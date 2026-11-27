/* Журнал смены: быстрая запись событий по детям в течение смены (поступил, назначил, отменил, процедура,
   исследование, анализ…). Время ставится само. Каждое событие сразу попадает в «Что было в это время»
   нужного интервала дневника (08:30–12:00, 12:00–15:00 …), поэтому вечером ничего не нужно вспоминать.
   Дозы и названия препаратов записываются ровно так, как вы их ввели: ничего не распознаётся и не подставляется.
   Лента смены показывает всё по времени, порядок поступления и копируется текстом. */
(function () {
  var N = function () { return window.__neo || {}; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad = function (x) { return ('0' + x).slice(-2); };
  var nowHM = function () { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var today = function () { return N().ae ? N().ae(Date.now()) : ''; };
  var ddmm = function (d) { return d ? d.split('-').reverse().slice(0, 2).join('.') : ''; };
  var clean = function (s) { return String(s || '').replace(/\s+/g, ' ').trim().replace(/[.;,\s]+$/, ''); };
  // первое слово с маленькой буквы, но аббревиатуры (КОС, ЭхоКГ, PIP, НСГ) не трогаем
  var lowerFirst = function (x) { var w = String(x || '').split(/[\s,:;]/)[0]; return w.length > 1 && w.slice(1) === w.slice(1).toLowerCase() && w.charAt(0) !== w.charAt(0).toLowerCase() ? x.charAt(0).toLowerCase() + x.slice(1) : x; };
  var lsGet = function (k) { try { return localStorage.getItem('neo.sl.' + k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem('neo.sl.' + k, v); } catch (e) { } };

  var TYPES = [
    { k: 'adm', l: 'Поступил', ph: 'Откуда, как поступил, состояние — по желанию', q: [] },
    { k: 'rx', l: 'Назначил', ph: 'Препарат, доза, путь, кратность — как назначили', q: [] },
    { k: 'rxoff', l: 'Отменил', ph: 'Что отменили', q: [] },
    { k: 'chg', l: 'Изменил', ph: 'Что изменили: параметры ИВЛ, дозу, скорость инфузии…', q: [] },
    { k: 'proc', l: 'Процедура', ph: 'Что проведено', q: ['Сурфактант эндотрахеально', 'Интубация трахеи', 'Катетеризация пупочной вены', 'Дренаж плевральной полости', 'Гемотрансфузия', 'Люмбальная пункция'] },
    { k: 'dx', l: 'Исследование', ph: 'Что и с каким результатом', q: ['ЭхоКГ', 'НСГ', 'Рентгенография ОГК и ОБП', 'УЗИ органов брюшной полости', 'Забор крови на стерильность'] },
    { k: 'lab', l: 'Анализ', ph: 'Что и какие значения', q: ['КОС: pH ', 'ОАК', 'СРБ', 'Биохимия', 'Глюкоза крови'] },
    { k: 'cons', l: 'Консультация', ph: 'Кто смотрел и что рекомендовал', q: ['Кардиохирург', 'Невролог', 'Хирург', 'Консилиум'] },
    { k: 'note', l: 'Другое', ph: 'Любое событие', q: [] }
  ];
  var TL = {}; TYPES.forEach(function (t) { TL[t.k] = t; });

  /* ---------- сутки 08:30 → 08:30 и интервалы дневника ---------- */
  function dayFor(date, hm) { return hm && hm < '08:30' ? N().prev(date) : date; }
  function slotFor(hm) {
    var F0 = N().F0 || [];
    for (var i = 0; i < F0.length; i++) { var p = F0[i].split('–'); if (hm >= p[0] && hm < p[1]) return F0[i]; }
    return F0[0];
  }
  function getKid(id) { return (N().kids() || []).find(function (k) { return k.id === id; }); }

  /* ---------- текст события для дневника ---------- */
  function sent(it, first) {
    var x = lowerFirst(clean(it.text)), body;
    switch (it.type) {
      case 'adm': body = 'поступил в ОРИТН' + (x ? ': ' + x : ''); break;
      case 'rx': body = 'назначено: ' + x; break;
      case 'rxoff': body = 'отменено: ' + x; break;
      case 'chg': body = 'изменено: ' + x; break;
      case 'proc': body = 'проведено: ' + x; break;
      case 'dx': body = 'выполнено: ' + x; break;
      case 'lab': body = 'получен результат: ' + x; break;
      case 'cons': body = 'консультация: ' + x; break;
      default: body = x;
    }
    var j = window.__neoHints ? window.__neoHints.justText(it) : '';
    // в первом интервале суток текст идёт в «За прошедшие сутки: …», поэтому без заглавной и без точки
    return first ? 'в ' + it.hm + ' ' + body + (j ? ' (' + lowerFirst(j) + ')' : '') : 'В ' + it.hm + ' ' + body + '.' + (j ? ' ' + j + '.' : '');
  }
  function place(k, it) {
    var F0 = N().F0, dk = dayFor(it.date, it.hm), slot = slotFor(it.hm);
    if (k.bd && dk < k.bd) { dk = k.bd; slot = F0[0]; }
    return { dk: dk, slot: slot, first: slot === F0[0] };
  }
  function getNote(e, slot, first) { return first ? (e.note || '') : ((e.slotNote || {})[slot] || ''); }
  function setNote(e, slot, first, v) {
    if (first) { if (v) e.note = v; else delete e.note; return; }
    if (v) { e.slotNote = e.slotNote || {}; e.slotNote[slot] = v; }
    else if (e.slotNote) { delete e.slotNote[slot]; if (!Object.keys(e.slotNote).length) delete e.slotNote; }
  }
  function inject(k, it) {
    var p = place(k, it); k.days = k.days || {};
    var e = k.days[p.dk] || (k.days[p.dk] = {}), cur = getNote(e, p.slot, p.first), s = sent(it, p.first);
    var base = p.first ? cur.replace(/[.\s]+$/, '') : cur;
    setNote(e, p.slot, p.first, base ? base + (p.first ? '; ' : ' ') + s : s);
    it.dk = p.dk; it.slot = p.slot; it.s = s;
  }
  // убирает ровно ту фразу, которую добавили; если врач её уже переписал руками — не трогает дневник
  function uninject(k, it) {
    if (!it.dk || !it.s || !k.days || !k.days[it.dk]) return false;
    var e = k.days[it.dk], first = it.slot === N().F0[0], cur = getNote(e, it.slot, first), i = cur.indexOf(it.s);
    if (i < 0) return false;
    var before = cur.slice(0, i), after = cur.slice(i + it.s.length);
    if (/(;\s|\s)$/.test(before) && before.trim()) before = before.replace(/(;\s*|\s+)$/, ''); else after = after.replace(/^(;\s*|\s+)/, '');
    setNote(e, it.slot, first, (before + (before && after ? (first ? '; ' : ' ') : '') + after).trim());
    if (!Object.keys(e).length) delete k.days[it.dk];
    return true;
  }
  var uid = function () { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); };
  function addEvent(kid, o) {
    var k = getKid(kid); if (!k) return null;
    var it = { id: uid(), date: o.date, hm: o.hm, type: o.type, text: clean(o.text), ts: Date.now() };
    if (o.just && o.just.length) it.just = o.just; if (o.jr) it.jr = o.jr;
    inject(k, it); (k.log = k.log || []).push(it); var f0 = window.__neoSaveFails || 0; N().save(k); if ((window.__neoSaveFails || 0) !== f0) it.unsaved = true; return it;
  }
  function delEvent(kid, id) {
    var k = getKid(kid); if (!k) return null;
    var it = (k.log || []).find(function (x) { return x.id === id; }); if (!it) return null;
    var snap = JSON.parse(JSON.stringify(it)), ok = uninject(k, it);
    k.log = k.log.filter(function (x) { return x.id !== id; }); N().save(k); return { it: snap, ok: ok };
  }
  function editEvent(kid, id, o) {
    var k = getKid(kid); if (!k) return false;
    var it = (k.log || []).find(function (x) { return x.id === id; }); if (!it) return false;
    var ok = uninject(k, it);
    it.date = o.date; it.hm = o.hm; it.type = o.type; it.text = clean(o.text);
    if (o.just && o.just.length) it.just = o.just; else delete it.just;
    inject(k, it); N().save(k); return ok;
  }
  function refresh() { try { if (/^#kid-/.test(location.hash) && N().rerender) N().rerender(); } catch (e) { } try { window.__neoHints && window.__neoHints.refresh(); } catch (e) { } }

  /* ---------- вспомогательное оформление ---------- */
  var DOSE = /(\d+(?:[.,]\d+)?\s?(?:мкг|мг|г|мл|ед|ме|ммоль|мэкв)(?:\/[а-я]+){0,2})/gi;
  var showText = function (s) { return esc(s).replace(DOSE, '<mark>$1</mark>'); };
  function toast(msg, undoLabel, undo) {
    var old = document.querySelector('.vundo.sl'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'vundo sl';
    t.innerHTML = '<span>' + msg + '</span>' + (undo ? '<button type="button">' + undoLabel + '</button>' : '');
    if (undo) t.querySelector('button').onclick = function () { undo(); t.remove(); };
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 7000);
  }
  function kidsList() { return (N().kids() || []).filter(function (k) { return !k.out; }); }
  function kidName(k) { return k.label || 'Ребёнок'; }
  function kidChip(k, sel) {
    var d = ''; try { d = ' · ' + N().G0(k, today()) + ' сут'; } catch (e) { }
    return '<button type="button" data-kid="' + esc(k.id) + '"' + (sel ? ' aria-pressed="true"' : '') + '>' + esc(kidName(k)) + d + '</button>';
  }
  function closeSheet() {
    var s = document.getElementById('slsh'); if (s) s.remove();
    if (!document.getElementById('vsh') && !document.getElementById('ash')) document.body.classList.remove('vopen');
  }
  function openSheet(html) {
    closeSheet();
    var s = document.createElement('div'); s.id = 'slsh'; s.className = 'vsheet';
    s.innerHTML = '<div class="vbox sl-box">' + html + '</div>';
    s.addEventListener('click', function (e) { if (e.target === s) closeSheet(); });
    document.body.appendChild(s); document.body.classList.add('vopen');
    return s;
  }

  /* ================= ЗАПИСАТЬ СОБЫТИЕ ================= */
  var S = null;
  function openAdd(edit, pre) {
    var kids = kidsList();
    S = { kid: '', type: lsGet('type') || 'rx', hm: nowHM(), date: today(), text: '', edit: null, justs: {}, jr: '' };
    if (edit) { S.kid = edit.kid; S.type = edit.it.type; S.hm = edit.it.hm; S.date = edit.it.date; S.text = edit.it.text; S.edit = edit; (edit.it.just || []).forEach(function (j) { S.justs[j.rule] = j; }); }
    else if (pre) { S.kid = pre.kid || ''; S.type = pre.type || S.type; S.text = pre.text || ''; S.jr = pre.jr || ''; }
    else {
      var last = lsGet('kid');
      S.kid = kids.some(function (k) { return k.id === last; }) ? last : (kids.length === 1 ? kids[0].id : '');
    }
    renderAdd();
  }
  function renderAdd() {
    var kids = kidsList(), T = TL[S.type] || TYPES[1], tdy = today(), yst = N().prev(tdy);
    if (S.edit && !kids.some(function (k) { return k.id === S.edit.kid; })) { var ek = getKid(S.edit.kid); if (ek) kids = [ek].concat(kids); }
    var html = '<div class="sl-h"><b>' + (S.edit ? 'Правка события' : 'Новое событие') + '</b><span>' + (S.edit ? '' : '<button type="button" class="sl-lnk" data-dict>🎙 Диктовкой</button>') + '<button type="button" class="sl-x" data-close aria-label="Закрыть">✕</button></span></div>' +
      (kids.length ? '' : '<p class="pill warn">В отделении нет детей. Сначала добавьте ребёнка.</p>') +
      '<p class="meta sl-l">Кто</p><div class="chips sl-kids">' + kids.map(function (k) { return kidChip(k, k.id === S.kid); }).join('') + '</div>' +
      '<p class="meta sl-l">Что</p><div class="chips sl-types">' + TYPES.map(function (t) { return '<button type="button" data-type="' + t.k + '"' + (t.k === S.type ? ' aria-pressed="true"' : '') + '>' + t.l + '</button>'; }).join('') + '</div>' +
      (T.q.length ? '<div class="chips sl-q">' + T.q.map(function (q, i) { return '<button type="button" data-q="' + i + '">' + esc(q) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="sl-time"><label class="f"><span>Время</span><span class="inp"><input type="time" id="slTime" value="' + esc(S.hm) + '"></span></label>' +
      '<div class="chips sl-dates">' + [[tdy, 'Сегодня'], [yst, 'Вчера']].map(function (d) { return '<button type="button" data-date="' + d[0] + '"' + (S.date === d[0] ? ' aria-pressed="true"' : '') + '>' + d[1] + ' · ' + ddmm(d[0]) + '</button>'; }).join('') + '</div></div>' +
      '<label class="f sl-f"><span>' + (S.type === 'adm' ? 'Подробности (по желанию)' : 'Текст события') + '</span><textarea class="ctext" id="slText" rows="2" placeholder="' + esc(T.ph) + '">' + esc(S.text) + '</textarea></label>' +
      '<p class="meta sl-hint">Названия и дозы записываются как введены — проверьте их перед сохранением. Голосом: микрофон на клавиатуре телефона.</p>' +
      (S.jr ? '<p class="pill info">Запись-обоснование: попадёт в дневник и закроет напоминание в карточке ребёнка.</p>' : '') +
      '<div id="slHints" class="sl-hints"></div>' +
      '<p class="pill warn" id="slErr" hidden></p>' +
      '<div class="actions sl-act"><button type="button" class="btn pro-btn" id="slSave">' + (S.edit ? 'Сохранить' : 'Записать') + '</button>' +
      (S.edit ? '' : '<button type="button" class="btn ghost" id="slSaveMore">Записать и ещё</button>') +
      '<button type="button" class="btn ghost" id="slToLog">Лента смены</button></div>';
    var sh = openSheet(html), box = sh.querySelector('.vbox'), ta = sh.querySelector('#slText'), err = sh.querySelector('#slErr'), hb = sh.querySelector('#slHints');
    var HN = window.__neoHints;
    function drawHints() {
      var k = getKid(S.kid);
      S.hints = HN && k ? HN.analyze(k, { id: S.edit ? S.edit.it.id : null, type: S.type, text: S.text, date: S.date, hm: S.hm }) : [];
      hb.innerHTML = HN ? HN.list(S.hints, { justify: true, justs: S.justs }) : '';
    }
    if (HN) HN.bind(hb, function () { return S.hints; }, S, drawHints);
    drawHints();
    var dh = function () { clearTimeout(dh._t); dh._t = setTimeout(drawHints, 350); };
    ta.addEventListener('input', function () { S.text = ta.value; dh(); });
    sh.querySelector('#slTime').addEventListener('input', function (e) { S.hm = e.target.value || S.hm; dh(); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.hasAttribute('data-dict')) { openDictate(); return; }
      if (b.dataset.kid) { S.kid = b.dataset.kid; renderAdd(); return; }
      if (b.dataset.type) { S.type = b.dataset.type; renderAdd(); return; }
      if (b.dataset.date) { S.date = b.dataset.date; renderAdd(); return; }
      if (b.dataset.q != null) {
        var q = TL[S.type].q[+b.dataset.q];
        S.text = S.text && !/[.,:;]$/.test(S.text.trim()) ? S.text.trim() + ', ' + q : (S.text ? S.text + ' ' : '') + q;
        renderAdd(); var t2 = document.getElementById('slText'); t2.focus(); t2.setSelectionRange(t2.value.length, t2.value.length); return;
      }
      if (b.id === 'slToLog') { openLog(); return; }
      if (b.id === 'slSave' || b.id === 'slSaveMore') save(b.id === 'slSaveMore');
    });
    function bad(m) { err.textContent = m; err.hidden = false; }
    function save(more) {
      S.text = ta.value; S.hm = sh.querySelector('#slTime').value || S.hm;
      if (!S.kid) return bad('Выберите ребёнка.');
      if (!/^\d\d:\d\d$/.test(S.hm)) return bad('Укажите время.');
      if (S.type !== 'adm' && !clean(S.text)) return bad('Напишите, что именно произошло.');
      drawHints();
      var live = {}; (S.hints || []).forEach(function (h) { if (h.st !== 'ok') live[h.rule] = 1; });
      var just = Object.keys(S.justs).filter(function (r) { return live[r]; }).map(function (r) { return S.justs[r]; });
      var o = { date: S.date, hm: S.hm, type: S.type, text: S.text, just: just, jr: S.jr }, k = getKid(S.kid), nm = k ? kidName(k) : '';
      if (S.edit) {
        var okE = editEvent(S.edit.kid, S.edit.it.id, o);
        closeSheet(); refresh(); toast('Сохранено.' + (okE ? '' : ' Прежнюю фразу в дневнике уберите вручную — вы её меняли.'));
        if (S.edit.back) openLog(); return;
      }
      var it = addEvent(S.kid, o); if (!it) return bad('Не удалось сохранить: ребёнок не найден.');
      lsSet('kid', S.kid); lsSet('type', S.type); refresh();
      if (it.unsaved) { toast('⚠ ' + esc(nm) + ': НЕ сохранено на телефоне — память заполнена.'); return; }
      if (more) { S.text = ''; S.hm = nowHM(); S.date = today(); renderAdd(); toast('✓ ' + esc(nm) + ': записано в ' + it.hm); return; }
      var kidId = S.kid;
      closeSheet();
      toast('✓ ' + esc(nm) + ': записано в ' + it.hm + ' → дневник ' + esc(it.slot), 'Отменить', function () { delEvent(kidId, it.id); refresh(); });
    }
  }

  /* ================= ЛЕНТА СМЕНЫ ================= */
  var L = { shift: null, by: 'time' };
  function allEvents(shift) {
    var out = [];
    (N().kids() || []).forEach(function (k) {
      (k.log || []).forEach(function (it) { if (dayFor(it.date, it.hm) === shift) out.push({ k: k, it: it }); });
    });
    out.sort(function (a, b) { return (a.it.date + ' ' + a.it.hm + ' ' + (a.it.ts || 0)).localeCompare(b.it.date + ' ' + b.it.hm + ' ' + (b.it.ts || 0)); });
    return out;
  }
  function shiftLabel(shift) { var nx = new Date(new Date(shift + 'T12:00').getTime() + 864e5); return '08:30 ' + ddmm(shift) + ' → 08:30 ' + ddmm(N().ae(nx.getTime())); }
  function arrivals(evs) { return evs.filter(function (x) { return x.it.type === 'adm'; }); }
  function logText(shift) {
    var evs = allEvents(shift), out = ['Смена ' + shiftLabel(shift)], ar = arrivals(evs);
    if (ar.length) out.push('Порядок поступления: ' + ar.map(function (x, i) { return (i + 1) + ') ' + x.it.hm + ' ' + kidName(x.k); }).join('; '));
    var line = function (x) { var s = sent(x.it, false); return s.replace(/^В (\d\d:\d\d) /, '$1 ').replace(/\.$/, ''); };
    if (L.by === 'kid') {
      var seen = {}; evs.forEach(function (x) { (seen[x.k.id] = seen[x.k.id] || { k: x.k, l: [] }).l.push(line(x)); });
      Object.keys(seen).forEach(function (id) { out.push('', kidName(seen[id].k)); seen[id].l.forEach(function (l) { out.push(l); }); });
    } else { out.push(''); evs.forEach(function (x) { out.push(kidName(x.k) + ' — ' + line(x)); }); }
    return out.join('\n');
  }
  function openLog(shift) {
    var tdy = today(), cur = dayFor(tdy, nowHM());
    L.shift = shift || L.shift || cur;
    var evs = allEvents(L.shift), ar = arrivals(evs);
    var row = function (x) {
      return '<li class="sl-row" data-k="' + esc(x.k.id) + '" data-id="' + esc(x.it.id) + '"><div class="sl-r1"><b>' + esc(x.it.hm) + '</b>' +
        (L.by === 'kid' ? '' : '<span class="sl-kid">' + esc(kidName(x.k)) + '</span>') + '<span class="sl-type">' + esc((TL[x.it.type] || TL.note).l) + '</span>' + (function () { var HN = window.__neoHints, n = HN ? HN.unjustified(x.k, x.it).length : 0; return n ? '<span class="ph-badge" title="Отличие от протокола без обоснования">⚠ ' + n + '</span>' : ''; })() +
        '<span class="sl-btns"><button type="button" data-edit aria-label="Править">✎</button><button type="button" data-del aria-label="Удалить">🗑</button></span></div>' +
        '<div class="sl-txt">' + (showText(x.it.text) || '<i class="meta">без подробностей</i>') + '</div></li>';
    };
    var body;
    if (!evs.length) body = '<p class="meta">За эту смену событий пока нет. Нажмите «＋ Событие», когда что-то произошло: время поставится само.</p>';
    else if (L.by === 'kid') {
      var g = {}, ord = []; evs.forEach(function (x) { if (!g[x.k.id]) { g[x.k.id] = []; ord.push(x.k); } g[x.k.id].push(x); });
      body = ord.map(function (k) { return '<h3 class="sl-gh">' + esc(kidName(k)) + '</h3><ul class="sl-list">' + g[k.id].map(row).join('') + '</ul>'; }).join('');
    } else body = '<ul class="sl-list">' + evs.map(row).join('') + '</ul>';
    var html = '<div class="sl-h"><b>Лента смены</b><button type="button" class="sl-x" data-close aria-label="Закрыть">✕</button></div>' +
      '<div class="chips sl-shifts">' + [[cur, 'Эта смена'], [N().prev(cur), 'Предыдущая']].map(function (d) { return '<button type="button" data-shift="' + d[0] + '"' + (L.shift === d[0] ? ' aria-pressed="true"' : '') + '>' + d[1] + '</button>'; }).join('') + '</div>' +
      '<p class="meta">' + shiftLabel(L.shift) + ' · событий: ' + evs.length + '</p>' +
      (ar.length ? '<div class="card sl-arr"><b>Порядок поступления</b><ol>' + ar.map(function (x) { return '<li>' + esc(x.it.hm) + ' — ' + esc(kidName(x.k)) + (x.it.text ? ' <span class="meta">(' + esc(x.it.text) + ')</span>' : '') + '</li>'; }).join('') + '</ol></div>' : '') +
      '<div class="chips sl-by"><button type="button" data-by="time"' + (L.by === 'time' ? ' aria-pressed="true"' : '') + '>По времени</button><button type="button" data-by="kid"' + (L.by === 'kid' ? ' aria-pressed="true"' : '') + '>По детям</button></div>' +
      body + '<div class="actions sl-act"><button type="button" class="btn pro-btn" id="slNew">＋ Событие</button><button type="button" class="btn ghost" id="slDict">🎙 Диктовка</button><button type="button" class="btn ghost" id="slCopy"' + (evs.length ? '' : ' disabled') + '>Скопировать</button></div>';
    var sh = openSheet(html);
    sh.querySelector('.vbox').addEventListener('click', async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.dataset.shift) { L.shift = b.dataset.shift; openLog(); return; }
      if (b.dataset.by) { L.by = b.dataset.by; openLog(); return; }
      if (b.id === 'slNew') { openAdd(); return; }
      if (b.id === 'slDict') { openDictate(); return; }
      if (b.id === 'slCopy') {
        var txt = logText(L.shift);
        try { await navigator.clipboard.writeText(txt); toast('Лента скопирована.'); } catch (er) { toast('Не удалось скопировать. Выделите текст вручную.'); }
        return;
      }
      var li = b.closest('.sl-row'); if (!li) return;
      var kid = li.dataset.k, id = li.dataset.id;
      if (b.hasAttribute('data-edit')) { var k = getKid(kid), it = k && (k.log || []).find(function (x) { return x.id === id; }); if (it) openAdd({ kid: kid, it: JSON.parse(JSON.stringify(it)), back: true }); return; }
      if (b.hasAttribute('data-del')) {
        var r = delEvent(kid, id); if (!r) return; refresh(); openLog();
        toast('Событие удалено' + (r.ok ? ' и убрано из дневника.' : '. Из дневника уберите вручную: вы правили эту фразу.'), 'Вернуть', function () {
          var k2 = getKid(kid); if (!k2) return; var it2 = r.it; delete it2.dk; delete it2.s; inject(k2, it2); (k2.log = k2.log || []).push(it2); N().save(k2); refresh(); openLog();
        });
      }
    });
  }


  /* ================= ДИКТОВКА: несколько событий и несколько детей за один раз ================= */
  // Ребёнок определяется по началу фамилии (метки) или по «бокс 3 / третий бокс». Падежи не мешают: «Айтжановой» → «Айтжанова».
  var NUMW = { 'один': 1, 'одна': 1, 'первый': 1, 'первая': 1, 'два': 2, 'две': 2, 'второй': 2, 'вторая': 2, 'три': 3, 'третий': 3, 'третья': 3, 'четыре': 4, 'четвертый': 4, 'четвертая': 4, 'пять': 5, 'пятый': 5, 'пятая': 5, 'шесть': 6, 'шестой': 6, 'шестая': 6, 'семь': 7, 'седьмой': 7, 'седьмая': 7, 'восемь': 8, 'восьмой': 8, 'восьмая': 8, 'девять': 9, 'девятый': 9, 'девятая': 9, 'десять': 10, 'десятый': 10, 'десятая': 10, 'одиннадцать': 11, 'двенадцать': 12 };
  var SKIP_KEY = /^(бокс|кувез|кювез|кроватка|место|койка|палата|ребенок|мальчик|девочка|близнец|двойня)$/;
  var norm = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); };
  function kidKeys(k) {
    var lab = norm(k.label), keys = [], num = '';
    lab.replace(/\([^)]*\)/g, ' ').split(/[^а-яa-z0-9]+/).forEach(function (w) {
      if (/^[а-яa-z]{4,}$/.test(w) && !SKIP_KEY.test(w)) keys.push(w.slice(0, Math.max(4, w.length - 2)));
    });
    var m = /(?:бокс|кувез|кювез|кроватка|место|койка)\s*№?\s*(\d{1,2})/.exec(lab); if (m) num = String(+m[1]);
    return { keys: keys, num: num };
  }
  function findMention(low, kids) {
    var info = kids.map(function (k) { return { k: k, ky: kidKeys(k) }; }), best = null, re = /[а-я]{4,}/g, m;
    while ((m = re.exec(low))) {
      for (var i = 0; i < info.length; i++) {
        if (info[i].ky.keys.some(function (st) { return m[0].indexOf(st) === 0; })) { best = { kid: info[i].k, start: m.index, end: m.index + m[0].length }; break; }
      }
      if (best) break;
    }
    var val = null, st = 0, en = 0, nm = /(бокс|кувез|кювез|кроватк[а-я]*|место|койк[а-я]*)\s*(?:№|номер)?\s*(\d{1,2}|[а-я]+)/.exec(low);
    if (nm) { val = /^\d+$/.test(nm[2]) ? String(+nm[2]) : (NUMW[nm[2]] ? String(NUMW[nm[2]]) : null); st = nm.index; en = nm.index + nm[0].length; }
    if (!val) { var om = /([а-я]+)\s+(бокс|кувез|кювез)/.exec(low); if (om && NUMW[om[1]]) { val = String(NUMW[om[1]]); st = om.index; en = om.index + om[0].length; } }
    if (val) { var kk = info.filter(function (x) { return x.ky.num === val; })[0]; if (kk && (!best || st < best.start)) best = { kid: kk.k, start: st, end: en }; }
    return best;
  }
  var TIME_RE = /(?:^|[\s(])(?:в\s+)?(\d{1,2}):(\d{2})(?!\d)/i;
  var VERB_RE = /^(?:назначил[аи]?|назначен[оаы]?|начал[аи]?|начат[оаы]?|подключил[аи]?|отменил[аи]?|отменен[оаы]?|поступил[аи]?|выполнил[аи]?|пров[её]л[аи]?|сделал[аи]?|вв[её]л[аи]?)(?![а-я])[\s,:—–-]*/i;
  var NW = '(?:^|[^а-я])', NE = '(?![а-я])';
  // порядок важен: «назначил рентген» — это назначение, «снизил PIP» — изменение, «ЭхоКГ: снижение СВ» — исследование
  var RULES = [
    ['adm', new RegExp('поступил|поступление|госпитализ')],
    ['rxoff', new RegExp('отмен|' + NW + 'снят[аоы]?' + NE + '|прекращ|остановил')],
    ['rx', new RegExp('назнач')],
    ['proc', new RegExp('сурфактант|куросурф|интубир|интубац|экстубир|экстубац|катетериз|дренаж|пункци|трансфуз|переливан|' + NW + 'зпк' + NE + '|санаци')],
    ['dx', new RegExp('эхокг|' + NW + 'нсг' + NE + '|рентген|' + NW + 'узи' + NE + '|' + NW + 'кт' + NE + '|' + NW + 'мрт' + NE + '|' + NW + 'экг' + NE + '|снимок')],
    ['lab', new RegExp(NW + 'кос' + NE + '|анализ|' + NW + 'оак' + NE + '|' + NW + 'срб' + NE + '|лактат|глюкоз|биохим|посев|электролит|билирубин')],
    ['chg', new RegExp('увелич|уменьш|снизил|снижен|повысил|повышен|изменил|изменен|скорректир|титров|перевел на|перевод на')],
    ['cons', new RegExp('консультац|консилиум|кардиохирург|невролог|хирург|осмотр')],
    ['rx', new RegExp('начат|начал|подключ|ввел|введен|инфуз|в/в|мкг|' + NW + 'мг' + NE + '|мл/ч')]
  ];
  var toMin = function (hm) { return +hm.slice(0, 2) * 60 + +hm.slice(3); };
  function parseDictation(text, kids, defId) {
    var rows = [], cur = defId || '', lastHM = '', nowT = nowHM(), tdy = today(), yst = N().prev(tdy);
    String(text || '').replace(/([.!?;])\s+/g, '$1\u0001').split(/\u0001|\n+/).forEach(function (c0) {
      var c = c0.trim(); if (!c) return;
      var mm = findMention(norm(c), kids);
      if (mm) {
        cur = mm.kid.id;
        c = (c.slice(0, mm.start).replace(/(?:^|\s)(?:у|по|для|на|ребенку|ребенка|ребёнку|ребёнка)\s*$/i, ' ') + ' ' + c.slice(mm.end).replace(/^[\s:,—–-]+/, '')).trim();
      }
      var tm = TIME_RE.exec(c), hm = '';
      if (tm && +tm[1] <= 23 && +tm[2] <= 59) {
        hm = pad(+tm[1]) + ':' + tm[2]; lastHM = hm;
        c = (c.slice(0, tm.index) + ' ' + c.slice(tm.index + tm[0].length)).trim();
      }
      c = c.replace(/^[\s,:—–-]+|[\s,.;]+$/g, '').replace(/^(?:и|а|потом|затем|также)\s+/i, '');
      var lc = norm(c), type = 'note';
      for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(lc)) { type = RULES[i][0]; break; }
      c = c.replace(VERB_RE, '').replace(/^[\s,:—–-]+/, '').trim();
      if (!c && type !== 'adm') return;
      var use = hm || lastHM || nowT;
      rows.push({ kid: cur, hm: use, date: toMin(use) > toMin(nowT) + 30 ? yst : tdy, type: type, text: c, on: true, guess: !hm });
    });
    return rows;
  }
  var D = { text: '', def: '', rows: null };
  function openDictate(keep) {
    if (!keep) D = { text: D.text || '', def: lsGet('kid') || '', rows: null };
    D.rows ? renderPreview() : renderDictInput();
  }
  function renderDictInput() {
    var kids = kidsList();
    var html = '<div class="sl-h"><b>Диктовка</b><span><button type="button" class="sl-lnk" data-one>＋ Одно событие</button><button type="button" class="sl-x" data-close aria-label="Закрыть">✕</button></span></div>' +
      '<p class="meta">Нажмите микрофон на клавиатуре и говорите подряд. Называйте ребёнка (фамилию или номер бокса), время и что произошло. Пример: «Сидорова: в 13:50 поступил, апноэ. В 14:10 куросурф 2 флакона. Назначил адреналин 0,1 мкг/кг/мин. Петрова: в 15:00 ЭхоКГ, снижение сердечного выброса».</p>' +
      '<p class="meta sl-l">Если ребёнка не назвали, это про</p><div class="chips sl-kids">' + kids.map(function (k) { return kidChip(k, k.id === D.def); }).join('') + '</div>' +
      '<label class="f sl-f"><span>Что продиктовали</span><textarea class="ctext" id="dtText" rows="8" placeholder="Говорите или печатайте…">' + esc(D.text) + '</textarea></label>' +
      '<p class="pill warn" id="dtErr" hidden></p>' +
      '<div class="actions sl-act"><button type="button" class="btn pro-btn" id="dtParse">Разобрать</button><button type="button" class="btn ghost" id="dtLog">Лента смены</button></div>';
    var sh = openSheet(html), ta = sh.querySelector('#dtText');
    ta.addEventListener('input', function () { D.text = ta.value; });
    sh.querySelector('.vbox').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.hasAttribute('data-one')) { openAdd(); return; }
      if (b.dataset.kid) { D.def = D.def === b.dataset.kid ? '' : b.dataset.kid; D.text = ta.value; renderDictInput(); return; }
      if (b.id === 'dtLog') { openLog(); return; }
      if (b.id === 'dtParse') {
        D.text = ta.value; var err = sh.querySelector('#dtErr');
        D.rows = parseDictation(D.text, kidsList(), D.def);
        if (!D.rows.length) { err.textContent = 'Не нашёл событий. Назовите ребёнка и что произошло.'; err.hidden = false; D.rows = null; return; }
        renderPreview();
      }
    });
  }
  function rowHints(r) {
    var HN = window.__neoHints, k = r.kid && getKid(r.kid); if (!HN || !k) return '';
    return HN.list(HN.analyze(k, { type: r.type, text: r.text, date: r.date, hm: r.hm }), { compact: true, hideOk: true, noFoot: true });
  }
  function renderPreview() {
    var kids = kidsList(), rows = D.rows;
    var kidSel = function (id) { return '<select data-f="kid"' + (id ? '' : ' class="dt-bad"') + '><option value="">— выберите ребёнка —</option>' + kids.map(function (k) { return '<option value="' + esc(k.id) + '"' + (k.id === id ? ' selected' : '') + '>' + esc(kidName(k)) + '</option>'; }).join('') + '</select>'; };
    var typeSel = function (t) { return '<select data-f="type">' + TYPES.map(function (x) { return '<option value="' + x.k + '"' + (x.k === t ? ' selected' : '') + '>' + x.l + '</option>'; }).join('') + '</select>'; };
    var nKids = {}; rows.forEach(function (r) { if (r.kid) nKids[r.kid] = 1; });
    var html = '<div class="sl-h"><b>Проверьте разбор</b><button type="button" class="sl-x" data-close aria-label="Закрыть">✕</button></div>' +
      '<p class="meta">Событий: ' + rows.length + ', детей: ' + Object.keys(nKids).length + '. Проверьте ребёнка, время, тип и особенно дозы. Лишнее снимите галочкой.</p>' +
      rows.map(function (r, i) {
        return '<div class="dt-row card" data-i="' + i + '"><div class="dt-l1"><input type="checkbox" data-f="on"' + (r.on ? ' checked' : '') + '>' + kidSel(r.kid) + '</div>' +
          '<div class="dt-l2"><input type="time" data-f="hm" value="' + esc(r.hm) + '">' + typeSel(r.type) + '</div>' +
          '<textarea data-f="text" rows="2" class="ctext">' + esc(r.text) + '</textarea>' +
          (r.guess ? '<p class="meta dt-g">Время не называли, поставил ' + esc(r.hm) + '.</p>' : '') + '<div class="dt-h">' + rowHints(r) + '</div></div>';
      }).join('') + (rows.some(function (r) { return /ph-diff|ph-conflict/.test(rowHints(r)); }) ? '<p class="meta">Отличие от протокола можно обосновать после записи: в карточке ребёнка или в ленте смены (✎).</p>' : '') +
      '<p class="pill warn" id="dtErr" hidden></p>' +
      '<div class="actions sl-act"><button type="button" class="btn pro-btn" id="dtSave">Записать выбранное</button><button type="button" class="btn ghost" id="dtBack">← Назад</button></div>';
    var sh = openSheet(html), box = sh.querySelector('.vbox');
    var sync = function (el) {
      var row = el.closest('.dt-row'); if (!row) return; var r = rows[+row.dataset.i], f = el.dataset.f;
      if (f === 'on') r.on = el.checked; else if (f === 'kid') { r.kid = el.value; el.classList.toggle('dt-bad', !el.value); }
      else if (f === 'hm') { if (el.value) { r.hm = el.value; r.guess = false; } } else r[f] = el.value;
      if (f !== 'on') { clearTimeout(row._t); row._t = setTimeout(function () { row.querySelector('.dt-h').innerHTML = rowHints(r); }, 350); }
    };
    box.addEventListener('input', function (e) { if (e.target.dataset && e.target.dataset.f) sync(e.target); });
    box.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.f) sync(e.target); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.id === 'dtBack') { D.rows = null; renderDictInput(); return; }
      if (b.id === 'dtSave') {
        var err = sh.querySelector('#dtErr'), on = rows.filter(function (r) { return r.on; });
        if (!on.length) { err.textContent = 'Ничего не выбрано.'; err.hidden = false; return; }
        var noKid = on.filter(function (r) { return !r.kid; }).length;
        if (noKid) { err.textContent = 'У ' + noKid + ' событий не выбран ребёнок.'; err.hidden = false; return; }
        var added = [];
        on.forEach(function (r) { var it = addEvent(r.kid, { date: r.date, hm: r.hm, type: r.type, text: r.text }); if (it) added.push({ kid: r.kid, id: it.id, unsaved: it.unsaved }); });
        var last = on[on.length - 1]; if (last) lsSet('kid', last.kid);
        D = { text: '', def: D.def, rows: null }; closeSheet(); refresh();
        if (added.some(function (a) { return a.unsaved; })) { toast('⚠ Часть событий НЕ сохранена — память заполнена.'); return; }
        toast('✓ Записано событий: ' + added.length, 'Отменить', function () { added.forEach(function (a) { delEvent(a.kid, a.id); }); refresh(); });
      }
    });
  }

  /* ---------- кнопка «＋ Событие» ---------- */
  function fab() {
    var h = location.hash, pro = (h === '' || h === '#kids') ? !!document.querySelector('.pro-strip') : (/^#kid-/.test(h) || h === '#round');
    var on = pro && N().kids && !document.getElementById('vsh') && !document.getElementById('ash') && !document.getElementById('slsh') && !document.getElementById('exsh');
    var f = document.getElementById('slFab');
    if (!on) { if (f) f.remove(); return; }
    if (f) return;
    f = document.createElement('button'); f.id = 'slFab'; f.type = 'button'; f.textContent = '＋ Событие';
    f.setAttribute('aria-label', 'Записать событие смены');
    f.addEventListener('click', function () { openAdd(); });
    document.body.appendChild(f);
  }
  function logLink() {
    if (location.hash !== '#kids' && location.hash !== '') return;
    var strip = document.querySelector('.pro-strip'); if (!strip || document.getElementById('slLink')) return;
    var bar = document.createElement('div'); bar.id = 'slLink'; bar.className = 'actions rd-links';
    bar.innerHTML = '<button type="button" class="btn pro-btn" id="slDictBtn">🎙 Диктовка по детям</button><button type="button" class="btn ghost" id="slOpen">＋ Событие смены</button><button type="button" class="btn ghost" id="slOpenLog">📋 Лента смены</button>';
    bar.querySelector('#slDictBtn').onclick = function () { openDictate(); };
    var anchor = document.getElementById('rdLink') || strip;
    anchor.parentNode.insertBefore(bar, anchor.nextSibling);
    bar.querySelector('#slOpen').onclick = function () { openAdd(); };
    bar.querySelector('#slOpenLog').onclick = function () { openLog(); };
  }
  function tick() { fab(); logLink(); }
  var st = document.createElement('style');
  st.textContent = '#slFab{position:fixed;left:14px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:41;border:0;border-radius:99px;height:50px;padding:0 20px;font:600 16px var(--font);background:var(--accent);color:var(--on-accent);box-shadow:0 6px 18px rgba(0,0,0,.28)}body.vopen #slFab{display:none}' +
    '.sl-box{padding-bottom:calc(18px + env(safe-area-inset-bottom))}.sl-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:18px}.sl-x{border:0;background:none;font-size:20px;color:var(--muted);padding:6px 10px;cursor:pointer}' +
    '.sl-l{margin:10px 2px 6px}.sl-q{margin-top:8px}.sl-q button{font-size:13px}.sl-f{margin-top:10px}.sl-f textarea{width:100%;box-sizing:border-box}.sl-hint{margin:6px 2px 8px;font-size:13px}' +
    '.sl-time{display:grid;grid-template-columns:130px 1fr;gap:10px;align-items:end;margin:6px 0 8px}.sl-act{position:sticky;bottom:0;background:var(--card);padding:10px 0 2px;gap:8px;flex-wrap:wrap}.sl-act .btn{flex:1 1 30%;text-align:center}' +
    '.sl-list{list-style:none;margin:0 0 6px;padding:0}.sl-row{padding:10px 0;border-top:1px solid var(--line)}.sl-r1{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.sl-r1 b{font-family:var(--num);font-size:17px}.sl-kid{font-weight:600}.sl-type{font-size:12.5px;color:var(--accent);background:var(--accent-soft);border-radius:99px;padding:2px 9px}' +
    '.sl-btns{margin-left:auto}.sl-btns button{border:0;background:none;font-size:17px;padding:4px 8px;cursor:pointer}.sl-txt{margin-top:3px;line-height:1.45;overflow-wrap:anywhere}.sl-txt mark{background:var(--warn-bg);color:var(--warn);border-radius:4px;padding:0 3px}' +
    '.sl-lnk{border:0;background:none;color:var(--accent);font:600 14px var(--font);padding:6px 8px;cursor:pointer}.dt-row{margin:8px 0;padding:10px}.dt-l1,.dt-l2{display:flex;gap:8px;align-items:center;margin-bottom:6px}.dt-l1 select{flex:1;min-width:0}.dt-l2 input{width:120px}.dt-l2 select{flex:1;min-width:0}.dt-row textarea{width:100%;box-sizing:border-box}.dt-row select,.dt-row input[type=time]{font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-in);background:var(--card-2);color:var(--ink)}.dt-bad{border-color:var(--bad)!important;background:var(--bad-bg)!important}.dt-g{margin:4px 2px 0;font-size:12.5px}.dt-l1 input[type=checkbox]{width:22px;height:22px}.sl-h span{display:flex;align-items:center}.sl-hints{margin:4px 0 6px}.dt-h .ph{margin:6px 0 0;padding:6px 9px}.sl-gh{margin:14px 2px 2px;font-size:15px}.sl-arr{margin:8px 0}.sl-arr ol{margin:6px 0 0;padding-left:22px}.sl-by,.sl-shifts{margin:6px 0}';
  document.head.appendChild(st);
  new MutationObserver(function () { clearTimeout(tick._t); tick._t = setTimeout(tick, 80); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { setTimeout(tick, 150); });
  setTimeout(tick, 600);
  window.__neoLog = { find: function (t, kids) { return findMention(norm(t), kids || kidsList()); }, parse: parseDictation, dictate: openDictate, open: openAdd, log: openLog, add: addEvent, del: delEvent, edit: editEvent, sentence: sent, slotFor: slotFor, dayFor: dayFor, text: logText };
})();
