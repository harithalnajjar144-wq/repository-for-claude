import { db } from "@/db";
import { settings } from "@/db/schema";

export const DEFAULT_SETTINGS = {
  /** Platform commission on the winning bid, charged to the seller. */
  auctionCommissionRate: 0.03,
  /** Minimum deposit as a fraction of the start price (seller may set more). */
  minDepositRate: 0.05,
  /** Absolute minimum deposit in IQD. */
  minDepositAmount: 25000,
  /** A bid placed within this many seconds of the end extends the auction. */
  antiSnipeSeconds: 120,
  /** Seconds added when anti-sniping triggers. */
  antiSnipeExtendSeconds: 120,
  /** Share of a forfeited deposit paid to the seller as compensation (rest kept by platform). */
  forfeitSellerShare: 0.5,
  /** Active listings allowed without a subscription. */
  freeActiveListings: 3,
  /** Active auctions allowed without a subscription (traders need a plan to auction beyond this). */
  freeActiveAuctions: 1,
  /** Cost to feature a listing for 7 days (IQD). */
  featuredListingPrice: 10000,
  /** Only verified accounts can bid or open auctions. */
  requireVerificationForAuctions: true,
  /** Support contact shown on the wallet top-up page. */
  supportPhone: "07700000000",
  zaincashNumber: "07800000000",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  return merged as Settings;
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  await db
    .insert(settings)
    .values({ key, value: value as never })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as never } });
}
