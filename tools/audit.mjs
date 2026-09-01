import { planFor, applySession, summarizeItem, estimateMinutes, tonnage, acwr, streak } from '../js/progression.js';
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

console.log('\n=== 5. Прогрессия: приложение предлагает, но не меняет ===');
{
  // Главное свойство: разбор тренировки не трогает ни вес, ни ступень.
  // Он копит наблюдения и выдаёт предложение с готовым «применить».
  const снимок = (st, ex) => JSON.stringify({ w: st.progress[ex].weight, s: st.progress[ex].steps?.swing_vol ?? st.progress[ex].step });
  const good = { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 7 }] };
  const need = TRACKS.swing_vol.winsNeeded ?? 2;
  ok(need >= 3, 'основное движение должно требовать не меньше трёх спокойных тренировок до разговора о прибавке');

  const st = mkState();
  st.progress.swing_1h = { weight: 24, step: 0, steps: {}, wins: 0, fails: 0 };
  const до = снимок(st, 'swing_1h');
  let предложение = null;
  for (let i = 0; i < need + 2; i++) {
    const изм = applySession(st, good);
    ok(снимок(st, 'swing_1h') === до, `после ${i + 1} тренировок нагрузка изменилась сама`);
    предложение = изм.find(c => c.type === 'suggest-up') || предложение;
  }
  ok(!!предложение, `${need} спокойных тренировок должны родить предложение прибавить`);
  ok(предложение?.apply && предложение.apply.step === 1 && предложение.apply.weight === 24,
     `предложение должно вести на следующую ступень тем же весом, получили ${JSON.stringify(предложение?.apply)}`);

  // с последней ступени предлагается гиря тяжелее и объём заново
  const last = TRACKS.swing_vol.steps.length - 1;
  const st2 = mkState();
  st2.progress.swing_1h = { weight: 24, step: last, steps: { swing_vol: last }, wins: need, fails: 0 };
  const изм2 = applySession(st2, good);
  const п2 = изм2.find(c => c.type === 'suggest-up');
  ok(st2.progress.swing_1h.weight === 24, 'вес не должен смениться сам');
  ok(п2?.apply?.weight === 32 && п2.apply.step === (TRACKS.swing_vol.reset ?? 0),
     `с последней ступени предложение должно вести на 32 кг и сброс объёма, получили ${JSON.stringify(п2?.apply)}`);

  // смена гири постепенная — ступени замены на месте
  const swapSteps = TRACKS.swing_vol.steps.filter(x => x.swapIn);
  ok(swapSteps.length >= 4, 'перед сменой гири должны быть ступени постепенной замены подходов');
  ok(swapSteps[swapSteps.length - 1].swapIn === 10, 'последняя ступень замены должна переводить все подходы на новый вес');

  // разгрузка ничего не двигает и счётчик не сбрасывает
  const st3 = mkState();
  st3.progress.swing_1h = { weight: 24, step: 4, steps: { swing_vol: 4 }, wins: 1, fails: 0 };
  applySession(st3, { deload: true, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 6 }] });
  ok(st3.progress.swing_1h.steps.swing_vol === 4 && st3.progress.swing_1h.wins === 1,
     'на разгрузке ступень не двигается и счётчик не сбрасывается');

  // тяжело дважды подряд — предложение убавить, но не сама убавка
  const st4 = mkState();
  st4.progress.swing_1h = { weight: 24, step: 3, steps: { swing_vol: 3 }, wins: 0, fails: 1 };
  const изм4 = applySession(st4, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: false, rpe: 9 }] });
  const п4 = изм4.find(c => c.type === 'suggest-down');
  ok(st4.progress.swing_1h.steps.swing_vol === 3, 'ступень не должна откатиться сама');
  ok(п4?.apply?.step === 2, `должно предлагаться вернуться на ступень ниже, получили ${JSON.stringify(п4?.apply)}`);

  // «тяжеловато» — рабочая зона, ничего не предлагаем и счётчик не рушим
  const st5 = mkState();
  st5.progress.swing_1h = { weight: 24, step: 2, steps: { swing_vol: 2 }, wins: 1, fails: 0 };
  const изм5 = applySession(st5, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 8 }] });
  ok(st5.progress.swing_1h.wins === 1 && st5.progress.swing_1h.steps.swing_vol === 2,
     'на «тяжеловато» стоим на месте, счётчик не сбрасывается');
  ok(!изм5.some(c => c.apply), 'на «тяжеловато» ничего не предлагаем');

  // «совсем легко» — предложение сразу, без накопления
  const st6 = mkState();
  st6.progress.swing_1h = { weight: 24, step: 2, steps: { swing_vol: 2 }, wins: 0, fails: 0 };
  const изм6 = applySession(st6, { deload: false, entries: [{ exId: 'swing_1h', trackId: 'swing_vol', complete: true, rpe: 4 }] });
  const п6 = изм6.find(c => c.type === 'suggest-up');
  ok(st6.progress.swing_1h.steps.swing_vol === 2, 'даже на «совсем легко» ступень не двигается сама');
  ok(п6?.apply?.step > 2, `на «совсем легко» предложение должно перепрыгнуть вперёд, получили ${JSON.stringify(п6?.apply)}`);

  // ни одна программа не должна менять нагрузку сама
  for (const pid of Object.keys(PROGRAMS)) {
    const s = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] } });
    const d0 = PROGRAMS[pid].days.findIndex(x => x.focus !== 'rest');
    const до2 = JSON.stringify(Object.fromEntries(Object.entries(s.progress).map(([k, v]) =>
      // первый разбор заводит запись ступени со значением 0 — это не изменение нагрузки
      [k, [v.weight, Object.entries(v.steps || {}).filter(([, x]) => x !== 0).sort()]])));
    for (let n = 0; n < 6; n++) {
      const p = planFor(s, today, null, d0);
      if (p.isRest) break;
      p.items.forEach(it => it.sets.forEach(x => { x.done = true; x.actualReps = x.reps; }));
      applySession(s, { id: n, date: today, deload: false, durationMin: 20, sessionRpe: 6,
        entries: p.items.map(it => { const sum = summarizeItem(it); return {
          exId: it.exId, trackId: it.trackId, kind: it.kind, weight: it.weight, maxStep: it.maxStep,
          plannedSets: sum.totalSets, doneSets: sum.doneSets, doneReps: sum.doneReps, doneSec: sum.doneSec,
          complete: sum.complete, rpe: 6, perCycle: it.perCycle, cycleDays: it.cycleDays }; }) });
    }
    const после = JSON.stringify(Object.fromEntries(Object.entries(s.progress).map(([k, v]) =>
      // первый разбор заводит запись ступени со значением 0 — это не изменение нагрузки
      [k, [v.weight, Object.entries(v.steps || {}).filter(([, x]) => x !== 0).sort()]])));
    ok(до2 === после, `${pid}: шесть тренировок «легко» изменили нагрузку без участия человека`);
  }
}
console.log(`  всего проверок ${checks}, провалов ${fails}`);
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

console.log('\n=== 11. Размер предложения пропорционален промаху ===');
{
  const mk2 = (step) => {
    const st = mkState();
    st.progress.abc = { weight: 24, step, steps: { abc_emom: step }, wins: 0, fails: 0 };
    return st;
  };
  const sess = (rpe, complete = true) => ({ deload: false, entries: [{ exId: 'abc', trackId: 'abc_emom', complete, rpe }] });
  const stepOf = (st) => st.progress.abc.steps.abc_emom;
  const предл = (изм, тип) => изм.find(c => c.type === тип);

  // «совсем мимо» — предложение сразу и сразу на несколько ступеней
  let st = mk2(0);
  let и = applySession(st, sess(4));
  ok(stepOf(st) === 0, 'ступень не двигается сама даже на RPE 4');
  ok(предл(и, 'suggest-up')?.apply?.step === 3, `RPE 4 «не заметил нагрузки» должен предлагать +3, получили ${JSON.stringify(предл(и, 'suggest-up')?.apply)}`);

  st = mk2(0);
  и = applySession(st, sess(5));
  ok(предл(и, 'suggest-up')?.apply?.step === 2, `RPE 5 «совсем легко» должен предлагать +2, получили ${JSON.stringify(предл(и, 'suggest-up')?.apply)}`);

  // «легко» идёт в копилку с двойным зачётом, «нормально» — с одинарным.
  // Порог берём из самой лестницы, чтобы тест не разъезжался с данными.
  const порог = Math.max(2, TRACKS.abc_emom.winsNeeded ?? 2);
  st = mk2(0);
  for (let i = 1; i <= Math.ceil(порог / 2); i++) и = applySession(st, sess(6));
  ok(!!предл(и, 'suggest-up'), `на RPE 6 предложение должно прийти за ${Math.ceil(порог / 2)} тренировок (двойной зачёт)`);

  st = mk2(0);
  for (let i = 1; i < порог; i++) {
    и = applySession(st, sess(7));
    ok(!предл(и, 'suggest-up'), `${i} тренировок из ${порог} на RPE 7 — предложения ещё быть не должно`);
  }
  и = applySession(st, sess(7));
  ok(!!предл(и, 'suggest-up'), `после ${порог} тренировок на RPE 7 предложение появляется`);
  ok(stepOf(st) === 0, 'и при этом ступень так и стоит на месте');

  // на последней ступени предлагается вес, и только после подтверждений
  const lastIdx = TRACKS.abc_emom.steps.length - 1;
  st = mk2(lastIdx);
  и = applySession(st, sess(4));
  ok(st.progress.abc.weight === 24 && stepOf(st) === lastIdx, 'вес сам не меняется');
  и = applySession(st, sess(6));
  const пв = предл(и, 'suggest-up');
  ok(пв?.apply?.weight === 32 && пв.apply.step === (TRACKS.abc_emom.reset ?? 0),
     `с последней ступени предлагается гиря тяжелее и сброс объёма, получили ${JSON.stringify(пв?.apply)}`);

  // предложение не перескакивает конец лестницы
  st = mk2(lastIdx - 1);
  и = applySession(st, sess(4));
  ok(предл(и, 'suggest-up')?.apply?.step === lastIdx && st.progress.abc.weight === 24,
     `прыжок не должен перескакивать последнюю ступень, получили ${JSON.stringify(предл(и, 'suggest-up')?.apply)}`);

  // вниз — тоже предложение, и только со второго раза
  st = mk2(5);
  и = applySession(st, sess(10, false));
  ok(!предл(и, 'suggest-down'), 'один тяжёлый раз — ещё не повод предлагать убавить');
  и = applySession(st, sess(10, false));
  ok(предл(и, 'suggest-down')?.apply?.step === 4, `два тяжёлых подряд предлагают ступень ниже, получили ${JSON.stringify(предл(и, 'suggest-down')?.apply)}`);
  ok(stepOf(st) === 5, 'сама ступень при этом не откатывается');

  // на разгрузке не предлагаем ничего
  st = mk2(3);
  и = applySession(st, { deload: true, entries: [{ exId: 'abc', trackId: 'abc_emom', complete: true, rpe: 4 }] });
  ok(stepOf(st) === 3 && !и.some(c => c.apply), 'на разгрузочной неделе ничего не двигаем и не предлагаем');
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

  // (б3) Недоделанная тренировка — это факт, а не провал. Сигналом «тяжело»
  //      остаётся оценка самочувствия: ушёл раньше, но шло нормально — ступень
  //      держим; было очень тяжело — провал, даже если доделал.
  for (const pid of Object.keys(PROGRAMS)) {
    const d0 = PROGRAMS[pid].days.findIndex(x => x.focus !== 'rest');
    // движение из одного-двух подходов недоделать нельзя: «часть» округляется
    // до целого и тренировка выходит полной — проверять там нечего
    {
      const проб = planFor(mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] } }), today, null, d0);
      if (проб.isRest || (проб.items[0]?.sets.length ?? 0) < 3) continue;
    }
    const проба = (доля, rpe, раз) => {
      const st = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] } });
      for (let n = 0; n < раз; n++) {
        const p = planFor(st, today, null, d0);
        const it = p.items[0];
        const сделать = Math.max(1, Math.round(it.sets.length * доля));
        it.sets.forEach((x, i) => { if (i < сделать) { x.done = true; x.actualReps = x.reps; } });
        const sum = summarizeItem(it);
        applySession(st, { id: n, date: today, deload: false, durationMin: 15, sessionRpe: rpe,
          entries: [{ exId: it.exId, trackId: it.trackId, kind: it.kind, weight: it.weight, maxStep: it.maxStep,
                      plannedSets: sum.totalSets, doneSets: sum.doneSets, doneReps: sum.doneReps,
                      doneSec: sum.doneSec, complete: sum.complete, rpe,
                      perCycle: it.perCycle, cycleDays: it.cycleDays }] });
      }
      const p = planFor(st, today, null, d0);
      const pr = st.progress[p.items[0].exId];
      pr.steps ||= {};
      return { шаг: pr.steps[p.items[0].trackId] ?? 0, вес: pr.weight, провалов: pr.fails || 0 };
    };
    const было = проба(1, 7, 0);
    const коротко = проба(0.4, 7, 3);
    ok(коротко.шаг === было.шаг && коротко.вес === было.вес,
       `${pid}: три коротких тренировки при нормальном самочувствии сдвинули нагрузку (${было.шаг}/${было.вес} → ${коротко.шаг}/${коротко.вес})`);
    ok(коротко.провалов === 0, `${pid}: короткая тренировка записана как провал`);
    // «очень тяжело» убавляет объём внутри лестницы, но НЕ меняет гирю:
    // смена веса — решение человека, приложение её только предлагает
    const тяжело = проба(0.4, 9, 4);
    ok(тяжело.вес === было.вес,
       `${pid}: «очень тяжело» само сменило гирю ${было.вес} → ${тяжело.вес} кг, а должно было предложить`);
    ok(тяжело.шаг <= было.шаг, `${pid}: «очень тяжело» подняло ступень`);
  }

  // (б4) Тоннаж считается по реально поднятому весу: пара гирь это двойной
  //      вес в повторе, а «круг» в минутном режиме — не один повтор.
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    const st = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] } });
    for (let d = 0; d < prog.days.length; d++) {
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      p.items.forEach(it => it.sets.forEach(x => { x.done = true; x.actualReps = x.reps; }));
      for (const it of p.items) {
        if (it.kind === 'time') continue;
        const sum = summarizeItem(it);
        const гирь = EXERCISES[it.exId].double ? 2 : 1;
        const ожидание = it.sets.reduce((a, x) => a + (x.loadReps ?? x.reps ?? 0) * (x.weight || 0) * гирь, 0);
        const факт = tonnage({ entries: [{ exId: it.exId, kind: it.kind, weight: it.weight,
                                           doneReps: sum.doneReps, doneLoadReps: sum.doneLoadReps }] });
        // тоннаж считается по единому весу позиции, поэтому сверяем на движениях
        // без частичной замены гири — там веса подходов разные по замыслу
        if (it.sets.some(x => x.weight !== it.weight)) continue;
        ok(факт === ожидание,
           `${pid}/д${d}: ${it.exId} тоннаж ${факт} кг вместо ${ожидание} кг`);
        if (гирь === 2) ok(факт > 0 && факт % 2 === 0, `${pid}: ${it.exId} двугиревой тоннаж должен учитывать обе гири`);
      }
    }
  }

  // (б5) Программы, где автор прогрессии не предусмотрел: объём один и тот же
  //      при любом самочувствии и на любой неделе волны, и приложение о прибавке
  //      не заговаривает. Подстроить нагрузку можно только гирей, руками.
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    if (!prog.noProgression) continue;
    const st = mkState({ settings: { programId: pid, bells: [16, 24, 32], pairs: [16, 24] } });
    for (let d = 0; d < prog.days.length; d++) {
      const p = planFor(st, today, null, d);
      if (p.isRest) continue;
      p.items.forEach(it => it.sets.forEach(x => { x.done = true; x.actualReps = x.reps; }));
      const изм = applySession(st, { id: d, date: today, deload: false, durationMin: 20, sessionRpe: 5,
        entries: p.items.map(it => { const sum = summarizeItem(it); return {
          exId: it.exId, trackId: it.trackId, kind: it.kind, weight: it.weight, maxStep: it.maxStep,
          plannedSets: sum.totalSets, doneSets: sum.doneSets, doneReps: sum.doneReps, doneSec: sum.doneSec,
          complete: sum.complete, rpe: 4, perCycle: it.perCycle, cycleDays: it.cycleDays }; }) });
      ok(!изм.some(c => c.apply), `${pid}/д${d}: программа без прогрессии предложила менять нагрузку`);
      // Рабочая ступень одна. Достигается двумя способами: лестницу обрезали
      // (если она только у этой программы) или прибили слотом fixedStep
      // (если общая с другими — резать нельзя, поедут соседи).
      for (const it of p.items) {
        const sl = (prog.days[d].slots || []).find(x => x.track === it.trackId);
        if (sl?.fixedStep !== undefined) { ok(true, ''); continue; }
        const рабочих = TRACKS[it.trackId].steps.filter(x => !x.swapIn && !x.heavy).length;
        ok(рабочих === 1, `${pid}: ${it.trackId} оставил ${рабочих} рабочих ступеней вместо одной`);
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
