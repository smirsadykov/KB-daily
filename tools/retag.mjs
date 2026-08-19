// Пересчёт объявленного времени программ по фактическим планам.
// Время меряется от начала разминки до конца заминки, по всей высоте
// лестниц и по всем дням цикла, с парой гирь и без неё.
// Запуск: node tools/retag.mjs [--write]
import { planFor, estimateMinutes } from '../js/progression.js';
import { EXERCISES, PROGRAMS } from '../js/data.js';
import { readFileSync, writeFileSync } from 'node:fs';

const today = new Date().toISOString().slice(0, 10);
const пиши = process.argv.includes('--write');

// Метка показывает обычный день: любую ступень лестниц, любую рабочую гирю,
// с парой гирь и без. Поправку на самочувствие сюда не включаем — иначе нижним
// краем станет день, когда ты разбит, и метка перестанет о чём-либо говорить.
// Что план не вылезает за метку с учётом самочувствия — проверяет аудит.
const САМОЧУВСТВИЕ = [null];
// Волна нагрузки поднимает объём до 1,2× в пиковую неделю и роняет до 0,55×
// в разгрузочную. Обе крайности программа выдаёт сама, поэтому метка обязана
// их накрывать — иначе она занижает и пик, и провал.
const НЕДЕЛИ = [0, 1, 2, 3, 4, 5];

function диапазон(pid) {
  const мин = [];
  for (const пары of [[24], []]) {
   for (const гиря of [16, 24, 32]) {
    for (const сам of САМОЧУВСТВИЕ) {
    for (const неделя of НЕДЕЛИ) {
    for (let ст = 0; ст < 16; ст++) {
      const старт = new Date(Date.now() - неделя * 7 * 86400000).toISOString().slice(0, 10);
      const st = {
        settings: { programId: pid, startDate: старт, bells: [16, 24, 32], pairs: пары,
                    cyclePos: 0, cycleDate: старт, warmup: true, cooldown: true,
                    tgu: pid === 's_and_s', deloadEvery: 6 },
        progress: Object.fromEntries(Object.keys(EXERCISES).filter(k => EXERCISES[k].kind !== 'mobility')
          .map(k => [k, { weight: гиря, step: ст, steps: new Proxy({}, { get: () => ст }), wins: 0, fails: 0 }])),
        sessions: []
      };
      for (let d = 0; d < PROGRAMS[pid].days.length; d++) {
        let p; try { p = planFor(st, today, сам, d); } catch (e) { continue; }
        if (!p.isRest) мин.push(estimateMinutes(p));
      }
    }
    }
    }
   }
  }
  return [Math.min(...мин), Math.max(...мин)];
}

let src = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
let менял = 0;
console.log('программа            было                      стало');
for (const [pid, prog] of Object.entries(PROGRAMS)) {
  const [низ, верх] = диапазон(pid);
  const части = prog.tag.split(' · ');
  const ярлык = части.slice(0, -1).join(' · ');
  const новое = `${ярлык} · ${низ === верх ? низ : низ + ' → ' + верх} мин`;
  const пометка = новое === prog.tag ? '' : '  ←';
  console.log('  ' + pid.padEnd(18) + ' ' + prog.tag.padEnd(25) + ' ' + новое + пометка);
  if (новое !== prog.tag) {
    const было = `tag: '${prog.tag}'`;
    if (!src.includes(было)) { console.log('     ! не нашёл строку в data.js: ' + было); continue; }
    src = src.replace(было, `tag: '${новое}'`);
    менял++;
  }
}
if (пиши && менял) { writeFileSync(new URL('../js/data.js', import.meta.url), src); console.log(`\nзаписал ${менял} программ`); }
else if (!пиши) console.log('\n(прогон вхолостую; запиши с --write)');
