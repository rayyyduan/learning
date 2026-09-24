/**
 * 正文增强：代码块语言标签与复制按钮、Mermaid 图（按需加载）、图片点击放大。
 * 对 Markdown 页面和 HTML 课程同样生效。
 */

import mediumZoom from "medium-zoom";
import { isDark } from "./toolbar.ts";

function initCodeBlocks(article: HTMLElement) {
  for (const pre of article.querySelectorAll<HTMLPreElement>("pre:not(.mermaid)")) {
    if (pre.parentElement?.classList.contains("code-block")) continue;
    const wrap = document.createElement("div");
    wrap.className = "code-block";
    pre.replaceWith(wrap);
    wrap.append(pre);
    const lang = pre.dataset.lang ?? /language-([\w+#-]+)/.exec(pre.querySelector("code")?.className ?? "")?.[1];
    if (lang) {
      const label = document.createElement("span");
      label.className = "code-block__lang";
      label.textContent = lang;
      wrap.append(label);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-block__copy";
    button.textContent = "复制";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败";
      }
      setTimeout(() => (button.textContent = "复制"), 1500);
    });
    wrap.append(button);
  }
}

async function initMermaid(article: HTMLElement) {
  const blocks = [...article.querySelectorAll<HTMLElement>("pre.mermaid")];
  if (!blocks.length) return;
  for (const b of blocks) b.dataset.source = b.textContent ?? "";
  const { default: mermaid } = await import("mermaid");
  const render = async () => {
    mermaid.initialize({ startOnLoad: false, theme: isDark() ? "dark" : "neutral", fontFamily: "inherit" });
    for (const b of blocks) {
      b.removeAttribute("data-processed");
      b.textContent = b.dataset.source ?? "";
    }
    await mermaid.run({ nodes: blocks, suppressErrors: true });
  };
  await render();
  document.addEventListener("site:themechange", render);
}

function initZoom(article: HTMLElement) {
  const images = [...article.querySelectorAll<HTMLImageElement>("img")].filter((img) => !img.closest("a, .no-zoom"));
  if (images.length) mediumZoom(images, { margin: 24, background: "var(--color-bg)" });
}

export function initEnhance() {
  const article = document.querySelector<HTMLElement>(".site-content article");
  if (!article) return;
  initCodeBlocks(article);
  initZoom(article);
  initMermaid(article).catch((e) => console.error("Mermaid 渲染失败", e));
}
