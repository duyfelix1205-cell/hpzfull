import * as Sentry from '@sentry/node';
import { config } from './config.js';

let initialized = false;

export function initObservability() {
  if (initialized) return;
  initialized = true;
  if (!config.sentryDsn) {
    console.log('[observability] Sentry disabled: SENTRY_DSN is empty');
    return;
  }
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    initialScope: {
      tags: {
        app_id: config.appId,
        service: 'backend',
        environment: config.environment,
        namespace: config.namespace,
        release: config.release,
        deploy_sha: config.deploySha
      }
    }
  });
  console.log(`[observability] Sentry enabled release=${config.release}`);
}

export function captureBackendError(error, req, statusCode = 500) {
  if (!config.sentryDsn || Number(statusCode) < 500) return;
  Sentry.withScope(scope => {
    scope.setTag('app_id', config.appId);
    scope.setTag('service', 'backend');
    scope.setTag('environment', config.environment);
    scope.setTag('namespace', config.namespace);
    scope.setTag('release', config.release);
    scope.setTag('deploy_sha', config.deploySha);
    scope.setTag('http_method', req?.method || 'UNKNOWN');
    scope.setExtra('request_id', req?.requestId || null);
    scope.setExtra('path', req?.originalUrl?.split('?')[0] || null);
    Sentry.captureException(error);
  });
}
