import { defineConfig } from "drizzle-kit";

// DATABASE_URL is required for migrate/push/studio but NOT for generate.
// Warn instead of throwing so `drizzle-kit generate` works without a live DB.
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.warn("Warning: DATABASE_URL is not set. Commands that require a database connection (migrate, push, studio) will fail.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl ?? "postgresql://localhost/placeholder",
  },
  migrations: {
    table: "drizzle_migrations",
    schema: "public",
  },
});
