import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { attachDocsScrollHandoff } from "../src/components/docs/scrollHandoff";

let page: HTMLElement;
let sidebar: HTMLElement;
let article: HTMLElement;
let detach: () => void;
const root = document.documentElement;
const scrollingElementDescriptor = Object.getOwnPropertyDescriptor(document, "scrollingElement");

function dimensions(element: Element, height: number, contentHeight: number) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: height },
    scrollHeight: { configurable: true, value: contentHeight },
  });
}

function wheel(target: HTMLElement, deltaY: number, options: globalThis.WheelEventInit = {}) {
  const event = new window.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY, ...options });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  page = document.createElement("main");
  sidebar = document.createElement("aside");
  article = document.createElement("article");
  sidebar.style.position = "sticky";
  sidebar.style.overflowY = "auto";
  article.style.lineHeight = "24px";
  page.append(sidebar, article);
  document.body.append(page);
  Object.defineProperty(document, "scrollingElement", { configurable: true, value: root });
  dimensions(root, 600, 1600);
  dimensions(sidebar, 500, 800);
  root.scrollTop = 0;
  sidebar.scrollTop = 0;
  detach = attachDocsScrollHandoff(page, sidebar);
});

afterEach(() => {
  detach();
  page.remove();
  root.scrollTop = 0;
  Reflect.deleteProperty(root, "clientHeight");
  Reflect.deleteProperty(root, "scrollHeight");
  if (scrollingElementDescriptor) Object.defineProperty(document, "scrollingElement", scrollingElementDescriptor);
  else Reflect.deleteProperty(document, "scrollingElement");
});

describe("docs pane scroll handoff", () => {
  test.each([
    ["article", 1000, 0, 80, 1000, 80],
    ["article", 960, 0, 80, 1000, 40],
    ["article", 0, 200, -80, 0, 120],
    ["article", 40, 200, -80, 0, 160],
    ["menu", 400, 300, 80, 480, 300],
    ["menu", 400, 260, 80, 440, 300],
    ["menu", 400, 0, -80, 320, 0],
    ["menu", 400, 40, -80, 360, 0],
  ])("%s hands off exactly the remainder (%s, %s, %s)", (pane, documentTop, menuTop, delta, nextDocument, nextMenu) => {
    root.scrollTop = Number(documentTop);
    sidebar.scrollTop = Number(menuTop);
    expect(wheel(pane === "menu" ? sidebar : article, Number(delta))).toBe(true);
    expect(root.scrollTop).toBe(nextDocument);
    expect(sidebar.scrollTop).toBe(nextMenu);
  });

  test("leaves native scrolling alone before the primary pane reaches an edge", () => {
    root.scrollTop = 400;
    sidebar.scrollTop = 100;
    expect(wheel(article, 80)).toBe(false);
    expect(wheel(sidebar, -80)).toBe(false);
    expect(root.scrollTop).toBe(400);
    expect(sidebar.scrollTop).toBe(100);
  });

  test("clamps both ends without bouncing or trapping the wheel", () => {
    root.scrollTop = 980;
    sidebar.scrollTop = 280;
    expect(wheel(article, 1000)).toBe(true);
    expect(root.scrollTop).toBe(1000);
    expect(sidebar.scrollTop).toBe(300);
    expect(wheel(article, 100)).toBe(false);
    root.scrollTop = 20;
    sidebar.scrollTop = 20;
    expect(wheel(sidebar, -1000)).toBe(true);
    expect(root.scrollTop).toBe(0);
    expect(sidebar.scrollTop).toBe(0);
    expect(wheel(sidebar, -100)).toBe(false);
  });

  test("normalizes line and page wheel units", () => {
    root.scrollTop = 1000;
    expect(wheel(article, 2, { deltaMode: window.WheelEvent.DOM_DELTA_LINE })).toBe(true);
    expect(sidebar.scrollTop).toBe(48);
    expect(wheel(article, 0.25, { deltaMode: window.WheelEvent.DOM_DELTA_PAGE })).toBe(true);
    expect(sidebar.scrollTop).toBe(198);
  });

  test.each([
    { ctrlKey: true }, { shiftKey: true }, { deltaX: 200 }, { cancelable: false },
  ])("preserves zoom, horizontal and non-cancelable gestures: %j", (options) => {
    root.scrollTop = 1000;
    expect(wheel(article, 80, options)).toBe(false);
    expect(sidebar.scrollTop).toBe(0);
  });

  test("respects an already handled event", () => {
    root.scrollTop = 1000;
    article.addEventListener("wheel", (event) => event.preventDefault());
    wheel(article, 80);
    expect(sidebar.scrollTop).toBe(0);
  });

  test("preserves nested source-code scrolling until its edge", () => {
    const code = document.createElement("pre");
    code.style.overflowY = "auto";
    article.append(code);
    dimensions(code, 100, 400);
    root.scrollTop = 1000;
    expect(wheel(code, 80)).toBe(false);
    expect(sidebar.scrollTop).toBe(0);
    code.scrollTop = 300;
    expect(wheel(code, 80)).toBe(true);
    expect(sidebar.scrollTop).toBe(80);
  });

  test("preserves fractional movement at the menu edge", () => {
    let menuTop = 280;
    Object.defineProperty(sidebar, "scrollTop", {
      configurable: true,
      get: () => menuTop,
      set: (value: number) => { menuTop = Math.max(0, Math.min(299.5, value)); },
    });
    root.scrollTop = 400;
    expect(wheel(sidebar, 40)).toBe(true);
    expect(sidebar.scrollTop).toBe(299.5);
    expect(root.scrollTop).toBe(420.5);
  });

  test("does not hijack editable controls", () => {
    const input = document.createElement("textarea");
    article.append(input);
    root.scrollTop = 1000;
    expect(wheel(input, 80)).toBe(false);
    expect(sidebar.scrollTop).toBe(0);
  });

  test("uses normal document scrolling in the mobile single-column layout", () => {
    sidebar.style.position = "static";
    root.scrollTop = 1000;
    expect(wheel(article, 80)).toBe(false);
    expect(sidebar.scrollTop).toBe(0);
  });

  test("does not intercept when the whole menu fits", () => {
    dimensions(sidebar, 800, 800);
    root.scrollTop = 1000;
    expect(wheel(article, 80)).toBe(false);
  });

  test("removes the listener on unmount", () => {
    detach();
    root.scrollTop = 1000;
    expect(wheel(article, 80)).toBe(false);
    expect(sidebar.scrollTop).toBe(0);
  });
});
