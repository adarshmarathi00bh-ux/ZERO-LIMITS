import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, setStatus, HttpError } from '../src/orders.js';
import { buildSlots } from '../src/slots.js';
import { SEED_MENU } from '../src/menu.js';

const NOW = Date.UTC(2026, 10, 12, 6, 3);
const fresh = () => ({ menu: structuredClone(SEED_MENU), orders: [], points: {}, config: { capacity: 40 } });
const slot0 = (db) => buildSlots(NOW, db.orders, db.config)[0].id;

test('order is created, stock drops, quiet slot earns points', () => {
  const db = fresh();
  const o = createOrder(db, { name: 'Asha', items: [{ id: 'dosa', qty: 2 }], slotId: slot0(db) }, NOW);
  assert.equal(o.total, 120);
  assert.equal(o.load, 8);
  assert.equal(o.points, 10);
  assert.equal(db.menu.find((m) => m.id === 'dosa').stock, 38);
  assert.equal(o.code.length, 4);
});

test('a full slot rejects the next order (no double booking)', () => {
  const db = fresh();
  const id = slot0(db);
  for (let i = 0; i < 4; i++) createOrder(db, { name: 'A' + i, items: [{ id: 'thali', qty: 2 }], slotId: id }, NOW); // 4 x 10 = 40
  assert.throws(() => createOrder(db, { name: 'Late', items: [{ id: 'chai', qty: 1 }], slotId: id }, NOW), (e) => e instanceof HttpError && e.status === 409);
});

test('auto reflow moves overflow to a nearby slot', () => {
  const db = fresh();
  const id = slot0(db);
  for (let i = 0; i < 4; i++) createOrder(db, { name: 'A' + i, items: [{ id: 'thali', qty: 2 }], slotId: id }, NOW);
  const o = createOrder(db, { name: 'B', items: [{ id: 'chai', qty: 1 }], slotId: id }, NOW, { autoReflow: true });
  assert.notEqual(o.slotId, id);
  assert.equal(o.reflowed, true);
});

test('cancelling restores stock and frees the slot', () => {
  const db = fresh();
  const id = slot0(db);
  const o = createOrder(db, { name: 'C', items: [{ id: 'dosa', qty: 3 }], slotId: id }, NOW);
  setStatus(db, o.id, 'CANCELLED', NOW);
  assert.equal(db.menu.find((m) => m.id === 'dosa').stock, 40);
  assert.equal(buildSlots(NOW, db.orders, db.config)[0].free, 40);
});

test('status flow cannot skip steps', () => {
  const db = fresh();
  const o = createOrder(db, { name: 'D', items: [{ id: 'chai', qty: 1 }], slotId: slot0(db) }, NOW);
  assert.throws(() => setStatus(db, o.id, 'READY'), HttpError);
  setStatus(db, o.id, 'ACCEPTED'); setStatus(db, o.id, 'PREPARING'); setStatus(db, o.id, 'READY');
  assert.equal(setStatus(db, o.id, 'PICKED_UP').status, 'PICKED_UP');
});
