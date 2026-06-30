# Database Migrations Guide

## How the System Works

**Auto-Discovery & Tracking:**
- Migrations are discovered automatically from this directory (alphabetically sorted)
- Each migration is tracked in the `schema_versions` table
- On every deployment, any unapplied migrations are run automatically
- Schema is validated before the app starts

**Key Benefits:**
✅ No manual migration tracking needed  
✅ Impossible to forget to run a migration  
✅ Database mismatches caught before app starts  
✅ Clear error messages if schema is wrong  
✅ Works on empty, existing, and partially migrated databases  

---

## Adding a New Migration

### Rule: ONLY add columns/tables, NEVER remove them in startup code

**Step 1:** Create migration file
```bash
# Use next sequential number
touch lib/db/migrations/0002_add_your_feature.sql
```

**Step 2:** Write idempotent SQL

For **new tables:**
```sql
-- Use IF NOT EXISTS so it's safe on re-deployment
CREATE TABLE IF NOT EXISTS "your_table" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Regular indexes (not CONCURRENT — that's only for existing data)
CREATE INDEX IF NOT EXISTS "idx_your_table_name" ON "your_table"("name");
```

For **adding columns to existing tables:**
```sql
-- Use ALTER TABLE IF EXISTS + ADD COLUMN IF NOT EXISTS
ALTER TABLE IF EXISTS "existing_table"
ADD COLUMN IF NOT EXISTS "new_column" text;

-- If the column needs to be NOT NULL with existing data:
-- 1. Add as nullable first (above)
-- 2. Backfill with default values
-- 3. Add NOT NULL constraint in separate ALTER

-- Backfill example:
UPDATE "existing_table"
SET "new_column" = 'default_value'
WHERE "new_column" IS NULL;

-- Then make NOT NULL
ALTER TABLE "existing_table"
ALTER COLUMN "new_column" SET NOT NULL;
```

For **adding constraints/indexes to existing tables:**
```sql
-- Use separate migrations from column additions
-- So column exists before constraint creation

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "idx_table_unique_col"
ON "existing_table"("unique_column");
```

**Step 3:** Update startup.mjs schema validation

Edit the `validateSchema` function in startup.mjs:

```javascript
const requiredColumns = {
  entities: [...],
  employees: [...],
  your_table: ['id', 'name', 'new_column', 'created_at'],  // ← Add this line
};
```

**Step 4:** Test locally

```bash
# Fresh database test
docker volume rm hope_postgres_data
docker compose build --no-cache
docker compose up -d --build
sleep 20
docker compose logs app | grep "\[startup\]"

# Should see:
# [startup] Running migration: 0002_add_your_feature.sql
# [startup]   ✓ 0002_add_your_feature.sql (XXXms)
# [startup] ✓ Schema validation passed
```

**Step 5:** Commit with clear message

```bash
git add lib/db/migrations/0002_add_your_feature.sql
git add startup.mjs  # (if you updated validation)
git commit -m "Add your_table with new_column for feature X

- Creates your_table with id, name, created_at
- Adds new_column to existing_table
- Updates schema validation"
```

---

## Migration Patterns

### ✅ SAFE Patterns

```sql
-- Pattern 1: Create table (idempotent on re-deployment)
CREATE TABLE IF NOT EXISTS "table_name" (...)

-- Pattern 2: Add column safely (won't fail if already exists)
ALTER TABLE IF EXISTS "table_name"
ADD COLUMN IF NOT EXISTS "col_name" type;

-- Pattern 3: Backfill with transaction safety
UPDATE "table_name"
SET "col_name" = 'value'
WHERE "col_name" IS NULL;

-- Pattern 4: Add constraint idempotently
CREATE UNIQUE INDEX IF NOT EXISTS "idx_name"
ON "table_name"("column");

-- Pattern 5: Handle duplicates before constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name='table_name' AND column_name='col_name') THEN
    -- Backfill logic here
    UPDATE "table_name" SET "col_name" = 'value' WHERE "col_name" IS NULL;
    CREATE UNIQUE INDEX ... ON "table_name"("col_name");
  END IF;
END $$;
```

### ❌ UNSAFE Patterns

```sql
-- ❌ DON'T: Regular CREATE TABLE (fails on re-deployment)
CREATE TABLE "table_name" (...)

-- ❌ DON'T: Direct ALTER TABLE (fails if column exists)
ALTER TABLE "table_name" ADD COLUMN "col_name" text;

-- ❌ DON'T: CREATE INDEX CONCURRENTLY inside migration
-- (PostgreSQL doesn't allow inside transactions)
CREATE INDEX CONCURRENTLY ...

-- ❌ DON'T: Use ON CONFLICT with non-existent constraints
INSERT INTO ... ON CONFLICT (col) DO NOTHING
-- (Constraint may not exist on existing databases)

-- ❌ DON'T: Remove columns in startup code
-- (Other code might still reference them)
ALTER TABLE "table_name" DROP COLUMN "col_name";

-- ❌ DON'T: Assume columns exist without checking
INSERT INTO "table" (id, assumed_column) VALUES (1, 'x');
-- (If migration wasn't run, this crashes)
```

---

## Schema Validation

The startup process validates these tables exist with the required columns:

### entities
- id, name, type, email, created_at, updated_at

### employees
- id, entity_id, emp_code, username, name, email, role, department, pin_hash, is_active, created_at, updated_at

**If validation fails:**
- App startup blocks with clear error showing which columns are missing
- Check which migration should have added those columns
- Ensure migration file exists in lib/db/migrations/
- Check syntax (IF NOT EXISTS / IF EXISTS clauses)
- Restart container to trigger auto-discovery

---

## Adding a Table Needed by Code

If production code references a table that doesn't exist:

1. Create migration: `lib/db/migrations/XXXX_add_table_name.sql`
2. Add ALL columns that production code uses
3. Update validation in startup.mjs
4. Test with fresh database

Example: If pharmacy-v4.ts references `pediatric_dose_master`:

```sql
-- lib/db/migrations/0002_add_pharmacy_tables.sql
CREATE TABLE IF NOT EXISTS "pediatric_dose_master" (
  "id" serial PRIMARY KEY NOT NULL,
  "drug_name" text NOT NULL,
  "dosage" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  -- Add other columns here based on what code uses
);
```

Then update startup.mjs validation:
```javascript
pediatric_dose_master: ['id', 'drug_name', 'dosage', 'created_at']
```

---

## Troubleshooting

### Migration fails with "column already exists"
- Wrap in IF NOT EXISTS: `ADD COLUMN IF NOT EXISTS`
- Already applied migrations are skipped, this shouldn't happen

### Schema validation fails at startup
```
[startup] ========== SCHEMA VALIDATION FAILED ==========
[startup] Missing columns detected:
[startup]   Table "employees": emp_code
```

Solutions:
1. Check lib/db/migrations/ for migration that adds emp_code
2. Verify migration SQL has `ADD COLUMN IF NOT EXISTS`
3. Restart container to trigger migration discovery
4. Check PostgreSQL logs: `docker compose logs postgres | tail -50`

### "Migration file not found"
- Ensure .sql file is in lib/db/migrations/
- File must be named with leading zero (0001_, 0002_, etc.)
- Must end with .sql extension

### Concurrent deployment causes unique constraint violation
- startup.mjs handles code 23505 (unique violation) with retry
- If it still fails after retry, constraint may have different name
- Check schema_versions table isn't growing with duplicates

---

## Production Safety Checklist

Before deploying a new migration:

- [ ] File named sequentially (0002_, 0003_, etc.)
- [ ] All statements have IF NOT EXISTS or IF EXISTS
- [ ] No DROP statements (backward compatibility)
- [ ] No DDL changes to already-deployed tables (ALTER TABLE only)
- [ ] Schema validation updated in startup.mjs
- [ ] Tested on fresh database
- [ ] Tested on existing database (redeployment scenario)

---

## Examples in This Repository

### 0000_baseline.sql
- Creates all baseline tables (entities, employees, patients, etc.)
- Uses CREATE TABLE IF NOT EXISTS
- All indexes use standard CREATE INDEX (not CONCURRENT)

### 0001_add_emp_code.sql
- Shows how to safely add column to existing table
- Uses DO $$ block to handle duplicates before creating constraint
- Uses CREATE UNIQUE INDEX CONCURRENTLY (outside transaction block)

---

**Golden Rule:** Every migration must be safe to run multiple times on any database state (empty, existing, partially migrated).
