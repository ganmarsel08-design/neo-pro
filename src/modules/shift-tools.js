/* Инструменты смены: «Обход» (всё отделение на одном экране), передача смены между телефонами,
   режим медсестры (показатели через QR), фото анализов для ИИ. */
(function () {
  var N = function () {
    return window.__neo || {};
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var low = function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  };
  var pad = function (x) {
    return ("0" + x).slice(-2);
  };
  var nowHM = function () {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  var b64e = function (s) {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };
  var b64d = function (s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  };
  var toast = function (msg, ms) {
    var t = document.createElement("div");
    t.className = "vundo";
    t.innerHTML = "<span>" + msg + "</span>";
    document.body.appendChild(t);
    setTimeout(function () {
      t.remove();
    }, ms || 5000);
  };
  var SUP = {
    none: "без поддержки",
    o2: "O₂ канюли",
    hfnc: "ВПК",
    cpap: "CPAP",
    nippv: "NIPPV",
    ivl: "ИВЛ",
    hfo: "ВЧО ИВЛ",
  };
  var active = function () {
    return (N().kids() || []).filter(function (k) {
      return !k.out;
    });
  };
  // время до 08:30 относится к суткам предыдущей даты (сутки 08:30 → 08:30)
  function dayFor(date, hm) {
    return hm && hm < "08:30" ? N().prev(date) : date;
  }

  /* ================= ОБХОД ================= */
  var R = { date: null };
  function entry(k, date) {
    k.days = k.days || {};
    return k.days[date] || (k.days[date] = {});
  }
  function setDyn(k, date, v) {
    var n = N(),
      w = entry(k, date),
      prevC = k.bd < date ? n.v0(k, n.prev(date)).cond : "",
      i = n.Ne.indexOf(prevC);
    if (w._dyn === v) {
      delete w._dyn;
      delete w.cond;
      if (w.ev) w.ev.worse = false;
      return;
    }
    w._dyn = v;
    w.cond = i >= 0 ? n.Ne[Math.max(0, Math.min(n.Ne.length - 1, i + v))] : "";
    w.ev = w.ev || {};
    w.ev.worse = v === 1;
  }
  function kidCard(k, date) {
    var n = N(),
      s = n.v0(k, date),
      w = (k.days || {})[date] || {},
      y = k.bd < date ? n.v0(k, n.prev(date)) : {};
    var dol = n.G0(k, date),
      dyn = w._dyn;
    var f = function (key, lab, unit, ph) {
      return (
        '<label class="f"><span>' +
        lab +
        '</span><span class="inp"><input data-k="' +
        key +
        '" inputmode="decimal" value="' +
        esc(w[key] == null ? "" : w[key]) +
        '" placeholder="' +
        esc(ph == null ? "" : ph) +
        '"><i>' +
        unit +
        "</i></span></label>"
      );
    };
    var done = dyn !== undefined;
    return (
      '<section class="kcard rd-kid' +
      (done ? " rd-done" : "") +
      '" data-id="' +
      esc(k.id) +
      '">' +
      '<div class="rd-h"><b>' +
      (done ? "✓ " : "") +
      esc(k.label) +
      '</b><a href="#kid-' +
      esc(k.id) +
      '">карта →</a></div>' +
      '<p class="meta">' +
      dol +
      "-е сут · " +
      esc(k.ga || "?") +
      " нед · " +
      esc(s.w || k.bw || "—") +
      " г · " +
      esc(SUP[s.sup] || "—") +
      (s.cond ? " · " + esc(s.cond) : "") +
      "</p>" +
      '<div class="chips rd-dyn">' +
      [
        [-1, "Лучше"],
        [0, "Без динамики"],
        [1, "Хуже"],
      ]
        .map(function (c) {
          return (
            '<button type="button" data-dyn="' +
            c[0] +
            '"' +
            (dyn === c[0] ? ' aria-pressed="true"' : "") +
            ">" +
            c[1] +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="form grid3">' +
      f("w", "Вес", "г", y.w) +
      f("urine", "Мочи", "мл", "") +
      f("stool", "Стул", "раз", "") +
      f("feed", "Кормление", "мл", y.feed) +
      f("feedN", "Кормлений", "раз", y.feedN) +
      "</div>" +
      '<label class="f wide"><span>Показатели и события — по желанию, текстом или голосом</span><textarea class="ctext" rows="2" data-txt placeholder="03:00 ЧСС 150, сат 94, АД 55/30. В 05:10 апноэ, тактильная стимуляция."></textarea></label>' +
      '<div class="actions"><button type="button" class="btn ghost" data-save>Разобрать и записать</button></div><p class="meta" data-res></p></section>'
    );
  }
  function applyText(k, date, text) {
    var n = N(),
      out = window.__neoLocal.day(text);
    var defSlot = n.F0[0];
    var DOSE = /\d\s*(мг|мкг|ед|ме|мл\/ч|мл\/кг|г\/кг)/i,
      all = n.items(out, { tab: "day", defSlot: defSlot });
    all.forEach(function (it) {
      if (DOSE.test(it.value)) it.dose = true;
    });
    var items = all.filter(function (it) {
      return it.on && !it.bad && !it.dose;
    });
    var skipped = all.filter(function (it) {
      return it.dose || it.bad;
    }).length;
    if (!items.length) return { n: 0, skipped: skipped, unclear: out.unclear || [] };
    n.apply(k, date, items);
    return {
      n: items.length,
      skipped: skipped,
      labels: items.map(function (i) {
        return i.label;
      }),
      unclear: out.unclear || [],
    };
  }
  function renderRound(J) {
    var n = N();
    if (!n.kids) return;
    var today = n.ae(Date.now());
    R.date = R.date || today;
    var date = R.date;
    var kids = active();
    var marked = kids.filter(function (k) {
      return ((k.days || {})[date] || {})._dyn !== undefined;
    }).length;
    J.className = "pro-page";
    J.innerHTML =
      '<a class="back" href="#kids">Дети</a><h1>Обход</h1>' +
      '<div class="card"><div class="chips">' +
      [
        [today, "Сегодня"],
        [n.prev(today), "Вчера"],
      ]
        .map(function (d) {
          return (
            '<button type="button" data-date="' +
            d[0] +
            '"' +
            (date === d[0] ? ' aria-pressed="true"' : "") +
            ">" +
            d[1] +
            " · " +
            d[0].split("-").reverse().slice(0, 2).join(".") +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="meta">Отмечено ' +
      marked +
      " из " +
      kids.length +
      ". Всё, что не тронуто, переносится со вчера. Показатели не выдумываются — только то, что вы ввели.</p>" +
      '<div class="actions"><button type="button" class="btn pro-btn" id="rdAll">Остальным — без динамики</button><button type="button" class="btn ghost" id="rdNurse">📷 От медсестры</button></div></div>' +
      (kids.length
        ? kids
            .map(function (k) {
              return kidCard(k, date);
            })
            .join("")
        : '<p class="muted">В отделении нет детей.</p>');
    J.querySelectorAll("[data-date]").forEach(function (b) {
      b.onclick = function () {
        R.date = b.dataset.date;
        renderRound(J);
      };
    });
    J.querySelector("#rdAll").onclick = function () {
      var left = active().filter(function (k) {
        return entry(k, date)._dyn === undefined;
      });
      if (!left.length) {
        toast("Все дети уже отмечены.");
        return;
      }
      if (
        !confirm(
          "Отметить «без динамики» за " +
            date +
            " у " +
            left.length +
            " дет.:\n" +
            left
              .map(function (k) {
                return "• " + k.label;
              })
              .join("\n") +
            "\n\nВы осмотрели каждого?",
        )
      )
        return;
      var c = 0;
      left.forEach(function (k) {
        setDyn(k, date, 0);
        n.save(k);
        c++;
      });
      toast("«Без динамики» отмечено: " + c + ".");
      renderRound(J);
    };
    J.querySelector("#rdNurse").onclick = function () {
      scanNurse(function () {
        renderRound(J);
      });
    };
    J.querySelectorAll(".rd-kid").forEach(function (sec) {
      var id = sec.dataset.id,
        get = function () {
          return (n.kids() || []).find(function (k) {
            return k.id === id;
          });
        };
      sec.querySelectorAll("[data-dyn]").forEach(function (b) {
        b.onclick = function () {
          var k = get();
          setDyn(k, date, +b.dataset.dyn);
          n.save(k);
          renderRound(J);
        };
      });
      sec.querySelectorAll("[data-k]").forEach(function (inp) {
        inp.addEventListener("input", function () {
          var k = get(),
            w = entry(k, date),
            v = inp.value.trim().replace(",", ".");
          if (v) w[inp.dataset.k] = v;
          else delete w[inp.dataset.k];
          n.save(k);
        });
      });
      sec.querySelector("[data-save]").onclick = function () {
        var ta = sec.querySelector("[data-txt]"),
          res = sec.querySelector("[data-res]"),
          t = ta.value.trim();
        if (!t) {
          res.textContent = "Нечего разбирать: напишите показатели или событие.";
          return;
        }
        var k = get(),
          r = applyText(k, date, t);
        n.save(k);
        if (!r.n) {
          res.innerHTML =
            "Ничего не распознано. " +
            (r.unclear.length ? esc(r.unclear.join("; ")) : "Нужны названия рядом с числами: «ЧСС 150».");
          return;
        }
        ta.value = "";
        res.innerHTML =
          "✓ Записано: " +
          esc(r.labels.join(", ")) +
          (r.skipped
            ? ". <b>С дозами и невозможными значениями (" + r.skipped + ") — внесите в карте вручную.</b>"
            : "") +
          (r.unclear.length ? " Проверьте: " + esc(r.unclear.join("; ")) : "");
      };
    });
  }
  window.__neoRound = renderRound;

  /* ================= ПЕРЕДАЧА СМЕНЫ ================= */
  async function pack(kids) {
    var json = JSON.stringify({ v: 1, at: Date.now(), kids: kids });
    if (window.CompressionStream) {
      try {
        var buf = await new Response(
          new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
        ).arrayBuffer();
        var bin = "",
          u = new Uint8Array(buf);
        for (var i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
        return "NEOS1z." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      } catch (e) {}
    }
    return "NEOS1." + b64e(json);
  }
  async function unpack(code) {
    var m = /NEOS1(z?)\.([A-Za-z0-9_-]+)/.exec(String(code || "").replace(/\s/g, ""));
    if (!m) throw new Error("Это не код передачи смены.");
    var d = m[2].replace(/-/g, "+").replace(/_/g, "/");
    while (d.length % 4) d += "=";
    if (!m[1]) return JSON.parse(b64d(m[2]));
    if (!window.DecompressionStream) throw new Error("Обновите iOS: этот телефон не умеет распаковывать код.");
    var bin = atob(d),
      u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var txt = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    return JSON.parse(txt);
  }
  function handoffCard() {
    var d = document.createElement("details");
    d.className = "card csec";
    d.id = "shiftBox";
    d.innerHTML =
      "<summary><b>🔁 Передать или принять смену</b></summary>" +
      '<p class="meta">Дети с анамнезом, дневниками и эпикризами переходят на телефон коллеги. Без сервера: файл или код через WhatsApp/Telegram, для 1–2 детей — QR-код.</p><p class="pill warn">Код не зашифрован: в нём вся карта ребёнка. Пока нет согласования с ИБ, передавайте только лично (QR) и не пересылайте в мессенджеры коды реальных пациентов.</p>' +
      '<h3>Передать</h3><div id="shList"></div><div class="actions"><button type="button" class="btn pro-btn" id="shSend">Отправить коллеге</button><button type="button" class="btn ghost" id="shQr">QR-код</button></div><div id="shOut"></div>' +
      '<h3>Принять</h3><div class="actions"><button type="button" class="btn ghost" id="shScan">Сканировать QR</button><label class="btn ghost filebtn">Открыть файл<input type="file" id="shFile" accept=".txt,.neo,text/plain" hidden></label></div>' +
      '<div class="form"><label class="f wide"><span>или вставьте код</span><span class="inp"><input id="shCode" placeholder="NEOS1…" autocomplete="off"><i></i></span></label></div><div id="shIn"></div>';
    var list = d.querySelector("#shList"),
      out = d.querySelector("#shOut"),
      inn = d.querySelector("#shIn");
    var fill = function () {
      list.innerHTML =
        active()
          .map(function (k) {
            return (
              '<label class="chk"><input type="checkbox" data-sh="' +
              esc(k.id) +
              '" checked><span>' +
              esc(k.label) +
              "</span></label>"
            );
          })
          .join("") || '<p class="muted">Нет детей в отделении.</p>';
    };
    d.addEventListener("toggle", fill);
    var chosen = function () {
      var ids = [].slice.call(list.querySelectorAll("[data-sh]:checked")).map(function (x) {
        return x.dataset.sh;
      });
      return (N().kids() || []).filter(function (k) {
        return ids.indexOf(k.id) >= 0;
      });
    };
    d.querySelector("#shSend").onclick = async function () {
      var ks = chosen();
      if (!ks.length) {
        out.innerHTML = '<p class="pill warn">Отметьте детей.</p>';
        return;
      }
      var code = await pack(ks),
        name = "smena-" + N().ae(Date.now()) + "-" + ks.length + ".txt";
      var file = new File([code], name, { type: "text/plain" });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Передача смены" });
          out.innerHTML = '<p class="pill ok">Отправлено: ' + ks.length + " дет.</p>";
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
      try {
        await navigator.clipboard.writeText(code);
        out.innerHTML =
          '<p class="pill ok">Код скопирован (' + ks.length + " дет.). Вставьте его коллеге в мессенджер.</p>";
      } catch (e) {
        out.innerHTML =
          '<p class="meta">Скопируйте код:</p><textarea class="ctext" rows="3" readonly>' + esc(code) + "</textarea>";
      }
    };
    d.querySelector("#shQr").onclick = async function () {
      var ks = chosen();
      if (!ks.length) return;
      var code = await pack(ks);
      if (code.length > 2200) {
        out.innerHTML =
          '<p class="pill warn">Слишком много данных для QR (' +
          ks.length +
          " дет.). Отметьте 1–2 детей или нажмите «Отправить коллеге».</p>";
        return;
      }
      out.innerHTML =
        '<div class="qrdark"><div class="qrbox">' +
        N().qr(code) +
        '</div><p class="qrcap">Коллега: «Передать или принять смену» → «Сканировать QR»</p></div>';
    };
    var take = async function (code) {
      var o;
      try {
        o = await unpack(code);
      } catch (e) {
        inn.innerHTML = '<p class="pill warn">' + esc(e.message || "Код повреждён.") + "</p>";
        return;
      }
      var mine = N().kids() || [],
        rows = (o.kids || []).map(function (k) {
          var m = mine.find(function (x) {
            return x.id === k.id;
          });
          var st = !m ? "new" : (k.upd || 0) > (m.upd || 0) ? "newer" : "older";
          return { k: k, st: st };
        });
      inn.innerHTML =
        '<div class="card"><b>В коде ' +
        rows.length +
        " дет.</b>" +
        rows
          .map(function (r, i) {
            return (
              '<label class="chk"><input type="checkbox" data-in="' +
              i +
              '" ' +
              (r.st !== "older" ? "checked" : "") +
              "><span>" +
              esc(r.k.label) +
              " — " +
              { new: "новый", newer: "обновит вашу карточку", older: "у вас уже новее" }[r.st] +
              "</span></label>"
            );
          })
          .join("") +
        '<div class="actions"><button type="button" class="btn pro-btn" id="shTake">Принять отмеченных</button></div></div>';
      inn.querySelector("#shTake").onclick = function () {
        var picked = [].slice.call(inn.querySelectorAll("[data-in]:checked")).map(function (x) {
          return rows[+x.dataset.in];
        });
        var old = picked.filter(function (r) {
            return r.st === "older";
          }),
          repl = picked.filter(function (r) {
            return r.st !== "new";
          });
        if (
          old.length &&
          !confirm(
            "У вас уже есть более новые карточки: " +
              old
                .map(function (r) {
                  return r.k.label;
                })
                .join(", ") +
              ".\nЕсли принять, ваши последние записи по этим детям будут ПОТЕРЯНЫ. Продолжить?",
          )
        )
          return;
        if (
          repl.length &&
          !old.length &&
          !confirm(
            "Карточки " +
              repl
                .map(function (r) {
                  return r.k.label;
                })
                .join(", ") +
              " будут заменены целиком версией коллеги. Записи, сделанные на этом телефоне после передачи, пропадут. Продолжить?",
          )
        )
          return;
        var c = 0;
        picked.forEach(function (r) {
          N().save(JSON.parse(JSON.stringify(r.k)));
          c++;
        });
        inn.innerHTML = '<p class="pill ok">Принято: ' + c + " дет.</p>";
        setTimeout(function () {
          N().rerender && N().rerender();
        }, 600);
      };
    };
    d.querySelector("#shScan").onclick = function () {
      N().scan(take, function (e) {
        inn.innerHTML = '<p class="pill warn">' + esc(e) + "</p>";
      });
    };
    d.querySelector("#shCode").addEventListener("input", function (e) {
      if (/NEOS1/.test(e.target.value)) take(e.target.value);
    });
    d.querySelector("#shFile").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (f) f.text().then(take);
      e.target.value = "";
    });
    return d;
  }

  /* ================= МЕДСЕСТРА ================= */
  var NQ = "neo.nurseQ";
  var q = function () {
    try {
      return JSON.parse(localStorage.getItem(NQ) || "[]");
    } catch (e) {
      return [];
    }
  };
  var qs = function (a) {
    try {
      localStorage.setItem(NQ, JSON.stringify(a));
    } catch (e) {
      window.__neoSaveErr && window.__neoSaveErr(e, "nurseQ");
    }
  };
  var VF = [
    ["hr", "ЧСС", "/мин"],
    ["rr", "ЧД", "/мин"],
    ["spo2", "SpO₂", "%"],
    ["bp", "АД", "мм"],
    ["t", "T", "°C"],
  ];
  function renderNurse(J) {
    var a = q(),
      labels = [];
    a.forEach(function (x) {
      if (labels.indexOf(x.l) < 0) labels.push(x.l);
    });
    try {
      JSON.parse(localStorage.getItem("neo.nurseL") || "[]").forEach(function (l) {
        if (labels.indexOf(l) < 0) labels.push(l);
      });
    } catch (e) {}
    J.className = "pro-page";
    J.innerHTML =
      '<h1>Показатели · медсестра</h1><p class="meta">Записи копятся на этом телефоне. Потом покажите врачу QR-код — показатели лягут в дневники по времени. Фамилии не вводите, только метку (кювез).</p>' +
      '<div class="card"><div class="chips" id="nuL">' +
      labels
        .map(function (l) {
          return '<button type="button" data-l="' + esc(l) + '">' + esc(l) + "</button>";
        })
        .join("") +
      "</div>" +
      '<div class="form grid3"><label class="f wide"><span>Ребёнок (метка)</span><span class="inp"><input id="nuLab" placeholder="Кювез 3"><i></i></span></label>' +
      '<label class="f"><span>Время</span><span class="inp"><input id="nuT" type="time" value="' +
      nowHM() +
      '"></span></label>' +
      VF.map(function (v) {
        return (
          '<label class="f"><span>' +
          v[1] +
          '</span><span class="inp"><input data-v="' +
          v[0] +
          '" inputmode="' +
          (v[0] === "bp" ? "text" : "decimal") +
          '" placeholder="' +
          (v[0] === "bp" ? "55/30" : "") +
          '"><i>' +
          v[2] +
          "</i></span></label>"
        );
      }).join("") +
      '<label class="f wide"><span>Заметка (апноэ, срыгивание…)</span><span class="inp"><input id="nuN"><i></i></span></label></div>' +
      '<div class="actions"><button type="button" class="btn pro-btn" id="nuAdd">Добавить</button></div><p id="nuMsg" class="meta"></p></div>' +
      "<h2>Не переданы врачу: " +
      a.length +
      '</h2><div class="card">' +
      (a.length
        ? a
            .slice()
            .reverse()
            .map(function (x) {
              return (
                "<p><b>" +
                esc(x.l) +
                "</b> · " +
                esc(x.t) +
                " — " +
                VF.filter(function (v) {
                  return x.v[v[0]];
                })
                  .map(function (v) {
                    return v[1] + " " + esc(x.v[v[0]]);
                  })
                  .join(", ") +
                (x.n ? " · " + esc(x.n) : "") +
                "</p>"
              );
            })
            .join("") +
          '<div class="actions"><button type="button" class="btn pro-btn" id="nuQr">Показать QR врачу</button><button type="button" class="btn ghost" id="nuClr">Очистить переданные</button></div><div id="nuQrBox"></div>'
        : '<p class="muted">Пусто.</p>') +
      "</div>";
    var lab = J.querySelector("#nuLab");
    J.querySelectorAll("[data-l]").forEach(function (b) {
      b.onclick = function () {
        lab.value = b.dataset.l;
      };
    });
    J.querySelector("#nuAdd").onclick = function () {
      var l = lab.value.trim(),
        v = {},
        msg = J.querySelector("#nuMsg");
      J.querySelectorAll("[data-v]").forEach(function (i) {
        if (i.value.trim()) v[i.dataset.v] = i.value.trim().replace(",", ".").replace(/\s/g, "");
      });
      var note = J.querySelector("#nuN").value.trim();
      if (!l) {
        msg.textContent = "Укажите метку ребёнка.";
        return;
      }
      if (!Object.keys(v).length && !note) {
        msg.textContent = "Введите хотя бы один показатель.";
        return;
      }
      var a2 = q();
      a2.push({
        l: l,
        d: N().ae ? N().ae(Date.now()) : new Date().toISOString().slice(0, 10),
        t: J.querySelector("#nuT").value || nowHM(),
        v: v,
        n: note,
      });
      qs(a2);
      try {
        var L = JSON.parse(localStorage.getItem("neo.nurseL") || "[]");
        if (L.indexOf(l) < 0) {
          L.push(l);
          localStorage.setItem("neo.nurseL", JSON.stringify(L.slice(-20)));
        }
      } catch (e) {}
      renderNurse(J);
    };
    var qr = J.querySelector("#nuQr");
    qr &&
      (qr.onclick = function () {
        var a3 = q(),
          code = "NEOV1." + b64e(JSON.stringify(a3));
        var box = J.querySelector("#nuQrBox");
        if (code.length > 2200) {
          box.innerHTML = '<p class="pill warn">Записей слишком много для одного QR. Передайте часть и очистите.</p>';
          return;
        }
        box.innerHTML =
          '<div class="qrdark"><div class="qrbox">' +
          N().qr(code) +
          '</div><p class="qrcap">Врач: «Обход» → «📷 От медсестры»</p></div>';
      });
    var clr = J.querySelector("#nuClr");
    clr &&
      (clr.onclick = function () {
        if (confirmBox(clr, "Точно удалить записи с этого телефона?")) {
          qs([]);
          renderNurse(J);
        }
      });
  }
  function confirmBox(btn, text) {
    if (btn.dataset.sure) return true;
    btn.dataset.sure = 1;
    btn.textContent = "Нажмите ещё раз, чтобы удалить";
    return false;
  }
  window.__neoNurse = renderNurse;
  function scanNurse(done) {
    var n = N();
    n.scan(
      function (code) {
        var m = /NEOV1\.([A-Za-z0-9_-]+)/.exec(String(code || "").replace(/\s/g, ""));
        if (!m) {
          toast("Это не QR медсестры.");
          return;
        }
        var arr;
        try {
          arr = JSON.parse(b64d(m[1]));
        } catch (e) {
          toast("QR повреждён.");
          return;
        }
        var kids = active(),
          ok = 0,
          miss = [];
        arr.forEach(function (x) {
          // Только точное совпадение метки: частичное («1» и «Койка 12») записывало показатели не тому ребёнку
          var same = kids.filter(function (k) {
            return low(k.label) === low(x.l);
          });
          if (same.length !== 1) {
            miss.push(x.l + (same.length > 1 ? " (несколько детей с такой меткой)" : ""));
            return;
          }
          var k = same[0];
          var date = dayFor(x.d, x.t),
            slot = n.Bi(x.t) || n.F0[0],
            items = [];
          Object.keys(x.v || {}).forEach(function (f) {
            items.push({ grp: "", label: f, path: ["vit", slot, f], value: String(x.v[f]), on: true });
          });
          if (x.n)
            items.push({
              grp: "",
              label: "Заметка",
              path: ["event", slot, ""],
              value: x.t + " — " + x.n.replace(/[.\s]+$/, "") + " (по данным медсестры).",
              on: true,
            });
          if (!items.length) return;
          n.apply(k, date, items);
          n.save(k);
          ok++;
        });
        toast(
          "От медсестры записано: " +
            ok +
            (miss.length ? ". Не нашёл детей: " + esc(miss.join(", ")) + " — проверьте метки." : "."),
          7000,
        );
        done && done();
      },
      function (e) {
        toast(esc(e));
      },
    );
  }

  /* ================= ФОТО АНАЛИЗОВ (с ключом ИИ) ================= */
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var img = new Image(),
        url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1800 / Math.max(img.width, img.height)),
          c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        bad(new Error("Не удалось открыть фото."));
      };
      img.src = url;
    });
  }
  async function ocr(imgs) {
    var n = N(),
      prov = n.prov(),
      key = n.key();
    var ask =
      "Перепиши дословно текст лабораторного бланка новорождённого: каждый показатель с новой строки в виде «название значение». Ничего не добавляй и не толкуй. ФИО, ИИН, номера историй не переписывай. Неразборчивое пропусти.";
    if (prov === "gemini") {
      var r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(n.model()) + ":generateContent",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: imgs
                  .map(function (d) {
                    return { inline_data: { mime_type: "image/jpeg", data: d } };
                  })
                  .concat([{ text: ask }]),
              },
            ],
          }),
        },
      );
      var j = await r.json().catch(function () {
        return {};
      });
      if (!r.ok) throw new Error("Ошибка Gemini: " + ((j.error && j.error.message) || r.status));
      return ((((j.candidates || [])[0] || {}).content || {}).parts || [])
        .filter(function (p) {
          return p.text && !p.thought;
        })
        .map(function (p) {
          return p.text;
        })
        .join("\n");
    }
    var rr = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: n.model(),
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: imgs
              .map(function (d) {
                return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } };
              })
              .concat([{ type: "text", text: ask }]),
          },
        ],
      }),
    });
    var jj = await rr.json().catch(function () {
      return {};
    });
    if (!rr.ok)
      throw new Error(
        rr.status === 401 ? "Ключ ИИ не подошёл." : "Ошибка ИИ: " + ((jj.error && jj.error.message) || rr.status),
      );
    return (jj.content || [])
      .filter(function (c) {
        return c.type === "text";
      })
      .map(function (c) {
        return c.text;
      })
      .join("\n");
  }
  function labsPhoto() {
    if (location.hash !== "#labs") return;
    var go = document.getElementById("lparse");
    if (!go || document.getElementById("lPhoto")) return;
    var n = N();
    if (!(n.me && n.me())) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn ghost";
    b.id = "lPhoto";
    b.textContent = "📷 Фото бланка";
    var f = document.createElement("input");
    f.type = "file";
    f.accept = "image/*";
    f.multiple = true;
    f.hidden = true;
    go.parentNode.appendChild(b);
    go.parentNode.appendChild(f);
    b.onclick = function () {
      f.click();
    };
    f.onchange = async function () {
      var fs = [].slice.call(f.files || [], 0, 3);
      f.value = "";
      if (!fs.length) return;
      b.disabled = true;
      b.textContent = "Читаю фото…";
      try {
        var t = await ocr(await Promise.all(fs.map(shrink)));
        var ta = document.getElementById("lraw");
        ta.value = t.trim();
        ta.dispatchEvent(new Event("input"));
        go.click();
      } catch (e) {
        toast(esc(e.message || e));
      }
      b.disabled = false;
      b.textContent = "📷 Фото бланка";
    };
  }

  /* ================= на странице «Дети» ================= */
  function kidsPage() {
    if (location.hash !== "#kids" && location.hash !== "") return;
    var strip = document.querySelector(".pro-strip");
    if (!strip || document.getElementById("rdLink")) return;
    var bar = document.createElement("div");
    bar.id = "rdLink";
    bar.className = "actions rd-links";
    bar.innerHTML =
      '<a class="btn pro-btn" href="#round">🩺 Обход отделения</a><button type="button" class="btn ghost" id="nuLink">👩‍⚕️ Ссылка для медсестры</button>';
    strip.parentNode.insertBefore(bar, strip.nextSibling);
    bar.querySelector("#nuLink").onclick = async function () {
      var url = location.href.split("#")[0] + "#nurse";
      try {
        if (navigator.share) {
          await navigator.share({ title: "Показатели для врача", url: url });
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
      try {
        await navigator.clipboard.writeText(url);
        toast("Ссылка скопирована. Медсестра открывает её в Safari — активация не нужна.");
      } catch (e) {
        toast(esc(url), 10000);
      }
    };
    var aig = document.getElementById("aigImp"),
      box = handoffCard();
    (aig || bar).parentNode.insertBefore(box, (aig || bar).nextSibling);
  }

  function tick() {
    kidsPage();
    labsPhoto();
  }
  var st = document.createElement("style");
  st.textContent =
    ".rd-links{margin:10px 0}.rd-links .btn{flex:1 1 45%;text-align:center}.rd-kid .rd-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.rd-kid .rd-h b{font-size:1.1em}.rd-done{opacity:.92;border-left:4px solid var(--green-ink,#2a9d63)}.rd-dyn{margin:6px 0 4px}";
  document.head.appendChild(st);
  new MutationObserver(function () {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 80);
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", function () {
    setTimeout(tick, 150);
  });
  setTimeout(tick, 500);
})();
