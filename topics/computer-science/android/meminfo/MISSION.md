# Mission: dumpsys meminfo

## Why

把 `dumpsys meminfo` 读懂：知道这条命令在向系统要哪一份快照，表里每一列在计量什么，以及这些数字和进程共享内存、Zygote、zRAM 的关系。

## Success looks like

- 能写出系统级和单进程两条命令，并说明它们各给出哪一种报告
- 能指出单进程表里 `Pss Total`、`Private Dirty`、`Private Clean`、`SwapPss`、`Rss` 各在说什么
- 能根据 App Summary 和 Objects 判断下一步该看 Java 堆、native 堆，还是泄漏的 `Activity`

## Constraints

- 已有基础还没有说明，课程一次只加一个概念
- 数字和列名以 Android 官方文档为准，输出随平台版本会有差别

## Out of scope

- 这一阶段不以开发完整 Android 应用为目标
- `procstats` 的历史统计、`showmap` 的逐段映射，留到单进程快照能读熟之后
