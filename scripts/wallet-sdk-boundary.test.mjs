import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const store = join(root, "node_modules/.pnpm");
function packageRoot(prefix, name) {
  const matches = readdirSync(store).filter(p => p.startsWith(prefix));
  assert.equal(matches.length, 1, `Review changed package topology: ${prefix}`);
  return join(store, matches[0], "node_modules", name);
}
const wc = packageRoot("@walletconnect+ethereum-provider@2.26.0_", "@walletconnect/ethereum-provider");
const appkit = packageRoot("@reown+appkit@1.8.19_", "@reown/appkit");
const read = file => readFileSync(file, "utf8");

test("actual SDK core entry has no embedded-auth constructor path", async () => {
  const meta = JSON.parse(read(join(appkit, "package.json")));
  assert.equal(meta.exports["./core"].import, "./dist/esm/exports/core.js");
  assert.equal(meta.exports["./core"].default, meta.exports["./core"].import);
  const core = read(join(appkit, "dist/esm/src/client/appkit-core.js"));
  const base = read(join(appkit, "dist/esm/src/client/appkit-base-client.js"));
  for (const source of [core, base]) {
    assert.doesNotMatch(source, /createAuthProvider|new W3mFrameProvider|W3mFrameProviderSingleton/);
  }
  assert.match(base, /this\.remoteFeatures = \{\}/);
  assert.match(base, /if \(!options\.basic && !options\.manualWCControl\)\s*\{\s*this\.remoteFeatures = await ConfigUtil\.fetchRemoteFeatures/);
});

test("first-party initializer through actual EthereumProvider ESM uses manual core QR mode", async () => {
  // Evaluate real module bytes with narrowly mocked imports. No SDK transport,
  // storage, browser, wallet, RPC or embedded-auth provider is instantiated.
  const captured = [];
  const mockedUniversalCalls = [];
  const signer = { session: undefined, on() {}, client: { core: { storage: { getItem: async () => undefined } } }, logger: { error() {} } };
  class BaseClient { constructor(options) { this.options = options; captured.push(options); } }
  const network = { id: 1, name: "Offline fixture", chainNamespace: "eip155", caipNetworkId: "eip155:1", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://offline.invalid"] } } };
  const stubs = {
    events: { EventEmitter },
    "@walletconnect/utils": { isValidArray: v => Array.isArray(v) && v.length > 0, getSdkError: () => ({ code: 4001, message: "fixture" }), getAccountsFromNamespaces: () => [] },
    "@walletconnect/universal-provider": { UniversalProvider: { init: async options => { mockedUniversalCalls.push(options); return signer; } } },
    "@reown/appkit/networks": { mainnet: network },
    "@reown/appkit-common": {},
    "@reown/appkit-controllers": { ChainController: {}, ConnectionController: {}, ConnectorController: {}, CoreHelperUtil: {}, OptionsController: {} },
    "@inshell/contracts": { OFFICIAL_DOMAINS: [], PUBLIC_SITE_METADATA: {}, absolutePublicAssetUrl: () => "https://offline.invalid/" },
  };
  const cache = new Map();
  const context = vm.createContext({ console, URL, EventEmitter, setTimeout: () => { throw Error("Unexpected timer"); }, fetch: () => { throw Error("Unexpected network"); } });
  function synthetic(id, values) {
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context, identifier: id });
  }
  async function load(file) {
    if (cache.has(file)) return cache.get(file);
    let source = read(file);
    if (file.endsWith(".ts")) source = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const names = new Map();
    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const spec = statement.moduleSpecifier.text;
      const required = [];
      if (statement.importClause?.name) required.push("default");
      for (const e of statement.importClause?.namedBindings?.elements || []) required.push(e.propertyName?.text || e.name.text);
      names.set(spec, required);
    }
    async function dependency(spec) {
      if (spec === "@walletconnect/ethereum-provider") return load(join(wc, "dist/index.js"));
      if (spec === "@reown/appkit/core") return load(join(appkit, "dist/esm/exports/core.js"));
      if (spec.endsWith("appkit-base-client.js")) return synthetic(spec, { AppKitBaseClient: BaseClient });
      if (spec.startsWith(".")) return load(resolve(dirname(file), spec));
      assert(spec in stubs, `Unexpected dependency must be qualified: ${spec}`);
      return synthetic(spec, Object.fromEntries([...new Set([...(names.get(spec) || []), ...Object.keys(stubs[spec])])].map(name => [name, stubs[spec][name]])));
    }
    const module = new vm.SourceTextModule(source, { context, identifier: file,
      importModuleDynamically: async spec => { const mod = await dependency(spec); if (mod.status === "unlinked") await mod.link(() => { throw Error("Unexpected synthetic import"); }); if (mod.status === "linked") await mod.evaluate(); return mod; }
    });
    cache.set(file, module);
    await module.link(dependency);
    return module;
  }
  const firstParty = await load(join(root, "packages/wallet/src/evm.ts"));
  await firstParty.evaluate();
  const provider = await firstParty.namespace.createWalletConnectEthereumProvider({ projectId: "offline-fixture", chains: [1], metadata: { name: "fixture", description: "fixture", url: "https://offline.invalid", icons: [] }, rpcMap: { 1: "https://offline.invalid" } });
  assert.equal(mockedUniversalCalls.length, 1);
  assert.equal(captured.length, 1);
  const options = captured[0];
  assert.equal(options.manualWCControl, true);
  assert.equal(options.basic, true);
  assert.equal(options.features.email, false);
  assert.equal(options.features.socials, false);
  assert.equal(options.universalProvider, signer);
  assert.equal(typeof provider.modal.open, "function");
  assert.equal(typeof provider.modal.createAuthProvider, "undefined");
  assert(![...cache.keys()].some(p => p.endsWith("/client/appkit.js")));
});
