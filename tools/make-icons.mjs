// Генератор иконок: рисует гирю попиксельно и пишет PNG без внешних библиотек.
// Запуск: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── PNG ──────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // бит на канал
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // фильтр none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Рисование ────────────────────────────────────────────────────────────────
const BG = [13, 17, 23];
const ACCENT = [255, 122, 26];

function inCircle(x, y, cx, cy, r) { const dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= r * r; }

// Форма гири в координатах 0..1
function isBell(x, y, pad) {
  const s = 1 - pad * 2;
  const u = (x - pad) / s, v = (y - pad) / s;
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;

  // корпус
  if (inCircle(u, v, 0.5, 0.66, 0.30)) return true;
  // горловина
  if (v > 0.30 && v < 0.42 && Math.abs(u - 0.5) < 0.10 + (v - 0.30) * 0.5) return true;
  // дужка: кольцо, нижнюю часть отрезаем
  const ring = inCircle(u, v, 0.5, 0.30, 0.22) && !inCircle(u, v, 0.5, 0.30, 0.145);
  if (ring && v < 0.34) return true;
  // стойки дужки вниз до горловины
  if (v >= 0.30 && v < 0.36 && (Math.abs(Math.abs(u - 0.5) - 0.1825) < 0.0375)) return true;
  return false;
}

function draw(size, pad) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 3; // сглаживание
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = (x + (sx + 0.5) / SS) / size;
          const fy = (y + (sy + 0.5) / SS) / size;
          if (isBell(fx, fy, pad)) hits++;
        }
      }
      const a = hits / (SS * SS);
      const i = (y * size + x) * 4;
      buf[i] = Math.round(BG[0] + (ACCENT[0] - BG[0]) * a);
      buf[i + 1] = Math.round(BG[1] + (ACCENT[1] - BG[1]) * a);
      buf[i + 2] = Math.round(BG[2] + (ACCENT[2] - BG[2]) * a);
      buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

mkdirSync(join(root, 'icons'), { recursive: true });
writeFileSync(join(root, 'icons/icon-192.png'), draw(192, 0.10));
writeFileSync(join(root, 'icons/icon-512.png'), draw(512, 0.10));
writeFileSync(join(root, 'icons/icon-maskable-512.png'), draw(512, 0.20));
console.log('Иконки готовы: icons/icon-192.png, icon-512.png, icon-maskable-512.png');
