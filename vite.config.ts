import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web app builds to static files (single-page mode) that OneBase serves itself, so one
// binary runs everything. The shell is written as index.html: OneBase answers any path without a
// file extension with it, and the router takes over in the browser.
export default defineConfig({
  server: {
    port: 3000,
    // `onebase dev` runs on :8090; proxy it so the browser sees one origin in development.
    proxy: { "/api": { target: "http://localhost:8090", ws: true } },
  },
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index.html" } } }), viteReact()],
});
