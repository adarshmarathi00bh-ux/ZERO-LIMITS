import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { loadDb, makeSaver } from './store.js';
import { buildSlots, recommend, ecoPoints } from './slots.js';
import { createOrder, setStatus, releaseNoShows, isClosed, soldOut } from './orders.js';
import { parseOrder } from './parser.js';
import { askClaude, aiEnabled } from './ai.js';
import { stats, ruleInsights } from './stats.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json({ limit: '20kb' }));

const db = loadDb();
const persist = makeSaver(db);
const PINS = { kitchen: process.env.KITCHEN_PIN || '1111', manager: process.env.MANAGER_PIN || '2222' };
const NOSHOW_MIN = Number(process.env.NOSHOW_MINUTES) || 10;

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong on our side.' });
  }
};
const need = (role) => (req, res, next) => {
  const pin = req.get('x-pin');
  if (pin === PINS.manager || (role === 'kitchen' && pin === PINS.kitchen)) return next();
  res.status(401).json({ error: 'That PIN is not right.' });
};
const changed = (event, order) => { io.emit(event, order); io.emit('slots:changed'); persist(); };

// Small per-IP limiter so the AI endpoint can't burn through an API key.
const hits = new Map();
const limit = (req, res, next) => {
  const k = req.ip; const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 30) return res.status(429).json({ error: 'Slow down a little and try again in a minute.' });
  hits.set(k, [...arr, now]); next();
};

app.get('/api/config', (_req, res) => res.json({ ai: aiEnabled(), capacity: db.config.capacity }));
app.post('/api/auth', (req, res) => {
  const pin = String(req.body.pin || '');
  if (pin === PINS.manager) return res.json({ role: 'manager' });
  if (pin === PINS.kitchen) return res.json({ role: 'kitchen' });
  res.status(401).json({ error: 'That PIN is not right.' });
});

app.get('/api/menu', (_req, res) => res.json(db.menu.map((m) => ({ ...m, soldOut: soldOut(m) }))));

app.post('/api/parse', limit, wrap(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) throw Object.assign(new Error('Type or say what you want to eat.'), { status: 400 });
  res.json(await parseOrder(text, db.menu.filter((m) => !soldOut(m))));
}));

app.get('/api/slots', (req, res) => {
  const now = Date.now();
  const slots = buildSlots(now, db.orders, db.config);
  const classStart = Number(req.query.classStart) || null;
  res.json({ now, slots: slots.map((s) => ({ ...s, eco: ecoPoints(s) })), rec: recommend(slots, { need: Number(req.query.need) || 1, classStart }) });
});

app.post('/api/orders', wrap((req, res) => {
  const order = createOrder(db, req.body);
  changed('order:new', order);
  res.status(201).json(order);
}));
app.get('/api/orders', (req, res) => {
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 20);
  res.json(db.orders.filter((o) => ids.includes(o.id)).sort((a, b) => b.createdAt - a.createdAt));
});
app.post('/api/orders/:id/cancel', wrap((req, res) => {
  const o = setStatus(db, req.params.id, 'CANCELLED');
  changed('order:update', o); res.json(o);
}));
app.patch('/api/orders/:id/status', need('kitchen'), wrap((req, res) => {
  const o = setStatus(db, req.params.id, String(req.body.status));
  changed('order:update', o); res.json(o);
}));

app.get('/api/kitchen', need('kitchen'), (_req, res) =>
  res.json({ now: Date.now(), orders: db.orders.filter((o) => !isClosed(o)).sort((a, b) => a.slotId - b.slotId || a.createdAt - b.createdAt) }));

app.get('/api/leaderboard', (_req, res) => res.json(Object.values(db.points).sort((a, b) => b.pts - a.pts).slice(0, 5)));

app.get('/api/stats', need('manager'), (_req, res) => res.json(stats(db)));
app.get('/api/insights', need('manager'), wrap(async (_req, res) => {
  const s = stats(db);
  let ai = null;
  try {
    ai = await askClaude({
      system: 'You are the operations copilot for a college canteen. Give exactly 3 short, concrete suggestions as a numbered list. Times are epoch milliseconds: write them as [[epochMs]] unchanged.',
      prompt: JSON.stringify({ ...s, lowStock: db.menu.filter((m) => m.stock <= 8).map((m) => [m.name, m.stock]) }),
    });
  } catch (e) { console.warn('Insights AI failed:', e.message); }
  res.json({ rules: ruleInsights(s, db), ai });
}));
app.patch('/api/menu/:id', need('manager'), wrap((req, res) => {
  const m = db.menu.find((x) => x.id === req.params.id);
  if (!m) throw Object.assign(new Error('Item not found.'), { status: 404 });
  if (typeof req.body.available === 'boolean') m.available = req.body.available;
  if (Number.isInteger(req.body.stock) && req.body.stock >= 0) m.stock = req.body.stock;
  io.emit('menu:changed'); io.emit('slots:changed'); persist(); res.json(m);
}));

// Demo mode: everyone wants the same three slots; the balancer spreads the rest.
const NAMES = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Isha', 'Vihaan', 'Anaya', 'Arjun', 'Saanvi', 'Neel', 'Tara'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
app.post('/api/demo/rush', need('manager'), wrap((req, res) => {
  const n = Math.min(Number(req.body.count) || 20, 40);
  let created = 0; let reflowed = 0;
  for (let i = 0; i < n; i++) {
    const avail = db.menu.filter((m) => !soldOut(m));
    if (!avail.length) break;
    const items = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({ id: pick(avail).id, qty: 1 + Math.floor(Math.random() * 2) }));
    const slots = buildSlots(Date.now(), db.orders, db.config);
    try {
      const o = createOrder(db, { name: pick(NAMES), items, slotId: slots[Math.floor(Math.random() * 3)].id }, Date.now(), { autoReflow: true });
      created++; if (o.reflowed) reflowed++;
      io.emit('order:new', o);
    } catch { /* stock ran out mid-rush, fine */ }
  }
  io.emit('slots:changed'); persist();
  res.json({ created, reflowed });
}));

setInterval(() => {
  const released = releaseNoShows(db, NOSHOW_MIN);
  released.forEach((o) => io.emit('order:update', o));
  if (released.length) { io.emit('slots:changed'); persist(); }
}, 30_000).unref();

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`QueueZero API on http://localhost:${PORT}  (AI: ${aiEnabled() ? 'Claude' : 'offline parser'})`));
