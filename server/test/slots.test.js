import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots, recommend, reflow, SLOT_MS } from '../src/slots.js';

const NOW = Date.UTC(2026, 10, 12, 6, 3); // 06:03 UTC

test('first slot respects the booking cutoff and slots are 10 minutes apart', () => {
  const s = buildSlots(NOW, [], { capacity: 40 });
  assert.ok(s[0].start >= NOW + 4 * 60_000);
  assert.equal(s[1].start - s[0].start, SLOT_MS);
});

test('cancelled and no-show orders do not consume capacity', () => {
  const first = buildSlots(NOW, [], {})[0].id;
  const orders = [
    { slotId: first, load: 20, status: 'PLACED' },
    { slotId: first, load: 15, status: 'CANCELLED' },
    { slotId: first, load: 15, status: 'NO_SHOW' },
  ];
  const s = buildSlots(NOW, orders, { capacity: 40 })[0];
  assert.equal(s.load, 20);
  assert.equal(s.free, 20);
});

test('recommend finds soonest, quietest and class-safe slots', () => {
  const base = buildSlots(NOW, [], { capacity: 40 });
  const orders = [{ slotId: base[0].id, load: 30, status: 'PLACED' }, { slotId: base[1].id, load: 25, status: 'PLACED' }];
  const slots = buildSlots(NOW, orders, { capacity: 40 });
  const r = recommend(slots, { need: 10, classStart: slots[4].end + 5 * 60_000 });
  assert.equal(r.fastest, slots[0].id); // first slot still has exactly 10 units free
  assert.equal(slots.find((s) => s.id === r.quietest).ratio, 0);
  assert.ok(slots.find((s) => s.id === r.class).end + 4 * 60_000 <= slots[4].end + 5 * 60_000);
});

test('reflow moves a full slot to the nearest slot with room', () => {
  const base = buildSlots(NOW, [], { capacity: 40 });
  const orders = [{ slotId: base[2].id, load: 40, status: 'PLACED' }];
  const slots = buildSlots(NOW, orders, { capacity: 40 });
  const moved = reflow(slots, 10, slots[2].id);
  assert.notEqual(moved.id, slots[2].id);
  assert.equal(Math.abs(moved.id - slots[2].id), SLOT_MS);
});
