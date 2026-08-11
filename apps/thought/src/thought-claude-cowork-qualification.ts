import { THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION } from
  "@inshell/thought-agent-protocol";

/**
 * Deprecated Cowork compatibility record. It is intentionally never imported
 * by active App routing; new Claude launches always target Claude Code.
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
  note: "Legacy Cowork compatibility only; not eligible for active App routing.",
});
