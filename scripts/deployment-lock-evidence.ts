import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  DEPLOYMENT_CONTRACT_NAMES, deploymentConfigurationDrift,
  type ThoughtDeploymentLock,
} from "../apps/thought/src/thought-v2-production-deployment";

export function verifyDeploymentLockEvidence(lock: ThoughtDeploymentLock, root: string) {
  const readReference = (reference: string) => {
    const base = realpathSync(root);
    const filename = realpathSync(resolve(base, reference));
    if (!filename.startsWith(base + sep)) throw new Error("Deployment evidence escaped repository.");
    return readFileSync(filename);
  };
  if (!readReference(lock.review.reference).toString("utf8").trim()) {
    throw new Error("Deployment review record is empty.");
  }
  if (lock.state === "no-approved-deployment") return;
  const bytes = readReference(lock.evidence.reference);
  if (createHash("sha256").update(bytes).digest("hex") !== lock.evidence.sha256) {
    throw new Error("Deployment evidence checksum drift.");
  }
  const report = JSON.parse(bytes.toString("utf8"));
  if (report.schema !== "inshell.deployment-evidence.v1" ||
      deploymentConfigurationDrift(lock, report.deployment).length) {
    throw new Error("Deployment evidence identity drift.");
  }
  for (const name of DEPLOYMENT_CONTRACT_NAMES) {
    const receipt = report.contracts?.[name];
    if (!receipt || receipt.address !== lock.deployment.contracts[name] ||
        receipt.blockNumber !== lock.deployment.deployBlocks[name] ||
        !/^0x[0-9a-f]{64}$/.test(receipt.transactionHash ?? "") ||
        /^0x0+$/.test(receipt.transactionHash) ||
        !/^[0-9a-f]{64}$/.test(receipt.runtimeBytecodeSha256 ?? "")) {
      throw new Error(`Deployment evidence missing verified receipt/bytecode: ${name}.`);
    }
  }
}

export function assertReviewedLockTransition(previous: unknown, next: ThoughtDeploymentLock) {
  const old = previous as { schema?: string; revision?: number; review?: { reference?: string };
    status?: string; enabled?: boolean; contracts?: unknown; authorization?: Record<string, unknown> };
  // A reviewed historical reference may pin an older release. Do not validate
  // that historical pin against today's generated release before comparing it.
  if (old.schema === next.schema && isDeepStrictEqual(previous, next)) return;
  if (old.schema === "inshell.thought.production-deployment-lock.v1" &&
      old.status === "not-deployed" && old.enabled === false && old.contracts === null &&
      old.authorization?.deploymentApproved === false &&
      old.authorization?.frontendActivationApproved === false &&
      old.authorization?.signerActivationApproved === false &&
      next.revision === 1 && next.state === "no-approved-deployment") return;
  if (!Number.isSafeInteger(old.revision) || next.revision <= Number(old.revision) ||
      next.review.reference === old.review?.reference) {
    throw new Error("Intentional deployment lock changes need a higher revision and a new review record.");
  }
}
