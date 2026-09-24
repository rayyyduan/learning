/**
 * 站点树：解析 TOPICS.md、扫描 topics/，得到分类 → 主题 → 页面的树，以及「URL → 内容来源」的站点地图。
 * 开发服务器（vite.config.ts）和静态构建（scripts/build.ts）共用本模块，保证开发时看到的就是部署后的样子。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TOPICS_DIR = path.join(ROOT, "topics");
export const TOPICS_MD = path.join(ROOT, "TOPICS.md");
export const ASSETS_DIR = path.join(ROOT, "assets");
export const SITE_NAME = "学习工作区";

export const STATUS_CLASS: Record<string, string> = { 进行中: "active", 暂停: "paused", 已完成: "done" };
export const PAGE_DIRS = { lessons: "课程", reference: "参考" } as const;
export type PageDir = keyof typeof PAGE_DIRS;

/** 「笔记」分组里固定排在前面的 Markdown，其余按文件名排在后面。MISSION.md 渲染在主题首页，不单列。 */
const NOTE_ORDER = ["NOTES.md", "GLOSSARY.md", "RESOURCES.md"];
export const MISSION_FILE = "MISSION.md";
export const RECORDS_DIR = "learning-records";

const HEADING_RE = /^#{2,6}\s+(.+?)\s*·\s*`([^`]+)`\s*$/;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const MD_TITLE_RE = /^#\s+(.+?)\s*#*\s*$/m;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]*\)/g;
const UNORDERED = Number.MAX_SAFE_INTEGER;

/** 内容不符合约定（例如主题未在 TOPICS.md 登记）。 */
export class SiteError extends Error {}

export interface Page {
  url: string; // 相对仓库根目录的 URL 路径，例如 topics/x/lessons/0001-a.html
  title: string;
  src: string; // 源文件绝对路径
}

export type NodeKind = "root" | "category" | "topic";

export interface SiteNode {
  path: string; // 相对仓库根目录，例如 topics/economics；根节点为 ""
  slug: string;
  name: string;
  kind: NodeKind;
  order: number;
  parent: SiteNode | null;
  children: SiteNode[];
  status: string;
  start: string;
  goal: string;
  pages: Record<PageDir, Page[]>;
  notes: Page[]; // 主题根目录下的 Markdown（MISSION 除外）
  records: Page[]; // learning-records/*.md
  mission: string | null; // MISSION.md 绝对路径
  warnings: string[]; // 仅根节点使用
}

export type Entry =
  | { kind: "generated"; node: SiteNode }
  | { kind: "page"; src: string; node: SiteNode }
  | { kind: "markdown"; src: string; node: SiteNode }
  | { kind: "redirect"; target: string }
  | { kind: "static"; src: string };

export function indexUrl(node: SiteNode): string {
  return node.kind === "root" ? "index.html" : `${node.path}/index.html`;
}

export function walk(node: SiteNode): SiteNode[] {
  return [node, ...node.children.flatMap(walk)];
}

export function topicsOf(node: SiteNode): SiteNode[] {
  return walk(node).filter((n) => n.kind === "topic");
}

export function ancestors(node: SiteNode): SiteNode[] {
  const chain: SiteNode[] = [];
  for (let n = node.parent; n; n = n.parent) chain.unshift(n);
  return chain;
}

export function contains(node: SiteNode, url: string): boolean {
  return node.kind === "root" || url === indexUrl(node) || url.startsWith(node.path + "/");
}

/** 主题下所有 Markdown 页面（笔记 + 学习记录），用于解析 [[wiki 链接]]。 */
export function markdownPages(node: SiteNode): Page[] {
  return [...node.notes, ...node.records];
}

// ---------------------------------------------------------------- 解析与扫描

function newNode(init: Partial<SiteNode> & Pick<SiteNode, "path" | "slug" | "name" | "kind">): SiteNode {
  return {
    order: UNORDERED, parent: null, children: [], status: "", start: "", goal: "",
    pages: { lessons: [], reference: [] }, notes: [], records: [], mission: null, warnings: [],
    ...init,
  };
}

function normDir(cell: string): string {
  let d = cell.trim().replace(/^`|`$/g, "").trim().replace(/^\/+|\/+$/g, "");
  if (d.startsWith("topics/")) d = d.slice("topics/".length);
  return d;
}

function plain(cell: string): string {
  return cell.replace(MD_LINK_RE, "$1").trim().replace(/^[*_`]+|[*_`]+$/g, "").trim();
}

interface TopicMeta { name: string; status: string; start: string; goal: string; order: number }

/** 返回分类（路径 → [中文名, 顺序]）和主题（路径 → 元数据），路径相对于 topics/。 */
export function parseTopicsMd() {
  const categories = new Map<string, [string, number]>();
  const topics = new Map<string, TopicMeta>();
  if (!fs.existsSync(TOPICS_MD)) return { categories, topics };
  fs.readFileSync(TOPICS_MD, "utf8").split(/\r?\n/).forEach((raw, order) => {
    const line = raw.trim();
    const m = HEADING_RE.exec(line);
    if (m) {
      categories.set(normDir(m[2]), [m[1].trim(), order]);
      return;
    }
    if (!line.startsWith("|")) return;
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.length < 5) return;
    const [name, directory, status, start, goal] = cells;
    const dir = normDir(directory);
    if (!dir || name === "主题" || /^[-:\s]*$/.test(name)) return;
    topics.set(dir, { name: plain(name), status, start, goal, order });
  });
  return { categories, topics };
}

const visible = (name: string) => !name.startsWith(".");

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && visible(e.name) && e.name.toLowerCase().endsWith(ext))
    .map((e) => e.name)
    .sort();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function htmlTitle(file: string): string {
  const m = TITLE_RE.exec(fs.readFileSync(file, "utf8"));
  const title = m ? decodeEntities(m[1].replace(/\s+/g, " ")).trim() : "";
  return title || path.basename(file, path.extname(file));
}

/** Markdown 的标题：第一个一级标题（去掉行内标记），没有就用文件名。 */
export function markdownTitle(file: string): string {
  const source = fs.readFileSync(file, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const m = MD_TITLE_RE.exec(source);
  const title = m ? m[1].replace(MD_LINK_RE, "$1").replace(/[*_`~]/g, "").trim() : "";
  return title || path.basename(file, ".md");
}

export function mdUrl(rel: string): string {
  return rel.replace(/\.md$/i, ".html");
}

function scanTopic(dir: string, node: SiteNode) {
  for (const sub of Object.keys(PAGE_DIRS) as PageDir[]) {
    node.pages[sub] = listFiles(path.join(dir, sub), ".html").map((f) => ({
      url: `${node.path}/${sub}/${f}`,
      title: htmlTitle(path.join(dir, sub, f)),
      src: path.join(dir, sub, f),
    }));
  }
  const rootMd = listFiles(dir, ".md");
  if (rootMd.includes(MISSION_FILE)) node.mission = path.join(dir, MISSION_FILE);
  const rank = (f: string) => (NOTE_ORDER.includes(f) ? NOTE_ORDER.indexOf(f) : NOTE_ORDER.length);
  node.notes = rootMd
    .filter((f) => f !== MISSION_FILE)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((f) => ({ url: mdUrl(`${node.path}/${f}`), title: markdownTitle(path.join(dir, f)), src: path.join(dir, f) }));
  node.records = listFiles(path.join(dir, RECORDS_DIR), ".md").map((f) => ({
    url: mdUrl(`${node.path}/${RECORDS_DIR}/${f}`),
    title: markdownTitle(path.join(dir, RECORDS_DIR, f)),
    src: path.join(dir, RECORDS_DIR, f),
  }));
}

export function loadTree(): SiteNode {
  const { categories, topics } = parseTopicsMd();
  const root = newNode({ path: "", slug: "", name: SITE_NAME, kind: "root" });
  const seen = new Set<string>();

  const scan = (directory: string, parent: SiteNode) => {
    const dirs = fs.readdirSync(directory, { withFileTypes: true })
      .filter((e) => e.isDirectory() && visible(e.name))
      .map((e) => e.name)
      .sort();
    for (const name of dirs) {
      const child = path.join(directory, name);
      const rel = path.relative(TOPICS_DIR, child).split(path.sep).join("/");
      const nodePath = `topics/${rel}`;
      let node: SiteNode;
      if (fs.existsSync(path.join(child, MISSION_FILE))) {
        const meta = topics.get(rel);
        if (!meta) {
          throw new SiteError(
            `主题目录 ${nodePath}/ 有 MISSION.md，但没有在 TOPICS.md 中登记。` +
            `请在对应分类的表格里加一行，「目录」列写 \`${rel}/\`。`,
          );
        }
        seen.add(rel);
        node = newNode({ path: nodePath, slug: name, name: meta.name, kind: "topic", order: meta.order, parent,
          status: meta.status, start: meta.start, goal: meta.goal });
        scanTopic(child, node);
      } else {
        const [catName, order] = categories.get(rel) ?? [name, UNORDERED];
        node = newNode({ path: nodePath, slug: name, name: catName, kind: "category", order, parent });
        scan(child, node);
      }
      parent.children.push(node);
    }
    parent.children.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  };

  if (fs.existsSync(TOPICS_DIR)) scan(TOPICS_DIR, root);
  for (const rel of topics.keys()) {
    if (!seen.has(rel)) root.warnings.push(`TOPICS.md 登记了 ${rel}/，但 topics/${rel}/MISSION.md 不存在，已跳过。`);
  }
  return root;
}

/** assets/ 下要发布的文件：跳过隐藏文件和 Markdown（例如说明用的 README.md）。 */
function staticFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!visible(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...staticFiles(p));
    else if (e.isFile() && !e.name.toLowerCase().endsWith(".md")) out.push(p);
  }
  return out.sort();
}

const toUrl = (abs: string) => path.relative(ROOT, abs).split(path.sep).join("/");

/** 所有要发布的 URL → 内容来源。开发服务器和构建都以此为准。 */
export function siteMap(tree: SiteNode): Map<string, Entry> {
  const entries = new Map<string, Entry>([
    ["index.html", { kind: "generated", node: tree }],
    ["topics/index.html", { kind: "redirect", target: "../index.html" }],
  ]);
  for (const node of walk(tree)) {
    if (node.kind === "root") continue;
    entries.set(indexUrl(node), { kind: "generated", node });
    if (node.kind !== "topic") continue;
    for (const page of [...node.pages.lessons, ...node.pages.reference]) {
      entries.set(page.url, { kind: "page", src: page.src, node });
    }
    for (const page of markdownPages(node)) entries.set(page.url, { kind: "markdown", src: page.src, node });
    for (const f of staticFiles(path.join(ROOT, node.path, "assets"))) entries.set(toUrl(f), { kind: "static", src: f });
  }
  for (const f of staticFiles(ASSETS_DIR)) entries.set(toUrl(f), { kind: "static", src: f });
  return entries;
}
