apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog-backend
  namespace: product-catalog
  labels:
    app.kubernetes.io/name: catalog-backend
    app.kubernetes.io/part-of: product-catalog
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: catalog-backend
  template:
    metadata:
      labels:
        app: catalog-backend
        app.kubernetes.io/name: catalog-backend
        app.kubernetes.io/part-of: product-catalog
    spec:
      securityContext:
        fsGroup: 1000
        fsGroupChangePolicy: OnRootMismatch
      terminationGracePeriodSeconds: 30
      containers:
        - name: backend
          image: nexora-catalog-backend:__IMAGE_TAG__
          imagePullPolicy: Never
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
          envFrom:
            - configMapRef:
                name: catalog-config
            - secretRef:
                name: catalog-backend-secret
            - secretRef:
                name: catalog-orders-customer-secret
                optional: true
            - secretRef:
                name: catalog-customer-auth-secret
                optional: true
            - secretRef:
                name: catalog-operations-read
                optional: true
          ports:
            - containerPort: 8080
          startupProbe:
            httpGet:
              path: /health/live
              port: 8080
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            periodSeconds: 10
            timeoutSeconds: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 6
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "2"
              memory: 1Gi
          volumeMounts:
            - name: media
              mountPath: /app/uploads
      volumes:
        - name: media
          persistentVolumeClaim:
            claimName: catalog-media
---
apiVersion: v1
kind: Service
metadata:
  name: catalog-backend
  namespace: product-catalog
spec:
  selector:
    app: catalog-backend
  ports:
    - port: 8080
      targetPort: 8080
