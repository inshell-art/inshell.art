import { deploymentOverrideDrift, THOUGHT_ACTIVATION_POLICY, THOUGHT_DEPLOYMENT_LOCK_STATUS, THOUGHT_V2_PRODUCTION_DEPLOYMENT } from "../../../../apps/thought/src/thought-v2-production-deployment";

const json = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  },
);

export const onRequestOptions = () => new Response(null, {
  status: 204,
  headers: {
    Allow: "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  },
});

export const onRequestGet = (ctx?: { env?: Record<string, unknown> }) => {
  const differences = deploymentOverrideDrift(ctx?.env ?? {});
  return json(differences.length ? 503 : 200, {
  schema: "inshell.thought.production-attestation-status.v2",
  deploymentLock: { ...THOUGHT_DEPLOYMENT_LOCK_STATUS,
    integrity: differences.length ? "drift" : "valid", differences },
  activationPolicy: THOUGHT_ACTIVATION_POLICY,
  enabled: false,
  status: THOUGHT_V2_PRODUCTION_DEPLOYMENT
    ? "signer-integration-not-authorized"
    : "not-deployed",
  signerLocation: "backend-only",
  browserSigning: false,
  });
};

export const onRequestPost = () => json(503, {
  error: {
    code: "PRODUCTION_ATTESTATION_NOT_AUTHORIZED",
    message: "THOUGHT production attestation is not authorized.",
  },
});
