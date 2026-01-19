import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const rootDir =
    typeof __dirname === "string"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(rootDir, "../..");
  const srcDir = path.resolve(rootDir, "src");

  return {
    root: rootDir,
    plugins: [react()],
    build: {
      outDir: path.resolve(rootDir, "../../dist/home"),
    },
    server: {
      host: true,
      fs: {
        allow: [workspaceRoot, rootDir],
      },
    },
    envDir: rootDir,
    define: {
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      alias: [
        { find: /^@\//, replacement: `${srcDir}/` },
        { find: "@", replacement: srcDir },
      ],
    },
  };
});
