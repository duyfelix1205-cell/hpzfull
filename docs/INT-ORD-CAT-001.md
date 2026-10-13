# INT-ORD-CAT-001 — Orders → Catalog Product Availability

- Status: PROPOSED / consumer implementation ready
- Version: v1 draft
- Producer: CRM Orders
- Consumer: Product Catalog
- Canonical ID: `product_id`
- Endpoint: `GET /api/v1/integration/catalog/products`
- Auth: authenticated internal call; bearer token placeholder in consumer
- Pagination: cursor + limit; optional `updated_after`
- Timeout: consumer 8 seconds/request; producer outage must not hard-down public catalog
- Idempotency: N/A (GET). Consumer upserts by `product_id`.
- PII: none expected.

## Response
```json
{
  "items": [{
    "product_id": "PRD-...",
    "name": "...",
    "sale_status": "ACTIVE",
    "available_qty": 42,
    "list_price": 150000,
    "combo_prices": {"3":145000,"5":136000,"10":127000},
    "product_code": "...",
    "branch_availability": [],
    "inventory_updated_at": "2026-09-16T22:00:00+07:00",
    "updated_at": "2026-09-16T22:00:00+07:00"
  }],
  "next_cursor": null
}
```

## Error model
```json
{"error":{"code":"...","message":"...","request_id":"..."}}
```

## Producer blocker
Current Orders `main` exposes `/api/products` and `/api/inventory/current`, but not this cross-app contract endpoint. Do not make Catalog depend on those internal endpoints as its permanent contract.
