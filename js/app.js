import { EXERCISES, PROGRAMS, TRACKS, waveFor, DELOAD_OPTIONS, RPE_SCALE, rpeLabel, WARMUP, COOLDOWN } from './data.js?v=39';
import { getState, save, update, resetAll, setBells, todayISO, exportJSON, importJSON } from './store.js?v=39';
import {
  planFor, applySession, summarizeItem, readinessMult, readinessLabel,
  waveIndex, weekIndex, wave, isDeload, acwr, streak, sessionLoad, tonnage, nextStepText, stepText, dayIndex,
  estimateMinutes, pairRealRest, paceFactor, blockStatus, nextBlockSuggestions, commitCycle
} from './progression.js?v=39';
import { TESTS, TEST_ORDER, computePlacement, applyPlacement, readinessForTest } from './assessment.js?v=39';
import { SUPPLEMENTS, TIERS, TIMING, SOURCES, DOPING_WARNING, DIET_FIRST, CUSTOM_NOTE, doseFor, byId as suppById } from './supplements.js?v=39';

// byId должен видеть и свои записи пользователя, поэтому оборачиваем
const byId = (id) => suppById(id, S);
import { timer, fmt, unlockAudio } from './timer.js?v=39';
import { barChart, gauge } from './charts.js?v=39';

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
// Экран перерисовывается целиком после каждого действия. Если при этом
// всегда прыгать наверх, отмечать подходы невозможно: после каждого «Готово»
// приходится скроллить обратно. Поэтому наверх уходим только когда реально
// сменился экран, а не когда перерисовали тот же самый.
let lastViewKey = null;

function viewKey() {
  return [tab, S.onboarded ? 1 : 0, S.today ? 1 : 0, S.testDraft?.i ?? '-'].join('|');
}

function render() {
  const screen = $('#screen');
  const key = viewKey();
  const sameView = key === lastViewKey;
  const keepY = window.scrollY;
  // innerHTML стирает состояние <details>: раскрытые подсказки захлопывались
  // после каждой отметки подхода. Запоминаем открытые и возвращаем обратно.
  const openDetails = new Set($$('details[data-key]').filter(d => d.open).map(d => d.dataset.key));
  const вернутьРаскрытые = () =>
    $$('details[data-key]').forEach(d => { if (openDetails.has(d.dataset.key)) d.open = true; });

  if (!S.onboarded) {
    screen.innerHTML = viewOnboarding();
    setTop('Настроим под тебя', '');
    // экран настройки выходит здесь, поэтому раскрытое возвращаем и тут:
    // иначе выбор программы захлопывал уже открытое «что даёт и чего не даёт»
    вернутьРаскрытые();
    lastViewKey = key;
    if (sameView) window.scrollTo({ top: keepY });
    return;
  }
  if (tab === 'today') { screen.innerHTML = viewToday(); }
  if (tab === 'test') { screen.innerHTML = viewTest(); }
  if (tab === 'supps') { screen.innerHTML = viewSupps(); }
  if (tab === 'timer') { screen.innerHTML = viewTimer(); }
  if (tab === 'history') { screen.innerHTML = viewHistory(); }
  if (tab === 'progress') { screen.innerHTML = viewProgress(); }
  if (tab === 'settings') { screen.innerHTML = viewSettings(); }
  $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));

  вернутьРаскрытые();

  lastViewKey = key;
  // при возврате позиции ограничиваем её новой высотой страницы:
  // после урезания списка старая координата может оказаться за концом
  if (sameView) {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(keepY, max) });
  } else {
    window.scrollTo({ top: 0 });
  }
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
      ${p.warn ? `<div class="muted small" style="margin-top:8px;color:var(--warn)">⚠️ ${h(p.warn)}</div>` : ''}
      ${p.origin ? `<div class="muted small" style="opacity:.6;margin-top:6px">Происхождение: ${h(p.origin)}</div>` : ''}
      ${p.gives ? `<details class="tips" data-key="prog-${id}" style="margin-top:8px">
        <summary>Что даёт и чего не даёт</summary>
        <div class="muted small" style="margin-top:6px"><b>Даёт:</b></div>
        <ul class="cues">${p.gives.map(x => `<li>${h(x)}</li>`).join('')}</ul>
        <div class="muted small"><b>Не даёт:</b></div>
        <ul class="cues">${p.limits.map(x => `<li>${h(x)}</li>`).join('')}</ul>
      </details>` : ''}
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
  const w = wave(S, date);
  const d = new Date(date + 'T00:00:00');
  setTop('Сегодня', `${RU_DAYS[d.getDay()]}, ${prettyDate(date)} · ${w.name}`);

  // если тренировка уже начата — показываем её, даже если по циклу сегодня отдых
  if (S.today) return viewSession(S.today.plan);

  const preview = planFor(S, date, null);
  const banner = !(S.tests || []).length ? `
    <div class="card tight tap" role="button" tabindex="0" data-act="test-open" style="border-color:var(--accent)">
      <div class="row between">
        <div class="grow">
          <div class="ex-name">Пройти тест кондиций</div>
          <div class="muted small">25 минут — и приложение начнёт с твоего уровня, а не с нуля</div>
        </div>
        <span class="pill accent">→</span>
      </div>
    </div>` : '';

  if (preview.isRest) return banner + suppCard() + viewRestDay(preview);
  return banner + suppCard() + viewReadiness(preview, w);
}


// Карточка добавок на главном экране. Держим её вверху и всегда видимой:
// в разделе «Ещё» её никто не находит, а креатин и бета-аланин работают
// только от регулярности.
function suppCard() {
  const chosen = (S.settings.supps || []).filter(id => byId(id));
  if (!chosen.length) {
    return `
    <div class="card tight tap" role="button" tabindex="0" data-act="supps-open">
      <div class="row between">
        <div class="grow">
          <div class="ex-name" style="font-size:15px">Добавки</div>
          <div class="muted small">Выбери, что принимаешь — буду напоминать здесь</div>
        </div>
        <span class="pill">настроить</span>
      </div>
    </div>`;
  }
  const log = suppsToday();
  const left = chosen.filter(id => !log[id]).length;
  return `
  <div class="card tight">
    <div class="row between" style="margin-bottom:10px">
      <div class="grow">
        <div class="ex-name" style="font-size:15px">Добавки на сегодня</div>
        <div class="muted small">${left ? `осталось ${left} из ${chosen.length}` : 'всё принято'}</div>
      </div>
      ${left ? '' : '<span class="pill ok">✓</span>'}
    </div>
    <div class="chips">
      ${chosen.map(id => {
        const sp = byId(id);
        const done = !!log[id];
        return `<button class="chip ${done ? 'on' : ''}" data-act="supp-take" data-id="${id}"
          title="${h(doseFor(sp, S.settings.bodyWeight))}">${done ? '✓ ' : ''}${h(sp.name)}</button>`;
      }).join('')}
    </div>
    <div class="muted small" style="margin-top:8px">
      ${chosen.map(id => byId(id)).filter(sp => !log[sp.id])
        .map(sp => { const d = doseFor(sp, S.settings.bodyWeight); return d ? `${h(sp.name)}: ${h(d)}` : h(sp.name); })
        .join(' · ') || 'Нажми ещё раз, чтобы снять отметку'}
    </div>
  </div>`;
}

function viewRestDay(plan) {
  const alreadyLogged = S.sessions.some(s => s.date === todayISO());
  const prog = PROGRAMS[S.settings.programId];

  // Что будет следующей тренировкой — чтобы день отдыха не был пустым экраном
  let след = null, черезДней = 0;
  for (let k = 1; k <= prog.days.length; k++) {
    const d = prog.days[(plan.dayIndex + k) % prog.days.length];
    if (d.focus !== 'rest') { след = d; черезДней = k; break; }
  }

  // Мобильность берём из библиотеки приложения, а не из выдуманного списка:
  // раньше здесь висели четыре строчки, одинаковые для всех программ,
  // и в них упоминалось БЖЖ независимо от того, чем ты занимаешься.
  const восстановление = (S.settings.cooldown ? COOLDOWN : WARMUP.slice(0, 3));

  return `
  <div class="card accent">
    <h2>Сегодня отдых</h2>
    <p class="muted mb0">${h(plan.note || 'Восстановление — часть плана, а не пропуск. Именно в эти дни закрепляется всё, что ты сделал.')}</p>
  </div>

  ${след ? `
  <div class="card tight">
    <div class="row between">
      <div class="grow">
        <div class="ex-name" style="font-size:15px">${h(след.name)}</div>
        <div class="muted small">${черезДней === 1 ? 'завтра' : `через ${черезДней} ${plural(черезДней, 'день', 'дня', 'дней')}`} · ${h(prog.name)}</div>
      </div>
      <span class="pill">дальше</span>
    </div>
  </div>` : ''}

  <div class="card">
    <h2>Если хочется подвигаться</h2>
    <ul class="cues">
      <li>Спокойная прогулка 20–30 минут</li>
      ${восстановление.map(w => `<li>${h(EXERCISES[w.ex].name)} — ${w.reps}${w.note ? ' ' + h(w.note) : ''}</li>`).join('')}
    </ul>
    <p class="muted small mb0">Это не тренировка и не должно ей стать. Если после мобильности хочется взять гирю — значит вчера ты недоработал, а не сегодня недогулял.</p>
  </div>

  ${alreadyLogged
    ? '<div class="card center"><div class="big-check">✓</div><p class="muted mb0">День отмечен</p></div>'
    : '<button class="btn ghost" data-act="log-rest">Отметить день отдыха</button>'}
`;
}

const READINESS_Q = [
  { k: 'sleep', q: 'Как спал?', lo: 'Разбит', hi: 'Отлично' },
  { k: 'soreness', q: 'Мышцы и суставы?', lo: 'Всё болит', hi: 'Свежий' },
  { k: 'energy', q: 'Сколько сил?', lo: 'Пусто', hi: 'Полный бак' }
];

let draftReadiness = { sleep: 4, soreness: 4, energy: 4 };

// dayOverride обязателен для тренировки вне графика: иначе экран пересчитает
// план по календарю, попадёт на день отдыха и покажет пустой список,
// хотя в шапке будет стоять выбранная тренировка.
function viewReadiness(preview, wave, dayOverride = null) {
  const mult = readinessMult(draftReadiness);
  const lab = readinessLabel(draftReadiness);
  const withR = planFor(S, todayISO(), draftReadiness, dayOverride ?? undefined);
  const est = estimateMinutes(withR);
  return `
  <div class="card">
    <div class="row between">
      <div><div class="ex-name">${h(preview.dayName)}</div><div class="muted small">${h(preview.programName)} · день ${preview.dayIndex + 1} из ${PROGRAMS[preview.programId].days.length}</div></div>
      <span class="pill ${preview.deload ? 'warn' : 'accent'}">${preview.deload ? 'разгрузка' : wave.name.split('·')[1]?.trim() || ''}</span>
    </div>
    <p class="muted small mt mb0">${h(wave.hint)}</p>
    ${nextDaysHint(preview)}
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

  <h3>План на сегодня · примерно ${est} мин${withR.paceFactor !== 1 ? ' (по твоему темпу)' : ''}</h3>
  ${withR.trims?.length ? `
    <div class="card tight">
      <span class="pill ok">как задумано в программе</span>
      <div class="muted small mt mb0">${withR.trims.map(h).join(' · ')}</div>
    </div>` : ''}
  ${withR.items.map((it, i) => {
    const pair = withR.pairs?.find(p => p.b === i);
    if (pair) return '';
    const partner = withR.pairs?.find(p => p.a === i);
    return `
    <div class="card tight">
      <div class="row between">
        <div class="grow"><div class="ex-name">${h(it.name)}${partner ? ' + ' + h(withR.items[partner.b].name.toLowerCase()) : ''}</div>
        <div class="ex-meta">${h(it.scheme)}${partner ? ' и ' + h(withR.items[partner.b].scheme) : ''} · ${it.weight} кг${partner ? ' / ' + withR.items[partner.b].weight + ' кг' : ''}</div></div>
        <span class="pill${partner ? ' accent' : ''}">${partner ? 'в паре' : 'шаг ' + (it.step + 1) + '/' + it.stepTotal}</span>
      </div>
    </div>`;
  }).join('')}

  <button class="btn" data-act="begin">Начать тренировку</button>
  ${mult <= 0.7 ? '<p class="muted small center mt">Плохой день — не повод пропускать. Объём я уже урезал, сделай что получится.</p>' : ''}`;
}


// Что будет в ближайшие дни. Без этого промежуточный день цикла выглядит так,
// будто программа выдала не то, что обещала названием: выбрал «Броневой
// комплекс», а на экране махи с переносками.
function nextDaysHint(plan) {
  const prog = PROGRAMS[plan.programId];
  const upcoming = [];
  for (let k = 1; k <= 3; k++) {
    const d = prog.days[(plan.dayIndex + k) % prog.days.length];
    upcoming.push(d.focus === 'rest' ? 'отдых' : d.name.replace(/^[^·]+ · /, '').toLowerCase());
  }
  return `<div class="muted small" style="margin-top:8px;opacity:.8">Дальше: ${h(upcoming.join(' → '))}</div>`;
}


// Выбор тяжести словами, а не числом. Все варианты видно сразу — человек
// сравнивает формулировки между собой, а не гадает, что значит «семёрка».
function rpePicker(value, act, extra = '') {
  return `
  <div style="display:flex;flex-direction:column;gap:6px">
    ${RPE_SCALE.map(o => `
      <button class="set ${o.v === value ? 'done' : ''}" style="width:100%;text-align:left;cursor:pointer"
              data-act="${act}" data-v="${o.v}"${extra}>
        <div class="set-main">
          <div class="set-title">${h(o.label)}</div>
          <div class="set-sub">${h(o.hint)}</div>
        </div>
        <div class="set-n" style="width:auto">${o.v === value ? '✓' : ''}</div>
      </button>`).join('')}
  </div>`;
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

  ${suppCard()}

  ${plan.warmup.length ? `
  <details class="card tight tips" data-key="warmup" ${doneSets === 0 ? 'open' : ''}>
    <summary>Разминка · 4 минуты</summary>
    <ul class="cues">${plan.warmup.map(w => `<li>${h(EXERCISES[w.ex].name)} — ${w.reps}${w.note ? ' ' + h(w.note) : ''}</li>`).join('')}</ul>
  </details>` : ''}

  ${(plan.pairs || []).map(p => viewPair(plan, p)).join('')}
  ${plan.items.map((it, i) => (plan.pairs || []).some(p => p.a === i || p.b === i) ? '' : viewExercise(it, i)).join('')}

  ${plan.cooldown.length ? `
  <details class="card tight tips" data-key="cooldown">
    <summary>Заминка · 2 минуты</summary>
    <ul class="cues">${plan.cooldown.map(w => `<li>${h(EXERCISES[w.ex].name)} — ${w.reps}${w.note ? ' ' + h(w.note) : ''}</li>`).join('')}</ul>
  </details>` : ''}

  <button class="btn" data-act="finish">Завершить тренировку</button>
  <button class="btn line mt" data-act="abort">Отменить и вернуться</button>`;
}

// Парный блок: подходы двух движений идут вперемешку.
// Пока работает одно, отдыхает другое — отсюда и экономия времени.
function viewPair(plan, p) {
  const a = plan.items[p.a], b = plan.items[p.b];
  const all = [...a.sets, ...b.sets];
  const done = all.filter(s => s.done).length;
  const rest = pairRealRest(plan, p);
  let round = 0;
  return `
  <div class="card">
    <div class="ex-head">
      <div class="grow">
        <div class="ex-name">${h(a.name)} + ${h(b.name.toLowerCase())}</div>
        <div class="ex-meta">чередуешь подходы · пауза ${p.rest} сек · ${a.weight} кг / ${b.weight} кг</div>
      </div>
      <span class="pill ${done === all.length ? 'ok' : 'accent'}">${done}/${all.length}</span>
    </div>
    <p class="muted small">Пауза короткая, но между своими подходами каждое движение отдыхает ${rest.a} и ${rest.b} сек. Учти: гирю оба раза держит одна рука, поэтому первым сдастся хват, а не бёдра. Поплыл хват — это сигнал добавить времени в настройках, а не дотерпеть.</p>
    <div class="sets">
      ${p.order.map(o => {
        const isA = o.side === 'a';
        const it = isA ? a : b;
        const idx = isA ? p.a : p.b;
        const s = it.sets[o.idx];
        if (!s) return '';
        if (isA) round++;
        return `${isA ? `<div class="muted small" style="margin-top:6px">Круг ${round}</div>` : ''}
          ${viewSet(it, s, idx, o.idx, EXERCISES[it.exId].short)}`;
      }).join('')}
    </div>
    <details class="tips" data-key="pair-${p.a}-${p.b}">
      <summary>Как делать правильно</summary>
      <ul class="cues">${[a, b].map(x => `<li><b>${h(EXERCISES[x.exId].short)}:</b> ${h((EXERCISES[x.exId].cues || [])[0] || '')}</li>`).join('')}</ul>
    </details>
  </div>`;
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
    <details class="tips" data-key="ex-${it.exId}">
      <summary>Как делать правильно</summary>
      <ul class="cues">${(ex.cues || []).map(c => `<li>${h(c)}</li>`).join('')}</ul>
    </details>
  </div>`;
}

function viewSet(it, s, i, j, exLabel) {
  const isTime = s.sec > 0;
  const title = s.gs
    ? `${Math.round(s.sec / 60)} мин · ${s.rpm} в минуту = ${s.reps} подъёмов`
    : isTime ? (s.sec >= 120 ? `${Math.round(s.sec / 60)} мин` : `${s.sec} сек`)
    : s.complex ? `1 круг${s.complexReps ? ' · ' + s.complexReps : ''}` : `${exLabel ? exLabel + ' · ' : ''}${s.actualReps ?? s.reps} ${plural(s.actualReps ?? s.reps, 'повтор', 'повтора', 'повторов')}`;
  const sub = [s.side ? `<span class="side-${s.side}">${sideText(s.side)}</span>` : '', `${s.weight} кг`, s.rung ? `ступень ${s.rung}` : '']
    .filter(Boolean).join(' · ');
  const btn = s.done ? '✓ есть' : s.gs || s.sec >= 120 ? `▶ ${Math.round(s.sec / 60)} мин` : isTime ? `▶ ${s.sec}с` : 'Готово';
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

// ── Экран «Тест кондиций» ────────────────────────────────────────────────────
function defaultTestDraft() {
  const b = S.settings.bells;
  const ballistic = S.progress.swing_1h?.weight ?? b[Math.min(1, b.length - 1)];
  const grind = S.progress.clean_press?.weight ?? b[0];
  const heavy = S.progress.carry_farmer?.weight ?? b[b.length - 1];
  return {
    i: 0,
    press: { bell: grind, reps: 5 },
    swing: { bell: ballistic, rpe: 7, techniqueHeld: true },
    squat: { bell: grind, reps: 10 },
    carry: { bell: heavy, sec: 45 }
  };
}

function testDraft() {
  if (!S.testDraft) S.testDraft = defaultTestDraft();
  return S.testDraft;
}

function bellPicker(key, current) {
  return `<div class="chips">${S.settings.bells.map(b =>
    `<button class="chip ${b === current ? 'on' : ''}" data-act="test-bell" data-k="${key}" data-v="${b}">${b} кг</button>`).join('')}</div>`;
}

function counter(key, field, value, min, max, unit, stepBy = 1) {
  return `<div class="row" style="gap:10px;justify-content:center;margin:14px 0">
      <button class="btn ghost sm" style="width:56px" data-act="test-num" data-k="${key}" data-f="${field}" data-d="${-stepBy}" data-min="${min}" data-max="${max}">−</button>
      <div style="min-width:120px;text-align:center">
        <div style="font-size:38px;font-weight:800;letter-spacing:-.03em">${value}</div>
        <div class="muted small">${unit}</div>
      </div>
      <button class="btn ghost sm" style="width:56px" data-act="test-num" data-k="${key}" data-f="${field}" data-d="${stepBy}" data-min="${min}" data-max="${max}">+</button>
    </div>`;
}

function viewTest() {
  const d = testDraft();
  const stage = TEST_ORDER[d.i];
  setTop('Тест кондиций', `шаг ${d.i + 1} из ${TEST_ORDER.length}`);

  if (stage === 'intro') {
    const r = readinessForTest(S, todayISO());
    const prev = (S.tests || []).slice(-1)[0];
    return `
    <div class="card accent">
      <h2>Зачем это</h2>
      <p class="muted">Приложение не знает, что ты уже умеешь, и по умолчанию начинает с нуля. Тест занимает около 25 минут и ставит тебя сразу на свой уровень — без трёх недель разминочных тренировок.</p>
    </div>

    <div class="card ${r.level === 'warn' ? '' : ''}">
      <span class="pill ${r.level === 'warn' ? 'warn' : r.level === 'note' ? 'warn' : 'ok'}">${r.level === 'warn' ? 'лучше подождать' : r.level === 'note' ? 'можно, но' : 'готов'}</span>
      <p class="muted small mt mb0">${h(r.text)}</p>
    </div>

    <h3>Два правила, иначе тест вредит</h3>
    <div class="card">
      <p><b>Не до отказа.</b> Ни один тест не доводится до срыва. У каждого есть стоп-правило по технике — оно и есть результат. Максимум с гирей ловится потерей формы, а не силой, и ловить его опасно.</p>
      <p class="mb0"><b>Ставлю ниже измеренного.</b> Тест показывает, что ты можешь один раз. Программе нужно то, что ты повторишь завтра и послезавтра. Поэтому итоговая ступень будет на одну ниже результата — это не занижение, это разница между разовым максимумом и рабочим объёмом.</p>
    </div>

    <h3>Что меряем</h3>
    ${Object.entries(TESTS).map(([k, t]) => `
      <div class="card tight">
        <div class="ex-name">${h(t.name)}</div>
        <div class="muted small">${h(t.what)}</div>
      </div>`).join('')}

    ${prev ? `<div class="card tight"><span class="pill">прошлый тест</span>
      <div class="muted small mt mb0">${prettyDate(prev.date)}: жим ${prev.results.press.reps} повт · махи ${h(rpeLabel(prev.results.swing.rpe).toLowerCase())} · присед ${prev.results.squat.reps} повт · переноска ${prev.results.carry.sec} сек</div></div>` : ''}

    <button class="btn" data-act="test-next">Начать тест</button>
    <button class="btn line mt" data-act="test-exit">Не сейчас</button>
    <p class="muted small center mt">Разомнись как обычно. Между тестами отдыхай 3–5 минут — иначе меряешь усталость, а не кондиции.</p>`;
  }

  if (stage === 'result') return viewTestResult();

  const t = TESTS[stage];
  const val = d[stage];
  return `
  <div class="card accent">
    <div class="row between">
      <div class="ex-name">${h(t.name)}</div>
      <span class="pill accent">${d.i} из 4</span>
    </div>
    <div class="muted small">${h(t.what)}</div>
  </div>

  <div class="card">
    <h2>Как делать</h2>
    <ul class="cues">${t.how.map(x => `<li>${h(x)}</li>`).join('')}</ul>
  </div>

  <div class="card" style="border-color:var(--warn)">
    <span class="pill warn">стоп-правило</span>
    <p class="muted small mt mb0">${h(t.stop)}</p>
  </div>

  <h3>Какой гирей</h3>
  <div class="card">${bellPicker(stage, val.bell)}</div>

  ${stage === 'swing' ? `
    <div class="card">
      <p class="muted small">Запусти таймер: 5 кругов по минуте. В начале каждой минуты — 10 махов, рука меняется каждый круг.</p>
      <button class="btn ghost" data-act="test-emom">▶ Запустить 5 минут</button>
    </div>` : ''}

  ${stage === 'carry' ? `
    <div class="card">
      <p class="muted small">Включи секундомер, иди — и останови, когда сработало стоп-правило.</p>
      <button class="btn ghost" data-act="test-stopwatch">▶ Секундомер</button>
    </div>` : ''}

  <h3>${h(t.label)}</h3>
  <div class="card">
    ${t.input === 'reps' ? counter(stage, 'reps', val.reps, 0, t.cap, plural(val.reps, 'повтор', 'повтора', 'повторов')) : ''}
    ${t.input === 'sec' ? counter(stage, 'sec', val.sec, 0, t.cap, 'секунд', 5) : ''}
    ${t.input === 'rpe' ? `
      ${rpePicker(val.rpe, 'test-rpe')}
      <div class="switch mt">
        <div><div class="sw-label">Техника дожила до конца</div><div class="sw-hint">Спина ровная, гиря не выше груди</div></div>
        <button class="sw ${val.techniqueHeld ? 'on' : ''}" data-act="test-tech"><i></i></button>
      </div>` : ''}
  </div>

  <button class="btn" data-act="test-next">${d.i === TEST_ORDER.length - 2 ? 'Посмотреть результат' : 'Дальше'}</button>
  <button class="btn line mt" data-act="test-back">Назад</button>`;
}

function viewTestResult() {
  const d = testDraft();
  const placement = computePlacement(d);
  const prog = PROGRAMS[S.settings.programId];
  const used = new Set();
  for (const day of prog.days) for (const sl of day.slots) used.add(sl.ex);

  const shown = placement.items.filter(it => used.has(it.exId));
  const rest = placement.items.filter(it => !used.has(it.exId));

  return `
  <div class="card accent center">
    <div class="big-check">📋</div>
    <h2>Вот твой уровень</h2>
    <p class="muted small mb0">Жим ${d.press.reps} повт · махи ${h(rpeLabel(d.swing.rpe).toLowerCase())} · присед ${d.squat.reps} повт · переноска ${d.carry.sec} сек</p>
  </div>

  ${placement.warnings.length ? `<div class="card" style="border-color:var(--warn)">
    ${placement.warnings.map(w => `<p class="small mb0" style="margin-bottom:8px">⚠️ ${h(w)}</p>`).join('')}
  </div>` : ''}

  <h3>С чего начнёшь в своей программе</h3>
  <div class="card">
    <table class="tbl">
      <tr><th>Упражнение</th><th>Старт</th></tr>
      ${shown.map(it => `<tr>
        <td>${h(EXERCISES[it.exId].name)}<div class="muted small">${it.weight} кг</div></td>
        <td>${h(stepText(it.trackId, it.step))}<div class="muted small">ступень ${it.step + 1}</div></td>
      </tr>`).join('')}
    </table>
  </div>

  ${rest.length ? `<details class="card tight tips" data-key="test-rest">
    <summary>Остальные упражнения (для других программ)</summary>
    <table class="tbl">
      ${rest.map(it => `<tr><td>${h(EXERCISES[it.exId].name)}</td><td>${it.weight} кг · ступень ${it.step + 1}</td></tr>`).join('')}
    </table>
  </details>` : ''}

  <button class="btn" data-act="test-apply">Применить и начать отсюда</button>
  <button class="btn line mt" data-act="test-back">Изменить ответы</button>
  <p class="muted small center mt">Если первая неделя пойдёт тяжело — не терпи. Отмечай честно, что было тяжело, и приложение само откатит на ступень назад.</p>`;
}


// ── Экран «Добавки» ──────────────────────────────────────────────────────────
function suppsToday() {
  const d = todayISO();
  return (S.suppLog && S.suppLog[d]) || {};
}

function suppAdherence(days = 30) {
  const enabled = (S.settings.supps || []).filter(id => byId(id)?.daily);
  if (!enabled.length) return null;
  let taken = 0, total = 0;
  for (let i = 0; i < days; i++) {
    const d = todayISO(new Date(Date.now() - i * 86400000));
    const log = (S.suppLog || {})[d] || {};
    for (const id of enabled) { total++; if (log[id]) taken++; }
  }
  return total ? Math.round(taken / total * 100) : null;
}

function viewSupps() {
  setTop('Добавки', 'Что реально работает и что ты принял');
  const chosen = S.settings.supps || [];
  const log = suppsToday();
  const adh = suppAdherence();
  const groups = { A: [], B: [], C: [] };
  for (const sp of SUPPLEMENTS) groups[sp.tier].push(sp);

  return `
  <div class="card">
    <p class="muted small mb0">${h(DIET_FIRST)}</p>
  </div>

  ${['A', 'B'].map(tier => `
    <h3>${TIERS[tier].label}</h3>
    <p class="muted small" style="margin:-4px 0 8px">${h(TIERS[tier].note)}</p>
    ${groups[tier].map(sp => {
      const on = chosen.includes(sp.id);
      return `
      <div class="card tight">
        <div class="row between">
          <div class="grow">
            <div class="ex-name">${h(sp.name)}</div>
            <div class="muted small">${h(doseFor(sp, S.settings.bodyWeight))}</div>
          </div>
          <button class="sw ${on ? 'on' : ''}" data-act="supp-toggle" data-id="${sp.id}"><i></i></button>
        </div>
        <details class="tips" data-key="supp-${sp.id}">
          <summary>Подробнее</summary>
          <ul class="cues">
            <li><b>Что делает:</b> ${h(sp.what)}</li>
            <li><b>Почему в списке:</b> ${h(sp.why)}</li>
            ${sp.doseNote ? `<li><b>Про дозу:</b> ${h(sp.doseNote)}</li>` : ''}
            <li><b>Осторожно:</b> ${h(sp.safety)}</li>
            <li><b>Частое заблуждение:</b> ${h(sp.myth)}</li>
          </ul>
        </details>
      </div>`;
    }).join('')}`).join('')}

  ${chosen.length ? `
  <h3>Сегодня</h3>
  <div class="card">
    ${chosen.map(id => {
      const sp = byId(id); if (!sp) return '';
      const done = !!log[id];
      return `<div class="set ${done ? 'done' : ''}" style="margin-bottom:8px">
        <div class="set-main">
          <div class="set-title">${h(sp.name)}</div>
          <div class="set-sub">${h(doseFor(sp, S.settings.bodyWeight))} · ${h(TIMING[sp.timing])}</div>
        </div>
        <button class="set-do" data-act="supp-take" data-id="${id}">${done ? '✓ принял' : 'Отметить'}</button>
      </div>`;
    }).join('')}
    ${adh !== null ? `<p class="muted small mb0 mt">Регулярность за 30 дней: ${adh}%. Для креатина, бета-аланина и омега-3 важна именно она, а не разовые приёмы.</p>` : ''}
  </div>` : ''}

  <h3>Свои добавки</h3>
  <p class="muted small" style="margin:-4px 0 8px">То, чего нет в списке выше. ${h(CUSTOM_NOTE)}</p>
  ${(S.settings.customSupps || []).map(c => `
    <div class="card tight">
      <div class="row between">
        <div class="grow">
          <div class="ex-name">${h(c.name)}</div>
          <div class="muted small">${h(c.dose || 'доза не указана')} · ${h(TIMING[c.timing] || TIMING.any)}</div>
        </div>
        <div class="row" style="gap:8px">
          <button class="sw ${(S.settings.supps || []).includes(c.id) ? 'on' : ''}" data-act="supp-toggle" data-id="${c.id}"><i></i></button>
          <button class="btn line sm" data-act="supp-del" data-id="${c.id}">✕</button>
        </div>
      </div>
    </div>`).join('')}
  <div class="card">
    <label class="field"><span>Название</span><input type="text" id="cName" placeholder="например, магний"></label>
    <label class="field"><span>Доза (не обязательно)</span><input type="text" id="cDose" placeholder="например, 400 мг"></label>
    <label class="field"><span>Когда</span>
      <select id="cTiming">
        ${Object.entries(TIMING).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select></label>
    <button class="btn ghost" data-act="supp-add">Добавить</button>
  </div>

  <details class="card tight tips" data-key="supp-useless">
    <summary>На что не тратить деньги</summary>
    <p class="muted small mt">Отмечать это нечего — эти вещи не работают. Держу список только чтобы ты не купил их по чьему-нибудь совету.</p>
    ${groups.C.map(sp => `<div style="margin-bottom:10px">
      <div class="small"><b>${h(sp.name)}</b></div>
      <div class="muted small">${h(sp.why)} ${h(sp.myth)}</div>
    </div>`).join('')}
    <div class="muted small">${h(groups.C.map(sp => sp.safety).find(x => x.includes('незаявленных')) || '')}</div>
  </details>

  <h3>Вес тела</h3>
  <div class="card">
    <label class="field"><span>Нужен только чтобы посчитать дозу кофеина в мг на кг</span>
      <input type="number" inputmode="numeric" id="bw" value="${S.settings.bodyWeight || ''}" placeholder="например 92"></label>
    <button class="btn ghost sm" data-act="supp-weight">Сохранить</button>
  </div>

  <h3>Если выступаешь</h3>
  <div class="card" style="border-color:var(--warn)">
    <p class="muted small mb0">${h(DOPING_WARNING)}</p>
  </div>

  <h3>Источники</h3>
  <div class="card">
    ${SOURCES.map(x => `<div style="margin-bottom:12px">
      <a href="${x.url}" target="_blank" rel="noopener">${h(x.title)}</a>
      <div class="muted small">${h(x.note)}</div>
    </div>`).join('')}
    <p class="muted small mb0">Здесь ничего не выдумано: состав списка и дозировки взяты из этих работ. Что не попало ни в один источник — в списке помечено как «не стоит».</p>
  </div>

  <div class="card">
    <p class="muted small mb0">Это не медицинская рекомендация. Витамин D подбирается по анализу крови, а не по самочувствию; при болезнях почек, печени и при приёме лекарств добавки обсуждают с врачом.</p>
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
      <div class="muted small">${s.entries.length} ${plural(s.entries.length, 'упражнение', 'упражнения', 'упражнений')} · ${t ? t.toLocaleString('ru-RU') + ' кг · ' : ''}${s.durationMin} мин · ${h(rpeLabel(s.sessionRpe).toLowerCase())}</div>
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
    <p class="muted small">${s.durationMin} мин · в целом ${h(rpeLabel(s.sessionRpe).toLowerCase())}${s.deload ? ' · разгрузка' : ''}${s.readiness ? ` · готовность ×${readinessMult(s.readiness).toFixed(2)}` : ''}</p>
    <table class="tbl">
      <tr><th>Упражнение</th><th>Сделано</th><th>Тяжесть</th></tr>
      ${s.entries.map(e => `<tr>
        <td>${h(EXERCISES[e.exId]?.short || e.exId)}<div class="muted small">${e.weight} кг</div></td>
        <td>${e.kind === 'time' ? e.doneSec + ' сек' : e.doneReps + ' повт'}<div class="muted small">${e.doneSets}/${e.plannedSets} подх</div></td>
        <td>${h(rpeLabel(e.rpe).toLowerCase())}</td></tr>`).join('')}
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

  <h3>Насколько резко прибавил</h3>
  <div class="card">
    <div class="row between">
      <span class="ex-name">${a.ratio == null ? '—' : a.ratio.toFixed(2).replace('.', ',')}</span>
      <span class="pill ${a.status === 'bad' ? 'bad' : a.status === 'warn' ? 'warn' : 'ok'}">${h(a.text)}</span>
    </div>
    ${gauge(a.ratio, a.status)}
    <p class="muted small mb0">Свежая неделя против привычной за месяц. Это не про травмы: как предиктор травм этот показатель раскритикован в науке. Просто показывает, насколько резко ты прибавил.</p>
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
        const st = p.steps?.[trackId] ?? p.step ?? 0;
        return `<tr>
          <td>${h(EXERCISES[exId].name)}<div class="muted small">дальше: ${h(nextStepText(trackId, st))}</div></td>
          <td>${p.weight} кг</td>
          <td>${st + 1}/${tr.steps.length}${p.wins ? ' <span class="pill ok">+1</span>' : ''}</td>
        </tr>`;
      }).join('')}
    </table>
    <p class="muted small mt mb0">Две удачные тренировки подряд — шаг вперёд. Кончились шаги — берёшь гирю тяжелее и начинаешь объём заново.</p>
  </div>

  ${(() => {
    const b = blockStatus(S);
    if (!b) return '';
    const s = nextBlockSuggestions(S);
    const pct = Math.round(b.pct * 100);
    return `
    <h3>Что дальше</h3>
    <div class="card">
      <div class="row between">
        <div class="grow"><div class="ex-name">Блок пройден на ${pct}%</div>
        <div class="muted small">${h(b.программа)}</div></div>
        <span class="pill ${b.наИсходе ? 'warn' : 'ok'}">${b.наИсходе ? 'на исходе' : 'в работе'}</span>
      </div>
      <div class="ex-prog"><i style="width:${pct}%"></i></div>

      ${b.железо.length ? `
        <div class="muted small mt" style="color:var(--warn)">
          <b>Упрётся в железо:</b>
          ${b.железо.map(x => `<div style="margin-top:4px">${h(x.текст)}</div>`).join('')}
          <div style="margin-top:6px;opacity:.85">Это стоит знать заранее: гирю нужно успеть достать, а не обнаружить упор посреди блока.</div>
        </div>` : ''}

      ${b.наИсходе ? `
        <p class="muted small mt mb0">Лестницы почти пройдены. Дальше есть два разумных хода:</p>
        ${s.дополнение ? `
          <div class="card tight tap" role="button" tabindex="0" data-act="program" data-v="${s.дополнение.pid}" style="margin-top:8px">
            <div class="row between"><div class="ex-name" style="font-size:15px">Добрать недостающее</div>
            <span class="pill">${h(s.дополнение.tag)}</span></div>
            <div class="muted small mt">${h(s.дополнение.name)}${s.дефицит.length ? ` — закроет то, чего в текущей программе мало` : ''}</div>
          </div>` : ''}
        ${s.специализация ? `
          <div class="card tight tap" role="button" tabindex="0" data-act="program" data-v="${s.специализация.pid}" style="margin-top:8px">
            <div class="row between"><div class="ex-name" style="font-size:15px">Углубить то же самое</div>
            <span class="pill">${h(s.специализация.tag)}</span></div>
            <div class="muted small mt">${h(s.специализация.name)} — тот же упор, но объёма на нём в разы больше</div>
          </div>` : ''}
        <p class="muted small mt mb0">Прогресс по каждой лестнице хранится отдельно, так что переключение ничего не потеряет — вернёшься на то же место.</p>
      ` : `<p class="muted small mt mb0">Пока идёшь по лестницам. Подскажу, когда блок будет заканчиваться.</p>`}
    </div>` ;
  })()}

  <h3>Где ты в блоке</h3>
  <div class="card">
    ${(S.settings.deloadEvery ?? 6)
      ? Array.from({ length: S.settings.deloadEvery ?? 6 }, (_, i) => waveFor(i, S.settings.deloadEvery ?? 6))
          .map((w, i) => `<div class="row between" style="padding:6px 0${i === waveIndex(S) ? ';font-weight:700' : ';opacity:.6'}">
            <span>${h(w.name)}</span><span class="pill ${i === waveIndex(S) ? 'accent' : ''}">×${w.mult.toFixed(2).replace('.', ',')}</span></div>`).join('')
      : '<p class="muted small mb0">Разгрузка выключена — объём растёт только прогрессией.</p>'}
    <p class="muted small mt mb0">Разгрузка нужна не для роста силы — доказательств этому нет. Она нужна связкам и хвату, которые при ежедневной работе восстанавливаются медленнее мышц.</p>
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
      ${p.warn ? `<div class="muted small" style="margin-top:8px;color:var(--warn)">⚠️ ${h(p.warn)}</div>` : ''}
      ${p.origin ? `<div class="muted small" style="opacity:.6;margin-top:6px">Происхождение: ${h(p.origin)}</div>` : ''}
      ${p.gives ? `<details class="tips" data-key="prog-${id}" style="margin-top:8px">
        <summary>Что даёт и чего не даёт</summary>
        <div class="muted small" style="margin-top:6px"><b>Даёт:</b></div>
        <ul class="cues">${p.gives.map(x => `<li>${h(x)}</li>`).join('')}</ul>
        <div class="muted small"><b>Не даёт:</b></div>
        <ul class="cues">${p.limits.map(x => `<li>${h(x)}</li>`).join('')}</ul>
      </details>` : ''}
    </div>`).join('')}

  <h3>Уровень</h3>
  <div class="card">
    <div class="row between">
      <div class="grow">
        <div class="sw-label">Тест кондиций</div>
        <div class="sw-hint">${(S.tests || []).length ? 'последний: ' + prettyDate(S.tests[S.tests.length - 1].date) : 'ещё не проходил'}</div>
      </div>
      <button class="btn ghost sm" data-act="test-open">${(S.tests || []).length ? 'Перетестироваться' : 'Пройти'}</button>
    </div>
    <p class="muted small mt mb0">Определяет рабочие веса и стартовые ступени за одну сессию. Имеет смысл повторять раз в 8–12 недель или после перерыва.</p>
  </div>

  <h3>Добавки</h3>
  <div class="card tap" role="button" tabindex="0" data-act="supps-open">
    <div class="row between">
      <div class="grow">
        <div class="sw-label">Витамины и добавки</div>
        <div class="sw-hint">${(S.settings.supps || []).length ? 'принимаешь: ' + (S.settings.supps || []).length : 'что работает по данным МОК и ISSN'}</div>
      </div>
      <span class="pill accent">→</span>
    </div>
  </div>

  <h3>Гири в наличии</h3>
  <div class="card">
    <div class="chips">
      ${BELL_OPTIONS.map(b => `<button class="chip ${S.settings.bells.includes(b) ? 'on' : ''}" data-act="bell" data-v="${b}">${b} кг</button>`).join('')}
    </div>
  </div>

  <h3>Каких гирь по две</h3>
  <div class="card">
    <div class="chips">
      ${S.settings.bells.map(b => `<button class="chip ${(S.settings.pairs || []).includes(b) ? 'on' : ''}" data-act="pair" data-v="${b}">${b} кг ×2</button>`).join('')}
    </div>
    <p class="muted small mt mb0">Комплекс ABC в оригинале делается парой гирь одного веса. Если пары нет — приложение даёт версию под одну гирю: круг идёт на каждую сторону, работы столько же, но времени вдвое больше.</p>
  </div>

  <h3>Рабочие веса и ступени</h3>
  <div class="card">
    ${(() => {
      const seen = new Set();
      const rows = [];
      for (const day of prog.days) for (const sl of day.slots) {
        const key = sl.ex + '|' + sl.track;
        if (seen.has(key)) continue;
        seen.add(key);
        if (sl.ex === 'tgu' && !S.settings.tgu) continue;
        const p = S.progress[sl.ex]; const tr = TRACKS[sl.track];
        if (!p || !tr) continue;
        const cur = p.steps?.[sl.track] ?? p.step ?? 0;
        rows.push(`
        <div style="padding:10px 0;border-bottom:1px solid var(--line)">
          <div class="row between" style="margin-bottom:8px">
            <div class="grow"><div class="sw-label">${h(EXERCISES[sl.ex].name)}</div>
            <div class="sw-hint">${h(stepText(sl.track, cur))}</div></div>
            <select data-act="weight" data-ex="${sl.ex}" style="width:100px;min-height:42px">
              ${S.settings.bells.map(b => `<option value="${b}" ${b === p.weight ? 'selected' : ''}>${b} кг</option>`).join('')}
            </select>
          </div>
          <select data-act="setstep" data-ex="${sl.ex}" data-track="${sl.track}" style="min-height:42px">
            ${tr.steps.map((_, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>Ступень ${i + 1} из ${tr.steps.length} — ${h(stepText(sl.track, i))}</option>`).join('')}
          </select>
        </div>`);
      }
      return rows.join('');
    })()}
    <p class="muted small mt mb0">Ступень можно поставить руками, если уровень уже есть и ждать прогрессии незачем. После перерыва бери на 2–3 ступени ниже своего прошлого максимума: тест меряет разовый результат, а программе нужен повторяемый. Смена веса сбрасывает ступень в начало — это защита от перегруза.</p>
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
      <div><div class="sw-label">Старт блока</div><div class="sw-hint">${prettyDate(S.settings.startDate)} · сейчас ${wave(S).name.toLowerCase()}</div></div>
      <button class="btn ghost sm" data-act="restart-block">Начать заново</button>
    </div>
  </div>

  <h3>Разгрузочная неделя</h3>
  <div class="card">
    <div class="chips">
      ${DELOAD_OPTIONS.map(o => `<button class="chip ${(S.settings.deloadEvery ?? 6) === o.v ? 'on' : ''}" data-act="deload" data-v="${o.v}">${o.label}</button>`).join('')}
    </div>
    <p class="muted small mt mb0">Исследования не подтверждают, что разгрузка ускоряет рост силы. Здесь она нужна связкам и хвату при ежедневной работе. Раз в 4 недели — это четверть первого месяца в полсилы, поэтому по умолчанию раз в 6.</p>
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
  pair(el) {
    const v = +el.dataset.v;
    update(s => {
      const cur = s.settings.pairs || [];
      s.settings.pairs = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
      s.today = null;
    });
    render();
  },
  bell(el) {
    const v = +el.dataset.v;
    const bells = S.settings.bells.includes(v) ? S.settings.bells.filter(b => b !== v) : [...S.settings.bells, v];
    if (!bells.length) { toast('Хотя бы одна гиря нужна'); return; }
    setBells(bells);
    render();
  },
  program(el) {
    const changed = S.settings.programId !== el.dataset.v;
    update(s => {
      s.settings.programId = el.dataset.v;
      // Новая программа должна начинаться со своего первого дня. Без этого
      // отсчёт продолжается от старого старта, и человек попадает в середину
      // чужого цикла — например, выбирает ABC, а получает день махов.
      if (changed) { s.settings.startDate = todayISO(); s.settings.cyclePos = 0; s.settings.cycleDate = todayISO(); }
      s.today = null;
    });
    render();
    if (S.onboarded && changed) toast('Программа сменилась, начинаем с первого дня');
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
    update(s => {
      s.today = { date: todayISO(), readiness: { ...draftReadiness }, plan, startedAt: Date.now() };
    });
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
    if (!s.done || !S.settings.autoRest || it.emom) return;
    // в паре пауза короткая: отдых этому движению даст следующее упражнение
    const pair = (S.today.plan.pairs || []).find(p => p.a === i || p.b === i);
    const rest = pair ? pair.rest : it.rest;
    const allDone = pair
      ? [...S.today.plan.items[pair.a].sets, ...S.today.plan.items[pair.b].sets].every(x => x.done)
      : it.sets.every(x => x.done);
    if (rest && !allDone) startRest(rest);
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
        complete: sum.complete, rpe: finishDraft.rpe[it.exId] ?? 7, step: it.step,
        // урезал ли объём бюджет времени — от этого зависит, засчитывать ступень
        perCycle: it.perCycle, cycleDays: it.cycleDays
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
      estimateMin: plan.estimate || null,
      durationMin: mins,
      sessionRpe: Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length),
      notes,
      entries
    };
    const changes = applySession(S, session);
    update(s => {
      s.sessions.push(session);
      s.today = null;
      // тренировка сделана — цикл двигается на следующий день программы
      s.settings.cyclePos = (s.settings.cyclePos + 1) % PROGRAMS[s.settings.programId].days.length;
      s.settings.cycleDate = todayISO();
    });
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
  // ── Тест кондиций ──
  deload(el) {
    update(s => { s.settings.deloadEvery = +el.dataset.v; s.today = null; });
    render();
  },
  'supps-open'() { tab = 'supps'; render(); },
  'supp-toggle'(el) {
    const id = el.dataset.id;
    update(s => {
      const cur = s.settings.supps || [];
      s.settings.supps = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    });
    render();
  },
  'supp-take'(el) {
    const id = el.dataset.id;
    const d = todayISO();
    update(s => {
      if (!s.suppLog) s.suppLog = {};
      if (!s.suppLog[d]) s.suppLog[d] = {};
      s.suppLog[d][id] = !s.suppLog[d][id];
    });
    render();
  },
  'supp-add'() {
    const name = ($('#cName')?.value || '').trim();
    if (!name) { toast('Впиши название'); return; }
    const id = 'own_' + Date.now();
    const item = { id, name, dose: ($('#cDose')?.value || '').trim(), timing: $('#cTiming')?.value || 'any' };
    update(s => {
      s.settings.customSupps = [...(s.settings.customSupps || []), item];
      s.settings.supps = [...(s.settings.supps || []), id];   // сразу включаем: раз добавил — значит пьёшь
    });
    render();
    toast('Добавил');
  },
  'supp-del'(el) {
    const id = el.dataset.id;
    update(s => {
      s.settings.customSupps = (s.settings.customSupps || []).filter(c => c.id !== id);
      s.settings.supps = (s.settings.supps || []).filter(x => x !== id);
    });
    render();
  },
  'supp-weight'() {
    const v = +($('#bw')?.value || 0);
    update(s => { s.settings.bodyWeight = v > 0 ? v : null; });
    render();
    toast(v > 0 ? 'Дозу кофеина посчитаю по весу' : 'Вес убран');
  },
  setstep(el) {
    const { ex, track } = el.dataset;
    update(s => {
      const p = s.progress[ex];
      if (!p.steps) p.steps = {};
      p.steps[track] = +el.value;
      p.step = +el.value;
      p.wins = 0; p.fails = 0;
      s.today = null;
    });
    render();
    toast('Ступень выставлена');
  },
  'test-open'() { S.testDraft = defaultTestDraft(); save(); tab = 'test'; render(); },
  'test-exit'() { tab = 'today'; render(); },
  'test-next'() { const d = testDraft(); d.i = Math.min(d.i + 1, TEST_ORDER.length - 1); save(); render(); },
  'test-back'() { const d = testDraft(); d.i = Math.max(0, d.i - 1); save(); render(); },
  'test-bell'(el) { testDraft()[el.dataset.k].bell = +el.dataset.v; save(); render(); },
  'test-num'(el) {
    const d = testDraft();
    const t = d[el.dataset.k];
    const f = el.dataset.f;
    t[f] = Math.max(+el.dataset.min, Math.min(+el.dataset.max, t[f] + +el.dataset.d));
    save(); render();
  },
  'test-rpe'(el) { testDraft().swing.rpe = +el.dataset.v; save(); render(); },
  'test-tech'() { const s = testDraft().swing; s.techniqueHeld = !s.techniqueHeld; save(); render(); },
  'test-emom'() { unlockAudio(); timer.startEmom(60, 5, 'Тест махов'); render(); },
  'test-stopwatch'() { unlockAudio(); timer.startStopwatch('Прогулка фермера'); render(); },
  'test-apply'() {
    const d = testDraft();
    const placement = computePlacement(d);
    const results = { press: { ...d.press }, swing: { ...d.swing }, squat: { ...d.squat }, carry: { ...d.carry } };
    update(s => {
      applyPlacement(s, placement);
      s.tests = [...(s.tests || []), { id: Date.now(), date: todayISO(), results, items: placement.items }];
      s.testDraft = null;
    });
    tab = 'today';
    render();
    openSheet(`<div class="big-check">✓</div>
      <h2 class="center">Уровень выставлен</h2>
      <p class="muted center small">Сегодняшний план уже пересобран. Дальше приложение двигает нагрузку как обычно: две удачные тренировки — шаг вперёд.</p>
      <p class="muted center small">Перетестироваться стоит через 8–12 недель или после перерыва длиннее двух недель.</p>
      <button class="btn" data-act="close-sheet">Понятно</button>`);
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
  <h2>Насколько было тяжело?</h2>
  <p class="muted small">Ориентируйся на то, сколько ещё смог бы сделать сверху. От этого ответа зависит, добавлю я нагрузку в следующий раз или оставлю как есть — отвечай честно, занижать смысла нет.</p>
  ${items.map(({ it, sum }) => `
    <div style="margin-bottom:16px">
      <div class="row between" style="margin-bottom:6px">
        <span class="ex-name" style="font-size:15px">${h(it.name)}</span>
        <span class="pill ${sum.complete ? 'ok' : 'warn'}">${sum.doneSets}/${sum.totalSets}</span>
      </div>
      ${rpePicker(finishDraft.rpe[it.exId], 'rpe-pick', ` data-ex="${it.exId}"`)}
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
  // Раскрывашка внутри карточки-кнопки: <details> открывается действием
  // браузера по умолчанию, а мы его тут же отменяли preventDefault. Из-за
  // этого «что даёт программа» не разворачивалось вовсе, а не схлопывалось.
  if (e.target.closest('summary')) { unlockAudio(); return; }
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
  // с клавиатуры та же история: Enter на заголовке раскрывашки должен
  // разворачивать её, а не выбирать программу
  if (e.target.closest?.('summary')) return;
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
update(s => { commitCycle(s); });   // подтягиваем положение в цикле к сегодняшнему дню
render();
window.__kbdBooted = true;

// ── Обновление приложения ────────────────────────────────────────────────────
// Установленное приложение должно само подхватывать новую версию,
// иначе оно навсегда остаётся на той, что закэширована при первом запуске.
if ('serviceWorker' in navigator) {
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // перезагружаемся только если приложение уже работало под старым воркером,
    // иначе первый в жизни запуск уйдёт в цикл перезагрузок
    if (reloading || !sessionStorage.getItem('kbd.hadController')) return;
    reloading = true;
    location.reload();
  });

  window.addEventListener('load', async () => {
    if (navigator.serviceWorker.controller) sessionStorage.setItem('kbd.hadController', '1');
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.update().catch(() => {});
      // и проверяем ещё раз каждый раз, когда возвращаешься в приложение
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (e) { /* без офлайна тоже работает */ }
  });
}
