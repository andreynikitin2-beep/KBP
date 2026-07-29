#!/bin/sh
# docker-entrypoint.sh — waits for Postgres, runs migrations, starts the app.
set -e

# ── 1. Wait for PostgreSQL ────────────────────────────────────────────────────
# Extract host and port from DATABASE_URL (postgresql://user:pass@host:port/db)
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_PORT=${DB_PORT:-5432}

echo "[entrypoint] Waiting for PostgreSQL at $DB_HOST:$DB_PORT ..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  sleep 1
done
echo "[entrypoint] PostgreSQL is ready."

# ── 2. Run database migrations ───────────────────────────────────────────────
echo "[entrypoint] Applying database migrations (drizzle-kit push) ..."
npx drizzle-kit push --config drizzle.config.ts
echo "[entrypoint] Migrations applied."

# ── 3. Start the application ─────────────────────────────────────────────────
echo "[entrypoint] Starting application ..."
exec node dist/index.cjs
