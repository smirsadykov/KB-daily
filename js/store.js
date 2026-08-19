// Хранилище состояния. Всё живёт в localStorage, без сервера.
import { EXERCISES, PROGRAMS } from './data.js?v=38';

const KEY = 'kbdaily.v1';

export function todayISO(d = new Date()) {
  const t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return t.toISOString().slice(0, 10);
}

function defaultWeights(bells) {
  const b = [...bells].sort((x, y) => x - y);
  const ballistic = b[Math.min(1, b.length - 1)];
  const grind = b[0];
  const heavy = b[b.length - 1];
  const w = {};
  for (const [id, ex] of Object.entries(EXERCISES)) {
    if (ex.kind === 'mobility') continue;
    w[id] = ex.load === 'ballistic' ? ballistic : ex.load === 'heavy' ? heavy : grind;
  }
  return w;
}

export function defaultState() {
  const bells = [16, 24, 32];
  const weights = defaultWeights(bells);
  const progress = {};
  for (const id of Object.keys(weights)) {
    // steps — ступень отдельно для каждой лестницы прогрессии: одно и то же
    // упражнение в разных программах идёт по разным лестницам (махи в
    // «Ежедневном минимуме» и в S&S — это разные схемы роста)
    progress[id] = { weight: weights[id], step: 0, steps: {}, wins: 0, fails: 0 };
  }
  return {
    version: 1,
    onboarded: false,
    settings: {
      bells,
      // веса, которых у тебя по две штуки — нужны для двугиревых движений
      pairs: [],
      programId: 'daily_min',
      startDate: todayISO(),
      deloadEvery: 6,
      // положение в цикле программы и дата, на которую оно посчитано.
      // Двигается по факту тренировок, а не по календарю: пропущенная
      // тренировка не теряется, а ждёт следующего дня.
      cyclePos: 0,
      cycleDate: todayISO(),
      supps: [],          // какие добавки ты принимаешь
      customSupps: [],    // свои записи: то, чего нет в каталоге
      bodyWeight: null,   // нужен только чтобы посчитать дозу кофеина в мг/кг
      warmup: true,
      cooldown: true,
      tgu: false,
      sound: true,
      vibrate: true,
      wakeLock: true,
      autoRest: true
    },
    progress,
    sessions: [],
    tests: [],
    suppLog: {},        // { 'ГГГГ-ММ-ДД': { creatine: true, ... } }
    today: null,
    testDraft: null
  };
}

let state = null;

export function getState() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = migrate(parsed);
    } else {
      state = defaultState();
    }
  } catch (e) {
    console.warn('Не смог прочитать сохранение, начинаю с чистого', e);
    state = defaultState();
  }
  return state;
}

function migrate(s) {
  const base = defaultState();
  const merged = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  merged.progress = { ...base.progress, ...(s.progress || {}) };
  // Новые упражнения в библиотеке — добавляем состояние прогресса
  for (const [id, p] of Object.entries(base.progress)) {
    if (!merged.progress[id]) merged.progress[id] = p;
    if (!merged.progress[id].steps) merged.progress[id].steps = {};
  }
  if (!PROGRAMS[merged.settings.programId]) merged.settings.programId = 'daily_min';
  merged.sessions = Array.isArray(s.sessions) ? s.sessions : [];
  merged.tests = Array.isArray(s.tests) ? s.tests : [];
  merged.suppLog = (s.suppLog && typeof s.suppLog === 'object') ? s.suppLog : {};
  // Переход со старой схемы, где день считался от даты старта
  if (merged.settings.cyclePos === undefined) merged.settings.cyclePos = 0;
  if (!merged.settings.cycleDate) merged.settings.cycleDate = merged.settings.startDate || todayISO();
  delete merged.settings.cycleShift;
  // время тренировки задаёт программа, а не пользователь
  delete merged.settings.timeBudget;
  return merged;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Не смог сохранить', e);
  }
}

export function update(fn) {
  fn(state);
  save();
  return state;
}

export function resetAll() {
  state = defaultState();
  save();
}

export function setBells(bells) {
  const clean = [...new Set(bells.filter(n => n > 0))].sort((a, b) => a - b);
  if (!clean.length) return;
  state.settings.bells = clean;
  // Подтягиваем веса, которых больше нет в наличии, к ближайшему доступному
  for (const [id, p] of Object.entries(state.progress)) {
    if (!clean.includes(p.weight)) {
      p.weight = clean.reduce((best, b) => Math.abs(b - p.weight) < Math.abs(best - p.weight) ? b : best, clean[0]);
    }
  }
  save();
}

export function nextBell(weight, bells) {
  const b = [...bells].sort((x, y) => x - y);
  const i = b.indexOf(weight);
  if (i === -1) return b.find(x => x > weight) ?? null;
  return b[i + 1] ?? null;
}

export function prevBell(weight, bells) {
  const b = [...bells].sort((x, y) => x - y);
  const i = b.indexOf(weight);
  if (i === -1) return [...b].reverse().find(x => x < weight) ?? null;
  return b[i - 1] ?? null;
}

// ── Экспорт / импорт ─────────────────────────────────────────────────────────
export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Не похоже на файл с данными');
  state = migrate(parsed);
  save();
}
