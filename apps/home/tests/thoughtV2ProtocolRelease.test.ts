import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { keccak256, toUtf8Bytes } from "ethers";
import {
  binaryFieldPackedHex,
  thoughtWorkHashes,
} from "../../../packages/shared/src/thought-v2-protocol";
import { buildThoughtV2Svg } from "../../../packages/shared/src/thought-v2-renderer";
import { THOUGHT_V2_PROTOCOL_RELEASE } from "../../../packages/thought-agent-protocol/src";
import { THOUGHT_AGENT_STATUS } from "../../../functions/api/thought-agent/v1/shared";

const LOCK_PATH = resolve(
  cwd(),
  "../../packages/thought-agent-protocol/thought-v2.consumer-lock.json",
);
const RELEASE_ID = (JSON.parse(readFileSync(LOCK_PATH, "utf8")) as { releaseId: string }).releaseId;
const RELEASE_DIR = resolve(
  cwd(),
  "public/artifacts/thought-protocol-v2",
  RELEASE_ID,
);

type ConsumerLock = {
  releaseId: string;
  source: { tag: string; commit: string };
  manifest: {
    byteLength: number;
    sha256: string;
    keccak256: string;
    artifactCount: number;
  };
  deployment: { status: string; v2MintEnabled: boolean; address?: string };
  artifacts: Array<{
    path: string;
    byteLength: number;
    sha256: string;
    keccak256: string;
  }>;
};

type RendererFixture = {
  id: string;
  promptLine: string;
  agentLine: string;
  rendererId: string;
  binaryFieldPacked: string;
  binaryFieldKeccak256: string;
  agentIdentityHash: string;
  workHash: string;
  expectedSvg: string;
  expectedSvgKeccak256: string;
};

const readBytes = (path: string) => readFileSync(path);
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

describe("pinned THOUGHT V2 protocol release", () => {
  test("pins the immutable release and verifies every normative artifact", () => {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as ConsumerLock;

    expect(lock.releaseId).toBe(RELEASE_ID);
    expect(lock.source).toMatchObject({
      repository: THOUGHT_V2_PROTOCOL_RELEASE.source.repository,
      commit: THOUGHT_V2_PROTOCOL_RELEASE.commit,
    });
    const manifestBytes = readBytes(resolve(RELEASE_DIR, "release-manifest.json"));
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
      artifacts?: unknown[];
    };
    expect(manifestBytes.byteLength).toBe(lock.manifest.byteLength);
    expect(sha256(manifestBytes)).toBe(lock.manifest.sha256);
    expect(keccak256(new Uint8Array(manifestBytes))).toBe(lock.manifest.keccak256);
    expect(manifest.artifacts).toHaveLength(lock.manifest.artifactCount);
    expect(lock.artifacts).toHaveLength(lock.manifest.artifactCount);

    for (const artifact of lock.artifacts) {
      const bytes = readBytes(resolve(RELEASE_DIR, "files", artifact.path));
      expect(bytes.byteLength).toBe(artifact.byteLength);
      expect(sha256(bytes)).toBe(artifact.sha256);
      expect(keccak256(new Uint8Array(bytes))).toBe(artifact.keccak256);
    }
  });

  test("keeps V2 mint disabled because the release is source-only", () => {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8")) as ConsumerLock;

    expect(lock.deployment.status).toBe("source-only");
    expect(lock.deployment.v2MintEnabled).toBe(false);
    expect(lock.deployment.address).toBeUndefined();
    expect(THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled).toBe(false);
    expect(THOUGHT_AGENT_STATUS).toMatchObject({
      protocolVersion: "inshell.thought.agent-run.v2",
      resultSchema: "inshell.thought.agent-result.v2",
      protocolReleaseId: RELEASE_ID,
      deploymentStatus: "source-only",
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

  test("consumes the released four-argument ThoughtNFT constructor ABI", () => {
    const artifact = JSON.parse(
      readFileSync(
        resolve(RELEASE_DIR, "files/contract/abi/ThoughtNFT.json"),
        "utf8",
      ),
    ) as { abi: Array<{ type: string; inputs?: Array<{ name: string; type: string }> }> };
    const constructor = artifact.abi.find((entry) => entry.type === "constructor");

    expect(constructor?.inputs).toEqual([
      { internalType: "address", name: "pathNft_", type: "address" },
      {
        internalType: "address",
        name: "thoughtSpecRegistry_",
        type: "address",
      },
      {
        internalType: "address",
        name: "thoughtRenderer_",
        type: "address",
      },
      {
        internalType: "bytes32",
        name: "protocolReleaseKeccak256_",
        type: "bytes32",
      },
    ]);
  });

  test("matches every packaged valid renderer fixture byte-for-byte", () => {
    const fixturesDir = resolve(RELEASE_DIR, "files/renderer/fixtures");
    const fixtureFiles = readdirSync(fixturesDir)
      .filter(
        (name) =>
          name.endsWith(".json") &&
          name !== "invalid-lines.json" &&
          name !== "invalid-raw-utf8.json" &&
          name !== "cycling-collisions.json",
      )
      .sort();

    expect(fixtureFiles.length).toBeGreaterThan(0);
    for (const fixtureFile of fixtureFiles) {
      const fixture = JSON.parse(
        readFileSync(resolve(fixturesDir, fixtureFile), "utf8"),
      ) as RendererFixture;
      const hashes = thoughtWorkHashes(fixture.promptLine, fixture.agentLine);
      const svg = buildThoughtV2Svg({
        promptLine: fixture.promptLine,
        agentLine: fixture.agentLine,
      });

      expect(fixture.rendererId).toBe(
        THOUGHT_V2_PROTOCOL_RELEASE.identifiers.renderer,
      );
      expect(binaryFieldPackedHex(fixture.promptLine, fixture.agentLine)).toBe(
        fixture.binaryFieldPacked,
      );
      expect(hashes.binaryFieldKeccak256).toBe(fixture.binaryFieldKeccak256);
      expect(hashes.agentIdentityHash).toBe(fixture.agentIdentityHash);
      expect(hashes.workHash).toBe(fixture.workHash);
      expect(svg).toBe(fixture.expectedSvg);
      expect(keccak256(toUtf8Bytes(svg))).toBe(fixture.expectedSvgKeccak256);
    }
  });
});
