import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Use function form — compatible with both rollup and rolldown
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            if (id.includes("leaflet") || id.includes("proj4")) return "vendor-leaflet";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("jspdf") || id.includes("xlsx")) return "vendor-export";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@hello-pangea")) return "vendor-dnd";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("react-dom") || id.includes("react-router") || (id.includes("/react/") && !id.includes("react-"))) return "vendor-react";
          }
        },
      },
    },
  },
}));
