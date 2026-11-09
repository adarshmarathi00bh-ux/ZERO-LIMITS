// Pure, dependency-free load-balancing core. Everything the kitchen can handle is
// modelled as "prep units" per 10-minute slot. Tested in test/slots.test.js.
export const SLOT_MIN = 10;
export const SLOT_MS = SLOT_MIN * 60_000;
export const DEFAULT_CONFIG = { capacity: 40, cutoffMs: 4 * 60_000, count: 18 };

export const slotStart = (ts) => Math.floor(ts / SLOT_MS) * SLOT_MS;

export function orderLoad(lines, menuById) {
  return lines.reduce((sum, l) => sum + menuById[l.id].prep * l.qty, 0);
}

export const levelOf = (ratio) => (ratio < 0.45 ? 'quiet' : ratio < 0.8 ? 'busy' : 'packed');

// Rush Saver reward: the quieter the slot you choose, the more points you earn.
export const ecoPoints = (slot) => (slot.ratio < 0.45 ? 10 : slot.ratio < 0.7 ? 5 : 0);

export function buildSlots(now, orders, cfg = {}) {
  const { capacity, cutoffMs, count } = { ...DEFAULT_CONFIG, ...cfg };
  const used = new Map();
  for (const o of orders) {
    if (o.status === 'CANCELLED' || o.status === 'NO_SHOW') continue;
    used.set(o.slotId, (used.get(o.slotId) || 0) + o.load);
  }
  let t = slotStart(now);
  while (t < now + cutoffMs) t += SLOT_MS;
  return Array.from({ length: count }, (_, i) => {
    const start = t + i * SLOT_MS;
    const load = used.get(start) || 0;
    const ratio = Math.min(load / capacity, 1);
    return { id: start, start, end: start + SLOT_MS, capacity, load, free: Math.max(capacity - load, 0), ratio, level: levelOf(ratio) };
  });
}

// Picks three "best" slots for an order that needs `need` units.
export function recommend(slots, { need = 1, classStart = null, walkMs = 4 * 60_000 } = {}) {
  const ok = slots.filter((s) => s.free >= need);
  if (!ok.length) return { fastest: null, quietest: null, class: null };
  const lowest = (list) => list.reduce((b, s) => (s.ratio < b.ratio ? s : b));
  const safe = classStart ? ok.filter((s) => s.end + walkMs <= classStart) : [];
  return { fastest: ok[0].id, quietest: lowest(ok).id, class: safe.length ? lowest(safe).id : null };
}

// When the wanted slot is full, move the order to the nearest slot that has room.
export function reflow(slots, need, preferredId) {
  const ok = slots.filter((s) => s.free >= need);
  if (!ok.length) return null;
  const pref = ok.find((s) => s.id === preferredId);
  if (pref) return pref;
  return ok.reduce((b, s) => (Math.abs(s.id - preferredId) < Math.abs(b.id - preferredId) ? s : b));
}
