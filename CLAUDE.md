# 学习工作区

这个仓库是我的个人学习专用目录。学习主要通过 `/teach` skill 进行，每个学习主题是一个独立的教学工作区。

所有课程和参考文档会汇总成一个静态网站：左侧是全站目录，右侧是内容。网站可以在本地预览，也可以按原目录结构直接部署到服务器。

## 目录结构

```
learning/
├── CLAUDE.md                      # 本文件：全局约定
├── TOPICS.md                      # 分类与主题索引（也是网站目录显示名的来源）
├── Makefile                       # make serve / build / deploy
├── assets/                        # 全站共享
│   ├── site.css                   # 全站唯一样式表，同时也是设计规范
│   └── vendor/                    # 第三方库（本地存放，不走 CDN）
├── scripts/                       # render.py 渲染核心 / serve.py 开发服务器 / build.py 构建
├── site/                          # 构建产物（git 已忽略，不要手动编辑）
└── topics/
    ├── economics/                 # 分类：经济学
    ├── history/                   # 分类：历史
    └── computer-science/          # 分类：计算机
        ├── fundamentals/          # 子分类或主题：计算机基础
        └── algorithms/            # 子分类或主题：算法
            └── <topic-slug>/      # 主题 = 一个 teach 工作区
                ├── MISSION.md
                ├── RESOURCES.md
                ├── NOTES.md
                ├── GLOSSARY.md（如需要）
                ├── learning-records/0001-*.md
                ├── lessons/0001-*.html
                ├── reference/*.html
                └── assets/*       # 只放本主题专属的组件、图片
```

## 分类与主题

`topics/` 下是一棵分类树，分类可以任意嵌套。有两种目录：

- **分类目录**：只用来归类，里面只放子目录，不放任何 teach 文件。
- **主题目录**（teach 工作区）：包含 `MISSION.md` 的目录。**主题目录下面不能再嵌套主题或分类。**

一个目录是分类还是主题，由学习目标的粒度决定。如果目标是「刷 LeetCode 准备面试」，`algorithms/` 本身就可以作为主题；如果想分开学「动态规划」「图论」，`algorithms/` 就是分类，下面分别建主题。拿不准时问我。

命名规则：目录一律用简短的 kebab-case 英文（如 `computer-science`、`dynamic-programming`），中文名称写在 `TOPICS.md` 中。

## 调用 `/teach` 时的约定（重要）

`/teach` skill 默认把「当前目录」当作单一主题的工作区。这里有多个主题，所以：

- **skill 里所有相对路径（`MISSION.md`、`./lessons/` 等）都相对于主题目录（如 `topics/computer-science/algorithms/dynamic-programming/`），而不是仓库根目录或分类目录。**
- 先确定主题：
  - 参数明确对应 `TOPICS.md` 里已有的主题：进入该主题目录继续学习。
  - 是新主题：判断它属于哪个分类（需要时新建分类），创建主题目录，并在 `TOPICS.md` 中登记。分类归属不明显时，先给出建议路径让我确认。
  - 不确定：列出相关的已有主题问我。
- 继续已有主题前，先读该主题的 `MISSION.md`、`NOTES.md` 和最近的 `learning-records/`，再决定下一课。
- 每个主题的学习记录只写在自己的目录里。但判断最近发展区时，可以参考同一分类下相关主题的学习记录（例如学算法时参考计算机基础的进度），课程之间也可以用相对路径互相链接。
- **样式、组件和导航遵循本文件的「设计与样式」「网站」两节，优先于 skill 里「每个工作区自建共享样式表」的做法。** skill 要求的「先读 `./assets/`、优先复用组件」同样适用，但要先读根目录的 `assets/`。

## 设计与样式

- 全站只有一份样式表：根目录的 `assets/site.css`。它开头的注释就是设计规范，写明了使用规则、token 和组件清单。**生成或修改任何 HTML 前先读它。**
- 所有页面都用相对路径链接它。层级按实际深度计算，例如 `topics/a/b/<slug>/lessons/x.html` 要写 `../../../../../assets/site.css`。
- 颜色、字体、字号、间距、栏宽一律用 `site.css` 里的 token，并优先使用已有的组件类，如 `callout`、`quiz`、`sidenote`。
- 课程只允许在自己的 `<style>` 里写本课专属的少量样式。不得重新定义 token，也不得覆盖全局样式。
- 可复用的新样式加进 `site.css`。可复用的新组件（测验逻辑、图示辅助、模拟器等）放到根目录 `assets/`，并在 `site.css` 的组件清单里登记。不要把它们内联在单个课程里。
- 主题下的 `assets/` 只放本主题专属的东西。**不要为主题新建或复制样式表。**
- 不依赖在线 CDN。需要第三方库（如 KaTeX）时，把它的发布文件下载到 `assets/vendor/<库名>/`，并在 `assets/vendor/README.md` 里登记版本、来源和许可证。

## 网站

- **布局**：每个页面左侧是全站目录树（分类、主题，再到课程和参考），右侧是内容。
- **自动生成的部分**：目录树，以及根目录、每个分类、每个主题的 `index.html` 首页，都由 `scripts/render.py` 在渲染时自动生成并注入。**不要在课程里手写全站导航，也不要自己创建 `index.html`。**
- **显示名的来源**：分类名、主题名、状态和一句话目标取自 `TOPICS.md`，课程和参考文档的名称取自页面的 `<title>`。所以 `<title>` 要简短，能在目录里一眼认出是哪一课。
- **哪些内容会发布**：
  - `topics/**/lessons/*.html`
  - `topics/**/reference/*.html`
  - 根目录和各主题的 `assets/`
  - 自动生成的首页

  Markdown 文件（MISSION、NOTES、学习记录等）不会上线。
- **URL 和源路径一一对应**：例如 `topics/computer-science/algorithms/dp/lessons/0001-intro.html` 对应 `http://localhost:8080/topics/computer-science/algorithms/dp/lessons/0001-intro.html`。
- **命令**：
  - `make serve`：启动开发服务器，地址是 http://localhost:8080 ，只监听本机。每次请求都用最新的源文件实时渲染，源文件一变，页面就自动刷新；新增课程后，目录会立即更新。
  - `make build`：生成纯静态的 `site/`，用于部署。
  - `make deploy DEPLOY_TARGET=user@host:/path`：先构建，再用 rsync 上传。
- **登记检查**：如果某个目录有 `MISSION.md`，却没有在 `TOPICS.md` 中登记，渲染会报错：浏览器里显示错误页，`make build` 失败。

## 语言

- 课程、参考文档、学习记录、笔记一律用简体中文撰写。
- 专业术语、代码、命令、API 名称保留原文；术语首次出现时可附中文解释，例如「所有权（ownership）」。
- 引用的外部资料可以是英文，但要优先寻找高质量的资料，不论语言。

## 课程与文件

- **页面结构**：
  - 用 `<html lang="zh-CN">`。
  - `<head>` 里要有 `charset`、`viewport`、`<title>`，以及指向 `site.css` 的链接。
  - `<body>` 里只放一个 `<article>`，正文写在里面。
- 课程中的交叉链接（到其他课程、参考文档、其他主题）一律用相对路径，保证整站放到任何路径下、或者直接打开源文件时，链接都有效。
- **生成或修改课程后**：
  1. 用 `curl -sf http://localhost:8080/__reload` 检查开发服务器是否在运行。如果没有，在后台启动 `make serve`。
  2. 用 `open http://localhost:8080/topics/<主题路径>/lessons/<file>.html` 在浏览器中打开。
  3. 如果页面显示错误（例如主题没有登记），先修复再继续。

## `TOPICS.md` 维护

- 每次新建主题、主题状态变化（进行中 / 暂停 / 已完成），或主题的 mission 发生变化时，都要同步更新 `TOPICS.md`。
- 它的格式会被脚本解析，写法以文件开头的「格式约定」为准：
  - 分类标题固定为 ``## 中文名 · `路径/` ``；
  - 「目录」列写相对于 `topics/` 的完整路径。

## Git

- 这是个人学习仓库，每次课程结束后可以提议提交，但只有我同意后才提交。
- 提交信息用中文，格式：`<topic-slug>: <做了什么>`，例如 `rust-ownership: 新增第 3 课 借用规则`。
