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
process.exit(keptA && keptB ? 0 : 1);
