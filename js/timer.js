// Таймер: обратный отсчёт, интервалы (каждую минуту), секундомер.
// Время всегда считается от метки времени, чтобы не сбиваться в фоне.

let audioCtx = null;
let wakeLock = null;

export function unlockAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    // короткий беззвучный тик, чтобы iOS разрешил звук дальше
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.01);
  } catch (e) { /* без звука тоже работает */ }
}

export function beep(freq = 880, ms = 120, vol = 0.25) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch (e) { /* ignore */ }
}

export function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch (e) { /* ignore */ }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* ignore */ }
}

function releaseWakeLock() {
  try { wakeLock?.release(); } catch (e) { /* ignore */ }
  wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timer.running && timer.opts.keepAwake) requestWakeLock();
});

export const timer = {
  mode: null,          // 'countdown' | 'emom' | 'stopwatch'
  running: false,
  paused: false,
  endAt: 0,
  startedAt: 0,
  pausedAt: 0,
  duration: 0,
  round: 0,
  totalRounds: 0,
  label: '',
  opts: { sound: true, vibrate: true, keepAwake: true },
  onUpdate: null,
  onFinish: null,
  onRound: null,
  _tick: null,
  _lastBeep: -1,

  configure(opts) { this.opts = { ...this.opts, ...opts }; },

  startCountdown(seconds, label = 'Отдых') {
    this._start('countdown', seconds, label);
  },

  startEmom(seconds, rounds, label = 'Каждую минуту') {
    this.totalRounds = rounds;
    this.round = 1;
    this._start('emom', seconds, label);
  },

  startStopwatch(label = 'Секундомер') {
    this.mode = 'stopwatch';
    this.label = label;
    this.running = true;
    this.paused = false;
    this.startedAt = Date.now();
    this.duration = 0;
    if (this.opts.keepAwake) requestWakeLock();
    this._loop();
  },

  _start(mode, seconds, label) {
    this.mode = mode;
    this.label = label;
    this.duration = seconds;
    this.running = true;
    this.paused = false;
    this.startedAt = Date.now();
    this.endAt = Date.now() + seconds * 1000;
    this._lastBeep = -1;
    if (this.opts.keepAwake) requestWakeLock();
    this._loop();
  },

  remaining() {
    if (this.mode === 'stopwatch') return 0;
    if (this.paused) return Math.max(0, Math.round((this.endAt - this.pausedAt) / 1000));
    return Math.max(0, Math.round((this.endAt - Date.now()) / 1000));
  },

  elapsed() {
    if (this.mode !== 'stopwatch') return 0;
    return Math.floor((Date.now() - this.startedAt) / 1000);
  },

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pausedAt = Date.now();
  },

  resume() {
    if (!this.paused) return;
    const delta = Date.now() - this.pausedAt;
    this.endAt += delta;
    this.startedAt += delta;
    this.paused = false;
  },

  addTime(sec) {
    if (this.mode === 'stopwatch') return;
    this.endAt += sec * 1000;
    this.duration += sec;
  },

  stop() {
    this.running = false;
    this.paused = false;
    this.mode = null;
    clearTimeout(this._tick);
    releaseWakeLock();
    this.onUpdate?.();
  },

  _loop() {
    clearTimeout(this._tick);
    const step = () => {
      if (!this.running) return;
      if (!this.paused) {
        if (this.mode === 'stopwatch') {
          this.onUpdate?.();
        } else {
          const left = this.remaining();
          if (left <= 3 && left > 0 && left !== this._lastBeep) {
            this._lastBeep = left;
            if (this.opts.sound) beep(700, 90, 0.2);
            if (this.opts.vibrate) buzz(40);
          }
          if (left <= 0) {
            if (this.opts.sound) { beep(1100, 260, 0.3); setTimeout(() => beep(1400, 200, 0.25), 160); }
            if (this.opts.vibrate) buzz([80, 60, 160]);
            if (this.mode === 'emom' && this.round < this.totalRounds) {
              this.round += 1;
              this.endAt = Date.now() + this.duration * 1000;
              this._lastBeep = -1;
              this.onRound?.(this.round);
              this.onUpdate?.();
            } else {
              const finished = this.mode;
              this.running = false;
              this.mode = null;
              releaseWakeLock();
              this.onUpdate?.();
              this.onFinish?.(finished);
              return;
            }
          } else {
            this.onUpdate?.();
          }
        }
      }
      this._tick = setTimeout(step, 200);
    };
    step();
  }
};

export function fmt(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
