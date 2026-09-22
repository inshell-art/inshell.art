import { readAuctionStatusOverride } from "@/services/auctionStatusOverride";
import { isPathDeploymentActive } from "@/services/pathDeployment";

/**
 * Studio Preview is a frontend capability boundary, not an auction state.
 * The deployment lock is authoritative: without an approved PATH deployment,
 * no onchain surface may mount or read chain-backed state.
 */
export function isStudioPreviewActive(): boolean {
  return (
    readAuctionStatusOverride() === "before_deploy" ||
    !isPathDeploymentActive()
  );
}
