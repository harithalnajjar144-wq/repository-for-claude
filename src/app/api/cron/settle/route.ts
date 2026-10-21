import { settleDueAuctions } from "@/lib/auctions";

/**
 * Closes auctions whose time is up. Call every minute from a scheduler, e.g.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/settle
 * (Auctions are also settled lazily whenever someone views them.)
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const settled = await settleDueAuctions();
  return Response.json({ settled });
}
