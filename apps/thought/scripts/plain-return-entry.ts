import path from "node:path";
import type { Plugin } from "vite";

// Runs after index integrity verification. Canonical creation is plain; only
// non-creation routes import the original entry. Old transport query links do
// not reopen legacy creation; existing /runs/:id links retain recovery.
export function plainReturnEntryPlugin(root: string): Plugin {
  const entries = new Map<string, string>();
  return {
    name: "thought-explicit-plain-return-entry",
    enforce: "pre",
    configureServer(server) {
      // Before the old local dev handler (or remote proxy): no new legacy task
      // or auto-run. Existing authenticated run-specific routes remain intact.
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        if (req.method !== "POST" || !/^\/api\/thought-agent\/v[12]\/runs\/?$/.test(pathname)) return next();
        res.writeHead(410, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ error: { code: "LEGACY_CREATION_RETIRED", message: "Open /thought to create a new work." } }));
      });
    },
    transformIndexHtml: { order: "pre", handler(html) {
      return html.replace(/(<script type="module" src=")(\/src\/main\.ts[^"]*)("><\/script>)/, (_all, before, source: string, after) => {
        const entry = `/@thought-entry/${source.includes("?") ? "snapshot" : "current"}`;
        entries.set(entry, path.resolve(root, source.slice(1)));
        return `${before}${entry}${after}`;
      });
    } },
    resolveId(id) { if (entries.has(id)) return `\0${id}`; return null; },
    load(id) {
      const original = entries.get(id.slice(1));
      if (!id.startsWith("\0") || !original) return null;
      return `const u=new URL(location.href);const p=u.pathname.replace(/\\/+$/,"");
if(p==="/thought"||p===""){
  import(${JSON.stringify(path.resolve(root, "src/plain-return/view.ts"))});
}else{import(${JSON.stringify(original)});}`;
    },
  };
}
