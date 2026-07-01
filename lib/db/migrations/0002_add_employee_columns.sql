-- ============================================================
-- Migration 0002: Add missing employee columns
-- Adds: landing_path, designation, address, joining_date, monthly_salary
-- Safe for existing databases - uses ALTER TABLE IF NOT EXISTS
-- ============================================================

-- Add landing_path column (default landing page after login)
ALTER TABLE IF EXISTS "employees"
ADD COLUMN IF NOT EXISTS "landing_path" text;

-- Add designation column (job title)
ALTER TABLE IF EXISTS "employees"
ADD COLUMN IF NOT EXISTS "designation" text;

-- Add address column (employee address)
ALTER TABLE IF EXISTS "employees"
ADD COLUMN IF NOT EXISTS "address" text;

-- Add joining_date column (employee joining date)
ALTER TABLE IF EXISTS "employees"
ADD COLUMN IF NOT EXISTS "joining_date" text;

-- Add monthly_salary column (numeric with precision 10, scale 2)
ALTER TABLE IF EXISTS "employees"
ADD COLUMN IF NOT EXISTS "monthly_salary" numeric(10, 2);
