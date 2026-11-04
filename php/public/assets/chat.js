/*
 * Dental Arena, the assistant on the site: a button in the corner opens a chat with the clinic's
 * AI assistant (/api/chat). It answers questions and books on the free times, shown as buttons.
 * The conversation continues across pages (its id is kept in this browser only).
 */
(function () {
  "use strict";
  var root = document.querySelector("[data-chat]");
  if (!root || !window.fetch) return;
  var phones = root.getAttribute("data-telefoane") || "";
  var KEY = "da_chat_t";
  var store = {
    get: function (k, s) {
      try {
        return (s ? sessionStorage : localStorage).getItem(k);
      } catch (e) {
        return null;
      }
    },
    set: function (k, v, s) {
      try {
        if (v === null) (s ? sessionStorage : localStorage).removeItem(k);
        else (s ? sessionStorage : localStorage).setItem(k, v);
      } catch (e) {
        /* private mode: the chat still works, it is just not remembered */
      }
    },
  };
  var token = store.get(KEY);
  var busy = false;
  var loaded = false;

  var ICON = {
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    tooth: '<path d="M7 3c-2.2 0-4 1.9-4 4.4 0 2.4 1 3.6 1.6 5.6.6 2 .9 7 2.9 7 1.6 0 1.7-4.5 3-4.5h3c1.3 0 1.4 4.5 3 4.5 2 0 2.3-5 2.9-7 .6-2 1.6-3.2 1.6-5.6C21 4.9 19.2 3 17 3c-1.9 0-2.9 1.2-5 1.2S8.9 3 7 3Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  };
  function svg(name, size, cls) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0 ' + (cls || "") + '">' + ICON[name] + "</svg>";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Plain text with clickable links and phone numbers.
  function rich(text) {
    return esc(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" class="underline underline-offset-2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)(?=[\s.,;:!?)]|$)/g, '$1<a href="$2" class="underline underline-offset-2">$2</a>')
      .replace(/(\b0\d{3}[ .]?\d{3}[ .]?\d{3}\b)/g, function (m) {
        return '<a href="tel:+4' + m.replace(/\D/g, "") + '" class="font-medium underline underline-offset-2 whitespace-nowrap">' + m + "</a>";
      });
  }

  // ── The button and the panel ─────────────────────────────────────────────────────────────
  root.innerHTML =
    '<button type="button" data-chat-deschide aria-expanded="false" aria-controls="chat-panou" class="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 flex h-14 items-center gap-2 rounded-full bg-actiune pr-5 pl-4 font-medium text-pe-actiune shadow-float transition-transform duration-200 hover:scale-[1.03] active:scale-95 md:right-6 md:bottom-6">' +
    '<span class="relative">' + svg("chat", 24) + '<span class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-actiune bg-[#7ee2b8]"></span></span><span class="text-[1rem]">Întrebați-ne</span></button>' +
    '<section id="chat-panou" role="dialog" aria-modal="false" aria-labelledby="chat-titlu" hidden class="fixed inset-0 z-[60] flex flex-col bg-suprafata text-cerneala shadow-float md:inset-auto md:right-6 md:bottom-6 md:h-[min(42rem,calc(100dvh-3rem))] md:w-[25rem] md:overflow-hidden md:rounded-[1.5rem] md:border md:border-linie">' +
    '<header class="flex items-center gap-3 border-b border-linie px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 md:pt-3">' +
    '<span class="flex size-10 items-center justify-center rounded-full bg-menta-pal text-actiune">' + svg("tooth", 22) + "</span>" +
    '<div class="min-w-0 flex-1"><h2 id="chat-titlu" class="font-semibold leading-tight">Asistentul Dental Arena</h2><p class="flex items-center gap-1.5 text-mic text-discret"><span class="size-2 rounded-full bg-actiune"></span>Răspunde imediat, non-stop</p></div>' +
    '<button type="button" data-chat-nou class="flex size-10 items-center justify-center rounded-full text-discret hover:bg-adancit" aria-label="Conversație nouă" title="Conversație nouă">' + svg("reset", 20) + "</button>" +
    '<button type="button" data-chat-inchide class="flex size-10 items-center justify-center rounded-full text-discret hover:bg-adancit" aria-label="Închideți chatul">' + svg("x", 22) + "</button></header>" +
    '<ol data-chat-lista role="log" aria-live="polite" aria-label="Mesajele" class="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-fundal px-4 py-4"></ol>' +
    '<form data-chat-form class="border-t border-linie bg-suprafata px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">' +
    '<div class="flex items-end gap-2 rounded-[1.25rem] border border-linie-control bg-fundal py-1.5 pr-1.5 pl-4 focus-within:border-actiune">' +
    '<label for="chat-text" class="sr-only">Mesajul dumneavoastră</label>' +
    '<textarea id="chat-text" rows="1" maxlength="1000" placeholder="Scrieți un mesaj…" class="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-[1rem] leading-snug outline-none placeholder:text-discret"></textarea>' +
    '<button type="submit" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-actiune text-pe-actiune disabled:opacity-40" aria-label="Trimiteți">' + svg("send", 18) + "</button></div>" +
    '<p class="mt-2 px-1 text-[11px] leading-snug text-discret">Asistent AI: poate greși și nu înlocuiește consultul. Urgențe: ' + rich(phones) + '. <a href="/politica-de-confidentialitate" class="underline">Date personale</a></p></form></section>';

  var openBtn = root.querySelector("[data-chat-deschide]");
  var panel = root.querySelector("#chat-panou");
  var list = root.querySelector("[data-chat-lista]");
  var form = root.querySelector("[data-chat-form]");
  var input = root.querySelector("#chat-text");
  var sendBtn = form.querySelector("button[type=submit]");

  function scroll() {
    list.scrollTop = list.scrollHeight;
  }
  function add(html, cls) {
    var li = document.createElement("li");
    li.className = cls || "";
    li.innerHTML = html;
    list.appendChild(li);
    scroll();
    return li;
  }
  function userBubble(text) {
    add('<div class="ml-auto w-fit max-w-[85%] rounded-[1.25rem] rounded-br-md bg-actiune px-4 py-2.5 text-[0.975rem] leading-snug whitespace-pre-line text-pe-actiune">' + esc(text) + "</div>", "flex");
  }
  function botBubble(r, live) {
    var html = '<div class="w-fit max-w-[88%] rounded-[1.25rem] rounded-bl-md border border-linie bg-suprafata px-4 py-2.5 text-[0.975rem] leading-snug whitespace-pre-line' + (r.error ? " border-carmin" : "") + '">' + rich(r.text || "") + "</div>";
    if (r.booked) {
      html +=
        '<div class="mt-2 flex max-w-[88%] items-start gap-3 rounded-[1.25rem] ' + (r.booked.confirmed ? "bg-menta-pal" : "bg-mustar-pal") + ' px-4 py-3 text-[0.925rem]">' +
        svg(r.booked.confirmed ? "check" : "clock", 20, "mt-0.5 " + (r.booked.confirmed ? "text-actiune" : "text-mustar-text")) +
        '<div><p class="font-semibold">' + (r.booked.confirmed ? "Programare confirmată" : "Cerere trimisă recepției") + '</p><p class="mt-0.5">' + esc(r.booked.label) + "</p>" +
        (r.booked.confirmed ? "" : '<p class="mt-0.5 text-mic">Vă sunăm să confirmăm ora.</p>') + "</div></div>";
    }
    var li = add(html, "flex flex-col items-start");
    if (r.slots && r.slots.length && live) slotPicker(li, r.slots);
    return li;
  }
  // The free times as buttons, by day.
  function slotPicker(li, slots) {
    var box = document.createElement("div");
    box.className = "mt-2 flex w-full flex-col gap-2";
    var days = [];
    slots.forEach(function (s) {
      var d = days[days.length - 1];
      if (!d || d.day !== s.day) days.push((d = { day: s.day, items: [] }));
      d.items.push(s);
    });
    days.forEach(function (d) {
      var row = document.createElement("div");
      row.innerHTML = '<p class="mb-1 text-mic font-semibold text-discret first-letter:uppercase">' + esc(d.day) + '</p><div class="flex flex-wrap gap-2"></div>';
      d.items.forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "flex flex-col items-start rounded-[0.9rem] border border-actiune bg-suprafata px-3 py-1.5 text-left transition-colors hover:bg-menta-pal";
        b.innerHTML = '<span class="font-semibold text-actiune">' + esc(s.time) + '</span><span class="text-[11px] text-discret">' + esc(s.clinic + " · " + s.doctor) + "</span>";
        b.addEventListener("click", function () {
          if (busy) return;
          box.remove();
          send("Aleg " + s.day + ", ora " + s.time + ", la " + s.clinic + " (" + s.doctor + ").", s.id);
        });
        row.lastChild.appendChild(b);
      });
      box.appendChild(row);
    });
    li.appendChild(box);
    scroll();
  }
  function chips(items) {
    var li = add('<div class="flex flex-wrap gap-2"></div>', "flex");
    items.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rounded-full border border-linie-control bg-suprafata px-3.5 py-2 text-[0.925rem] transition-colors hover:border-actiune hover:bg-menta-pal";
      b.textContent = t;
      b.addEventListener("click", function () {
        li.remove();
        send(t);
      });
      li.firstChild.appendChild(b);
    });
  }
  function greet() {
    botBubble({ text: "Bună ziua! Sunt asistentul virtual Dental Arena. Vă pot face o programare, vă spun prețurile sau răspund la întrebări despre clinicile din Cristești și Luduș." });
    chips(["Vreau o programare", "Cât costă un implant?", "Mă doare un dinte", "Unde sunteți și ce program aveți?"]);
  }
  function typing(on) {
    var t = list.querySelector("[data-scrie]");
    if (on && !t) {
      add('<div class="flex w-fit items-center gap-1 rounded-[1.25rem] rounded-bl-md border border-linie bg-suprafata px-4 py-3.5" aria-label="Asistentul scrie"><span class="size-2 animate-bounce rounded-full bg-discret [animation-delay:-0.3s]"></span><span class="size-2 animate-bounce rounded-full bg-discret [animation-delay:-0.15s]"></span><span class="size-2 animate-bounce rounded-full bg-discret"></span></div>', "flex").setAttribute("data-scrie", "");
    } else if (!on && t) {
      t.remove();
    }
  }

  function send(text, slot) {
    text = text.trim();
    if (!text || busy) return;
    busy = true;
    sendBtn.disabled = true;
    userBubble(text);
    typing(true);
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ t: token, m: text, s: slot || "" }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { error: "Răspunsul nu a putut fi citit." };
        });
      })
      .then(function (d) {
        typing(false);
        if (d.t) {
          token = d.t;
          store.set(KEY, token);
        }
        botBubble(d.reply || { text: d.error || "Ceva n-a mers. Încercați din nou sau sunați-ne: " + phones, error: true }, true);
      })
      .catch(function () {
        typing(false);
        botBubble({ text: "Nu am conexiune la internet acum. Încercați din nou sau sunați-ne: " + phones, error: true });
      })
      .then(function () {
        busy = false;
        sendBtn.disabled = false;
        if (panel.offsetParent !== null) input.focus();
      });
  }

  function load() {
    if (loaded) return;
    loaded = true;
    if (!token) {
      greet();
      return;
    }
    typing(true);
    fetch("/api/chat?t=" + encodeURIComponent(token), { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        typing(false);
        var msgs = (d && d.messages) || [];
        if (!msgs.length) {
          token = null;
          store.set(KEY, null);
          greet();
          return;
        }
        msgs.forEach(function (m, i) {
          if (m.role === "user") userBubble(m.text);
          else botBubble(m, i === msgs.length - 1);
        });
      })
      .catch(function () {
        typing(false);
        greet();
      });
  }

  var mobile = window.matchMedia("(max-width: 767px)");
  function open() {
    panel.hidden = false;
    openBtn.hidden = true;
    openBtn.setAttribute("aria-expanded", "true");
    if (mobile.matches) document.documentElement.style.overflow = "hidden";
    store.set("da_chat_open", "1", true);
    load();
    setTimeout(function () {
      input.focus();
      scroll();
    }, 30);
  }
  function close() {
    panel.hidden = true;
    openBtn.hidden = false;
    openBtn.setAttribute("aria-expanded", "false");
    document.documentElement.style.overflow = "";
    store.set("da_chat_open", null, true);
    openBtn.focus();
  }
  openBtn.addEventListener("click", open);
  root.querySelector("[data-chat-inchide]").addEventListener("click", close);
  root.querySelector("[data-chat-nou]").addEventListener("click", function () {
    if (busy) return;
    token = null;
    store.set(KEY, null);
    list.innerHTML = "";
    greet();
    input.focus();
  });
  panel.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = input.value;
    input.value = "";
    input.style.height = "";
    send(t);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });
  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 128) + "px";
  });
  // Links on the page can open the chat: <a href="#asistent">.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="#asistent"]');
    if (a) {
      e.preventDefault();
      open();
    }
  });
  if (store.get("da_chat_open", true) === "1" && !mobile.matches) open();
})();
