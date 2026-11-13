import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SIZE = 1024;
const CENTER = SIZE / 2;
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x5eed1ce);

function blend(x, y, r, g, b, alpha) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SIZE || py >= SIZE || alpha <= 0) return;

  const i = (py * SIZE + px) * 4;
  const sourceAlpha = Math.min(1, alpha);
  const destAlpha = pixels[i + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) return;

  pixels[i] = Math.round(
    (r * sourceAlpha + pixels[i] * destAlpha * (1 - sourceAlpha)) / outAlpha,
  );
  pixels[i + 1] = Math.round(
    (g * sourceAlpha + pixels[i + 1] * destAlpha * (1 - sourceAlpha)) / outAlpha,
  );
  pixels[i + 2] = Math.round(
    (b * sourceAlpha + pixels[i + 2] * destAlpha * (1 - sourceAlpha)) / outAlpha,
  );
  pixels[i + 3] = Math.round(outAlpha * 255);
}

function distanceToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

function drawLine(x0, y0, x1, y1, width, r, g, b, alpha) {
  const half = width / 2;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1));
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(x0, x1) + half + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1));
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(y0, y1) + half + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = distanceToSegment(x + 0.5, y + 0.5, x0, y0, x1, y1);
      const coverage = Math.max(0, Math.min(1, half + 0.5 - distance));
      if (coverage > 0) blend(x, y, r, g, b, alpha * coverage);
    }
  }
}

function drawDisc(cx, cy, radius, r, g, b, alpha) {
  const minX = Math.max(0, Math.floor(cx - radius - 1));
  const maxX = Math.min(SIZE - 1, Math.ceil(cx + radius + 1));
  const minY = Math.max(0, Math.floor(cy - radius - 1));
  const maxY = Math.min(SIZE - 1, Math.ceil(cy + radius + 1));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - distance));
      if (coverage > 0) blend(x, y, r, g, b, alpha * coverage);
    }
  }
}

function stroke(x0, y0, x1, y1, width, alpha) {
  drawLine(x0, y0, x1, y1, width + 16, 120, 190, 255, alpha * 0.08);
  drawLine(x0, y0, x1, y1, width, 232, 246, 255, alpha);
  drawLine(x0, y0, x1, y1, Math.max(1, width * 0.32), 255, 255, 255, alpha);
}

function branch(x, y, angle, length, depth) {
  const nx = x + Math.cos(angle) * length;
  const ny = y + Math.sin(angle) * length;

  stroke(x, y, nx, ny, 9, 0.95);

  if (depth <= 0) return;

  const side = length * (0.36 + random() * 0.1);
  const offsets = depth >= 2 ? [-0.62, 0.62] : [-0.72, 0.72];

  for (const offset of offsets) {
    const t = 0.55 + random() * 0.16;
    const px = x + (nx - x) * t;
    const py = y + (ny - y) * t;
    const sideAngle = angle + offset + (random() - 0.5) * 0.16;
    const sideLength = side * (0.7 + random() * 0.5);

    stroke(
      px,
      py,
      px + Math.cos(sideAngle) * sideLength,
      py + Math.sin(sideAngle) * sideLength,
      6,
      0.85,
    );
  }

  branch(
    nx,
    ny,
    angle + (random() - 0.5) * 0.34,
    length * (0.66 + random() * 0.1),
    depth - 1,
  );

  if (depth >= 2) {
    branch(
      nx,
      ny,
      angle - 0.72,
      length * 0.48,
      depth - 2,
    );
  }
}

// Soft icy glow behind the flake.
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const distance = Math.hypot(x - CENTER, y - CENTER) / (SIZE * 0.46);
    const alpha = Math.max(0, 1 - distance) ** 2 * 0.16;
    if (alpha > 0.002) blend(x, y, 120, 190, 255, alpha);
  }
}

for (let i = 0; i < 6; i++) {
  const angle = (Math.PI / 3) * i - Math.PI / 2;
  const armLength = SIZE * (0.32 + random() * 0.03);
  branch(
    CENTER + Math.cos(angle) * 18,
    CENTER + Math.sin(angle) * 18,
    angle,
    armLength,
    4,
  );

  drawDisc(
    CENTER + Math.cos(angle) * (armLength + 30),
    CENTER + Math.sin(angle) * (armLength + 30),
    9,
    245,
    252,
    255,
    0.95,
  );
}

drawDisc(CENTER, CENTER, 34, 150, 210, 255, 0.28);
drawDisc(CENTER, CENTER, 22, 240, 250, 255, 0.98);
drawDisc(CENTER, CENTER, 12, 255, 255, 255, 1);

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const output = resolve(process.cwd(), "public/app-icon.png");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, png);
console.log(`Wrote ${output} (${png.length} bytes)`);