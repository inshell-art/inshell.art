import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_AGENT_RUN_AUTHORITY,
  buildThoughtClaudeOperationContract,
  buildThoughtCodexOperationContract,
  sha256Hex,
} from "../packages/thought-agent-protocol/src/index";

const pageUrl = (() => {
  const url = new URL(
    process.env.THOUGHT_BROWSER_CANARY_URL || "http://127.0.0.1:5185/thought/",
  );
  if (!url.searchParams.has("surface")) {
    url.searchParams.set("surface", "agent");
  }
  return url.toString();
})();
const timeoutMs = Number(process.env.THOUGHT_BROWSER_CANARY_TIMEOUT_MS || 45_000);
const adapterId = process.env.THOUGHT_BROWSER_CANARY_AGENT === "codex" ? "codex" : "claude";
const product = adapterId === "codex" ? "Codex" : "Claude";
const provider = adapterId === "codex" ? "codex" : "anthropic";
const agentActionLabel = adapterId === "codex"
  ? "open this THOUGHT task in Codex within the ChatGPT desktop app"
  : "open this THOUGHT task in Claude Code";
const screenshotPath = process.env.THOUGHT_BROWSER_CANARY_SCREENSHOT ||
  path.join(os.tmpdir(), `thought-${adapterId}-browser-release-canary.png`);
const promptLine = "Can one release remain one release?";

const installBrowserReleaseCanaryFunction = `function (promptLine) {
  window.__thoughtBrowserReleaseCanary = { create: null, launchUrl: "", statusStates: [] };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method === "POST" && /\\/api\\/thought-agent\\/v2\\/runs$/.test(new URL(url, location.href).pathname)) {
        window.__thoughtBrowserReleaseCanary.create = await response.clone().json();
      }
      if (method === "GET" && /\\/api\\/thought-agent\\/v2\\/runs\\/tar_[^/]+$/.test(new URL(url, location.href).pathname)) {
        const status = await response.clone().json();
        window.__thoughtBrowserReleaseCanary.statusStates.push(status.state || "unknown");
      }
    } catch (error) {
      window.__thoughtBrowserReleaseCanary.captureError = String(error);
    }
    return response;
  };
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (/^(?:claude|codex):/.test(this.href)) {
      window.__thoughtBrowserReleaseCanary.launchUrl = this.href;
      return;
    }
    return originalAnchorClick.call(this);
  };
  const prompt = document.querySelector("#thought-dock-prompt");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(prompt, promptLine);
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}`;

const hasAgentActionFunction = `function (agentActionLabel) {
  return [...document.querySelectorAll("button")].some((node) =>
    node.getAttribute("aria-label") === agentActionLabel &&
    node.getBoundingClientRect().width > 0 &&
    node.getBoundingClientRect().height > 0 &&
    getComputedStyle(node).display !== "none" &&
    getComputedStyle(node).visibility !== "hidden"
  );
}`;

const clickAgentActionFunction = `function (agentActionLabel, product) {
  const button = [...document.querySelectorAll("button")].find((node) =>
    node.getAttribute("aria-label") === agentActionLabel &&
    node.getBoundingClientRect().width > 0 &&
    node.getBoundingClientRect().height > 0 &&
    getComputedStyle(node).display !== "none" &&
    getComputedStyle(node).visibility !== "hidden"
  );
  if (!button) throw new Error(String(product) + " action not found.");
  button.click();
  return true;
}`;

const chromePath = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
].find((candidate) => fs.existsSync(candidate));

if (!chromePath) {
  throw new Error("Chrome/Chromium is required for the browser release canary.");
}

type CdpClient = {
  send(method: string, params?: Record<string, unknown>): Promise<any>;
  on(method: string, listener: (params: any) => void): void;
  close(): void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
};

const makeClient = (webSocketUrl: string): Promise<CdpClient> => new Promise((resolve, reject) => {
  const socket = new globalThis.WebSocket(webSocketUrl);
  let id = 0;
  const pending = new Map<number, {
    resolve(value: unknown): void;
    reject(error: Error): void;
    method: string;
  }>();
  const listeners = new Map<string, Array<(params: unknown) => void>>();

  socket.onopen = () => resolve({
    send(method, params = {}) {
      const callId = ++id;
      socket.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolveCall, rejectCall) => {
        pending.set(callId, { resolve: resolveCall, reject: rejectCall, method });
      });
    },
    on(method, listener) {
      const current = listeners.get(method) ?? [];
      current.push(listener);
      listeners.set(method, current);
    },
    close() {
      socket.close();
    },
  });
  socket.onerror = () => reject(new Error("Could not connect to Chrome DevTools."));
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const call = pending.get(message.id)!;
      pending.delete(message.id);
      if (message.error) call.reject(new Error(`${call.method}: ${message.error.message}`));
      else call.resolve(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) {
      listener(message.params);
    }
  };
});

const evaluate = async <T>(client: CdpClient, expression: string): Promise<T> => {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || "Browser evaluation failed.");
  }
  return response.result.value as T;
};

const getBrowserGlobalObjectId = async (client: CdpClient): Promise<string> => {
  const response = await client.send("Runtime.evaluate", {
    expression: "globalThis",
    objectGroup: "thought-browser-release-canary",
    returnByValue: false,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || "Browser evaluation failed.");
  }
  const objectId = response.result?.objectId;
  if (typeof objectId !== "string" || objectId.length === 0) {
    throw new Error("Browser global object is unavailable.");
  }
  return objectId;
};

const callFunctionOn = async <T>(
  client: CdpClient,
  objectId: string,
  functionDeclaration: string,
  argumentValues: unknown[] = [],
): Promise<T> => {
  const response = await client.send("Runtime.callFunctionOn", {
    objectId,
    functionDeclaration,
    arguments: argumentValues.map((value) => ({ value })),
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || "Browser function call failed.");
  }
  return response.result.value as T;
};

const waitForValue = async <T>(
  load: () => Promise<T>,
  accept: (value: T) => boolean,
  label: string,
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await load();
    if (accept(value)) return value;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};

const waitFor = async <T>(
  client: CdpClient,
  expression: string,
  accept: (value: T) => boolean,
  label: string,
): Promise<T> => waitForValue(() => evaluate<T>(client, expression), accept, label);

type ProtocolError = { error?: { code?: string; message?: string } };

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = JSON.parse(text) as T & ProtocolError;
  assert.equal(
    response.ok,
    true,
    `${response.status} ${payload.error?.code ?? "HTTP_ERROR"}: ${payload.error?.message ?? "request failed"}`,
  );
  return payload;
};

const capsuleValue = (handoff: string, key: string) => {
  const match = handoff.match(new RegExp(`^<${key}> = (.+)$`, "m"));
  assert.ok(match, `browser handoff is missing <${key}>`);
  return match[1].trim();
};

const nestedValuesForKey = (value: unknown, key: string): unknown[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => nestedValuesForKey(entry, key));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([entryKey, entryValue]) => [
    ...(entryKey === key
      ? [entryValue && typeof entryValue === "object" && "const" in entryValue
        ? (entryValue as { const: unknown }).const
        : entryValue]
      : []),
    ...nestedValuesForKey(entryValue, key),
  ]);
};

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "thought-browser-canary-"));
const port = 14_000 + Math.floor(Math.random() * 2_000);
const chrome = spawn(chromePath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let chromeStderr = "";
chrome.stderr.on("data", (chunk) => {
  chromeStderr += chunk.toString();
});

let client: CdpClient | null = null;
let created: {
  runId: string;
  browserToken: string;
  statusUrl: string;
  launchUri: string;
  release: { protocolReleaseId: `0x${string}`; manifestKeccak256: `0x${string}` };
  controlContract?: {
    schema?: string;
    mode?: string;
    claimCreativeInput?: string;
    creativeInputEndpoint?: string;
  };
  resultContract?: {
    workProfile: string;
    lineValidation: "terminal-english-64";
    declarationLabelField?: "agentLabel" | "label";
  };
} | null = null;
let terminal = false;

try {
  const devtoolsDeadline = Date.now() + 10_000;
  while (Date.now() < devtoolsDeadline) {
    try {
      await getJson(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await sleep(100);
    }
  }
  if (Date.now() >= devtoolsDeadline) {
    throw new Error(`Chrome DevTools did not start. ${chromeStderr}`);
  }

  const target = await getJson(`http://127.0.0.1:${port}/json/new`, { method: "PUT" }) as {
    webSocketDebuggerUrl: string;
  };
  client = await makeClient(target.webSocketDebuggerUrl);
  const requests: Array<{ url: string; method: string; status: number | null }> = [];
  const requestIndex = new Map<string, number>();
  client.on("Network.requestWillBeSent", (event) => {
    requestIndex.set(event.requestId, requests.length);
    requests.push({
      url: event.request?.url ?? "",
      method: event.request?.method ?? "",
      status: null,
    });
  });
  client.on("Network.responseReceived", (event) => {
    const index = requestIndex.get(event.requestId);
    if (index !== undefined) requests[index].status = event.response.status;
  });

  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Page.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Page.navigate", { url: pageUrl });
  await waitFor(
    client,
    `document.readyState === "complete" && document.documentElement.classList.contains("agent-surface") && document.querySelector("#thought-dock-prompt")?.getBoundingClientRect().width > 0`,
    Boolean,
    "THOUGHT creation UI",
  );

  const browserGlobalObjectId = await getBrowserGlobalObjectId(client);
  await callFunctionOn<boolean>(
    client,
    browserGlobalObjectId,
    installBrowserReleaseCanaryFunction,
    [promptLine],
  );

  await evaluate(client, `(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      node.getAttribute("aria-label") === "run this THOUGHT with your Agent" &&
      node.getBoundingClientRect().width > 0 &&
      node.getBoundingClientRect().height > 0 &&
      getComputedStyle(node).display !== "none" &&
      getComputedStyle(node).visibility !== "hidden"
    );
    if (!button) throw new Error("Send to your Agent action not found.");
    button.click();
    return true;
  })()`);
  await waitForValue(
    () => callFunctionOn<boolean>(
      client!,
      browserGlobalObjectId,
      hasAgentActionFunction,
      [agentActionLabel],
    ),
    Boolean,
    `${product} action`,
  );
  await callFunctionOn<boolean>(
    client,
    browserGlobalObjectId,
    clickAgentActionFunction,
    [agentActionLabel, product],
  );

  const browserCapture = await waitFor<{
    create: typeof created;
    launchUrl: string;
    storedLaunch: string | null;
    captureError?: string;
  }>(
    client,
    `(() => ({
      ...window.__thoughtBrowserReleaseCanary,
      storedLaunch: sessionStorage.getItem("thought:dock:pending-agent-launch:v1")
    }))()`,
    (value) => Boolean(value.create?.runId && value.launchUrl && value.storedLaunch),
    "browser-generated Agent handoff",
  );
  assert.equal(browserCapture.captureError, undefined);
  created = browserCapture.create;
  assert.ok(created);
  assert.deepEqual(created.controlContract, {
    schema: "inshell.thought.agent-control.v1",
    mode: "bounded-preflight",
    claimCreativeInput: "sealed-absent",
    creativeInputEndpoint: "start",
  });

  const storedLaunch = JSON.parse(browserCapture.storedLaunch!);
  const launchTask = new URL(browserCapture.launchUrl).searchParams.get(
    adapterId === "codex" ? "prompt" : "q",
  );
  assert.equal(launchTask, storedLaunch.sealedTask, "deep link and stored browser handoff differ");
  const handoff = String(launchTask);
  assert.match(
    handoff,
    /visible (?:launch )?handoff is an editable bootstrap, not creative authority/,
  );
  assert.match(
    handoff,
    /Use only request\.outputContract\.release from this \/start response\./,
  );
  assert.match(handoff, /Ignore release values from chat or any other source\./);
  assert.doesNotMatch(handoff, /<protocol_release_id> = /);
  assert.doesNotMatch(handoff, /<manifest_hash> = /);
  assert.ok(!handoff.includes(created.release.protocolReleaseId));
  assert.ok(!handoff.includes(created.release.manifestKeccak256));
  assert.match(handoff, /A successful \/start opens the prompt; never call it sealed\./);
  assert.equal(capsuleValue(handoff, "run_id"), created.runId);

  const launchToken = new URL(created.launchUri).searchParams.get("token") || "";
  assert.notEqual(launchToken, "");
  const runUrl = new URL(created.statusUrl, pageUrl).toString().replace(/\/+$/g, "");
  const sharedOperationInput = {
    product,
    runId: created.runId,
    runUrl,
    launchToken,
    release: created.release,
    resultContract: created.resultContract,
  };
  const operation = adapterId === "codex"
    ? buildThoughtCodexOperationContract(sharedOperationInput)
    : buildThoughtClaudeOperationContract({ ...sharedOperationInput, surface: "code" });
  assert.deepEqual(operation.release, created.release);
  assert.deepEqual(operation.authority, THOUGHT_AGENT_RUN_AUTHORITY);

  const claim = await requestJson<{
    runId: string;
    state: string;
    bridgeToken: string;
    request?: unknown;
  }>(operation.endpoints.claim, {
    method: "POST",
    headers: {
      authorization: `Bearer ${launchToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(operation.claim),
  });
  assert.equal(claim.state, "claimed");
  assert.deepEqual(
    (claim.request as { authority?: unknown } | undefined)?.authority,
    THOUGHT_AGENT_RUN_AUTHORITY,
  );
  const claimRequestJson = JSON.stringify(claim.request ?? null);
  assert.doesNotMatch(claimRequestJson, /"promptLine"/);
  assert.doesNotMatch(claimRequestJson, /"agentInput"/);
  assert.doesNotMatch(claimRequestJson, /"instructions"/);
  assert.doesNotMatch(claimRequestJson, /"spec"/);

  const ready = await requestJson<{ state: string; stage: string }>(operation.endpoints.ready, {
    method: "POST",
    headers: {
      authorization: `Bearer ${claim.bridgeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(operation.ready),
  });
  assert.equal(ready.state, "ready");
  assert.equal(ready.stage, "control-verified");

  const startedAt = new Date().toISOString();
  const started = await requestJson<{
    state: string;
    request?: {
      intent?: string;
      spec?: {
        id?: string;
        contractSpecId?: string;
        text?: string;
        sha256?: string;
      };
      instructions?: { text?: string; sha256?: string };
      promptLine?: { text?: string; sha256?: string };
      agentInput?: { text?: string; sha256?: string };
      outputContract?: {
        release?: {
          protocolReleaseId?: string;
          manifestKeccak256?: string;
        };
        authority?: unknown;
        agentLine?: { workProfile?: string };
        schema?: unknown;
      };
    };
  }>(operation.endpoints.start, {
    method: "POST",
    headers: {
      authorization: `Bearer ${claim.bridgeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      invocationId: operation.invocationId,
      startedAt,
    }),
  });
  assert.equal(started.state, "running");
  assert.equal(started.request?.intent, "generate-thought-candidate");
  assert.deepEqual(started.request?.authority, THOUGHT_AGENT_RUN_AUTHORITY);
  assert.equal(started.request?.promptLine?.text, promptLine);
  assert.equal(started.request?.agentInput?.text, promptLine);
  assert.equal(started.request?.promptLine?.sha256, await sha256Hex(promptLine));
  assert.equal(started.request?.agentInput?.sha256, await sha256Hex(promptLine));
  assert.equal(started.request?.spec?.sha256, await sha256Hex(String(started.request?.spec?.text)));
  assert.equal(
    started.request?.instructions?.sha256,
    await sha256Hex(String(started.request?.instructions?.text)),
  );
  assert.equal(started.request?.spec?.id, started.request?.spec?.contractSpecId);
  assert.notEqual(started.request?.spec?.text, started.request?.instructions?.text);
  assert.notEqual(started.request?.spec?.sha256, started.request?.instructions?.sha256);
  assert.equal(
    started.request?.outputContract?.agentLine?.workProfile,
    capsuleValue(handoff, "work_profile"),
  );
  assert.deepEqual(
    started.request?.outputContract?.release,
    created.release,
    "created run and exact /start outputContract.release differ",
  );
  for (const value of nestedValuesForKey(started.request, "protocolReleaseId")) {
    assert.equal(value, created.release.protocolReleaseId, "a /start protocolReleaseId field drifted");
  }
  for (const value of nestedValuesForKey(started.request, "manifestKeccak256")) {
    assert.equal(value, created.release.manifestKeccak256, "a /start manifestKeccak256 field drifted");
  }

  const agentLine = "One run should carry one release throughout.";
  const raw = JSON.stringify({
    schema: THOUGHT_AGENT_RESULT_VERSION,
    release: created.release,
    agentLine,
    declaration: {
      schema: "inshell.thought.agent-declaration.v1",
      status: "declared-unverified",
      label: product,
      declaredOneCreativeResult: true,
    },
  });
  const completedAt = new Date(Math.max(Date.now(), Date.parse(startedAt))).toISOString();
  const returned = await requestJson<{ state: string; result?: { agentLine?: string } }>(operation.endpoints.result, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${claim.bridgeToken}`,
      "content-type": "application/json",
      "idempotency-key": operation.invocationId,
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      invocationId: operation.invocationId,
      bridge: operation.bridge,
      adapter: operation.adapter,
      agent: {
        product,
        provider,
        model: `${adapterId}-browser-release-canary`,
        metadataSource: "reported",
      },
      execution: operation.execution,
      startedAt,
      completedAt,
      output: {
        mediaType: "application/json",
        raw,
        rawSha256: await sha256Hex(raw),
        agentLine,
        agentLineSha256: await sha256Hex(agentLine),
      },
    }),
  });
  assert.equal(returned.state, "returned");
  assert.equal(returned.result?.agentLine, agentLine);
  terminal = true;

  await waitFor(
    client,
    `window.__thoughtBrowserReleaseCanary.statusStates.includes("returned")`,
    Boolean,
    "browser polling of the returned run",
  );
  await waitFor(
    client,
    `(() => {
      const image = document.querySelector("#thought-svg-preview");
      return Boolean(
        image &&
        !image.classList.contains("is-hidden") &&
        image.getAttribute("src")?.startsWith("data:image/svg+xml")
      );
    })()`,
    Boolean,
    "browser contract-rendered preview of the returned work",
  );
  const dom = await evaluate<{
    workVisible: boolean;
    consoleEntries: number;
    actionLabels: string[];
    statusStates: string[];
  }>(client, `(() => {
    const image = document.querySelector("#thought-svg-preview");
    return ({
      workVisible: Boolean(
        image &&
        !image.classList.contains("is-hidden") &&
        image.getAttribute("src")?.startsWith("data:image/svg+xml")
      ),
      consoleEntries: document.querySelectorAll("#thought-dock-details-body > *").length,
      actionLabels: [...document.querySelectorAll("#thought-dock-action-area button")].map((node) => node.textContent.trim()),
      statusStates: [...window.__thoughtBrowserReleaseCanary.statusStates]
    });
  })()`);
  assert.equal(dom.statusStates.includes("returned"), true);
  assert.equal(dom.workVisible, true);

  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

  console.log(JSON.stringify({
    runId: created.runId,
    adapterId,
    state: returned.state,
    release: created.release,
    parity: {
      createToBrowserHandoff: true,
      browserHandoffToStart: true,
      creativeBindings: true,
      boundedControlClaim: true,
      everyReleaseField: true,
      startToResult: true,
    },
    dom,
    failedNetworkRequests: requests.filter((request) =>
      request.status === null || request.status >= 400
    ),
    screenshotPath,
  }, null, 2));
} finally {
  if (created && !terminal) {
    const runUrl = new URL(created.statusUrl, pageUrl).toString().replace(/\/+$/g, "");
    await fetch(`${runUrl}/cancel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${created.browserToken}`,
        "content-type": "application/json",
      },
      body: "{}",
    }).catch(() => {});
  }
  client?.close();
  chrome.kill("SIGTERM");
  await sleep(300);
  fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
