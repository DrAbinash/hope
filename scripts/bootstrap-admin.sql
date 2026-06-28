-- ============================================================
-- Hope Hospital ERP — Admin Bootstrap Script
-- Creates a default entity and super-admin employee account.
-- Safe to run multiple times (ON CONFLICT DO NOTHING / DO UPDATE).
-- PIN: 1234  (bcrypt cost 12)
-- ============================================================

BEGIN;

-- 1. Create default entity (the hospital)
INSERT INTO entities (name, type, owner, email, created_at)
VALUES ('Hope NeuroTrauma & MultiSpeciality Hospital', 'hospital', 'Abinash Singh', 'abinashsingh@gmail.com', now())
ON CONFLICT (name) DO NOTHING;

-- 2. Create admin employee
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
  e.id,
  'ADMIN001',
  'Abinash Singh',
  'abinashsingh',
  'abinashsingh@gmail.com',
  'admin',
  'Administration',
  '$2b$12$e5ftWx/lif0c0JS6UBzyg.bkQ/vS/YZfeZy8vofvw5XPir8jNHetm',
  true,
  now()
FROM entities e
WHERE e.name = 'Hope NeuroTrauma & MultiSpeciality Hospital'
LIMIT 1
ON CONFLICT (username) DO UPDATE
  SET pin_hash  = EXCLUDED.pin_hash,
      email     = EXCLUDED.email,
      role      = EXCLUDED.role,
      is_active = true;

COMMIT;

-- Verify
SELECT id, entity_id, emp_code, username, name, email, role, is_active
FROM employees
WHERE username = 'abinashsingh';
