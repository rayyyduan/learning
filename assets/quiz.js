(function () {
  function bind() {
    document.querySelectorAll(".quiz").forEach(function (quiz) {
      if (quiz.dataset.bound === "true") return;
      quiz.dataset.bound = "true";
      var feedback = quiz.querySelector(".quiz__feedback");
      quiz.addEventListener("click", function (event) {
        var option = event.target.closest(".quiz__option");
        if (!option) return;
        var correct = option.dataset.correct === "true";
        quiz.querySelectorAll(".quiz__option").forEach(function (button) {
          button.classList.remove("is-correct", "is-wrong");
        });
        option.classList.add(correct ? "is-correct" : "is-wrong");
        if (!feedback) return;
        feedback.className = "quiz__feedback " + (correct ? "is-correct" : "is-wrong");
        feedback.textContent = option.dataset.feedback || (correct ? "答对了。" : "再看一遍这一节。");
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
