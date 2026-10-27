import {
  pgTable,
  pgEnum,
  serial,
  integer,
  bigint,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// All money amounts are stored in Iraqi Dinar (IQD) as whole numbers.
const money = (name: string) => bigint(name, { mode: "number" });

export const roleEnum = pgEnum("role", ["user", "trader", "vet", "shop", "admin"]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "none",
  "pending",
  "verified",
  "rejected",
]);
export const listingTypeEnum = pgEnum("listing_type", ["offer", "wanted"]);
export const listingStatusEnum = pgEnum("listing_status", ["active", "sold", "hidden", "removed"]);
export const genderEnum = pgEnum("animal_gender", ["male", "female", "mixed", "unknown"]);
export const auctionStatusEnum = pgEnum("auction_status", [
  "scheduled",
  "live",
  "ended", // finished, waiting for the sale to be completed
  "completed", // seller confirmed the hand-over
  "unsold", // ended with no bids
  "cancelled",
]);
export const depositStatusEnum = pgEnum("deposit_status", ["held", "released", "forfeited"]);
export const txTypeEnum = pgEnum("tx_type", [
  "topup",
  "withdrawal",
  "deposit_hold",
  "deposit_release",
  "deposit_forfeit",
  "deposit_compensation",
  "commission",
  "subscription",
  "featured",
  "adjustment",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "ready",
  "delivered",
  "cancelled",
]);
export const providerKindEnum = pgEnum("provider_kind", ["vet", "shop"]);
export const reportStatusEnum = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const topupStatusEnum = pgEnum("topup_status", ["pending", "approved", "rejected"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 160 }),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("user"),
    city: varchar("city", { length: 40 }).notNull(),
    avatar: text("avatar"),
    bio: text("bio"),
    whatsapp: varchar("whatsapp", { length: 20 }),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("none"),
    // Spendable wallet balance. Held auction deposits are NOT included.
    walletBalance: money("wallet_balance").notNull().default(0),
    isBanned: boolean("is_banned").notNull().default(false),
    /** Set once the phone number was confirmed with an SMS code. */
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_phone_idx").on(t.phone)],
);

export const sessionClientEnum = pgEnum("session_client", ["web", "mobile"]);

/** Login sessions. Web uses a cookie, the mobile app a Bearer token; both store only the SHA-256 hash. */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // sha256 of the token
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    client: sessionClientEnum("client").notNull().default("web"),
    deviceName: varchar("device_name", { length: 120 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Every stored image and who uploaded it (used to stop attaching someone else's file). */
export const uploads = pgTable(
  "uploads",
  {
    name: varchar("name", { length: 80 }).primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    isPrivate: boolean("is_private").notNull().default(false),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("uploads_user_idx").on(t.userId, t.createdAt)],
);

/** Security events counted across restarts (e.g. failed logins per phone number). */
export const securityEvents = pgTable(
  "security_events",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("security_events_key_idx").on(t.key, t.createdAt)],
);

/** Expo push tokens of a user's devices. */
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 200 }).notNull(),
    platform: varchar("platform", { length: 10 }).notNull().default("android"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_tokens_token_idx").on(t.token), index("push_tokens_user_idx").on(t.userId)],
);

/** One-time SMS codes for confirming phone numbers and resetting passwords. */
export const phoneOtps = pgTable(
  "phone_otps",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    purpose: varchar("purpose", { length: 20 }).notNull(), // register | reset
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set after the code was entered correctly; the matching verification token is valid until it is used. */
    verifiedTokenHash: varchar("verified_token_hash", { length: 64 }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("phone_otps_phone_idx").on(t.phone, t.createdAt)],
);

export const verificationRequests = pgTable("verification_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  documentType: varchar("document_type", { length: 40 }).notNull(),
  documentImages: jsonb("document_images").$type<string[]>().notNull().default([]),
  licenseImage: text("license_image"), // vet licence / shop trade licence
  note: text("note"),
  status: verificationStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: txTypeEnum("type").notNull(),
    amount: money("amount").notNull(), // signed: + credit, - debit
    balanceAfter: money("balance_after").notNull(),
    reference: varchar("reference", { length: 80 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_tx_user_idx").on(t.userId)],
);

// Manual top-up requests (user pays via ZainCash / Qi Card / cash, admin approves).
export const topupRequests = pgTable("topup_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: money("amount").notNull(),
  method: varchar("method", { length: 40 }).notNull(),
  transferRef: varchar("transfer_ref", { length: 120 }),
  receiptImage: text("receipt_image"),
  status: topupStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: listingTypeEnum("type").notNull().default("offer"),
    category: varchar("category", { length: 30 }).notNull(),
    breed: varchar("breed", { length: 80 }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    price: money("price"), // null = "call for price"
    negotiable: boolean("negotiable").notNull().default(true),
    quantity: integer("quantity").notNull().default(1),
    ageMonths: integer("age_months"),
    gender: genderEnum("gender").notNull().default("unknown"),
    weightKg: integer("weight_kg"),
    city: varchar("city", { length: 40 }).notNull(),
    area: varchar("area", { length: 80 }),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    status: listingStatusEnum("status").notNull().default("active"),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    /** Set when an admin hid or removed the listing; the owner cannot re-publish it. */
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    views: integer("views").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listings_search_idx").on(t.status, t.category, t.city),
    index("listings_user_idx").on(t.userId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favorites_unique").on(t.userId, t.listingId)],
);

export const auctions = pgTable(
  "auctions",
  {
    id: serial("id").primaryKey(),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    breed: varchar("breed", { length: 80 }),
    ageMonths: integer("age_months"),
    gender: genderEnum("gender").notNull().default("unknown"),
    weightKg: integer("weight_kg"),
    quantity: integer("quantity").notNull().default(1),
    city: varchar("city", { length: 40 }).notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    startPrice: money("start_price").notNull(),
    minIncrement: money("min_increment").notNull(),
    reservePrice: money("reserve_price"), // optional hidden minimum
    depositAmount: money("deposit_amount").notNull(),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(), // e.g. 0.0300
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: auctionStatusEnum("status").notNull().default("scheduled"),
    currentPrice: money("current_price"),
    bidCount: integer("bid_count").notNull().default(0),
    winnerId: integer("winner_id").references(() => users.id),
    winningBid: money("winning_bid"),
    commissionAmount: money("commission_amount"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auctions_status_idx").on(t.status, t.endsAt)],
);

export const bids = pgTable(
  "bids",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    bidderId: integer("bidder_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bids_auction_idx").on(t.auctionId, t.amount)],
);

export const auctionDeposits = pgTable(
  "auction_deposits",
  {
    id: serial("id").primaryKey(),
    auctionId: integer("auction_id")
      .notNull()
      .references(() => auctions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    status: depositStatusEnum("status").notNull().default("held"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("deposit_unique").on(t.auctionId, t.userId)],
);

// Business profile for vets/clinics and pet & livestock supply shops.
export const providers = pgTable(
  "providers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: providerKindEnum("kind").notNull(),
    businessName: varchar("business_name", { length: 160 }).notNull(),
    description: text("description"),
    city: varchar("city", { length: 40 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    whatsapp: varchar("whatsapp", { length: 20 }),
    workingHours: text("working_hours"),
    specialties: jsonb("specialties").$type<string[]>().notNull().default([]),
    logo: text("logo"),
    coverImage: text("cover_image"),
    homeVisits: boolean("home_visits").notNull().default(false),
    delivery: boolean("delivery").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("providers_user_kind").on(t.userId, t.kind)],
);

export const vetServices = pgTable("vet_services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  price: money("price"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").references(() => vetServices.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  animalType: varchar("animal_type", { length: 60 }).notNull(),
  animalCount: integer("animal_count").notNull().default(1),
  homeVisit: boolean("home_visit").notNull().default(false),
  notes: text("notes"),
  status: bookingStatusEnum("status").notNull().default("pending"),
  providerNote: text("provider_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  description: text("description"),
  price: money("price").notNull(),
  unit: varchar("unit", { length: 30 }),
  stock: integer("stock").notNull().default(0),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id")
    .notNull()
    .references(() => providers.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  fulfilment: varchar("fulfilment", { length: 20 }).notNull().default("pickup"), // pickup | delivery
  address: text("address"),
  phone: varchar("phone", { length: 20 }).notNull(),
  notes: text("notes"),
  total: money("total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  name: varchar("name", { length: 160 }).notNull(),
  unitPrice: money("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  role: roleEnum("role").notNull(), // which account type the plan is for
  priceMonthly: money("price_monthly").notNull(),
  maxActiveListings: integer("max_active_listings"), // null = unlimited
  maxActiveAuctions: integer("max_active_auctions"),
  featuredCredits: integer("featured_credits").notNull().default(0),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: integer("plan_id")
      .notNull()
      .references(() => plans.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    pricePaid: money("price_paid").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subs_user_idx").on(t.userId, t.endsAt)],
);

export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  placement: varchar("placement", { length: 30 }).notNull().default("home_top"),
  advertiser: varchar("advertiser", { length: 120 }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: varchar("target_type", { length: 20 }).notNull(), // listing | auction | user | provider
  targetId: integer("target_id").notNull(),
  reason: varchar("reason", { length: 60 }).notNull(),
  details: text("details"),
  status: reportStatusEnum("status").notNull().default("open"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    /** Push queue: null until the notification was sent to the user's devices. */
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notif_user_idx").on(t.userId, t.isRead), index("notif_push_queue_idx").on(t.pushedAt)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Auction = typeof auctions.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Ad = typeof ads.$inferSelect;
