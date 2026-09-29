import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import process from "node:process";
import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { handlePlainRequest, type PlainDatabase, type PlainEnv } from "../../../functions/api/thought-plain/v1/_middleware";

// Local D1-shaped facade executes the product SQL, not a separate run model.
export function sqliteD1(database: DatabaseSync): PlainDatabase {
  return { prepare(sql) {
    let values: SQLInputValue[] = [];
    return {
      bind(...input: unknown[]) { values = input as SQLInputValue[]; return this; },
      async first<T>() { return (database.prepare(sql).get(...values) ?? null) as T | null; },
      async run() { return database.prepare(sql).run(...values); },
    };
  } };
}
export async function servePlainRequest(req: IncomingMessage, res: ServerResponse, env: PlainEnv) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("cf-connecting-ip", req.socket.remoteAddress ?? "127.0.0.1");
  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method, headers,
    ...(!["GET", "HEAD"].includes(req.method ?? "GET") ? { body: Readable.toWeb(req) as globalThis.ReadableStream<Uint8Array>, duplex: "half" } : {}),
  });
  const response = await handlePlainRequest({ request, env });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}
export function plainReturnDevPlugin(): Plugin {
  return { name: "thought-plain-return-local-api", apply: "serve", configureServer(server) {
    const enabled = process.env.THOUGHT_PLAIN_HTTP_ENABLED === "true";
    const origin = process.env.THOUGHT_PLAIN_HTTP_ORIGIN;
    const file = process.env.THOUGHT_PLAIN_HTTP_SQLITE_PATH;
    if (enabled && (!origin || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || !file)) {
      throw new Error("Plain HTTP dev requires explicit loopback origin and SQLite file path");
    }
    const database = enabled ? new DatabaseSync(file!) : null;
    const env: PlainEnv = { THOUGHT_PLAIN_HTTP_ENABLED: enabled ? "true" : undefined,
      THOUGHT_PLAIN_HTTP_ORIGIN: origin, INSHELL_CHAIN_DATA_DB: database ? sqliteD1(database) : undefined };
    server.httpServer?.once("close", () => database?.close());
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith("/api/thought-plain")) return next();
      void servePlainRequest(req, res, env).catch(() => {
        if (!res.headersSent) res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end('{"code":"STORE_UNAVAILABLE"}');
      });
    });
  } };
}
