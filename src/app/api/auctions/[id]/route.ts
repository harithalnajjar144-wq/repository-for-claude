import { getCurrentUser } from "@/lib/auth";
import { getAuctionState } from "@/lib/auctionState";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const state = await getAuctionState(Number(id) || 0, user?.id);
  if (!state) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
