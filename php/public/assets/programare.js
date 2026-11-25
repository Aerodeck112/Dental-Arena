/*
 * Dental Arena, /programare: the four booking steps. One step is open at a time; the steps done
 * show a one-line summary and „Schimbați”. The free times come from /api/sloturi (by clinic,
 * reason and doctor, a week at a time). Without this script the page keeps the request form.
 */
(function () {
  "use strict";
  var root = document.querySelector("[data-programare]");
  if (!root || !window.fetch || !window.JSON) return;
  var D = JSON.parse(root.querySelector("[data-programare-date]").textContent);
  root.hidden = false;
  var fallback = document.querySelector("[data-fara-js]");
  if (fallback) fallback.hidden = true;
  var form = root.querySelector("[data-programare-form]");
  var apel = root.querySelector("[data-apel]");
  var steps = Array.prototype.slice.call(form.querySelectorAll("[data-pas]"));
  var summary = document.querySelector("[data-rezumat]");
  if (summary) summary.hidden = false;
  var $ = function (sel, el) { return (el || root).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || root).querySelectorAll(sel)); };
  var input = function (name) { return form.querySelector("[name='" + name + "']"); };
  var today = new Date();
  var iso = function (d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
  var addDays = function (s, n) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  var horizon = addDays(iso(today), D.days - 1);
  var fmtDay = new Intl.DateTimeFormat("ro-RO", { weekday: "short" });
  var fmtNum = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short" });
  var fmtMonth = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });

  var S = { step: 1, reason: null, clinic: null, doctor: "", slot: "", slotText: "", slotDoctor: "", from: iso(today), day: null, data: null };
  var init = D.initial || {};
  D.reasons.forEach(function (r, i) {
    if (S.reason === null && String(r.id) === String(init.serviciu || "")) S.reason = i;
  });
  if (init.clinica) S.clinic = Number(init.clinica);
  if (init.medic) S.doctor = String(init.medic);
  // After a server-side error the chosen hour comes back (YmdHi-clinic-doctor-minutes).
  var m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})-/.exec(init.slot || "");
  if (m) {
    S.slot = init.slot;
    S.day = m[1] + "-" + m[2] + "-" + m[3];
    S.from = S.day;
    S.slotText = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" }).format(new Date(S.day + "T12:00:00")) + ", ora " + m[4] + ":" + m[5];
  }
  try {
    var saved = JSON.parse(sessionStorage.getItem("da_programare") || "null");
    if (saved && !init.serviciu && !init.clinica) {
      S.reason = saved.reason;
      S.clinic = saved.clinic;
      S.doctor = saved.doctor || "";
    }
  } catch (e) { /* private mode */ }
  var save = function () {
    try {
      sessionStorage.setItem("da_programare", JSON.stringify({ reason: S.reason, clinic: S.clinic, doctor: S.doctor }));
    } catch (e) { /* private mode */ }
  };
  var reason = function () { return S.reason === null ? null : D.reasons[S.reason]; };
  var clinic = function () {
    for (var i = 0; i < D.clinics.length; i++) if (D.clinics[i].id === S.clinic) return D.clinics[i];
    return null;
  };

  // ── Step 1: the reason and the clinic ────────────────────────────────────────────────────
  $$("input[name=motiv]").forEach(function (r) {
    if (Number(r.value) === S.reason) r.checked = true;
    r.addEventListener("change", function () {
      S.reason = Number(r.value);
      S.slot = "";
      urgent();
      sync();
    });
  });
  $$("input[name=clinica_r]").forEach(function (r) {
    if (Number(r.value) === S.clinic) r.checked = true;
    r.addEventListener("change", function () {
      S.clinic = Number(r.value);
      S.doctor = "";
      S.slot = "";
      sync();
    });
  });
  if (S.clinic === null && D.clinics.length === 1) S.clinic = D.clinics[0].id;
  function urgent() {
    var r = reason();
    $("[data-urgent]").hidden = !(r && r.urgent);
  }

  // ── Step 2: the doctor, the day, the hour ────────────────────────────────────────────────
  function doctors() {
    var list = (D.doctors[S.clinic] || []).slice();
    var r = reason();
    var doers = r && D.doers[r.category];
    if (doers && doers.length) list = list.filter(function (d) { return doers.indexOf(d.id) !== -1; });
    return list;
  }
  function renderDoctors() {
    var box = $("[data-medici]");
    box.innerHTML = "";
    var chip = function (id, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.setAttribute("aria-pressed", String(S.doctor === id));
      b.className = "rounded-full border px-4 py-2 text-[0.95rem] font-medium transition-colors " + (S.doctor === id ? "border-actiune bg-actiune text-pe-actiune" : "border-linie-control bg-suprafata hover:border-actiune");
      b.addEventListener("click", function () {
        S.doctor = id;
        S.slot = "";
        save();
        renderDoctors();
        load();
      });
      box.appendChild(b);
    };
    chip("", "Oricare medic");
    doctors().forEach(function (d) { chip(String(d.id), d.name); });
  }
  var loading = 0;
  function load() {
    var r = reason();
    if (!r || S.clinic === null) return;
    var mine = ++loading;
    var box = $("[data-ore]");
    box.innerHTML = '<p class="text-corp text-discret">Caut orele libere…</p>';
    fetch("/api/sloturi?clinica=" + S.clinic + "&serviciu=" + r.id + "&medic=" + encodeURIComponent(S.doctor) + "&de=" + S.from + "&zile=7", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 429) throw new Error("prea-multe");
        return res.json();
      })
      .then(function (d) {
        if (mine !== loading) return;
        S.data = d;
        var withSlots = d.days.filter(function (x) { return x.slots.length; });
        if (!S.day || !d.days.some(function (x) { return x.date === S.day && x.slots.length; })) S.day = withSlots.length ? withSlots[0].date : null;
        renderDays();
        renderSlots();
      })
      .catch(function (e) {
        if (mine !== loading) return;
        box.innerHTML = '<p class="text-corp text-carmin">' + (e.message === "prea-multe" ? "Prea multe căutări. Așteptați un minut." : "Nu am putut încărca orele. Verificați conexiunea și încercați din nou.") + "</p>";
      });
  }
  function renderDays() {
    var box = $("[data-zile]");
    box.innerHTML = "";
    $("[data-luna]").textContent = fmtMonth.format(new Date(S.from + "T12:00:00")).replace(/^./, function (c) { return c.toUpperCase(); });
    S.data.days.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      var dt = new Date(d.date + "T12:00:00");
      b.innerHTML = '<span class="block text-mic capitalize">' + fmtDay.format(dt) + '</span><span class="block font-semibold">' + fmtNum.format(dt) + "</span>";
      b.disabled = !d.slots.length;
      b.setAttribute("aria-pressed", String(S.day === d.date));
      b.className = "rounded-control border px-2 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:border-linie disabled:bg-adancit disabled:text-discret " + (S.day === d.date ? "border-actiune bg-actiune text-pe-actiune" : "border-linie-control bg-suprafata hover:border-actiune");
      b.addEventListener("click", function () {
        S.day = d.date;
        renderDays();
        renderSlots();
      });
      box.appendChild(b);
    });
    $("[data-zile-inapoi]").disabled = S.from <= iso(today);
    $("[data-zile-inainte]").disabled = addDays(S.from, 7) > horizon;
  }
  function renderSlots() {
    var box = $("[data-ore]");
    box.innerHTML = "";
    var day = null;
    S.data.days.forEach(function (d) { if (d.date === S.day) day = d; });
    if (!day) {
      var p = document.createElement("div");
      p.className = "rounded-panou bg-adancit p-4 text-corp";
      p.textContent = "Nicio oră liberă în aceste zile.";
      if (S.data.first) {
        var go = document.createElement("button");
        go.type = "button";
        go.className = "ml-1 font-semibold text-link underline";
        go.textContent = "Mergeți la prima oră liberă";
        go.addEventListener("click", function () {
          S.from = S.data.first.slice(0, 10);
          S.day = S.from;
          load();
        });
        p.appendChild(go);
      }
      box.appendChild(p);
      return;
    }
    [["Dimineața", true], ["După-amiaza", false]].forEach(function (g) {
      var list = day.slots.filter(function (s) { return s.morning === g[1]; });
      if (!list.length) return;
      var wrap = document.createElement("div");
      wrap.innerHTML = '<p class="mb-2 text-mic font-semibold text-discret">' + g[0] + '</p><div class="flex flex-wrap gap-2"></div>';
      list.forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-pressed", String(S.slot === s.id));
        b.className = "min-w-[5.5rem] rounded-control border px-3 py-2 text-left transition-colors " + (S.slot === s.id ? "border-actiune bg-actiune text-pe-actiune" : "border-actiune bg-suprafata hover:bg-menta-pal");
        b.innerHTML = '<span class="block font-semibold">' + s.time + '</span><span class="block text-[11px] ' + (S.slot === s.id ? "" : "text-discret") + '">' + (S.doctor ? "" : s.doctor) + "</span>";
        b.addEventListener("click", function () {
          S.slot = s.id;
          S.slotText = day.label + ", ora " + s.time;
          S.slotDoctor = s.doctor;
          renderSlots();
          sync();
        });
        wrap.lastChild.appendChild(b);
      });
      box.appendChild(wrap);
    });
  }
  $("[data-zile-inapoi]").addEventListener("click", function () {
    var f = addDays(S.from, -7);
    S.from = f < iso(today) ? iso(today) : f;
    S.day = null;
    load();
  });
  $("[data-zile-inainte]").addEventListener("click", function () {
    S.from = addDays(S.from, 7);
    S.day = null;
    load();
  });

  // ── Step 3: comfort; step 4: for whom ────────────────────────────────────────────────────
  var nota = $("[data-nota]");
  $$("input[name=confort]").forEach(function (r) {
    r.addEventListener("change", function () { nota.hidden = !(r.checked && r.value !== "fara-emotii"); });
    if (r.checked && r.value !== "fara-emotii") nota.hidden = false;
  });
  if (init.confort) $$("input[name=confort]").forEach(function (r) { if (r.value === init.confort) { r.checked = true; nota.hidden = r.value === "fara-emotii"; } });
  var copil = $("[data-copil]");
  $$("input[name=pentru]").forEach(function (r) {
    r.addEventListener("change", function () { copil.hidden = !(r.checked && r.value === "copil"); });
    if (r.checked && r.value === "copil") copil.hidden = false;
  });

  // ── Moving between steps ─────────────────────────────────────────────────────────────────
  function stepText(n) {
    var r = reason();
    var c = clinic();
    if (n === 1) return (r ? r.label : "") + (c ? " · " + c.name : "");
    if (n === 2) return S.slotText ? S.slotText.replace(/^./, function (x) { return x.toUpperCase(); }) + (S.slotDoctor ? " · " + S.slotDoctor : "") : "";
    if (n === 3) {
      var ch = form.querySelector("input[name=confort]:checked");
      return ch ? ch.parentNode.querySelector(".font-semibold").textContent : "Nu am spus";
    }
    return "";
  }
  function show(n) {
    S.step = n;
    steps.forEach(function (sec) {
      var k = Number(sec.getAttribute("data-pas"));
      var done = k < n;
      $("[data-pas-continut]", sec).hidden = k !== n;
      $("[data-pas-rezumat]", sec).hidden = !done;
      $("[data-pas-rezumat]", sec).textContent = done ? stepText(k) : "";
      $("[data-schimba]", sec).hidden = !done;
      var nr = $("[data-pas-nr]", sec);
      nr.className = "flex size-9 shrink-0 items-center justify-center rounded-full font-semibold " + (done ? "bg-menta-pal text-actiune" : k === n ? "bg-actiune text-pe-actiune" : "bg-adancit text-discret");
      nr.textContent = done ? "✓" : String(k);
      sec.style.opacity = k > n ? "0.6" : "";
    });
    if (n === 2) {
      renderDoctors();
      load();
    }
    var target = steps[n - 1];
    if (target && n > 1) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function say(sec, text) {
    var p = $("[data-pas-eroare]", sec);
    if (!p) {
      p = document.createElement("p");
      p.setAttribute("data-pas-eroare", "");
      p.setAttribute("role", "alert");
      p.className = "font-medium text-carmin";
      $("[data-pas-continut]", sec).insertBefore(p, $("[data-inainte]", sec).parentNode);
    }
    p.textContent = text;
    p.hidden = !text;
  }
  steps.forEach(function (sec) {
    var n = Number(sec.getAttribute("data-pas"));
    var next = $("[data-inainte]", sec);
    if (next) next.addEventListener("click", function () {
      if (n === 1 && (S.reason === null || S.clinic === null)) return say(sec, S.reason === null ? "Alegeți motivul programării." : "Alegeți clinica.");
      if (n === 2 && !S.slot) return say(sec, "Alegeți o oră liberă.");
      say(sec, "");
      show(n + 1);
    });
    $("[data-schimba]", sec).addEventListener("click", function () { show(n); });
  });
  function sync() {
    var r = reason();
    var c = clinic();
    input("serviciu").value = r ? r.id : "";
    input("clinica").value = S.clinic === null ? "" : S.clinic;
    input("medic").value = S.doctor;
    input("slot").value = S.slot;
    save();
    if (summary) {
      summary.querySelector("[data-r-motiv]").textContent = r ? r.label : "—";
      summary.querySelector("[data-r-clinica]").textContent = c ? c.name : "—";
      summary.querySelector("[data-r-ora]").textContent = S.slot ? S.slotText : "—";
      summary.querySelector("[data-r-medic]").textContent = S.slot && S.slotDoctor ? S.slotDoctor : "Oricare medic";
    }
    var t = S.slot ? S.slotText.split("ora ")[1] : "";
    $("[data-trimite]").textContent = t ? "Rezervați ora de " + t : "Rezervați ora";
  }
  form.addEventListener("submit", function (e) {
    if (!S.slot) {
      e.preventDefault();
      show(2);
      say(steps[1], "Alegeți o oră liberă.");
      return;
    }
    sync();
    var btn = $("[data-trimite]");
    if (btn.getAttribute("aria-busy")) {
      e.preventDefault();
      return;
    }
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Se rezervă…";
  });

  // „Prefer să mă sunați”: the call-back form, with what was already chosen.
  $("[data-vreau-apel]").addEventListener("click", function () {
    var r = reason();
    apel.querySelector("[name=serviciu]").value = r ? r.id : "";
    apel.querySelector("[name=clinica]").value = S.clinic === null ? "" : S.clinic;
    ["name", "phone"].forEach(function (k) {
      var from = input(k);
      var to = apel.querySelector("[name=" + k + "]");
      if (from && to && !to.value) to.value = from.value;
    });
    apel.hidden = false;
    apel.scrollIntoView({ behavior: "smooth", block: "start" });
    apel.querySelector("input[name=name]").focus();
  });
  apel.querySelector("[data-inapoi-ore]").addEventListener("click", function () {
    apel.hidden = true;
    show(2);
  });

  // Where to start: the step with an error, else the first one not answered.
  urgent();
  sync();
  var errs = D.errors || {};
  var start = 1;
  if (errs.slot) start = 2;
  else if (errs.name || errs.phone || errs.email || errs.consent || errs.copil || errs.varsta || errs.form) start = 4;
  else if (S.reason !== null && S.clinic !== null) start = 2;
  if (start === 4 && !S.slot) start = 2;
  show(start);
  if (errs.slot) say(steps[1], errs.slot);
})();
