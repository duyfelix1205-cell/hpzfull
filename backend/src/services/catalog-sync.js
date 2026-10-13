import { pool, tx } from '../db.js';
import { createOrdersAdapter } from '../adapters/orders-adapter.js';

async function upsertSource(item) {
  return tx(async client => {
    const result = await client.query(
      `INSERT INTO catalog_product_source(
         product_id,product_name,sale_status,available_qty,list_price,combo_prices_json,
         product_code,branch_availability_json,source_updated_at,inventory_updated_at,synced_at,sync_state,sync_error
       ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10,now(),'OK',null)
       ON CONFLICT(product_id) DO UPDATE SET
         product_name=EXCLUDED.product_name,
         sale_status=EXCLUDED.sale_status,
         available_qty=EXCLUDED.available_qty,
         list_price=EXCLUDED.list_price,
         combo_prices_json=EXCLUDED.combo_prices_json,
         product_code=EXCLUDED.product_code,
         branch_availability_json=EXCLUDED.branch_availability_json,
         source_updated_at=EXCLUDED.source_updated_at,
         inventory_updated_at=EXCLUDED.inventory_updated_at,
         synced_at=now(),sync_state='OK',sync_error=null
       RETURNING (xmax = 0) AS inserted`,
      [
        item.product_id,item.name,item.sale_status,item.available_qty,item.list_price,
        JSON.stringify(item.combo_prices),item.product_code,JSON.stringify(item.branch_availability),
        item.updated_at,item.inventory_updated_at
      ]
    );
    return Boolean(result.rows[0]?.inserted);
  });
}

export async function syncCatalogSource({ adapter = createOrdersAdapter() } = {}) {
  const run = (await pool.query(
    `INSERT INTO catalog_sync_run(status,started_at) VALUES('RUNNING',now()) RETURNING sync_run_id,started_at`
  )).rows[0];

  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let cursor = null;

  try {
    do {
      const page = await adapter.fetchProducts({ cursor });
      cursor = page.next_cursor || null;
      for (const item of page.items) {
        fetched += 1;
        try {
          if (await upsertSource(item)) inserted += 1;
          else updated += 1;
        } catch (error) {
          failed += 1;
          await pool.query(
            `INSERT INTO catalog_sync_error(sync_run_id,product_id,error_message) VALUES($1,$2,$3)`,
            [run.sync_run_id, item.product_id || null, error.message]
          );
        }
      }
    } while (cursor);

    const status = failed ? 'PARTIAL' : 'SUCCESS';
    await pool.query(
      `UPDATE catalog_sync_run SET finished_at=now(),status=$2,fetched_count=$3,inserted_count=$4,updated_count=$5,failed_count=$6,source_cursor=$7 WHERE sync_run_id=$1`,
      [run.sync_run_id, status, fetched, inserted, updated, failed, cursor]
    );
    return { sync_run_id: run.sync_run_id, status, fetched, inserted, updated, failed };
  } catch (error) {
    await pool.query(
      `UPDATE catalog_sync_run SET finished_at=now(),status='FAILED',fetched_count=$2,inserted_count=$3,updated_count=$4,failed_count=$5,error_summary=$6,source_cursor=$7 WHERE sync_run_id=$1`,
      [run.sync_run_id, fetched, inserted, updated, failed, error.message, cursor]
    );
    throw error;
  }
}
