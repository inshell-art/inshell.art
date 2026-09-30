import { appendThoughtWork, writeThoughtWorks, type ThoughtWorkRecord, type WorkStorage } from "../works";
import { API, PENDING_KEY, SAVED_KEY, assertRunId, createBrief, validateWork, type PlainWork } from "./model";

type Pending = { runId: string; promptLine: string; browserToken: string; readExpiresAt: number };
type Status = { runId: string; state: string; conflict: boolean; work: PlainWork | null };
export type ClientState = "idle" | "preparing" | "preparation-uncertain" | "waiting" | "review" | "saved" | "cancelled" | "rejected" | "expired" | "uncertain" | "unavailable";

function storedRecord(work: PlainWork): ThoughtWorkRecord {
  return appendThoughtWork([], {
    prompt: work.promptLine, returnedText: work.agentLine, title: work.promptLine,
    rawOutput: work.agentLine, image: "", svg: work.svg, route: "experimental-plain-http",
    provider: "unknown", model: "unknown", provenanceJson: JSON.stringify(work),
    normalizer: { id: "frontend-renderer", source: "browser-renderer" },
    runContext: { mode: "experimental-plain-http", provider: "unknown", model: "unknown",
      prompt: work.promptLine, clientGeneratedAt: work.acceptedAt }, createdAt: work.acceptedAt,
  }).work;
}
export function readSaved(storage: WorkStorage): PlainWork[] {
  try {
    const data: unknown = JSON.parse(storage.getItem(SAVED_KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.slice(-80).flatMap(record => {
      try {
        if (record.runContext?.mode !== "experimental-plain-http") return [];
        return [validateWork(JSON.parse(record.provenanceJson))];
      } catch { return []; }
    });
  } catch { return []; }
}
export class PlainClient {
  state: ClientState = "idle";
  work: PlainWork | null = null;
  conflict = false;
  reviewed = false;
  private pending: Pending | null = null;
  private epoch = 0;
  private checking = false;
  private cancelling = false;
  constructor(private pendingStorage: WorkStorage, private savedStorage: WorkStorage, private fetcher: typeof fetch = (input, init) => fetch(input, init)) {}
  private async request(path: string, init: RequestInit = {}) {
    const response = await this.fetcher(`${API}${path}`, { ...init, redirect: "error", cache: "no-store", signal: globalThis.AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(response.status === 410 ? "expired" : response.status === 404 ? "unavailable" : "uncertain");
    if (!response.headers.get("content-type")?.startsWith("application/json")) throw new Error("uncertain");
    return response.json();
  }
  async available() {
    const capability = await this.request("/capabilities");
    if (capability.schema !== "inshell.thought.plain-capabilities.v1" || capability.enabled !== true || capability.mintEligible !== false) throw new Error("unavailable");
  }
  restore() {
    try {
      const candidate: Pending = JSON.parse(this.pendingStorage.getItem(PENDING_KEY) ?? "null");
      assertRunId(candidate.runId);
      createBrief(candidate.runId, candidate.promptLine);
      if (!/^[A-Za-z0-9_-]{43}$/.test(candidate.browserToken) || !Number.isFinite(candidate.readExpiresAt) || candidate.readExpiresAt <= Date.now()) throw new Error("expired");
      this.pending = candidate;
      this.state = "waiting";
    } catch { try { this.pendingStorage.removeItem(PENDING_KEY); } catch { /* Storage may be unavailable. */ } }
  }
  async create(promptLine: string): Promise<string> {
    if (this.state !== "idle") throw new Error("Already preparing or active");
    createBrief("plain_validate", promptLine);
    this.state = "preparing";
    try {
      // One create, never a hidden retry after timeout/lost acknowledgement.
      const result = await this.request("/runs", { method: "POST", headers: { "Content-Type": "application/json", "X-Thought-Create": "1" }, body: JSON.stringify({ promptLine }) });
      assertRunId(result.runId);
      if (result.promptLine !== promptLine || !/^[A-Za-z0-9_-]{43}$/.test(result.browserToken) || typeof result.handoff !== "string" || !Number.isFinite(result.readExpiresAt)) throw new Error("uncertain");
      const pending = { runId: result.runId, promptLine, browserToken: result.browserToken, readExpiresAt: result.readExpiresAt };
      this.pendingStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      this.pending = pending;
      this.state = "waiting";
      return result.handoff;
    } catch {
      this.pending = null;
      this.state = "preparation-uncertain";
      throw new Error("Preparation is uncertain; do not submit again automatically");
    }
  }
  private accept(status: Status) {
    if (!this.pending || status.runId !== this.pending.runId || typeof status.conflict !== "boolean") throw new Error("uncertain");
    if (status.state === "returned") {
      const work = validateWork(status.work!);
      if (work.runId !== this.pending.runId || work.promptLine !== this.pending.promptLine) throw new Error("uncertain");
      if (this.work && JSON.stringify(this.work) !== JSON.stringify(work)) throw new Error("uncertain");
      this.work = work;
      this.conflict = status.conflict;
      this.state = readSaved(this.savedStorage).some(saved => saved.runId === work.runId) ? "saved" : "review";
    } else if (["pending", "cancelled", "rejected", "expired"].includes(status.state) && status.work === null) {
      this.state = status.state === "pending" ? "waiting" : status.state as ClientState;
    } else throw new Error("uncertain");
  }
  get canInspect() { return this.pending !== null && this.pending.readExpiresAt > Date.now(); }
  // Expose only the validated artistic line, never the recovery credential.
  get pendingPrompt() { return this.pending?.promptLine ?? null; }
  async poll() {
    // Automatic reads stop at a terminal result. Manual inspection remains
    // available for later conflicts, without an indefinite D1 polling loop.
    if (!["waiting", "uncertain"].includes(this.state)) return;
    await this.check();
  }
  async check() {
    if (!this.pending || this.checking || this.cancelling) return;
    if (!this.canInspect) {
      if (this.state !== "saved") this.state = "expired";
      return;
    }
    this.checking = true;
    const epoch = this.epoch;
    try {
      const status = await this.request(`/runs/${this.pending.runId}`, { headers: { Authorization: `Bearer ${this.pending.browserToken}` } });
      if (epoch === this.epoch) this.accept(status);
    } catch (error) {
      if (epoch === this.epoch) this.state = error instanceof Error && error.message === "expired" ? "expired" : "uncertain";
    } finally { this.checking = false; }
  }
  async cancel() {
    if (!this.pending || this.cancelling) return;
    this.cancelling = true;
    ++this.epoch;
    try {
      this.accept(await this.request(`/runs/${this.pending.runId}`, { method: "DELETE", headers: { Authorization: `Bearer ${this.pending.browserToken}` } }));
    } catch { this.state = "uncertain"; }
    finally { this.cancelling = false; }
  }
  review() {
    if (this.state !== "review" || !this.work || this.conflict) throw new Error("Work cannot be reviewed");
    this.reviewed = true;
  }
  save() {
    if (!this.work || !this.reviewed || this.conflict || this.state !== "review") throw new Error("Review first");
    const works = readSaved(this.savedStorage).filter(work => work.runId !== this.work!.runId);
    works.push(validateWork(this.work));
    writeThoughtWorks(this.savedStorage, works.map((work, index) => ({ ...storedRecord(work), id: index + 1 })), SAVED_KEY);
    this.state = "saved";
  }
  load(runId: string) {
    if (["waiting", "preparing", "uncertain", "preparation-uncertain"].includes(this.state)) throw new Error("An exchange is still active");
    const work = readSaved(this.savedStorage).find(item => item.runId === runId);
    if (!work) throw new Error("Saved work not found");
    ++this.epoch;
    this.pending = null;
    this.pendingStorage.removeItem(PENDING_KEY);
    this.work = work;
    this.conflict = false;
    this.reviewed = true;
    this.state = "saved";
  }
  reset() {
    if (["waiting", "preparing", "uncertain", "preparation-uncertain"].includes(this.state)) throw new Error("Cancel or check the pending exchange first");
    ++this.epoch;
    this.pending = null;
    this.pendingStorage.removeItem(PENDING_KEY);
    this.work = null;
    this.reviewed = false;
    this.conflict = false;
    this.state = "idle";
  }
}
