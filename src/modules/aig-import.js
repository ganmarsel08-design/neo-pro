/* Приём ребёнка из АиГДневника Pro: QR-код или код текстом. Создаёт карточку с данными матери и родов. */
(function () {
  function dec(code) {
    var m = /AIG1\.([A-Za-z0-9_-]+)/.exec(String(code || "").replace(/\s/g, ""));
    if (!m) return null;
    var b = m[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    try {
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) {
      return null;
    }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function show(box, o) {
    var k = o.kid;
    var dup = (window.__neo.kids() || []).some(function (x) {
      return x.bd === k.bd && x.bt === k.bt && String(x.bw) === String(k.bw);
    });
    box.innerHTML =
      "<p><b>" +
      esc(k.ga) +
      (k.gad ? "+" + esc(k.gad) : "") +
      " нед · " +
      esc(k.bw || "—") +
      " г · " +
      (k.sex === "ж" ? "девочка" : k.sex === "м" ? "мальчик" : "пол не указан") +
      " · родился " +
      esc(k.bd) +
      " " +
      esc(k.bt) +
      "</b></p>" +
      '<p class="meta">' +
      esc((k.adm && k.adm.pregTxt) || "") +
      (k.adm && k.adm.mBlood ? " Группа крови матери " + esc(k.adm.mBlood) + "." : "") +
      "</p>" +
      (dup ? '<p class="pill warn">Похоже, этот ребёнок уже есть в списке.</p>' : "") +
      '<div class="form"><label class="f wide"><span>Метка (без фамилии)</span><span class="inp"><input id="aigLabel" value="' +
      esc(o.label || "") +
      '" placeholder="Кювез 3"><i></i></span></label></div>' +
      '<div class="actions"><button class="btn pro-btn" type="button" id="aigSave">Сохранить ребёнка</button></div>';
    box.querySelector("#aigSave").addEventListener("click", function () {
      var kid = JSON.parse(JSON.stringify(k));
      kid.id = Date.now().toString(36);
      kid.label = (box.querySelector("#aigLabel").value || "").trim() || o.label || "Новорождённый";
      kid.cs = kid.cs || {};
      kid.days = kid.days || {};
      kid.from = "aig";
      window.__neo.save(kid);
      location.hash = "#kid-" + kid.id;
    });
  }
  function inject() {
    if (location.hash !== "#kids" || !window.__neo) return;
    var strip = document.querySelector(".pro-strip");
    if (!strip || document.getElementById("aigImp")) return;
    var d = document.createElement("details");
    d.className = "card csec";
    d.id = "aigImp";
    d.innerHTML =
      '<summary><b>＋ Принять из АиГДневника</b></summary><p class="meta">Акушер показывает QR-код во вкладке «Роды / КС» → «Передать ребёнка неонатологу». Карточка заполнится: срок, масса, Апгар, роды, воды, безводный период, стероиды, течение беременности, группа крови матери.</p>' +
      '<div class="actions"><button class="btn pro-btn" type="button" id="aigScan">Сканировать QR-код</button></div>' +
      '<div class="form"><label class="f wide"><span>или вставьте код текстом</span><span class="inp"><input id="aigCode" placeholder="AIG1…" autocomplete="off"><i></i></span></label></div><div id="aigOut"></div>';
    strip.parentNode.insertBefore(d, strip.nextSibling);
    var out = d.querySelector("#aigOut");
    function take(t) {
      var o = dec(t);
      if (!o || !o.kid) {
        out.innerHTML = '<p class="pill warn">Это не код АиГДневника.</p>';
        return;
      }
      show(out, o);
    }
    d.querySelector("#aigScan").addEventListener("click", function () {
      window.__neo.scan(take, function (e) {
        out.innerHTML = '<p class="pill warn">' + esc(e) + "</p>";
      });
    });
    d.querySelector("#aigCode").addEventListener("input", function (e) {
      if (/AIG1\./.test(e.target.value)) take(e.target.value);
    });
  }
  new MutationObserver(function () {
    clearTimeout(inject._t);
    inject._t = setTimeout(inject, 60);
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", function () {
    setTimeout(inject, 120);
  });
  setTimeout(inject, 300);
})();
