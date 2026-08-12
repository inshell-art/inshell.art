import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./dev-thought-lan-stack.mjs", import.meta.url),
  "utf8",
);

test("LAN supervisor keeps Vite loopback-only behind its own proxy", () => {
  assert.match(source, /const loopbackHost = "127\.0\.0\.1";/);
  assert.match(source, /Configured LAN host is not an assigned private IPv4 address/);
  assert.match(
    source,
    /server\.listen\(\{ host: publicHost, port: Number\(homePort\), exclusive: true \}/,
  );
  assert.match(source, /INSHELL_THOUGHT_HOME_HOST: loopbackHost/);
  assert.match(source, /INSHELL_THOUGHT_APP_HOST: "127\.0\.0\.1"/);
  assert.doesNotMatch(source, /INSHELL_THOUGHT_(?:HOME|APP)_HOST: "0\.0\.0\.0"/);
});

test("LAN supervisor exposes only its disposable chain and canonical Home origin", () => {
  assert.match(source, /const rpcProxy = await startRpcProxy\(publicHost\)/);
  assert.doesNotMatch(
    source,
    /const publicRpcUrl =\s*process\.env\.INSHELL_THOUGHT_PUBLIC_RPC_URL/,
  );
  assert.match(source, /INSHELL_THOUGHT_ANVIL_HOST: loopbackHost/);
  assert.doesNotMatch(source, /INSHELL_THOUGHT_(?:ANVIL|HOME|APP)_HOST: "0\.0\.0\.0"/);
  assert.match(source, /"eth_sendRawTransaction"/);
  assert.doesNotMatch(source, /"eth_sendTransaction"|"anvil_[^"]+"|"evm_[^"]+"/);
  assert.match(source, /RPC method is not available on the LAN lane/);
  assert.match(source, /const appUrl = `\$\{homeUrl\}thought\/`/);
  assert.match(
    source,
    /fetchStatus\(`\$\{homeUrl\}api\/thought-agent\/v2\/client`, 410, accessHeaders\)/,
  );
  assert.match(source, /if \(consecutiveFailures >= unhealthyLimit\)/);
  assert.match(source, /Restarting the unhealthy THOUGHT LAN stack/);
  assert.match(source, /LAN address changed from \$\{publicHost\} to \$\{detectedHost\}/);
});

test("LAN UI requires a generated bearer cookie and denies private Vite paths", () => {
  assert.match(source, /randomBytes\(32\)\.toString\("base64url"\)/);
  assert.match(source, /rpcAccessToken = await readOrCreateAccessToken\(rpcAccessTokenFile\)/);
  assert.match(source, /parsedUrl\.pathname !== `\/\$\{rpcAccessToken\}`/);
  assert.match(source, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=604800/);
  assert.match(source, /response\.end\("LAN access token required\.\\n"\)/);
  assert.doesNotMatch(source, /remoteAddress === publicHost/);
  assert.doesNotMatch(source, /remoteAddress !== publicHost/);
  assert.match(source, /const accessHeaders = \{ cookie: `\$\{accessCookieName\}=\$\{accessToken\}` \}/);
  assert.match(source, /git\|local\|agents\|codex\|ops\|claude/);
  assert.match(source, /for \(let pass = 0; pass < 3; pass \+= 1\)/);
  assert.match(source, /decoded = decoded\.replaceAll\("\\\\", "\/"\)\.toLowerCase\(\)/);
  assert.match(source, /path\.join\(root, "node_modules"\)/);
  assert.match(source, /path\.join\(root, "packages"\)/);
  assert.match(source, /!isAllowedViteFsPath\(decoded\)/);
  assert.match(source, /\.dev\\\.vars/);
  assert.match(source, /inbox\|memo\|local_tasks/);
  assert.match(source, /__open-in-editor/);
  assert.match(source, /headers: proxyHeaders\(request\.headers\)/);
  assert.match(source, /Object\.entries\(proxyHeaders\(request\.headers\)\)/);
  assert.match(source, /filter\(\(part\) => part\.split\("=", 1\)\[0\] !== accessCookieName\)/);
  assert.match(source, /rpcUrl: `http:\/\/\$\{publicHost\}:\$\{anvilPort\}\/\<access-token\>`/);
  assert.doesNotMatch(source, /rpcUrl:\s*publicRpcUrl/);
  assert.match(source, /const maxLogBytes = 10 \* 1024 \* 1024/);
  assert.match(source, /fsPromises\.rename\(logFile, rotatedLogFile\)/);
  assert.match(source, /logBytes \+ bytes\.length > maxLogBytes/);
  assert.match(source, /fs\.renameSync\(logFile, rotatedLogFile\)/);
  assert.match(source, /fsPromises\.rm\(statusFile, \{ force: true \}\)/);
  assert.match(source, /const requestUrl = \(request, base\) =>/);
  assert.match(source, /response\.end\("Invalid request URL\.\\n"\)/);
  assert.match(source, /rpcError\(response, request, 400, -32600, "Invalid request URL"\)/);
  assert.match(source, /fsPromises\.chmod\(statusFile, 0o600\)/);
  assert.match(source, /stop\("error"\)/);
  assert.match(source, /child\.once\("exit", resolve\)/);
});
