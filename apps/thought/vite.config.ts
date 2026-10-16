import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { plainReturnDevPlugin } from "./scripts/plain-return-dev";
import { plainReturnEntryPlugin } from "./scripts/plain-return-entry";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import type { RollupLog, RollupLogHandler } from "rollup";
import {
  resolvePagesBuildDeploymentEnv,
  sortPagesBuildPublicEnv,
} from "../../packages/shared/src/pagesBuildEnv";
import thoughtCreativeSpecLock from "./spec/THOUGHT.v2.lock.json";
import {
  THOUGHT_V2_LOCAL_RELEASE,
} from "./src/thought-v2-local-release";
import {
  assertThoughtV2AnvilRuntime,
} from "./src/thought-v2-contract-client";
import { buildThoughtV2PathAcquisitionBrowserAddresses } from "./src/thought-v2-path-acquisition-runtime";
import {
  loadThoughtDevSnapshotModule,
  restoreThoughtDevIndexSnapshot,
  shouldRestoreThoughtDevIndexSnapshot,
  THOUGHT_DEV_INDEX_SNAPSHOT,
} from "./scripts/dev-index-snapshot.mjs";

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
  return process.env.INSHELL_THOUGHT_DEV_API_ORIGIN?.trim() || "https://thought.inshell.art";
}

function normalizeViteBase(value: string | undefined) {
  const raw = value?.trim();
  if (!raw || raw === "/") return "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function resolveThoughtRouteBaseRedirect(
  requestUrl: string | undefined,
  routeBase: string,
) {
  if (routeBase === "/") return null;
  const request = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const routeWithoutTrailingSlash = routeBase.slice(0, -1);
  if (request.pathname !== routeWithoutTrailingSlash) return null;
  return `${routeBase}${request.search}`;
}

function createThoughtRouteBaseRedirectPlugin(routeBase: string): Plugin {
  return {
    name: "thought-route-base-redirect",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        const location = resolveThoughtRouteBaseRedirect(req.url, routeBase);
        if (!location) {
          next();
          return;
        }
        res.statusCode = 307;
        res.setHeader("Location", location);
        res.end();
      });
    },
  };
}

function readOutDir(rootDir: string) {
  const configured = process.env.INSHELL_THOUGHT_OUT_DIR?.trim();
  return path.resolve(rootDir, configured || "../../dist/thought");
}

function readCurrentThoughtContractRuntime(
  workspaceRoot: string,
  command: "build" | "serve",
  mode: string,
) {
  if (
    command !== "serve" ||
    mode === "sepolia" ||
    process.env.INSHELL_THOUGHT_USE_CONTRACT_RUNTIME === "0"
  ) {
    return null;
  }
  const configuredDescriptor = process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE?.trim();
  const descriptorPath = configuredDescriptor
    ? path.resolve(workspaceRoot, configuredDescriptor)
    : path.join(
        workspaceRoot,
        "apps/thought/contract-integration/local-runtime.thought-anvil.json",
      );
  if (!fs.existsSync(descriptorPath)) {
    return null;
  }
  const runtime = assertThoughtV2AnvilRuntime(
    JSON.parse(fs.readFileSync(descriptorPath, "utf8")),
  );
  if (
    runtime.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime.status !== "ready"
  ) {
    throw new Error(`Incompatible THOUGHT Contract runtime descriptor: ${descriptorPath}`);
  }
  const selectedSpecPath = path.join(workspaceRoot, "apps/thought/spec/THOUGHT.v2.md");
  const selectedSpecBytes = fs.readFileSync(selectedSpecPath);
  const selectedSpecSha256 = crypto.createHash("sha256").update(selectedSpecBytes).digest("hex");
  if (
    runtime.selectedSpec?.name !== thoughtCreativeSpecLock.artifact.name ||
    runtime.selectedSpec?.id?.toLowerCase() !==
      thoughtCreativeSpecLock.artifact.thoughtSpecId.toLowerCase() ||
    runtime.selectedSpec?.hash?.toLowerCase() !==
      thoughtCreativeSpecLock.artifact.thoughtSpecHash.toLowerCase() ||
    selectedSpecBytes.length !== thoughtCreativeSpecLock.artifact.byteLength ||
    selectedSpecSha256 !== thoughtCreativeSpecLock.artifact.sha256
  ) {
    throw new Error(`THOUGHT runtime does not bind the App creative spec: ${descriptorPath}`);
  }
  return {
    descriptorPath,
    raw: runtime,
    evmAddresses: {
      schema: "inshell.thought.app-current-contract-anvil-runtime.v1",
      rpcUrl: runtime.rpcUrl,
      chainId: runtime.chainId,
      path: { address: runtime.contracts.pathNft },
      pathNft: { address: runtime.contracts.pathNft },
      ...buildThoughtV2PathAcquisitionBrowserAddresses(runtime),
      thoughtSpecRegistry: { address: runtime.contracts.thoughtSpecRegistry },
      protocolRegistry: { address: runtime.contracts.protocolRegistry },
      thoughtRenderer: { address: runtime.contracts.thoughtRenderer },
      creationAttestationVerifier: { address: runtime.contracts.creationAttestationVerifier },
      thought: { address: runtime.contracts.thoughtNft },
      thoughtNft: { address: runtime.contracts.thoughtNft },
      protocolRelease: {
        id: runtime.protocolRelease.id,
        manifestHash: runtime.protocolRelease.manifestHash,
        manifestURI: runtime.protocolRelease.manifestUri,
        status: runtime.protocolRelease.status,
        rendererIdHash: runtime.protocolRelease.manifest.identifiers.rendererHash,
        workProfileIdHash: runtime.protocolRelease.manifest.identifiers.workProfileHash,
        contextProfileIdHash: runtime.protocolRelease.manifest.identifiers.contextProfileHash,
        metadataProfileIdHash: runtime.protocolRelease.manifest.identifiers.metadataProfileHash,
        creationAttestationProfileIdHash: runtime.attestation.profileId,
      },
      provenance: runtime.provenance,
      thoughtSpecs: [{
        specName: runtime.selectedSpec.name,
        specId: runtime.selectedSpec.id,
        specHash: runtime.selectedSpec.hash,
        ref: runtime.selectedSpec.ref,
        byteLength: selectedSpecBytes.length,
        sha256: selectedSpecSha256,
      }],
      recommendedThoughtSpecName: runtime.selectedSpec.name,
      recommendedThoughtSpecId: runtime.selectedSpec.id,
      recommendedThoughtSpecHash: runtime.selectedSpec.hash,
      thoughtSpec: {
        specName: runtime.selectedSpec.name,
        id: runtime.selectedSpec.id,
        hash: runtime.selectedSpec.hash,
        ref: runtime.selectedSpec.ref,
      },
      localContractIntegration: {
        acceptanceOnly: true,
        deploymentAuthorized: THOUGHT_V2_LOCAL_RELEASE.artifact.deploymentAuthorized,
        id: THOUGHT_V2_LOCAL_RELEASE.artifact.id,
        productionConsumable: THOUGHT_V2_LOCAL_RELEASE.artifact.productionConsumable,
        runtimeDescriptorPath: descriptorPath,
      },
    },
  };
}

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createThoughtDevRuntimeBootstrapPlugin({
  contractRuntime,
  evmAddresses,
  publicEnv,
  useLockedSurface,
  workspaceRoot,
}: {
  contractRuntime: Record<string, unknown> | null;
  evmAddresses: Record<string, unknown> | null;
  publicEnv: Record<string, string>;
  useLockedSurface: boolean;
  workspaceRoot: string;
}): Plugin {
  const bootstrap = [
    `globalThis.__INSHELL_THOUGHT_DEV_INDEX_SNAPSHOT__ = ${serializeForInlineScript(THOUGHT_DEV_INDEX_SNAPSHOT)};`,
    `globalThis.__INSHELL_VITE_ENV__ = ${serializeForInlineScript(publicEnv)};`,
    `globalThis.__INSHELL_THOUGHT_CONTRACT_RUNTIME__ = ${serializeForInlineScript(contractRuntime)};`,
    `globalThis.__INSHELL_THOUGHT_EVM_ADDRESSES__ = ${serializeForInlineScript(evmAddresses)};`,
  ].join("\n");

  return {
    name: "inshell-thought-locked-runtime-bootstrap",
    apply: useLockedSurface ? undefined : "serve",
    enforce: "pre",
    load(id) {
      return loadThoughtDevSnapshotModule(workspaceRoot, id);
    },
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        const restoredHtml = useLockedSurface || shouldRestoreThoughtDevIndexSnapshot(
          context.originalUrl,
          context.path,
        )
          ? restoreThoughtDevIndexSnapshot(html)
          : html;
        return {
          html: restoredHtml,
          tags: [{
            tag: "script",
            children: bootstrap,
            injectTo: "head-prepend",
          }],
        };
      },
    },
  };
}

function existingRealPaths(paths: string[]) {
  return paths.flatMap((candidate) => {
    if (!fs.existsSync(candidate)) return [];
    return [fs.realpathSync(candidate)];
  });
}

export default defineConfig(({ command, mode }) => {
  const rootDir = process.cwd();
  const workspaceRoot = path.resolve(rootDir, "../..");
  const currentContractRuntime = readCurrentThoughtContractRuntime(workspaceRoot, command, mode);
  const publicRuntimeRpcUrl = process.env.INSHELL_THOUGHT_PUBLIC_RPC_URL?.trim();
  const browserContractRuntime = currentContractRuntime?.raw
    ? {
        ...currentContractRuntime.raw,
        ...(publicRuntimeRpcUrl ? { rpcUrl: publicRuntimeRpcUrl } : {}),
      }
    : null;
  const browserEvmAddresses = currentContractRuntime?.evmAddresses
    ? {
        ...currentContractRuntime.evmAddresses,
        ...(publicRuntimeRpcUrl ? { rpcUrl: publicRuntimeRpcUrl } : {}),
      }
    : null;
  const routeBase = normalizeViteBase(process.env.VITE_THOUGHT_ROUTE_BASE);
  const loadedEnv = loadEnv(mode, rootDir, "VITE_");
  const processPublicEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
  );
  const deployEnv = resolvePagesBuildDeploymentEnv({
    configuredDeployEnv:
      processPublicEnv.VITE_DEPLOY_ENV ?? loadedEnv.VITE_DEPLOY_ENV,
    pagesBranch: process.env.CF_PAGES_BRANCH,
  });
  const publicEnv = sortPagesBuildPublicEnv({
    ...loadedEnv,
    ...(mode === "sepolia" ? { VITE_NETWORK: "sepolia" } : {}),
    ...processPublicEnv,
    ...(deployEnv ? { VITE_DEPLOY_ENV: deployEnv } : {}),
  });
  const useLockedSurface =
    process.env.INSHELL_THOUGHT_USE_LOCKED_SURFACE === "1";

  return {
    root: rootDir,
    base: routeBase,
    plugins: [
      createThoughtRouteBaseRedirectPlugin(routeBase),
      createThoughtDevRuntimeBootstrapPlugin({
        contractRuntime: browserContractRuntime,
        evmAddresses: browserEvmAddresses,
        publicEnv,
        useLockedSurface,
        workspaceRoot,
      }),
      plainReturnEntryPlugin(rootDir),
      plainReturnDevPlugin(),
      react(),
    ],
    build: {
      outDir: readOutDir(rootDir),
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
      proxy: {
        "/api": {
          target: readDevApiOrigin(),
          changeOrigin: true,
          secure: true,
        },
      },
      fs: {
        allow: [
          workspaceRoot,
          ...existingRealPaths([
            path.resolve(rootDir, "node_modules"),
            path.resolve(workspaceRoot, "node_modules"),
            path.resolve(workspaceRoot, "node_modules/node_modules"),
          ]),
        ],
      },
    },
    envDir: rootDir,
    define: {
      "globalThis.__INSHELL_VITE_ENV__": JSON.stringify(publicEnv),
      "globalThis.__INSHELL_THOUGHT_CONTRACT_RUNTIME__": JSON.stringify(
        browserContractRuntime,
      ),
      "globalThis.__INSHELL_THOUGHT_EVM_ADDRESSES__": JSON.stringify(
        browserEvmAddresses,
      ),
      ...(deployEnv
        ? { "import.meta.env.VITE_DEPLOY_ENV": JSON.stringify(deployEnv) }
        : {}),
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});
