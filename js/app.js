import { EXERCISES, PROGRAMS, TRACKS, WAVE, RPE_HINTS } from './data.js';
import { getState, save, update, resetAll, setBells, todayISO, exportJSON, importJSON } from './store.js';
import {
  planFor, applySession, summarizeItem, readinessMult, readinessLabel,
  waveIndex, isDeload, acwr, streak, sessionLoad, tonnage, nextStepText, dayIndex
} from './progression.js';
import { timer, fmt, unlockAudio } from './timer.js';
import { barChart, gauge } from './charts.js';

// ── Мелкие помощники ─────────────────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, a, b, c) => { const m = n % 100; const k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };

let S = getState();
let tab = 'today';
let toastTimer = null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

function openSheet(html) {
  $('#sheet').innerHTML = `<div class="sheet-grip"></div>${html}`;
  $('#sheetWrap').hidden = false;
}
function closeSheet() { $('#sheetWrap').hidden = true; $('#sheet').innerHTML = ''; }

const RU_DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const RU_MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${RU_MON[d.getMonth()]}`;
}
function sideText(s) { return s === 'L' ? 'левая' : s === 'R' ? 'правая' : ''; }

// ── Роутер ───────────────────────────────────────────────────────────────────
function render() {
  const screen = $('#screen');
  if (!S.onboarded) { screen.innerHTML = viewOnboarding(); setTop('Настроим под тебя', ''); return; }
  if (tab === 'today') { screen.innerHTML = viewToday(); }
  if (tab === 'timer') { screen.innerHTML = viewTimer(); }
  if (tab === 'history') { screen.innerHTML = viewHistory(); }
  if (tab === 'progress') { screen.innerHTML = viewProgress(); }
  if (tab === 'settings') { screen.innerHTML = viewSettings(); }
  $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  window.scrollTo({ top: 0 });
  updateRestbar();
}

function setTop(title, sub) {
  $('#topTitle').textContent = title;
  $('#topSub').textContent = sub || '';
}

// ── Онбординг ────────────────────────────────────────────────────────────────
const BELL_OPTIONS = [8, 12, 16, 20, 24, 28, 32, 40];

function viewOnboarding() {
  return `
  <div class="card accent">
    <h2>Гиря каждый день</h2>
    <p class="muted">Приложение само решает, сколько тебе сегодня работать, и само добавляет нагрузку, когда ты готов. Тебе остаётся открыть и сделать.</p>
  </div>

  <h3>Какие гири есть</h3>
  <div class="card">
    <div class="chips" id="bellChips">
      ${BELL_OPTIONS.map(b => `<button class="chip ${S.settings.bells.includes(b) ? 'on' : ''}" data-act="bell" data-v="${b}">${b} кг</button>`).join('')}
    </div>
    <p class="muted small mt">Отметь всё, что стоит дома. Между ними и будет расти вес.</p>
  </div>

  <h3>Программа</h3>
  ${Object.entries(PROGRAMS).map(([id, p]) => `
    <div class="card tight tap ${S.settings.programId === id ? 'accent' : ''}" role="button" tabindex="0" data-act="program" data-v="${id}">
      <div class="row between">
        <div class="ex-name">${h(p.name)}</div>
        <span class="pill ${S.settings.programId === id ? 'accent' : ''}">${h(p.tag)}</span>
      </div>
      <div class="muted small mt">${h(p.desc)}</div>
      <div class="muted small" style="opacity:.75">${h(p.for)}</div>
    </div>`).join('')}

  <div class="card">
    <div class="switch">
      <div><div class="sw-label">Турецкие подъёмы</div><div class="sw-hint">Если не делаешь — заменю на прогулки с гирей</div></div>
      <button class="sw ${S.settings.tgu ? 'on' : ''}" data-act="toggle" data-k="tgu"><i></i></button>
    </div>
  </div>

  <button class="btn" data-act="start-app">Начать</button>
  <p class="muted small center mt">Всё хранится только на телефоне. Никаких аккаунтов.</p>`;
}

// ── Экран «Сегодня» ──────────────────────────────────────────────────────────
function ensureToday() {
  if (S.today && S.today.date !== todayISO()) S.today = null;
}

function viewToday() {
  ensureToday();
  const date = todayISO();
  const wi = waveIndex(S, date);
  const wave = WAVE[wi];
  const d = new Date(date + 'T00:00:00');
  setTop('Сегодня', `${RU_DAYS[d.getDay()]}, ${prettyDate(date)} · ${wave.name}`);

  // если тренировка уже начата — показываем её, даже если по циклу сегодня отдых
  if (S.today) return viewSession(S.today.plan);

  const preview = planFor(S, date, null);
  if (preview.isRest) return viewRestDay(preview);
  return viewReadiness(preview, wave);
}

function viewRestDay(plan) {
  const alreadyLogged = S.sessions.some(s => s.date === todayISO());
  return `
  <div class="card accent">
    <h2>Сегодня отдых</h2>
    <p class="muted">${h(plan.note || 'Восстановление — часть плана, а не пропуск. Именно в эти дни закрепляется всё, что ты сделал.')}</p>
  </div>
  <div class="card">
    <h2>10 минут для себя</h2>
    <ul class="cues">
      <li>Прогулка 20–30 минут в спокойном темпе</li>
      <li>Кошка-верблюд 8 раз, ягодичный мост 10 раз</li>
      <li>Присед с раскачкой 5 раз, дыши в нижней точке</li>
      <li>Если после БЖЖ болит хват — просто повиси на перекладине 2×20 сек</li>
    </ul>
  </div>
  ${alreadyLogged
    ? '<div class="card center"><div class="big-check">✓</div><p class="muted mb0">День отмечен</p></div>'
    : '<button class="btn ghost" data-act="log-rest">Отметить день отдыха</button>'}
  <button class="btn line mt" data-act="train-anyway">Всё равно хочу потренироваться</button>`;
}

const READINESS_Q = [
  { k: 'sleep', q: 'Как спал?', lo: 'Разбит', hi: 'Отлично' },
  { k: 'soreness', q: 'Мышцы и суставы?', lo: 'Всё болит', hi: 'Свежий' },
  { k: 'energy', q: 'Сколько сил?', lo: 'Пусто', hi: 'Полный бак' }
];

let draftReadiness = { sleep: 4, soreness: 4, energy: 4 };

function viewReadiness(preview, wave) {
  const mult = readinessMult(draftReadiness);
  const lab = readinessLabel(draftReadiness);
  const withR = planFor(S, todayISO(), draftReadiness);
  const est = estimateMinutes(withR);
  return `
  <div class="card">
    <div class="row between">
      <div><div class="ex-name">${h(preview.dayName)}</div><div class="muted small">${h(preview.programName)}</div></div>
      <span class="pill ${preview.deload ? 'warn' : 'accent'}">${preview.deload ? 'разгрузка' : wave.name.split('·')[1]?.trim() || ''}</span>
    </div>
    <p class="muted small mt mb0">${h(wave.hint)}</p>
  </div>

  <h3>Как ты сегодня</h3>
  <div class="card">
    ${READINESS_Q.map(q => `
      <div style="margin-bottom:14px">
        <div class="row between" style="margin-bottom:6px">
          <span>${h(q.q)}</span>
          <span class="muted small">${h(q.lo)} → ${h(q.hi)}</span>
        </div>
        <div class="seg">
          ${[1, 2, 3, 4, 5].map(v => `<button class="${draftReadiness[q.k] === v ? 'on' : ''}" data-act="readiness" data-k="${q.k}" data-v="${v}">${v}</button>`).join('')}
        </div>
      </div>`).join('')}
    <div class="row between">
      <span class="pill ${lab.tone === 'bad' ? 'bad' : lab.tone === 'warn' ? 'warn' : 'ok'}">${h(lab.text)}</span>
      <span class="muted small">объём ×${withR.mult.toFixed(2).replace('.', ',')}</span>
    </div>
  </div>

  <h3>План на сегодня · примерно ${est} мин</h3>
  ${withR.items.map(it => `
    <div class="card tight">
      <div class="row between">
        <div class="grow"><div class="ex-name">${h(it.name)}</div>
        <div class="ex-meta">${h(it.scheme)} · ${it.weight} кг${it.label ? ' · ' + h(it.label) : ''}</div></div>
        <span class="pill">шаг ${it.step + 1}/${it.stepTotal}</span>
      </div>
    </div>`).join('')}

  <button class="btn" data-act="begin">Начать тренировку</button>
  ${mult <= 0.7 ? '<p class="muted small center mt">Плохой день — не повод пропускать. Объём я уже урезал, сделай что получится.</p>' : ''}`;
}

function estimateMinutes(plan) {
  let sec = plan.warmup.length ? 240 : 0;
  for (const it of plan.items) {
    // если подходы идут парами на левую и правую, отдыхаешь один раз на пару
    const paired = it.kind !== 'ballistic' && it.sets.some(s => s.side);
    it.sets.forEach((s, i) => {
      sec += s.sec || (s.reps || 1) * 3.5;
      if (it.emom) sec += it.emom;
      else if (!paired || i % 2 === 1) sec += it.rest || 45;
    });
  }
  return Math.max(5, Math.round(sec / 60));
}

function viewSession(plan) {
  const totalSets = plan.items.reduce((a, i) => a + i.sets.length, 0);
  const doneSets = plan.items.reduce((a, i) => a + i.sets.filter(s => s.done).length, 0);
  const pct = totalSets ? Math.round(doneSets / totalSets * 100) : 0;

  return `
  <div class="card accent">
    <div class="row between">
      <div><div class="ex-name">${h(plan.dayName)}</div><div class="muted small">${doneSets} из ${totalSets} подходов</div></div>
      <span class="pill accent">${pct}%</span>
    </div>
    <div class="ex-prog"><i style="width:${pct}%"></i></div>
  </div>

  ${plan.warmup.length ? `
  <details class="card tight tips" ${doneSets === 0 ? 'open' : ''}>
    <summary>Разминка · 4 минуты</summary>
    <ul class="cues">${plan.warmup.map(w => `<li>${h(EXERCISES[w.ex].name)} — ${w.reps}${w.note ? ' ' + h(w.note) : ''}</li>`).join('')}</ul>
  </details>` : ''}

  ${plan.items.map((it, i) => viewExercise(it, i)).join('')}

  ${plan.cooldown.length ? `
  <details class="card tight tips">
    <summary>Заминка · 2 минуты</summary>
    <ul class="cues">${plan.cooldown.map(w => `<li>${h(EXERCISES[w.ex].name)} — ${w.reps}${w.note ? ' ' + h(w.note) : ''}</li>`).join('')}</ul>
  </details>` : ''}

  <button class="btn" data-act="finish">Завершить тренировку</button>
  <button class="btn line mt" data-act="abort">Отменить и вернуться</button>`;
}

function viewExercise(it, i) {
  const ex = EXERCISES[it.exId];
  const done = it.sets.filter(s => s.done).length;
  return `
  <div class="card" data-ex="${i}">
    <div class="ex-head">
      <div class="grow">
        <div class="ex-name">${h(it.name)}</div>
        <div class="ex-meta">${h(it.scheme)} · ${it.weight} кг · отдых ${it.emom ? 'до конца минуты' : (it.rest || 0) + ' сек'}</div>
      </div>
      <span class="pill ${done === it.sets.length ? 'ok' : ''}">${done}/${it.sets.length}</span>
    </div>
    ${it.emom ? `<button class="btn ghost sm" data-act="emom" data-i="${i}">▶ Запустить интервалы ${it.emom} сек</button>` : ''}
    <div class="sets">
      ${it.sets.map((s, j) => viewSet(it, s, i, j)).join('')}
    </div>
    <details class="tips">
      <summary>Как делать правильно</summary>
      <ul class="cues">${(ex.cues || []).map(c => `<li>${h(c)}</li>`).join('')}</ul>
    </details>
  </div>`;
}

function viewSet(it, s, i, j) {
  const isTime = it.kind === 'time';
  const title = isTime
    ? `${s.sec} сек`
    : s.complex ? '1 круг' : `${s.actualReps ?? s.reps} ${plural(s.actualReps ?? s.reps, 'повтор', 'повтора', 'повторов')}`;
  const sub = [s.side ? `<span class="side-${s.side}">${sideText(s.side)}</span>` : '', `${s.weight} кг`, s.rung ? `ступень ${s.rung}` : '']
    .filter(Boolean).join(' · ');
  const btn = s.done ? '✓ есть' : isTime ? `▶ ${s.sec}с` : 'Готово';
  return `
  <div class="set ${s.done ? 'done' : ''}">
    <div class="set-n">${j + 1}</div>
    <div class="set-main tap" role="button" tabindex="0" aria-label="Изменить подход ${j + 1}" data-act="set-edit" data-i="${i}" data-j="${j}">
      <div class="set-title">${title}</div>
      <div class="set-sub">${sub}</div>
    </div>
    <button class="set-do" data-act="${isTime && !s.done ? 'set-time' : 'set-done'}" data-i="${i}" data-j="${j}">${btn}</button>
  </div>`;
}

// ── Экран «Таймер» ───────────────────────────────────────────────────────────
let timerCfg = { work: 60, rounds: 10 };

function viewTimer() {
  setTop('Таймер', 'Отдых, интервалы и секундомер');
  return `
  <div class="card" id="timerCard">${timerBody()}</div>

  <h3>Быстрый отдых</h3>
  <div class="chips">
    ${[30, 45, 60, 75, 90, 120, 180].map(s => `<button class="chip" data-act="quick-rest" data-v="${s}">${s < 60 ? s + ' сек' : fmt(s)}</button>`).join('')}
  </div>

  <h3>Интервалы (каждую минуту)</h3>
  <div class="card">
    <label class="field"><span>Интервал, секунд</span>
      <input type="number" inputmode="numeric" id="emomWork" value="${timerCfg.work}" min="10" max="600"></label>
    <label class="field"><span>Сколько кругов</span>
      <input type="number" inputmode="numeric" id="emomRounds" value="${timerCfg.rounds}" min="1" max="60"></label>
    <button class="btn" data-act="start-emom">Запустить</button>
  </div>

  <h3>Секундомер</h3>
  <button class="btn ghost" data-act="stopwatch">Включить секундомер</button>`;
}

function timerBody() {
  if (!timer.running) {
    return `<p class="timer-label">Таймер не запущен</p>
      <div class="timer-big" id="tBig">0:00</div>
      <p class="muted small center mb0">Звук включается после первого касания экрана — так требует браузер.</p>`;
  }
  const t = timer.mode === 'stopwatch' ? timer.elapsed() : timer.remaining();
  const sub = timer.mode === 'emom' ? `круг ${timer.round} из ${timer.totalRounds}` : timer.label;
  return `
    <p class="timer-label" id="tLabel">${h(sub)}</p>
    <div class="timer-big" id="tBig">${fmt(t)}</div>
    <div class="timer-grid">
      <button class="btn ghost sm" data-act="t-pause" style="width:100%">${timer.paused ? 'Дальше' : 'Пауза'}</button>
      <button class="btn ghost sm" data-act="t-add" data-v="15" style="width:100%">+15 сек</button>
      <button class="btn ghost sm" data-act="t-stop" style="width:100%">Стоп</button>
    </div>`;
}

function updateTimerScreen() {
  const card = $('#timerCard');
  if (!card) return;
  const big = $('#tBig');
  if (!big || !timer.running) { card.innerHTML = timerBody(); return; }
  big.textContent = fmt(timer.mode === 'stopwatch' ? timer.elapsed() : timer.remaining());
  const lab = $('#tLabel');
  if (lab) lab.textContent = timer.mode === 'emom' ? `круг ${timer.round} из ${timer.totalRounds}` : timer.label;
}

function updateRestbar() {
  const bar = $('#restbar');
  if (!timer.running || tab === 'timer') { bar.hidden = true; return; }
  bar.hidden = false;
  const t = timer.mode === 'stopwatch' ? timer.elapsed() : timer.remaining();
  const label = timer.mode === 'emom' ? `Круг ${timer.round}/${timer.totalRounds}` : timer.label;
  bar.innerHTML = `<div class="restbar-in">
      <div class="restbar-time">${fmt(t)}</div>
      <div class="grow small">${h(label)}</div>
      <button data-act="t-add" data-v="15">+15</button>
      <button data-act="t-stop">Стоп</button>
    </div>`;
}

// ── Экран «Дневник» ──────────────────────────────────────────────────────────
function viewHistory() {
  setTop('Дневник', `${S.sessions.length} ${plural(S.sessions.length, 'запись', 'записи', 'записей')}`);
  if (!S.sessions.length) {
    return `<div class="card center"><p class="muted mb0">Тут появятся тренировки. Сделай первую — и увидишь, как растёт.</p></div>`;
  }
  const sorted = [...S.sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.id - a.id));
  return sorted.map(s => {
    if (s.type === 'rest') {
      return `<div class="list-item tap" role="button" tabindex="0" data-act="del-ask" data-id="${s.id}">
        <span class="pill">отдых</span><span class="grow">${prettyDate(s.date)}</span>
        <span class="muted small">день отмечен</span></div>`;
    }
    const t = tonnage(s);
    return `<div class="list-item tap" role="button" tabindex="0" data-act="open-session" data-id="${s.id}" style="align-items:flex-start;flex-direction:column;gap:4px">
      <div class="row between" style="width:100%">
        <span class="ex-name">${h(s.dayName)}</span>
        <span class="muted small">${prettyDate(s.date)}</span>
      </div>
      <div class="muted small">${s.entries.length} ${plural(s.entries.length, 'упражнение', 'упражнения', 'упражнений')} · ${t ? t.toLocaleString('ru-RU') + ' кг · ' : ''}${s.durationMin} мин · RPE ${s.sessionRpe}</div>
    </div>`;
  }).join('') + `
  <hr class="sep">
  <div class="row" style="gap:8px">
    <button class="btn line sm grow" data-act="export">Сохранить файл</button>
    <button class="btn line sm grow" data-act="import">Загрузить файл</button>
  </div>`;
}

function sessionSheet(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return;
  openSheet(`
    <h2>${h(s.dayName)} · ${prettyDate(s.date)}</h2>
    <p class="muted small">${s.durationMin} мин · общий RPE ${s.sessionRpe}${s.deload ? ' · разгрузка' : ''}${s.readiness ? ` · готовность ×${readinessMult(s.readiness).toFixed(2)}` : ''}</p>
    <table class="tbl">
      <tr><th>Упражнение</th><th>Сделано</th><th>RPE</th></tr>
      ${s.entries.map(e => `<tr>
        <td>${h(EXERCISES[e.exId]?.short || e.exId)}<div class="muted small">${e.weight} кг</div></td>
        <td>${e.kind === 'time' ? e.doneSec + ' сек' : e.doneReps + ' повт'}<div class="muted small">${e.doneSets}/${e.plannedSets} подх</div></td>
        <td>${e.rpe}</td></tr>`).join('')}
    </table>
    ${s.notes ? `<p class="muted mt">${h(s.notes)}</p>` : ''}
    <button class="btn line mt" data-act="del-ask" data-id="${s.id}">Удалить запись</button>
    <button class="btn ghost mt" data-act="close-sheet">Закрыть</button>`);
}

// ── Экран «Прогресс» ─────────────────────────────────────────────────────────
function weekKey(iso) {
  const d = new Date(iso + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // понедельник = 0
  d.setDate(d.getDate() - day);
  return todayISO(d);
}

function viewProgress() {
  setTop('Прогресс', 'Что выросло и куда идём');
  const real = S.sessions.filter(s => s.type !== 'rest');
  const st = streak(S.sessions);
  const totalT = real.reduce((a, s) => a + tonnage(s), 0);
  const a = acwr(S.sessions);

  // тоннаж по неделям, последние 8
  const byWeek = new Map();
  for (const s of real) {
    const k = weekKey(s.date);
    byWeek.set(k, (byWeek.get(k) || 0) + tonnage(s));
  }
  const weeks = [];
  let cursor = new Date(weekKey(todayISO()) + 'T00:00:00');
  for (let i = 7; i >= 0; i--) {
    const d = new Date(cursor.getTime() - i * 7 * 86400000);
    const k = todayISO(d);
    weeks.push({ label: prettyDate(k), short: prettyDate(k).split(' ')[0], value: Math.round((byWeek.get(k) || 0) / 100) / 10, highlight: i === 0 });
  }

  const prog = PROGRAMS[S.settings.programId];
  const usedEx = new Set();
  for (const day of prog.days) for (const sl of day.slots) usedEx.add(sl.ex + '|' + sl.track);

  return `
  <div class="stat-grid">
    <div class="stat"><b>${st}</b><span>дней подряд</span></div>
    <div class="stat"><b>${real.length}</b><span>тренировок</span></div>
    <div class="stat"><b>${(totalT / 1000).toFixed(1)}т</b><span>поднято всего</span></div>
  </div>

  <h3>Тоннаж по неделям, тонн</h3>
  <div class="card">${barChart(weeks, { unit: ' т' })}</div>

  <h3>Скачок нагрузки</h3>
  <div class="card">
    <div class="row between">
      <span class="ex-name">${a.ratio == null ? '—' : a.ratio.toFixed(2).replace('.', ',')}</span>
      <span class="pill ${a.status === 'bad' ? 'bad' : a.status === 'warn' ? 'warn' : 'ok'}">${h(a.text)}</span>
    </div>
    ${gauge(a.ratio, a.status)}
    <p class="muted small mb0">Свежая неделя против привычной за месяц. Зелёная зона 0,8–1,3 — здесь растут, а не ломаются.</p>
  </div>

  <h3>Лестница прогрессии</h3>
  <div class="card">
    <table class="tbl">
      <tr><th>Упражнение</th><th>Вес</th><th>Шаг</th></tr>
      ${[...usedEx].map(key => {
        const [exId, trackId] = key.split('|');
        const p = S.progress[exId]; const tr = TRACKS[trackId];
        if (!p || !tr) return '';
        if (exId === 'tgu' && !S.settings.tgu) return '';
        return `<tr>
          <td>${h(EXERCISES[exId].name)}<div class="muted small">дальше: ${h(nextStepText(trackId, p.step))}</div></td>
          <td>${p.weight} кг</td>
          <td>${p.step + 1}/${tr.steps.length}${p.wins ? ' <span class="pill ok">+1</span>' : ''}</td>
        </tr>`;
      }).join('')}
    </table>
    <p class="muted small mt mb0">Две удачные тренировки подряд — шаг вперёд. Кончились шаги — берёшь гирю тяжелее и начинаешь объём заново.</p>
  </div>

  <h3>Где ты в блоке</h3>
  <div class="card">
    ${WAVE.map((w, i) => `<div class="row between" style="padding:6px 0${i === waveIndex(S) ? ';font-weight:700' : ';opacity:.6'}">
      <span>${h(w.name)}</span><span class="pill ${i === waveIndex(S) ? 'accent' : ''}">×${w.mult.toFixed(2).replace('.', ',')}</span></div>`).join('')}
    <p class="muted small mt mb0">Три недели растём, четвёртую разгружаемся. Форма приходит именно на разгрузке.</p>
  </div>`;
}

// ── Экран «Ещё» ──────────────────────────────────────────────────────────────
function viewSettings() {
  setTop('Ещё', 'Программа, гири, данные');
  const prog = PROGRAMS[S.settings.programId];
  const usedEx = new Set();
  for (const day of prog.days) for (const sl of day.slots) usedEx.add(sl.ex);

  return `
  <h3>Программа</h3>
  ${Object.entries(PROGRAMS).map(([id, p]) => `
    <div class="card tight tap ${S.settings.programId === id ? 'accent' : ''}" role="button" tabindex="0" data-act="program" data-v="${id}">
      <div class="row between"><div class="ex-name">${h(p.name)}</div><span class="pill ${S.settings.programId === id ? 'accent' : ''}">${h(p.tag)}</span></div>
      <div class="muted small mt">${h(p.desc)}</div>
    </div>`).join('')}

  <h3>Гири в наличии</h3>
  <div class="card">
    <div class="chips">
      ${BELL_OPTIONS.map(b => `<button class="chip ${S.settings.bells.includes(b) ? 'on' : ''}" data-act="bell" data-v="${b}">${b} кг</button>`).join('')}
    </div>
  </div>

  <h3>Рабочие веса</h3>
  <div class="card">
    ${[...usedEx].map(exId => {
      if (exId === 'tgu' && !S.settings.tgu) return '';
      const p = S.progress[exId];
      return `<div class="switch">
        <div><div class="sw-label">${h(EXERCISES[exId].name)}</div><div class="sw-hint">шаг ${p.step + 1}</div></div>
        <select data-act="weight" data-ex="${exId}" style="width:110px;min-height:42px">
          ${S.settings.bells.map(b => `<option value="${b}" ${b === p.weight ? 'selected' : ''}>${b} кг</option>`).join('')}
        </select>
      </div>`;
    }).join('')}
    <p class="muted small mt mb0">Меняешь вес руками — шаг объёма сбрасывается автоматически, чтобы не словить перегруз.</p>
  </div>

  <h3>Настройки</h3>
  <div class="card">
    ${[
      ['warmup', 'Разминка', 'Показывать перед тренировкой'],
      ['cooldown', 'Заминка', 'Пара движений в конце'],
      ['tgu', 'Турецкие подъёмы', 'Выключено — вместо них прогулки'],
      ['autoRest', 'Отдых сам включается', 'После каждого подхода'],
      ['sound', 'Звук', 'Сигналы таймера'],
      ['vibrate', 'Вибро', 'Если телефон умеет'],
      ['wakeLock', 'Не гасить экран', 'Пока идёт таймер']
    ].map(([k, label, hint]) => `
      <div class="switch">
        <div><div class="sw-label">${label}</div><div class="sw-hint">${hint}</div></div>
        <button class="sw ${S.settings[k] ? 'on' : ''}" data-act="toggle" data-k="${k}"><i></i></button>
      </div>`).join('')}
  </div>

  <h3>Цикл</h3>
  <div class="card">
    <div class="row between">
      <div><div class="sw-label">Старт блока</div><div class="sw-hint">${prettyDate(S.settings.startDate)} · сейчас ${WAVE[waveIndex(S)].name.toLowerCase()}</div></div>
      <button class="btn ghost sm" data-act="restart-block">Начать заново</button>
    </div>
  </div>

  <h3>Данные</h3>
  <div class="card">
    <div class="row" style="gap:8px">
      <button class="btn line sm grow" data-act="export">Сохранить</button>
      <button class="btn line sm grow" data-act="import">Загрузить</button>
    </div>
    <button class="btn danger mt" data-act="reset">Стереть всё</button>
  </div>

  <p class="muted small center">Гиря каждый день · всё считается на телефоне</p>`;
}

// ── Действия ─────────────────────────────────────────────────────────────────
const actions = {
  bell(el) {
    const v = +el.dataset.v;
    const bells = S.settings.bells.includes(v) ? S.settings.bells.filter(b => b !== v) : [...S.settings.bells, v];
    if (!bells.length) { toast('Хотя бы одна гиря нужна'); return; }
    setBells(bells);
    render();
  },
  program(el) {
    update(s => { s.settings.programId = el.dataset.v; s.today = null; });
    render();
    if (S.onboarded) toast('Программа сменилась');
  },
  toggle(el) {
    const k = el.dataset.k;
    update(s => { s.settings[k] = !s.settings[k]; if (k === 'tgu') s.today = null; });
    timer.configure({ sound: S.settings.sound, vibrate: S.settings.vibrate, keepAwake: S.settings.wakeLock });
    render();
  },
  weight(el) {
    const exId = el.dataset.ex;
    update(s => { s.progress[exId].weight = +el.value; s.progress[exId].step = 0; s.progress[exId].wins = 0; s.progress[exId].fails = 0; s.today = null; });
    render();
    toast('Вес обновлён, объём начнём заново');
  },
  'start-app'() {
    update(s => { s.onboarded = true; s.settings.startDate = todayISO(); });
    tab = 'today';
    render();
  },
  readiness(el) {
    draftReadiness[el.dataset.k] = +el.dataset.v;
    render();
  },
  begin() {
    const plan = planFor(S, todayISO(), draftReadiness);
    update(s => { s.today = { date: todayISO(), readiness: { ...draftReadiness }, plan, startedAt: Date.now() }; });
    render();
  },
  'train-anyway'() {
    // Берём ближайший рабочий день программы вместо отдыха
    const prog = PROGRAMS[S.settings.programId];
    const di = dayIndex(S);
    let altIdx = -1;
    for (let k = 1; k <= prog.days.length; k++) {
      const idx = (di + k) % prog.days.length;
      if (prog.days[idx].focus !== 'rest') { altIdx = idx; break; }
    }
    if (altIdx < 0) { toast('В программе нет рабочих дней'); return; }
    const plan = planFor(S, todayISO(), draftReadiness, altIdx);
    plan.dayName = plan.dayName + ' · вне графика';
    update(s => { s.today = { date: todayISO(), readiness: { ...draftReadiness }, plan, startedAt: Date.now() }; });
    render();
  },
  'log-rest'() {
    update(s => {
      s.sessions.push({ id: Date.now(), type: 'rest', date: todayISO(), dayName: 'Отдых', entries: [], durationMin: 0, sessionRpe: 0 });
    });
    render();
    toast('Отдых засчитан');
  },
  'set-done'(el) {
    const i = +el.dataset.i, j = +el.dataset.j;
    const it = S.today.plan.items[i];
    const s = it.sets[j];
    s.done = !s.done;
    if (s.done) { s.actualReps = s.actualReps ?? s.reps; s.ts = Date.now(); }
    save();
    render();
    if (s.done && S.settings.autoRest && it.rest && !it.emom) {
      const last = it.sets.every(x => x.done);
      if (!last) startRest(it.rest);
    }
  },
  'set-time'(el) {
    const i = +el.dataset.i, j = +el.dataset.j;
    const it = S.today.plan.items[i];
    const s = it.sets[j];
    unlockAudio();
    timer.startCountdown(s.sec, `${it.name}${s.side ? ' · ' + sideText(s.side) : ''}`);
    timer.onFinish = () => {
      s.done = true; s.ts = Date.now(); save();
      timer.onFinish = null;
      render();
      if (S.settings.autoRest && it.rest && !it.sets.every(x => x.done)) startRest(it.rest);
    };
    render();
  },
  'set-edit'(el) {
    const i = +el.dataset.i, j = +el.dataset.j;
    const it = S.today.plan.items[i];
    const s = it.sets[j];
    if (it.kind === 'time') {
      openSheet(`<h2>Подход ${j + 1}</h2>
        <label class="field"><span>Секунды</span><input type="number" inputmode="numeric" id="edSec" value="${s.sec}"></label>
        <button class="btn" data-act="save-set" data-i="${i}" data-j="${j}">Сохранить</button>
        <button class="btn ghost mt" data-act="toggle-set" data-i="${i}" data-j="${j}">${s.done ? 'Снять отметку' : 'Отметить сделанным'}</button>`);
      return;
    }
    openSheet(`<h2>Подход ${j + 1}${s.side ? ' · ' + sideText(s.side) : ''}</h2>
      <label class="field"><span>Повторов сделано</span><input type="number" inputmode="numeric" id="edReps" value="${s.actualReps ?? s.reps}"></label>
      <label class="field"><span>Вес, кг</span>
        <select id="edWeight">${S.settings.bells.map(b => `<option value="${b}" ${b === s.weight ? 'selected' : ''}>${b} кг</option>`).join('')}</select></label>
      <button class="btn" data-act="save-set" data-i="${i}" data-j="${j}">Сохранить</button>
      <button class="btn ghost mt" data-act="toggle-set" data-i="${i}" data-j="${j}">${s.done ? 'Снять отметку' : 'Отметить сделанным'}</button>`);
  },
  'save-set'(el) {
    const i = +el.dataset.i, j = +el.dataset.j;
    const s = S.today.plan.items[i].sets[j];
    const reps = $('#edReps'), w = $('#edWeight'), sec = $('#edSec');
    if (reps) s.actualReps = Math.max(0, +reps.value || 0);
    if (w) s.weight = +w.value;
    if (sec) s.sec = Math.max(0, +sec.value || 0);
    s.done = true;
    save(); closeSheet(); render();
  },
  'toggle-set'(el) {
    const i = +el.dataset.i, j = +el.dataset.j;
    const s = S.today.plan.items[i].sets[j];
    s.done = !s.done;
    if (s.done) s.actualReps = s.actualReps ?? s.reps;
    save(); closeSheet(); render();
  },
  emom(el) {
    const it = S.today.plan.items[+el.dataset.i];
    unlockAudio();
    timer.startEmom(it.emom, it.sets.length, it.name);
    tab = 'today';
    render();
    toast('Интервалы пошли');
  },
  abort() {
    openSheet(`<h2>Отменить тренировку?</h2>
      <p class="muted">Отметки подходов пропадут. Записи в дневнике не будет.</p>
      <button class="btn danger" data-act="abort-yes">Да, отменить</button>
      <button class="btn ghost mt" data-act="close-sheet">Продолжить тренировку</button>`);
  },
  'abort-yes'() {
    update(s => { s.today = null; });
    closeSheet(); render();
  },
  finish() {
    const plan = S.today.plan;
    const mins = Math.max(1, Math.round((Date.now() - S.today.startedAt) / 60000));
    const items = plan.items.map((it, i) => {
      const sum = summarizeItem(it);
      return { it, i, sum };
    });
    finishDraft = { rpe: {}, mins, notes: '' };
    for (const { it } of items) finishDraft.rpe[it.exId] = 7;
    openSheet(finishSheetHTML(items, mins));
  },
  'rpe-pick'(el) {
    // запоминаем то, что уже введено, чтобы не потерять при перерисовке
    finishDraft.mins = Math.max(1, +($('#finMins')?.value || finishDraft.mins));
    finishDraft.notes = $('#finNotes')?.value ?? finishDraft.notes;
    finishDraft.rpe[el.dataset.ex] = +el.dataset.v;
    const items = S.today.plan.items.map((it, i) => ({ it, i, sum: summarizeItem(it) }));
    openSheet(finishSheetHTML(items, finishDraft.mins));
  },
  'save-session'() {
    const plan = S.today.plan;
    const mins = Math.max(1, +($('#finMins')?.value || finishDraft.mins));
    const notes = $('#finNotes')?.value || finishDraft.notes || '';
    const entries = plan.items.map(it => {
      const sum = summarizeItem(it);
      return {
        exId: it.exId, trackId: it.trackId, kind: it.kind, name: it.name, weight: it.weight,
        plannedSets: sum.totalSets, doneSets: sum.doneSets,
        plannedReps: sum.plannedReps, doneReps: sum.doneReps, doneSec: sum.doneSec,
        complete: sum.complete, rpe: finishDraft.rpe[it.exId] ?? 7, step: it.step
      };
    }).filter(e => e.doneSets > 0);

    if (!entries.length) { toast('Ни одного подхода не отмечено'); return; }

    const rpes = entries.map(e => e.rpe);
    const session = {
      id: Date.now(),
      date: plan.date,
      programId: plan.programId,
      dayId: plan.dayId,
      dayName: plan.dayName,
      deload: plan.deload,
      waveIndex: plan.waveIndex,
      mult: plan.mult,
      readiness: plan.readiness,
      durationMin: mins,
      sessionRpe: Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length),
      notes,
      entries
    };
    const changes = applySession(S, session);
    update(s => { s.sessions.push(session); s.today = null; });
    closeSheet();
    render();
    showResult(session, changes);
  },
  'open-session'(el) { sessionSheet(+el.dataset.id); },
  'del-ask'(el) {
    const id = +el.dataset.id;
    openSheet(`<h2>Удалить запись?</h2><p class="muted">Прогрессия при этом не откатится.</p>
      <button class="btn danger" data-act="del-yes" data-id="${id}">Удалить</button>
      <button class="btn ghost mt" data-act="close-sheet">Отмена</button>`);
  },
  'del-yes'(el) {
    const id = +el.dataset.id;
    update(s => { s.sessions = s.sessions.filter(x => x.id !== id); });
    closeSheet(); render(); toast('Удалил');
  },
  'quick-rest'(el) { unlockAudio(); startRest(+el.dataset.v); render(); },
  'start-emom'() {
    unlockAudio();
    timerCfg.work = Math.max(5, +$('#emomWork').value || 60);
    timerCfg.rounds = Math.max(1, +$('#emomRounds').value || 10);
    timer.startEmom(timerCfg.work, timerCfg.rounds, 'Интервалы');
    render();
  },
  stopwatch() { unlockAudio(); timer.startStopwatch(); render(); },
  't-pause'() { timer.paused ? timer.resume() : timer.pause(); render(); },
  't-add'(el) { timer.addTime(+el.dataset.v); updateTimerScreen(); updateRestbar(); },
  't-stop'() { timer.onFinish = null; timer.stop(); render(); },
  'restart-block'() {
    update(s => { s.settings.startDate = todayISO(); s.today = null; });
    render(); toast('Блок начат заново с сегодня');
  },
  export() {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `girya-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Файл сохранён');
  },
  import() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        importJSON(await f.text());
        S = getState();
        render(); toast('Данные загружены');
      } catch (e) { toast('Не смог прочитать файл'); }
    };
    inp.click();
  },
  reset() {
    openSheet(`<h2>Стереть всё?</h2><p class="muted">Уйдут все тренировки и прогресс. Отменить будет нельзя.</p>
      <button class="btn danger" data-act="reset-yes">Да, стереть</button>
      <button class="btn ghost mt" data-act="close-sheet">Отмена</button>`);
  },
  'reset-yes'() { resetAll(); S = getState(); closeSheet(); tab = 'today'; render(); },
  'close-sheet'() { closeSheet(); }
};

let finishDraft = { rpe: {}, mins: 15, notes: '' };

function finishSheetHTML(items, mins) {
  return `
  <h2>Как прошло?</h2>
  <p class="muted small">Оцени, насколько было тяжело. От этого зависит, добавлю я нагрузку или нет.</p>
  ${items.map(({ it, sum }) => `
    <div style="margin-bottom:16px">
      <div class="row between" style="margin-bottom:6px">
        <span class="ex-name" style="font-size:15px">${h(it.name)}</span>
        <span class="pill ${sum.complete ? 'ok' : 'warn'}">${sum.doneSets}/${sum.totalSets}</span>
      </div>
      <div class="rpe-grid">
        ${[5, 6, 7, 8, 9, 10].map(v => `<button class="${finishDraft.rpe[it.exId] === v ? 'on' : ''}" data-act="rpe-pick" data-ex="${it.exId}" data-v="${v}">${v}</button>`).join('')}
      </div>
      <div class="muted small" style="margin-top:4px">${h(RPE_HINTS[finishDraft.rpe[it.exId]] || '')}</div>
    </div>`).join('')}
  <label class="field"><span>Сколько минут заняло</span><input type="number" inputmode="numeric" id="finMins" value="${mins}"></label>
  <label class="field"><span>Заметка (не обязательно)</span><textarea id="finNotes" placeholder="Например: правое плечо подтягивало"></textarea></label>
  <button class="btn" data-act="save-session">Сохранить тренировку</button>
  <button class="btn ghost mt" data-act="close-sheet">Ещё не закончил</button>`;
}

function showResult(session, changes) {
  const good = changes.filter(c => c.type === 'weight-up' || c.type === 'step-up');
  openSheet(`
    <div class="big-check">${good.length ? '🔥' : '✓'}</div>
    <h2 class="center">${good.length ? 'Есть прогресс' : 'Записал'}</h2>
    <p class="muted center small">${tonnage(session).toLocaleString('ru-RU')} кг поднято · ${session.durationMin} мин · нагрузка ${sessionLoad(session)}</p>
    <div class="card mt">
      ${changes.map(c => `<div class="row" style="padding:6px 0;gap:8px">
        <span>${c.type === 'weight-up' ? '⬆️' : c.type === 'step-up' ? '▲' : c.type === 'step-down' || c.type === 'weight-down' ? '▼' : '•'}</span>
        <span class="grow small">${h(c.text)}</span></div>`).join('')}
    </div>
    <button class="btn" data-act="close-sheet">Готово</button>`);
}

function startRest(sec) {
  unlockAudio();
  timer.onFinish = null;
  timer.startCountdown(sec, 'Отдых');
  updateRestbar();
}

// ── События ──────────────────────────────────────────────────────────────────
const FORM_TAGS = ['SELECT', 'INPUT', 'TEXTAREA', 'OPTION'];

document.addEventListener('click', (e) => {
  if (FORM_TAGS.includes(e.target.tagName)) { unlockAudio(); return; }
  const closeEl = e.target.closest('[data-close]');
  if (closeEl) { closeSheet(); return; }
  const el = e.target.closest('[data-act]');
  if (el) {
    unlockAudio();
    const fn = actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
    return;
  }
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; render(); }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest?.('[role="button"][data-act]');
  if (el && actions[el.dataset.act]) { e.preventDefault(); actions[el.dataset.act](el); }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});

timer.onUpdate = () => { updateRestbar(); if (tab === 'timer') updateTimerScreen(); };

// ── Старт ────────────────────────────────────────────────────────────────────
timer.configure({ sound: S.settings.sound, vibrate: S.settings.vibrate, keepAwake: S.settings.wakeLock });
ensureToday();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
