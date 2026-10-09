/*
 * Dental Arena: the little the public site does in the browser. Everything works without it
 * (menus are <details>, „Sunați” and „Meniu” fall back to links); with it:
 *  - header menus close on Esc, on a click outside and after following a link
 *  - „Meniu” and „Sunați” (phone bar) open as dialogs
 *  - the cookie banner (cookie da_consent = {v:1, harti, at}) and the Google maps after consent
 *  - „Cum vă simțiți când vă gândiți la dentist?” on the home page
 *  - the price search on /preturi
 *  - forms: no double sending, focus on the error list or the confirmation
 */
(function () {
  "use strict";

  // ── Menus (<details data-dismiss>) ──────────────────────────────────────────
  var menus = Array.prototype.slice.call(document.querySelectorAll("details[data-dismiss]"));
  menus.forEach(function (details) {
    details.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && details.open) {
        e.preventDefault();
        details.open = false;
        var s = details.querySelector("summary");
        if (s) s.focus();
      }
    });
    details.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) details.open = false;
    });
  });
  function closeOutside(e) {
    menus.forEach(function (d) {
      if (d.open && !d.contains(e.target)) d.open = false;
    });
  }
  document.addEventListener("pointerdown", closeOutside);
  document.addEventListener("focusin", closeOutside);

  // ── Dialogs ([data-open-dialog="id"], [data-close-dialog]) ─────────────────
  document.addEventListener("click", function (e) {
    var opener = e.target.closest && e.target.closest("[data-open-dialog]");
    if (opener) {
      var dlg = document.getElementById(opener.getAttribute("data-open-dialog"));
      if (dlg && typeof dlg.showModal === "function") {
        e.preventDefault();
        dlg.showModal();
      }
      return;
    }
    var closer = e.target.closest && e.target.closest("[data-close-dialog]");
    if (closer) {
      var d = closer.closest("dialog");
      if (d) d.close();
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll("dialog"), function (dlg) {
    // A click on the backdrop (the dialog itself, outside its content) closes it.
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
      else if (e.target.closest && e.target.closest("a[href]")) dlg.close();
    });
  });

  // ── Cookies ─────────────────────────────────────────────────────────────────
  var COOKIE = "da_consent";
  function readConsent() {
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(COOKIE + "=") === 0) {
        try {
          var v = JSON.parse(decodeURIComponent(p.slice(COOKIE.length + 1)));
          if (v && v.v === 1 && typeof v.harti === "boolean") return v;
        } catch (err) {
          return null;
        }
      }
    }
    return null;
  }
  function writeConsent(harti) {
    var state = { v: 1, harti: harti, at: new Date().toISOString() };
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = COOKIE + "=" + encodeURIComponent(JSON.stringify(state)) + "; Path=/; Max-Age=" + 180 * 86400 + "; SameSite=Lax" + secure;
    applyMaps();
  }

  var banner = document.getElementById("cookie-uri");
  var returnFocus = null;
  function showSettings(on) {
    if (!banner) return;
    banner.querySelector("[data-cookie-panel]").hidden = !on;
    banner.querySelector('[data-cookie="save"]').hidden = !on;
    banner.querySelector('[data-cookie="refuse"]').hidden = on;
    banner.querySelector('[data-cookie="settings"]').hidden = on;
  }
  function closeBanner() {
    banner.hidden = true;
    showSettings(false);
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }
  if (banner) {
    if (!readConsent()) banner.hidden = false;
    banner.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-cookie]");
      if (!b) return;
      var what = b.getAttribute("data-cookie");
      if (what === "accept") {
        writeConsent(true);
        closeBanner();
      } else if (what === "refuse") {
        writeConsent(false);
        closeBanner();
      } else if (what === "settings") {
        showSettings(true);
      } else if (what === "save") {
        writeConsent(banner.querySelector('input[name="harti"]').checked);
        closeBanner();
      }
    });
  }
  document.addEventListener("click", function (e) {
    if (!banner || !(e.target.closest && e.target.closest("[data-cookie-settings]"))) return;
    returnFocus = document.activeElement;
    var c = readConsent();
    banner.querySelector('input[name="harti"]').checked = !!(c && c.harti);
    banner.hidden = false;
    showSettings(true);
    banner.focus();
  });

  // Google maps ([data-harta] with data-src): only after consent, or when the visitor asks.
  function loadMap(box) {
    if (box.querySelector("iframe")) return;
    var f = document.createElement("iframe");
    f.src = box.getAttribute("data-src");
    f.title = box.getAttribute("data-title") || "Hartă";
    f.loading = "lazy";
    f.referrerPolicy = "no-referrer-when-downgrade";
    f.className = "absolute inset-0 h-full w-full border-0";
    box.innerHTML = "";
    box.appendChild(f);
  }
  function applyMaps() {
    var c = readConsent();
    if (!c || !c.harti) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-harta]"), loadMap);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-incarca-harta]");
    if (!b) return;
    var box = b.closest("[data-harta]");
    if (b.hasAttribute("data-mereu")) writeConsent(true);
    else if (box) loadMap(box);
  });
  applyMaps();

  // ── „Cum vă simțiți…” (home) ────────────────────────────────────────────────
  var comfort = document.querySelector("[data-confort]");
  if (comfort) {
    var chips = comfort.querySelectorAll("[data-alegere]");
    var SELECTED = ["border-cerneala", "shadow-[0_0_0_1px_var(--da-cerneala)]"];
    Array.prototype.forEach.call(chips, function (chip) {
      chip.setAttribute("role", "button");
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", function (e) {
        e.preventDefault();
        var value = chip.getAttribute("data-alegere");
        Array.prototype.forEach.call(chips, function (c) {
          var on = c === chip;
          c.setAttribute("aria-pressed", on ? "true" : "false");
          SELECTED.forEach(function (cls) { c.classList.toggle(cls, on); });
          c.classList.toggle("bg-menta", on && value === "fara-emotii");
          c.classList.toggle("bg-mustar", on && value !== "fara-emotii");
          c.classList.toggle("bg-suprafata", !on);
          c.classList.toggle("border-linie-control", !on);
        });
        Array.prototype.forEach.call(comfort.querySelectorAll("[data-raspuns]"), function (r) {
          r.hidden = r.getAttribute("data-raspuns") !== value;
        });
        try {
          sessionStorage.setItem("da-confort", value);
        } catch (err) {
          /* the links carry ?confort= anyway */
        }
      });
    });
  }

  // ── Price search (/preturi) ─────────────────────────────────────────────────
  var search = document.querySelector("[data-cauta-pret]");
  if (search) {
    var status = document.getElementById(search.getAttribute("aria-describedby"));
    var fold = function (s) {
      return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    };
    search.addEventListener("input", function () {
      var q = fold(search.value.trim());
      var shown = 0;
      Array.prototype.forEach.call(document.querySelectorAll("[data-grup-pret]"), function (group) {
        var any = false;
        Array.prototype.forEach.call(group.querySelectorAll("[data-pret]"), function (row) {
          var hit = q === "" || fold(row.getAttribute("data-pret")).indexOf(q) !== -1 || fold(group.getAttribute("data-grup-pret")).indexOf(q) !== -1;
          row.hidden = !hit;
          if (hit) {
            any = true;
            shown++;
          }
        });
        group.hidden = !any;
      });
      if (status) status.textContent = q === "" ? "" : shown === 0 ? "Niciun preț găsit. Încercați alt cuvânt sau sunați-ne." : shown + (shown === 1 ? " preț găsit." : " prețuri găsite.");
    });
  }

  // ── Forms ───────────────────────────────────────────────────────────────────
  Array.prototype.forEach.call(document.querySelectorAll("form"), function (form) {
    form.addEventListener("submit", function () {
      var btn = form.querySelector("button[data-pending]");
      if (!btn) return;
      // Disabled after the submit is under way, so the browser still sends the form.
      setTimeout(function () {
        btn.disabled = true;
        btn.textContent = btn.getAttribute("data-pending");
      }, 0);
    });
  });
  var focusMe = document.querySelector("[data-autofocus]");
  if (focusMe) focusMe.focus();
})();
