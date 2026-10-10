import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const STAR = [
  [32, 6],
  [35.83, 22.76],
  [50.38, 13.62],
  [41.24, 28.17],
  [58, 32],
  [41.24, 35.83],
  [50.38, 50.38],
  [35.83, 41.24],
  [32, 58],
  [28.17, 41.24],
  [13.62, 50.38],
  [22.76, 35.83],
  [6, 32],
  [22.76, 28.17],
  [13.62, 13.62],
  [28.17, 22.76],
];

const NIGHT = [0x10, 0x26, 0x1c];
const GOLD = [0xe7, 0xc5, 0x6a];

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(width, height, pixels) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function contains(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function draw(size, inset) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = (size * (1 - inset * 2)) / 64;
  const offset = (size - 64 * scale) / 2;
  const polygon = STAR.map(([x, y]) => [x * scale + offset, y * scale + offset]);
  const samples = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (const [sx, sy] of samples) {
        if (contains(x + sx, y + sy, polygon)) cover += 1;
      }
      const mix = cover / samples.length;
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(NIGHT[0] * (1 - mix) + GOLD[0] * mix);
      pixels[index + 1] = Math.round(NIGHT[1] * (1 - mix) + GOLD[1] * mix);
      pixels[index + 2] = Math.round(NIGHT[2] * (1 - mix) + GOLD[2] * mix);
      pixels[index + 3] = 255;
    }
  }
  return encodePng(size, size, pixels);
}

const root = process.cwd();
const icons = path.join(root, 'public', 'icons');
fs.mkdirSync(icons, { recursive: true });
fs.writeFileSync(path.join(icons, 'icon-192.png'), draw(192, 0.04));
fs.writeFileSync(path.join(icons, 'icon-512.png'), draw(512, 0.04));
fs.writeFileSync(path.join(icons, 'icon-maskable-512.png'), draw(512, 0.18));
fs.writeFileSync(path.join(root, 'app', 'apple-icon.png'), draw(180, 0.08));
console.log('icons written');
