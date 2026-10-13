import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { many, one } from '../db.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCHEMA_VERSION = 'ops-metrics.v1';
const TIMEZONE = 'Asia/Ho_Chi_Minh';

const clean = value => String(value ?? '').trim();
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const raw = clean(req.get('authorization'));
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : clean(req.get('x-nexora-internal-token'));
}

function requireOperationsRead(req, res, next) {
  if (!config.operationsReadSecret) {
    return res.status(503).json({ error: { code: 'OPERATIONS_READ_UNAVAILABLE', message: 'Operations read API is not configured.' } });
  }
  if (clean(req.get('x-nexora-consumer')) !== 'nexora-operations') {
    return res.status(403).json({ error: { code: 'OPERATIONS_SCOPE_FORBIDDEN', message: 'Invalid Operations consumer scope.' } });
  }
  if (!safeEqual(bearer(req), config.operationsReadSecret)) {
    return res.status(401).json({ error: { code: 'OPERATIONS_READ_UNAUTHORIZED', message: 'Invalid Operations read credential.' } });
  }
  next();
}

function period(req) {
  const from = clean(req.query.from);
  const to = clean(req.query.to);
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    const error = new Error('from/to must use YYYY-MM-DD and from must be <= to');
    error.status = 400;
    error.code = 'INVALID_PERIOD';
    throw error;
  }
  const days = Math.floor((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
  if (days < 1 || days > 62) {
    const error = new Error('Operations read period is limited to 62 days.');
    error.status = 400;
    error.code = 'PERIOD_TOO_LARGE';
    throw error;
  }
  return { from, to, timezone: TIMEZONE };
}

function metric(key, value, unit, aggregation) {
  return { key, value, unit, definition_version: 'v1', aggregation, source_refs: [] };
}

function envelope({ metrics = [], p = null, extras = {}, warnings = [], dataStatus = 'COMPLETE' } = {}) {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    source_app: 'product-catalog',
    crm_instance_id: 'product-catalog',
    ...(p ? { period: p } : {}),
    generated_at: now,
    data_as_of: now,
    data_status: dataStatus,
    metrics,
    warnings,
    ...extras
  };
}

router.use(requireOperationsRead);

router.get('/summary', async (req, res, next) => {
  try {
    const p = period(req);
    const [products, content, media, sync, wiki, journal, market, clicks] = await Promise.all([
      one(`SELECT
        COUNT(*)::int total,
        COUNT(*) FILTER (WHERE COALESCE(available_qty,0)>0)::int in_stock,
        COUNT(*) FILTER (WHERE COALESCE(available_qty,0)<=0)::int out_of_stock,
        COUNT(*) FILTER (
          WHERE source_kind<>'LOCAL'
            AND COALESCE(inventory_updated_at,synced_at) < now() - ($1::int * interval '1 second')
        )::int stale_stock,
        MAX(GREATEST(COALESCE(source_updated_at,'epoch'::timestamptz),COALESCE(inventory_updated_at,'epoch'::timestamptz),synced_at)) source_high_watermark
      FROM catalog_product_source`, [config.stockStaleSeconds]),
      one(`SELECT
        COUNT(*) FILTER (WHERE publish_status='PUBLISHED')::int published,
        COUNT(*) FILTER (WHERE publish_status<>'PUBLISHED')::int unpublished,
        COUNT(*) FILTER (
          WHERE publish_status='PUBLISHED'
            AND NULLIF(BTRIM(COALESCE(short_description,'')),'') IS NULL
            AND NULLIF(BTRIM(COALESCE(description,'')),'') IS NULL
        )::int missing_description
      FROM catalog_content`),
      one(`SELECT COUNT(*)::int missing_primary_media
        FROM catalog_content c
        WHERE c.publish_status='PUBLISHED'
          AND NOT EXISTS(
            SELECT 1 FROM catalog_media m WHERE m.product_id=c.product_id AND m.is_primary=true
          )`),
      one(`SELECT status,finished_at,fetched_count,failed_count,error_summary
        FROM catalog_sync_run ORDER BY started_at DESC LIMIT 1`),
      one(`SELECT COUNT(*) FILTER (WHERE publish_status='PUBLISHED')::int published FROM catalog_wiki_article`),
      one(`SELECT COUNT(*) FILTER (WHERE publish_status='PUBLISHED')::int published FROM catalog_journal_entry`),
      one(`SELECT
        COUNT(*) FILTER (WHERE moderation_status='APPROVED' AND publish_status='PUBLISHED')::int visible_posts,
        COUNT(*) FILTER (WHERE moderation_status='APPROVED' AND publish_status='PUBLISHED' AND is_sold=true)::int sold_posts,
        COUNT(*) FILTER (WHERE moderation_status='PENDING')::int pending_moderation
      FROM catalog_market_post`),
      one(`SELECT COALESCE(SUM(click_count),0)::bigint clicks
        FROM catalog_link_click_daily
        WHERE event_date >= $1::date AND event_date <= $2::date`, [p.from, p.to])
    ]);

    res.json(envelope({
      p,
      metrics: [
        metric('catalog.products_total', num(products?.total), 'PRODUCT', 'COUNT'),
        metric('catalog.products_published', num(content?.published), 'PRODUCT', 'COUNT'),
        metric('catalog.products_unpublished', num(content?.unpublished), 'PRODUCT', 'COUNT'),
        metric('catalog.products_in_stock', num(products?.in_stock), 'PRODUCT', 'COUNT'),
        metric('catalog.products_out_of_stock', num(products?.out_of_stock), 'PRODUCT', 'COUNT'),
        metric('catalog.products_stale_stock', num(products?.stale_stock), 'PRODUCT', 'COUNT'),
        metric('catalog.products_missing_description', num(content?.missing_description), 'PRODUCT', 'COUNT'),
        metric('catalog.products_missing_primary_media', num(media?.missing_primary_media), 'PRODUCT', 'COUNT'),
        metric('catalog.wiki_published', num(wiki?.published), 'ARTICLE', 'COUNT'),
        metric('catalog.journal_published', num(journal?.published), 'ENTRY', 'COUNT'),
        metric('catalog.market_visible_posts', num(market?.visible_posts), 'POST', 'COUNT'),
        metric('catalog.market_sold_posts', num(market?.sold_posts), 'POST', 'COUNT'),
        metric('catalog.market_pending_moderation', num(market?.pending_moderation), 'POST', 'COUNT'),
        metric('catalog.market_clicks', num(clicks?.clicks), 'CLICK', 'SUM')
      ],
      extras: {
        contract_id: 'INT-CAT-OPS-001',
        source_high_watermark: products?.source_high_watermark || null,
        sync: sync || null,
        warnings: [
          'catalog.market_clicks is engagement traffic and must not be combined with Orders/Sales revenue without a proven conversion event.'
        ]
      }
    }));
  } catch (error) { next(error); }
});

router.get('/data-health', async (_req, res, next) => {
  try {
    const [products, content, market] = await Promise.all([
      one(`SELECT COUNT(*)::int count,MAX(synced_at) source_high_watermark FROM catalog_product_source`),
      one(`SELECT COUNT(*)::int count,MAX(updated_at) content_high_watermark FROM catalog_content`),
      one(`SELECT COUNT(*)::int count,MAX(updated_at) market_high_watermark FROM catalog_market_post`)
    ]);
    res.json(envelope({
      metrics: [
        metric('catalog.source_product_count', num(products?.count), 'PRODUCT', 'COUNT'),
        metric('catalog.content_record_count', num(content?.count), 'RECORD', 'COUNT'),
        metric('catalog.market_record_count', num(market?.count), 'POST', 'COUNT')
      ],
      extras: {
        contract_id: 'INT-CAT-OPS-001',
        read_only: true,
        source_high_watermark: products?.source_high_watermark || content?.content_high_watermark || market?.market_high_watermark || null
      }
    }));
  } catch (error) { next(error); }
});

export default router;
