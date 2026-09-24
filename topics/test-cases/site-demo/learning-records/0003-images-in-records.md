---
status: active
date: 2026-09-24
tags: [demo, images]
evidence:
  source: 手动验证
---
# 学习记录里也能放图片

学习记录在 `learning-records/` 子目录里，引用主题图片要写 `../assets/`：

![示例图片](../assets/sample.svg)

frontmatter 里的 `tags`（数组）和 `evidence`（对象）不应该出现在元信息行里，只显示 `status` 和 `date`。
