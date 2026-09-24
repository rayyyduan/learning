/**
 * 页面渲染：全站布局（目录、工具条）、自动生成的首页、Markdown 页面，以及往课程 HTML 里注入布局。
 */

import fs from "node:fs";
import path from "node:path";
import {
  ancestors, contains, indexUrl, markdownPages, MISSION_FILE, PAGE_DIRS, SITE_NAME, STATUS_CLASS, topicsOf,
  type Entry, type Page, type SiteNode,
} from "./tree.ts";
import { renderMarkdown, stripLeadingH1 } from "./markdown.ts";

export type Mode = "dev" | "build";

export const SITE_CSS = "assets/site.css";
export const FAVICON = "assets/favicon.svg";
export const CLIENT_JS = "_app/client.js";
export const KATEX_CSS = "_app/katex/katex.min.css";

const HTML = "text/html; charset=utf-8";

export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** 从 current 页面指向 target 的相对路径，保证整站可放在任意子路径下。 */
export function rel(target: string, current: string): string {
  const from = path.posix.dirname(current);
  const r = path.posix.relative(from === "." ? "" : from, target);
  return r || path.posix.basename(target);
}

function siteRoot(current: string): string {
  const depth = current.split("/").length - 1;
  return depth ? "../".repeat(depth) : "./";
}

export function statusBadge(status: string): string {
  if (!status) return "";
  return `<span class="status status--${STATUS_CLASS[status] ?? "other"}">${esc(status)}</span>`;
}

// ---------------------------------------------------------------- 图标（lucide 风格，内联 SVG）

const ICON_PATHS: Record<string, string> = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  "panel-close": '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M16 15l-3-3 3-3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  toc: '<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"/>',
  width: '<path d="m18 8 4 4-4 4M2 12h20M6 8l-4 4 4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  system: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
};

export function icon(name: string, cls = ""): string {
  return `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

// ---------------------------------------------------------------- 目录树

function sidebar(tree: SiteNode, current: string): string {
  const link = (target: string, text: string, cls = "nav-link") => {
    const here = target === current ? ' aria-current="page"' : "";
    return `<a class="${cls}" href="${esc(rel(target, current))}"${here}>${esc(text)}</a>`;
  };
  const pageItems = (pages: Page[]) => pages.map((p) => `<li>${link(p.url, p.title)}</li>`).join("");
  const branch = (key: string, open: boolean, cls: string, head: string, body: string) =>
    `<li class="${cls}"><details data-key="${esc(key)}"${open ? " open" : ""}>` +
    `<summary class="nav-row">${head}</summary><ul>${body}</ul></details></li>`;

  const item = (node: SiteNode): string => {
    const classes = `nav-${node.kind}` + (topicsOf(node).length ? "" : " is-empty");
    let body = "";
    if (node.kind === "topic") {
      for (const [sub, label] of Object.entries(PAGE_DIRS)) {
        const pages = node.pages[sub as keyof typeof PAGE_DIRS];
        if (pages.length) body += `<li class="nav-group">${label}</li>${pageItems(pages)}`;
      }
      if (node.notes.length || node.records.length) {
        body += `<li class="nav-group">笔记</li>${pageItems(node.notes)}`;
        if (node.records.length) {
          const open = node.records.some((p) => p.url === current);
          body += branch(`${node.path}/learning-records`, open, "nav-records",
            '<span class="nav-row__label">学习记录</span>', pageItems(node.records));
        }
      }
    } else {
      body = node.children.map(item).join("");
    }
    const head = link(indexUrl(node), node.name) + statusBadge(node.status);
    if (!body) return `<li class="${classes}"><div class="nav-row nav-row--leaf">${head}</div></li>`;
    return branch(node.path, contains(node, current), classes, head, body);
  };

  return `<nav class="site-nav" id="site-nav" aria-label="全站目录" data-pagefind-ignore>
<div class="site-nav__header">${link("index.html", SITE_NAME, "site-nav__brand")}
<button type="button" class="icon-button" data-action="sidebar-toggle" title="收起目录（[）" aria-label="收起目录">${icon("panel-close")}</button></div>
<ul class="nav-tree">${tree.children.map(item).join("")}</ul>
<div class="site-nav__resize" role="separator" aria-orientation="vertical" aria-label="拖动调整目录宽度" tabindex="0"></div>
</nav>
<div class="site-nav-backdrop" data-action="drawer-close"></div>`;
}

function toolbar(): string {
  const widths = [["narrow", "窄"], ["medium", "适中"], ["wide", "宽"], ["full", "全宽"]]
    .map(([v, label]) => `<button type="button" class="segmented__item" data-width-option="${v}">${label}</button>`).join("");
  return `<div class="site-toolbar" data-pagefind-ignore>
<button type="button" class="icon-button site-toolbar__menu" data-action="sidebar-open" title="打开目录（[）" aria-label="打开目录">${icon("menu")}</button>
<span class="site-toolbar__spacer"></span>
<button type="button" class="icon-button" data-action="toc" popovertarget="toc-menu" title="本页目录" aria-label="本页目录" hidden>${icon("toc")}</button>
<button type="button" class="icon-button" popovertarget="width-menu" title="正文宽度" aria-label="正文宽度">${icon("width")}</button>
<button type="button" class="icon-button" data-action="theme" title="切换配色" aria-label="切换配色">${icon("system", "icon--system")}${icon("sun", "icon--light")}${icon("moon", "icon--dark")}</button>
<button type="button" class="icon-button" data-action="search" title="搜索（/ 或 ⌘K）" aria-label="搜索">${icon("search")}</button>
</div>
<div id="width-menu" popover class="toolbar-popover"><p class="toolbar-popover__title">正文宽度</p><div class="segmented">${widths}</div></div>
<div id="toc-menu" popover class="toolbar-popover toolbar-popover--toc"><p class="toolbar-popover__title">本页目录</p><nav data-page-toc></nav></div>`;
}

// ---------------------------------------------------------------- 页面骨架

/** 在首屏绘制前恢复配色、正文宽度和侧栏状态，避免闪烁。 */
const INIT_SCRIPT = `<script>(()=>{try{const d=document.documentElement,s=localStorage,t=s.getItem("site:theme"),w=s.getItem("site:width"),sw=s.getItem("site:sidebar-width");if(t==="light"||t==="dark")d.dataset.theme=t;if(w)d.dataset.width=w;if(s.getItem("site:sidebar")==="collapsed")d.dataset.sidebar="collapsed";if(sw)d.style.setProperty("--sidebar-width",sw)}catch(e){}})()</script>`;

interface HeadOptions { mode: Mode; math?: boolean }

function headExtras(current: string, { mode, math }: HeadOptions): string {
  const parts = [
    `<link rel="icon" href="${esc(rel(FAVICON, current))}" type="image/svg+xml">`,
    `<meta name="site-root" content="${siteRoot(current)}">`,
    INIT_SCRIPT,
  ];
  if (math) {
    const href = mode === "dev" ? "/node_modules/katex/dist/katex.min.css" : rel(KATEX_CSS, current);
    parts.push(`<link rel="stylesheet" href="${esc(href)}">`);
  }
  if (mode === "dev") {
    parts.push('<script type="module" src="/@vite/client"></script>', '<script type="module" src="/scripts/client/main.ts"></script>');
  } else {
    parts.push(`<script type="module" src="${esc(rel(CLIENT_JS, current))}"></script>`);
  }
  return parts.join("\n");
}

function layout(tree: SiteNode, current: string, content: string): string {
  return `<div class="site-layout">${sidebar(tree, current)}<main class="site-main">${toolbar()}` +
    `<div class="site-content" data-pagefind-body>${content}</div></main></div>`;
}

function document(tree: SiteNode, current: string, title: string, content: string, opts: HeadOptions): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<link rel="stylesheet" href="${esc(rel(SITE_CSS, current))}">
${headExtras(current, opts)}
</head>
<body>
${layout(tree, current, content)}
</body>
</html>
`;
}

const HEAD_CLOSE_RE = /<\/head\s*>/i;
const SITE_CSS_LINK_RE = /<link\b[^>]*href=["'][^"']*site\.css["'][^>]*>/i;
const BODY_OPEN_RE = /<body\b[^>]*>/i;

/** 往课程 / 参考页面里注入全站布局；页面缺少全局样式表时顺便补上。 */
function inject(source: string, current: string, tree: SiteNode, extra: string, opts: HeadOptions): string {
  let head = headExtras(current, opts);
  if (!SITE_CSS_LINK_RE.test(source.replace(/<!--[\s\S]*?-->/g, ""))) head = `<link rel="stylesheet" href="${esc(rel(SITE_CSS, current))}">\n` + head;
  const h = HEAD_CLOSE_RE.exec(source);
  source = h ? source.slice(0, h.index) + head + "\n" + source.slice(h.index) : head + source;
  const b = BODY_OPEN_RE.exec(source);
  if (!b) return layout(tree, current, source + extra);
  const start = b.index + b[0].length;
  let end = source.toLowerCase().lastIndexOf("</body");
  if (end < start) end = source.length;
  return source.slice(0, start) + layout(tree, current, source.slice(start, end) + extra) + source.slice(end);
}

// ---------------------------------------------------------------- 各类页面

function breadcrumb(node: SiteNode, current: string, includeSelf = false): string {
  const chain = includeSelf ? [...ancestors(node), node] : ancestors(node);
  const crumbs = chain.map((a) => `<a href="${esc(rel(indexUrl(a), current))}">${esc(a.name)}</a>`);
  return crumbs.length ? `<p class="breadcrumb">${crumbs.join(" / ")}</p>` : "";
}

function pager(pages: Page[], current: string, label: string): string {
  const i = pages.findIndex((p) => p.url === current);
  if (i < 0 || pages.length < 2) return "";
  const cell = (p: Page | undefined, dir: "prev" | "next") => p
    ? `<a class="pager__link pager__link--${dir}" href="${esc(rel(p.url, current))}"><span class="pager__label">${dir === "prev" ? "← 上一" : "下一"}${label}${dir === "next" ? " →" : ""}</span><span class="pager__title">${esc(p.title)}</span></a>`
    : "<span></span>";
  return `<nav class="pager" aria-label="上一篇 / 下一篇" data-pagefind-ignore>${cell(pages[i - 1], "prev")}${cell(pages[i + 1], "next")}</nav>`;
}

function topicTable(topics: SiteNode[], current: string): string {
  if (!topics.length) return '<p class="muted">暂无主题。</p>';
  const rows = topics.map((t) => "<tr>" +
    `<td><a href="${esc(rel(indexUrl(t), current))}">${esc(t.name)}</a></td>` +
    `<td>${statusBadge(t.status)}</td><td>${esc(t.start)}</td><td>${t.pages.lessons.length}</td><td>${esc(t.goal)}</td></tr>`).join("");
  return '<div class="table-wrap fullwidth"><table class="topic-table"><thead><tr><th>主题</th><th>状态</th>' +
    `<th>开始日期</th><th>课程</th><th>一句话目标</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** 分类下直属主题的表格，以及子分类的小节（逐级递归）。 */
function sections(node: SiteNode, current: string, level: number): string {
  const direct = node.children.filter((c) => c.kind === "topic");
  const subs = node.children.filter((c) => c.kind === "category");
  let out = direct.length || !subs.length ? topicTable(direct, current) : "";
  const h = Math.min(level, 6);
  for (const s of subs) {
    out += `<section><h${h}><a href="${esc(rel(indexUrl(s), current))}">${esc(s.name)}</a></h${h}>${sections(s, current, level + 1)}</section>`;
  }
  return out;
}

function pageList(pages: Page[], current: string, tag: "ol" | "ul"): string {
  if (!pages.length) return '<p class="muted">暂无。</p>';
  return `<${tag} class="page-list">${pages.map((p) => `<li><a href="${esc(rel(p.url, current))}">${esc(p.title)}</a></li>`).join("")}</${tag}>`;
}

/** [[名称]] 在主题内查找：文件名（带不带 .md 都行）或标题。 */
function wikiResolver(node: SiteNode, current: string) {
  return (name: string): string | null => {
    const key = name.trim().replace(/\.md$/i, "").toLowerCase();
    if (key === MISSION_FILE.replace(/\.md$/, "").toLowerCase()) return rel(indexUrl(node), current);
    const all = [...markdownPages(node), ...node.pages.lessons, ...node.pages.reference];
    const hit = all.find((p) => path.basename(p.src).replace(/\.(md|html)$/i, "").toLowerCase() === key)
      ?? all.find((p) => p.title.toLowerCase() === key)
      ?? all.find((p) => path.basename(p.src).toLowerCase().startsWith(key + "-"));
    return hit ? rel(hit.url, current) : null;
  };
}

/** 把 Markdown 里的标题整体降一级，用于嵌入主题首页。 */
const demoteHeadings = (html: string) => html.replace(/<(\/?)h([1-5])\b/g, (_, slash: string, n: string) => `<${slash}h${Number(n) + 1}`);

async function generatedPage(node: SiteNode, current: string, tree: SiteNode, mode: Mode): Promise<string> {
  if (node.kind === "root") {
    const body = `<article><h1>${esc(SITE_NAME)}</h1>` +
      '<p class="subtitle">所有学习主题一览。左侧目录可以逐级浏览分类、主题、课程和笔记。</p>' +
      sections(node, current, 2) + "</article>";
    return document(tree, current, SITE_NAME, body, { mode });
  }
  if (node.kind === "category") {
    const body = `<article>${breadcrumb(node, current)}<h1>${esc(node.name)}</h1>${sections(node, current, 2)}</article>`;
    return document(tree, current, `${node.name} · ${SITE_NAME}`, body, { mode });
  }
  const meta = [statusBadge(node.status), node.start ? `开始于 ${esc(node.start)}` : ""].filter(Boolean).join(" · ");
  let mission = "";
  let math = false;
  if (node.mission && fs.existsSync(node.mission)) {
    const r = await renderMarkdown(node.mission, wikiResolver(node, current));
    math = r.hasMath;
    mission = `<section class="topic-mission"><h2>学习目标</h2>${demoteHeadings(stripLeadingH1(r.html))}</section>`;
  }
  const body = `<article>${breadcrumb(node, current)}<h1>${esc(node.name)}</h1>` +
    (meta ? `<p class="meta">${meta}</p>` : "") +
    (node.goal ? `<p class="subtitle">${esc(node.goal)}</p>` : "") +
    mission +
    `<h2>课程</h2>${pageList(node.pages.lessons, current, "ol")}` +
    `<h2>参考</h2>${pageList(node.pages.reference, current, "ul")}` +
    `<h2>笔记</h2>${pageList(node.notes, current, "ul")}` +
    (node.records.length ? `<h3>学习记录</h3>${pageList(node.records, current, "ol")}` : "") +
    "</article>";
  return document(tree, current, `${node.name} · ${SITE_NAME}`, body, { mode, math });
}

/** frontmatter 里的简单值显示成元信息行；数组、对象不显示。YAML 日期会被解析成 Date，按 YYYY-MM-DD 显示。 */
function frontmatterLine(data: Record<string, unknown>): string {
  const items = Object.entries(data)
    .map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v] as const)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${esc(k)}：${esc(String(v))}`);
  return items.length ? `<p class="meta">${items.join(" · ")}</p>` : "";
}

async function markdownPage(src: string, node: SiteNode, current: string, tree: SiteNode, mode: Mode): Promise<string> {
  const r = await renderMarkdown(src, wikiResolver(node, current));
  const page = markdownPages(node).find((p) => p.url === current);
  const title = page?.title ?? path.basename(src, ".md");
  let html = r.html;
  const meta = frontmatterLine(r.frontmatter);
  if (meta) {
    const end = html.indexOf("</h1>");
    html = end >= 0 ? html.slice(0, end + 5) + meta + html.slice(end + 5) : meta + html;
  }
  const isRecord = node.records.some((p) => p.url === current);
  const content = '<div class="doc-layout"><div class="doc-main">' +
    `<article class="doc markdown-body">${breadcrumb(node, current, true)}${html}</article>` +
    (isRecord ? pager(node.records, current, "篇") : "") +
    '</div><aside class="page-toc" data-pagefind-ignore><p class="page-toc__title">本页目录</p><nav data-page-toc></nav></aside></div>';
  return document(tree, current, `${title} · ${node.name}`, content, { mode, math: r.hasMath });
}

function redirectPage(target: string): string {
  const t = esc(target);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${t}">` +
    `<title>跳转中</title></head><body><a href="${t}">跳转到首页</a></body></html>`;
}

export const MIME: Record<string, string> = {
  ".html": HTML, ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wasm": "application/wasm",
};

/** 渲染站点地图里的一个条目，返回内容和 Content-Type。 */
export async function renderEntry(url: string, entry: Entry, tree: SiteNode, mode: Mode): Promise<{ data: string | Buffer; type: string }> {
  switch (entry.kind) {
    case "static":
      return { data: fs.readFileSync(entry.src), type: MIME[path.extname(entry.src).toLowerCase()] ?? "application/octet-stream" };
    case "redirect":
      return { data: redirectPage(entry.target), type: HTML };
    case "page": {
      const extra = entry.node.pages.lessons.some((p) => p.url === url) ? pager(entry.node.pages.lessons, url, "课") : "";
      return { data: inject(fs.readFileSync(entry.src, "utf8"), url, tree, extra, { mode }), type: HTML };
    }
    case "markdown":
      return { data: await markdownPage(entry.src, entry.node, url, tree, mode), type: HTML };
    case "generated":
      return { data: await generatedPage(entry.node, url, tree, mode), type: HTML };
  }
}

export function printWarnings(tree: SiteNode): void {
  for (const w of tree.warnings) console.warn(`警告：${w}`);
}
