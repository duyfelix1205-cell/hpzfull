import 'dotenv/config';

const positiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
const csv = value => String(value || '').split(',').map(x=>x.trim()).filter(Boolean);
const bool = (value, fallback=false) => value === undefined ? fallback : ['1','true','yes','on'].includes(String(value).toLowerCase());
const deploySha = String(process.env.DEPLOY_SHA || 'dev').trim() || 'dev';
const appId = String(process.env.APP_ID || 'product-catalog').trim() || 'product-catalog';
const environment = String(process.env.NEXORA_ENVIRONMENT || process.env.NODE_ENV || 'development').trim() || 'development';

export const config = Object.freeze({
  appId,
  namespace: String(process.env.NEXORA_NAMESPACE || 'product-catalog').trim() || 'product-catalog',
  environment,
  deploySha,
  release: String(process.env.SENTRY_RELEASE || `${appId}@${deploySha}`).trim() || `${appId}@${deploySha}`,
  sentryDsn: String(process.env.SENTRY_DSN || '').trim(),
  port: positiveInt(process.env.PORT, 8080),
  databaseUrl: process.env.CATALOG_DB_URL || process.env.DATABASE_URL || 'postgres://catalog:catalog@localhost:5432/nexora_catalog',
  standaloneMode: bool(process.env.CATALOG_STANDALONE_MODE, true),
  seedLegacyStandalone: bool(process.env.SEED_LEGACY_STANDALONE, environment !== 'production'),
  ordersAdapter: (process.env.ORDERS_ADAPTER || 'fixture').toLowerCase(),
  ordersBaseUrl: (process.env.ORDERS_BASE_URL || '').replace(/\/$/, ''),
  ordersInternalToken: process.env.ORDERS_INTERNAL_TOKEN || '',
  customerOrdersInternalToken: process.env.CUSTOMER_ORDERS_INTERNAL_TOKEN || '',
  operationsReadSecret: process.env.NEXORA_OPERATIONS_READ_SECRET || '',
  ordersFixturePath: process.env.ORDERS_FIXTURE_PATH || new URL('../fixtures/orders-products.json', import.meta.url).pathname,
  syncIntervalSeconds: positiveInt(process.env.SYNC_INTERVAL_SECONDS, 60),
  syncPageSize: positiveInt(process.env.SYNC_PAGE_SIZE, 200),
  mediaRoot: process.env.MEDIA_ROOT || new URL('../uploads', import.meta.url).pathname,
  maxMediaBytes: positiveInt(process.env.MAX_MEDIA_BYTES, 8 * 1024 * 1024),
  stockStaleSeconds: positiveInt(process.env.STOCK_STALE_SECONDS, 300),
  adminAuthMode: (process.env.ADMIN_AUTH_MODE || 'off').toLowerCase(),
  adminAllowedRoles: csv(process.env.ADMIN_ALLOWED_ROLES || 'catalog-admin,nexora-admin'),
  publicBaseUrl: String(process.env.PUBLIC_BASE_URL || 'http://localhost:5173').replace(/\/$/,''),
  customerSessionCookie: String(process.env.CUSTOMER_SESSION_COOKIE || 'nexora_customer_session'),
  customerSessionDays: positiveInt(process.env.CUSTOMER_SESSION_DAYS, 30),
  googleClientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
  authEmailApiUrl: String(process.env.AUTH_EMAIL_API_URL || 'https://api.resend.com/emails').trim(),
  authEmailApiKey: String(process.env.AUTH_EMAIL_API_KEY || '').trim(),
  authEmailFrom: String(process.env.AUTH_EMAIL_FROM || '').trim()
});
