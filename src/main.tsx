import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./main.css";
import { analytics } from "../firebaseConfig";

if (analytics) {
  console.log("Analytics enabled");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
