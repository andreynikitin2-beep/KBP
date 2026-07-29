#!/bin/sh
# backup-db.sh — PostgreSQL dump with retention cleanup
# Runs inside the backup container on a cron schedule.
# Environment variables (set in docker-compose.yml / .env):
#   POSTGRES_HOST      — hostname of the db service (default: db)
#   POSTGRES_USER      — database user            (default: kb)
#   POSTGRES_DB        — database name            (default: kb)
#   PGPASSWORD         — database password        (required)
#   BACKUP_DIR         — where to write dumps     (default: /backups)
#   BACKUP_RETAIN_DAYS — how many days to keep    (default: 7)

set -e

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_USER="${POSTGRES_USER:-kb}"
POSTGRES_DB="${POSTGRES_DB:-kb}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting backup of database '${POSTGRES_DB}' → ${FILENAME}"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  "${POSTGRES_DB}" \
  | gzip > "${FILENAME}"

echo "[$(date -Iseconds)] Backup complete: ${FILENAME} ($(du -sh "${FILENAME}" | cut -f1))"

# Retention: remove dumps older than BACKUP_RETAIN_DAYS
echo "[$(date -Iseconds)] Removing dumps older than ${BACKUP_RETAIN_DAYS} days…"
find "${BACKUP_DIR}" -maxdepth 1 -name "*.sql.gz" -mtime "+${BACKUP_RETAIN_DAYS}" -print -delete

echo "[$(date -Iseconds)] Latest backup: $(ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)"
echo "[$(date -Iseconds)] Done."
