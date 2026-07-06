import {
  getRun,
  onRequestOptions,
  type ThoughtAgentRouteContext,
} from "../shared";

export { onRequestOptions };

export async function onRequestGet(
  ctx: ThoughtAgentRouteContext,
): Promise<Response> {
  return getRun(ctx);
}
