"""开发服务器：每次请求都用最新的源文件实时渲染，并让浏览器在源文件变化时自动刷新。

用法：python3 scripts/serve.py [--port 8080]（通常通过 make serve 启动）
只用于本机预览；部署请用 make build 生成的纯静态 site/。
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render  # noqa: E402

RELOAD_PATH = "/__reload"
# 每秒询问一次源文件版本号，变化就刷新当前页。只在开发服务器注入，构建产物里没有。
RELOAD_SNIPPET = b"""<script>(() => {
  let version = null;
  const poll = async () => {
    try {
      const res = await fetch("/__reload", { cache: "no-store" });
      const next = await res.text();
      if (version !== null && next !== version) return location.reload();
      version = next;
    } catch (e) {}
    setTimeout(poll, 1000);
  };
  poll();
})();</script>"""


def source_version() -> str:
    """topics/、assets/ 和 TOPICS.md 的指纹：任何文件新增、删除、修改都会改变它。"""
    digest = hashlib.sha1()
    for base in (render.TOPICS_DIR, render.ASSETS_DIR):
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = sorted(d for d in dirnames if not d.startswith("."))
            for name in sorted(filenames):
                path = os.path.join(dirpath, name)
                try:
                    st = os.stat(path)
                except FileNotFoundError:
                    continue
                digest.update(f"{path}\0{st.st_mtime_ns}\0{st.st_size}\n".encode())
    if render.TOPICS_MD.exists():
        digest.update(str(render.TOPICS_MD.stat().st_mtime_ns).encode())
    return digest.hexdigest()


def error_page(title: str, message: str) -> bytes:
    return (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        f"<title>{render.esc(title)}</title>"
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<style>:root{color-scheme:light}html{background:#fbf9f3}"
        "body{font:16px/1.7 -apple-system,'PingFang SC',sans-serif;max-width:48rem;"
        "margin:4rem auto;padding:0 1.5rem;color:#222}pre{white-space:pre-wrap;background:#f0ebdf;"
        "padding:1rem 1.25rem;border-radius:4px}a{color:#9e3b1f}</style></head><body>"
        f"<h1>{render.esc(title)}</h1><pre>{render.esc(message)}</pre>"
        '<p>修改源文件后，页面会自动刷新。<a href="/">返回首页</a></p></body></html>'
    ).encode()


class Handler(BaseHTTPRequestHandler):
    server_version = "LearningDev/1.0"

    def do_GET(self):
        self.respond(with_body=True)

    def do_HEAD(self):
        self.respond(with_body=False)

    def respond(self, with_body: bool):
        path = unquote(urlsplit(self.path).path)
        if path == RELOAD_PATH:
            return self.send(200, source_version().encode(), "text/plain; charset=utf-8", with_body)

        url = path.lstrip("/")
        if url == "" or url.endswith("/"):
            url += "index.html"
        try:
            tree = render.load_tree()
            entries = render.site_map(tree)
            entry = entries.get(url)
            if entry is None:
                if f"{url}/index.html" in entries:  # 目录少了结尾的斜杠
                    return self.redirect(quote(path) + "/")
                return self.send(404, error_page("404 找不到页面", f"/{url}"),
                                 "text/html; charset=utf-8", with_body)
            data, ctype = render.render_entry(url, entry, tree)
        except render.SiteError as e:
            return self.send(500, error_page("内容不符合约定", str(e)),
                             "text/html; charset=utf-8", with_body)
        except Exception:
            return self.send(500, error_page("渲染出错", traceback.format_exc()),
                             "text/html; charset=utf-8", with_body)
        self.send(200, data, ctype, with_body)

    def send(self, code: int, data: bytes, ctype: str, with_body: bool):
        if ctype.startswith("text/html"):
            end = data.lower().rfind(b"</body>")
            data = data[:end] + RELOAD_SNIPPET + data[end:] if end >= 0 else data + RELOAD_SNIPPET
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if with_body:
            self.wfile.write(data)

    def redirect(self, location: str):
        self.send_response(301)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt, *args):
        if RELOAD_PATH not in self.path:
            super().log_message(fmt, *args)


def main():
    parser = argparse.ArgumentParser(description="学习工作区开发服务器")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    try:
        tree = render.load_tree()
        render.print_warnings(tree)
    except render.SiteError as e:
        print(f"错误：{e}", file=sys.stderr)

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as e:
        sys.exit(f"无法监听 {args.host}:{args.port}（{e}）。端口可能已被占用，"
                 f"可以用 make serve PORT=8081 换一个端口。")
    print(f"开发服务器已启动：http://localhost:{args.port}/  （Ctrl-C 停止）", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
