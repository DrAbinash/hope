-- ============================================================
-- Hope Hospital ERP — Admin Bootstrap Script
-- Creates a default entity and super-admin employee account.
-- Safe to run multiple times (ON CONFLICT DO NOTHING / DO UPDATE).
-- PIN: 1234  (bcrypt cost 12)
-- ============================================================

BEGIN;

-- 1. Ensure default entity exists (the hospital)
--    First try to find it, then insert if missing
WITH entity_upsert AS (
  SELECT id, name FROM entities
  WHERE name = 'Hope NeuroTrauma & MultiSpeciality Hospital'
  UNION ALL
  INSERT INTO entities (name, type, email, created_at)
  SELECT 'Hope NeuroTrauma & MultiSpeciality Hospital', 'hospital', 'abinashsingh@gmail.com', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM entities
    WHERE name = 'Hope NeuroTrauma & MultiSpeciality Hospital'
  )
  RETURNING id, name
)
SELECT id INTO entity_id_var FROM entity_upsert LIMIT 1;

-- 2. Ensure admin employee exists
--    username: abinashsingh   email: abinashsingh@gmail.com   role: admin
--    PIN: 1234  →  pin_hash below (bcrypt cost 12)
INSERT INTO employees (
  entity_id,
  emp_code,
  name,
  username,
  email,
  role,
  department,
  pin_hash,
  is_active,
  created_at
)
SELECT
  (SELECT id FROM entities WHERE name = 'Hope NeuroTrauma & MultiSpeciality Hospital'),
  'ADMIN001',
  'Abinash Singh',
  'abinashsingh',
  'abinashsingh@gmail.com',
  'admin',
  'Administration',
  '$2b$12$e5ftWx/lif0c0JS6UBzyg.bkQ/vS/YZfeZy8vofvw5XPir8jNHetm',
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM employees WHERE username = 'abinashsingh'
);

-- If admin exists but is inactive, reactivate it
UPDATE employees
SET is_active = true,
    pin_hash = '$2b$12$e5ftWx/lif0c0JS6UBzyg.bkQ/vS/YZfeZy8vofvw5XPir8jNHetm'
WHERE username = 'abinashsingh' AND is_active = false;

COMMIT;

-- Verify
SELECT id, entity_id, emp_code, username, name, email, role, is_active
FROM employees
WHERE username = 'abinashsingh';
