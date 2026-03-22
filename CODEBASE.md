# CODEBASE.md — File Dependencies

## Core Libraries (src/lib/)

| File | Depends On | Used By |
|------|-----------|---------|
| `prisma.ts` | `@prisma/client` | Everything |
| `auth.ts` | `prisma.ts`, `bcryptjs` | `middleware.ts`, API routes |
| `encryption.ts` | `crypto` (Node) | `mssql.ts`, seed, DB instance API |
| `mssql.ts` | `encryption.ts`, `prisma.ts`, `mssql` | Sync API, DB instance API |
| `mapping-engine.ts` | `prisma.ts` | Upload API, Sync API, Mapping API |
| `pricing.ts` | `prisma.ts` | Invoice builder |
| `invoice-builder.ts` | `prisma.ts`, `pricing.ts` | Invoice API |
| `audit.ts` | `prisma.ts` | All mutating API routes |
| `api-response.ts` | — | All API routes |

## API Routes (src/app/api/)

| Route | Depends On |
|-------|-----------|
| `/api/auth/[...nextauth]` | `auth.ts` |
| `/api/db-instances/*` | `prisma.ts`, `encryption.ts`, `mssql.ts`, `audit.ts` |
| `/api/upload/*` | `prisma.ts`, `mapping-engine.ts`, `audit.ts` |
| `/api/studies/*` | `prisma.ts`, `mapping-engine.ts`, `audit.ts` |
| `/api/mappings/*` | `prisma.ts`, `audit.ts` |
| `/api/clients/*` | `prisma.ts`, `audit.ts` |
| `/api/radiologists/*` | `prisma.ts`, `audit.ts` |
| `/api/invoices/*` | `prisma.ts`, `invoice-builder.ts`, `pricing.ts`, `audit.ts` |
| `/api/exports/*` | `prisma.ts`, `audit.ts` |
| `/api/admin/*` | `prisma.ts`, `audit.ts` |

## UI Pages (src/app/(dashboard)/)

| Page | Components Used |
|------|----------------|
| Dashboard `/` | Cards, Charts, QuickActions |
| Upload `/upload` | DropZone, ProgressBar, PreviewTable |
| Mapping `/mapping` | DataTable, FilterBar, MappingModal |
| Config Pages | DataTable, Forms, CSVImport |
| Invoices | InvoiceBuilder, LineEditor, ExportButtons |
| Exports | ColumnPicker, FilterPanel, GroupBy |
| Admin | UserTable, AuditLogTable, NormRulesEditor |
