const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const width = 256;
const height = 256;
const output = path.resolve(__dirname, '..', 'assets', 'mdviewer.png');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function pixel(buffer, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }

  const offset = y * (width * 4 + 1) + 1 + x * 4;
  buffer[offset] = r;
  buffer[offset + 1] = g;
  buffer[offset + 2] = b;
  buffer[offset + 3] = a;
}

function fillRect(buffer, x, y, w, h, color) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      pixel(buffer, col, row, ...color);
    }
  }
}

function fillRoundedRect(buffer, x, y, w, h, radius, color) {
  const right = x + w - 1;
  const bottom = y + h - 1;

  for (let row = y; row <= bottom; row += 1) {
    for (let col = x; col <= right; col += 1) {
      const dx = col < x + radius ? x + radius - col : col > right - radius ? col - (right - radius) : 0;
      const dy = row < y + radius ? y + radius - row : row > bottom - radius ? row - (bottom - radius) : 0;
      if (dx * dx + dy * dy <= radius * radius) {
        pixel(buffer, col, row, ...color);
      }
    }
  }
}

function fillTriangle(buffer, points, color) {
  const [a, b, c] = points;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);

  for (let row = minY; row <= maxY; row += 1) {
    for (let col = minX; col <= maxX; col += 1) {
      const w1 = ((b[1] - c[1]) * (col - c[0]) + (c[0] - b[0]) * (row - c[1])) / area;
      const w2 = ((c[1] - a[1]) * (col - c[0]) + (a[0] - c[0]) * (row - c[1])) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
        pixel(buffer, col, row, ...color);
      }
    }
  }
}

function createPng() {
  const raw = Buffer.alloc(height * (width * 4 + 1), 0);
  for (let row = 0; row < height; row += 1) {
    raw[row * (width * 4 + 1)] = 0;
  }

  const teal = [15, 118, 110, 255];
  const paper = [255, 255, 255, 255];
  const ink = [23, 32, 42, 255];
  const accent = [232, 93, 63, 255];

  fillRoundedRect(raw, 0, 0, 256, 256, 42, teal);
  fillRoundedRect(raw, 38, 52, 180, 152, 14, paper);

  fillRect(raw, 66, 91, 23, 74, ink);
  fillTriangle(raw, [[88, 91], [113, 129], [88, 129]], ink);
  fillTriangle(raw, [[138, 91], [113, 129], [138, 129]], ink);
  fillRect(raw, 137, 91, 23, 74, ink);
  fillTriangle(raw, [[95, 128], [107, 154], [119, 154]], ink);
  fillTriangle(raw, [[131, 128], [107, 154], [119, 154]], ink);

  fillRect(raw, 170, 91, 22, 40, accent);
  fillRect(raw, 151, 130, 60, 16, accent);
  fillTriangle(raw, [[151, 130], [181, 165], [211, 130]], accent);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(output, createPng());
console.log(`Generated ${output}`);
