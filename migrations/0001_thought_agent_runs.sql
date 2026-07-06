CREATE TABLE IF NOT EXISTS thought_agent_runs (
  run_id TEXT PRIMARY KEY,
  protocol_version TEXT NOT NULL,
  state TEXT NOT NULL,
  web_origin TEXT NOT NULL,
  visitor_hash TEXT,
  requested_adapter_id TEXT NOT NULL,
  requested_model TEXT,
  spec_id TEXT NOT NULL,
  spec_sha256 TEXT NOT NULL,
  contract_spec_hash TEXT,
  spec_text TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_sha256 TEXT NOT NULL,
  agent_input_text TEXT NOT NULL,
  agent_input_sha256 TEXT NOT NULL,
  browser_token_hash TEXT NOT NULL,
  launch_token_hash TEXT,
  bridge_token_hash TEXT,
  bridge_metadata_json TEXT,
  adapter_metadata_json TEXT,
  agent_metadata_json TEXT,
  execution_metadata_json TEXT,
  invocation_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  raw_result TEXT,
  raw_result_sha256 TEXT,
  work_text TEXT,
  work_sha256 TEXT,
  receipt_json TEXT,
  receipt_sha256 TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  claim_expires_at TEXT NOT NULL,
  run_expires_at TEXT NOT NULL,
  delete_after TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS thought_agent_runs_state_delete
ON thought_agent_runs(state, delete_after);

CREATE INDEX IF NOT EXISTS thought_agent_runs_visitor_created
ON thought_agent_runs(visitor_hash, created_at);
