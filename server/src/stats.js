import { buildSlots } from './slots.js';

const MIN_SAVED_PER_ORDER = 12; // typical queue time avoided, used for the impact counter

export function stats(db, now = Date.now()) {
  const done = db.orders.filter((o) => o.status !== 'CANCELLED');
  const top = new Map();
  for (const o of done) for (const l of o.items) top.set(l.name, (top.get(l.name) || 0) + l.qty);
  return {
    orders: done.length,
    revenue: done.reduce((s, o) => s + o.total, 0),
    minutesSaved: done.length * MIN_SAVED_PER_ORDER,
    noShows: db.orders.filter((o) => o.status === 'NO_SHOW').length,
    reflowed: done.filter((o) => o.reflowed).length,
    top: [...top].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty })),
    slots: buildSlots(now, db.orders, db.config).map((s) => ({ id: s.id, ratio: s.ratio, load: s.load, capacity: s.capacity })),
  };
}

// Times are written as [[epochMs]] so the browser can format them in the viewer's timezone.
export function ruleInsights(s, db) {
  const out = [];
  if (s.slots.length) {
    const peak = s.slots.reduce((b, x) => (x.ratio > b.ratio ? x : b));
    const calm = s.slots.reduce((b, x) => (x.ratio < b.ratio ? x : b));
    if (peak.ratio >= 0.7) out.push(`The [[${peak.id}]] slot is ${Math.round(peak.ratio * 100)}% full. Offer double Rush Saver points on [[${calm.id}]] to move orders there.`);
  }
  for (const m of db.menu) if (m.available && m.stock > 0 && m.stock <= 8) out.push(`${m.name} has only ${m.stock} left. Restock before the next rush.`);
  if (s.noShows) out.push(`${s.noShows} order(s) were never picked up. Keep the 10-minute hold rule and send a "ready" notification.`);
  if (s.top[0]) out.push(`${s.top[0].name} is the top seller (${s.top[0].qty}). Start a batch 10 minutes before each busy slot.`);
  return out.length ? out : ['No pressure points right now. Place a few orders or run the rush simulation to see insights.'];
}
