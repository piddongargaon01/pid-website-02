import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "../firebase";

// ─── Notification handler setup ───
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Get push token ───
export async function registerForPushNotifications(userId, userRole) {
  if (!Device.isDevice) {
    console.log("Must use physical device for push notifications");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Permission not granted for notifications");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "PID Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1B1464",
      sound: true,
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: "817e87ac-d9f5-4d4e-ac43-86ef99b5141d",
    })).data;

    // Firebase mein save karo
    if (userId && token) {
      const collectionName = userRole === "teacher" ? "teachers" : "students";
      await updateDoc(doc(db, collectionName, userId), {
        expoPushToken: token,
      });
    }
    return token;
  } catch (e) {
    console.error("Push token error:", e);
    return null;
  }
}
