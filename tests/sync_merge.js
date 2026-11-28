// Слияние облачной копии (функции из src/app.js как есть). Выход 1 — правка одного из устройств потеряна.
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'src/app.js'), 'utf8');
const a = s.indexOf('  var Jx = (e) => {'), b = s.indexOf('  var Yi = (e, t) =>');
if (a < 0 || b < 0) { console.log('Не нашёл функции слияния в src/app.js'); process.exit(2); }
eval(s.slice(a, b) + '; global.Gd = Gd;');
const base = { id: 'k1', label: 'Синтетик', days: { '2026-11-26': { note: 'утро' } }, log: [], upd: 1000 };
const A = JSON.parse(JSON.stringify(base)); A.days['2026-11-26'].slotNote = { '12:00–15:00': 'дневник A' }; A.upd = 2000;
const B = JSON.parse(JSON.stringify(base)); B.log.push({ id: 'e1', hm: '13:40', text: 'событие B' }); B.upd = 2100;
const k = Gd({ kids: [A], del: {} }, { kids: [B], del: {} }).kids[0];
const keptA = !!((k.days['2026-11-26'].slotNote || {})['12:00–15:00']), keptB = k.log.length === 1;
console.log('правка A сохранена:', keptA, '| правка B сохранена:', keptB);
if (!(keptA && keptB)) process.exit(1);

// --- сходимость и удаление (sync-events) ---
{
  const A2 = { id: 'k2', label: 'К', log: [{ id: 'e1', ts: 10, text: 'x' }, { id: 'e2', ts: 20, text: 'y' }], upd: 1000 };
  const D = JSON.parse(JSON.stringify(A2)); D.log = D.log.filter(e => e.id !== 'e1'); D.ldel = { e1: 3000 }; D.upd = 3000;   // удалено на устройстве D
  const O = JSON.parse(JSON.stringify(A2)); O.upd = 1500;                                                                    // старая копия на другом устройстве
  const m1 = Gd({ kids: [D], del: {} }, { kids: [O], del: {} }).kids[0], m2 = Gd({ kids: [O], del: {} }, { kids: [D], del: {} }).kids[0];
  if (m1.log.some(e => e.id === 'e1')) { console.log('удалённое событие воскресло'); process.exit(1); }
  if (JSON.stringify(m1) !== JSON.stringify(m2)) { console.log('слияние не коммутативно'); process.exit(1); }
  // конфликт: тот же id, разное содержимое — проигравшее не теряется, результат одинаков на обоих устройствах
  const X = { id: 'k3', label: 'К', log: [{ id: 'e1', ts: 10, text: 'версия X' }], upd: 5 }, Y = { id: 'k3', label: 'К', log: [{ id: 'e1', ts: 12, text: 'версия Y' }], upd: 6 };
  const c1 = Gd({ kids: [X], del: {} }, { kids: [Y], del: {} }).kids[0], c2 = Gd({ kids: [Y], del: {} }, { kids: [X], del: {} }).kids[0];
  if (JSON.stringify(c1) !== JSON.stringify(c2)) { console.log('конфликт: устройства расходятся'); process.exit(1); }
  if (c1.log.length !== 1 || !(c1.conf || []).some(x => x.lost && x.lost.text)) { console.log('проигравшая версия не сохранена в conf'); process.exit(1); }
  // идемпотентность
  const c3 = Gd({ kids: [c1], del: {} }, { kids: [X], del: {} }).kids[0];
  if (JSON.stringify(c3) !== JSON.stringify(c1)) { console.log('повторное слияние меняет результат'); process.exit(1); }
  console.log('сходимость, удаление, конфликт, идемпотентность: ок');
}
