import { reportAction } from "@/app/actions/listings";
import { REPORT_REASONS } from "@/lib/constants";
import { ActionForm, SubmitButton } from "./forms";

export function ReportForm({ targetType, targetId }: { targetType: string; targetId: number }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink/50 hover:text-red-600">🚩 الإبلاغ عن مشكلة</summary>
      <ActionForm action={reportAction} className="mt-3 space-y-2" resetOnSuccess>
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <select name="reason" className="input" required defaultValue="">
          <option value="" disabled>سبب البلاغ</option>
          {REPORT_REASONS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <textarea name="details" className="input" placeholder="تفاصيل إضافية (اختياري)" maxLength={2000} />
        <SubmitButton className="btn-outline" pendingText="جارٍ الإرسال…">إرسال البلاغ</SubmitButton>
      </ActionForm>
    </details>
  );
}
