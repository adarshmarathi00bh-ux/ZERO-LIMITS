import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { socket } from './socket.js';
import { toast, fmtTime, rupees, withTimes } from './util.js';

export default function Manager({ pin }) {
  const [s, setS] = useState(null);
  const [menu, setMenu] = useState([]);
  const [ins, setIns] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api.stats(pin).then(setS).catch((e) => toast(e.message));
    api.menu().then(setMenu).catch(() => {});
  }, [pin]);
  useEffect(() => {
    load();
    socket.on('slots:changed', load); socket.on('menu:changed', load);
    return () => { socket.off('slots:changed', load); socket.off('menu:changed', load); };
  }, [load]);

  async function rush() {
    setBusy('rush');
    try {
      const r = await api.rush(pin);
      toast(`${r.created} orders arrived. The balancer moved ${r.reflowed} of them to quieter slots.`);
    } catch (e) { toast(e.message); }
    setBusy('');
  }
  async function askAi() {
    setBusy('ai');
    try { setIns(await api.insights(pin)); } catch (e) { toast(e.message); }
    setBusy('');
  }
  const patch = (id, body) => api.patchMenu(id, body, pin).then(load).catch((e) => toast(e.message));

  if (!s) return <p className="empty">Loading numbers…</p>;
  const maxTop = Math.max(1, ...s.top.map((t) => t.qty));

  return (
    <div className="manager">
      <section className="card kpis">
        <div><b>{s.orders}</b><span>Orders</span></div>
        <div><b>{rupees(s.revenue)}</b><span>Sales</span></div>
        <div><b>{s.minutesSaved}</b><span>Student minutes not spent in a queue</span></div>
        <div><b>{s.reflowed}</b><span>Orders the balancer moved to a calmer slot</span></div>
        <div><b>{s.noShows}</b><span>Missed pickups</span></div>
      </section>

      <section className="card">
        <div className="sect-head"><h2>Kitchen load, next 3 hours</h2>
          <button className="btn" disabled={busy === 'rush'} onClick={rush}>{busy === 'rush' ? 'Simulating…' : 'Simulate a lunch rush'}</button>
        </div>
        <div className="bars" role="img" aria-label="Kitchen load per pickup slot">
          {s.slots.map((x) => (
            <div key={x.id} className="bar" title={`${fmtTime(x.id)}: ${x.load} of ${x.capacity} units`}>
              <i className={x.ratio >= 0.8 ? 'hot' : x.ratio >= 0.45 ? 'mid' : ''} style={{ height: `${Math.max(4, x.ratio * 100)}%` }} />
              <span>{fmtTime(x.id).replace(' ', '').toLowerCase()}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="two">
        <section className="card">
          <div className="sect-head"><h2>Copilot</h2><button className="btn ghost" disabled={busy === 'ai'} onClick={askAi}>{busy === 'ai' ? 'Thinking…' : 'Get suggestions'}</button></div>
          {!ins ? <p className="empty">Ask for a plan based on today’s orders, stock and slot load.</p> : (
            <>
              <ul className="ins">{ins.rules.map((r) => <li key={r}>{withTimes(r)}</li>)}</ul>
              {ins.ai && <div className="ai-box"><b>Claude suggests</b><p>{withTimes(ins.ai)}</p></div>}
            </>
          )}
        </section>
        <section className="card">
          <h2>Best sellers</h2>
          {s.top.length ? s.top.map((t) => (
            <div key={t.name} className="hbar"><span>{t.name}</span><i style={{ width: `${(t.qty / maxTop) * 100}%` }} /><b>{t.qty}</b></div>
          )) : <p className="empty">No sales yet.</p>}
        </section>
      </div>

      <section className="card">
        <h2>Menu and stock</h2>
        <div className="mtable">
          {menu.map((m) => (
            <div key={m.id} className="mrow">
              <span>{m.emoji} {m.name}</span>
              <label>Stock <input type="number" min="0" defaultValue={m.stock} key={m.stock} onBlur={(e) => Number(e.target.value) !== m.stock && patch(m.id, { stock: Number(e.target.value) })} /></label>
              <button className={`chip ${m.available ? 'on' : ''}`} onClick={() => patch(m.id, { available: !m.available })}>{m.available ? 'Available' : 'Hidden'}</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
