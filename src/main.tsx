import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./main.css";
import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/600.css";

(globalThis as any).__VITE_ENV__ = import.meta.env;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
