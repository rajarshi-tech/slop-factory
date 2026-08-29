import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Directs any request starting with /api to your backend server
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
