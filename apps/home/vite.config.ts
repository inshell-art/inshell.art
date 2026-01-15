import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const rootDir = process.cwd();
  const workspaceRoot = path.resolve(rootDir, "../..");

  return {
    root: rootDir,
    plugins: [react()],
    build: {
      outDir: path.resolve(__dirname, "../../dist/home"),
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
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});
