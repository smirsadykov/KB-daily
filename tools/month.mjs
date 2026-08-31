// Прогон месяца по каждой программе. Проверяет не «падает ли код»,
// а осмысленно ли то, что приложение выдаёт человеку день за днём.
// Цикл считается настоящим движком (resolveCycle), поэтому даты берутся
// в прошлом — иначе движок уходит в ветку «планируем наперёд».
// Запуск: node tools/month.mjs
import { planFor, applySession, summarizeItem, estimateMinutes, resolveCycle } from '../js/progression.js';
import { EXERCISES, PROGRAMS, TRACKS } from '../js/data.js';

const D = 86400000;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const ДНЕЙ = 30;
const проблемы = [];
const баг = (pid, тип, текст) => проблемы.push({ pid, тип, текст });

const ПРОФИЛИ = {
  'идеальный':    { пропуск: 0,    rpe: () => 7, недоделал: 0 },
  'реалистичный': { пропуск: 0.25, rpe: (r) => [6, 7, 7, 8][Math.floor(r * 4)], недоделал: 0.1 },
  'тяжело идёт':  { пропуск: 0.15, rpe: () => 9, недоделал: 0.4 },
  'слишком легко':{ пропуск: 0,    rpe: () => 5, недоделал: 0 }
};

function прогон(pid, профиль, seed = 7) {
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;

  // окно целиком в прошлом, чтобы работал настоящий resolveCycle
  const t0 = new Date(Date.now() - (ДНЕЙ + 2) * D);
  const st = {
    settings: { programId: pid, startDate: iso(t0), bells: [16, 24, 32], pairs: [16, 24],
                cyclePos: 0, cycleDate: iso(t0), warmup: true, cooldown: true, tgu: pid === 's_and_s',
                deloadEvery: 6 },
    progress: Object.fromEntries(Object.keys(EXERCISES).filter(k => EXERCISES[k].kind !== 'mobility')
      .map(k => [k, { weight: 24, step: 0, steps: {}, wins: 0, fails: 0 }])),
    sessions: []
  };
  const п = ПРОФИЛИ[профиль];
  const журнал = [];
  const весПоТреку = {};
  const объёмПоНеделям = {};
  const виденныеДни = new Set();
  let итогНедели = null;
  let предложений = 0;
  // ступень со значением 0 заводится при первом разборе — это не изменение
  const снимокНагрузки = (s) => JSON.stringify(Object.entries(s.progress)
    .map(([k, v]) => [k, v.weight, Object.entries(v.steps || {}).filter(([, x]) => x !== 0).sort()]));
  let нагрузкаБыла = null;
  const объёмПоДням = {};
  const всегоДней = PROGRAMS[pid].days.length;

  нагрузкаБыла = снимокНагрузки(st);
  for (let d = 0; d < ДНЕЙ; d++) {
    const дата = iso(new Date(t0.getTime() + d * D));
    const неделя = Math.floor(d / 7);
    let pos, plan;
    try {
      pos = resolveCycle(st, дата);
      plan = planFor(st, дата, null);
    } catch (e) { баг(pid, 'падение', `${профиль}, день ${d}: ${e.message}`); break; }

    const деньПрограммы = PROGRAMS[pid].days[pos];
    if (!деньПрограммы) { баг(pid, 'цикл', `${профиль}, день ${d}: позиция ${pos} вне цикла из ${всегоДней}`); break; }
    виденныеДни.add(pos);

    if (plan.isRest) {
      if (деньПрограммы.focus !== 'rest') баг(pid, 'цикл', `${профиль}, день ${d}: план говорит «отдых», а в программе день «${деньПрограммы.focus}»`);
      журнал.push({ d, тип: 'отдых', pos });
      continue;
    }
    if (деньПрограммы.focus === 'rest') баг(pid, 'цикл', `${профиль}, день ${d}: программа даёт отдых, а план выдал тренировку`);

    // ── качество плана ──
    let заДень = 0;
    if (!plan.items.length) { баг(pid, 'пустой план', `${профиль}, день ${d}: рабочий день без упражнений`); }
    for (const it of plan.items) {
      if (!it.sets.length) баг(pid, 'пустое упражнение', `${профиль}: ${it.exId} без подходов`);
      for (const set of it.sets) {
        if (!st.settings.bells.includes(set.weight)) баг(pid, 'вес', `${профиль}: ${it.exId} вес ${set.weight} кг, которого нет в наборе`);
        if (!set.reps && !set.sec) баг(pid, 'подход', `${профиль}: ${it.exId} подход без повторов и без времени`);
      }
      const L = it.sets.filter(x => x.side === 'L').length, R = it.sets.filter(x => x.side === 'R').length;
      if (L !== R) баг(pid, 'стороны', `${профиль}: ${it.exId} L=${L} R=${R}`);
      if (!it.scheme || it.scheme === '—') баг(pid, 'подпись', `${профиль}: ${it.exId} без подписи схемы`);

      const key = it.exId + '|' + it.trackId;
      const было = весПоТреку[key];
      if (было && было !== it.weight) {
        const i1 = st.settings.bells.indexOf(было), i2 = st.settings.bells.indexOf(it.weight);
        if (Math.abs(i1 - i2) > 1) баг(pid, 'скачок веса', `${профиль}: ${it.exId} ${было} → ${it.weight} кг за один шаг`);
        // после сброса веса ступень не должна возвращать более тяжёлую гирю
        if (i2 < i1) {
          const tr = TRACKS[it.trackId];
          const шаг = tr?.steps?.[it.step];
          if (шаг && (шаг.swapIn || шаг.heavy)) баг(pid, 'откат', `${профиль}: ${it.exId} сбросили до ${it.weight} кг, но ступень возвращает ${было} кг`);
        }
      }
      весПоТреку[key] = it.weight;

      const тоннаж = it.sets.reduce((a, x) => a + (x.reps || 0) * x.weight, 0);
      объёмПоНеделям[неделя] = (объёмПоНеделям[неделя] || 0) + тоннаж;
      заДень += тоннаж;
    }
    (объёмПоДням[деньПрограммы.id] ||= []).push(заДень);

    const мин = estimateMinutes(plan);
    if (мин < 3) баг(pid, 'длительность', `${профиль}, день ${d}: ${мин} мин — подозрительно мало`);
    if (мин > 90) баг(pid, 'длительность', `${профиль}, день ${d}: ${мин} мин — подозрительно много`);
    // время задаёт программа: план обязан укладываться в объявленное ею окно
    const окно = (PROGRAMS[pid].tag.match(/(\d+)(?:\s*→\s*(\d+))?\s*мин/) || []).slice(1).filter(Boolean).map(Number);
    const верх = окно[окно.length - 1];
    if (верх && мин > верх) баг(pid, 'дольше обещанного', `${профиль}, день ${d}: ${мин} мин, а программа обещает не больше ${верх}`);

    if (rnd() < п.пропуск) { журнал.push({ d, тип: 'пропуск', pos, dayId: деньПрограммы.id }); continue; }

    const entries = plan.items.map(it => {
      const доля = rnd() < п.недоделал ? 0.6 : 1;
      const делать = Math.max(1, Math.round(it.sets.length * доля));
      it.sets.forEach((x, i) => { if (i < делать) { x.done = true; x.actualReps = x.reps; } });
      const sum = summarizeItem(it);
      return { exId: it.exId, trackId: it.trackId, kind: it.kind, weight: it.weight,
               plannedSets: sum.totalSets, doneSets: sum.doneSets, doneReps: sum.doneReps, doneSec: sum.doneSec,
               complete: sum.complete, maxStep: it.maxStep,
               rpe: п.rpe(rnd()), perCycle: it.perCycle, cycleDays: it.cycleDays };
    });
    const session = { id: d, date: дата, deload: plan.deload, entries, durationMin: мин, sessionRpe: 7, estimateMin: мин };
    let изменения = [];
    try { изменения = applySession(st, session) || []; }
    catch (e) { баг(pid, 'падение', `${профиль}, день ${d}: applySession — ${e.message}`); break; }
    предложений += изменения.filter(c => c.apply).length;
    // приложение не имеет права само двигать вес или ступень
    const слепок = снимокНагрузки(st);
    if (слепок !== нагрузкаБыла) {
      баг(pid, 'нагрузка сама', `${профиль}, день ${d}: вес или ступень изменились без участия человека`);
      нагрузкаБыла = слепок;
    }
    st.sessions.push(session);
    журнал.push({ d, тип: 'сделал', pos, dayId: деньПрограммы.id, мин });
  }

  // ── итоги месяца ──
  const сделано = журнал.filter(x => x.тип === 'сделал');
  const отдых = журнал.filter(x => x.тип === 'отдых');
  const пропуск = журнал.filter(x => x.тип === 'пропуск');

  if (!сделано.length) баг(pid, 'месяц', `${профиль}: за месяц ни одной тренировки`);
  if (виденныеДни.size < всегоДней) {
    const нет = PROGRAMS[pid].days.map((x, i) => i).filter(i => !виденныеДни.has(i));
    баг(pid, 'недостижимый день', `${профиль}: за месяц ни разу не выпали дни ${нет.join(', ')} из ${всегоДней}`);
  }
  // пропущенная тренировка не должна теряться — она обязана повториться назавтра
  for (const пр of пропуск) {
    const завтра = журнал.find(x => x.d === пр.d + 1);
    if (завтра && завтра.тип !== 'отдых' && завтра.dayId !== пр.dayId) {
      баг(pid, 'потерянный день', `${профиль}: пропустил «${пр.dayId}» в день ${пр.d}, назавтра выдали «${завтра.dayId}»`);
    }
  }
  // прогрессия: приложение её предлагает, а не делает
  const шаги = Object.entries(st.progress).flatMap(([ex, p]) => Object.entries(p.steps || {}).map(([tr, v]) => ({ ex, tr, v })));
  if (профиль === 'слишком легко' && сделано.length > 6 && предложений === 0) {
    баг(pid, 'прогрессия', 'слишком легко: за месяц ни одного предложения прибавить');
  }
  if (профиль === 'тяжело идёт' && сделано.length > 6 && предложений === 0) {
    баг(pid, 'прогрессия', 'тяжело идёт: за месяц ни одного предложения убавить');
  }
  if (профиль === 'идеальный') {
    // только полные недели: в 30 днях последняя «неделя» — это два дня
    const полные = [0, 1, 2, 3].map(i => объёмПоНеделям[i] || 0);
    const [п1, , , п4] = полные;
    // сравниваем одинаковые дни цикла: календарная неделя режет длинный цикл неровно
    for (const [dayId, ряд] of Object.entries(объёмПоДням)) {
      if (ряд.length < 4) continue;
      const начало = ряд.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
      const конец = ряд.slice(-2).reduce((a, b) => a + b, 0) / 2;
      if (начало && конец < начало * 0.85) баг(pid, 'объём падает', `идеальный: день «${dayId}» ${Math.round(начало)} → ${Math.round(конец)} кг тоннажа`);
    }
    if (п1 && п4 > п1 * 3) баг(pid, 'объём растёт слишком быстро', `идеальный: тоннаж по неделям ${полные.map(x => Math.round(x/1000)+'т').join(' → ')}`);
    итогНедели = полные;
  }
  return { сделано: сделано.length, отдых: отдых.length, пропуск: пропуск.length,
           недели: итогНедели, ступени: шаги, мин: сделано.reduce((a, x) => a + x.мин, 0) };
}

console.log('═'.repeat(78));
console.log(`ПРОГОН ${ДНЕЙ} ДНЕЙ · ${Object.keys(PROGRAMS).length} программ · 4 профиля поведения`);
console.log('═'.repeat(78));
for (const pid of Object.keys(PROGRAMS)) {
  console.log(`\n${PROGRAMS[pid].name}`);
  for (const профиль of Object.keys(ПРОФИЛИ)) {
    const r = прогон(pid, профиль);
    const ступ = r.ступени.length ? Math.max(...r.ступени.map(x => x.v)) + 1 : 1;
    const тонн = r.недели ? '  тоннаж по неделям: ' + r.недели.map(x => Math.round(x / 100) / 10 + 'т').join(' → ') : '';
    console.log(`  ${профиль.padEnd(14)} тренировок ${String(r.сделано).padStart(2)} · отдых ${String(r.отдых).padStart(2)} · пропуск ${String(r.пропуск).padStart(2)} · ${String(r.мин).padStart(3)} мин · верх лестницы ${ступ}`);
    if (тонн) console.log(тонн);
  }
}

console.log('\n' + '═'.repeat(78));
console.log(проблемы.length ? `НАЙДЕНО ПРОБЛЕМ: ${проблемы.length}` : '✓ ПРОБЛЕМ НЕ НАЙДЕНО');
console.log('═'.repeat(78));
const поТипам = {};
for (const p of проблемы) (поТипам[p.тип] ||= []).push(p);
for (const [тип, список] of Object.entries(поТипам)) {
  const seen = new Set();
  const уник = список.map(x => `${x.pid}: ${x.текст}`).filter(t => {
    const k = t.replace(/день \d+/, 'день N'); if (seen.has(k)) return false; seen.add(k); return true;
  });
  console.log(`\n[${тип}] всего ${список.length}, разных ${уник.length}`);
  уник.slice(0, 8).forEach(x => console.log('   ' + x));
  if (уник.length > 8) console.log(`   … и ещё ${уник.length - 8}`);
}
