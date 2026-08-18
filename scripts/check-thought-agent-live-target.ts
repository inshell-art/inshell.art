import {
  requiredThoughtAgentLiveTarget,
  validateCurrentThoughtAgentCandidateCheckout,
  validateThoughtAgentLiveTarget,
} from "./lib/thought-agent-live-target";

const target = requiredThoughtAgentLiveTarget();
await validateCurrentThoughtAgentCandidateCheckout(target);
const validated = await validateThoughtAgentLiveTarget(target);
process.stdout.write(`${JSON.stringify({
  qualified: true,
  runnerId: target.runnerId,
  environment: validated.environment,
  commitSha: validated.commitSha,
  protocolVersion: validated.protocolVersion,
}, null, 2)}\n`);
