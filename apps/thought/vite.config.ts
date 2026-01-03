import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const workspaceRoot = path.resolve(__dirname, "../..");

  return {
    root: __dirname,
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, "../../dist/thought"),
    },
    server: {
      host: true,
      fs: {
        allow: [workspaceRoot],
      },
    },
    envDir: __dirname,
    define: {
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
