import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// خادم API التطويري (tools/dev-api.ts) يحاكي Netlify Functions على المنفذ 8788
const apiPort = Number(process.env.DEV_API_PORT ?? 8788);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8220,
    strictPort: false,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    sourcemap: false,
    target: "es2022",
  },
});
