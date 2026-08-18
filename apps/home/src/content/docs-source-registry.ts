export type DocsSourceRegistryGroup = {
  id: string;
  title: string;
  owner: string;
  reason: string;
  files?: readonly string[];
  directories?: readonly string[];
  exclude?: readonly RegExp[];
};

/**
 * Knowledge-bearing inputs for the public human and Agent documentation.
 *
 * This is deliberately narrower than the whole source tree: tests, compiler
 * declarations, and tooling that cannot change the public surface do not
 * belong here. Public presentation, behavior, protocol, release, route, API,
 * wallet, and documentation sources do. The docs generator fingerprints every
 * file below and publishes the exact inventory through the Agent index.
 */
export const DOCS_SOURCE_REGISTRY = {
  schema: "inshell.agent-docs.source-registry.v1",
  policy: {
    scope:
      "Public knowledge-bearing sources across inshell.art, THOUGHT, PATH, wallet, route, and read-only API boundaries.",
    update:
      "When a registered source changes, update its owning source or lock, run pnpm docs:generate, review the generated docs and source lock, then run pnpm docs:check.",
    check: "pnpm docs:check",
    upstreamCheck: "pnpm check:upstream-releases",
  },
  groups: [
    {
      id: "public-docs",
      title: "Public documentation sources",
      owner: "inshell.art docs",
      reason: "Human articles, Agent-readable content, authority maps, and machine-handoff selection.",
      files: [
        "docs/AGENTS.md",
        "apps/home/src/content/AGENTS.md",
        "apps/home/src/content/docs.ts",
        "apps/home/src/content/docs-source-registry.ts",
        "apps/home/src/content/thought-machine-handoff.ts",
      ],
    },
    {
      id: "home-app",
      title: "Home, PATH, Pulse, WILL, and shared docs runtime",
      owner: "inshell.art Home App",
      reason: "Public copy, interaction, route, gallery, detail, pricing, and visualization behavior.",
      files: [
        "apps/home/index.html",
        "apps/home/package.json",
        "apps/home/vite.config.ts",
        "apps/home/src/App.tsx",
        "apps/home/src/main.css",
        "apps/home/src/main.tsx",
        "apps/home/src/pathMintSubmissionLock.ts",
        "apps/home/src/content/colorFont.ts",
        "apps/home/src/content/path.ts",
        "apps/home/src/content/pulse.ts",
      ],
      directories: [
        "apps/home/src/assets",
        "apps/home/src/components",
        "apps/home/src/config",
        "apps/home/src/hooks",
        "apps/home/src/services",
        "apps/home/src/types",
        "apps/home/src/utils",
      ],
      exclude: [/\.test\.[cm]?[jt]sx?$/, /\.spec\.[cm]?[jt]sx?$/, /\.d\.ts$/],
    },
    {
      id: "public-routes-and-resources",
      title: "Public routes and read-only resource contracts",
      owner: "inshell.art shared App infrastructure",
      reason: "The Agent index advertises these routes and their read-only semantics.",
      files: [
        "apps/home/public/_headers",
        "functions/_middleware.ts",
      ],
      directories: ["functions/api"],
      exclude: [/\.test\.[cm]?[jt]sx?$/, /\.spec\.[cm]?[jt]sx?$/, /\.d\.ts$/],
    },
    {
      id: "wallet-boundary",
      title: "Wallet boundary",
      owner: "inshell.art shared App infrastructure",
      reason: "Public docs distinguish passive wallet reads from signatures and transactions.",
      files: [
        "packages/wallet/src/evm.ts",
        "packages/wallet/src/index.tsx",
        "packages/inshell-shell/src/index.tsx",
      ],
    },
    {
      id: "shared-runtime",
      title: "Shared product runtime",
      owner: "inshell.art shared App infrastructure",
      reason: "Shared Ethereum, surface, utility, and Agent-protocol code used by public routes.",
      directories: [
        "packages/ethereum/src",
        "packages/shared/src",
        "packages/surface-shell-core/src",
        "packages/thought-agent-protocol/src",
        "packages/utils/src",
      ],
      exclude: [/\.test\.[cm]?[jt]sx?$/, /\.spec\.[cm]?[jt]sx?$/, /\.d\.ts$/],
    },
    {
      id: "contract-consumer-runtime",
      title: "Contract consumer runtime",
      owner: "inshell.art shared App infrastructure",
      reason: "Address, ABI, public metadata, and release-selection logic consumed by the Apps.",
      files: [
        "packages/contracts/src/addressBook.ts",
        "packages/contracts/src/index.ts",
        "packages/contracts/src/protocolRelease.ts",
        "packages/contracts/src/publicMetadata.ts",
        "packages/contracts/src/thoughtRelease.ts",
      ],
      directories: ["packages/contracts/src/abi"],
    },
    {
      id: "path-release",
      title: "PATH release",
      owner: "PATH Contract producer and inshell.art consumer",
      reason: "PATH permission, capacity, renderer, ABI, and release facts are imported from this lock and release.",
      files: ["packages/contracts/src/path-release/consumer-lock.json"],
      directories: ["packages/contracts/src/path-release/releases/v0.5.0"],
    },
    {
      id: "path-deployments",
      title: "PATH deployment records",
      owner: "inshell.art deployment tooling",
      reason: "Network, address, and deployment facts shown by the App derive from these records.",
      directories: [
        "packages/contracts/src/addresses",
        "packages/contracts/src/releases",
      ],
    },
    {
      id: "thought-runtime",
      title: "THOUGHT App runtime",
      owner: "THOUGHT App",
      reason: "Public THOUGHT creation, Agent transport, preview, provenance, rendering, and mint behavior.",
      files: [
        "apps/thought/index.html",
        "apps/thought/package.json",
        "apps/thought/vite.config.ts",
      ],
      directories: ["apps/thought/src", "apps/thought/scripts"],
      exclude: [/\.test\.[cm]?[jt]sx?$/, /\.spec\.[cm]?[jt]sx?$/, /\.d\.ts$/],
    },
    {
      id: "thought-app",
      title: "THOUGHT App specifications and records",
      owner: "THOUGHT App",
      reason: "Creative specification, provenance, metadata namespace, and App integration facts.",
      directories: [
        "apps/thought/spec",
        "apps/thought/provenance/v2",
        "apps/thought/metadata/v2",
        "apps/thought/contract-integration/current",
      ],
    },
    {
      id: "thought-contract-release",
      title: "THOUGHT Contract release",
      owner: "THOUGHT Contract producer and inshell.art consumer",
      reason: "Canonical Contract, renderer, metadata, protocol, and conformance facts.",
      files: ["apps/thought/contract-release/consumer-lock.json"],
      directories: [
        "apps/thought/contract-release/releases/thought-v2-canonical-portable-release-20260801-r1",
      ],
    },
  ] satisfies readonly DocsSourceRegistryGroup[],
} as const;
