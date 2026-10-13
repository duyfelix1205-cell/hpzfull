import { AppError } from '../lib/errors.js';
import { normalizeOrdersItem } from './orders-normalize.js';

export class HttpOrdersAdapter {
  constructor({ baseUrl, token, pageSize = 200, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.pageSize = pageSize;
    this.fetchImpl = fetchImpl;
  }

  async fetchProducts({ updatedAfter = null, cursor = null } = {}) {
    if (!this.baseUrl) throw new AppError('ORDERS_BASE_URL is required for http adapter', { code: 'ORDERS_CONFIG_INVALID', status: 500 });
    const url = new URL('/api/v1/integration/catalog/products', this.baseUrl);
    url.searchParams.set('limit', String(this.pageSize));
    if (updatedAfter) url.searchParams.set('updated_after', updatedAfter);
    if (cursor) url.searchParams.set('cursor', cursor);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          accept: 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
        },
        signal: controller.signal
      });
      if (!response.ok) {
        throw new AppError(`Orders integration returned HTTP ${response.status}`, { code: 'ORDERS_UPSTREAM_ERROR', status: 502 });
      }
      const body = await response.json();
      if (!Array.isArray(body.items)) throw new AppError('Orders response missing items[]', { code: 'ORDERS_PAYLOAD_INVALID', status: 502 });
      return {
        items: body.items.map(normalizeOrdersItem),
        next_cursor: body.next_cursor || null
      };
    } catch (error) {
      if (error.name === 'AbortError') throw new AppError('Orders integration timeout', { code: 'ORDERS_TIMEOUT', status: 504 });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
