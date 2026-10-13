import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const workflow=readFileSync(path.join(root,'.github/workflows/deploy-catalog.yml'),'utf8');

test('Source Vault V1 is a post-smoke production release gate',()=>{
  assert.match(workflow,/permissions:\n\s+contents: read\n\s+id-token: write/);
  assert.match(workflow,/SOURCE_VAULT_APP_ID: product-catalog/);
  assert.match(workflow,/SOURCE_VAULT_EXPECTED_REPO: tranhung204\/nexora-product-catalog/);
  assert.match(workflow,/git archive --format=zip --output="\$ARCHIVE" "\$DEPLOY_SHA"/);
  assert.match(workflow,/audience=nexora-desk-source-archive/);
  assert.match(workflow,/X-Source-Sha: \$DEPLOY_SHA/);
  assert.match(workflow,/X-Source-Branch: main/);
  assert.match(workflow,/SOURCE_VAULT_META="\$META" python3 - <<'PY'/);
  assert.match(workflow,/'has_archive': item\.get\('has_archive'\) is True/);
  assert.match(workflow,/'sha': item\.get\('source_sha'\) == expected_sha/);
  assert.match(workflow,/'branch': item\.get\('branch'\) == 'main'/);
  assert.match(workflow,/'archive_size': int\(item\.get\('archive_size'\) or 0\) > 0/);

  const smoke=workflow.indexOf('- name: Verify public HTTPS and Admin isolation');
  const publish=workflow.indexOf('- name: Publish production source to NEXORA Source Vault');
  const verify=workflow.indexOf('- name: Verify NEXORA Source Vault release identity');
  const summary=workflow.indexOf('- name: Deployment summary');
  assert.ok(smoke>=0&&publish>smoke&&verify>publish&&summary>verify,'Vault publish/verify must happen after smoke and before release summary');
});

test('Source Vault publisher keeps exact deployed SHA and does not use long-lived credentials',()=>{
  assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$DEPLOY_SHA"/);
  assert.match(workflow,/for attempt in 1 2 3 4 5/);
  assert.doesNotMatch(workflow,/SOURCE_VAULT_(PASSWORD|PAT|TOKEN)|SOURCE_ARCHIVE_SESSION_SECRET|session cookie/i);
});
