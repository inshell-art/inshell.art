import { THOUGHT_V2_PRODUCTION_DEPLOYMENT } from "../../../../apps/thought/src/thought-v2-production-deployment";

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

export const onRequestGet = () => json(200, {
  schema: "inshell.thought.production-attestation-status.v1",
  deploymentLocked: THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null,
  enabled: false,
  status: THOUGHT_V2_PRODUCTION_DEPLOYMENT
    ? "signer-integration-not-authorized"
    : "not-deployed",
  signerLocation: "backend-only",
  browserSigning: false,
});

export const onRequestPost = () => json(503, {
  error: {
    code: "PRODUCTION_ATTESTATION_NOT_AUTHORIZED",
    message: "THOUGHT production attestation is not authorized.",
  },
});
