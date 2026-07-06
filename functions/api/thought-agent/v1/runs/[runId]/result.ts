import {
  onRequestOptions,
  submitResult,
  type ThoughtAgentRouteContext,
} from "../../shared";

export { onRequestOptions };

export async function onRequestPut(
  ctx: ThoughtAgentRouteContext,
): Promise<Response> {
  return submitResult(ctx);
}
