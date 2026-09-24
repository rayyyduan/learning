/**
 * 静态构建：生成可以直接部署的 site/，目录结构与源目录一致。
 *
 * 1. Vite 打包浏览器端脚本到 site/_app/
 * 2. 渲染站点地图里的所有页面，复制 assets/
 * 3. 复制 KaTeX 样式和字体（只有含公式的页面会引用）
 * 4. Pagefind 生成全文搜索索引到 site/pagefind/
 *
 * 用法：pnpm build（通常通过 make build 调用）
 */

import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
import * as pagefind from "pagefind";
import { loadTree, siteMap, ROOT, SiteError } from "./site/tree.ts";
import { printWarnings, renderEntry, KATEX_CSS } from "./site/render.ts";

const OUT = path.join(ROOT, "site");

async function main() {
  let tree, entries;
  try {
    tree = loadTree();
    entries = siteMap(tree);
  } catch (e) {
    if (e instanceof SiteError) {
      console.error(`错误：${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  printWarnings(tree);

  await build({ configFile: path.join(ROOT, "vite.config.ts"), logLevel: "warn" });

  for (const [url, entry] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    const { data } = await renderEntry(url, entry, tree, "build");
    const target = path.join(OUT, url);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }

  const katexDist = path.join(ROOT, "node_modules/katex/dist");
  const katexOut = path.dirname(path.join(OUT, KATEX_CSS));
  fs.mkdirSync(katexOut, { recursive: true });
  fs.copyFileSync(path.join(katexDist, "katex.min.css"), path.join(katexOut, "katex.min.css"));
  fs.cpSync(path.join(katexDist, "fonts"), path.join(katexOut, "fonts"), { recursive: true });

  const { index, errors } = await pagefind.createIndex({});
  if (!index) throw new Error(`Pagefind 初始化失败：${errors.join("; ")}`);
  const added = await index.addDirectory({ path: OUT });
  if (added.errors.length) throw new Error(`Pagefind 建索引失败：${added.errors.join("; ")}`);
  await index.writeFiles({ outputPath: path.join(OUT, "pagefind") });
  await pagefind.close();

  console.log(`已生成 ${entries.size} 个页面和文件到 site/，搜索索引收录 ${added.page_count} 个页面。`);
}

await main();
