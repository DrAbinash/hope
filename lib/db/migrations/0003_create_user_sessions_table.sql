-- ============================================================
-- Migration 0003: Create user_sessions table for express-session
-- Required for session persistence using connect-pg-simple
-- This table stores Express session data
-- ============================================================

-- Create user_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
);

-- Create index on expire column for automatic session cleanup
-- Sessions older than expire time can be deleted
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire"
ON "user_sessions"("expire");

-- Grant permissions if needed (usually not required in Docker)
-- This is a safety measure for multi-user PostgreSQL setups
