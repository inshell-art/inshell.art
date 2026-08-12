const capsuleMethods = new Map([
  ["claim", "POST"],
  ["ready", "POST"],
  ["start", "POST"],
  ["result", "PUT"],
  ["fail", "POST"],
]);

const capsulePathPattern =
  /^\/api\/thought-agent\/v2\/runs\/(tar_[A-Za-z0-9_-]{8,128})\/([a-z-]+)$/;
const bearerPattern = /^Bearer [A-Za-z0-9._~-]{16,512}$/;

export function isLanAgentCapsuleRequest({
  method,
  pathname,
  search = "",
  authorization,
}) {
  if (search !== "" || typeof authorization !== "string") return false;
  if (!bearerPattern.test(authorization)) return false;
  const match = capsulePathPattern.exec(pathname);
  if (!match) return false;
  return capsuleMethods.get(match[2]) === method;
}
