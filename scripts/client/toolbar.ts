/**
 * 工具条：正文宽度档位、配色切换、本页目录（含滚动高亮）。
 */

import { store } from "./store.ts";

const root = document.documentElement;
const DARK = window.matchMedia("(prefers-color-scheme: dark)");

// ---------------------------------------------------------------- 正文宽度

const WIDTHS = ["narrow", "medium", "wide", "full"] as const;
const DEFAULT_WIDTH = "medium";

function currentWidth(): string {
  return root.dataset.width ?? DEFAULT_WIDTH;
}

function setWidth(value: string) {
  if (value === DEFAULT_WIDTH) delete root.dataset.width;
  else root.dataset.width = value;
  store.set("site:width", value === DEFAULT_WIDTH ? null : value);
  syncWidthButtons();
}

function syncWidthButtons() {
  for (const b of document.querySelectorAll<HTMLElement>("[data-width-option]")) {
    b.setAttribute("aria-pressed", String(b.dataset.widthOption === currentWidth()));
  }
}

function initWidth() {
  if (!WIDTHS.includes(currentWidth() as (typeof WIDTHS)[number])) setWidth(DEFAULT_WIDTH);
  syncWidthButtons();
  document.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-width-option]");
    if (b) setWidth(b.dataset.widthOption!);
  });
}

// ---------------------------------------------------------------- 配色

const THEMES = ["system", "light", "dark"] as const;
const THEME_LABEL = { system: "跟随系统", light: "浅色", dark: "深色" };

export function isDark(): boolean {
  return root.dataset.theme === "dark" || (root.dataset.theme !== "light" && DARK.matches);
}

function currentTheme(): (typeof THEMES)[number] {
  return root.dataset.theme === "light" || root.dataset.theme === "dark" ? root.dataset.theme : "system";
}

function syncThemeButton() {
  const label = `配色：${THEME_LABEL[currentTheme()]}（点击切换）`;
  for (const b of document.querySelectorAll<HTMLElement>('[data-action="theme"]')) {
    b.title = label;
    b.setAttribute("aria-label", label);
  }
}

function initTheme() {
  syncThemeButton();
  document.addEventListener("click", (e) => {
    if (!(e.target as Element).closest('[data-action="theme"]')) return;
    const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
    store.set("site:theme", next === "system" ? null : next);
    syncThemeButton();
    document.dispatchEvent(new CustomEvent("site:themechange"));
  });
  DARK.addEventListener("change", () => {
    if (currentTheme() === "system") document.dispatchEvent(new CustomEvent("site:themechange"));
  });
}

// ---------------------------------------------------------------- 本页目录

function slugify(text: string, used: Set<string>): string {
  const base = text.trim().toLowerCase().replace(/[\s　]+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "") || "section";
  let slug = base;
  for (let i = 2; used.has(slug) || document.getElementById(slug); i++) slug = `${base}-${i}`;
  used.add(slug);
  return slug;
}

function headingText(h: HTMLElement): string {
  const clone = h.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".heading-anchor, .sidenote, .katex-mathml").forEach((n) => n.remove());
  return clone.textContent?.trim() ?? "";
}

function initToc() {
  const article = document.querySelector<HTMLElement>(".site-content article");
  const headings = article ? [...article.querySelectorAll<HTMLElement>("h2, h3")].filter((h) => !h.closest(".quiz, .callout, details")) : [];
  const layout = document.querySelector(".doc-layout");
  if (headings.length < 2) {
    layout?.classList.add("doc-layout--no-toc");
    return;
  }
  const used = new Set<string>();
  for (const h of headings) if (!h.id) h.id = slugify(headingText(h), used);

  const list = () => {
    const ol = document.createElement("ol");
    ol.className = "page-toc__list";
    for (const h of headings) {
      const li = document.createElement("li");
      li.className = `page-toc__item page-toc__item--${h.tagName.toLowerCase()}`;
      const a = document.createElement("a");
      a.href = `#${encodeURIComponent(h.id)}`;
      a.textContent = headingText(h);
      a.dataset.target = h.id;
      li.append(a);
      ol.append(li);
    }
    return ol;
  };
  for (const nav of document.querySelectorAll("[data-page-toc]")) nav.replaceChildren(list());
  document.querySelector<HTMLElement>('[data-action="toc"]')?.removeAttribute("hidden");

  // 在弹出菜单里点了链接就关闭菜单
  const menu = document.getElementById("toc-menu");
  menu?.addEventListener("click", (e) => {
    if ((e.target as Element).closest("a")) (menu as HTMLElement & { hidePopover?: () => void }).hidePopover?.();
  });

  // 滚动高亮：视口上方最后一个越过的标题
  const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-page-toc] a")];
  let ticking = false;
  const update = () => {
    ticking = false;
    const offset = 96;
    let active = headings[0].id;
    for (const h of headings) {
      if (h.getBoundingClientRect().top - offset <= 0) active = h.id;
      else break;
    }
    for (const a of links) a.classList.toggle("is-active", a.dataset.target === active);
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}

export function initToolbar() {
  initWidth();
  initTheme();
  initToc();
}
