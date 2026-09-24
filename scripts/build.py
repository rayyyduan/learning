"""静态构建：把所有要发布的页面渲染到 site/，目录结构与源目录一致。

用法：python3 scripts/build.py（通常通过 make build 调用）
产物只包含 HTML 和 assets/，不包含 Markdown 文件，也不包含开发服务器的自动刷新脚本。
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render  # noqa: E402

OUT = render.ROOT / "site"


def main():
    try:
        tree = render.load_tree()
        entries = render.site_map(tree)
    except render.SiteError as e:
        sys.exit(f"错误：{e}")
    render.print_warnings(tree)

    if OUT.exists():
        shutil.rmtree(OUT)
    for url, entry in sorted(entries.items()):
        data, _ = render.render_entry(url, entry, tree)
        target = OUT / url
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    print(f"已生成 {len(entries)} 个文件到 {OUT.relative_to(render.ROOT)}/")


if __name__ == "__main__":
    main()
