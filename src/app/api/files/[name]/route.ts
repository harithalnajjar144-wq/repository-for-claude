import { CONTENT_TYPES, fileNameRe, publicBaseUrl, readStoredFile } from "@/lib/uploads";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!fileNameRe.test(name)) return new Response("Not found", { status: 404 });
  const cdn = publicBaseUrl();
  if (cdn) return Response.redirect(`${cdn}/${name}`, 301);
  const data = await readStoredFile(name, false);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[name.split(".").pop()!],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
