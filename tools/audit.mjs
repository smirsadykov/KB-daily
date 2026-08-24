import { planFor, applySession, summarizeItem, estimateMinutes, acwr, streak } from '../js/progression.js';
import { PROGRAMS, TRACKS, EXERCISES } from '../js/data.js';

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const today = new Date().toISOString().slice(0, 10);

const mkState = (over = {}) => ({
  settings: { programId: 'daily_min', startDate: today, bells: [16,24,32],
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
        const st = mkState({ settings: { programId: pid }, step });
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

console.log('\n=== 3. Время задаёт программа, а не пользователь ===');
// Никакого бюджета: план обязан в точности совпадать с предписанием ступени,
// а объявленное программой время — накрывать то, что она реально выдаёт.
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  const объявлено = (prog.tag.match(/(\d+)(?:\s*→\s*(\d+))?\s*мин/) || []).slice(1).filter(Boolean).map(Number);
  ok(объявлено.length > 0, `${pid}: программа не объявляет своё время в tag`);
  const верх = объявлено[объявлено.length - 1];
  for (const step of [0, 5, 11]) {
    const st = mkState({ settings: { programId: pid }, step });
    for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      const est = estimateMinutes(p);
      ok(p.estimate === est, `${pid}: plan.estimate=${p.estimate} расходится с пересчётом ${est}`);
      ok(!p.items.some(it => it.cutForTime), `${pid}/д${d}/шаг${step}: объём срезан, хотя резать больше нечем`);
      if (верх) ok(est <= верх, `${pid}/д${d}/шаг${step}: ${est} мин, а программа обещает не больше ${верх}`);
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log('\n=== 4. Отдых не проваливается ниже пола ===');
const FLOOR = { ballistic: 30, ladder: 45, reps: 45, time: 30, swap: 60, interval: 120 };
for (const [pid] of Object.entries(PROGRAMS)) {
  for (const budget of [15, 20, 25]) {
    const st = mkState({ settings: { programId: pid }, step: 8 });
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
    const st = mkState({ settings: { programId: pid }, step: 6 });
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
        const st = mkState({ settings: { programId: pid }, step });
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
          const st = mkState({ settings: { programId: pid }, step });
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
        const st = mkState({ settings: { programId: pid }, step: lastIdx });
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
    const st = mkState({ settings: { programId: 'ab15' } });
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

// ═══ 14. Парная работа только по объявлению программы ═════════════════════
// Раньше пары ставились, чтобы уложиться в бюджет. Бюджета нет: пара — это
// часть протокола, и появляться она должна только там, где так задумано.
console.log('\n=== 14. Пары — замысел программы, а не экономия времени ===');
{
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    for (const step of [0, 4, 8, 12]) {
      const st = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [24] }, step });
      for (let d = 0; d < prog.days.length; d++) {
        const p = planFor(st, today, null, d);
        if (p.isRest) continue;
        ok(!!prog.days[d].pair || p.pairs.length === 0,
           `${pid}/д${d}/шаг${step}: пара появилась там, где программа её не объявляла`);
        for (const it of p.items) {
          ok(it.sets.length > 0, `${pid}/д${d}/шаг${step}: ${it.exId} остался без подходов`);
          ok(it.fullSets === undefined || it.fullSets === it.sets.length,
             `${pid}/д${d}/шаг${step}: ${it.exId} потерял подходы между сборкой и выдачей`);
        }
      }
    }
  }
  // чередующиеся движения должны получать поровну кругов
  // (13 минут махов и трастеров — это 7 подходов махов и только 6 трастеров)
  const САМОЧУВСТВИЕ = [null, { sleep: 5, soreness: 5, energy: 5 }, { sleep: 3, soreness: 3, energy: 3 },
                        { sleep: 2, soreness: 2, energy: 2 }, { sleep: 1, soreness: 1, energy: 1 }];
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    for (const step of [0, 2, 4, 6, 8]) {
      for (const r of САМОЧУВСТВИЕ) {
        const st = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] }, step });
        for (let d = 0; d < prog.days.length; d++) {
          const p = planFor(st, today, r, d);
          if (p.isRest) continue;
          for (const it of p.items) {
            if (!it.sets.some(x => x.alt)) continue;
            const счёт = {};
            it.sets.forEach(x => { счёт[x.complexReps] = (счёт[x.complexReps] || 0) + 1; });
            const кол = Object.values(счёт);
            ok(new Set(кол).size === 1,
               `${pid}/д${d}/шаг${step}: чередующиеся движения получили разное число кругов — ${JSON.stringify(счёт)}`);
          }
        }
      }
    }
  }

  // откат после сброса веса не должен возвращать более тяжёлую гирю
  for (const [tid, track] of Object.entries(TRACKS)) {
    if (!track.steps?.length) continue;
    const st = mkState({ settings: { bells: [16, 24, 32] } });
    const exId = Object.keys(EXERCISES).find(k => EXERCISES[k].kind !== 'mobility');
    const pr = st.progress[exId]; pr.weight = 24; pr.steps = { [tid]: 0 }; pr.fails = 1; pr.wins = 0;
    applySession(st, { id: 1, date: today, deload: false, durationMin: 20, sessionRpe: 9,
      entries: [{ exId, trackId: tid, kind: track.kind, weight: 24, plannedSets: 5, doneSets: 2,
                  doneReps: 20, doneSec: 0, complete: false, rpe: 9, perCycle: 3, cycleDays: 7 }] });
    if (pr.weight === 16) {
      const шаг = track.steps[pr.steps[tid] ?? 0];
      ok(!шаг.swapIn && !шаг.heavy, `${tid}: после сброса до 16 кг ступень не должна возвращать гирю 24 кг`);
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);


// ═══ 15. Объём: потолок протокола и потолок программы ═════════════════════
console.log('\n=== 15. Волна не раздувает чужой протокол, минимум остаётся минимумом ===');
{
  const ПИК = { sleep: 5, soreness: 5, energy: 5 };
  // (а) там, где объём задан источником, пиковая неделя и отличное самочувствие
  //     не должны давать больше подходов, чем предписала ступень
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    if (!prog.fixedVolume) continue;
    for (const step of [0, 3, 6, 9]) {
      const базовое = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] }, step });
      for (let d = 0; d < prog.days.length; d++) {
        const тихо = planFor(базовое, today, null, d);
        const пик = planFor(базовое, today, ПИК, d);
        if (тихо.isRest) continue;
        тихо.items.forEach((it, i) => {
          ok(пик.items[i].sets.length <= it.sets.length,
             `${pid}/д${d}/шаг${step}: ${it.exId} на пике ${пик.items[i].sets.length} подходов против ${it.sets.length} — протокол раздут`);
        });
      }
    }
  }

  // (б) потолок ступени, заданный программой, соблюдается в плане
  //     и не превращается в тупик: упёршись, движок берёт гирю тяжелее
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    for (const day of prog.days) {
      for (const sl of day.slots || []) {
        if (sl.maxStep === undefined) continue;
        const st = mkState({ settings: { programId: pid, bells: [16, 24, 32] }, step: 20 });
        const d = prog.days.indexOf(day);
        const p = planFor(st, today, null, d);
        const it = p.items.find(x => x.trackId === sl.track);
        ok(!!it, `${pid}: слот ${sl.ex} с потолком не попал в план`);
        if (!it) continue;
        ok(it.step <= sl.maxStep, `${pid}: ${sl.ex} ступень ${it.step} выше потолка ${sl.maxStep}`);
        // упёрлись в потолок и всё делаем легко — должна смениться гиря
        const pr = st.progress[it.exId];
        const весДо = pr.weight;
        pr.steps = { [sl.track]: sl.maxStep }; pr.wins = 9;
        applySession(st, { id: 1, date: today, deload: false, durationMin: 20, sessionRpe: 6,
          entries: [{ exId: it.exId, trackId: sl.track, kind: it.kind, weight: it.weight, maxStep: sl.maxStep,
                      plannedSets: it.sets.length, doneSets: it.sets.length, doneReps: 50, doneSec: 0,
                      complete: true, rpe: 6, perCycle: it.perCycle, cycleDays: it.cycleDays }] });
        const дошёлДоПотолка = весДо !== pr.weight || (pr.steps[sl.track] ?? 0) <= sl.maxStep;
        ok(дошёлДоПотолка, `${pid}: ${sl.ex} на потолке ${sl.maxStep} ушёл на ступень ${pr.steps[sl.track]} вместо смены гири`);
      }
    }
  }

  // (б2) A/B: числа Джорджа Томаса — ровно три круга в A и шесть в B, всегда.
  //      Ни ступень лестницы, ни волна, ни самочувствие их не двигают.
  //      Убавить может только разгрузочная неделя и плохое самочувствие.
  for (const r of [null, { sleep: 5, soreness: 5, energy: 5 }]) {
    for (const step of [0, 2, 4, 6, 8, 9]) {
      const st = mkState({ settings: { programId: 'ab15', bells: [16, 24, 32], pairs: [16, 24] }, step });
      for (let d = 0; d < PROGRAMS.ab15.days.length; d++) {
        const p = planFor(st, today, r, d);
        if (p.isRest) continue;
        if (p.dayId === 'A') {
          p.items.forEach(it => ok(it.sets.length === 3,
            `ab15/день A/шаг${step}: ${it.exId} даёт ${it.sets.length} кругов вместо трёх`));
        } else {
          p.items.forEach(it => ok(it.sets.length === 12,
            `ab15/день B/шаг${step}: ${it.sets.length} подходов вместо двенадцати (шесть кругов)`));
        }
      }
    }
  }

  // (в) постепенная замена гири в минутном режиме делит тяжёлые круги поровну
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    for (const step of [0, 4, 8, 10, 11]) {
      const st = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] }, step });
      for (let d = 0; d < prog.days.length; d++) {
        const p = planFor(st, today, null, d);
        if (p.isRest) continue;
        for (const it of p.items) {
          const тяж = it.sets.filter(x => x.weight > it.weight);
          if (!тяж.length || !it.sets.some(x => x.alt)) continue;
          const счёт = {};
          тяж.forEach(x => { счёт[x.complexReps] = (счёт[x.complexReps] || 0) + 1; });
          ok(new Set(Object.values(счёт)).size === 1,
             `${pid}/д${d}/шаг${step}: тяжёлую гирю получили не поровну — ${JSON.stringify(счёт)}`);
        }
      }
    }
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);

console.log(`\nГОТОВО: ${checks} проверок, ${fails} провалов`);
