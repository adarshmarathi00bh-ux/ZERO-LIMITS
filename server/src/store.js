import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_MENU } from './menu.js';

const FILE = process.env.DB_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/db.json');

export function loadDb() {
  const config = { capacity: Number(process.env.SLOT_CAPACITY) || 40 };
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return { ...saved, config };
  } catch {
    return { menu: structuredClone(SEED_MENU), orders: [], points: {}, config };
  }
}

// Debounced JSON persistence: zero native dependencies, swap for Postgres later.
export function makeSaver(db) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify({ menu: db.menu, orders: db.orders, points: db.points }));
      } catch (e) { console.warn('Could not save db:', e.message); }
    }, 400);
  };
}
