import { AppError } from '../lib/errors.js';

const nullableNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new AppError('Invalid numeric field from Orders', { code: 'ORDERS_PAYLOAD_INVALID' });
  return n;
};

export function normalizeOrdersItem(item) {
  if (!item || typeof item !== 'object') {
    throw new AppError('Orders item must be an object', { code: 'ORDERS_PAYLOAD_INVALID' });
  }
  const productId = String(item.product_id || '').trim();
  const name = String(item.name || '').trim();
  if (!/^PRD-[A-Za-z0-9._-]+$/.test(productId)) {
    throw new AppError(`Invalid canonical product_id: ${productId || '<empty>'}`, { code: 'ORDERS_PAYLOAD_INVALID' });
  }
  if (!name) throw new AppError(`Missing product name for ${productId}`, { code: 'ORDERS_PAYLOAD_INVALID' });

  return {
    product_id: productId,
    name,
    sale_status: String(item.sale_status || 'UNKNOWN').trim().toUpperCase(),
    available_qty: nullableNumber(item.available_qty),
    list_price: nullableNumber(item.list_price),
    combo_prices: item.combo_prices && typeof item.combo_prices === 'object' ? item.combo_prices : null,
    product_code: item.product_code == null ? null : String(item.product_code),
    branch_availability: Array.isArray(item.branch_availability) ? item.branch_availability : null,
    inventory_updated_at: item.inventory_updated_at || null,
    updated_at: item.updated_at || null
  };
}
