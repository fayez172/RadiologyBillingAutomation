---
description: Verify the application by building, running tests, and checking connections
---

# Verify Workflow

## Steps

// turbo-all

1. Type check:
```bash
npx tsc --noEmit
```

2. Lint:
```bash
npm run lint
```

3. Build production bundle:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

5. Check Prisma schema validity:
```bash
npx prisma validate
```

6. Check Docker services are running:
```bash
docker compose ps
```
