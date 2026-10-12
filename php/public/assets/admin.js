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

  // Dictation for the AI consultation: the browser's speech recognition, in Romanian. Final
  // phrases go into the text box; the phrase being spoken shows below it. Chrome stops after a
  // silence, so it restarts on its own until the doctor presses „Opriți”.
  var dictBtn = document.querySelector("[data-dictare]");
  if (dictBtn) {
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    var zone = dictBtn.closest("[data-dictare-zona]");
    if (!Rec) {
      dictBtn.hidden = true;
      var missing = zone && zone.querySelector("[data-dictare-lipsa]");
      if (missing) missing.hidden = false;
    } else {
      var box = document.getElementById(dictBtn.getAttribute("data-dictare"));
      var label = dictBtn.querySelector("[data-dictare-eticheta]");
      var state = zone && zone.querySelector("[data-dictare-stare]");
      var interim = document.querySelector("[data-dictare-interim]");
      var rec = null;
      var on = false;
      var setState = function (t) {
        if (state) state.textContent = t;
      };
      var start = function () {
        rec = new Rec();
        rec.lang = "ro-RO";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = function (e) {
          var temp = "";
          for (var i = e.resultIndex; i < e.results.length; i++) {
            var t = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              var sep = box.value && !/\s$/.test(box.value) ? " " : "";
              box.value += sep + t.trim().replace(/^./, function (c) { return c.toUpperCase(); }) + ".";
            } else {
              temp += t;
            }
          }
          if (interim) interim.textContent = temp;
        };
        rec.onerror = function (e) {
          if (e.error === "not-allowed" || e.error === "service-not-allowed") {
            on = false;
            setState("Browserul nu are voie să folosească microfonul. Permiteți-l din bara de adrese.");
          }
        };
        rec.onend = function () {
          if (on) {
            try { rec.start(); } catch (err) { /* already starting */ }
          } else {
            if (interim) interim.textContent = "";
          }
        };
        rec.start();
      };
      dictBtn.addEventListener("click", function () {
        on = !on;
        if (on) {
          start();
          label.textContent = "Opriți dictarea";
          dictBtn.setAttribute("aria-pressed", "true");
          setState("Ascult… vorbiți clar, în română.");
        } else {
          if (rec) rec.stop();
          label.textContent = "Dictați";
          dictBtn.setAttribute("aria-pressed", "false");
          setState("Dictarea s-a oprit. Verificați textul, apoi „Analizați cu AI”.");
        }
      });
    }
  }

  // A button that shows a waiting text while its form is sent (the AI takes up to a minute).
  document.addEventListener("submit", function (e) {
    var b = e.submitter;
    if (b && b.getAttribute("data-pending") && !e.defaultPrevented) {
      b.setAttribute("aria-busy", "true");
      b.textContent = b.getAttribute("data-pending") + "…";
    }
  });

  // The code for the signing tablet: the page follows the patient (opened, then signed).
  var code = document.querySelector("[data-cod-tableta]");
  if (code && window.fetch) {
    var state = code.querySelector("[data-cod-stare]");
    var opened = false;
    var poll = setInterval(function () {
      if (document.hidden) return;
      fetch(code.getAttribute("data-cod-tableta"), { credentials: "same-origin", cache: "no-store" })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (d) {
          if (!d) return;
          if (d.status !== "asteptare") {
            clearInterval(poll);
            window.location.reload();
          } else if (d.opened && !opened && state) {
            opened = true;
            state.textContent = "Pacientul semnează acum pe tabletă…";
          }
        })
        .catch(function () {});
    }, 4000);
  }

  // Setări → Actualizare: the archive goes in 1 MB pieces (past the hosting's upload limit).
  var upd = document.querySelector("[data-actualizare]");
  if (upd && window.fetch && window.Blob && window.crypto) {
    upd.addEventListener("submit", function (e) {
      var file = upd.querySelector("input[type=file]").files[0];
      if (!file) return;
      e.preventDefault();
      var url = upd.getAttribute("data-actualizare");
      var bar = upd.querySelector("[data-actualizare-progres]");
      var state = upd.querySelector("[data-actualizare-stare]");
      var btnUp = upd.querySelector("button[type=submit]");
      var token = upd.querySelector("[name=_csrf]").value;
      var bytes = new Uint8Array(12);
      window.crypto.getRandomValues(bytes);
      var id = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      var size = 1024 * 1024;
      var offset = 0;
      var tries = 0;
      bar.hidden = false;
      btnUp.disabled = true;
      var fail = function (msg) {
        state.textContent = msg;
        state.className = "text-mic font-medium text-carmin";
        btnUp.disabled = false;
        upd.removeAttribute("data-trimis");
      };
      var next = function () {
        if (offset >= file.size) {
          state.textContent = "Se verifică arhiva…";
          window.location.href = url + "?pachet=" + id;
          return;
        }
        fetch(url + "?op=bucata", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/octet-stream", "X-CSRF-Token": token, "X-Upload-Id": id, "X-Offset": String(offset) },
          body: file.slice(offset, offset + size),
        })
          .then(function (r) {
            return r.json().then(function (d) { return { ok: r.ok, d: d }; });
          })
          .then(function (x) {
            if (!x.ok) return fail(x.d.error || "Încărcarea nu a mers.");
            offset = x.d.size;
            tries = 0;
            bar.firstChild.style.width = Math.round((offset / file.size) * 100) + "%";
            state.textContent = "Se încarcă: " + Math.round((offset / file.size) * 100) + "% din " + (file.size / 1048576).toFixed(1).replace(".", ",") + " MB";
            next();
          })
          .catch(function () {
            if (++tries <= 3) setTimeout(next, 1500 * tries);
            else fail("Conexiunea s-a întrerupt. Încercați din nou.");
          });
      };
      next();
    });
  }

  // Absențe: the doctor list only when the absence is a doctor's (not a closed clinic).
  var cineMedic = document.querySelector("[data-cine-medic]");
  if (cineMedic) {
    var cine = document.querySelectorAll("input[name=cine]");
    var showDoctor = function () {
      var on = document.querySelector("input[name=cine]:checked");
      cineMedic.hidden = !!on && on.value === "clinica";
    };
    Array.prototype.forEach.call(cine, function (r) { r.addEventListener("change", showDoctor); });
    showDoctor();
  }

  var focusMe = document.querySelector("[data-autofocus], [role=alert]");
  if (focusMe) focusMe.focus();
})();
