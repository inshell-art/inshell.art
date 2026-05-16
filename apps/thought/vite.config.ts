import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
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
  const rootDir = process.cwd();
  const workspaceRoot = path.resolve(rootDir, "../..");
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
      outDir: path.resolve(__dirname, "../../dist/thought"),
      emptyOutDir: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        onwarn: ignoreKnownRollupWarnings,
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      fs: {
        allow: [workspaceRoot],
      },
    },
    envDir: __dirname,
    define: {
      "globalThis.__INSHELL_VITE_ENV__": JSON.stringify(publicEnv),
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});
