// Симуляция месяца ежедневного использования: что реально происходит с нагрузкой.
import { planFor, applySession, summarizeItem } from '../js/progression.js';
import { EXERCISES, PROGRAMS } from '../js/data.js';

const DAY = 86400000;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function simulate({ programId, days = 30, tgu = false, budget = 25, start = {}, rpe = 7 }) {
  const t0 = new Date('2026-09-01T00:00:00');
  const state = {
    settings: { programId, startDate: iso(t0), bells: [16, 24, 32],
                warmup: true, cooldown: true, tgu, deloadEvery: 6 },
    progress: Object.fromEntries(Object.keys(EXERCISES).filter(k => EXERCISES[k].kind !== 'mobility')
      .map(k => [k, { weight: start[k]?.weight ?? 16, step: 0, steps: start[k]?.steps ?? {}, wins: 0, fails: 0 }])),
    sessions: []
  };

  const weeks = [[], [], [], [], []];
  for (let d = 0; d < days; d++) {
    const date = iso(new Date(t0.getTime() + d * DAY));
    const plan = planFor(state, date, null);
    if (plan.isRest) { weeks[Math.floor(d / 7)].push({ rest: true }); continue; }

    // «идеальный» пользователь: делает всё, честно ставит RPE
    const entries = plan.items.map(it => {
      it.sets.forEach(s => { s.done = true; s.actualReps = s.reps; });
      const sum = summarizeItem(it);
      return { exId: it.exId, trackId: it.trackId, kind: it.kind, weight: it.weight,
               plannedSets: sum.totalSets, doneSets: sum.doneSets, doneReps: sum.doneReps,
               doneSec: sum.doneSec, complete: true, rpe };
    });
    const session = { date, deload: plan.deload, entries, durationMin: plan.estimate, sessionRpe: rpe, estimateMin: plan.estimate };
    applySession(state, session);
    state.sessions.push(session);
    weeks[Math.floor(d / 7)].push({ plan, entries });
  }
  return { state, weeks };
}

function report(title, opts) {
  const { state, weeks } = simulate(opts);
  console.log(`\n${'═'.repeat(62)}\n${title}\n${'═'.repeat(62)}`);
  weeks.slice(0, 4).forEach((w, i) => {
    const work = w.filter(x => !x.rest);
    const swings = work.reduce((a, d) => a + d.entries.filter(e => ['swing_1h','swing_2h'].includes(e.exId)).reduce((x, e) => x + e.doneReps, 0), 0);
    const press = work.reduce((a, d) => a + d.entries.filter(e => ['clean_press','press'].includes(e.exId)).reduce((x, e) => x + e.doneReps, 0), 0);
    const tonn = work.reduce((a, d) => a + d.entries.reduce((x, e) => x + e.doneReps * e.weight, 0), 0);
    const mins = work.reduce((a, d) => a + d.plan.estimate, 0);
    const deload = w.some(x => x.plan?.deload);
    console.log(`Неделя ${i + 1}${deload ? ' (разгрузка)' : '           '} · тренировок ${work.length} · ${mins} мин · махов ${swings} · жимов ${press} · ${(tonn/1000).toFixed(1)} т`);
  });
  const p = state.progress;
  const show = (ex, tr) => { const st = p[ex]?.steps?.[tr]; return st === undefined ? '—' : `${p[ex].weight} кг, ступень ${st + 1}`; };
  console.log(`\nГде окажешься через месяц:`);
  for (const [ex, tr] of [['swing_1h','swing_vol'],['clean_press','press_ladder'],['goblet_squat','squat_reps'],['swing_1h','sns_swing'],['tgu','sns_tgu']]) {
    const v = show(ex, tr);
    if (v !== '—') console.log(`  ${EXERCISES[ex].name} (${tr}): ${v}`);
  }
}

report('«ЕЖЕДНЕВНЫЙ МИНИМУМ» — 30 дней, старт с нуля', { programId: 'daily_min' });
report('«ЕЖЕДНЕВНЫЙ МИНИМУМ» — старт после теста кондиций (твой уровень)', {
  programId: 'daily_min',
  start: { swing_1h: { weight: 24, steps: { swing_vol: 5 } }, clean_press: { weight: 16, steps: { press_ladder: 3 } },
           goblet_squat: { weight: 16, steps: { squat_reps: 4 } }, carry_farmer: { weight: 32, steps: { carry_time: 3 } },
           row: { weight: 16, steps: { row_reps: 3 } }, swing_2h: { weight: 24, steps: { swing_vol: 6 } } }
});
report('SIMPLE & SINISTER — 30 дней, старт с 16 кг', { programId: 's_and_s', tgu: true, start: { swing_1h: { weight: 24 }, tgu: { weight: 16 } } });
