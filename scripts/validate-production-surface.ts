import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const LOCALHOST_PATTERN = /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const HEX32_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const REQUIRED_SECURITY_HEADERS = [
  "Referrer-Policy: no-referrer",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY",
  "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy: camera=(), microphone=(), geolocation=()",
] as const;

const DEPLOY_WORKFLOW_SNIPPETS = [
  "deploy-home",
  "deploy-thought",
  "dist/home",
  "dist/thought",
  "/api/path-rpc",
  "/api/thought-rpc",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_PAGES_PROJECT_HOME",
  "CLOUDFLARE_PAGES_PROJECT_THOUGHT",
  "VITE_ETH_RPC",
  "VITE_THOUGHT_RPC_URL",
  "VITE_THOUGHT_PREVIEW_ENDPOINT_ENABLED",
  "VITE_THOUGHT_PREVIEW_ENDPOINT_URL",
  "VITE_WALLET_CHAIN_RPC_URL",
  "VITE_PATH_MINT_URL",
  "VITE_THOUGHT_EXPLORER_BASE_URL",
  "VITE_WALLETCONNECT_PROJECT_ID",
  "check:deployment",
] as const;

const HOME_DEV_SCRIPT_SNIPPETS = [
  "--host 127.0.0.1",
  "--port 5173",
  "--strictPort",
] as const;

const THOUGHT_DEV_SCRIPT_SNIPPETS = [
  "--host 127.0.0.1",
  "--port 5174",
  "--strictPort",
] as const;

const REQUIRED_REDIRECTS = {
  home: [],
  thought: [],
} as const;

type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};

const errors: string[] = [];

function rel(path: string): string {
  return relative(ROOT, resolve(ROOT, path));
}

function fail(message: string) {
  errors.push(message);
}

function read(path: string): string {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) {
    fail(`${rel(path)} is missing`);
    return "";
  }
  return readFileSync(full, "utf8");
}

function readJson<T extends JsonValue>(path: string): T | null {
  const text = read(path);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    fail(`${rel(path)} is not valid JSON: ${String((err as Error).message ?? err)}`);
    return null;
  }
}

function requireSnippets(path: string, snippets: readonly string[]) {
  const text = read(path);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      fail(`${rel(path)} is missing required text: ${snippet}`);
    }
  }
}

function requireNoLocalhost(path: string) {
  const text = read(path);
  if (LOCALHOST_PATTERN.test(text)) {
    fail(`${rel(path)} contains a localhost address in production release surface`);
  }
}

function collectJsonFiles(inputPath: string, out: string[]) {
  const full = resolve(ROOT, inputPath);
  if (!existsSync(full)) {
    fail(`${rel(inputPath)} is missing`);
    return;
  }
  const st = statSync(full);
  if (st.isDirectory()) {
    for (const name of readdirSync(full)) {
      collectJsonFiles(join(full, name), out);
    }
    return;
  }
  if (st.isFile() && extname(full).toLowerCase() === ".json") {
    out.push(full);
  }
}

function checkPackageScripts() {
  const homePkg = readJson<Record<string, any>>("apps/home/package.json");
  const thoughtPkg = readJson<Record<string, any>>("apps/thought/package.json");
  const rootPkg = readJson<Record<string, any>>("package.json");

  const homeDevScripts = [
    homePkg?.scripts?.dev,
    homePkg?.scripts?.["dev:devnet"],
  ].filter(Boolean);
  for (const script of homeDevScripts) {
    for (const snippet of HOME_DEV_SCRIPT_SNIPPETS) {
      if (!String(script).includes(snippet)) {
        fail(`apps/home/package.json script "${script}" is missing ${snippet}`);
      }
    }
  }
  const homePreview = String(homePkg?.scripts?.preview ?? "");
  for (const snippet of ["--host 127.0.0.1", "--port 4173", "--strictPort"]) {
    if (!homePreview.includes(snippet)) {
      fail(`apps/home/package.json preview script is missing ${snippet}`);
    }
  }

  const thoughtDevScripts = [thoughtPkg?.scripts?.dev].filter(Boolean);
  for (const script of thoughtDevScripts) {
    for (const snippet of THOUGHT_DEV_SCRIPT_SNIPPETS) {
      if (!String(script).includes(snippet)) {
        fail(`apps/thought/package.json script "${script}" is missing ${snippet}`);
      }
    }
  }
  const thoughtPreview = String(thoughtPkg?.scripts?.preview ?? "");
  for (const snippet of ["--host 127.0.0.1", "--port 4174", "--strictPort"]) {
    if (!thoughtPreview.includes(snippet)) {
      fail(`apps/thought/package.json preview script is missing ${snippet}`);
    }
  }

  const deploymentCheck = String(rootPkg?.scripts?.["check:deployment"] ?? "");
  const productionCheck = String(rootPkg?.scripts?.["check:production"] ?? "");
  if (!deploymentCheck.includes("check-deployment.mjs")) {
    fail("package.json is missing check:deployment coverage for check-deployment.mjs");
  }
  if (!productionCheck.includes("check:deployment")) {
    fail("package.json is missing check:production coverage for check:deployment");
  }
  const deploymentCheckSource = read("scripts/check-deployment.mjs");
  for (const snippet of [
    "validate-production-surface.ts",
    "validate-path-artifacts.ts",
    "validate-inshell-contracts.mjs",
  ]) {
    if (!deploymentCheckSource.includes(snippet)) {
      fail(`scripts/check-deployment.mjs is missing ${snippet}`);
    }
  }

  const rootHomeBuild = String(rootPkg?.scripts?.["build:home"] ?? "");
  if (!rootHomeBuild.includes("build:prod")) {
    fail("package.json build:home must use the Sepolia production build:prod script");
  }
  const rootHomeDevnetBuild = String(rootPkg?.scripts?.["build:home:devnet"] ?? "");
  if (!rootHomeDevnetBuild.includes("@inshell/home build")) {
    fail("package.json build:home:devnet must preserve the explicit devnet-capable build path");
  }
}

function checkViteConfig(path: string, expectedPort: number) {
  const text = read(path);
  const required = [
    'host: "127.0.0.1"',
    `port: ${expectedPort}`,
    "strictPort: true",
    "emptyOutDir: true",
    "chunkSizeWarningLimit:",
  ];
  for (const snippet of required) {
    if (!text.includes(snippet)) {
      fail(`${rel(path)} is missing Vite production/dev invariant: ${snippet}`);
    }
  }
}

function checkStaticHostingFiles(app: "home" | "thought") {
  requireSnippets(`apps/${app}/public/_headers`, REQUIRED_SECURITY_HEADERS);
  const redirectsPath = `apps/${app}/public/_redirects`;
  const redirects = read(redirectsPath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const loopWarningRules = redirects.filter((line) => /^\/(?:\*|[^\s]*\/\*)\s+\/index\.html\s+200$/.test(line));
  if (loopWarningRules.length > 0) {
    fail(`${redirectsPath} must use explicit SPA rewrites, not Wrangler loop-warning wildcards: ${loopWarningRules.join(", ")}`);
  }
  for (const rule of REQUIRED_REDIRECTS[app]) {
    if (!redirects.includes(rule)) {
      fail(`${redirectsPath} is missing redirect rule "${rule}"`);
    }
  }
}

function checkDeployWorkflow() {
  requireSnippets(".github/workflows/deploy-pages.yml", [
    ...DEPLOY_WORKFLOW_SNIPPETS,
    "actions/checkout@v6",
    "corepack enable",
    "actions/setup-node@v6",
    "wrangler@4.94.0",
  ]);
  requireSnippets(".github/workflows/test.yml", [
    "actions/checkout@v6",
    "corepack enable",
    "actions/setup-node@v6",
    "gitleaks_8.30.1_linux_x64.tar.gz",
    "detect --no-git --redact --no-banner",
    "pnpm run test:thought-runtime",
  ]);
}

function checkSepoliaRelease() {
  const release = readJson<Record<string, any>>("packages/contracts/src/releases/release.sepolia.json");
  const addresses = readJson<Record<string, any>>("packages/contracts/src/addresses/addresses.sepolia.json");

  if (!release || !addresses) return;
  if (release.network !== "sepolia") fail("release.sepolia.json network must be sepolia");
  if (release.chain_id !== 11155111) fail("release.sepolia.json chain_id must be 11155111");
  if (release.status?.ready_for_fe !== true) {
    fail("release.sepolia.json status.ready_for_fe must be true");
  }
  if (release.status?.postconditions !== "pass") {
    fail("release.sepolia.json status.postconditions must be pass");
  }
  if (!release.deploy_run_id) fail("release.sepolia.json deploy_run_id is missing");
  if (!release.repo_commit) fail("release.sepolia.json repo_commit is missing");

  const requiredReleaseAddresses = [
    ["contracts.path_nft", release.contracts?.path_nft],
    ["contracts.path_pulse_adapter", release.contracts?.path_pulse_adapter],
    ["contracts.pulse_auction", release.contracts?.pulse_auction],
    ["admin", release.admin],
    ["treasury", release.treasury],
  ] as const;
  for (const [name, value] of requiredReleaseAddresses) {
    if (!ADDRESS_PATTERN.test(String(value ?? ""))) {
      fail(`release.sepolia.json ${name} is not a checksummed-sized address`);
    }
  }
  for (const [name, value] of Object.entries(addresses)) {
    if (name === "payment_token" && value === "0x0000000000000000000000000000000000000000") {
      continue;
    }
    if (!ADDRESS_PATTERN.test(String(value))) {
      fail(`addresses.sepolia.json ${name} is not an EVM address`);
    }
  }
  for (const [name, value] of Object.entries(release.code_hashes ?? {})) {
    if (!HEX32_PATTERN.test(String(value))) {
      fail(`release.sepolia.json code_hashes.${name} is not bytes32 hex`);
    }
  }
}

function checkSepoliaThoughtRelease() {
  const release = readJson<Record<string, any>>("packages/contracts/src/releases/thought-release.sepolia.json");
  const addresses = readJson<Record<string, any>>("packages/contracts/src/addresses/addresses.sepolia.json");

  if (!release || !addresses) return;
  if (release.network !== "sepolia") fail("thought-release.sepolia.json network must be sepolia");
  if (release.chain_id !== 11155111) fail("thought-release.sepolia.json chain_id must be 11155111");
  if (release.schema_version !== 1) fail("thought-release.sepolia.json schema_version must be 1");
  if (release.protocol !== "thought") fail("thought-release.sepolia.json protocol must be thought");
  if (release.movement?.name !== "THOUGHT") fail("thought-release.sepolia.json movement.name must be THOUGHT");
  if (release.movement?.quota !== 1) fail("thought-release.sepolia.json movement.quota must be 1");
  if (release.movement?.frozen !== true) fail("thought-release.sepolia.json movement.frozen must be true");
  if (!Number.isFinite(release.deploy_blocks?.thought_nft)) {
    fail("thought-release.sepolia.json deploy_blocks.thought_nft is required for bounded gallery reads");
  }

  const requiredThoughtAddresses = [
    ["contracts.path_nft", release.contracts?.path_nft],
    ["contracts.thought_nft", release.contracts?.thought_nft],
    ["contracts.thought_spec_registry", release.contracts?.thought_spec_registry],
    ["contracts.color_font_v1", release.contracts?.color_font_v1],
    ["contracts.thought_previewer", release.contracts?.thought_previewer],
    ["contracts.seed_generator", release.contracts?.seed_generator],
    ["path_dependency.pathNft", release.path_dependency?.pathNft],
    ["path_dependency.admin", release.path_dependency?.admin],
  ] as const;
  for (const [name, value] of requiredThoughtAddresses) {
    if (!ADDRESS_PATTERN.test(String(value ?? ""))) {
      fail(`thought-release.sepolia.json ${name} is not a checksummed-sized address`);
    }
  }
  for (const key of [
    "path_nft",
    "thought_nft",
    "thought_spec_registry",
    "color_font_v1",
    "thought_previewer",
    "seed_generator",
  ]) {
    const value = addresses[key];
    if (!ADDRESS_PATTERN.test(String(value ?? ""))) {
      fail(`addresses.sepolia.json ${key} is not an EVM address`);
    }
  }
  if (
    String(addresses.path_nft ?? "").toLowerCase() !==
    String(release.path_dependency?.pathNft ?? "").toLowerCase()
  ) {
    fail("thought-release.sepolia.json path dependency does not match addresses.sepolia.json path_nft");
  }
}

function checkNoLocalhostInProductionArtifacts() {
  const files = [
    "packages/contracts/src/releases/release.sepolia.json",
    "packages/contracts/src/releases/thought-release.sepolia.json",
    "packages/contracts/src/addresses/addresses.sepolia.json",
    ".github/workflows/deploy-pages.yml",
    "apps/home/public/_headers",
    "apps/home/public/_redirects",
    "apps/thought/public/_headers",
    "apps/thought/public/_redirects",
  ];
  for (const path of files) {
    requireNoLocalhost(path);
  }
}

function checkAbiAndReleaseJsonParse() {
  const jsonFiles: string[] = [];
  collectJsonFiles("packages/contracts/src/releases", jsonFiles);
  collectJsonFiles("packages/contracts/src/abi", jsonFiles);
  collectJsonFiles("packages/contracts/src/addresses", jsonFiles);
  for (const file of jsonFiles) {
    const text = readFileSync(file, "utf8");
    try {
      JSON.parse(text);
    } catch (err) {
      fail(`${rel(file)} is invalid JSON: ${String((err as Error).message ?? err)}`);
    }
  }
}

function checkEthereumRpcGuard() {
  const text = read("packages/ethereum/src/client.ts");
  for (const snippet of [
    "requiresConfiguredRpc",
    "VITE_ETH_RPC is required outside local development.",
    "isLocalBrowserHost",
  ]) {
    if (!text.includes(snippet)) {
      fail(`packages/ethereum/src/client.ts is missing RPC guard snippet: ${snippet}`);
    }
  }
}

function checkThoughtProductionGuards() {
  const text = read("apps/thought/src/main.ts");
  for (const snippet of [
    "getThoughtReleaseDeployBlock(\"thought_nft\")",
    "const THOUGHT_LOG_CHUNK_SIZE = 5_000;",
    "const logs = await getThoughtMintedLogs(provider);",
    "VITE_THOUGHT_EXPLORER_BASE_URL.trim()",
    "const LEGACY_OPENROUTER_DEFAULT_MODELS = new Set([",
    "const OPENROUTER_DEFAULT_MODEL = \"openrouter/free\";",
    "const token = getReadThoughtNFT();",
    "previewWorkViaAllowedProvider",
    "createThoughtPreviewEndpointProvider",
    "VITE_THOUGHT_PREVIEW_ENDPOINT_ENABLED",
    "THOUGHT_PREVIEW_TIMEOUT_MS",
    "current candidate is not contract-previewed.",
    "waiting for model return.",
    "OLLAMA_ORIGINS=",
    "openai request could not be reached from this browser.",
    "withCliLoading",
    "reading from chain: wallet $PATH inventory",
    "reading from chain: owner",
    "reading from chain: checking latest block",
    "gallery-create-link",
    "galleryCreateLink.hidden = true",
    "settleGalleryCreateLink",
  ]) {
    if (!text.includes(snippet)) {
      fail(`apps/thought/src/main.ts is missing THOUGHT production guard: ${snippet}`);
    }
  }
  if (text.includes("connect wallet or configure a read-only preview path.")) {
    fail("apps/thought/src/main.ts must not tell auto preview visitors to configure RPC");
  }
  requireSnippets("apps/thought/src/thought-preview-policy.ts", [
    "export type PreviewMode = \"auto\" | \"wallet\" | \"off\";",
    "preview service unavailable or wallet not connected.",
  ]);
  const previewPolicy = read("apps/thought/src/thought-preview-policy.ts");
  if (previewPolicy.includes("connect wallet or configure a read-only preview path.")) {
    fail("apps/thought/src/thought-preview-policy.ts must not tell auto preview visitors to configure RPC");
  }
  if (/config (?:rpc endpoint|preview rpc)/.test(text) || /"rpc"/.test(previewPolicy)) {
    fail("THOUGHT preview must not expose browser-configured RPC commands");
  }

  requireSnippets("apps/thought/src/thought-run-payload.ts", [
    "export const supportsProviderWebSearch = (_provider: ThoughtRunProvider) => false;",
    "payload.config.web.enabled",
    "tools: [{ type: \"openrouter:web_search\" }]",
    "tools: [{ type: \"web_search\" }], tool_choice: \"auto\"",
    "type: \"web_search_20250305\"",
  ]);
  requireSnippets("package.json", ["test:thought-runtime"]);
  requireSnippets("apps/home/package.json", ["tests/thoughtPreviewFunction.test.ts"]);

  if (text.includes("VITE_THOUGHT_INDEXER_URL")) {
    fail("apps/thought/src/main.ts must not use VITE_THOUGHT_INDEXER_URL as a tx explorer URL");
  }
}

function checkSharedSurfaceLayer() {
  requireSnippets("packages/shared/src/index.ts", [
    "SURFACE_TERMINOLOGY",
    "SURFACE_DEPLOYMENT_MANIFEST",
    "resolveWalletChainRpcUrls",
    "buildContractStatusSections",
    "buildReportBugLink",
    "shouldShowReportBug",
  ]);
  requireSnippets("packages/shared/src/design.css", [
    ".inshell-contract-status",
    ".inshell-report-bug-link",
    ".inshell-report-bug-link--floating",
    "--inshell-font-mono",
  ]);
  requireSnippets("apps/home/src/main.tsx", ["@inshell/shared/design.css"]);
  requireSnippets("apps/home/src/App.tsx", ["<FloatingReportBug />"]);
  requireSnippets("apps/home/src/components/FloatingReportBug.tsx", [
    "inshell-report-bug-link--floating",
    "buildReportBugLink",
  ]);
  requireSnippets("apps/thought/src/main.ts", [
    "@inshell/shared/design.css",
    "buildContractStatusSections",
    "buildReportBugLink",
  ]);
  requireSnippets("apps/thought/index.html", ["inshell-report-bug-link--floating"]);
  const thoughtIndex = read("apps/thought/index.html");
  const thoughtReportLinkTag =
    thoughtIndex.match(/<a\b[^>]*id="thought-report-bug-link"[^>]*>/)?.[0] ?? "";
  if (thoughtReportLinkTag.includes("is-hidden")) {
    fail("apps/thought/index.html must not ship the floating report bug link hidden");
  }
  requireSnippets(".github/workflows/deploy-pages.yml", [
    "VITE_REPORT_BUG_URL: ${{ vars.VITE_REPORT_BUG_URL || 'https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md' }}",
    "VITE_GITHUB_URL: ${{ vars.VITE_GITHUB_URL || 'https://github.com/inshell-art/' }}",
    "VITE_WALLET_CHAIN_RPC_URL: ${{ vars.VITE_WALLET_CHAIN_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com' }}",
  ]);
}

function checkCloudflareRpcProxy() {
  requireSnippets("functions/_middleware.ts", [
    "PUBLIC_FEED_RSS_URL",
    "PUBLIC_FEED_ALIAS_URL",
    "isAppShellRoute",
    "serveAppShell",
    "proxyFeed",
    "/rss.xml",
    "/feed.xml",
    "/pulse",
    "/color-font",
    "/path",
    "/gallery",
    "/thought",
    "application/rss+xml; charset=utf-8",
    "public, max-age=60",
  ]);
  requireSnippets("functions/api/rpc-gate.ts", [
    "ETH_RPC_UPSTREAM",
    "PATH_RPC_UPSTREAM",
    "THOUGHT_RPC_UPSTREAM",
    "MSG_HUB_RPC_USAGE_ENDPOINT",
    "eth_getLogs batches are not allowed.",
    "eth_getLogs range is too large",
    "rpc.usage.warning",
    "pathRpcGate",
    "thoughtRpcGate",
    "fallbackRpcGate",
  ]);
  requireSnippets("functions/api/eth-rpc.ts", ["fallbackRpcGate"]);
  requireSnippets("functions/api/path-rpc.ts", ["pathRpcGate"]);
  requireSnippets("functions/api/thought-rpc.ts", ["thoughtRpcGate"]);
}

function checkThoughtPreviewEndpoint() {
  const text = read("functions/api/thought-preview.ts");
  for (const snippet of [
    "THOUGHT_PREVIEW_RPC_UPSTREAM",
    "THOUGHT_PREVIEW_NFT_ADDRESS",
    "THOUGHT_PREVIEW_CHAIN_ID",
    "PREVIEW_WORK_SELECTOR",
    "Use POST for THOUGHT preview.",
    "THOUGHT preview rate limit reached.",
    "previewWork",
    "eth_chainId",
    "eth_call",
  ]) {
    if (!text.includes(snippet)) {
      fail(`functions/api/thought-preview.ts is missing preview endpoint snippet: ${snippet}`);
    }
  }
}

checkPackageScripts();
checkViteConfig("apps/home/vite.config.ts", 5173);
checkViteConfig("apps/thought/vite.config.ts", 5174);
checkStaticHostingFiles("home");
checkStaticHostingFiles("thought");
checkDeployWorkflow();
checkSepoliaRelease();
checkSepoliaThoughtRelease();
checkNoLocalhostInProductionArtifacts();
checkAbiAndReleaseJsonParse();
checkEthereumRpcGuard();
checkThoughtProductionGuards();
checkSharedSurfaceLayer();
checkCloudflareRpcProxy();
checkThoughtPreviewEndpoint();

if (errors.length) {
  console.error("[validate-production-surface] FAIL");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[validate-production-surface] OK");
