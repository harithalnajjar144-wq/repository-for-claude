// Shapes returned by the Halali API (see docs/mobile-api.md in the server repo).

export type Role = "user" | "trader" | "vet" | "shop" | "admin";
export type Verification = "none" | "pending" | "verified" | "rejected";

export type User = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  city: string;
  bio: string | null;
  whatsapp: string | null;
  verificationStatus: Verification;
  walletBalance: number;
  phoneVerifiedAt: string | null;
  createdAt: string;
};

export type SellerBrief = { name: string; verificationStatus: Verification };

export type Listing = {
  id: number;
  userId: number;
  type: "offer" | "wanted";
  category: string;
  breed: string | null;
  title: string;
  description: string;
  price: number | null;
  negotiable: boolean;
  quantity: number;
  ageMonths: number | null;
  gender: "male" | "female" | "mixed" | "unknown";
  weightKg: number | null;
  city: string;
  area: string | null;
  images: string[];
  status: "active" | "sold" | "hidden" | "removed";
  featuredUntil: string | null;
  views: number;
  createdAt: string;
  seller?: SellerBrief;
};

export type ListingDetail = {
  listing: Listing;
  seller: {
    id: number;
    name: string;
    city: string;
    role: Role;
    verificationStatus: Verification;
    createdAt: string;
    phone: string | null;
    whatsapp: string | null;
  };
  isOwner: boolean;
  isFavorite: boolean;
  similar: Listing[];
};

export type AuctionStatus = "scheduled" | "live" | "ended" | "completed" | "unsold" | "cancelled";

export type Auction = {
  id: number;
  sellerId: number;
  title: string;
  description: string;
  category: string;
  breed: string | null;
  ageMonths: number | null;
  gender: Listing["gender"];
  weightKg: number | null;
  quantity: number;
  city: string;
  images: string[];
  startPrice: number;
  minIncrement: number;
  reservePrice?: number | null;
  depositAmount: number;
  commissionRate: string;
  startsAt: string;
  endsAt: string;
  status: AuctionStatus;
  currentPrice: number | null;
  bidCount: number;
  winnerId: number | null;
  winningBid: number | null;
  commissionAmount: number | null;
  seller?: SellerBrief;
};

export type AuctionState = {
  id: number;
  status: "scheduled" | "live" | "closing" | "ended" | "completed" | "unsold" | "cancelled";
  startsAt: string;
  endsAt: string;
  startPrice: number;
  currentPrice: number | null;
  minNext: number;
  minIncrement: number;
  depositAmount: number;
  bidCount: number;
  winningBid: number | null;
  reserveMet: boolean;
  hasReserve: boolean;
  bids: { id: number; amount: number; at: string; name: string; mine: boolean }[];
  me: { isSeller: boolean; deposit: string | null; isTop: boolean; isWinner: boolean } | null;
  serverTime: string;
};

export type AuctionDetail = {
  auction: Auction;
  state: AuctionState;
  seller: { id: number; name: string; city: string; verificationStatus: Verification; createdAt: string; phone: string | null; whatsapp: string | null };
  winner: { id: number; name: string; phone: string } | null;
};

export type Provider = {
  id: number;
  userId: number;
  kind: "vet" | "shop";
  businessName: string;
  description: string | null;
  city: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  workingHours: string | null;
  specialties: string[];
  logo: string | null;
  homeVisits: boolean;
  delivery: boolean;
  isActive: boolean;
  verificationStatus?: Verification;
};

export type VetService = { id: number; providerId: number; name: string; description: string | null; price: number | null; durationMinutes: number; isActive: boolean };
export type Product = {
  id: number;
  providerId: number;
  name: string;
  category: string;
  description: string | null;
  price: number;
  unit: string | null;
  stock: number;
  images: string[];
  isActive: boolean;
};

export type Booking = {
  id: number;
  providerId: number;
  userId: number;
  serviceId: number | null;
  scheduledAt: string;
  animalType: string;
  animalCount: number;
  homeVisit: boolean;
  notes: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "rejected";
  providerNote: string | null;
  createdAt: string;
  serviceName?: string | null;
  provider?: { id: number; businessName: string; phone: string | null };
  customer?: { name: string; phone: string };
};

export type OrderItem = { id: number; orderId: number; productId: number | null; name: string; unitPrice: number; quantity: number };
export type Order = {
  id: number;
  providerId: number;
  userId: number;
  status: "pending" | "confirmed" | "ready" | "delivered" | "cancelled";
  fulfilment: "pickup" | "delivery";
  address: string | null;
  phone: string;
  notes: string | null;
  total: number;
  createdAt: string;
  items: OrderItem[];
  provider?: { id: number; businessName: string; phone: string | null };
  customer?: { name: string };
};

export type Plan = {
  id: number;
  slug: string;
  name: string;
  role: Role;
  priceMonthly: number;
  maxActiveListings: number | null;
  maxActiveAuctions: number | null;
  features: string[];
};

export type Notification = { id: number; title: string; body: string | null; link: string | null; isRead: boolean; createdAt: string };

export type Me = {
  user: User;
  unreadNotifications: number;
  subscription: { plan: Plan; endsAt: string } | null;
  business: Provider | null;
  lastVerificationRequest: { status: Verification; adminNote: string | null; createdAt: string } | null;
};

export type Wallet = {
  balance: number;
  heldDeposits: number;
  transactions: { id: number; type: string; amount: number; balanceAfter: number; note: string | null; createdAt: string }[];
  topups: { id: number; amount: number; method: string; transferRef: string | null; status: "pending" | "approved" | "rejected"; adminNote: string | null; createdAt: string }[];
};

type Option = { key: string; label: string };
export type Meta = {
  minAppVersion: string;
  otpRequired: boolean;
  governorates: Option[];
  animalCategories: (Option & { icon: string })[];
  productCategories: Option[];
  vetSpecialties: string[];
  reportReasons: Option[];
  topupMethods: Option[];
  auctionDurations: { hours: number; label: string }[];
  labels: {
    roles: Record<string, string>;
    genders: Record<string, string>;
    auctionStatus: Record<string, string>;
    bookingStatus: Record<string, string>;
    orderStatus: Record<string, string>;
    verification: Record<string, string>;
    txTypes: Record<string, string>;
  };
  settings: {
    auctionCommissionRate: number;
    minDepositRate: number;
    minDepositAmount: number;
    antiSnipeSeconds: number;
    antiSnipeExtendSeconds: number;
    forfeitSellerShare: number;
    freeActiveListings: number;
    freeActiveAuctions: number;
    featuredListingPrice: number;
    requireVerificationForAuctions: boolean;
    supportPhone: string;
    zaincashNumber: string;
  };
};
