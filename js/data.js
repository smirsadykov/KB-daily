// Библиотека упражнений, треки прогрессии и программы.
// Вся методика описана в docs/methodology.md

// ── Упражнения ───────────────────────────────────────────────────────────────
// kind: ballistic (взрывные, дыхательные) | grind (силовые, медленные) | carry | mobility
// side: both (двумя руками) | each (на каждую сторону)

export const EXERCISES = {
  swing_1h: {
    name: 'Свинг одной рукой',
    short: 'Свинг 1р',
    kind: 'ballistic', pattern: 'hinge', side: 'each',
    load: 'ballistic',
    cues: [
      'Это тяга бёдрами, а не присед. Гиря идёт назад «под себя», как пас в регби.',
      'Стоя в верхней точке: ягодицы, пресс и кулак сжаты одновременно, резкий выдох.',
      'Гиря не выше груди. Руки её не поднимают — их просто закидывает.',
      'Плечо прижато, не тянись за гирей вперёд.'
    ]
  },
  swing_2h: {
    name: 'Свинг двумя руками',
    short: 'Свинг 2р',
    kind: 'ballistic', pattern: 'hinge', side: 'both',
    load: 'ballistic',
    cues: [
      'Стойка чуть шире плеч, носки слегка наружу.',
      'Спина прямая всё время. Смотри вперёд, не вниз.',
      'Работа заканчивается в верхней точке, вниз гиря падает сама.'
    ]
  },
  clean_press: {
    name: 'Заброс + жим',
    short: 'Клин+жим',
    kind: 'grind', pattern: 'press', side: 'each',
    load: 'grind',
    cues: [
      'Заброс — тот же свинг, только гиря «обтекает» руку и мягко садится на предплечье. Без удара.',
      'Перед жимом: вдох, живот твёрдый, ягодица со стороны жима сжата.',
      'Жми не вверх, а «отталкивай себя от гири» вниз ногами.',
      'Локоть выпрямлен, бицепс у уха, потом медленно опускаешь.'
    ]
  },
  press: {
    name: 'Жим стоя',
    short: 'Жим',
    kind: 'grind', pattern: 'press', side: 'each',
    load: 'grind',
    cues: ['Всё тело в напряжении.', 'Не отклоняйся назад — рёбра вниз, пресс держит.']
  },
  goblet_squat: {
    name: 'Гоблет-присед',
    short: 'Гоблет',
    kind: 'grind', pattern: 'squat', side: 'both',
    load: 'grind',
    cues: [
      'Гирю к груди, локти внутрь бёдер.',
      'Садись между ног, колени наружу, пятки на полу.',
      'В нижней точке пауза 1 сек — это и есть растяжка бёдер.'
    ]
  },
  front_squat: {
    name: 'Фронтальный присед',
    short: 'Фр. присед',
    kind: 'grind', pattern: 'squat', side: 'each',
    load: 'grind',
    cues: ['Гиря в стойке на предплечье, локоть прижат к рёбрам.', 'Корпус вертикальный.']
  },
  row: {
    name: 'Тяга в наклоне',
    short: 'Тяга',
    kind: 'grind', pattern: 'pull', side: 'each',
    load: 'grind',
    cues: ['Спина параллельно полу, поясница нейтральная.', 'Тяни локтем к карману, лопатку вниз-назад.']
  },
  snatch: {
    name: 'Рывок',
    short: 'Рывок',
    kind: 'ballistic', pattern: 'hinge', side: 'each',
    load: 'ballistic',
    cues: [
      'Это свинг, который не остановился. Ускорение бёдрами, а не рукой.',
      'В верхней точке «прошей» кисть — гиря обтекает, не бьёт по предплечью.',
      'Кулак смотрит вперёд, локоть выпрямлен, стоишь жёстко.'
    ]
  },
  swing_2kb: {
    name: 'Свинг двумя гирями',
    short: 'Свинг 2г',
    kind: 'ballistic', pattern: 'hinge', side: 'both',
    load: 'ballistic',
    cues: [
      'По гире в каждой руке. Общий вес вдвое больше — стойка чуть шире, чтобы гири проходили между ног.',
      'Спина держит вдвое больший рычаг: если поясница начинает круглиться, подход закончен.',
      'Гири должны идти синхронно. Разъезжаются — это сигнал, что вес великоват.'
    ]
  },
  clean: {
    name: 'Заброс',
    short: 'Заброс',
    kind: 'ballistic', pattern: 'hinge', side: 'each',
    load: 'ballistic',
    cues: ['Гиря идёт по телу, а не по дуге от себя.', 'Мягкая посадка в стойку — тишина, без стука.']
  },
  abc: {
    name: 'Комплекс ABC (2 заброса + жим + 3 приседа)',
    short: 'ABC',
    kind: 'grind', pattern: 'complex', side: 'each',
    load: 'grind',
    cues: [
      'Один круг = 2 заброса, 1 жим, 3 фронтальных приседа. Потом другая сторона.',
      'Соотношение не случайное: у Дэна Джона приседов больше, чем забросов, а забросов больше, чем жимов — именно потому, что жим отказывает первым. Менять пропорции нельзя, комплекс на них и держится.',
      'Оригинал делается ДВУМЯ гирями. Здесь вариант под одну — тогда круг идёт на каждую сторону.',
      'Работай в минуту: круг + отдых до конца минуты. Дальняя цель у Джона — 30 кругов за 30 минут.',
      'Если к концу минуты не успеваешь — это сигнал остановиться, а не терпеть.'
    ]
  },
  // ── Гиревой спорт ──────────────────────────────────────────────────────────
  // Это ДРУГАЯ дисциплина, не hardstyle. Там задача — максимум подъёмов
  // за 10 минут, поэтому техника построена на экономии, а не на жёсткости:
  // расслабленные плечи, отдых в стойке, хват «крюком», дыхание в такт.
  gs_jerk: {
    name: 'Толчок',
    short: 'Толчок',
    kind: 'gs', pattern: 'jerk', side: 'each',
    load: 'ballistic',
    cues: [
      'Соревновательное движение: максимум подъёмов за 10 минут. Работают ноги, руки только фиксируют.',
      'Гиря отдыхает в стойке — на этом всё и держится. Не висни на руке, найди опору на тазе.',
      'Подсед под гирю ногами, а не дожим плечом.',
      'Дыхание в такт движению, без задержек. Плечи расслаблены.',
      'Техника гиревого спорта заметно отличается от hardstyle и по книжке не ставится — ищи тренера.'
    ]
  },
  gs_lc: {
    name: 'Длинный цикл',
    short: 'ДЦ',
    kind: 'gs', pattern: 'jerk', side: 'each',
    load: 'ballistic',
    cues: [
      'Каждый повтор: заброс с виса, потом толчок. Темп ниже, чем в толчке, — движение вдвое длиннее.',
      'Заброс делается бёдрами, гиря идёт близко к телу.',
      'Отдых только в стойке и в висе, специально останавливаться нельзя.'
    ]
  },
  gs_snatch: {
    name: 'Рывок (спортивный стиль)',
    short: 'Рывок ГС',
    kind: 'gs', pattern: 'hinge', side: 'each',
    load: 'ballistic',
    cues: [
      'Одна смена руки за подход — так на соревнованиях. Задача — дожить до конца сета обеими руками.',
      'Хват «крюком», кисть расслаблена. Гиря обтекает кисть, а не бьёт по предплечью.',
      'Наверху короткая фиксация и сразу вниз, без hardstyle-напряжения всего тела.',
      'Если рвётся хват — сет закончен, это не повод терпеть до мозоли.'
    ]
  },

  carry_farmer: {
    name: 'Прогулка фермера',
    short: 'Фермер',
    kind: 'carry', pattern: 'carry', side: 'both',
    load: 'heavy',
    cues: ['Две гири по бокам. Если гиря одна — неси её как «чемодан», меняя руки.', 'Плечи вниз-назад, рёбра вниз.', 'Шаг короткий и ровный, не заваливайся вбок.']
  },
  carry_rack: {
    name: 'Прогулка в стойке',
    short: 'Стойка',
    kind: 'carry', pattern: 'carry', side: 'each',
    load: 'grind',
    cues: ['Гиря на предплечье, локоть прижат.', 'Дыши животом, несмотря на давление гири.']
  },
  carry_suitcase: {
    name: 'Прогулка с чемоданом',
    short: 'Чемодан',
    kind: 'carry', pattern: 'carry', side: 'each',
    load: 'heavy',
    cues: ['Одна гиря сбоку. Задача — не наклоняться в её сторону.', 'Это работа на косые и хват, а не на ноги.']
  },
  tgu: {
    name: 'Турецкий подъём',
    short: 'ТГУ',
    kind: 'grind', pattern: 'getup', side: 'each',
    load: 'grind',
    cues: ['Глаза на гирю всю дорогу.', 'Медленно. Это не упражнение на количество.']
  },
  // Разминка / мобильность — без прогрессии
  halo: { name: 'Halo (круги у головы)', short: 'Halo', kind: 'mobility', side: 'both', cues: ['Медленно, плечи расслаблены.'] },
  prying_squat: { name: 'Присед с раскачкой', short: 'Раскачка', kind: 'mobility', side: 'both', cues: ['Локтями разводи колени, дыши в нижней точке.'] },
  hip_bridge: { name: 'Ягодичный мост', short: 'Мост', kind: 'mobility', side: 'both', cues: ['Сжимай ягодицы, не выгибай поясницу.'] },
  windmill: { name: 'Мельница', short: 'Мельница', kind: 'mobility', side: 'each', cues: ['Вес на задней ноге, взгляд на гирю.'] },
  deadbug: { name: 'Мёртвый жук', short: 'Жук', kind: 'mobility', side: 'both', cues: ['Поясница прижата к полу.'] },
  cat_camel: { name: 'Кошка-верблюд', short: 'Кошка', kind: 'mobility', side: 'both', cues: ['Плавно, по одному позвонку.'] }
};

// Разминка (одинаковая для всех программ, ~5 минут)
export const WARMUP = [
  { ex: 'cat_camel', reps: 8, note: '' },
  { ex: 'hip_bridge', reps: 10, note: '' },
  { ex: 'deadbug', reps: 6, note: 'на каждую сторону' },
  { ex: 'halo', reps: 5, note: 'в каждую сторону, лёгкая гиря' },
  { ex: 'prying_squat', reps: 5, note: 'с паузой внизу' }
];

export const COOLDOWN = [
  { ex: 'cat_camel', reps: 6, note: '' },
  { ex: 'prying_squat', reps: 5, note: 'дыши 3 сек вдох / 5 сек выдох' }
];

// ── Треки прогрессии ─────────────────────────────────────────────────────────
// Шаги идут снизу вверх: сначала растёт объём, потом плотность (меньше отдыха),
// и только потом — вес. Это правильный порядок для гирь, где следующий вес
// это сразу +20-30%, а не +2.5 кг.

export const TRACKS = {
  // Баллистика: 10 повторений в подходе — константа. Растут подходы, потом падает отдых.
  // winsNeeded — сколько удачных тренировок подряд нужно на шаг вперёд.
  // Для основных движений это 3, а не 2: при трёх занятиях в неделю
  // «две подряд» дают полтора шага в неделю, и за месяц движок доводит
  // до смены гири. В реальной практике на гирю уходят месяцы.
  swing_vol: {
    kind: 'ballistic', reset: 1, winsNeeded: 3,
    steps: [
      { sets: 5, reps: 10, rest: 75 },
      { sets: 6, reps: 10, rest: 75 },
      { sets: 7, reps: 10, rest: 60 },
      { sets: 8, reps: 10, rest: 60 },
      { sets: 9, reps: 10, rest: 60 },
      { sets: 10, reps: 10, rest: 60 },
      { sets: 10, reps: 10, rest: 45 },
      { sets: 10, reps: 10, rest: 30 },
      { sets: 10, reps: 10, rest: 0, emom: 60, label: 'каждую минуту' },
      // Дальше гиря меняется не прыжком: следующий вес заходит по одному
      // подходу за раз. Прыжок 24→32 это сразу +33%, и на 100 махов
      // такой скачок ловится не силой, а поясницей.
      { sets: 10, reps: 10, rest: 60, swapIn: 2 },
      { sets: 10, reps: 10, rest: 60, swapIn: 4 },
      { sets: 10, reps: 10, rest: 60, swapIn: 6 },
      { sets: 10, reps: 10, rest: 60, swapIn: 8 },
      { sets: 10, reps: 10, rest: 60, swapIn: 10, label: 'вся работа новым весом' }
    ]
  },
  snatch_vol: {
    kind: 'ballistic', reset: 1, winsNeeded: 3,
    steps: [
      { sets: 5, reps: 5, rest: 75 },
      { sets: 6, reps: 5, rest: 60 },
      { sets: 8, reps: 5, rest: 60 },
      { sets: 10, reps: 5, rest: 45 },
      { sets: 10, reps: 5, rest: 30 },
      { sets: 10, reps: 5, rest: 0, emom: 60, label: 'каждую минуту' },
      { sets: 10, reps: 6, rest: 0, emom: 60, label: 'каждую минуту' },
      { sets: 10, reps: 8, rest: 0, emom: 60, label: 'каждую минуту' }
    ]
  },
  // Грайнды: лестницы 1-2-3. Сначала больше лестниц, потом длиннее ступени.
  press_ladder: {
    kind: 'ladder', reset: 0, winsNeeded: 3,
    steps: [
      { ladders: 3, rungs: [1, 2], rest: 60 },
      { ladders: 4, rungs: [1, 2], rest: 60 },
      { ladders: 5, rungs: [1, 2], rest: 60 },
      { ladders: 3, rungs: [1, 2, 3], rest: 60 },
      { ladders: 4, rungs: [1, 2, 3], rest: 60 },
      { ladders: 5, rungs: [1, 2, 3], rest: 60 },
      { ladders: 3, rungs: [1, 2, 3, 4], rest: 75 },
      { ladders: 4, rungs: [1, 2, 3, 4], rest: 75 },
      { ladders: 5, rungs: [1, 2, 3, 4], rest: 75 },
      { ladders: 3, rungs: [1, 2, 3, 4, 5], rest: 90 },
      { ladders: 4, rungs: [1, 2, 3, 4, 5], rest: 90 },
      { ladders: 5, rungs: [1, 2, 3, 4, 5], rest: 90 }
    ]
  },
  // Обычная двойная прогрессия: сначала подходы, потом повторы.
  squat_reps: {
    kind: 'reps', reset: 0,
    steps: [
      { sets: 3, reps: 5, rest: 75 },
      { sets: 4, reps: 5, rest: 75 },
      { sets: 5, reps: 5, rest: 75 },
      { sets: 3, reps: 8, rest: 90 },
      { sets: 4, reps: 8, rest: 90 },
      { sets: 5, reps: 8, rest: 90 },
      { sets: 4, reps: 10, rest: 90 },
      { sets: 5, reps: 10, rest: 90 }
    ]
  },
  row_reps: {
    kind: 'reps', reset: 0,
    steps: [
      { sets: 3, reps: 6, rest: 60 },
      { sets: 3, reps: 8, rest: 60 },
      { sets: 4, reps: 8, rest: 60 },
      { sets: 4, reps: 10, rest: 60 },
      { sets: 5, reps: 10, rest: 60 }
    ]
  },
  tgu_reps: {
    kind: 'reps', reset: 0,
    steps: [
      { sets: 3, reps: 1, rest: 60 },
      { sets: 4, reps: 1, rest: 60 },
      { sets: 5, reps: 1, rest: 60 },
      { sets: 5, reps: 1, rest: 45 },
      { sets: 5, reps: 2, rest: 60 }
    ]
  },
  // Переноски: растёт время, потом подходы.
  carry_time: {
    kind: 'time', reset: 0,
    steps: [
      { sets: 2, sec: 30, rest: 60 },
      { sets: 3, sec: 30, rest: 60 },
      { sets: 3, sec: 45, rest: 60 },
      { sets: 4, sec: 45, rest: 60 },
      { sets: 4, sec: 60, rest: 60 },
      { sets: 5, sec: 60, rest: 45 }
    ]
  },
  // Simple & Sinister по оригиналу: объём НЕ растёт, он всегда 10×10.
  // Растёт доля подходов с целевой гирей — «замена по одному подходу за раз».
  // Когда все 10 подходов сделаны целевым весом, идёт работа на норматив:
  // 100 махов за 5 минут (подход каждые 30 сек), 10 подъёмов за 10 минут.
  sns_swing: {
    kind: 'swap', reset: 0, sets: 10, reps: 10, winsNeeded: 3,
    steps: [
      ...Array.from({ length: 11 }, (_, heavy) => ({ heavy, rest: 60 })),
      { heavy: 10, interval: 60, label: 'подход в минуту' },
      { heavy: 10, interval: 45, label: 'подход каждые 45 сек' },
      { heavy: 10, interval: 30, label: 'норматив: 100 махов за 5 минут' }
    ]
  },
  sns_tgu: {
    kind: 'swap', reset: 0, sets: 10, reps: 1, winsNeeded: 3,
    steps: [
      ...Array.from({ length: 11 }, (_, heavy) => ({ heavy, rest: 60 })),
      { heavy: 10, interval: 75, label: 'подъём каждые 75 сек' },
      { heavy: 10, interval: 60, label: 'норматив: 10 подъёмов за 10 минут' }
    ]
  },

  // Гиревой спорт: набор соревновательной ёмкости.
  // Сначала длиннее сеты на низком темпе, потом выше темп на полных 10 минутах.
  // Ориентир для толчка — 20 подъёмов в минуту, это 200 за сет.
  gs_jerk_cap: {
    kind: 'interval', reset: 4,
    steps: [
      { sets: 5, min: 2, rpm: 10, rest: 120 },
      { sets: 4, min: 3, rpm: 10, rest: 120 },
      { sets: 3, min: 4, rpm: 10, rest: 150 },
      { sets: 2, min: 5, rpm: 10, rest: 180 },
      { sets: 2, min: 6, rpm: 12, rest: 180 },
      { sets: 1, min: 8, rpm: 12, rest: 0 },
      { sets: 1, min: 10, rpm: 12, rest: 0 },
      { sets: 1, min: 10, rpm: 14, rest: 0 },
      { sets: 1, min: 10, rpm: 16, rest: 0 },
      { sets: 1, min: 10, rpm: 18, rest: 0 },
      { sets: 1, min: 10, rpm: 20, rest: 0, label: 'соревновательный ориентир' }
    ]
  },
  gs_snatch_cap: {
    kind: 'interval', reset: 4,
    steps: [
      { sets: 5, min: 2, rpm: 12, rest: 120 },
      { sets: 4, min: 3, rpm: 12, rest: 120 },
      { sets: 3, min: 4, rpm: 14, rest: 150 },
      { sets: 2, min: 5, rpm: 14, rest: 180 },
      { sets: 2, min: 6, rpm: 16, rest: 180 },
      { sets: 1, min: 8, rpm: 16, rest: 0 },
      { sets: 1, min: 10, rpm: 16, rest: 0 },
      { sets: 1, min: 10, rpm: 18, rest: 0 },
      { sets: 1, min: 10, rpm: 20, rest: 0 },
      { sets: 1, min: 10, rpm: 22, rest: 0, label: 'соревновательный ориентир' }
    ]
  },
  gs_lc_cap: {
    kind: 'interval', reset: 3,
    steps: [
      { sets: 4, min: 2, rpm: 8, rest: 150 },
      { sets: 3, min: 3, rpm: 8, rest: 150 },
      { sets: 3, min: 4, rpm: 9, rest: 180 },
      { sets: 2, min: 5, rpm: 10, rest: 180 },
      { sets: 2, min: 6, rpm: 10, rest: 210 },
      { sets: 1, min: 8, rpm: 10, rest: 0 },
      { sets: 1, min: 10, rpm: 10, rest: 0 },
      { sets: 1, min: 10, rpm: 12, rest: 0, label: 'соревновательный ориентир' }
    ]
  },

  // ABC: каждый круг в минуту.
  // Дальняя цель самого Дэна Джона — 30 кругов за 30 минут. Лестница обязана
  // доводить до неё, иначе программа обрывается на полпути к собственной цели.
  // Растём кругами при неизменном весе, и только потом весом.
  abc_emom: {
    kind: 'emom', reset: 2, winsNeeded: 3,
    steps: [5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 27, 30]
      .map((sets, i) => ({ sets, emom: 60, label: sets === 30 ? 'цель: 30 кругов за 30 минут' : '' }))
  }
};

// ── Программы ────────────────────────────────────────────────────────────────
// Каждая программа — цикл дней. День 'rest' = только мобильность.
// focus: ballistic / grind / mixed / light / rest — влияет на подсказки.

const REST_DAY = {
  id: 'rest', name: 'Отдых', focus: 'rest',
  note: 'Сегодня не тренируешься. 5–10 минут мобильности — и всё.',
  slots: []
};

export const PROGRAMS = {
  daily_min: {
    name: 'Ежедневный минимум',
    tag: 'база · 15–25 мин',
    desc: 'Свинги + заброс с жимом каждый день, без выматывания. Основа, с которой можно жить месяцами и не выпадать.',
    for: 'Ежедневная практика, совместимая с БЖЖ и залом.',
    origin: 'авторская. Собрана из общих принципов, готового прототипа в гиревой литературе не имеет',
    days: [
      { id: 'A', name: 'A · Свинг + жим', focus: 'mixed', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'B', name: 'B · Свинг + ноги/тяга', focus: 'mixed', slots: [
        { ex: 'swing_2h', track: 'swing_vol' },
        { ex: 'goblet_squat', track: 'squat_reps' },
        { ex: 'row', track: 'row_reps' }
      ]},
      { id: 'A', name: 'A · Свинг + жим', focus: 'mixed', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'L', name: 'Л · Лёгкий день', focus: 'light', mult: 0.6,
        note: 'Специально легко. Смысл — движение и техника, а не нагрузка.',
        slots: [
          { ex: 'swing_2h', track: 'swing_vol' },
          { ex: 'carry_suitcase', track: 'carry_time' }
        ]},
      { id: 'A', name: 'A · Свинг + жим', focus: 'mixed', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'B', name: 'B · Свинг + ноги/тяга', focus: 'mixed', slots: [
        { ex: 'swing_2h', track: 'swing_vol' },
        { ex: 'goblet_squat', track: 'squat_reps' },
        { ex: 'row', track: 'row_reps' }
      ]},
      REST_DAY
    ]
  },

  s_and_s: {
    name: 'Simple & Sinister',
    tag: 'оригинал · 20–30 мин',
    desc: '100 махов одной рукой и 10 турецких подъёмов. Каждый день, объём не меняется — растёт только вес.',
    for: 'Когда нужен один понятный ориентир на полгода вперёд.',
    origin: 'программа Павла Цацулина, воспроизведена по оригиналу: объём фиксирован (10×10 махов + 10 подъёмов), вес растёт заменой по одному подходу за раз, затем идёт работа на временные нормативы — 100 махов за 5 минут и 10 подъёмов за 10 минут',
    fixedVolume: true,
    days: Array.from({ length: 7 }, () => ({
      id: 'S', name: 'Simple & Sinister', focus: 'mixed',
      slots: [
        { ex: 'swing_1h', track: 'sns_swing' },
        { ex: 'tgu', track: 'sns_tgu' }
      ]
    }))
  },

  rop: {
    name: 'Путь бойца (жимовые лестницы)',
    tag: 'сила · 25–35 мин',
    desc: 'Три жимовых дня в лестницах + день баллистики. Классическая схема для роста жима.',
    for: 'Когда главная цель — выжать более тяжёлую гирю.',
    origin: 'по мотивам «Rite of Passage» из Enter the Kettlebell. Структура лёгкий/средний/тяжёлый + variety-дни взята оттуда, финал тот же — 5 лестниц 1-2-3-4-5. В оригинале баллистика идёт в тот же день после жимов, здесь вынесена в отдельные дни',
    days: [
      { id: 'P1', name: 'Жим · лёгкий', focus: 'grind', mult: 0.7, slots: [
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'swing_2h', track: 'swing_vol' }
      ]},
      { id: 'V', name: 'Баллистика', focus: 'ballistic', slots: [
        { ex: 'snatch', track: 'snatch_vol' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'P2', name: 'Жим · средний', focus: 'grind', mult: 0.85, slots: [
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'goblet_squat', track: 'squat_reps' }
      ]},
      { id: 'V', name: 'Баллистика', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'row', track: 'row_reps' }
      ]},
      { id: 'P3', name: 'Жим · тяжёлый', focus: 'grind', mult: 1.0, slots: [
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'carry_rack', track: 'carry_time' }
      ]},
      REST_DAY,
      REST_DAY
    ]
  },

  abc_plan: {
    name: 'Броневой комплекс (ABC)',
    tag: 'плотно · 20 мин',
    desc: '2 заброса + жим + 3 приседа в минуту. Комплекс Дэна Джона, здесь в варианте под одну гирю; оригинал делается двумя.',
    for: 'Когда мало времени, но нужен объём.',
    origin: 'комплекс Дэна Джона, соотношение 2-1-3 сохранено. Отличие: оригинал делается двумя гирями, дальняя цель — 30 кругов за 30 минут',
    gives: [
      'Устойчивость корпуса под нагрузкой. Название придумал футболист Дэна Джона: смысл в подготовке тела к столкновениям, отсюда «броня». Для БЖЖ это прямой перенос.',
      'Максимум работы за минимальное время — самый плотный формат из всех программ здесь.',
      'Силовая работа с кардио-нагрузкой одновременно: измеренный метаболический отклик гиревых комплексов сопоставим с высокоинтенсивным функциональным тренингом, кислород и вентиляция остаются повышенными ещё 30–60 минут после.',
      'Хват и три паттерна разом: тяга бёдрами, жим над головой, присед.'
    ],
    limits: [
      'Максимальную силу не растит. Вес ограничен тем, что ты выжмешь после двух забросов, а жим отказывает первым — для роста жима нужны лестницы, а не комплекс.',
      'Гипертрофия здесь побочный эффект: объём на отдельную мышцу низкий по сравнению с целевой работой.',
      'Главный риск — техника на фоне одышки. Заброс и жим требуют точности, а делаются в задыхающемся состоянии. Ломаются обычно поясница и плечо.',
      'Прямых исследований именно этого комплекса нет — есть данные по гиревым комплексам как классу.'
    ],
    days: [
      { id: 'C', name: 'ABC', focus: 'grind', slots: [
        { ex: 'abc', track: 'abc_emom' }
      ]},
      { id: 'B', name: 'Свинги + переноски', focus: 'ballistic', slots: [
        // если гири есть парой — свинг двумя, как и весь остальной комплекс
        { ex: 'swing_2kb', track: 'swing_vol', needsPair: true, fallback: 'swing_2h' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'C', name: 'ABC', focus: 'grind', slots: [
        { ex: 'abc', track: 'abc_emom' }
      ]},
      { id: 'L', name: 'Лёгкий день', focus: 'light', mult: 0.6, slots: [
        { ex: 'swing_2h', track: 'swing_vol' }
      ]},
      { id: 'C', name: 'ABC', focus: 'grind', slots: [
        { ex: 'abc', track: 'abc_emom' }
      ]},
      { id: 'B', name: 'Свинги + переноски', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'carry_suitcase', track: 'carry_time' }
      ]},
      REST_DAY
    ]
  },

  gs_base: {
    name: 'Гиревой спорт · базовый цикл',
    tag: 'другая дисциплина · 30–45 мин',
    desc: 'Толчок, рывок и длинный цикл интервалами. Задача — доработать до 10-минутного сета в соревновательном темпе.',
    for: 'Если интересен именно гиревой спорт, а не общая форма.',
    origin: 'построена по общей логике подготовки в гиревом спорте: сначала длиннее сеты на низком темпе, потом растёт темп на полных 10 минутах. Конкретные ступени — наш выбор. Это НЕ hardstyle: техника здесь другая и ставится с тренером, а не по приложению',
    warn: 'Эта программа плохо сочетается с БЖЖ и жиросжиганием: 10-минутные сеты выматывают и требуют серьёзного восстановления. Берите её, только если цель — сам гиревой спорт.',
    days: [
      { id: 'J', name: 'Толчок · интервалы', focus: 'ballistic', slots: [
        { ex: 'gs_jerk', track: 'gs_jerk_cap' },
        { ex: 'goblet_squat', track: 'squat_reps' }
      ]},
      { id: 'S', name: 'Рывок · интервалы', focus: 'ballistic', slots: [
        { ex: 'gs_snatch', track: 'gs_snatch_cap' },
        { ex: 'row', track: 'row_reps' }
      ]},
      { id: 'R', name: 'Восстановление', focus: 'rest',
        note: 'Мобильность и лёгкая прогулка. В гиревом спорте объём большой, без выходных он не переваривается.',
        slots: [] },
      { id: 'L', name: 'Длинный цикл', focus: 'ballistic', slots: [
        { ex: 'gs_lc', track: 'gs_lc_cap' }
      ]},
      { id: 'S2', name: 'Рывок · лёгкий', focus: 'light', mult: 0.6, slots: [
        { ex: 'gs_snatch', track: 'gs_snatch_cap' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'J2', name: 'Толчок · объём', focus: 'ballistic', mult: 0.85, slots: [
        { ex: 'gs_jerk', track: 'gs_jerk_cap' }
      ]},
      { id: 'R', name: 'Восстановление', focus: 'rest', slots: [] }
    ]
  },

  bjj: {
    name: 'Поддержка БЖЖ',
    tag: 'без ям · 15–20 мин',
    desc: 'Мало объёма, много хвата и корпуса. Задача — не отобрать силы у ковра.',
    for: 'Когда 3–5 тренировок БЖЖ в неделю и нельзя приходить убитым.',
    origin: 'авторская. Известной программы с таким назначением не копирует',
    days: [
      { id: 'G', name: 'Хват + бёдра', focus: 'mixed', mult: 0.8, slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'carry_farmer', track: 'carry_time' }
      ]},
      { id: 'P', name: 'Жим + тяга', focus: 'grind', mult: 0.8, slots: [
        { ex: 'clean_press', track: 'press_ladder' },
        { ex: 'row', track: 'row_reps' }
      ]},
      { id: 'L', name: 'Лёгкий день', focus: 'light', mult: 0.5, slots: [
        { ex: 'swing_2h', track: 'swing_vol' }
      ]},
      { id: 'G', name: 'Хват + бёдра', focus: 'mixed', mult: 0.8, slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'carry_suitcase', track: 'carry_time' }
      ]},
      { id: 'S', name: 'Ноги + корпус', focus: 'grind', mult: 0.8, slots: [
        { ex: 'goblet_squat', track: 'squat_reps' },
        { ex: 'carry_rack', track: 'carry_time' }
      ]},
      REST_DAY,
      REST_DAY
    ]
  }
};

// Волна нагрузки внутри блока.
// Длина блока настраивается: разгрузка каждые 4, 6 или 8 недель, либо никогда.
// По умолчанию 6 — доказательств, что разгрузка улучшает адаптацию, нет
// (Coleman et al., 2024), а при разгрузке каждую 4-ю неделю первый месяц
// занятий теряет четверть объёма. Шесть недель — компромисс: связки и хват
// при ежедневной работе всё-таки нужно разгружать, но не так часто.
export function waveFor(week, deloadEvery = 6) {
  if (!deloadEvery) {
    return { index: 0, mult: 1, name: 'Ровная нагрузка', hint: 'Разгрузка выключена. Объём растёт только прогрессией.', deload: false };
  }
  const i = week % deloadEvery;
  const isDeload = i === deloadEvery - 1;
  if (isDeload) {
    return { index: i, mult: 0.55, name: `Неделя ${i + 1} · разгрузка`,
             hint: 'Специально мало. Даём догнать связкам и хвату — они восстанавливаются медленнее мышц.', deload: true };
  }
  const ramp = deloadEvery > 2 ? i / (deloadEvery - 2) : 0;
  const mult = Math.round((1 + 0.2 * ramp) * 100) / 100;
  return {
    index: i, mult, deload: false,
    name: `Неделя ${i + 1} · ${i === 0 ? 'базовая' : mult >= 1.19 ? 'пик' : 'плюс'}`,
    hint: i === 0 ? 'Рабочий объём. Спокойно набираешь.'
        : mult >= 1.19 ? 'Самая объёмная неделя блока. Дальше разгрузка.'
        : 'Чуть больше работы, чем на прошлой.'
  };
}

export const DELOAD_OPTIONS = [
  { v: 4, label: 'каждые 4 недели', hint: 'чаще отдыха, медленнее прогресс' },
  { v: 6, label: 'каждые 6 недель', hint: 'по умолчанию' },
  { v: 8, label: 'каждые 8 недель', hint: 'для опытных и молодых суставов' },
  { v: 0, label: 'никогда', hint: 'следи за локтями сам' }
];

export const RPE_HINTS = {
  5: 'Совсем легко, будто разминка',
  6: 'Легко, мог бы ещё много',
  7: 'Комфортно, в запасе 3–4 повтора',
  8: 'Тяжеловато, в запасе 2 повтора',
  9: 'Очень тяжело, в запасе 1',
  10: 'До отказа, техника поплыла'
};
