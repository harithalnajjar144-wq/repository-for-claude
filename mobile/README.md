# حلالي · Halali mobile app

React Native (Expo SDK 58, Expo Router) app for Android first, iOS later. Arabic only, right-to-left, IBM Plex Sans Arabic. It talks to the Halali server's JSON API (`/api/v1`, see `../docs/mobile-api.md`); the admin panel stays on the website.

## Screens

- **Tabs:** Home · Market (search, filters, infinite list) · Auctions · Vets & shops · Account
- **Listings:** detail with photo gallery, call / WhatsApp, favorites, report; create and edit with camera or gallery upload; owner tools (sold, hide, feature, delete)
- **Auctions:** live screen polling every 3 s with countdown, deposit, bidding, bid history, anti-sniping notice; seller tools (winner contact, confirm hand-over, cancel); create auction (now or scheduled)
- **Vets & shops:** profile, services and prices, booking with date and time chips, product catalogue with cart and cash-on-delivery order
- **Account:** notifications, my listings, auctions and bids, favorites, bookings, orders, wallet and top-up (with private receipt photo), plans, profile, ID verification (private document photos), password
- **Business (vets & shops):** profile and logo, services, products, incoming bookings and orders
- **Sign-in:** phone + password; SMS code step appears automatically when the server has `SMS_PROVIDER` set; forgot password

Push notifications (outbid, auction won, orders, bookings, verification, top-ups) open the matching screen when tapped.

## Run during development

```bash
cd mobile
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your server
npx expo start                # press "a" for an Android emulator
```

Use `http://10.0.2.2:3000` as the API URL to reach a server on your computer from the Android emulator. Push notifications and some native features need a development build (`eas build --profile development`), not Expo Go.

## Build an Android app (EAS)

```bash
npm install -g eas-cli
eas login
eas init                       # links the project and adds its projectId (needed for push)
eas build -p android --profile preview      # installable APK for testing
eas build -p android --profile production   # .aab for Google Play
```

Set the server address in `eas.json` (`EXPO_PUBLIC_API_URL`) before building. For push notifications on Android, add Firebase Cloud Messaging (FCM V1) credentials in the Expo dashboard (`eas credentials`).

## Checks

```bash
npm run typecheck
npm run lint
npx expo export --platform android   # confirms the app bundles
```
