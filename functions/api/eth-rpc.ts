import {
  __clearRpcGateCachesForTests,
  fallbackRpcGate,
} from "./rpc-gate";

export const onRequestOptions = fallbackRpcGate.onRequestOptions;
export const onRequestGet = fallbackRpcGate.onRequestGet;
export const onRequestPost = fallbackRpcGate.onRequestPost;

export function __clearRpcProxyCachesForTests() {
  __clearRpcGateCachesForTests();
}
