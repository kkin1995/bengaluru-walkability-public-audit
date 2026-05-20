#!/bin/bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
COMPOSE_FILE="/home/karankinariwala/bengaluru-walkability-public-audit/docker-compose.yml"
COMPOSE_SERVER_FILE="/home/karankinariwala/bengaluru-walkability-public-audit/docker-compose.server.yml"
BACKUP_ROOT="/data/backups"
MIN_SIZE_KB=10
DATE=$(date +%Y%m%d_%H%M%S)

# ── PostgreSQL backup via docker exec ─────────────────────────────────────────
# Uses docker exec against the running db container to avoid Docker network name
# ambiguity (the auto-generated network name depends on the directory name).
# Volume name: postgres_data (confirmed from docker-compose.yml)
DB_BACKUP_DIR="${BACKUP_ROOT}/db"
DB_BACKUP_FILE="${DB_BACKUP_DIR}/walkability_${DATE}.sql.gz"
mkdir -p "$DB_BACKUP_DIR"

DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_SERVER_FILE" ps -q db)
if [ -z "$DB_CONTAINER" ]; then
    echo "BACKUP FAILED: db container is not running" >&2
    exit 1
fi
docker exec "$DB_CONTAINER" pg_dump -U walkability walkability | gzip > "$DB_BACKUP_FILE"

# ── Validate pg_dump output size ──────────────────────────────────────────────
# Exit 1 on validation failure so systemd OnFailure= unit fires (D-14).
ACTUAL_SIZE=$(du -k "$DB_BACKUP_FILE" | cut -f1)
if [ "$ACTUAL_SIZE" -lt "$MIN_SIZE_KB" ]; then
    echo "BACKUP VALIDATION FAILED: $DB_BACKUP_FILE is only ${ACTUAL_SIZE}KB (expected > ${MIN_SIZE_KB}KB)" >&2
    exit 1
fi

# ── Uploads volume backup ──────────────────────────────────────────────────────
# Volume name: uploads (confirmed from docker-compose.yml)
# Mounted read-only to avoid any accidental writes during backup.
UPLOADS_BACKUP_DIR="${BACKUP_ROOT}/uploads"
UPLOADS_BACKUP_FILE="${UPLOADS_BACKUP_DIR}/uploads_${DATE}.tar.gz"
mkdir -p "$UPLOADS_BACKUP_DIR"

docker run --rm \
    -v uploads:/data:ro \
    -v "${UPLOADS_BACKUP_DIR}:/backup" \
    alpine \
    tar czf "/backup/uploads_${DATE}.tar.gz" -C /data .

# ── 30-day retention ──────────────────────────────────────────────────────────
# Runs only after a successful pg_dump + size validation so a failed run does
# not delete the previous successful backups prematurely (D-15).
find "$BACKUP_ROOT" -mtime +30 -name "*.sql.gz" -delete
find "$BACKUP_ROOT" -mtime +30 -name "*.tar.gz" -delete

echo "Backup complete: $DB_BACKUP_FILE and $UPLOADS_BACKUP_FILE"
