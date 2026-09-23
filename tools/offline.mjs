// Офлайн-проверка в настоящем Chrome: ставим приложение, открываем «День»,
// роняем сервер — ровно то, что делает авиарежим, — чистим обычный кэш
// браузера, чтобы ответить мог только воркер, и открываем снова.
// Ловит три вещи: приложение не открывается без сети; в рамке «Дня» без сети
// оказывается главная страница (всё приложение внутри самого себя);
// воркер стирает офлайн-копию соседнего приложения на том же сайте.
// Запуск: node tools/offline.mjs   (нужен Google Chrome; без него — пропуск)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!CHROME) { console.log('офлайн: пропуск — Chrome не найден'); process.exit(0); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 8900 + Math.floor(Math.random() * 90), DBG = 9300 + Math.floor(Math.random() * 90), base = `http://localhost:${PORT}/`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', root], { stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'kb-chrome-'))}`, `--remote-debugging-port=${DBG}`, 'about:blank'], { stdio: 'ignore' });
const stop = code => { server.kill(); chrome.kill(); process.exit(code); };

let target;
for (let i = 0; i < 100 && !target; i++) {            // до 20 с: прошлый Chrome может ещё закрываться
  await sleep(200);
  try { target = (await (await fetch(`http://localhost:${DBG}/json/list`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) { console.log('офлайн: Chrome не запустился'); stop(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const waiting = new Map(), events = [];
ws.addEventListener('message', m => {
  const d = JSON.parse(m.data);
  if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } else if (d.method) events.push(d.method);
});
const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const js = async e => (await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
const go = async url => { events.length = 0; await cdp('Page.navigate', { url }); for (let i = 0; i < 80 && !events.includes('Page.loadEventFired'); i++) await sleep(100); await sleep(800); };
const frame = `document.getElementById('dayFrame')`;
const dayReady = `(${frame}.contentDocument && ${frame}.contentDocument.getElementById('habits')) ? true : false`;

await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
// соседнее приложение на том же сайте уже держит свою офлайн-копию
await go(base + 'README.md');
await js(`caches.open('daydesk-v14').then(c=>c.put('/probe', new Response('neighbour')))`);

await go(base);
for (let i = 0; i < 60 && !(await js(`navigator.serviceWorker.getRegistration().then(r=>!!(r&&r.active))`)); i++) await sleep(250);
for (let i = 0; i < 40 && !(await js(dayReady)); i++) await sleep(250);
const onlineDay = await js(dayReady);
const neighbour = (await js('caches.keys()')).includes('daydesk-v14');

await cdp('Network.clearBrowserCache');
server.kill(); await sleep(500);                       // авиарежим
await go(base);
for (let i = 0; i < 40 && !(await js(dayReady)); i++) await sleep(250);

const app = (await js('document.title')) === 'Гиря каждый день' && (await js(`!!document.querySelector('.tabs')`));
const day = await js(dayReady);
const nested = await js(`!!(${frame}.contentDocument && ${frame}.contentDocument.querySelector('.tabs'))`);
const ok = v => (v ? '✓' : '✗');
console.log(`офлайн: «День» в сети ${ok(onlineDay)} · приложение без сети ${ok(app)} · «День» без сети ${ok(day)}`
  + ` · в рамке не само приложение ${ok(!nested)} · офлайн-копия соседа цела ${ok(neighbour)}`);
stop(onlineDay && app && day && !nested && neighbour ? 0 : 1);
