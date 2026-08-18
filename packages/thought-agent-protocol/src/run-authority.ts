export const THOUGHT_AGENT_RUN_AUTHORITY_VERSION =
  "inshell.thought.agent-run-authority.v1" as const;

/**
 * Fixed trust boundary shared by the App, Agent handoffs, and handoff lab.
 *
 * Visible handoff text is intentionally editable in Agent chat surfaces. It
 * may bootstrap a run but cannot become the source of creative authority.
 */
export const THOUGHT_AGENT_RUN_AUTHORITY = {
  schema: THOUGHT_AGENT_RUN_AUTHORITY_VERSION,
  launchHandoff: "bootstrap-only",
  canonicalRunCapsule: "app-issued",
  creativeInputSource: "start-response-only",
  chatEditsAffectCanonicalRun: false,
  transcriptPurityAttested: false,
} as const;
