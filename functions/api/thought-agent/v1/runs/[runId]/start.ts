import {
  onRequestOptions,
  startRun,
  type ThoughtAgentRouteContext,
} from "../../shared";

export { onRequestOptions };

export async function onRequestPost(
  ctx: ThoughtAgentRouteContext,
): Promise<Response> {
  return startRun(ctx);
}
