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
#   SECRETS_KEY_FILE   — encryption key file      (default: /secrets/secrets.key)
#   SECRETS_KEY        — key from .env, if set (used when there is no key file)
#
# Each dump gets a copy of the secrets encryption key next to it
# (<db>_<timestamp>.secrets.key, mode 600). Without the key the SMTP/LDAP
# passwords and the AI API key stored in the dump cannot be decrypted.
#
# Restore:
#   1. gunzip -c backups/kb_<timestamp>.sql.gz | docker compose exec -T db psql -U kb kb
#   2. cp backups/kb_<timestamp>.secrets.key secrets/secrets.key && chmod 600 secrets/secrets.key
#      (or put its contents into SECRETS_KEY in .env)
#   3. docker compose restart app

set -e

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_USER="${POSTGRES_USER:-kb}"
POSTGRES_DB="${POSTGRES_DB:-kb}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
SECRETS_KEY_FILE="${SECRETS_KEY_FILE:-/secrets/secrets.key}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
KEYFILE="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.secrets.key"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting backup of database '${POSTGRES_DB}' → ${FILENAME}"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  "${POSTGRES_DB}" \
  | gzip > "${FILENAME}"

echo "[$(date -Iseconds)] Backup complete: ${FILENAME} ($(du -sh "${FILENAME}" | cut -f1))"

# Encryption key next to the dump (owner-only permissions).
if [ -s "${SECRETS_KEY_FILE}" ]; then
  (umask 077 && cp "${SECRETS_KEY_FILE}" "${KEYFILE}")
  echo "[$(date -Iseconds)] Encryption key saved: ${KEYFILE}"
elif [ -n "${SECRETS_KEY}" ]; then
  (umask 077 && printf '%s\n' "${SECRETS_KEY}" > "${KEYFILE}")
  echo "[$(date -Iseconds)] Encryption key (from SECRETS_KEY) saved: ${KEYFILE}"
else
  echo "[$(date -Iseconds)] WARNING: encryption key not found (${SECRETS_KEY_FILE}, SECRETS_KEY) — dump saved without it"
fi

# Retention: remove dumps older than BACKUP_RETAIN_DAYS
echo "[$(date -Iseconds)] Removing dumps older than ${BACKUP_RETAIN_DAYS} days…"
find "${BACKUP_DIR}" -maxdepth 1 \( -name "*.sql.gz" -o -name "*.secrets.key" \) -mtime "+${BACKUP_RETAIN_DAYS}" -print -delete

echo "[$(date -Iseconds)] Latest backup: $(ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)"
echo "[$(date -Iseconds)] Done."
