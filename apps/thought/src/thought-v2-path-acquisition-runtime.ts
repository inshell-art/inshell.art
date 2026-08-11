import type { ThoughtV2AnvilRuntime } from "./thought-v2-contract-client";

export const buildThoughtV2PathAcquisitionBrowserAddresses = (
  runtime: ThoughtV2AnvilRuntime,
) => ({
  pathPulseAdapter: { address: runtime.pathPulseAdapter.address },
  pulseAuction: { address: runtime.pulseAuction.address },
  paymentToken: { address: runtime.paymentToken.address },
});
