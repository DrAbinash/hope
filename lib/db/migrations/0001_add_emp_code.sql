-- ============================================================
-- Migration 0001: Add emp_code column to employees table
-- Safe for existing databases - uses ALTER TABLE IF NOT EXISTS
-- ============================================================

-- Add emp_code column if it doesn't exist
ALTER TABLE IF EXISTS "employees"
ADD COLUMN IF NOT EXISTS "emp_code" text;

-- emp_code should be UNIQUE (each employee has unique ID)
-- Create unique index (idempotent - only if doesn't exist)
DO $$
BEGIN
  -- Check if the unique constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'employees' AND column_name = 'emp_code' AND constraint_name LIKE '%emp_code%'
  ) THEN
    -- Check for NULL or duplicate values that would block the unique constraint
    IF EXISTS (
      SELECT emp_code FROM employees WHERE emp_code IS NOT NULL
      GROUP BY emp_code HAVING COUNT(*) > 1
    ) THEN
      -- Duplicate emp_codes exist - backfill with auto-incrementing values
      UPDATE employees
      SET emp_code = 'EMP' || LPAD(id::text, 5, '0')
      WHERE emp_code IS NULL OR emp_code IN (
        SELECT emp_code FROM employees WHERE emp_code IS NOT NULL
        GROUP BY emp_code HAVING COUNT(*) > 1
      );
    ELSE
      -- No duplicates, just backfill NULLs
      UPDATE employees
      SET emp_code = 'EMP' || LPAD(id::text, 5, '0')
      WHERE emp_code IS NULL;
    END IF;

    -- Now create the unique index (CONCURRENTLY removed - can't use inside transaction)
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_employees_emp_code"
    ON "employees"("emp_code");
  END IF;
END $$;
