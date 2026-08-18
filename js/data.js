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
  swing_vol: {
    kind: 'ballistic', reset: 1,
    steps: [
      { sets: 5, reps: 10, rest: 75 },
      { sets: 6, reps: 10, rest: 75 },
      { sets: 7, reps: 10, rest: 60 },
      { sets: 8, reps: 10, rest: 60 },
      { sets: 9, reps: 10, rest: 60 },
      { sets: 10, reps: 10, rest: 60 },
      { sets: 10, reps: 10, rest: 45 },
      { sets: 10, reps: 10, rest: 30 },
      { sets: 10, reps: 10, rest: 0, emom: 60, label: 'каждую минуту' }
    ]
  },
  snatch_vol: {
    kind: 'ballistic', reset: 1,
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
    kind: 'ladder', reset: 0,
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
  // ABC: каждый круг в минуту.
  abc_emom: {
    kind: 'emom', reset: 1,
    steps: [
      { sets: 5, emom: 60 },
      { sets: 6, emom: 60 },
      { sets: 7, emom: 60 },
      { sets: 8, emom: 60 },
      { sets: 9, emom: 60 },
      { sets: 10, emom: 60 },
      { sets: 12, emom: 60 },
      { sets: 10, emom: 50 },
      { sets: 12, emom: 50 }
    ]
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
    tag: 'классика · 20–30 мин',
    desc: '10×10 свингов одной рукой + подъёмы. Минимум упражнений, максимум повторяемости.',
    for: 'Если хочешь довести два движения до автоматизма.',
    origin: 'по мотивам Simple & Sinister Павла Цацулина. Отличия от оригинала: там 100 махов и 10 подъёмов каждую сессию сразу, а прогресс идёт заменой на гирю тяжелее по одному подходу и временными нормативами. Здесь объём наращивается подходами',
    days: [
      { id: 'S', name: 'S&S', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'tgu', track: 'tgu_reps', optional: 'tgu' },
        { ex: 'carry_rack', track: 'carry_time', replaces: 'tgu' }
      ]},
      { id: 'S', name: 'S&S', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'tgu', track: 'tgu_reps', optional: 'tgu' },
        { ex: 'carry_rack', track: 'carry_time', replaces: 'tgu' }
      ]},
      { id: 'S', name: 'S&S', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'tgu', track: 'tgu_reps', optional: 'tgu' },
        { ex: 'carry_rack', track: 'carry_time', replaces: 'tgu' }
      ]},
      { id: 'L', name: 'Лёгкий день', focus: 'light', mult: 0.6, slots: [
        { ex: 'swing_2h', track: 'swing_vol' }
      ]},
      { id: 'S', name: 'S&S', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'tgu', track: 'tgu_reps', optional: 'tgu' },
        { ex: 'carry_rack', track: 'carry_time', replaces: 'tgu' }
      ]},
      { id: 'S', name: 'S&S', focus: 'ballistic', slots: [
        { ex: 'swing_1h', track: 'swing_vol' },
        { ex: 'tgu', track: 'tgu_reps', optional: 'tgu' },
        { ex: 'carry_rack', track: 'carry_time', replaces: 'tgu' }
      ]},
      REST_DAY
    ]
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
    days: [
      { id: 'C', name: 'ABC', focus: 'grind', slots: [
        { ex: 'abc', track: 'abc_emom' }
      ]},
      { id: 'B', name: 'Свинги + переноски', focus: 'ballistic', slots: [
        { ex: 'swing_2h', track: 'swing_vol' },
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

// Волна нагрузки внутри 4-недельного блока
export const WAVE = [
  { mult: 1.00, name: 'Неделя 1 · базовая', hint: 'Рабочий объём. Спокойно набираешь.' },
  { mult: 1.10, name: 'Неделя 2 · плюс', hint: 'Чуть больше работы, чем на прошлой.' },
  { mult: 1.20, name: 'Неделя 3 · пик', hint: 'Самая объёмная неделя блока. Дальше разгрузка.' },
  { mult: 0.55, name: 'Неделя 4 · разгрузка', hint: 'Специально мало. Тело догоняет нагрузку именно здесь.' }
];

export const RPE_HINTS = {
  5: 'Совсем легко, будто разминка',
  6: 'Легко, мог бы ещё много',
  7: 'Комфортно, в запасе 3–4 повтора',
  8: 'Тяжеловато, в запасе 2 повтора',
  9: 'Очень тяжело, в запасе 1',
  10: 'До отказа, техника поплыла'
};
