import { eq, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { users, walletTransactions } from "@/db/schema";
import { UserError } from "./errors";

type TxType = (typeof walletTransactions.$inferInsert)["type"];

/**
 * Credit (+) or debit (-) a user's wallet inside a DB transaction.
 * The user row is locked so concurrent changes cannot overspend.
 */
export async function moveFunds(
  tx: Tx,
  opts: {
    userId: number;
    amount: number;
    type: TxType;
    reference?: string;
    note?: string;
    allowNegative?: boolean;
  },
) {
  const { userId, amount, type, reference, note, allowNegative } = opts;
  if (!Number.isInteger(amount) || amount === 0) throw new Error("invalid amount");
  const locked = await tx.execute<{ wallet_balance: string }>(
    sql`select wallet_balance from users where id = ${userId} for update`,
  );
  if (!locked.rows[0]) throw new Error("user not found");
  const current = Number(locked.rows[0].wallet_balance);
  const next = current + amount;
  if (amount < 0 && next < 0 && !allowNegative) {
    throw new UserError("رصيد المحفظة غير كافٍ. يرجى شحن المحفظة أولاً.");
  }
  await tx.update(users).set({ walletBalance: next }).where(eq(users.id, userId));
  await tx.insert(walletTransactions).values({
    userId,
    type,
    amount,
    balanceAfter: next,
    reference,
    note,
  });
  return next;
}
