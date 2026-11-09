import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { socket } from './socket.js';
import { toast, fmtTime, useNow } from './util.js';

const NEXT = { PLACED: ['ACCEPTED', 'Accept'], ACCEPTED: ['PREPARING', 'Start cooking'], PREPARING: ['READY', 'Mark ready'], READY: ['PICKED_UP', 'Handed over'] };
const COLS = [['Incoming', ['PLACED', 'ACCEPTED']], ['On the stove', ['PREPARING']], ['Ready for pickup', ['READY']]];

export default function Kitchen({ pin }) {
  const [orders, setOrders] = useState([]);
  const now = useNow(15000);
  const ctx = useRef(null);

  const load = useCallback(() => api.kitchen(pin).then((d) => setOrders(d.orders)).catch((e) => toast(e.message)), [pin]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const beep = () => {
      try {
        ctx.current = ctx.current || new AudioContext();
        const o = ctx.current.createOscillator(); const g = ctx.current.createGain();
        o.frequency.value = 880; g.gain.value = 0.08;
        o.connect(g); g.connect(ctx.current.destination); o.start(); o.stop(ctx.current.currentTime + 0.18);
      } catch { /* audio is a bonus */ }
    };
    const added = () => { beep(); load(); };
    socket.on('order:new', added); socket.on('order:update', load);
    return () => { socket.off('order:new', added); socket.off('order:update', load); };
  }, [load]);

  // What to cook, grouped by pickup window.
  const prep = useMemo(() => {
    const bySlot = new Map();
    for (const o of orders) {
      if (o.status === 'READY') continue;
      const m = bySlot.get(o.slotId) || new Map();
      o.items.forEach((i) => m.set(i.name, (m.get(i.name) || 0) + i.qty));
      bySlot.set(o.slotId, m);
    }
    return [...bySlot].sort((a, b) => a[0] - b[0]).slice(0, 4);
  }, [orders]);

  const advance = (o) => api.setStatus(o.id, NEXT[o.status][0], pin).catch((e) => toast(e.message));

  return (
    <div className="kitchen">
      <section className="card prep">
        <h2>Cook list by pickup window</h2>
        {prep.length === 0 ? <p className="empty">Nothing to cook. New orders land here the moment students place them.</p> : (
          <div className="prep-grid">
            {prep.map(([slot, items]) => (
              <div key={slot}>
                <h3>{fmtTime(slot)}</h3>
                <ul>{[...items].map(([n, q]) => <li key={n}><b>{q}×</b> {n}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="cols">
        {COLS.map(([title, sts]) => {
          const list = orders.filter((o) => sts.includes(o.status));
          return (
            <section key={title} className="col">
              <h2>{title} <span className="count">{list.length}</span></h2>
              {list.map((o) => {
                const mins = Math.round((o.slotId - now) / 60000);
                return (
                  <article key={o.id} className={`k-card ${mins <= 3 && o.status !== 'READY' ? 'urgent' : ''}`}>
                    <header><span className="code">{o.code}</span><div><strong>{o.name}</strong><small>{fmtTime(o.slotId)} pickup, {mins > 0 ? `in ${mins} min` : 'due now'}</small></div></header>
                    <ul>{o.items.map((i) => <li key={i.id}><b>{i.qty}×</b> {i.name}{i.notes && <em> {i.notes}</em>}</li>)}</ul>
                    <button className="btn wide" onClick={() => advance(o)}>{NEXT[o.status][1]}</button>
                  </article>
                );
              })}
              {!list.length && <p className="empty">All clear.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
