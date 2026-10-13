apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: catalog-public
  namespace: product-catalog
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - __CATALOG_DOMAIN__
      secretName: catalog-tls
  rules:
    - host: __CATALOG_DOMAIN__
      http:
        paths:
          - path: /api/v1/catalog
            pathType: Prefix
            backend:
              service:
                name: catalog-backend
                port:
                  number: 8080
          - path: /media
            pathType: Prefix
            backend:
              service:
                name: catalog-backend
                port:
                  number: 8080
          - path: /health
            pathType: Prefix
            backend:
              service:
                name: catalog-backend
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: catalog-frontend
                port:
                  number: 8080
