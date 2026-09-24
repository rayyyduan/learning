# 学习工作区

这个仓库是我的个人学习专用目录。学习主要通过 `/teach` skill 进行，每个学习主题是一个独立的教学工作区。

## 目录结构

```
learning/
├── CLAUDE.md                      # 本文件：全局约定
├── TOPICS.md                      # 分类与主题索引
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
                └── assets/*
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
  - 参数明确对应 `TOPICS.md` 里已有的主题 → 进入该主题目录继续学习。
  - 是新主题 → 判断它属于哪个分类（需要时新建分类），创建主题目录，并在 `TOPICS.md` 中登记。分类归属不明显时，先给出建议路径让我确认。
  - 不确定 → 列出相关的已有主题问我。
- 继续已有主题前，先读该主题的 `MISSION.md`、`NOTES.md` 和最近的 `learning-records/`，再决定下一课。
- 每个主题的学习记录只写在自己的目录里。但判断最近发展区时，可以参考同一分类下相关主题的学习记录（例如学算法时参考计算机基础的进度），课程之间也可以用相对路径互相链接。
- 新主题的 `assets/` 可以复制已有主题的样式表作为起点，保持整体风格一致。

## 语言

- 课程、参考文档、学习记录、笔记一律用简体中文撰写。
- 专业术语、代码、命令、API 名称保留原文；术语首次出现时可附中文解释，例如「所有权（ownership）」。
- 引用的外部资料可以是英文，但要优先寻找高质量的资料，不论语言。

## 课程与文件

- 生成课程后，用 `open topics/<slug>/lessons/<file>.html` 在浏览器中打开。
- 课程中的交叉链接使用相对路径，保证整个目录移动后链接仍然有效。
- HTML 课程应自包含或只依赖本主题 `assets/` 下的文件，避免依赖在线 CDN，以便离线复习。

## `TOPICS.md` 维护

每次新建主题、主题状态变化（进行中 / 暂停 / 已完成），或主题的 mission 发生变化时，同步更新 `TOPICS.md`。

## Git

- 这是个人学习仓库，每次课程结束后可以提议提交，但只有我同意后才提交。
- 提交信息用中文，格式：`<topic-slug>: <做了什么>`，例如 `rust-ownership: 新增第 3 课 借用规则`。
