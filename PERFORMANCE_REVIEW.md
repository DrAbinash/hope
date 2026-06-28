# Performance Review
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Database Query Performance

### Critical: No Secondary Indexes

None of the high-query tables have secondary indexes beyond the primary key. PostgreSQL does not auto-index foreign keys.

| Table | Missing Indexes | Impact |
|-------|----------------|--------|
| `patients` | `entity_id`, `phone`, `name` | Full scan on every patient search |
| `opd_visits` | `patient_id`, `entity_id`, `doctor_id`, `visit_date` | Full scan on OPD listing |
| `ipd_admissions` | `patient_id`, `entity_id`, `status` | Full scan on IPD board |
| `invoices` | `patient_id`, `entity_id`, `status`, `invoice_date` | Full scan on billing history |
| `medicines` | `entity_id`, `name`, `barcode`, `generic_name`, `expiry_date` | Full scan on pharmacy search + expiry alerts |
| `vendor_purchases` | `vendor_id`, `status`, `invoice_date` | Full scan on purchase history |
| `stock_movements` | `medicine_id`, `created_at` | Full scan on stock ledger |
| `diagnostic_orders` | `patient_id`, `status`, `type` | Full scan on lab/radiology queue |
| `insurance_claims` | `patient_id`, `status` | Full scan on TPA listing |

**Recommended index SQL (safe to add without downtime — CREATE INDEX CONCURRENTLY):**
```sql
CREATE INDEX CONCURRENTLY idx_patients_entity ON patients(entity_id);
CREATE INDEX CONCURRENTLY idx_patients_phone ON patients(phone);
CREATE INDEX CONCURRENTLY idx_patients_name ON patients(name text_pattern_ops);
CREATE INDEX CONCURRENTLY idx_opd_visits_patient ON opd_visits(patient_id);
CREATE INDEX CONCURRENTLY idx_opd_visits_date ON opd_visits(visit_date);
CREATE INDEX CONCURRENTLY idx_opd_visits_entity ON opd_visits(entity_id);
CREATE INDEX CONCURRENTLY idx_ipd_admissions_patient ON ipd_admissions(patient_id);
CREATE INDEX CONCURRENTLY idx_ipd_admissions_status ON ipd_admissions(status);
CREATE INDEX CONCURRENTLY idx_invoices_patient ON invoices(patient_id);
CREATE INDEX CONCURRENTLY idx_invoices_date ON invoices(invoice_date);
CREATE INDEX CONCURRENTLY idx_invoices_status ON invoices(status);
CREATE INDEX CONCURRENTLY idx_medicines_entity ON medicines(entity_id);
CREATE INDEX CONCURRENTLY idx_medicines_name ON medicines(name text_pattern_ops);
CREATE INDEX CONCURRENTLY idx_medicines_barcode ON medicines(barcode);
CREATE INDEX CONCURRENTLY idx_medicines_expiry ON medicines(expiry_date);
CREATE INDEX CONCURRENTLY idx_stock_movements_medicine ON stock_movements(medicine_id);
```

### Critical: ILIKE Full Table Scan on Search

`search.ts` uses `ILIKE '%term%'` on name, phone, and UHID columns. Leading-wildcard patterns cannot use B-tree indexes.

**Option A (low effort):** Add `pg_trgm` extension and GIN trigram index:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_patients_name_trgm ON patients USING GIN (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_patients_phone_trgm ON patients USING GIN (phone gin_trgm_ops);
```

**Option B (recommended long-term):** Add a `tsvector` full-text search column updated by trigger.

### High: Dashboard Full Table Scan

`dashboard.ts` fetches `monthInvoices` and `pendingDues` with JavaScript-side date filtering — loading the entire invoice table into memory every dashboard load. As the DB grows to tens of thousands of invoices, this becomes a bottleneck.

**Fix:** Push date filter to SQL:
```ts
// Instead of: db.select().from(invoicesTable) then .filter() in JS
// Use: db.select().from(invoicesTable).where(
//   and(gte(invoicesTable.invoiceDate, startOfMonth), lte(invoicesTable.invoiceDate, today))
// )
```

### High: N+1 Queries in Reports

`reports.ts` — `GET /reports/doctor-wise` and `GET /reports/opd-to-ipd` fire one DB query per row inside a `Promise.all` loop. With 50 doctors or 200 conversions, this is 50–200 separate DB round-trips per request.

**Fix:** Rewrite as single aggregated query with `GROUP BY` or `JOIN`.

### Medium: Unbounded Page Sizes

Multiple list endpoints accept `limit` from query string with no enforced maximum. A request with `?limit=999999` pulls the entire table into memory.

**Recommended fix:** Add a max limit cap:
```ts
const limit = Math.min(parseInt(req.query.limit as string || "50"), 500);
```

## API Response Performance

### Dashboard Parallelization
The 8 summary queries in `dashboard.ts` are correctly wrapped in `Promise.all` — this is well done. The bottleneck is full table scans, not serialization.

### Accounting Tally Export
`GET /accounting/tally-export` fetches ALL vouchers with no date filter at the DB level. For hospitals with years of accounting history, this will time out.

**Fix:** Require a date range parameter and enforce it in the SQL WHERE clause.

## Frontend Performance

### Bundle Size
No bundle analysis performed (requires build environment). Observations:
- Tailwind CSS v4 with Vite plugin — tree-shaking should work correctly
- Recharts is a moderately large dependency but used across multiple report pages — acceptable
- Framer Motion is loaded globally but used in limited places — consider lazy loading per page

### Lazy Loading
All pages are imported statically in `App.tsx`. Adding `React.lazy()` with `Suspense` for heavy pages (pharmacy analytics, finance reports, AI finance) would reduce initial bundle size.

### No Caching
The React Query setup likely uses default stale times. For relatively static data (medicines list, billing heads, ward/bed structure), adding `staleTime: 5 * 60 * 1000` (5 minutes) would reduce unnecessary refetches.

## Files Reviewed
`routes/dashboard.ts`, `routes/patients.ts`, `routes/search.ts`, `routes/reports.ts`, `routes/accounting.ts`, `routes/billing.ts`, `routes/pharmacy.ts`, all schema files.

## Files Modified
None (performance fixes are SQL migrations and code changes — documented for implementation).

## Remaining Recommendations
1. Run `CREATE INDEX CONCURRENTLY` statements during a low-traffic window (indexes build without locking reads/writes)
2. Add `pg_trgm` for patient name/phone search
3. Fix dashboard date filtering to push to SQL
4. Add max page size enforcement to all list endpoints
5. Add `React.lazy()` for heavy pages
