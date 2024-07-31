// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAIi6NtYgV3XYygnEBNsXS4vD0_qKw0k_4",
  authDomain: "inshell-art-prod.firebaseapp.com",
  projectId: "inshell-art-prod",
  storageBucket: "inshell-art-prod.appspot.com",
  messagingSenderId: "599412809285",
  appId: "1:599412809285:web:91120db3ea7b8b10720d2c",
  measurementId: "G-768447GYCS",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
