# حلالي · Halali

**منصة رقمية لتنظيم سوق المواشي والحيوانات في العراق.**
A digital marketplace for livestock and animals in Iraq: direct buying and selling, deposit-protected auctions, vets, and pet & livestock supply shops in one place.

The interface is fully in Arabic (RTL).

## Features

| Area | What's included |
| --- | --- |
| **Accounts** | Sign up with an Iraqi phone number. Four account types: buyer, trader/breeder, vet, supply shop, plus admin. |
| **Verification** | Users upload ID (and a vet/shop licence). Admins approve or reject. Documents are stored privately and only admins can view them. Verified accounts get a ✓ badge. |
| **Market** | Offer and wanted listings with photos, breed, age, sex, weight, quantity, price (or "call for price"). Search and filter by governorate, animal type, price, and verified sellers. Favorites, reports, featured listings (paid from wallet). |
| **Auctions** | Verified traders set start price, minimum increment, optional hidden reserve, deposit and duration (start now or scheduled). Bidders hold a deposit from their wallet. Live bidding with polling, anti-sniping extension, automatic settlement, losers refunded immediately, platform commission charged to the seller, winner's deposit returned after the seller confirms hand-over or forfeited (seller compensated) if the winner backs out. |
| **Vets** | Clinic profile, services and prices, booking requests (including home/field visits), confirm/complete/reject. |
| **Shops** | Product catalogue with stock, order requests (pickup or delivery, cash on delivery), order status workflow, stock returned on cancellation. |
| **Wallet** | Ledger-based balance. Users submit top-up requests (ZainCash, Qi Card, FastPay, cash) and admins approve. Used for deposits, subscriptions, featured listings and commissions. |
| **Revenue** | Monthly subscription plans per account type, auction commission, featured listings, and ad placements with impression and click counts. |
| **Admin** | Revenue and activity stats, verification queue, top-up approvals, user management (roles, bans, wallet adjustments), listing moderation, auction resolution, reports, plans, ads, platform settings. |
| **Notifications** | Outbid, auction won/ended, bookings, orders, verification and wallet events. |

## Tech stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Vitest

## Run locally

Requirements: Node.js 22+ and PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL etc.
npm install
npm run db:migrate              # create tables
npm run db:seed                 # plans, admin account and demo data
npm run dev                     # http://localhost:3000
```

Demo accounts created by the seed (password `demo12345`):

| Role | Phone |
| --- | --- |
| Admin | `07700000001` (password `halali-admin-2026`, override with `SEED_ADMIN_PASSWORD`) |
| Trader | `07801112233` |
| Buyer | `07706667788` |
| Vet | `07809990011` |
| Shop | `07813330044` |

For production, seed without demo data and with your own admin password:

```bash
SEED_DEMO=0 SEED_ADMIN_PHONE=07XXXXXXXXX SEED_ADMIN_PASSWORD='strong-password' npm run db:seed
```

## Deploy on Railway (quickest)

The app sets itself up on start (`src/instrumentation.ts`): it applies migrations, creates the subscription plans and admin account, optionally loads demo data, and closes finished auctions every minute. No build commands, cron jobs or shell access are needed.

1. In Railway, create a project from the GitHub repo.
2. Add a **PostgreSQL** database to the project.
3. On the app service, add a **volume** mounted at `/data` (stores uploaded photos).
4. Set these variables on the app service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference to the database) |
| `UPLOAD_DIR` | `/data/uploads` |
| `ADMIN_PHONE` | the phone number you'll sign in with as admin |
| `ADMIN_PASSWORD` | at least 10 characters |
| `SEED_DEMO` | `1` to load sample listings for a demo (remove later) |
| `CRON_SECRET` | any long random string |

5. Under the service's networking settings, generate a public domain. HTTPS is included.

The admin account is created only if that phone number doesn't exist yet, so changing `ADMIN_PASSWORD` later does not change the password.

## Deploy with Docker (own server)

```bash
DB_PASSWORD=... CRON_SECRET=... SITE_URL=https://halali.iq docker compose up -d --build
docker compose exec app sh -c "SEED_DEMO=0 SEED_ADMIN_PASSWORD='...' npm run db:seed"
```

This starts PostgreSQL, the app (migrations run on start) and a small job that settles finished auctions every minute. Put a reverse proxy with HTTPS (e.g. Caddy or Nginx) in front, then remove `INSECURE_COOKIES` from `docker-compose.yml`. Back up the `pgdata` and `uploads` volumes.

Auctions also settle automatically whenever someone opens them, so the cron job is a safety net rather than a requirement.

## Tests

```bash
npm test          # auction engine & wallet tests against TEST_DATABASE_URL (default: halali_test)
npm run typecheck
npm run lint
```

## Project layout

```
src/
  app/            pages (Arabic UI), server actions in app/actions, API routes in app/api
  components/     shared UI (cards, forms, live auction panel…)
  db/             Drizzle schema and client
  lib/            auction engine, wallet ledger, auth, plans, settings, queries
scripts/seed.ts   seed data
drizzle/          SQL migrations
tests/            integration tests
```

## Before launch

- **Payments:** wallet top-ups are approved manually by an admin. Integrating a payment gateway (ZainCash API, Qi Card) would make top-ups instant. The wallet ledger is ready for it.
- **SMS verification:** phone numbers are not yet confirmed by OTP. Add an SMS provider before going public.
- **Image storage:** uploads go to local disk (`UPLOAD_DIR`). For multiple servers, move them to S3-compatible storage.
- **Legal:** the terms page is a draft and should be reviewed by a lawyer.
- **Mobile app:** the site is mobile-first and responsive. A native app can reuse the same database and business logic.
