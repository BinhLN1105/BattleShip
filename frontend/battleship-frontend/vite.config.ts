import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // Cho phép các thiết bị cùng mạng Wi-Fi (LAN) kết nối qua IPv4
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:8888",
        ws: true,
        changeOrigin: true,
      },
    },
  },
})

