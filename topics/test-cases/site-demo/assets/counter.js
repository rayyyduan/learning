// 主题专属的普通脚本（classic script）：验证课程能用相对路径引用主题 assets/ 里的脚本。
// 故意声明了一个全局变量 store，确认不会和站点脚本冲突（站点脚本是 ES module，不污染全局）。
var store = { clicks: 0 };
document.addEventListener("DOMContentLoaded", function () {
  var button = document.getElementById("demo-counter");
  var output = document.getElementById("demo-counter-output");
  if (!button || !output) return;
  button.addEventListener("click", function () {
    store.clicks += 1;
    output.textContent = "已点击 " + store.clicks + " 次";
  });
  output.textContent = "脚本已加载，点一下试试";
});
