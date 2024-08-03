import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    build: {
      outDir: "dist",
    },
    server: {
      host: true,
    },
    envDir: "./config",
    define: {
      "import.meta.env.MODE": JSON.stringify(mode),
    },
  };
});
