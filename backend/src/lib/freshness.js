export function stockFreshness({ inventoryUpdatedAt, syncedAt, thresholdSeconds = 300, now = Date.now() } = {}) {
  const raw = inventoryUpdatedAt || syncedAt;
  if (!raw) return { stock_stale:true, stock_age_seconds:null };
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return { stock_stale:true, stock_age_seconds:null };
  const age = Math.max(0, Math.floor((Number(now) - ts) / 1000));
  return { stock_stale:age > thresholdSeconds, stock_age_seconds:age };
}
