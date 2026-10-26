/**
 * Seed the database with plans, an admin account and (optionally) demo content.
 *
 *   npm run db:seed             → plans + admin + demo data
 *   SEED_DEMO=0 npm run db:seed → plans + admin only
 *
 * The same setup also runs automatically when the server starts (see src/instrumentation.ts).
 */
import { pool } from "../src/db";
import { ensureBaseData, runMigrations, seedDemoData } from "../src/lib/bootstrap";

async function main() {
  await runMigrations();
  const phone = process.env.SEED_ADMIN_PHONE ?? "07700000001";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "halali-admin-2026";
  await ensureBaseData({ phone, password });
  console.log(`Admin: ${phone} / ${password}`);
  if (process.env.SEED_DEMO !== "0") await seedDemoData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
