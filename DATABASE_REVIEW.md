# Database Review
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Schema Inventory

37 tables across clinical, financial, pharmacy, and administrative domains. All schemas defined in `lib/db/src/schema/` using Drizzle ORM.

## Financial Column Types — PASS

All monetary columns correctly use `numeric` with explicit precision. No `float` or `real` found.

| Precision Tier | Tables | Max Value |
|---|---|---|
| `numeric(10,2)` | invoices, billing_heads, medicines (MRP), opd_visits | ~99,999,999 |
| `numeric(12,2)` | ledgers, vouchers, estimations, packages | ~9,999,999,999 |
| `numeric(14,2)` | vendors, vendor_purchases, purchase_returns | ~999,999,999,999 |

**Risk:** A vendor purchase (`numeric(14,2)`) that generates an invoice (`numeric(10,2)`) can error or truncate for values above ~99M. Standardize all monetary columns to `numeric(12,2)` minimum.

## UHID Uniqueness — PASS

`patients.uhid` has `UNIQUE` constraint at the database level. Generation is application-side (no DB sequence). Application-level race conditions are theoretically possible under concurrent load.

## Missing Indexes — CRITICAL

No secondary indexes exist on any table beyond primary keys. All foreign key columns are unindexed.

See PERFORMANCE_REVIEW.md for the full list of recommended `CREATE INDEX CONCURRENTLY` statements.

## Missing Foreign Key Constraints — HIGH

20+ cross-table ID columns have no `.references()` defined. PostgreSQL does not enforce referential integrity for these:

| Table | Column | Missing Reference |
|---|---|---|
| `patients` | `entity_id` | `entities.id` |
| `ipd_admissions` | `entity_id`, `linked_opd_id` | `entities.id`, `opd_visits.id` |
| `opd_visits` | `entity_id`, `ipd_admission_id` | `entities.id`, `ipd_admissions.id` |
| `invoices` | `ipd_admission_id`, `opd_visit_id` | respective tables |
| `discharge_summaries` | `ipd_admission_id` | `ipd_admissions.id` |
| `referral_payouts` | `patientId`, `invoiceId` | orphaned financial records possible |
| `consultant_engagements` | `patientId`, `invoiceId` | orphaned financial records possible |

Adding FK constraints on a populated database requires the data to already be consistent. Run this check first:
```sql
-- Example: find opd_visits.entity_id values not in entities.id
SELECT DISTINCT entity_id FROM opd_visits WHERE entity_id NOT IN (SELECT id FROM entities);
```

## Date Columns Stored as Text — HIGH

12+ date columns are `text` instead of `date` or `timestamptz`. This breaks SQL date comparisons, sorting, and expiry filtering.

| Table | Column | Current Type | Should Be |
|---|---|---|---|
| `medicines` | `expiry_date` | `text` | `date` — CRITICAL for expiry alert queries |
| `ipd_admissions` | `admission_date`, `discharge_date` | `text` | `date` |
| `opd_visits` | `visit_date`, `next_visit_date` | `text` | `date` |
| `invoices` | `invoice_date` | `text` | `date` |
| `vouchers` | `date` | `text` | `date` |
| `insurance_claims` | `preauth_date`, `settlement_date` | `text` | `date` |

**IMPORTANT — Do NOT run this migration without testing.** The application stores date strings as `"YYYY-MM-DD"` which PostgreSQL can cast directly, but verify the data format first:
```sql
SELECT DISTINCT LEFT(expiry_date, 7) FROM medicines ORDER BY 1 LIMIT 20;
```

## Timezone Awareness — MEDIUM

Every `created_at`, `updated_at`, and audit timestamp uses plain `timestamp` (without time zone). For a hospital system with regulatory audit requirements, `timestamptz` is strongly recommended.

This is a significant migration (all tables) and should be planned carefully with a full data backup.

## Migrations Status — CRITICAL

**No migrations folder exists.** The project uses `drizzle-kit push` exclusively. This means:
- No schema change history is recorded
- Rollback is impossible (only manual restore from SQL dump)
- Production schema changes cannot be previewed before application

**Immediate action required:**
1. Run `drizzle-kit generate --config lib/db/drizzle.config.ts` to generate a baseline migration from the current schema
2. Create a `migrations/` folder in `lib/db/`
3. Apply future schema changes via `drizzle-kit migrate` only
4. NEVER run `drizzle-kit push` on production again

## Pharmacy Stock Balance — Dual Source of Truth — HIGH

`medicines` table has a `stock` integer column alongside a `stock_movements` ledger table. Running totals are maintained in both. If any stock movement is not atomically paired with an `UPDATE medicines SET stock = ...`, the column drifts from the ledger.

**Recommended verification query:**
```sql
SELECT m.id, m.name, m.stock AS column_stock,
       COALESCE(SUM(CASE WHEN sm.movement_type = 'in' THEN sm.quantity
                         WHEN sm.movement_type = 'out' THEN -sm.quantity
                         ELSE 0 END), 0) AS ledger_stock
FROM medicines m
LEFT JOIN stock_movements sm ON sm.medicine_id = m.id
GROUP BY m.id, m.name, m.stock
HAVING m.stock != COALESCE(SUM(...), 0);
```

## Type Inconsistencies — MEDIUM

| Table | Column | Issue |
|---|---|---|
| `bank_details` | `is_active` | `integer` (0/1) — should be `boolean` like `employees.is_active` |

## Files Reviewed
All 37 files in `lib/db/src/schema/`. `lib/db/src/index.ts`. `lib/db/drizzle.config.ts`.

## Files Modified
None (schema changes require planned migrations — documented only).
