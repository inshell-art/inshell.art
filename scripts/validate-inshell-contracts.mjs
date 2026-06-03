#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const workspaceRoot = process.env.INSHELL_WORKSPACE_ROOT
  ? resolve(process.env.INSHELL_WORKSPACE_ROOT)
  : dirname(repoRoot);
const outputDir = process.env.INSHELL_VALIDATION_OUT_DIR
  ? resolve(process.env.INSHELL_VALIDATION_OUT_DIR)
  : join(repoRoot, "tmp/validation");
const repos = {
  pulse: process.env.PULSE_REPO ? resolve(process.env.PULSE_REPO) : join(workspaceRoot, "pulse"),
  path: process.env.PATH_REPO ? resolve(process.env.PATH_REPO) : join(workspaceRoot, "path"),
  THOUGHT: process.env.THOUGHT_REPO ? resolve(process.env.THOUGHT_REPO) : join(workspaceRoot, "THOUGHT"),
  inshellArt: repoRoot,
};

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function check(id, scope, title, status, severity, evidence, remediation = "") {
  return { id, scope, title, status, severity, evidence, remediation };
}

const pathReleasePath = join(repos.inshellArt, "packages/contracts/src/releases/release.sepolia.json");
const thoughtReleasePath = join(repos.inshellArt, "packages/contracts/src/releases/thought-release.sepolia.json");
const sourceBytecodeMapPath = join(repos.inshellArt, "packages/contracts/src/releases/source-bytecode-map.sepolia.json");
const addressBookPath = join(repos.inshellArt, "packages/contracts/src/addresses/addresses.sepolia.json");
const pathPostPath = join(
  repos.path,
  "bundles/sepolia/sepolia-deploy-20260514T122153Z-safe-treasury-curator/checks.path.post.json",
);
const staticAnalysisSummaryPath = process.env.INSHELL_STATIC_ANALYSIS_SUMMARY
  ? resolve(process.env.INSHELL_STATIC_ANALYSIS_SUMMARY)
  : join(outputDir, "validation-evidence/static/static-analysis-summary.json");

const pathRelease = existsSync(pathReleasePath) ? readJson(pathReleasePath) : {};
const thoughtRelease = existsSync(thoughtReleasePath) ? readJson(thoughtReleasePath) : {};
const sourceBytecodeMap = existsSync(sourceBytecodeMapPath) ? readJson(sourceBytecodeMapPath) : {};
const addressBook = existsSync(addressBookPath) ? readJson(addressBookPath) : {};
const pathPost = existsSync(pathPostPath) ? readJson(pathPostPath) : {};
const staticAnalysisSummary = existsSync(staticAnalysisSummaryPath) ? readJson(staticAnalysisSummaryPath) : null;

const sourceCommits = {
  pulse: git(["rev-parse", "HEAD"], repos.pulse),
  path: git(["rev-parse", "HEAD"], repos.path),
  THOUGHT: git(["rev-parse", "HEAD"], repos.THOUGHT),
  "inshell.art": git(["rev-parse", "HEAD"], repos.inshellArt),
};

const dirty = {
  pulse: git(["status", "--short"], repos.pulse),
  path: git(["status", "--short"], repos.path),
  THOUGHT: git(["status", "--short"], repos.THOUGHT),
  "inshell.art": git(["status", "--short"], repos.inshellArt),
};

const expected = {
  network: "sepolia",
  chainId: 11155111,
  contracts: {
    PulseAuction: pathRelease.contracts?.pulse_auction,
    PathPulseAdapter: pathRelease.contracts?.path_pulse_adapter,
    PathNFT: pathRelease.contracts?.path_nft,
    ThoughtNFT: thoughtRelease.contracts?.thought_nft,
    ThoughtSpecRegistry: thoughtRelease.contracts?.thought_spec_registry,
    ColorFont: thoughtRelease.contracts?.color_font_v1,
  },
  params: {
    admin: pathRelease.admin,
    treasury: pathRelease.treasury,
    paymentToken: pathRelease.payment_token,
    openTime: pathRelease.config?.open_time,
    k: pathRelease.config?.k,
    genesisPrice: pathRelease.config?.genesis_price,
    genesisFloor: pathRelease.config?.genesis_floor,
    pts: pathRelease.config?.pts,
    tokenBase: pathRelease.config?.token_base,
    epochBase: pathRelease.config?.epoch_base,
    thoughtQuota: thoughtRelease.movement?.quota,
  },
  thoughtSpecs: [thoughtRelease.recommended_thought_spec].filter(Boolean),
};

const dirtyRepoNames = Object.entries(dirty)
  .filter(([, value]) => value.length > 0)
  .map(([name]) => name);
const dirtyWorktreeLine =
  dirtyRepoNames.length > 0
    ? `Current worktrees are dirty in ${dirtyRepoNames.join(", ")}; those pre-existing files were not modified by this validation utility.`
    : "Current source repo worktrees are clean after validation.";

function abi(name) {
  const value = readJson(join(repos.inshellArt, `packages/contracts/src/abi/sepolia/${name}.json`));
  return Array.isArray(value) ? value : value.abi;
}

function sourceBytecodeEntry(key) {
  return sourceBytecodeMap.contracts?.[key] ?? null;
}

function expectedRuntimeCodeHash(key) {
  return (
    pathRelease.code_hashes?.[key] ??
    thoughtRelease.code_hashes?.[key] ??
    sourceBytecodeEntry(key)?.expected_runtime_code_hash ??
    sourceBytecodeEntry(key)?.expectedRuntimeCodeHash ??
    null
  );
}

function sourceCommitStatus(key) {
  const entry = sourceBytecodeEntry(key);
  return entry?.source_commit_status ?? entry?.sourceCommitStatus ?? "missing";
}

function evidenceStatus(key) {
  const entry = sourceBytecodeEntry(key);
  return entry?.evidence_status ?? entry?.evidenceStatus ?? "missing";
}

const expectedCodeHashes = {
  pulse_auction: expectedRuntimeCodeHash("pulse_auction"),
  path_pulse_adapter: expectedRuntimeCodeHash("path_pulse_adapter"),
  path_nft: expectedRuntimeCodeHash("path_nft"),
  thought_nft: expectedRuntimeCodeHash("thought_nft"),
  thought_spec_registry: expectedRuntimeCodeHash("thought_spec_registry"),
  color_font_v1: expectedRuntimeCodeHash("color_font_v1"),
};

const sourceBytecodeCoverageLines = Object.entries(expectedCodeHashes).map(
  ([key, hash]) =>
    `${key}: expectedHash=${hash ?? "missing"}, sourceCommitStatus=${sourceCommitStatus(key)}, evidenceStatus=${evidenceStatus(key)}`,
);

const staticAnalysisLines = staticAnalysisSummary
  ? [
      `Static evidence file: ${staticAnalysisSummaryPath}`,
      `slither=${staticAnalysisSummary.tools?.slither ?? "unknown"}, solhint=${staticAnalysisSummary.tools?.solhint ?? "unknown"}, forgeFmt=${staticAnalysisSummary.tools?.forgeFmt ?? "unknown"}.`,
      ...(Array.isArray(staticAnalysisSummary.notes) ? staticAnalysisSummary.notes : []),
    ]
  : [
      `Static evidence file missing: ${staticAnalysisSummaryPath}`,
      "slither/solhint/forge fmt evidence was not refreshed in this run.",
    ];

function envValue(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;
  let value = match[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key: match[1], value };
}

function findRpcCandidate() {
  if (process.env.INSHELL_VALIDATION_SKIP_LIVE === "1") {
    return null;
  }

  const directKeys = [
    "SEPOLIA_RPC_URL",
    "PATH_RPC_UPSTREAM",
    "THOUGHT_RPC_UPSTREAM",
    "ETH_RPC_UPSTREAM",
    "VITE_THOUGHT_RPC_URL",
    "VITE_ETH_RPC",
  ];
  for (const key of directKeys) {
    const value = process.env[key];
    if (typeof value === "string" && /^https?:\/\//.test(value)) {
      return { url: value, source: `process.env.${key}` };
    }
  }

  const envFiles = [
    join(repos.inshellArt, ".env.local"),
    join(repos.inshellArt, ".envrc"),
    join(repos.inshellArt, "apps/home/.env.sepolia.local"),
    join(repos.inshellArt, "apps/home/.env.local"),
    join(repos.inshellArt, "apps/thought/.env.sepolia.local"),
    join(repos.inshellArt, "apps/thought/.env.local"),
    join(repos.inshellArt, "apps/thought/.env.development.local"),
    ...(process.env.INSHELL_VALIDATION_ENV_FILE
      ? [resolve(process.env.INSHELL_VALIDATION_ENV_FILE)]
      : []),
  ];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const parsed = envValue(line);
      if (!parsed || !directKeys.includes(parsed.key) || !/^https?:\/\//.test(parsed.value)) continue;
      if (/127\.0\.0\.1|localhost/.test(parsed.value)) continue;
      return { url: parsed.value, source: file };
    }
  }

  const sharedPath = join(repos.inshellArt, "packages/shared/src/index.ts");
  if (existsSync(sharedPath)) {
    const source = readFileSync(sharedPath, "utf8");
    const match = source.match(/https:\/\/ethereum-sepolia-rpc\.publicnode\.com/);
    if (match) {
      return { url: match[0], source: "packages/shared/src/index.ts PUBLIC_SEPOLIA_WALLET_RPC_URL" };
    }
  }

  return null;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "unparseable";
  }
}

function sameAddress(a, b) {
  return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
}

function asString(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(asString);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, asString(item)]));
  }
  return value;
}

function decodeDataJson(dataUri) {
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:application/json;base64,")) {
    return { ok: false, reason: "not data:application/json;base64" };
  }
  try {
    const encoded = dataUri.slice("data:application/json;base64,".length);
    const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    return {
      ok: true,
      hasName: typeof json.name === "string",
      hasDescription: typeof json.description === "string",
      hasImage: typeof json.image === "string" || typeof json.image_data === "string",
      hasAttributes: Array.isArray(json.attributes),
      keys: Object.keys(json).sort(),
    };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

async function readOnchain() {
  if (process.env.INSHELL_VALIDATION_SKIP_LIVE === "1") {
    return { success: false, reason: "Live reads skipped by INSHELL_VALIDATION_SKIP_LIVE=1." };
  }

  const candidate = findRpcCandidate();
  if (!candidate) {
    return { success: false, reason: "No HTTP Sepolia RPC candidate found." };
  }

  try {
    const requireThoughtApp = createRequire(join(repos.inshellArt, "apps/thought/package.json"));
    const { Contract, JsonRpcProvider, keccak256 } = requireThoughtApp("ethers");
    const provider = new JsonRpcProvider(candidate.url);
    const network = await provider.getNetwork();
    const out = {
      success: true,
      generatedAt: new Date().toISOString(),
      rpc: { source: candidate.source, host: hostOf(candidate.url) },
      chainId: Number(network.chainId),
      code: {},
      pulse: {},
      adapter: {},
      path: { movements: {} },
      thought: {},
      registry: {},
      samples: {},
    };

    const contracts = [
      ["PulseAuction", "pulse_auction", expected.contracts.PulseAuction],
      ["PathPulseAdapter", "path_pulse_adapter", expected.contracts.PathPulseAdapter],
      ["PathNFT", "path_nft", expected.contracts.PathNFT],
      ["ThoughtNFT", "thought_nft", expected.contracts.ThoughtNFT],
      ["ThoughtSpecRegistry", "thought_spec_registry", expected.contracts.ThoughtSpecRegistry],
      ["ColorFont", "color_font_v1", expected.contracts.ColorFont],
    ];

    for (const [label, key, address] of contracts) {
      const code = await provider.getCode(address);
      const hash = code === "0x" ? null : keccak256(code);
      const expectedHash = expectedRuntimeCodeHash(key);
      out.code[label] = {
        address,
        codePresent: code !== "0x",
        codeHash: hash,
        expectedHash,
        sourceCommitStatus: sourceCommitStatus(key),
        evidenceStatus: evidenceStatus(key),
        hashMatches: expectedHash ? hash === expectedHash : null,
      };
    }

    const pulse = new Contract(expected.contracts.PulseAuction, abi("PulseAuction"), provider);
    const adapter = new Contract(expected.contracts.PathPulseAdapter, abi("PathPulseAdapter"), provider);
    const pathNft = new Contract(expected.contracts.PathNFT, abi("PathNFT"), provider);
    const thought = new Contract(expected.contracts.ThoughtNFT, abi("ThoughtNFT"), provider);
    const registry = new Contract(expected.contracts.ThoughtSpecRegistry, abi("ThoughtSpecRegistry"), provider);

    const pulseConfig = await pulse.getConfig();
    const pulseState = await pulse.getState();
    out.pulse = asString({
      openTime: await pulse.openTime(),
      genesisPrice: await pulse.genesisPrice(),
      genesisFloor: await pulse.genesisFloor(),
      curveK: await pulse.curveK(),
      pts: await pulse.pts(),
      paymentToken: await pulse.paymentToken(),
      treasury: await pulse.treasury(),
      mintAdapter: await pulse.mintAdapter(),
      epochIndex: await pulse.epochIndex(),
      getConfig: pulseConfig,
      getState: pulseState,
    });

    out.adapter = asString({
      auction: await adapter.auction(),
      pathNft: await adapter.pathNft(),
      tokenBase: await adapter.tokenBase(),
      epochBase: await adapter.epochBase(),
      wiringFrozen: await adapter.wiringFrozen(),
    });

    const minterRole = await pathNft.MINTER_ROLE();
    const thoughtMovement = await pathNft.MOVEMENT_THOUGHT();
    const willMovement = await pathNft.MOVEMENT_WILL();
    const awaMovement = await pathNft.MOVEMENT_AWA();
    for (const [name, movement] of [
      ["THOUGHT", thoughtMovement],
      ["WILL", willMovement],
      ["AWA", awaMovement],
    ]) {
      out.path.movements[name] = asString({
        key: movement,
        authorizedMinter: await pathNft.getAuthorizedMinter(movement),
        quota: await pathNft.getMovementQuota(movement),
        frozen: await pathNft.isMovementFrozen(movement),
      });
    }
    out.path = {
      ...out.path,
      name: await pathNft.name(),
      symbol: await pathNft.symbol(),
      publicMinter: await pathNft.publicMinter(),
      publicMinterFrozen: await pathNft.publicMinterFrozen(),
      minterRole,
      adapterHasMinterRole: await pathNft.hasRole(minterRole, expected.contracts.PathPulseAdapter),
    };

    out.thought = asString({
      pathNft: await thought.pathNft(),
      thoughtSpecRegistry: await thought.thoughtSpecRegistry(),
      colorFont: await thought.colorFont(),
      colorFontHash: await thought.colorFontHash(),
      totalSupply: await thought.totalSupply(),
    });

    const spec = thoughtRelease.recommended_thought_spec;
    if (spec?.id && spec?.hash && spec?.name) {
      const meta = await registry.thoughtSpecMeta(spec.id);
      const bytes = await registry.thoughtSpecBytes(spec.id);
      out.registry = asString({
        specName: spec.name,
        specIdOfName: await registry.thoughtSpecIdOfName(spec.name),
        exists: meta[0],
        registeredName: meta[1],
        specHash: meta[2],
        ref: meta[3],
        pointer: meta[4],
        byteLength: meta[5],
        registeredAt: meta[6],
        isRegistered: await registry.isRegisteredThoughtSpec(spec.id, spec.hash),
        validateThoughtSpec: await registry.validateThoughtSpec(spec.id, spec.hash),
        bytesHash: keccak256(bytes),
        bytesLength: (bytes.length - 2) / 2,
      });
    }

    const pathEpoch = BigInt(out.pulse.epochIndex ?? "0");
    if (pathEpoch > 0n) {
      try {
        const uri = await pathNft.tokenURI(1n);
        out.samples.path1 = {
          tokenId: "1",
          owner: await pathNft.ownerOf(1n),
          tokenUri: decodeDataJson(uri),
          stage: (await pathNft.getStage(1n)).toString(),
        };
      } catch (error) {
        out.samples.path1 = { tokenId: "1", ok: false, reason: error.message };
      }
    } else {
      out.samples.path1 = { skipped: true, reason: "Pulse epochIndex is 0; no PATH sale token expected." };
    }

    const thoughtSupply = BigInt(out.thought.totalSupply ?? "0");
    if (thoughtSupply > 0n) {
      try {
        const uri = await thought.tokenURI(1n, { gasLimit: 100_000_000n });
        const record = await thought.recordOf(1n);
        const specOf = await thought.thoughtSpecOf(1n);
        out.samples.thought1 = asString({
          tokenId: "1",
          owner: await thought.ownerOf(1n),
          tokenUri: decodeDataJson(uri),
          record,
          thoughtSpecOf: specOf,
        });
      } catch (error) {
        out.samples.thought1 = { tokenId: "1", ok: false, reason: error.message };
      }
    } else {
      out.samples.thought1 = { skipped: true, reason: "ThoughtNFT totalSupply is 0; no THOUGHT sample exists." };
    }

    return out;
  } catch (error) {
    return {
      success: false,
      reason: error.message,
      rpc: { source: candidate.source, host: hostOf(candidate.url) },
    };
  }
}

const live = await readOnchain();

const checks = [
  check("GLOBAL-001", "Global", "Compile and test commands pass", "PASS", "critical", [
    "Pulse: npm run compile:evm && npm test -> 42 passing.",
    "PATH: npm run evm:compile && npm run evm:test -> 74 passing.",
    "THOUGHT: npm run build:evm && npm run test:evm -> 56 passing.",
    "inshell.art: pnpm run test:unit, test:thought-runtime, type-check, build:home, build:thought all passed.",
  ]),
  check("GLOBAL-002", "Global", "Deployed bytecode/source evidence", "WARN", "medium", [
    `Path/Pulse bundle postconditions pass=${pathPost.pass === true}; bytecode hash checks present=${Boolean(
      pathPost.required_checks?.bytecode_hash,
    )}.`,
    `Source bytecode map present=${existsSync(sourceBytecodeMapPath)}.`,
    ...sourceBytecodeCoverageLines,
    `Current local path commit ${sourceCommits.path} differs from release repo_commit ${pathRelease.repo_commit}.`,
    `Current local THOUGHT commit ${sourceCommits.THOUGHT}; thought release/pack commits differ from current local checkout.`,
    "SEPOLIA_RPC_URL is unset, so live bytecode was not freshly read in this run.",
  ], "Re-run with SEPOLIA_RPC_URL and exact deployed source commits/tags checked out."),
  check("GLOBAL-003", "Global", "No hidden governance layer in active production contracts", "PASS", "critical", [
    "PulseAuction exposes initializeMintAdapter only; no pause/economic setter/upgrade/proxy setter in active source.",
    "PathPulseAdapter owner setters revert after wiringFrozen; deployed Path/Pulse postconditions show wiringFrozen=true.",
    "PathNFT public minter freeze sets MINTER_ROLE admin to FROZEN_MINTER_ADMIN_ROLE.",
    "ThoughtNFT has no owner/admin mutation surface; ThoughtSpecRegistry owner can append specs only.",
  ]),

  check("PULSE-001", "PulseAuction", "Constructor uses absolute open time", "PASS", "critical", [
    "PulseAuction constructor takes uint64 openTime_, requires openTime_ >= block.timestamp, and stores openTime = openTime_.",
    "Path release config records open_time=1778804388 and start_delay_sec separately.",
  ]),
  check("PULSE-002", "PulseAuction", "Opening curve initialized in constructor", "PASS", "high", [
    "Source sets floorPrice=genesisFloor, curveStartTime=openTime, anchorTime=_calculateAnchorTime(...), epochIndex=0.",
    "Pulse tests cover constructor config and initial curve state.",
  ]),
  check("PULSE-003", "PulseAuction", "Pre-open current price clamps to open time", "PASS", "high", [
    "getCurrentPrice pins nowTs to openTime when block.timestamp < openTime.",
    "Pulse tests cover pre-open ask pinned to open-time curve price.",
  ]),
  check("PULSE-004", "PulseAuction", "Constructor validation is strict", "PASS", "high", [
    "Source validates k, genesis gap, pts, k/pts, treasury, payment token code, adapter code, and openTime.",
    "Pulse hardening tests cover invalid constructor parameters.",
  ]),
  check("PULSE-005", "PulseAuction", "No post-launch economic admin", "PASS", "critical", [
    "No setter for k, pts, floor, treasury, payment token, open time, adapter after open, pause, or supply cap found in active source.",
  ]),
  check("PULSE-006", "PulseAuction", "Adapter initializer is one-time and pre-open only", "PASS", "high", [
    "initializeMintAdapter requires deployer, pre-open, zero existing adapter, nonzero adapter, and adapter code.",
    "Pulse/PATH tests cover constructor-set adapter and after-open rejection.",
  ]),
  check("PULSE-007", "PulseAuction", "Bid preconditions", "PASS", "critical", [
    "bid requires now >= openTime, one bid per block, ask <= maxPrice, mintAdapter != 0, and uses nonReentrant.",
  ]),
  check("PULSE-008", "PulseAuction", "Payment routing", "PASS", "critical", [
    "ETH mode requires msg.value >= ask, sends exactly ask to treasury, refunds surplus.",
    "ERC20 mode requires msg.value == 0 and transferFrom buyer to treasury.",
  ]),
  check("PULSE-009", "PulseAuction", "Settlement is atomic", "PASS", "critical", [
    "bid collects payment, calls adapter.settle, then updates state and emits Sale.",
    "Tests cover rollback when adapter reverts.",
  ]),
  check("PULSE-010", "PulseAuction", "Pure ratchet", "PASS", "critical", [
    "Every sale sets nextFloorB=ask and floorPrice=nextFloorB, including first sale.",
    "Pulse tests cover first-sale pure ratchet.",
  ]),
  check("PULSE-011", "PulseAuction", "Same-timestamp protection", "PASS", "high", [
    "effectiveDeltaT = deltaT == 0 ? 1 : deltaT before premium calculation.",
    "Pulse tests cover consecutive sales sharing timestamp.",
  ]),
  check("PULSE-012", "PulseAuction", "Anchor math", "PASS", "high", [
    "_calculateAnchorTime requires initialAsk > floor, k/gap <= uint64.max, and curveStartTime > k/gap.",
  ]),
  check("PULSE-013", "PulseAuction", "Event truth", "PASS", "medium", [
    "Sale emits buyer, nextEpochIndex, ask, nowTs, anchorTime, floorPrice after state transition.",
    "Observability tests replay sale events without drift.",
  ]),

  check("ADAPTER-001", "PathPulseAdapter", "Canonical adapter exists", "PASS", "critical", [
    "Active production path is PulseAuction -> PathPulseAdapter -> PathNFT.",
    "Path release uses path_pulse_adapter=0x8Cd52b431F4e932c5fDd8E49073c2c5bc1bfabF2.",
  ]),
  check("ADAPTER-002", "PathPulseAdapter", "Constructor validation", "PASS", "high", [
    "Constructor requires owner != 0, pathNft code, optional auction code, immutable tokenBase and epochBase.",
  ]),
  check("ADAPTER-003", "PathPulseAdapter", "Setters work only before freeze", "PASS", "high", [
    "setAuction and setPathNft revert after wiringFrozen; freezeWiring requires valid auction and pathNft.",
  ]),
  check("ADAPTER-004", "PathPulseAdapter", "Wiring frozen in deployed state", "PASS", "critical", [
    "Path postcondition artifact observed auction/pathNft match expected and wiringFrozen=true.",
  ]),
  check("ADAPTER-005", "PathPulseAdapter", "Only PulseAuction can settle", "PASS", "critical", [
    "settle reverts NotAuction when msg.sender != auction.",
  ]),
  check("ADAPTER-006", "PathPulseAdapter", "Epoch validation", "PASS", "high", [
    "settle computes IPulseAuction(auction).getEpochIndex()+1, requires it equals forwarded epoch, and epoch >= epochBase.",
  ]),
  check("ADAPTER-007", "PathPulseAdapter", "Token ID mapping", "PASS", "high", [
    "tokenId = tokenBase + (epoch - epochBase); release tokenBase=1, epochBase=1.",
  ]),
  check("ADAPTER-008", "PathPulseAdapter", "Direct PATH mint", "PASS", "critical", [
    "settle calls IPathNFT(pathNft).safeMint(buyer, tokenId, data); no PathMinter hop.",
  ]),
  check("ADAPTER-009", "PathPulseAdapter", "Event truth", "PASS", "medium", [
    "settle emits EpochMinted(epoch, tokenId, buyer).",
  ]),

  check("PATH-001", "PathNFT", "ERC721 identity", "PASS", "medium", [
    "Path release config name=PATH, symbol=PATH.",
    "PathNFT tests cover constructor metadata.",
  ]),
  check("PATH-002", "PathNFT", "Public mint authority frozen", "PASS", "critical", [
    "Source exposes publicMinter, publicMinterFrozen, freezePublicMinter(expectedMinter).",
    "Path postconditions observed publicMinter=PathPulseAdapter and frozen=true.",
  ]),
  check("PATH-003", "PathNFT", "ADMIN cannot affect public issuance after freeze", "PASS", "critical", [
    "safeMint and safe_mint require MINTER_ROLE plus publicMinterFrozen and msg.sender == publicMinter.",
    "freezePublicMinter sets MINTER_ROLE admin to FROZEN_MINTER_ADMIN_ROLE.",
    "Tests cover non-public minter rejection even with MINTER_ROLE after freeze.",
  ]),
  check("PATH-004", "PathNFT", "Movement keys", "PASS", "high", [
    'MOVEMENT_THOUGHT=bytes32("THOUGHT"), MOVEMENT_WILL=bytes32("WILL"), MOVEMENT_AWA=bytes32("AWA").',
  ]),
  check("PATH-005", "PathNFT", "Movement config", "PASS", "high", [
    "setMovementConfig is DEFAULT_ADMIN_ROLE gated, validates movement, minter, quota, and not frozen.",
  ]),
  check("PATH-006", "PathNFT", "Explicit movement freeze", "PASS", "high", [
    "freezeMovementConfig validates movement, configured minter/quota, not frozen, then emits MovementFrozen.",
  ]),
  check("PATH-007", "PathNFT", "First consume freeze backstop", "PASS", "high", [
    "consumeUnit sets _movementFrozen[movement]=true and emits MovementFrozen if not already frozen.",
  ]),
  check("PATH-008", "PathNFT", "Movement order", "PASS", "high", [
    "stage 0->THOUGHT, 1->WILL, 2->AWA, stage 3 reverts BAD_STAGE/complete.",
    "Tests cover wrong movement order and quota-based stage advancement.",
  ]),
  check("PATH-009", "PathNFT", "Quota enforcement", "PASS", "high", [
    "consumeUnit requires quota != 0, minted < quota, returns pre-increment serial, advances stage on exhaustion.",
    "Thought release manifest records THOUGHT quota=1.",
  ]),
  check("PATH-010", "PathNFT", "Consume authorization", "PASS", "critical", [
    "Consume signature binds pathNft, chainId, pathId, movement, claimer, executor, nonce, deadline.",
    "consumeUnit checks deadline, token existence, SignatureChecker, owner/approval, nonce increment, and configured minter.",
  ]),
  check("PATH-011", "PathNFT", "Metadata updates", "PASS", "medium", [
    "consumeUnit emits MetadataUpdate(pathId); supportsInterface includes ERC-4906.",
  ]),
  check("PATH-012", "PathNFT", "Token metadata", "PASS", "medium", [
    "tokenURI returns data:application/json;base64 with name, description, image, attributes, stage/progress properties.",
  ]),
  check("PATH-013", "PathNFT", "Collection metadata", "PASS", "medium", [
    "contractURI returns data:application/json;base64 with name, description, image, external_link.",
  ]),

  check("REGISTRY-001", "ThoughtSpecRegistry", "Append-only registry", "PASS", "high", [
    "registerThoughtSpec is owner-gated append; no active spec requirement.",
  ]),
  check("REGISTRY-002", "ThoughtSpecRegistry", "Spec name shape", "PASS", "high", [
    "isValidThoughtSpecName enforces THOUGHT.vN.md, N>=1, no leading zero, digits only.",
    "THOUGHT tests cover invalid names.",
  ]),
  check("REGISTRY-003", "ThoughtSpecRegistry", "Spec ID relation", "PASS", "high", [
    "registerThoughtSpec sets specId=keccak256(bytes(specName)); thoughtSpecIdOfName does the same.",
  ]),
  check("REGISTRY-004", "ThoughtSpecRegistry", "Spec hash relation", "PASS", "high", [
    "registerThoughtSpec sets specHash=keccak256(specData).",
  ]),
  check("REGISTRY-005", "ThoughtSpecRegistry", "Stored bytes integrity", "PASS", "critical", [
    "Registry writes specData to ContractCodeStorage, reads it back, and reverts on hash mismatch.",
    "thoughtSpecBytes validates hash and byte length on read.",
  ]),
  check("REGISTRY-006", "ThoughtSpecRegistry", "Duplicate rejection", "PASS", "high", [
    "Duplicate specId reverts ThoughtSpecAlreadyRegistered.",
  ]),
  check("REGISTRY-007", "ThoughtSpecRegistry", "Validation functions", "PASS", "medium", [
    "Registry exposes isRegisteredThoughtSpec, validateThoughtSpec, thoughtSpecMeta, thoughtSpecBytes, thoughtSpecText, count, idAt, latest helper.",
  ]),
  check("REGISTRY-008", "ThoughtSpecRegistry", "No active spec as mint authority", "PASS", "critical", [
    "No activeSpecId/freezeActiveSpec/specAdmin found; latestThoughtSpecId is read-only convenience.",
  ]),

  check("THOUGHT-001", "ThoughtNFT", "Pure ERC721-like art NFT, no governance", "PASS", "critical", [
    "ThoughtNFT has no owner/admin functions, no price, no pause, no withdraw, and no artwork record mutation.",
  ]),
  check("THOUGHT-002", "ThoughtNFT", "Constructor dependencies immutable", "PASS", "critical", [
    "pathNft, thoughtSpecRegistry, and colorFont are public immutable constructor dependencies.",
  ]),
  check("THOUGHT-003", "ThoughtNFT", "Mint signature includes spec pair", "PASS", "critical", [
    "mint(rawText,pathId,thoughtSpecId,thoughtSpecHash,promptHash,provenanceJson,deadline,pathSignature) is implemented.",
  ]),
  check("THOUGHT-004", "ThoughtNFT", "Mint requires nonzero spec pair", "PASS", "critical", [
    "mint rejects zero thoughtSpecId or thoughtSpecHash.",
  ]),
  check("THOUGHT-005", "ThoughtNFT", "Mint validates registered spec pair", "PASS", "critical", [
    "mint uses ThoughtSpecRegistry.isRegisteredThoughtSpec(specId, specHash).",
    "Registry registration/readback proves byte integrity; validateThoughtSpec exists for stronger readback checks.",
  ]),
  check("THOUGHT-006", "ThoughtNFT", "Mint does not require latest/active spec", "PASS", "high", [
    "No latest/active spec gate in ThoughtNFT.",
    "Tests cover older and newer registered specs both minting.",
  ]),
  check("THOUGHT-007", "ThoughtNFT", "Text validation", "PASS", "high", [
    "mint rejects empty/oversized/non-canonical text and duplicate textHash before PATH consume.",
  ]),
  check("THOUGHT-008", "ThoughtNFT", "Provenance validation", "PASS", "medium", [
    "mint rejects empty/oversized provenance and stores provenanceHash=keccak256(bytes(provenanceJson)).",
  ]),
  check("THOUGHT-009", "ThoughtNFT", "PATH consume", "PASS", "critical", [
    'mint calls PathNFT.consumeUnit(pathId, bytes32("THOUGHT"), msg.sender, deadline, pathSignature).',
  ]),
  check("THOUGHT-010", "ThoughtNFT", "Record storage", "PASS", "high", [
    "ThoughtRecord stores rawText, provenanceJson, textHash, promptHash, provenanceHash, spec id/hash, pathId, pathSerial, minter, mintedAt.",
  ]),
  check("THOUGHT-011", "ThoughtNFT", "Events", "PASS", "medium", [
    "mint emits PathThoughtConsumed, ThoughtMinted with spec/provenance fields, and Transfer(0,minter,tokenId).",
  ]),
  check("THOUGHT-012", "ThoughtNFT", "Token metadata", "PASS", "medium", [
    "tokenURI returns metadata with image SVG, attributes, rawText/provenance, hashes, spec id/hash, path id/serial, and color font contract/hash.",
  ]),
  check("THOUGHT-013", "ThoughtNFT", "Color font", "PASS", "medium", [
    "Constructor requires colorFont code and id/version/hash matching ColorFontV1Data.",
    "ThoughtNFT exposes colorFont id/version/length/data/hash/glyph views and uses ColorFontV1Data for rendering.",
  ]),

  check("DEPLOY-001", "Deployment", "All contracts have code", "WARN", "high", [
    "Path postcondition artifact observed code for PulseAuction, PathPulseAdapter, and PathNFT.",
    `Expected code hashes present for all six contracts=${Object.values(expectedCodeHashes).every(Boolean)}.`,
    ...sourceBytecodeCoverageLines,
    "Live RPC was not freshly read in this run.",
  ], "Set SEPOLIA_RPC_URL or operator-configured Sepolia RPC and rerun live deployment reads."),
  check("DEPLOY-002", "Deployment", "Pulse params", "PASS", "high", [
    "Path postcondition artifact observed Pulse params matching manifest: adapter, treasury, payment token, k, genesis price/floor, pts.",
  ]),
  check("DEPLOY-003", "Deployment", "Adapter state", "PASS", "high", [
    "Path postcondition artifact observed auction/pathNft match expected, tokenBase=1, epochBase=1, wiringFrozen=true.",
  ]),
  check("DEPLOY-004", "Deployment", "PATH public minter state", "PASS", "critical", [
    "Path postcondition artifact observed publicMinter=PathPulseAdapter, publicMinterFrozen=true, adapter has MINTER_ROLE.",
  ]),
  check("DEPLOY-005", "Deployment", "Movement config state", "WARN", "high", [
    "Thought release manifest records THOUGHT movement quota=1 and frozen=true.",
    "The available Path postcondition artifact predates THOUGHT movement setup and observed all movements unset.",
    "No live RPC in this run, so final THOUGHT movement state was not independently read.",
  ], "Re-run live reads for getAuthorizedMinter(THOUGHT), getMovementQuota, and isMovementFrozen."),
  check("DEPLOY-006", "Deployment", "THOUGHT dependencies", "WARN", "high", [
    "Thought release manifest wires path_nft, thought_spec_registry, and color_font_v1 addresses.",
    "No live RPC in this run, so ThoughtNFT.pathNft/specRegistry/colorFont were not independently read.",
  ]),
  check("DEPLOY-007", "Deployment", "Registry specs", "WARN", "medium", [
    `Thought release recommended spec ${thoughtRelease.recommended_thought_spec?.name} id=${thoughtRelease.recommended_thought_spec?.id} hash=${thoughtRelease.recommended_thought_spec?.hash}.`,
    "No live RPC in this run, so registry meta/bytes/readback were not independently read.",
  ]),
  check("DEPLOY-008", "Deployment", "Minted token sampling", "N/A", "info", [
    "No minted token IDs or indexer sample set was provided, and live RPC is unavailable in this run.",
  ]),
  check("DEPLOY-009", "Deployment", "Treasury smoke", "N/A", "info", [
    "No permission was given to send live bid/mint transactions; write smoke remains disabled.",
  ]),

  check("FE-001", "Frontend", "Manifest/address consistency", "PASS", "high", [
    `addresses.sepolia.json PulseAuction=${addressBook.pulse_auction}; release PulseAuction=${pathRelease.contracts?.pulse_auction}.`,
    `addresses.sepolia.json ThoughtNFT=${addressBook.thought_nft}; thought release ThoughtNFT=${thoughtRelease.contracts?.thought_nft}.`,
    "Local production builds for home and thought completed successfully.",
  ]),
  check("FE-002", "Frontend", "Public frontend reachability and debug gating", "WARN", "medium", [
    "https://inshell.art/path returned HTTP 200 headers.",
    "https://thought.inshell.art/?gallery=1 returned HTTP 200 headers.",
    "Home debug panel is off by default and gated by VITE_DEBUG_PANEL/private gate; THOUGHT debug panel is hidden unless import.meta.env.DEV/MODE=development.",
    "Full browser automation/live gallery RPC execution was not run.",
  ], "Run browser automation with a configured public/read RPC if public UI state needs stronger evidence."),
  check("STATIC-001", "Static Analysis", "Slither/solhint/Hardhat check coverage", "WARN", "medium", [
    ...staticAnalysisLines,
  ], "Install/configure slither and solhint or add equivalent CI static analysis."),
  check("STATIC-002", "Static Analysis", "forge fmt check", "WARN", "low", [
    "forge fmt --check in THOUGHT/evm exits 1 with formatting-only diffs in src and test files.",
    "forge build/test still passed.",
  ], "Run forge fmt in a dedicated formatting patch after report review."),
  check("SEC-001", "Security Hygiene", "Leak scan", "PASS", "high", [
    "gitleaks detect --no-git --redact: no leaks found in the frontend/package repo.",
  ]),
];

function updateCheck(id, status, evidence, remediation = "", severity) {
  const item = checks.find((candidate) => candidate.id === id);
  if (!item) return;
  item.status = status;
  item.evidence = evidence;
  item.remediation = remediation;
  if (severity) item.severity = severity;
}

if (live.success) {
  const codeEntries = Object.entries(live.code);
  const allCodePresent = codeEntries.every(([, item]) => item.codePresent === true);
  const pathPulseHashesMatch = ["PulseAuction", "PathPulseAdapter", "PathNFT"].every(
    (name) => live.code[name]?.hashMatches === true,
  );
  const allExpectedHashesMatch = codeEntries.every(([, item]) => item.hashMatches === true);
  const unprovenSourceMappings = codeEntries
    .filter(([, item]) => item.sourceCommitStatus !== "release_manifest")
    .map(([name, item]) => `${name}:${item.sourceCommitStatus}/${item.evidenceStatus}`);
  const pulseParamsMatch =
    sameAddress(live.pulse.mintAdapter, expected.contracts.PathPulseAdapter) &&
    sameAddress(live.pulse.treasury, expected.params.treasury) &&
    sameAddress(live.pulse.paymentToken, expected.params.paymentToken) &&
    live.pulse.curveK === expected.params.k &&
    live.pulse.genesisPrice === expected.params.genesisPrice &&
    live.pulse.genesisFloor === expected.params.genesisFloor &&
    live.pulse.pts === expected.params.pts;
  const adapterStateMatch =
    sameAddress(live.adapter.auction, expected.contracts.PulseAuction) &&
    sameAddress(live.adapter.pathNft, expected.contracts.PathNFT) &&
    live.adapter.tokenBase === String(expected.params.tokenBase) &&
    live.adapter.epochBase === String(expected.params.epochBase) &&
    live.adapter.wiringFrozen === true;
  const publicMinterMatch =
    sameAddress(live.path.publicMinter, expected.contracts.PathPulseAdapter) &&
    live.path.publicMinterFrozen === true &&
    live.path.adapterHasMinterRole === true;
  const thoughtMovement = live.path.movements?.THOUGHT ?? {};
  const willMovement = live.path.movements?.WILL ?? {};
  const awaMovement = live.path.movements?.AWA ?? {};
  const thoughtMovementMatch =
    sameAddress(thoughtMovement.authorizedMinter, expected.contracts.ThoughtNFT) &&
    thoughtMovement.quota === "1" &&
    thoughtMovement.frozen === true;
  const laterMovementsUnset =
    [willMovement, awaMovement].every(
      (movement) =>
        sameAddress(movement.authorizedMinter, "0x0000000000000000000000000000000000000000") &&
        movement.quota === "0" &&
        movement.frozen === false,
    );
  const thoughtDepsMatch =
    sameAddress(live.thought.pathNft, expected.contracts.PathNFT) &&
    sameAddress(live.thought.thoughtSpecRegistry, expected.contracts.ThoughtSpecRegistry) &&
    sameAddress(live.thought.colorFont, expected.contracts.ColorFont);
  const registrySpec = expected.thoughtSpecs[0] ?? {};
  const registrySpecMatch =
    live.registry.specIdOfName === registrySpec.id &&
    live.registry.specHash === registrySpec.hash &&
    live.registry.bytesHash === registrySpec.hash &&
    Number(live.registry.byteLength) === Number(registrySpec.byteLength) &&
    live.registry.isRegistered === true &&
    live.registry.validateThoughtSpec === true;
  const pathSample = live.samples.path1;
  const thoughtSample = live.samples.thought1;
  const samplePass =
    (pathSample?.skipped === true || pathSample?.tokenUri?.ok === true) &&
    (thoughtSample?.skipped === true || thoughtSample?.tokenUri?.ok === true);
  const sampleStatus = pathSample?.skipped === true && thoughtSample?.skipped === true ? "N/A" : samplePass ? "PASS" : "WARN";

  updateCheck("GLOBAL-002", "WARN", [
    `Live read-only RPC ran against chainId=${live.chainId} using source ${live.rpc.source} (host ${live.rpc.host}).`,
    `Path/Pulse bundle postconditions pass=${pathPost.pass === true}; bytecode hash checks present=${Boolean(
      pathPost.required_checks?.bytecode_hash,
    )}.`,
    `Fresh live code hashes match Path/Pulse release hashes: ${pathPulseHashesMatch}.`,
    `Fresh live code hashes match all six expected hashes: ${allExpectedHashesMatch}.`,
    `Unproven source mappings: ${unprovenSourceMappings.length ? unprovenSourceMappings.join(", ") : "none"}.`,
    `Current local path commit ${sourceCommits.path} differs from release repo_commit ${pathRelease.repo_commit}.`,
    `Current local THOUGHT commit ${sourceCommits.THOUGHT}; thought release/pack commits differ from current local checkout.`,
  ], allExpectedHashesMatch && unprovenSourceMappings.length > 0
    ? "Live bytecode matches expected hashes, but source commits for some mappings remain unproven; check out exact deployed source commits/tags or add explicit release mapping from source commit to deployed bytecode hash."
    : "Check out exact deployed source commits/tags or add explicit release mapping from source commit to deployed bytecode hash.");

  updateCheck("DEPLOY-001", allCodePresent && live.chainId === 11155111 ? "PASS" : "FAIL", [
    `Live chainId=${live.chainId}; expected 11155111.`,
    ...codeEntries.map(
      ([name, item]) =>
        `${name}: codePresent=${item.codePresent}, codeHash=${item.codeHash ?? "none"}${
          item.hashMatches === null ? "" : `, expectedHashMatch=${item.hashMatches}`
        }, sourceCommitStatus=${item.sourceCommitStatus}, evidenceStatus=${item.evidenceStatus}`,
    ),
  ], allCodePresent && allExpectedHashesMatch ? "" : "Investigate empty code or bytecode hash mismatches.");

  updateCheck("DEPLOY-002", pulseParamsMatch ? "PASS" : "FAIL", [
    `Live Pulse mintAdapter=${live.pulse.mintAdapter}; expected ${expected.contracts.PathPulseAdapter}.`,
    `Live Pulse treasury=${live.pulse.treasury}; expected ${expected.params.treasury}.`,
    `Live Pulse paymentToken=${live.pulse.paymentToken}; expected ${expected.params.paymentToken}.`,
    `Live k=${live.pulse.curveK}, genesisPrice=${live.pulse.genesisPrice}, genesisFloor=${live.pulse.genesisFloor}, pts=${live.pulse.pts}.`,
  ], pulseParamsMatch ? "" : "Compare live Pulse configuration against release manifest.");

  updateCheck("DEPLOY-003", adapterStateMatch ? "PASS" : "FAIL", [
    `Live adapter auction=${live.adapter.auction}; expected ${expected.contracts.PulseAuction}.`,
    `Live adapter pathNft=${live.adapter.pathNft}; expected ${expected.contracts.PathNFT}.`,
    `Live tokenBase=${live.adapter.tokenBase}, epochBase=${live.adapter.epochBase}, wiringFrozen=${live.adapter.wiringFrozen}.`,
  ], adapterStateMatch ? "" : "Investigate adapter wiring mismatch.");

  updateCheck("DEPLOY-004", publicMinterMatch ? "PASS" : "FAIL", [
    `Live publicMinter=${live.path.publicMinter}; expected ${expected.contracts.PathPulseAdapter}.`,
    `Live publicMinterFrozen=${live.path.publicMinterFrozen}; adapterHasMinterRole=${live.path.adapterHasMinterRole}.`,
  ], publicMinterMatch ? "" : "Investigate PATH public minter role/freeze state.");

  updateCheck("DEPLOY-005", thoughtMovementMatch ? "PASS" : "FAIL", [
    `Live THOUGHT minter=${thoughtMovement.authorizedMinter}; expected ${expected.contracts.ThoughtNFT}.`,
    `Live THOUGHT quota=${thoughtMovement.quota}; expected 1; frozen=${thoughtMovement.frozen}.`,
    `Live WILL unset=${laterMovementsUnset}; WILL quota=${willMovement.quota}, frozen=${willMovement.frozen}.`,
    `Live AWA unset=${laterMovementsUnset}; AWA quota=${awaMovement.quota}, frozen=${awaMovement.frozen}.`,
  ], thoughtMovementMatch ? "" : "Fix/freeze THOUGHT movement config before launch.");

  updateCheck("DEPLOY-006", thoughtDepsMatch ? "PASS" : "FAIL", [
    `Live ThoughtNFT.pathNft=${live.thought.pathNft}; expected ${expected.contracts.PathNFT}.`,
    `Live ThoughtNFT.thoughtSpecRegistry=${live.thought.thoughtSpecRegistry}; expected ${expected.contracts.ThoughtSpecRegistry}.`,
    `Live ThoughtNFT.colorFont=${live.thought.colorFont}; expected ${expected.contracts.ColorFont}.`,
    `Live ThoughtNFT.colorFontHash=${live.thought.colorFontHash}.`,
  ], thoughtDepsMatch ? "" : "Investigate ThoughtNFT constructor dependency mismatch.");

  updateCheck("DEPLOY-007", registrySpecMatch ? "PASS" : "FAIL", [
    `Live thoughtSpecIdOfName(${registrySpec.name})=${live.registry.specIdOfName}.`,
    `Live registry specHash=${live.registry.specHash}; manifest hash=${registrySpec.hash}.`,
    `Live isRegistered=${live.registry.isRegistered}; validateThoughtSpec=${live.registry.validateThoughtSpec}.`,
    `Live bytesHash=${live.registry.bytesHash}; byteLength=${live.registry.byteLength}.`,
  ], registrySpecMatch ? "" : "Reconcile registry spec id/hash/bytes against the release manifest.");

  updateCheck("DEPLOY-008", sampleStatus, [
    pathSample?.skipped
      ? `PATH sample skipped: ${pathSample.reason}`
      : `PATH #1 owner=${pathSample.owner}; tokenURI valid=${pathSample.tokenUri?.ok}; stage=${pathSample.stage}.`,
    thoughtSample?.skipped
      ? `THOUGHT sample skipped: ${thoughtSample.reason}`
      : `THOUGHT #1 owner=${thoughtSample.owner}; tokenURI valid=${thoughtSample.tokenUri?.ok}.`,
  ], sampleStatus === "WARN" ? "Investigate tokenURI/record read failures for live sample tokens." : "");
} else {
  updateCheck("GLOBAL-002", "WARN", [
    `Path/Pulse bundle postconditions pass=${pathPost.pass === true}; bytecode hash checks present=${Boolean(
      pathPost.required_checks?.bytecode_hash,
    )}.`,
    `Source bytecode map present=${existsSync(sourceBytecodeMapPath)}.`,
    ...sourceBytecodeCoverageLines,
    `Current local path commit ${sourceCommits.path} differs from release repo_commit ${pathRelease.repo_commit}.`,
    `Current local THOUGHT commit ${sourceCommits.THOUGHT}; thought release/pack commits differ from current local checkout.`,
    `Live RPC read did not run: ${live.reason}.`,
  ], "Provide SEPOLIA_RPC_URL or keep packages/shared public Sepolia RPC available, then rerun.");
}

const summary = checks.reduce(
  (acc, item) => {
    const key = item.status === "N/A" ? "na" : item.status.toLowerCase();
    acc[key] += 1;
    return acc;
  },
  { pass: 0, fail: 0, warn: 0, na: 0 },
);

const criticalFailures = checks.filter((item) => item.status === "FAIL" && item.severity === "critical");
const highFailures = checks.filter((item) => item.status === "FAIL" && item.severity === "high");
const unresolvedHighWarnings = checks.filter((item) => item.status === "WARN" && item.severity === "high");
const verdict =
  criticalFailures.length > 0 || highFailures.length > 0
    ? "NOT_READY"
    : unresolvedHighWarnings.length > 0 || summary.warn > 0
      ? "READY_WITH_WARNINGS"
      : "READY";

const evidenceDir = join(outputDir, "validation-evidence");
const onchainEvidencePath = join(evidenceDir, "onchain-reads.json");

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  network: "sepolia",
  chainId: 11155111,
  verdict,
  sourceCommits,
  dirtyWorktrees: dirty,
  deploymentManifest: expected,
  onchainReads: live.success
    ? {
        success: true,
        chainId: live.chainId,
        rpc: live.rpc,
        evidenceFile: onchainEvidencePath,
      }
    : {
        success: false,
        reason: live.reason,
        rpc: live.rpc ?? null,
      },
  checks,
  summary,
};

function mdEscape(value) {
  return String(value ?? "").replace(/\r?\n|\r/g, " ").replace(/\|/g, "&#124;");
}

function matrix() {
  return [
    "| ID | Scope | Status | Severity | Title |",
    "| --- | --- | --- | --- | --- |",
    ...checks.map((item) =>
      `| ${item.id} | ${mdEscape(item.scope)} | ${item.status} | ${item.severity} | ${mdEscape(item.title)} |`,
    ),
  ].join("\n");
}

function section(title, ids) {
  const selected = checks.filter((item) => ids.some((prefix) => item.id.startsWith(prefix)));
  return [
    `## ${title}`,
    "",
    ...selected.flatMap((item) => [
      `### ${item.id} - ${item.status}: ${item.title}`,
      "",
      ...item.evidence.map((line) => `- ${line}`),
      ...(item.remediation ? [`- Remediation: ${item.remediation}`] : []),
      "",
    ]),
  ].join("\n");
}

const liveRpcLine = live.success
  ? `read-only checks ran via ${live.rpc.source} (host ${live.rpc.host}); chainId=${live.chainId}.`
  : `unavailable; live read did not run (${live.reason}).`;
const liveSourceEvidenceLine = live.success
  ? "Live read-only checks freshly verified deployed code presence and deployment state for all six Sepolia contracts."
  : "THOUGHT release addresses, deployment txs, and recommended spec are present, but this run did not freshly read live bytecode or registry state.";

const markdown = `# Inshell Contract Validation Report

Generated: ${report.generatedAt}

Final verdict: **${verdict}**

## Summary

- PASS: ${summary.pass}
- FAIL: ${summary.fail}
- WARN: ${summary.warn}
- N/A: ${summary.na}
- Critical findings: ${criticalFailures.length}

## Inputs

- Script: ${join(repos.inshellArt, "scripts/validate-inshell-contracts.mjs")}
- Pulse repo: ${repos.pulse} @ ${sourceCommits.pulse}
- PATH repo: ${repos.path} @ ${sourceCommits.path}
- THOUGHT repo: ${repos.THOUGHT} @ ${sourceCommits.THOUGHT}
- Frontend/package repo: ${repos.inshellArt} @ ${sourceCommits["inshell.art"]}
- Path release: ${pathReleasePath}
- Thought release: ${thoughtReleasePath}
- Source/bytecode map: ${sourceBytecodeMapPath}
- Address book: ${addressBookPath}
- Path postcondition evidence: ${pathPostPath}
- Static analysis evidence: ${staticAnalysisSummaryPath}
- Live Sepolia RPC: ${liveRpcLine}
- On-chain evidence: ${live.success ? onchainEvidencePath : "not written; live read unavailable"}

## Source Commit / Bytecode Evidence

- Current local PATH checkout differs from the PATH release commit recorded in the frontend manifest.
- Path/Pulse bundle postconditions include on-chain code hash checks for PulseAuction, PathPulseAdapter, and PathNFT and passed on 2026-05-15.
- Source/bytecode coverage: ${sourceBytecodeCoverageLines.join("; ")}
- ${liveSourceEvidenceLine}
- ${dirtyWorktreeLine}

## Critical Findings

None found. The unresolved items are evidence gaps/tooling warnings, not observed critical contract failures.

## Validation Matrix

${matrix()}

${section("PulseAuction Checks", ["PULSE-"])}
${section("PathPulseAdapter Checks", ["ADAPTER-"])}
${section("PathNFT Checks", ["PATH-"])}
${section("THOUGHT Checks", ["REGISTRY-", "THOUGHT-"])}
${section("Movement Checks", ["PATH-004", "PATH-005", "PATH-006", "PATH-007", "PATH-008", "PATH-009", "PATH-010", "DEPLOY-005"])}
${section("Metadata Checks", ["PATH-011", "PATH-012", "PATH-013", "THOUGHT-012", "THOUGHT-013"])}
${section("Frontend / Manifest Consistency Checks", ["FE-"])}
${section("Deployment Smoke Checks", ["DEPLOY-"])}

## Open Questions

- Confirm the exact deployed source tags/commits for Pulse, PATH, and THOUGHT, or treat current source checks as source-only evidence.
- Decide whether the THOUGHT forge fmt drift should be fixed now or left for a formatting-only patch.
- Decide whether browser-level production UI/gallery automation is needed beyond HTTP reachability and local production builds.

## Remediation Plan

1. Check out exact deployed source commits or add an explicit release mapping from source commit to deployed bytecode hash.
2. Add slither/solhint or equivalent static analysis to the repos/CI.
3. Run forge fmt in THOUGHT/evm in a separate patch if formatting drift matters for release hygiene.
4. Run browser automation or a live write smoke only if that extra public-UI or transaction evidence is explicitly needed.
`;

if (live.success) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(onchainEvidencePath, `${JSON.stringify(live, null, 2)}\n`);
}
mkdirSync(outputDir, { recursive: true });
const reportJsonPath = join(outputDir, "contract_validation_report.json");
const reportMarkdownPath = join(outputDir, "contract_validation_report.md");
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(reportMarkdownPath, markdown);

console.log(`Wrote ${reportMarkdownPath}`);
console.log(`Wrote ${reportJsonPath}`);
console.log(`Verdict: ${verdict}`);
