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
const FLOOR = { ballistic: 30, ladder: 45, reps: 45, time: 30, swap: 60, interval: 120 };
for (const [pid] of Object.entries(PROGRAMS)) {
  for (const budget of [15, 20, 25]) {
    const st = mkState({ settings: { programId: pid, timeBudget: budget }, step: 8 });
    for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      p.items.forEach((it, i) => {
        if (p.pairs.some(pr => pr.a === i || pr.b === i)) return;
        if (it.emom) return;
        if (it.sets.length < 2) return;   // одному подходу отдыхать не между чем
        if (TRACKS[it.trackId]?.fixedRest) return;  // отдых задан самой программой
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
  const need = TRACKS.swing_vol.winsNeeded ?? 2;
  ok(need >= 3, 'основное движение должно требовать не меньше трёх удачных тренировок на шаг');
  for (let i = 1; i < need; i++) {
    applySession(st, good);
    ok(st.progress.swing_1h.steps.swing_vol === 0, `${i} удачных из ${need} не должны двигать шаг`);
  }
  applySession(st, good);
  ok(st.progress.swing_1h.steps.swing_vol === 1, `${need} удачных должны дать шаг вперёд`);

  const last = TRACKS.swing_vol.steps.length - 1;
  const st2 = mkState();
  st2.progress.swing_1h = { weight: 24, step: last, steps: { swing_vol: last }, wins: need - 1, fails: 0 };
  applySession(st2, good);
  ok(st2.progress.swing_1h.weight === 32 && st2.progress.swing_1h.steps.swing_vol === TRACKS.swing_vol.reset,
     `с последнего шага должен быть переход на 32 кг, получили ${st2.progress.swing_1h.weight}/шаг ${st2.progress.swing_1h.steps.swing_vol}`);

  // смена гири должна быть постепенной, а не прыжком
  const swapSteps = TRACKS.swing_vol.steps.filter(x => x.swapIn);
  ok(swapSteps.length >= 4, 'перед сменой гири должны быть ступени постепенной замены подходов');
  ok(swapSteps[swapSteps.length - 1].swapIn === 10, 'последняя ступень замены должна переводить все подходы на новый вес');

  const st3 = mkState();
  st3.progress.swing_1h = { weight: 24, step: 4, steps: { swing_vol: 4 }, wins: 1, fails: 0 };
  applySession(st3, { deload: true, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 6 }] });
  ok(st3.progress.swing_1h.steps.swing_vol === 4 && st3.progress.swing_1h.wins === 1, 'на разгрузке шаг не двигается и счётчик не сбрасывается');

  const st4 = mkState();
  st4.progress.swing_1h = { weight: 24, step: 3, steps: { swing_vol: 3 }, wins: 0, fails: 1 };
  applySession(st4, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: false, rpe: 9 }] });
  ok(st4.progress.swing_1h.steps.swing_vol === 2, 'две неудачных должны откатить шаг');

  const st5 = mkState();
  st5.progress.swing_1h = { weight: 24, step: 2, steps: { swing_vol: 2 }, wins: 1, fails: 0 };
  applySession(st5, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 8 }] });
  ok(st5.progress.swing_1h.wins === 1 && st5.progress.swing_1h.steps.swing_vol === 2, 'RPE 8 — стоим на месте, счётчик не должен сбрасываться');
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

console.log('\n=== 8. Пол отдыха действует и внутри пар ===');
{
  const { pairRealRest } = await import('../js/progression.js');
  const F = { ballistic: 30, reps: 45, time: 30, swap: 60, interval: 120 };
  for (const [pid] of Object.entries(PROGRAMS)) {
    for (const budget of [15, 20, 25, 30]) {
      for (const step of [0, 5, 11]) {
        const st = mkState({ settings: { programId: pid, timeBudget: budget }, step });
        for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
          const p = planFor(st, today, null, d);
          if (p.isRest) continue;
          for (const pr of p.pairs) {
            const real = pairRealRest(p, pr);
            for (const [it, got] of [[p.items[pr.a], real.a], [p.items[pr.b], real.b]]) {
              if (it.kind === 'ladder') continue;
              const f = F[it.kind] ?? 45;
              ok(got >= f, `${pid}/д${d}/${budget}мин: ${it.exId} в паре получает ${got} сек < пола ${f}`);
            }
          }
        }
      }
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);
console.log(`\nФИНАЛ: ${checks} проверок, ${fails} провалов`);

console.log('\n=== 9. Подпись не теряет смысл после пересчёта бюджета ===');
{
  // refreshScheme уже дважды затирал важные части подписи (норматив S&S,
  // «двумя гирями»). Проверяем, что подпись всегда согласована с подходами.
  for (const [pid] of Object.entries(PROGRAMS)) {
    for (const budget of [0, 15, 25, 45]) {
      for (const step of [0, 5, 11]) {
        for (const pairs of [[], [16], [16, 24, 32]]) {
          const st = mkState({ settings: { programId: pid, timeBudget: budget }, step });
          st.settings.pairs = pairs;
          for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
            const p = planFor(st, today, null, d);
            if (p.isRest) continue;
            for (const it of p.items) {
              ok(!!it.scheme && it.scheme !== '—', `${pid}/${budget}/pairs${pairs.length}: пустая подпись у ${it.exId}`);
              if (it.kind === 'emom') {
                if (it.alt) {
                  // где чередуются два разных движения, «одной или двумя гирями» неприменимо
                  ok(it.scheme.includes('чередуются'), `${pid}: подпись «${it.scheme}» не говорит о чередовании движений`);
                } else {
                  const dbl = it.sets.some(s => s.doubled);
                  ok(it.scheme.includes(dbl ? 'двумя гирями' : 'на каждую сторону'),
                     `${pid}: подпись «${it.scheme}» не говорит, одной гирей или двумя`);
                }
              }
              if (it.kind === 'swap' && it.emom) {
                ok(/норматив|минут|сек/.test(it.scheme), `${pid}: ступень норматива S&S потеряла режим времени: «${it.scheme}»`);
              }
            }
          }
        }
      }
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);
console.log(`\nИТОГ: ${checks} проверок, ${fails} провалов`);

console.log('\n=== 10. Потолки не режут последние ступени лестниц ===');
{
  // Лестницу ABC подняли до 30 кругов, а в коде оставался жёсткий потолок 16 —
  // до цели программы было не дойти. Проверяем все треки на такой обрыв.
  const { TRACKS: TR } = await import('../js/data.js');
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    for (const day of prog.days) {
      for (const sl of day.slots) {
        const tr = TR[sl.track];
        if (!tr || tr.kind === 'swap' || tr.kind === 'interval') continue;
        const lastIdx = tr.steps.length - 1;
        const st = mkState({ settings: { programId: pid, timeBudget: 0 }, step: lastIdx });
        st.settings.pairs = [16, 24, 32];
        const di = prog.days.indexOf(day);
        const p = planFor(st, today, null, di);
        if (p.isRest) continue;
        const it = p.items.find(x => x.trackId === sl.track);
        if (!it) continue;
        const want = tr.steps[lastIdx];
        // у лёгких дней свой множитель — это задумано, а не обрезка потолком
        const expect = Math.round(want.sets * (day.mult ?? 1));
        if (tr.kind === 'emom' || tr.kind === 'ballistic') {
          const unit = tr.kind === 'emom' ? 'кругов' : 'подходов';
          ok(it.sets.length >= expect,
             `${pid}/${sl.ex} (день ×${day.mult ?? 1}): ждали не меньше ${expect} ${unit}, выдано ${it.sets.length}`);
        }
      }
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);
console.log(`\nВСЕГО: ${checks} проверок, ${fails} провалов`);

console.log('\n=== 11. Поправка пропорциональна промаху ===');
{
  const mk2 = (step) => {
    const st = mkState();
    st.progress.abc = { weight: 24, step, steps: { abc_emom: step }, wins: 0, fails: 0 };
    return st;
  };
  const sess = (rpe, complete = true) => ({ deload: false, entries: [{ exId: 'abc', trackId: 'abc_emom', complete, rpe }] });
  const stepOf = (st) => st.progress.abc.steps.abc_emom;

  let st = mk2(0);
  applySession(st, sess(4));
  ok(stepOf(st) === 3, `RPE 4 «не заметил нагрузки» должен дать +3 сразу, получили ${stepOf(st)}`);

  st = mk2(0);
  applySession(st, sess(5));
  ok(stepOf(st) === 2, `RPE 5 «совсем легко» должен дать +2 сразу, получили ${stepOf(st)}`);

  st = mk2(0);
  applySession(st, sess(6));
  ok(stepOf(st) === 0, 'RPE 6 сразу шаг не двигает');
  applySession(st, sess(6));
  ok(stepOf(st) === 1, 'две тренировки на RPE 6 дают шаг (комфортно = двойной зачёт)');

  st = mk2(0);
  for (let i = 0; i < 2; i++) applySession(st, sess(7));
  ok(stepOf(st) === 0, 'на RPE 7 две тренировки шаг ещё не двигают');
  applySession(st, sess(7));
  ok(stepOf(st) === 1, 'на RPE 7 шаг приходит с третьей тренировки');

  // Смена веса — единственное место, где спешить нельзя: 24→32 это +33%.
  // Поэтому «было легко» на последней ступени вес НЕ меняет, а идёт в счётчик.
  const lastIdx = TRACKS.abc_emom.steps.length - 1;
  st = mk2(lastIdx);
  applySession(st, sess(4));
  ok(st.progress.abc.weight === 24 && stepOf(st) === lastIdx,
     `лёгкая тренировка на последней ступени не должна менять вес сразу, получили ${st.progress.abc.weight}/${stepOf(st)}`);
  applySession(st, sess(6));
  ok(st.progress.abc.weight === 32 && stepOf(st) === (TRACKS.abc_emom.reset ?? 0),
     `после подтверждения вес меняется один раз, получили ${st.progress.abc.weight}/${stepOf(st)}`);

  // и не должна прыгать за конец лестницы
  st = mk2(lastIdx - 1);
  applySession(st, sess(4));
  ok(stepOf(st) === lastIdx && st.progress.abc.weight === 24,
     `прыжок не должен перескакивать последнюю ступень, получили ${stepOf(st)}/${st.progress.abc.weight}`);

  // вниз реакция остаётся осторожной
  st = mk2(5);
  applySession(st, sess(10, false));
  ok(stepOf(st) === 5, 'один провал шаг не откатывает');
  applySession(st, sess(10, false));
  ok(stepOf(st) === 4, 'два провала подряд откатывают на один шаг, не больше');

  // на разгрузке ничего не двигается даже при RPE 4
  st = mk2(3);
  applySession(st, { deload: true, entries: [{ exId: 'abc', trackId: 'abc_emom', complete: true, rpe: 4 }] });
  ok(stepOf(st) === 3, 'на разгрузочной неделе лёгкая тренировка не двигает шаг');
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);
console.log(`\nРЕЗУЛЬТАТ: ${checks} проверок, ${fails} провалов`);

console.log('\n=== 12. Двугиревые движения при наличии пары ===');
{
  // Раньше движок сверял пару с ТЕКУЩИМ рабочим весом. Упражнение стартовало
  // с 16 кг, пары шестнадцаток не было — и человек с парой 24 молча получал
  // одногиревую замену. Проверяем оба направления.
  const дв = (p) => p.items.filter(i => i.exId.startsWith('dbl_') || i.exId === 'swing_2kb');
  const од = (p) => p.items.filter(i => ['goblet_squat', 'clean_press', 'row', 'swing_2h'].includes(i.exId));

  for (const [pairs, ждём] of [[[24], 'двугиревые'], [[16, 24, 32], 'двугиревые'], [[], 'одногиревые']]) {
    const st = mkState({ settings: { programId: 'ab15', timeBudget: 0 } });
    st.settings.pairs = pairs;
    const p = planFor(st, today, null, 0);
    if (ждём === 'двугиревые') {
      ok(дв(p).length === 3, `пары [${pairs}]: ждали 3 двугиревых упражнения, получили ${дв(p).length}`);
      ok(od => true, '');
      ok(p.items.every(i => !i.sets.some(s => s.side)), `пары [${pairs}]: двугиревые не должны делиться на левую и правую`);
      ok(p.items.every(i => pairs.includes(i.weight)), `пары [${pairs}]: рабочий вес должен быть из имеющихся пар, получили ${p.items.map(i => i.weight)}`);
    } else {
      ok(дв(p).length === 0, `без пар: двугиревых быть не должно, получили ${дв(p).length}`);
      ok(од(p).length === 3, `без пар: ждали 3 одногиревых замены, получили ${од(p).length}`);
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);
console.log(`\nПРОВЕРЕНО: ${checks} проверок, ${fails} провалов`);

console.log('\n=== 13. Программа главнее календаря ===');
{
  const { resolveCycle } = await import('../js/progression.js');
  const D = 86400000;
  const isoOf = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const назад = (n) => isoOf(new Date(Date.now() - n * D));

  for (const pid of ['ab15', 'daily_min', 'qd', 'giant', 's_and_s']) {
    const prog = PROGRAMS[pid];

    // ── правило 3: пропустил рабочий день — он ждёт, а не теряется
    {
      const st = mkState({ settings: { programId: pid } });
      st.settings.cyclePos = 0;
      st.settings.cycleDate = назад(3);
      st.sessions = [];                       // за три дня не тренировался ни разу
      const первыйРабочий = prog.days.findIndex(d => d.focus !== 'rest');
      const ожид = первыйРабочий;             // указатель должен стоять на первом рабочем дне
      // считаем, сколько дней отдыха пройдёт само
      let pos = 0, прошло = 0;
      while (prog.days[pos].focus === 'rest' && прошло < 3) { pos = (pos + 1) % prog.days.length; прошло++; }
      ok(resolveCycle(st) === pos,
         `${pid}: пропущенная тренировка должна ждать. Ждали позицию ${pos}, получили ${resolveCycle(st)}`);
    }

    // ── правило 1: день отдыха программы проходит сам
    if (prog.days.some(d => d.focus === 'rest')) {
      const restIdx = prog.days.findIndex(d => d.focus === 'rest');
      const st = mkState({ settings: { programId: pid } });
      st.settings.cyclePos = restIdx;
      st.settings.cycleDate = назад(1);
      st.sessions = [];
      ok(resolveCycle(st) === (restIdx + 1) % prog.days.length,
         `${pid}: день отдыха обязан пройти сам, без тренировки`);
    }

    // ── правило 2: нет дней отдыха в программе — нет и в приложении
    {
      const st = mkState({ settings: { programId: pid } });
      const естьОтдых = prog.days.some(d => d.focus === 'rest');
      const дни = [];
      for (let i = 0; i < prog.days.length; i++) дни.push(planFor(st, today, null, i).isRest);
      ok(дни.some(Boolean) === естьОтдых,
         `${pid}: дни отдыха в приложении должны совпадать с программой`);
    }
  }

  // ── сквозной сценарий: пропуск не ломает последовательность
  {
    const st = mkState({ settings: { programId: 'ab15' } });
    st.settings.cyclePos = 0; st.settings.cycleDate = назад(4);
    // тренировался только в первый из четырёх дней
    st.sessions = [{ date: назад(4), type: 'workout', entries: [] }];
    const pos = resolveCycle(st);
    const прогр = PROGRAMS.ab15.days;
    // день 0 сделан → 1 (отдых) прошёл → 2 (B) НЕ сделан и ждёт
    ok(pos === 2, `после пропусков указатель должен стоять на невыполненной тренировке, получили ${pos} (${прогр[pos].name})`);
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

// ═══ 14. Урезание под бюджет времени ═══════════════════════════════════════
// Три бага, найденные месячным прогоном (tools/month.mjs). Все три —
// про то, что приложение молча выдавало желаемое за действительное.
console.log('\n=== 14. Бюджет времени не врёт про прогресс ===');
{
  // (а) откат после сброса веса не должен возвращать более тяжёлую гирю
  for (const [tid, track] of Object.entries(TRACKS)) {
    if (!track.steps?.length) continue;
    const st = mkState({ settings: { bells: [16, 24, 32], timeBudget: 30 } });
    // прогоняем движок через настоящий сброс веса: два провала подряд на нулевой ступени
    const exId = Object.keys(EXERCISES).find(k => EXERCISES[k].kind !== 'mobility');
    const p = st.progress[exId]; p.weight = 24; p.steps = { [tid]: 0 }; p.fails = 1; p.wins = 0;
    const ses = { id: 1, date: today, deload: false, durationMin: 20, sessionRpe: 9,
      entries: [{ exId, trackId: tid, kind: track.kind, weight: 24, plannedSets: 5, doneSets: 2,
                  doneReps: 20, doneSec: 0, complete: false, rpe: 9, perCycle: 3, cycleDays: 7 }] };
    applySession(st, ses);
    if (p.weight === 16) {
      const шаг = track.steps[p.steps[tid] ?? 0];
      ok(!шаг.swapIn && !шаг.heavy,
         `${tid}: после сброса до 16 кг ступень не должна возвращать гирю 24 кг`);
    }
  }

  // (б) план либо влезает в бюджет, либо остался без подсобки — молчаливого перебора быть не может
  for (const pid of Object.keys(PROGRAMS)) {
    for (const бюджет of [15, 20, 30, 45]) {
      for (const ст of [0, 4, 8]) {
        const st = mkState({ settings: { programId: pid, timeBudget: бюджет, bells: [16, 24, 32], pairs: [24] } });
        for (const pr of Object.values(st.progress)) { pr.step = ст; pr.steps = new Proxy({}, { get: () => ст }); }
        for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
          const plan = planFor(st, today, null, d);
          if (plan.isRest) continue;
          ok(!plan.overBudget || plan.items.length === 1,
             `${pid} @${бюджет} мин, ступень ${ст + 1}: не влезает в бюджет, хотя подсобка ещё в плане`);
          ok(plan.items.every(it => (it.fullSets ?? it.sets.length) >= it.sets.length),
             `${pid} @${бюджет} мин: срезанных подходов больше, чем было запланировано`);
        }
      }
    }
  }

  // (в) урезанная под время тренировка не подтверждает ступень
  for (const pid of Object.keys(PROGRAMS)) {
    const st = mkState({ settings: { programId: pid, timeBudget: 15, bells: [16, 24, 32] } });
    const plan = planFor(st, today, null, PROGRAMS[pid].days.findIndex(d => d.focus !== 'rest'));
    if (plan.isRest) continue;
    const срезан = plan.items.find(it => it.cutForTime);
    if (!срезан) continue;
    const пр = st.progress[срезан.exId]; пр.steps ||= {};
    const было = { w: пр.weight, s: пр.steps[срезан.trackId] ?? 0 };
    applySession(st, { id: 1, date: today, deload: false, durationMin: 15, sessionRpe: 7,
      entries: [{ exId: срезан.exId, trackId: срезан.trackId, kind: срезан.kind, weight: срезан.weight,
                  plannedSets: срезан.sets.length, doneSets: срезан.sets.length,
                  doneReps: 50, doneSec: 0, complete: true, cutForTime: true, rpe: 7,
                  perCycle: срезан.perCycle, cycleDays: срезан.cycleDays }] });
    const стало = { w: пр.weight, s: пр.steps[срезан.trackId] ?? 0 };
    ok(было.w === стало.w && было.s === стало.s,
       `${pid}: тренировка, срезанная под бюджет, не должна двигать ступень (${было.s} → ${стало.s})`);
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log(`\nГОТОВО: ${checks} проверок, ${fails} провалов`);
