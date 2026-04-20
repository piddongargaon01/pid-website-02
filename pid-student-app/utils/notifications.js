import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, updateDoc } from "firebase/firestore";
import * as IntentLauncher from "expo-intent-launcher";
import { Alert, Platform } from "react-native";
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
    await Notifications.setNotificationChannelAsync("pid_alerts", {
      name: "PID Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1B1464",
      sound: true,
    });
  }

  try {
    // 1. Get Expo Push Token (for fallback)
    const expoToken = (await Notifications.getExpoPushTokenAsync({
      projectId: "817e87ac-d9f5-4d4e-ac43-86ef99b5141d",
    })).data;

    // 2. Get Native Device Token (Direct FCM)
    const nativeToken = (await Notifications.getDevicePushTokenAsync()).data;

    console.log("Student/Teacher Tokens collected:", { expo: !!expoToken, native: !!nativeToken });

    // Firebase mein save karo
    if (userId) {
      const collectionName = userRole === "teacher" ? "teachers" : "students";
      const updates = {};
      
      if (expoToken) updates.expoPushToken = expoToken;
      if (nativeToken) updates.nativeFcmToken = nativeToken;

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, collectionName, userId), updates);
      }
    }
    return nativeToken || expoToken;
  } catch (e) {
    console.error("Push token error:", e);
    return null;
  }
}

// ─── Advanced Permissions (Battery, Popup, etc.) ───
export async function checkAndRequestAdvancedPermissions() {
  if (Platform.OS !== "android") return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }

    // Battery Optimization Check
    Alert.alert(
      "🔋 Full Power Notifications",
      "School alerts aur notices bina kisi delay ke paane ke liye, Battery Optimization ko 'Don't Optimize' par set rahein.",
      [
        { text: "Baad mein", style: "cancel" },
        { 
          text: "Settings Kholo", 
          onPress: () => {
            IntentLauncher.startActivityAsync(
              IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
            );
          } 
        }
      ]
    );
  } catch (e) {
    console.error("Permission error:", e);
  }
}
