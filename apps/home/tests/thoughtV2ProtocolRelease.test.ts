import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { THOUGHT_V2_PROTOCOL_RELEASE } from "../../../packages/thought-agent-protocol/src";
import { THOUGHT_AGENT_STATUS } from "../../../functions/api/thought-agent/v1/shared";
import {
  THOUGHT_V2_CONVERSATION_IDENTITY_DOMAIN,
  THOUGHT_V2_RENDERER_ID,
  THOUGHT_V2_RENDERER_ID_HASH,
  THOUGHT_V2_WORK_DOMAIN,
  THOUGHT_V2_WORK_PROFILE_ID,
  THOUGHT_V2_WORK_PROFILE_ID_HASH,
  deriveThoughtV2WorkHashes,
} from "../../thought/contract-integration/current/reference/thought-v2-terminal-work-profile";

const LOCK_PATH = resolve(
  cwd(),
  "../../packages/thought-agent-protocol/thought-v2.consumer-lock.json",
);

type ConsumerLock = {
  schema: string;
  artifactId: string;
  source: {
    repository: string;
    tag: string;
    commit: string;
    dirty: boolean;
    eligibleForProduction: boolean;
  };
  contractManifestSha256: string;
  runtimeRelease: {
    protocolReleaseId: string;
    manifestKeccak256: string;
  };
  selectedSpec: {
    name: string;
    byteLength: number;
    sha256: string;
    evmSpecId: string;
    evmSpecHash: string;
  };
  identifiers: {
    workProfile: string;
  };
  deployment: {
    status: string;
    v2MintEnabled: boolean;
    address?: string;
  };
};

type ReleaseManifest = {
  artifactId: string;
  source: { tag: string; dirty: boolean };
  compatibility: {
    selectedSpec: {
      name: string;
      byteLength: number;
      sha256: string;
      thoughtSpecId: string;
      thoughtSpecHash: string;
    };
    workProfile: { id: string };
  };
  deploymentPolicy: {
    authorizedNow: boolean;
    targetChains: Array<{ deploymentAuthorized: boolean }>;
  };
  flags: {
    deploymentAuthorized: boolean;
    productionConsumable: boolean;
  };
  files: Array<{
    path: string;
    byteLength: number;
    sha256: string;
  }>;
};

type ReleaseReadme = {
  artifactId: string;
  sourceTag: string;
  deploymentAuthorized: boolean;
  productionConsumable: boolean;
};

type WorkHashVectors = {
  profileId: string;
  profileIdHash: string;
  rendererId: string;
  rendererIdHash: string;
  conversationIdentityDomain: string;
  workDomain: string;
  vectors: Array<{
    promptLine: string;
    agentLine: string;
    promptLineKeccak256: string;
    agentLineKeccak256: string;
    conversationIdentityHash: string;
    workHash: string;
  }>;
};

const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as ConsumerLock;
const RELEASE_ID = lock.artifactId;
const RELEASE_DIR = resolve(
  cwd(),
  "../thought/contract-release/releases",
  RELEASE_ID,
);
const readBytes = (path: string) => readFileSync(path);
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

describe("pinned THOUGHT V2 protocol release", () => {
  test("pins the immutable release and verifies every packaged artifact", () => {
    const manifestBytes = readBytes(resolve(RELEASE_DIR, "manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as ReleaseManifest;

    expect(lock.schema).toBe("inshell.thought.current-v2-consumer-lock.v2");
    expect(lock.artifactId).toBe(THOUGHT_V2_PROTOCOL_RELEASE.releaseId);
    expect(lock.source).toMatchObject({
      repository: THOUGHT_V2_PROTOCOL_RELEASE.source.repository,
      tag: THOUGHT_V2_PROTOCOL_RELEASE.source.tag,
      commit: THOUGHT_V2_PROTOCOL_RELEASE.commit,
      dirty: false,
      eligibleForProduction: true,
    });
    expect(manifest.artifactId).toBe(RELEASE_ID);
    expect(manifest.source).toMatchObject({ tag: lock.source.tag, dirty: false });
    expect(sha256(manifestBytes)).toBe(lock.contractManifestSha256);
    expect(manifest.files.length).toBeGreaterThan(0);

    for (const artifact of manifest.files) {
      const bytes = readBytes(resolve(RELEASE_DIR, artifact.path));
      expect(bytes.byteLength).toBe(artifact.byteLength);
      expect(sha256(bytes)).toBe(artifact.sha256);
    }

    expect(manifest.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "contract/compiled/ThoughtNFTV2.json",
        "dependencies/mono-76/manifest.json",
        "reference/thought-v2-terminal-work-profile.ts",
        "validation/producer-tests.json",
      ]),
    );
  });

  test("keeps the runtime binding aligned with the current consumer lock", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(RELEASE_DIR, "manifest.json"), "utf8"),
    ) as ReleaseManifest;

    expect(lock.runtimeRelease).toEqual(THOUGHT_V2_PROTOCOL_RELEASE.release);
    expect(lock.selectedSpec).toMatchObject({
      name: THOUGHT_V2_PROTOCOL_RELEASE.spec.name,
      byteLength: THOUGHT_V2_PROTOCOL_RELEASE.spec.byteLength,
      sha256: THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256,
      evmSpecId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
      evmSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
    });
    expect(manifest.compatibility.selectedSpec).toEqual({
      name: lock.selectedSpec.name,
      byteLength: lock.selectedSpec.byteLength,
      sha256: lock.selectedSpec.sha256,
      thoughtSpecId: lock.selectedSpec.evmSpecId,
      thoughtSpecHash: lock.selectedSpec.evmSpecHash,
    });
    expect(manifest.compatibility.workProfile.id).toBe(
      THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
    );
    expect(lock.identifiers.workProfile).toBe(
      THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
    );
  });

  test("matches the released work-hash conformance vectors", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(
          RELEASE_DIR,
          "protocol/current/v2/conformance/work-hash-vectors.json",
        ),
        "utf8",
      ),
    ) as WorkHashVectors;

    expect(fixture).toMatchObject({
      profileId: THOUGHT_V2_WORK_PROFILE_ID,
      profileIdHash: THOUGHT_V2_WORK_PROFILE_ID_HASH,
      rendererId: THOUGHT_V2_RENDERER_ID,
      rendererIdHash: THOUGHT_V2_RENDERER_ID_HASH,
      conversationIdentityDomain: THOUGHT_V2_CONVERSATION_IDENTITY_DOMAIN,
      workDomain: THOUGHT_V2_WORK_DOMAIN,
    });
    expect(fixture.vectors.length).toBeGreaterThan(0);

    for (const vector of fixture.vectors) {
      expect(
        deriveThoughtV2WorkHashes(vector.promptLine, vector.agentLine),
      ).toEqual({
        promptLineKeccak256: vector.promptLineKeccak256,
        agentLineKeccak256: vector.agentLineKeccak256,
        conversationIdentityHash: vector.conversationIdentityHash,
        workHash: vector.workHash,
      });
    }
  });

  test("keeps V2 mint disabled until a persistent deployment is authorized", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(RELEASE_DIR, "manifest.json"), "utf8"),
    ) as ReleaseManifest;
    const readme = JSON.parse(
      readFileSync(resolve(RELEASE_DIR, "README.json"), "utf8"),
    ) as ReleaseReadme;

    expect(lock.deployment.status).toBe("canonical-portable-not-deployed");
    expect(lock.deployment.v2MintEnabled).toBe(false);
    expect(lock.deployment.address).toBeUndefined();
    expect(manifest.deploymentPolicy.authorizedNow).toBe(false);
    expect(
      manifest.deploymentPolicy.targetChains.every(
        ({ deploymentAuthorized }) => deploymentAuthorized === false,
      ),
    ).toBe(true);
    expect(manifest.flags).toMatchObject({
      deploymentAuthorized: false,
      productionConsumable: true,
    });
    expect(readme).toMatchObject({
      artifactId: RELEASE_ID,
      sourceTag: lock.source.tag,
      deploymentAuthorized: false,
      productionConsumable: true,
    });
    expect(THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled).toBe(false);
    expect(THOUGHT_AGENT_STATUS).toMatchObject({
      protocolVersion: "inshell.thought.agent-run.v2",
      resultSchema: "inshell.thought.agent-result.v2",
      protocolReleaseId: RELEASE_ID,
      deploymentStatus: "canonical-portable-not-deployed",
      v2MintEnabled: false,
    });
  });

  test("does not embed Agent write credentials in user-visible launch tasks", () => {
    const thoughtSource = readFileSync(
      resolve(cwd(), "../thought/src/main.ts"),
      "utf8",
    );

    expect(thoughtSource).not.toContain("Launch token:");
    expect(thoughtSource).not.toMatch(/thought:\/\/agent\/run\?[^`\n]*token=/);
  });

  test("consumes the released six-argument ThoughtNFTV2 constructor ABI", () => {
    const artifact = JSON.parse(
      readFileSync(
        resolve(RELEASE_DIR, "contract/compiled/ThoughtNFTV2.json"),
        "utf8",
      ),
    ) as { abi: Array<{ type: string; inputs?: Array<Record<string, string>> }> };
    const constructor = artifact.abi.find((entry) => entry.type === "constructor");

    expect(constructor?.inputs).toEqual([
      { internalType: "address", name: "pathNft_", type: "address" },
      { internalType: "address", name: "thoughtSpecRegistry_", type: "address" },
      { internalType: "address", name: "thoughtRenderer_", type: "address" },
      { internalType: "address", name: "protocolRegistry_", type: "address" },
      { internalType: "bytes32", name: "protocolReleaseId_", type: "bytes32" },
      {
        internalType: "address",
        name: "creationAttestationVerifier_",
        type: "address",
      },
    ]);
  });
});
