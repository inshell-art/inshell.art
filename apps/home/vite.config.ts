import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RollupLog, RollupLogHandler } from "rollup";

function ignoreKnownRollupWarnings(warning: RollupLog, warn: RollupLogHandler) {
  if (
    warning.code === "INVALID_ANNOTATION" &&
    warning.message.includes("contains an annotation that Rollup cannot interpret")
  ) {
    return;
  }
  warn(warning);
}

export default defineConfig(({ mode }) => {
  const rootDir =
    typeof __dirname === "string"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(rootDir, "../..");
  const srcDir = path.resolve(rootDir, "src");
  const publicEnv = {
    ...loadEnv(mode, rootDir, "VITE_"),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_"))
    ),
  };

  return {
    root: rootDir,
    plugins: [react()],
    build: {
      outDir: path.resolve(rootDir, "../../dist/home"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        onwarn: ignoreKnownRollupWarnings,
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      fs: {
        allow: [workspaceRoot, rootDir],
      },
    },
    envDir: rootDir,
    define: {
      "globalThis.__INSHELL_VITE_ENV__": JSON.stringify(publicEnv),
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
