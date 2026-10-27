import { handleApiRequest } from "@/lib/api/handle";
import { CORS_HEADERS } from "@/lib/api/http";

// Every /api/v1/* request goes through the route table in src/lib/api/routes.ts.
export const GET = handleApiRequest;
export const POST = handleApiRequest;
export const PATCH = handleApiRequest;
export const PUT = handleApiRequest;
export const DELETE = handleApiRequest;
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS_HEADERS });
