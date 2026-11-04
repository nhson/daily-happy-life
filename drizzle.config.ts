import { defineConfig } from "drizzle-kit";

// Migrations run against the unpooled connection (DDL), app queries use DATABASE_URL.
export default defineConfig({
  schema: "./src/data/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  strict: true,
});
