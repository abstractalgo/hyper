import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Pre-bundling this together with "lucide-react" splits every icon into a shared chunk that
    // the "lucide-react" entry then imports, so dev page loads fetched ~1,900 icon modules.
    // Served unbundled, it only loads the icons actually rendered.
    exclude: ["lucide-react/dynamic"],
  },
});
