/*
 * Dental Arena, the signing tablet at reception: the on-screen keypad for the 6-digit code, the
 * signature pad (finger, stylus or mouse), the checks before sending, and the return to the code
 * screen after a few idle minutes so the next patient never sees the previous one's page.
 */
(function () {
  "use strict";
  var csrf = document.querySelector("[data-renunta]");
  function leave() {
    if (csrf) csrf.submit();
    else window.location.href = "/tableta";
  }

  // ── The code: the keypad writes into the field; 6 digits send the form ─────────────────
  var codeForm = document.querySelector("[data-cod]");
  if (codeForm) {
    var field = codeForm.querySelector("input[name=code]");
    // The keypad replaces the system keyboard, which would cover half the screen.
    if (window.matchMedia("(pointer: coarse)").matches) field.setAttribute("inputmode", "none");
    var send = function () {
      if (field.value.length === 6 && !codeForm.getAttribute("data-trimis")) {
        codeForm.setAttribute("data-trimis", "1");
        codeForm.submit();
      }
    };
    codeForm.addEventListener("click", function (e) {
      var key = e.target.closest("[data-tasta]");
      if (!key) return;
      var k = key.getAttribute("data-tasta");
      field.removeAttribute("aria-invalid");
      if (k === "sterge") field.value = field.value.slice(0, -1);
      else if (field.value.length < 6) field.value += k;
      if (navigator.vibrate) navigator.vibrate(8);
      send();
    });
    field.addEventListener("input", function () {
      field.value = field.value.replace(/\D/g, "").slice(0, 6);
      send();
    });
    // Back to a clean field after an error, for the next try.
    if (field.getAttribute("aria-invalid")) field.value = "";
  }

  // ── The signature pad ────────────────────────────────────────────────────────────────────
  var canvas = document.querySelector("[data-semnatura]");
  var signed = false;
  if (canvas) {
    var ctx = canvas.getContext("2d");
    var hint = document.querySelector("[data-semnatura-indiciu]");
    var ink = 0;
    var last = null;
    var resize = function () {
      // Draw at the screen's real resolution; a resize clears the pad (as on paper, sign again).
      var r = canvas.getBoundingClientRect();
      var dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#13212b";
      ink = 0;
      signed = false;
      if (hint) hint.hidden = false;
    };
    var point = function (e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure && e.pointerType === "pen" ? e.pressure : 0.5, t: e.timeStamp };
    };
    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      last = point(e);
      ctx.beginPath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.arc(last.x, last.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
      if (hint) hint.hidden = true;
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!last) return;
      var events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (var i = 0; i < events.length; i++) {
        var p = point(events[i]);
        var d = Math.hypot(p.x - last.x, p.y - last.y);
        if (d < 0.6) continue;
        // Faster strokes are thinner, like ink.
        var speed = d / Math.max(1, p.t - last.t);
        ctx.lineWidth = Math.max(1.4, Math.min(4.2, 3.6 - speed * 0.9)) * (0.6 + p.p * 0.8);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        var mx = (last.x + p.x) / 2;
        var my = (last.y + p.y) / 2;
        ctx.quadraticCurveTo(last.x, last.y, mx, my);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ink += d;
        last = p;
      }
      if (ink > 40) signed = true;
    });
    var end = function () {
      last = null;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    var clear = document.querySelector("[data-semnatura-sterge]");
    if (clear) clear.addEventListener("click", resize);
    var width = 0;
    window.addEventListener("resize", function () {
      if (Math.abs(canvas.getBoundingClientRect().width - width) > 2) {
        width = canvas.getBoundingClientRect().width;
        resize();
      }
    });
    width = canvas.getBoundingClientRect().width;
    resize();
  }

  // ── Before sending: at least one consent, a questionnaire answer, a signature ─────────────
  var form = document.querySelector("[data-semnare]");
  if (form) {
    var msg = form.querySelector("[data-semnare-eroare]");
    var say = function (text, target) {
      msg.textContent = text;
      msg.classList.remove("hidden");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    // „Nothing to declare” and the answers exclude each other.
    var nothing = form.querySelector("input[name=nothing]");
    if (nothing) {
      form.addEventListener("change", function (e) {
        if (e.target === nothing && nothing.checked) {
          Array.prototype.forEach.call(form.querySelectorAll("input[name^=flags]"), function (b) {
            b.checked = false;
          });
        } else if (e.target.name && e.target.name.indexOf("flags") === 0 && e.target.checked) {
          nothing.checked = false;
        }
      });
    }
    form.addEventListener("submit", function (e) {
      var boxes = form.querySelectorAll("input[name='accept[]']");
      var ticked = form.querySelectorAll("input[name='accept[]']:checked");
      if (boxes.length && !ticked.length) {
        e.preventDefault();
        say(form.getAttribute("data-msg-acorduri") || "Bifați acordurile pe care le dați.", boxes[0].closest("article"));
        return;
      }
      if (nothing) {
        var answered = nothing.checked || form.querySelector("input[name^=flags]:checked");
        ["allergies", "medications", "other_conditions"].forEach(function (n) {
          var f = form.querySelector("[name=" + n + "]");
          if (f && f.value.trim()) answered = true;
        });
        if (!answered) {
          e.preventDefault();
          say(form.getAttribute("data-msg-chestionar") || "Completați chestionarul sau bifați „Nu am nimic de declarat”.", nothing.closest("section"));
          return;
        }
      }
      if (!signed) {
        e.preventDefault();
        say(form.getAttribute("data-msg-semnatura") || "Semnați în chenar cu degetul.", canvas);
        return;
      }
      if (form.getAttribute("data-trimis")) {
        e.preventDefault();
        return;
      }
      // The signature on white, so it reads the same on any background.
      var out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      var o = out.getContext("2d");
      o.fillStyle = "#fff";
      o.fillRect(0, 0, out.width, out.height);
      o.drawImage(canvas, 0, 0);
      form.querySelector("[data-semnatura-valoare]").value = out.toDataURL("image/png");
      form.setAttribute("data-trimis", "1");
      var btn = form.querySelector("button[type=submit]");
      if (btn) btn.setAttribute("aria-disabled", "true");
    });
  }

  var out = document.querySelector("[data-renunta-acum]");
  if (out) out.addEventListener("click", leave);

  // ── Idle: back to the code screen ──────────────────────────────────────────────────────
  var idle = Number(document.body.getAttribute("data-inactiv") || 0);
  if (idle > 0) {
    var timer;
    var arm = function () {
      clearTimeout(timer);
      timer = setTimeout(leave, idle * 1000);
    };
    ["pointerdown", "keydown", "scroll", "input"].forEach(function (ev) {
      document.addEventListener(ev, arm, { passive: true, capture: true });
    });
    arm();
  }
  // No long-press menus or accidental zoom on the kiosk.
  document.addEventListener("contextmenu", function (e) {
    if (!e.target.closest("textarea,input")) e.preventDefault();
  });
})();
