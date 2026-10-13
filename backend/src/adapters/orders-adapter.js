import { config } from '../config.js';
import { FixtureOrdersAdapter } from './fixture-orders-adapter.js';
import { HttpOrdersAdapter } from './http-orders-adapter.js';

export function createOrdersAdapter() {
  if (config.ordersAdapter === 'http') {
    return new HttpOrdersAdapter({
      baseUrl: config.ordersBaseUrl,
      token: config.ordersInternalToken,
      pageSize: config.syncPageSize
    });
  }
  if (config.ordersAdapter === 'fixture') {
    return new FixtureOrdersAdapter({ fixturePath: config.ordersFixturePath });
  }
  throw new Error(`Unsupported ORDERS_ADAPTER=${config.ordersAdapter}`);
}
