/**
 * startup.mjs — runs before the app server on every deployment.
 * Uses only `pg` (always available) — no drizzle-kit binary needed.
 * 1. Waits for Postgres to be ready
 * 2. Runs baseline migration (CREATE TABLE IF NOT EXISTS — idempotent)
 * 3. Seeds the default entity + admin account
 */

import pg from "pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
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

async function runMigration(client) {
  const sqlPath = join(__dirname, "lib/db/migrations/0000_baseline.sql");
  const sql = readFileSync(sqlPath, "utf8");
  console.log("[startup] Running baseline migration...");
  try {
    await client.query(sql);
    console.log("[startup] Migration complete");
  } catch (err) {
    console.error("\n[startup] ========== MIGRATION FAILED ==========");
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
    console.error("[startup] Full Error Object:");
    console.dir(err, { depth: null });
    console.error("[startup] ==========================================\n");
    throw err;
  }
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
    await runMigration(client);
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
