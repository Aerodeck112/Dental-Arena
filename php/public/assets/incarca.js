/*
 * /incarca/<code> (src/upload.php): the photos chosen or taken on the phone are made smaller here
 * (at most 2000 px, JPEG) and sent one by one, each with its little preview and its state, so the
 * hosting's upload limit and a slow mobile connection are not a problem. Without the script the
 * form still works (the „Trimiteți” button in <noscript>).
 */
(function () {
  "use strict";
  var form = document.querySelector("[data-incarca]");
  if (!form || !window.fetch || !window.FormData || !window.Promise) return;
  var list = document.querySelector("[data-trimise]");
  var note = form.querySelector("[name=note]");
  var MAX = 2000;
  var queue = Promise.resolve();

  // A smaller JPEG of the photo (the phone's camera makes 3–8 MB); the original when it cannot.
  function shrink(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return resolve(file);
      createImageBitmap(file, { imageOrientation: "from-image" })
        .then(function (bmp) {
          var k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
          if (k === 1 && file.size < 1500000) return resolve(file);
          var c = document.createElement("canvas");
          c.width = Math.round(bmp.width * k);
          c.height = Math.round(bmp.height * k);
          c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
          c.toBlob(function (b) { resolve(b || file); }, "image/jpeg", 0.85);
        })
        .catch(function () { resolve(file); });
    });
  }

  function item(file) {
    var li = document.createElement("li");
    li.className = "flex flex-col overflow-hidden rounded-control border border-linie bg-suprafata";
    var img = document.createElement("img");
    img.alt = "";
    img.className = "aspect-square w-full object-cover";
    try { img.src = URL.createObjectURL(file); } catch (e) { /* no preview */ }
    var st = document.createElement("span");
    st.className = "px-1.5 py-1 text-mic text-discret";
    st.textContent = "Se trimite…";
    li.appendChild(img);
    li.appendChild(st);
    list.insertBefore(li, list.firstChild);
    return st;
  }

  function send(file) {
    var st = item(file);
    return shrink(file).then(function (blob) {
      var fd = new FormData();
      fd.append("poza", blob, blob === file && file.name ? file.name : "poza.jpg");
      fd.append("note", note ? note.value : "");
      return fetch(form.action || location.href, { method: "POST", body: fd, headers: { Accept: "application/json" }, credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            st.textContent = "✓ Trimisă";
            st.className = "px-1.5 py-1 text-mic font-semibold text-actiune";
          } else {
            st.textContent = d.error || "Nu s-a putut trimite.";
            st.className = "px-1.5 py-1 text-mic font-semibold text-carmin";
          }
        })
        .catch(function () {
          st.textContent = "Fără conexiune. Încercați din nou.";
          st.className = "px-1.5 py-1 text-mic font-semibold text-carmin";
        });
    });
  }

  form.addEventListener("change", function (e) {
    var input = e.target;
    if (input.type !== "file" || !input.files || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    input.value = "";
    files.forEach(function (f) {
      queue = queue.then(function () { return send(f); });
    });
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); });
})();
