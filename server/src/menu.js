// prep = kitchen effort units. A 10-minute slot holds SLOT_CAPACITY units (default 40).
export const SEED_MENU = [
  { id: 'dosa', name: 'Masala Dosa', emoji: '🥞', price: 60, category: 'Tiffin', prep: 4, stock: 40, aliases: ['dosa', 'dosai', 'masala dosa'] },
  { id: 'idli', name: 'Idli Sambar', emoji: '🍚', price: 40, category: 'Tiffin', prep: 2, stock: 60, aliases: ['idli', 'idly'] },
  { id: 'vada', name: 'Medu Vada', emoji: '🍩', price: 35, category: 'Tiffin', prep: 2, stock: 50, aliases: ['vada', 'wada', 'medu vada'] },
  { id: 'vadapav', name: 'Vada Pav', emoji: '🍔', price: 25, category: 'Snacks', prep: 2, stock: 60, aliases: ['vada pav', 'vadapav', 'wada pav'] },
  { id: 'samosa', name: 'Samosa', emoji: '🔺', price: 20, category: 'Snacks', prep: 1, stock: 80, aliases: ['samosa', 'samosas'] },
  { id: 'sandwich', name: 'Veg Grilled Sandwich', emoji: '🥪', price: 50, category: 'Snacks', prep: 3, stock: 40, aliases: ['sandwich', 'veg sandwich', 'grilled sandwich'] },
  { id: 'maggi', name: 'Masala Maggi', emoji: '🍜', price: 45, category: 'Meals', prep: 3, stock: 40, aliases: ['maggi', 'noodles', 'masala maggi'] },
  { id: 'friedrice', name: 'Veg Fried Rice', emoji: '🥘', price: 80, category: 'Meals', prep: 5, stock: 30, aliases: ['fried rice', 'veg rice'] },
  { id: 'thali', name: 'Mini Thali', emoji: '🍛', price: 90, category: 'Meals', prep: 5, stock: 30, aliases: ['thali', 'meal', 'mini thali'] },
  { id: 'chai', name: 'Masala Chai', emoji: '🫖', price: 15, category: 'Drinks', prep: 1, stock: 150, aliases: ['chai', 'tea', 'chaya', 'masala chai'] },
  { id: 'coffee', name: 'Filter Coffee', emoji: '☕', price: 20, category: 'Drinks', prep: 1, stock: 100, aliases: ['coffee', 'kaapi', 'filter coffee'] },
  { id: 'coldcoffee', name: 'Cold Coffee', emoji: '🧋', price: 50, category: 'Drinks', prep: 2, stock: 50, aliases: ['cold coffee', 'iced coffee'] },
  { id: 'lassi', name: 'Sweet Lassi', emoji: '🥛', price: 35, category: 'Drinks', prep: 1, stock: 50, aliases: ['lassi'] },
  { id: 'brownie', name: 'Choco Brownie', emoji: '🍫', price: 40, category: 'Sweet', prep: 1, stock: 40, aliases: ['brownie', 'dessert'] },
].map((m) => ({ ...m, available: true }));
