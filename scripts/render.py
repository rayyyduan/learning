"""渲染核心：解析 TOPICS.md、扫描 topics/，生成站点地图并渲染每个页面。

serve.py（开发服务器）和 build.py（静态构建）共用本模块，
保证开发时看到的就是部署后的样子。只依赖 Python 标准库。
"""

from __future__ import annotations

import html
import mimetypes
import posixpath
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS_DIR = ROOT / "topics"
TOPICS_MD = ROOT / "TOPICS.md"
ASSETS_DIR = ROOT / "assets"
SITE_CSS = "assets/site.css"
SITE_NAME = "学习工作区"

STATUS_CLASS = {"进行中": "active", "暂停": "paused", "已完成": "done"}
PAGE_DIRS = {"lessons": "课程", "reference": "参考"}

HEADING_RE = re.compile(r"^#{2,6}\s+(.+?)\s*·\s*`([^`]+)`\s*$")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
BODY_OPEN_RE = re.compile(r"<body\b[^>]*>", re.I)
HEAD_CLOSE_RE = re.compile(r"</head\s*>", re.I)
MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")

UNORDERED = 10**9


class SiteError(Exception):
    """内容不符合约定（例如主题未在 TOPICS.md 登记）。"""


@dataclass
class Page:
    path: str  # 相对仓库根目录的 URL 路径
    title: str


@dataclass
class Node:
    path: str  # 相对仓库根目录，例如 topics/economics；根节点为 ""
    slug: str
    name: str
    kind: str  # root | category | topic
    order: int = UNORDERED
    parent: Node | None = None
    children: list[Node] = field(default_factory=list)
    status: str = ""
    start: str = ""
    goal: str = ""
    pages: dict[str, list[Page]] = field(default_factory=dict)  # lessons / reference
    warnings: list[str] = field(default_factory=list)  # 仅根节点使用

    @property
    def index(self) -> str:
        return "index.html" if self.kind == "root" else f"{self.path}/index.html"

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def topics(self):
        return [n for n in self.walk() if n.kind == "topic"]

    def ancestors(self):
        chain, node = [], self.parent
        while node is not None:
            chain.append(node)
            node = node.parent
        return list(reversed(chain))

    def contains(self, url: str) -> bool:
        return self.kind == "root" or url == self.index or url.startswith(self.path + "/")


@dataclass
class Entry:
    kind: str  # generated | page | redirect | static
    node: Node | None = None
    src: Path | None = None
    target: str = ""


# ---------------------------------------------------------------- 解析与扫描


def _norm_dir(cell: str) -> str:
    d = cell.strip().strip("`").strip().strip("/")
    return d[len("topics/"):] if d.startswith("topics/") else d


def _plain(cell: str) -> str:
    return MD_LINK_RE.sub(r"\1", cell).strip().strip("*_`").strip()


def parse_topics_md():
    """返回 (分类: {路径: (中文名, 顺序)}, 主题: {路径: 元数据})，路径相对于 topics/。"""
    categories, topics = {}, {}
    if not TOPICS_MD.exists():
        return categories, topics
    for order, line in enumerate(TOPICS_MD.read_text(encoding="utf-8").splitlines()):
        line = line.strip()
        m = HEADING_RE.match(line)
        if m:
            categories[_norm_dir(m.group(2))] = (m.group(1).strip(), order)
            continue
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 5:
            continue
        name, directory, status, start, goal = cells[:5]
        directory = _norm_dir(directory)
        if not directory or name == "主题" or set(name) <= set("-: "):
            continue
        topics[directory] = {
            "name": _plain(name),
            "status": status,
            "start": start,
            "goal": goal,
            "order": order,
        }
    return categories, topics


def _page_title(path: Path) -> str:
    m = TITLE_RE.search(path.read_text(encoding="utf-8", errors="replace"))
    title = html.unescape(re.sub(r"\s+", " ", m.group(1))).strip() if m else ""
    return title or path.stem


def _visible(path: Path) -> bool:
    return not path.name.startswith(".")


def load_tree() -> Node:
    categories, topics_meta = parse_topics_md()
    root = Node(path="", slug="", name=SITE_NAME, kind="root")
    seen = set()

    def scan(directory: Path, parent: Node):
        for child in sorted(p for p in directory.iterdir() if p.is_dir() and _visible(p)):
            rel = child.relative_to(TOPICS_DIR).as_posix()
            path = f"topics/{rel}"
            if (child / "MISSION.md").exists():
                meta = topics_meta.get(rel)
                if meta is None:
                    raise SiteError(
                        f"主题目录 {path}/ 有 MISSION.md，但没有在 TOPICS.md 中登记。"
                        f"请在对应分类的表格里加一行，「目录」列写 `{rel}/`。"
                    )
                seen.add(rel)
                node = Node(path=path, slug=child.name, name=meta["name"], kind="topic",
                            order=meta["order"], parent=parent, status=meta["status"],
                            start=meta["start"], goal=meta["goal"])
                for sub in PAGE_DIRS:
                    files = sorted((child / sub).glob("*.html")) if (child / sub).is_dir() else []
                    node.pages[sub] = [
                        Page(f"{path}/{sub}/{f.name}", _page_title(f)) for f in files if _visible(f)
                    ]
            else:
                name, order = categories.get(rel, (child.name, UNORDERED))
                node = Node(path=path, slug=child.name, name=name, kind="category",
                            order=order, parent=parent)
                scan(child, node)
            parent.children.append(node)
        parent.children.sort(key=lambda n: (n.order, n.slug))

    if TOPICS_DIR.is_dir():
        scan(TOPICS_DIR, root)
    for rel in topics_meta:
        if rel not in seen:
            root.warnings.append(f"TOPICS.md 登记了 {rel}/，但 topics/{rel}/MISSION.md 不存在，已跳过。")
    return root


def _static_files(directory: Path):
    """assets/ 下要发布的文件：跳过隐藏文件和 Markdown（Markdown 一律不上线）。"""
    if not directory.is_dir():
        return []
    return sorted(
        p for p in directory.rglob("*")
        if p.is_file() and p.suffix.lower() != ".md"
        and all(_visible(Path(part)) for part in p.relative_to(ROOT).parts)
    )


def site_map(tree: Node) -> dict[str, Entry]:
    """所有要发布的 URL → 内容来源。开发服务器和构建都以此为准。"""
    entries = {
        "index.html": Entry("generated", node=tree),
        "topics/index.html": Entry("redirect", target="../index.html"),
    }
    for node in tree.walk():
        if node.kind == "root":
            continue
        entries[node.index] = Entry("generated", node=node)
        if node.kind == "topic":
            for pages in node.pages.values():
                for page in pages:
                    entries[page.path] = Entry("page", src=ROOT / page.path)
            for f in _static_files(ROOT / node.path / "assets"):
                entries[f.relative_to(ROOT).as_posix()] = Entry("static", src=f)
    for f in _static_files(ASSETS_DIR):
        entries[f.relative_to(ROOT).as_posix()] = Entry("static", src=f)
    return entries


# ---------------------------------------------------------------- 渲染


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def rel(target: str, current: str) -> str:
    """从 current 页面指向 target 的相对路径，保证整站可放在任意子路径下、也能离线打开。"""
    return posixpath.relpath(target, posixpath.dirname(current) or ".")


def status_badge(status: str) -> str:
    if not status:
        return ""
    return f'<span class="status status--{STATUS_CLASS.get(status, "other")}">{esc(status)}</span>'


def sidebar(tree: Node, current: str) -> str:
    def link(target: str, text: str, cls: str = "nav-link") -> str:
        here = ' aria-current="page"' if target == current else ""
        return f'<a class="{cls}" href="{esc(rel(target, current))}"{here}>{esc(text)}</a>'

    def item(node: Node) -> str:
        classes = f"nav-{node.kind}" + ("" if node.topics() else " is-empty")
        if node.kind == "topic":
            body = ""
            for sub, label in PAGE_DIRS.items():
                if node.pages[sub]:
                    body += f'<li class="nav-group">{label}</li>'
                    body += "".join(f"<li>{link(p.path, p.title)}</li>" for p in node.pages[sub])
        else:
            body = "".join(item(child) for child in node.children)
        head = link(node.index, node.name) + status_badge(node.status)
        if not body:
            return f'<li class="{classes}"><div class="nav-row nav-row--leaf">{head}</div></li>'
        is_open = node.kind == "category" or node.contains(current)
        return (f'<li class="{classes}"><details{" open" if is_open else ""}>'
                f'<summary class="nav-row">{head}</summary><ul>{body}</ul></details></li>')

    return (
        '<nav class="site-nav" aria-label="全站目录">'
        f'{link("index.html", SITE_NAME, "site-nav__brand")}'
        '<input type="checkbox" id="site-nav-toggle" class="site-nav__toggle">'
        '<label for="site-nav-toggle" class="site-nav__toggle-label">目录</label>'
        f'<ul class="nav-tree">{"".join(item(child) for child in tree.children)}</ul>'
        "</nav>"
    )


def wrap_layout(tree: Node, current: str, content: str) -> str:
    return (f'<div class="site-layout">{sidebar(tree, current)}'
            f'<main class="site-main">{content}</main></div>')


def inject(source: str, current: str, tree: Node) -> str:
    """把全站目录注入课程/参考页面；页面缺少全局样式表时顺便补上。"""
    if "site.css" not in source:
        tag = f'<link rel="stylesheet" href="{esc(rel(SITE_CSS, current))}">'
        m = HEAD_CLOSE_RE.search(source)
        source = source[:m.start()] + tag + source[m.start():] if m else tag + source
    m = BODY_OPEN_RE.search(source)
    end = source.lower().rfind("</body")
    if not m:
        return wrap_layout(tree, current, source)
    if end < m.end():
        end = len(source)
    return (source[:m.end()] + wrap_layout(tree, current, source[m.end():end])
            + source[end:])


def document(tree: Node, current: str, title: str, article: str) -> str:
    return (
        '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta name="color-scheme" content="light dark">\n'
        f"<title>{esc(title)}</title>\n"
        f'<link rel="stylesheet" href="{esc(rel(SITE_CSS, current))}">\n'
        "</head>\n<body>\n"
        f"{wrap_layout(tree, current, f'<article>{article}</article>')}\n"
        "</body>\n</html>\n"
    )


def _breadcrumb(node: Node, current: str) -> str:
    crumbs = [f'<a href="{esc(rel(a.index, current))}">{esc(a.name)}</a>' for a in node.ancestors()]
    return f'<p class="breadcrumb">{" / ".join(crumbs)}</p>' if crumbs else ""


def _topic_table(topics: list[Node], current: str) -> str:
    if not topics:
        return '<p class="muted">暂无主题。</p>'
    rows = "".join(
        "<tr>"
        f'<td><a href="{esc(rel(t.index, current))}">{esc(t.name)}</a></td>'
        f"<td>{status_badge(t.status)}</td>"
        f"<td>{esc(t.start)}</td>"
        f"<td>{len(t.pages['lessons'])}</td>"
        f"<td>{esc(t.goal)}</td>"
        "</tr>"
        for t in topics
    )
    return ('<table class="fullwidth topic-table"><thead><tr><th>主题</th><th>状态</th>'
            f"<th>开始日期</th><th>课程</th><th>一句话目标</th></tr></thead><tbody>{rows}</tbody></table>")


def _sections(node: Node, current: str, level: int) -> str:
    """分类下直属主题的表格，以及子分类的小节（逐级递归）。"""
    direct = [c for c in node.children if c.kind == "topic"]
    subs = [c for c in node.children if c.kind == "category"]
    out = _topic_table(direct, current) if direct or not subs else ""
    h = min(level, 6)
    for sub in subs:
        out += (f'<section><h{h}><a href="{esc(rel(sub.index, current))}">{esc(sub.name)}</a></h{h}>'
                f"{_sections(sub, current, level + 1)}</section>")
    return out


def _page_list(pages: list[Page], current: str, tag: str) -> str:
    if not pages:
        return '<p class="muted">暂无。</p>'
    items = "".join(f'<li><a href="{esc(rel(p.path, current))}">{esc(p.title)}</a></li>' for p in pages)
    return f'<{tag} class="page-list">{items}</{tag}>'


def generated_page(node: Node, current: str, tree: Node) -> str:
    if node.kind == "root":
        body = (f"<h1>{esc(SITE_NAME)}</h1>"
                '<p class="subtitle">所有学习主题一览。左侧目录可以逐级浏览分类、主题和课程。</p>'
                + _sections(node, current, 2))
        return document(tree, current, SITE_NAME, body)
    if node.kind == "category":
        body = (_breadcrumb(node, current) + f"<h1>{esc(node.name)}</h1>"
                + _sections(node, current, 2))
        return document(tree, current, f"{node.name} · {SITE_NAME}", body)
    meta = " · ".join(filter(None, [status_badge(node.status),
                                    f"开始于 {esc(node.start)}" if node.start else ""]))
    body = (_breadcrumb(node, current) + f"<h1>{esc(node.name)}</h1>"
            + (f'<p class="meta">{meta}</p>' if meta else "")
            + (f'<p class="subtitle">{esc(node.goal)}</p>' if node.goal else "")
            + "<h2>课程</h2>" + _page_list(node.pages["lessons"], current, "ol")
            + "<h2>参考</h2>" + _page_list(node.pages["reference"], current, "ul"))
    return document(tree, current, f"{node.name} · {SITE_NAME}", body)


def redirect_page(target: str) -> str:
    t = esc(target)
    return (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            f'<meta http-equiv="refresh" content="0; url={t}"><title>跳转中</title></head>'
            f'<body><a href="{t}">跳转到首页</a></body></html>')


def render_entry(url: str, entry: Entry, tree: Node) -> tuple[bytes, str]:
    """返回 (内容, Content-Type)。"""
    html_type = "text/html; charset=utf-8"
    if entry.kind == "static":
        ctype = mimetypes.guess_type(entry.src.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
            ctype += "; charset=utf-8"
        return entry.src.read_bytes(), ctype
    if entry.kind == "redirect":
        return redirect_page(entry.target).encode(), html_type
    if entry.kind == "page":
        source = entry.src.read_text(encoding="utf-8")
        return inject(source, url, tree).encode(), html_type
    return generated_page(entry.node, url, tree).encode(), html_type


def print_warnings(tree: Node) -> None:
    for w in tree.warnings:
        print(f"警告：{w}", file=sys.stderr)
