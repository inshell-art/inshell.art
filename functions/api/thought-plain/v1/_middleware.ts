import { API, acknowledge, assertOrigin, createBrief, digest, handoff, makeWork } from "../../../../apps/thought/src/plain-return/model";

export type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; run(): Promise<unknown> };
export type PlainDatabase = { prepare(sql: string): Statement };
export type PlainEnv = { INSHELL_CHAIN_DATA_DB?: PlainDatabase; THOUGHT_PLAIN_HTTP_ENABLED?: string; THOUGHT_PLAIN_HTTP_ORIGIN?: string };
type Context = { request: Request; env: PlainEnv };
type Row = {
  run_id: string; prompt: string; brief_hash: string; return_hash: string; browser_hash: string;
  expires_at: number; read_expires_at: number; state: string; agent_line: string | null;
  accepted_at: string | null; conflict: number;
};
export const WRITE_TTL = 30 * 60_000;
export const READ_TTL = 24 * 60 * 60_000;
const BODY_TIMEOUT = 5000;
const token = () => globalThis.btoa(String.fromCharCode(...globalThis.crypto.getRandomValues(new Uint8Array(32))))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
class Rejection extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
function reject(status: number, code: string): never { throw new Rejection(status, code); }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" },
});

// Bound memory and duration. Never include supplied body/token in an error.
async function textBody(request: Request, max: number): Promise<string> {
  if (request.headers.has("content-encoding")) reject(415, "BODY_ENCODING");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > max)) reject(413, "BODY_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, fail) => {
    timer = setTimeout(() => { fail(new Rejection(408, "BODY_TIMEOUT")); void reader.cancel().catch(() => {}); }, BODY_TIMEOUT);
  });
  try {
    const bytes = new Uint8Array(max);
    let size = 0;
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout]);
      if (chunk.done) break;
      if (size + chunk.value.byteLength > max) reject(413, "BODY_TOO_LARGE");
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
    // Preserve BOM instead of stripping it; artwork validation rejects it.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size));
  } catch (error) {
    if (error instanceof Rejection) throw error;
    return reject(422, "BODY_INVALID");
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
async function schema(db: PlainDatabase) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS thought_plain_runs_v1 (
    run_id TEXT PRIMARY KEY, prompt TEXT NOT NULL, brief_hash TEXT NOT NULL,
    return_hash TEXT NOT NULL, browser_hash TEXT NOT NULL, visitor_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL, read_expires_at INTEGER NOT NULL,
    state TEXT NOT NULL, agent_line TEXT, accepted_at TEXT, conflict INTEGER NOT NULL DEFAULT 0
  )`).run();
}
async function readRow(db: PlainDatabase, id: string) {
  return db.prepare("SELECT * FROM thought_plain_runs_v1 WHERE run_id = ?").bind(id).first<Row>();
}
function authorize(request: Request, expectedHash: string) {
  const value = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const actual = digest(value ?? "");
  let difference = actual.length ^ expectedHash.length;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ (expectedHash.charCodeAt(i) || 0);
  if (!value || difference !== 0) reject(401, "CAPABILITY_INVALID");
}
function work(row: Row) {
  return row.state === "returned" && row.agent_line !== null && row.accepted_at !== null
    ? makeWork(row.run_id, row.prompt, row.agent_line, row.accepted_at) : null;
}

/** Same handler for Pages and the local SQLite-backed adapter. Never proxies. */
export async function handlePlainRequest({ request, env }: Context, now = Date.now()): Promise<Response> {
  const started = Date.now();
  try {
    // No schema creation or DB access when disabled (the default).
    if (env.THOUGHT_PLAIN_HTTP_ENABLED !== "true") return json({ code: "NOT_FOUND" }, 404);
    let origin: string;
    try { origin = assertOrigin(env.THOUGHT_PLAIN_HTTP_ORIGIN ?? ""); }
    catch { return json({ code: "NOT_CONFIGURED" }, 503); }
    const url = new URL(request.url);
    if (url.origin !== origin || url.search || url.hash) reject(403, "ORIGIN_NOT_ALLOWED");
    const browserOrigin = request.headers.get("origin");
    if (browserOrigin !== null && browserOrigin !== origin) reject(403, "ORIGIN_NOT_ALLOWED");
    const path = url.pathname;
    const runMatch = new RegExp(`^${API}/runs/(plain_[a-zA-Z0-9-]{8,64})(/return)?$`).exec(path);
    const capabilityRoute = path === `${API}/capabilities`;
    const createRoute = path === `${API}/runs`;
    if (!capabilityRoute && !createRoute && !runMatch) reject(404, "NOT_FOUND");
    const methodAllowed = capabilityRoute ? request.method === "GET"
      : createRoute || runMatch?.[2] ? request.method === "POST" : ["GET", "DELETE"].includes(request.method);
    if (!methodAllowed) reject(405, "METHOD_NOT_ALLOWED");
    const db = env.INSHELL_CHAIN_DATA_DB;
    if (!db) reject(503, "STORE_UNAVAILABLE");
    if (capabilityRoute) return json({ schema: "inshell.thought.plain-capabilities.v1", enabled: true, origin, writeTtlMs: WRITE_TTL, readTtlMs: READ_TTL, mintEligible: false });
    if (createRoute) {
      if (browserOrigin !== origin || request.headers.get("x-thought-create") !== "1") reject(403, "ORIGIN_NOT_ALLOWED");
      if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) reject(415, "BODY_TYPE");
      let prompt: string;
      try {
        const body = JSON.parse(await textBody(request, 1024)) as Record<string, unknown>;
        if (!body || Object.keys(body).join() !== "promptLine" || typeof body.promptLine !== "string") reject(422, "PROMPT_INVALID");
        prompt = body.promptLine as string;
        createBrief("plain_validate", prompt);
      } catch (error) {
        if (error instanceof Rejection) throw error;
        return reject(422, "PROMPT_INVALID");
      }
      // Pages supplies this trusted header; local adapter uses its peer address.
      const peer = request.headers.get("cf-connecting-ip");
      if (!peer || peer.length > 64) reject(503, "RATE_IDENTITY_UNAVAILABLE");
      const visitorHash = digest(`plain:${origin}:${peer}`);
      await schema(db);
      await db.prepare("DELETE FROM thought_plain_runs_v1 WHERE read_expires_at <= ?").bind(now).run();
      const runId = `plain_${globalThis.crypto.randomUUID()}`;
      const returnToken = token(), browserToken = token();
      const expiresAt = now + WRITE_TTL;
      // One atomic INSERT SELECT prevents concurrent create-limit bypass.
      await db.prepare(`INSERT INTO thought_plain_runs_v1
        (run_id, prompt, brief_hash, return_hash, browser_hash, visitor_hash, expires_at, read_expires_at, state)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'pending'
        WHERE (SELECT count(*) FROM thought_plain_runs_v1) < 1000
        AND (SELECT count(*) FROM thought_plain_runs_v1 WHERE visitor_hash = ?) < 10
        AND (SELECT count(*) FROM thought_plain_runs_v1 WHERE visitor_hash = ? AND state = 'pending' AND expires_at > ?) < 2`)
        .bind(runId, prompt, createBrief(runId, prompt).briefSha256, digest(returnToken), digest(browserToken), visitorHash,
          expiresAt, now + READ_TTL, visitorHash, visitorHash, now).run();
      if (!await readRow(db, runId)) reject(429, "RUN_LIMIT");
      return json({ runId, promptLine: prompt, expiresAt, readExpiresAt: now + READ_TTL, browserToken,
        handoff: handoff(runId, prompt, origin, returnToken, expiresAt).text }, 201);
    }
    await schema(db);
    const id = runMatch![1];
    let row = await readRow(db, id);
    if (!row) reject(404, "RUN_NOT_FOUND");
    const returning = Boolean(runMatch![2]);
    authorize(request, returning ? row.return_hash : row.browser_hash);
    if (now >= row.read_expires_at || (returning && now >= row.expires_at)) reject(410, "EXPIRED");
    if (row.brief_hash !== createBrief(row.run_id, row.prompt).briefSha256) reject(409, "RELEASE_CHANGED");
    if (request.method === "GET") return json({ runId: id, state: row.state === "pending" && now >= row.expires_at ? "expired" : row.state, conflict: Boolean(row.conflict), work: work(row) });
    if (request.method === "DELETE") {
      await db.prepare("UPDATE thought_plain_runs_v1 SET state = 'cancelled' WHERE run_id = ? AND state = 'pending'").bind(id).run();
      row = (await readRow(db, id))!;
      return json({ runId: id, state: row.state, conflict: Boolean(row.conflict), work: work(row) });
    }
    let line: string;
    try {
      if (!/^text\/plain(?:;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) reject(415, "BODY_TYPE");
      line = await textBody(request, 64);
      makeWork(id, row.prompt, line, new Date(now).toISOString());
    } catch (error) {
      await db.prepare("UPDATE thought_plain_runs_v1 SET state = 'rejected' WHERE run_id = ? AND state = 'pending'").bind(id).run();
      if (error instanceof Rejection) throw error;
      return reject(422, "ARTWORK_INVALID");
    }
    await db.prepare("UPDATE thought_plain_runs_v1 SET state = 'returned', agent_line = ?, accepted_at = ? WHERE run_id = ? AND state = 'pending' AND expires_at > ?")
      .bind(line, new Date(now).toISOString(), id, now + Math.max(0, Date.now() - started)).run();
    row = (await readRow(db, id))!;
    if (row.state === "returned" && row.agent_line === line) return json(acknowledge(work(row)!));
    if (row.state === "returned") {
      await db.prepare("UPDATE thought_plain_runs_v1 SET conflict = 1 WHERE run_id = ?").bind(id).run();
      reject(409, "CONFLICT");
    }
    if (row.state === "pending" && now + Math.max(0, Date.now() - started) >= row.expires_at) reject(410, "EXPIRED");
    return reject(row.state === "rejected" ? 422 : 409, row.state.toUpperCase());
  } catch (error) {
    return error instanceof Rejection ? json({ code: error.code }, error.status) : json({ code: "STORE_UNAVAILABLE" }, 503);
  }
}
export const onRequest = (ctx: Context) => handlePlainRequest(ctx);
