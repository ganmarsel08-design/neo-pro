// Проверяет, что все цитаты протоколов РК в карточках заболеваний дословно есть в тексте протоколов
// (data/protocols.json) или в проверенных по PDF цитатах «Антидефекта» (data/antidefect-rules.json).
// Запуск: node tools/check-quotes.js
const fs = require('fs'), path = require('path'), R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
global.window = {};
eval(R('src/modules/conds.js').replace('__KZ_DATA__', R('data/kz-protocols-meta.json')));
const C = window.__neoConds, P = JSON.parse(R('data/protocols.json')).items;
const nz = s => s.replace(/[•]/g, ' ').replace(/\s+/g, ' ').replace(/[«»"]/g, '').trim();
const T = {}; P.forEach(p => T[p.id] = nz(p.sections.map(s => s.t).join(' ')));
const RD = JSON.parse(R('data/antidefect-rules.json')), AD = nz(Object.values(RD.R).map(r => r.q.map(x => x[1]).join(' ')).join(' '));
let n = 0, bad = 0;
const bases = [{ ga: 25, dol: 5, w: 800, f: { fio2: 40, modeK: 'niv', map: 6 } }, { ga: 39, dol: 1, w: 4100, f: {} }, { ga: 30, dol: 12, w: 1400, f: { modeK: 'inv', fio2: 55 } }];
for (const d of C.list) for (const b of bases) {
  const st = d.init ? d.init('') : {}; if (d.id === 'pda') { st.clin = {}; st.ci = {}; }
  const c = d.ctx(st, b);
  for (const r of d.world(c)) for (const q of (r.q || [])) { n++; const pid = (r.s.u || '').replace('#protocol-', ''); const hay = T[pid] || Object.values(T).join(' '); if (!hay.includes(nz(q)) && !AD.includes(nz(q))) { bad++; console.log('НЕ НАЙДЕНО', d.id, pid, '::', q.slice(0, 90)); } }
  for (const t of d.tact) { d.judge(t[0], c); d.text(c, t[0]); }
}
console.log('цитат проверено', n, 'не найдено', bad, 'карточек', C.list.length);
process.exit(bad ? 1 : 0);
