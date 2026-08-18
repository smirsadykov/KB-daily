// Единая точка выпуска версии. Раньше версия ставилась только на app.js и css,
// а остальные модули грузились без неё — при обновлении новый app.js мог
// получить старый закэшированный модуль и упасть с ошибкой импорта.
// Теперь версия одна на всё. Запуск: node tools/bump-version.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const cur = +(sw.match(/kbd-v(\d+)/)?.[1] ?? 0);
const next = cur + 1;

const sub = (file, fn) => {
  const p = join(root, file);
  writeFileSync(p, fn(readFileSync(p, 'utf8')));
};
const stamp = (s) => s
  .replace(/(styles\.css|app\.js|data\.js|store\.js|progression\.js|timer\.js|charts\.js|assessment\.js|supplements\.js)\?v=\d+/g,
           `$1?v=${next}`);

sub('index.html', stamp);
sub('sw.js', (s) => stamp(s).replace(/kbd-v\d+/, `kbd-v${next}`));
for (const f of readdirSync(join(root, 'js'))) sub(join('js', f), stamp);

console.log(`Версия поднята: kbd-v${cur} → kbd-v${next}`);
