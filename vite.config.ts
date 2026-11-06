import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web app builds to static files that OneBase serves itself, so one binary runs everything.
// OneBase answers any path without a file extension with index.html, and the router takes over
// in the browser.
export default defineConfig({
  server: {
    port: 3000,
    // `onebase dev` runs on :8090; proxy it so the browser sees one origin in development.
    proxy: { "/api": { target: "http://localhost:8090", ws: true } },
  },
  resolve: { tsconfigPaths: true },
  build: { outDir: "dist/client", emptyOutDir: true },
  // file routes in src/routes, written to src/routeTree.gen.ts
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), viteReact()],
});
