apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-frontend
  namespace: product-catalog
  labels:
    app.kubernetes.io/name: catalog-frontend
    app.kubernetes.io/part-of: product-catalog
spec:
  replicas: 1
  selector:
    matchLabels:
      app: catalog-frontend
  template:
    metadata:
      labels:
        app: catalog-frontend
        app.kubernetes.io/name: catalog-frontend
        app.kubernetes.io/part-of: product-catalog
    spec:
      containers:
        - name: frontend
          image: nexora-catalog-frontend:__IMAGE_TAG__
          imagePullPolicy: Never
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
              memory: 64Mi
            limits:
              cpu: "1"
              memory: 256Mi
---
apiVersion: v1
kind: Service
metadata:
  name: catalog-frontend
  namespace: product-catalog
spec:
  selector:
    app: catalog-frontend
  ports:
    - port: 8080
      targetPort: 8080
