import { json, run } from "./http";
import { match } from "./routes";

/** Dispatch a /api/v1/* request through the route table. */
export async function handleApiRequest(req: Request) {
  const path = new URL(req.url).pathname.replace(/^\/api\/v1/, "") || "/";
  const m = match(req.method, path);
  if (m === "method_not_allowed")
    return json({ error: { code: "method_not_allowed", message: "طريقة الطلب غير مدعومة." } }, 405);
  if (!m) return json({ error: { code: "not_found", message: "المسار غير موجود." } }, 404);
  return run(req, m.params, m.route.handler, m.route.auth);
}
