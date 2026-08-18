// Движок прогрессии: что делать сегодня и что менять после тренировки.
import { EXERCISES, PROGRAMS, TRACKS, waveFor, WARMUP, COOLDOWN } from './data.js';
import { nextBell, prevBell, todayISO } from './store.js';

const DAY = 86400000;

export function daysSince(startISO, dateISO) {
  const a = new Date(startISO + 'T00:00:00');
  const b = new Date(dateISO + 'T00:00:00');
  return Math.max(0, Math.round((b - a) / DAY));
}

export function weekIndex(state, dateISO = todayISO()) {
  return Math.floor(daysSince(state.settings.startDate, dateISO) / 7);
}

export function wave(state, dateISO = todayISO()) {
  return waveFor(weekIndex(state, dateISO), state.settings.deloadEvery ?? 6);
}

export function waveIndex(state, dateISO = todayISO()) {
  return wave(state, dateISO).index;
}

export function isDeload(state, dateISO = todayISO()) {
  return wave(state, dateISO).deload;
}

export function dayIndex(state, dateISO = todayISO()) {
  const prog = PROGRAMS[state.settings.programId];
  return daysSince(state.settings.startDate, dateISO) % prog.days.length;
}

// ── Готовность ───────────────────────────────────────────────────────────────
// Три вопроса по 5 баллов. Чем хуже — тем меньше объёма.
export function readinessMult(r) {
  if (!r) return 1;
  const score = (r.sleep + r.soreness + r.energy) / 3;
  if (score < 2.0) return 0.5;
  if (score < 2.7) return 0.7;
  if (score < 3.4) return 0.85;
  if (score < 4.3) return 1.0;
  return 1.1;
}

export function readinessLabel(r) {
  const m = readinessMult(r);
  if (m <= 0.5) return { text: 'Плохо. Сегодня только лёгкое движение', tone: 'bad' };
  if (m <= 0.7) return { text: 'Так себе. Урезал объём', tone: 'warn' };
  if (m <= 0.85) return { text: 'Нормально. Чуть меньше обычного', tone: 'warn' };
  if (m <= 1.0) return { text: 'Хорошо. Работаем по плану', tone: 'ok' };
  return { text: 'Отлично. Можно чуть добавить', tone: 'ok' };
}

// ── Построение тренировки ────────────────────────────────────────────────────
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function expandSets(exId, ex, step, kind, weight, mult, bells = [], track = {}, doubles = false) {
  const sets = [];
  const push = (o) => sets.push({ id: sets.length, weight, done: false, ...o });
  const sideFor = (i) => ex.side === 'each' ? (i % 2 === 0 ? 'L' : 'R') : null;

  if (kind === 'ballistic') {
    let n = clamp(Math.round(step.sets * mult), 2, 14);
    // swapIn: столько подходов делается уже следующей гирей
    const heavier = step.swapIn ? (nextBell(weight, bells) ?? weight) : null;
    const heavyN = step.swapIn ? Math.min(step.swapIn, n) : 0;
    // при работе на каждую сторону подходов должно быть чётное число,
    // иначе одна рука получит больше работы
    if (ex.side === 'each' && n % 2 !== 0) n += 1;
    for (let i = 0; i < n; i++) push({ reps: step.reps, side: sideFor(i), weight: i < heavyN ? heavier : weight });
    return { sets, rest: step.rest, emom: step.emom || null, heavy: heavyN };
  }
  if (kind === 'ladder') {
    const n = clamp(Math.round(step.ladders * mult), 1, 7);
    for (let l = 0; l < n; l++) {
      for (const r of step.rungs) {
        if (ex.side === 'each') { push({ reps: r, side: 'L', rung: r }); push({ reps: r, side: 'R', rung: r }); }
        else push({ reps: r, rung: r });
      }
    }
    return { sets, rest: step.rest, emom: null, ladders: n, rungs: step.rungs };
  }
  if (kind === 'reps') {
    const n = clamp(Math.round(step.sets * mult), 1, 8);
    for (let i = 0; i < n; i++) {
      if (ex.side === 'each') { push({ reps: step.reps, side: 'L' }); push({ reps: step.reps, side: 'R' }); }
      else push({ reps: step.reps });
    }
    return { sets, rest: step.rest, emom: null };
  }
  if (kind === 'time') {
    const n = clamp(Math.round(step.sets * mult), 1, 8);
    for (let i = 0; i < n; i++) {
      if (ex.side === 'each') { push({ sec: step.sec, side: 'L' }); push({ sec: step.sec, side: 'R' }); }
      else push({ sec: step.sec });
    }
    return { sets, rest: step.rest, emom: null };
  }
  // Замена по одному подходу (Simple & Sinister): объём фиксирован,
  // растёт доля подходов, сделанных целевой гирей. Остальные — предыдущей.
  if (kind === 'swap') {
    const total = track.sets || 10;
    const lighter = prevBell(weight, bells) ?? weight;
    // на плохой день сначала убираем тяжёлые подходы, а не объём
    let heavy = clamp(Math.round((step.heavy ?? 0) * Math.min(mult, 1)), 0, total);
    let n = total;
    if (mult < 0.7) { n = Math.max(4, Math.round(total * mult)); heavy = Math.min(heavy, n); }
    if (ex.side === 'each' && n % 2 !== 0) n += 1;
    for (let i = 0; i < n; i++) {
      push({ reps: track.reps ?? 10, side: sideFor(i), weight: i < heavy ? weight : lighter });
    }
    return { sets, rest: step.rest ?? 60, emom: step.interval || null, heavy, total: n };
  }

  // Гиревой спорт: сет задаётся временем и темпом подъёмов в минуту
  if (kind === 'interval') {
    const n = clamp(Math.round(step.sets * mult), 1, 6);
    for (let i = 0; i < n; i++) {
      push({ sec: step.min * 60, rpm: step.rpm, reps: Math.round(step.min * step.rpm), gs: true });
    }
    return { sets, rest: step.rest, emom: null };
  }

  if (kind === 'emom') {
    let n = clamp(Math.round(step.sets * mult), 2, 16);
    // Если этот вес есть парой — делаем как в оригинале, двумя гирями сразу,
    // и круг не делится на стороны. Иначе круг идёт на каждую сторону,
    // и тогда число кругов должно быть чётным, чтобы руки получили поровну.
    if (!doubles && ex.side === 'each' && n % 2 !== 0) n += 1;
    // один круг комплекса = 2 заброса + 1 жим + 3 приседа (соотношение Дэна Джона)
    for (let i = 0; i < n; i++) {
      push({ reps: 1, side: doubles ? null : sideFor(i), complex: true,
             doubled: doubles, complexReps: '2 заброса · 1 жим · 3 приседа' });
    }
    return { sets, rest: 0, emom: step.emom, doubled: doubles };
  }
  return { sets, rest: 60, emom: null };
}

function ladderWord(n) {
  const m = n % 100, k = n % 10;
  if (m > 10 && m < 20) return 'лестниц';
  if (k === 1) return 'лестница';
  if (k > 1 && k < 5) return 'лестницы';
  return 'лестниц';
}

function schemeText(kind, step, item) {
  // подходы на левую и правую — это один подход схемы, а не два,
  // иначе «3 × 45 сек на сторону» превращается в мнимые «6 × 45 сек»
  const sides = item.sets.some(s => s.side) ? 2 : 1;
  const perSide = sides === 2 ? ' на сторону' : '';
  if (kind === 'ballistic') return `${item.sets.length} × ${step.reps}` + (item.heavy ? `, из них ${item.heavy} новым весом` : '');
  if (kind === 'ladder') return `${item.ladders} ${ladderWord(item.ladders)} ${step.rungs.join('-')}`;
  if (kind === 'reps') return `${item.sets.length / sides} × ${step.reps}${perSide}`;
  if (kind === 'time') return `${item.sets.length / sides} × ${step.sec} сек${perSide}`;
  if (kind === 'emom') return `${item.sets.length} кругов, каждые ${step.emom} сек` + (item.doubled ? ' · двумя гирями' : ' · на каждую сторону');
  if (kind === 'swap') {
    const base = `${item.sets.length} × ${step.reps ?? 10}`;
    if (step.interval) return `${base} · ${step.label || 'на время'}`;
    return item.heavy > 0 ? `${base}, из них ${item.heavy} целевым весом` : base;
  }
  if (kind === 'interval') return `${item.sets.length} × ${step.min} мин @ ${step.rpm} подъёмов в минуту`;
  return '';
}

// ── Бюджет времени ───────────────────────────────────────────────────────────
// Реальная тренировка почти целиком состоит из отдыха: чистой работы в 38-минутной
// сессии минут девять. Поэтому укладываемся в бюджет по порядку уступок,
// от самых дешёвых к самым дорогим:
//   1. пары (пока отдыхает одно движение, работает другое) — не стоит ничего
//   2. сокращение отдыха до разумного минимума
//   3. урезание подсобки
//   4. и только в последнюю очередь — объём основного движения

// Время работы в подходе. Числа выверены по известным ориентирам, а не на глаз:
//   10 махов одной рукой  ≈ 20 сек  (S&S: 10×10 с отдыхом 60 сек укладывается в ~13 мин)
//   ступень лестницы 1-2-3 ≈ 6-12 сек (заброс 2,5 + жимы по 2,5 + постановка)
//   гоблет-присед с паузой ≈ 3 сек на повтор
// Завышать здесь опаснее, чем занижать: из-за этого бюджет времени срезает объём,
// который на самом деле влезал бы.
const SET_WORK = (item, s) => {
  if (item.kind === 'ballistic') return (s.reps || 0) * 1.5 + 5;
  if (item.kind === 'ladder') return (s.reps || 0) * 2.5 + 4;   // заброс, жимы, постановка
  if (item.kind === 'reps') return (s.reps || 0) * 3 + 5;
  if (item.kind === 'time') return (s.sec || 0) + 5;            // взять и поставить гири
  if (item.kind === 'emom') return item.emom || 60;
  if (item.kind === 'swap') return (s.reps || 0) * (s.reps > 5 ? 1.5 : 12) + 5;  // махи против подъёмов
  if (item.kind === 'interval') return (s.sec || 0) + 10;
  return 30;
};

// Переход между упражнениями: дойти, сменить гирю, перестроиться
const SWITCH = 20;

// Ниже этих значений отдых перестаёт быть отдыхом: жим превращается
// в выносливость, а махи — в кашу по технике.
const REST_FLOOR = { ballistic: 30, ladder: 45, reps: 45, time: 30, emom: 0, swap: 30, interval: 120 };

export function estimateSeconds(plan) {
  let sec = plan.warmup.length ? 240 : 0;
  sec += plan.cooldown?.length ? 90 : 0;          // заминку тоже делаешь, её надо считать
  const paired = new Set();
  for (const p of plan.pairs || []) { paired.add(p.a); paired.add(p.b); }
  let blocks = 0;

  for (const p of plan.pairs || []) {
    const a = plan.items[p.a], b = plan.items[p.b];
    if (!a || !b) continue;
    blocks++;
    const work = [a, b].reduce((t, it) => t + it.sets.reduce((x, s) => x + SET_WORK(it, s), 0), 0);
    // пауза стоит между подходами, а не после последнего
    const gaps = Math.max(0, a.sets.length + b.sets.length - 1);
    sec += work + gaps * p.rest;
  }

  plan.items.forEach((it, i) => {
    if (paired.has(i)) return;
    blocks++;
    if (it.emom) { sec += it.sets.length * it.emom; return; }
    // подходы на левую и правую идут парой — отдыхаешь один раз на обе
    const sides = it.kind !== 'ballistic' && it.sets.some(s => s.side);
    it.sets.forEach((s, k) => {
      sec += SET_WORK(it, s);
      if (k < it.sets.length - 1 && (!sides || k % 2 === 1)) sec += it.rest || 45;
    });
  });

  sec += Math.max(0, blocks - 1) * SWITCH;
  return Math.round(sec * (plan.paceFactor || 1));
}

// Средний отдых, который реально достаётся каждому движению в паре.
// Нужен, чтобы видеть: короткая пауза не значит короткий отдых.
export function pairRealRest(plan, p) {
  const a = plan.items[p.a], b = plan.items[p.b];
  if (!a || !b) return {};
  const work = [a, b].reduce((t, it) => t + it.sets.reduce((x, s) => x + SET_WORK(it, s), 0), 0);
  const cycle = work + (a.sets.length + b.sets.length - 1) * p.rest;
  const per = (it, n) => Math.round(cycle / n - it.sets.reduce((x, s) => x + SET_WORK(it, s), 0) / n);
  return { a: per(a, a.sets.length), b: per(b, b.sets.length) };
}

// Личный темп: сравниваем прогноз с реально записанным временем.
// У всех разный темп между подходами, и через несколько тренировок
// приложение начинает считать по твоему, а не по среднему.
export function paceFactor(sessions) {
  const rows = (sessions || [])
    .filter(s => s.type !== 'rest' && s.estimateMin > 0 && s.durationMin > 0 &&
                 s.entries?.length && s.entries.every(e => e.complete))
    .slice(-8);
  if (rows.length < 3) return 1;
  const r = rows.map(s => s.durationMin / s.estimateMin).sort((x, y) => x - y);
  const mid = Math.floor(r.length / 2);
  const med = r.length % 2 ? r[mid] : (r[mid - 1] + r[mid]) / 2;
  return Math.max(0.7, Math.min(1.5, Math.round(med * 100) / 100));
}

export function estimateMinutes(plan) {
  return Math.max(5, Math.round(estimateSeconds(plan) / 60));
}

// Два движения можно ставить в пару, если у них разные основные паттерны.
// Оговорка, которую важно не замалчивать: «разные паттерны» не значит
// «совсем не мешают друг другу». Махи и заброс с жимом оба держатся на хвате,
// и заброс — тоже тазовый шарнир. В паре первым сдастся хват, а не бёдра.
// Это осознанный размен: без пар в 25 минут не уложиться, но пользователю
// об этом говорится прямо, а не подаётся как бесплатный обед.
function canPair(a, b) {
  if (!a || !b) return false;
  if (a.kind === 'emom' || b.kind === 'emom') return false;
  if (a.kind === 'time' || b.kind === 'time') return false;
  // в гиревом спорте сет задан временем и темпом, в S&S объём фиксирован
  // программой — пары там ломают саму суть, а не экономят время
  if (['interval', 'swap'].includes(a.kind) || ['interval', 'swap'].includes(b.kind)) return false;
  const pa = EXERCISES[a.exId]?.pattern, pb = EXERCISES[b.exId]?.pattern;
  return pa && pb && pa !== pb;
}

// Чередование подходов: на каждый подход первого движения приходится
// столько подходов второго, чтобы оба закончились одновременно.
function interleave(aLen, bLen) {
  const order = [];
  let done = 0;
  for (let k = 0; k < aLen; k++) {
    order.push({ side: 'a', idx: k });
    const target = Math.round(((k + 1) / aLen) * bLen);
    while (done < target) { order.push({ side: 'b', idx: done }); done++; }
  }
  while (done < bLen) { order.push({ side: 'b', idx: done }); done++; }
  return order;
}

function dropRound(item) {
  // объём S&S и длительность сета в гиревом спорте — это и есть программа,
  // резать их ради минут значит подменить её другой программой
  if (item.kind === 'swap' || item.kind === 'interval') return false;
  // снимаем не отдельный подход, а целый круг: лестницу целиком
  // или пару подходов на левую и правую, иначе стороны разъедутся
  if (item.kind === 'ladder' && item.rungs) {
    const perLadder = item.rungs.length * (item.sets.some(s => s.side) ? 2 : 1);
    if (item.sets.length - perLadder < perLadder) return false;
    item.sets = item.sets.slice(0, item.sets.length - perLadder);
    item.ladders = Math.max(1, (item.ladders || 1) - 1);
    return true;
  }
  const chunk = item.sets.some(s => s.side) ? 2 : 1;
  const min = item.kind === 'ballistic' ? 4 : 2;
  if (item.sets.length - chunk < min) return false;
  item.sets = item.sets.slice(0, item.sets.length - chunk);
  return true;
}

// Подпись вида «8 × 10» пересчитывается по фактическим подходам
function refreshScheme(item) {
  const sides = item.sets.some(s => s.side) ? 2 : 1;
  const first = item.sets[0];
  if (!first) { item.scheme = '—'; return; }
  const perSide = sides === 2 ? ' на сторону' : '';
  if (item.kind === 'ballistic') item.scheme = `${item.sets.length} × ${first.reps}` + (item.heavy ? `, из них ${item.heavy} новым весом` : '');
  else if (item.kind === 'ladder') item.scheme = `${item.ladders} ${ladderWord(item.ladders)} ${(item.rungs || []).join('-')}`;
  else if (item.kind === 'reps') item.scheme = `${item.sets.length / sides} × ${first.reps}${perSide}`;
  else if (item.kind === 'time') item.scheme = `${item.sets.length / sides} × ${first.sec} сек${perSide}`;
  else if (item.kind === 'emom') item.scheme = `${item.sets.length} кругов`;
  else if (item.kind === 'swap') {
    const base = `${item.sets.length} × ${first.reps}`;
    // на ступени норматива важен режим времени, а не сколько подходов целевым весом
    item.scheme = item.emom ? `${base} · ${item.label || 'на время'}`
                : item.heavy > 0 ? `${base}, из них ${item.heavy} целевым весом` : base;
  }
  else if (item.kind === 'interval') item.scheme = `${item.sets.length} × ${Math.round(first.sec / 60)} мин @ ${first.rpm}`;
}

export function fitToBudget(plan, budgetMin) {
  plan.trims = [];
  plan.pairs = plan.pairs || [];
  if (!budgetMin) { plan.estimate = estimateMinutes(plan); return plan; }
  const budget = budgetMin * 60;
  const over = () => estimateSeconds(plan) > budget;

  // 1. Пары — самая дешёвая экономия, объём не страдает вообще
  if (over()) {
    for (let i = 0; i < plan.items.length && over(); i++) {
      for (let j = i + 1; j < plan.items.length; j++) {
        const used = plan.pairs.some(p => p.a === i || p.b === i || p.a === j || p.b === j);
        if (used || !canPair(plan.items[i], plan.items[j])) continue;
        plan.pairs.push({ a: i, b: j, rest: 25, order: interleave(plan.items[i].sets.length, plan.items[j].sets.length) });
        plan.trims.push(`${plan.items[i].name.toLowerCase()} и ${plan.items[j].name.toLowerCase()} идут в паре`);
        break;
      }
    }
  }

  // 2. Отдых — до пола, ниже которого движение меняет смысл
  let guard = 0;
  while (over() && guard++ < 40) {
    let changed = false;
    for (const p of plan.pairs) {
      if (p.rest > 15) { p.rest -= 5; changed = true; }
    }
    plan.items.forEach((it, i) => {
      if (plan.pairs.some(p => p.a === i || p.b === i)) return;
      // В S&S сокращение отдыха — это не экономия времени, а следующая ступень
      // программы (работа на норматив). Двигать её ради бюджета нельзя.
      // В гиревом спорте отдых между сетами задан задачей сета.
      if (it.kind === 'swap' || it.kind === 'interval') return;
      const floor = REST_FLOOR[it.kind] ?? 45;
      if ((it.rest || 0) > floor) { it.rest = Math.max(floor, it.rest - 15); changed = true; }
    });
    if (!changed) break;
  }
  const shortened = plan.items.some(it => it.rest !== undefined);
  if (shortened && plan.trims.length === 0 && over() === false) { /* отдых уже урезан ниже */ }

  // 3. Подсобка — режем с конца, там переноски и тяги
  guard = 0;
  while (over() && guard++ < 20) {
    let changed = false;
    for (let i = plan.items.length - 1; i > 0; i--) {
      if (plan.pairs.some(p => p.a === i || p.b === i)) continue;
      if (dropRound(plan.items[i])) {
        changed = true;
        if (!plan.trims.some(t => t.includes(plan.items[i].name.toLowerCase() + ':')))
          plan.trims.push(`${plan.items[i].name.toLowerCase()}: меньше подходов`);
        break;
      }
    }
    if (!changed) break;
  }

  // 4. Основное движение — только если иначе никак
  guard = 0;
  while (over() && guard++ < 20) {
    let changed = false;
    for (let i = 0; i < plan.items.length; i++) {
      if (dropRound(plan.items[i])) {
        changed = true;
        const name = plan.items[i].name.toLowerCase();
        if (!plan.trims.some(t => t.startsWith(name + ':'))) plan.trims.push(`${name}: срезал объём, времени не хватало`);
        break;
      }
    }
    if (!changed) break;
  }

  // Пол отдыха должен работать и внутри пар, иначе пара его молча обходит.
  // Исключение — лестницы: короткий отдых между ступенями это их суть
  // (в традиции ступени разделяет ровно то время, пока работает напарник),
  // а полноценный отдых нужен между лестницами целиком.
  for (const p of plan.pairs) {
    let guard2 = 0;
    while (guard2++ < 20) {
      const real = pairRealRest(plan, p);
      const need = [[plan.items[p.a], real.a], [plan.items[p.b], real.b]]
        .some(([it, got]) => it.kind !== 'ladder' && got < (REST_FLOOR[it.kind] ?? 45));
      if (!need) break;
      // добавить отдых нельзя без места во времени — тогда снимаем круг
      if (!dropRound(plan.items[p.a]) && !dropRound(plan.items[p.b])) break;
      p.order = interleave(plan.items[p.a].sets.length, plan.items[p.b].sets.length);
    }
  }

  // Пересобираем подписи и чередование после всех урезаний,
  // иначе на экране останутся числа из исходного плана
  for (const it of plan.items) refreshScheme(it);
  for (const p of plan.pairs) p.order = interleave(plan.items[p.a].sets.length, plan.items[p.b].sets.length);

  plan.estimate = estimateMinutes(plan);
  plan.overBudget = plan.estimate > budgetMin;
  return plan;
}

export function planFor(state, dateISO = todayISO(), readiness = null, dayOverride = null) {
  const prog = PROGRAMS[state.settings.programId];
  const di = dayOverride != null ? dayOverride : dayIndex(state, dateISO);
  const day = prog.days[di];
  const w = wave(state, dateISO);
  const wi = w.index;
  const rMult = readinessMult(readiness);
  const dayMult = day.mult ?? 1;
  const mult = clamp(w.mult * rMult * dayMult, 0.4, 1.25);

  const items = [];
  for (const slot of day.slots) {
    // Турецкие подъёмы включаются только если их включили в настройках
    if (slot.optional === 'tgu' && !state.settings.tgu) continue;
    if (slot.replaces === 'tgu' && state.settings.tgu) continue;

    const ex = EXERCISES[slot.ex];
    const track = TRACKS[slot.track];
    const p = state.progress[slot.ex] || { weight: state.settings.bells[0], step: 0 };
    const stepIdx = clamp(p.steps?.[slot.track] ?? p.step ?? 0, 0, track.steps.length - 1);
    const step = track.steps[stepIdx];
    const hasPair = (state.settings.pairs || []).includes(p.weight);
    const item = expandSets(slot.ex, ex, step, track.kind, p.weight, mult, state.settings.bells, track, hasPair);
    item.exId = slot.ex;
    item.trackId = slot.track;
    item.kind = track.kind;
    item.name = ex.name;
    item.step = stepIdx;
    item.stepTotal = track.steps.length;
    item.weight = p.weight;
    item.scheme = schemeText(track.kind, step, item);
    item.label = step.label || '';
    items.push(item);
  }

  const plan = {
    date: dateISO,
    programId: state.settings.programId,
    programName: prog.name,
    dayIndex: di,
    dayId: day.id,
    dayName: day.name,
    focus: day.focus,
    note: day.note || '',
    waveIndex: wi,
    waveName: w.name,
    waveHint: w.hint,
    deload: w.deload,
    mult: Math.round(mult * 100) / 100,
    readiness,
    warmup: state.settings.warmup ? WARMUP : [],
    cooldown: state.settings.cooldown ? COOLDOWN : [],
    items,
    pairs: [],
    trims: [],
    // темп берём из истории: у всех разная скорость между подходами
    paceFactor: paceFactor(state.sessions),
    isRest: day.focus === 'rest'
  };

  return plan.isRest ? plan : fitToBudget(plan, state.settings.timeBudget);
}

// Описание конкретной ступени словами
export function stepText(trackId, step) {
  const track = TRACKS[trackId];
  if (!track) return '';
  const s = track.steps[clamp(step, 0, track.steps.length - 1)];
  if (!s) return '';
  if (track.kind === 'ballistic') return `${s.sets} × ${s.reps}, отдых ${s.emom ? 'по минуте' : s.rest + ' сек'}`;
  if (track.kind === 'ladder') return `${s.ladders} ${ladderWord(s.ladders)} ${s.rungs.join('-')}`;
  if (track.kind === 'reps') return `${s.sets} × ${s.reps}`;
  if (track.kind === 'time') return `${s.sets} × ${s.sec} сек`;
  if (track.kind === 'emom') return `${s.sets} кругов`;
  return '';
}

// Что будет на следующем шаге — для мотивации на экране прогресса
export function nextStepText(trackId, step) {
  return stepText(trackId, step + 1);
}

// ── Разбор результата и прогрессия ───────────────────────────────────────────
// Правило: два подряд удачных подхода к упражнению (всё сделано + RPE ≤ 7)
// двигают на шаг вперёд. Две неудачи (недоделал или RPE ≥ 9) — шаг назад.
// Вес растёт только когда закончились шаги по объёму и плотности.

export function summarizeItem(item) {
  const doneSets = item.sets.filter(s => s.done);
  const plannedReps = item.sets.reduce((a, s) => a + (s.reps || 0), 0);
  const doneReps = doneSets.reduce((a, s) => a + (s.actualReps ?? s.reps ?? 0), 0);
  const plannedSec = item.sets.reduce((a, s) => a + (s.sec || 0), 0);
  const doneSec = doneSets.reduce((a, s) => a + (s.sec || 0), 0);
  const complete = doneSets.length >= item.sets.length &&
    (plannedReps === 0 || doneReps >= plannedReps * 0.95) &&
    (plannedSec === 0 || doneSec >= plannedSec * 0.95);
  return { doneSets: doneSets.length, totalSets: item.sets.length, doneReps, plannedReps, doneSec, complete };
}

export function applySession(state, session) {
  const changes = [];
  const deload = session.deload;
  for (const entry of session.entries) {
    const p = state.progress[entry.exId];
    const track = TRACKS[entry.trackId];
    if (!p || !track) continue;
    // Ступень своя у каждой лестницы, вес общий у упражнения.
    if (!p.steps) p.steps = {};
    if (p.steps[entry.trackId] === undefined) p.steps[entry.trackId] = clamp(p.step ?? 0, 0, track.steps.length - 1);
    const readStep = () => p.steps[entry.trackId];
    const writeStep = (v) => { p.steps[entry.trackId] = v; p.step = v; };
    const ex = EXERCISES[entry.exId];
    const rpe = entry.rpe ?? 7;

    if (deload) {
      changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: разгрузочная неделя, шаг не меняем` });
      continue;
    }

    if (entry.complete && rpe <= 7) {
      p.wins = (p.wins || 0) + 1;
      p.fails = 0;
    } else if (!entry.complete || rpe >= 9) {
      p.fails = (p.fails || 0) + 1;
      p.wins = 0;
    } else {
      // сделал, но было тяжеловато — стоим на месте
      changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: закрепляем, ещё разок так же` });
      continue;
    }

    const winsNeeded = track.winsNeeded ?? 2;
    if (p.wins >= winsNeeded) {
      p.wins = 0;
      if (readStep() >= track.steps.length - 1) {
        const nb = nextBell(p.weight, state.settings.bells);
        if (nb) {
          p.weight = nb;
          writeStep(track.reset ?? 0);
          changes.push({ exId: entry.exId, type: 'weight-up', text: `${ex.short}: гиря ${nb} кг! Объём сбросили, начинаем заново` });
        } else {
          changes.push({ exId: entry.exId, type: 'max', text: `${ex.short}: потолок по твоим гирям. Нужна следующая гиря` });
        }
      } else {
        writeStep(readStep() + 1);
        changes.push({ exId: entry.exId, type: 'step-up', text: `${ex.short}: шаг вперёд → ${stepText(entry.trackId, readStep())}` });
      }
    } else if (p.fails >= 2) {
      p.fails = 0;
      if (readStep() > 0) {
        writeStep(readStep() - 1);
        changes.push({ exId: entry.exId, type: 'step-down', text: `${ex.short}: откатили на шаг назад, догоним` });
      } else {
        const pb = prevBell(p.weight, state.settings.bells);
        if (pb) {
          p.weight = pb;
          writeStep(Math.max(0, track.steps.length - 3));
          changes.push({ exId: entry.exId, type: 'weight-down', text: `${ex.short}: вернулись на ${pb} кг` });
        } else {
          changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: держим как есть` });
        }
      }
    } else {
      const need = winsNeeded - (p.wins || 0);
      if (p.wins > 0) changes.push({ exId: entry.exId, type: 'progress', text: `${ex.short}: ещё ${need} ${need === 1 ? 'такая тренировка' : 'такие тренировки'} — и шаг вперёд` });
      else changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: повторим то же самое` });
    }
  }
  return changes;
}

// ── Нагрузка и мониторинг ────────────────────────────────────────────────────
export function sessionLoad(session) {
  return Math.round((session.sessionRpe || 6) * (session.durationMin || 15));
}

export function tonnage(session) {
  let t = 0;
  for (const e of session.entries) {
    if (e.kind === 'time') continue;
    t += (e.doneReps || 0) * (e.weight || 0);
  }
  return t;
}

// Отношение свежей нагрузки к привычной (acute:chronic workload ratio).
//
// ВАЖНО про статус этого показателя. Сама нагрузка сессии (RPE × минуты) — это
// метод Фостера, он валидирован как мера внутренней нагрузки. А вот ACWR как
// предиктор травм разгромлен в литературе: Impellizzeri и соавторы (2020) показали
// математическую связанность числителя со знаменателем, произвольность окон 7 и 28
// дней и нестабильность отношения при малом знаменателе; они же требовали отзыва
// исходной фигуры Blanch & Gabbett с «зонами риска».
// Поэтому здесь это НЕ индикатор травмы и не «безопасная зона», а просто
// скорость роста нагрузки: заметить собственный разгон, не более.
export function acwr(sessions, dateISO = todayISO()) {
  const end = new Date(dateISO + 'T00:00:00').getTime();
  const inRange = (s, days) => {
    const t = new Date(s.date + 'T00:00:00').getTime();
    return t <= end && t > end - days * DAY;
  };
  const acute = sessions.filter(s => inRange(s, 7)).reduce((a, s) => a + sessionLoad(s), 0);
  const chronicTotal = sessions.filter(s => inRange(s, 28)).reduce((a, s) => a + sessionLoad(s), 0);
  const chronic = chronicTotal / 4;

  // Пока история короче двух недель, считать это отношение бессмысленно:
  // «привычная нагрузка» ещё не набралась и любой день выглядит скачком.
  const real = sessions.filter(s => s.type !== 'rest');
  const first = real.length ? real.map(s => s.date).sort()[0] : null;
  const daysOfHistory = first ? Math.round((end - new Date(first + 'T00:00:00').getTime()) / DAY) : 0;
  if (real.length < 4 || daysOfHistory < 14 || chronic < 1) {
    return { acute: Math.round(acute), chronic: Math.round(chronic), ratio: null, status: 'new', text: 'Копим историю — считать будет с третьей недели' };
  }
  const ratio = acute / chronic;
  let status = 'ok', text = 'Нагрузка растёт ровно';
  if (ratio > 1.5) { status = 'warn'; text = 'Эта неделя заметно тяжелее привычного'; }
  else if (ratio > 1.3) { status = 'warn'; text = 'Прибавил ощутимо — просто знай об этом'; }
  else if (ratio < 0.6) { status = 'ok'; text = 'Заметно легче обычного'; }
  else if (ratio < 0.8) { status = 'ok'; text = 'Полегче обычного — норма для разгрузки'; }
  return { acute: Math.round(acute), chronic: Math.round(chronic), ratio: Math.round(ratio * 100) / 100, status, text };
}

export function streak(sessions, dateISO = todayISO()) {
  const dates = new Set(sessions.map(s => s.date));
  let n = 0;
  let cur = new Date(dateISO + 'T00:00:00').getTime();
  // сегодня ещё может быть не сделано — не рвём серию из-за этого
  if (!dates.has(todayISO(new Date(cur)))) cur -= DAY;
  while (true) {
    const iso = todayISO(new Date(cur));
    if (dates.has(iso)) { n++; cur -= DAY; } else break;
  }
  return n;
}
