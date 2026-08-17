// Тест кондиций: за одну сессию определяем рабочие веса и стартовые ступени.
//
// Два принципа, на которых всё держится:
// 1. Никаких разовых максимумов в жиме. Максимум с гирей ловится техническим
//    срывом, а не силой, и после перерыва это самый быстрый способ травмироваться.
//    Меряем максимум ЧИСТЫХ повторов со стоп-правилом по технике.
// 2. Ставим на ступень НИЖЕ измеренного. Тест показывает, что ты можешь один раз.
//    Программе нужно то, что ты повторишь завтра и послезавтра.

export const TEST_ORDER = ['intro', 'press', 'swing', 'squat', 'carry', 'result'];

export const TESTS = {
  press: {
    name: 'Жим над головой',
    exId: 'clean_press',
    what: 'Сила плечевого пояса и корпуса',
    how: [
      'Забрось гирю на плечо и жми над головой столько раз, сколько получается чисто.',
      'Меряем на слабой руке — по ней и будем строить программу.',
      'Между повторами гиря возвращается в стойку, отдыхать в ней нельзя.'
    ],
    stop: 'Останавливайся, когда начинаешь отклоняться назад, помогать ногами или пауза между повторами больше 2 секунд. Это не подход до отказа.',
    input: 'reps', cap: 15,
    label: 'Чистых повторов на слабой руке'
  },
  swing: {
    name: 'Махи: 5 подходов по минуте',
    exId: 'swing_1h',
    what: 'Выносливость бёдер, дыхание и хват',
    how: [
      '5 подходов по 10 махов одной рукой, каждый подход стартует в начале новой минуты.',
      'Руку меняешь каждый подход. Успел за 25 секунд — остаток минуты отдыхаешь.',
      'В конце оцени, насколько было тяжело.'
    ],
    stop: 'Если техника поплыла раньше пятого подхода — останови тест и отметь это. Гиря выше груди и круглая спина означают, что вес великоват.',
    input: 'rpe',
    label: 'Насколько было тяжело'
  },
  squat: {
    name: 'Гоблет-присед',
    exId: 'goblet_squat',
    what: 'Ноги и подвижность таза',
    how: [
      'Гиря у груди, приседай в полный сед столько раз, сколько получается чисто.',
      'Внизу короткая пауза, без падения в нижнюю точку.'
    ],
    stop: 'Стоп, когда отрываются пятки, скругляется поясница или колени начинают складываться внутрь.',
    input: 'reps', cap: 25,
    label: 'Чистых повторов'
  },
  carry: {
    name: 'Прогулка фермера',
    exId: 'carry_farmer',
    what: 'Хват и способность корпуса держать форму',
    how: [
      'Возьми гирю (или две) и иди ровным шагом, пока держит хват.',
      'Плечи вниз-назад, рёбра вниз, не заваливайся вбок.'
    ],
    stop: 'Стоп, когда пальцы начинают разжиматься или тебя перекашивает в сторону гири. До срыва гири доводить не нужно.',
    input: 'sec', cap: 150,
    label: 'Секунд под нагрузкой'
  }
};

// ── Пересчёт результата в ступени ────────────────────────────────────────────
// Каждая функция возвращает ступень ПОСЛЕ страховочной скидки.

// Правило лестниц: верхняя ступень примерно вдвое ниже максимума повторов.
// Выжал 6 раз — работаешь лестницами до 3.
export function pressStep(reps) {
  if (reps >= 12) return { step: 9, tooEasy: true };
  if (reps >= 10) return { step: 8 };
  if (reps >= 8) return { step: 5 };
  if (reps >= 6) return { step: 3 };
  if (reps >= 4) return { step: 2 };
  if (reps >= 2) return { step: 0 };
  return { step: 0, tooHeavy: true };
}

// Тест идёт в минутном режиме, то есть жёстче, чем ступени с отдыхом 60–75 сек.
// Поэтому лёгкий тест честно переносит сразу на объёмные ступени.
export function swingStep(rpe, techniqueHeld) {
  if (!techniqueHeld) return { step: 0, tooHeavy: true };
  if (rpe <= 5) return { step: 6 };
  if (rpe <= 6) return { step: 5 };
  if (rpe <= 7) return { step: 3 };
  if (rpe <= 8) return { step: 1 };
  return { step: 0, tooHeavy: true };
}

export function squatStep(reps) {
  if (reps >= 16) return { step: 5, tooEasy: true };
  if (reps >= 13) return { step: 4 };
  if (reps >= 10) return { step: 3 };
  if (reps >= 7) return { step: 1 };
  return { step: 0 };
}

export function rowStep(reps) {
  if (reps >= 16) return { step: 4 };
  if (reps >= 13) return { step: 3 };
  if (reps >= 10) return { step: 2 };
  if (reps >= 7) return { step: 1 };
  return { step: 0 };
}

export function carryStep(sec) {
  if (sec >= 90) return { step: 4 };
  if (sec >= 60) return { step: 3 };
  if (sec >= 45) return { step: 2 };
  if (sec >= 30) return { step: 1 };
  return { step: 0 };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ── Раскладка результата по всем упражнениям ─────────────────────────────────
export function computePlacement(r) {
  const press = pressStep(r.press.reps);
  const swing = swingStep(r.swing.rpe, r.swing.techniqueHeld !== false);
  const squat = squatStep(r.squat.reps);
  const carry = carryStep(r.carry.sec);

  const items = [
    { exId: 'swing_1h', trackId: 'swing_vol', weight: r.swing.bell, step: swing.step },
    // двумя руками легче, чем одной — можно на ступень выше
    { exId: 'swing_2h', trackId: 'swing_vol', weight: r.swing.bell, step: clamp(swing.step + 1, 0, 8) },
    { exId: 'clean_press', trackId: 'press_ladder', weight: r.press.bell, step: press.step },
    { exId: 'press', trackId: 'press_ladder', weight: r.press.bell, step: press.step },
    { exId: 'goblet_squat', trackId: 'squat_reps', weight: r.squat.bell, step: squat.step },
    { exId: 'front_squat', trackId: 'squat_reps', weight: r.press.bell, step: clamp(squat.step - 1, 0, 7) },
    { exId: 'row', trackId: 'row_reps', weight: r.squat.bell, step: rowStep(r.squat.reps).step },
    { exId: 'carry_farmer', trackId: 'carry_time', weight: r.carry.bell, step: carry.step },
    { exId: 'carry_rack', trackId: 'carry_time', weight: r.press.bell, step: clamp(carry.step - 1, 0, 5) },
    { exId: 'carry_suitcase', trackId: 'carry_time', weight: r.carry.bell, step: carry.step },
    // рывок технически сложнее махов, поэтому заметно ниже
    { exId: 'snatch', trackId: 'snatch_vol', weight: r.swing.bell, step: clamp(swing.step - 3, 0, 7) },
    // комплекс ABC — три движения подряд, объём считаем от жима и очень скромно
    { exId: 'abc', trackId: 'abc_emom', weight: r.press.bell, step: clamp(Math.round(press.step / 3), 0, 4) }
  ];

  const warnings = [];
  if (press.tooEasy) warnings.push('Жим: 12+ повторов — эта гиря для тебя лёгкая. Возьми следующую и перетестируй жим.');
  if (press.tooHeavy) warnings.push('Жим: меньше двух повторов — гиря тяжеловата. Начни с более лёгкой, силу наберёшь объёмом.');
  if (swing.tooHeavy) warnings.push('Махи: техника не дожила до конца теста. Ставлю минимальный объём, и лучше взять гирю полегче.');
  if (squat.tooEasy) warnings.push('Присед: 16+ повторов — для приседа стоит взять гирю тяжелее.');

  return { items, warnings, raw: { press, swing, squat, carry } };
}

export function applyPlacement(state, placement) {
  const changes = [];
  for (const it of placement.items) {
    const p = state.progress[it.exId];
    if (!p) continue;
    const weight = state.settings.bells.includes(it.weight)
      ? it.weight
      : state.settings.bells.reduce((b, x) => Math.abs(x - it.weight) < Math.abs(b - it.weight) ? x : b, state.settings.bells[0]);
    p.weight = weight;
    p.step = it.step;
    p.wins = 0;
    p.fails = 0;
    changes.push({ exId: it.exId, trackId: it.trackId, weight, step: it.step });
  }
  state.today = null;
  return changes;
}

// Тест стоит проходить не в первый день после паузы: разовый максимум
// на несвежих связках — плохая идея и по травме, и по точности.
export function readinessForTest(state, todayISO) {
  const real = (state.sessions || []).filter(s => s.type !== 'rest');
  if (!real.length) {
    return { ok: false, level: 'warn', text: 'Ты ещё ни разу не тренировался в приложении. Лучше сделать 2–3 спокойные тренировки, а тест пройти на четвёртой: тогда он покажет твой уровень, а не то, как ты отвык.' };
  }
  const last = real.map(s => s.date).sort().pop();
  const days = Math.round((new Date(todayISO + 'T00:00:00') - new Date(last + 'T00:00:00')) / 86400000);
  if (days > 14) {
    return { ok: false, level: 'warn', text: `Последняя тренировка была ${days} дней назад. После такого перерыва тест завышает риск и занижает результат — сделай пару лёгких дней и вернись.` };
  }
  if (real.length < 3) {
    return { ok: true, level: 'note', text: 'Тренировок пока мало. Тест можно пройти, но если техника ещё не устоялась — результат будет заниженным.' };
  }
  return { ok: true, level: 'ok', text: 'Можно тестироваться. Разомнись как обычно и не спеши между тестами: между блоками отдыхай 3–5 минут.' };
}
