import { planFor, applySession, summarizeItem, estimateMinutes, acwr, streak } from '../js/progression.js';
import { PROGRAMS, TRACKS, EXERCISES } from '../js/data.js';

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const today = new Date().toISOString().slice(0, 10);

const mkState = (over = {}) => ({
  settings: { programId: 'daily_min', startDate: today, bells: [16,24,32], timeBudget: 25,
              warmup: true, cooldown: true, tgu: false, ...(over.settings || {}) },
  progress: Object.fromEntries(Object.keys(EXERCISES).filter(k => EXERCISES[k].kind !== 'mobility')
            .map(k => [k, { weight: 16, step: over.step ?? 0, wins: 0, fails: 0 }])),
  sessions: [], tests: []
});

console.log('\n=== 1. Раскладка подходов ===');
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  for (let d = 0; d < prog.days.length; d++) {
    for (const step of [0, 3, 8, 11]) {
      const st = mkState({ settings: { programId: pid }, step });
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      for (const it of p.items) {
        const L = it.sets.filter(s => s.side === 'L').length;
        const R = it.sets.filter(s => s.side === 'R').length;
        ok(L === R, `${pid}/день${d}/шаг${step} ${it.exId}: стороны разъехались L=${L} R=${R}`);
        ok(it.sets.length > 0, `${pid}/день${d} ${it.exId}: пустой список подходов`);
        ok(it.sets.every(s => s.weight > 0), `${pid} ${it.exId}: подход без веса`);
      }
    }
  }
}
console.log(`  проверено ${checks}, провалов ${fails}`);

console.log('\n=== 2. Пары: каждый подход виден ровно один раз ===');
let pairChecks = 0;
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  for (let d = 0; d < prog.days.length; d++) {
    for (const budget of [15, 20, 25, 30]) {
      for (const step of [0, 5, 11]) {
        const st = mkState({ settings: { programId: pid, timeBudget: budget }, step });
        const p = planFor(st, today, null, d);
        if (p.isRest) continue;
        for (const pr of p.pairs) {
          pairChecks++;
          const a = p.items[pr.a], b = p.items[pr.b];
          const seenA = pr.order.filter(o => o.side === 'a').map(o => o.idx).sort((x,y)=>x-y);
          const seenB = pr.order.filter(o => o.side === 'b').map(o => o.idx).sort((x,y)=>x-y);
          ok(seenA.length === a.sets.length && new Set(seenA).size === a.sets.length,
             `${pid}/д${d}/${budget}мин: ${a.exId} показано ${seenA.length} из ${a.sets.length} подходов`);
          ok(seenB.length === b.sets.length && new Set(seenB).size === b.sets.length,
             `${pid}/д${d}/${budget}мин: ${b.exId} показано ${seenB.length} из ${b.sets.length} подходов`);
          ok(seenA.every((v,i) => v === i), `${pid}: индексы ${a.exId} не подряд`);
        }
      }
    }
  }
}
console.log(`  пар проверено: ${pairChecks}, всего проверок ${checks}, провалов ${fails}`);

console.log('\n=== 3. Бюджет времени соблюдается ===');
for (const [pid] of Object.entries(PROGRAMS)) {
  for (const budget of [15, 20, 25, 30, 45]) {
    for (const step of [0, 5, 11]) {
      const st = mkState({ settings: { programId: pid, timeBudget: budget }, step });
      for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
        const p = planFor(st, today, null, d);
        if (p.isRest) continue;
        const est = estimateMinutes(p);
        ok(est <= budget || p.overBudget,
           `${pid}/д${d}/бюджет${budget}/шаг${step}: ${est} мин и флаг overBudget не выставлен`);
        ok(p.estimate === est, `${pid}: plan.estimate=${p.estimate} расходится с пересчётом ${est}`);
      }
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log('\n=== 4. Отдых не проваливается ниже пола ===');
const FLOOR = { ballistic: 30, ladder: 45, reps: 45, time: 30 };
for (const [pid] of Object.entries(PROGRAMS)) {
  for (const budget of [15, 20, 25]) {
    const st = mkState({ settings: { programId: pid, timeBudget: budget }, step: 8 });
    for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      p.items.forEach((it, i) => {
        if (p.pairs.some(pr => pr.a === i || pr.b === i)) return;
        if (it.emom) return;
        const f = FLOOR[it.kind] ?? 45;
        ok(it.rest >= f, `${pid}/д${d}/${budget}мин: ${it.exId} отдых ${it.rest} < пола ${f}`);
      });
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log('\n=== 5. Прогрессия ===');
{
  const st = mkState();
  st.progress.swing_1h = { weight: 24, step: 0, wins: 0, fails: 0 };
  const good = { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 7 }] };
  applySession(st, good);
  ok(st.progress.swing_1h.step === 0 && st.progress.swing_1h.wins === 1, 'одна удачная не должна двигать шаг');
  applySession(st, good);
  ok(st.progress.swing_1h.step === 1, 'две удачных должны дать шаг вперёд');

  const st2 = mkState();
  st2.progress.swing_1h = { weight: 24, step: 8, wins: 1, fails: 0 };
  applySession(st2, good);
  ok(st2.progress.swing_1h.weight === 32 && st2.progress.swing_1h.step === TRACKS.swing_vol.reset,
     `с последнего шага должен быть переход на 32 кг, получили ${st2.progress.swing_1h.weight}/шаг ${st2.progress.swing_1h.step}`);

  const st3 = mkState();
  st3.progress.swing_1h = { weight: 24, step: 4, wins: 1, fails: 0 };
  applySession(st3, { deload: true, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 6 }] });
  ok(st3.progress.swing_1h.step === 4 && st3.progress.swing_1h.wins === 1, 'на разгрузке шаг не двигается и счётчик не сбрасывается');

  const st4 = mkState();
  st4.progress.swing_1h = { weight: 24, step: 3, wins: 0, fails: 1 };
  applySession(st4, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: false, rpe: 9 }] });
  ok(st4.progress.swing_1h.step === 2, 'две неудачных должны откатить шаг');

  const st5 = mkState();
  st5.progress.swing_1h = { weight: 24, step: 2, wins: 1, fails: 0 };
  applySession(st5, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 8 }] });
  ok(st5.progress.swing_1h.wins === 1 && st5.progress.swing_1h.step === 2, 'RPE 8 — стоим на месте, счётчик не должен сбрасываться');
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log('\n=== 6. Готовность и волна ===');
{
  const st = mkState();
  const norm = planFor(st, today, { sleep: 4, soreness: 4, energy: 4 });
  const bad = planFor(st, today, { sleep: 1, soreness: 1, energy: 1 });
  const nSets = (p) => p.items.reduce((a, i) => a + i.sets.length, 0);
  ok(nSets(bad) < nSets(norm), `плохая готовность должна резать объём: ${nSets(bad)} против ${nSets(norm)}`);
  ok(nSets(bad) > 0, 'даже при худшей готовности должно остаться хоть что-то');
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log('\n=== 7. Соответствие ярлыка и фактических подходов ===');
for (const [pid] of Object.entries(PROGRAMS)) {
  for (const budget of [15, 25, 0]) {
    const st = mkState({ settings: { programId: pid, timeBudget: budget }, step: 6 });
    for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      for (const it of p.items) {
        if (it.kind === 'ballistic') {
          const n = +it.scheme.split(' × ')[0];
          ok(n === it.sets.length, `${pid}/${budget}: ярлык «${it.scheme}» против ${it.sets.length} подходов (${it.exId})`);
        }
        if (it.kind === 'time') {
          const n = +it.scheme.split(' × ')[0];
          const sides = it.sets.some(s => s.side) ? 2 : 1;
          ok(n === it.sets.length / sides, `${pid}/${budget}: ярлык «${it.scheme}» против ${it.sets.length} подходов (${it.exId})`);
        }
      }
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log(`\n${'='.repeat(50)}\nИТОГО: ${checks} проверок, ${fails} провалов`);
