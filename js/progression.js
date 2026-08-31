// Движок прогрессии: что делать сегодня и что менять после тренировки.
import { EXERCISES, PROGRAMS, TRACKS, waveFor, WARMUP, COOLDOWN } from './data.js?v=49';
import { nextBell, prevBell, todayISO } from './store.js?v=49';

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

// ── Положение в цикле программы ──────────────────────────────────────────────
// Программа главнее календаря. Из этого следует три вещи:
//
//   1. День отдыха, предусмотренный программой, обязан состояться —
//      он «проходит» сам собой вместе с календарным днём.
//   2. Если программа отдыха не предусматривает, его и не будет.
//   3. Если тренировки не было в логе, указатель НЕ двигается: завтра
//      выпадет ровно та тренировка, которая должна была быть сегодня.
//
// Раньше день считался от даты старта, и пропуск означал безвозвратно
// потерянную тренировку: пропустил среду — в пятницу цикл уже уехал вперёд.

const addDay = (isoStr, n = 1) => {
  const d = new Date(isoStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return todayISO(d);
};

export function resolveCycle(state, dateISO = todayISO()) {
  const prog = PROGRAMS[state.settings.programId];
  const len = prog.days.length;
  let pos = (state.settings.cyclePos ?? 0) % len;
  let cur = state.settings.cycleDate || state.settings.startDate || dateISO;
  const сегодня = todayISO();

  // Прошедшие дни: рабочий день ждёт, пока его не сделают; день отдыха проходит сам
  let guard = 0;
  while (cur < dateISO && cur < сегодня && guard++ < 3000) {
    const day = prog.days[pos];
    const тренировался = (state.sessions || []).some(s => s.date === cur && s.type !== 'rest');
    if (day.focus === 'rest' || тренировался) pos = (pos + 1) % len;
    cur = addDay(cur);
  }

  // Будущие дни показываем оптимистично: считаем, что всё сделано вовремя
  if (dateISO > сегодня) {
    let d = сегодня > cur ? сегодня : cur;
    let g2 = 0;
    while (d < dateISO && g2++ < 3000) { pos = (pos + 1) % len; d = addDay(d); }
  }
  return pos;
}

export function dayIndex(state, dateISO = todayISO()) {
  return resolveCycle(state, dateISO);
}

// Сохраняем разрешённое положение, чтобы пересчёт не начинался с нуля каждый раз
export function commitCycle(state) {
  const pos = resolveCycle(state, todayISO());
  state.settings.cyclePos = pos;
  state.settings.cycleDate = todayISO();
  return pos;
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
    // потолок выше конца самой длинной лестницы: у A+A это 50 подходов
    let n = clamp(Math.round(step.sets * mult), 2, 100);
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
    // потолок должен быть выше конца самой длинной лестницы этого типа
    const n = clamp(Math.round(step.sets * mult), 1, 24);
    // swapIn: столько кругов уже делается следующей гирей. Нужен там, где
    // диапазон повторов закончился, а прыгать сразу на треть веса нельзя.
    const heavier = step.swapIn ? (nextBell(weight, bells) ?? weight) : null;
    const heavyN = step.swapIn ? Math.min(step.swapIn, n) : 0;
    for (let i = 0; i < n; i++) {
      const w = i < heavyN ? heavier : weight;
      if (ex.side === 'each') { push({ reps: step.reps, side: 'L', weight: w }); push({ reps: step.reps, side: 'R', weight: w }); }
      else push({ reps: step.reps, weight: w });
    }
    return { sets, rest: step.rest, emom: null, heavy: heavyN };
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
    // потолок должен быть выше конца лестницы, иначе последние ступени
    // молча срезаются и до цели программы не дойти
    let n = clamp(Math.round(step.sets * mult), 2, 40);
    // Подпись подхода берём из трека или из ступени: у ABC это состав круга,
    // у Q&D и A/B — название движения, потому что там два движения чередуются.
    const alt = step.alt || track.alt;
    // Если этот вес есть парой — делаем как в оригинале, двумя гирями сразу,
    // и круг не делится на стороны. Иначе круг идёт на каждую сторону,
    // и тогда число кругов должно быть чётным, чтобы руки получили поровну.
    if (!doubles && !alt && ex.side === 'each' && n % 2 !== 0) n += 1;
    // Движения чередуются по кругу, значит число минут обязано делиться на их
    // количество. Иначе первому движению достаётся лишний круг: 13 минут — это
    // 7 подходов махов и только 6 трастеров. Срезаем до целого числа кругов.
    if (alt && alt.length > 1 && n % alt.length !== 0) n = Math.max(alt.length, n - (n % alt.length));
    // swapIn: столько КРУГОВ уже делается следующей гирей — так же, как в дне A
    // программы A/B, где новая пара заходит по одному кругу за раз. У чередующихся
    // движений круг это alt.length минут: иначе тяжёлую гирю получили бы махи,
    // а трастеры так и остались бы на лёгкой.
    const минутВКруге = alt && alt.length > 1 ? alt.length : 1;
    const heavier = step.swapIn ? (nextBell(weight, bells) ?? weight) : null;
    const heavyN = step.swapIn ? Math.min(step.swapIn * минутВКруге, n) : 0;
    for (let i = 0; i < n; i++) {
      // Круг и минута — не одно и то же, когда движения чередуются: круг это
      // минута махов ПЛЮС минута трастеров. Раньше каждая строка подписывалась
      // как «1 круг», и шесть кругов программы выглядели на экране двенадцатью.
      // reps: 1 — это отметка «круг сделан», она не годится для тоннажа.
      // loadReps — сколько повторов гирей реально в этом подходе.
      const altReps = step.altReps || track.altReps;
      push({ reps: 1, side: doubles || alt ? null : sideFor(i), complex: true,
             doubled: doubles, alt: !!alt, weight: i < heavyN ? heavier : weight,
             round: Math.floor(i / минутВКруге) + 1, rounds: Math.round(n / минутВКруге),
             loadReps: alt ? (altReps ? altReps[i % altReps.length] : 1) : (track.complex?.reps ?? 1),
             complexReps: alt ? alt[i % alt.length] : (track.complex?.label ?? '') });
    }
    return { sets, rest: 0, emom: step.emom, doubled: doubles, alt: !!alt, heavy: heavyN };
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
  if (kind === 'reps') return `${item.sets.length / sides} × ${step.reps}${perSide}` + (item.heavy ? `, из них ${item.heavy} новым весом` : '');
  if (kind === 'time') return step.sec >= 120
    ? `${item.sets.length / sides} × ${Math.round(step.sec / 60)} мин${perSide}`
    : `${item.sets.length / sides} × ${step.sec} сек${perSide}`;
  if (kind === 'emom') {
    const base = `${item.sets.length} ${item.alt ? 'подходов' : 'кругов'}, каждые ${step.emom} сек`;
    if (item.alt) return base + ' · движения чередуются';
    return base + (item.doubled ? ' · двумя гирями' : ' · на каждую сторону');
  }
  if (kind === 'swap') {
    const base = `${item.sets.length} × ${step.reps ?? 10}`;
    if (step.interval) return `${base} · ${step.label || 'на время'}`;
    return item.heavy > 0 ? `${base}, из них ${item.heavy} целевым весом` : base;
  }
  if (kind === 'interval') return `${item.sets.length} × ${step.min} мин @ ${step.rpm} подъёмов в минуту`;
  return '';
}

// ── Оценка длительности ──────────────────────────────────────────────────────
// Реальная тренировка почти целиком состоит из отдыха: чистой работы в 38-минутной
// сессии минут девять. Оценка нужна, чтобы честно показать человеку, во что
// обойдётся день, и чтобы программа могла объявить своё время в карточке.
// Подгонки под заданное пользователем время здесь больше нет: сколько занимает
// тренировка — решает программа.

// Время работы в подходе. Числа выверены по известным ориентирам, а не на глаз:
//   10 махов одной рукой  ≈ 20 сек  (S&S: 10×10 с отдыхом 60 сек укладывается в ~13 мин)
//   ступень лестницы 1-2-3 ≈ 6-12 сек (заброс 2,5 + жимы по 2,5 + постановка)
//   гоблет-присед с паузой ≈ 3 сек на повтор
// Завышать здесь опаснее, чем занижать: программа объявляет своё время по этим
// числам, и завышенная оценка отпугнёт от программы, которая на деле короче.
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
// Пол отдыха: ниже него движение меняет смысл. Используется, чтобы проверить
// реальный отдых внутри парной работы, объём по нему больше не режется.
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
  // трек может запретить пары явно (Easy Strength: там нельзя поднимать пульс)
  if (TRACKS[a.trackId]?.noPair || TRACKS[b.trackId]?.noPair) return false;
  // работа в минутном режиме уже задана таймером, пара её ломает
  if (a.emom || b.emom) return false;
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


// Подпись вида «8 × 10» пересчитывается по фактическим подходам
function refreshScheme(item) {
  const sides = item.sets.some(s => s.side) ? 2 : 1;
  const first = item.sets[0];
  if (!first) { item.scheme = '—'; return; }
  const perSide = sides === 2 ? ' на сторону' : '';
  if (item.kind === 'ballistic') item.scheme = `${item.sets.length} × ${first.reps}` + (item.heavy ? `, из них ${item.heavy} новым весом` : '');
  else if (item.kind === 'ladder') item.scheme = `${item.ladders} ${ladderWord(item.ladders)} ${(item.rungs || []).join('-')}`;
  else if (item.kind === 'reps') item.scheme = `${item.sets.length / sides} × ${first.reps}${perSide}` + (item.heavy ? `, из них ${item.heavy} новым весом` : '');
  else if (item.kind === 'time') item.scheme = first.sec >= 120
    ? `${item.sets.length / sides} × ${Math.round(first.sec / 60)} мин${perSide}`
    : `${item.sets.length / sides} × ${first.sec} сек${perSide}`;
  else if (item.kind === 'emom') {
    // Заход новой гири подписываем так же, как в дне A программы A/B.
    // У чередующихся движений считаем КРУГАМИ: минута махов плюс минута трастеров.
    const кругов = item.alt ? Math.round((item.heavy || 0) / 2) : (item.heavy || 0);
    const заход = кругов ? `, из них ${кругов} ${кругов === 1 ? 'круг' : кругов < 5 ? 'круга' : 'кругов'} новым весом` : '';
    // Считаем кругами, как считает сам источник: шесть кругов, а не двенадцать
    // подходов. Минуты подписываем рядом, потому что отмечать в приложении
    // приходится именно их.
    const круговВсего = item.sets[0]?.rounds || item.sets.length;
    item.scheme = item.alt
      ? `${круговВсего} ${круговВсего === 1 ? 'круг' : круговВсего < 5 ? 'круга' : 'кругов'} · ${item.sets.length} минут · движения чередуются${заход}`
      : `${item.sets.length} кругов` + (item.doubled ? ' · двумя гирями' : ' · на каждую сторону') + заход;
  }
  else if (item.kind === 'swap') {
    const base = `${item.sets.length} × ${first.reps}`;
    // на ступени норматива важен режим времени, а не сколько подходов целевым весом
    item.scheme = item.emom ? `${base} · ${item.label || 'на время'}`
                : item.heavy > 0 ? `${base}, из них ${item.heavy} целевым весом` : base;
  }
  else if (item.kind === 'interval') item.scheme = `${item.sets.length} × ${Math.round(first.sec / 60)} мин @ ${first.rpm}`;
}

// Сборка плана. Времени человек больше не назначает: сколько занимает
// тренировка — решает программа. Здесь ничего не режется, объём ровно тот,
// что предписывает ступень лестницы. Единственное, что делается, — парная
// работа там, где её требует сам источник программы (в «10 000 махов»
// силовое движение выполняется между подходами махов, это часть протокола
// Дэна Джона, а не способ сэкономить минуты).
export function finalizePlan(plan, day) {
  plan.pairs = plan.pairs || [];
  plan.trims = [];

  if (day?.pair) {
    for (let i = 0; i < plan.items.length; i++) {
      for (let j = i + 1; j < plan.items.length; j++) {
        const занят = plan.pairs.some(pp => [pp.a, pp.b].includes(i) || [pp.a, pp.b].includes(j));
        if (занят || !canPair(plan.items[i], plan.items[j])) continue;
        plan.pairs.push({ a: i, b: j, rest: day.pairRest ?? 25, order: interleave(plan.items[i].sets.length, plan.items[j].sets.length) });
        plan.trims.push(`${plan.items[j].name.toLowerCase()} идёт между подходами — так задумано в программе`);
        break;
      }
    }
  }

  for (const it of plan.items) refreshScheme(it);
  for (const pp of plan.pairs) pp.order = interleave(plan.items[pp.a].sets.length, plan.items[pp.b].sets.length);

  plan.estimate = estimateMinutes(plan);
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
  // fixedVolume: у программ, где объём задан источником (A/B — три круга и
  // шесть, Q&D, VWC, «10 000 махов», Easy Strength), предписанное количество
  // это потолок. Волна и самочувствие могут только убавить: раздувать чужой
  // протокол на 20% значит выдавать за него что-то другое.
  // Ограничиваем каждый множитель по отдельности, а не их произведение: иначе
  // в день, который программа сама объявила лёгким (у VWC это 0,7), хорошее
  // самочувствие всё равно добавляло объём сверх задуманного.
  const mult = prog.fixedVolume
    ? clamp(Math.min(w.mult, 1) * Math.min(rMult, 1) * dayMult, 0.4, 1)
    : clamp(w.mult * rMult * dayMult, 0.4, 1.25);

  // Как часто движение встречается в цикле — нужно, чтобы подтверждения
  // считались во времени, а не в тренировках. Движение раз в неделю
  // с лестницей в 14 ступеней иначе не закончится никогда.
  const perCycle = {};
  for (const d of prog.days) for (const sl of d.slots) {
    const k = sl.ex + '|' + sl.track;
    perCycle[k] = (perCycle[k] || 0) + 1;
  }

  const items = [];
  for (const slot of day.slots) {
    // Турецкие подъёмы включаются только если их включили в настройках
    if (slot.optional === 'tgu' && !state.settings.tgu) continue;
    if (slot.replaces === 'tgu' && state.settings.tgu) continue;

    // Двугиревые движения имеют смысл только при наличии пары.
    //
    // Проверять надо НАЛИЧИЕ ПАР ВООБЩЕ, а не совпадение с текущим рабочим
    // весом: стартовый вес берётся из общего набора гирь и парным может
    // не быть. Раньше из-за этого человек с парой 24 получал одногиревую
    // замену только потому, что упражнение стартовало с 16.
    const pairs = state.settings.pairs || [];
    let exId = slot.ex;
    let pairWeight = null;
    if (slot.needsPair) {
      if (!pairs.length) exId = slot.fallback;
      else {
        const p0 = state.progress[slot.ex];
        pairWeight = pairs.includes(p0?.weight)
          ? p0.weight
          : pairs.reduce((b, x) => Math.abs(x - (p0?.weight ?? x)) < Math.abs(b - (p0?.weight ?? b)) ? x : b, pairs[0]);
      }
    }
    const ex = EXERCISES[exId];
    const track = TRACKS[slot.track];
    const p = state.progress[exId] || { weight: state.settings.bells[0], step: 0 };
    const weight = pairWeight ?? p.weight;
    // maxStep: докуда эта программа ведёт движение по лестнице. Нужен там, где
    // лестница общая с другой программой: пять лестниц 1-2-3-4-5 — это «Путь бойца»
    // Павла, а для ежедневной практики такой объём превращает её в полуторачасовую
    // тренировку. Дойдя до потолка, движок переходит на гирю тяжелее и сбрасывает
    // объём — это и есть заявленный порядок «объём → плотность → вес».
    const потолок = Math.min(track.steps.length - 1, slot.maxStep ?? Infinity);
    const stepIdx = clamp(p.steps?.[slot.track] ?? p.step ?? 0, 0, потолок);
    const step = track.steps[stepIdx];
    const hasPair = pairs.includes(weight);
    // Для двугиревой работы лестницей весов служит список пар: подставлять
    // гирю, которой у человека всего одна, бессмысленно. Нет следующей пары —
    // замена просто не произойдёт, и это честнее, чем обещать невозможное.
    const лестницаВесов = hasPair ? pairs : state.settings.bells;
    const item = expandSets(exId, ex, step, track.kind, weight, mult, лестницаВесов, track, hasPair);
    item.exId = exId;
    item.trackId = slot.track;
    item.maxStep = slot.maxStep;
    item.perCycle = perCycle[slot.ex + '|' + slot.track] || 1;
    item.cycleDays = prog.days.length;
    item.kind = track.kind;
    item.name = ex.name;
    item.step = stepIdx;
    item.stepTotal = track.steps.length;
    item.weight = weight;
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

  return plan.isRest ? plan : finalizePlan(plan, day);
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
  if (track.kind === 'emom') {
    // у чередующихся движений круг это несколько минут, а не одна
    const alt = s.alt || track.alt;
    const кругов = alt && alt.length > 1 ? Math.round(s.sets / alt.length) : s.sets;
    const слово = кругов === 1 ? 'круг' : кругов < 5 ? 'круга' : 'кругов';
    // объём ступени в чередующихся лестницах меняется повторами, а не кругами:
    // без них все ступени выглядели бы одинаково
    return alt && alt.length > 1 ? `${кругов} ${слово}: ${alt.join(' + ')}` : `${кругов} ${слово}`;
  }
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
  // Повторы для тоннажа: у комплексов и минутных режимов reps — это отметка
  // «круг сделан», а не число подъёмов. Тоннаж должен считаться по факту.
  const doneLoadReps = doneSets.reduce((a, s) => a + (s.loadReps ?? s.actualReps ?? s.reps ?? 0), 0);
  const complete = doneSets.length >= item.sets.length &&
    (plannedReps === 0 || doneReps >= plannedReps * 0.95) &&
    (plannedSec === 0 || doneSec >= plannedSec * 0.95);
  return { doneSets: doneSets.length, totalSets: item.sets.length, doneReps, doneLoadReps, plannedReps, doneSec, complete };
}

// Размер поправки зависит от размера промаха.
//
// Раньше движок реагировал одинаково на RPE 5 и RPE 7: и там и там «+1
// к счётчику», и до рабочей нагрузки можно было ползти месяц. Но «было
// супер легко» — это не то же самое, что «нормально зашло»: в первом случае
// назначенная нагрузка просто мимо, и одной тренировки достаточно, чтобы
// это понять. Ждать трёх подтверждений имеет смысл у границы возможностей,
// а не в двух шагах ниже неё.
//
// Вниз реакция осталась осторожной: два подряд провала на шаг назад.
// Ошибиться в меньшую сторону дёшево, в большую — травма.
function stepJump(rpe, complete) {
  if (!complete) return null;
  if (rpe <= 4) return 3;   // не заметил нагрузки вообще
  if (rpe <= 5) return 2;   // совсем легко
  return null;              // дальше работает обычный счётчик удачных тренировок
}


// Куда ставить человека после того, как ему сбросили вес гири.
// Раньше здесь было «почти вершина лестницы» (steps.length - 3), и это ломалось:
// у многих лестниц верхние ступени — это swapIn, то есть часть подходов делается
// СЛЕДУЮЩЕЙ гирей. Человек только что провалил 24 кг, его переводили на 16 —
// и выдавали ступень, где 6 подходов из 10 снова с 24 кг. У лестниц S&S верх — это
// работа по нормативу. Теперь берём середину той части лестницы, где работа идёт
// одной гирей: нагрузка настоящая, но потолок ещё впереди.
function stepAfterWeightDrop(track) {
  if (track.kind === 'swap') return 0;
  const свои = track.steps
    .map((s, i) => ({ s, i }))
    .filter(x => !x.s.swapIn && !x.s.heavy);
  if (!свои.length) return 0;
  return свои[Math.floor((свои.length - 1) / 2)].i;
}

// Разбор тренировки. Приложение НИЧЕГО не меняет само: считает, замечает
// и предлагает. Нагрузку двигает человек — в «Ещё → Рабочие веса и ступени»
// или кнопкой прямо в отчёте после тренировки.
//
// Почему так. Прогрессия — это не свойство календаря, а готовность человека,
// и она приходит не сразу. Автоматика же исходила из обратного: три подхода
// подряд «нормально» — значит пора прибавить. На двугиревой работе цена
// ошибки особенно велика: шаг между парами это плюс треть веса, а 15 махов
// парой 24 — это 48 кг в каждом повторе.
export function applySession(state, session) {
  const changes = [];
  const deload = session.deload;
  for (const entry of session.entries) {
    const p = state.progress[entry.exId];
    const track = TRACKS[entry.trackId];
    if (!p || !track) continue;
    if (!p.steps) p.steps = {};
    if (p.steps[entry.trackId] === undefined) p.steps[entry.trackId] = clamp(p.step ?? 0, 0, track.steps.length - 1);
    const step = p.steps[entry.trackId];
    const ex = EXERCISES[entry.exId];
    const rpe = entry.rpe ?? 7;
    const last = Math.min(track.steps.length - 1, entry.maxStep ?? Infinity);

    if (deload) {
      changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: разгрузочная неделя, ничего не трогаем` });
      continue;
    }

    // Куда шагнуть, если человек решит прибавить. Ничего не записывает.
    const кудаДальше = (n) => {
      const target = step + n;
      if (target <= last) return { kind: 'step', step: target, weight: p.weight };
      if (step < last) return { kind: 'step', step: last, weight: p.weight };
      const nb = nextBell(p.weight, state.settings.bells);
      if (!nb) return { kind: 'max' };
      return { kind: 'weight', step: track.reset ?? 0, weight: nb };
    };
    const предложить = (тип, п, текст) => changes.push({
      exId: entry.exId, trackId: entry.trackId, type: тип, text: текст,
      apply: п.kind === 'max' ? null : { exId: entry.exId, trackId: entry.trackId, step: п.step, weight: п.weight }
    });

    // Нагрузка была явно мала — говорим сразу, не копя подтверждения
    const jump = stepJump(rpe, entry.complete);
    if (jump && step < last) {
      p.wins = 0; p.fails = 0;
      const н = кудаДальше(jump);
      предложить('suggest-up', н, `${ex.short}: было совсем легко. Если готов — ${stepText(entry.trackId, н.step)}`);
      continue;
    }

    // Короткая тренировка — это факт, а не провал. Сигналом «тяжело» служит
    // оценка самочувствия, а не число сделанных подходов.
    if (entry.complete && rpe <= 7) {
      p.wins = (p.wins || 0) + (rpe <= 6 ? 2 : 1);
      p.fails = 0;
    } else if (rpe >= 9) {
      p.fails = (p.fails || 0) + 1;
      p.wins = 0;
    } else {
      changes.push({ exId: entry.exId, type: 'hold',
        text: entry.complete ? `${ex.short}: записал` : `${ex.short}: записал сколько получилось` });
      continue;
    }

    // Сколько спокойных тренировок подряд считаем поводом ПРЕДЛОЖИТЬ прибавку.
    // Реже занимаешься — меньше подтверждений, чтобы разговор о прибавке
    // заходил примерно раз в тот же срок, а не раз в полгода.
    const base = track.winsNeeded ?? 2;
    const perWeek = entry.perCycle && entry.cycleDays ? (entry.perCycle * 7) / entry.cycleDays : 3;
    const winsNeeded = Math.max(2, track.fixedPace ? base : Math.round(base * Math.min(perWeek, 3) / 3));

    if (p.wins >= winsNeeded) {
      const н = кудаДальше(1);
      if (н.kind === 'max') {
        changes.push({ exId: entry.exId, type: 'max', text: `${ex.short}: потолок по твоим гирям. Дальше нужна гиря тяжелее` });
      } else if (н.kind === 'weight') {
        предложить('suggest-up', н, `${ex.short}: лестница пройдена, идёт спокойно. Если готов — гиря ${н.weight} кг и объём заново`);
      } else {
        предложить('suggest-up', н, `${ex.short}: идёт спокойно ${p.wins} ${p.wins < 5 ? 'тренировки' : 'тренировок'} подряд. Если готов — ${stepText(entry.trackId, н.step)}`);
      }
    } else if (p.fails >= 2) {
      p.fails = 0;
      if (step > 0) {
        предложить('suggest-down', { kind: 'step', step: step - 1, weight: p.weight },
          `${ex.short}: тяжело второй раз подряд. Можно вернуться на ${stepText(entry.trackId, step - 1)}`);
      } else {
        const pb = prevBell(p.weight, state.settings.bells);
        const нуженПара = DOUBLE_EX(entry.exId) || PROGRAMS[state.settings.programId]?.needsPair;
        const естьПара = !нуженПара || (state.settings.pairs || []).includes(pb);
        if (pb && естьПара) {
          предложить('suggest-down', { kind: 'weight', step, weight: pb },
            `${ex.short}: тяжело второй раз подряд на самой лёгкой ступени. Можно взять ${нуженПара ? 'пару ' : ''}${pb} кг`);
        } else {
          changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: тяжело, но легче уже некуда — держим` });
        }
      }
    } else {
      changes.push({ exId: entry.exId, type: 'hold', text: `${ex.short}: записал` });
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
    // Двугиревые движения поднимают две гири: в дне A на паре 16 в каждом
    // повторе 32 кг, а не 16. Раньше тоннаж занижался ровно вдвое.
    const гирь = EXERCISES[e.exId]?.double ? 2 : 1;
    t += (e.doneLoadReps ?? e.doneReps ?? 0) * (e.weight || 0) * гирь;
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

// ── Что дальше ───────────────────────────────────────────────────────────────
// Приложение вело прогрессию, но молчало о двух вещах: когда лестницы
// заканчиваются и когда упрёшься в отсутствующее железо. Обе всплывают
// внезапно — через полтора месяца работы, когда менять что-то уже поздно.

const DOUBLE_EX = (exId) => !!EXERCISES[exId]?.double;

export function blockStatus(state, dateISO = todayISO()) {
  const prog = PROGRAMS[state.settings.programId];
  const seen = new Map();
  for (const day of prog.days) for (const sl of day.slots) {
    const key = sl.ex + '|' + sl.track;
    if (!seen.has(key)) seen.set(key, sl);
  }

  const rows = [];
  for (const [, sl] of seen) {
    const tr = TRACKS[sl.track];
    const p = state.progress[sl.ex];
    if (!tr || !p) continue;
    const last = Math.min(tr.steps.length - 1, sl.maxStep ?? Infinity);
    const step = clamp(p.steps?.[sl.track] ?? 0, 0, last);
    rows.push({
      exId: sl.ex, trackId: sl.track, step, last,
      pct: last ? step / last : 1,
      осталось: last - step,
      weight: p.weight
    });
  }
  if (!rows.length) return null;

  const pct = rows.reduce((a, r) => a + r.pct, 0) / rows.length;

  // Чего не хватает по железу: смотрим вперёд, а не по факту упора
  const железо = [];
  for (const r of rows) {
    if (r.осталось > 3) continue;                    // ещё далеко, не пугаем
    const nb = nextBell(r.weight, state.settings.bells);
    const нужнаПара = DOUBLE_EX(r.exId) || prog.needsPair;
    const когда = r.осталось === 0 ? 'уже на последней ступени —'
      : `через ${r.осталось} ${r.осталось === 1 ? 'ступень' : 'ступени'}`;
    if (!nb) {
      железо.push({ exId: r.exId, осталось: r.осталось,
        текст: `${EXERCISES[r.exId].short}: ${когда} понадобится гиря тяжелее ${r.weight} кг` });
    } else if (нужнаПара && !(state.settings.pairs || []).includes(nb)) {
      железо.push({ exId: r.exId, осталось: r.осталось,
        текст: `${EXERCISES[r.exId].short}: ${когда} понадобится ПАРА гирь по ${nb} кг` });
    }
  }

  return { pct, rows, железо, наИсходе: pct >= 0.7, программа: prog.name };
}

// Какие паттерны программа реально грузит — считаем подходами за цикл,
// а не по названиям упражнений.
function patternLoad(programId) {
  const prog = PROGRAMS[programId];
  const load = {};
  for (const day of prog.days) for (const sl of day.slots) {
    const ex = EXERCISES[sl.ex];
    if (!ex) continue;
    const tr = TRACKS[sl.track];
    const mid = tr.steps[Math.floor(tr.steps.length / 2)] || {};
    const sets = mid.sets || (mid.ladders ? mid.ladders * (mid.rungs?.length || 1) : 3);
    // комплекс грузит несколько паттернов сразу — делим подходы между ними
    const patterns = ex.covers || [ex.pattern];
    for (const pt of patterns) load[pt] = (load[pt] || 0) + sets / patterns.length;
  }
  const total = Object.values(load).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(load)) load[k] = load[k] / total;
  return load;
}

// Что взять следующим блоком. Считаем две вещи: чего в текущей программе
// мало (дополнение) и во что она упирается (специализация).
export function nextBlockSuggestions(state) {
  const cur = state.settings.programId;
  const curLoad = patternLoad(cur);
  const дефицит = ['hinge', 'squat', 'press', 'pull', 'carry']
    .filter(p => (curLoad[p] || 0) < 0.12);

  const варианты = [];
  for (const [pid, prog] of Object.entries(PROGRAMS)) {
    if (pid === cur) continue;
    const load = patternLoad(pid);
    // насколько программа закрывает то, чего у тебя мало
    const покрытие = дефицит.reduce((a, p) => a + (load[p] || 0), 0);
    // насколько она углубляет то, чем ты уже занимаешься
    const углубление = Object.entries(curLoad)
      .reduce((a, [p, v]) => a + Math.min(v, load[p] || 0) * (load[p] || 0), 0);
    варианты.push({ pid, name: prog.name, tag: prog.tag, покрытие, углубление });
  }

  const дополнение = [...варианты].sort((a, b) => b.покрытие - a.покрытие)[0];
  const специализация = [...варианты].sort((a, b) => b.углубление - a.углубление)[0];
  return {
    дефицит,
    дополнение: дополнение?.покрытие > 0.15 ? дополнение : null,
    специализация: специализация?.pid !== дополнение?.pid ? специализация : null
  };
}
