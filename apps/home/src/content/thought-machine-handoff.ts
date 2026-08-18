export type ThoughtMachineArtifactAuthority =
  | "app-documentation"
  | "app-record"
  | "contract-release";

export type ThoughtMachineArtifact = {
  id: string;
  title: string;
  source: "app" | "contract-release";
  sourcePath: string;
  publicPath: string;
  role: string;
  owner: string;
  authority: ThoughtMachineArtifactAuthority;
  mediaType: string;
};

/**
 * Curated, machine-readable THOUGHT handoff inputs.
 *
 * The generator validates these files against their owning locks and the
 * canonical Contract release manifest before publishing exact-byte copies.
 * Additions, removals, or byte changes therefore update the derived handoff
 * release and the Agent index together; an unpinned change fails docs:check.
 */
export const THOUGHT_MACHINE_HANDOFF_SOURCE = {
  schema: "inshell.thought.machine-handoff-source.v1",
  title: "THOUGHT App and Contract machine handoff",
  status: "current-local-integration-no-production-authorization",
  topics: ["thought", "contracts", "source-release-boundaries"],
  ownerBoundary: {
    sourceOfTruth: {
      repository: "https://github.com/inshell-art/THOUGHT",
      path: "docs/agent/THOUGHT_CROSS_REPO_OWNERSHIP_AND_WALLET_BOUNDARY_HANDOFF_20260803.md",
      revision: "2026-08-04-owner-approved",
    },
    thoughtContract: {
      owner: "THOUGHT feature owner in the THOUGHT repository",
      owns: [
        "contracts",
        "canonical Contract releases",
        "Contract renderer and token metadata",
        "Contract-side validation semantics",
      ],
    },
    thoughtApp: {
      owner: "THOUGHT feature owner in inshell.art",
      owns: [
        "creation flow",
        "Creative Work Specification selection",
        "provenance assembly",
        "Creation Attestation inputs",
        "mint calldata assembly and readback",
      ],
    },
    sharedInfrastructure: {
      owner: "inshell.art shared App infrastructure",
      owns: ["protocol-neutral wallet connection", "$PATH inventory", "site shell", "build and routing"],
    },
    humanWallet: {
      owner: "wallet holder",
      owns: ["wallet account choice", "signature consent", "transaction consent"],
    },
  },
  excluded: [
    {
      id: "thought-agent-transport-release",
      status: "not-in-current-handoff",
      reason:
        "The checked-in Agent transport consumer lock is a stale development snapshot and does not pin the current terminal-english-64 work profile and selected Creative Work Specification. It must not be advertised as current until its owner publishes a clean aligned lock.",
    },
  ],
  artifacts: [
    {
      id: "creative-work-spec",
      title: "THOUGHT V2 Creative Work Specification",
      source: "app",
      sourcePath: "apps/thought/spec/THOUGHT.v2.md",
      publicPath: "app/creative/THOUGHT.v2.md",
      role: "selected-creative-work-specification",
      owner: "THOUGHT App",
      authority: "app-documentation",
      mediaType: "text/markdown; charset=utf-8",
    },
    {
      id: "app-provenance-spec",
      title: "THOUGHT provenance specification",
      source: "app",
      sourcePath: "apps/thought/provenance/v2/thought.provenance.v2.md",
      publicPath: "app/provenance/thought.provenance.v2.md",
      role: "app-owned-provenance-specification",
      owner: "THOUGHT App",
      authority: "app-documentation",
      mediaType: "text/markdown; charset=utf-8",
    },
    {
      id: "app-provenance-schema",
      title: "THOUGHT provenance schema",
      source: "app",
      sourcePath: "apps/thought/provenance/v2/thought.provenance.v2.schema.json",
      publicPath: "app/provenance/thought.provenance.v2.schema.json",
      role: "app-owned-provenance-schema",
      owner: "THOUGHT App",
      authority: "app-record",
      mediaType: "application/schema+json",
    },
    {
      id: "app-metadata-namespace-spec",
      title: "THOUGHT metadata namespace specification",
      source: "app",
      sourcePath: "apps/thought/metadata/v2/thought.metadata-namespace.v2.md",
      publicPath: "app/metadata/thought.metadata-namespace.v2.md",
      role: "app-documentation-for-contract-owned-token-metadata",
      owner: "THOUGHT App and THOUGHT Contract",
      authority: "app-documentation",
      mediaType: "text/markdown; charset=utf-8",
    },
    {
      id: "app-metadata-namespace-schema",
      title: "THOUGHT metadata namespace schema",
      source: "app",
      sourcePath: "apps/thought/metadata/v2/thought.metadata-namespace.v2.schema.json",
      publicPath: "app/metadata/thought.metadata-namespace.v2.schema.json",
      role: "app-documentation-for-contract-owned-token-metadata",
      owner: "THOUGHT App and THOUGHT Contract",
      authority: "app-documentation",
      mediaType: "application/schema+json",
    },
    {
      id: "app-contract-integration-lock",
      title: "THOUGHT App Contract integration lock",
      source: "app",
      sourcePath: "apps/thought/contract-integration/current/integration-lock.json",
      publicPath: "app/integration/app-contract-integration-lock.json",
      role: "app-consumer-binding-to-canonical-contract-release",
      owner: "THOUGHT App",
      authority: "app-documentation",
      mediaType: "application/json",
    },
    {
      id: "contract-release-manifest",
      title: "Canonical THOUGHT Contract release manifest",
      source: "contract-release",
      sourcePath: "manifest.json",
      publicPath: "contract/release-manifest.json",
      role: "canonical-contract-release-manifest",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "contract-index",
      title: "THOUGHT Contract artifact index",
      source: "contract-release",
      sourcePath: "contract/index.json",
      publicPath: "contract/contract-index.json",
      role: "contract-artifact-index",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "thought-nft-compiled-artifact",
      title: "ThoughtNFTV2 compiled artifact",
      source: "contract-release",
      sourcePath: "contract/compiled/ThoughtNFTV2.json",
      publicPath: "contract/compiled/ThoughtNFTV2.json",
      role: "compiled-contract-abi-and-bytecode",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "app-contract-boundary",
      title: "THOUGHT App and Contract executable boundary",
      source: "contract-release",
      sourcePath: "protocol/current/v2/integration/thought.app-contract-boundary.v1.json",
      publicPath: "contract/protocol/integration/thought.app-contract-boundary.v1.json",
      role: "contract-release-boundary-description",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "work-profile",
      title: "THOUGHT work profile",
      source: "contract-release",
      sourcePath: "protocol/current/v2/work/thought.work.v2.profile.json",
      publicPath: "contract/protocol/work/thought.work.v2.profile.json",
      role: "accepted-work-profile",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "work-schema",
      title: "THOUGHT work schema",
      source: "contract-release",
      sourcePath: "protocol/current/v2/work/thought.work.v2.schema.json",
      publicPath: "contract/protocol/work/thought.work.v2.schema.json",
      role: "accepted-work-schema",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/schema+json",
    },
    {
      id: "context-profile",
      title: "THOUGHT visible-context profile",
      source: "contract-release",
      sourcePath: "protocol/current/v2/context/thought.context.v2.profile.json",
      publicPath: "contract/protocol/context/thought.context.v2.profile.json",
      role: "accepted-visible-context-profile",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "metadata-profile",
      title: "THOUGHT Contract metadata profile",
      source: "contract-release",
      sourcePath: "protocol/current/v2/metadata/thought.metadata.v2.profile.json",
      publicPath: "contract/protocol/metadata/thought.metadata.v2.profile.json",
      role: "contract-token-metadata-profile",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "creation-attestation-spec",
      title: "THOUGHT Creation Attestation specification",
      source: "contract-release",
      sourcePath: "protocol/current/v2/attestation/thought.creation-workflow-attestation.v2.md",
      publicPath: "contract/protocol/attestation/thought.creation-workflow-attestation.v2.md",
      role: "contract-accepted-creation-attestation-specification",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "text/markdown; charset=utf-8",
    },
    {
      id: "creation-attestation-vectors",
      title: "THOUGHT Creation Attestation conformance vectors",
      source: "contract-release",
      sourcePath: "protocol/current/v2/attestation/fixtures/creation-attestation-v2-vectors.json",
      publicPath: "contract/protocol/attestation/creation-attestation-v2-vectors.json",
      role: "creation-attestation-conformance-vectors",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "work-hash-vectors",
      title: "THOUGHT work-hash conformance vectors",
      source: "contract-release",
      sourcePath: "protocol/current/v2/conformance/work-hash-vectors.json",
      publicPath: "contract/protocol/conformance/work-hash-vectors.json",
      role: "work-hash-conformance-vectors",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
    {
      id: "contract-provenance-schema",
      title: "Contract-release provenance schema copy",
      source: "contract-release",
      sourcePath: "protocol/current/v2/provenance/thought.provenance.v2.schema.json",
      publicPath: "contract/protocol/provenance/thought.provenance.v2.schema.json",
      role: "contract-release-bundled-provenance-schema",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/schema+json",
    },
    {
      id: "renderer-profile",
      title: "THOUGHT renderer profile",
      source: "contract-release",
      sourcePath: "protocol/current/v2/renderer/thought.renderer.v2.profile.json",
      publicPath: "contract/protocol/renderer/thought.renderer.v2.profile.json",
      role: "canonical-renderer-profile",
      owner: "THOUGHT Contract",
      authority: "contract-release",
      mediaType: "application/json",
    },
  ] satisfies ThoughtMachineArtifact[],
} as const;
