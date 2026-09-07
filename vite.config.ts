import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Strip all console.logs and debug statements in production build
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  build: {
    target: "es2020", // Eliminates heavy legacy polyfills
    sourcemap: false, // Disables heavy sourcemaps in production
    cssCodeSplit: true, // Only loads CSS required for current view
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Automatically split vendor packages into clean, cacheable chunks
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Core React framework
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router-dom")) {
              return "vendor-react";
            }
            // Supabase and data querying
            if (id.includes("@supabase") || id.includes("@tanstack")) {
              return "vendor-backend";
            }
            // UI, Icons, Animations (Framer motion, Radix, Lucide)
            if (id.includes("framer-motion") || id.includes("lucide-react") || id.includes("@radix-ui")) {
              return "vendor-ui";
            }
            // Remaining 3rd-party dependencies
            return "vendor-misc";
          }
        },
      },
    },
  },
}));
