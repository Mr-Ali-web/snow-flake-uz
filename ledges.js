// Oynalar ro'yxatidan (z-tartibda, tepadagisi birinchi) qor qo'nadigan chiziqlarni hisoblaydi
function ledgesFor(rects, b) {
  const out = [];
  rects.forEach((r, idx) => {
    const [id, l, t, rr, bt] = r, w = rr - l;
    if (w < 160 || bt - t < 50) return;
    if (t - b.y < 30 || t > b.y + b.height - 30 || rr < b.x || l > b.x + b.width) return;
    let segs = [[l, rr]];
    for (let j = 0; j < idx && segs.length; j++) {
      const o = rects[j];
      if (o[2] > t + 2 || o[4] <= t + 2) continue; // tepadagi oyna bu chetni yopmaydi
      segs = segs.flatMap(([a, c]) => {
        if (o[3] <= a || o[1] >= c) return [[a, c]];
        const res = []; if (o[1] > a) res.push([a, o[1]]); if (o[3] < c) res.push([o[3], c]); return res;
      });
    }
    segs = segs.filter(([a, c]) => c - a > 20);
    if (segs.length) out.push({ id, x: l - b.x, y: t - b.y, w, segs: segs.map(([a, c]) => [a - l, c - l]) });
  });
  return out.slice(0, 15);
}
module.exports = { ledgesFor };
