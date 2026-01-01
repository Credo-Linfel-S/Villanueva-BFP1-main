import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [
            "babel-plugin-react-compiler",
            {
              // Optional: Add React Compiler configuration
              sources: (filename) => {
                return filename.indexOf("node_modules") === -1;
              },
            },
          ],
        ],
      },
    }),
  ],
  // Add server configuration for WiFi hosting
  server: {
    host: "0.0.0.0", // Allows connections from any IP on network
    port: 5173, // Default Vite port
    strictPort: true, // Don't try other ports if 5173 is busy
    open: true, // Automatically open browser
    cors: true, // Enable CORS

    // Configure HMR for network access
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173,
      clientPort: 5173,
    },

    // Watch configuration for better file detection
    watch: {
      usePolling: false, // Set to true if you're using WSL or Docker
      interval: 100,
    },
  },

  // Optional: Build configuration
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  // Preview configuration
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    open: true,
  },
});
