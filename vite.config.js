import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  optimizeDeps: {
    include: ["@babylonjs/core"],
  },
  build: {
    commonjsOptions: {
      include: [/@babylonjs\/core/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ["@babylonjs/core"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});