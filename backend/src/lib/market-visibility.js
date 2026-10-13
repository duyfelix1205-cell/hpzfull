const cleanUpper=value=>String(value??'').trim().toUpperCase();

export const DEFAULT_SOLD_VISIBILITY_HOURS=36;
export const HIDDEN_ACTIONS=['EDIT_RESUBMIT','CONTACT_HPZ','VIEW_ONLY'];

export function normalizeHiddenAction(value){
  const action=cleanUpper(value);
  return HIDDEN_ACTIONS.includes(action)?action:'VIEW_ONLY';
}

export function hiddenActionAllowsEdit(value){
  return normalizeHiddenAction(value)==='EDIT_RESUBMIT';
}

const participationSql=(alias,status)=>`EXISTS (
  SELECT 1
    FROM catalog_market_session_post sp
    JOIN catalog_market_session s ON s.session_id=sp.session_id
   WHERE sp.post_id=${alias}.post_id
     AND sp.removed_at IS NULL
     ${status?`AND s.status='${status}'`:''}
)`;

export function marketPhaseSql(alias='p'){
  return `CASE
    WHEN ${participationSql(alias,'OPEN')} THEN 'OPEN'
    WHEN ${participationSql(alias,'UPCOMING')} THEN 'UPCOMING'
    WHEN ${participationSql(alias,'ENDED')} THEN 'ENDED'
    ELSE 'GENERAL'
  END`;
}

export function soldVisibilitySql(alias='p'){
  return `(${alias}.is_sold=false OR ${alias}.sold_visibility_until IS NULL OR ${alias}.sold_visibility_until>now())`;
}

export function publicMarketVisibilitySql(alias='p'){
  return `${alias}.publish_status='PUBLISHED'
    AND ${alias}.moderation_status='APPROVED'
    AND ${soldVisibilitySql(alias)}
    AND (
      NOT ${participationSql(alias)}
      OR ${participationSql(alias,'OPEN')}
      OR (
        ${participationSql(alias,'ENDED')}
        AND NOT ${participationSql(alias,'UPCOMING')}
      )
    )`;
}
