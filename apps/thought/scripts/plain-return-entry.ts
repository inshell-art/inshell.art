import path from "node:path";
import type { Plugin } from "vite";
import { isRetiredThoughtPath, retiredThoughtResponse } from "../../../packages/shared/src/retired-thought";

// Runs after index integrity verification. Canonical creation is plain; only
// non-creation routes import the original entry. Old transport query links do
// not reopen legacy creation. Legacy run links, demos and plugins are retired.
export function plainReturnEntryPlugin(root: string): Plugin {
  const entries = new Map<string, string>();
  return {
    name: "thought-explicit-plain-return-entry",
    enforce: "pre",
    configureServer(server) {
      // Before the remote proxy or SPA: retirement never opens a run store.
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        if (!isRetiredThoughtPath(pathname)) return next();
        const response = retiredThoughtResponse(req.method ?? "GET");
        res.writeHead(response.status, Object.fromEntries(response.headers));
        void response.text().then((body) => res.end(body));
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
      // Keep scoped layout CSS on the eager entry. The build optimizer can fold
      // the two conditional imports into one preload call and retain only the
      // legacy branch's CSS dependencies. HTML must load this for either path.
      return `import ${JSON.stringify(path.resolve(root, "src/plain-return/view.css"))};
import { mountGa4Choice } from ${JSON.stringify(path.resolve(root, "../../packages/shared/src/ga4-ui.ts"))};
mountGa4Choice(import.meta.env);
const u=new URL(location.href);const p=u.pathname.replace(/\\/+$/,"");
if(p==="/thought"||p===""){
  import(${JSON.stringify(path.resolve(root, "src/plain-return/view.ts"))});
}else{import(${JSON.stringify(original)});}`;
    },
  };
}
