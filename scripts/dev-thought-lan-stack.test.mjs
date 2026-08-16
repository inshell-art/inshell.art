import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import { isLanAgentCapsuleRequest } from "./thought-lan-agent-capsule.mjs";
import { isAllowedLanRpcOrigin } from "./thought-lan-rpc-origin.mjs";

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
  assert.match(source, /isAllowedLanRpcOrigin\(request\.headers\.origin, rpcHomeOrigin\(publicHost\)\)/);
  assert.doesNotMatch(source, /"access-control-allow-origin": request\.headers\.origin \|\| "\*"/);
  assert.match(source, /const appUrl = `\$\{homeUrl\}thought\/`/);
  assert.match(source, /const pathUrl = `http:\/\/\$\{publicHost\}:\$\{homePort\}\/path`/);
  assert.match(source, /fetchOk\(pathUrl, accessHeaders\)/);
  assert.match(source, /pathRuntimeReady\(publicRpcUrl\)/);
  assert.match(source, /deployment\?\.schema !== "inshell\.path\.local-deployment\.v1"/);
  assert.match(source, /data: "0xeb91d37e"/);
  assert.match(
    source,
    /fetchStatus\(`\$\{homeUrl\}api\/thought-agent\/v2\/client`, 410, accessHeaders\)/,
  );
  assert.match(source, /if \(consecutiveFailures >= unhealthyLimit\)/);
  assert.match(source, /Restarting the unhealthy THOUGHT LAN stack/);
  assert.match(source, /LAN address changed from \$\{publicHost\} to \$\{detectedHost\}/);
  assert.match(source, /detached: process\.platform !== "win32"/);
  assert.match(source, /process\.kill\(-target\.pid, signal\)/);
  assert.match(source, /process\.kill\(-target\.pid, 0\)/);
  assert.match(source, /const childTreeGraceMs = 45_000/);
  assert.match(source, /terminateChildTree\(target, "SIGKILL"\)/);
  assert.match(
    source,
    /const terminateChildLeader = \(target, signal = "SIGTERM"\) => \{\s*if \(target\?\.exitCode === null\) target\.kill\(signal\);\s*\}/,
  );
  assert.match(
    source,
    /const stopAndWaitChildTree = async \(target, exited\) => \{\s*terminateChildLeader\(target\);\s*await waitForChildTreeExit\(target\);\s*return await exited;\s*\}/,
  );
  assert.match(source, /Stopping LAN stack from \$\{signal\}[\s\S]*?terminateChildLeader\(child\)/);
  assert.match(source, /stopRequested\.then\(\(\) => \(\{ stop: true \}\)\)/);
  assert.match(source, /if \(result\.stop\) return await stopAndWaitChildTree\(child, exited\)/);
  assert.match(
    source,
    /if \(result\.exit\) \{\s*terminateChildTree\(child\);\s*await waitForChildTreeExit\(child\);\s*return result\.exit;\s*\}/,
  );
  assert.match(
    source,
    /const exit = await runStack\(\);\s*terminateChildTree\(child\);\s*await waitForChildTreeExit\(child\);\s*child = null;/,
  );
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
  assert.match(source, /thought-v2-contract-release\.generated\.ts/);
  assert.match(source, /thought-v2-production-deployment\.ts/);
  assert.match(source, /"production", "deployment-lock\.json"/);
  assert.match(source, /"contract-integration", "current", "integration-lock\.json"/);
  assert.match(source, /"contract-integration", "current", "thought\.selected-spec\.md"/);
  assert.match(
    source,
    /"thought-v2-canonical-portable-release-20260807-r2",\s*"dependencies",\s*"mono-76",\s*"glyphs\.json"/,
  );
  assert.match(source, /if \(allowedViteFsFiles\.includes\(requested\)\) return true/);
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
  assert.match(source, /rpcError\(response, request, publicHost, 400, -32600, "Invalid request URL"\)/);
  assert.match(source, /RPC browser origin is not allowed/);
  assert.match(source, /fsPromises\.chmod\(statusFile, 0o600\)/);
  assert.match(source, /stop\("error"\)/);
  assert.match(
    source,
    /stop\("error"\);\s*await waitForChildTreeExit\(child\);\s*process\.exitCode = 1/,
  );
  assert.doesNotMatch(source, /child\.once\("exit", resolve\)/);
  assert.match(source, /!isAllowedLanRpcOrigin\(/);
  assert.match(
    source,
    /keccak256\(code\)\.toLowerCase\(\) === records\[index\]\.codeHash\.toLowerCase\(\)/,
  );
  assert.match(source, /same\(deployer\[0\], runtime\.pathSpark\?\.issuer\)/);
});

test("LAN proxy bypasses its UI cookie only for bearer-authenticated Agent capsules", () => {
  const authorization = `Bearer ${"a".repeat(32)}`;
  const allowed = [
    ["POST", "claim"],
    ["POST", "ready"],
    ["POST", "start"],
    ["PUT", "result"],
    ["POST", "fail"],
  ];
  for (const [method, action] of allowed) {
    assert.equal(
      isLanAgentCapsuleRequest({
        method,
        pathname: `/api/thought-agent/v2/runs/tar_abcdefgh/${action}`,
        authorization,
      }),
      true,
    );
  }

  for (const request of [
    {
      method: "POST",
      pathname: "/api/thought-agent/v2/runs/tar_abcdefgh/claim",
      authorization: undefined,
    },
    {
      method: "POST",
      pathname: "/api/thought-agent/v2/runs/tar_abcdefgh/claim",
      authorization: "Basic not-bearer",
    },
    {
      method: "GET",
      pathname: "/api/thought-agent/v2/runs/tar_abcdefgh/claim",
      authorization,
    },
    {
      method: "GET",
      pathname: "/api/thought-agent/v2/runs/tar_abcdefgh",
      authorization,
    },
    {
      method: "POST",
      pathname: "/api/thought-agent/v2/runs/tar_abcdefgh/claim-authorization",
      authorization,
    },
    {
      method: "POST",
      pathname: "/api/thought-agent/v1/runs/tar_abcdefgh/claim",
      authorization,
    },
    {
      method: "POST",
      pathname: "/api/thought-agent/v2/runs/not-a-run/claim",
      authorization,
    },
    {
      method: "POST",
      pathname: "/api/thought-agent/v2/runs/tar_abcdefgh/claim",
      search: "?access=not-allowed",
      authorization,
    },
  ]) {
    assert.equal(isLanAgentCapsuleRequest(request), false);
  }

  assert.match(source, /isLanAgentCapsuleRequest\(\{/);
  assert.match(source, /authorization: request\.headers\.authorization/);
});

test("LAN RPC POST accepts wallet extensions and rejects foreign web origins", async () => {
  const homeOrigin = "http://192.168.0.105:5177";
  const server = createServer((request, response) => {
    const allowed = isAllowedLanRpcOrigin(request.headers.origin, homeOrigin);
    response.writeHead(allowed ? 204 : 403);
    response.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });
  const address = server.address();
  assert.equal(typeof address, "object");
  const endpoint = `http://127.0.0.1:${address.port}/token`;
  const post = (origin) =>
    fetch(endpoint, {
      method: "POST",
      headers: origin ? { origin } : {},
      body: "{}",
    });
  try {
    assert.equal((await post(homeOrigin)).status, 204);
    assert.equal(
      (await post("chrome-extension://abcdefghijklmnopabcdefghijklmnop")).status,
      204,
    );
    assert.equal(
      (await post("moz-extension://123e4567-e89b-12d3-a456-426614174000")).status,
      204,
    );
    assert.equal((await post(undefined)).status, 204);
    assert.equal((await post("https://evil.example")).status, 403);
    assert.equal((await post("null")).status, 403);
    assert.equal((await post("chrome-extension://not-an-extension-id")).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
