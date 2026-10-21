import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { providers } from "@/db/schema";

/** Short link to a vet or shop profile. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id) || 0;
  const [p] = await db.select({ kind: providers.kind }).from(providers).where(eq(providers.id, id));
  if (!p) return new Response("Not found", { status: 404 });
  redirect(`/${p.kind === "vet" ? "vets" : "shops"}/${id}`);
}
