import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { socket } from './socket.js';
import { toast, rupees, fmtTime } from './util.js';
import Board from './Board.jsx';
import Tracker from './Tracker.jsx';

const EXAMPLES = ['2 masala dosa aur ek chai', 'veg sandwich no onion and a cold coffee', 'teen samosa and one lassi'];
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const saved = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export default function Student() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({}); // id -> { qty, notes }
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [info, setInfo] = useState(null);
  const [listening, setListening] = useState(false);
  const [name, setName] = useState(localStorage.getItem('qz_name') || '');
  const [classAt, setClassAt] = useState('');
  const [slotData, setSlotData] = useState(null);
  const [slotId, setSlotId] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [mine, setMine] = useState(() => saved('qz_orders', []));
  const [orders, setOrders] = useState([]);
  const [board, setBoard] = useState([]);
  const [cat, setCat] = useState('All');

  const need = useMemo(() => menu.reduce((s, m) => s + (cart[m.id]?.qty || 0) * m.prep, 0), [menu, cart]);
  const lines = menu.filter((m) => cart[m.id]?.qty);
  const total = lines.reduce((s, m) => s + m.price * cart[m.id].qty, 0);
  const classMs = useMemo(() => {
    if (!classAt) return null;
    const [h, m] = classAt.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.getTime();
  }, [classAt]);

  const loadMenu = useCallback(() => api.menu().then(setMenu).catch(() => {}), []);
  const loadSlots = useCallback(() => api.slots({ need: Math.max(need, 1), classStart: classMs }).then(setSlotData).catch(() => {}), [need, classMs]);
  const loadBoard = useCallback(() => api.leaderboard().then(setBoard).catch(() => {}), []);
  const loadMine = useCallback(() => (mine.length ? api.orders(mine).then(setOrders).catch(() => {}) : setOrders([])), [mine]);

  useEffect(() => { loadMenu(); loadBoard(); }, [loadMenu, loadBoard]);
  useEffect(() => { loadSlots(); const t = setInterval(loadSlots, 20000); return () => clearInterval(t); }, [loadSlots]);
  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => {
    const slots = () => { loadSlots(); loadBoard(); };
    const upd = (o) => {
      if (!mine.includes(o.id)) return;
      setOrders((p) => p.map((x) => (x.id === o.id ? o : x)));
      if (o.status === 'READY') toast(`Order ${o.code} is ready. Head to the counter.`);
    };
    socket.on('slots:changed', slots); socket.on('menu:changed', loadMenu); socket.on('order:update', upd);
    return () => { socket.off('slots:changed', slots); socket.off('menu:changed', loadMenu); socket.off('order:update', upd); };
  }, [loadSlots, loadBoard, loadMenu, mine]);

  // Drop the chosen slot if the tray grew past what it can hold.
  useEffect(() => {
    const s = slotData?.slots.find((x) => x.id === slotId);
    if (slotId && (!s || s.free < need)) setSlotId(null);
  }, [slotData, slotId, need]);

  const setQty = (id, d) => setCart((c) => {
    const qty = Math.max(0, Math.min(10, (c[id]?.qty || 0) + d));
    const n = { ...c, [id]: { ...c[id], qty } };
    if (!qty) delete n[id];
    return n;
  });
  const setNote = (id, notes) => setCart((c) => ({ ...c, [id]: { ...c[id], notes } }));

  async function understand(raw = text) {
    if (!raw.trim()) return;
    setParsing(true);
    try {
      const r = await api.parse(raw);
      setInfo(r);
      if (r.items.length) {
        setCart((c) => {
          const n = { ...c };
          r.items.forEach((i) => { n[i.id] = { qty: Math.min(10, (n[i.id]?.qty || 0) + i.qty), notes: i.notes || n[i.id]?.notes || '' }; });
          return n;
        });
        setText('');
      } else toast('No menu items found in that. Try naming a dish.');
    } catch (e) { toast(e.message); }
    setParsing(false);
  }

  function listen() {
    const r = new SR();
    r.lang = 'en-IN';
    r.onresult = (e) => { const t = e.results[0][0].transcript; setText(t); understand(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  async function place() {
    setPlacing(true);
    try {
      const o = await api.order({ name, slotId, items: lines.map((m) => ({ id: m.id, qty: cart[m.id].qty, notes: cart[m.id].notes })) });
      localStorage.setItem('qz_name', name);
      const ids = [o.id, ...mine].slice(0, 10);
      localStorage.setItem('qz_orders', JSON.stringify(ids));
      setMine(ids); setCart({}); setSlotId(null); setInfo(null);
      toast(o.points ? `Order placed. You earned ${o.points} Rush Saver points.` : 'Order placed. See you at the counter.');
      loadBoard();
    } catch (e) { toast(e.message); loadSlots(); }
    setPlacing(false);
  }

  async function cancel(id) {
    try { const o = await api.cancel(id); setOrders((p) => p.map((x) => (x.id === id ? o : x))); loadBoard(); } catch (e) { toast(e.message); }
  }

  const slots = slotData?.slots || [];
  const rec = slotData?.rec;
  const crowd = slots.length ? Math.round((slots.slice(0, 3).reduce((s, x) => s + x.ratio, 0) / Math.min(3, slots.length)) * 100) : 0;
  const cats = ['All', ...new Set(menu.map((m) => m.category))];
  const chosen = slots.find((s) => s.id === slotId);
  const bestId = rec?.class || rec?.quietest;

  return (
    <div className="layout">
      <section className="main">
        <div className="hero card">
          <h1>Tell us what you’re craving. We’ll find you a time with no queue.</h1>
          <p className="sub">The canteen is <b>{crowd}% busy</b> over the next 30 minutes. Write in English, Hindi or Hinglish. Typos are fine.</p>
          <div className="ask">
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="2 masala dosa aur ek chai, no sugar"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); understand(); } }} aria-label="Describe your order" />
            <div className="ask-actions">
              {SR && <button className={`btn ghost ${listening ? 'rec' : ''}`} onClick={listen} aria-label="Order by voice">{listening ? 'Listening…' : 'Speak'}</button>}
              <button className="btn" disabled={parsing || !text.trim()} onClick={() => understand()}>{parsing ? 'Reading…' : 'Add to tray'}</button>
            </div>
          </div>
          <div className="chips">{EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => { setText(e); understand(e); }}>{e}</button>)}</div>
          {info && (
            <p className="parse-note">
              {info.source === 'claude' ? 'Claude understood your order.' : 'Understood with the offline parser.'}
              {info.unmatched?.length > 0 && <> Not on the menu: <b>{info.unmatched.join(', ')}</b>.</>}
            </p>
          )}
        </div>

        <div className="sect-head"><h2>Menu</h2>
          <div className="chips">{cats.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
        </div>
        <div className="menu">
          {menu.filter((m) => cat === 'All' || m.category === cat).map((m) => (
            <div key={m.id} className={`item ${m.soldOut ? 'out' : ''}`}>
              <span className="emoji" aria-hidden="true">{m.emoji}</span>
              <div className="meta"><strong>{m.name}</strong><span>{rupees(m.price)}{m.stock > 0 && m.stock <= 8 && <em> Only {m.stock} left</em>}</span></div>
              {m.soldOut ? <span className="sold">Sold out</span> : (
                <div className="stepper">
                  <button onClick={() => setQty(m.id, -1)} disabled={!cart[m.id]} aria-label={`Remove one ${m.name}`}>−</button>
                  <output>{cart[m.id]?.qty || 0}</output>
                  <button onClick={() => setQty(m.id, 1)} aria-label={`Add one ${m.name}`}>+</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sect-head"><h2>Pickup board</h2>
          <label className="class-guard">Next class at
            <input type="time" value={classAt} onChange={(e) => setClassAt(e.target.value)} />
          </label>
        </div>
        <p className="hint">Each row is a 10-minute pickup window. Fewer lit blocks means a calmer kitchen and more points for you.{need === 0 && ' Add something to your tray to see which windows fit.'}</p>
        {slots.length ? <Board slots={slots} rec={rec} selected={slotId} onSelect={setSlotId} need={Math.max(need, 1)} /> : <p className="empty">Loading pickup times…</p>}
        {need > 0 && bestId && slotId !== bestId && (
          <button className="btn ghost wide" onClick={() => setSlotId(bestId)}>
            Pick the best time for me ({fmtTime(bestId)}{classMs && rec?.class ? ', gets you to class' : ', quietest'})
          </button>
        )}
      </section>

      <aside className="side">
        <div className="card tray">
          <h2>Your tray</h2>
          {!lines.length ? <p className="empty">Nothing yet. Describe your meal above or tap + on the menu.</p> : (
            <ul>
              {lines.map((m) => (
                <li key={m.id}>
                  <div><b>{cart[m.id].qty} × {m.name}</b><span>{rupees(m.price * cart[m.id].qty)}</span></div>
                  <input value={cart[m.id].notes || ''} onChange={(e) => setNote(m.id, e.target.value)} placeholder="Add a note (no onion…)" aria-label={`Note for ${m.name}`} maxLength={60} />
                </li>
              ))}
            </ul>
          )}
          <div className="sum"><span>Total</span><b>{rupees(total)}</b></div>
          <input className="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={30} aria-label="Your name" />
          <p className="hint">{chosen ? `Pickup at ${fmtTime(chosen.start)}${chosen.eco ? `, earns ${chosen.eco} points` : ''}` : 'Choose a pickup time on the board.'} Pay at the counter.</p>
          <button className="btn wide" disabled={placing || !lines.length || !chosen || !name.trim()} onClick={place}>{placing ? 'Placing…' : 'Place order'}</button>
        </div>

        <div className="card"><h2>Your orders</h2><Tracker orders={orders} onCancel={cancel} /></div>

        <div className="card">
          <h2>Rush Savers</h2>
          <p className="hint">Book quiet slots, earn points, keep the line short for everyone.</p>
          {board.length ? <ol className="lb">{board.map((p, i) => <li key={p.name}><span>{i + 1}</span>{p.name}<b>{p.pts}</b></li>)}</ol> : <p className="empty">Be the first on the board.</p>}
        </div>
      </aside>
    </div>
  );
}
