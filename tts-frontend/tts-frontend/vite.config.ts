// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Разрешает доступ со всех IP
    port: 3000, // Можно указать любой порт
  }
  // server: {
  //   port: 5173,
  //   proxy: {
  //     // все запросы, начинающиеся с /api, проксируем на твой сервер
  //     "/api": {
  //       target: "http://localhost:3001", // порт твоего backend
  //       changeOrigin: true,
  //       rewrite: (p) => p.replace(/^\/api/, ""),
  //     },
  //   },
  // },
});
