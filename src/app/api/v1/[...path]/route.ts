import { handleApiRequest } from "@/lib/api/handle";

// Every /api/v1/* request goes through the route table in src/lib/api/routes.ts.
export const GET = handleApiRequest;
export const POST = handleApiRequest;
export const PATCH = handleApiRequest;
export const PUT = handleApiRequest;
export const DELETE = handleApiRequest;
