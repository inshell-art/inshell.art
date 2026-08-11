import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RollupLog, RollupLogHandler } from "rollup";
import { resolvePagesBuildDeploymentEnv } from "../../packages/shared/src/pagesBuildEnv";

function ignoreKnownRollupWarnings(warning: RollupLog, warn: RollupLogHandler) {
  if (
    warning.code === "INVALID_ANNOTATION" &&
    warning.message.includes("contains an annotation that Rollup cannot interpret")
  ) {
    return;
  }
  warn(warning);
}

function readDevApiOrigin() {
  return process.env.INSHELL_DEV_API_ORIGIN?.trim() || "https://inshell.art";
}

function readThoughtAppOrigin() {
  return (
    process.env.INSHELL_THOUGHT_APP_ORIGIN?.trim() ||
    "http://127.0.0.1:5174"
  );
}

function readLocalThoughtRuntime(
  workspaceRoot: string,
  command: string,
  mode: string,
) {
  if (command !== "serve" || mode !== "devnet") return null;
  const runtimeFile = path.resolve(
    process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE?.trim() ||
      path.join(
        workspaceRoot,
        "apps",
        "thought",
        "contract-integration",
        "local-runtime.thought-anvil.json",
      ),
  );
  try {
    const runtime = JSON.parse(fs.readFileSync(runtimeFile, "utf8")) as {
      schema?: unknown;
      status?: unknown;
      localLane?: { id?: unknown; isolation?: unknown };
    };
    if (
      runtime.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
      runtime.status !== "ready" ||
      runtime.localLane?.id !== "thought" ||
      runtime.localLane?.isolation !== "dedicated-anvil"
    ) {
      throw new Error("local THOUGHT runtime is not a ready dedicated lane");
    }
    return runtime;
  } catch (error) {
    console.warn(
      `Local THOUGHT gallery runtime unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

export default defineConfig(({ command, mode }) => {
  const rootDir =
    typeof __dirname === "string"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(rootDir, "../..");
  const srcDir = path.resolve(rootDir, "src");
  const loadedEnv = loadEnv(mode, rootDir, "VITE_");
  const processPublicEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
  );
  const deployEnv = resolvePagesBuildDeploymentEnv({
    configuredDeployEnv:
      processPublicEnv.VITE_DEPLOY_ENV ?? loadedEnv.VITE_DEPLOY_ENV,
    pagesBranch: process.env.CF_PAGES_BRANCH,
  });
  const publicEnv = {
    ...loadedEnv,
    ...processPublicEnv,
    ...(deployEnv ? { VITE_DEPLOY_ENV: deployEnv } : {}),
  };
  const thoughtAppOrigin = readThoughtAppOrigin();
  const localThoughtRuntime = readLocalThoughtRuntime(
    workspaceRoot,
    command,
    mode,
  );

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
      proxy: {
        "/api/thought-contract": {
          target: thoughtAppOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/api/thought-agent": {
          target: thoughtAppOrigin,
          changeOrigin: true,
          secure: false,
        },
        "/thought": {
          target: thoughtAppOrigin,
          changeOrigin: true,
          secure: false,
          rewrite: (requestPath) =>
            requestPath.replace(/^\/thought(?=$|\?)/, "/thought/"),
        },
        "/gallery": {
          target: thoughtAppOrigin,
          changeOrigin: true,
          secure: false,
          rewrite: (requestPath) =>
            requestPath.replace(/^\/gallery\/?(?=$|\?)/, "/thought/"),
        },
        "/api": {
          target: readDevApiOrigin(),
          changeOrigin: true,
          secure: true,
        },
      },
      fs: {
        allow: [workspaceRoot, rootDir],
      },
    },
    envDir: rootDir,
    define: {
      "globalThis.__INSHELL_VITE_ENV__": JSON.stringify(publicEnv),
      "globalThis.__INSHELL_THOUGHT_CONTRACT_RUNTIME__": JSON.stringify(
        localThoughtRuntime,
      ),
      ...(deployEnv
        ? { "import.meta.env.VITE_DEPLOY_ENV": JSON.stringify(deployEnv) }
        : {}),
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: [
        { find: /^@\//, replacement: `${srcDir}/` },
        { find: "@", replacement: srcDir },
      ],
    },
  };
});
