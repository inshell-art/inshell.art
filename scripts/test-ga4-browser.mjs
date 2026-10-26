// Local substitutes only. ALL browser requests are fulfilled or aborted here.
// This verifies our contract, not Google SDK behavior, ingestion or retention.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const { build } = await import(require.resolve("esbuild", { paths: [dirname(require.resolve("tsx/package.json"))] }));
const root = process.cwd();
const enabledBuild = process.env.GA4_BROWSER_ENABLED === 'true';
const buildRoot = resolve(root, enabledBuild ? 'dist/ga4-fixture' : 'dist/home');
const output = resolve(root, process.env.GA4_BROWSER_OUTPUT_DIR || (enabledBuild ? "tmp/ga4-enabled-local-check" : "tmp/ga4-local-check"));
await mkdir(output, { recursive: true });
await build({ stdin: { contents: `import { mountGa4Choice } from './packages/shared/src/ga4-ui';
window.addEventListener('DOMContentLoaded',()=>mountGa4Choice(window.fixtureEnv));`, resolveDir: root, loader: "ts" },
  bundle: true, outfile: `${output}/fixture.js`, format: "iife" });
const fixture = { PROD: true, VITE_DEPLOY_ENV: "production", VITE_GA4_ENABLED: "true", VITE_GA4_MEASUREMENT_ID: "G-LOCALONLY01" };
const pref = "inshell.ga4.preference.v1", excluded = "inshell.ga4.excluded.v1";
const fixtureHtml = `<!doctype html><html><head><meta name="referrer" content="no-referrer"><title>private-title-SENTINEL</title>
<link rel="stylesheet" href="/fixture.css"><style>:root{--inshell-text:#111;--inshell-panel:#fff;--inshell-font-mono:monospace;--font-size-14:14px;--weight-mid:400}body{margin:0}main{min-height:60vh;padding:20px}</style></head>
<body><main><h1>Local consent fixture</h1><textarea id="work">unsaved-SENTINEL</textarea></main><script src="/fixture.js"></script></body></html>`;
const vendor = `(()=>{const q=window.inshellGa4Layer;let context={},configuration={};
function send(name,values={}){if(window['ga-disable-G-LOCALONLY01'])return;
fetch('https://www.google-analytics.com/g/collect',{method:'POST',body:JSON.stringify({name,...context,...values}),keepalive:true});}
function consume(args){const [action,name,value]=Array.from(args);
if(action==='set')context={...context,...name};
if(action==='config'){configuration={...configuration,...value};context={...context,...value};
if(!window['ga-disable-G-LOCALONLY01'])document.cookie='inshell_ga4_ga=fixture;Secure;SameSite=Lax;Path=/';}
if(action==='event')send(name,value);}
const pending=q.slice();q.length=0;q.push=(...items)=>{items.forEach(consume);return 0;};pending.forEach(consume);
window.vendorAutomatic=()=>send('user_engagement',{page_location:context.page_location||location.href,page_title:context.page_title||document.title,page_referrer:context.page_referrer??document.referrer});
window.vendorConfig=()=>configuration;window.vendorAutomatic();})();`;
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const results = [], contexts = [];
async function setup({ env = fixture, stored, exclusion, failure, actual = false, noChannel = false, holdVendor = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(10000);
  contexts.push(context);
  const events = [], unexpected = [], errors = [], scripts = [];
  let releaseVendor;
  const vendorReady = new Promise(resolve=>{releaseVendor=resolve;});
  if(!holdVendor) releaseVendor();
  await context.addInitScript(({ env, stored, exclusion, failure, noChannel }) => {
    window.fixtureEnv = env;
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    if(noChannel) window.BroadcastChannel=undefined;
    if (!sessionStorage.getItem("fixture-initialized")) {
      if (stored) localStorage.setItem("inshell.ga4.preference.v1", JSON.stringify(stored));
      if (exclusion) localStorage.setItem("inshell.ga4.excluded.v1", "1");
      sessionStorage.setItem("fixture-initialized", "1");
    }
    localStorage.setItem("inshell.thought.saved.fixture", "saved-SENTINEL");
    document.cookie = "unrelated=keep;Path=/;Secure";
    if (failure === "read") Object.defineProperty(window, "localStorage", { get() { throw Error("blocked"); } });
    if (failure === "write") Storage.prototype.setItem = function () { throw Error("blocked"); };
    if (failure === "remove") Storage.prototype.removeItem = function () { throw Error("blocked"); };
  }, { env, stored, exclusion, failure, noChannel });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "www.googletagmanager.com") {
      assert.equal(url.searchParams.get("id"), "G-LOCALONLY01"); scripts.push(url.pathname);
      await vendorReady;
      return route.fulfill({ contentType: "application/javascript", body: vendor });
    }
    if (url.hostname === "www.google-analytics.com") {
      events.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    if (url.origin !== "https://inshell.art") { unexpected.push(url.origin); return route.abort(); }
    if (!actual) {
      if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "application/javascript", body: await readFile(`${output}/fixture.js`, "utf8") });
      if (url.pathname === "/fixture.css") return route.fulfill({ contentType: "text/css", body: await readFile(`${output}/fixture.css`, "utf8") });
      return route.fulfill({ contentType: "text/html", body: fixtureHtml });
    }
    if (url.pathname === '/api/thought-plain/v1/capabilities') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({schema:'inshell.thought.plain-capabilities.v1',enabled:true,mintEligible:false}) });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"offline fixture"}' });
    let file = resolve(buildRoot, `.${url.pathname}`);
    if (route.request().resourceType() === "document") file = resolve(buildRoot, url.pathname.replace(/\/$/, "") === "/thought" ? "thought/index.html" : "index.html");
    if (!file.startsWith(buildRoot)) return route.abort();
    try {
      const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
      return route.fulfill({ contentType: types[extname(file)] ?? "application/octet-stream", body: await readFile(file) });
    } catch { unexpected.push(url.pathname); return route.fulfill({ status: 404, body: "offline missing" }); }
  });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  return { context, page, events, unexpected, errors, scripts, releaseVendor };
}
const settle = async page => { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.waitForTimeout(75); };
const allow = async page => { await page.getByRole("button", { name: "Allow Google Analytics", exact: true }).click(); await settle(page); };
try {
  for (const [name, options] of [
    ["unknown", {}], ["rejected", { stored: { choice: "reject", version: 1, expiresAt: Date.now()+86400000 } }],
    ["expired", { stored: { choice: "allow", version: 1, expiresAt: Date.now()-1 } }],
    ["unreadable-storage", { failure: "read" }], ["write-failure", { failure: "write" }],
    ["persisted-allow-write-failure", { stored: { choice: "allow", version: 1, expiresAt: Date.now()+86400000 }, failure: "write" }],
    ["persisted-allow-cleanup-failure", { stored: { choice: "allow", version: 1, expiresAt: Date.now()+86400000 }, failure: "remove" }],
    ["excluded", { exclusion: true }], ["missing-id", { env: { ...fixture, VITE_GA4_MEASUREMENT_ID: "" } }],
    ["preview", { env: { ...fixture, VITE_DEPLOY_ENV: "preview" } }], ["ci", { env: { ...fixture, VITE_GA4_TEST: "true" } }],
  ]) {
    const x = await setup(options); await x.page.goto("https://inshell.art/"); await settle(x.page);
    if (options.failure) {
      await x.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
      assert.equal(await x.page.getByRole('button',{name:'Allow Google Analytics',exact:true}).isDisabled(),true);
      assert.equal(await x.page.evaluate(()=>window.__inshellGa4.status().storageOk),false);
    }
    assert.equal(x.scripts.length, 0, name); assert.equal(x.events.length, 0, name);
    assert.equal((await x.context.cookies()).some(c => c.name.startsWith("inshell_ga4")), false, name);
    assert.equal(await x.page.locator('link[rel="preconnect"]').count(), 0);
    assert.deepEqual(x.errors, []); results.push({ name, pass: true }); await x.context.close();
  }
  const failedGrant=await setup(); await failedGrant.page.goto('https://inshell.art/'); await settle(failedGrant.page);
  await failedGrant.page.evaluate(()=>{Storage.prototype.setItem=function(){throw Error('blocked');};});
  await allow(failedGrant.page);
  assert.equal(failedGrant.scripts.length,0); assert.equal(failedGrant.events.length,0);
  assert.equal(await failedGrant.page.evaluate(()=>window.__inshellGa4.status().storageOk),false);
  results.push({name:'grant-persistence-failure-after-initial-probe',pass:true}); await failedGrant.context.close();
  const x = await setup(); await x.page.goto("https://inshell.art/?utm_source=private-SENTINEL#secret-SENTINEL"); await settle(x.page);
  await allow(x.page); assert.equal(x.scripts.length, 1);
  assert.equal(x.events.filter(e=>e.name==="page_view").length, 1);
  for (const target of ["/docs/agent-art", "/docs/agent-art#section", "/docs/agent-art?q=private-SENTINEL", "/", "/thought", "/gallery", "/thought/123456789", "/thought/987654321"]) {
    await x.page.evaluate(path => history.pushState({}, "", path), target); await settle(x.page);
    await x.page.evaluate(()=>window.vendorAutomatic());
  }
  assert.equal(x.events.filter(e=>e.name==="page_view").length, 7);
  assert.doesNotMatch(JSON.stringify(x.events), /SENTINEL|utm_|secret|123456789|987654321|\?|#/);
  const config = await x.page.evaluate(()=>window.vendorConfig());
  assert.equal(config.cookie_domain,"none"); assert.equal(config.cookie_update,false);
  assert.equal(config.cookie_expires,7776000); assert.equal(config.send_page_view,false);
  assert.equal(config.allow_google_signals,false); assert.equal(config.allow_ad_personalization_signals,false);
  // A second document models the separate Home/THOUGHT bundles with same-origin storage.
  const other = await x.context.newPage(); await other.goto("https://inshell.art/thought"); await settle(other);
  const before = x.events.length;
  await x.page.getByRole("button",{name:"Analytics settings",exact:true}).click();
  await x.page.getByRole("button",{name:"Withdraw Google Analytics permission",exact:true}).click();
  await settle(other);
  for(const page of [x.page,other]) {
    assert.equal(await page.evaluate(()=>window['ga-disable-G-LOCALONLY01']),true);
    await page.evaluate(()=>window.vendorAutomatic());
    assert.equal(await page.evaluate(()=>localStorage.getItem("inshell.thought.saved.fixture")),"saved-SENTINEL");
    assert.equal(await page.locator("#work").inputValue(),"unsaved-SENTINEL");
  }
  await settle(x.page); assert.equal(x.events.length,before);
  assert.equal((await x.context.cookies()).some(c=>c.name.startsWith("inshell_ga4")),false);
  assert.equal((await x.context.cookies()).find(c=>c.name==="unrelated")?.value,"keep");
  await x.page.reload(); await settle(x.page); assert.equal(x.scripts.length,2);
  results.push({name:"consent-route-sanitization-cross-tab-withdrawal",pass:true,explicitViews:8,realGoogleRequests:0});
  await x.context.close();

  const y = await setup(); await y.page.goto("https://inshell.art/"); await allow(y.page);
  const y2=await y.context.newPage(); await y2.goto("https://inshell.art/thought"); await settle(y2);
  await y.page.getByRole("button",{name:"Analytics settings",exact:true}).click();
  await y.page.getByRole("button",{name:"Exclude this browser",exact:true}).click(); await settle(y2);
  assert.equal(await y2.evaluate(()=>window['ga-disable-G-LOCALONLY01']),true);
  await y2.reload(); await settle(y2); assert.equal(y.scripts.length,2);
  assert.equal(await y2.evaluate(key=>localStorage.getItem(key),excluded),"1");
  results.push({name:"persistent-cross-tab-exclusion",pass:true}); await y.context.close();

  const z=await setup(); await z.page.goto("https://inshell.art/"); await allow(z.page);
  const n=z.events.length; await z.page.evaluate(()=>history.pushState({},"","/api/private-SENTINEL"));
  await z.page.evaluate(()=>window.vendorAutomatic()); await settle(z.page);
  assert.equal(z.events.length,n); assert.equal(await z.page.evaluate(()=>window['ga-disable-G-LOCALONLY01']),true);
  results.push({name:"excluded-spa-route-native-disable",pass:true}); await z.context.close();

  const expiry=await setup({stored:{choice:"allow",version:1,expiresAt:Date.now()+2000}});
  await expiry.page.goto('https://inshell.art/'); await settle(expiry.page); assert.equal(expiry.scripts.length,1);
  await expiry.page.waitForFunction(()=>window['ga-disable-G-LOCALONLY01']===true);
  assert.equal((await expiry.context.cookies()).some(c=>c.name.startsWith('inshell_ga4')),false);
  results.push({name:'active-consent-expiry',pass:true}); await expiry.context.close();

  const reload=await setup(); await reload.page.goto('https://inshell.art/'); await allow(reload.page);
  await reload.page.reload(); await settle(reload.page); assert.equal(reload.scripts.length,2);
  assert.equal(reload.events.filter(e=>e.name==='page_view').length,2);
  // Clear-all storage events revoke; unrelated work storage is never cleared by the controller.
  await reload.page.evaluate(key=>{localStorage.removeItem(key);window.dispatchEvent(new StorageEvent('storage',{key:null}));},pref);
  assert.equal(await reload.page.evaluate(()=>window['ga-disable-G-LOCALONLY01']),true);
  assert.equal(await reload.page.evaluate(()=>localStorage.getItem('inshell.thought.saved.fixture')),'saved-SENTINEL');
  results.push({name:'allowed-refresh-and-storage-clear-revocation',pass:true}); await reload.context.close();

  const race=await setup({holdVendor:true}); await race.page.goto('https://inshell.art/'); await allow(race.page);
  await race.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
  await race.page.getByRole('button',{name:'Reject Google Analytics',exact:true}).click();
  race.releaseVendor(); await settle(race.page); assert.equal(race.events.length,0);
  assert.equal((await race.context.cookies()).some(c=>c.name.startsWith('inshell_ga4')),false);
  results.push({name:'late-sdk-after-withdrawal-no-replay',pass:true}); await race.context.close();

  const storageOnly=await setup({noChannel:true}); await storageOnly.page.goto('https://inshell.art/'); await allow(storageOnly.page);
  const peer=await storageOnly.context.newPage(); await peer.goto('https://inshell.art/thought'); await settle(peer);
  await storageOnly.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
  await storageOnly.page.getByRole('button',{name:'Reject Google Analytics',exact:true}).click();
  await peer.waitForFunction(()=>window['ga-disable-G-LOCALONLY01']===true);
  results.push({name:'storage-event-withdrawal-without-broadcast-channel',pass:true}); await storageOnly.context.close();

  for (const noChannel of [false, true]) {
    const stale = await setup({noChannel});
    await stale.page.goto('https://inshell.art/'); await allow(stale.page);
    const stalePeer = await stale.context.newPage();
    await stalePeer.goto('https://inshell.art/thought'); await settle(stalePeer);
    // Hold the value from the peer's read, then withdraw in the other real tab.
    const captured = await stalePeer.evaluate(key => localStorage.getItem(key), pref);
    const count = stale.events.length;
    await stale.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
    await stale.page.getByRole('button',{name:'Withdraw Google Analytics permission',exact:true}).click();
    await stalePeer.waitForFunction(()=>window['ga-disable-G-LOCALONLY01']===true);
    const refusal = await stale.page.evaluate(key => localStorage.getItem(key), pref);
    assert.equal(JSON.parse(refusal).choice, 'reject');
    // Resume a stale read deterministically; do not rely on probabilistic timing.
    await stalePeer.evaluate(({pref,captured}) => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key) {
        if(this === localStorage && key === pref) {
          Storage.prototype.getItem = original;
          return captured;
        }
        return original.call(this,key);
      };
      window.__inshellGa4.status();
    }, {pref,captured});
    assert.equal(await stalePeer.evaluate(key=>localStorage.getItem(key),pref),refusal);
    for(const page of [stale.page,stalePeer]) {
      await page.evaluate(()=>{window.__inshellGa4.refresh();window.vendorAutomatic();});
      assert.equal(await page.evaluate(()=>window.__inshellGa4.status().choice),'reject');
      assert.equal(await page.locator('#work').inputValue(),'unsaved-SENTINEL');
      assert.equal(await page.evaluate(()=>localStorage.getItem('inshell.thought.saved.fixture')),'saved-SENTINEL');
      await page.reload(); await settle(page);
      assert.equal(await page.evaluate(()=>window['ga-disable-G-LOCALONLY01']),true);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),pref),refusal);
    }
    const next = await stale.context.newPage(); await next.goto('https://inshell.art/gallery'); await settle(next);
    assert.equal(await next.evaluate(()=>window.__inshellGa4.status().choice),'reject');
    assert.equal(await next.evaluate(()=>localStorage.getItem('inshell.ga4.storage-probe.v1')),null);
    assert.equal(stale.scripts.length,2); assert.equal(stale.events.length,count);
    assert.equal((await stale.context.cookies()).some(c=>c.name.startsWith('inshell_ga4')),false);
    results.push({name:`stale-peer-refusal-both-reloads-next-document-channel-${!noChannel}`,pass:true});
    await stale.context.close();
  }

  const ui=await setup(); await ui.page.goto("https://inshell.art/");
  await ui.page.getByText('Google Analytics notice',{exact:true}).click();
  assert.match(await ui.page.locator('details').innerText(),/client cookie has a fixed expiry/);
  assert.match(await ui.page.locator('details').innerText(),/session cookie can renew/);
  await ui.page.getByText('Google Analytics notice',{exact:true}).click();
  for(const [width,height] of [[1280,900],[390,844]]) {
    await ui.page.setViewportSize({width,height}); await settle(ui.page);
    const metrics=await ui.page.evaluate(()=>{
      const p=document.querySelector('#inshell-ga4-panel').getBoundingClientRect();
      const buttons=[...document.querySelectorAll('.inshell-ga4-actions button')].map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}));
      return {overflow:document.documentElement.scrollWidth>innerWidth,panel:{x:p.x,y:p.y,right:p.right,bottom:p.bottom},buttons};
    });
    assert.equal(metrics.overflow,false); assert.ok(metrics.panel.x>=0&&metrics.panel.right<=width&&metrics.panel.bottom<=height);
    assert.ok(Math.abs(metrics.buttons[0].width-metrics.buttons[1].width)<1);
    await ui.page.screenshot({path:`${output}/consent-${width}.png`,fullPage:true}); results.push({name:`visual-${width}`,pass:true,metrics});
  }
  await ui.context.close();
  const app=await setup({actual:true});
  for(const path of ["/", "/docs/agent-art", "/docs/wallet-local-data", "/thought/", "/gallery"]) {
    console.log(`Checking built route ${path} (inert ID: ${enabledBuild})`);
    await app.page.goto(`https://inshell.art${path}`); await app.page.getByRole('button',{name:'Analytics settings',exact:true}).waitFor();
    if(enabledBuild && path==='/') await allow(app.page);
    await settle(app.page);
    if(path==='/docs/wallet-local-data') {
      const notice = app.page.getByText(/The choice lasts 90 days\. Analytics cookies are host-only\./,{exact:false});
      await notice.waitFor();
      assert.match(await notice.innerText(),/client cookie has a fixed expiry/);
      assert.match(await notice.innerText(),/session cookie can renew/);
      results.push({name:'built-documentation-corrected-cookie-notice',pass:true});
    }
    if(path==="/thought/") {
      assert.equal(await app.page.locator('body').getAttribute('data-thought-transport'),'plain-experimental');
      await app.page.locator('#thought-dock-prompt').fill('private draft SENTINEL');
      await app.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
      await app.page.getByRole('button',{name:'Reject Google Analytics',exact:true}).click();
      assert.equal(await app.page.locator('#thought-dock-prompt').inputValue(),'private draft SENTINEL');
      await app.page.getByRole('button',{name:'Analytics settings',exact:true}).click();
      for(const [width,height] of [[1280,900],[390,844]]) {
        await app.page.setViewportSize({width,height}); await settle(app.page);
        const metrics=await app.page.evaluate(()=>{
          const panel=document.querySelector('#inshell-ga4-panel').getBoundingClientRect();
          const buttons=[...document.querySelectorAll('.inshell-ga4-actions button')].map(b=>b.getBoundingClientRect().width);
          return {overflow:document.documentElement.scrollWidth>innerWidth,x:panel.x,right:panel.right,bottom:panel.bottom,buttons};
        });
        assert.equal(metrics.overflow,false);assert.ok(metrics.x>=0&&metrics.right<=width&&metrics.bottom<=height);
        assert.ok(Math.abs(metrics.buttons[0]-metrics.buttons[1])<1);
        await app.page.screenshot({path:`${output}/plain-thought-settings-${width}.png`,fullPage:true});
        results.push({name:`built-plain-thought-visual-${width}`,pass:true,metrics});
      }
    }
    if(!enabledBuild) { assert.equal(app.scripts.length,0); assert.equal(app.events.length,0); }
  }
  if(enabledBuild) {
    assert.equal(app.scripts.length,4);
    assert.deepEqual(app.events.filter(e=>e.name==='page_view').map(e=>e.page_location),['https://inshell.art/','https://inshell.art/docs/agent-art','https://inshell.art/docs/wallet-local-data','https://inshell.art/thought']);
    assert.doesNotMatch(JSON.stringify(app.events),/SENTINEL|private draft/);
  }
  assert.deepEqual(app.errors,[]); assert.deepEqual(app.unexpected,[]);
  results.push({name:enabledBuild ? "built-home-docs-plain-thought-withdraw-gallery-inert-id" : "built-home-docs-plain-thought-gallery-missing-id",pass:true});
  await writeFile(`${output}/results.json`,JSON.stringify({scope:"local vendor substitutes; no actual Google receipt",results},null,2));
  console.log(JSON.stringify({passed:results.length,output,realGoogleRequests:0}));
} finally { await browser.close(); }
