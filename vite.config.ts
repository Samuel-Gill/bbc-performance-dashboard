import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "private-local-starter",
      configureServer(server) {
        server.middlewares.use("/api/starter-workbook", async (req, res) => {
          res.setHeader("Cache-Control", "private, no-store");
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }
          try {
            const bytes = await readFile(
              new URL("./private/starter.xlsx", import.meta.url),
            );
            res.setHeader(
              "Content-Type",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            );
            res.end(bytes);
          } catch {
            res.statusCode = 404;
            res.end("Upload your original workbook.");
          }
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: { manualChunks: { charts: ["recharts"], excel: ["jszip"] } },
    },
  },
});
