import { RouterProvider } from "@tanstack/react-router";
import { OnebaseProvider } from "onebase/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getClient } from "./lib/onebase";
import { router } from "./router";
import "./styles.css";

// A single-page app: OneBase serves index.html for every path, and the router takes it from there.
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <OnebaseProvider client={getClient()}>
      <RouterProvider router={router} />
    </OnebaseProvider>
  </StrictMode>,
);
