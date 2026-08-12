#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Interface,
  keccak256,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";
import { isLanAgentCapsuleRequest } from "./thought-lan-agent-capsule.mjs";
import { isAllowedLanRpcOrigin } from "./thought-lan-rpc-origin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runDirectory = path.join(root, ".local", "run");
const logDirectory = path.join(root, ".local", "logs");
const statusFile = path.join(runDirectory, "thought-lan-stack.json");
const accessUrlFile = path.join(runDirectory, "thought-lan-access-url.txt");
const accessTokenFile = path.join(root, ".local", "lan", "access-token");
const rpcAccessTokenFile = path.join(root, ".local", "lan", "rpc-access-token");
const logFile = path.join(logDirectory, "thought-lan-stack.log");
const rotatedLogFile = `${logFile}.1`;
const appPort = process.env.INSHELL_THOUGHT_APP_PORT?.trim() || "5176";
const homePort = process.env.INSHELL_THOUGHT_HOME_PORT?.trim() || "5177";
const anvilPort = process.env.INSHELL_THOUGHT_ANVIL_PORT?.trim() || "8547";
const expectedChainId = process.env.INSHELL_THOUGHT_ANVIL_CHAIN_ID?.trim() || "31338";
const expectedChainIdHex = `0x${BigInt(expectedChainId).toString(16)}`;
const healthIntervalMs = 15_000;
const startupTimeoutMs = 120_000;
const unhealthyLimit = 3;
const loopbackHost = "127.0.0.1";
const accessCookieName = "inshell_lan_access";
const maxRpcBodyBytes = 1024 * 1024;
const maxLogBytes = 10 * 1024 * 1024;
const childTreeGraceMs = 45_000;
const childTreeKillMs = 5_000;
const allowedRpcMethods = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getProof",
  "eth_getStorageAt",
  "eth_getTransactionByBlockHashAndIndex",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "eth_protocolVersion",
  "eth_sendRawTransaction",
  "eth_syncing",
  "net_version",
  "web3_clientVersion",
]);

await fsPromises.mkdir(runDirectory, { recursive: true, mode: 0o700 });
await fsPromises.mkdir(logDirectory, { recursive: true, mode: 0o700 });
await fsPromises.mkdir(path.dirname(accessTokenFile), { recursive: true, mode: 0o700 });
await Promise.all([
  fsPromises.chmod(runDirectory, 0o700),
  fsPromises.chmod(logDirectory, 0o700),
  fsPromises.chmod(path.dirname(accessTokenFile), 0o700),
]);
await fsPromises.rm(statusFile, { force: true });
try {
  if ((await fsPromises.stat(logFile)).size >= maxLogBytes) {
    await fsPromises.rm(rotatedLogFile, { force: true });
    await fsPromises.rename(logFile, rotatedLogFile);
    await fsPromises.chmod(rotatedLogFile, 0o600);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
let logBytes = await fsPromises.stat(logFile).then(({ size }) => size, () => 0);
let logDescriptor = fs.openSync(logFile, "a", 0o600);
fs.chmodSync(logFile, 0o600);

const writeLog = (chunk) => {
  const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  if (logBytes > 0 && logBytes + bytes.length > maxLogBytes) {
    fs.closeSync(logDescriptor);
    fs.rmSync(rotatedLogFile, { force: true });
    fs.renameSync(logFile, rotatedLogFile);
    fs.chmodSync(rotatedLogFile, 0o600);
    logDescriptor = fs.openSync(logFile, "a", 0o600);
    fs.chmodSync(logFile, 0o600);
    logBytes = 0;
  }
  fs.writeSync(logDescriptor, bytes);
  logBytes += bytes.length;
};

const write = (message, stream = process.stdout) => {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  stream.write(line);
  writeLog(line);
};

const writeChildOutput = (chunk, stream) => {
  stream.write(chunk);
  writeLog(chunk);
};

const readOrCreateAccessToken = async (tokenFile) => {
  try {
    const token = (await fsPromises.readFile(tokenFile, "utf8")).trim();
    if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
      throw new Error(`Invalid LAN access token file: ${tokenFile}`);
    }
    return token;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const token = randomBytes(32).toString("base64url");
    await fsPromises.writeFile(tokenFile, `${token}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return token;
  }
};

const accessToken = await readOrCreateAccessToken(accessTokenFile);
const rpcAccessToken = await readOrCreateAccessToken(rpcAccessTokenFile);

const isPrivateIpv4 = (address) => {
  const octets = address.split(".").map(Number);
  return octets.length === 4 && (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
};

const detectLanHost = () => {
  const configured = process.env.INSHELL_THOUGHT_PUBLIC_HOST?.trim();
  const candidates = Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((address) => ({ name, ...address })),
    )
    .filter((address) =>
      address.family === "IPv4" && !address.internal && isPrivateIpv4(address.address),
    )
    .sort((left, right) => {
      const leftScore = left.name === "en0" ? 0 : left.name.startsWith("en") ? 1 : 2;
      const rightScore = right.name === "en0" ? 0 : right.name.startsWith("en") ? 1 : 2;
      return leftScore - rightScore || left.name.localeCompare(right.name);
    });
  if (configured) {
    if (!isPrivateIpv4(configured) || !candidates.some(({ address }) => address === configured)) {
      throw new Error(
        `Configured LAN host is not an assigned private IPv4 address: ${configured}`,
      );
    }
    return configured;
  }
  if (!candidates[0]?.address) {
    throw new Error(
      "No private LAN IPv4 address is available. Connect this machine to the LAN and retry.",
    );
  }
  return candidates[0].address;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchOk = async (url, headers = {}) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const fetchStatus = async (url, expectedStatus, headers = {}) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(3_000),
    });
    return response.status === expectedStatus;
  } catch {
    return false;
  }
};

const rpc = async (url, method, params = []) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(3_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `RPC HTTP ${response.status}`);
  }
  return payload.result;
};

const pathRuntimeReady = async (publicRpcUrl) => {
  const runtimeFile = path.join(
    root,
    "apps",
    "thought",
    "contract-integration",
    "local-runtime.thought-anvil.json",
  );
  const runtime = JSON.parse(await fsPromises.readFile(runtimeFile, "utf8"));
  const deployment = runtime?.pathDeployment;
  if (
    runtime?.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime?.status !== "ready" ||
    runtime?.chainId !== Number(expectedChainId) ||
    deployment?.schema !== "inshell.path.local-deployment.v1" ||
    deployment?.chainId !== Number(expectedChainId) ||
    deployment?.releaseTag !== "v0.5.0" ||
    deployment?.releasePublicationCommit !== "085cfc084b0e568740e0da639e968eb535f7e5c8" ||
    deployment?.contractSourceCommit !== "5a1ab1f137e76c80dc69045dc520454f6e07cbb1" ||
    deployment?.manifestSha256 !== "a81355b459b40faea894cf1dfb7f484765a7ec62672039dd62d58a3a52849921"
  ) {
    return false;
  }
  const records = [
    deployment.contracts?.pathNft,
    deployment.contracts?.pathPulseAdapter,
    deployment.contracts?.pulseAuction,
  ];
  if (
    records.some(
      (record) =>
        typeof record?.address !== "string" ||
        !/^0x[a-fA-F0-9]{40}$/.test(record.address) ||
        !Number.isSafeInteger(record?.deployBlock) ||
        typeof record?.codeHash !== "string" ||
        !/^0x[a-fA-F0-9]{64}$/.test(record.codeHash),
    )
  ) {
    return false;
  }
  const [codes, currentPrice] = await Promise.all([
    Promise.all(
      records.map((record) =>
        rpc(publicRpcUrl, "eth_getCode", [record.address, "latest"]),
      ),
    ),
    rpc(publicRpcUrl, "eth_call", [
      { to: deployment.contracts.pulseAuction.address, data: "0xeb91d37e" },
      "latest",
    ]),
  ]);
  if (
    !codes.every(
      (code, index) =>
        typeof code === "string" &&
        !/^0x0*$/i.test(code) &&
        keccak256(code).toLowerCase() === records[index].codeHash.toLowerCase(),
    ) ||
    typeof currentPrice !== "string" ||
    !/^0x[0-9a-f]+$/i.test(currentPrice)
  ) {
    return false;
  }

  const interfaces = {};
  for (const contract of ["PathNFT", "PathPulseAdapter", "PulseAuction"]) {
    const artifactFile = path.join(
      root,
      "packages",
      "contracts",
      "src",
      "path-release",
      "releases",
      "v0.5.0",
      "hardhat",
      `${contract}.json`,
    );
    interfaces[contract] = new Interface(
      JSON.parse(await fsPromises.readFile(artifactFile, "utf8")).abi,
    );
  }
  const call = async (record, contract, method) => {
    const iface = interfaces[contract];
    const result = await rpc(publicRpcUrl, "eth_call", [
      { to: record.address, data: iface.encodeFunctionData(method) },
      "latest",
    ]);
    return iface.decodeFunctionResult(method, result);
  };
  const [
    adapterConfig,
    wiringFrozen,
    tokenBase,
    epochBase,
    publicMinter,
    publicMinterFrozen,
    sparkClaimDuration,
    reservedCap,
    auctionConfig,
    mintAdapter,
    paymentToken,
    treasury,
    deployer,
  ] = await Promise.all([
    call(records[1], "PathPulseAdapter", "getConfig"),
    call(records[1], "PathPulseAdapter", "wiringFrozen"),
    call(records[1], "PathPulseAdapter", "tokenBase"),
    call(records[1], "PathPulseAdapter", "epochBase"),
    call(records[0], "PathNFT", "publicMinter"),
    call(records[0], "PathNFT", "publicMinterFrozen"),
    call(records[0], "PathNFT", "sparkClaimDuration"),
    call(records[0], "PathNFT", "getReservedCap"),
    call(records[2], "PulseAuction", "getConfig"),
    call(records[2], "PulseAuction", "mintAdapter"),
    call(records[2], "PulseAuction", "paymentToken"),
    call(records[2], "PulseAuction", "treasury"),
    call(records[2], "PulseAuction", "deployer"),
  ]);
  const same = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();
  return (
    same(adapterConfig[0], records[2].address) &&
    same(adapterConfig[1], records[0].address) &&
    wiringFrozen[0] === true &&
    tokenBase[0] === 1n &&
    epochBase[0] === 1n &&
    same(publicMinter[0], records[1].address) &&
    publicMinterFrozen[0] === true &&
    sparkClaimDuration[0] === BigInt(runtime.pathSpark?.claimDurationSeconds) &&
    reservedCap[0] === BigInt(runtime.pathSpark?.reservedCap) &&
    Number(auctionConfig[0]) === deployment.auction?.openTime &&
    String(auctionConfig[1]) === deployment.auction?.genesisPrice &&
    String(auctionConfig[2]) === deployment.auction?.genesisFloor &&
    String(auctionConfig[3]) === deployment.auction?.k &&
    String(auctionConfig[4]) === deployment.auction?.pts &&
    same(mintAdapter[0], records[1].address) &&
    same(paymentToken[0], deployment.paymentToken) &&
    same(treasury[0], deployment.auction?.treasury) &&
    same(deployer[0], runtime.pathSpark?.issuer)
  );
};

const health = async ({ publicHost, publicRpcUrl }) => {
  const homeUrl = `http://${publicHost}:${homePort}/`;
  const appUrl = `http://${publicHost}:${homePort}/thought/`;
  const pathUrl = `http://${publicHost}:${homePort}/path`;
  const accessHeaders = { cookie: `${accessCookieName}=${accessToken}` };
  try {
    const [
      chainId,
      homeReady,
      appReady,
      pathReady,
      pathRuntimeIsReady,
      agentApiReady,
    ] = await Promise.all([
      rpc(publicRpcUrl, "eth_chainId"),
      fetchOk(homeUrl, accessHeaders),
      fetchOk(appUrl, accessHeaders),
      fetchOk(pathUrl, accessHeaders),
      pathRuntimeReady(publicRpcUrl),
      fetchStatus(`${homeUrl}api/thought-agent/v2/client`, 410, accessHeaders),
    ]);
    return {
      ok:
        chainId === expectedChainIdHex &&
        homeReady &&
        appReady &&
        pathReady &&
        pathRuntimeIsReady &&
        agentApiReady,
      chainId,
      homeReady,
      appReady,
      pathReady,
      pathRuntimeIsReady,
      agentApiReady,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const writeStatus = async (status) => {
  const temporary = `${statusFile}.tmp`;
  await fsPromises.writeFile(temporary, `${JSON.stringify(status, null, 2)}\n`, {
    mode: 0o600,
  });
  await fsPromises.rename(temporary, statusFile);
  await fsPromises.chmod(statusFile, 0o600);
};

const normalizedRemoteAddress = (request) =>
  String(request.socket.remoteAddress ?? "").replace(/^::ffff:/, "");

const requestUrl = (request, base) => {
  try {
    return new URL(request.url ?? "/", base);
  } catch {
    return null;
  }
};

const cookieValue = (request, name) =>
  String(request.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1] ?? "";

const stripAccessCookie = (cookieHeader) =>
  String(cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.split("=", 1)[0] !== accessCookieName)
    .join("; ");

const proxyHeaders = (headers) => {
  const forwarded = { ...headers };
  const cookie = stripAccessCookie(headers.cookie);
  if (cookie) forwarded.cookie = cookie;
  else delete forwarded.cookie;
  return forwarded;
};

const allowedViteFsRoots = [
  path.join(root, "node_modules"),
  path.join(root, "packages"),
].map((value) => value.replaceAll("\\", "/").toLowerCase());
const allowedViteFsFiles = [
  path.join(root, "apps", "thought", "src", "thought-v2-contract-release.generated.ts"),
  path.join(root, "apps", "thought", "src", "thought-v2-production-deployment.ts"),
  path.join(root, "apps", "thought", "production", "deployment-lock.json"),
].map((value) => value.replaceAll("\\", "/").toLowerCase());

const isAllowedViteFsPath = (decoded) => {
  const marker = decoded.indexOf("/@fs/");
  if (marker === -1) return true;
  const requested = path.resolve("/", decoded.slice(marker + "/@fs/".length))
    .replaceAll("\\", "/")
    .toLowerCase();
  if (allowedViteFsFiles.includes(requested)) return true;
  return allowedViteFsRoots.some(
    (allowed) => requested === allowed || requested.startsWith(`${allowed}/`),
  );
};

const isDeniedVitePath = (pathname) => {
  let decoded = pathname;
  try {
    for (let pass = 0; pass < 3; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    decoded = decoded.replaceAll("\\", "/").toLowerCase();
  } catch {
    return true;
  }
  return (
    !isAllowedViteFsPath(decoded) ||
    /(?:^|\/)__open-in-editor(?:\/|$)/.test(decoded) ||
    /(?:^|\/)\.(?:git|local|agents|codex|ops|claude|inshell-secrets|ssh|wrangler)(?:\/|$)/.test(decoded) ||
    /(?:^|\/)library\/keychains(?:\/|$)/.test(decoded) ||
    /(?:^|\/)\.env(?:rc|\..*)?$/.test(decoded) ||
    /(?:^|\/)\.dev\.vars(?:\..*)?$/.test(decoded) ||
    /(?:^|\/)\.(?:npmrc|yarnrc)(?:$|\/)/.test(decoded) ||
    /(?:^|\/)[^/]+\.(?:key|pem|p12|pfx)(?:$|\/)/.test(decoded) ||
    /(?:^|\/)(?:inbox|memo|local_tasks)\.md(?:$|\/)/.test(decoded)
  );
};

const authorizeUiRequest = (request, response, publicHost) => {
  const remoteAddress = normalizedRemoteAddress(request);
  if (remoteAddress === loopbackHost) return true;
  const parsedUrl = requestUrl(request, `http://${publicHost}:${homePort}`);
  if (!parsedUrl) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Invalid request URL.\n");
    return false;
  }
  if (
    isLanAgentCapsuleRequest({
      method: request.method,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      authorization: request.headers.authorization,
    })
  ) {
    return true;
  }
  const suppliedToken = parsedUrl.searchParams.get("access");
  if (suppliedToken === accessToken) {
    parsedUrl.searchParams.delete("access");
    response.writeHead(302, {
      location: `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
      "set-cookie": `${accessCookieName}=${accessToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
      "cache-control": "no-store",
    });
    response.end();
    return false;
  }
  if (cookieValue(request, accessCookieName) === accessToken) return true;
  response.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end("LAN access token required.\n");
  return false;
};

const proxyRequest = (publicHost, request, response) => {
  if (!authorizeUiRequest(request, response, publicHost)) return;
  const parsedUrl = requestUrl(request, `http://${publicHost}:${homePort}`);
  if (!parsedUrl || isDeniedVitePath(parsedUrl.pathname)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found.\n");
    return;
  }
  const upstream = httpRequest({
    hostname: loopbackHost,
    port: Number(homePort),
    path: request.url ?? "/",
    method: request.method,
    headers: proxyHeaders(request.headers),
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", (error) => {
    if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
    response.end(`LAN proxy unavailable: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  request.pipe(upstream);
};

const proxyUpgrade = (publicHost, request, client, head) => {
  const remoteAddress = normalizedRemoteAddress(request);
  if (
    remoteAddress !== loopbackHost &&
    cookieValue(request, accessCookieName) !== accessToken
  ) {
    client.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    return;
  }
  const upstream = connect(Number(homePort), loopbackHost);
  upstream.once("connect", () => {
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);
    for (const [name, value] of Object.entries(proxyHeaders(request.headers))) {
      if (Array.isArray(value)) {
        for (const item of value) upstream.write(`${name}: ${item}\r\n`);
      } else if (value !== undefined) {
        upstream.write(`${name}: ${value}\r\n`);
      }
    }
    upstream.write("\r\n");
    if (head.length > 0) upstream.write(head);
    client.pipe(upstream).pipe(client);
  });
  upstream.once("error", () => client.destroy());
  client.once("error", () => upstream.destroy());
};

const startLanProxy = (publicHost) =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) =>
      proxyRequest(publicHost, request, response));
    server.on("upgrade", (request, client, head) =>
      proxyUpgrade(publicHost, request, client, head));
    server.once("error", reject);
    server.listen({ host: publicHost, port: Number(homePort), exclusive: true }, () => {
      server.removeListener("error", reject);
      server.on("error", (error) => {
        write(`LAN proxy error: ${error instanceof Error ? error.message : String(error)}`, process.stderr);
      });
      resolve(server);
    });
  });

const readRequestBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRpcBodyBytes) throw new Error("RPC request is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

const rpcHomeOrigin = (publicHost) => `http://${publicHost}:${homePort}`;

const rpcCorsHeaders = (request, publicHost) => ({
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  ...(request.headers.origin &&
  isAllowedLanRpcOrigin(request.headers.origin, rpcHomeOrigin(publicHost))
    ? { "access-control-allow-origin": request.headers.origin }
    : {}),
  "access-control-max-age": "600",
  vary: "Origin",
});

const rpcError = (response, request, publicHost, status, code, message, id = null) => {
  if (response.headersSent) {
    response.end();
    return;
  }
  response.writeHead(status, {
    ...rpcCorsHeaders(request, publicHost),
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
};

const startRpcProxy = (publicHost) =>
  new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      const parsedUrl = requestUrl(request, `http://${publicHost}:${anvilPort}`);
      if (!parsedUrl) {
        rpcError(response, request, publicHost, 400, -32600, "Invalid request URL");
        return;
      }
      if (parsedUrl.pathname !== `/${rpcAccessToken}`) {
        rpcError(response, request, publicHost, 404, -32601, "RPC endpoint not found");
        return;
      }
      if (
        !isAllowedLanRpcOrigin(
          request.headers.origin,
          rpcHomeOrigin(publicHost),
        )
      ) {
        rpcError(response, request, publicHost, 403, -32600, "RPC browser origin is not allowed");
        return;
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, rpcCorsHeaders(request, publicHost));
        response.end();
        return;
      }
      if (request.method !== "POST") {
        rpcError(response, request, publicHost, 405, -32600, "Only JSON-RPC POST is allowed");
        return;
      }
      let body;
      let payload;
      try {
        body = await readRequestBody(request);
        payload = JSON.parse(body.toString("utf8"));
      } catch (error) {
        rpcError(
          response,
          request,
          publicHost,
          error instanceof Error && error.message.includes("too large") ? 413 : 400,
          -32700,
          error instanceof Error ? error.message : "Invalid JSON-RPC request",
        );
        return;
      }
      const calls = Array.isArray(payload) ? payload : [payload];
      const denied = calls.find((call) => !call || !allowedRpcMethods.has(call.method));
      if (denied) {
        rpcError(response, request, publicHost, 403, -32601, "RPC method is not available on the LAN lane", denied?.id ?? null);
        return;
      }
      const upstream = httpRequest({
        hostname: loopbackHost,
        port: Number(anvilPort),
        path: "/",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": body.length,
        },
      }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, {
          ...upstreamResponse.headers,
          ...rpcCorsHeaders(request, publicHost),
          "cache-control": "no-store",
        });
        upstreamResponse.pipe(response);
      });
      upstream.once("error", (error) => {
        rpcError(response, request, publicHost, 502, -32000, error.message);
      });
      upstream.end(body);
    });
    server.once("error", reject);
    server.listen({ host: publicHost, port: Number(anvilPort), exclusive: true }, () => {
      server.removeListener("error", reject);
      server.on("error", (error) => {
        write(`LAN RPC proxy error: ${error instanceof Error ? error.message : String(error)}`, process.stderr);
      });
      resolve(server);
    });
  });

let child = null;
let stopping = false;
let restartCount = 0;
let resolveStopRequest;
const stopRequested = new Promise((resolve) => {
  resolveStopRequest = resolve;
});

const terminateChildTree = (target, signal = "SIGTERM") => {
  if (!target) return;
  if (process.platform !== "win32" && target.pid) {
    try {
      process.kill(-target.pid, signal);
      return;
    } catch (error) {
      if (error?.code === "ESRCH") return;
    }
  }
  if (target.exitCode === null) target.kill(signal);
};

const terminateChildLeader = (target, signal = "SIGTERM") => {
  if (target?.exitCode === null) target.kill(signal);
};

const childTreeIsAlive = (target) => {
  if (!target) return false;
  if (process.platform === "win32" || !target.pid) return target.exitCode === null;
  try {
    process.kill(-target.pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
};

const waitForChildTreeExit = async (target) => {
  const waitUntil = async (deadline) => {
    while (childTreeIsAlive(target) && Date.now() < deadline) {
      await sleep(100);
    }
    return !childTreeIsAlive(target);
  };
  if (await waitUntil(Date.now() + childTreeGraceMs)) return;
  write(
    `THOUGHT LAN child group ${target?.pid ?? "unknown"} did not stop gracefully; forcing shutdown.`,
    process.stderr,
  );
  terminateChildTree(target, "SIGKILL");
  if (!(await waitUntil(Date.now() + childTreeKillMs))) {
    throw new Error(`THOUGHT LAN child group ${target?.pid ?? "unknown"} did not exit.`);
  }
};

const stopAndWaitChildTree = async (target, exited) => {
  terminateChildLeader(target);
  await waitForChildTreeExit(target);
  return await exited;
};

const stop = (signal) => {
  if (stopping) return;
  stopping = true;
  write(`Stopping LAN stack from ${signal}.`);
  terminateChildLeader(child);
  resolveStopRequest();
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

const publicHost = detectLanHost();
const lanProxy = await startLanProxy(publicHost);
const rpcProxy = await startRpcProxy(publicHost);
await fsPromises.writeFile(
  accessUrlFile,
  `http://${publicHost}:${homePort}/?access=${accessToken}\n`,
  { encoding: "utf8", mode: 0o600 },
);
await fsPromises.chmod(accessUrlFile, 0o600);

const runStack = async () => {
  const publicRpcUrl =
    `http://${publicHost}:${anvilPort}/${rpcAccessToken}`;
  const homeUrl = `http://${publicHost}:${homePort}/`;
  const appUrl = `${homeUrl}thought/`;
  const env = {
    ...process.env,
    INSHELL_THOUGHT_ANVIL_HOST: loopbackHost,
    INSHELL_THOUGHT_APP_HOST: "127.0.0.1",
    INSHELL_THOUGHT_HOME_HOST: loopbackHost,
    INSHELL_THOUGHT_PUBLIC_HOST: publicHost,
    INSHELL_THOUGHT_PUBLIC_RPC_URL: publicRpcUrl,
  };

  write(`Starting THOUGHT LAN stack on ${publicHost} (restart ${restartCount}).`);
  child = spawn(process.execPath, ["scripts/dev-thought-local-stack.mjs"], {
    cwd: root,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => writeChildOutput(chunk, process.stdout));
  child.stderr.on("data", (chunk) => writeChildOutput(chunk, process.stderr));
  const exited = new Promise((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  const startedAt = new Date().toISOString();
  const deadline = Date.now() + startupTimeoutMs;
  let currentHealth = null;
  while (!stopping && Date.now() < deadline) {
    const result = await Promise.race([
      exited.then((exit) => ({ exit })),
      sleep(1_000).then(async () => ({ health: await health({ publicHost, publicRpcUrl }) })),
      stopRequested.then(() => ({ stop: true })),
    ]);
    if (result.stop) return await stopAndWaitChildTree(child, exited);
    if (result.exit) {
      terminateChildTree(child);
      await waitForChildTreeExit(child);
      return result.exit;
    }
    currentHealth = result.health;
    if (currentHealth.ok) break;
  }

  if (stopping) return await stopAndWaitChildTree(child, exited);
  if (!currentHealth?.ok) {
    write("LAN stack did not become healthy before the startup deadline.", process.stderr);
    return await stopAndWaitChildTree(child, exited);
  }

  const readyStatus = {
    schema: "inshell.thought.lan-stack.v1",
    status: "ready",
    pid: child.pid,
    startedAt,
    checkedAt: new Date().toISOString(),
    restartCount,
    publicHost,
    homeUrl,
    appUrl,
    rpcUrl: `http://${publicHost}:${anvilPort}/<access-token>`,
    accessUrlFile,
    chainId: Number(expectedChainId),
    logFile,
  };
  await writeStatus(readyStatus);
  write(`LAN ready: ${homeUrl}`);
  write(`THOUGHT App: ${appUrl}`);
  write(`Disposable THOUGHT RPC: http://${publicHost}:${anvilPort}/<access-token>`);

  let consecutiveFailures = 0;
  while (!stopping) {
    const detectedHost = detectLanHost();
    if (detectedHost !== publicHost) {
      throw new Error(
        `LAN address changed from ${publicHost} to ${detectedHost}; launchd must restart the supervisor.`,
      );
    }
    const result = await Promise.race([
      exited.then((exit) => ({ exit })),
      sleep(healthIntervalMs).then(async () => ({
        health: await health({ publicHost, publicRpcUrl }),
      })),
      stopRequested.then(() => ({ stop: true })),
    ]);
    if (result.stop) return await stopAndWaitChildTree(child, exited);
    if (result.exit) {
      terminateChildTree(child);
      await waitForChildTreeExit(child);
      return result.exit;
    }
    currentHealth = result.health;
    if (currentHealth.ok) {
      consecutiveFailures = 0;
      await writeStatus({
        ...readyStatus,
        checkedAt: new Date().toISOString(),
      });
      continue;
    }
    consecutiveFailures += 1;
    write(
      `LAN health check failed ${consecutiveFailures}/${unhealthyLimit}: ${JSON.stringify(currentHealth)}`,
      process.stderr,
    );
    if (consecutiveFailures >= unhealthyLimit) {
      write("Restarting the unhealthy THOUGHT LAN stack.", process.stderr);
      return await stopAndWaitChildTree(child, exited);
    }
  }

  return await stopAndWaitChildTree(child, exited);
};

try {
  while (!stopping) {
    const exit = await runStack();
    terminateChildTree(child);
    await waitForChildTreeExit(child);
    child = null;
    if (stopping) break;
    restartCount += 1;
    write(`THOUGHT LAN stack exited (${JSON.stringify(exit)}); restarting in 3 seconds.`, process.stderr);
    await sleep(3_000);
  }
} catch (error) {
  write(error instanceof Error ? error.message : String(error), process.stderr);
  stop("error");
  await waitForChildTreeExit(child);
  process.exitCode = 1;
} finally {
  await fsPromises.rm(statusFile, { force: true });
  await new Promise((resolve) => lanProxy.close(resolve));
  await new Promise((resolve) => rpcProxy.close(resolve));
  fs.closeSync(logDescriptor);
}
