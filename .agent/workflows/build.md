---
description: Build the TeleRadiology Billing web application (Docker + Next.js)
---

# Build Workflow

## Prerequisites
- Docker Desktop running
- Node.js 20+
- `.env.local` configured

## Steps

// turbo-all

1. Start infrastructure services:
```bash
docker compose up -d postgres redis
```

2. Install dependencies:
```bash
npm install
```

3. Generate Prisma client:
```bash
npx prisma generate
```

4. Run database migration:
```bash
npx prisma migrate dev
```

5. Seed the database:
```bash
npm run db:seed
```

6. Start development server:
```bash
npm run dev
```

The app will be available at http://localhost:3000
