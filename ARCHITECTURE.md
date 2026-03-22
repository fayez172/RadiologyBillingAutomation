# TeleRadiology Billing Automation — Architecture

## System Overview

A full-stack Next.js 14 web application that automates teleradiology billing, replacing
a manual Microsoft Excel workflow. Connects to multiple remote MS SQL Server instances
to pull study data, maps procedures to billing categories, and generates invoices.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma (PostgreSQL) |
| Auth | NextAuth.js v5 (credentials) |
| Queue | BullMQ + Redis |
| Remote DB | MS SQL Server (mssql/tedious, READ-ONLY) |
| PDF | Puppeteer + Handlebars |
| Excel | SheetJS (xlsx) |
| Container | Docker Compose |

## Directory Structure

```
src/
├── app/
│   ├── (dashboard)/           # Authenticated routes
│   │   ├── layout.tsx         # Sidebar + header layout
│   │   ├── page.tsx           # Dashboard
│   │   ├── upload/            # File upload
│   │   ├── mapping/           # Mapping review queue
│   │   ├── config/
│   │   │   ├── mappings/      # Master mappings CRUD
│   │   │   ├── clients/       # Clients & prices
│   │   │   ├── radiologists/  # Radiologists & fees
│   │   │   └── db-instances/  # MSSQL instance management
│   │   ├── invoices/          # Invoice list + builder
│   │   ├── exports/           # Study & radiologist exports
│   │   └── admin/             # Users, audit logs, settings
│   ├── api/                   # Route handlers
│   └── login/                 # Login page
├── components/                # Reusable UI components
├── lib/                       # Core business logic
│   ├── prisma.ts              # Prisma client singleton
│   ├── auth.ts                # NextAuth config
│   ├── mssql.ts               # MSSQL connection manager
│   ├── mapping-engine.ts      # Procedure → Type resolver
│   ├── pricing.ts             # Price lookups
│   ├── invoice-builder.ts     # Invoice line computation
│   ├── encryption.ts          # AES-256 for passwords
│   ├── audit.ts               # Audit log helper
│   └── api-response.ts        # Standardized responses
├── middleware.ts              # Auth middleware
└── types/                     # Shared TypeScript types
prisma/
├── schema.prisma              # Data model
├── seed.ts                    # Seed script
└── migrations/                # Auto-generated
templates/
├── invoice.html               # Handlebars PDF template
└── samples/                   # Sample CSV/XLSX
docker-compose.yml
Dockerfile
.agent/                        # Agent configuration
```

## Key Agents

| Agent | Domain | When Used |
|-------|--------|-----------|
| `backend-specialist` | API routes, DB, MSSQL, business logic | Most tasks |
| `frontend-specialist` | UI pages, components, UX | Dashboard, forms |
| `security-auditor` | Encryption, auth, MSSQL safety | DB credentials, auth |
| `project-planner` | Sprint planning, task breakdown | New features |

## Key Skills

| Skill | Purpose |
|-------|---------|
| `mssql-integration` | MSSQL connection rules, READ-ONLY enforcement |
| `billing-logic` | Mapping engine, pricing, invoice computation |
| `data-import` | CSV/XLSX parsing, column mapping, dedup |
| `docker-deployment` | Containerized build & deployment |

## Data Flow

```
MSSQL Prod Instances ──sync──▶ PostgreSQL (local cache) ──query──▶ Next.js App
CSV/XLSX Uploads ──────parse──▶ PostgreSQL (local cache) ──query──▶ Next.js App
```

The app **never queries MSSQL on the fly** for billing. All data lives in local PostgreSQL after sync.

## Critical Rules

1. **MSSQL is READ-ONLY** — never issue INSERT/UPDATE/DELETE
2. **Credentials never hardcoded** — always `.env.local`
3. **Unified composite key** — always `instanceId:WorkflowID` (uploads MUST select an instance)
4. **All API responses** follow `{ data, error, meta }` convention
5. **All auditable actions** must call `audit()` helper
6. **Duplicate detection** — fuzzy match (hospital + modality + procedure + patient) → flag, exclude from invoices
7. **Local caching** — PostgreSQL is the source of truth for billing; MSSQL only touched during sync
8. **Name aliasing** — hospital/radiologist names vary across instances; alias tables map to canonical entities
9. **Accounts receivable** — track billed, paid, due per client; auto-insert `previous_due` on invoices
10. **Custom invoice periods** — users pick any date range, not locked to calendar months
