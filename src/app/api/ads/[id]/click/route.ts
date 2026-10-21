import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ads } from "@/db/schema";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const [ad] = await db.update(ads).set({ clicks: sql`${ads.clicks} + 1` }).where(eq(ads.id, id)).returning();
  const target = ad?.linkUrl && /^(https?:\/\/|\/)/.test(ad.linkUrl) ? ad.linkUrl : "/";
  return Response.redirect(new URL(target, req.url), 302);
}
