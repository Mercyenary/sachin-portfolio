import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found in index.html");

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
