import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDnVimerQOT7kolFuDVkA2vby-u00MlPO4",
  authDomain: "pid-app-92693.firebaseapp.com",
  projectId: "pid-app-92693",
  storageBucket: "pid-app-92693.firebasestorage.app",
  messagingSenderId: "718576750381",
  appId: "1:718576750381:web:0ba6aedddeb5291d084da4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});