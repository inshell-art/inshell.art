import { initializeApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";

let analytics: Analytics | null = null;

if (import.meta.env.MODE === "prod") {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
} else {
  console.log("Firebase is not in prod mode, analytics is disabled.");

  analytics = null;
}

export { analytics };
