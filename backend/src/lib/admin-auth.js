import { AppError } from './errors.js';

export function parseRoles(value) {
  return [...new Set(String(value || '').split(',').map(x => x.trim()).filter(Boolean))];
}

export function buildAdminActor(req, config) {
  if (config.adminAuthMode === 'off') return { userId:'local-dev', roles:['catalog-admin'], mode:'off' };
  if (config.adminAuthMode !== 'trusted_headers') throw new AppError('Unsupported ADMIN_AUTH_MODE', { code:'ADMIN_AUTH_CONFIG', status:500 });
  const userId = String(req.headers['x-nexora-user-id'] || '').trim();
  const roles = parseRoles(req.headers['x-nexora-roles']);
  if (!userId) throw new AppError('Missing trusted user identity', { code:'ADMIN_UNAUTHENTICATED', status:401 });
  if (!roles.some(role => config.adminAllowedRoles.includes(role))) throw new AppError('Catalog admin role required', { code:'ADMIN_FORBIDDEN', status:403 });
  return { userId, roles, mode:'trusted_headers' };
}
