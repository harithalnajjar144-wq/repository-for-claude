/**
 * Runs once when the server starts (not during `next build`):
 *  1. applies database migrations,
 *  2. creates subscription plans and the admin account (from ADMIN_PHONE / ADMIN_PASSWORD),
 *  3. loads demo data if SEED_DEMO=1,
 *  4. closes finished auctions and sends queued push notifications every minute.
 * This lets hosts like Railway run the app with no extra commands or cron jobs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.SKIP_BOOTSTRAP === "1") return;

  const { runMigrations, ensureBaseData, seedDemoData } = await import("./lib/bootstrap");
  const { settleDueAuctions } = await import("./lib/auctions");
  const { deliverPendingPushes } = await import("./lib/push");

  await runMigrations();
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (phone && password && password.length < 10) {
    console.warn("[halali] ADMIN_PASSWORD must be at least 10 characters; admin account not created.");
    await ensureBaseData();
  } else {
    await ensureBaseData(phone && password ? { phone, password } : undefined);
  }
  if (process.env.SEED_DEMO === "1") await seedDemoData();

  const tick = () =>
    settleDueAuctions()
      .catch((e) => console.error("[halali] auction settlement failed", e))
      .then(() => deliverPendingPushes())
      .catch((e) => console.error("[halali] push delivery failed", e));
  setInterval(tick, 60_000).unref();
  tick();
  console.log("[halali] ready");
}
