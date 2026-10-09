/*
 * Dental Arena panel: confirmation before deleting, the phone menu closing on a click outside,
 * focus on the error list, and no double sending of a form.
 */
(function () {
  "use strict";
  document.addEventListener("submit", function (e) {
    var form = e.target;
    var submitter = e.submitter;
    var ask = (submitter && submitter.getAttribute("data-confirma")) || form.getAttribute("data-confirma");
    if (ask && !window.confirm(ask)) {
      e.preventDefault();
      return;
    }
    if (form.method.toLowerCase() === "post") {
      // Re-sending the same form while it is on its way would save twice.
      if (form.getAttribute("data-trimis")) {
        e.preventDefault();
        return;
      }
      form.setAttribute("data-trimis", "1");
      setTimeout(function () {
        form.removeAttribute("data-trimis");
      }, 8000);
    }
  });
  var menu = document.querySelector("[data-meniu-panou]");
  if (menu) {
    document.addEventListener("pointerdown", function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape") menu.open = false;
    });
  }
  var focusMe = document.querySelector("[data-autofocus], [role=alert]");
  if (focusMe) focusMe.focus();
})();
