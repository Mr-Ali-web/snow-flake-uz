const cv = document.getElementById('c'), ctx = cv.getContext('2d');

// ---- Sozlamalar: shu yerdan o'zgartirib ko'ring ----
const TUNE = {
  density: { light: 90, medium: 180, heavy: 320 }, // 1080p ekranga nechta parcha
  maxPile: 34,       // qor uyumining maksimal balandligi (px)
  pileGrowth: 5,     // uyum qanchalik tez o'sadi
  windMax: 70,       // shamol kuchi (px/s)
  sweepRadius: 90,   // kursor qorni qancha masofadan itaradi
};
const STEP = 3;
let S = { density: 'medium', wind: true, accumulate: true, paused: false };
let W = 0, H = 0, DPR = 1, groundY = 0, raf = 0, last = 0;
let flakes = [], debris = [], ledge = null;
const cur = { x: -999, y: -999, vx: 0, vy: 0, t: 0 };
const rand = (a, b) => a + Math.random() * (b - a);

// ---- Spritelar: sovuq ko'k qirra oq fonda ham ko'rinishi uchun ----
function makeSprite(kind) {
  const N = 64, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'); g.translate(N / 2, N / 2);
  if (kind === 'crystal') {
    g.lineCap = 'round';
    for (const [lw, col] of [[5, 'rgba(150,175,210,.5)'], [2.6, '#fff']]) {
      g.strokeStyle = col; g.lineWidth = lw;
      for (let i = 0; i < 6; i++) {
        g.rotate(Math.PI / 3); g.beginPath();
        g.moveTo(0, 0); g.lineTo(0, -26); g.moveTo(0, -14); g.lineTo(-8, -22); g.moveTo(0, -14); g.lineTo(8, -22); g.stroke();
      }
    }
  } else {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, N / 2);
    if (kind === 'dot') {
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#fff');
      gr.addColorStop(0.72, 'rgba(170,195,230,.55)'); gr.addColorStop(1, 'rgba(170,195,230,0)');
    } else { // soft: ekranga yaqin, xira bokeh
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(225,236,252,.5)'); gr.addColorStop(1, 'rgba(210,225,248,0)');
    }
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, N / 2, 0, 7); g.fill();
  }
  return c;
}
const SPR = { dot: makeSprite('dot'), soft: makeSprite('soft'), crystal: makeSprite('crystal') };

// ---- Parchalar ----
function newFlake(f, anywhere) {
  const z = Math.pow(Math.random(), 1.4); // 0 = uzoq, 1 = yaqin
  f.z = z; f.x = rand(-50, W + 50); f.y = anywhere ? rand(-20, groundY) : rand(-60, -10);
  if (z > 0.85) { f.kind = 'soft'; f.size = rand(20, 34); f.a = rand(0.18, 0.3); }
  else if (z > 0.4 && Math.random() < 0.18) { f.kind = 'crystal'; f.size = rand(11, 17); f.a = rand(0.7, 0.95); f.spin = rand(-1, 1); }
  else { f.kind = 'dot'; f.size = 2.5 + z * 7; f.a = 0.35 + z * 0.6; f.spin = 0; }
  f.vy = 22 + z * 58 + rand(0, 10); f.vx = 0; f.ix = 0; f.iy = 0;
  f.ph = rand(0, 6.28); f.sw = rand(0.6, 1.6); f.amp = rand(8, 22) * (0.4 + z); f.rot = rand(0, 6.28);
  return f;
}
function fit() {
  const want = Math.round(TUNE.density[S.density] * W * H / (1920 * 1080));
  while (flakes.length < want) flakes.push(newFlake({}, true));
  flakes.length = Math.min(flakes.length, want);
}
const wind = (t) => !S.wind ? 0 : TUNE.windMax * (0.5 * Math.sin(t * 0.13) + 0.35 * Math.sin(t * 0.37 + 1.7) + Math.max(0, Math.sin(t * 0.05)) * 0.6 * Math.sin(t * 0.9));

// ---- Qor uyumi (balandliklar xaritasi) ----
function addSnow(L, x, amt) {
  const c = (x / STEP) | 0;
  for (let k = -4; k <= 4; k++) {
    const i = c + k; if (i < 0 || i >= L.h.length) continue;
    L.h[i] = Math.min(L.cap[i], L.h[i] + amt * Math.exp(-k * k / 6));
  }
}
function relax(L) { // qor tik turmasligi uchun yonbag'irlarni yumshatadi
  const h = L.h, m = 1.1;
  for (let i = 0; i < h.length - 1; i++) {
    const d = h[i] - h[i + 1];
    if (d > m) { const t = (d - m) * 0.25; h[i] -= t; h[i + 1] += t; }
    else if (d < -m) { const t = (-d - m) * 0.25; h[i] += t; h[i + 1] -= t; }
  }
}
function sweep(L, sp, dt) { // kursor uyumni supuradi
  const R = TUNE.sweepRadius;
  const c0 = Math.max(0, ((cur.x - R) / STEP) | 0), c1 = Math.min(L.h.length - 1, ((cur.x + R) / STEP) | 0);
  for (let i = c0; i <= c1; i++) {
    const x = i * STEP, u = (x - cur.x) / R, top = L.y - L.h[i];
    if (L.h[i] < 0.3 || cur.y < top - 30 || cur.y > L.y + 6) continue;
    const take = Math.min(L.h[i], (1 - u * u) * sp * dt * 0.05);
    L.h[i] -= take;
    if (take > 0.15 && debris.length < 250 && Math.random() < 0.3)
      debris.push({ x, y: top, vx: cur.vx * 0.25 + rand(-70, 70), vy: rand(-160, -40), life: 1, s: rand(1.5, 3.5) });
  }
}
function drawPile(L) {
  let mx = 0; for (const v of L.h) if (v > mx) mx = v;
  if (mx < 0.4) return;
  const g = ctx.createLinearGradient(0, L.y - mx, 0, L.y);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#cddcf0');
  ctx.beginPath(); ctx.moveTo(0, L.y);
  for (let i = 0; i < L.h.length; i++) ctx.lineTo(i * STEP, L.y - L.h[i]);
  ctx.lineTo(W, L.y); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); let on = false;
  for (let i = 0; i < L.h.length; i++) {
    const x = i * STEP, y = L.y - L.h[i];
    if (L.h[i] > 0.3) { on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; } else on = false;
  }
  ctx.strokeStyle = 'rgba(140,165,205,.55)'; ctx.lineWidth = 1; ctx.stroke();
}

// ---- Asosiy sikl ----
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000, w = wind(t);
  const sp = now - cur.t < 80 ? Math.hypot(cur.vx, cur.vy) : 0;
  const L = ledge;

  for (const f of flakes) {
    f.ph += f.sw * dt; f.rot += f.spin * dt;
    f.vx += (w * (0.3 + f.z) + Math.cos(f.ph) * f.amp - f.vx) * Math.min(1, dt * 1.5);
    if (sp > 40) {
      const dx = f.x - cur.x, dy = f.y - cur.y, R = TUNE.sweepRadius * (0.6 + f.z * 0.6), d2 = dx * dx + dy * dy;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1, k = (1 - d / R) ** 2;
        f.ix += (dx / d * 600 + cur.vx * 8) * k * dt; f.iy += (dy / d * 600 + cur.vy * 8) * k * dt;
      }
    }
    const damp = Math.exp(-dt * 2.2); f.ix *= damp; f.iy *= damp;
    f.x += (f.vx + f.ix) * dt; f.y += (f.vy + f.iy) * dt;
    if (f.x < -60) f.x = W + 60; else if (f.x > W + 60) f.x = -60;
    if (S.accumulate && f.z > 0.35 && f.z < 0.85) { // faqat o'rta qatlam qo'nadi
      const i = (f.x / STEP) | 0;
      if (i >= 0 && i < L.h.length && f.y + f.size * 0.25 >= L.y - L.h[i]) { addSnow(L, f.x, f.size * 0.12 * TUNE.pileGrowth); newFlake(f); continue; }
    }
    if (f.y > (f.z > 0.85 ? H + 40 : groundY) || f.y < -150) newFlake(f);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const p = debris[i]; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.3;
    if (p.life <= 0) debris.splice(i, 1);
  }
  if (S.accumulate) { if (sp > 80) sweep(L, sp, dt); relax(L); }

  ctx.clearRect(0, 0, W, H);
  if (S.accumulate) drawPile(L);
  for (const kind of ['dot', 'crystal', 'soft']) for (const f of flakes) { // yaqin parchalar tepada
    if (f.kind !== kind) continue;
    ctx.globalAlpha = f.a; const s = f.size;
    if (kind === 'crystal') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.drawImage(SPR.crystal, -s / 2, -s / 2, s, s); ctx.restore(); }
    else ctx.drawImage(SPR[kind], f.x - s / 2, f.y - s / 2, s, s);
  }
  for (const p of debris) { ctx.globalAlpha = p.life; ctx.drawImage(SPR.dot, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); }
  ctx.globalAlpha = 1;
}

function resize() {
  DPR = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!groundY || groundY > H) groundY = H;
  const n = Math.ceil(W / STEP);
  ledge = { y: groundY, h: new Float32Array(n),
    cap: Float32Array.from({ length: n }, (_, i) => TUNE.maxPile * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(i * 0.045) * Math.sin(i * 0.013 + 1)))) };
  fit();
}
function run() { cancelAnimationFrame(raf); if (S.paused) { ctx.clearRect(0, 0, W, H); return; } last = performance.now(); raf = requestAnimationFrame(frame); }

snow.onInit((d) => { groundY = d.groundY; S = d.settings; resize(); run(); });
snow.onSettings((s) => { S = s; fit(); if (!S.accumulate && ledge) ledge.h.fill(0); run(); });
snow.onClear(() => ledge && ledge.h.fill(0));
snow.onCursor((p) => {
  const now = performance.now(), dt = (now - cur.t) / 1000;
  if (dt > 0 && dt < 0.2) { cur.vx = cur.vx * 0.5 + (p.x - cur.x) / dt * 0.5; cur.vy = cur.vy * 0.5 + (p.y - cur.y) / dt * 0.5; }
  else { cur.vx = 0; cur.vy = 0; }
  cur.x = p.x; cur.y = p.y; cur.t = now;
});
addEventListener('resize', resize);
