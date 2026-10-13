import { config } from '../config.js';
import { syncCatalogSource } from './catalog-sync.js';

let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await syncCatalogSource();
    console.log('catalog sync completed', result);
  } catch (error) {
    console.error('catalog sync failed', error);
  } finally {
    running = false;
  }
}

export function startSyncScheduler() {
  if (timer || config.syncIntervalSeconds <= 0) return;
  timer = setInterval(tick, config.syncIntervalSeconds * 1000);
  timer.unref?.();
}

export function stopSyncScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
