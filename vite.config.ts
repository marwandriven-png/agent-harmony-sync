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
    // Raise chunk warning to 800KB to stop noise; actual chunks are now much smaller
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manual chunks: split the biggest dependencies into separate cacheable files
        manualChunks: {
          // React core — tiny, changes almost never
          "vendor-react":   ["react", "react-dom", "react-router-dom"],
          // Tanstack query — medium, changes rarely
          "vendor-query":   ["@tanstack/react-query"],
          // Leaflet + proj4 — large, always same version
          "vendor-leaflet": ["leaflet", "react-leaflet", "proj4"],
          // Recharts — only used on reports/analytics pages
          "vendor-charts":  ["recharts"],
          // DnD — only used on leads page
          "vendor-dnd":     ["@hello-pangea/dnd"],
          // Radix UI components
          "vendor-radix":   [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-slider",
            "@radix-ui/react-switch",
          ],
          // Supabase client
          "vendor-supabase": ["@supabase/supabase-js"],
          // PDF/Excel export — only used on demand
          "vendor-export":   ["jspdf", "xlsx", "jspdf-autotable"],
        },
      },
    },
  },
}));
