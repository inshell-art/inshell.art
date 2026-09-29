import path from "node:path";
import type { Plugin } from "vite";

// Runs after the existing index integrity verification. The default imports the
// identical original entry (including its verified snapshot query), unchanged.
export function plainReturnEntryPlugin(root: string): Plugin {
  const entries = new Map<string, string>();
  return {
    name: "thought-explicit-plain-return-entry",
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
if(u.searchParams.get("transport")==="plain"&&(p==="/thought"||p==="")){
  import(${JSON.stringify(path.resolve(root, "src/plain-return/view.ts"))});
}else{import(${JSON.stringify(original)});}`;
    },
  };
}
