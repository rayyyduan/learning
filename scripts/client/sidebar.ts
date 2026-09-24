/**
 * 侧栏：整栏收起 / 展开（按钮、快捷键 [）、窄屏抽屉、拖拽调整宽度、目录树展开状态与滚动位置的记忆。
 */

import { store } from "./store.ts";

const root = document.documentElement;
const MOBILE = window.matchMedia("(max-width: 56rem)");
const MIN_WIDTH = 12 * 16;
const MAX_WIDTH = 32 * 16;

function isMobile() {
  return MOBILE.matches;
}

function setCollapsed(collapsed: boolean) {
  if (collapsed) root.dataset.sidebar = "collapsed";
  else delete root.dataset.sidebar;
  store.set("site:sidebar", collapsed ? "collapsed" : null);
}

function setDrawer(open: boolean) {
  if (open) root.dataset.drawer = "open";
  else delete root.dataset.drawer;
}

export function toggleSidebar() {
  if (isMobile()) setDrawer(root.dataset.drawer !== "open");
  else setCollapsed(root.dataset.sidebar !== "collapsed");
}

function openSidebar() {
  if (isMobile()) setDrawer(true);
  else setCollapsed(false);
}

function initResize(nav: HTMLElement) {
  const handle = nav.querySelector<HTMLElement>(".site-nav__resize");
  if (!handle) return;
  const apply = (px: number) => {
    const w = `${Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, px)))}px`;
    root.style.setProperty("--sidebar-width", w);
    return w;
  };
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    root.dataset.resizing = "";
    const left = nav.getBoundingClientRect().left;
    const move = (ev: PointerEvent) => apply(ev.clientX - left);
    const up = (ev: PointerEvent) => {
      store.set("site:sidebar-width", apply(ev.clientX - left));
      delete root.dataset.resizing;
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
  handle.addEventListener("dblclick", () => {
    root.style.removeProperty("--sidebar-width");
    store.set("site:sidebar-width", null);
  });
  handle.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const w = nav.getBoundingClientRect().width + (e.key === "ArrowLeft" ? -16 : 16);
    store.set("site:sidebar-width", apply(w));
  });
}

/** 展开状态：当前页所在分支总是展开；其余分支记住用户最后一次的选择。 */
function initTree(nav: HTMLElement) {
  const saved = store.json<Record<string, boolean>>("site:nav-open") ?? {};
  for (const d of nav.querySelectorAll<HTMLDetailsElement>("details[data-key]")) {
    const key = d.dataset.key!;
    const current = d.querySelector('[aria-current="page"]') !== null;
    if (!current && key in saved) d.open = saved[key];
    d.addEventListener("toggle", () => {
      const state = store.json<Record<string, boolean>>("site:nav-open") ?? {};
      state[key] = d.open;
      store.setJson("site:nav-open", state);
    });
  }
  // 点击名称跳转、点击箭头才展开 / 收起
  for (const a of nav.querySelectorAll<HTMLAnchorElement>("summary a")) {
    a.addEventListener("click", (e) => e.stopPropagation());
  }
}

function initScroll(nav: HTMLElement) {
  const tree = nav.querySelector<HTMLElement>(".nav-tree") ?? nav;
  const saved = Number(sessionStorage.getItem("site:nav-scroll") ?? NaN);
  if (!Number.isNaN(saved)) tree.scrollTop = saved;
  const current = nav.querySelector<HTMLElement>('[aria-current="page"]');
  if (current) {
    const r = current.getBoundingClientRect();
    const box = tree.getBoundingClientRect();
    if (r.top < box.top || r.bottom > box.bottom) current.scrollIntoView({ block: "center" });
  }
  window.addEventListener("pagehide", () => {
    try { sessionStorage.setItem("site:nav-scroll", String(tree.scrollTop)); } catch { /* 忽略 */ }
  });
}

export function initSidebar() {
  const nav = document.getElementById("site-nav");
  if (!nav) return;
  initTree(nav);
  initResize(nav);
  initScroll(nav);

  document.addEventListener("click", (e) => {
    const target = (e.target as Element).closest<HTMLElement>("[data-action]");
    switch (target?.dataset.action) {
      case "sidebar-toggle": return toggleSidebar();
      case "sidebar-open": return openSidebar();
      case "drawer-close": return setDrawer(false);
    }
  });
  // 抽屉里点了链接就收起
  nav.addEventListener("click", (e) => {
    if (isMobile() && (e.target as Element).closest("a")) setDrawer(false);
  });
  MOBILE.addEventListener("change", () => setDrawer(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.dataset.drawer === "open") setDrawer(false);
  });
}
