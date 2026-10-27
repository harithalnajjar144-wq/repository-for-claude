import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { EAS_PROJECT_ID } from "./config";

// Show notifications while the app is open, too.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Ask for permission and return this device's Expo push token, or null if unavailable. */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "إشعارات حلالي",
        // eslint-disable-next-line import/namespace -- re-exported via export *, which the linter cannot follow
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#216a43",
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;
    if (!EAS_PROJECT_ID) {
      console.warn("Push disabled: no EAS projectId. Run `npx eas-cli init` in mobile/.");
      return null;
    }
    return (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
  } catch (e) {
    console.warn("Push registration failed", e);
    return null;
  }
}
