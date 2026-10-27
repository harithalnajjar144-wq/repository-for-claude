import { useCallback, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { errorMessage } from "./api";
import { useFeedback } from "@/components/ui";

/** Run an API action with a busy flag, a success toast and cache refresh; errors become a red toast. */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: { success?: string | ((r: R) => string); invalidate?: QueryKey[]; confirm?: string; danger?: boolean; onDone?: (r: R) => void } = {},
) {
  const { toast, confirm } = useFeedback();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      if (opts.confirm && !(await confirm(opts.confirm, { danger: opts.danger }))) return;
      setBusy(true);
      try {
        const r = await fn(...args);
        if (opts.success) toast(typeof opts.success === "function" ? opts.success(r) : opts.success);
        await Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
        opts.onDone?.(r);
        return r;
      } catch (e) {
        toast(errorMessage(e), "red");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, qc, toast, confirm],
  );
  return { run, busy };
}
