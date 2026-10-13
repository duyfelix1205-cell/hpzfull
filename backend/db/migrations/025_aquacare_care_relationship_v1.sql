-- AquaCare V1. Only additive data structures; preserve existing tank/log/item/order rows.
-- Precondition audit: fail instead of silently normalizing unknown legacy states.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM aquacare.issue WHERE status NOT IN ('OPEN','RESOLVED')) THEN
  RAISE EXCEPTION 'AquaCare legacy issue status audit failed: unexpected status; do not migrate blindly';
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS aquacare.care_relationship (
 customer_id text PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aquacare.care_event (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id text NOT NULL,
 tank_id uuid REFERENCES aquacare.tank(tank_id) ON DELETE SET NULL,
 issue_id uuid REFERENCES aquacare.issue(issue_id) ON DELETE RESTRICT,
 event_key text,
 event_type text NOT NULL,
 actor_type text NOT NULL CHECK (actor_type IN ('CUSTOMER','HPZ_HUMAN','SYSTEM','LEGACY')),
 actor_id text NOT NULL DEFAULT '',
 content text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_aquacare_event_customer ON aquacare.care_event(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_aquacare_event_issue ON aquacare.care_event(issue_id,created_at);
CREATE INDEX IF NOT EXISTS ix_aquacare_event_tank ON aquacare.care_event(tank_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_aquacare_event_idempotency ON aquacare.care_event(event_key) WHERE event_key IS NOT NULL;

-- Audit historical status before changing legacy OPEN to equivalent V1 ACTIVE.
INSERT INTO aquacare.care_event(customer_id,tank_id,issue_id,event_key,event_type,actor_type,content,created_at)
SELECT customer_id,tank_id,issue_id,'legacy:issue:'||issue_id::text,'LEGACY_IMPORTED','LEGACY',
  'Legacy status='||status||'; issue type='||issue_type||'; historical content unchanged',
  created_at
FROM aquacare.issue
ON CONFLICT DO NOTHING;

ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS previous_issue_id uuid REFERENCES aquacare.issue(issue_id) ON DELETE SET NULL;
ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS care_decision text NOT NULL DEFAULT 'D';
ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS human_state text NOT NULL DEFAULT 'NONE';
ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS wait_reason text;
ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS resolution_by text;
ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS resolution_basis text;
ALTER TABLE aquacare.issue ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE aquacare.issue ALTER COLUMN tank_id DROP NOT NULL;
ALTER TABLE aquacare.issue DROP CONSTRAINT IF EXISTS issue_status_check;
ALTER TABLE aquacare.issue ALTER COLUMN status SET DEFAULT 'ACTIVE';
UPDATE aquacare.issue SET status='ACTIVE' WHERE status='OPEN';
ALTER TABLE aquacare.issue ADD CONSTRAINT issue_status_check CHECK(status IN ('ACTIVE','WAITING','INACTIVE_UNRESOLVED','RESOLVED'));
ALTER TABLE aquacare.issue ADD CONSTRAINT issue_care_decision_check CHECK(care_decision IN ('A','B','C','D'));
ALTER TABLE aquacare.issue ADD CONSTRAINT issue_human_state_check CHECK(human_state IN ('NONE','REQUESTED','ACKNOWLEDGED','CONTRIBUTED'));
CREATE INDEX IF NOT EXISTS ix_aquacare_incident_previous ON aquacare.issue(previous_issue_id) WHERE previous_issue_id IS NOT NULL;

-- One relationship per customer; existing aquarium or incident links still point to the same stable ID.
INSERT INTO aquacare.care_relationship(customer_id,started_at)
SELECT customer_id,MIN(created_at) FROM (
 SELECT customer_id,created_at FROM aquacare.tank
 UNION ALL SELECT customer_id,created_at FROM aquacare.issue
 UNION ALL SELECT customer_id,created_at FROM aquacare.care_log
) old_data
WHERE customer_id IS NOT NULL AND customer_id<>''
GROUP BY customer_id
ON CONFLICT(customer_id) DO NOTHING;
