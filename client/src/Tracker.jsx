import { fmtTime, useNow } from './util.js';

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP'];
const LABEL = { PLACED: 'Sent', ACCEPTED: 'Accepted', PREPARING: 'Cooking', READY: 'Ready', PICKED_UP: 'Picked up' };

export default function Tracker({ orders, onCancel }) {
  const now = useNow(15000);
  if (!orders.length) return <p className="empty">Orders you place show up here with a live pickup code.</p>;
  return orders.map((o) => {
    const idx = STEPS.indexOf(o.status);
    const closed = o.status === 'CANCELLED' || o.status === 'NO_SHOW';
    const mins = Math.round((o.slotId - now) / 60000);
    const note = closed
      ? (o.status === 'CANCELLED' ? 'Cancelled' : 'Pickup missed, slot released')
      : o.status === 'READY' ? 'Ready now. Show this code at the counter.'
      : o.status === 'PICKED_UP' ? 'Enjoy your meal'
      : mins > 0 ? `Pickup opens in ${mins} min` : 'Pickup window is open';
    return (
      <article className={`ticket st-${o.status}`} key={o.id}>
        <header>
          <span className="code">{o.code}</span>
          <div><strong>{fmtTime(o.slotId)} pickup</strong><small>{note}</small></div>
        </header>
        <ul>{o.items.map((i) => <li key={i.id}>{i.qty} × {i.name}{i.notes && <em> ({i.notes})</em>}</li>)}</ul>
        {!closed && <ol className="steps">{STEPS.map((s, k) => <li key={s} className={k <= idx ? 'done' : ''}>{LABEL[s]}</li>)}</ol>}
        {(o.status === 'PLACED' || o.status === 'ACCEPTED') && <button className="link" onClick={() => onCancel(o.id)}>Cancel this order</button>}
      </article>
    );
  });
}
