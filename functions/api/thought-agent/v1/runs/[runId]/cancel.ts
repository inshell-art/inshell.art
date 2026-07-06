import {
  cancelRun,
  onRequestOptions,
  type ThoughtAgentRouteContext,
} from "../../shared";

export { onRequestOptions };

export async function onRequestPost(
  ctx: ThoughtAgentRouteContext,
): Promise<Response> {
  return cancelRun(ctx);
}
