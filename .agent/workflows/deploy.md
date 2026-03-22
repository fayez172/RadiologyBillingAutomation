---
description: Deploy to production using Docker
---

# Deploy Workflow

## Pre-flight Checks

1. Ensure all tests pass (run `/verify` first)
2. Ensure `.env.production` is configured on the server
3. Ensure Docker is available on the target

## Steps

1. Build production Docker image:
```bash
docker build -t telerad-billing:latest .
```

2. Tag for registry (if using one):
```bash
docker tag telerad-billing:latest your-registry/telerad-billing:latest
```

3. Push to registry:
```bash
docker push your-registry/telerad-billing:latest
```

4. On production server, pull and start:
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

5. Run migrations on production:
```bash
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

6. Verify the app is running:
```bash
docker compose -f docker-compose.prod.yml ps
curl -s http://localhost:3000/api/health | jq .
```
