---
name: billing-logic
description: Core billing business logic — mapping engine, pricing lookups, invoice building, name aliasing, accounts receivable, and normalization rules.
---

# Billing Logic Skill

## Purpose

Implements the core billing pipeline: Procedure → mapping → pricing → invoice lines.
Also handles name aliasing, accounts receivable tracking, and MIS reporting.

## Name Aliasing (Hospital & Radiologist)

Hospital and radiologist names can vary slightly across MSSQL instances:
- `"Popular Diagnostic Centre Ltd. Tangail"` vs `"Popular Diagnostic Centre, Tangail"`
- `"Dr. Mariyam Sultana"` vs `"Dr. Mariam Sultana"`

### Alias Configuration

```
Model: ClientAlias
  client_id    → links to Client
  alias_name   → the raw name as seen from MSSQL / uploads
  instance_id? → optional, scope alias to specific instance

Model: RadiologistAlias
  radiologist_id → links to Radiologist
  alias_name     → the raw name variant
  instance_id?   → optional
```

### Resolution Flow

```
1. Incoming study has hospital_name = "Popular Diagnostic Centre, Tangail"
2. Look up ClientAlias WHERE alias_name matches (case-insensitive, trimmed)
3. Found? → Resolve to canonical Client record
4. Not found? → Flag for manual mapping in configuration
```

Same logic applies for `final_rad_name` → `Radiologist` via `RadiologistAlias`.

## Mapping Engine (src/lib/mapping-engine.ts)

### Algorithm

```
Input: Study { modality, procedure_raw }
  ↓
Step 1: Normalize (trim, uppercase, collapse spaces, apply synonyms)
  ↓
Step 2: Exact Match (modality + procedure_pattern, is_regex=false)
  → Found? Return { type, typedr, confidence: EXACT }
  ↓
Step 3: Fuzzy Match (regex patterns + substring contains, ordered by priority)
  → Found? Return { type, typedr, confidence: FUZZY }
  ↓
Step 4: No Match → Return { type: null, typedr: null, confidence: MANUAL }
```

### Normalization

```typescript
function normalize(modality: string, procedure: string): NormalizedInput {
  let mod = modality?.trim().toUpperCase() || '';
  let proc = procedure?.trim().toUpperCase() || '';
  
  // Collapse multiple spaces
  proc = proc.replace(/\s+/g, ' ');
  
  // Apply DB-stored synonym rules (cached 5 min)
  for (const rule of normalizationCache) {
    proc = proc.replaceAll(rule.raw_term.toUpperCase(), rule.normalized.toUpperCase());
  }
  
  // Remove punctuation except hyphens
  proc = proc.replace(/[^\w\s-]/g, '');
  
  return { modality: mod, procedure: proc };
}
```

### Type / TypeDR Concept

- **Type**: Billing category for the CLIENT invoice (e.g. "X-Ray", "CT Scan", "MRI Brain")
- **TypeDR**: Billing category for the RADIOLOGIST fee (may differ from Type)

A single `Mapping` record produces both `type` and `typedr` from a `(modality, procedure_pattern)` pair.

## Pricing Lookup (src/lib/pricing.ts)

### Client Price Resolution

```
1. Search ClientPrice WHERE client_id AND type AND effective_from <= reportDate AND (effective_to IS NULL OR effective_to >= reportDate)
2. Fallback: GlobalPrice WHERE type
3. If neither found: return null → flag for manual review
```

### Radiologist Fee Resolution

```
1. Resolve radiologist via RadiologistAlias (or direct name match)
2. Search RadiologistPrice WHERE radiologist_id AND typedr AND date range
3. If ambiguous match: return null → flag for disambiguation
```

## Accounts Receivable & Ledger

### Client Account Model

```
Model: ClientAccount (or tracked on Client itself)
  client_id       → Client
  total_billed    → running sum of all finalized invoices
  total_paid      → running sum of all payments received
  current_due     → total_billed - total_paid
  last_payment_at → most recent payment date
```

### Payment Tracking

```
Model: Payment
  id, client_id, amount, payment_date, reference, note, created_by, created_at
```

- When a payment is recorded, `current_due` is recalculated
- Payment history is visible per client
- Audit log records all payment events

### Auto Previous Due on Invoice

When creating an invoice, `previous_due` is automatically pulled from the client ledger:
```
previous_due = client.current_due (sum of all unpaid invoices for this client)
total_due = subtotal + previous_due
```

User can override `previous_due` manually if needed.

## Invoice Builder (src/lib/invoice-builder.ts)

### Custom Duration

Users choose **any date range** — not locked to calendar months:
- Start: any date
- End: any date
- Common presets: "This Month", "Last Month", "Custom Range"

### Pipeline

```
1. Resolve client via name aliases (hospital_name → Client)
2. Fetch studies: resolved client, custom date range, type IS NOT NULL,
   is_duplicate = false (exclude flagged duplicates)
3. Group by type → { type, qty: COUNT(*) }
4. For each group: lookupClientPrice(clientId, type, midpoint of date range)
5. Compute line total = qty × price
6. Auto-fetch previous_due from client ledger
7. Return InvoiceLine[] + previous_due (not persisted until user confirms)
```

> **IMPORTANT**: Duplicates are ALWAYS excluded from invoice generation.
> Users must review and resolve duplicates before finalizing invoices.

### Line Item Editing

Users can modify generated lines before finalizing:
- Adjust qty (manual override)
- Change unit price
- Add custom line items
- Remove lines
- Override previous_due amount
- Undo stack (in-memory, Ctrl+Z support)

### Finalization

Once finalized:
- Status set to `FINAL`
- Lines locked (no further edits)
- `finalized_at` timestamp recorded
- Client's `total_billed` updated by invoice subtotal
- Audit log entry created

## Invoice Numbering

Format: `INV-{YYYYMM}-{serial}`
Example: `INV-202601-0042`

Serial auto-increments per month.
