import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raise the warning limit slightly — we're deliberately splitting chunks
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core — tiny chunk, loaded first, long-lived cache
          if (
            /node_modules\/(react|react-dom|react-router-dom|scheduler)\//.test(id)
          ) {
            return "vendor-react";
          }

          // Supabase — auth + DB client, loaded on every authenticated page
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }

          // Radix UI primitives — large collection, rarely changes
          if (id.includes("node_modules/@radix-ui/")) {
            return "vendor-radix";
          }

          // Charts — only used on analytics / dashboard pages
          if (
            id.includes("node_modules/recharts/") ||
            /node_modules\/d3[-/]/.test(id) ||
            id.includes("node_modules/victory-")
          ) {
            return "vendor-charts";
          }

          // GSAP — only used in HeroSection, keep isolated
          if (id.includes("node_modules/gsap/")) {
            return "vendor-gsap";
          }

          // PDF libs — very heavy, only used for document preview
          if (
            id.includes("node_modules/pdfjs-dist/") ||
            id.includes("node_modules/pdf2pic/")
          ) {
            return "vendor-pdf";
          }

          // Tanstack Query
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }

          // Everything else in node_modules → generic vendor chunk
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
}));
