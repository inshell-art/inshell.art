import assert from "node:assert/strict";
import test from "node:test";
import { installGa4 } from "./ga4";
import { GA4_LIFETIME_MS, GA4_PREFERENCE_KEY } from "./ga4-policy";

const env = { PROD: true, VITE_DEPLOY_ENV: "production", VITE_GA4_ENABLED: "true", VITE_GA4_MEASUREMENT_ID: "G-LOCALONLY01" };
const allow = () => JSON.stringify({ choice: "allow", version: 1, expiresAt: Date.now() + GA4_LIFETIME_MS });

// Deterministic document/storage doubles only: scripts are counted, never loaded.
function documentTab(data: Map<string, string>) {
  const writes: string[] = [], scripts = new Set<object>();
  let afterRead: (() => void) | undefined;
  let fail: "read" | "write" | "remove" | undefined;
  const storage = {
    getItem(key: string) {
      if (fail === "read") throw Error("Storage unreadable");
      const captured = data.get(key) ?? null;
      if (key === GA4_PREFERENCE_KEY && afterRead) {
        const callback = afterRead; afterRead = undefined; callback();
      }
      return captured;
    },
    setItem(key: string, value: string) {
      if (fail === "write") throw Error("Storage unwritable");
      writes.push(key); data.set(key, value);
    },
    removeItem(key: string) {
      if (fail === "remove") throw Error("Storage cannot remove");
      data.delete(key);
    },
  };
  const doc = Object.assign(new globalThis.EventTarget(), {
    referrer: "", cookie: "",
    createElement() { const script = { remove() { scripts.delete(script); } }; return script; },
    head: { append(script: object) { scripts.add(script); } },
  });
  const raw = Object.assign(new globalThis.EventTarget(), {
    document: doc, location: { href: "https://inshell.art/" }, navigator: { webdriver: false },
    localStorage: storage, history: { pushState() {}, replaceState() {} },
    setTimeout() { return 1; }, clearTimeout() {},
  });
  const win = raw as unknown as NonNullable<Parameters<typeof installGa4>[1]>;
  return { win, scripts, writes, setFailure(value: typeof fail) { fail = value; },
    interleave(callback: () => void) { afterRead = callback; },
    storageEvent(key: string) { raw.dispatchEvent(Object.assign(new globalThis.Event("storage"), { key })); },
  };
}

test("status and refresh never rewrite persisted consent or renew its expiry", () => {
  const initial = allow(), data = new Map([[GA4_PREFERENCE_KEY, initial]]);
  const tab = documentTab(data), controller = installGa4(env, tab.win);
  tab.writes.length = 0;
  controller.status(); controller.refresh(); controller.status();
  assert.deepEqual(tab.writes.filter(key => key === GA4_PREFERENCE_KEY), []);
  assert.equal(data.get(GA4_PREFERENCE_KEY), initial);
  assert.deepEqual([...data.keys()], [GA4_PREFERENCE_KEY]);
});

test("stale peer read cannot overwrite withdrawal; both documents and reload stay refused", () => {
  const data = new Map([[GA4_PREFERENCE_KEY, allow()]]);
  const main = documentTab(data), peer = documentTab(data);
  const a = installGa4(env, main.win), b = installGa4(env, peer.win);
  assert.equal(main.scripts.size, 1); assert.equal(peer.scripts.size, 1);
  let refused = "";
  // Peer captures allow; main saves reject before peer's state() continues.
  peer.interleave(() => {
    a.choose("reject"); refused = data.get(GA4_PREFERENCE_KEY)!;
    assert.equal(JSON.parse(refused).choice, "reject");
  });
  b.status();
  assert.equal(data.get(GA4_PREFERENCE_KEY), refused, "A stale reader must not restore allow");
  peer.storageEvent(GA4_PREFERENCE_KEY);
  for (const [tab, controller] of [[main, a], [peer, b]] as const) {
    controller.refresh();
    assert.equal(controller.status().choice, "reject");
    assert.equal(tab.win["ga-disable-G-LOCALONLY01" as keyof typeof tab.win], true);
    assert.equal(tab.scripts.size, 0);
  }
  const reloaded = documentTab(data);
  assert.equal(installGa4(env, reloaded.win).status().choice, "reject");
  assert.equal(reloaded.scripts.size, 0);
  assert.equal(data.get(GA4_PREFERENCE_KEY), refused);
});

test("persisted allow fails closed on read, write or probe-cleanup failure", () => {
  for (const failure of ["read", "write", "remove"] as const) {
    const initial = allow(), data = new Map([[GA4_PREFERENCE_KEY, initial]]);
    const tab = documentTab(data); tab.setFailure(failure);
    const controller = installGa4(env, tab.win);
    assert.equal(controller.status().storageOk, false, failure);
    assert.equal(tab.scripts.size, 0, failure);
    assert.equal(data.get(GA4_PREFERENCE_KEY), initial);
  }
});

test("probe storage events do not trigger feedback or modify consent", () => {
  const data = new Map([[GA4_PREFERENCE_KEY, allow()]]), tab = documentTab(data);
  installGa4(env, tab.win); tab.writes.length = 0;
  tab.storageEvent("inshell.ga4.storage-probe.v1");
  assert.deepEqual(tab.writes, []);
});

test("storage failure discovered by status immediately disables an active document", () => {
  const data = new Map([[GA4_PREFERENCE_KEY, allow()]]), tab = documentTab(data);
  const controller = installGa4(env, tab.win);
  assert.equal(tab.scripts.size, 1);
  tab.setFailure("write");
  assert.equal(controller.status().storageOk, false);
  assert.equal(tab.win["ga-disable-G-LOCALONLY01" as keyof typeof tab.win], true);
  assert.equal(tab.scripts.size, 0);
});
