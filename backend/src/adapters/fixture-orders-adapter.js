import { readFile } from 'node:fs/promises';
import { normalizeOrdersItem } from './orders-normalize.js';

export class FixtureOrdersAdapter {
  constructor({ fixturePath }) {
    this.fixturePath = fixturePath;
  }

  async fetchProducts() {
    const raw = JSON.parse(await readFile(this.fixturePath, 'utf8'));
    const items = Array.isArray(raw) ? raw : raw.items;
    if (!Array.isArray(items)) throw new Error('Fixture must contain an items array');
    return { items: items.map(normalizeOrdersItem), next_cursor: null };
  }
}
