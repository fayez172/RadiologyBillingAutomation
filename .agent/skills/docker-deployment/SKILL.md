---
name: docker-deployment
description: Docker Compose setup, Dockerfile patterns, and deployment instructions for the TeleRadiology Billing system.
---

# Docker Deployment Skill

## Purpose

Containerized development and production deployment of the TeleRadiology Billing system.

## Development Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: telerad
      POSTGRES_PASSWORD: telerad_pass
      POSTGRES_DB: telerad_billing
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U telerad"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: development
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://telerad:telerad_pass@postgres:5432/telerad_billing
      REDIS_URL: redis://redis:6379
    env_file:
      - .env.local
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

### Development Workflow

```bash
# Start infrastructure only
docker compose up -d postgres redis

# Run app locally (faster hot reload)
npm run dev

# OR run everything in Docker
docker compose up -d
```

## Production Dockerfile

```dockerfile
# Multi-stage build
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

## Deployment Commands

```bash
# Build production image
docker build -t telerad-billing:latest .

# Run with compose
docker compose -f docker-compose.prod.yml up -d

# Run migration
docker compose exec app npx prisma migrate deploy

# Run seed
docker compose exec app npx prisma db seed
```

## Network Notes

- The app connects to EXTERNAL MSSQL servers (172.28.28.203, etc.)
- These are NOT in Docker — use host networking or ensure Docker can reach them
- On Docker Desktop for Windows: `host.docker.internal` or direct IP works
