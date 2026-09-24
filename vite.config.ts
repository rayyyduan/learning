/**
 * Vite 配置。
 * - 开发（pnpm dev / make serve）：中间件按请求用最新源文件实时渲染页面；topics/、assets/、TOPICS.md 一变，浏览器整页刷新。
 * - 构建：这里只打包浏览器端脚本（scripts/client/）到 site/_app/，页面由 scripts/build.ts 渲染。
 */

import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { loadTree, siteMap, ROOT, SiteError, TOPICS_MD } from "./scripts/site/tree.ts";
import { esc, printWarnings, renderEntry, MIME } from "./scripts/site/render.ts";

const PORT = Number(process.env.PORT ?? 8080);

function errorPage(title: string, message: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><script type="module" src="/@vite/client"></script>' +
    "<style>:root{color-scheme:light}html{background:#fbf9f3}" +
    "body{font:16px/1.7 -apple-system,'PingFang SC',sans-serif;max-width:48rem;margin:4rem auto;padding:0 1.5rem;color:#222}" +
    "pre{white-space:pre-wrap;background:#f0ebdf;padding:1rem 1.25rem;border-radius:4px}a{color:#9e3b1f}</style></head><body>" +
    `<h1>${esc(title)}</h1><pre>${esc(message)}</pre><p>修改源文件后，页面会自动刷新。<a href="/">返回首页</a></p></body></html>`;
}

function learningSite(): Plugin {
  return {
    name: "learning-site",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      try {
        printWarnings(loadTree());
      } catch (e) {
        if (e instanceof SiteError) console.error(`错误：${e.message}`);
        else throw e;
      }

      const watched = (file: string) => {
        const r = path.relative(ROOT, file);
        return file === TOPICS_MD || r.startsWith("topics" + path.sep) || r.startsWith("assets" + path.sep);
      };
      server.watcher.on("all", (_event, file) => {
        if (watched(file)) server.ws.send({ type: "full-reload", path: "*" });
      });

      server.middlewares.use(async (req, res, next) => {
        const send = (code: number, data: string | Buffer, type: string) => {
          res.statusCode = code;
          res.setHeader("Content-Type", type);
          res.setHeader("Cache-Control", "no-store");
          res.end(data);
        };
        const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);

        // 搜索索引只在构建时生成；开发时使用上一次 make build 的结果
        if (pathname.startsWith("/pagefind/")) {
          const file = path.join(ROOT, "site", pathname);
          if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            return send(200, fs.readFileSync(file), MIME[path.extname(file)] ?? "application/octet-stream");
          }
          return send(404, "", "text/plain");
        }

        let url = pathname.replace(/^\/+/, "");
        if (url === "" || url.endsWith("/")) url += "index.html";
        const isPage = url.endsWith(".html");
        try {
          const tree = loadTree();
          const entries = siteMap(tree);
          const entry = entries.get(url);
          if (!entry) {
            if (entries.has(`${url}/index.html`)) {
              res.statusCode = 301;
              res.setHeader("Location", pathname + "/");
              return res.end();
            }
            // 其余请求（/scripts/client/*.ts、/node_modules/…、/@vite/…）交给 Vite
            if (isPage && !url.startsWith("@")) return send(404, errorPage("404 找不到页面", `/${url}`), MIME[".html"]);
            return next();
          }
          const { data, type } = await renderEntry(url, entry, tree, "dev");
          return send(200, data, type);
        } catch (e) {
          if (e instanceof SiteError) return send(500, errorPage("内容不符合约定", e.message), MIME[".html"]);
          return send(500, errorPage("渲染出错", e instanceof Error ? e.stack ?? e.message : String(e)), MIME[".html"]);
        }
      });
    },
  };
}

export default defineConfig({
  root: ROOT,
  base: "./",
  appType: "custom",
  publicDir: false,
  clearScreen: false,
  plugins: [learningSite()],
  server: { host: "127.0.0.1", port: PORT, strictPort: true },
  optimizeDeps: {
    entries: ["scripts/client/main.ts"],
    include: ["medium-zoom", "mermaid"],
  },
  build: {
    outDir: "site",
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      input: path.join(ROOT, "scripts/client/main.ts"),
      output: {
        entryFileNames: "_app/client.js",
        chunkFileNames: "_app/chunks/[name]-[hash].js",
        assetFileNames: "_app/[name]-[hash][extname]",
      },
    },
    chunkSizeWarningLimit: 4096,
  },
});
