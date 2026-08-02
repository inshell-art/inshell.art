import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RollupLog, RollupLogHandler } from "rollup";
import type { Plugin } from "vite";
import { readLocalAnvilSaleHistory } from "./dev/localAnvilSaleHistory";

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

type LocalAnvilDeployment = {
  rpcUrl?: string;
  chainId?: number;
  pathNft?: { address?: string };
  pathPulseAdapter?: { address?: string };
  pulseAuction?: { address?: string };
  paymentToken?: { address?: string };
  thoughtNft?: { address?: string };
};

type CurrentThoughtAnvilRuntime = {
  schema?: string;
  status?: string;
  rpcUrl?: string;
  chainId?: number;
  contracts?: {
    pathNft?: string;
    thoughtNft?: string;
  };
};

function readCurrentThoughtAnvilRuntime(
  workspaceRoot: string
): CurrentThoughtAnvilRuntime | null {
  const configuredDescriptor = process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE?.trim();
  if (!configuredDescriptor) return null;
  const descriptorPath = path.resolve(workspaceRoot, configuredDescriptor);
  if (!fs.existsSync(descriptorPath)) return null;

  const runtime = JSON.parse(
    fs.readFileSync(descriptorPath, "utf8")
  ) as CurrentThoughtAnvilRuntime;
  const rpcUrl = runtime.rpcUrl?.trim();
  const pathNft = runtime.contracts?.pathNft?.trim();
  const thoughtNft = runtime.contracts?.thoughtNft?.trim();
  if (
    runtime.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime.status !== "ready" ||
    typeof runtime.chainId !== "number" ||
    !Number.isSafeInteger(runtime.chainId) ||
    !rpcUrl ||
    !pathNft ||
    !thoughtNft
  ) {
    throw new Error(
      `Incompatible THOUGHT Contract runtime descriptor: ${descriptorPath}`
    );
  }
  return runtime;
}

function readLocalAnvilEnv(workspaceRoot: string): Record<string, string> {
  const deploymentPath = path.resolve(
    workspaceRoot,
    "apps/thought/evm/addresses.anvil.json"
  );
  const deployment = JSON.parse(
    fs.readFileSync(deploymentPath, "utf8")
  ) as LocalAnvilDeployment;
  const currentThoughtRuntime = readCurrentThoughtAnvilRuntime(workspaceRoot);
  const rpcUrl =
    currentThoughtRuntime?.rpcUrl?.trim() ?? deployment.rpcUrl?.trim();
  const chainId = currentThoughtRuntime?.chainId ?? deployment.chainId;
  const pathNft =
    currentThoughtRuntime?.contracts?.pathNft?.trim() ??
    deployment.pathNft?.address?.trim();
  const pathPulseAdapter = deployment.pathPulseAdapter?.address?.trim();
  const pulseAuction = deployment.pulseAuction?.address?.trim();
  const paymentToken = deployment.paymentToken?.address?.trim();
  const thoughtNft =
    currentThoughtRuntime?.contracts?.thoughtNft?.trim() ??
    deployment.thoughtNft?.address?.trim();
  if (
    !rpcUrl ||
    typeof chainId !== "number" ||
    !Number.isSafeInteger(chainId) ||
    !pathNft ||
    !pathPulseAdapter ||
    !pulseAuction ||
    !paymentToken ||
    !thoughtNft
  ) {
    throw new Error(`Invalid local Anvil deployment record: ${deploymentPath}`);
  }
  return {
    VITE_NETWORK: "devnet",
    VITE_ETH_RPC: rpcUrl,
    VITE_PATH_RPC_URL: rpcUrl,
    VITE_WALLET_CHAIN_RPC_URL: rpcUrl,
    VITE_EXPECTED_CHAIN_ID: `0x${chainId.toString(16)}`,
    VITE_PATH_NFT: pathNft,
    VITE_PATH_PULSE_ADAPTER: pathPulseAdapter,
    VITE_PULSE_AUCTION: pulseAuction,
    VITE_PAYMENT_TOKEN: paymentToken,
    VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
    VITE_THOUGHT_NFT: thoughtNft,
    VITE_THOUGHT_NFT_DEPLOY_BLOCK: "0",
    VITE_PATH_NFT_DEPLOY_BLOCK: "0",
    VITE_PULSE_AUCTION_DEPLOY_BLOCK: "0",
  };
}

function localAnvilSaleHistoryPlugin(
  workspaceRoot: string,
  pulseAuctionAddress: string
): Plugin {
  const stateFile =
    process.env.INSHELL_ANVIL_STATE_FILE?.trim() ||
    path.join(workspaceRoot, ".local", "anvil", "inshell-state.json");

  return {
    name: "inshell-local-anvil-sale-history",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = (request.url ?? "").split(/[?#]/)[0];
        if (pathname !== "/api/pulse-auction") {
          next();
          return;
        }
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.statusCode = 405;
          response.setHeader("allow", "GET, HEAD");
          response.end();
          return;
        }

        try {
          const payload = await readLocalAnvilSaleHistory(
            stateFile,
            pulseAuctionAddress
          );
          response.statusCode = 200;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.setHeader("cache-control", "no-store");
          response.end(request.method === "HEAD" ? undefined : JSON.stringify(payload));
        } catch (error) {
          server.config.logger.error(
            `Local Anvil sale history unavailable: ${String(
              (error as Error)?.message ?? error
            )}`
          );
          response.statusCode = 503;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(
            JSON.stringify({ error: "Local Anvil sale history unavailable." })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootDir =
    typeof __dirname === "string"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = path.resolve(rootDir, "../..");
  const srcDir = path.resolve(rootDir, "src");
  const localAnvilEnv =
    mode === "devnet" ? readLocalAnvilEnv(workspaceRoot) : {};
  if (mode === "devnet") {
    Object.assign(process.env, localAnvilEnv);
  }
  const publicEnv = {
    ...loadEnv(mode, rootDir, "VITE_"),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_"))
    ),
    ...localAnvilEnv,
  };

  return {
    root: rootDir,
    plugins: [
      react(),
      ...(mode === "devnet"
        ? [
            localAnvilSaleHistoryPlugin(
              workspaceRoot,
              localAnvilEnv.VITE_PULSE_AUCTION
            ),
          ]
        : []),
    ],
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
        "/api/thought-agent": {
          target: "http://127.0.0.1:5174",
          changeOrigin: true,
          secure: false,
        },
        "/api/thought-contract": {
          target: "http://127.0.0.1:5174",
          changeOrigin: true,
          secure: false,
        },
        "/thought": {
          target: "http://127.0.0.1:5174",
          changeOrigin: true,
          secure: false,
          bypass: (request) => {
            const pathname = (request.url ?? "").split(/[?#]/)[0];
            return /^\/thought\/[1-9]\d{0,8}$/.test(pathname)
              ? "/index.html"
              : undefined;
          },
          rewrite: (requestPath) =>
            requestPath.replace(/^\/thought(?=$|\?)/, "/thought/"),
        },
        "/gallery": {
          target: "http://127.0.0.1:5174",
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
