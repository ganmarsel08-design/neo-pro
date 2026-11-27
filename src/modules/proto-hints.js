/* Подсказки по протоколам — из базы правил «Антидефекта» (пилот rules-0.3: РДС №4/2016, НЭК и сепсис №185/2023).
   Цитаты дословные, с номером страницы. Подсказка — не запрет и не заключение: отклониться можно,
   но причину нужно записать в дневник — тогда она попадает в запись события («Отличие от протокола … : причина»).
   Программа ничего не назначает и не выдумывает дозы: сравнивает только с тем, что прямо написано в цитате. */
(function () {
  var D = __RULES_DATA__;
  var N = function () { return window.__neo || {}; };
  var low = function (s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pad = function (x) { return ('0' + x).slice(-2); };
  var num = function (s) { return parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); };
  var ts = function (date, hm) { var t = new Date(date + 'T' + (/^\d\d:\d\d$/.test(hm || '') ? hm : '12:00') + ':00').getTime(); return isFinite(t) ? t : null; };
  var hhmm = function (t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var ddmm = function (t) { var d = new Date(t); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); };
  var when = function (t) { return hhmm(t) + ' ' + ddmm(t); };
  var fmt = function (x) { return String(Math.round(x * 100) / 100).replace('.', ','); };

  /* ---------- словари ---------- */
  var ABX = [
    ['amp', /ампицил/, 'ампициллин'], ['amox', /амоксицил|амоксиклав|аугмент/, 'амоксициллин'], ['pen', /пеницил/, 'бензилпенициллин'],
    ['gent', /гента/, 'гентамицин'], ['amik', /амикац/, 'амикацин'], ['netil', /нетилм/, 'нетилмицин'],
    ['ctx', /цефотакс/, 'цефотаксим'], ['ctz', /цефтазид/, 'цефтазидим'], ['ctr', /цефтриакс/, 'цефтриаксон'], ['cfp', /цефепим/, 'цефепим'],
    ['cfo', /цефоперазон|сульперазон/, 'цефоперазон'], ['cxm', /цефурокс/, 'цефуроксим'], ['mero', /меропенем|меронем/, 'меропенем'], ['imi', /имипенем/, 'имипенем'],
    ['vanco', /ванкомиц/, 'ванкомицин'], ['metro', /метронид/, 'метронидазол'], ['lzd', /линезолид/, 'линезолид'], ['col', /колистин/, 'колистин'],
    ['oxa', /оксацил/, 'оксациллин'], ['azi', /азитромиц/, 'азитромицин'], ['teic', /тейкопл/, 'тейкопланин'], ['fosf', /фосфомиц/, 'фосфомицин']
  ];
  var RE = {
    cancel: /отмен|прекращ|(^|[^а-я])снят|остановл/,
    culture: /посев|стерильн|гемокульт|бакпосев|бак\.?\s*исслед|бактериолог/,
    crp: /срб|crp|c-реакт|с-реакт|с реакт/,
    intub: /интубац|интубир/,
    surf: /сурфакт|куросурф|curosurf|порактант|сурванта|берактант|альвеофакт|бльсурф/,
    porac: /куросурф|curosurf|порактант/,
    igg: /иммуноглобул|пентаглоб|октагам|габриглоб|интраглоб|привиджен/,
    nec: /(^|[^а-я])нэк|некротиз/,
    necNeg: /исключ|нет нэк|без нэк|риск нэк|не нэк|профилакт/,
    necII: /нэк\s*(ii|2|iia|iib|2а|2б|2a|2b)(?![0-9])|(ii|2)\s*(ст\.?|стад)/,
    feedStop: /(кормлен|энтерал|питани)[а-я]*\s*(отмен|прекращ|исключ|стоп|остановл)|(отмен|прекращ|исключ)[а-я]*\s*(энтерал|кормлен)|голод|nil by mouth|nbm/,
    ngt: /зонд/,
    uvc: /пупочн[а-я]*\s*(вен|артер|катетер)|(^|[^а-я])(пвк|пак)([^а-я]|$)/,
    uvcOut: /удал[а-я]*\s*[^.]{0,30}(пупочн|пвк|пак)|(пупочн|пвк|пак)[^.]{0,30}удал/,
    pn: /парентерал|(^|[^а-я])пп([^а-я]|$)|аминовен|интралипид|смофлипид|кабивен/,
    surgeon: /хирург/,
    xray: /рентген|(^|[^а-я])рг([^а-я]|$)|снимок|обзорн/,
    menin: /менинг/,
    gas: /(^|[^а-я])кос([^а-я]|$)|pco2|рсо2|pсо2|рco2|газы крови/,
    ivl: /ивл|интубац|вчо|simv|a\/c|ippv/,
    oxy: /fio2|fio₂|кислород|spo2|spo₂|сатурац/
  };

  var STL = { diff: 'Отличается от протокола', conflict: 'В протоколе два положения', nodata: 'Недостаточно данных', remind: 'Напоминание', ok: 'Совпадает с протоколом' };
  var ORDER = { diff: 0, conflict: 1, nodata: 2, remind: 3, ok: 4 };
  var CATS = [
    ['clinical', 'По клиническим показаниям', 'по клиническим показаниям'],
    ['local', 'Местные данные / протокол отделения', 'с учётом местных данных о возбудителях и чувствительности (протокол отделения)'],
    ['unavail', 'Препарата нет в отделении', 'препарата нет в отделении'],
    ['consilium', 'Решение консилиума', 'по решению консилиума'],
    ['other', 'Другое', '']
  ];
  var CATM = {}; CATS.forEach(function (c) { CATM[c[0]] = c; });

  /* ---------- данные ребёнка ---------- */
  function ctx(k, ev) {
    var ga = num(k.ga); ga = isFinite(ga) ? ga + (num(k.gad) || 0) / 7 : null;
    var t = ts(ev.date, ev.hm), b = k.bd ? ts(k.bd, k.bt || '') : null;
    var TW = { adm: 'поступил', rxoff: 'отменено', proc: 'проведено', rx: 'назначено', dx: 'выполнено', lab: 'анализ', cons: 'консультация' };
    var log = (k.log || []).filter(function (x) { return !ev.id || x.id !== ev.id; }).map(function (x) { return { it: x, t: ts(x.date, x.hm), l: low(x.text) + ' ' + (TW[x.type] || '') }; });
    return { k: k, ga: ga, t: t, hol: t != null && b != null ? (t - b) / 36e5 : null, btKnown: !!k.bt, log: log };
  }
  function drugsIn(l) { var out = []; ABX.forEach(function (a) { var m = a[1].exec(l); if (m) out.push({ k: a[0], n: a[2], at: m.index }); }); return out.sort(function (a, b) { return a.at - b.at; }); }
  function isAbxEvent(type, l) { return type !== 'rxoff' && !RE.cancel.test(l) && drugsIn(l).length > 0; }
  function segment(l, key) {
    var ds = drugsIn(l), i = ds.findIndex(function (d) { return d.k === key; }); if (i < 0) return '';
    return l.slice(ds[i].at, i + 1 < ds.length ? ds[i + 1].at : l.length);
  }
  function dose(seg) {
    var r = {}, m;
    if ((m = /(\d+(?:[.,]\d+)?)\s*(?:мг|mg)\s*\/\s*кг/.exec(seg))) { r.v = num(m[1]); r.u = 'мг/кг'; }
    else if ((m = /(\d[\d\s]*(?:[.,]\d+)?)\s*(тыс\.?\s*)?(?:ед|ме|eд|ед\.)\s*\/\s*кг/.exec(seg))) { r.v = num(m[1]) * (m[2] ? 1000 : 1); r.u = 'Ед/кг'; }
    if ((m = /(?:кажд[а-я]*|через|q|раз в|1 раз в)\s*(\d+)\s*(?:ч|час)/.exec(seg))) r.iv = +m[1];
    else if (/(^|[^0-9])(1\s*раз|однократно)\s*(в\s*)?(сут|день)|раз в сутки|в сутки 1|кажд[а-я]* 24/.test(seg)) r.iv = 24;
    else if (/2\s*раза\s*в\s*(сут|день)/.test(seg)) r.iv = 12;
    else if (/3\s*раза\s*в\s*(сут|день)/.test(seg)) r.iv = 8;
    return r;
  }
  var dtxt = function (d) { return (d.v != null ? fmt(d.v).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ') + ' ' + d.u : 'доза не указана') + (d.iv ? ' каждые ' + d.iv + ' ч' : ', интервал не указан'); };
  function find(c, re, from, to) { return c.log.filter(function (x) { return re.test(x.l) && x.t != null && (from == null || x.t >= from) && (to == null || x.t <= to); }); }
  function firstAbx(c) {
    var xs = c.log.filter(function (x) { return x.t != null && isAbxEvent(x.it.type, x.l); }).sort(function (a, b) { return a.t - b.t; });
    return xs[0] || null;
  }
  function justified(c, rule, after) { return c.log.some(function (x) { return x.it.jr === rule && (after == null || x.t >= after - 36e5); }); }

  /* ---------- одна подсказка ---------- */
  function H(rule, st, title, line, qi, o) {
    var r = D.R[rule]; o = o || {};
    return { rule: rule, st: st, title: title, line: line || '', q: (qi || [0]).map(function (i) { return r.q[i]; }).filter(Boolean), p: r.p, norm: r.norm, short: o.short || '', choices: o.choices || null, jt: o.jt || '', add: o.add || null, skip: o.skip || '', key: o.key || rule };
  }

  /* ---------- разбор одного события ---------- */
  function analyze(k, ev) {
    var out = []; if (!k || !ev) return out;
    var l = low(ev.text), c = ctx(k, ev), type = ev.type;
    if (!l.trim() && type !== 'adm') return out;
    var abx = isAbxEvent(type, l), ds = abx ? drugsIn(l) : [];
    var necCtx = (RE.nec.test(l) && !RE.necNeg.test(l)) || c.log.some(function (x) { return RE.nec.test(x.l) && !RE.necNeg.test(x.l); });

    if (abx) {
      var fa = firstAbx(c), isStart = !fa || (c.t != null && fa.t > c.t);
      if (isStart) {
        // посев до первой дозы
        var cul = find(c, RE.culture, null, c.t).concat(RE.culture.test(l) ? [{ t: c.t }] : []);
        out.push(cul.length ? H('SEP-002', 'ok', 'Посев крови до первой дозы', 'Забор на посев отмечен' + (cul[0].t != null && cul[0].t !== c.t ? ' в ' + hhmm(cul[0].t) : ' в этой записи') + '.', [0])
          : H('SEP-002', 'nodata', 'Посев крови до первой дозы', 'В журнале нет отметки о заборе крови на посев до начала АБТ. Если взяли — запишите время отдельным событием.', [0, 1], { short: 'посев крови до начала АБТ, стр. 6', add: { type: 'dx', text: 'Забор крови на стерильность' }, skip: 'Посев крови до начала АБТ не взят' }));
        // СРБ через 18–24 ч
        if (c.t != null) out.push(H('SEP-007', 'remind', 'Контроль СРБ через 18–24 ч', 'Окно: с ' + when(c.t + 18 * 36e5) + ' до ' + when(c.t + 24 * 36e5) + ' (от этой первой дозы).', [1, 0], { add: { type: 'lab', text: 'СРБ ' }, skip: 'Контроль СРБ через 18–24 ч после начала АБТ не проведён' }));
        // эмпирическая схема при РНС
        if (c.hol != null && c.hol <= 72) {
          var near = c.log.filter(function (x) { return x.t != null && c.t != null && Math.abs(x.t - c.t) <= 2 * 36e5 && isAbxEvent(x.it.type, x.l); });
          var all = {}; ds.concat.apply(ds, near.map(function (x) { return drugsIn(x.l); })).forEach(function (d) { all[d.k] = d.n; });
          var names = Object.keys(all).map(function (x) { return all[x]; }).join(' + ');
          var ok = (all.amp || all.pen) && all.gent;
          var age = Math.max(0, Math.round(c.hol)) + ' ч жизни' + (c.btKnown ? '' : ', время рождения не указано');
          out.push(ok ? H('SEP-004', 'ok', 'Эмпирическая АБТ при подозрении на РНС', 'Назначено: ' + names + ' (' + age + ').', [0])
            : H('SEP-004', 'diff', 'Эмпирическая АБТ при подозрении на РНС', 'Назначено: ' + names + ' (' + age + '). В протоколе первый выбор — бензилпенициллин/ампициллин с гентамицином; при выборе можно опираться на местные данные о возбудителях (стр. 12).', [0, 1], { short: 'первый выбор при подозрении на ранний сепсис — бензилпенициллин/ампициллин с гентамицином, стр. 12' }));
        }
      }
      if (necCtx && !/метронид/.test(l) && !c.log.some(function (x) { return /метронид/.test(x.l); }))
        out.push(H('NEC-007', 'diff', 'НЭК: метронидазол в схеме АБТ', 'При НЭК в схеме нет метронидазола. Иной антианаэробный препарат — отличие с обоснованием.', [0, 1], { short: 'при НЭК в терапию вводится метронидазол, стр. 13' }));
      // гентамицин
      if (ds.some(function (d) { return d.k === 'gent'; })) out.push(gent(c, dose(segment(l, 'gent'))));
      // бензилпенициллин
      if (ds.some(function (d) { return d.k === 'pen'; })) out.push(pen(c, dose(segment(l, 'pen')), RE.menin.test(l)));
    }
    if (RE.surf.test(l) && type !== 'rxoff') out.push(surf(c, l));
    if (RE.intub.test(l) && !/экстуб/.test(l)) {
      var s2 = RE.surf.test(l) || find(c, RE.surf, c.t != null ? c.t - 2 * 36e5 : null, null).length;
      out.push(H('RDS-002', s2 ? 'ok' : 'remind', 'После интубации при РДС — сурфактант', s2 ? 'Сурфактант отмечен.' : 'Если интубация по поводу РДС — по протоколу показан сурфактант. При интубации по другой причине отметьте её.', [0], { add: { type: 'proc', text: 'Сурфактант эндотрахеально' }, skip: 'Сурфактант после интубации не вводился' }));
    }
    if (RE.igg.test(l) && type !== 'rxoff') out.push(H('SEP-003', 'diff', 'Иммуноглобулин при сепсисе', 'Рутинное применение не рекомендуется; индивидуальное назначение — с записанным показанием.', [0], { short: 'рутинное применение иммуноглобулина не рекомендуется, стр. 14' }));
    if (RE.nec.test(l) && !RE.necNeg.test(l) && !c.log.some(function (x) { return RE.nec.test(x.l) && !RE.necNeg.test(x.l) && x.t != null && c.t != null && x.t < c.t; }))
      out.push(H('NEC-001', 'remind', 'При подозрении на НЭК — сразу', 'Прекратить энтеральное кормление и поставить назогастральный зонд; удалить пупочные катетеры, если стоят; ПП с первого дня; при АБТ — метронидазол; консультация хирурга (в протоколе — для стационаров 2-го уровня); при НЭК II — рентген через 48 ч. Невыполненные пункты затем видны в карточке ребёнка.', [0]));
    if (RE.gas.test(l) && (RE.ivl.test(l) || c.log.some(function (x) { return RE.ivl.test(x.l) && !/экстуб/.test(x.l); })))
      out.push(H('RDS-010', 'remind', 'ИВЛ: избегать гипокапнии', 'Порог PaCO₂ протокол не задаёт — оценивает врач.', [0, 2]));
    if (RE.oxy.test(l) && c.ga != null && c.ga < 37 && (type === 'chg' || type === 'note'))
      out.push(H('RDS-005', 'remind', 'Недоношенный на кислороде: SpO₂ 90–95%', '', [0]));
    // один ключ — одна подсказка
    var seen = {}; out = out.filter(function (h) { if (seen[h.key]) return false; seen[h.key] = 1; return true; });
    return out.sort(function (a, b) { return ORDER[a.st] - ORDER[b.st]; });
  }

  function gent(c, d) {
    var row = null, lab = '';
    if (c.ga != null && c.hol != null) {
      var days = c.hol / 24;
      if (c.ga < 30) { lab = '29 недель и меньше, ' + (days <= 7 ? '0–7 суток' : days < 28 ? '8–28 суток' : '28 суток и старше'); row = days <= 7 ? { iv: 48, v: null } : days < 28 ? { iv: 36, v: 4 } : { iv: 24, v: 4 }; }
      else if (c.ga < 35) { lab = '30–34 недели, ' + (days < 7 ? 'младше 7 суток' : 'старше 7 суток'); row = days < 7 ? { iv: 36, v: 4.5 } : { iv: 24, v: 4 }; }
      else { lab = '35 недель и старше'; row = { iv: 24, v: 4 }; }
    }
    var rowTxt = row ? (row.v != null ? fmt(row.v) + ' мг/кг ' : 'доза в цитате таблицы не указана, ') + 'каждые ' + row.iv + ' ч' : '';
    if (d.v == null || d.u !== 'мг/кг' || !d.iv)
      return H('SEP-006', 'nodata', 'Гентамицин: доза и интервал', 'Для сверки укажите дозу в мг/кг и интервал в часах. Текст п. 7 (стр. 13): начальная доза 5 мг/кг, вторая — через 36 ч' + (row ? '; таблица (стр. 18) для «' + lab + '»: ' + rowTxt : '') + '.', [1, 2, 5, 6, 7], { key: 'SEP-006', short: 'доза и интервал гентамицина, стр. 13 и 18' });
    var mText = Math.abs(d.v - 5) < 0.01 && d.iv === 36, mTab = row && (row.v == null || Math.abs(d.v - row.v) < 0.01) && d.iv === row.iv;
    var line = 'Назначено: ' + dtxt(d) + '. ' +
      (row ? (mTab ? 'Совпадает с таблицей (стр. 18) для «' + lab + '». ' : 'Таблица (стр. 18) для «' + lab + '»: ' + rowTxt + '. ') : 'Гестационный возраст не указан — строку таблицы (стр. 18) выбрать нельзя. ') +
      (mText ? 'Совпадает с текстом п. 7 (стр. 13).' : 'Текст п. 7 (стр. 13): начальная доза 5 мг/кг, вторая — через 36 ч.');
    var st = mText && mTab ? 'ok' : (mText || mTab) ? 'conflict' : 'diff';
    return H('SEP-006', st, 'Гентамицин: доза и интервал', line, [1, 2, 5, 6, 7], {
      short: 'гентамицин: п. 7 — 5 мг/кг, вторая доза через 36 ч (стр. 13); таблица по сроку гестации (стр. 18)',
      choices: st === 'conflict' ? ['по таблице препаратов (стр. 18)', 'по тексту п. 7 (стр. 13)'] : null, jt: 'Режим гентамицина выбран '
    });
  }
  function pen(c, d, menin) {
    if (menin) return H('SEP-005', 'remind', 'Бензилпенициллин при менингите', 'При менингите протокол даёт иную дозу — 50 мг/кг каждые 12 ч (стр. 16).', [3]);
    if (d.v == null || !d.iv) return H('SEP-005', 'nodata', 'Бензилпенициллин: доза и интервал', 'Для сверки укажите дозу (мг/кг или Ед/кг) и интервал. Текст п. 6: 25 мг/кг каждые 12 ч (при очень тяжёлом состоянии — каждые 8 ч); таблица (стр. 18): 50 000 Ед/кг каждые 8 ч.', [0, 1, 4, 6], { short: 'бензилпенициллин, стр. 12–13 и 18' });
    var mText = d.u === 'мг/кг' && Math.abs(d.v - 25) < 0.01 && (d.iv === 12 || d.iv === 8), mTab = d.u === 'Ед/кг' && Math.abs(d.v - 50000) < 1 && d.iv === 8;
    var line = 'Назначено: ' + dtxt(d) + '. ' + (mText ? 'Совпадает с текстом п. 6 (стр. 12–13). ' : 'Текст п. 6: 25 мг/кг каждые 12 ч (при очень тяжёлом состоянии — каждые 8 ч). ') + (mTab ? 'Совпадает с таблицей (стр. 18).' : 'Таблица (стр. 18): 50 000 Ед/кг каждые 8 ч.');
    var st = mText && mTab ? 'ok' : (mText || mTab) ? 'conflict' : 'diff';
    return H('SEP-005', st, 'Бензилпенициллин: доза и интервал', line, [0, 1, 4, 6], {
      short: 'бензилпенициллин: 25 мг/кг каждые 12 ч (стр. 12–13), таблица — 50 000 Ед/кг каждые 8 ч (стр. 18)',
      choices: st === 'conflict' ? ['по тексту п. 6 (стр. 12–13)', 'по таблице препаратов (стр. 18)'] : null, jt: 'Режим бензилпенициллина выбран '
    });
  }
  function surf(c, l) {
    var prev = find(c, RE.surf, null, c.t != null ? c.t - 60000 : null).length;
    if (prev) return H('RDS-009', 'ok', 'Сурфактант: повторное введение', 'Правило задаёт только начальную дозу порактанта альфа (200 мг/кг).', [0]);
    if (!RE.porac.test(l)) return H('RDS-009', 'nodata', 'Сурфактант: препарат и доза', 'Для порактанта альфа (Куросурф) протокол называет начальную дозу 200 мг/кг; для других препаратов доза этим правилом не задаётся. Укажите препарат и дозу в мг/кг.', [0, 1]);
    var d = dose(l);
    if (d.v == null || d.u !== 'мг/кг') {
      var fl = /(\d+)\s*флак/.exec(l);
      return H('RDS-009', 'nodata', 'Порактант альфа: доза в мг/кг', (fl ? 'Доза записана во флаконах (' + fl[1] + ' фл.). ' : 'Доза не указана. ') + 'Для сверки с протоколом укажите мг/кг: начальная доза — 200 мг/кг.', [0, 1], { short: 'порактант альфа, начальная доза 200 мг/кг, стр. 9' });
    }
    return Math.abs(d.v - 200) < 0.5 ? H('RDS-009', 'ok', 'Порактант альфа: начальная доза', 'Назначено 200 мг/кг.', [0, 1])
      : H('RDS-009', 'diff', 'Порактант альфа: начальная доза', 'Назначено ' + fmt(d.v) + ' мг/кг; в протоколе начальная доза — 200 мг/кг (лучше, чем 100 мг/кг).', [0, 1], { short: 'порактант альфа, начальная доза 200 мг/кг, стр. 9' });
  }

  /* ---------- открытые вопросы по ребёнку (по журналу, на текущий момент) ---------- */
  function openItems(k, now) {
    now = now || Date.now();
    var c = ctx(k, { date: '', hm: '' }), items = [], H7 = 7 * 24 * 36e5;
    c.log.sort(function (a, b) { return a.t - b.t; });
    var fa = firstAbx(c);
    if (fa && now - fa.t < 4 * 24 * 36e5) {
      if (!find(c, RE.culture, null, fa.t).length && !RE.culture.test(fa.l) && !justified(c, 'SEP-002') && !hasJust(fa.it, 'SEP-002'))
        items.push(H('SEP-002', 'nodata', 'Посев крови до первой дозы АБТ', 'АБТ начата в ' + when(fa.t) + ', забор на посев до неё не отмечен.', [0, 1], { add: { type: 'dx', text: 'Забор крови на стерильность' }, skip: 'Посев крови до начала АБТ не взят' }));
      var a = fa.t + 18 * 36e5, b = fa.t + 24 * 36e5, crp = find(c, RE.crp, fa.t + 36e5, null);
      if (!justified(c, 'SEP-007', fa.t)) {
        var inW = crp.filter(function (x) { return x.t >= a && x.t <= b; });
        if (!inW.length) {
          if (crp.length) items.push(H('SEP-007', 'diff', 'Контроль СРБ через 18–24 ч', 'СРБ отмечен в ' + when(crp[0].t) + ' — вне окна ' + when(a) + '–' + hhmm(b) + '.', [0], { short: 'контроль СРБ через 18–24 ч после начала АБТ, стр. 13' }));
          else if (now < a) items.push(H('SEP-007', 'remind', 'Контроль СРБ через 18–24 ч', 'Взять с ' + when(a) + ' до ' + when(b) + '.', [0], { add: { type: 'lab', text: 'СРБ ' }, skip: 'Контроль СРБ через 18–24 ч после начала АБТ не проведён' }));
          else if (now <= b) items.push(Object.assign(H('SEP-007', 'remind', 'Сейчас: контроль СРБ (18–24 ч)', 'Окно до ' + when(b) + '.', [0], { add: { type: 'lab', text: 'СРБ ' }, skip: 'Контроль СРБ через 18–24 ч после начала АБТ не проведён' }), { hot: true }));
          else items.push(H('SEP-007', 'nodata', 'Контроль СРБ через 18–24 ч', 'Окно ' + when(a) + '–' + hhmm(b) + ' прошло, СРБ не отмечен.', [0], { add: { type: 'lab', text: 'СРБ ' }, skip: 'Контроль СРБ через 18–24 ч после начала АБТ не проведён' }));
        }
      }
    }
    var ints = c.log.filter(function (x) { return RE.intub.test(x.l) && !/экстуб/.test(x.l); });
    var li = ints[ints.length - 1];
    if (li && now - li.t < 3 * 24 * 36e5 && !RE.surf.test(li.l) && !find(c, RE.surf, li.t - 2 * 36e5, null).length && !justified(c, 'RDS-002', li.t))
      items.push(H('RDS-002', 'remind', 'Интубирован ' + when(li.t) + ' — сурфактант не отмечен', 'При РДС всем интубированным показан сурфактант. Если интубация по другой причине — отметьте.', [0], { add: { type: 'proc', text: 'Сурфактант эндотрахеально' }, skip: 'Сурфактант после интубации не вводился' }));
    var nec = c.log.filter(function (x) { return RE.nec.test(x.l) && !RE.necNeg.test(x.l); })[0];
    if (nec && now - nec.t < H7) {
      var aft = function (re) { return find(c, re, nec.t - 36e5, null).length || re.test(nec.l); };
      var chk = [
        ['NEC-001', 'Энтеральное кормление прекращено', aft(RE.feedStop), { type: 'rxoff', text: 'Энтеральное кормление' }, 'Энтеральное кормление не прекращалось'],
        ['NEC-001', 'Назогастральный зонд для декомпрессии', aft(RE.ngt), { type: 'proc', text: 'Установлен назогастральный зонд для декомпрессии' }, 'Назогастральный зонд не устанавливался'],
        ['NEC-005', 'Парентеральное питание с первого дня', aft(RE.pn), { type: 'rx', text: 'Полное парентеральное питание' }, 'Парентеральное питание не начато'],
        ['NEC-009', 'Консультация хирурга (в протоколе — для 2-го уровня)', aft(RE.surgeon), { type: 'cons', text: 'Хирург' }, 'Консультация хирурга не проводилась']
      ];
      if (c.log.some(function (x) { return RE.uvc.test(x.l) && !RE.uvcOut.test(x.l); })) chk.push(['NEC-002', 'Пупочные катетеры удалены', aft(RE.uvcOut), { type: 'proc', text: 'Удалён пупочный катетер' }, 'Пупочный катетер не удалён']);
      if (c.log.some(function (x) { return isAbxEvent(x.it.type, x.l); })) chk.push(['NEC-007', 'Метронидазол в схеме АБТ', c.log.some(function (x) { return /метронид/.test(x.l); }), { type: 'rx', text: 'Метронидазол ' }, 'Метронидазол не введён в схему']);
      var stII = c.log.some(function (x) { return RE.necII.test(x.l); });
      if (stII) {
        var dx48 = nec.t + 48 * 36e5, xr = find(c, RE.xray, nec.t + 36e5, null);
        chk.push(['NEC-006', 'Рентген ОГК и ОБП через 48 ч (' + when(dx48) + ')', xr.length > 0, { type: 'dx', text: 'Рентгенография ОГК и ОБП' }, 'Рентген-контроль через 48 ч не проведён']);
      }
      var open = chk.filter(function (x) { return !x[2] && !justified(c, x[0] + ':' + x[1], nec.t); });
      open.forEach(function (x) { items.push(H(x[0], 'remind', 'НЭК (' + when(nec.t) + '): ' + x[1], '', [0], { key: x[0] + ':' + x[1], add: x[3], skip: x[4] })); });
    }
    // отличия в записях последних 2 суток без обоснования
    c.log.filter(function (x) { return x.t != null && now - x.t < 2 * 24 * 36e5; }).forEach(function (x) {
      analyze(k, x.it).forEach(function (h) {
        if ((h.st === 'diff' || h.st === 'conflict') && !hasJust(x.it, h.rule)) items.push(Object.assign({}, h, { title: hhmm(x.t) + ' · ' + h.title, ev: x.it, key: h.key + '@' + x.it.id }));
      });
    });
    return items.sort(function (a, b) { return (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || ORDER[a.st] - ORDER[b.st]; });
  }
  function hasJust(it, rule) { return (it.just || []).some(function (j) { return j.rule === rule; }); }
  function unjustified(k, it) { return analyze(k, it).filter(function (h) { return (h.st === 'diff' || h.st === 'conflict') && !hasJust(it, h.rule); }); }

  /* ---------- обоснование → текст записи ---------- */
  function justSentence(j) {
    var r = D.R[j.rule]; if (!r) return '';
    var P = D.P[r.p], doc = 'протокола ' + P.doc;
    if (j.choice) return (j.jt || 'Выбрано ') + j.choice + ' ' + doc + (j.text ? '; ' + j.text.trim() : '');
    var cat = CATM[j.cat], why = [cat ? cat[2] : '', (j.text || '').trim()].filter(Boolean).join(', ');
    return 'Отличие от ' + doc + (j.short ? ' (' + j.short + ')' : '') + ' обосновано: ' + (why || '—');
  }
  function justText(it) { return (it.just || []).map(justSentence).filter(Boolean).join('. '); }

  /* ---------- вывод ---------- */
  function quotesHtml(h) {
    var P = D.P[h.p];
    return '<details class="ph-q"><summary>Цитата: ' + esc(P.n) + ', стр. ' + esc(h.q.map(function (q) { return q[0]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ')) + '</summary>' +
      h.q.map(function (q) { return '<blockquote>«' + esc(q[1]) + '» <i>стр. ' + q[0] + '</i></blockquote>'; }).join('') +
      '<p class="ph-src">' + esc(P.doc) + ' · правило ' + esc(h.rule) + ' (' + esc(h.norm.replace('_', ' ')) + ') · <a href="' + P.href + '">открыть протокол</a></p></details>';
  }
  function card(h, o) {
    o = o || {};
    var j = o.justs && o.justs[h.rule], canJ = o.justify && (h.st === 'diff' || h.st === 'conflict' || h.st === 'nodata');
    var html = '<div class="ph ph-' + h.st + (h.hot ? ' ph-hot' : '') + '" data-rule="' + esc(h.rule) + '" data-key="' + esc(h.key) + '"><div class="ph-h"><span class="ph-st">' + STL[h.st] + '</span><b>' + esc(h.title) + '</b></div>' +
      (h.line ? '<p class="ph-l">' + esc(h.line) + '</p>' : '') + (o.compact ? '' : quotesHtml(h));
    if (j) html += '<p class="ph-j">✓ В запись: ' + esc(justSentence(j)) + '. <button type="button" class="ph-lnk" data-unjust>убрать</button></p>';
    else if (canJ) {
      html += '<div class="ph-acts"><button type="button" class="ph-lnk" data-justopen>' + (h.choices ? 'Указать, по какому положению' : 'Обосновать отличие') + '</button></div>' +
        '<div class="ph-jf" hidden>' + (h.choices ? '<div class="chips">' + h.choices.map(function (ch, i) { return '<button type="button" data-choice="' + i + '">' + esc(ch) + '</button>'; }).join('') + '</div>'
          : '<div class="chips">' + CATS.map(function (ct) { return '<button type="button" data-cat="' + ct[0] + '">' + ct[1] + '</button>'; }).join('') + '</div>') +
        '<label class="f"><span>' + (h.choices ? 'Уточнение (по желанию)' : 'Чем обосновано — кратко, для комиссии') + '</span><input type="text" data-jtext placeholder="' + (h.choices ? 'например: срок гестации 38 нед' : 'например: чувствительность флоры отделения, решение зав. отделением') + '"></label>' +
        '<button type="button" class="btn ghost ph-jsave" data-jsave>Добавить в запись</button></div>';
    }
    if (o.card) {
      html += '<div class="ph-acts">' + (h.ev ? '<button type="button" class="ph-lnk" data-evedit="' + esc(h.ev.id) + '">Обосновать в записи ' + esc(h.ev.hm) + '</button>' : '') +
        (h.add ? '<button type="button" class="ph-lnk" data-add>＋ Записать</button>' : '') + (h.skip ? '<button type="button" class="ph-lnk" data-skip>Не делали — обосновать</button>' : '') + '</div>';
    }
    return html + '</div>';
  }
  var FOOT = '<p class="ph-foot">Подсказки по базе правил «Антидефекта» (' + esc(D.v) + ' от ' + esc(D.revised.split('-').reverse().join('.')) + '). Правила ещё не подтверждены экспертом. Это не запрет и не заключение: отклонение допустимо, если причина записана в истории.</p>';
  function list(hs, o) {
    o = o || {};
    if (!hs.length) return '';
    var vis = o.hideOk ? hs.filter(function (h) { return h.st !== 'ok'; }) : hs;
    var oks = hs.length - vis.length;
    return vis.map(function (h) { return card(h, o); }).join('') + (oks ? '<p class="ph-okn">✓ Совпадает с протоколом: ' + hs.filter(function (h) { return h.st === 'ok'; }).map(function (h) { return esc(h.title); }).join('; ') + '</p>' : '') + (o.noFoot ? '' : FOOT);
  }
  // обработчики для блока подсказок в форме события; state.justs — {rule: {...}}
  function bind(box, getHints, state, rerender) {
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var el = b.closest('.ph'); if (!el) return;
      var rule = el.dataset.rule, h = (getHints() || []).find(function (x) { return x.rule === rule; }); if (!h) return;
      if (b.hasAttribute('data-justopen')) { var f = el.querySelector('.ph-jf'); f.hidden = !f.hidden; return; }
      if (b.hasAttribute('data-unjust')) { delete state.justs[rule]; rerender(); return; }
      if (b.dataset.cat) { el.querySelectorAll('[data-cat]').forEach(function (x) { x.removeAttribute('aria-pressed'); }); b.setAttribute('aria-pressed', 'true'); el.dataset.cat = b.dataset.cat; return; }
      if (b.dataset.choice != null) { el.querySelectorAll('[data-choice]').forEach(function (x) { x.removeAttribute('aria-pressed'); }); b.setAttribute('aria-pressed', 'true'); el.dataset.choice = b.dataset.choice; return; }
      if (b.hasAttribute('data-jsave')) {
        var t = (el.querySelector('[data-jtext]') || {}).value || '';
        if (h.choices) { if (el.dataset.choice == null) { b.textContent = 'Выберите положение'; return; } state.justs[rule] = { rule: rule, choice: h.choices[+el.dataset.choice], jt: h.jt, text: t }; }
        else {
          var cat = el.dataset.cat; if (!cat) { b.textContent = 'Выберите причину'; return; }
          if ((cat === 'other' || cat === 'clinical') && !t.trim()) { b.textContent = 'Напишите кратко, чем'; return; }
          state.justs[rule] = { rule: rule, cat: cat, text: t, short: h.short };
        }
        rerender();
      }
    });
  }

  /* ---------- карточка на странице ребёнка ---------- */
  var openCard = {};
  function kidCard() {
    var m = /^#kid-(.+)$/.exec(location.hash), host = document.querySelector('.kmain');
    var old = document.getElementById('phCard');
    if (!m || !host || !N().kids) { if (old) old.remove(); return; }
    var id = decodeURIComponent(m[1]), k = (N().kids() || []).find(function (x) { return x.id === id; });
    if (!k) { if (old) old.remove(); return; }
    var items = openItems(k), sig = id + '|' + JSON.stringify(items.map(function (h) { return h.key + h.st + h.line; }));
    if (old && old.dataset.sig === sig && host.contains(old)) return;
    if (old) old.remove();
    if (!items.length) return;
    var sec = document.createElement('section'); sec.id = 'phCard'; sec.className = 'card ph-card'; sec.dataset.sig = sig;
    var show = openCard[id] ? items : items.slice(0, 3);
    sec.innerHTML = '<div class="ph-ch"><b>По протоколам: ' + items.length + '</b><span class="meta">из журнала смены</span></div>' +
      show.map(function (h) { return card(h, { card: true, compact: false }); }).join('') +
      (items.length > 3 ? '<button type="button" class="ph-lnk ph-more">' + (openCard[id] ? 'Свернуть' : 'Показать все (' + items.length + ')') + '</button>' : '') + FOOT;
    var anchor = host.querySelector('.khints') || host.querySelector('.khead');
    if (anchor && anchor.parentNode === host) host.insertBefore(sec, anchor.nextSibling); else host.insertBefore(sec, host.firstChild);
    sec.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('ph-more')) { openCard[id] = !openCard[id]; sec.remove(); kidCard(); return; }
      var el = b.closest('.ph'); if (!el) return;
      var h = items.find(function (x) { return x.key === el.dataset.key; }); if (!h) return;
      var L = window.__neoLog; if (!L) return;
      if (b.dataset.evedit) { var it = (k.log || []).find(function (x) { return x.id === b.dataset.evedit; }); if (it) L.open({ kid: k.id, it: JSON.parse(JSON.stringify(it)) }); return; }
      if (b.hasAttribute('data-add')) { L.open(null, { kid: k.id, type: h.add.type, text: h.add.text }); return; }
      if (b.hasAttribute('data-skip')) { L.open(null, { kid: k.id, type: 'note', text: h.skip + ': ', jr: h.key }); return; }
    });
  }
  var st = document.createElement('style');
  st.textContent = '.ph{border-left:4px solid var(--line);background:var(--card-2);border-radius:10px;padding:9px 11px;margin:8px 0}.ph-diff{border-left-color:var(--bad)}.ph-conflict{border-left-color:var(--amber-ink,#8a5f00)}.ph-nodata{border-left-color:var(--muted)}.ph-remind{border-left-color:var(--accent)}.ph-ok{border-left-color:var(--ok)}.ph-hot{background:var(--warn-bg)}' +
    '.ph-h{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}.ph-h b{font-size:14.5px}.ph-st{font-size:11.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--muted)}.ph-diff .ph-st{color:var(--bad)}.ph-conflict .ph-st{color:var(--warn)}.ph-remind .ph-st{color:var(--accent)}.ph-ok .ph-st{color:var(--ok)}' +
    '.ph-l{margin:4px 0 2px;font-size:14px;line-height:1.45}.ph-q{margin:4px 0 0;font-size:13.5px}.ph-q summary{cursor:pointer;color:var(--accent);font-weight:600}.ph-q blockquote{margin:6px 0;padding:6px 10px;border-left:3px solid var(--line);background:var(--card);border-radius:6px;line-height:1.45}.ph-q blockquote i{color:var(--muted);font-size:12px}.ph-src{font-size:12px;color:var(--muted);margin:4px 0 0}' +
    '.ph-acts{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px}.ph-lnk{border:0;background:none;color:var(--accent);font:600 13.5px var(--font);padding:4px 0;cursor:pointer}.ph-jf{margin-top:6px}.ph-jf .chips{margin-bottom:6px}.ph-jf input{width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid var(--line);border-radius:var(--r-in);background:var(--card);color:var(--ink)}.ph-jsave{margin-top:6px;min-height:36px}' +
    '.ph-j{margin:6px 0 0;font-size:13.5px;color:var(--ok);line-height:1.45}.ph-okn{font-size:13px;color:var(--ok);margin:6px 2px}.ph-foot{font-size:11.5px;color:var(--muted);margin:6px 2px 0;line-height:1.4}.ph-card{margin:10px 0}.ph-ch{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.ph-more{margin-top:2px}.ph-badge{font-size:12px;color:var(--bad);font-weight:700;margin-left:2px}';
  document.head.appendChild(st);
  new MutationObserver(function () { clearTimeout(kidCard._t); kidCard._t = setTimeout(kidCard, 120); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { setTimeout(kidCard, 200); });
  setInterval(kidCard, 60000);
  window.__neoHints = { analyze: analyze, openItems: openItems, list: list, card: card, bind: bind, justText: justText, unjustified: unjustified, refresh: function () { var o = document.getElementById('phCard'); if (o) o.remove(); kidCard(); }, data: D };
})();
