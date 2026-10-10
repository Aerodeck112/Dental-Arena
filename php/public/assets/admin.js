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
  // The calendar's date field goes to the chosen day at once.
  Array.prototype.forEach.call(document.querySelectorAll("[data-trimite-la-schimbare]"), function (input) {
    input.addEventListener("change", function () {
      if (input.form && input.value) input.form.submit();
    });
  });
  // Print pages: the „Tipăriți” button.
  Array.prototype.forEach.call(document.querySelectorAll("[data-tipareste]"), function (b) {
    b.addEventListener("click", function () {
      window.print();
    });
  });

  // „1.250,50” → 125050 bani; empty or not a number → null.
  function bani(s) {
    s = String(s || "").replace(/\s|lei/g, "");
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "");
    s = s.replace(",", ".");
    var n = Number(s);
    return isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  }
  function lei(b) {
    var s = (Math.round(b) / 100).toFixed(2).split(".");
    return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + s[1] + "\u00a0lei";
  }

  // A service picked from the price list fills in the price and the description (when untouched).
  Array.prototype.forEach.call(document.querySelectorAll("select[data-serviciu]"), function (sel) {
    sel.addEventListener("change", function () {
      var opt = sel.options[sel.selectedIndex];
      if (!opt || !opt.value) return;
      var price = document.getElementById(sel.getAttribute("data-pret-in") || "");
      var name = document.getElementById(sel.getAttribute("data-denumire-in") || "");
      if (price && (!price.value || price.getAttribute("data-auto"))) {
        price.value = opt.getAttribute("data-pret") || "";
        price.setAttribute("data-auto", "1");
      }
      if (name && (!name.value || name.getAttribute("data-auto"))) {
        name.value = opt.getAttribute("data-denumire") || "";
        name.setAttribute("data-auto", "1");
      }
      if (price) price.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("input"), function (i) {
    i.addEventListener("input", function (e) {
      if (e.isTrusted) i.removeAttribute("data-auto");
    });
  });

  // The new invoice: the total as lines are ticked and typed (the server computes it again).
  var inv = document.querySelector("form[data-factura]");
  if (inv) {
    var out = inv.querySelector("[data-total-factura]");
    var recalc = function () {
      var total = 0;
      var vatIn = inv.querySelector("[data-tva]");
      var vat = vatIn ? Number(vatIn.value) || 0 : 0;
      Array.prototype.forEach.call(inv.querySelectorAll("[data-linie-plan]"), function (h) {
        var box = document.getElementById("plan-" + h.getAttribute("data-linie-plan"));
        if (box && box.checked) {
          var net = Number(h.getAttribute("data-valoare")) || 0;
          total += net + Math.round((net * vat) / 100);
        }
      });
      Array.prototype.forEach.call(inv.querySelectorAll("[data-linie-libera]"), function (row) {
        var q = Number((row.querySelector("input[data-cant]") || {}).value) || 0;
        var p = bani((row.querySelector("input[data-pret]") || {}).value) || 0;
        var d = bani((row.querySelector("input[data-reducere]") || {}).value) || 0;
        var net = Math.max(0, q * p - d);
        total += net + Math.round((net * vat) / 100);
      });
      if (out) out.textContent = lei(total);
    };
    inv.addEventListener("input", recalc);
    inv.addEventListener("change", recalc);
    recalc();
  }

  var focusMe = document.querySelector("[data-autofocus], [role=alert]");
  if (focusMe) focusMe.focus();
})();
