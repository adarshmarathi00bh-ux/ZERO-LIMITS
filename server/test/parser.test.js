import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocal } from '../src/parser.js';
import { SEED_MENU } from '../src/menu.js';

const get = (text) => Object.fromEntries(parseLocal(text, SEED_MENU).items.map((i) => [i.id, i]));

test('English quantities and conjunctions', () => {
  const r = get('2 masala dosa and a tea');
  assert.equal(r.dosa.qty, 2);
  assert.equal(r.chai.qty, 1);
});

test('Hinglish number words', () => {
  const r = get('teen samosa aur ek lassi chahiye bhai');
  assert.equal(r.samosa.qty, 3);
  assert.equal(r.lassi.qty, 1);
});

test('typos are tolerated', () => {
  assert.equal(get('masla dosa').dosa.qty, 1);
  assert.equal(get('two samosaa').samosa.qty, 2);
});

test('notes attach to the right item', () => {
  const r = get('veg sandwich no onion and 2 chai less sugar');
  assert.match(r.sandwich.notes, /no onion/);
  assert.match(r.chai.notes, /less sugar/);
  assert.equal(r.chai.qty, 2);
});

test('longest menu name wins (cold coffee is not coffee)', () => {
  const r = get('one cold coffee');
  assert.ok(r.coldcoffee);
  assert.equal(r.coffee, undefined);
});

test('unknown words are reported', () => {
  const p = parseLocal('1 pizza and 1 chai', SEED_MENU);
  assert.ok(p.unmatched.includes('pizza'));
});
