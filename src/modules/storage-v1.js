/* storage-v1: проверяемая резервная копия, ступенчатое восстановление с журналом и откатом, миграция схемы.
   Принципы: (1) ничего не меняем, пока файл не прошёл проверку; (2) перед изменением — снимок текущей базы с проверкой чтением;
   (3) прерывание на любом шаге → после перезапуска база возвращается к снимку (байт в байт) либо уже полностью новая;
   (4) одинаковый event_id не дублируется, тот же id с другим содержимым не перезаписывается молча (конфликт);
   (5) совпадение койки не основание для слияния — только устойчивый id пациента. Старую базу не удаляем. */
(function () {
  var APP = "neo-pro", VER = 2, P = "neo.";
  var DATA = ["kids", "kidsDel", "team", "teamT"];            // ключи базы (без префикса)
  var J = P + "restore.journal", SNAP = P + "restore.snap", STAGE = P + "restore.stage", LAST = P + "bak.last", CONF = P + "conflicts";

  var ls = function () { return window.localStorage; };
  function get(k) { try { return ls().getItem(k); } catch (e) { return null; } }
  function set(k, v) { ls().setItem(k, v); if (ls().getItem(k) !== v) throw new Error("verify:" + k); }   // запись с проверкой чтением
  function del(k) { try { ls().removeItem(k); } catch (e) { } }
  function step(name) { var f = window.__neoStoreFault; if (f && f === name) { var e = new Error("crash:" + name); e.crash = true; throw e; } }
  function parse(s, d) { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } }

  function sha(str) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  function snapshotRaw() { var o = {}; DATA.forEach(function (k) { var v = get(P + k); if (v !== null) o[k] = v; }); return o; }    // сырые строки, как лежат
  function dbString() { return JSON.stringify(snapshotRaw()); }
  function dbSha() { return sha(dbString()); }

  /* ---------- резервная копия ---------- */
  function buildBackup() {
    var payload = JSON.stringify({ kids: parse(get(P + "kids"), []), del: parse(get(P + "kidsDel"), {}), team: parse(get(P + "team"), null), teamT: parse(get(P + "teamT"), 0) });
    return sha(payload).then(function (sum) { return JSON.stringify({ app: APP, v: VER, saved: new Date().toISOString(), sum: sum, payload: payload }); });
  }
  /* Проверка до любых изменений. Возвращает {ok, reason, data, legacy}. */
  function verify(text) {
    var f; try { f = JSON.parse(text); } catch (e) { return Promise.resolve({ ok: false, reason: "truncated_or_not_json" }); }
    if (!f || typeof f !== "object") return Promise.resolve({ ok: false, reason: "not_object" });
    if (f.app && f.app !== APP) return Promise.resolve({ ok: false, reason: "wrong_app" });
    if (f.v === 1 && Array.isArray(f.kids)) {      // старый формат без суммы: принимаем структурно, помечаем legacy
      if (!f.kids.every(function (k) { return k && typeof k.id === "string" && k.id; })) return Promise.resolve({ ok: false, reason: "bad_kid" });
      return Promise.resolve({ ok: true, legacy: true, data: { kids: f.kids, del: f.del || {}, team: f.team || null, teamT: f.teamT || 0 } });
    }
    if (f.v !== VER) return Promise.resolve({ ok: false, reason: "unknown_schema_version" });
    if (typeof f.payload !== "string" || typeof f.sum !== "string") return Promise.resolve({ ok: false, reason: "missing_fields" });
    return sha(f.payload).then(function (s) {
      if (s !== f.sum) return { ok: false, reason: "checksum_mismatch" };
      var d = parse(f.payload, null);
      if (!d || !Array.isArray(d.kids) || !d.kids.every(function (k) { return k && typeof k.id === "string" && k.id; })) return { ok: false, reason: "bad_payload" };
      return { ok: true, data: d };
    });
  }

  /* ---------- слияние ---------- */
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function mergeList(local, incoming, kind, kid, rep) {
    var out = (local || []).slice(), idx = {}; out.forEach(function (x) { if (x && x.id) idx[x.id] = x; });
    (incoming || []).forEach(function (x) {
      if (!x || !x.id) { out.push(x); return; }
      var ex = idx[x.id];
      if (!ex) { out.push(x); idx[x.id] = x; rep.events++; return; }
      if (same(ex, x)) { rep.skipped++; return; }
      rep.conflicts.push({ kind: kind, kid: kid, id: x.id, local: ex, incoming: x });   // местное не перезаписываем
    });
    return out;
  }
  function merge(localKids, incoming) {
    var rep = { added: 0, events: 0, skipped: 0, conflicts: [], bedClash: [] }, out = (localKids || []).slice(), byId = {};
    out.forEach(function (k) { byId[k.id] = k; });
    (incoming || []).forEach(function (k) {
      var ex = byId[k.id];
      if (!ex) {
        var clash = out.filter(function (o) { return o.label && k.label && o.label === k.label; })[0];
        if (clash) rep.bedClash.push({ incoming: k.id, local: clash.id, label: k.label });   // койка занята другим пациентом — не сливаем
        out.push(k); byId[k.id] = k; rep.added++; return;
      }
      var m = Object.assign({}, ex);
      ["log", "fluid"].forEach(function (f) { if ((k[f] || []).length) m[f] = mergeList(ex[f], k[f], f, k.id, rep); });
      out[out.indexOf(ex)] = m; byId[k.id] = m;
    });
    return { kids: out, rep: rep };
  }

  /* ---------- восстановление ---------- */
  function applyDb(raw) { DATA.forEach(function (k) { if (raw[k] === undefined) del(P + k); else set(P + k, raw[k]); }); }
  function restore(data) {
    var before, plan;
    return dbSha().then(function (h) {
      before = h;
      var raw = snapshotRaw(), m = merge(parse(raw.kids, []), data.kids), del0 = parse(raw.kidsDel, {}), next = Object.assign({}, raw);
      next.kids = JSON.stringify(m.kids);
      var d2 = Object.assign({}, del0); Object.keys(data.del || {}).forEach(function (k) { d2[k] = Math.max(d2[k] || 0, data.del[k]); });
      next.kidsDel = JSON.stringify(d2);
      if (data.team && !(parse(raw.team, null) || {}).me) { next.team = JSON.stringify(data.team); next.teamT = JSON.stringify(data.teamT || 0); }
      plan = { raw: raw, next: next, rep: m.rep };
      set(SNAP, JSON.stringify(raw));                                  // 1. снимок текущей базы
      step("after-snapshot");
      set(J, JSON.stringify({ state: "staged", t: Date.now(), before: h }));   // 2. журнал
      step("after-journal");
      set(STAGE, JSON.stringify(next));                                // 3. результат на «чистовике»
      step("after-stage");
      set(J, JSON.stringify({ state: "commit", t: Date.now(), before: h }));   // 4. фиксируем начало записи
      step("after-commit-marker");
      set(P + "kids", next.kids);                                      // 5. запись в базу
      step("mid-commit");
      applyDb(next);
      step("after-commit");
      return dbSha();
    }).then(function (after) {
      var exp = JSON.stringify(plan.next);
      if (JSON.stringify(snapshotRaw()) !== exp) throw new Error("verify:commit");   // 6. проверка записанного
      set(J, JSON.stringify({ state: "done", before: before, after: after }));
      step("after-verify");
      try { set(LAST, JSON.stringify(plan.raw)); } catch (e) { }       // копия «до восстановления» (если есть место)
      del(STAGE); del(SNAP); del(J);
      if (plan.rep.conflicts.length) { try { set(CONF, JSON.stringify((parse(get(CONF), [])).concat(plan.rep.conflicts))); } catch (e) { } }
      return { ok: true, rep: plan.rep, before: before, after: after };
    }).catch(function (e) {
      if (e && e.crash) throw e;                                       // «обрыв процесса»: откат сделает recover() после перезапуска
      try { rollback(); } catch (x) { }
      return { ok: false, reason: String(e && e.message || e) };
    });
  }
  function rollback() {
    var s = parse(get(SNAP), null); if (!s) { del(J); del(STAGE); return false; }
    applyDb(s); del(STAGE); del(SNAP); del(J); return true;
  }
  /* Вызывается при запуске: незавершённое восстановление откатывается к снимку; завершённое — только чистится. */
  function recover() {
    var j = parse(get(J), null); if (!j) { del(STAGE); del(SNAP); return { state: "clean" }; }
    if (j.state === "done") { del(STAGE); del(SNAP); del(J); return { state: "finished" }; }
    var ok = rollback(); return { state: ok ? "rolled_back" : "cleared" };
  }

  /* ---------- миграция схемы 1 → 2 (устойчивый pid) ---------- */
  function migrate() {
    var cur = get(P + "schema"); if (cur === String(VER)) return { ok: true, already: true };
    var raw = get(P + "kids"), kids = parse(raw, []);
    try {
      if (raw !== null) set(P + "mig.v1copy", raw);                    // страховочная копия старых данных (не удаляется)
      var out = kids.map(function (k) { return k.pid ? k : Object.assign({}, k, { pid: k.id }); });
      if (!same(out, kids)) set(P + "kids", JSON.stringify(out));
      set(P + "schema", String(VER));                                  // успех — только после проверенной записи
      return { ok: true, migrated: kids.length };
    } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }   // база не тронута, повтор безопасен
  }

  window.__neoStore = { buildBackup: buildBackup, verify: verify, restore: restore, recover: recover, migrate: migrate, merge: merge, dbSha: dbSha, VER: VER };
  try { window.__neoStoreBoot = recover(); } catch (e) { window.__neoStoreBoot = { state: "error" }; }
  try { window.__neoStoreMig = migrate(); } catch (e) { window.__neoStoreMig = { ok: false }; }
})();
