/**
 * 浏览器端入口：由渲染脚本注入到每个页面（开发时是 /scripts/client/main.ts，构建后是 _app/client.js）。
 * 课程页面不需要自己引用它。
 */

import { initSidebar, toggleSidebar } from "./sidebar.ts";
import { initToolbar } from "./toolbar.ts";
import { initSearch } from "./search.ts";
import { initEnhance } from "./enhance.ts";

initSidebar();
initToolbar();
initSearch();
initEnhance();

document.addEventListener("keydown", (e) => {
  if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
  if ((e.target as Element).closest("input, textarea, select, [contenteditable]")) return;
  e.preventDefault();
  toggleSidebar();
});
