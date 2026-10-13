apiVersion: batch/v1
kind: Job
metadata:
  name: catalog-db-migrate
  namespace: product-catalog
  labels:
    app: catalog-maintenance
    app.kubernetes.io/part-of: product-catalog
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 1800
  ttlSecondsAfterFinished: 1800
  template:
    metadata:
      labels:
        app: catalog-maintenance
        app.kubernetes.io/part-of: product-catalog
    spec:
      restartPolicy: Never
      securityContext:
        fsGroup: 1000
        fsGroupChangePolicy: OnRootMismatch
      initContainers:
        - name: pre-migration-backup
          image: postgres:16-alpine
          imagePullPolicy: IfNotPresent
          env:
            - name: PGHOST
              value: catalog-postgres
            - name: PGPORT
              value: "5432"
            - name: PGDATABASE
              valueFrom:
                secretKeyRef:
                  name: catalog-postgres-secret
                  key: POSTGRES_DB
            - name: PGUSER
              valueFrom:
                secretKeyRef:
                  name: catalog-postgres-secret
                  key: POSTGRES_USER
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: catalog-postgres-secret
                  key: POSTGRES_PASSWORD
          command:
            - /bin/sh
            - -ec
            - |
              mkdir -p /backup
              TS="$(date -u +%Y%m%dT%H%M%SZ)"
              FILE="/backup/catalog_pre_migration_${TS}.dump"
              i=0
              until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
                i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 5
              done
              pg_dump --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --dbname="$PGDATABASE" --format=custom --compress=6 --no-owner --no-acl --file="$FILE"
              sha256sum "$FILE" > "${FILE}.sha256"
              test -s "$FILE"
              echo "[data-safety] pre-migration backup created: $FILE"
          volumeMounts:
            - name: backups
              mountPath: /backup
      containers:
        - name: migrate
          image: nexora-catalog-backend:__IMAGE_TAG__
          imagePullPolicy: Never
          command: ["sh","-c","npm run migrate"]
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
          resources:
            requests:
              cpu: 25m
              memory: 96Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: media
              mountPath: /app/uploads
      volumes:
        - name: media
          persistentVolumeClaim:
            claimName: catalog-media
        - name: backups
          persistentVolumeClaim:
            claimName: catalog-backups
