/** An error whose message is safe to show to the user (Arabic). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

/** Turn an exception into form state, hiding unexpected errors. */
export function toActionError(e: unknown): ActionState {
  if (e instanceof UserError) return { error: e.message };
  // Let Next.js redirects / notFound propagate.
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string") {
    const d = (e as { digest: string }).digest;
    if (d.startsWith("NEXT_REDIRECT") || d.startsWith("NEXT_HTTP_ERROR") || d === "NEXT_NOT_FOUND") throw e;
  }
  console.error(e);
  return { error: "حدث خطأ غير متوقع، حاول مرة أخرى." };
}
