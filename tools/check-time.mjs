import { estimateSeconds } from '../js/progression.js';

const mk = (kind, n, opts) => ({
  kind, name: kind, exId: opts.exId || 'x', rest: opts.rest, emom: opts.emom || null,
  sets: Array.from({length: n}, (_, i) => ({ reps: opts.reps, sec: opts.sec, side: opts.sides ? (i % 2 ? 'R' : 'L') : null }))
});
const plan = (items, pairs = [], warm = false) => ({ items, pairs, warmup: warm ? [1] : [], cooldown: [] });
const m = (s) => (s / 60).toFixed(1);

console.log('ЭТАЛОН 1 — S&S: 10×10 махов одной рукой, отдых 60 сек');
console.log('  реально по секундомеру: подход ~15-20 сек + 60 отдых → 12,5-13,5 мин');
console.log('  считает приложение:', m(estimateSeconds(plan([mk('ballistic', 10, {reps: 10, rest: 60})]))), 'мин\n');

console.log('ЭТАЛОН 2 — 10×10 махов в минутном режиме (EMOM)');
console.log('  реально: ровно 10 минут по определению');
console.log('  считает приложение:', m(estimateSeconds(plan([mk('ballistic', 10, {reps: 10, rest: 0, emom: 60})]))), 'мин\n');

console.log('ЭТАЛОН 3 — жим: 3 лестницы 1-2-3 на две стороны, отдых 60 сек');
const ladderSets = [];
for (let l = 0; l < 3; l++) for (const r of [1,2,3]) { ladderSets.push({reps:r, side:'L'}); ladderSets.push({reps:r, side:'R'}); }
const ladder = { kind:'ladder', name:'жим', exId:'clean_press', rest:60, sets: ladderSets };
console.log('  реально: 9 ступеней, работа ~12 сек на пару сторон + 60 отдых → ~11 мин');
console.log('  считает приложение:', m(estimateSeconds(plan([ladder]))), 'мин\n');

console.log('ЭТАЛОН 4 — переноска 4×45 сек, отдых 60');
console.log('  реально: 4×45 работы + 3×60 отдыха = 6 мин');
console.log('  считает приложение:', m(estimateSeconds(plan([mk('time', 4, {sec: 45, rest: 60})]))), 'мин\n');

console.log('РАЗМИНКА: приложение всегда добавляет 4,0 мин\n');

console.log('ПАРА — махи 10 подходов + жим 18 подходов, пауза 15 сек');
const pairPlan = plan([mk('ballistic', 10, {reps:10, rest:60}), ladder], [{a:0,b:1,rest:15}]);
console.log('  считает приложение:', m(estimateSeconds(pairPlan)), 'мин');
