/**
 * Markdown 渲染：markdown-it + 插件，尽量覆盖常见写法。
 *
 * 支持：GFM（表格、删除线、自动链接）、脚注、任务列表、标题锚点、GitHub 提示框（> [!NOTE]）、
 * ::: 容器（tip / note / warn / … / details）、KaTeX 公式、Shiki 代码高亮（浅色 / 深色双主题）、
 * Mermaid（交给浏览器渲染）、==高亮==、上下标、++插入++、缩写、定义列表、emoji、{.class} 属性、
 * [[wiki 链接]]、YAML frontmatter，以及中文段落内换行不产生多余空格。
 *
 * 提示框统一输出成 site.css 里的 .callout 组件，和 HTML 课程里的提示框长得一样。
 */

import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
type MD = InstanceType<typeof MarkdownIt>;
import type Token from "markdown-it/lib/token.mjs";
import anchor from "markdown-it-anchor";
import footnote from "markdown-it-footnote";
import taskLists from "markdown-it-task-lists";
import githubAlerts from "markdown-it-github-alerts";
import container from "markdown-it-container";
import attrs from "markdown-it-attrs";
import mark from "markdown-it-mark";
import sub from "markdown-it-sub";
import sup from "markdown-it-sup";
import abbr from "markdown-it-abbr";
import deflist from "markdown-it-deflist";
import ins from "markdown-it-ins";
import { full as emoji } from "markdown-it-emoji";
import cjkBreaks from "markdown-it-cjk-breaks";
import regexpPlugin from "markdown-it-regexp";
import katexModule from "@vscode/markdown-it-katex";
import { fromHighlighter } from "@shikijs/markdown-it/core";
import { bundledLanguages, createHighlighter, type HighlighterGeneric } from "shiki";
import matter from "gray-matter";

/** CommonJS 插件在 ESM 里可能被包一层 { default }。 */
const interop = <T>(mod: T): T => ((mod as { default?: T }).default ?? mod);

export const SHIKI_THEMES = { light: "vitesse-light", dark: "vitesse-dark" } as const;

/** 提示框类型 → site.css 的 .callout 修饰类和默认标题。 */
const CALLOUTS: Record<string, { cls: string; title: string }> = {
  note: { cls: "note", title: "说明" },
  info: { cls: "note", title: "说明" },
  tip: { cls: "tip", title: "技巧" },
  important: { cls: "important", title: "重要" },
  warning: { cls: "warn", title: "注意" },
  warn: { cls: "warn", title: "注意" },
  caution: { cls: "caution", title: "警告" },
  danger: { cls: "caution", title: "警告" },
  source: { cls: "source", title: "推荐资料" },
  ask: { cls: "ask", title: "有问题随时问" },
};

export interface RenderEnv {
  /** 当前 Markdown 源文件的绝对路径，用于改写相对链接。 */
  src: string;
  /** [[名称]] → 相对当前页面的链接。 */
  resolveWiki: (name: string) => string | null;
  /** 渲染过程中收集的信息，供页面模板使用。 */
  hasMath?: boolean;
  hasMermaid?: boolean;
}

export interface RenderedMarkdown {
  html: string;
  frontmatter: Record<string, unknown>;
  hasMath: boolean;
  hasMermaid: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 相对链接里的 .md 改成 .html；MISSION.md 渲染在主题首页，所以指向同目录的 index.html。 */
export function rewriteMdHref(href: string): string {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return href;
  const m = /^([^?#]*?)([^/?#]*)\.md([?#].*)?$/i.exec(href);
  if (!m) return href;
  const [, dir, base, rest = ""] = m;
  return base.toUpperCase() === "MISSION" ? `${dir}index.html${rest}` : `${dir}${base}.html${rest}`;
}

/** 标题锚点：保留中文，去掉标点，空白变连字符。 */
function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/[\s\u3000]+/g, "-").replace(/[^\p{L}\p{N}_-]/gu, "") || "section";
}

function setup(highlighter: HighlighterGeneric<any, any>): MD {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

  md.use(fromHighlighter(highlighter, {
    themes: SHIKI_THEMES,
    defaultColor: false,
    transformers: [{
      pre(node) {
        const lang = this.options.lang;
        if (lang && lang !== "text") node.properties["data-lang"] = lang;
      },
    }],
  }));

  // Mermaid：原样输出源码，由浏览器端脚本按需加载 mermaid 渲染。
  // Shiki 不认识的语言按纯文本输出（语言在 renderMarkdown 里按需加载，所以要实时判断）。
  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const lang = token.info.trim().split(/\s+/)[0].toLowerCase();
    if (lang === "mermaid") {
      (env as unknown as RenderEnv).hasMermaid = true;
      return `<pre class="mermaid">${escapeHtml(token.content)}</pre>\n`;
    }
    if (lang && !highlighter.getLoadedLanguages().includes(lang)) {
      token.info = "text" + token.info.trim().slice(lang.length);
    }
    return fence(tokens, idx, options, env, self);
  };

  md.use(interop(katexModule), { throwOnError: false, enableMathBlockInHtml: true, enableMathInlineInHtml: true });
  for (const rule of ["math_inline", "math_block", "math_block_eqno", "math_inline_double"]) {
    const render = md.renderer.rules[rule];
    if (!render) continue;
    md.renderer.rules[rule] = (tokens, idx, options, env, self) => {
      (env as unknown as RenderEnv).hasMath = true;
      return render(tokens, idx, options, env, self);
    };
  }

  md.use(interop(footnote))
    .use(interop(taskLists), { enabled: false, label: true })
    .use(interop(mark))
    .use(interop(sub))
    .use(interop(sup))
    .use(interop(ins))
    .use(interop(abbr))
    .use(interop(deflist))
    .use(emoji)
    .use(interop(cjkBreaks))
    .use(interop(attrs), { allowedAttributes: ["id", "class", "style", "width", "height", "title", /^data-.*$/] })
    .use(anchor, {
      level: [2, 3, 4],
      slugify,
      permalink: anchor.permalink.linkInsideHeader({
        symbol: "#", placement: "after", class: "heading-anchor", ariaHidden: true,
        renderAttrs: () => ({ "data-pagefind-ignore": "" }),
      }),
    });

  // GitHub 提示框：> [!NOTE] 标题
  md.use(githubAlerts, { titles: Object.fromEntries(Object.entries(CALLOUTS).map(([k, v]) => [k, v.title])) });
  md.renderer.rules.alert_open = (tokens, idx) => {
    const { title, type } = tokens[idx].meta as { title: string; type: string };
    const cls = CALLOUTS[type]?.cls ?? "note";
    return `<div class="callout callout--${cls}"><span class="callout__title">${md.utils.escapeHtml(title)}</span>`;
  };

  // ::: tip 标题 … :::
  for (const [name, { cls, title }] of Object.entries(CALLOUTS)) {
    md.use(container, name, {
      render(tokens: Token[], idx: number) {
        const token = tokens[idx];
        if (token.nesting !== 1) return "</div>\n";
        const custom = token.info.trim().slice(name.length).trim();
        return `<div class="callout callout--${cls}"><span class="callout__title">${md.utils.escapeHtml(custom || title)}</span>\n`;
      },
    });
  }
  md.use(container, "details", {
    render(tokens: Token[], idx: number) {
      const token = tokens[idx];
      if (token.nesting !== 1) return "</details>\n";
      const summary = token.info.trim().slice("details".length).trim() || "详细信息";
      return `<details><summary>${md.utils.escapeHtml(summary)}</summary>\n`;
    },
  });

  // [[名称]] / [[名称|显示文字]] / [[名称#小节]]：先输出占位链接，再按当前页面解析
  md.use(interop(regexpPlugin)(/\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/, (match: string[], utils: { escape: (s: string) => string }) => {
    const [, name, hash = "", label] = match;
    return `<a class="wikilink" data-wiki="${utils.escape(name.trim())}" data-wiki-hash="${utils.escape(hash)}">${utils.escape((label ?? name + hash).trim())}</a>`;
  }));

  // 相对链接：.md → .html
  const linkOpen: NonNullable<typeof md.renderer.rules.link_open> = md.renderer.rules.link_open ?? ((t, i, o, _e, s) => s.renderToken(t, i, o));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href");
    if (href) token.attrSet("href", rewriteMdHref(String(href)));
    if (href && /^https?:\/\//i.test(String(href))) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noopener");
    }
    return linkOpen(tokens, idx, options, env, self);
  };

  // 宽表格可以横向滚动
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";

  // 图片懒加载
  const image = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet("loading", "lazy");
    return image(tokens, idx, options, env, self);
  };

  return md;
}

let instance: Promise<{ md: MD; highlighter: HighlighterGeneric<any, any> }> | null = null;

function getMarkdown() {
  instance ??= createHighlighter({ themes: Object.values(SHIKI_THEMES), langs: [] })
    .then((highlighter) => ({ md: setup(highlighter), highlighter }));
  return instance;
}

const FENCE_LANG_RE = /^\s*(`{3,}|~{3,})\s*([\w#+-]+)/gm;

/** Shiki 按需加载代码块里出现的语言，避免启动时加载全部语法。 */
async function loadLanguages(highlighter: HighlighterGeneric<any, any>, source: string) {
  const loaded = new Set(highlighter.getLoadedLanguages());
  const wanted = new Set<string>();
  for (const m of source.matchAll(FENCE_LANG_RE)) {
    const lang = m[2].toLowerCase();
    if (!loaded.has(lang) && lang in bundledLanguages) wanted.add(lang);
  }
  if (wanted.size) await highlighter.loadLanguage(...([...wanted] as (keyof typeof bundledLanguages)[]));
}

export async function renderMarkdown(src: string, resolveWiki: RenderEnv["resolveWiki"]): Promise<RenderedMarkdown> {
  const { md, highlighter } = await getMarkdown();
  const { content, data } = matter(fs.readFileSync(src, "utf8"));
  await loadLanguages(highlighter, content);
  const env: RenderEnv = { src, resolveWiki };
  let html = md.render(content, env as never);
  html = html.replace(/<a class="wikilink" data-wiki="([^"]*)" data-wiki-hash="([^"]*)">/g, (_, name: string, hash: string) => {
    const target = resolveWiki(decodeEntities(name));
    return target
      ? `<a class="wikilink" href="${escapeHtml(target)}${hash}">`
      : `<a class="wikilink is-missing" title="找不到页面：${name}">`;
  });
  return { html, frontmatter: data, hasMath: !!env.hasMath, hasMermaid: !!env.hasMermaid };
}

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** 去掉渲染结果开头的一级标题（主题首页已经有标题，MISSION 的标题就不再重复）。 */
export function stripLeadingH1(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/, "");
}

export function mdBasename(file: string): string {
  return path.basename(file, path.extname(file));
}
