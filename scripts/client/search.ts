/**
 * 全站搜索：Pagefind（构建时生成索引，纯静态、离线可用）。快捷键 / 或 ⌘K / Ctrl+K。
 * 开发模式下使用上一次 make build 生成的索引。
 */

interface PagefindResult { data: () => Promise<{ url: string; excerpt: string; meta: { title?: string } }> }
interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  debouncedSearch: (q: string, o?: unknown, ms?: number) => Promise<{ results: PagefindResult[] } | null>;
}

const MAX_RESULTS = 12;

function siteRootUrl(): URL {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="site-root"]');
  return new URL(meta?.content ?? "./", location.href);
}

let pagefind: Promise<Pagefind | null> | null = null;

function loadPagefind(): Promise<Pagefind | null> {
  pagefind ??= (async () => {
    const base = siteRootUrl();
    try {
      const pf = (await import(/* @vite-ignore */ new URL("pagefind/pagefind.js", base).href)) as Pagefind;
      await pf.options({ baseUrl: base.pathname });
      await pf.init();
      return pf;
    } catch {
      return null;
    }
  })();
  return pagefind;
}

function createDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "search-dialog";
  dialog.setAttribute("aria-label", "全站搜索");
  dialog.innerHTML = `
    <form method="dialog" class="search-dialog__form">
      <input type="search" class="search-dialog__input" placeholder="搜索课程、参考和笔记…" autocomplete="off" spellcheck="false" aria-label="搜索关键词">
      <kbd class="search-dialog__esc">Esc</kbd>
    </form>
    <p class="search-dialog__status" role="status"></p>
    <ol class="search-dialog__results"></ol>`;
  document.body.append(dialog);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close(); // 点遮罩关闭
  });
  return dialog;
}

export function initSearch() {
  let dialog: HTMLDialogElement | null = null;
  let active = -1;

  const items = () => [...(dialog?.querySelectorAll<HTMLAnchorElement>(".search-dialog__result") ?? [])];
  const highlight = (i: number) => {
    const list = items();
    if (!list.length) return;
    active = (i + list.length) % list.length;
    list.forEach((a, j) => a.classList.toggle("is-active", j === active));
    list[active].scrollIntoView({ block: "nearest" });
  };

  const search = async (q: string) => {
    const status = dialog!.querySelector<HTMLElement>(".search-dialog__status")!;
    const results = dialog!.querySelector<HTMLOListElement>(".search-dialog__results")!;
    if (!q.trim()) {
      status.textContent = "";
      results.replaceChildren();
      return;
    }
    const pf = await loadPagefind();
    if (!pf) {
      status.textContent = "还没有搜索索引。运行一次 make build 生成索引后即可搜索。";
      return;
    }
    const res = await pf.debouncedSearch(q, {}, 150);
    if (!res) return; // 被后续输入取代
    const data = await Promise.all(res.results.slice(0, MAX_RESULTS).map((r) => r.data()));
    status.textContent = res.results.length ? `找到 ${res.results.length} 个结果` : "没有找到相关内容";
    results.replaceChildren(...data.map((d) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "search-dialog__result";
      a.href = d.url;
      const title = document.createElement("span");
      title.className = "search-dialog__title";
      title.textContent = d.meta.title ?? d.url;
      const excerpt = document.createElement("span");
      excerpt.className = "search-dialog__excerpt";
      excerpt.innerHTML = d.excerpt; // Pagefind 已转义，只含 <mark>
      a.append(title, excerpt);
      li.append(a);
      return li;
    }));
    active = -1;
    if (data.length) highlight(0);
  };

  const open = () => {
    if (!dialog) {
      dialog = createDialog();
      const input = dialog.querySelector<HTMLInputElement>("input")!;
      input.addEventListener("input", () => search(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
        if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
        if (e.key === "Enter") {
          e.preventDefault();
          const target = items()[active];
          if (target) location.href = target.href;
        }
      });
      loadPagefind();
    }
    dialog.showModal();
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    input.select();
  };

  document.addEventListener("click", (e) => {
    if ((e.target as Element).closest('[data-action="search"]')) open();
  });
  document.addEventListener("keydown", (e) => {
    const typing = (e.target as Element).closest("input, textarea, select, [contenteditable]");
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      open();
    }
  });
}
