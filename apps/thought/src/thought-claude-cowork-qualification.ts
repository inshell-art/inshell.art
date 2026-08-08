import { THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION } from
  "@inshell/thought-agent-protocol";

/**
 * Cowork is hosted, so deterministic tests alone cannot qualify it. Flip this
 * record only after a real Cowork run against public HTTPS returns a receipt.
 */
type ThoughtClaudeCoworkQualification = Readonly<{
  schema: "inshell.thought.claude-cowork-qualification.v1";
  handoffRevision: typeof THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION;
  qualified: boolean;
  publicHttpsOnly: true;
  qualifiedAt: string | null;
  liveCanaryReportSha256: string | null;
  note: string;
}>;

export const THOUGHT_CLAUDE_COWORK_QUALIFICATION:
  ThoughtClaudeCoworkQualification = Object.freeze({
  schema: "inshell.thought.claude-cowork-qualification.v1" as const,
  handoffRevision: THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION,
  qualified: false,
  publicHttpsOnly: true,
  qualifiedAt: null,
  liveCanaryReportSha256: null,
  note: "Awaiting a successful public-HTTPS Claude Cowork canary.",
});
