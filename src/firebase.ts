import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import firebaseAppletConfig from "../firebase-applet-config.json";

// These VITE_FIREBASE_* env vars were never actually set anywhere (no .env,
// nothing in the GitHub Actions build), so import.meta.env.VITE_FIREBASE_*
// was always undefined and initializeApp() threw at module load time —
// before React could even render, which is why the deployed page was blank.
// Firebase web config is a public identifier (not a secret; access is
// controlled by firestore.rules), so it's safe to read straight from the
// committed firebase-applet-config.json instead.
const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey,
  authDomain: firebaseAppletConfig.authDomain,
  projectId: firebaseAppletConfig.projectId,
  storageBucket: firebaseAppletConfig.storageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId,
  appId: firebaseAppletConfig.appId,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
