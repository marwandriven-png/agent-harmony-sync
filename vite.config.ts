import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const resolvedEnv = {
    VITE_SUPABASE_URL:
      env.VITE_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      "https://kapakvcxzqrhknxnwdhe.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY:
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcGFrdmN4enFyaGtueG53ZGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5OTUxMzUsImV4cCI6MjA4NDU3MTEzNX0.B_osudRrqfyiIGysjzJnoIsZmCj_vHmslCF7hB0zfTE",
    VITE_SUPABASE_PROJECT_ID:
      env.VITE_SUPABASE_PROJECT_ID ||
      process.env.VITE_SUPABASE_PROJECT_ID ||
      "kapakvcxzqrhknxnwdhe",
  };

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(resolvedEnv.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(resolvedEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(resolvedEnv.VITE_SUPABASE_PROJECT_ID),
    },
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
  };
});
