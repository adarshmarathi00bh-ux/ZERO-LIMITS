import { buildSlots, orderLoad, ecoPoints, reflow } from './slots.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const FLOW = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['PICKED_UP', 'NO_SHOW'],
};
export const isClosed = (o) => ['PICKED_UP', 'CANCELLED', 'NO_SHOW'].includes(o.status);

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode(db) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!db.orders.some((o) => o.code === c && !isClosed(o))) return c;
  }
}

export const soldOut = (m) => !m.available || m.stock <= 0;

// Runs synchronously on a single thread, so the capacity check and the insert
// can never interleave: two students can't take the last space in a slot.
export function createOrder(db, { name, items, slotId }, now = Date.now(), { autoReflow = false } = {}) {
  name = String(name || '').trim().slice(0, 30);
  if (!name) throw new HttpError(400, 'Enter your name so the kitchen can call it out.');
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Your tray is empty.');

  const byId = Object.fromEntries(db.menu.map((m) => [m.id, m]));
  const merged = new Map();
  for (const it of items) {
    const m = byId[it.id];
    if (!m) throw new HttpError(400, 'One of those items is not on the menu.');
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, 'Pick 1 to 10 of each item.');
    const cur = merged.get(m.id) || { id: m.id, name: m.name, price: m.price, qty: 0, notes: '' };
    cur.qty += qty;
    if (it.notes) cur.notes = String(it.notes).slice(0, 60);
    merged.set(m.id, cur);
  }
  const lines = [...merged.values()];
  for (const l of lines) {
    const m = byId[l.id];
    if (soldOut(m)) throw new HttpError(409, `${m.name} is sold out.`);
    if (m.stock < l.qty) throw new HttpError(409, `Only ${m.stock} ${m.name} left.`);
  }

  const load = orderLoad(lines, byId);
  if (load > db.config.capacity) throw new HttpError(400, 'That order is too big for one pickup slot. Split it into two orders.');
  const slots = buildSlots(now, db.orders, db.config);
  let slot = slots.find((s) => s.id === Number(slotId));
  let reflowed = false;
  if (autoReflow && (!slot || slot.free < load)) {
    slot = reflow(slots, load, Number(slotId) || slots[0].id);
    reflowed = true;
  }
  if (!slot) throw new HttpError(400, 'That pickup time is no longer available.');
  if (slot.free < load) throw new HttpError(409, 'That slot just filled up. Pick another time.');

  const points = ecoPoints(slot);
  lines.forEach((l) => { byId[l.id].stock -= l.qty; });
  const order = {
    id: `o_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    code: makeCode(db), name, items: lines, load, slotId: slot.id,
    total: lines.reduce((s, l) => s + l.price * l.qty, 0),
    status: 'PLACED', points, reflowed, createdAt: now,
  };
  db.orders.push(order);
  if (points) {
    const key = name.toLowerCase();
    db.points[key] = { name, pts: (db.points[key]?.pts || 0) + points };
  }
  return order;
}

export function setStatus(db, id, to, now = Date.now()) {
  const o = db.orders.find((x) => x.id === id);
  if (!o) throw new HttpError(404, 'Order not found.');
  if (!(FLOW[o.status] || []).includes(to)) throw new HttpError(409, `Can't move an order from ${o.status} to ${to}.`);
  if (to === 'CANCELLED') {
    o.items.forEach((l) => { const m = db.menu.find((x) => x.id === l.id); if (m) m.stock += l.qty; });
    const p = db.points[o.name.toLowerCase()];
    if (p) p.pts = Math.max(0, p.pts - (o.points || 0));
  }
  if (to === 'READY') o.readyAt = now;
  if (to === 'PICKED_UP') o.pickedAt = now;
  o.status = to;
  return o;
}

export function releaseNoShows(db, minutes, now = Date.now()) {
  const out = [];
  for (const o of db.orders) {
    if (o.status === 'READY' && now - o.readyAt > minutes * 60_000) { o.status = 'NO_SHOW'; out.push(o); }
  }
  return out;
}
