# Care360 TeleRadiology Billing Automation

A production-ready Enterprise Billing Automation tool built with Next.js 14, standardizing and accelerating teleradiology billing processes, mapping remote databases, generating PDF invoices, and tracking accounts receivable.

## Features

- **Multi-Instance MSSQL Syncing**: Connects securely with multiple remote hospital databases to pull radiological study records.
- **Smart Mapping Engine**: Automatically cleans inconsistent hospital study types (e.g. "CT BRAIN W/O CONTRAST") and maps them to unified billing types (e.g. "CT-BRAIN") using configurable Normalization Rules.
- **Alias Resolution**: Recognizes various hospital client names and radiologist doctors with automated alias mapping.
- **Automated Invoicing**: Generates accurate billing statements with PDF (`@react-pdf/renderer`) and Excel exports. Calculates historical previous AR dues.
- **Payment Ledger**: Track client payments and keep a running Ledger of collected vs uncollected accounts receivable.
- **MIS Dashboards**: Analytics interface for spotting payment collection trends and identifying highest-revenue clients.

## Tech Stack
- Next.js 14 App Router, React 18
- TailwindCSS, shadcn/ui, Recharts
- Prisma, PostgreSQL, Docker
- NextAuth.js (Database Strategy)
- react-pdf, xlsx

## Getting Started

1. Clone repository
2. Run `npm install`
3. Spin up PostgreSQL and Redis with `docker-compose up -d`
4. Copy `.env.example` to `.env` and fill in DB connections.
5. Push the Prisma Schema: `npx prisma db push`
6. Seed the default admin user: `npx ts-node prisma/seed.ts` (Email: fayez@rsb.com.bd)
7. Start Server: `npm run dev`

## Deployment
A multi-stage `Dockerfile` is provided for containerized production deployment. `docker-compose` can also be explicitly overridden for orchestrating the web, db, and caching layers in staging environments.
