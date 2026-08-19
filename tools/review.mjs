// Аудит приложения: целостность данных и пригодность каждой программы.
// Запуск: node tools/review.mjs
import { EXERCISES, PROGRAMS, TRACKS, waveFor } from '../js/data.js';
import { planFor, estimateMinutes, applySession } from '../js/progression.js';

const today = new Date().toISOString().slice(0, 10);
const problems = [];
const warn = (kind, msg) => problems.push({ kind, msg });

const mkState = (pid, budget = 25, step = 0, pairs = [24]) => ({
  settings: { programId: pid, startDate: today, bells: [16, 24, 32], pairs,
              warmup: true, cooldown: true, tgu: false, deloadEvery: 6 },
  progress: Object.fromEntries(Object.keys(EXERCISES).filter(k => EXERCISES[k].kind !== 'mobility')
    .map(k => [k, { weight: 24, step: 0, steps: {}, wins: 0, fails: 0 }])),
  sessions: []
});
const atStep = (st, pid, step) => {
  for (const day of PROGRAMS[pid].days) for (const sl of day.slots) {
    const tr = TRACKS[sl.track];
    st.progress[sl.ex].steps[sl.track] = Math.min(step, tr.steps.length - 1);
  }
  st.today = null;
  return st;
};

console.log('═'.repeat(74));
console.log('ЧАСТЬ 1. ЦЕЛОСТНОСТЬ ДАННЫХ');
console.log('═'.repeat(74));

// ссылки на несуществующие упражнения и треки
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  for (const day of prog.days) for (const sl of day.slots) {
    if (!EXERCISES[sl.ex]) warn('ссылка', `${pid}: нет упражнения ${sl.ex}`);
    if (!TRACKS[sl.track]) warn('ссылка', `${pid}: нет трека ${sl.track}`);
    if (sl.fallback && !EXERCISES[sl.fallback]) warn('ссылка', `${pid}: нет замены ${sl.fallback}`);
  }
}
// документация программ
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  if (!prog.origin) warn('документация', `${pid}: нет происхождения`);
  if (!prog.gives || !prog.limits) warn('документация', `${pid}: нет разбора «что даёт / чего не даёт»`);
}
// неиспользуемые упражнения и треки
const usedEx = new Set(), usedTr = new Set();
for (const prog of Object.values(PROGRAMS)) for (const d of prog.days) for (const sl of d.slots) {
  usedEx.add(sl.ex); usedTr.add(sl.track); if (sl.fallback) usedEx.add(sl.fallback);
}
for (const id of Object.keys(EXERCISES)) {
  if (EXERCISES[id].kind === 'mobility') continue;
  if (!usedEx.has(id)) warn('мусор', `упражнение ${id} не используется ни в одной программе`);
}
for (const id of Object.keys(TRACKS)) if (!usedTr.has(id)) warn('мусор', `трек ${id} не используется`);
// упражнения без подсказок по технике
for (const [id, ex] of Object.entries(EXERCISES)) {
  if (!ex.cues || !ex.cues.length) warn('качество', `${id}: нет подсказок по технике`);
}

console.log(problems.length ? problems.map(p => `  [${p.kind}] ${p.msg}`).join('\n') : '  Проблем не найдено');

console.log('\n' + '═'.repeat(74));
console.log('ЧАСТЬ 2. ПРИГОДНОСТЬ ПРОГРАММ');
console.log('═'.repeat(74));

const rows = [];
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  const workDays = prog.days.filter(d => d.focus !== 'rest').length;
  const restDays = prog.days.length - workDays;

  // длительность на старте, в середине и в конце лестниц
  const dur = [];
  for (const step of [0, 99]) {
    const st = atStep(mkState(pid, 0), pid, step);   // без лимита времени
    const mins = prog.days.map((d, i) => {
      const p = planFor(st, today, null, i);
      return p.isRest ? null : p.estimate;
    }).filter(x => x !== null);
    dur.push(mins.length ? [Math.min(...mins), Math.max(...mins)] : [0, 0]);
  }

  // сколько тренировок до конца лестниц
  let sessionsToFinish = 0;
  for (const sl of prog.days.flatMap(d => d.slots)) {
    const tr = TRACKS[sl.track];
    const inCycle = prog.days.filter(d => d.slots.some(x => x.ex === sl.ex && x.track === sl.track)).length;
    const perWeek = (inCycle * 7) / prog.days.length;
    const base = tr.winsNeeded ?? 2;
    const eff = tr.fixedPace ? base : Math.max(1, Math.round(base * Math.min(perWeek, 3) / 3));
    const need = (tr.steps.length - 1) * eff;
    const weeks = perWeek ? need / perWeek : Infinity;
    sessionsToFinish = Math.max(sessionsToFinish, weeks);
  }

  // влезает ли в 25 минут и что теряет
  const st25 = atStep(mkState(pid, 25), pid, 99);
  const p25 = prog.days.map((d, i) => planFor(st25, today, null, i)).filter(p => !p.isRest);
  const over = p25.filter(p => p.overBudget).length;

  rows.push({ pid, name: prog.name, workDays, restDays,
    старт: dur[0], финал: dur[1], недельДоКонца: Math.round(sessionsToFinish),
    неВлезает: over, всегоДней: p25.length });
}

for (const r of rows) {
  console.log(`\n${r.name}  [${r.pid}]`);
  console.log(`  дней работы в цикле: ${r.workDays} из ${r.workDays + r.restDays}`);
  console.log(`  длительность: старт ${r.старт[0]}–${r.старт[1]} мин → финал ${r.финал[0]}–${r.финал[1]} мин`);
  console.log(`  пройти лестницы целиком: ~${r.недельДоКонца} недель`);
  if (r.неВлезает) console.log(`  ⚠️ в 25 минут не влезает: ${r.неВлезает} из ${r.всегоДней} дней (на финальных ступенях)`);
  if (r.финал[1] > 60) console.log(`  ⚠️ финальные сессии дольше часа: ${r.финал[1]} мин`);
  if (r.недельДоКонца > 40) console.log(`  ⚠️ лестница очень длинная: ~${r.недельДоКонца} недель до конца`);
  if (r.недельДоКонца < 4) console.log(`  ⚠️ лестница короткая: закончится за ~${r.недельДоКонца} недель`);
}

console.log('\n' + '═'.repeat(74));
console.log('ЧАСТЬ 3. СКОРОСТЬ ПРОГРЕССА ПО КАЖДОМУ ДВИЖЕНИЮ');
console.log('═'.repeat(74));
console.log('Ступеней много, а движение в программе редкое — лестница не кончится никогда.\n');

for (const [pid, prog] of Object.entries(PROGRAMS)) {
  const seen = new Map();
  for (const day of prog.days) for (const sl of day.slots) {
    const key = sl.ex + '|' + sl.track;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const lines = [];
  for (const [key, perWeek] of seen) {
    const [ex, track] = key.split('|');
    const tr = TRACKS[track];
    const perWeekReal = (perWeek * 7) / prog.days.length;
    const base = tr.winsNeeded ?? 2;
    // та же формула, что в движке: подтверждения меряются неделями
    const eff = tr.fixedPace ? base : Math.max(1, Math.round(base * Math.min(perWeekReal, 3) / 3));
    const need = (tr.steps.length - 1) * eff;
    const weeks = need / perWeekReal;
    // осознанно заданный темп не считаем проблемой
    const flag = weeks > 30 ? ' ⚠️ практически недостижимо'
               : (weeks < 3 && !tr.fixedPace) ? ' ⚠️ слишком быстро'
               : tr.fixedPace ? ' (темп задан программой)' : '';
    lines.push(`    ${EXERCISES[ex].short.padEnd(14)} ${perWeekReal.toFixed(1)}×/нед · ${tr.steps.length} ступеней · подтверждений ${eff} · ~${Math.round(weeks)} нед${flag}`);
  }
  console.log(`  ${prog.name}`);
  console.log(lines.join('\n'));
}
