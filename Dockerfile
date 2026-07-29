FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine

# postgresql-client provides pg_isready for the entrypoint health-wait
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package*.json ./
# Install only production deps; drizzle-kit is needed for migrations
RUN npm ci --omit=dev && npm install drizzle-kit --no-save

COPY --from=builder /app/dist ./dist
# migrations/ is needed by drizzle-kit push at startup
COPY --from=builder /app/migrations ./migrations
# drizzle config + shared schema needed by drizzle-kit
COPY drizzle.config.ts ./
COPY shared ./shared

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Default file storage directory (override via FILE_STORAGE_PATH env var or Docker volume)
RUN mkdir -p /data/uploads
ENV FILE_STORAGE_PATH=/data/uploads
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

ENTRYPOINT ["docker-entrypoint.sh"]
