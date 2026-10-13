import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { initObservability } from './observability.js';
import { startSyncScheduler, stopSyncScheduler } from './services/sync-scheduler.js';

initObservability();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`catalog-backend listening on ${config.port} release=${config.release} standalone=${config.standaloneMode}`);
  if (!config.standaloneMode) startSyncScheduler();
});

const stop = () => {
  if (!config.standaloneMode) stopSyncScheduler();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
