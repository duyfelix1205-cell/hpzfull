import * as Sentry from '@sentry/react';

const dsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim();
const deploySha = String(import.meta.env.VITE_DEPLOY_SHA || 'dev').trim() || 'dev';
const environment = String(import.meta.env.VITE_APP_ENV || 'development').trim() || 'development';
const release = `product-catalog@${deploySha}`;

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    initialScope: {
      tags: {
        app_id: 'product-catalog',
        service: 'frontend',
        environment,
        namespace: 'product-catalog',
        release,
        deploy_sha: deploySha
      }
    }
  });
}

export const frontendRelease = Object.freeze({ deploySha, environment, release, sentryEnabled:Boolean(dsn) });
