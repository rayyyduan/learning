# dumpsys meminfo Resources

## Knowledge

- [Document: dumpsys（Android Developers，meminfo 一节）](https://developer.android.com/tools/dumpsys)
  `dumpsys` 的语法，以及 `meminfo` 作为某一时刻快照的定义。含 `Pss Total`、`Private Dirty`、`Private Clean` 和 `-d` 展开的 Dalvik / ART 行。Use for: 命令形式、列的官方解释、示例输出。
- [Guide: Quick assessment tools](https://developer.android.com/topic/performance/memory/guide/tools-overview)
  2026 年的读法：`-a`、`-s`、无参数的整机视图，以及 `SwapPss`、App Summary、Objects。Use for: 当前版本的表头和分诊顺序。
- [Guide: Fundamental concepts](https://developer.android.com/topic/performance/memory/guide/concepts)
  RSS、PSS、USS，匿名页和文件页，clean / dirty，Zygote 的 copy-on-write，zRAM。Use for: 列名背后的计量规则，以及该用哪一个指标。
- [Case study: Debugging memory usage on Android（Perfetto）](https://android.googlesource.com/platform/external/perfetto/+/refs/heads/main/docs/case-studies/memory.md)
  用一份真实的 `dumpsys meminfo` 把 PSS 和 RSS 接到后续工具。Use for: 快照之后下一步看什么。

## Wisdom (Communities)

- [r/androiddev](https://www.reddit.com/r/androiddev/)
  Android 应用开发讨论区。Use for: 把一份真实的 `meminfo` 输出拿去对照别人的读法。
- [Stack Overflow：android + memory](https://stackoverflow.com/questions/tagged/android+memory)
  带具体输出和复现步骤的问答。Use for: 某一列在你的设备上和文档示例对不上时。
