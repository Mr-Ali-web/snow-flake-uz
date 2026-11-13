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
let S = { density: 'medium', wind: true, accumulate: true, paused: false, playMode: false };
let W = 0, H = 0, DPR = 1, groundY = 0, raf = 0, last = 0;
let flakes = [], debris = [], ledges = [], balls = [], playMode = false, dragBall = null, pointer = {x:0,y:0};
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

// ---- Qor uyumi: har bir "tokcha" (ekran osti yoki oyna tepasi) o'z balandliklar xaritasiga ega ----
function mkLedge(id, w, seed) {
  const n = Math.ceil(w / STEP), k = id === 'ground' ? 1 : 0.55;
  return { id, x: 0, y: 0, tx: 0, ty: 0, w, segs: [[0, w]], h: new Float32Array(n),
    cap: Float32Array.from({ length: n }, (_, i) => TUNE.maxPile * k * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(i * 0.045 + seed) * Math.sin(i * 0.013 + seed * 2)))) };
}
function setGround() {
  const g = mkLedge('ground', W, 1); g.y = g.ty = groundY;
  ledges = ledges.filter((L) => L.id !== 'ground'); ledges.unshift(g);
}
function setWindows(list) { // oyna uyumi oyna bilan birga ko'chadi
  const old = new Map(ledges.map((L) => [L.id, L])), next = [old.get('ground')];
  for (const d of list) {
    let L = old.get(d.id);
    if (!L || Math.abs(L.w - d.w) > 1) {
      const nl = mkLedge(d.id, d.w, (d.id % 97) + 1);
      if (L) { nl.h.set(L.h.subarray(0, Math.min(L.h.length, nl.h.length))); nl.x = L.x; nl.y = L.y; } else { nl.x = d.x; nl.y = d.y; }
      L = nl;
    }
    L.tx = d.x; L.ty = d.y; L.segs = d.segs; next.push(L);
  }
  ledges = next;
}
function addSnow(L, lx, amt) {
  const c = (lx / STEP) | 0;
  for (let k = -4; k <= 4; k++) {
    const i = c + k; if (i < 0 || i >= L.h.length) continue;
    L.h[i] = Math.min(L.cap[i], L.h[i] + amt * Math.exp(-k * k / 6));
  }
}
function takeSnow(L, lx, amt) {
  const c = (lx / STEP) | 0; let taken = 0;
  for (let k=-4;k<=4;k++) { const i=c+k; if(i<0||i>=L.h.length) continue; const n=Math.min(L.h[i],amt*Math.exp(-k*k/6)); L.h[i]-=n; taken+=n; }
  return taken;
}
function drawBall(b) {
  const g=ctx.createRadialGradient(b.x-b.r*.35,b.y-b.r*.45,1,b.x,b.y,b.r*1.25);
  g.addColorStop(0,'#fff');g.addColorStop(.72,'#eef5ff');g.addColorStop(1,'#aebfd8');ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(130,155,190,.45)';ctx.stroke();
}
function drawSnowman() {
  for(const base of balls.filter(b=>b.stack>=2)) {
    const mid=balls.find(b=>b.stack===1&&Math.abs(b.x-base.x)<4), head=balls.find(b=>b.stack===0&&mid&&Math.abs(b.x-base.x)<4&&b.y<mid.y);
    if(!mid||!head)continue;ctx.fillStyle='#172536';
    for(const side of [-1,1]){ctx.beginPath();ctx.arc(head.x+side*head.r*.32,head.y-head.r*.14,Math.max(1.5,head.r*.07),0,7);ctx.fill();}
    ctx.fillStyle='#f29a43';ctx.beginPath();ctx.moveTo(head.x,head.y);ctx.lineTo(head.x+head.r*.65,head.y+2);ctx.lineTo(head.x,head.y+head.r*.12);ctx.fill();
    for(const y of [mid.y-mid.r*.2,mid.y+mid.r*.2,base.y-base.r*.25]){ctx.beginPath();ctx.arc(base.x,y,2.2,0,7);ctx.fill();}
  }
}
function updateBalls(dt) {
  for(let i=balls.length-1;i>=0;i--){const b=balls[i];if(b===dragBall){b.x=pointer.x;b.y=pointer.y;continue;}
    if(b.resting&&Math.abs(b.vx)<1)continue;b.vy+=520*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;let floor=null;
    for(const L of ledges){const x=b.x-L.x,j=Math.floor(x/STEP);if(j>=0&&j<L.h.length&&L.segs.some(s=>x>=s[0]&&x<s[1])){const y=L.y-L.h[j];if(b.y+b.r>=y&&b.y-b.r<L.y)floor={L,x,y};}}
    if(floor&&b.vy>0){b.y=floor.y-b.r;b.vy=0;b.vx*=.92;if(Math.abs(b.vx)<5){b.vx=0;b.resting=true;}
      if(b.dropHeight>b.r*5){balls.splice(i,1);for(let k=0;k<10;k++)debris.push({x:b.x,y:b.y,vx:rand(-100,100),vy:rand(-150,20),life:1,s:rand(2,5)});continue;}
      if(floor.L.id!=='ground')addSnow(floor.L,floor.x,b.r*.025);
    }else if(b.y>H+100)balls.splice(i,1);else b.dropHeight=Math.max(b.dropHeight||0,b.y-b.startY);
  }
}
function land(f, py) { // parcha tokchaning tepasidan o'tsa qo'nadi
  const a = f.size * 0.25;
  for (const L of ledges) {
    const lx = f.x - L.x; if (lx < 0 || lx >= L.w) continue;
    const i = (lx / STEP) | 0;
    if (i >= L.h.length || !L.segs.some((s) => lx >= s[0] && lx < s[1])) continue;
    const top = L.y - L.h[i];
    if (py + a <= top + 1 && f.y + a >= top) { addSnow(L, lx, f.size * 0.12 * TUNE.pileGrowth); return true; }
  }
  return false;
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
  const R = TUNE.sweepRadius, cx = cur.x - L.x;
  const c0 = Math.max(0, ((cx - R) / STEP) | 0), c1 = Math.min(L.h.length - 1, ((cx + R) / STEP) | 0);
  for (let i = c0; i <= c1; i++) {
    const x = i * STEP, u = (x - cx) / R, top = L.y - L.h[i];
    if (L.h[i] < 0.3 || cur.y < top - 30 || cur.y > L.y + 6 || !L.segs.some((s) => x >= s[0] && x < s[1])) continue;
    const take = Math.min(L.h[i], (1 - u * u) * sp * dt * 0.05);
    L.h[i] -= take;
    if (take > 0.15 && debris.length < 250 && Math.random() < 0.3)
      debris.push({ x: L.x + x, y: top, vx: cur.vx * 0.25 + rand(-70, 70), vy: rand(-160, -40), life: 1, s: rand(1.5, 3.5) });
  }
}
function drawPile(L) {
  let mx = 0; for (const v of L.h) if (v > mx) mx = v;
  if (mx < 0.4) return;
  ctx.save(); ctx.translate(L.x, L.y);
  ctx.beginPath(); for (const [a, b] of L.segs) ctx.rect(a, -mx - 6, b - a, mx + 8); ctx.clip();
  const g = ctx.createLinearGradient(0, -mx, 0, 0);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#cddcf0');
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (let i = 0; i < L.h.length; i++) ctx.lineTo(i * STEP, -L.h[i]);
  ctx.lineTo(L.w, 0); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); let on = false;
  for (let i = 0; i < L.h.length; i++) {
    const x = i * STEP, y = -L.h[i];
    if (L.h[i] > 0.3) { on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; } else on = false;
  }
  ctx.strokeStyle = 'rgba(140,165,205,.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

// ---- Asosiy sikl ----
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t = now / 1000, w = wind(t);
  const sp = now - cur.t < 80 ? Math.hypot(cur.vx, cur.vy) : 0;

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
    const py = f.y; f.x += (f.vx + f.ix) * dt; f.y += (f.vy + f.iy) * dt;
    if (f.x < -60) f.x = W + 60; else if (f.x > W + 60) f.x = -60;
    if (S.accumulate && f.z > 0.35 && f.z < 0.85 && land(f, py)) { newFlake(f); continue; } // faqat o'rta qatlam qo'nadi
    if (f.y > (f.z > 0.85 ? H + 40 : groundY) || f.y < -150) newFlake(f);
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const p = debris[i]; p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.3;
    if (p.life <= 0) debris.splice(i, 1);
  }
  for (const L of ledges) {
    if (L.id !== 'ground') { const k = Math.min(1, dt * 20); L.x += (L.tx - L.x) * k; L.y += (L.ty - L.y) * k; }
    if (S.accumulate) { if (sp > 80) sweep(L, sp, dt); relax(L); }
  }
  updateBalls(dt);

  ctx.clearRect(0, 0, W, H);
  if (S.accumulate) for (const L of ledges) drawPile(L);
  for (const kind of ['dot', 'crystal', 'soft']) for (const f of flakes) { // yaqin parchalar tepada
    if (f.kind !== kind) continue;
    ctx.globalAlpha = f.a; const s = f.size;
    if (kind === 'crystal') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.drawImage(SPR.crystal, -s / 2, -s / 2, s, s); ctx.restore(); }
    else ctx.drawImage(SPR[kind], f.x - s / 2, f.y - s / 2, s, s);
  }
  for (const p of debris) { ctx.globalAlpha = p.life; ctx.drawImage(SPR.dot, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); }
  balls.sort((a,b)=>a.y-b.y).forEach(drawBall);drawSnowman();
  ctx.globalAlpha = 1;
}

function resize() {
  DPR = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!groundY || groundY > H) groundY = H;
  setGround();
  fit();
}
function run() { cancelAnimationFrame(raf); if (S.paused) { ctx.clearRect(0, 0, W, H); return; } last = performance.now(); raf = requestAnimationFrame(frame); }

snow.onInit((d) => { groundY = d.groundY; S = d.settings; resize(); run(); });
snow.onSettings((s) => { S = s; setPlay(!!s.playMode); fit(); if (!S.accumulate) ledges.forEach((L) => L.h.fill(0)); run(); });
snow.onClear(() => { ledges.forEach((L) => L.h.fill(0)); balls=[]; });
snow.onWindows((d) => W && setWindows(d));
snow.onPlay(setPlay);
snow.onCursor((p) => {
  const now = performance.now(), dt = (now - cur.t) / 1000;
  if (dt > 0 && dt < 0.2) { cur.vx = cur.vx * 0.5 + (p.x - cur.x) / dt * 0.5; cur.vy = cur.vy * 0.5 + (p.y - cur.y) / dt * 0.5; }
  else { cur.vx = 0; cur.vy = 0; }
  cur.x = p.x; cur.y = p.y; cur.t = now;
});
addEventListener('resize', resize);
function setPlay(v){playMode=v;cv.style.pointerEvents=v?'auto':'none';if(!v)dragBall=null;}
cv.addEventListener('pointerdown',(e)=>{
  if(!playMode)return;pointer={x:e.offsetX,y:e.offsetY};
  const existing=[...balls].reverse().find(b=>Math.hypot(pointer.x-b.x,pointer.y-b.y)<b.r);
  if(existing){dragBall=existing;dragBall.resting=false;dragBall.stack=0;cv.setPointerCapture(e.pointerId);return;}
  const L=ledges.find(q=>{const x=pointer.x-q.x,j=Math.floor(x/STEP);return j>=0&&j<q.h.length&&q.segs.some(s=>x>=s[0]&&x<s[1])&&pointer.y>=q.y-q.h[j]-8&&pointer.y<=q.y+5;});
  if(!L)return;dragBall={x:pointer.x,y:pointer.y,startY:pointer.y,r:10,vx:0,vy:0,stack:0,resting:false};balls.push(dragBall);cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove',(e)=>{pointer={x:e.offsetX,y:e.offsetY};if(!dragBall)return;const d=Math.hypot(e.movementX,e.movementY);dragBall.r=Math.min(48,dragBall.r+d*.025);
  for(const L of ledges){const x=pointer.x-L.x,j=Math.floor(x/STEP);if(j>=0&&j<L.h.length&&L.segs.some(s=>x>=s[0]&&x<s[1])&&Math.abs(pointer.y-(L.y-L.h[j]))<dragBall.r+24)takeSnow(L,x,d*.025);}
});
cv.addEventListener('pointerup',()=>{if(!dragBall)return;dragBall.vx=cur.vx*.12;dragBall.vy=10;dragBall.resting=false;
  const base=balls.find(b=>b!==dragBall&&b.resting&&b.stack<2&&dragBall.r<b.r*.92&&Math.abs(b.x-dragBall.x)<b.r*.55&&Math.abs(dragBall.y+dragBall.r-(b.y-b.r))<dragBall.r*1.5);
  if(base){dragBall.x=base.x;dragBall.y=base.y-base.r-dragBall.r;dragBall.stack=base.stack+1;dragBall.resting=true;}dragBall=null;
});
addEventListener('keydown',(e)=>{if(playMode&&e.key==='Escape')snow.exitPlay();});
