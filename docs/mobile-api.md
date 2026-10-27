# Halali mobile API (v1)

Base URL: `https://<your-domain>/api/v1`. All bodies are JSON except `POST /uploads` (multipart).

## Conventions

- **Auth:** `POST /auth/login` or `/auth/register` returns `{ token, expiresAt, user }`. Send `Authorization: Bearer <token>` on every request. Tokens are stored hashed in the `sessions` table (`client = 'mobile'`), last 90 days and are extended while used. Logout revokes the token. Banning a user revokes all sessions.
- **Success:** `{ "data": ... }`, lists may add `page`, `totalPages`, `total`.
- **Errors:** `{ "error": { "code", "message" } }` with HTTP status 400 (`invalid`, message is Arabic and can be shown as-is), 401 `unauthorized`, 403, 404 `not_found`, 405, 429 `rate_limited`, 500 `server_error`.
- **Values:** money is whole IQD; dates are ISO 8601 UTC; enums are sent as keys — labels come from `GET /meta`.
- **Images:** upload each photo with `POST /uploads` (field `file`, JPG/PNG/WEBP up to 6 MB; add `?private=1` for ID documents and receipts), then pass the returned URLs in `images` / `documentImages` / `receiptImage` / `logo`. URLs are relative (`/api/files/…`), prefix them with the site origin.
- **Live auctions:** poll `GET /auctions/:id/state` every ~3 s while the screen is open.
- **Push:** register the Expo push token with `POST /me/push-tokens`. Every in-app notification is also pushed; `data.link` holds a web path such as `/auctions/12` to open the matching screen.

## Endpoints

| | Endpoint | Notes |
|---|---|---|
| **App** | `GET /health` | |
| | `GET /meta` | governorates, categories, labels, public settings, `otpRequired`, `minAppVersion` |
| | `GET /home` | stats, live auctions, latest listings, vets, shops, ad |
| | `POST /uploads` 🔒 | multipart `file` → `{ url }` |
| **Auth** | `POST /auth/otp/request` | `{ phone, purpose: "register" \| "reset" }` (only when `otpRequired`) |
| | `POST /auth/otp/verify` | `{ phone, code, purpose }` → `{ otpToken }` |
| | `POST /auth/register` | `{ name, phone, password, city, role, businessName?, otpToken?, deviceName? }` |
| | `POST /auth/login` | `{ phone, password, deviceName? }` |
| | `POST /auth/password/reset` | `{ phone, otpToken, password }` |
| | `POST /auth/logout` 🔒 | `{ pushToken? }` |
| **Me** | `GET /me` 🔒 | user, unread count, subscription, business profile, last verification request |
| | `PATCH /me` 🔒 | `{ name, city, whatsapp, email, bio }` |
| | `POST /me/password` 🔒 | `{ current, next }` |
| | `POST /me/verification` 🔒 | `{ fullName, documentType, documentImages[], licenseImage? }` (private uploads) |
| | `POST` / `DELETE /me/push-tokens` 🔒 | `{ token, platform }` |
| | `GET /me/notifications` 🔒, `POST /me/notifications/read` 🔒 | `{ ids? }` |
| | `GET /me/listings`, `/me/favorites`, `/me/auctions`, `/me/bookings`, `/me/orders` 🔒 | |
| **Wallet** | `GET /me/wallet` 🔒 | balance, held deposits, transactions, top-ups |
| | `POST /me/wallet/topups` 🔒 | `{ amount, method, transferRef?, receiptImage? }` |
| | `GET /plans`, `GET` / `POST /me/subscription` 🔒 | `{ planId, months }` |
| **Listings** | `GET /listings` | `q, category, city, type, minPrice, maxPrice, sort, verified, page` |
| | `GET /listings/:id` | seller phone only when signed in |
| | `POST /listings` 🔒, `PATCH /listings/:id` 🔒 | fields as on the web form + `images[]` |
| | `POST /listings/:id/status` 🔒 | `{ status: active \| sold \| hidden \| removed }` |
| | `POST /listings/:id/feature` 🔒 | paid from wallet |
| | `PUT` / `DELETE /listings/:id/favorite` 🔒 | |
| **Auctions** | `GET /auctions` | `status=active \| ended, category, city, page` |
| | `GET /auctions/:id`, `GET /auctions/:id/state` | details + live state |
| | `POST /auctions` 🔒 | traders only; `startMode: now \| scheduled`, `startsAt` ISO |
| | `POST /auctions/:id/join` 🔒 | holds the deposit |
| | `POST /auctions/:id/bids` 🔒 | `{ amount }` |
| | `POST /auctions/:id/complete` 🔒, `/cancel` 🔒 | seller |
| **Vets & shops** | `GET /providers?kind=vet\|shop`, `GET /providers/:id` | services or products |
| | `POST /providers/:id/bookings` 🔒 | `{ scheduledAt, animalType, animalCount, homeVisit, serviceId?, notes? }` |
| | `POST /providers/:id/orders` 🔒 | `{ items: [{ productId, quantity }], fulfilment, address?, phone?, notes? }` |
| | `POST /bookings/:id/status` 🔒, `POST /orders/:id/status` 🔒 | customer may cancel; business confirms etc. |
| **My business** | `GET` / `PATCH /me/business` 🔒 | vet or shop profile |
| | `POST /me/business/services`, `PATCH` / `DELETE …/:id` 🔒 | vets |
| | `POST /me/business/products`, `PATCH` / `DELETE …/:id` 🔒 | shops |
| | `GET /me/business/bookings`, `/me/business/orders` 🔒 | |
| **Other** | `POST /reports` 🔒, `GET /users/:id` | |

🔒 = needs a token. The admin panel stays web-only.

Rate limits (per instance): login 10 per phone / 20 per IP per 15 min, registration 10 per IP per hour, SMS codes 10 per IP per hour, bids 30 per minute.
