import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./", // relative paths so the built app also works inside Electron
  server: {
    port: 5173,
    // In development, /api calls go to the Spring Boot backend on this computer
    proxy: { "/api": "http://127.0.0.1:8765" },
  },
  test: { environment: "node" },
});
