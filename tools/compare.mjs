// Сравнение двух программ на месяц вперёд для конкретного человека.
// Запуск: node tools/compare.mjs
import { planFor, applySession, summarizeItem } from '../js/progression.js';
import { EXERCISES, PROGRAMS, TRACKS } from '../js/data.js';

const DAY = 86400000;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function run({ programId, days = 28, rpe = 7, pairs = [24], budget = 0 }) {
  const t0 = new Date('2026-09-01T00:00:00');
  const state = {
    settings: { programId, startDate: iso(t0), bells: [16, 24, 32], pairs,
                warmup: true, cooldown: true, tgu: false, deloadEvery: 6 },
    progress: Object.fromEntries(Object.keys(EXERCISES).filter(k => EXERCISES[k].kind !== 'mobility')
      .map(k => [k, { weight: 24, step: 0, steps: {}, wins: 0, fails: 0 }])),
    sessions: []
  };
  const log = { сессий: 0, минут: 0, тоннаж: 0, подходы: {}, повторы: {} };
  for (let d = 0; d < days; d++) {
    const date = iso(new Date(t0.getTime() + d * DAY));
    const plan = planFor(state, date, null);
    if (plan.isRest) continue;
    const entries = plan.items.map(it => {
      it.sets.forEach(s => { s.done = true; s.actualReps = s.reps; });
      const sum = summarizeItem(it);
      log.подходы[it.name] = (log.подходы[it.name] || 0) + sum.totalSets;
      log.повторы[it.name] = (log.повторы[it.name] || 0) + sum.doneReps;
      log.тоннаж += it.sets.reduce((a, s) => a + (s.actualReps || 0) * (s.weight || 0) * (s.side ? 1 : (it.exId.startsWith('dbl_') || it.exId === 'swing_2kb' ? 2 : 1)), 0);
      return { exId: it.exId, trackId: it.trackId, kind: it.kind, weight: it.weight,
               plannedSets: sum.totalSets, doneSets: sum.doneSets, doneReps: sum.doneReps,
               complete: true, rpe, perCycle: it.perCycle, cycleDays: it.cycleDays };
    });
    applySession(state, { date, deload: plan.deload, entries, durationMin: plan.estimate, sessionRpe: rpe, estimateMin: plan.estimate });
    state.sessions.push({ date, entries, durationMin: plan.estimate, sessionRpe: rpe });
    log.сессий++; log.минут += plan.estimate;
  }
  return { state, log };
}

const недели = 4;
for (const [pid, label] of [['ab15', '15 минут A/B'], ['giant', 'The Giant']]) {
  const { state, log } = run({ programId: pid });
  const prog = PROGRAMS[pid];
  console.log(`\n${'═'.repeat(60)}\n${label}\n${'═'.repeat(60)}`);
  console.log(`  за 4 недели: ${log.сессий} тренировок, ${log.минут} минут, ${(log.тоннаж/1000).toFixed(1)} тонн`);
  console.log(`  в неделю: ${(log.сессий/недели).toFixed(1)} тренировок, ${Math.round(log.минут/недели)} минут`);
  console.log('  подходов в неделю по движениям:');
  for (const [name, n] of Object.entries(log.подходы)) {
    console.log(`     ${name.padEnd(30)} ${(n/недели).toFixed(1)} подх · ${Math.round(log.повторы[name]/недели)} повт`);
  }
  console.log('  где окажешься через месяц:');
  for (const day of prog.days) for (const sl of day.slots) {
    const p = state.progress[sl.ex]; const st = p?.steps?.[sl.track];
    if (st === undefined) continue;
    const tr = TRACKS[sl.track];
    console.log(`     ${EXERCISES[sl.ex].short.padEnd(18)} ${p.weight} кг, ступень ${st + 1}/${tr.steps.length}`);
  }
}
