# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production: use Debian (glibc) so better-sqlite3 native module works on Swarm nodes
# Alpine (musl) can cause "fcntl64: symbol not found" on some hosts
FROM node:20-bookworm-slim
WORKDIR /app

# Install build dependencies for better-sqlite3 (node-gyp needs python3, make, g++) and wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential wget \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --production

# Remove build deps to keep image smaller (optional; uncomment if image size matters)
# RUN apt-get purge -y python3 build-essential && apt-get autoremove -y

COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ./public

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "src/index.js"]
