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

/**
 * The Firebase SDK is ~200KB and only two features touch it: creating a
 * permanent share link, and opening one. Importing it at module scope meant
 * every visitor downloaded and initialised Firestore during first paint,
 * including the large majority who only ever paste two blocks of text.
 *
 * This defers both the import and initialisation until first use. The promise
 * is memoised, so concurrent callers share one initialisation and repeat
 * calls are free.
 */
let dbPromise: Promise<import("firebase/firestore").Firestore> | null = null;

export const getDb = () => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ initializeApp }, { getFirestore }] = await Promise.all([
        import("firebase/app"),
        import("firebase/firestore"),
      ]);
      const app = initializeApp(firebaseConfig);
      return getFirestore(app, firebaseAppletConfig.firestoreDatabaseId);
    })().catch((err) => {
      // Don't cache a rejected promise — a transient network failure should
      // not permanently disable sharing for the rest of the session.
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
};
