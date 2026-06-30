/**
 * startup.mjs — runs before the app server on every deployment.
 * Auto-discovers and runs ALL migrations sequentially (self-healing).
 * Validates schema completeness before allowing app to start.
 *
 * 1. Waits for Postgres to be ready
 * 2. Creates schema_versions tracking table (idempotent)
 * 3. Auto-discovers migrations in lib/db/migrations/
 * 4. Runs any unapplied migrations in order
 * 5. Validates schema matches code requirements
 * 6. Seeds the default entity + admin account
 */

import pg from "pg";
import bcrypt from "bcryptjs";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[startup] DATABASE_URL is not set");
  process.exit(1);
}

async function waitForDb(retries = 15, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      console.log("[startup] Database is ready");
      return;
    } catch (err) {
      console.log(`[startup] Waiting for database... (${i}/${retries})`);
      await client.end().catch(() => {});
      if (i === retries) throw new Error("Database never became ready");
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function initMigrationTracker(client) {
  const trackerSql = `
    CREATE TABLE IF NOT EXISTS schema_versions (
      id serial PRIMARY KEY,
      version text NOT NULL UNIQUE,
      applied_at timestamp DEFAULT now() NOT NULL,
      execution_time_ms integer
    );
  `;
  try {
    await client.query(trackerSql);
  } catch (err) {
    console.error("[startup] Failed to create schema_versions table:", err.message);
    throw err;
  }
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    `SELECT version FROM schema_versions ORDER BY version ASC`
  );
  return new Set(result.rows.map(r => r.version));
}

async function discoverMigrations() {
  const migrationsDir = join(__dirname, "lib/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();
  return files;
}

async function runMigrations(client) {
  console.log("[startup] Initializing migration tracker...");
  await initMigrationTracker(client);

  const appliedVersions = await getAppliedMigrations(client);
  const allMigrations = await discoverMigrations();
  const pendingMigrations = allMigrations.filter(m => !appliedVersions.has(m));

  if (pendingMigrations.length === 0) {
    console.log("[startup] All migrations already applied");
    return;
  }

  console.log(`[startup] Found ${pendingMigrations.length} pending migration(s)`);

  for (const migrationFile of pendingMigrations) {
    const migrationPath = join(__dirname, "lib/db/migrations", migrationFile);
    const sql = readFileSync(migrationPath, "utf8");

    console.log(`[startup] Running migration: ${migrationFile}`);
    const startTime = Date.now();

    try {
      await client.query(sql);
      const executionTime = Date.now() - startTime;

      await client.query(
        `INSERT INTO schema_versions (version, execution_time_ms) VALUES ($1, $2)`,
        [migrationFile, executionTime]
      );

      console.log(`[startup]   ✓ ${migrationFile} (${executionTime}ms)`);
    } catch (err) {
      console.error("\n[startup] ========== MIGRATION FAILED ==========");
      console.error(`[startup] Migration: ${migrationFile}`);
      console.error("[startup] Error Type:", err.constructor.name);
      console.error("[startup] Error Message:", err.message);
      console.error("[startup] PostgreSQL Code:", err.code);
      console.error("[startup] PostgreSQL Detail:", err.detail);
      console.error("[startup] PostgreSQL Hint:", err.hint);
      console.error("[startup] Stack Trace:");
      console.error(err.stack);
      if (err.cause) {
        console.error("[startup] Underlying Cause:");
        console.error(err.cause);
      }
      console.error("[startup] ==========================================\n");
      throw err;
    }
  }

  console.log("[startup] All migrations completed successfully");
}

async function validateSchema(client) {
  console.log("[startup] Validating schema completeness...");

  const requiredColumns = {
    entities: ['id', 'name', 'type', 'email', 'created_at', 'updated_at'],
    employees: ['id', 'entity_id', 'emp_code', 'username', 'name', 'email', 'role', 'department', 'pin_hash', 'is_active', 'created_at', 'updated_at'],
  };

  const missingColumns = {};

  for (const [table, columns] of Object.entries(requiredColumns)) {
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table]
    );
    const dbColumns = new Set(result.rows.map(r => r.column_name));
    const missing = columns.filter(c => !dbColumns.has(c));

    if (missing.length > 0) {
      missingColumns[table] = missing;
    }
  }

  if (Object.keys(missingColumns).length > 0) {
    console.error("\n[startup] ========== SCHEMA VALIDATION FAILED ==========");
    console.error("[startup] Missing columns detected:");
    for (const [table, columns] of Object.entries(missingColumns)) {
      console.error(`[startup]   Table "${table}": ${columns.join(', ')}`);
    }
    console.error("[startup] Action: Ensure all migrations in lib/db/migrations/ are created and applied");
    console.error("[startup] ===================================================\n");
    throw new Error(`Schema validation failed: missing columns in ${Object.keys(missingColumns).join(', ')}`);
  }

  console.log("[startup] ✓ Schema validation passed");
}

async function seedAdmin(client) {
  // Ensure default entity exists — safe SELECT-then-INSERT (no constraint dependency)
  const entityName = "Hope NeuroTrauma & MultiSpeciality Hospital";

  let entityId;

  // Step 1: Try to find existing entity
  const existingRes = await client.query(
    `SELECT id FROM entities WHERE name = $1`,
    [entityName]
  );

  if (existingRes.rows.length > 0) {
    entityId = existingRes.rows[0].id;
    console.log(`[startup] Default entity found (id=${entityId})`);
  } else {
    // Step 2: Entity doesn't exist, insert it
    try {
      const insertRes = await client.query(
        `INSERT INTO entities (name, type, email, created_at)
         VALUES ($1, 'hospital', 'abinashsingh@gmail.com', now())
         RETURNING id`,
        [entityName]
      );
      entityId = insertRes.rows[0].id;
      console.log(`[startup] Default entity created (id=${entityId})`);
    } catch (err) {
      // Handle edge case: another startup process inserted it between our SELECT and INSERT
      if (err.code === '23505') {
        // Unique constraint violation - try SELECT again
        const retryRes = await client.query(
          `SELECT id FROM entities WHERE name = $1`,
          [entityName]
        );
        if (retryRes.rows.length > 0) {
          entityId = retryRes.rows[0].id;
          console.log(`[startup] Default entity created by concurrent process (id=${entityId})`);
        } else {
          throw new Error(`[startup] Failed to create or find default entity after duplicate key error`);
        }
      } else {
        throw err;
      }
    }
  }

  // Check if admin already exists
  const existing = await client.query(
    `SELECT id, is_active FROM employees WHERE username = 'abinashsingh'`
  );

  if (existing.rows.length === 0) {
    const pinHash = await bcrypt.hash("1234", 12);
    await client.query(
      `INSERT INTO employees
         (entity_id, emp_code, name, username, email, role, department, pin_hash, is_active, created_at)
       VALUES ($1, 'ADMIN001', 'Abinash Singh', 'abinashsingh', 'abinashsingh@gmail.com',
               'admin', 'Administration', $2, true, now())`,
      [entityId, pinHash]
    );
    console.log("[startup] Default admin account created (username: abinashsingh, PIN: 1234)");
  } else if (!existing.rows[0].is_active) {
    const pinHash = await bcrypt.hash("1234", 12);
    await client.query(
      `UPDATE employees SET is_active = true, pin_hash = $1 WHERE username = 'abinashsingh'`,
      [pinHash]
    );
    console.log("[startup] Default admin account re-activated");
  } else {
    console.log("[startup] Admin account already exists — skipping seed");
  }
}

async function main() {
  await waitForDb();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await runMigrations(client);
    await validateSchema(client);
    await seedAdmin(client);
  } finally {
    await client.end();
  }

  console.log("[startup] Done — handing off to application server");
}

main().catch((err) => {
  console.error("\n========== STARTUP FATAL ERROR ==========");
  console.error("Error Type:", err.constructor.name);
  console.error("Error Message:", err.message);
  if (err.code) console.error("Error Code:", err.code);
  if (err.detail) console.error("Error Detail:", err.detail);
  if (err.hint) console.error("Error Hint:", err.hint);
  if (err.constraint) console.error("Constraint:", err.constraint);
  if (err.table) console.error("Table:", err.table);
  if (err.schema) console.error("Schema:", err.schema);
  console.error("\nStack Trace:");
  console.error(err.stack);
  if (err.cause) {
    console.error("\nUnderlying Cause:");
    console.error(err.cause);
    if (err.cause.stack) console.error(err.cause.stack);
  }
  console.error("\nFull Error Object:");
  console.dir(err, { depth: null });
  console.error("========================================\n");
  process.exit(1);
});
