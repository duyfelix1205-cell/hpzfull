# Product Catalog deploy bootstrap note

The production workflow can bootstrap the Catalog PostgreSQL credential into the `product-catalog` namespace when GitHub repository secrets have not yet been configured. The public hostname defaults to `catalog.hungtp.click` and the Orders base URL defaults to `https://crm.hungtp.click`.

If `CATALOG_ORDERS_INTERNAL_TOKEN` is absent, the deployment intentionally uses the fixture adapter so the isolated Catalog application, database, media, ingress, TLS and backup path can be verified without fabricating an authenticated Orders integration. This state is live-verifiable but is not considered full production integration. Real Orders HTTP sync must replace fixture mode before M8 is considered fully production-complete.

If `CATALOG_SENTRY_DSN` is absent, Sentry stays disabled and the workflow marks observability as pending rather than failing the deploy.
