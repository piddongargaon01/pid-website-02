import admin from "firebase-admin";

/**
 * Robust Firebase Admin Initialization
 */
function initializeFirebase() {
  if (admin.apps.length > 0) return admin.apps[0];

  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey.trim());
      
      // Handle the private key carefully
      if (serviceAccount.private_key && !serviceAccount.private_key.includes("\n")) {
        // If the key doesn't have actual newlines, it might have escaped \n
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Fallback to individual env vars
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    }
  } catch (error) {
    console.error("❌ Firebase Admin Initialization Error:", error.message);
  }
  return null;
}

// Initialize immediately
initializeFirebase();

// Export admin and a safe db getter
export { admin };
export const adminDb = admin.apps.length ? admin.firestore() : null;
