import Constants from "expo-constants";

/** Server address. Set EXPO_PUBLIC_API_URL (see .env.example) or extra.apiUrl in app.json. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (Constants.expoConfig?.extra?.apiUrl as string) || "http://localhost:3000").replace(/\/$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

/** Expo project id, set by `eas init` (needed for push notifications). */
export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;
