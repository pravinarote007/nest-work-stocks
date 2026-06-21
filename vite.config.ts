import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. During `vite dev` the Python API at /api is provided by `vercel dev`
// (or a local FastAPI). Set VITE_API_BASE to point the frontend at a running backend.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
