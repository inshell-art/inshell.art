function scrollStep(element: Element, delta: number) {
  const max = Math.max(0, element.scrollHeight - element.clientHeight);
  const start = Math.min(max, Math.max(0, element.scrollTop));
  const end = Math.min(max, Math.max(0, start + delta));
  return { start, end, remaining: delta - (end - start) };
}

/**
 * Keep native scrolling until the pane under the pointer runs out of room.
 * Only then pass its unused wheel movement to the other pane. The article
 * remains in document flow, so anchors, keyboard navigation and page scrolling
 * keep their normal browser behavior.
 */
export function attachDocsScrollHandoff(page: HTMLElement, sidebar: HTMLElement) {
  const doc = page.ownerDocument;
  const view = doc.defaultView;
  if (!view) return () => {};

  const onWheel = (event: globalThis.WheelEvent) => {
    if (
      event.defaultPrevented || !event.cancelable || event.ctrlKey || event.shiftKey ||
      !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)
    ) return;

    // The mobile menu is ordinary document content, not a second scroll pane.
    if (
      view.getComputedStyle(sidebar).position !== "sticky" ||
      sidebar.scrollHeight <= sidebar.clientHeight
    ) return;

    const target = event.target instanceof Element ? event.target : null;
    const documentPane = doc.scrollingElement;
    if (!target || !documentPane || target.closest("input, textarea, select, [contenteditable]")) return;

    const overMenu = sidebar.contains(target);
    const primary = overMenu ? sidebar : documentPane;
    const secondary = overMenu ? documentPane : sidebar;
    const style = view.getComputedStyle(target);
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize);
    const delta = event.deltaY * (
      event.deltaMode === event.DOM_DELTA_LINE ? lineHeight :
      event.deltaMode === event.DOM_DELTA_PAGE ? primary.clientHeight : 1
    );
    if (!Number.isFinite(delta)) return;

    // Code excerpts and other nested scrollers retain their own native scroll.
    for (let node: Element | null = target; node && node !== primary && node !== page; node = node.parentElement) {
      if (node.scrollHeight <= node.clientHeight) continue;
      if (!/^(auto|scroll)$/.test(view.getComputedStyle(node).overflowY)) continue;
      if (scrollStep(node, delta).remaining !== delta) return;
    }

    const first = scrollStep(primary, delta);
    if (!first.remaining) return;
    const second = scrollStep(secondary, first.remaining);
    if (second.remaining === first.remaining) return;

    // Prevent the native scroll from applying this same movement a second time.
    event.preventDefault();
    primary.scrollTop = first.end;
    // scrollHeight/clientHeight are rounded but scrollTop can be fractional.
    // Carry the actual consumed distance so subpixel edges do not lose motion.
    const remaining = delta - (primary.scrollTop - first.start);
    secondary.scrollTop = scrollStep(secondary, remaining).end;
  };

  page.addEventListener("wheel", onWheel, { passive: false });
  return () => page.removeEventListener("wheel", onWheel);
}
