/* Быстрый ввод: разбор диктовки и вставленного текста без ключа ИИ (на телефоне, без интернета),
   фото обменной карты (с ключом ИИ), отметки по беременности вместо свободного текста,
   «мать и роды как у близнеца», кнопка помощника под большой палец. */
(function () {
  var N = function () {
    return window.__neo || {};
  };
  var low = function (s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ё/g, "е");
  };
  var cap = function (s) {
    s = String(s || "").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  };
  var dot = function (s) {
    s = cap(s).replace(/[\s,;:]+$/, "");
    return s ? (/[.!?]$/.test(s) ? s : s + ".") : s;
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };

  /* ---------- словари ---------- */
  // течение беременности → ключи отметок приложения
  var PG = [
    ["arvi", /орви|(?:^|[^а-яa-z0-9])ори(?![а-яa-z0-9])|простуд|респираторн[а-яёa-z0-9_]* инфекц|ковид|covid/],
    ["anem", /анеми/],
    ["threat", /угроз[а-яёa-z0-9_]*(\s+\S+){0,2}\s*(прерыв|выкидыш|преждевременн)/],
    ["icn", /(?:^|[^а-яa-z0-9])ицн(?![а-яa-z0-9])|истмико|серкляж|пессари/],
    [
      "gdm",
      /(?:^|[^а-яa-z0-9])гсд(?![а-яa-z0-9])|гестационн[а-яёa-z0-9_]*\s+(сахарн[а-яёa-z0-9_]*\s+)?диабет|сахарн[а-яёa-z0-9_]*\s+диабет|(?:^|[^а-яa-z0-9])сд(?![а-яa-z0-9])/,
    ],
    ["pe", /преэклампс|(?:^|[^а-яa-z0-9])пэ(?![а-яa-z0-9])|эклампс/],
    [
      "gah",
      /(?:^|[^а-яa-z0-9])гаг(?![а-яa-z0-9])|гестационн[а-яёa-z0-9_]*\s+(артериальн[а-яёa-z0-9_]*\s+)?гипертенз|гипертензи|повышен[а-яёa-z0-9_]*\s+(ад|давлен)/,
    ],
    [
      "fgr",
      /(?:^|[^а-яa-z0-9])звур(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])зрп(?![а-яa-z0-9])|нарушен[а-яёa-z0-9_]*\s+(мппк|маточно|фппк|кровоток)|(?:^|[^а-яa-z0-9])нмпк(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])фпн(?![а-яa-z0-9])|фетоплацентарн|плацентарн[а-яёa-z0-9_]*\s+недостаточн/,
    ],
    ["oligo", /маловоди/],
    ["poly", /многоводи/],
    ["colp", /кольпит|вагиноз|вагинит|молочниц|кандидоз/],
    ["uti", /бактериури|пиелонефрит|цистит|инфекц[а-яёa-z0-9_]*\s+мочев|(?:^|[^а-яa-z0-9])имп(?![а-яa-z0-9])/],
    ["torch", /torch|торч|(?:^|[^а-яa-z0-9])цмв(?![а-яa-z0-9])|цитомегалови|токсоплазм|герпес|краснух/],
    [
      "gbs",
      /(?:^|[^а-яa-z0-9])сгв(?![а-яa-z0-9])|стрептокок[а-яёa-z0-9_]*\s+(группы\s+)?[вb](?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])gbs(?![а-яa-z0-9])/,
    ],
    ["twin", /двойн|многоплод|близнец|бихориал|монохориал|диамниот/],
    ["ivf", /(?:^|[^а-яa-z0-9])эко(?![а-яa-z0-9])|экстракорпоральн/],
    ["prev", /предлежан/],
    ["abr", /отслойк|(?:^|[^а-яa-z0-9])понрп(?![а-яa-z0-9])/],
    ["fever", /лихорад|гипертерми|температур[а-яёa-z0-9_]*\s+(в родах|38|39)/],
    ["chorio", /хориоамнион/],
    ["rh", /резус.?(сенсибил|конфликт|иммуниз)|титр[а-яёa-z0-9_]*\s+антител|анти-?d/],
  ];
  var TRI_OK = { arvi: 1, anem: 1, threat: 1, pe: 1, colp: 1, uti: 1 };
  // жалобы при поступлении
  var CMP = [
    [
      "resp",
      /тахипноэ|втяжен|одышк|дыхательн[а-яёa-z0-9_]*\s+(нарушен|недостаточн|расстрой)|(?:^|[^а-яa-z0-9])дн(?![а-яa-z0-9])/,
    ],
    ["grunt", /стонущ|стон(?![а-яa-z0-9])|раздуван/],
    ["cyan", /цианоз|десатурац|снижен[а-яёa-z0-9_]*\s+сатурац/],
    ["apnea", /апноэ/],
    ["cns", /угнетен|слаб[а-яёa-z0-9_]*\s+крик|снижен[а-яёa-z0-9_]*\s+двигательн/],
    ["tone", /мышечн[а-яёa-z0-9_]*\s+гипотон|гипотони[а-яёa-z0-9_]*\s+мышц|гипорефлекс/],
    ["jaund", /желтушн|иктеричн|желтух/],
    ["vom", /срыгив|застой|рвот/],
    ["bloat", /вздути/],
    ["feed", /вял[а-яёa-z0-9_]*\s+сосан|отказ[а-яёa-z0-9_]*\s+от\s+(еды|кормл|груди)|плохо\s+сос/],
    ["seiz", /судорог/],
    ["malf", /(?:^|[^а-яa-z0-9])впр(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])впс(?![а-яa-z0-9])|порок/],
    [
      "shock",
      /микроциркул|мраморн|артериальн[а-яёa-z0-9_]*\s+гипотон|симптом[а-яёa-z0-9_]*\s+бел[а-яёa-z0-9_]*\s+пятн/,
    ],
  ];
  var WATER = [
    ["мекониальные", /меко/],
    ["зелёные с неприятным запахом", /зелен|запах/],
    ["кровянистые", /кровянист|с кровью|геморрагич/],
    ["светлые", /светл|прозрачн/],
  ];
  var FROM = [
    ["родильного зала", /родзал|родильн[а-яёa-z0-9_]*\s+зал|родового зала/],
    ["операционной", /операционн/],
    ["послеродового отделения", /послеродов|совместн[а-яёa-z0-9_]*\s+пребыв|палат/],
    [
      "другого стационара",
      /друг[а-яёa-z0-9_]*\s+(стационар|больниц|роддом)|(?:^|[^а-яa-z0-9])црб(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])район|санави|переведен[а-яёa-z0-9_]*\s+из/,
    ],
  ];
  var ORD = {
    "перв": 1,
    "втор": 2,
    "трет": 3,
    "четв": 4,
    "пят": 5,
    "шест": 6,
    "седьм": 7,
    "восьм": 8,
    "девят": 9,
    "десят": 10,
    "одиннадц": 11,
    "двенадц": 12,
  };
  var ordNum = function (w) {
    w = low(w);
    for (var k in ORD) if (w.indexOf(k) === 0) return ORD[k];
    return null;
  };
  var NUMW =
    "(\\d{1,2}|перв[а-яёa-z0-9_]*|втор[а-яёa-z0-9_]*|трет[а-яёa-z0-9_]*|четв[а-яёa-z0-9_]*|пят[а-яёa-z0-9_]*|шест[а-яёa-z0-9_]*|седьм[а-яёa-z0-9_]*|восьм[а-яёa-z0-9_]*|девят[а-яёa-z0-9_]*|десят[а-яёa-z0-9_]*)";
  var toN = function (s) {
    return /^\d+$/.test(s) ? +s : ordNum(s);
  };

  /* ---------- куски текста ---------- */
  function segments(text) {
    // фразы между запятыми/точками — для отметок и триместров
    return String(text || "")
      .split(/[,;\n]|\.(?=\s|$)/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }
  function negated(seg, idx) {
    var before = seg.slice(Math.max(0, idx - 8), idx),
      after = seg.slice(idx, idx + 40);
    return (
      /((?:^|[^а-яa-z0-9])без|(?:^|[^а-яa-z0-9])не|(?:^|[^а-яa-z0-9])нет|отрицает)\s*$/.test(before) ||
      /^\S+(\s+\S+)?\s+(не было|не выявлен[а-яёa-z0-9_]*|не отмечал[а-яёa-z0-9_]*|нет|отрицает|отрицательн[а-яёa-z0-9_]*)/.test(
        after,
      )
    );
  }
  function trimesters(seg) {
    var s = low(seg);
    if (s.indexOf("триместр") < 0) return "";
    var out = {},
      re = /триместр/g,
      m;
    while ((m = re.exec(s))) {
      var w = s.slice(0, m.index).split(/\s+/).slice(-5);
      w.forEach(function (x) {
        x = x.replace(/[^0-9a-zа-я]/g, "").replace(/(м|ом|ем)$/, "");
        if (/^(1|i|перв)/.test(x)) out[1] = 1;
        else if (/^(3|iii|трет)/.test(x)) out[3] = 1;
        else if (/^(2|ii|втор)/.test(x)) out[2] = 1;
      });
    }
    return Object.keys(out).sort().join(",");
  }
  // отметки из свободного текста; возвращает {hits:[[key,tri,seg]], rest:[seg]}
  function matchList(text, list) {
    var hits = [],
      rest = [],
      seen = {};
    segments(text).forEach(function (seg) {
      var s = low(seg),
        any = false,
        neg = false;
      list.forEach(function (it) {
        var m = it[1].exec(s);
        if (!m) return;
        if (negated(s, m.index)) {
          neg = true;
          return;
        }
        any = true;
        if (!seen[it[0]]) {
          seen[it[0]] = 1;
          hits.push([it[0], TRI_OK[it[0]] ? trimesters(seg) : "", seg]);
        }
      });
      // фразу оставляем текстом, если в ней есть что-то кроме найденного
      if (!any && !neg) rest.push(seg);
      else if (any) {
        var left = s;
        list.forEach(function (it) {
          left = left.replace(new RegExp(it[1].source, "g"), " ");
        });
        left = left
          .replace(
            /(?:^|[^а-яa-z0-9])(в|во|на|с|и|по|при|беременност[а-яёa-z0-9_]*|течени[а-яёa-z0-9_]*|триместр[а-яёa-z0-9_]*|\d|i{1,3}|перв[а-яёa-z0-9_]*|втор[а-яёa-z0-9_]*|трет[а-яёa-z0-9_]*|-?м|-?ом|неделе|нед)(?![а-яa-z0-9])/g,
            " ",
          )
          .replace(/[^а-яa-z]+/g, " ")
          .trim();
        if (
          left.split(/\s+/).filter(function (w) {
            return w.length > 3;
          }).length >= 2
        )
          rest.push(seg);
      }
    });
    return { hits: hits, rest: rest };
  }
  var label = function (list, key) {
    var g = (N().ge || []).concat(N().Qe || []).find(function (x) {
      return x[0] === key;
    });
    return g ? g[1] : key;
  };
  var triTxt = function (t) {
    return t ? " (" + t.split(",").join(" и ") + " трим.)" : "";
  };

  /* ---------- анамнез и поступление: разбор на телефоне ---------- */
  function first(re, s) {
    var m = re.exec(s);
    return m ? m : null;
  }
  function blood(s) {
    var L = low(s),
      g = null,
      rh = null,
      m;
    m =
      /(?:групп[а-яёa-z0-9_]*\s*крови|гр\.?\s*кр(?:ови|\.)?|кровь)[\s:–-]*(o|о|0|i{1,3}v?|iv|a|b|ab|а|в|ав|[1-4])(?![а-яa-z0-9])\s*(?:\(\s*(i{1,3}|iv|[1-4])\s*\))?\s*(?:rh|резус|рез)?\s*[-–:]?\s*(\+|-|−|положит[а-яёa-z0-9_]*|отрицат[а-яёa-z0-9_]*|пол(?![а-яa-z0-9])|отр(?![а-яa-z0-9]))?/.exec(
        L,
      ) ||
      /(?:^|[^а-яa-z0-9])(o|о|0|a|b|ab|а|в|ав)\s*\(\s*(i{1,3}|iv)\s*\)\s*(?:rh|резус)\s*[-–:]?\s*(\+|-|−|положит[а-яёa-z0-9_]*|отрицат[а-яёa-z0-9_]*|пол(?![а-яa-z0-9])|отр(?![а-яa-z0-9]))/.exec(
        L,
      );
    if (!m) return "";
    var x = m[1],
      r = m[2] || "";
    var map = {
      o: 1,
      "о": 1,
      "0": 1,
      i: 1,
      a: 2,
      "а": 2,
      ii: 2,
      b: 3,
      "в": 3,
      iii: 3,
      ab: 4,
      "ав": 4,
      iv: 4,
      "1": 1,
      "2": 2,
      "3": 3,
      "4": 4,
    };
    g = map[x] || map[r];
    if (!g) return "";
    var sign = m[3] || "";
    if (!sign) {
      var after = L.slice(m.index, m.index + 60);
      var mm = /(резус|rh)\D{0,6}(\+|-|−|положит|отрицат|пол(?![а-яa-z0-9])|отр(?![а-яa-z0-9]))/.exec(after);
      sign = mm ? mm[2] : "";
    }
    rh = /^(\+|полож|пол)/.test(sign) ? "+" : /^(-|−|отриц|отр)/.test(sign) ? "−" : "";
    return ["O(I)", "A(II)", "B(III)", "AB(IV)"][g - 1] + (rh ? " Rh" + rh : "");
  }
  function sero(s) {
    var L = low(s),
      m =
        /(вич|(?:^|[^а-яa-z0-9])rw(?![а-яa-z0-9])|(?:^|[^а-яa-z0-9])рв(?![а-яa-z0-9])|hbsag|hcv|гепатит|маркер[а-яёa-z0-9_]*\s+гепат|сифилис)/.exec(
          L,
        );
    if (!m) return "";
    var seg = L.slice(m.index, m.index + 120).split(/[.;\n]/)[0];
    if (
      /(отрицат|отр(?![а-яa-z0-9])|не обнаруж|neg|\(-\)|\s-\s*$|норм)/.test(seg) &&
      !/(положит|полож(?![а-яa-z0-9])|обнаружен[^и])/.test(seg)
    )
      return "отрицательные";
    return seg.trim();
  }
  function steroid(s) {
    var L = low(s),
      m = /(стероид|дексамет|бетамет|дексон|профилакти[а-яёa-z0-9_]*\s+(синдрома\s+дыхательных|рдс|сдр))/.exec(L);
    if (!m) return null;
    var w =
      L.slice(Math.max(0, m.index - 40), m.index + 80)
        .split(/[.;\n]/)
        .filter(function (x) {
          return /(стероид|дексамет|бетамет|дексон|рдс|сдр)/.test(x);
        })[0] || "";
    if (
      /(не\s+(провод|получ|был|ввод|сдел)|без\s+(стероид|профилакт)|не\s+проведен|отсутств|(?:^|[^а-яa-z0-9])нет(?![а-яa-z0-9]))/.test(
        w,
      )
    )
      return ["none", true];
    if (/(неполн|частичн|не\s+заверш|1\s+доз|одн[а-яёa-z0-9_]*\s+доз|прерван)/.test(w)) return ["part", true];
    if (
      /(полн|заверш|(?:^|[^а-яa-z0-9])4\s+доз|(?:^|[^а-яa-z0-9])2\s+доз|курс\s+провед|провед|получил|получала)/.test(w)
    )
      return ["full", true];
    return ["full", false];
  }
  function parseAdm(text) {
    var T = String(text || ""),
      L = low(T),
      adm = {},
      x = [],
      unclear = [];
    var add = function (path, lab, shown, on) {
      x.push({ grp: "Отметки в карте", label: lab, path: path, value: "1", shown: shown, on: on !== false });
    };
    var m;
    // поступление
    if ((m = first(/поступ[а-яёa-z0-9_]*[^0-9\n]{0,25}?(\d{1,2})[:.](\d{2})/, L)))
      adm.admT = ("0" + m[1]).slice(-2) + ":" + m[2];
    if ((m = first(/(?:в\s+)?возраст[а-яёa-z0-9_]*\s+(\d{1,3})\s*(?:ч(?![а-яa-z0-9])|час)/, L))) adm.admH = m[1];
    for (var i = 0; i < FROM.length; i++)
      if (FROM[i][1].test(L) && /(поступ|переведен|доставлен|из\s)/.test(L)) {
        adm.from = FROM[i][0];
        break;
      }
    if ((m = first(/(на руках[^.,;]*)/, L))) adm.trans = m[1].trim();
    // мать
    if (
      (m =
        first(
          /(?:мат(?:ь|ери)|женщин[а-яёa-z0-9_]*|возраст\s+матери|рожениц[а-яёa-z0-9_]*)\D{0,20}?(\d{2})\s*(?:лет|год|л\.)/,
          L,
        ) || first(/(?:^|[^а-яa-z0-9])(\d{2})\s*(?:лет|года?)(?![а-яa-z0-9])/, L))
    ) {
      if (+m[1] >= 13 && +m[1] <= 55) adm.mAge = m[1];
    }
    // беременность и роды по счёту: «Б-3 Р-2», «G3P2», «беременность третья», «3 беременность, 2 роды»
    if ((m = first(/(?:^|[^а-яa-z0-9])g\s*(\d{1,2})\s*p\s*(\d{1,2})/, L))) {
      adm.gr = m[1];
      adm.par = m[2];
    }
    if (!adm.gr && (m = first(/(?:^|[^а-яa-z0-9])б\s*[-–:]?\s*(\d{1,2})(?![а-яa-z0-9])/, L))) adm.gr = m[1];
    if (!adm.par && (m = first(/(?:^|[^а-яa-z0-9])р\s*[-–:]?\s*(\d{1,2})(?![а-яa-z0-9])/, L))) adm.par = m[1];
    if (
      !adm.gr &&
      (m =
        first(
          new RegExp("беременност[а-яёa-z0-9_]*\\s*(?:по\\s+счету\\s*)?[-–:№]?\\s*" + NUMW + "(?![а-яa-z0-9])"),
          L,
        ) || first(new RegExp(NUMW + "[-\\s]*(?:я|ая|ья)?\\s+беременност"), L))
    )
      adm.gr = String(toN(m[1]) || "");
    if (
      !adm.par &&
      (m =
        first(new RegExp("(?:^|[^а-яa-z0-9])роды\\s*(?:по\\s+счету\\s*)?[-–:№]?\\s*" + NUMW + "(?![а-яa-z0-9])"), L) ||
        first(new RegExp(NUMW + "[-\\s]*(?:е|ые|ие|ьи)?\\s+роды"), L))
    )
      adm.par = String(toN(m[1]) || "");
    if (!adm.gr) delete adm.gr;
    if (!adm.par) delete adm.par;
    var prev = segments(T).filter(function (s) {
      return /(аборт|(?:^|[^а-яa-z0-9])м\/а(?![а-яa-z0-9])|выкидыш|замерш|внематочн|живых|мертворожд|самопроизвольн[а-яёa-z0-9_]*\s+прерыв|(?:^|[^а-яa-z0-9])св(?![а-яa-z0-9]))/.test(
        low(s),
      );
    });
    if (prev.length) adm.prev = cap(prev.join(", ").replace(/^\s*в\s+анамнезе[:\s-]*/i, ""));
    // течение беременности → отметки
    var pgPart = T.replace(
      /(групп[а-яёa-z0-9_]*\s*крови|вич|(?:^|[^а-яa-z0-9])rw(?![а-яa-z0-9])|hbsag|hcv)[^.;\n]*/gi,
      " ",
    );
    var pg = matchList(pgPart, PG);
    var wasOk =
      /(беременност[а-яёa-z0-9_]*\s+(протекал[а-яёa-z0-9_]*\s+)?без\s+(особенност|осложнен|патолог)|без\s+особенностей)/.test(
        L,
      );
    if (
      pg.hits.some(function (h) {
        return h[0] === "pe";
      })
    )
      pg.hits = pg.hits.filter(function (h) {
        return h[0] !== "gah";
      });
    pg.hits.forEach(function (h) {
      add(["pg", h[0], h[1] || ""], "Течение беременности", label(PG, h[0]) + triTxt(h[1]));
    });
    if (!pg.hits.length && wasOk) add(["pgok"], "Течение беременности", "без особенностей");
    // стероиды
    var st = steroid(T);
    if (st)
      add(
        ["st", st[0]],
        "Антенатальные стероиды",
        { full: "полный курс", part: "неполный курс", none: "не проводилась" }[st[0]] + (st[1] ? "" : " — уточните"),
        st[1],
      );
    var b = blood(T);
    if (b) adm.mBlood = b;
    var sr = sero(T);
    if (sr) adm.sero = sr;
    // роды
    if (/кесар|(?:^|[^а-яa-z0-9])кс(?![а-яa-z0-9])|оперативн[а-яёa-z0-9_]*\s+родоразреш/.test(L)) adm.delivery = "cs";
    else if (
      /естественн[а-яёa-z0-9_]*\s+родов|(?:^|[^а-яa-z0-9])ерп(?![а-яa-z0-9])|самопроизвольн[а-яёa-z0-9_]*\s+роды|вагинальн|физиологическ[а-яёa-z0-9_]*\s+род|роды\s+через\s+естеств/.test(
        L,
      )
    )
      adm.delivery = "vag";
    if (
      adm.delivery === "cs" &&
      (m = first(
        /(?:кесарев[а-яёa-z0-9_]*\s+сечени[а-яёa-z0-9_]*|(?:^|[^а-яa-z0-9])кс(?![а-яa-z0-9])|кесарево)[^.;\n]{0,15}?(?:по поводу|в связи с|по показани[а-яёa-z0-9_]*:?|показани[а-яёa-z0-9_]*:)\s*([^.;,\n]+)/,
        L,
      ))
    )
      adm.csInd = m[1].trim();
    for (i = 0; i < WATER.length; i++) {
      var wm = /(воды|околоплодн[а-яёa-z0-9_]*)[^.;\n]{0,25}/.exec(L);
      if (wm && WATER[i][1].test(wm[0])) {
        adm.water = WATER[i][0];
        break;
      }
    }
    if (
      (m = first(
        /безводн[а-яёa-z0-9_]*\s+(?:промежуток|период)[а-яёa-z0-9_]*[^0-9\n]{0,15}(\d+(?:[.,]\d+)?)\s*(ч|час|мин|сут)?/,
        L,
      ))
    ) {
      var v = parseFloat(m[1].replace(",", "."));
      if (/^мин/.test(m[2] || "")) v = Math.round(v / 6) / 10;
      if (/^сут/.test(m[2] || "")) v = v * 24;
      adm.prom = String(v);
    }
    if (
      (m = first(
        /апгар[а-яёa-z0-9_]*[^0-9\n]{0,15}(\d{1,2})\s*(?:\/|-|–|,|и|на|\s)\s*(\d{1,2})(?:\s*(?:\/|-|–|,|и|\s)\s*(\d{1,2}))?/,
        L,
      )) ||
      (m = first(/оценк[а-яёa-z0-9_]*[^0-9\n]{0,20}(\d{1,2})\s*[\/–-]\s*(\d{1,2})(?:\s*[\/–-]\s*(\d{1,2}))?\s*балл/, L))
    ) {
      if (+m[1] <= 10) adm.apg1 = m[1];
      if (+m[2] <= 10) adm.apg5 = m[2];
      if (m[3] && +m[3] <= 10) adm.apg10 = m[3];
    }
    // родзал
    var rz = segments(T).filter(function (s) {
      s = low(s);
      return (
        s.indexOf("поступ") < 0 &&
        /(родзал|родильн[а-яёa-z0-9_]*\s+зал|в родах|после рождения|при рождении)/.test(s) &&
        /(cpap|сипап|ивл|маск|интубир|реаним|сурфактант|санац|кислород|массаж|адреналин|обсушен|тактильн)/.test(s)
      );
    });
    if (rz.length)
      adm.rz = rz
        .map(function (q) {
          return q.replace(/(^|\s)(в\s+)?(родзале|родильном\s+зале)(\s|$)/i, " ").trim();
        })
        .filter(Boolean)
        .join(", ");
    if (/(реанимац[а-яёa-z0-9_]*\s+не\s+(требовал|проводил)|без\s+реанимац)/.test(L))
      add(["nores"], "Реанимация в родзале", "не требовалась");
    else {
      if (
        /(ивл|вентиляц[а-яёa-z0-9_]*)\s+(маск|мешк)|масочн[а-яёa-z0-9_]*\s+ивл|(?:^|[^а-яa-z0-9])ppv(?![а-яa-z0-9])/.test(
          L,
        )
      )
        add(["csf", "r_ppv"], "Реанимация в родзале", "ИВЛ маской");
      if (/интубир|интубац/.test(L) && /(родзал|родильн|в родах|при рождении|сразу)/.test(L))
        add(["csf", "r_int"], "Реанимация в родзале", "интубация");
      if (/непрям[а-яёa-z0-9_]*\s+массаж|(?:^|[^а-яa-z0-9])нмс(?![а-яa-z0-9])|адреналин/.test(L))
        add(["csf", "r_cpr"], "Реанимация в родзале", "непрямой массаж / адреналин");
    }
    // объективно
    if ((m = first(/сильверман[а-яёa-z0-9_]*[^0-9\n]{0,10}(\d{1,2})(?:\s*\/\s*(\d{1,2}))?/, L)))
      adm.silv = m[2] ? m[1] + "/" + m[2] : m[1];
    if (
      (m = first(/окружност[а-яёa-z0-9_]*\s+голов[а-яёa-z0-9_]*[^0-9\n]{0,8}(\d{2}(?:[.,]\d)?)/, L)) ||
      (m = first(/(?:^|[^а-яa-z0-9])ог(?![а-яa-z0-9])[^0-9\n]{0,4}(\d{2}(?:[.,]\d)?)/, L))
    )
      adm.hc = m[1].replace(",", ".");
    if (
      (m = first(/окружност[а-яёa-z0-9_]*\s+груд[а-яёa-z0-9_]*[^0-9\n]{0,8}(\d{2}(?:[.,]\d)?)/, L)) ||
      (m = first(/(?:^|[^а-яa-z0-9])огк(?![а-яa-z0-9])[^0-9\n]{0,4}(\d{2}(?:[.,]\d)?)/, L))
    )
      adm.cc = m[1].replace(",", ".");
    // жалобы
    var jal = /(жалоб|при поступлении|состояни)/.test(L) ? matchList(T, CMP) : { hits: [] };
    jal.hits.forEach(function (h) {
      add(["cmp", h[0]], "Жалобы при поступлении", label(CMP, h[0]));
    });
    // показатели и поддержка при поступлении — общий разборщик чисел
    var out = { adm: adm, _x: x, unclear: unclear, fixes: [] };
    var noRz = T;
    segments(T).forEach(function (q) {
      var l = low(q);
      if (l.indexOf("поступ") < 0 && (rz.indexOf(q) >= 0 || /(маск|мешк|родзал|родильн[а-яёa-z0-9_]*\s+зал)/.test(l)))
        noRz = noRz.split(q).join(" ");
    });
    var d = dayNumbers(noRz, false);
    out.day = d.day;
    out.vitals = d.vitals.map(function (v) {
      v.time = "";
      return v;
    });
    out.unclear = unclear.concat(d.unclear);
    if (out.day) {
      ["w", "urine", "stool", "feed", "feedN", "cond"].forEach(function (k) {
        delete out.day[k];
      });
    }
    return out;
  }

  /* ---------- дневник: разбор на телефоне ---------- */
  var EVK = [
    ["surf", /сурфактант|куросурф|порактант|кюросурф/],
    ["intub", /интубир|интубац/],
    ["extub", /экстубир|экстубац/],
    ["ptx", /пневмоторакс/],
    ["apnea", /апноэ/],
    ["seiz", /судорог/],
    ["abxOn", /(начат[а-яёa-z0-9_]*|назнач[а-яёa-z0-9_]*|старт[а-яёa-z0-9_]*)\s+(абт|антибиот)/],
    ["abxCh", /(смен[а-яёa-z0-9_]*|замен[а-яёa-z0-9_]*)\s+(абт|антибиот)/],
    ["abxOff", /(отмен[а-яёa-z0-9_]*)\s+(абт|антибиот)/],
    ["ftOn", /(начат[а-яёa-z0-9_]*|назнач[а-яёa-z0-9_]*)\s+фототерап|на фототерап/],
    ["ftOff", /фототерап[а-яёa-z0-9_]*\s+отмен|отмен[а-яёa-z0-9_]*\s+фототерап/],
    ["zpk", /(?:^|[^а-яa-z0-9])зпк(?![а-яa-z0-9])|заменн[а-яёa-z0-9_]*\s+переливан/],
    ["trans", /гемотрансфуз|трансфуз|перелит[а-яёa-z0-9_]*\s+(эр|сзп|тромб)|эритроцитарн/],
    ["inoOn", /(начат[а-яёa-z0-9_]*|подключ[а-яёa-z0-9_]*)\s+(инотроп|допамин|добутамин|адреналин|норадреналин)/],
    ["inoOff", /(инотроп[а-яёa-z0-9_]*|допамин|добутамин)\s+отмен|отмен[а-яёa-z0-9_]*\s+(инотроп|допамин|добутамин)/],
    ["hypog", /гипогликем/],
    ["feedStop", /кормлени[а-яёa-z0-9_]*\s+отмен|отмен[а-яёa-z0-9_]*\s+кормлен|голод/],
    [
      "paramUp",
      /(повысил|поднял|увеличил|повышен|увеличен)[а-яёa-z0-9_]*\s+(fio|фио|pip|пип|peep|параметр|map|мап|поток|чд)/,
    ],
    ["paramDown", /(снизил|уменьшил|снижен|уменьшен)[а-яёa-z0-9_]*\s+(fio|фио|pip|пип|peep|параметр|map|мап|поток|чд)/],
  ];
  var EV_KEYS = function () {
    return (N().Ae || []).map(function (a) {
      return a[0];
    });
  };
  var PERSON = [
    [/(?:^|[^а-яa-z0-9])санировал[а-яёa-z0-9_]*\s+(трубку|этт|тбд|трахею)/gi, "проведена санация ТБД"],
    [/(?:^|[^а-яa-z0-9])санировал[а-яёa-z0-9_]*/gi, "проведена санация"],
    [/(?:^|[^а-яa-z0-9])интубировал[а-яёa-z0-9_]*/gi, "интубирован"],
    [/(?:^|[^а-яa-z0-9])экстубировал[а-яёa-z0-9_]*/gi, "экстубирован"],
    [/(?:^|[^а-яa-z0-9])ввел[а-яёa-z0-9_]*|(?:^|[^а-яa-z0-9])ввёл[а-яёa-z0-9_]*/gi, "введено"],
    [/(?:^|[^а-яa-z0-9])поставил[а-яёa-z0-9_]*/gi, "установлен"],
    [/(?:^|[^а-яa-z0-9])получил[а-яёa-z0-9_]*/gi, "получено"],
    [
      /(?:^|[^а-яa-z0-9])поднял[а-яёa-z0-9_]*|(?:^|[^а-яa-z0-9])повысил[а-яёa-z0-9_]*|(?:^|[^а-яa-z0-9])увеличил[а-яёa-z0-9_]*/gi,
      "увеличен",
    ],
    [/(?:^|[^а-яa-z0-9])снизил[а-яёa-z0-9_]*|(?:^|[^а-яa-z0-9])уменьшил[а-яёa-z0-9_]*/gi, "снижен"],
    [/(?:^|[^а-яa-z0-9])отменил[а-яёa-z0-9_]*/gi, "отменено"],
    [/(?:^|[^а-яa-z0-9])начал[а-яёa-z0-9_]*/gi, "начато"],
    [/(?:^|[^а-яa-z0-9])сделал[а-яёa-z0-9_]*/gi, "выполнено"],
    [/(?:^|[^а-яa-z0-9])перевел[а-яёa-z0-9_]*|(?:^|[^а-яa-z0-9])перевёл[а-яёa-z0-9_]*/gi, "переведён"],
    [/(?:^|[^а-яa-z0-9])взял[а-яёa-z0-9_]*/gi, "взято"],
    [/(?:^|[^а-яa-z0-9])осмотрел[а-яёa-z0-9_]*/gi, "осмотрен"],
  ];
  var third = function (s) {
    var r = " " + String(s);
    PERSON.forEach(function (p) {
      r = r.replace(p[0], function (m) {
        return (/^[^а-яa-zё0-9]/i.test(m) ? m.charAt(0) : "") + p[1];
      });
    });
    return r.replace(/получено\s+([а-яё]+?)ую\s+([а-яё]+?)у(?![а-яё])/gi, "получена $1ая $2а").trim();
  };
  var TIME =
    /(?:^|[\s,(])(?:в|во|около|к|с)?\s*(\d{1,2})[:.](\d{2})(?!\d)|(?:^|[\s,])(?:в|во|около|к)\s+(\d{1,2})\s*(?:час[а-яёa-z0-9_]*)?\s*(утра|вечера|ночи|дня)(?![а-яa-z0-9])|(?:^|[\s,])(?:в|во|около|к)\s+(\d{1,2})\s+час[а-яёa-z0-9_]*/i;
  function clauseTime(c) {
    var m = TIME.exec(c);
    if (!m) return null;
    var h,
      mi = "00";
    if (m[1] != null) {
      h = +m[1];
      mi = m[2];
    } else if (m[3] != null) {
      h = +m[3];
      var p = low(m[4]);
      if ((p === "вечера" || p === "дня") && h < 12) h += 12;
      if (p === "ночи" && h === 12) h = 0;
    } else {
      h = +m[5];
    }
    if (h > 23 || +mi > 59) return null;
    return { t: ("0" + h).slice(-2) + ":" + mi, raw: m[0] };
  }
  var STOP =
    /^(утром|вечером|ночью|днем|сейчас|сегодня|около|примерно|раз|мл|по|на|и|в|с|до|за|при|был|была|было|стал|стала|потом|затем|также|еще|уже|время|сутки|сут)$/;
  function meaningful(s) {
    return (
      low(s)
        .replace(/[^а-яa-z\s]/g, " ")
        .split(/\s+/)
        .filter(function (w) {
          return w.length >= 3 && !STOP.test(w);
        }).length >= 2
    );
  }
  function dayNumbers(text, withEvents) {
    var pi = N().pi,
      res = { day: {}, vitals: [], events: [], unclear: [], notes: [] };
    if (!pi) return res;
    var put = function (it, slotVit) {
      if (it.status === "bad" || it.status === "miss" || it.status === "ask") {
        res.unclear.push(it.label + ": " + (it.shown || it.value) + " — проверьте значение");
        return;
      }
      if (it.kind === "vit" || it.kind === "bp") {
        slotVit[it.k] = String(it.value);
        return;
      }
      if (it.kind === "day") res.day[it.k] = String(it.value);
      else if (it.kind === "vent") {
        res.day.vent = res.day.vent || {};
        res.day.vent[it.k] = String(it.value);
      } else if (it.kind === "sup") res.day.sup = it.value;
      else if (it.kind === "mode") res.day.mode = it.value;
      else if (it.kind === "cond") res.day.cond = it.value;
    };
    var clauses = String(text || "")
      .split(/(?:[.;!?](?=\s|$))|\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    var sup = "";
    clauses.forEach(function (c) {
      var tm = clauseTime(c),
        body = tm
          ? c
              .replace(tm.raw, " ")
              .replace(/^\s*[,–—-]?\s*/, "")
              .trim()
          : c;
      var r;
      try {
        r = pi(body, { sup: sup });
      } catch (e) {
        r = { items: [], rest: [] };
      }
      var vit = {};
      (r.items || []).forEach(function (it) {
        put(it, vit);
      });
      if (res.day.sup) sup = res.day.sup;
      if (Object.keys(vit).length) {
        vit.time = tm ? tm.t : "";
        res.vitals.push(vit);
      }
      if (!withEvents) return;
      var restTxt = (r.rest || [])
        .map(function (q) {
          return q.text;
        })
        .filter(function (q) {
          return low(q)
            .replace(/[^а-яa-z\s]/g, " ")
            .split(/\s+/)
            .some(function (w) {
              return w.length >= 3 && !STOP.test(w);
            });
        })
        .join(", ");
      var hasItems = (r.items || []).length > 0,
        narrative = hasItems ? meaningful(restTxt) : meaningful(body);
      if (!narrative) return;
      var L = low(body),
        key = "";
      for (var i = 0; i < EVK.length; i++)
        if (EVK[i][1].test(L) && EV_KEYS().indexOf(EVK[i][0]) >= 0) {
          key = EVK[i][0];
          break;
        }
      if (tm || key) res.events.push({ time: tm ? tm.t : "", key: key, text: dot(third(body)) });
      else res.notes.push(dot(third(hasItems ? restTxt : body)));
    });
    if (res.notes.length) res.day.summary = res.notes.join(" ");
    if (!Object.keys(res.day).length) res.day = null;
    return res;
  }
  function parseDay(text) {
    var d = dayNumbers(text, true);
    return { day: d.day || {}, vitals: d.vitals, events: d.events, unclear: d.unclear, fixes: [] };
  }

  /* ---------- приведение ответа ИИ к отметкам (и для локального разбора) ---------- */
  window.__neoPre = function (e, t) {
    if (!e || typeof e !== "object") return e;
    var a = e.adm;
    if (!a) return e;
    var x = e._x || (e._x = []),
      have = {};
    x.forEach(function (it) {
      have[it.path.join("|")] = 1;
    });
    var add = function (path, lab, shown, on) {
      if (have[path.join("|")]) return;
      have[path.join("|")] = 1;
      x.push({ grp: "Отметки в карте", label: lab, path: path, value: "1", shown: shown, on: on !== false });
    };
    if (a.preg) {
      var r = matchList(a.preg, PG);
      r.hits.forEach(function (h) {
        add(["pg", h[0], h[1] || ""], "Течение беременности", label(PG, h[0]) + triTxt(h[1]));
      });
      if (r.hits.length) {
        if (r.rest.length) a.preg = r.rest.join(", ");
        else delete a.preg;
      } else if (/^\s*(без особенностей|без осложнений|протекала без осложнений|не осложнена)\.?\s*$/i.test(a.preg)) {
        add(["pgok"], "Течение беременности", "без особенностей");
        delete a.preg;
      }
    }
    if (a.steroids) {
      var s = steroid("стероиды " + a.steroids);
      if (s && s[1]) {
        add(
          ["st", s[0]],
          "Антенатальные стероиды",
          { full: "полный курс", part: "неполный курс", none: "не проводилась" }[s[0]],
        );
        delete a.steroids;
      }
    }
    if (a.complaints) {
      var c = matchList(a.complaints, CMP);
      c.hits.forEach(function (h) {
        add(["cmp", h[0]], "Жалобы при поступлении", label(CMP, h[0]));
      });
      if (c.hits.length) {
        if (c.rest.length) a.complaints = c.rest.join(", ");
        else delete a.complaints;
      }
    }
    if (a.from) {
      var lf = low(a.from);
      for (var i = 0; i < FROM.length; i++)
        if (FROM[i][1].test(lf) || lf.indexOf(FROM[i][0]) >= 0) {
          a.from = FROM[i][0];
          break;
        }
    }
    if (a.water) {
      var lw = low(a.water);
      for (i = 0; i < WATER.length; i++)
        if (WATER[i][1].test(lw)) {
          a.water = WATER[i][0];
          break;
        }
    }
    return e;
  };

  /* ---------- фото документа (нужен ключ ИИ) ---------- */
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var img = new Image(),
        url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)),
          c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        bad(new Error("Не удалось открыть фото."));
      };
      img.src = url;
    });
  }
  var PHOTO_RULE =
    "\n\nСейчас вместо диктовки — ФОТО документа (обменная карта, выписка, история родов, лист наблюдения; может быть рукописным). Извлеки из него данные по тем же правилам: только то, что написано. Неразборчивое не угадывай — спроси в unclear. Фамилии, имена, ИИН, адреса и телефоны не переносить.";
  async function vision(o) {
    var n = N(),
      prov = n.prov && n.prov(),
      key = n.key && n.key();
    if (!prov || !key)
      throw new Error(
        "Фото разбирает ИИ — нужен ключ (Профиль → Голосовой помощник). Без ключа: нажмите в поле текста и удерживайте → «Сканировать текст», наведите камеру на карту — текст вставится сам.",
      );
    var ctx = n.ctx(o.kid, o.date, o.state, o.tab) + (o.text ? "\n\nДополнение врача:\n«" + o.text + "»" : "");
    if (prov === "gemini") {
      var body = {
        systemInstruction: {
          parts: [
            {
              text:
                n.sys +
                PHOTO_RULE +
                "\n\nОтветь ТОЛЬКО одним JSON-объектом строго по схеме (поля, которых нет, не включай):\n" +
                JSON.stringify(n.tool.input_schema),
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: o.img
              .map(function (d) {
                return { inline_data: { mime_type: "image/jpeg", data: d } };
              })
              .concat([{ text: ctx }]),
          },
        ],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 },
      };
      var r;
      try {
        r = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(n.model()) +
            ":generateContent",
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify(body),
          },
        );
      } catch (e) {
        throw new Error("Нет связи с сервером ИИ. Проверьте интернет.");
      }
      var j = await r.json().catch(function () {
        return {};
      });
      if (!r.ok) throw new Error("Ошибка Gemini: " + ((j.error && j.error.message) || r.status));
      var t = ((((j.candidates || [])[0] || {}).content || {}).parts || [])
        .filter(function (p) {
          return p.text && !p.thought;
        })
        .map(function (p) {
          return p.text;
        })
        .join("")
        .trim()
        .replace(/^```(?:json)?\s*|\s*```$/g, "");
      try {
        return JSON.parse(t);
      } catch (e) {
        var a = t.indexOf("{"),
          b = t.lastIndexOf("}");
        if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
        throw new Error("ИИ вернул непонятный ответ. Попробуйте ещё раз.");
      }
    }
    var req = {
      model: n.model(),
      max_tokens: 4000,
      system: n.sys + PHOTO_RULE,
      tools: [n.tool],
      tool_choice: { type: "tool", name: "fill_chart" },
      messages: [
        {
          role: "user",
          content: o.img
            .map(function (d) {
              return { type: "image", source: { type: "base64", media_type: "image/jpeg", data: d } };
            })
            .concat([{ type: "text", text: ctx }]),
        },
      ],
    };
    var rr;
    try {
      rr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(req),
      });
    } catch (e) {
      throw new Error("Нет связи с сервером ИИ. Проверьте интернет.");
    }
    var jj = await rr.json().catch(function () {
      return {};
    });
    if (!rr.ok) {
      var msg = (jj.error && jj.error.message) || "";
      throw new Error(
        rr.status === 401
          ? "Ключ ИИ не подошёл. Проверьте его в Профиле."
          : rr.status === 429
            ? "Слишком много запросов, подождите минуту."
            : "Ошибка ИИ: " + (msg || rr.status),
      );
    }
    var tu = (jj.content || []).find(function (c) {
      return c.type === "tool_use";
    });
    if (!tu) throw new Error("ИИ не вернул разбор. Попробуйте ещё раз.");
    return tu.input || {};
  }

  /* ---------- точка входа из окна помощника ---------- */
  window.__neoKi = async function (o) {
    if (o.img && o.img.length) return vision(o);
    var n = N();
    if (n.me && n.me()) return null; // ключ есть — работает ИИ, как раньше
    var out = o.tab === "adm" ? parseAdm(o.text) : parseDay(o.text);
    var nt = document.getElementById("qiNote");
    if (nt)
      nt.innerHTML = '<p class="meta">Разобрано на телефоне, без ИИ. Проверьте строки и снимите галочки с лишнего.</p>';
    return out;
  };
  window.__neoLocal = { adm: parseAdm, day: parseDay };

  /* ---------- окно помощника: фото и вставка ---------- */
  function enhanceSheet(sh) {
    if (sh.__qi) return;
    sh.__qi = 1;
    var act = sh.querySelector(".actions");
    if (!act) return;
    var bar = document.createElement("div");
    bar.className = "actions qi-row";
    bar.innerHTML =
      '<button type="button" class="btn ghost" id="qiPaste">📋 Вставить</button><button type="button" class="btn ghost" id="qiPhoto">📷 Фото документа</button><input type="file" accept="image/*" multiple id="qiFile" hidden>';
    act.parentNode.insertBefore(bar, act);
    var note = document.createElement("div");
    note.id = "qiNote";
    bar.parentNode.insertBefore(note, bar.nextSibling);
    var ta = sh.querySelector("#atxt"),
      file = bar.querySelector("#qiFile");
    bar.querySelector("#qiPaste").addEventListener("click", async function () {
      try {
        var t = await navigator.clipboard.readText();
        if (t) {
          ta.value = (ta.value.replace(/\s*$/, "") + (ta.value.trim() ? "\n" : "") + t).trim();
          ta.dispatchEvent(new Event("input"));
          note.innerHTML = '<p class="meta">Вставлено. Нажмите «Составить запись».</p>';
        }
      } catch (e) {
        note.innerHTML = '<p class="meta">Нажмите в поле и удерживайте → «Вставить».</p>';
        ta.focus();
      }
    });
    bar.querySelector("#qiPhoto").addEventListener("click", function () {
      var n = N();
      if (!(n.me && n.me())) {
        note.innerHTML =
          '<div class="pill info qi-hint"><b>Без ключа ИИ фото читает сам iPhone:</b> нажмите в поле рассказа и удерживайте → «Сканировать текст» (значок рамки с текстом), наведите камеру на обменную карту и нажмите «Вставить». Потом «Составить запись». <br>С ключом ИИ (Профиль → Голосовой помощник) эта кнопка сразу отправляет фото на разбор, даже рукописное.</div>';
        ta.focus();
        return;
      }
      file.click();
    });
    file.addEventListener("change", async function () {
      var fs = [].slice.call(file.files || [], 0, 3);
      file.value = "";
      if (!fs.length) return;
      note.innerHTML = '<p class="meta">Готовлю фото…</p>';
      try {
        sh.__img = await Promise.all(fs.map(shrink));
      } catch (e) {
        note.innerHTML = '<p class="pill warn">' + esc(e.message) + "</p>";
        return;
      }
      note.innerHTML =
        '<p class="meta">Фото: ' + sh.__img.length + " шт. Закройте ФИО и ИИН — они не нужны. Разбираю…</p>";
      var go = sh.querySelector("#ago");
      go && go.click();
      setTimeout(function () {
        sh.__img = null;
      }, 500);
    });
  }

  /* ---------- мать и роды как у близнеца ---------- */
  var ADM_M = [
    "mAge",
    "gr",
    "par",
    "prev",
    "preg",
    "pregOk",
    "pregTxt",
    "ster",
    "mBlood",
    "sero",
    "mode",
    "csInd",
    "water",
  ];
  function copyMother(src, dst) {
    dst.adm = dst.adm || {};
    dst.cs = dst.cs || {};
    var sa = src.adm || {},
      sc = src.cs || {};
    ADM_M.forEach(function (k) {
      if (sa[k] !== undefined) dst.adm[k] = JSON.parse(JSON.stringify(sa[k]));
    });
    Object.keys(sc).forEach(function (k) {
      if (/^m_/.test(k) || ["prom", "mec", "cs", "spont"].indexOf(k) >= 0) dst.cs[k] = sc[k];
    });
    [src, dst].forEach(function (k) {
      k.adm = k.adm || {};
      (k.adm.preg = k.adm.preg || {}).twin = true;
      delete k.adm.pregOk;
    });
  }
  function twinBar() {
    var n = N();
    if (!n.kids || !/^#kid-/.test(location.hash)) return;
    var h = [].slice.call(document.querySelectorAll(".kcard h3")).find(function (x) {
      return x.textContent.trim() === "Мать и беременность";
    });
    if (!h || h.parentNode.querySelector(".qi-twin")) return;
    var id = location.hash.slice(5),
      kids = n.kids() || [],
      me = kids.find(function (k) {
        return k.id === id;
      });
    if (!me) return;
    var day = 864e5,
      t0 = new Date(me.bd + "T00:00:00").getTime();
    var mins = function (k) {
      var m = /^(\d{1,2}):(\d{2})/.exec(k.bt || "");
      return m ? new Date(k.bd + "T00:00:00").getTime() / 6e4 + +m[1] * 60 + +m[2] : null;
    };
    var isTw = function (k) {
      return !!((k.adm || {}).preg || {}).twin;
    };
    var sib = kids.filter(function (k) {
      if (k.id === id || !k.bd || k.out || Math.abs(new Date(k.bd + "T00:00:00").getTime() - t0) > day) return false;
      var a = mins(me),
        b = mins(k);
      return isTw(k) || isTw(me) || a == null || b == null || Math.abs(a - b) <= 120;
    });
    if (!sib.length) return;
    var d = document.createElement("div");
    d.className = "qi-twin";
    d.innerHTML =
      "<span>👶👶 Двойня? Мать и роды — как у:</span>" +
      sib
        .map(function (k) {
          return '<button type="button" class="btn ghost" data-twin="' + esc(k.id) + '">' + esc(k.label) + "</button>";
        })
        .join("");
    h.parentNode.insertBefore(d, h.nextSibling);
    d.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-twin]");
      if (!b) return;
      var all = n.kids(),
        src = all.find(function (k) {
          return k.id === b.dataset.twin;
        }),
        dst = all.find(function (k) {
          return k.id === id;
        });
      if (!src || !dst) return;
      copyMother(src, dst);
      n.save(src);
      n.save(dst);
      n.at ? n.at(id) : location.reload();
      var t = document.createElement("div");
      t.className = "vundo";
      t.innerHTML =
        "<span>Мать, беременность и роды взяты из «" +
        esc(src.label) +
        "». Апгар и родзал — заполните для этого ребёнка.</span>";
      document.body.appendChild(t);
      setTimeout(function () {
        t.remove();
      }, 6000);
    });
  }

  /* ---------- кнопка помощника под большим пальцем ---------- */
  function fab() {
    var on =
      /^#kid-/.test(location.hash) &&
      document.getElementById("aiopen") &&
      !document.getElementById("ash") &&
      !document.getElementById("vsh");
    var f = document.getElementById("qiFab");
    if (!on) {
      if (f) f.remove();
      return;
    }
    if (f) return;
    f = document.createElement("button");
    f.id = "qiFab";
    f.type = "button";
    f.setAttribute("aria-label", "Рассказать голосом");
    f.textContent = "🎙";
    f.addEventListener("click", function () {
      var b = document.getElementById("aiopen");
      b && b.click();
    });
    document.body.appendChild(f);
  }

  function tick() {
    var sh = document.getElementById("ash");
    if (sh) enhanceSheet(sh);
    twinBar();
    fab();
  }
  var st = document.createElement("style");
  st.textContent =
    ".qi-row{flex-wrap:wrap;margin:6px 0 2px}.qi-row .btn{flex:1 1 40%}.qi-hint{display:block;line-height:1.45;margin:8px 0;white-space:normal}" +
    ".qi-twin{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 12px;padding:10px 12px;border-radius:12px;background:var(--accent-soft,#e6f4f6)}.qi-twin span{font-weight:600;width:100%}.qi-twin .btn{padding:8px 14px;min-height:0}" +
    "#qiFab{position:fixed;right:16px;bottom:calc(150px + env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;border:0;font-size:28px;z-index:40;background:var(--accent,#1b8aa0);color:var(--on-accent,#fff);box-shadow:0 6px 18px rgba(0,0,0,.25)}" +
    "body.vopen #qiFab{display:none}";
  document.head.appendChild(st);
  new MutationObserver(function () {
    clearTimeout(tick._t);
    tick._t = setTimeout(tick, 60);
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", function () {
    setTimeout(tick, 150);
  });
  setTimeout(tick, 400);
})();
