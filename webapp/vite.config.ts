import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
// Deploy-Trigger: Domain-Registrierung (CNAME) erneut auslesen
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // 3000 ist der Standardport der API (api/src/env.ts). Belegte der
    // Dev-Server ihn ebenfalls, kollidierten beide und die API waere im
    // Entwicklungsbetrieb nicht startbar.
    port: 5173,
    // Der Proxy loest zwei Dinge zugleich: der Browser spricht nur mit
    // dem Dev-Server (gleicher Ursprung, deshalb KEIN CORS noetig), und
    // die API bleibt unter ihrem eigenen Port erreichbar. Serverseitig
    // gibt es keine Ursprungsbeschraenkung.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
