# 教学备忘

- 2026-09-24：目标是详细学 `dumpsys meminfo` 和读懂它所需的内存概念。已有基础未说明。
- 第一课只建立「两条命令、一份快照、先看两列」。列的逐项、App Summary、Objects、整机视图的 ZRAM / DMA-BUF / Lost RAM 后面再拆。
- 文档之间有年代差：`dumpsys` 页的示例表头是 `Swapped Dirty`，[Quick assessment tools](https://developer.android.com/topic/performance/memory/guide/tools-overview) 的示例是 `SwapPss` 加 `Rss`。课上要写明「随平台版本变化」，并以 2026 年的指南作为当前读法。
