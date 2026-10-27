import { getCurrentUser } from "@/lib/auth";
import { CONTENT_TYPES, fileNameRe, readStoredFile } from "@/lib/uploads";

/** ID documents and payment receipts: admins only. */
export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const { name } = await params;
  if (!fileNameRe.test(name)) return new Response("Not found", { status: 404 });
  const data = await readStoredFile(name, true);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": CONTENT_TYPES[name.split(".").pop()!], "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
