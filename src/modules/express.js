/* НеоДневник Pro — главный экран и экспресс-дневник.
   Диктовка → разбор по разделам → вопросы кнопками → готовый дневник в выбранный интервал.
   Карточка ОАП: значимость, «как в мире», дозы на текущую массу, обоснование в запись.
   Решение всегда за врачом: в дневник ничего не уходит без нажатия. */
(function () {
  var N = function () { return window.__neo || {}; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); };
  var pad = function (x) { return ('0' + x).slice(-2); };
  var nowHM = function () { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var today = function () { return N().ae ? N().ae(Date.now()) : new Date().toISOString().slice(0, 10); };
  var ddmm = function (d) { return d ? d.split('-').reverse().slice(0, 2).join('.') : ''; };
  var dmy = function (d) { return d ? d.split('-').reverse().join('.') : ''; };
  var num = function (s) { if (s == null || s === '') return null; var v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? null : v; };
  var fmt = function (v, d) { if (v == null) return ''; var r = Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0); return String(r).replace('.', ','); };
  var cap = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  var lsGet = function (k) { try { return localStorage.getItem('neo.ex.' + k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem('neo.ex.' + k, v); } catch (e) { } };
  var NA = 'не указано';

  function saveOK(k) { var f0 = window.__neoSaveFails || 0; N().save(k); return (window.__neoSaveFails || 0) === f0; }
  function kidsList() { return (N().kids() || []).filter(function (k) { return !k.out; }); }
  function getKid(id) { return (N().kids() || []).find(function (k) { return k.id === id; }); }
  function dol(k, date) { try { var v = N().G0(k, date); return v ? +v : null; } catch (e) { return null; } }
  function slotFor(hm) { return window.__neoLog ? window.__neoLog.slotFor(hm) : (N().F0 || [])[0]; }

  /* ================= РАЗБОР ДИКТОВКИ ================= */
  var R = {
    dol: [/(\d{1,3})\s*[-–]?\s*(?:е|ые|ие|ье|й)?\s*(?:сутки|суток|сут\.?|день жизни|дн[ея] жизни)/, /(?:день|сутки)\s+жизни\s*(\d{1,3})/],
    w: [/(?:масса|вес|массой)\s*(?:тела\s*)?(?:сегодня\s*)?(\d{3,4})(?:\s*г(?:р|рамм)?)?/],
    fio2: [/(?:fio2|fio₂|фио2|фио ?₂|фио два|фи о два|кислород[а-я]*)\s*[-–:]?\s*(\d{2,3})/],
    spo2: [/(?:spo2|spo₂|сатурац[а-я]*|сат\.?|сао2)\s*[-–:]?\s*(\d{2,3})/],
    hr: [/(?:чсс|пульс)\s*[-–:]?\s*(\d{2,3})/],
    rr: [/(?:чд|частота дыхани[а-я]*)\s*[-–:]?\s*(\d{2,3})/],
    t: [/(?:температур[а-я]*|(?:^|[^а-я])т)\s*[-–:]?\s*(3\d[.,]\d)/],
    bp: [/(?:(?:^|[^а-я])ад|артериальн[а-я]* давлени[а-я]*)\s*[-–:]?\s*(\d{2,3}\s*\/\s*\d{2,3}(?:\s*\/\s*\d{2,3})?)/],
    peep: [/(?:peep|пдкв|пэп)\s*[-–:]?\s*(\d{1,2}(?:[.,]\d)?)/],
    pip: [/(?:\bpip|пик[а-я]* давлени[а-я]*)\s*[-–:]?\s*(\d{1,2})/],
    map: [/(?:\bmap|(?:^|[^а-я])мап|средн[а-я]* давлени[а-я]*)\s*[-–:]?\s*(\d{1,2}(?:[.,]\d)?)/],
    pda: [/(?:оап|открыт[а-я]* артериальн[а-я]* проток[а-я]*|артериальн[а-я]* проток[а-я]*|(?:^|[^а-я])пда(?![а-я])|\bpda\b)/],
    pdaD: [/(?:оап|проток[а-я]*|пда|\bpda\b)[^.;]{0,40}?(\d(?:[.,]\d{1,2})?)\s*мм/],
    lpao: [/(?:лп\s*\/\s*ао|лп\s*к\s*ао|лп на ао|la\s*\/\s*ao)\s*[-–:]?\s*(\d(?:[.,]\d{1,2})?)/]
  };
  var MODES = [
    [/вч\s*ивл|вчо|вчосц|hfov|высокочастотн[а-я]*/, 'ВЧ ИВЛ', 'inv'],
    [/ивл|a\/c|\bsimv\b|\bippv\b|\bpsv\b|интубирован[а-я]*|на аппарат[а-я]*/, 'ИВЛ', 'inv'],
    [/nippv|ниппв|нипв|неинвазивн[а-я]* ивл|bipap|бипап|дуопап|duopap/, 'неинвазивная ИВЛ (NIPPV)', 'niv'],
    [/cpap|сипап|сипэп|сепап|сипап[а-я]*/, 'CPAP', 'niv'],
    [/hfnc|высокопоточн[а-я]*|канюл[а-я]*/, 'высокопоточные канюли', 'o2'],
    [/самостоятельн[а-я]* дыш[а-я]*|самостоятельн[а-я]* дыхани[а-я]*|без респираторн[а-я]* поддержк[а-я]*|на воздухе|дышит сам/, 'самостоятельное дыхание', 'none'],
    [/кислородн[а-я]* палатк[а-я]*|кислород через маску|потоков[а-я]* кислород/, 'дотация кислорода', 'o2']
  ];
  var ORDN = { 'перв': 1, 'втор': 2, 'трет': 3, 'четверт': 4, 'пят': 5, 'шест': 6, 'седьм': 7, 'восьм': 8, 'девят': 9, 'десят': 10, 'одиннадцат': 11, 'двенадцат': 12, 'тринадцат': 13, 'четырнадцат': 14, 'пятнадцат': 15, 'шестнадцат': 16, 'семнадцат': 17, 'восемнадцат': 18, 'девятнадцат': 19, 'двадцат': 20 };
  var ORD = /(одиннадцат|двенадцат|тринадцат|четырнадцат|пятнадцат|шестнадцат|семнадцат|восемнадцат|девятнадцат|двадцат|перв|втор|трет|четверт|пят|шест|седьм|восьм|девят|десят)[а-я]*\s+(?:сутки|сут|день жизни|дн[яе] жизни)/;
  function grab(low, list) { for (var i = 0; i < list.length; i++) { var m = list[i].exec(low); if (m) return m[1]; } return null; }
  function phrase(low, re) { var m = re.exec(low); return m ? m[1].replace(/\s+/g, ' ').trim() : null; }

  function parse(text, kid) {
    var low = norm(text), o = { raw: text };
    o.dol = num(grab(low, R.dol)); if (o.dol == null) { var om = ORD.exec(low); if (om) o.dol = ORDN[om[1]]; } o.w = num(grab(low, R.w));
    o.fio2 = num(grab(low, R.fio2)); o.spo2 = num(grab(low, R.spo2)); o.hr = num(grab(low, R.hr)); o.rr = num(grab(low, R.rr));
    o.t = grab(low, R.t); o.bp = (grab(low, R.bp) || '').replace(/\s+/g, '') || null;
    o.peep = grab(low, R.peep); o.pip = grab(low, R.pip); o.map = grab(low, R.map);
    if (o.fio2 && o.fio2 < 21) o.fio2 = null;
    for (var i = 0; i < MODES.length; i++) if (MODES[i][0].test(low)) { o.mode = MODES[i][1]; o.modeK = MODES[i][2]; break; }
    if (o.fio2 === 21 && !o.mode) { o.mode = 'самостоятельное дыхание'; o.modeK = 'none'; }
    var st = /состояни[а-я]*\s+(?:ребенка\s+)?(крайне тяжел[а-я]*|тяжел[а-я]*|средн[а-я]*(?: степени)?(?: тяжести)?|удовлетворительн[а-я]*|стабильн[а-я]*)/.exec(low);
    if (st) o.state = /крайне/.test(st[1]) ? 'крайне тяжёлое' : /средн/.test(st[1]) ? 'средней тяжести' : /тяж/.test(st[1]) ? 'тяжёлое' : /удовл/.test(st[1]) ? 'удовлетворительное' : 'стабильное';
    o.abd = phrase(low, /живот[а-я]*\s+((?:не\s+)?(?:мягк|вздут|напряж|безболезн|болезн|доступ|увелич|умерен|плотн|запавш|ладьевид|выбуха)[а-я]*(?:(?:\s*,\s*|\s+и\s+|\s+)(?:не\s+)?(?:мягк|вздут|напряж|безболезн|болезн|доступ|увелич|умерен|плотн|пальпац)[а-я]*)*)/);
    var fm = /(?:кормлени[а-я]*|энтеральн[а-я]*|питани[а-я]*|грудн[а-я]* молок[а-я]*|смес[а-я]*|сцеж[а-я]*)[^.;]{0,40}?(\d+(?:[.,]\d)?)\s*мл/.exec(low);
    if (fm) o.feed = fm[1].replace('.', ',');
    var ff = /(?:каждые|через)\s*(\d)\s*(?:ч|час)/.exec(low); if (ff) o.feedQ = ff[1];
    var fi = /(?:нараст[а-я]*|наращива[а-я]*|увелич[а-я]*|прибавл[а-я]*|добавл[а-я]*)[^.;]{0,30}?(?:по|на)?\s*\+?\s*(\d+(?:[.,]\d)?)\s*мл/.exec(low) || /(?:^|[\s(,])(?:\+|плюс)\s*(\d+(?:[.,]\d)?)\s*мл/.exec(low);
    if (fi) o.feedInc = fi[1].replace('.', ',');
    var fx = /(?:кормлени|нараст|наращива|увелич)[^.;]{0,60}?до\s*(\d+(?:[.,]\d)?)\s*мл/.exec(low); if (fx) o.feedMax = fx[1].replace('.', ',');
    if (/(?:через|по)\s+(?:ж\/?\s?зонд|желудочн[а-я]* зонд|зонд)/.test(low)) o.feedRt = 'зонд'; else if (/сос[её]т|из бутылочк|из соски|прикладыва|грудь/.test(low)) o.feedRt = 'сам';
    if (/(?:^|[^а-я])сгм(?![а-я])|сцеж[а-я]* грудн/.test(low)) o.feedTp = 'СГМ'; else if (/донорск[а-я]* молок/.test(low)) o.feedTp = 'донорское молоко'; else if (/смес[а-я]*/.test(low)) o.feedTp = 'смесь'; else if (/грудн[а-я]* молок/.test(low)) o.feedTp = 'грудное молоко';
    var iv = /(?:инфузи[а-я]*|в\/в|внутривенн[а-я]*|парентеральн[а-я]*)[^.;]{0,30}?(\d{2,4})\s*мл/.exec(low); if (iv) o.iv = iv[1];
    var nv = /неврологическ[а-я]*\s+статус[а-я]*\s*[:\-–]?\s*([^.;]+)/.exec(low); if (nv) o.neuro = nv[1].trim();
    var fw = fm ? low.slice(fm.index, fm.index + fm[0].length + 70) : (/(?:кормлени|энтеральн|усваива|переносит)[^]{0,70}/.exec(low) || [''])[0];
    if (/не переносит|не усваива|застой|сбрасыва|по зонду сброс|рвот[а-я]*|срыгив[а-я]*|желудочн[а-я]* остат/.test(fw)) o.tol = 'no'; else if (/переносит|усваива|без остатк/.test(fw)) o.tol = 'yes';
    if (/(?:кормлени[а-я]*|энтеральн[а-я]*)\s+не\s+(?:проводит|получа)|голод|энтерально не|нпо|ничего через рот/.test(low)) o.feed = '0';
    var dm = /диурез[а-я]*\s*[-–:]?\s*(\d+(?:[.,]\d)?)\s*(?:мл\s*\/\s*кг\s*\/\s*ч|мл\/кг\/час|мл\/кг)/.exec(low);
    if (dm) o.diur = dm[1].replace('.', ',') + ' мл/кг/ч';
    else { var dw = /диурез[а-я]*\s+(адекватн[а-я]*|достаточн[а-я]*|сохран[а-я]*|снижен[а-я]*|олигури[а-я]*|норм[а-я]*|не было|отсутств[а-я]*)/.exec(low); if (dw) o.diur = /снижен|олиг/.test(dw[1]) ? 'снижен' : /не было|отсутств/.test(dw[1]) ? 'не было' : 'адекватный'; }
    if (/стул[а-я]*\s+(?:не было|отсутств[а-я]*|нет)|стула не было|без стула/.test(low)) o.stool = 'не было';
    else { var sm = /стул[а-я]*\s+(был[а-я]*|меконий[а-я]*|переходн[а-я]*|желт[а-я]*|кашиц[а-я]*|жидк[а-я]*|с примес[а-я]*[а-я ]*|после клизм[а-я]*)/.exec(low); if (sm) o.stool = /^был/.test(sm[1]) ? 'был' : sm[1]; }
    // остальное, что сказано, — отдельными фразами, чтобы ничего не потерять
    o.kid = kid || null;
    return o;
  }
  // фразы-события (назначения, процедуры) — для проверки по протоколам и для текста
  var EVW = /назнач|начат|начал|ввел|введен|вводим|отмен|сурфактант|куросурф|порактант|ампицил|гентамиц|амоксиц|меропен|ванкомиц|пеницил|цефотакс|метронидаз|иммуноглобул|интубир|экстубир|переведен|переливан|трансфуз|пункц|катетер|ибупрофен|парацетамол|индометац|допамин|добутамин|адреналин|норадреналин|милринон|фуросемид|кофеин/;
  function eventPhrases(text) {
    return String(text || '').replace(/([.!?;])\s+/g, '$1\u0001').split(/\u0001|\n+/).map(function (x) { return x.trim().replace(/[.;]+$/, ''); }).filter(function (x) { return x && EVW.test(norm(x)) && !/(оап|проток)/.test(norm(x)); });
  }

  /* ================= КАРТОЧКИ ЗАБОЛЕВАНИЙ (conds.js) ================= */
  var C = function () { return window.__neoConds; };
  // Единый вход расчёта доз: только строгие конечные положительные числа; масса — ТЕКУЩАЯ, названная врачом (масса при рождении для доз не подставляется);
  // возраст/срок не подставляются нулями — null означает «неизвестно», и режимы, зависящие от них, не выбираются.
  function numS(x) { if (x == null) return null; if (typeof x === 'number') return isFinite(x) && x > 0 ? x : null; var s = String(x).trim(); if (!/^\d+(?:[.,]\d+)?$/.test(s)) return null; var v = parseFloat(s.replace(',', '.')); return isFinite(v) && v > 0 ? v : null; }
  function base(E) {
    var k = E.kid && E.kid !== '-' ? getKid(E.kid) : null, dl = E.f.dol != null ? numS(E.f.dol) : (k ? dol(k, E.date) : null);
    return { k: k, ga: k ? numS(k.ga) : null, dol: dl != null && isFinite(dl) && dl >= 0 ? dl : null, w: numS(E.f.w), wBasis: numS(E.f.w) ? 'current' : null, wBirth: k ? numS(k.bw) : null, f: E.f, date: E.date };
  }
  function cctx(E, e) { var d = C().by[e.id]; return d.ctx(e.st, base(E)); }
  function ctext(E, e) {
    var d = C().by[e.id], c = cctx(E, e), t = d.text(c, e.tact) || '';
    if (e.tact) { var l = C().line(d, c, e.tact, e.why); if (l) t += (t ? ' ' : '') + l; }
    return t;
  }
  /* ================= КОРМЛЕНИЕ: наращивание и мл/кг/сут ================= */
  var ml = function (v) { return (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); };
  var hm2m = function (s) { var m = /(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : 0; };
  function feedPlan(E) {
    var f = E.f, v0 = num(f.feed); if (v0 == null || v0 === 0) return null;
    var k = E.kid && E.kid !== '-' ? getKid(E.kid) : null, w = num(f.w) || (k ? num(k.bw) : null);
    var q = num(f.feedQ) || 3, n = Math.max(1, Math.round(24 / q)), inc = num(f.feedInc) || 0, mx = num(f.feedMax);
    var F0 = N().F0 || [], s0 = hm2m((F0[0] || '08:30').split(/[–-]/)[0]), first = Math.ceil(s0 / 60) * 60, vols = [], times = [];
    for (var i = 0; i < n; i++) { var v = v0 + i * inc; if (mx != null && v > mx) v = mx; vols.push(Math.round(v * 10) / 10); times.push(first + i * q * 60); }
    var tot = vols.reduce(function (a, b) { return a + b; }, 0), iv = num(f.iv);
    var r = { v0: v0, q: q, n: n, inc: inc, mx: mx, vols: vols, times: times, tot: Math.round(tot * 10) / 10, w: w, last: vols[vols.length - 1] };
    if (w) { r.mlkg = tot / (w / 1000); if (iv) { r.ivkg = iv / (w / 1000); r.allkg = r.mlkg + r.ivkg; } }
    r.iv = iv;
    return r;
  }
  // объём на кормлениях внутри интервала («12:00–15:00»)
  function slotVols(fp, slot) {
    var p = slot.split(/[–-]/), a = hm2m(p[0]), b = hm2m(p[1]) || 1440, base = fp.times[0] - 60;
    if (a < base) a += 1440; if (b <= a) b += 1440;
    var v = []; fp.times.forEach(function (t, i) { if (t >= a && t < b) v.push(fp.vols[i]); });
    return v;
  }
  function volTxt(v) { if (!v.length) return ''; var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v); return lo === hi ? ml(lo) : ml(lo) + '–' + ml(hi); }
  function feedBox(E) {
    var fp = feedPlan(E);
    if (!fp) return '<p class="meta">Скажите объём кормления — посчитаю наращивание и мл/кг/сут.</p>';
    return '<div class="ex-fcalc"><p><b>' + fp.n + ' кормлений</b> каждые ' + fmt(fp.q) + ' ч: ' + fp.vols.map(function (v) { return fmt(v, 1); }).join(' → ') + ' мл</p>' +
      '<p>За сутки энтерально: <b>' + fmt(fp.tot, 1) + ' мл</b>' + (fp.mlkg != null ? ' = <b>' + fmt(fp.mlkg, 0) + ' мл/кг/сут</b>' : '') + '</p>' +
      (fp.ivkg != null ? '<p>В/в ' + fp.iv + ' мл = ' + fmt(fp.ivkg, 0) + ' мл/кг/сут · всего жидкости <b>' + fmt(fp.allkg, 0) + ' мл/кг/сут</b></p>' : '') +
      (fp.w ? '<p class="ex-src">Расчёт на массу ' + fp.w + ' г' + (num(E.f.w) ? '' : ' (при рождении — укажите текущую, если другая)') + '. Первое кормление — в начале утреннего интервала.</p>' : '<p class="ex-src">Укажите массу — посчитаю мл/кг/сут.</p>') + '</div>';
  }
  function fdraw() { var el = document.getElementById('exFeed'); if (el && E) el.innerHTML = feedBox(E); }
  function feedPlanLine(E, fp) {
    var f = E.f;
    return 'Энтеральное кормление' + (f.feedTp ? ' ' + f.feedTp : '') + ' по ' + ml(fp.v0) + ' мл' + (f.feedRt === 'зонд' ? ' через ж/зонд' : '') + ' каждые ' + fmt(fp.q) + ' ч' +
      (fp.inc ? ' с наращиванием по ' + ml(fp.inc) + ' мл на каждое кормление' + (fp.mx != null ? ' до ' + ml(fp.mx) + ' мл' : '') : '') +
      '; расчётный объём за сутки ' + fmt(fp.tot, 1) + ' мл' + (fp.mlkg != null ? ' (' + fmt(fp.mlkg, 0) + ' мл/кг/сут)' : '') + '.' +
      (fp.ivkg != null ? ' Инфузионная терапия ' + fp.iv + ' мл/сут (' + fmt(fp.ivkg, 0) + ' мл/кг/сут), общий объём жидкости ' + fmt(fp.allkg, 0) + ' мл/кг/сут.' : '');
  }
  var B = '___';
  var has = function (x) { return x != null && x !== ''; };
  function vitals(v, inv) { return 'ЧД – ' + (inv ? 'ИВЛ' : (has(v.rr) ? v.rr : B)) + '  ЧСС – ' + (has(v.hr) ? v.hr : B) + '  Т – ' + (has(v.t) ? String(v.t).replace('.', ',') : B) + '  АД – ' + (has(v.bp) ? v.bp : B) + ' мм рт. ст.  Sat – ' + (has(v.spo2) ? v.spo2 : B) + '%'; }
  var DYN = { stab: 'без отрицательной динамики', pos: 'с положительной динамикой', neg: 'с отрицательной динамикой' };
  function shortSlot(E, slot, last, fp) {
    var f = E.f, v = (E.vs || {})[slot] || {}, p = [];
    p.push('За время наблюдения состояние ребёнка ' + (f.state || B) + (E.dyn ? ', ' + DYN[E.dyn] : '') + '.');
    if (f.modeK === 'none') p.push('Дышит самостоятельно' + (f.fio2 && f.fio2 > 21 ? ', FiO₂ ' + f.fio2 + '%' : '') + '.');
    else if (f.mode) p.push('Продолжается респираторная поддержка: ' + f.mode + (f.fio2 ? ' по прежним параметрам' : '') + '.');
    if (f.feed === '0') p.push('Энтерально не кормится.');
    else if (fp) { var sv = slotVols(fp, slot); p.push('Получает энтеральное кормление' + (f.feedTp ? ' ' + f.feedTp : '') + (sv.length ? ' по ' + volTxt(sv) + ' мл' : ' в заданном объёме') + (f.feedRt === 'зонд' ? ' через ж/зонд' : '') + (f.tol === 'yes' ? ', усваивает' : f.tol === 'no' ? ', застой/срыгивания' : '') + '.'); }
    if (E.dyn === 'stab' || E.dyn === 'pos') p.push('Неврологический статус: прежний.');
    if (v.note && v.note.trim()) p.push(cap(v.note.trim().replace(/([^.])$/, '$1.')));
    var t = vitals(v, f.modeK === 'inv') + '\n\n' + p.join(' ');
    if (last) t += '\n\nГидробаланс (24 ч): энтерально ' + (fp ? fmt(fp.tot, 1) + ' мл' + (fp.mlkg != null ? ' (' + fmt(fp.mlkg, 0) + ' мл/кг)' : '') : B + ' мл') + '; в/в ' + (num(f.iv) ? f.iv + ' мл' : B + ' мл') + '; диурез ' + B + ' мл/кг/ч; стул ' + B + ' раз(а). Масса на утро ' + B + ' г.';
    return t;
  }
  function buildDay(E) {
    var F0 = N().F0 || [], fp = feedPlan(E), out = [];
    var t1 = build(E).replace(/^.*\n/, '').replace(/^\n/, '');
    if (fp) t1 += '\n\nПлан лечения: ' + feedPlanLine(E, fp);
    out.push({ slot: F0[0], text: t1 });
    for (var i = 1; i < F0.length; i++) out.push({ slot: F0[i], text: shortSlot(E, F0[i], i === F0.length - 1, fp) });
    return out;
  }

  function build(E) {
    var f = E.f, k = E.kid ? getKid(E.kid) : null, L = [];
    var inv = f.modeK === 'inv';
    L.push(dmy(E.date) + ' ' + E.slot);
    L.push(vitals(f, inv));
    var hd = [];
    var d = f.dol != null ? f.dol : (k ? dol(k, E.date) : null);
    if (d) hd.push(d + '-е сутки жизни'); if (k && k.ga) hd.push('ГВ ' + k.ga + ' нед');
    if (f.w) hd.push('масса ' + f.w + ' г' + (k && num(k.bw) ? ' (при рождении ' + k.bw + ' г)' : ''));
    var p = [];
    if (hd.length) p.push(cap(hd.join(', ')) + '.');
    p.push(f.state ? 'Состояние ребёнка ' + f.state + '.' : 'Состояние ребёнка: ' + NA + '.');
    var resp;
    if (!f.mode) resp = 'Респираторная поддержка: ' + NA;
    else if (f.modeK === 'none') resp = 'Дышит самостоятельно' + (f.fio2 && f.fio2 > 21 ? ', FiO₂ ' + f.fio2 + '%' : '');
    else {
      var pr = []; if (f.pip) pr.push('PIP ' + f.pip); if (f.peep) pr.push('PEEP ' + String(f.peep).replace('.', ',')); if (f.map) pr.push('MAP ' + String(f.map).replace('.', ',')); if (f.fio2) pr.push('FiO₂ ' + f.fio2 + '%');
      resp = 'Находится на ' + (f.modeK === 'inv' ? 'аппаратной ' : '') + 'респираторной поддержке: ' + f.mode + (pr.length ? ' с параметрами ' + pr.join(', ') : '');
    }
    p.push(resp + '.');
    (E.conds || []).forEach(function (e) { if (e.on) { var t = ctext(E, e); if (t) p.push(t); } });
    var fe;
    if (f.feed === '0') fe = 'Энтеральное питание не проводится';
    else if (f.feed) { var fp1 = feedPlan(E); fe = 'Получает энтеральное кормление' + (f.feedTp ? ' ' + f.feedTp : '') + ' по ' + (num(f.feed) != null ? ml(num(f.feed)) : f.feed) + ' мл' + (f.feedRt === 'зонд' ? ' через ж/зонд' : f.feedRt === 'сам' ? ', сосёт самостоятельно' : '') + (f.feedQ ? ' каждые ' + f.feedQ + ' ч' : '') + (fp1 && fp1.inc ? ' с наращиванием по ' + ml(fp1.inc) + ' мл на каждое кормление' : '') + (f.tol === 'yes' ? ', усваивает' : f.tol === 'no' ? ', не усваивает (застой/срыгивания)' : '') + (fp1 && fp1.mlkg != null ? ' (расчётно ' + fmt(fp1.mlkg, 0) + ' мл/кг/сут' + (fp1.allkg != null ? ', всего жидкости ' + fmt(fp1.allkg, 0) + ' мл/кг/сут' : '') + ')' : ''); }
    else fe = 'Энтеральное питание: ' + NA;
    p.push(fe + '.');
    p.push((f.abd ? 'Живот ' + f.abd : 'Живот: ' + NA) + '. ' + (f.diur === 'не было' ? 'Мочи не было' : f.diur ? 'Диурез ' + f.diur : 'Диурез: ' + NA) + '. ' + (f.stool === 'не было' ? 'Стула не было' : f.stool ? 'Стул ' + f.stool : 'Стул: ' + NA) + '.');
    p.push('Неврологический статус: ' + (f.neuro ? f.neuro.replace(/[.\s]+$/, '') : NA) + '.');
    if (E.events.length) p.push(E.events.map(function (x) { return cap(x.replace(/[.\s]+$/, '')) + '.'; }).join(' '));
    var jt = Object.keys(E.justs).length && window.__neoHints ? window.__neoHints.justText({ just: Object.keys(E.justs).map(function (r) { return E.justs[r]; }) }) : '';
    if (jt) p.push(jt + '.');
    if (E.extra && E.extra.trim()) p.push(E.extra.trim().replace(/([^.])$/, '$1.'));
    L.push(''); L.push(p.join(' '));
    return L.join('\n');
  }

  /* ================= ОКНО ================= */
  var E = null;
  function closeSheet() { var s = document.getElementById('exsh'); if (s) s.remove(); if (!document.getElementById('vsh') && !document.getElementById('slsh') && !document.getElementById('ash')) document.body.classList.remove('vopen'); }
  function sheet(html) {
    var s = document.getElementById('exsh');
    if (!s) { s = document.createElement('div'); s.id = 'exsh'; s.className = 'vsheet'; s.addEventListener('click', function (e) { if (e.target === s) closeSheet(); }); document.body.appendChild(s); document.body.classList.add('vopen'); }
    s.innerHTML = '<div class="vbox ex-box">' + html + '</div>';
    s.querySelector('.vbox').scrollTop = 0;
    return s;
  }
  var head = function (t, step) { return '<div class="ex-h"><b>' + t + '</b><span class="ex-step">' + step + '</span><button type="button" class="ex-x" data-close aria-label="Закрыть">✕</button></div>'; };
  var chip = function (attr, val, label, on) { return '<button type="button" ' + attr + '="' + esc(val) + '"' + (on ? ' aria-pressed="true"' : '') + '>' + label + '</button>'; };

  function open(o) {
    o = o || {};
    var tdy = today(), hm = nowHM();
    E = { date: tdy, slot: slotFor(hm), kid: o.kid || '', auto: false, text: '', f: {}, conds: [], events: [], justs: {}, extra: '', day: lsGet('day') !== '0', vs: {}, dyn: '' };
    if (!E.kid) { var last = lsGet('kid'); if (last && getKid(last) && kidsList().length > 1) E.kid = ''; else if (kidsList().length === 1) E.kid = kidsList()[0].id; }
    stepInput();
  }

  function stepInput() {
    var tdy = today(), yst = N().prev ? N().prev(tdy) : tdy, F0 = N().F0 || [], kids = kidsList();
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var html = head('⚡ Экспресс-дневник', '1 / 3') +
      '<p class="meta ex-l">Когда</p><div class="chips">' + chip('data-date', tdy, 'Сегодня · ' + ddmm(tdy), E.date === tdy) + chip('data-date', yst, 'Вчера · ' + ddmm(yst), E.date === yst) +
      '<label class="ex-dpick' + (E.date !== tdy && E.date !== yst ? ' on' : '') + '">📅 <input type="date" id="exDate" value="' + esc(E.date) + '"></label></div>' +
      '<div class="chips ex-mode">' + chip('data-day', '1', '📅 Весь день — все интервалы', E.day) + chip('data-day', '0', 'Один интервал', !E.day) + '</div>' +
      (E.day ? '' : '<div class="chips ex-slots">' + F0.map(function (s) { return chip('data-slot', s, s, s === E.slot); }).join('') + '</div>') +
      '<p class="meta ex-l">Кто' + (E.auto ? ' <span class="ex-auto">найден по диктовке</span>' : '') + '</p><div class="chips ex-kids">' + kids.map(function (k) { var d = dol(k, E.date); return chip('data-kid', k.id, esc(k.label || 'Ребёнок') + (d ? ' · ' + d + ' сут' : ''), k.id === E.kid); }).join('') + chip('data-kid', '-', 'Без карточки', E.kid === '-') + '</div>' +
      '<p class="meta ex-l">Говорите, как удобно</p>' +
      '<div class="ex-ta"><textarea id="exText" rows="7" class="ctext" placeholder="Кювез 5, пятые сутки, масса 1080, CPAP, PEEP 6, FiO₂ 25, сатурация 92, ЧСС 156. Живот мягкий, кормление по 4 мл каждые 3 часа, переносит. ЭхоКГ: ОАП 2,1 мм, сброс слева направо, ЛП/Ао 1,6.">' + esc(E.text) + '</textarea>' +
      (SR ? '<button type="button" class="ex-mic" id="exMic" aria-label="Диктовать">🎙</button>' : '') + '</div>' +
      '<p class="meta ex-tip">' + (SR ? 'Нажмите 🎙 и говорите. Можно и через микрофон на клавиатуре.' : 'Нажмите микрофон на клавиатуре и говорите.') + ' Фамилию или кювез можно назвать вслух.</p>' +
      '<p class="pill warn" id="exErr" hidden></p>' +
      '<div class="actions ex-act"><button type="button" class="btn pro-btn" id="exNext">Разобрать →</button></div>';
    var sh = sheet(html), box = sh.querySelector('.vbox'), ta = box.querySelector('#exText');
    ta.addEventListener('input', function () { E.text = ta.value; autoKid(); });
    box.querySelector('#exDate').addEventListener('change', function (e) { if (e.target.value) { E.date = e.target.value; stepInput(); } });
    var rec = null;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { if (rec) try { rec.stop(); } catch (x) { } closeSheet(); return; }
      if (b.dataset.date) { E.date = b.dataset.date; stepInput(); return; }
      if (b.dataset.day) { E.day = b.dataset.day === '1'; lsSet('day', E.day ? '1' : '0'); stepInput(); return; }
      if (b.dataset.slot) { E.slot = b.dataset.slot; box.querySelectorAll('[data-slot]').forEach(function (x) { if (x === b) x.setAttribute('aria-pressed', 'true'); else x.removeAttribute('aria-pressed'); }); return; }
      if (b.dataset.kid) { E.kid = b.dataset.kid; E.auto = false; box.querySelectorAll('[data-kid]').forEach(function (x) { if (x === b) x.setAttribute('aria-pressed', 'true'); else x.removeAttribute('aria-pressed'); }); return; }
      if (b.id === 'exMic') {
        if (rec) { try { rec.stop(); } catch (x) { } return; }
        try {
          rec = new SR(); rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = false;
          var base = ta.value;
          rec.onresult = function (ev) { var s = ''; for (var i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript + ' '; ta.value = (base ? base.replace(/\s*$/, ' ') : '') + s.trim(); E.text = ta.value; autoKid(); };
          rec.onend = function () { rec = null; b.classList.remove('on'); };
          rec.onerror = function () { rec = null; b.classList.remove('on'); };
          rec.start(); b.classList.add('on');
        } catch (x) { rec = null; }
        return;
      }
      if (b.id === 'exNext') {
        if (rec) try { rec.stop(); } catch (x) { }
        if (!E.text.trim()) { var er = box.querySelector('#exErr'); er.textContent = 'Скажите или напишите хотя бы пару параметров.'; er.hidden = false; return; }
        autoKid();
        if (!E.kid) { var er2 = box.querySelector('#exErr'); er2.textContent = 'Кто это? Выберите ребёнка или «Без карточки».'; er2.hidden = false; return; }
        runParse(); stepReview();
      }
    });
    function autoKid() {
      if (E.kid && !E.auto) return;
      var m = window.__neoLog && window.__neoLog.find ? window.__neoLog.find(E.text) : null;
      if (m && m.kid && m.kid.id !== E.kid) { E.kid = m.kid.id; E.auto = true; box.querySelectorAll('[data-kid]').forEach(function (x) { if (x.dataset.kid === E.kid) x.setAttribute('aria-pressed', 'true'); else x.removeAttribute('aria-pressed'); }); var l = box.querySelectorAll('.ex-l')[1]; if (l && !l.querySelector('.ex-auto')) l.insertAdjacentHTML('beforeend', ' <span class="ex-auto">найден по диктовке</span>'); }
    }
  }

  function runParse() {
    var k = E.kid && E.kid !== '-' ? getKid(E.kid) : null;
    var f = parse(E.text, k);
    E.f = f;
    var keep = {}; (E.conds || []).forEach(function (e) { keep[e.id] = e; });
    E.conds = C() ? C().detect(E.text).map(function (id) { return keep[id] || C().make(id, E.text); }) : [];
    (E.conds0 || []).forEach(function (e) { if (!E.conds.some(function (x) { return x.id === e.id; })) E.conds.push(e); });
    E.events = eventPhrases(E.text); E.justs = {};
  }

  /* ---------- шаг 2: как понял + вопросы ---------- */
  var FIELDS = [
    ['Состояние и витальные', [['state', 'Состояние', 'ch', ['крайне тяжёлое', 'тяжёлое', 'средней тяжести', 'удовлетворительное']], ['hr', 'ЧСС', 'n'], ['rr', 'ЧД', 'n'], ['spo2', 'SpO₂, %', 'n'], ['t', 'Т, °C', 't'], ['bp', 'АД', 't'], ['neuro', 'Неврология', 't']]],
    ['Дыхание', [['mode', 'Поддержка', 'ch', ['самостоятельное дыхание', 'CPAP', 'неинвазивная ИВЛ (NIPPV)', 'ИВЛ', 'ВЧ ИВЛ', 'высокопоточные канюли']], ['fio2', 'FiO₂, %', 'n'], ['peep', 'PEEP', 't'], ['pip', 'PIP', 't'], ['map', 'MAP', 't']]],
    ['Питание и ЖКТ', [['feed', 'Кормление, мл', 't'], ['feedQ', 'Каждые, ч', 'n'], ['feedInc', '+ мл каждое кормление', 'n'], ['feedMax', 'До, мл', 'n'], ['feedRt', 'Как', 'ch', [['зонд', 'через зонд'], ['сам', 'сосёт']]], ['iv', 'В/в, мл/сут', 'n'], ['tol', 'Усваивает', 'ch', [['yes', 'да'], ['no', 'нет, застой']]], ['abd', 'Живот', 'ch', ['мягкий', 'мягкий, не вздут', 'вздут', 'напряжён']]]],
    ['Выделение и масса', [['diur', 'Диурез', 'ch', ['адекватный', 'снижен', 'не было']], ['stool', 'Стул', 'ch', ['был', 'не было', 'меконий']], ['w', 'Масса, г', 'n'], ['dol', 'Сутки жизни', 'n']]]
  ];
  var MK = { 'самостоятельное дыхание': 'none', 'CPAP': 'niv', 'неинвазивная ИВЛ (NIPPV)': 'niv', 'ИВЛ': 'inv', 'ВЧ ИВЛ': 'inv', 'высокопоточные канюли': 'o2' };
  function fieldHTML(fd) {
    var key = fd[0], v = E.f[key], miss = v == null || v === '';
    if (key === 'dol' && miss && E.kid !== '-') { var kk = getKid(E.kid); var dd = kk ? dol(kk, E.date) : null; if (dd) { v = dd; miss = false; } }
    if (key === 'w' && miss) miss = false; // масса не обязательна
    if (['pip', 'peep', 'map'].indexOf(key) >= 0 && (E.f.modeK === 'none' || E.f.modeK === 'o2' || !E.f.modeK)) return '';
    if (key === 'rr' && E.f.modeK === 'inv') return '';
    var h = '<div class="ex-fld' + (miss ? ' miss' : '') + '"><span class="ex-fl">' + fd[1] + '</span>';
    if (fd[2] === 'ch') h += '<div class="chips ex-fc">' + fd[3].map(function (o) { var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o; return chip('data-set="' + key + '" data-v', val, esc(lab), String(v) === val); }).join('') + '</div>';
    else h += '<input class="ex-in" data-in="' + key + '" inputmode="' + (fd[2] === 'n' ? 'decimal' : 'text') + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + (miss ? NA : '') + '">';
    return h + '</div>';
  }
  function stepReview() {
    var k = E.kid && E.kid !== '-' ? getKid(E.kid) : null;
    var missN = 0; ['state', 'mode', 'abd', 'diur', 'stool', 'feed'].forEach(function (x) { if (E.f[x] == null || E.f[x] === '') missN++; });
    var hints = []; var HN = window.__neoHints;
    if (HN && k) E.events.forEach(function (t) { try { hints = hints.concat(HN.analyze(k, { type: 'rx', text: t, date: E.date, hm: nowHM() }) || []); } catch (x) { } });
    var seen = {}; hints = hints.filter(function (h) { if (seen[h.rule]) return false; seen[h.rule] = 1; return true; });
    E.hints = hints;
    var html = head('Как я понял', '2 / 3') +
      '<div class="ex-kid">' + (k ? '<b>' + esc(k.label) + '</b> · ' + (k.ga ? k.ga + ' нед · ' : '') + (k.bw ? 'при рождении ' + esc(k.bw) + ' г · ' : '') : '<b>Без карточки</b> · ') + dmy(E.date) + ' · ' + (E.day ? 'весь день' : esc(E.slot)) + '</div>' +
      (missN ? '<p class="meta ex-miss">Не прозвучало: ' + missN + '. Отметьте кнопками — или оставьте, в дневнике будет «' + NA + '».</p>' : '') +
      FIELDS.map(function (g) { return '<section class="card ex-sec"><h3>' + g[0] + '</h3>' + g[1].map(fieldHTML).join('') + (g[0] === 'Питание и ЖКТ' ? '<div id="exFeed">' + feedBox(E) + '</div>' : '') + '</section>'; }).join('') +
      (E.day ? daySec() : '') +
      (E.conds || []).map(cardHTML).join('') + addPicker() +
      (E.events.length ? '<section class="card ex-sec"><h3>События и назначения</h3><ul class="ex-ev">' + E.events.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + (hints.length && HN ? '<div id="exHints">' + HN.list(hints, { hideOk: false }) + '</div>' : '') + '</section>' : '') +
      '<section class="card ex-sec"><h3>Добавить своими словами</h3><textarea id="exExtra" rows="2" class="ctext" placeholder="Например: неврологический статус, план обследования">' + esc(E.extra) + '</textarea></section>' +
      '<div class="actions ex-act"><button type="button" class="btn pro-btn" id="exBuild">Собрать дневник →</button><button type="button" class="btn ghost" id="exBack">← Диктовка</button></div>';
    var sh = sheet(html), box = sh.querySelector('.vbox');
    if (HN && hints.length) { var hb = box.querySelector('#exHints'); if (hb) HN.bind(hb, function () { return E.hints; }, E, function () { hb.innerHTML = HN.list(E.hints, { hideOk: false }); markJust(hb); }); markJust(hb); }
    box.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.in) { var key = t.dataset.in, v = t.value.trim(); E.f[key] = v === '' ? null : (['hr', 'rr', 'spo2', 'fio2', 'w', 'dol', 'feedQ', 'feedInc', 'feedMax', 'iv'].indexOf(key) >= 0 ? num(v) : v); fdraw(); t.closest('.ex-fld').classList.toggle('miss', v === ''); redrawAll(box); }
      if (t.id === 'exExtra') E.extra = t.value;
      if (t.dataset.vs) { var vp = t.dataset.vs.split('|'); E.vs[vp[0]] = E.vs[vp[0]] || {}; E.vs[vp[0]][vp[1]] = t.value.trim(); }
      if (t.dataset.cq) { var pr = t.dataset.cq.split('|'), ce = cget(pr[0]); ce.st[pr[1]] = t.value.trim() === '' ? null : t.value.trim(); redrawCard(box, ce, t.dataset.cq); }
      if (t.dataset.cwhy) { cget(t.dataset.cwhy).why = t.value; }
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.dataset.set) {
        var key = b.dataset.set, val = b.dataset.v, cur = String(E.f[key]);
        E.f[key] = cur === val ? null : val; if (key === 'mode') E.f.modeK = E.f.mode ? MK[E.f.mode] : null;
        if (key === 'mode') { stepReview(); return; }
        b.parentNode.querySelectorAll('button').forEach(function (x) { if (x === b && E.f[key] != null) x.setAttribute('aria-pressed', 'true'); else x.removeAttribute('aria-pressed'); });
        b.closest('.ex-fld').classList.toggle('miss', E.f[key] == null);
        redrawAll(box); return;
      }
      if (b.dataset.cq) {
        var pr = b.dataset.cq.split('|'), ce = cget(pr[0]), def = C().by[ce.id], qd = qdef(def, pr[1]);
        if (qd.t === 'one') ce.st[pr[1]] = ce.st[pr[1]] === b.dataset.v ? '' : b.dataset.v;
        else if (qd.t === 'flag') ce.st[pr[1]] = !ce.st[pr[1]];
        else { ce.st[pr[1]] = ce.st[pr[1]] || {}; ce.st[pr[1]][b.dataset.v] = !ce.st[pr[1]][b.dataset.v]; }
        redrawCard(box, ce); return;
      }
      if (b.dataset.ctact) { var ce2 = cget(b.dataset.ctact); ce2.tact = ce2.tact === b.dataset.v ? '' : b.dataset.v; redrawCard(box, ce2); return; }
      if (b.dataset.coff) { var ce3 = cget(b.dataset.coff); ce3.on = !ce3.on; redrawCard(box, ce3); return; }
      if (b.dataset.cdel) { E.conds = E.conds.filter(function (x) { return x.id !== b.dataset.cdel; }); E.conds0 = (E.conds0 || []).filter(function (x) { return x.id !== b.dataset.cdel; }); var el = box.querySelector('#exC-' + b.dataset.cdel); if (el) el.remove(); return; }
      if (b.dataset.dyn) { E.dyn = E.dyn === b.dataset.dyn ? '' : b.dataset.dyn; box.querySelectorAll('[data-dyn]').forEach(function (x) { if (x.dataset.dyn === E.dyn) x.setAttribute('aria-pressed', 'true'); else x.removeAttribute('aria-pressed'); }); return; }
      if (b.id === 'exAddBtn') { var pk = box.querySelector('#exPick'); pk.hidden = !pk.hidden; return; }
      if (b.dataset.cadd) { var ne = C().make(b.dataset.cadd, E.text); E.conds.push(ne); E.conds0 = (E.conds0 || []).concat([ne]); stepReview(); var nc = document.querySelector('#exC-' + ne.id); if (nc) nc.scrollIntoView({ block: 'start' }); return; }
      if (b.id === 'exBack') { stepInput(); return; }
      if (b.id === 'exBuild') {
        var bad = (E.conds || []).filter(function (e) { if (!e.on || !e.tact) return false; var j = C().by[e.id].judge(e.tact, cctx(E, e)); return j.hard.length && !(e.why || '').trim(); })[0];
        // правила-кандидаты (не утверждены экспертом) не блокируют запись: один раз показываем поле причины, повторное нажатие — собрать без неё
        if (bad && E.whyAsked !== bad.id) { E.whyAsked = bad.id; var w = box.querySelector('[data-cwhy="' + bad.id + '"]'); if (w) { w.focus(); w.classList.add('dt-bad'); w.scrollIntoView({ block: 'center' }); } var bn = box.querySelector('#exBuild'); if (bn) bn.textContent = 'Собрать без причины'; return; }
        stepResult();
      }
    });
  }
  function markJust(hb) { if (!hb) return; hb.querySelectorAll('.ph').forEach(function (el) { if (E.justs[el.dataset.rule]) el.classList.add('ph-done'); }); }

  function daySec() {
    var F0 = N().F0 || [];
    return '<section class="card ex-sec"><h3>Остальные интервалы дня</h3>' +
      '<p class="meta ex-l">Динамика за сутки — пойдёт в краткие записи</p><div class="chips">' + [['stab', 'без отрицательной динамики'], ['pos', 'положительная'], ['neg', 'отрицательная']].map(function (x) { return chip('data-dyn', x[0], x[1], E.dyn === x[0]); }).join('') + '</div>' +
      '<p class="meta ex-l">Витальные по интервалам — что не впишете, останется «___»</p>' +
      F0.slice(1).map(function (sl) { var v = E.vs[sl] || {}; var inp = function (k, ph, w) { return '<input class="ex-in ex-vin" data-vs="' + sl + '|' + k + '" inputmode="' + (k === 'bp' || k === 'note' ? 'text' : 'decimal') + '" placeholder="' + ph + '" value="' + esc(v[k] || '') + '"' + (w ? ' style="flex:' + w + '"' : '') + '>'; };
        return '<div class="ex-vrow"><b>' + sl + '</b><div class="ex-vg">' + inp('hr', 'ЧСС') + inp('rr', 'ЧД') + inp('spo2', 'Sat') + inp('t', 'Т') + inp('bp', 'АД', 1.6) + '</div>' + inp('note', 'Что было в этом интервале (необязательно)') + '</div>'; }).join('') + '</section>';
  }

  /* ---------- карточки заболеваний ---------- */
  function cget(id) { return E.conds.filter(function (x) { return x.id === id; })[0]; }
  function qdef(def, k) { if (def.ci && def.ci.k === k) return { k: k, t: 'multi' }; return def.q.filter(function (q) { return q.k === k; })[0]; }
  function cardHTML(e) { return '<section class="card ex-sec ex-cond' + (e.on ? '' : ' off') + '" id="exC-' + e.id + '">' + cardInner(e) + '</section>'; }
  function redrawCard(box, e, focus) {
    var el = box.querySelector('#exC-' + e.id); if (!el) return;
    var pos = null; if (focus) { var f0 = el.querySelector('[data-cq="' + focus + '"]'); if (f0) pos = f0.selectionStart; }
    el.className = 'card ex-sec ex-cond' + (e.on ? '' : ' off'); el.innerHTML = cardInner(e);
    if (focus) { var f1 = el.querySelector('[data-cq="' + focus + '"]'); if (f1) { f1.focus(); try { f1.setSelectionRange(pos, pos); } catch (x) { } } }
  }
  function redrawAll(box) { (E.conds || []).forEach(function (e) { redrawCard(box, e); }); }
  function addPicker() {
    if (!C()) return '';
    var have = {}; (E.conds || []).forEach(function (e) { have[e.id] = 1; });
    var full = C().list.filter(function (d) { return !d.kzOnly && !have[d.id]; }), kz = C().list.filter(function (d) { return d.kzOnly && !have[d.id]; });
    return '<div class="ex-addc"><button type="button" class="btn ghost" id="exAddBtn">＋ Карточка заболевания</button><div id="exPick" hidden>' +
      '<p class="meta ex-l">С рекомендациями «как в мире»</p><div class="chips">' + full.map(function (d) { return chip('data-cadd', d.id, d.icon + ' ' + esc(d.name)); }).join('') + '</div>' +
      '<p class="meta ex-l">Протоколы РК</p><div class="chips">' + kz.map(function (d) { return chip('data-cadd', d.id, '📘 ' + esc(d.name)); }).join('') + '</div></div></div>';
  }
  function qHTML(e, q, c) {
    var key = e.id + '|' + q.k, v = e.st[q.k];
    if (q.t === 'num' || q.t === 'txt') return '<label class="ex-cl' + (q.half ? ' half' : '') + '">' + q.l + '<input class="ex-in" data-cq="' + key + '" inputmode="' + (q.t === 'num' ? 'decimal' : 'text') + '" value="' + esc(v == null ? '' : String(v).replace('.', ',')) + '"></label>';
    var h = '<div class="ex-cq"><p class="meta ex-l">' + (q.t === 'flag' ? '' : q.l) + '</p><div class="chips' + (q.bad ? ' ex-gate' : '') + '">';
    if (q.t === 'flag') h += chip('data-cq="' + key + '" data-v', '1', q.l, !!v);
    else h += q.o.map(function (o) { return chip('data-cq="' + key + '" data-v', o[0], esc(o[1]), q.t === 'one' ? v === o[0] : !!(v && v[o[0]])); }).join('');
    return h + '</div></div>';
  }
  function cardInner(e) {
    var d = C().by[e.id], b = base(E), c = d.ctx(e.st, b), stt = d.status(c), w = d.world(c), ds = d.doses(c), dis = d.disagree(c) || [];
    var h = '<div class="ex-ph"><h3>' + d.icon + ' ' + esc(d.name) + '</h3><span class="ex-tag ' + stt[0] + '">' + esc(stt[1]) + '</span><button type="button" class="ex-x ex-cdel" data-cdel="' + e.id + '" aria-label="Убрать карточку">✕</button></div>' +
      '<p class="meta">' + [b.ga ? b.ga + ' нед' : 'срок не указан', b.dol ? b.dol + '-е сутки' : 'сутки не указаны', b.w ? 'масса ' + b.w + ' г' : 'масса не указана'].join(' · ') + '</p>';
    var nums = d.q.filter(function (q) { return q.t === 'num' || q.t === 'txt'; }), rest = d.q.filter(function (q) { return !(q.t === 'num' || q.t === 'txt'); });
    if (nums.length) h += '<div class="ex-grid">' + nums.map(function (q) { return qHTML(e, q, c); }).join('') + '</div>';
    h += rest.map(function (q) { return qHTML(e, q, c); }).join('');
    var ev = d.eval(c) || [];
    if (ev.length) h += '<div class="ex-eval">' + ev.map(function (x, i) { return '<p' + (i === ev.length - 1 && /^Градации|^Подробная/.test(x) ? ' class="ex-src"' : '') + '>' + esc(x) + '</p>'; }).join('') + '</div>';
    h += '<h4 class="ex-wh">🌍 Как в мире</h4><ul class="ex-world">' + w.map(function (r) {
      var src = r.s.u ? '<a class="ex-src" href="' + esc(r.s.u) + '"' + (r.s.u.charAt(0) === '#' ? '' : ' target="_blank" rel="noopener"') + '>' + esc(r.s.d) + (r.s.u.charAt(0) === '#' ? ' — открыть протокол' : ' ↗') + '</a>' : '<span class="ex-src">' + esc(r.s.d) + '</span>';
      return '<li><div class="ex-wr"><span class="ex-flag">' + r.s.f + '</span><b>' + esc(r.s.c) + '</b><span class="ex-tag ' + (r.tone || '') + '">' + esc(r.v) + '</span></div>' +
        (r.q && r.q.length ? '<ul class="ex-qt">' + r.q.map(function (x) { return '<li>«' + esc(x) + '»</li>'; }).join('') + '</ul>' : '') + (r.t ? '<p>' + esc(r.t) + '</p>' : '') + src + '</li>';
    }).join('') + '</ul>' + (dis.length ? '<div class="ex-dis"><b>Где источники расходятся</b>' + dis.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' : '');
    if (d.ci && !c.gate) h += qHTML(e, { k: d.ci.k, l: d.ci.l, t: 'multi', o: d.ci.o }, c).replace('class="chips', 'class="chips ex-ci');
    if (ds !== null || !d.kzOnly) h += ds ? '<h4 class="ex-wh">💊 Дозы на массу ' + b.w + ' г</h4><ul class="ex-dose">' + ds.map(function (x) {
      return '<li class="' + (x.bad ? 'no' : '') + '"><b>' + esc(x.n) + '</b>' + (x.bad ? ' <span class="ex-tag bad">противопоказан</span>' : '') + (x.note ? ' <span class="ex-tag warn">' + esc(x.note) + '</span>' : '') + '<p>' + x.t + '</p><span class="ex-src">' + esc(x.s) + '</span></li>';
    }).join('') + '</ul><p class="ex-src">Расчёт по формуле на текущую массу. Форму выпуска, разведение и скорость введения сверьте с инструкцией.</p>' : (d.doses && !d.kzOnly ? '<p class="meta">Дозы скрыты: укажите ТЕКУЩУЮ массу (число, г). Масса при рождении' + (b.wBirth ? ' (' + b.wBirth + ' г)' : '') + ' для расчёта доз не используется.</p>' : '');
    h += '<h4 class="ex-wh">Ваше решение</h4><div class="chips ex-tact">' + d.tact.map(function (t) { return chip('data-ctact="' + e.id + '" data-v', t[0], esc(t[1]), e.tact === t[0]); }).join('') + '</div>';
    if (e.tact) {
      var j = d.judge(e.tact, c);
      if (j.sup.length) h += '<p class="ex-sup">✓ Опора: ' + esc(j.sup.join('; ')) + '</p>';
      if (j.ag.length) h += '<div class="ex-ag"><b>⚠ ' + (j.hard.length ? 'Отличие от протокола РК — укажите причину' : 'Расхождение с частью источников') + '</b>' + j.ag.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '<textarea data-cwhy="' + e.id + '" rows="2" class="ctext" placeholder="' + (j.hard.length ? 'Желательно' : 'По желанию') + ': почему так — например, решение консилиума, нарастание FiO₂, данные посева">' + esc(e.why) + '</textarea></div>';
    }
    var tx = ctext(E, e);
    if (tx) h += '<p class="meta">В дневник:</p><blockquote class="ex-q">' + esc(tx) + '</blockquote>';
    h += '<div class="actions"><button type="button" class="btn ghost" data-coff="' + e.id + '">' + (e.on ? 'Не включать в дневник' : 'Включить в дневник') + '</button></div>';
    return h;
  }

  /* ---------- шаг 3: готовый дневник ---------- */
  function stepResult() {
    var k = E.kid && E.kid !== '-' ? getKid(E.kid) : null;
    var parts = E.day ? buildDay(E) : null;
    var txt = parts ? parts.map(function (x) { return x.text; }).join('\n\n') : build(E), nNA = (txt.match(new RegExp(NA, 'g')) || []).length;
    var F0 = N().F0 || [], first = E.slot === F0[0];
    var cur = '';
    if (k && k.days && k.days[E.date]) { var e = k.days[E.date]; cur = parts ? ((e.note || Object.keys(e.slotNote || {}).some(function (x) { return (e.slotNote[x] || '').trim(); })) ? 'есть' : '') : first ? (e.note || '') : ((e.slotNote || {})[E.slot] || ''); }
    var chk = [];
    if (nNA) chk.push(['warn', '«' + NA + '» — ' + nNA + ' раз. Эксперт увидит пробел; лучше дополнить.']);
    var nB = (txt.match(/___/g) || []).length; if (nB) chk.push(['warn', 'Пустых полей «___» — ' + nB + ' (витальные, гидробаланс). Заполните в тексте или в Дамумеде.']);
    if (parts && !E.dyn) chk.push(['warn', 'Динамика за сутки не отмечена — в кратких записях её нет.']);
    (E.conds || []).forEach(function (e) {
      if (!e.on) return; var d = C().by[e.id];
      if (!e.tact) { if (!d.kzOnly) chk.push(['warn', d.name + ': тактика не выбрана — в записи будет только описание.']); return; }
      var j = d.judge(e.tact, cctx(E, e));
      chk.push(j.ag.length ? ((e.why || '').trim() ? ['ok', d.name + ': отличие от рекомендаций обосновано в записи.'] : [j.hard.length ? 'bad' : 'warn', d.name + ': расхождение (' + j.ag.join('; ') + '), причина не указана.']) : ['ok', d.name + ': обоснование со ссылкой на источники в записи.']);
    });
    var un = (E.hints || []).filter(function (h) { return (h.st === 'diff' || h.st === 'conflict') && !E.justs[h.rule]; });
    if (un.length) chk.push(['bad', 'По протоколам РК без обоснования: ' + un.map(function (h) { return h.title; }).join('; ') + '. Вернитесь на шаг 2 и нажмите «Обосновать».']);
    if (!chk.length) chk.push(['ok', 'Замечаний нет.']);
    var html = head('Дневник готов', '3 / 3') +
      '<p class="meta">' + (k ? esc(k.label) + ' · ' : '') + dmy(E.date) + (parts ? ' · весь день, ' + parts.length + ' интервалов' : ' · интервал ' + esc(E.slot)) + '</p>' +
      (parts ? parts.map(function (x, i) { return '<p class="ex-slh">' + esc(x.slot) + (i === 0 ? ' · полная запись' : '') + '</p><textarea data-out="' + esc(x.slot) + '" rows="' + (i === 0 ? 14 : 6) + '" class="ctext ex-out">' + esc(x.text) + '</textarea>'; }).join('') : '<textarea id="exOut" rows="14" class="ctext ex-out">' + esc(txt) + '</textarea>') +
      '<div class="card ex-check"><b>🛡 Проверка «Антидефекта»</b>' + chk.map(function (x) { return '<p class="ex-c ' + x[0] + '">' + esc(x[1]) + '</p>'; }).join('') + '</div>' +
      (k && cur ? '<p class="meta ex-l">' + (parts ? 'В этот день уже есть записи' : 'В этом интервале уже есть запись') + '</p><div class="chips">' + chip('data-mode', 'add', 'Добавить ниже', E.mode !== 'rep') + chip('data-mode', 'rep', 'Заменить', E.mode === 'rep') + '</div>' : '') +
      '<div class="actions ex-act">' + (k ? '<button type="button" class="btn pro-btn" id="exSave">Записать в дневник</button>' : '') + '<button type="button" class="btn ' + (k ? 'ghost' : 'pro-btn') + '" id="exCopy">Копировать</button><button type="button" class="btn ghost" id="exBack2">← Исправить</button></div>';
    var sh = sheet(html), box = sh.querySelector('.vbox');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-close')) { closeSheet(); return; }
      if (b.dataset.mode) { E.mode = b.dataset.mode; box.querySelectorAll('[data-mode]').forEach(function (x) { if (x === b) x.setAttribute('aria-pressed', 'true'); else x.removeAttribute('aria-pressed'); }); return; }
      if (b.id === 'exBack2') { stepReview(); return; }
      if (parts) {
        var outs = Array.prototype.map.call(box.querySelectorAll('[data-out]'), function (t) { return { slot: t.dataset.out, text: t.value }; });
        if (b.id === 'exCopy') { copy(outs.map(function (x) { return dmy(E.date) + ' ' + x.slot + '\n' + x.text; }).join('\n\n')); b.textContent = '✓ Скопировано'; return; }
        if (b.id === 'exSave') {
          var kd = getKid(E.kid); kd.days = kd.days || {}; var ed = kd.days[E.date] || (kd.days[E.date] = {}), F0d = N().F0 || [];
          var snap = JSON.stringify({ note: ed.note, slotNote: ed.slotNote });
          outs.forEach(function (x) {
            var body = x.text.trim(); if (!body) return;
            var isFirst = x.slot === F0d[0], prev = isFirst ? (ed.note || '') : ((ed.slotNote || {})[x.slot] || '');
            var val = prev && E.mode !== 'rep' ? prev.replace(/\s+$/, '') + '\n\n' + body : body;
            if (isFirst) ed.note = val; else { ed.slotNote = ed.slotNote || {}; ed.slotNote[x.slot] = val; }
          });
          if (!saveOK(kd)) { b.textContent = '⚠ Не сохранено — скопируйте текст'; return; } lsSet('kid', kd.id); closeSheet(); try { if (N().rerender) N().rerender(); } catch (x) { }
          toast('✓ ' + esc(kd.label) + ': дневник за ' + ddmm(E.date) + ', ' + outs.length + ' интервалов', 'Отменить', function () {
            var k4 = getKid(kd.id), o4 = JSON.parse(snap), e4 = k4.days[E.date] || (k4.days[E.date] = {});
            if (o4.note) e4.note = o4.note; else delete e4.note; if (o4.slotNote) e4.slotNote = o4.slotNote; else delete e4.slotNote;
            N().save(k4); try { N().rerender(); } catch (x) { }
          });
        }
        return;
      }
      var out = box.querySelector('#exOut').value;
      if (b.id === 'exCopy') { copy(out); b.textContent = '✓ Скопировано'; return; }
      if (b.id === 'exSave') {
        var body = out.replace(/^.*\n/, '').replace(/^\n/, ''); // строку «дата интервал» не пишем: интервал и так подписан в дневнике
        var kk = getKid(E.kid); kk.days = kk.days || {}; var ee = kk.days[E.date] || (kk.days[E.date] = {});
        var prev = first ? (ee.note || '') : ((ee.slotNote || {})[E.slot] || '');
        var val = prev && E.mode !== 'rep' ? prev.replace(/\s+$/, '') + '\n\n' + body : body;
        if (first) ee.note = val; else { ee.slotNote = ee.slotNote || {}; ee.slotNote[E.slot] = val; }
        if (!saveOK(kk)) { b.textContent = '⚠ Не сохранено — скопируйте текст'; return; } lsSet('kid', kk.id);
        closeSheet(); try { if (N().rerender) N().rerender(); } catch (x) { }
        toast('✓ ' + esc(kk.label) + ': дневник ' + ddmm(E.date) + ' ' + esc(E.slot), 'Отменить', function () {
          var k3 = getKid(kk.id), e3 = k3.days[E.date] || (k3.days[E.date] = {});
          if (first) { if (prev) e3.note = prev; else delete e3.note; } else { e3.slotNote = e3.slotNote || {}; if (prev) e3.slotNote[E.slot] = prev; else delete e3.slotNote[E.slot]; }
          N().save(k3); try { N().rerender(); } catch (x) { }
        });
      }
    });
  }
  function copy(t) {
    try { navigator.clipboard.writeText(t); return; } catch (e) { }
    var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) { } a.remove();
  }
  function toast(msg, undoLabel, undo) {
    var old = document.querySelector('.vundo.ex'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'vundo ex';
    t.innerHTML = '<span>' + msg + '</span>' + (undo ? '<button type="button">' + undoLabel + '</button>' : '');
    if (undo) t.querySelector('button').onclick = function () { undo(); t.remove(); };
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 7000);
  }

  /* ================= ГЛАВНЫЙ ЭКРАН ================= */
  function home() {
    if (location.hash !== '#kids' && location.hash !== '') return;
    var strip = document.querySelector('.pro-strip'); if (!strip || document.getElementById('exHome')) return;
    var n = kidsList().length, tdy = today(), done = 0;
    kidsList().forEach(function (k) { var e = k.days && k.days[tdy]; if (e && (e.note || (e.slotNote && Object.keys(e.slotNote).length))) done++; });
    var hb = document.createElement('div'); hb.id = 'exHome'; hb.className = 'ex-home';
    hb.innerHTML =
      '<button type="button" class="ex-tile t2" id="exTExp"><span class="ex-ti">⚡</span><b>Экспресс-дневник</b><small>любой ребёнок, любой день — сразу диктовка</small></button>' +
      '<button type="button" class="ex-tile t1" id="exTKids"><span class="ex-ti">👶</span><b>Мои дети</b><small>' + n + ' в отделении · дневник сегодня: ' + done + ' из ' + n + '</small></button>' +
      '<button type="button" class="ex-tile t3" id="exTNew"><span class="ex-ti">＋</span><b>Поступил ребёнок</b><small>роды, анамнез, первичный осмотр</small></button>';
    strip.parentNode.insertBefore(hb, strip.nextSibling);
    // остальные кнопки — в «Инструменты смены», ничего не удаляем
    var tools = document.createElement('details'); tools.id = 'exTools'; tools.className = 'card csec';
    tools.innerHTML = '<summary><b>🧰 Инструменты смены</b> <span class="meta">обход, диктовка по детям, события, лента</span></summary>';
    if (lsGet('tools') === '1') tools.open = true;
    tools.addEventListener('toggle', function () { lsSet('tools', tools.open ? '1' : '0'); });
    hb.parentNode.insertBefore(tools, hb.nextSibling);
    hb.querySelector('#exTExp').onclick = function () { open(); };
    hb.querySelector('#exTKids').onclick = function () { var l = document.querySelector('.list .kidrow'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    hb.querySelector('#exTNew').onclick = function () {
      var d = Array.prototype.filter.call(document.querySelectorAll('details.csec'), function (x) { return /Поступил ребёнок/.test((x.querySelector('summary') || {}).textContent || ''); })[0];
      if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); var i = d.querySelector('input'); if (i) setTimeout(function () { i.focus(); }, 400); }
    };
  }
  function tuck() {
    var tools = document.getElementById('exTools'); if (!tools) return;
    ['rdLink', 'slLink'].forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode !== tools) tools.appendChild(el); });
  }
  function kidBtn() {
    var m = /^#kid-(.+)$/.exec(location.hash); if (!m || document.getElementById('exKidBtn')) return;
    var h1 = document.querySelector('main h1, #app h1, h1'); if (!h1) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'exKidBtn'; b.className = 'btn pro-btn ex-kidbtn'; b.textContent = '⚡ Экспресс-дневник';
    b.onclick = function () { open({ kid: decodeURIComponent(m[1]) }); };
    h1.parentNode.insertBefore(b, h1.nextSibling);
  }
  function tick() { home(); tuck(); kidBtn(); }

  var st = document.createElement('style');
  st.textContent =
    '.ex-home{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}' +
    '.ex-tile{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:0;border-radius:18px;padding:16px 14px;cursor:pointer;font:inherit;color:var(--ink);background:var(--card);box-shadow:0 1px 0 var(--line),0 6px 18px rgba(15,35,60,.08);min-height:104px}' +
    '.ex-tile b{font-size:17px;line-height:1.2}.ex-tile small{font-size:12.5px;color:var(--muted);line-height:1.3}.ex-ti{font-size:24px;line-height:1;margin-bottom:4px}' +
    '.ex-tile.t2{grid-column:1/-1;min-height:116px;background:linear-gradient(135deg,#0e5e66,#13808a);color:#fff}.ex-tile.t2 small{color:rgba(255,255,255,.85)}.ex-tile.t2 b{font-size:20px}' +
    '.ex-tile:active{transform:scale(.98)}#exTools summary{flex-wrap:wrap}#exTools summary b{flex:1}#exTools summary .meta{display:block;width:100%;order:3;font-size:12.5px;font-weight:400;margin-top:2px}#exTools .rd-links{margin:10px 0 2px}' +
    '.ex-kidbtn{width:100%;margin:6px 0 10px}' +
    '.ex-box{padding-bottom:calc(18px + env(safe-area-inset-bottom))}.ex-h{display:flex;align-items:center;gap:8px;font-size:18px;margin-bottom:4px}.ex-h b{flex:1}.ex-step{font-size:12.5px;color:var(--muted)}.ex-x{border:0;background:none;font-size:20px;color:var(--muted);padding:6px 10px;cursor:pointer}' +
    '.ex-l{margin:12px 2px 6px}.ex-auto{color:var(--accent);font-weight:600}.ex-slots{margin-top:6px}.ex-slots button{font-size:13px}' +
    '.ex-dpick{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:99px;padding:2px 8px;font-size:13px}.ex-dpick.on{border-color:var(--accent);background:var(--accent-soft)}.ex-dpick input{border:0;background:none;font:inherit;color:var(--ink);width:118px}' +
    '.ex-ta{position:relative}.ex-ta textarea{width:100%;box-sizing:border-box;font-size:16px;line-height:1.45;padding-right:58px}.ex-mic{position:absolute;right:8px;bottom:10px;width:46px;height:46px;border-radius:50%;border:0;background:var(--accent);color:#fff;font-size:21px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.18)}.ex-mic.on{background:#c0392b;animation:exP 1.2s infinite}@keyframes exP{50%{box-shadow:0 0 0 10px rgba(192,57,43,.15)}}' +
    '.ex-tip{margin:6px 2px;font-size:12.5px}.ex-act{position:sticky;bottom:0;background:var(--card);padding:10px 0 2px;gap:8px;flex-wrap:wrap;z-index:2}.ex-act .btn{flex:1 1 40%;text-align:center}' +
    '.ex-kid{margin:2px 2px 8px;font-size:14px}.ex-miss{margin:0 2px 8px;color:var(--warn)}' +
    '.ex-sec{margin:10px 0;padding:12px}.ex-sec h3{margin:0 0 8px;font-size:15px}.ex-fld{display:grid;grid-template-columns:96px 1fr;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)}.ex-fld:first-of-type{border-top:0}' +
    '.ex-fl{font-size:13px;color:var(--muted)}.ex-fld.miss .ex-fl{color:var(--warn);font-weight:600}.ex-fc{gap:6px}.ex-fc button{font-size:13px;padding:6px 10px}' +
    '.ex-in{font:inherit;font-size:16px;padding:8px 10px;border:1px solid var(--line);border-radius:var(--r-in,10px);background:var(--card-2);color:var(--ink);width:100%;box-sizing:border-box}.ex-fld.miss .ex-in{border-color:var(--warn);background:var(--warn-bg)}' +
    '.ex-ev{margin:0 0 6px;padding-left:18px}.ex-ev li{margin:3px 0}.ph.ph-done{opacity:.75}' +
    '.ex-cond{border:1.5px solid #c9d6e2}.ex-cond.off{opacity:.55}.ex-cond .ex-cdel{margin-left:auto;font-size:16px;padding:4px 8px}.ex-ph .ex-tag{margin-left:6px}.ex-qt{margin:6px 0 2px;padding-left:16px;font-size:13px;line-height:1.45;color:var(--ink)}.ex-qt li{margin:3px 0;font-style:italic}.ex-addc{margin:10px 0}.ex-addc>.btn{width:100%}#exPick .chips button{font-size:13px}.ex-cq{margin-top:2px}.ex-ph{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.ex-ph h3{margin:0}' +
    '.ex-tag{display:inline-block;font-size:12px;font-weight:600;border-radius:99px;padding:2px 9px;background:var(--line);color:var(--ink);white-space:nowrap}.ex-tag.ok{background:#e3f4e8;color:#1e7a3c}.ex-tag.warn{background:var(--warn-bg);color:var(--warn)}.ex-tag.bad{background:var(--bad-bg,#fde8e8);color:var(--bad,#b3261e)}' +
    '.ex-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}.ex-grid label{font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:4px}' +
    '.ex-gate{margin-top:10px}.ex-gate button[aria-pressed=true]{background:var(--bad-bg,#fde8e8);color:var(--bad,#b3261e);border-color:var(--bad,#b3261e)}' +
    '.ex-eval{background:var(--card-2);border-radius:12px;padding:8px 10px;margin:10px 0}.ex-eval p{margin:3px 0;font-size:14px}' +
    '.ex-src{display:block;font-size:11.5px;color:var(--muted);margin-top:3px;text-decoration:none}a.ex-src{color:var(--accent)}' +
    '.ex-wh{margin:14px 0 6px;font-size:15px}.ex-world{list-style:none;margin:0;padding:0}.ex-world li{padding:9px 0;border-top:1px solid var(--line)}.ex-world p{margin:4px 0 0;font-size:13.5px;line-height:1.45}.ex-wr{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ex-flag{font-size:18px}' +
    '.ex-dis{margin:8px 0;padding:8px 10px;border-left:3px solid var(--warn);background:var(--warn-bg);border-radius:6px}.ex-dis p{margin:3px 0;font-size:13px}' +
    '.ex-ci button{font-size:12.5px;padding:5px 9px}.ex-ci button[aria-pressed=true]{background:var(--bad-bg,#fde8e8);color:var(--bad,#b3261e);border-color:var(--bad,#b3261e)}' +
    '.ex-dose{list-style:none;margin:0;padding:0}.ex-dose li{padding:8px 0;border-top:1px solid var(--line)}.ex-dose li.no p{text-decoration:line-through;opacity:.6}.ex-dose p{margin:3px 0 0;font-size:14px}.ex-dose b{font-family:var(--num)}' +
    '.ex-tact button{font-size:13.5px}.ex-sup{font-size:13px;color:#1e7a3c;margin:8px 0 4px}.ex-ag{margin:8px 0;padding:8px 10px;border-left:3px solid var(--warn);background:var(--warn-bg);border-radius:6px}.ex-ag p{margin:3px 0;font-size:13px}.ex-ag textarea{width:100%;box-sizing:border-box;margin-top:6px}' +
    '.ex-q{margin:4px 0 8px;padding:8px 10px;border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:6px;font-size:13.5px;line-height:1.45}' +
    '.ex-out{width:100%;box-sizing:border-box;font-size:15px;line-height:1.5}.ex-slh{margin:12px 2px 4px;font-weight:700;font-size:14px;color:var(--accent)}.ex-mode{margin-top:8px}.ex-fcalc{margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--accent-soft)}.ex-fcalc p{margin:3px 0;font-size:14px}.ex-vrow{padding:8px 0;border-top:1px solid var(--line)}.ex-vrow b{font-size:13px}.ex-vg{display:flex;gap:6px;margin:5px 0}.ex-vg .ex-in{flex:1;min-width:0;padding:7px 6px;font-size:15px;text-align:center}.ex-vrow>.ex-in{font-size:14px;padding:7px 9px}.ex-check{margin:10px 0;padding:10px 12px}.ex-c{margin:5px 0 0;font-size:13.5px;padding-left:20px;position:relative}.ex-c:before{position:absolute;left:0}.ex-c.ok:before{content:"✓";color:#1e7a3c}.ex-c.warn:before{content:"!";color:var(--warn);font-weight:700}.ex-c.bad:before{content:"⚠";color:var(--bad,#b3261e)}';
  document.head.appendChild(st);

  new MutationObserver(function () { clearTimeout(tick._t); tick._t = setTimeout(tick, 90); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { setTimeout(tick, 160); });
  setTimeout(tick, 700);
  window.__neoExpress = { open: open, parse: parse, build: build, cctx: cctx, ctext: ctext, state: function () { return E; }, events: eventPhrases };
})();
