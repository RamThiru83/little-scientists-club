/* Little Scientists Club — shared canvas animation library (deterministic: everything is a function of t) */
(function (global) {
  const W = 1920, H = 1080;
  const P = {
    sky: '#CDEBFF', skyDeep: '#9ED3FF', ground: '#9BD77A', groundDark: '#7CC25A',
    sun: '#FFD23F', sunDeep: '#FFB020', ink: '#2B2D42', white: '#FFFFFF', cream: '#FFF7E6',
    pip: '#FFB03B', pipDark: '#E07B1A', cheek: '#FF8FA3', blue: '#4EA8FF', blueDeep: '#2F7FD6',
    red: '#FF5C5C', pink: '#FF9BD2', green: '#5BC26B', purple: '#9B6BFF', grey: '#B8BFCC',
    greyDark: '#7A8294', brown: '#B5713A', water: '#5FB8FF', waterDeep: '#2E8FE0', night: '#1F2A48'
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    linear: t => t,
    inOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    out: t => 1 - (1 - t) * (1 - t),
    in: t => t * t,
    outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1
  };
  // progress of t inside [a,b], clamped 0..1, optionally eased
  const seg = (t, a, b, ease) => { const p = clamp((t - a) / Math.max(1e-6, b - a), 0, 1); if (p <= 0) return 0; if (p >= 1) return 1; return ease ? ease(p) : p; };
  // seeded random for deterministic particles
  function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let r = Math.imul(s ^ (s >>> 15), 1 | s); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 6; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 6; ctx.stroke(); }
  }
  function text(ctx, str, x, y, opt) {
    opt = opt || {};
    const size = opt.size || 48, weight = opt.weight || 600, family = opt.family || 'Fredoka';
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = opt.align || 'center'; ctx.textBaseline = opt.baseline || 'middle';
    if (opt.stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = opt.stroke; ctx.lineWidth = opt.strokeWidth || size * 0.22; ctx.strokeText(str, x, y); }
    ctx.fillStyle = opt.color || P.ink; ctx.fillText(str, x, y);
  }
  function wrapLines(ctx, str, maxW, font) {
    ctx.font = font; const words = str.split(' '); const lines = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
    if (cur) lines.push(cur); return lines;
  }

  // ---------- backgrounds ----------
  function sky(ctx, opt) {
    opt = opt || {};
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, opt.top || P.skyDeep); g.addColorStop(1, opt.bottom || P.sky);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function ground(ctx, y, color) {
    y = y == null ? 820 : y;
    ctx.fillStyle = color || P.ground; ctx.beginPath(); ctx.moveTo(0, y + 40);
    ctx.quadraticCurveTo(W * 0.25, y - 30, W * 0.5, y + 10); ctx.quadraticCurveTo(W * 0.75, y + 50, W, y - 10);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.groundDark; ctx.fillRect(0, H - 90, W, 90);
  }
  function sun(ctx, x, y, r, t, opt) {
    opt = opt || {};
    const rays = 12; const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
    glow.addColorStop(0, 'rgba(255,210,63,0.35)'); glow.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.15);
    ctx.strokeStyle = P.sunDeep; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
    for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2; const len = r * (1.35 + 0.12 * Math.sin(t * 3 + i)); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke(); }
    ctx.restore();
    circle(ctx, x, y, r, P.sun, P.sunDeep, r * 0.1);
    if (opt.face !== false) {
      circle(ctx, x - r * 0.3, y - r * 0.15, r * 0.08, P.ink); circle(ctx, x + r * 0.3, y - r * 0.15, r * 0.08, P.ink);
      ctx.strokeStyle = P.ink; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.35, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      circle(ctx, x - r * 0.45, y + r * 0.15, r * 0.1, 'rgba(255,120,120,0.5)'); circle(ctx, x + r * 0.45, y + r * 0.15, r * 0.1, 'rgba(255,120,120,0.5)');
    }
  }
  function cloud(ctx, x, y, s, color, opt) {
    opt = opt || {}; color = color || P.white;
    const parts = [[0, 0, 1], [-0.9, 0.2, 0.75], [0.9, 0.2, 0.8], [-0.4, -0.35, 0.8], [0.45, -0.3, 0.7]];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (opt.outline) { const lw = 6 / s; ctx.fillStyle = opt.outline; ctx.beginPath(); for (const [px, py, pr] of parts) { ctx.moveTo(px * 60 + pr * 60 + lw, py * 60); ctx.arc(px * 60, py * 60, pr * 60 + lw, 0, Math.PI * 2); } ctx.fill(); }
    ctx.fillStyle = color;
    ctx.beginPath(); for (const [px, py, pr] of parts) { ctx.moveTo(px * 60 + pr * 60, py * 60); ctx.arc(px * 60, py * 60, pr * 60, 0, Math.PI * 2); } ctx.fill();
    if (opt.face) {
      circle(ctx, -22, -5, 6, P.ink); circle(ctx, 22, -5, 6, P.ink);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      if (opt.face === 'sad') ctx.arc(0, 30, 16, 1.15 * Math.PI, 1.85 * Math.PI); else ctx.arc(0, 8, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }
  function star(ctx, x, y, r, color, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = color || P.sun; ctx.fill(); ctx.restore();
  }
  function sparkles(ctx, x, y, t, seed, n, spread, color) {
    const r = rng(seed || 1); n = n || 8; spread = spread || 120;
    for (let i = 0; i < n; i++) { const ox = (r() - 0.5) * spread * 2, oy = (r() - 0.5) * spread * 2; const ph = r() * Math.PI * 2; const s = 0.5 + 0.5 * Math.sin(t * 5 + ph); if (s < 0.15) continue; star(ctx, x + ox, y + oy, 10 + 14 * s, color || P.sun, t + ph); }
  }

  // ---------- Curie the mascot ----------
  // opt: x,y, s (scale), mood: 'happy'|'talk'|'think'|'wow'|'sad'|'wink', t, lookX,lookY (-1..1), armL, armR (angles rad; default resting), bulb(0..1), flip, blink
  function pip(ctx, o) {
    const t = o.t || 0, s = o.s || 1, mood = o.mood || 'happy';
    ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s * (o.flip ? -1 : 1), s);
    const bob = o.bob === false ? 0 : Math.sin(t * 2.2) * 4; ctx.translate(0, bob);
    const R = 100;
    // feet
    ellipse(ctx, -42, R - 4, 34, 16, P.pipDark); ellipse(ctx, 42, R - 4, 34, 16, P.pipDark);
    // antenna
    ctx.strokeStyle = P.pipDark; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -R + 8); ctx.quadraticCurveTo(10, -R - 40, 28 + Math.sin(t * 3) * 3, -R - 60); ctx.stroke();
    const bulb = o.bulb || 0;
    if (bulb > 0) { const g = ctx.createRadialGradient(28, -R - 70, 5, 28, -R - 70, 60 * bulb + 20); g.addColorStop(0, 'rgba(255,230,80,' + (0.8 * bulb) + ')'); g.addColorStop(1, 'rgba(255,230,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(28, -R - 70, 60 * bulb + 20, 0, Math.PI * 2); ctx.fill(); }
    circle(ctx, 28, -R - 70, 16, bulb > 0.3 ? P.sun : P.red, P.pipDark, 5);
    // arms
    const armL = o.armL == null ? 0.5 : o.armL, armR = o.armR == null ? 0.5 : o.armR; // angle: 0 = pointing sideways, +ve down, -ve up (radians)
    ctx.strokeStyle = P.pip; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-R + 18, 10); ctx.lineTo(-R + 18 - Math.cos(armL) * 70, 10 + Math.sin(armL) * 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R - 18, 10); ctx.lineTo(R - 18 + Math.cos(armR) * 70, 10 + Math.sin(armR) * 70); ctx.stroke();
    ctx.strokeStyle = P.pipDark; ctx.lineWidth = 32; ctx.globalCompositeOperation = 'destination-over';
    ctx.beginPath(); ctx.moveTo(-R + 18, 10); ctx.lineTo(-R + 18 - Math.cos(armL) * 70, 10 + Math.sin(armL) * 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R - 18, 10); ctx.lineTo(R - 18 + Math.cos(armR) * 70, 10 + Math.sin(armR) * 70); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // body
    const sq = o.squash || 0;
    ctx.save(); ctx.scale(1 + sq, 1 - sq);
    circle(ctx, 0, 0, R, P.pip, P.pipDark, 8);
    // belly highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-30, -35, 34, 22, -0.6, 0, Math.PI * 2); ctx.fill();
    // cheeks
    circle(ctx, -58, 22, 14, 'rgba(255,120,150,0.55)'); circle(ctx, 58, 22, 14, 'rgba(255,120,150,0.55)');
    // eyes
    const lx = (o.lookX || 0) * 8, ly = (o.lookY || 0) * 6;
    const blinkCycle = (t * 0.5 + (o.blinkSeed || 0)) % 1; const blink = o.blink != null ? o.blink : (blinkCycle > 0.92 ? 1 : 0);
    for (const sx of [-1, 1]) {
      const ex = sx * 36, ey = -22;
      if (mood === 'wink' && sx === 1 || blink) { ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 16, ey); ctx.quadraticCurveTo(ex, ey + 8, ex + 16, ey); ctx.stroke(); continue; }
      const ry = mood === 'wow' ? 30 : mood === 'think' ? 20 : 25;
      ellipse(ctx, ex, ey, 22, ry, P.white, P.ink, 4);
      circle(ctx, ex + lx, ey + ly + 2, mood === 'wow' ? 13 : 11, P.ink); circle(ctx, ex + lx - 4, ey + ly - 3, 4, P.white);
      if (mood === 'think' && sx > 0) { ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - 20, ey - 40); ctx.quadraticCurveTo(ex, ey - 54, ex + 20, ey - 42); ctx.stroke(); }
      if (mood === 'sad') { ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex - sx * 18, ey - 36); ctx.lineTo(ex + sx * 16, ey - 44); ctx.stroke(); }
    }
    // mouth
    ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineCap = 'round';
    if (mood === 'talk') {
      const open = 0.5 + 0.5 * Math.sin(t * 14) * Math.sin(t * 9.3); const d = 8 + 26 * open;
      ctx.fillStyle = '#7A2E3B'; ctx.beginPath(); ctx.moveTo(-26, 30); ctx.quadraticCurveTo(0, 30 + d * 1.9, 26, 30); ctx.quadraticCurveTo(0, 34 - 2 * open, -26, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (open > 0.35) { ctx.save(); ctx.beginPath(); ctx.moveTo(-26, 30); ctx.quadraticCurveTo(0, 30 + d * 1.9, 26, 30); ctx.closePath(); ctx.clip(); ellipse(ctx, 0, 30 + d * 1.1, 16, 9, '#FF8FA3'); ctx.restore(); }
    }
    else if (mood === 'wow') { ellipse(ctx, 0, 40, 16, 20, '#7A2E3B', P.ink, 5); }
    else if (mood === 'think') { ctx.beginPath(); ctx.moveTo(-14, 42); ctx.quadraticCurveTo(0, 36, 14, 44); ctx.stroke(); }
    else if (mood === 'sad') { ctx.beginPath(); ctx.arc(0, 56, 18, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, 28, 26, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }

  // ---------- UI chrome ----------
  function caption(ctx, str, alpha) {
    if (!str || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    const font = '600 46px Fredoka'; const lines = wrapLines(ctx, str, 1500, font);
    const lh = 58, h = lines.length * lh + 36, w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 90;
    const x = W / 2 - w / 2, y = H - 60 - h;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(ctx, x, y, w, h, 28); ctx.fill();
    ctx.strokeStyle = 'rgba(43,45,66,0.12)'; ctx.lineWidth = 4; ctx.stroke();
    lines.forEach((l, i) => text(ctx, l, W / 2, y + 18 + lh / 2 + i * lh, { size: 46, weight: 600, color: P.ink }));
    ctx.restore();
  }
  // big playful word sticker that pops in
  function sticker(ctx, str, x, y, p, opt) {
    if (p <= 0) return; opt = opt || {};
    const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.rotate(opt.rot || -0.06); ctx.scale(s, s);
    const size = opt.size || 96; ctx.font = `700 ${size}px Fredoka`; const w = ctx.measureText(str).width + 70;
    ctx.fillStyle = opt.bg || P.sun; roundRect(ctx, -w / 2, -size * 0.72, w, size * 1.44, 36); ctx.fill();
    ctx.strokeStyle = opt.border || P.ink; ctx.lineWidth = 8; ctx.stroke();
    text(ctx, str, 0, 6, { size, weight: 700, color: opt.color || P.ink });
    ctx.restore();
  }
  function logo(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    circle(ctx, 0, 0, 150, P.white, P.ink, 10);
    circle(ctx, 0, 0, 132, P.blue);
    // flask
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-28, -95); ctx.lineTo(28, -95); ctx.lineTo(28, -40); ctx.lineTo(72, 60); ctx.quadraticCurveTo(80, 85, 55, 85); ctx.lineTo(-55, 85); ctx.quadraticCurveTo(-80, 85, -72, 60); ctx.lineTo(-28, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.moveTo(-28, -95); ctx.lineTo(28, -95); ctx.lineTo(28, -40); ctx.lineTo(72, 60); ctx.quadraticCurveTo(80, 85, 55, 85); ctx.lineTo(-55, 85); ctx.quadraticCurveTo(-80, 85, -72, 60); ctx.lineTo(-28, -40); ctx.closePath(); ctx.clip();
    ctx.fillStyle = P.green; ctx.fillRect(-90, 25 + Math.sin(t * 2) * 3, 180, 80);
    circle(ctx, -20, 45 + Math.sin(t * 3) * 6, 9, '#BFF5C8'); circle(ctx, 18, 60 + Math.cos(t * 2.5) * 6, 6, '#BFF5C8'); circle(ctx, 5, 35 + Math.sin(t * 4) * 5, 5, '#BFF5C8');
    ctx.restore();
    star(ctx, -95, -70, 22, P.sun, t); star(ctx, 100, -40, 16, P.sun, -t); star(ctx, 90, 95, 18, P.pink, t * 0.5);
    ctx.restore();
  }
  function titleCard(ctx, t, p, title) {
    // p: 0..1 over the card lifetime
    sky(ctx, { top: '#5FB8FF', bottom: '#CDEBFF' });
    const r = rng(7); for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, ph = r() * 6; star(ctx, x, y, 8 + 8 * Math.sin(t * 2 + ph), 'rgba(255,255,255,0.6)', t + ph); }
    const s = E.outBack(seg(p, 0, 0.35)); logo(ctx, W / 2, 380, s * 1.1, t);
    const tp = seg(p, 0.25, 0.6, E.outBack);
    ctx.save(); ctx.translate(W / 2, 700); ctx.scale(tp, tp);
    text(ctx, 'Little Scientists', 0, -40, { size: 120, weight: 700, color: P.white, stroke: P.ink, strokeWidth: 22 });
    text(ctx, 'Club', 0, 80, { size: 120, weight: 700, color: P.sun, stroke: P.ink, strokeWidth: 22 });
    ctx.restore();
    if (title) { const qp = seg(p, 0.55, 0.85, E.outBack); ctx.save(); ctx.globalAlpha = qp; text(ctx, title, W / 2, 900, { size: 64, weight: 600, color: P.ink }); ctx.restore(); }
  }
  // iris / wipe transitions: p 0..1 covers screen with colour
  function wipe(ctx, p, color) {
    if (p <= 0) return; ctx.save(); ctx.fillStyle = color || P.blueDeep;
    const r = Math.max(W, H) * 0.8 * (1 - p); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true); ctx.fill(); ctx.restore();
  }
  function fade(ctx, a, color) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.fillStyle = color || '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  // ---------- generic props ----------
  function iceCream(ctx, x, y, s, melt, t, opt) {
    // melt 0..1; x,y = cone tip
    opt = opt || {};
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const py = opt.puddleY == null ? 6 : (opt.puddleY - y) / s; // puddle level in local coords
    // puddle
    if (melt > 0.05) { const pr = 20 + 170 * E.out(melt); ctx.fillStyle = opt.color || P.pink; ctx.beginPath(); ctx.ellipse(0, py, pr, pr * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.stroke(); }
    // cone
    ctx.fillStyle = '#E7A251'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, -200); ctx.lineTo(70, -200); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,70,20,0.5)'; ctx.lineWidth = 4;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-70 + i * 35 * 0.5, -200 + i * 2); ctx.lineTo(0 + i * 10, -40 - i * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(70 - i * 35 * 0.5, -200 + i * 2); ctx.lineTo(0 - i * 10, -40 - i * 2); ctx.stroke(); }
    // scoop: shrinks and sags with melt
    const sr = 95 * (1 - 0.6 * melt), sag = 40 * melt;
    ctx.fillStyle = opt.color || P.pink; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(0, -200 - sr * 0.75 + sag, sr * (1 + 0.35 * melt), sr, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // drips
    if (melt > 0.1) {
      ctx.fillStyle = opt.color || P.pink;
      for (let i = 0; i < 4; i++) { const dx = -60 + i * 40; const len = (30 + 60 * i % 3 * 0.5) * melt + 20 * Math.max(0, Math.sin(t * 1.5 + i)); ctx.beginPath(); ctx.ellipse(dx, -200 + sag * 0.5, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); roundRect(ctx, dx - 11, -200 + sag * 0.5, 22, len, 11); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.stroke(); }
    }
    // falling drops
    if (melt > 0.2) { const r = rng(3); for (let i = 0; i < 3; i++) { const ph = r(); const f = ((t * 0.9 + ph) % 1); const dx = -40 + i * 40; const dy = -150 + f * (py + 150); ctx.globalAlpha = 1 - f * 0.4; ctx.fillStyle = opt.color || P.pink; ctx.beginPath(); ctx.ellipse(dx, dy, 9, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } }
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-30, -200 - sr * 0.95 + sag, 18, 10, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function ball(ctx, x, y, r, color, t, spin) {
    circle(ctx, x, y, r, color || P.red, P.ink, 6);
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin || 0); ctx.beginPath(); ctx.arc(0, 0, r - 3, -0.5, 0.9); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    circle(ctx, x - r * 0.35, y - r * 0.4, r * 0.18, 'rgba(255,255,255,0.8)');
  }
  function torch(ctx, x, y, angle, on, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(s || 1, s || 1);
    ctx.fillStyle = P.greyDark; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, -150, -28, 150, 56, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.grey; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(40, -56); ctx.lineTo(40, 56); ctx.lineTo(0, 46); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = on ? P.sun : '#DDD'; ctx.beginPath(); ctx.ellipse(40, 0, 10, 54, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    circle(ctx, -90, 0, 12, P.red, P.ink, 4);
    ctx.restore();
  }
  function tree(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = P.brown; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, -22, -120, 44, 130, 12); ctx.fill(); ctx.stroke();
    circle(ctx, 0, -190, 95, P.green, P.ink, 6); circle(ctx, -70, -140, 70, P.green, P.ink, 6); circle(ctx, 70, -140, 70, P.green, P.ink, 6);
    ctx.restore();
  }
  function house(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#FFE1A8'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.fillRect(-120, -140, 240, 160); ctx.strokeRect(-120, -140, 240, 160);
    ctx.fillStyle = P.red; ctx.beginPath(); ctx.moveTo(-140, -140); ctx.lineTo(0, -240); ctx.lineTo(140, -140); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.blue; ctx.fillRect(-85, -100, 60, 60); ctx.strokeRect(-85, -100, 60, 60); ctx.fillRect(25, -100, 60, 60); ctx.strokeRect(25, -100, 60, 60);
    ctx.fillStyle = P.brown; roundRect(ctx, -30, -60, 60, 80, 10); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function arrow(ctx, x1, y1, x2, y2, color, lw) {
    lw = lw || 10; ctx.save(); ctx.strokeStyle = color || P.ink; ctx.fillStyle = color || P.ink; ctx.lineWidth = lw; ctx.lineCap = 'round';
    const a = Math.atan2(y2 - y1, x2 - x1); const hl = lw * 2.6;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * hl * 0.6, y2 - Math.sin(a) * hl * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(a - 0.5) * hl, y2 - Math.sin(a - 0.5) * hl); ctx.lineTo(x2 - Math.cos(a + 0.5) * hl, y2 - Math.sin(a + 0.5) * hl); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function thoughtBubble(ctx, x, y, w, h, p, tailDir) {
    if (p <= 0) return; ctx.save(); const s = E.outBack(clamp(p, 0, 1)); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    roundRect(ctx, -w / 2, -h / 2, w, h, 40); ctx.fill(); ctx.stroke();
    const d = tailDir || 1; circle(ctx, -d * w / 2 + d * 20, h / 2 + 30, 16, P.white, P.ink, 6); circle(ctx, -d * w / 2 - d * 10, h / 2 + 70, 10, P.white, P.ink, 5);
    ctx.restore();
  }
  function hand(ctx, x, y, s, rot) { // simple pointing hand / grown-up hand
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    ctx.fillStyle = '#F2C9A0'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    roundRect(ctx, -60, -40, 120, 100, 40); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 4; i++) { roundRect(ctx, -58 + i * 30, -95 + (i === 1 ? -10 : i === 3 ? 15 : 0), 26, 80, 13); ctx.fill(); ctx.stroke(); }
    roundRect(ctx, -95, -20, 50, 28, 14); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  global.LSC = { W, H, P, E, clamp, lerp, seg, rng, roundRect, circle, ellipse, text, wrapLines, sky, ground, sun, cloud, star, sparkles, pip, caption, sticker, logo, titleCard, wipe, fade, iceCream, ball, torch, tree, house, arrow, thoughtBubble, hand };
})(typeof window !== 'undefined' ? window : globalThis);

/* Shared scenes and props for Little Scientists Club episodes */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;

  // timeline helper: T = {lineId: {start,end,hold}}
  L.tl = function (t, T) {
    const get = id => T[id] || { start: 0, end: 0, hold: 0 };
    return {
      t,
      start: id => get(id).start, end: id => get(id).end,
      // progress across the spoken part of a line
      p: (id, ease) => seg(t, get(id).start, get(id).end, ease),
      // progress from start of a to end of b (plus hold)
      span: (a, b, ease) => seg(t, get(a).start, get(b || a).end + (get(b || a).hold || 0), ease),
      since: id => t - get(id).start,
      after: id => t >= get(id).start,
      done: id => t >= get(id).end,
      // 0..1 within [start+offset, start+offset+dur]
      win: (id, offset, dur, ease) => seg(t, get(id).start + offset, get(id).start + offset + dur, ease),
      // start time of the spoken chunk (sentence) of a line that contains `needle`; falls back to the line start
      chunk: (id, needle) => { const cs = get(id).chunks || []; const n = String(needle).toLowerCase(); const c = cs.find(c => c.text.toLowerCase().includes(n)); return c ? c.start : get(id).start; },
      chunkN: (id, n) => { const cs = get(id).chunks || []; return cs[n] ? cs[n].start : get(id).start; },
      // 0..1 window starting when `needle` is spoken (+offset seconds)
      cwin: (id, needle, dur, ease, offset) => { const s0 = (typeof needle === 'number' ? (get(id).chunks || [])[needle]?.start ?? get(id).start : (() => { const cs = get(id).chunks || []; const n = String(needle).toLowerCase(); const c = cs.find(c => c.text.toLowerCase().includes(n)); return c ? c.start : get(id).start; })()) + (offset || 0); return seg(t, s0, s0 + dur, ease); },
      cafter: (id, needle, offset) => { const cs = get(id).chunks || []; const n = String(needle).toLowerCase(); const c = cs.find(c => c.text.toLowerCase().includes(n)); return t >= (c ? c.start : get(id).start) + (offset || 0); }
    };
  };

  L.park = function (ctx, t, o) {
    o = o || {};
    L.sky(ctx); if (o.sun !== false) L.sun(ctx, o.sunX == null ? 1650 : o.sunX, o.sunY == null ? 200 : o.sunY, o.sunR || 110, t);
    if (o.clouds !== false) { L.cloud(ctx, 300 + Math.sin(t * 0.3) * 20, 180, 1.1); L.cloud(ctx, 1100 + Math.cos(t * 0.25) * 25, 120, 0.8); }
    L.ground(ctx, 820);
    if (o.tree !== false) L.tree(ctx, 240, 830, 1.1);
    if (o.house) L.house(ctx, 1500, 840, 1);
  };
  L.snowflake = function (ctx, x, y, r, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.strokeStyle = color || '#8FD3FF'; ctx.lineWidth = Math.max(3, r * 0.14); ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.8, -r * 0.2); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.8, r * 0.2); ctx.stroke(); }
    ctx.restore();
  };
  L.heatWaves = function (ctx, x, y, t, n, h, color) {
    n = n || 3; h = h || 90; ctx.save(); ctx.strokeStyle = color || 'rgba(255,90,60,0.8)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const ox = x + (i - (n - 1) / 2) * 50; const ph = t * 4 + i; ctx.beginPath(); for (let k = 0; k <= 20; k++) { const yy = y - k / 20 * h; const xx = ox + Math.sin(ph + k * 0.5) * 12; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.globalAlpha = 0.9 - 0.5 * ((t * 0.7 + i * 0.3) % 1); ctx.stroke(); }
    ctx.restore();
  };
  L.tryBanner = function (ctx, p) {
    if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(W / 2, 110); ctx.scale(s, s);
    ctx.fillStyle = P.green; roundRect(ctx, -420, -62, 840, 124, 40); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.stroke();
    text(ctx, 'Try it at home!', 0, 4, { size: 72, weight: 700, color: P.white, stroke: P.ink, strokeWidth: 14 });
    ctx.restore();
  };
  L.grownUpBadge = function (ctx, x, y, p) {
    if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    circle(ctx, 0, 0, 84, P.white, P.ink, 7); L.hand(ctx, -8, 10, 0.55, 0.2);
    ctx.restore();
    text(ctx, 'with a grown-up', x, y + 125, { size: 36, weight: 600, color: P.ink });
  };
  L.magnifier = function (ctx, x, y, r, p) {
    // frame only (contents drawn by caller with clip)
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8FD3FF'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r - 11, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + r * 0.72, y + r * 0.72); ctx.lineTo(x + r * 1.25, y + r * 1.25); ctx.stroke();
    ctx.restore();
  };
  L.confetti = function (ctx, t, seed, n) {
    const r = L.rng(seed || 11); n = n || 60;
    const cols = [P.red, P.sun, P.blue, P.green, P.pink, P.purple];
    for (let i = 0; i < n; i++) { const x0 = r() * W, sp = 120 + r() * 160, ph = r() * 10, col = cols[Math.floor(r() * cols.length)], w = 10 + r() * 14; const y = ((t * sp + ph * 100) % (H + 100)) - 60; const x = x0 + Math.sin(t * 2 + ph) * 30; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + ph); ctx.fillStyle = col; ctx.fillRect(-w / 2, -w / 4, w, w / 2); ctx.restore(); }
  };
  L.questionMark = function (ctx, x, y, s, t, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.1); ctx.scale(s, s);
    text(ctx, '?', 0, 0, { size: 160, weight: 700, color: color || P.red, stroke: P.ink, strokeWidth: 22 }); ctx.restore();
  };
  L.sayItSticker = function (ctx, phrase, p, t) {
    if (p <= 0) return; const s = E.outElastic(clamp(p, 0, 1)); ctx.save(); ctx.translate(W / 2, 300); ctx.scale(s, s); ctx.rotate(Math.sin(t * 2) * 0.03);
    let size = 96; ctx.font = `700 ${size}px Fredoka`; let tw = ctx.measureText(phrase).width; if (tw > 1500) { size = Math.floor(96 * 1500 / tw); ctx.font = `700 ${size}px Fredoka`; tw = ctx.measureText(phrase).width; }
    const w = tw + 120;
    ctx.fillStyle = P.sun; roundRect(ctx, -w / 2, -110, w, 220, 50); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 10; ctx.stroke();
    text(ctx, 'Say it with me:', 0, -50, { size: 40, weight: 600, color: P.ink });
    text(ctx, phrase, 0, 36, { size, weight: 700, color: P.ink });
    ctx.restore();
  };

  // ---- Web Audio for Try-it activities (website only) ----
  // LSC.sound.pluck(freq, vol) plucked string; .drum(vol) drum hit; .tone(freq, dur, {type, vol, glide, attack});
  // .noise(dur, vol, {lp, hp}). The page calls LSC.sound.unlock() on every touch, so these may be called from an
  // activity's pointer() or update(). In the video renderer and in Node there is no AudioContext: calls do nothing.
  L.sound = {
    ctx: null, out: null,
    unlock() {
      try {
        if (typeof window === 'undefined') return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        if (!this.ctx) {
          this.ctx = new AC();
          // a gentle limiter on the way out, so many sounds at once (a swipe across strings, fast taps) never clip
          try { const k = this.ctx.createDynamicsCompressor(); k.threshold.value = -12; k.knee.value = 6; k.ratio.value = 8; k.attack.value = 0.003; k.release.value = 0.2; k.connect(this.ctx.destination); this.out = k; } catch (e) { this.out = null; }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* no sound is fine */ }
    },
    _dest() { return this.out || this.ctx.destination; },
    tone(freq, dur, o) {
      const c = this.ctx; if (!c) return; o = o || {};
      const t0 = c.currentTime, osc = c.createOscillator(), g = c.createGain(), v = Math.max(0.0002, o.vol == null ? 0.3 : o.vol);
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0); if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this._dest()); osc.start(t0); osc.stop(t0 + dur + 0.05);
    },
    pluck(freq, vol) { const v = vol == null ? 0.35 : vol; [[1, 1], [2, 0.5], [3, 0.25], [4, 0.12]].forEach(([h, a]) => this.tone(freq * h, 1.6 / Math.sqrt(h), { type: 'triangle', vol: v * a, attack: 0.004 })); },
    drum(vol) { const v = vol == null ? 0.5 : vol; this.tone(150, 0.45, { vol: v, glide: 55, attack: 0.003 }); this.noise(0.12, v * 0.35, { lp: 2500 }); },
    noise(dur, vol, o) {
      const c = this.ctx; if (!c) return; o = o || {};
      const n = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      let s = 12345; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; d[i] = (s / 1073741824 - 1) * (1 - i / n); }
      const src = c.createBufferSource(); src.buffer = buf; let node = src;
      for (const [type, f] of [['lowpass', o.lp], ['highpass', o.hp]]) if (f) { const q = c.createBiquadFilter(); q.type = type; q.frequency.value = f; node.connect(q); node = q; }
      const g = c.createGain(); g.gain.value = vol == null ? 0.2 : vol; node.connect(g); g.connect(this._dest()); src.start();
    }
  };

  // ---- shared scenes ----
  L.scenes = L.scenes || {};
  // Curie waves hello in the park
  L.scenes.intro = function (ctx, t, Lt) {
    L.park(ctx, t, { house: true });
    const p = Lt.p('hello'); const wave = Math.sin(t * 9) * 0.5;
    L.pip(ctx, { x: 960, y: 700, s: 1.4, t, mood: 'talk', armR: p < 0.6 ? -1.2 + wave * 0.5 : 0.4, armL: 0.6, lookX: 0 });
    L.sparkles(ctx, 960, 560, t, 5, 6, 260);
    const lp = Lt.win('hello', 1.2, 0.7, E.outBack); if (lp > 0) { ctx.save(); ctx.translate(380, 420); ctx.scale(lp, lp); L.logo(ctx, 0, 0, 0.9, t); ctx.restore(); }
  };
  // Curie asks the big question with a thought bubble; drawInBubble(ctx,t) draws the topic prop centred at 0,0.
  // opt.word: the pop-up word (default 'Why?'; use 'What?', 'Where?' or 'How?' to match the question)
  L.scenes.question = function (ctx, t, Lt, drawInBubble, opt) {
    L.park(ctx, t, { house: true });
    L.pip(ctx, { x: 620, y: 720, s: 1.4, t, mood: 'think', armR: -0.9, armL: 0.6, lookX: 0.6, lookY: -0.6 });
    const bp = Lt.win('q', 0.1, 0.6); L.thoughtBubble(ctx, 1230, 380, 700, 480, bp, 1);
    if (bp > 0.5) { ctx.save(); ctx.translate(1180, 400); drawInBubble(ctx, t); ctx.restore(); L.questionMark(ctx, 1500, 320, 1 + 0.1 * Math.sin(t * 3), t); }
    L.sticker(ctx, (opt && opt.word) || 'Why?', 380, 300, Lt.cwin('q', 1, 0.5), { bg: P.pink, rot: -0.12 });
  };
  // outro: Curie waves bye, logo, confetti, key phrase
  L.scenes.outro = function (ctx, t, Lt, phrase) {
    L.sky(ctx, { top: '#5FB8FF', bottom: '#CDEBFF' }); L.confetti(ctx, t, 21, 70); L.ground(ctx, 860);
    L.pip(ctx, { x: 560, y: 720, s: 1.4, t, mood: Lt.cafter('bye', 'bye-bye') ? 'happy' : 'talk', armR: -1.1 + Math.sin(t * 8) * 0.35, armL: 0.6 });
    const lp = Lt.win('bye', 0, 0.6, E.outBack); ctx.save(); ctx.translate(1380, 340); ctx.scale(lp, lp); L.logo(ctx, 0, 0, 1, t); ctx.restore();
    const pp = Lt.cwin('bye', 'remember', 0.6, E.outBack, 0.3); if (pp > 0) { ctx.save(); ctx.translate(1380, 640); ctx.scale(pp, pp); ctx.fillStyle = P.white; ctx.font = '700 60px Fredoka'; const w = ctx.measureText(phrase).width + 100; roundRect(ctx, -w / 2, -60, w, 120, 40); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.stroke(); text(ctx, phrase, 0, 4, { size: 60, weight: 700, color: P.ink }); ctx.restore(); }
    const bp = Lt.cwin('bye', 'bye-bye', 0.6, E.outBack); if (bp > 0) L.sticker(ctx, 'Bye-bye!', 1380, 790, bp, { bg: P.sun, rot: 0.05, size: 84 });
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* =====================================================================================================================
   Little Scientists Club: the shared creature library, LSC.creatures (from Episode 12). Loaded after lib/scenes.js.
   const C = LSC.creatures;  C.rex(ctx, x, y, s, t, o)  ...  Pure drawing: the same arguments always give the same
   picture (no Math.random, no Date, no state between calls); every call leaves the context as it found it.

   COMMON SIGNATURE   C.name(ctx, x, y, s, t, o)
     x, y   the ground point under the feet (between them), unless noted. o.anchor = 'center' puts (x, y) at the centre of
            the drawing instead (C.info[name].center); for the birds that centre is the middle of the body (Ep14's bird).
     s      scale. The size at s = 1 is listed below and in C.info[name] (w, h, box = [x0, y0, x1, y1] of the first pose,
            boxAll = the box over all poses). Line widths grow with size but never below 2.5 px; fine details (dots,
            feather lines, teeth, scales) fade out on small drawings, so one call works from a 60 px thumbnail to a close-up.
     t      time in seconds: breathing, blinking, idle sways and looks, and the cycles when no phase is given.
     o      options (all optional):
       face 1 | -1      faces right (default) or left (o.flip = true is the same as face -1)
       pose             see each animal; an unknown pose falls back to the first one
       phase 0..1       position in a cycle (walk, run, hop, flap, peck, roar...). Without it the cycle runs from t * speed.
       dist (px)        on-screen distance walked: drives the cycle so the planted feet do not slide when you move x yourself
                        (phase = dist / (stride * s)); use it whenever the animal travels across the screen
       speed            cycle speed (1 = natural)
       amount 0..1, from   blend from the pose `from` (default the first pose) into `pose` (lying down, getting up...)
       look {x, y} or a number -1..1    where the eyes (and the head a little) look; default: a gentle idle look-around
       blink 0..1       force the eyelids (default: automatic blinking every few seconds)
       mood             'happy' (default) | 'calm' | 'surprised' | 'sleepy' | 'sad' (eyelids, brows, blush, mouth; all gentle)
       mouth 0..1       open the mouth / beak (overrides the pose's own)
       alpha 0..1       transparency
       silhouette 0..1  fades the animal to a soft grey silhouette (Ep16 "fading away"); 1 with alpha < 1 = one flat shape
       colors {...}     colour overrides by part name (e.g. { body: '#4EA8FF', belly: '#DDEEFF' })
       seed             varies the blinking, idle motion and texture so a herd or flock does not move in step
       shadow           false hides the soft ground shadow (or a number 0..1 for its strength)

   DINOSAURS                                                         (size at s = 1: width x height, ground point)
   C.rex(ctx, x, y, s, t, o)              780 x 430 (lookUp reaches 536 tall; lie 790 x 182), feet on y, faces right.
       poses 'idle' (breathing, blinking, tail sway, looking), 'walk', 'run' (stride 290 / 540 px at s = 1), 'roar' (a happy
       open-mouthed roar with squeezed eyes: a one-shot with phase 0..1, or a 3.2 s loop from t), 'lie' (on its belly,
       eyes closed, resting), 'lookUp' (head raised to the sky). o.xray 0..1 overlays the skeleton. colors: body, belly,
       claw, mouth, tongue, cheek, iris.
   C.rexSkeleton(ctx, x, y, s, t, o)      766 x 416, the same rig as C.rex, so it takes the same poses and sizes (the bones
       of a rex drawn with the same x, y, s, pose and t line up with it). o.fossil 0..1: cream bones -> stone-coloured
       fossil. o.parts = ['skull', 'body', 'tail', 'legNear', 'legFar'] (or o.part = one of them) draws only those pieces,
       each at its assembled position: puzzle pieces (Ep12). No ground shadow unless o.shadow is given.
   C.titanosaur(ctx, x, y, s, t, o)       1074 x 650 (long neck up), feet on y. poses 'idle' (slow neck sway), 'walk' (four-
       legged walk: hind, front, hind, front; stride 270), 'munch' (head down to the ground plants, chewing; o.reach 1 =
       up in the treetops instead; o.food = false hides the leafy sprig).
   C.horned(ctx, x, y, s, t, o)           660 x 340 (frill, two brow horns, nose horn, beak), feet on y. poses 'idle', 'walk'
       (stride 200), 'munch' (o.food as above). colors: body, belly, frill, frillIn, horn, beak.
   C.featheredDino(ctx, x, y, s, t, o)    550 x 306 at bird 0 (324 x 252 at bird 1), feet on y. o.bird 0..1 morphs
       smoothly: 0 = a small feathered dinosaur (snout with small teeth, clawed hands, short arm feathers, long bony tail
       feathered at the end), 0.5 = Archaeopteryx-like (wings with three clawed fingers, teeth, long feathered bony tail),
       1 = a pigeon-like bird (beak, no teeth, no hand claws, short fan tail). poses 'idle', 'walk', 'run', 'flap' (a flap
       cycle standing on the ground), 'brood' (sitting on a mound nest of eggs with the wings spread over them, like the
       "Big Mama" fossil; o.nest = false leaves the nest out, o.count = eggs).
   C.archaeopteryx(ctx, x, y, s, t, o)    the bird = 0.5 stage at crow size: 298 x 158; same poses and options.
   C.archaeopteryxFossil(ctx, x, y, s, t, o)   444 x 332 stone slab, (x, y) = the CENTRE of the slab: the famous fossil
       (head thrown back, wings spread with feather prints, long tail with paired feathers). o.slab = false draws only the
       bones and prints (to lay them into your own rock).

   BIRDS (one rig: egg-shaped body, neck, round head, scaly legs with three toes forward and one back, a fan tail;
   folded wings at rest, a 3D flap cycle in flight: wings up, down, folding back on the upstroke, the body bobbing)
   C.pigeon(ctx, x, y, s, t, o)           218 x 150, feet on y. 'idle', 'walk' (the real head-bob: the head holds still in
       the world, then thrusts forward; stride 60), 'peck' (one-shot by phase, or a loop), 'coo' (puffed chest, bowing),
       'fly', 'glide' (wings held up in a V). Green-purple neck shine.
   C.hen(ctx, x, y, s, t, o)              268 x 248 (comb, wattle, fluffy body). 'idle', 'walk', 'peck', 'brood' (settled on a
       straw nest with eggs: o.nest = false, o.count, o.nestOpts = options for C.nest), 'cluck'.
   C.crow(ctx, x, y, s, t, o)             304 x 164, strong beak, blue sheen. 'idle', 'hop', 'walk', 'caw', 'fly'.
   C.sparrow(ctx, x, y, s, t, o)          118 x 80, streaked brown. 'idle', 'hop', 'peck', 'fly'.
   C.smallBird(ctx, x, y, s, t, o)        102 x 74, for flocks. 'perch' (toes curled round a branch at y), 'idle', 'hop', 'fly'.
       o.variant: 'blue' (default), 'yellow', 'red', 'green', 'orange', 'pink', 'teal', 'purple', 'brown', or a number 0..8.
   Flying poses keep the body where it is when standing, legs tucked: (x, y) is the point under it, so move y up to fly
   higher; or pass o.anchor = 'center' to place the middle of the body at (x, y).

   NESTS, EGGS, PRINTS, FEATHERS (no t: C.name(ctx, x, y, s, o))
   C.nest(ctx, x, y, s, o)                258 x 106 with eggs, (x, y) = the bottom of the nest. o.count 0..7 eggs, o.kind 'straw'
       (bird nest, default) | 'mound' (dinosaur nest of earth, eggs in a ring), o.eggColor, o.seed, o.layer 'back' | 'front':
       draw 'back', then the sitting animal, then 'front' (no layer = both).
   C.egg(ctx, x, y, s, o)                 64 x 68, standing on its fat end at (x, y). o.color, o.spots 0..1, o.rot, o.crack 0..1
       (a zigzag crack), o.stone 0..1 (a fossil egg), o.long (a longer dinosaur egg), o.seed.
   C.track(ctx, x, y, s, o) = C.foot      a three-toed footprint pressed into the ground, seen from above: about 70 x 112
       (heel near (x, y), toes pointing up the screen; o.rot turns it). o.kind 'dino' (default) | 'bird' (slender toes and a
       back toe), o.color = the ground's colour (the print is shaded from it), o.depth 0..1.
   C.feather(ctx, x, y, s, o)             34 x 128, (x, y) = the base of the quill, pointing up at rot 0. o.color, o.tip (tip
       colour, '' for none), o.rot, o.curl -1..1.

   OTHER ANIMALS (Ep16 survivors)
   C.shrew(ctx, x, y, s, t, o)       208 x 70 (tail included). 'idle', 'scurry' (stride 70), 'sniff' (twitching nose).
   C.turtle(ctx, x, y, s, t, o)      260 x 106. 'idle', 'walk' (stride 60), 'hide' (head and legs pulled into the shell).
   C.frog(ctx, x, y, s, t, o)        114 x 104 sitting. 'sit' (throat pulse, blink), 'hop' (one jump of 150 px forward per
                                     cycle, rising about 70 px; drive it with dist or phase).
   C.crocodile(ctx, x, y, s, t, o)   662 x 106. 'idle', 'walk' (stride 160), 'smile' (a toothy, friendly grin).

   C.info[name]   poses, cycles, gait {pose: {stride (px at s = 1), rate}}, w, h, box, boxAll, center, flyPoses, parts, variants.
   C.util         mix(colourA, colourB, k), rgba(colour, a), crv(path, points, closed), limb(...), palette(...).
   Speed (out/creatures/timing.txt, s = 1, headless Chromium without GPU): rex, rexSkeleton, titanosaur, featheredDino about
   1.3 - 1.65 ms, horned 1.25 - 1.35 ms; birds 0.65 - 1.1 ms drawn 300+ px tall; the rest under 0.75 ms. Gallery and checks:
   tools/creatures_gallery.js.

   REPLACING THE EPISODES' OWN DRAWINGS (sizes are at s = 1; "x 0.8" means multiply your s by 0.8)
   Ep12  rex(ctx,x,y,s,o)          -> C.rex(ctx, x, y, s, o.t, {face: o.flip ? -1 : 1, silhouette, alpha}); about the same size.
         rexLying                  -> C.rex pose 'lie' (790 x 182, theirs 700 x 190); use amount/from: 'idle' to lie down.
         titan(ctx,x,y,s,o)        -> C.titanosaur; theirs 850 x 700, ours 1074 x 650: s x 1.0 - 1.08 (ours is longer).
         skeleton / skeletonLying  -> C.rexSkeleton (poses 'idle' / 'lie', o.fossil for stone). Their pieces skull, body, tail,
                                      legA, legB -> o.parts 'skull', 'body', 'tail', 'legNear', 'legFar'. Their 'ghost' mode
                                      (dashed outline of a missing piece) is not in the library: keep theirs, or use
                                      {silhouette: 1, alpha: 0.5} for a flat grey stand-in.
         egg(ctx,x,y,r,o)          -> C.egg(ctx, x, y + 1.25 * r, r / 32, {stone: o.stone}): ours stands on its bottom.
         nest(ctx,x,y,w,o)         -> C.nest(ctx, x, y, w / 258, {kind: 'mound', count: o.eggs}); no stone version.
   Ep13  titan(ctx,x,y,s,t,flip)   -> C.titanosaur(ctx, x, y, s * 0.54, t, {face: flip ? -1 : 1}); theirs 500 x 350.
   Ep14  bird(ctx,x,y,s,o)         -> C.sparrow or C.smallBird with {anchor: 'center'} (their x, y = the body centre),
                                      pose 'fly' for o.fly 1, 'perch'/'idle' for 0; o.carry (a beetle) and o.q are not in the
                                      library. moth, beetle, tiger, stickInsect: not in the library (keep them).
   Ep15  para(ctx,x,y,s,t,m,o)     -> C.featheredDino(ctx, x, y, s, t, {bird: m / 4, pose: o.flap ? 'flap' : ...}); same size
                                      (about 550 long at bird 0). Their peck is not a featheredDino pose.
         bird(..., {kind})         -> C.hen / C.crow / C.sparrow (peck -> pose 'peck', sit -> 'brood', hop -> 'hop',
                                      walk phase -> pose 'walk' with phase); ours are a little smaller: hen x 1.15.
         miniBird(ctx,x,y,s,k,flip,hop) -> C.smallBird(ctx, x, y, s * 1.2, t, {variant: k, face, pose: hop ? 'hop' : 'idle'}).
         rex (950 x 550)           -> C.rex with s x 1.25; rexFoot is part of their rex (ours draws its own feet).
         trackPrint(ctx,x,y,len,rot,o) -> C.track(ctx, x, y, len / 112, {rot, color: the stone or sand colour}).
         egg / nestEggs            -> C.egg (same anchor: the bottom) / C.nest (layer 'back' and 'front' around a sitter).
         skeleton (in the slab)    -> C.archaeopteryxFossil (the Archaeopteryx stage only; (x, y) = slab centre).
         oviSkeleton               -> not in the library (keep theirs); C.featheredDino pose 'brood' is the living version.
   Ep16  rex (760 long)            -> C.rex x 0.97 (ours stands taller: 430 vs about 350); titan (880 long) -> C.titanosaur
                                      x 0.82; horned (560 long) -> C.horned x 0.85; feathered -> C.featheredDino; bird
                                      {kind} -> C.sparrow / C.hen / C.pigeon / C.crow; shrew, turtle, frog -> C.shrew,
                                      C.turtle, C.frog; croc -> C.crocodile; skeleton (fossil rex) -> C.rexSkeleton {fossil: 1}
                                      with the same x, y, s as the rex; their sil/alpha -> silhouette/alpha. dog: not in the
                                      library (keep it).
   All episode functions that take flip: use face: -1. All ours put the ground point at the feet (y = 0), except the
   fossil slab (centre) and C.egg/C.nest (bottom). Pass t (seconds) so breathing and blinking run.
   ===================================================================================================================== */
(function (global) {
  const L = global.LSC;
  if (!L) return;
  const P = L.P, INK = P.ink;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const frac = v => v - Math.floor(v);
  const ease = u => u * u * (3 - 2 * u);
  const hash = n => { let h = Math.imul((n | 0) ^ 0x9E3779B9, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const wob = (t, k) => Math.sin(t * 1.13 + k * 1.7) * 0.6 + Math.sin(t * 0.71 + k * 3.1) * 0.4;   // smooth, about -1..1

  // ---------------------------------------------------------------------------------------------------------------
  // colours
  const RGBC = new Map();
  function rgbOf(c) {
    if (typeof c !== 'string') return [0, 0, 0, 1];
    let v = RGBC.get(c); if (v) return v;
    let r = 0, g = 0, b = 0, a = 1;
    if (c[0] === '#') {
      if (c.length < 7) { r = parseInt(c[1] + c[1], 16); g = parseInt(c[2] + c[2], 16); b = parseInt(c[3] + c[3], 16); }
      else { r = parseInt(c.slice(1, 3), 16); g = parseInt(c.slice(3, 5), 16); b = parseInt(c.slice(5, 7), 16); }
      v = [r || 0, g || 0, b || 0, 1]; if (RGBC.size < 400) RGBC.set(c, v); return v;
    }
    const m = c.match(/[\d.]+/g); if (m) { r = +m[0]; g = +m[1]; b = +m[2]; if (m[3] != null) a = +m[3]; }
    return [r || 0, g || 0, b || 0, a];
  }
  function mix(a, b, t) {
    if (!(t > 0)) return a; if (t >= 1) return b;
    const A = rgbOf(a), B = rgbOf(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function rgba(c, a) { const A = rgbOf(c); return 'rgba(' + Math.round(A[0]) + ',' + Math.round(A[1]) + ',' + Math.round(A[2]) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  const dk = (c, k) => mix(c, INK, k);          // shade towards the ink colour (cool cartoon shadows)
  const lt = (c, k) => mix(c, '#FFFFFF', k);
  const SIL = '#A9AFBD';                        // the soft grey of a fading silhouette
  function palette(def, over, sil) {
    const o = {};
    for (const k in def) { const c = (over && over[k]) || def[k]; o[k] = sil > 0 ? mix(c, SIL, sil) : c; }
    if (over) for (const k in over) if (!(k in o)) o[k] = sil > 0 ? mix(over[k], SIL, sil) : over[k];
    return o;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // paths: Catmull-Rom splines through points, CW outlines, tapered limbs, body tubes along a spine
  // smooth curve through a control polygon: quadratic B-spline (curves through the midpoints of the polygon's edges).
  // Chromium fills these much faster than cubic curves, and they look as smooth.
  function crv(p, pts, closed, noMove) {
    const n = pts.length; if (n < 2) return;
    if (closed) {
      const a0 = pts[n - 1], b0 = pts[0];
      if (!noMove) p.moveTo((a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2);
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1 < n ? i + 1 : 0]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
      p.closePath(); return;
    }
    if (!noMove) p.moveTo(pts[0][0], pts[0][1]);
    if (n === 2) { p.lineTo(pts[1][0], pts[1][1]); return; }
    for (let i = 1; i < n - 2; i++) { const a = pts[i], b = pts[i + 1]; p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    p.quadraticCurveTo(pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1]);
  }
  // the point of the curve nearest control point i (the B-spline passes through (P[i-1] + 6 P[i] + P[i+1]) / 8)
  function bsp(pts, i) { const n = pts.length, a = pts[(i - 1 + n) % n], p = pts[i], b = pts[(i + 1) % n]; return [(a[0] + 6 * p[0] + b[0]) / 8, (a[1] + 6 * p[1] + b[1]) / 8]; }
  function area(pts) { let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  const cw = pts => (area(pts) >= 0 ? pts : pts.slice().reverse());       // y down: positive area = clockwise on screen
  function closedPath(p, pts) { crv(p, cw(pts), true); }
  function ell(p, x, y, rx, ry, rot) { rot = rot || 0; p.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx); p.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function circ(p, x, y, r) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); }
  // points of a tapered limb from A (radius ra) to B (radius rb); b1, b2 bulge the two sides (fractions of the radius)
  function limbPts(A, ra, B, rb, b1, b2) {
    const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    const m1 = (ra + rb) / 2 * (1 + (b1 || 0)), m2 = (ra + rb) / 2 * (1 + (b2 || 0)), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
    const r2 = Math.SQRT1_2;
    return [
      [A[0] + nx * ra, A[1] + ny * ra], [mx + nx * m1, my + ny * m1], [B[0] + nx * rb, B[1] + ny * rb],
      [B[0] + (nx + ux) * rb * r2, B[1] + (ny + uy) * rb * r2], [B[0] + ux * rb, B[1] + uy * rb], [B[0] + (ux - nx) * rb * r2, B[1] + (uy - ny) * rb * r2],
      [B[0] - nx * rb, B[1] - ny * rb], [mx - nx * m2, my - ny * m2], [A[0] - nx * ra, A[1] - ny * ra],
      [A[0] - (nx + ux) * ra * r2, A[1] - (ny + uy) * ra * r2], [A[0] - ux * ra, A[1] - uy * ra], [A[0] + (nx - ux) * ra * r2, A[1] + (ny - uy) * ra * r2]
    ];
  }
  function limb(p, A, ra, B, rb, b1, b2) { closedPath(p, limbPts(A, ra, B, rb, b1, b2)); }
  // a bent tube through joints J (radii r): one contour for a whole limb (e.g. shin + foot bone), round ends
  function chainPts(J, r) {
    const n = J.length, L_ = [], R_ = [];
    for (let i = 0; i < n; i++) {
      const a = J[Math.max(0, i - 1)], b = J[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let k = 1; if (i > 0 && i < n - 1) { const ux = J[i][0] - a[0], uy = J[i][1] - a[1], ul = Math.hypot(ux, uy) || 1; k = 1 / Math.max(0.6, (ux * tx + uy * ty) / ul); }
      L_.push([J[i][0] - ty * r[i] * k, J[i][1] + tx * r[i] * k]); R_.push([J[i][0] + ty * r[i] * k, J[i][1] - tx * r[i] * k]);
    }
    const e0 = [J[1][0] - J[0][0], J[1][1] - J[0][1]], l0 = Math.hypot(e0[0], e0[1]) || 1, e1 = [J[n - 1][0] - J[n - 2][0], J[n - 1][1] - J[n - 2][1]], l1 = Math.hypot(e1[0], e1[1]) || 1;
    const c0 = [J[0][0] - e0[0] / l0 * r[0], J[0][1] - e0[1] / l0 * r[0]], c1 = [J[n - 1][0] + e1[0] / l1 * r[n - 1], J[n - 1][1] + e1[1] / l1 * r[n - 1]];
    return [c0].concat(L_, [c1], R_.reverse());
  }
  // a body along a spine (points tail tip -> head end): d = thickness above, v = below; caps round the two ends.
  // returns {top, bot, up} (up = the unit 'up' normal at each point) and fills `out` with the closed outline points
  function tube(sp, d, v, capA, capB, groundClamp) {
    const n = sp.length, top = [], bot = [], up = [];
    for (let i = 0; i < n; i++) {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      const ux = ty / l, uy = -tx / l; up.push([ux, uy]);
      top.push([sp[i][0] + ux * d[i], sp[i][1] + uy * d[i]]); bot.push([sp[i][0] - ux * v[i], sp[i][1] - uy * v[i]]);
    }
    const out = [];
    const t0 = [-up[0][1], up[0][0]], t1 = [-up[n - 1][1], up[n - 1][0]];   // tangents (pointing tail -> head)
    if (capA) out.push([sp[0][0] - t0[0] * capA, sp[0][1] - t0[1] * capA]);
    for (let i = 0; i < n; i++) out.push(top[i]);
    if (capB) out.push([sp[n - 1][0] + t1[0] * capB, sp[n - 1][1] + t1[1] * capB]);
    for (let i = n - 1; i >= 0; i--) out.push(bot[i]);
    if (groundClamp) for (const q of out) if (q[1] > groundClamp) q[1] = groundClamp;
    return { top, bot, up, out };
  }
  // point and direction at fraction u along a polyline
  function along(pts, u) {
    let tot = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
    let dist = clamp(u, 0, 1) * tot;
    for (let i = 0; i < seg.length; i++) {
      if (dist <= seg[i] || i === seg.length - 1) { const f = seg[i] ? clamp(dist / seg[i], 0, 1) : 0, a = pts[i], b = pts[i + 1]; return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), i, f }; }
      dist -= seg[i];
    }
    return { x: pts[0][0], y: pts[0][1], ang: 0, i: 0, f: 0 };
  }
  // two-bone IK: the joint between H and A (lengths l1, l2), bending forward (+x) when bend = 1
  function ik(H, A, l1, l2, bend) {
    const dx = A[0] - H[0], dy = A[1] - H[1]; let d = Math.hypot(dx, dy);
    const dmax = (l1 + l2) * 0.999, dmin = Math.abs(l1 - l2) + 0.01;
    d = clamp(d, dmin, dmax);
    const a = Math.atan2(dy, dx), c = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), A1 = Math.acos(c), g = a - (bend || 1) * A1;
    return [H[0] + Math.cos(g) * l1, H[1] + Math.sin(g) * l1];
  }
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const add = (p, v, k) => [p[0] + v[0] * (k == null ? 1 : k), p[1] + v[1] * (k == null ? 1 : k)];
  const dirv = a => [Math.cos(a), Math.sin(a)];

  // ---------------------------------------------------------------------------------------------------------------
  // drawing state, outlines, two-tone shading
  function setup(ctx, x, y, s, o, H1, center) {
    const face = (o.face != null ? (o.face < 0 ? -1 : 1) : (o.flip ? -1 : 1));
    const sil = clamp(+o.silhouette || 0, 0, 1), alpha = o.alpha == null ? 1 : clamp(+o.alpha, 0, 1);
    const k0 = o._k || 1, hs = H1 * s * k0, lwS = clamp(0.42 * Math.sqrt(hs), 2.5, 9.5);
    const st = { ctx, s: s * k0, face, sil, det: 1 - sil, alpha, lw: lwS / (s * k0), hs, tex: sstep(80, 170, hs) * (1 - sil), fine: sstep(130, 260, hs) * (1 - sil),
      ink: sil > 0 ? mix(INK, SIL, sil) : INK, flat: sil > 0.995 && alpha < 0.999, all: null, seed: o.seed || 0, lod: hs >= 190 ? 2 : hs >= 90 ? 1 : 0 };
    if (st.flat) st.all = new Path2D();
    ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
    if (o.anchor === 'center' && center) ctx.translate(-center[0], -center[1]);
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    return st;
  }
  // outlines as fills (cheaper than strokes): each outline is moved outwards by d along its normals (miter-limited), filled
  // in ink, then the shape itself on top. list = point lists (one shape may be several overlapping pieces: one silhouette).
  // k(i, pts) may scale the outline per point (0 hides it there: a part that melts into the body).
  function fatPts(pts, d, k) {
    const n = pts.length, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], p = pts[i], b = pts[(i + 1) % n];
      let e1x = p[0] - a[0], e1y = p[1] - a[1], e2x = b[0] - p[0], e2y = b[1] - p[1]; const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
      e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
      let nx = e1y + e2y, ny = -e1x - e2x; const ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
      const cosh = Math.max(0.55, nx * e1y - ny * e1x), dd = d * (k ? k(i, p) : 1) / cosh;
      out[i] = [p[0] + nx * dd, p[1] + ny * dd];
    }
    return out;
  }
  function partPts(st, list, fill, k, one) {
    if (st.flat) { for (const it of list) closedPath(st.all, it.pts || it); return; }
    if (one) {   // small pieces: all outlines in one fill, all shapes in another
      const ctx = st.ctx, ink = new Path2D(), col = new Path2D();
      for (const it of list) { const c = cw(it.pts || it); crv(ink, fatPts(c, st.lw, it.k || k), true); crv(col, c, true); }
      ctx.fillStyle = st.ink; ctx.fill(ink); ctx.fillStyle = fill; ctx.fill(col); return;
    }
    // one contour per fill (Skia fills a single simple contour much faster than several in one path); all the outlines
    // first, then all the shapes, so overlapping pieces merge into one silhouette
    const ctx = st.ctx, cs = [];
    ctx.fillStyle = st.ink;
    for (const it of list) { const pts = it.pts || it, c = cw(pts); cs.push(c); const p = new Path2D(); crv(p, fatPts(c, st.lw, it.k || k), true); ctx.fill(p); }
    ctx.fillStyle = fill; for (const c of cs) { const p = new Path2D(); crv(p, c, true); ctx.fill(p); }
  }
  // a crescent inside a closed outline, along the edges facing `dir` (default: down and right, light from the top left).
  // w = widest; inset keeps it just inside the ink. No clipping (clips are slow): the band follows the outline points.
  const SHADE_DIR = [0.42, 0.91];
  function crescentPts(pts0, w, dir, inset, lo, hi) {
    const pts = cw(pts0), n = pts.length; if (n < 3 || !(w > 0)) return null;
    const dx = dir ? dir[0] : SHADE_DIR[0], dy = dir ? dir[1] : SHADE_DIR[1], N = [], F = [];
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = ty / l, ny = -tx / l;
      N.push([nx, ny]); F.push(sstep(lo == null ? 0.05 : lo, hi == null ? 0.7 : hi, nx * dx + ny * dy));
    }
    let i0 = 0; for (let i = 1; i < n; i++) if (F[i] < F[i0]) i0 = i;
    let first = -1, last = -1; for (let k = 0; k < n; k++) if (F[(i0 + k) % n] > 0.001) { if (first < 0) first = k; last = k; }
    if (first < 0) return null;
    const run = []; for (let k = Math.max(0, first - 1); k <= Math.min(n - 1, last + 1); k++) run.push((i0 + k) % n);
    const ins = inset == null ? 1 : inset, out = [];
    for (const i of run) out.push([pts[i][0] - N[i][0] * ins, pts[i][1] - N[i][1] * ins]);
    for (let k = run.length - 1; k >= 0; k--) { const i = run[k], d = ins + w * F[i]; out.push([pts[i][0] - N[i][0] * d, pts[i][1] - N[i][1] * d]); }
    return out;
  }
  function fillPts(st, pts, color) { if (st.flat || !pts) return; const p = new Path2D(); crv(p, pts, true); st.ctx.fillStyle = color; st.ctx.fill(p); }
  // a band between an edge (points) and the same edge moved inwards by w[i] along in[i]
  function bandPts(edge, inw, w, inset) {
    const out = [], ins = inset || 0;
    for (let i = 0; i < edge.length; i++) out.push([edge[i][0] + inw[i][0] * ins, edge[i][1] + inw[i][1] * ins]);
    for (let i = edge.length - 1; i >= 0; i--) out.push([edge[i][0] + inw[i][0] * (ins + w[i]), edge[i][1] + inw[i][1] * (ins + w[i])]);
    return out;
  }
  function finish(st, ctx) {
    if (st.flat) { ctx.fillStyle = SIL; ctx.fill(st.all); }
    ctx.restore();
  }
  function groundShadow(ctx, cx, w, k, sil) {
    if (k <= 0.01 || w <= 0) return;
    ctx.fillStyle = rgba(INK, 0.13 * k * (1 - 0.5 * (sil || 0)));
    ctx.beginPath(); ctx.ellipse(cx, 0, w * 0.85, w * 0.085 + 3, 0, 0, TAU); ctx.fill();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // faces: eyes with lids, brows, blinking, moods
  // auto blink: closed for ~0.16 s every 2.6-5 s (seeded)
  function blinkAt(t, seed) {
    const per = 3.1, u = t / per + (seed || 0) * 0.37, k = Math.floor(u), j = hash(k * 7 + (seed | 0) * 131) * 0.55, f = (u - k - j) * per;
    return f > 0 && f < 0.17 ? Math.sin(f / 0.17 * PI) : 0;
  }
  const MOODS = {
    happy: { lid: 0.04, low: 0, bUp: 0.1, bTilt: 0.05, smile: 1, pup: 0.58 },
    calm: { lid: 0.32, low: 0, bUp: 0, bTilt: 0, smile: 0.5, pup: 0.56 },
    surprised: { lid: 0, low: 0, bUp: 0.9, bTilt: 0, smile: -0.2, pup: 0.44, wide: 1, open: 0.18 },
    sleepy: { lid: 0.6, low: 0.05, bUp: -0.25, bTilt: -0.1, smile: 0.3, pup: 0.56 },
    sad: { lid: 0.28, low: 0, bUp: 0.25, bTilt: 0.55, smile: -0.8, pup: 0.6 }
  };
  const moodOf = o => MOODS[o.mood] || MOODS.happy;
  // eye at (x, y), radius r. e: {lid, low (0..1), lx, ly (-1..1), skin, iris, closed ('sleep' | 'happy'), pup, wide}
  function eye(st, x, y, r, e) {
    if (st.flat) return;
    const ctx = st.ctx, lw = st.lw, lid = clamp(e.lid || 0, 0, 1), low = clamp(e.low || 0, 0, 1);
    ctx.save(); if (st.det < 1) ctx.globalAlpha *= st.det;
    if (lid > 0.9 || lid + low > 1.15) {          // closed
      ctx.strokeStyle = st.ink; ctx.lineWidth = Math.max(lw * 1.05, r * 0.16); ctx.beginPath();
      if (e.closed === 'happy') { ctx.moveTo(x - r * 0.85, y + r * 0.25); ctx.quadraticCurveTo(x, y - r * 0.7, x + r * 0.85, y + r * 0.25); }
      else { ctx.moveTo(x - r * 0.9, y - r * 0.1); ctx.quadraticCurveTo(x, y + r * 0.62, x + r * 0.9, y - r * 0.1); }
      ctx.stroke();
      if (e.closed !== 'happy' && st.fine > 0.2) {   // two little lashes
        ctx.lineWidth = Math.max(lw * 0.6, r * 0.09); ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.12); ctx.lineTo(x - r * 0.8, y + r * 0.36); ctx.moveTo(x - r * 0.2, y + r * 0.24); ctx.lineTo(x - r * 0.28, y + r * 0.5); ctx.stroke();
      }
      ctx.restore(); return;
    }
    const rx = r * 0.9 * (e.wide ? 1.06 : 1), ry = r * (e.wide ? 1.1 : 1), eo = Math.min(lw * 0.475, rx * 0.3), rxi = Math.max(0.5, rx - eo + 0.6), ryi = Math.max(0.5, ry - eo + 0.6);
    ctx.beginPath(); ctx.ellipse(x, y, rx + eo, ry + eo, 0, 0, TAU); ctx.fillStyle = st.ink; ctx.fill();          // the outline ring
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.3, rx - eo), Math.max(0.3, ry - eo), 0, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    // pupil (kept inside the white by the limits on its travel), iris ring, catchlights
    const px = x + clamp(e.lx || 0, -1, 1) * rx * 0.34, py = y + clamp(e.ly || 0, -1, 1) * ry * 0.3 + r * 0.04, pr = r * Math.min(0.6, e.pup || 0.56);
    if (e.iris && st.fine > 0.3) { ctx.fillStyle = e.iris; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, pr * 0.66, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(px - pr * 0.34, py - pr * 0.36, pr * 0.36, 0, TAU);
    if (r * st.s > 6) { ctx.moveTo(px + pr * 0.49, py + pr * 0.34); ctx.arc(px + pr * 0.34, py + pr * 0.34, pr * 0.15, 0, TAU); }
    ctx.fill();
    // lids: the part of the eye above (or below) a gently curved lid line, in skin colour
    ctx.strokeStyle = st.ink;
    if (lid > 0.01) {
      const k = clamp(-1 + 2 * lid, -0.999, 0.999), a0 = Math.asin(k), yl = y + k * ryi, xr = rxi * Math.cos(a0);
      ctx.fillStyle = e.skin; ctx.beginPath(); ctx.ellipse(x, y, rxi, ryi, 0, PI - a0, TAU + a0); ctx.quadraticCurveTo(x, yl + ry * 0.28, x - xr, yl); ctx.closePath(); ctx.fill();
      ctx.lineWidth = lw * 0.9; ctx.beginPath(); ctx.moveTo(x - xr, yl); ctx.quadraticCurveTo(x, yl + ry * 0.28, x + xr, yl); ctx.stroke();
    }
    if (low > 0.01) {
      const k = clamp(1 - 1.6 * low, -0.999, 0.999), a0 = Math.asin(k), yl = y + k * ryi, xr = rxi * Math.cos(a0);
      ctx.fillStyle = e.skin; ctx.beginPath(); ctx.ellipse(x, y, rxi, ryi, 0, a0, PI - a0); ctx.quadraticCurveTo(x, yl - ry * 0.25, x + xr, yl); ctx.closePath(); ctx.fill();
      ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(x - xr, yl); ctx.quadraticCurveTo(x, yl - ry * 0.25, x + xr, yl); ctx.stroke();
    }
    ctx.restore();
  }
  // a brow above an eye at (x, y) radius r: up raises it, tilt lifts its front end (sad / worried)
  function brow(st, x, y, r, up, tilt, col, w) {
    if (st.flat || st.det < 0.05) return; const ctx = st.ctx;
    ctx.save(); if (st.det < 1) ctx.globalAlpha *= st.det;
    const yb = y - r * (1.18 + 0.32 * up), x0 = x - r * 0.72, x1 = x + r * 0.62, y0 = yb + r * 0.1 * (1 - tilt), y1 = yb - r * 0.06 - r * 0.42 * tilt;
    ctx.strokeStyle = col; ctx.lineWidth = w || r * 0.24; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - r * (0.18 + 0.18 * up), x1, y1); ctx.stroke();
    ctx.restore();
  }
  // the deterministic idle 'look around' of a head when the caller gives no look: mostly forward, sometimes up or back
  function idleLook(t, seed) { return { x: 0.35 + 0.45 * wob(t * 0.55, seed + 1), y: 0.15 * wob(t * 0.4, seed + 7) }; }
  function lookOf(o, t, seed) {
    const l = o.look; if (l == null) return idleLook(t, seed);
    if (typeof l === 'number') return { x: clamp(l, -1, 1), y: 0 };
    return { x: clamp(l.x || 0, -1, 1), y: clamp(l.y || 0, -1, 1) };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // gaits. phase: o.phase (0..1) if given, else o.dist (on-screen distance walked) / (stride * s), else t * rate * speed
  function phaseOf(o, t, g, s) {
    if (o.phase != null) return frac(+o.phase || 0);
    if (o.dist != null) return frac(Math.abs(+o.dist || 0) / Math.max(1e-6, g.stride * s));
    return frac(t * g.rate * (o.speed == null ? 1 : +o.speed || 0) + hash((o.seed | 0) + 3) );
  }
  // one biped foot: x relative to the neutral point, height of the lift, stance flag, progress u of the current stance / swing
  function bipedFoot(p, g) {
    const c = g.stride * g.duty;
    if (p < g.duty) { const u = p / g.duty; return { x: c * (0.5 - u), y: 0, st: true, u }; }
    const u = (p - g.duty) / (1 - g.duty), e = ease(u);
    return { x: c * (e - 0.5), y: -g.lift * Math.sin(PI * Math.pow(u, 0.85)), st: false, u };
  }

  // =================================================================================================================
  // T. REX: big friendly meat-eater. Local frame: ground at y = 0 under the feet, facing +x. s = 1: about 420 tall, 820 long.
  // =================================================================================================================
  const REX_DEF = { body: '#6BBF59', belly: '#CDE8A0', claw: '#F4EAD6', mouth: '#8E3346', tongue: '#F27C97', cheek: '#FFA3B5', iris: '#8A5A2B' };
  const RX = { Lf: 106, Lt: 110, Lm: 58, ball: 15, H: 420, center: [56, -212] };
  const REX_GAIT = { walk: { stride: 290, duty: 0.62, lift: 44, rate: 0.74 }, run: { stride: 540, duty: 0.38, lift: 86, rate: 1.45 } };
  const REX_POSES = ['idle', 'walk', 'run', 'roar', 'lie', 'lookUp'];
  // the pose as numbers (so poses blend): hip, pitch, tail, neck (three segment angles), head, jaw, arms, feet, eyes
  function rexBase() {
    return { hx: 0, hy: -238, pitch: 0, br: 0, tR: 0.06, tC: -0.014, tW: 0.05, tP: 0, n0: -0.5, n1: -0.85, n2: -0.42, hA: 0.06, jaw: 0, arm: 0,
      nX: 36, nY: 0, nP: 0.5, nT: 0, fX: -22, fY: 0, fP: 0.55, fT: 0, lie: 0, lid: -1, low: -1, closed: 0, eyeY: 0 };
  }
  function rexParams(pose, t, o, s) {
    const q = rexBase(), sd = o.seed || 0, br = Math.sin(t * 2.1 + sd);
    q.br = br; q.tP = t * 1.7 + sd; q.hy += br * 2; q.hA += br * 0.012;
    if (pose === 'walk' || pose === 'run') {
      const run = pose === 'run', g = REX_GAIT[pose], p = phaseOf(o, t, g, s);
      const fn = bipedFoot(p, g), ff = bipedFoot(frac(p + 0.5), g), nx0 = run ? 34 : 18;
      q.nX = nx0 + fn.x; q.nY = fn.y; q.fX = nx0 - 12 + ff.x; q.fY = ff.y;
      // the ankle: the heel rises at the end of the stance, the foot swings through with the toes hanging
      const ankle = f => f.st ? 0.42 + 0.6 * sstep(0.5, 1, f.u) : lerp(1.02, 0.32, sstep(0, 0.5, f.u));
      const toe = f => f.st ? 0 : 0.75 * Math.sin(PI * Math.min(1, f.u * 1.1));
      q.nP = ankle(fn); q.fP = ankle(ff); q.nT = toe(fn); q.fT = toe(ff);
      const bob = (run ? 12 : 6) * Math.cos(4 * PI * (p - (run ? 0.2 : 0.1)));
      q.hy = (run ? -244 : -238) + bob;
      q.pitch = (run ? 0.15 : 0.02) + (run ? 0.025 : 0.012) * Math.sin(4 * PI * p);
      q.hA = (run ? 0.1 : 0.06) + 0.04 * Math.cos(4 * PI * (p - 0.25));
      if (run) { q.n0 = -0.28; q.n1 = -0.52; q.n2 = -0.2; }
      q.n1 += 0.05 * Math.cos(4 * PI * (p - 0.2));
      q.tR = run ? -0.07 : 0.06; q.tW = run ? 0.05 : 0.07; q.tP = 4 * PI * p + sd;
      q.arm = (run ? 0.55 : 0.3) * Math.sin(TAU * p); q.jaw = run ? 0.18 : 0;
    } else if (pose === 'roar') {
      // anticipation (head back and down), the big happy ROAR (head up, mouth wide, eyes squeezed shut), settle
      const per = 3.2, u = o.phase != null ? frac(+o.phase || 0) : frac(t / per + sd * 0.13);
      const a = sstep(0, 0.18, u) * (1 - sstep(0.22, 0.32, u)), r = sstep(0.22, 0.34, u) * (1 - sstep(0.8, 0.97, u));
      const shake = r * Math.sin(t * 40) * 0.014;
      q.pitch = -0.03 * a - 0.07 * r; q.hx = -10 * a + 4 * r; q.hy += 8 * a - 4 * r;
      q.n0 += 0.12 * a - 0.18 * r; q.n1 += 0.15 * a - 0.25 * r; q.n2 += 0.1 * a - 0.2 * r;
      q.hA = 0.06 + 0.16 * a - 0.34 * r + shake; q.jaw = 0.1 * a + r;
      q.tR = 0.06 + 0.1 * r; q.tW = 0.03 + 0.05 * r; q.arm = -0.3 * r + 0.2 * a; q.closed = r > 0.45 ? 2 : 0;
    } else if (pose === 'lie') {
      q.hy = -76 + br * 2.2; q.pitch = 0.03; q.lie = 1;
      q.nX = 56; q.nY = 0; q.nP = 1.45; q.nT = 0; q.fX = 34; q.fY = 0; q.fP = 1.45; q.fT = 0;
      q.tR = -0.26; q.tC = 0.045; q.tW = 0.012; q.n0 = 0.35; q.n1 = 0.5; q.n2 = 0.28; q.hA = 0.1 + br * 0.008; q.jaw = 0; q.arm = 0; q.closed = 1;
    } else if (pose === 'lookUp') {
      q.pitch = -0.07; q.n0 = -0.85; q.n1 = -1.25; q.n2 = -1.0; q.hA = -0.62; q.jaw = 0.16; q.eyeY = -1; q.tR = 0.0; q.hy -= 4;
    }
    return q;
  }
  function blendParams(a, b, k) { if (k >= 1) return b; if (k <= 0) return a; const o = {}; for (const key in b) o[key] = typeof b[key] === 'number' && typeof a[key] === 'number' ? lerp(a[key], b[key], k) : b[key]; return o; }
  function poseName(o, list) { return list.indexOf(o.pose) >= 0 ? o.pose : list[0]; }
  function rexQ(o, t, s) {
    const pose = poseName(o, REX_POSES); let q = rexParams(pose, t, o, s);
    if (o.amount != null && +o.amount < 1) { const from = rexParams(poseName({ pose: o.from || 'idle' }, REX_POSES), t, o, s); q = blendParams(from, q, ease(clamp(+o.amount || 0, 0, 1))); }
    if (o.mouth != null) q.jaw = clamp(+o.mouth, 0, 1);
    return q;
  }
  // the rig: feet first (the hip comes down if a planted foot could not reach), then the spine, head, legs (IK) and arms
  const REX_TAIL_L = [54, 52, 49, 46, 42, 38, 34];
  function rexRig(q, look) {
    const foot = (bx, by, phi) => { const ball = [bx, -RX.ball + by]; return { ball, A: [ball[0] - Math.sin(phi) * RX.Lm, ball[1] - Math.cos(phi) * RX.Lm] }; };
    const fF = foot(q.fX, q.fY, q.fP), fN = foot(q.nX, q.nY, q.nP);
    const reach = (RX.Lf + RX.Lt) * 0.97;
    let hy = q.hy;
    for (const [f, by, ox] of [[fF, q.fY, -10], [fN, q.nY, 0]]) if (by > -6) { const dx = f.A[0] - (q.hx + ox); if (Math.abs(dx) < reach) hy = Math.max(hy, f.A[1] - Math.sqrt(reach * reach - dx * dx)); }
    q = Object.assign({}, q, { hy });
    const c = Math.cos(q.pitch), sn = Math.sin(q.pitch);
    const B = (dx, dy) => [q.hx + dx * c - dy * sn, q.hy + dx * sn + dy * c];
    const sac = B(-6, -40), back = B(74, -46), sh = B(148, -42);
    const tail = []; let p = sac;
    for (let k = 0; k < REX_TAIL_L.length; k++) {
      const a = PI + q.pitch * 0.6 + q.tR + q.tC * k + q.tW * Math.sin(q.tP - k * 0.6) * (k + 1) / 5;
      p = [p[0] + Math.cos(a) * REX_TAIL_L[k], p[1] + Math.sin(a) * REX_TAIL_L[k]]; tail.push(p);
    }
    const neck = []; p = sh; const nA = [q.n0, q.n1, q.n2], nL = [34, 30, 28], lk = look.y * 0.12;
    for (let k = 0; k < 3; k++) { const a = q.pitch + nA[k] + lk * (k + 1); p = [p[0] + Math.cos(a) * nL[k], p[1] + Math.sin(a) * nL[k]]; neck.push(p); }
    const sp = tail.slice().reverse().concat([sac, back, sh], neck);
    const brk = 1 + 0.025 * q.br;
    const d = [7, 11, 16, 21, 26, 31, 35, 38, 42, 40, 37, 35, 34];
    const v = [7, 11, 17, 24, 33, 44, 57, 74, 116 * brk, 112 * brk, 98, 82, 68];
    const head = { x: neck[2][0], y: neck[2][1], a: q.pitch * 0.3 + q.hA + look.y * 0.2 };
    const leg = (f, toe, far) => { const H = far ? [q.hx - 10, q.hy - 4] : [q.hx, q.hy]; return { H, K: ik(H, f.A, RX.Lf, RX.Lt, 1), A: f.A, ball: f.ball, toe, far }; };
    const legs = [leg(fF, q.fT, true), leg(fN, q.nT, false)];
    const arm = far => {
      const S = B(far ? 146 : 152, far ? 40 : 46), a1 = 1.2 + q.arm * 0.6 - q.pitch * 0.5 - q.lie * 1.0, E = add(S, dirv(a1), 30), a2 = 0.25 + q.arm * 0.5 - q.pitch * 0.5 - q.lie * 1.2, W = add(E, dirv(a2), 22);
      return { S, E, W, a2 };
    };
    return { q, sp, d, v, sac, back, sh, tail, neck, head, legs, arms: [arm(true), arm(false)], B };
  }
  // head shapes (head-local: origin at the back of the skull where the neck joins, +x along the head)
  const REX_HEAD = [[-44, -34], [-22, -76], [24, -100], [62, -108], [100, -98], [138, -86], [180, -72], [214, -54], [236, -30], [240, -4], [230, 18], [184, 27], [124, 31], [64, 33], [22, 38], [-18, 38], [-46, 12]];
  const REX_JAW = [[-22, 22], [50, 27], [130, 29], [192, 29], [224, 31], [232, 44], [220, 58], [164, 66], [96, 70], [34, 66], [-6, 56], [-22, 40]];
  const REX_JAW_TOP = [[226, 31], [192, 29], [130, 29], [62, 28], [12, 26]];
  const REX_UPPER = [[12, 34], [64, 33], [124, 31], [184, 27], [230, 18]];
  const RXJ = [0, 28], RXHS = 0.9;   // jaw hinge; head scale
  const RX_EYE = [72, -46, 33];
  function headXf(ctx, h) { ctx.translate(h.x, h.y); ctx.rotate(h.a); ctx.scale(RXHS, RXHS); }
  const jawPt = (pt, a) => { const r = rot(pt[0] - RXJ[0], pt[1] - RXJ[1], a); return [RXJ[0] + r[0], RXJ[1] + r[1]]; };

  const REX_FOOT = [[-18, -10], [6, -15], [30, -17], [50, -18], [62, -13], [50, -5], [70, -8], [90, -3], [86, 6], [70, 8], [80, 12], [68, 16], [28, 16], [-8, 16], [-20, 6]];
  function rexLegPts(L_) {
    const H = L_.H, K = L_.K, A = L_.A, Bl = L_.ball;
    const thigh = limbPts([H[0] - 12, H[1] - 12], 58, K, 29, 0.16, 0.1);
    const calf = [lerp(K[0], A[0], 0.3) - 6, lerp(K[1], A[1], 0.3)];
    const lower = chainPts([K, calf, A, Bl], [26, 24, 16, 14]);
    // the foot: far, middle and near toe as one outline, claws on the toe tips (in the frame of the toe angle)
    const ta = L_.toe, T = (x, y) => { const r = rot(x, y, ta); return [Bl[0] + r[0], Bl[1] + r[1]]; };
    const foot = REX_FOOT.map(q => T(q[0], q[1]));
    const tips = [[4, -0.15], [7, 0.05], [10, 0.3]].map(([i, a]) => ({ tip: bsp(foot, i), ang: ta + a }));
    return { thigh, lower, foot, tips };
  }
  // claws: one path for several (no two overlap), so one stroke and one fill
  // claws: p is a Path2D, or an array that collects claws for claws() (outlined by an ink fill: cheaper than a stroke)
  function clawPath(p, x, y, a, len, w) {
    if (Array.isArray(p)) { p.push([x, y, a, len, w]); return; }
    const c = Math.cos(a), s = Math.sin(a);
    p.moveTo(x - s * w, y + c * w); p.quadraticCurveTo(x + c * len * 0.7 - s * w * 0.6, y + s * len * 0.7 + c * w * 0.6, x + c * len, y + s * len + w * 0.35);
    p.quadraticCurveTo(x + c * len * 0.6 + s * w * 0.5, y + s * len * 0.6 - c * w * 0.9, x + s * w, y - c * w); p.closePath();
  }
  function claws(st, p, col) {
    if (st.flat) return; const ctx = st.ctx;
    if (Array.isArray(p)) {
      if (!p.length) return;
      const e = st.lw * 0.7, ink = new Path2D(), fill = new Path2D();
      for (const [x, y, a, len, w] of p) { const c = Math.cos(a), s = Math.sin(a); clawPath(ink, x - c * e * 0.6, y - s * e * 0.6, a, len + e * 1.25, w + e * 0.95); clawPath(fill, x, y, a, len, w); }
      ctx.fillStyle = st.ink; ctx.fill(ink); ctx.fillStyle = col; ctx.fill(fill); return;
    }
    ctx.lineWidth = st.lw * 1.4; ctx.strokeStyle = st.ink; ctx.stroke(p); ctx.fillStyle = col; ctx.fill(p);
  }
  function pathOf(pts) { const p = new Path2D(); closedPath(p, pts); return p; }
  // the far side (arm and leg in a darker colour) or the near side (thigh melting into the body, lower leg, foot, arm)
  function rexLimbs(st, R, pal, far, shadeP) {
    const ctx = st.ctx, L_ = R.legs[far ? 0 : 1], A_ = R.arms[far ? 0 : 1], P_ = rexLegPts(L_), cp = st.lod ? [] : null;
    if (cp) { for (const c of P_.tips) { const x0 = c.tip[0] - Math.cos(c.ang) * 3, y0 = c.tip[1] - Math.sin(c.ang) * 3; let a = c.ang + 0.2; if (y0 + Math.sin(a) * 15 + 2 > -0.5) a = Math.asin(clamp((-2.5 - y0) / 15, -1, 1)); clawPath(cp, x0, y0, a, 15, 5.5); } for (const da of [-0.12, 0.26]) clawPath(cp, A_.W[0] + Math.cos(A_.a2) * 4, A_.W[1] + Math.sin(A_.a2) * 4, A_.a2 + da + 0.5, 10, 3.8); }
    const arm = chainPts([A_.S, A_.E, A_.W], [12, 8.5, 7]), H = L_.H;
    if (far) { partPts(st, [P_.thigh, P_.lower, P_.foot, arm], pal.far); if (cp) claws(st, cp, dk(pal.claw, 0.12)); return; }
    partPts(st, [P_.lower, P_.foot, { pts: P_.thigh, k: (i, p) => sstep(H[1] - 30, H[1] + 4, p[1]) }, arm], pal.body);   // the thigh's top melts into the body
    if (st.flat || st.lod === 0) return cp;
    for (const [pts, w] of [[P_.thigh, 14], [P_.lower, 8]]) { const c = crescentPts(pts, w, null, st.lw * 0.25); if (c) shadeP.push(c); }
    if (st.lod === 2) {
      ctx.fillStyle = rgba(pal.dot, 0.6 * st.tex); const r = L.rng(11); ctx.beginPath();     // scale dots on the thigh
      for (let i = 0; i < 8; i++) { const px = H[0] - 40 + r() * 64, py = H[1] + 6 + r() * 64, rr = 3 + r() * 4; ctx.moveTo(px + rr, py); ctx.arc(px, py, rr, 0, TAU); }
      ctx.fill();
      ctx.strokeStyle = rgba(pal.shade, 0.55 * st.tex); ctx.lineWidth = 3; const A = L_.A, Bl = L_.ball, a = Math.atan2(Bl[1] - A[1], Bl[0] - A[0]) + PI / 2;   // scaly bands on the foot
      ctx.beginPath(); for (let i = 1; i <= 3; i++) { const f = i / 4, x = lerp(A[0], Bl[0], f), y = lerp(A[1], Bl[1], f); ctx.moveTo(x - Math.cos(a) * 11, y - Math.sin(a) * 11); ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); } ctx.stroke();
    }
    return cp;
  }
  function rexPal(o, sil) {
    const pal = palette(REX_DEF, o.colors, sil);
    pal.shade = dk(pal.body, 0.22); pal.far = dk(pal.body, 0.2); pal.farShade = dk(pal.body, 0.34); pal.stripe = dk(pal.body, 0.12); pal.dot = lt(pal.body, 0.35);
    pal.bellyShade = mix(pal.belly, pal.body, 0.45); pal.lid = pal.body; pal.brow = dk(pal.body, 0.32);
    return pal;
  }

  function rex(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, RX.H, RX.center), pal = rexPal(o, st.sil), m = moodOf(o);
    const lk = lookOf(o, t, st.seed), q = rexQ(o, t, s), R = rexRig(q, q.lie > 0.5 ? { x: 0, y: 0 } : lk);
    if (o.shadow !== false) groundShadow(ctx, 20, 320 + 60 * q.lie, o.shadow == null ? 1 : +o.shadow, st.sil);
    rexSkin(st, R, pal, m, lk, t, o);
    if (o.xray > 0 && !st.flat) rexXray(st, R, o, t);
    finish(st, ctx);
  }
  function rexBody(R) { return tube(R.sp, R.d, R.v, 5, 0, R.q.lie > 0.5 ? -1 : 0); }
  function rexHeadPath(R) {
    const h = R.head, c = Math.cos(h.a) * RXHS, sn = Math.sin(h.a) * RXHS;
    const W = pt => [h.x + pt[0] * c - pt[1] * sn, h.y + pt[0] * sn + pt[1] * c];
    const ja = R.q.jaw * 0.62, g = R.q.lie > 0.5;
    const cl = pts => g ? pts.map(q => [q[0], Math.min(q[1], -1)]) : pts;
    const upPts = cl(REX_HEAD.map(W)), jawPts = cl(REX_JAW.map(pt => W(jawPt(pt, ja))));
    const mouth = new Path2D(); closedPath(mouth, REX_UPPER.map(W).concat(REX_JAW_TOP.map(pt => W(jawPt(pt, ja)))));
    return { upPts, jawPts, up: pathOf(upPts), jaw: pathOf(jawPts), mouth, W, ja };
  }
  const REX_JAW_BELLY = [[34, 66], [96, 70], [164, 66], [220, 58], [232, 44], [214, 45], [164, 52], [96, 55], [40, 52]];
  function rexSkin(st, R, pal, m, lk, t, o) {
    const ctx = st.ctx, q = R.q;
    rexLimbs(st, R, pal, true, null);
    // inside of the mouth and tongue, then the lower jaw: all behind the head
    const H = rexHeadPath(R);
    if (q.jaw > 0.02 && !st.flat) {
      ctx.fillStyle = pal.mouth; ctx.fill(H.mouth);
      const a = H.W(jawPt([166, 22], H.ja)), b = H.W(jawPt([62, 18], H.ja)), ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
      ctx.fillStyle = pal.tongue; ctx.beginPath(); ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 64 * RXHS, 20 * RXHS, ang, 0, TAU); ctx.fill();
    }
    partPts(st, [H.jawPts], pal.body);
    // body, tail, neck and head as one silhouette
    const T = rexBody(R);
    partPts(st, [T.out, H.upPts], pal.body);
    const shadeP = [];
    if (!st.flat && st.det > 0.03) {
      const n = R.sp.length, up = T.up, bot = T.bot, sp = R.sp, ins = st.lw * 0.25;
      // the lighter belly band (tail to throat, and under the chin) and its shadow; the shadow under the tail
      shadeP.push(bandPts(bot.slice(0, 5), up.slice(0, 5), [0, 4, 6, 8, 9], ins));
      const i0 = 2, kb = [1, 1, 1, 0.86, 0.72, 0.64, 0.6, 0.56, 0.5, 0.5, 0.44, 0.4, 0.4], wB = [0, 4, 6, 8, 10, 12, 14, 16, 19, 19, 15, 9, 0];
      const bel = []; for (let i = i0; i < n; i++) bel.push([bot[i][0] + up[i][0] * ins, bot[i][1] + up[i][1] * ins]);
      for (let i = n - 1; i >= i0; i--) bel.push([sp[i][0] - up[i][0] * R.v[i] * kb[i], sp[i][1] - up[i][1] * R.v[i] * kb[i]]);
      fillPts(st, bel, pal.belly); fillPts(st, cw(REX_JAW_BELLY.map(pt => H.W(jawPt(pt, H.ja)))), pal.belly);
      fillPts(st, bandPts(bot.slice(4, n - 1), up.slice(4, n - 1), wB.slice(4, n - 1).map((w, j) => w * 0.85 * (j ? 1 : 0)), ins), pal.bellyShade);
      // soft stripes across the back and tail (they stop just inside the top edge)
      ctx.fillStyle = pal.stripe; ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const u = 0.15 + k * 0.088, P_ = along(sp, u), i = Math.min(n - 2, P_.i), f = P_.f, U = [lerp(up[i][0], up[i + 1][0], f), lerp(up[i][1], up[i + 1][1], f)];
        const dd = lerp(R.d[i], R.d[i + 1], f), vv = lerp(R.v[i], R.v[i + 1], f), w = 7 + 6 * Math.sin(u * PI), tx = -U[1], ty = U[0];
        const top = [P_.x + U[0] * (dd - 3), P_.y + U[1] * (dd - 3)], bt = [P_.x - U[0] * vv * 0.28 - tx * 8, P_.y - U[1] * vv * 0.28 - ty * 8];
        crv(ctx, [[top[0] - tx * w, top[1] - ty * w], [top[0] + tx * w, top[1] + ty * w], [lerp(top[0], bt[0], 0.55) + tx * w * 0.5, lerp(top[1], bt[1], 0.55) + ty * w * 0.5], bt, [lerp(top[0], bt[0], 0.5) - tx * w * 0.6, lerp(top[1], bt[1], 0.5) - ty * w * 0.6]], true);
      }
      ctx.fill();
      if (st.tex > 0.02) {
        ctx.fillStyle = rgba(pal.dot, 0.5 * st.tex); ctx.beginPath(); const r = L.rng(5);
        for (let k = 0; k < 12; k++) { const u = 0.08 + r() * 0.78, P_ = along(sp, u), i = Math.min(n - 1, P_.i), dep = R.d[i] * 0.2 + r() * R.v[i] * 0.35, rr = 2.5 + r() * 3, x = P_.x - up[i][0] * dep, y = P_.y - up[i][1] * dep; ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU); }
        ctx.fill();
        ctx.fillStyle = rgba(pal.bellyShade, 0.55 * st.tex); ctx.beginPath();     // belly lines (thin lens shapes: fills are cheaper than strokes)
        for (let k = 0; k < 9; k++) { const u = 0.36 + k * 0.05, P_ = along(sp, u), i = Math.min(n - 1, P_.i), U = up[i], vv = lerp(R.v[i], R.v[Math.min(n - 1, i + 1)], P_.f); const x0 = P_.x - U[0] * vv * 0.58, y0 = P_.y - U[1] * vv * 0.58, x1 = x0 - U[0] * vv * 0.32, y1 = y0 - U[1] * vv * 0.32, cx = x0 - U[0] * vv * 0.16 + 5, cy = y0 - U[1] * vv * 0.16; ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx + 2.2, cy, x1, y1); ctx.quadraticCurveTo(cx - 2.2, cy, x0, y0); }
        ctx.fill();
      }
      // a soft highlight along the back; the shadow under the upper jaw
      const hl = [], hb = []; for (let i = 4; i < n - 2; i++) { const w = i === 4 || i === n - 3 ? 1.5 : 6; hl.push([sp[i][0] + up[i][0] * (R.d[i] - 13 + w), sp[i][1] + up[i][1] * (R.d[i] - 13 + w)]); hb.push([sp[i][0] + up[i][0] * (R.d[i] - 13 - w), sp[i][1] + up[i][1] * (R.d[i] - 13 - w)]); }
      fillPts(st, hl.concat(hb.reverse()), 'rgba(255,255,255,0.22)');
      const hc = crescentPts(H.upPts, 10, null, ins, 0.3, 0.9); if (hc) shadeP.push(hc);
      rexHeadDetails(st, R, H, pal, m, lk, t, o);
    }
    // near side: leg and arm, then all the shadow crescents in one fill, then the claws
    const cpN = rexLimbs(st, R, pal, false, shadeP);
    if (!st.flat && st.det > 0.03) { for (const c of shadeP) fillPts(st, c, pal.shade); if (cpN) claws(st, cpN, pal.claw); }
  }
  // small rounded teeth along a jaw edge (dir 1 hangs down from the upper jaw, -1 stands up on the lower jaw, which turns by ja)
  function rexTeeth(ctx, st, lw, xs, y0, dir, ja) {
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = st.ink; ctx.lineWidth = lw * 0.55;
    for (const tx of xs) {
      const y = y0 - (dir > 0 && tx > 200 ? 4 : 0), pts = [[tx - 8, y - dir * 3], [tx, y + dir * 13], [tx + 8, y - dir * 3]].map(p => ja == null ? p : jawPt(p, ja));
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.quadraticCurveTo(pts[1][0] + (pts[1][0] - (pts[0][0] + pts[2][0]) / 2) * 0.3, pts[1][1] + (pts[1][1] - (pts[0][1] + pts[2][1]) / 2) * 0.3, pts[2][0], pts[2][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  function rexHeadDetails(st, R, H, pal, m, lk, t, o) {
    const ctx = st.ctx, q = R.q, h = R.head, E_ = RX_EYE, lw = st.lw / RXHS;
    ctx.save(); headXf(ctx, h);
    if (st.det > 0.05 && m.smile > 0) { ctx.fillStyle = rgba(pal.cheek, 0.72 * st.det * Math.min(1, m.smile)); ctx.beginPath(); ctx.ellipse(70, 2, 20, 10, -0.1, 0, TAU); ctx.fill(); }
    ctx.fillStyle = st.ink; ctx.beginPath(); ctx.ellipse(214, -30, 7, 4.2, -0.5, 0, TAU); ctx.fill();
    const sm = m.smile;
    if (q.jaw < 0.05) {
      if (st.det > 0.1) rexTeeth(ctx, st, lw, [204, 176], 26, 1, null);
      ctx.strokeStyle = st.ink; ctx.lineWidth = lw * 1.1; ctx.beginPath(); ctx.moveTo(52, 33); ctx.quadraticCurveTo(26, 36 - sm * 2, 12, 26 - sm * 12); ctx.stroke();
    } else if (st.det > 0.1) {
      rexTeeth(ctx, st, lw, q.jaw < 0.35 ? [210, 182] : [212, 186, 160, 134], 28, 1, null);
      if (q.jaw >= 0.35) rexTeeth(ctx, st, lw, [196, 168, 140], 31, -1, H.ja);
    }
    const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed);
    if (q.closed === 2) eye(st, E_[0], E_[1], E_[2], { lid: 1, closed: 'happy' });
    else {
      const lid = q.closed === 1 ? 1 : Math.max(q.lid >= 0 ? q.lid : m.lid, blink);
      eye(st, E_[0], E_[1], E_[2], { lid, low: m.low, lx: lk.x * 0.9, ly: clamp(lk.y + q.eyeY * 0.8, -1, 1), skin: pal.lid, iris: pal.iris, closed: 'sleep', pup: m.pup, wide: m.wide });
    }
    brow(st, E_[0], E_[1], E_[2], m.bUp + (q.closed === 2 ? 0.25 : 0) + (q.eyeY < 0 ? 0.35 : 0), m.bTilt, pal.brow, 11);
    ctx.restore();
  }

  // ----- rex skeleton (the same rig as bones) -----
  const BONE = '#EDE3D1', BONE_D = '#CFC2A8', STONE = '#C8B9A6', STONE_D = '#8C7B6B';
  function bonePal(o, sil) {
    const f = clamp(+o.fossil || 0, 0, 1);
    const p = { bone: mix(BONE, '#D6C8B3', f), boneD: mix(BONE_D, STONE_D, f * 0.7), ink: mix(INK, '#6E5E50', f), hole: mix('#8A7563', '#9A8878', f) };
    if (sil > 0) for (const k in p) p[k] = mix(p[k], SIL, sil);
    return p;
  }
  // a bone from A to B with knobby ends (r0, r1 = half thickness at the ends, k = knob size factor)
  function bonePts(A, B, r0, r1, k) {
    const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux, kk = k == null ? 1.45 : k;
    const P_ = (p, a, b) => [p[0] + ux * a + nx * b, p[1] + uy * a + ny * b];
    return [P_(A, -r0 * 0.9, r0 * kk * 0.55), P_(A, -r0 * 0.3, r0 * kk), P_(A, r0 * 1.1, r0), P_(B, -r1 * 1.1, r1), P_(B, r1 * 0.3, r1 * kk), P_(B, r1 * 0.9, r1 * kk * 0.55),
      P_(B, r1 * 0.9, -r1 * kk * 0.55), P_(B, r1 * 0.3, -r1 * kk), P_(B, -r1 * 1.1, -r1), P_(A, r0 * 1.1, -r0), P_(A, -r0 * 0.3, -r0 * kk), P_(A, -r0 * 0.9, -r0 * kk * 0.55)];
  }
  // bones: each bone is one closed outline (a point list, smoothed). A layer of bones = one ink fill (every outline grown
  // by the line width) and one bone-coloured fill: bones of one layer that touch join up, a later layer overlaps cleanly.
  function boneLayer(st, list, bp, far) {
    if (!list.length) return;
    if (st.flat) { for (const pts of list) crv(st.all, cw(pts), true); return; }
    const ctx = st.ctx, ink = new Path2D(), fill = new Path2D(), d = Math.max(st.lw * 0.62, 2.4 / st.s);
    for (const p0 of list) { const pts = cw(p0); crv(ink, fatPts(pts, d), true); crv(fill, pts, true); }
    ctx.fillStyle = bp.ink; ctx.fill(ink); ctx.fillStyle = far ? bp.boneD : bp.bone; ctx.fill(fill);
  }
  // a run of vertebrae as ONE outline (much cheaper to fill than separate bones): a pinched waist between vertebrae, a
  // rounded spine on top and a chevron below where given. vs = [{at (distance along the spine), cl, ch, sl, tilt, cv}],
  // tail end first. Returns {pts, seps}: seps = thin quads across the waists (drawn in ink over the bone colour).
  function columnPts(S, vs) {
    const top = [], bot = [], seps = [], n = vs.length;
    const fr = v => { const F = S.at(v.at); return (a, b) => [F.P[0] + F.tg[0] * a + F.up[0] * b, F.P[1] + F.tg[1] * a + F.up[1] * b]; };
    for (let k = 0; k < n; k++) {
      const v = vs[k], V = fr(v), w = v.cl * (v.sw || 0.5);
      if (k === 0) top.push(V(-v.cl * 1.15, 0));
      else {
        const u = vs[k - 1], W = fr({ at: (u.at + v.at) / 2 }), hw = 0.6 * Math.min(u.ch, v.ch);
        const t1 = W(0, hw), b1 = W(0, -hw); top.push(t1); bot.push(b1);
        if (v.sep !== false) { const e = W(-1.1, 0), f = W(1.1, 0), dx = f[0] - e[0], dy = f[1] - e[1]; seps.push([[t1[0] - dx, t1[1] - dy], [t1[0] + dx, t1[1] + dy], [b1[0] + dx, b1[1] + dy], [b1[0] - dx, b1[1] - dy]]); }
      }
      if (v.sl > 3) { const bx = -v.sl * v.tilt; top.push(V(-w * 1.15, v.ch), V(bx - w * 0.5, v.ch + v.sl * 1.06), V(bx + w * 0.5, v.ch + v.sl * 1.06), V(w * 1.05, v.ch)); }
      else top.push(V(-v.cl * 0.55, v.ch), V(v.cl * 0.55, v.ch));
      const bb = [];
      if (v.cv > 3) { const bx = -v.cv * v.tilt * 1.4; bb.push(V(w, -v.ch), V(bx, -v.ch - v.cv * 1.25), V(-w * 1.1, -v.ch)); }
      else bb.push(V(v.cl * 0.55, -v.ch), V(-v.cl * 0.55, -v.ch));
      bot.push(bb);
      if (k === n - 1) top.push(V(v.cl * 1.15, 0));
    }
    // bottom edge: back from the head end (the waists and each vertebra's points, reversed)
    const B = []; for (let k = n - 1; k >= 0; k--) { const it = bot[k * 2]; if (Array.isArray(it[0])) B.push(...it); else B.push(it); if (k > 0) B.push(bot[k * 2 - 1]); }
    return { pts: top.concat(B), seps };
  }
  // a simple rod (6 points, smoothed: a long oval tapering from r0 to r1)
  function rodPts(A, B, r0, r1) {
    const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    return [[A[0] - ux * r0, A[1] - uy * r0], [A[0] + nx * r0, A[1] + ny * r0], [B[0] + nx * r1, B[1] + ny * r1], [B[0] + ux * r1, B[1] + uy * r1], [B[0] - nx * r1, B[1] - ny * r1], [A[0] - nx * r0, A[1] - ny * r0]];
  }
  // positions along the rig's spine by distance from the tail tip: point, smooth orientation, the body's thickness there
  function spineFrames(R) {
    const sp = R.sp, n = sp.length, T = tube(sp, R.d, R.v, 0, 0), cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]));
    const at = dist => {
      let i = 0; while (i < n - 2 && cum[i + 1] < dist) i++;
      const f = clamp((dist - cum[i]) / ((cum[i + 1] - cum[i]) || 1), 0, 1), a = sp[i], b = sp[i + 1];
      let ux = lerp(T.up[i][0], T.up[i + 1][0], f), uy = lerp(T.up[i][1], T.up[i + 1][1], f); const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
      return { P: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], up: [ux, uy], tg: [-uy, ux], d: lerp(R.d[i], R.d[i + 1], f), v: lerp(R.v[i], R.v[i + 1], f) };
    };
    return { cum, at };
  }
  // the pelvis in the hip frame (x forward, y down, the hip socket at 0, 0): the ilium blade, the ischium (down and
  // back) and the pubis (down and forward, ending in its big 'boot')
  const RX_PELVIS = [
    [[-82, -30], [-74, -46], [-42, -56], [0, -60], [40, -56], [70, -46], [80, -30], [62, -14], [30, -10], [0, -16], [-30, -10], [-64, -14]],     // ilium
    [[2, 2], [18, 2], [22, 40], [20, 76], [46, 84], [54, 94], [42, 102], [-4, 102], [-14, 94], [2, 80], [4, 40]],                             // pubis and boot
    [[-8, 0], [-20, -4], [-38, 30], [-56, 62], [-50, 72], [-40, 66], [-18, 34]]];                                                              // ischium
  // the skeleton as separate pieces (puzzle pieces for Ep12): skull, body (neck, back, ribs, hips, arms), tail, legNear, legFar
  function rexBones(st, R, bp, o) {
    const ctx = st.ctx, q = R.q, want = o.parts ? (Array.isArray(o.parts) ? o.parts : [o.parts]) : (o.part ? [o.part] : null);
    const on = k => !want || want.indexOf(k) >= 0, body = on('body'), lod = st.lod;
    const S = spineFrames(R), c7 = S.cum[7], c9 = S.cum[9], c12 = S.cum[12];
    // far side: leg and arm in the darker bone colour
    const far = [];
    if (on('legFar')) { const l = rexLegBonePts(R.legs[0], lod); far.push(...l[0], ...l[1]); }
    if (body) far.push(...rexArmPts(R.arms[0]));
    boneLayer(st, far, bp, true);
    // ribs (behind the backbone), then the vertebrae of the tail, back and neck
    if (body) {
      const ribs = [];
      for (let k = 0; k < 5; k++) {
        const F = S.at(lerp(c7 + 76, c9 - 2, k / 4)), h = F.v * (k === 0 ? 0.64 : 0.8 - 0.05 * Math.abs(k - 2)), V = (a, b) => [F.P[0] + F.tg[0] * a + F.up[0] * b, F.P[1] + F.tg[1] * a + F.up[1] * b];
        ribs.push(chainPts([V(0, 2), V(-0.07 * h, -0.5 * h), V(-0.3 * h, -0.98 * h)], [6, 5, 3]));
      }
      boneLayer(st, ribs, bp);
    }
    // the backbone: the tail and the body (hips, back, neck) as two outlines, the joints marked across them
    const cols = [], seps = [];
    if (on('tail')) {
      const NT = 9, top = c7 - 36, gap = (top - 12) / (NT - 1), vs = [];
      for (let k = NT - 1; k >= 0; k--) {
        const F = S.at(top - k * gap), u = k / (NT - 1);
        vs.push({ at: top - k * gap, cl: gap * 0.42, ch: clamp((F.d + F.v) * 0.1 + 3, 4.5, 12.5), sl: u < 0.7 ? F.d * 0.5 : 0, tilt: 0.42, cv: u < 0.5 ? F.v * 0.36 : 0, sw: 0.55 });
      }
      const c = columnPts(S, vs); cols.push(c.pts); seps.push(...c.seps);
    }
    if (body) {
      const a0 = c7 - 40, a1 = c12 - 8, NB = 11, gap = (a1 - a0) / (NB - 1), vs = [];
      for (let k = 0; k < NB; k++) {
        const at = a0 + k * gap, F = S.at(at), neck = at > c9 + 6;
        vs.push({ at, cl: gap * 0.42, ch: neck ? 10 : 11.5, sl: neck ? 11 : F.d * 0.74, tilt: neck ? -0.12 : 0.2, cv: 0, sw: neck ? 0.6 : 0.46, sep: k > 0 });
      }
      const c = columnPts(S, vs); cols.push(c.pts); seps.push(...c.seps);
    }
    boneLayer(st, cols, bp);
    if (seps.length && !st.flat && lod) { const sp = new Path2D(); for (const q4 of seps) { sp.moveTo(q4[0][0], q4[0][1]); for (let i = 1; i < 4; i++) sp.lineTo(q4[i][0], q4[i][1]); sp.closePath(); } ctx.fillStyle = bp.ink; ctx.fill(sp); }
    // hips, shoulder blade and the near arm
    if (body) {
      const c = Math.cos(q.pitch), sn = Math.sin(q.pitch), pk = clamp((-q.hy - 5) / 102, 0.55, 1);   // lying: the pubis boot rests on the ground
      const Hf = ([x, y]) => { const yy = y > 0 ? y * pk : y, xx = y > 0 ? x * (0.75 + 0.25 * pk) : x; return [q.hx + xx * c - yy * sn, q.hy + xx * sn + yy * c]; };
      const A_ = R.arms[1], scap = limbPts(R.B(116, -22), 8, [A_.S[0] - 6, A_.S[1] - 4], 12, 0.12, -0.05);
      boneLayer(st, [...RX_PELVIS.map(pp => pp.map(Hf)), scap, ...rexArmPts(A_)], bp);
    }
    if (on('legNear')) { const l = rexLegBonePts(R.legs[1], lod); boneLayer(st, l[0], bp); boneLayer(st, l[1], bp); }
    if (on('skull')) rexSkull(st, R, bp);
  }
  // a little arm: upper arm, forearm, two fingers
  function rexArmPts(A_) {
    const out = [chainPts([A_.S, A_.E, A_.W], [5.5, 4.4, 4])];
    for (const da of [-0.3, 0.32]) { const a = A_.a2 + da + 0.25; out.push(rodPts(A_.W, add(A_.W, dirv(a), 13), 3, 1.4)); }
    return out;
  }
  // leg bones in two layers (so the joints show): [thigh bone, foot bone], [shin with its thin partner, three toes]
  function rexLegBonePts(L_, lod) {
    const H = L_.H, K = L_.K, A = L_.A, Bl = L_.ball, ta = L_.toe, T = (x, y) => { const r = rot(x, y, ta); return [Bl[0] + r[0], Bl[1] + r[1]]; };
    const l1 = [bonePts(H, K, 12, 10.5, 1.4), bonePts(A, Bl, 7.5, 6.5, 1.3)];
    const l2 = [bonePts(K, A, 10.5, 7.5, 1.32)];
    if (lod) { const dx = K[0] - A[0], dy = K[1] - A[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; l2.push(rodPts([lerp(K[0], A[0], 0.1) - nx * 9, lerp(K[1], A[1], 0.1) - ny * 9], [lerp(K[0], A[0], 0.88) - nx * 6, lerp(K[1], A[1], 0.88) - ny * 6], 5, 3.5)); }
    for (const [ex, ey] of [[46, 6], [64, 9], [54, 12]]) l2.push(chainPts([T(4, 0), T(ex * 0.55, ey * 0.6), T(ex, ey)], [5.5, 4.6, 2]));
    return [l1, l2];
  }
  // skull and jaw with the openings a palaeontologist expects: eye socket, the big hole in front of it, the nostril, the cheek hole
  const RX_SKULL = [[-36, -30], [-16, -68], [26, -90], [62, -96], [100, -88], [138, -78], [180, -64], [212, -46], [230, -24], [232, -2], [222, 16], [184, 24], [124, 28], [64, 30], [22, 34], [-14, 34], [-38, 10]];
  const RX_SKJAW = [[-20, 24], [50, 28], [130, 30], [190, 30], [218, 33], [224, 44], [212, 56], [160, 63], [96, 66], [34, 62], [-4, 54], [-20, 40]];
  const RX_HOLES = [[[52, -64], [84, -70], [98, -48], [88, -26], [64, -22], [48, -40]], [[114, -58], [152, -58], [178, -44], [162, -24], [126, -20], [110, -36]],
    [[196, -36], [214, -38], [220, -26], [204, -22]], [[10, -46], [30, -52], [36, -26], [24, 2], [10, 2], [2, -20]]];
  function rexSkull(st, R, bp) {
    const ctx = st.ctx, h = R.head, ja = R.q.jaw * 0.62;
    ctx.save(); headXf(ctx, h); const st2 = Object.assign({}, st, { lw: st.lw / RXHS, s: st.s * RXHS });
    const jaw = RX_SKJAW.map(pt => jawPt(pt, ja));
    boneLayer(st2, [jaw], bp); boneLayer(st2, [RX_SKULL], bp);
    if (!st.flat) {
      const holes = new Path2D(); for (const hp of RX_HOLES) closedPath(holes, hp);
      closedPath(holes, [[70, 40], [116, 40], [128, 48], [112, 56], [74, 54]].map(pt => jawPt(pt, ja)));
      ctx.fillStyle = bp.hole; ctx.fill(holes);
      if (st.lod) {
        const teeth = [];
        for (const tx of [202, 174, 146, 118]) teeth.push([[tx - 8, 24], [tx + 8, 24], [tx + 1, 42]]);
        if (ja > 0.12) for (const tx of [188, 160, 132]) teeth.push([jawPt([tx - 7, 34], ja), jawPt([tx + 7, 34], ja), jawPt([tx, 17], ja)]);
        boneLayer(st2, teeth, bp);
      }
    }
    ctx.restore();
  }
  function rexSkeleton(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, RX.H, RX.center), q = rexQ(Object.assign({}, o, { mouth: o.mouth == null ? 0 : o.mouth }), t, s), R = rexRig(q, { x: 0, y: 0 });
    if (o.shadow) groundShadow(ctx, 10, 330, +o.shadow, st.sil);
    rexBones(st, R, bonePal(o, st.sil), o);
    finish(st, ctx);
  }
  function rexXray(st, R, o, t) {
    const ctx = st.ctx, k = clamp(+o.xray, 0, 1), H = rexHeadPath(R), T = rexBody(R), sil = pathOf(T.out); closedPath(sil, H.upPts); closedPath(sil, H.jawPts);
    for (const L_ of R.legs) { const lp = rexLegPts(L_); closedPath(sil, lp.thigh); closedPath(sil, lp.lower); closedPath(sil, lp.foot); }
    ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = 'rgba(40,70,120,0.55)'; ctx.fill(sil);
    rexBones(Object.assign({}, st, { lw: st.lw * 0.8 }), R, bonePal({}, 0), {}); ctx.restore();
  }


  // =================================================================================================================
  // FOUR-LEGGED DINOSAURS: one rig for the titanosaur and the horned dinosaur. A body tube along a spine (tail, hips, back,
  // shoulders, neck), the head drawn by the species, column legs with IK, a lateral-sequence walk (hind, front, hind, front).
  // =================================================================================================================
  function quadParams(sp, pose, t, o, s) {
    const I = sp.idle, sd = o.seed || 0, br = Math.sin(t * sp.breathe + sd);
    const q = { hx: I.hx, hy: I.hy + br * 2.4, pitch: I.pitch, br, tR: I.tR, tC: I.tC, tW: 0.045, tP: t * 1.3 + sd, hA: I.hA + br * 0.01, jaw: 0, reach: 0,
      lid: -1, eyeY: 0, hNx: sp.feet[0], hNy: 0, fNx: sp.feet[1], fNy: 0, hFx: sp.feet[0] - sp.feet[2], hFy: 0, fFx: sp.feet[1] - sp.feet[2], fFy: 0 };
    I.neck.forEach((a, k) => { q['n' + k] = a + 0.025 * Math.sin(t * 0.9 + sd + k * 0.4); });
    if (pose === 'walk') {
      const g = sp.gait.walk, p = phaseOf(o, t, g, s);
      const f = [bipedFoot(p, g), bipedFoot(frac(p + 0.25), g), bipedFoot(frac(p + 0.5), g), bipedFoot(frac(p + 0.75), g)];
      q.hNx += f[0].x; q.hNy = f[0].y; q.fNx += f[1].x; q.fNy = f[1].y; q.hFx += f[2].x; q.hFy = f[2].y; q.fFx += f[3].x; q.fFy = f[3].y;
      const bob = 5 * Math.cos(4 * PI * (p - 0.1));
      q.hy = I.hy + bob; q.pitch = I.pitch + 0.012 * Math.sin(TAU * p);
      I.neck.forEach((a, k) => { q['n' + k] = a + 0.035 * Math.sin(TAU * p - k * 0.5); });
      q.hA = I.hA + 0.03 * Math.sin(TAU * p - 1.6); q.tP = TAU * p * 2 + sd; q.tW = 0.06;
    } else if (pose === 'munch') {
      const M = sp.munch, reach = o.reach == null ? 0 : clamp(+o.reach, 0, 1), ch = Math.sin(t * 7.5 + sd);
      M.neck.forEach((a, k) => { q['n' + k] = lerp(a, M.neckUp[k], reach) + 0.02 * Math.sin(t * 1.1 + k); });
      q.hA = lerp(M.hA, M.hAUp, reach) + 0.04 * ch; q.jaw = 0.25 + 0.25 * ch; q.reach = reach; q.pitch = I.pitch + M.pitch * (1 - reach); q.hy = I.hy + M.dy * (1 - reach) + br * 2;
      q.lid = 0.3 + 0.1 * Math.max(0, ch);
    }
    return q;
  }
  function quadQ(sp, o, t, s) {
    const pose = poseName(o, sp.poses); let q = quadParams(sp, pose, t, o, s);
    if (o.amount != null && +o.amount < 1) q = blendParams(quadParams(sp, poseName({ pose: o.from || 'idle' }, sp.poses), t, o, s), q, ease(clamp(+o.amount || 0, 0, 1)));
    if (o.mouth != null) q.jaw = clamp(+o.mouth, 0, 1);
    return q;
  }
  function quadRig(sp, q, look) {
    // feet first: a planted foot that the leg cannot reach pulls the body down
    const legs = [], pc = Math.cos(q.pitch), ps = Math.sin(q.pitch);
    const Bf = (ox, oy, dx, dy) => [ox + dx * pc - dy * ps, oy + dx * ps + dy * pc];
    const shSp = Bf(q.hx, q.hy, sp.body[sp.body.length - 1][0], sp.body[sp.body.length - 1][1]);
    const joint = (front, far, hy) => { const base = front ? Bf(q.hx, hy, sp.body[sp.body.length - 1][0], sp.body[sp.body.length - 1][1]) : [q.hx, hy]; const j = Bf(base[0], base[1], front ? sp.frontJ[0] : sp.hindJ[0], front ? sp.frontJ[1] : sp.hindJ[1]); return far ? [j[0] + sp.farOff[0], j[1] + sp.farOff[1]] : j; };
    const defs = [['hFx', 'hFy', false, true], ['fFx', 'fFy', true, true], ['hNx', 'hNy', false, false], ['fNx', 'fNy', true, false]];
    let hy = q.hy;
    for (const [kx, ky, front] of defs) if (q[ky] > -5) {
      const L2 = front ? sp.front : sp.hind, reach = (L2[0] + L2[1]) * 0.985, J0 = joint(front, false, q.hy), A = [q[kx], -sp.ankleH + q[ky]], dx = A[0] - J0[0];
      if (Math.abs(dx) < reach) { const need = A[1] - Math.sqrt(reach * reach - dx * dx); if (J0[1] < need) hy += need - J0[1]; }
    }
    q = Object.assign({}, q, { hy });
    void shSp;
    for (const [kx, ky, front, far] of defs) {
      const L2 = front ? sp.front : sp.hind, J = joint(front, far, q.hy), A = [q[kx], -sp.ankleH + q[ky]];
      legs.push({ J, K: ik(J, A, L2[0], L2[1], front ? -1 : 1), A, front, far, lift: q[ky] });
    }
    // spine: tail (tip first), hips, back, shoulders, neck
    const Hs = [q.hx, q.hy], tail = []; let p = Hs;
    for (let k = 0; k < sp.tailL.length; k++) { const a = PI + q.pitch * 0.6 + q.tR + q.tC * k + q.tW * Math.sin(q.tP - k * 0.55) * (k + 1) / 6; p = [p[0] + Math.cos(a) * sp.tailL[k], p[1] + Math.sin(a) * sp.tailL[k]]; tail.push(p); }
    const bodyPts = sp.body.map(b => Bf(q.hx, q.hy, b[0], b[1]));
    const neck = []; p = bodyPts[bodyPts.length - 1];
    for (let k = 0; k < sp.neckL.length; k++) { const a = q.pitch + q['n' + k] + look.y * 0.06 * (k + 1) / sp.neckL.length; p = [p[0] + Math.cos(a) * sp.neckL[k], p[1] + Math.sin(a) * sp.neckL[k]]; neck.push(p); }
    const spine = tail.slice().reverse().concat([Hs], bodyPts, neck);
    const brk = 1 + 0.02 * q.br, nb = sp.tailL.length + 1;
    const v = sp.v.map((x, i) => (i >= nb && i < nb + sp.body.length ? x * brk : x));
    const nEnd = neck[neck.length - 1], nPrev = neck.length > 1 ? neck[neck.length - 2] : bodyPts[bodyPts.length - 1];
    const head = { x: nEnd[0], y: nEnd[1], a: q.hA + q.pitch * 0.3 + look.y * 0.25 + 0 * Math.atan2(nEnd[1] - nPrev[1], nEnd[0] - nPrev[0]) };
    return { q, sp: spine, d: sp.d, v, legs, head, tailN: sp.tailL.length };
  }
  // a column leg with an elephant-like foot pad and toenails
  function quadLegPts(sp, L_) {
    const r = L_.front ? sp.frontR : sp.hindR, A = L_.A;
    const col = chainPts([L_.J, L_.K, A], r), pw = sp.pad[0], ph = sp.pad[1], fx = A[0] + (L_.front ? 4 : 6), fy = A[1] + sp.ankleH;
    const lift = L_.lift < -1 ? clamp(-L_.lift / 30, 0, 1) * 0.25 : 0, c = Math.cos(lift), sn = Math.sin(lift);
    const T = (x, y) => [A[0] + (x - A[0]) * c - (y - A[1]) * sn, A[1] + (x - A[0]) * sn + (y - A[1]) * c];
    const pad = [[fx - pw, fy - ph * 0.55], [fx - pw * 0.6, fy - ph * 1.05], [fx + pw * 0.6, fy - ph * 1.05], [fx + pw * 1.04, fy - ph * 0.45], [fx + pw, fy - 1], [fx - pw * 0.95, fy - 1]].map(q => T(q[0], q[1]));
    const nails = [-0.15, 0.3, 0.75].map(f => T(fx + pw * f, fy - ph * 0.42));
    return { col, pad, nails };
  }
  function quadDrawLegs(st, sp, R, pal, far, shadeP) {
    const ctx = st.ctx, list = [], nails = [];
    for (const L_ of R.legs) if (L_.far === far) { const P_ = quadLegPts(sp, L_); list.push(P_.col, P_.pad); nails.push(...P_.nails); if (!far && shadeP && st.lod) { const c = crescentPts(P_.col, sp.frontR[0] * 0.3, null, st.lw * 0.25); if (c) shadeP.push(c); } }
    partPts(st, list, far ? pal.far : pal.body);
    if (!st.flat && st.lod) {   // toenails
      ctx.fillStyle = far ? dk(pal.nail, 0.12) : pal.nail; ctx.beginPath(); const nr = sp.pad[1] * 0.3;
      for (const n of nails) { ctx.moveTo(n[0] + nr * 0.8, n[1]); ctx.ellipse(n[0], n[1], nr * 0.8, nr, 0, 0, TAU); }
      ctx.fill();
    }
  }
  function quadDraw(sp, ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, sp.H, sp.center), pal = sp.pal(o, st.sil), m = moodOf(o);
    const lk = lookOf(o, t, st.seed + 3), q = quadQ(sp, o, t, s), R = quadRig(sp, q, lk);
    if (o.shadow !== false) groundShadow(ctx, sp.shadow[0], sp.shadow[1], o.shadow == null ? 1 : +o.shadow, st.sil);
    quadDrawLegs(st, sp, R, pal, true, null);
    const T = tube(R.sp, R.d, R.v, 6, 0), H = sp.headPts(R, q);
    if (H.back) { partPts(st, H.back, pal.frill || pal.far); if (sp.frillDetails) sp.frillDetails(st, H, pal); }   // things behind the head: the frill, the far horn
    if (H.back2) partPts(st, H.back2, dk(pal.horn || pal.far, 0.12));
    if (!st.flat && q.jaw > 0.02 && H.mouth) { ctx.fillStyle = pal.mouth; ctx.fill(pathOf(H.mouth)); }
    if (H.jaw) partPts(st, [H.jaw], pal.body);
    partPts(st, [T.out].concat(H.parts), pal.body);
    const shadeP = [];
    if (!st.flat && st.det > 0.03) {
      const n = R.sp.length, up = T.up, bot = T.bot, ins = st.lw * 0.25, i0 = sp.bellyFrom;
      // lighter belly band with its shadow
      const bel = []; for (let i = i0; i < n; i++) bel.push([bot[i][0] + up[i][0] * ins, bot[i][1] + up[i][1] * ins]);
      for (let i = n - 1; i >= i0; i--) { const k = sp.bellyK[i - i0]; bel.push([R.sp[i][0] - up[i][0] * R.v[i] * k, R.sp[i][1] - up[i][1] * R.v[i] * k]); }
      fillPts(st, bel, pal.belly);
      shadeP.push(bandPts(bot.slice(0, i0 + 1), up.slice(0, i0 + 1), sp.shadeW.slice(0, i0 + 1), ins));
      fillPts(st, bandPts(bot.slice(i0, n - 1), up.slice(i0, n - 1), sp.shadeW.slice(i0, n - 1).map(w => w * 0.85), ins), pal.bellyShade);
      sp.texture(st, R, T, pal);
      // highlight along the back
      const hl = [], hb = [];
      for (let i = sp.hlFrom; i < n - 1; i++) { const w = i === sp.hlFrom || i === n - 2 ? sp.hlW * 0.12 : sp.hlW * 0.5, dd = R.d[i] * 0.62; hl.push([R.sp[i][0] + up[i][0] * (dd + w), R.sp[i][1] + up[i][1] * (dd + w)]); hb.push([R.sp[i][0] + up[i][0] * (dd - w), R.sp[i][1] + up[i][1] * (dd - w)]); }
      fillPts(st, hl.concat(hb.reverse()), 'rgba(255,255,255,0.2)');
      sp.headDetails(st, R, H, pal, m, lk, t, o, q, shadeP);
    }
    quadDrawLegs(st, sp, R, pal, false, shadeP);
    if (!st.flat && st.det > 0.03) for (const c of shadeP) fillPts(st, c, pal.shade);
    if (H.front && !st.flat) H.front(st, pal);
    finish(st, ctx);
  }
  function quadPal(def) {
    return (o, sil) => {
      const pal = palette(def, o.colors, sil);
      pal.shade = dk(pal.body, 0.2); pal.far = dk(pal.body, 0.2); pal.bellyShade = mix(pal.belly, pal.body, 0.5); pal.lid = pal.body; pal.brow = dk(pal.body, 0.3);
      return pal;
    };
  }
  // a head as points in head-local coordinates (origin at the end of the neck, +x forward), scaled by k
  function headW(h, k) { const c = Math.cos(h.a) * k, sn = Math.sin(h.a) * k; return pt => [h.x + pt[0] * c - pt[1] * sn, h.y + pt[0] * sn + pt[1] * c]; }
  function hingePt(pt, J, a) { const r = rot(pt[0] - J[0], pt[1] - J[1], a); return [J[0] + r[0], J[1] + r[1]]; }
  // leaves held in the mouth while munching
  function sprig(st, x, y, a, k, pal) {
    if (st.flat || st.det < 0.1) return; const ctx = st.ctx;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(k, k);
    ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw / k * 0.8; ctx.fillStyle = pal.leaf;
    for (const [lx, ly, la] of [[18, -6, -0.5], [30, 4, 0.4], [6, 6, 0.9]]) { ctx.beginPath(); ctx.ellipse(lx, ly, 13, 6, la, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  // ----- the titanosaur (long neck, small head, pillar legs; blue-grey with light round spots). s = 1: about 560 tall, 1000 long.
  const TITAN_HEAD = [[-20, -22], [4, -38], [38, -44], [72, -38], [94, -24], [102, -4], [96, 14], [72, 22], [34, 24], [4, 22], [-20, 10]];
  const TITAN_JAW = [[-8, 12], [40, 16], [84, 16], [98, 12], [96, 24], [74, 32], [34, 32], [2, 26]];
  const TITAN_JAW_J = [0, 16];
  const TITAN = {
    H: 560, w: 1020, center: [-67, -321], shadow: [-20, 400], breathe: 1.6,
    poses: ['idle', 'walk', 'munch'],
    gait: { walk: { stride: 270, duty: 0.72, lift: 18, rate: 0.5 } },
    idle: { hx: -150, hy: -362, pitch: -0.03, tR: -0.3, tC: 0.04, hA: 0.3, neck: [-0.85, -0.95, -0.95, -0.85, -0.7, -0.5] },
    munch: { neck: [-0.35, 0.05, 0.45, 0.7, 0.8, 0.8], neckUp: [-0.95, -1.1, -1.15, -1.05, -0.9, -0.6], hA: 1.1, hAUp: 0.05, pitch: 0.06, dy: 6 },
    tailL: [70, 68, 64, 60, 56, 50, 44, 38], neckL: [62, 60, 58, 56, 54, 50],
    body: [[95, -14], [195, -18], [285, -8]],
    d: [6, 10, 15, 21, 27, 34, 41, 48, 56, 60, 64, 64, 58, 50, 43, 37, 31, 26, 22],
    v: [6, 10, 15, 22, 30, 39, 49, 61, 82, 136, 150, 152, 126, 92, 70, 56, 45, 36, 28],
    hindJ: [6, 74], frontJ: [-6, 82], hind: [136, 128], front: [134, 128], ankleH: 28,
    hindR: [46, 38, 35], frontR: [43, 36, 33], pad: [42, 26], feet: [-140, 138, 30], farOff: [-24, -6],
    bellyFrom: 4, bellyK: [1, 0.85, 0.7, 0.6, 0.55, 0.5, 0.5, 0.52, 0.55, 0.55, 0.55, 0.6, 0.65, 0.7, 0.75], shadeW: [0, 3, 5, 7, 9, 11, 13, 15, 17, 20, 22, 22, 18, 13, 10, 8, 6, 4, 0],
    hlFrom: 4, hlW: 16,
    pal: quadPal({ body: '#7FA7C9', belly: '#C9DAEA', spot: '#B9CFE4', nail: '#EEE6D6', mouth: '#7A3A4A', cheek: '#FF9FB2', leaf: '#6CC04A', iris: '#5A6B8C' }),
    headPts(R, q) {
      const W = headW(R.head, 1), ja = q.jaw * 0.35, jaw = TITAN_JAW.map(pt => W(hingePt(pt, TITAN_JAW_J, ja)));
      const up = TITAN_HEAD.map(W), mouth = [[4, 18], [40, 20], [80, 18], [98, 10]].map(W).concat([[90, 14], [40, 16], [4, 14]].map(pt => W(hingePt(pt, TITAN_JAW_J, ja))));
      return { parts: [up], jaw, mouth, W, ja, up };
    },
    texture(st, R, T, pal) {
      const ctx = st.ctx, n = R.sp.length; ctx.fillStyle = pal.spot; ctx.beginPath();
      const r = L.rng(21);
      for (let k = 0; k < 15; k++) {
        const u = 0.12 + k / 15 * 0.8 + (r() - 0.5) * 0.03, P_ = along(R.sp, u), i = Math.min(n - 1, P_.i), U = T.up[i], dd = R.d[i], vv = R.v[i];
        const dep = -dd * (0.15 + 0.4 * r()) + (k % 3 === 2 ? vv * 0.35 : 0), rr = Math.max(3, (dd + vv) * (0.07 + 0.05 * r()));
        const x = P_.x - U[0] * dep, y = P_.y - U[1] * dep; ctx.moveTo(x + rr, y); ctx.ellipse(x, y, rr, rr * 0.85, 0, 0, TAU);
      }
      ctx.fill();
    },
    headDetails(st, R, H, pal, m, lk, t, o, q, shadeP) {
      const ctx = st.ctx, h = R.head;
      if (H.jaw) fillPts(st, cw(TITAN_JAW.slice(3, 7).concat([[70, 22], [30, 22]]).map(pt => H.W(hingePt(pt, TITAN_JAW_J, H.ja)))), pal.belly);
      const c = crescentPts(H.up, 6, null, st.lw * 0.25, 0.3, 0.9); if (c) shadeP.push(c);
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
      if (m.smile > 0) { ctx.fillStyle = rgba(pal.cheek, 0.7 * st.det); ctx.beginPath(); ctx.ellipse(56, 6, 11, 6, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = st.ink; ctx.beginPath(); ctx.ellipse(78, -30, 4.5, 3, -0.4, 0, TAU); ctx.fill();
      if (q.jaw < 0.05) { ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw; ctx.beginPath(); ctx.moveTo(98, 10); ctx.quadraticCurveTo(70, 20, 40, 16); ctx.quadraticCurveTo(32, 15 - m.smile * 2, 28, 8 - m.smile * 4); ctx.stroke(); }
      const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 1);
      eye(st, 40, -14, 14, { lid: Math.max(q.lid >= 0 ? q.lid : m.lid, blink), low: m.low, lx: lk.x, ly: clamp(lk.y + q.eyeY, -1, 1), skin: pal.lid, iris: pal.iris, pup: m.pup, wide: m.wide });
      brow(st, 40, -14, 14, m.bUp, m.bTilt, pal.brow, 5);
      ctx.restore();
      if (q.jaw > 0.05 && o.food !== false) { const pt = H.W(hingePt([92, 18], TITAN_JAW_J, H.ja)); sprig(st, pt[0], pt[1], h.a + 0.3, 1.1, pal); }
    }
  };
  function titanosaur(ctx, x, y, s, t, o) { quadDraw(TITAN, ctx, x, y, s, t, o); }

  // ----- the horned dinosaur (Triceratops-like: big frill, two brow horns and a nose horn, a beak). s = 1: about 310 tall, 640 long.
  const HORN_FACE = [[-34, -18], [0, -50], [52, -62], [104, -50], [146, -30], [176, -8], [190, 12], [184, 30], [150, 38], [90, 42], [30, 38], [-14, 26]];
  const HORN_BEAK = [[168, -4], [190, 2], [206, 20], [208, 44], [198, 52], [192, 36], [178, 28], [164, 16]];
  const HORN_JAW = [[30, 30], [90, 36], [150, 36], [178, 38], [192, 52], [176, 60], [120, 62], [60, 56], [26, 44]];
  const HORN_JAW_J = [30, 34];
  const HORN_FRILL = (() => { const pts = []; for (let i = 0; i <= 16; i++) { const a = -3.0 + i / 16 * 2.05, r = 104 + (i % 2 ? 0 : 12); pts.push([-2 + Math.cos(a) * r * 1.02, -30 + Math.sin(a) * r * 0.98]); } pts.push([46, -26], [16, 8], [-36, 18], [-96, 0]); return pts; })();
  const HORNED = {
    H: 310, w: 640, center: [24, -167], shadow: [10, 270], breathe: 1.9,
    poses: ['idle', 'walk', 'munch'],
    gait: { walk: { stride: 200, duty: 0.66, lift: 24, rate: 0.75 } },
    idle: { hx: -110, hy: -200, pitch: 0.05, tR: -0.18, tC: 0.03, hA: 0.08, neck: [-0.35, -0.15] },
    munch: { neck: [0.28, 0.42], neckUp: [-0.45, -0.3], hA: 0.3, hAUp: -0.05, pitch: 0.08, dy: 6 },
    tailL: [46, 42, 38, 32, 26], neckL: [22, 18],
    body: [[80, -8], [160, -6], [215, 6]],
    d: [6, 12, 19, 27, 36, 48, 54, 54, 46, 40, 36],
    v: [6, 12, 20, 30, 42, 60, 98, 104, 88, 64, 50],
    hindJ: [6, 46], frontJ: [-4, 52], hind: [84, 76], front: [66, 60], ankleH: 20,
    hindR: [34, 27, 24], frontR: [27, 22, 20], pad: [29, 20], feet: [-100, 104, 24], farOff: [-16, -6],
    bellyFrom: 3, bellyK: [1, 0.8, 0.66, 0.58, 0.55, 0.55, 0.6, 0.62], shadeW: [0, 3, 5, 7, 9, 12, 15, 15, 12, 8, 0],
    hlFrom: 3, hlW: 12,
    pal: quadPal({ body: '#F2A65A', belly: '#F8D39C', frill: '#E07A5F', frillIn: '#EE9A7E', horn: '#FFF1D6', beak: '#B9794A', nail: '#EEE2CC', mouth: '#7A3A4A', cheek: '#FF8FA3', leaf: '#6CC04A', iris: '#7A4A2A', spot: '#F6C48A' }),
    headPts(R, q) {
      const W = headW(R.head, 1), ja = q.jaw * 0.3, jp = pt => W(hingePt(pt, HORN_JAW_J, ja));
      const face = HORN_FACE.map(W), frill = HORN_FRILL.map(W), beak = HORN_BEAK.map(W), jaw = HORN_JAW.map(jp);
      const horn = (bx, by, len, a, w) => [[bx - w, by + 4], [bx + Math.cos(a) * len * 0.5 - w * 0.55, by + Math.sin(a) * len * 0.5], [bx + Math.cos(a) * len, by + Math.sin(a) * len], [bx + Math.cos(a) * len * 0.5 + w * 0.5, by + Math.sin(a) * len * 0.5 + w * 0.3], [bx + w, by + 2]].map(W);
      const hornFar = horn(70, -50, 96, -0.95, 13), hornNear = horn(96, -48, 104, -0.82, 15), nose = horn(150, -30, 40, -1.25, 13);
      const mouth = [[40, 34], [100, 38], [160, 34], [190, 30]].map(W).concat([[178, 38], [100, 36], [40, 34]].map(jp));
      return { parts: [face], back: [frill], back2: [hornFar], jaw, mouth, W, ja, face, frill, beak, hornNear, nose, hornFar,
        front: (st, pal) => { partPts(st, [hornNear, nose], pal.horn); partPts(st, [beak], pal.beak); } };
    },
    texture(st, R, T, pal) {
      const ctx = st.ctx, n = R.sp.length; if (st.lod < 1) return;
      ctx.fillStyle = dk(pal.body, 0.12); ctx.beginPath(); const r = L.rng(31);
      for (let k = 0; k < 10; k++) { const u = 0.2 + k * 0.065, P_ = along(R.sp, u), i = Math.min(n - 1, P_.i), U = T.up[i], dep = -R.d[i] * 0.55, rr = 6 + r() * 5, x = P_.x - U[0] * dep, y = P_.y - U[1] * dep; ctx.moveTo(x + rr, y); ctx.ellipse(x, y, rr, rr * 0.7, P_.ang, 0, TAU); }
      ctx.fill();
    },
    headDetails(st, R, H, pal, m, lk, t, o, q, shadeP) {
      const ctx = st.ctx, h = R.head;
      // the frill (drawn behind with the far horn) gets its colour and a pattern here: it is part of the body silhouette's back layer
      fillPts(st, cw(H.jaw.slice(4, 8).concat([H.W(hingePt([120, 50], HORN_JAW_J, H.ja)), H.W(hingePt([176, 50], HORN_JAW_J, H.ja))])), pal.belly);
      const c = crescentPts(H.face, 8, null, st.lw * 0.25, 0.3, 0.9); if (c) shadeP.push(c);
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
      if (m.smile > 0) { ctx.fillStyle = rgba(pal.cheek, 0.7 * st.det); ctx.beginPath(); ctx.ellipse(96, 14, 16, 8, 0, 0, TAU); ctx.fill(); }
      if (q.jaw < 0.05) { ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw; ctx.beginPath(); ctx.moveTo(170, 36); ctx.quadraticCurveTo(120, 42, 70, 36); ctx.quadraticCurveTo(58, 34 - m.smile * 2, 52, 26 - m.smile * 5); ctx.stroke(); }
      const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 2);
      eye(st, 98, -20, 17, { lid: Math.max(q.lid >= 0 ? q.lid : m.lid, blink), low: m.low, lx: lk.x, ly: clamp(lk.y + q.eyeY, -1, 1), skin: pal.lid, iris: pal.iris, pup: m.pup, wide: m.wide });
      brow(st, 98, -20, 17, m.bUp, m.bTilt, pal.brow, 6);
      ctx.restore();
      if (q.jaw > 0.05 && o.food !== false) { const pt = H.W([200, 40]); sprig(st, pt[0], pt[1], h.a + 0.5, 1.0, pal); }
    }
  };
  HORNED.frillDetails = function (st, H, pal) {
    if (st.flat || st.det < 0.05) return; const ctx = st.ctx, W = H.W;
    const inner = []; for (let i = 0; i <= 12; i++) { const a = -2.85 + i / 12 * 1.9; inner.push(W([-2 + Math.cos(a) * 76, -30 + Math.sin(a) * 80])); }
    inner.push(W([20, -20]), W([-30, 0]));
    fillPts(st, inner, pal.frillIn);
    if (st.lod) { ctx.fillStyle = pal.frill; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -2.65 + i * 0.38, p = W([-2 + Math.cos(a) * 60, -30 + Math.sin(a) * 64]), r = 9; ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, TAU); } ctx.fill(); }
  };
  function horned(ctx, x, y, s, t, o) { quadDraw(HORNED, ctx, x, y, s, t, o); }

  // =================================================================================================================
  // BIRDS: one rig for the pigeon, hen, crow, sparrow and the small flock bird. Birds share one scale (about 6 px per cm at
  // s = 1: a pigeon is about 190 long), so birds drawn at the same s have their true relative sizes. Local frame: ground at
  // y = 0 under the feet (also in flight: the bird is drawn where it would stand; anchor: 'center' puts the body centre at x, y).
  // =================================================================================================================
  // a fan of feathers (a tail, or the hand of a spread wing) as one scalloped outline: the base points, then the tips with
  // notches between them; also the inner edge of the coloured tips and the short lines between feathers
  function fanPts(base, tips, notch, tipLen) {
    const n = tips.length, out = base.slice(), inner = [], lines = [];
    for (let i = 0; i < n; i++) {
      const t = tips[i]; out.push(t.p);
      if (i < n - 1) { const u = tips[i + 1], m = [(t.p[0] + u.p[0]) / 2, (t.p[1] + u.p[1]) / 2], o = [(t.o[0] + u.o[0]) / 2, (t.o[1] + u.o[1]) / 2]; const q = [lerp(m[0], o[0], notch), lerp(m[1], o[1], notch)]; out.push(q); lines.push([q, [lerp(q[0], o[0], 0.45), lerp(q[1], o[1], 0.45)]]); }
    }
    for (let i = 0; i < n; i++) { const t = tips[i]; inner.push([lerp(t.p[0], t.o[0], tipLen), lerp(t.p[1], t.o[1], tipLen)]); }
    return { pts: out, inner, lines };
  }
  // the coloured tips of a fan: the band between the scalloped edge and the tips' inner line (same control points: same curve)
  function fanTipPts(F, nBase) { const outer = F.pts.slice(nBase); return outer.concat(F.inner.slice().reverse()); }

  const BIRD_POSES = { pigeon: ['idle', 'walk', 'peck', 'coo', 'fly', 'glide'], hen: ['idle', 'walk', 'peck', 'brood', 'cluck'], crow: ['idle', 'hop', 'walk', 'caw', 'fly'],
    sparrow: ['idle', 'hop', 'peck', 'fly'], smallBird: ['perch', 'idle', 'hop', 'fly'] };
  const BIRD_SP = {
    pigeon: { H: 150, w: 200, bx: -6, by: -80, rx: 66, ry: 46, tilt: -0.22, chest: 0.22, rump: 0.35, hr: 21, head: [56, -126], neckW: 30,
      beak: [17, 8.5, 0.05], legT: 24, legM: 24, foot: 17, toeW: 5.5, tail: [58, 0.1, 0.42, 6], wing: [1.0, 0.9], cadence: 1.7, stride: 60, hop: 0, bob: 1,
      col: { body: '#9AA5B1', belly: '#B7C0CA', wing: '#A7B1BC', wingDark: '#6E7884', bar: '#4A515B', tail: '#8B96A2', tailBand: '#4A515B', head: '#7D8996', beak: '#4A4F58', cere: '#F2F2EE', leg: '#E2737E', iris: '#F28C28', shine1: '#62AE9C', shine2: '#9A7FBE', cheek: '#FF9FB2' } },
    hen: { H: 240, w: 250, bx: -10, by: -122, rx: 90, ry: 74, tilt: -0.1, chest: 0.12, rump: 0.05, hr: 30, head: [74, -196], neckW: 44,
      beak: [20, 12, 0.15], legT: 34, legM: 36, foot: 25, toeW: 7.5, tail: [70, 0.95, 0.75, 5], wing: [0.9, 0.95], cadence: 1.3, stride: 80, hop: 0, bob: 1, fluffy: 1,
      col: { body: '#FFF4E0', belly: '#FFFBF2', wing: '#F3E4C6', wingDark: '#E2CDA4', bar: '#E2CDA4', tail: '#F0DFC0', tailBand: '#DCC59C', head: '#FFF4E0', beak: '#F5B335', comb: '#E5484D', leg: '#F5B335', iris: '#E08A2E', cheek: '#FF9FB2' } },
    crow: { H: 170, w: 270, bx: -10, by: -92, rx: 82, ry: 46, tilt: -0.2, chest: 0.08, rump: 0.4, hr: 25, head: [74, -134], neckW: 32,
      beak: [36, 15, 0.3], legT: 30, legM: 34, foot: 22, toeW: 6, tail: [88, 0.06, 0.3, 5], wing: [1.05, 0.9], cadence: 1.4, stride: 80, hop: 1, bob: 0.4,
      col: { body: '#3B3F45', belly: '#454A52', wing: '#353940', wingDark: '#2A2D33', bar: '#2A2D33', tail: '#33373D', tailBand: '#2A2D33', head: '#3B3F45', beak: '#2A2D33', leg: '#2E3136', iris: '#5A3A22', sheen: '#6E8FC2', cheek: '#FF9FB2' } },
    sparrow: { H: 78, w: 100, bx: -4, by: -42, rx: 34, ry: 24, tilt: -0.22, chest: 0.12, rump: 0.3, hr: 13.5, head: [27, -64], neckW: 17,
      beak: [9, 6.5, 0.02], legT: 12, legM: 12, foot: 9, toeW: 3.2, tail: [32, 0.18, 0.3, 4], wing: [1.0, 0.9], cadence: 2.2, stride: 30, hop: 1, bob: 0,
      col: { body: '#B1835A', belly: '#EBDCC4', wing: '#9C6C45', wingDark: '#5E3F28', bar: '#F5EBDD', tail: '#7C5536', tailBand: '#5E3F28', head: '#8C8C8C', beak: '#4E4A46', leg: '#C99A7E', iris: '#3A2A20', streak: '#4A3020', cheekW: '#F3ECE0', cheek: '#FF9FB2' } },
    smallBird: { H: 70, w: 92, bx: -2, by: -38, rx: 30, ry: 23, tilt: -0.18, chest: 0.15, rump: 0.25, hr: 13, head: [24, -58], neckW: 16,
      beak: [8, 6, 0.02], legT: 10, legM: 11, foot: 8, toeW: 3, tail: [26, 0.22, 0.32, 4], wing: [1.0, 0.92], cadence: 2.4, stride: 26, hop: 1, bob: 0,
      col: { body: '#4EA8FF', belly: '#D8EEFF', wing: '#2F7FD6', wingDark: '#1F5FA6', bar: '#2F7FD6', tail: '#2F7FD6', tailBand: '#1F5FA6', head: '#4EA8FF', beak: '#F5A623', leg: '#E8A07A', iris: '#2B2D42', cheek: '#FF9FB2' } }
  };
  const SMALL_VARIANTS = {
    blue: { body: '#4EA8FF', belly: '#D8EEFF', wing: '#2F7FD6', wingDark: '#1F5FA6', tail: '#2F7FD6', tailBand: '#1F5FA6', head: '#4EA8FF' },
    yellow: { body: '#FFD23F', belly: '#FFF2B0', wing: '#E8A91C', wingDark: '#B9820F', tail: '#E8A91C', tailBand: '#B9820F', head: '#FFD23F' },
    red: { body: '#E5484D', belly: '#F9C2C4', wing: '#B8343A', wingDark: '#8E252A', tail: '#B8343A', tailBand: '#8E252A', head: '#E5484D' },
    green: { body: '#5BC26B', belly: '#D4F2C0', wing: '#3A9A4E', wingDark: '#2A7339', tail: '#3A9A4E', tailBand: '#2A7339', head: '#5BC26B' },
    orange: { body: '#F7934C', belly: '#FFE0C4', wing: '#D9702E', wingDark: '#A9521D', tail: '#D9702E', tailBand: '#A9521D', head: '#F7934C' },
    pink: { body: '#FF9BD2', belly: '#FFE1F1', wing: '#E56BAF', wingDark: '#B94F8B', tail: '#E56BAF', tailBand: '#B94F8B', head: '#FF9BD2' },
    teal: { body: '#3FA7A3', belly: '#D2F0EC', wing: '#2B807D', wingDark: '#1E5E5C', tail: '#2B807D', tailBand: '#1E5E5C', head: '#3FA7A3' },
    purple: { body: '#9B6BFF', belly: '#E6DBFF', wing: '#7A4FD6', wingDark: '#5B37A8', tail: '#7A4FD6', tailBand: '#5B37A8', head: '#9B6BFF' },
    brown: { body: '#B1835A', belly: '#EBDCC4', wing: '#8C6240', wingDark: '#5E3F28', tail: '#8C6240', tailBand: '#5E3F28', head: '#B1835A' }
  };
  const SMALL_ORDER = ['blue', 'yellow', 'red', 'green', 'orange', 'pink', 'teal', 'purple', 'brown'];

  function birdParams(kind, sp, pose, t, o, s) {
    const sd = o.seed || 0, br = Math.sin(t * 2.6 + sd);
    const q = { bx: sp.bx, by: sp.by + br * sp.ry * 0.02, tilt: sp.tilt, puff: br * 0.015, hx: sp.head[0], hy: sp.head[1], hA: 0.05, beak: 0, tailA: 0, fan: 0,
      fly: 0, flap: 0, fold: 0, wingLift: 0, tuck: 0, sit: 0, lid: -1, closed: 0, nX: 8, nY: 0, nP: 0.22, nT: 0, fX: -6, fY: 0, fP: 0.25, fT: 0, curl: 0, hop: 0 };
    const L1 = sp.legT, idleLook = wob(t * 0.8, sd + 2);
    q.hx += sp.hr * 0.12 * idleLook; q.hA += 0.08 * wob(t * 0.6, sd + 5);
    if (kind === 'smallBird' && pose === 'perch') { q.curl = 1; q.nX = 4; q.fX = -2; q.nP = 0.05; q.fP = 0.05; }
    if (pose === 'walk') {
      const g = { stride: sp.stride, duty: 0.6, lift: L1 * 0.5, rate: sp.cadence }, p = phaseOf(o, t, g, s);
      const fn = bipedFoot(p, g), ff = bipedFoot(frac(p + 0.5), g);
      q.nX = 6 + fn.x; q.nY = fn.y; q.fX = 0 + ff.x; q.fY = ff.y;
      q.nP = fn.st ? 0.2 + 0.5 * sstep(0.5, 1, fn.u) : lerp(0.75, 0.2, sstep(0, 0.6, fn.u)); q.fP = ff.st ? 0.2 + 0.5 * sstep(0.5, 1, ff.u) : lerp(0.75, 0.2, sstep(0, 0.6, ff.u));
      q.nT = fn.st ? 0 : 0.7 * Math.sin(PI * fn.u); q.fT = ff.st ? 0 : 0.7 * Math.sin(PI * ff.u);
      q.by = sp.by + sp.ry * 0.04 * Math.cos(4 * PI * (p - 0.1)); q.tilt = sp.tilt + 0.03 * Math.sin(4 * PI * p);
      // head-bob: the head holds still in the world while the body walks on, then thrusts forward (once per step)
      if (sp.bob > 0) { const sp2 = frac(2 * p + 0.15), hold = 0.62, amp = sp.stride * 0.5 * hold * sp.bob; const hxo = sp2 < hold ? amp * (0.5 - sp2 / hold) : amp * (ease((sp2 - hold) / (1 - hold)) - 0.5); q.hx = sp.head[0] + hxo + sp.hr * 0.15; q.hy = sp.head[1] + (sp2 < hold ? 0 : -sp.hr * 0.12 * Math.sin(PI * (sp2 - hold) / (1 - hold))); }
      q.tailA = 0.05 * Math.sin(4 * PI * p);
    } else if (pose === 'hop') {
      // both feet together: crouch, spring, fly through an arc, land; the body redistributes the walk so the feet stay planted
      const g = { stride: sp.stride * 1.6, rate: sp.cadence * 0.55 }, p = phaseOf(o, t, g, s);
      const air0 = 0.25, air1 = 0.62, u = clamp((p - air0) / (air1 - air0), 0, 1), inAir = p > air0 && p < air1;
      const cover = p < air0 ? 0 : p > air1 ? 1 : ease(u), D = g.stride;
      const shift = D * (cover - p);                    // where the bird is relative to an even walk
      const crouch = Math.sin(PI * clamp(p / air0, 0, 1)) * 0.6 + Math.sin(PI * clamp((p - air1) / (1 - air1), 0, 1)) * 0.5;
      q.hop = inAir ? sp.H * 0.28 * Math.sin(PI * u) : 0; q.bx = sp.bx + shift; q.hx = sp.head[0] + shift; q.nX = 8 + shift; q.fX = -4 + shift;
      q.by = sp.by + sp.ry * 0.16 * crouch; q.hy = sp.head[1] + sp.ry * 0.14 * crouch; q.tilt = sp.tilt + (inAir ? -0.12 * Math.sin(PI * u) : 0.1 * crouch);
      q.nP = q.fP = inAir ? 0.55 : 0.22 + 0.35 * crouch; q.nT = q.fT = inAir ? 0.5 * Math.sin(PI * u) : 0; q.tailA = inAir ? -0.25 * Math.sin(PI * u) : 0.15 * crouch;
      q.wingLift = inAir ? 0.35 * Math.sin(PI * u) : 0;
    } else if (pose === 'peck') {
      const per = 1.6, u = o.phase != null ? frac(+o.phase || 0) : frac(t / per + sd * 0.17);
      const down = sstep(0.0, 0.25, u) * (1 - sstep(0.7, 0.92, u)), jab = Math.max(0, Math.sin((u - 0.3) * PI / 0.12)) * (u > 0.3 && u < 0.54 ? 1 : 0);
      q.tilt = sp.tilt + 0.42 * down; q.bx = sp.bx + sp.rx * 0.08 * down; q.by = sp.by + sp.ry * 0.12 * down;
      q.hx = lerp(sp.head[0], sp.head[0] + sp.hr * 1.5, down); q.hy = lerp(sp.head[1], 2 - (sp.hr + sp.beak[0]) * 0.96 - sp.hr * 0.3 * (1 - jab), down); q.hA = lerp(0.05, 1.15, down) + 0.15 * jab;
      q.tailA = 0.1 * down; q.beak = 0.25 * jab;
    } else if (pose === 'coo') {
      const per = 2.2, u = o.phase != null ? frac(+o.phase || 0) : frac(t / per + sd * 0.11), bow = Math.sin(PI * u) * Math.sin(PI * u);
      q.puff = 0.2 + 0.05 * Math.sin(u * TAU * 3); q.hy = sp.head[1] + sp.hr * 0.9 * bow; q.hx = sp.head[0] - sp.hr * 0.3 * bow; q.hA = 0.05 + 0.6 * bow; q.tilt = sp.tilt + 0.12 * bow;
      q.tailA = -0.4 * bow; q.fan = 0.6 * bow; q.lid = 0.3;
    } else if (pose === 'cluck') {
      const u = frac(t * 1.6 + sd * 0.3), k = Math.max(0, Math.sin(u * TAU * 2)) * (u < 0.5 ? 1 : 0);
      q.beak = 0.65 * k; q.hx = sp.head[0] + sp.hr * 0.18 * k; q.hy = sp.head[1] - sp.hr * 0.1 * k; q.hA = -0.15 * k; q.tailA = 0.05 * k;
    } else if (pose === 'caw') {
      const per = 1.7, u = o.phase != null ? frac(+o.phase || 0) : frac(t / per + sd * 0.19), k = Math.sin(PI * clamp((u - 0.1) / 0.5, 0, 1));
      q.beak = 0.9 * k; q.hx = sp.head[0] + sp.hr * 0.35 * k; q.hy = sp.head[1] + sp.hr * 0.25 * k; q.hA = -0.28 * k + 0.08; q.tilt = sp.tilt + 0.12 * k; q.tailA = -0.15 * k; q.wingLift = 0.25 * k; q.puff = 0.06 * k;
    } else if (pose === 'brood') {
      const ch = Math.sin(t * 1.3 + sd);
      q.sit = 1; q.by = -sp.ry * 1.21; q.bx = sp.bx; q.tilt = -0.04; q.puff = 0.12 + 0.01 * br; q.hx = sp.head[0] - sp.hr * 0.2; q.hy = -sp.ry * 1.21 - sp.ry * 1.05; q.hA = 0.08 + 0.05 * ch;
      q.lid = 0.45; q.tailA = 0.1; q.fan = 0.2;
    } else if (pose === 'fly' || pose === 'glide') {
      const rate = (o.speed == null ? 1 : +o.speed || 0) * (kind === 'crow' ? 2.3 : kind === 'pigeon' ? 3.2 : 4.2), p = o.phase != null ? frac(+o.phase || 0) : frac(t * rate + hash((sd | 0) + 9));
      q.fly = 1; q.tuck = 1; q.tilt = -0.05; q.hx = sp.head[0] + sp.hr * 0.6; q.hy = sp.head[1] + sp.hr * 0.55; q.hA = 0.15; q.fan = 0.25;
      if (pose === 'glide') { q.flap = 0.86 + 0.05 * Math.sin(t * 2 + sd); q.fold = 0; q.by = sp.by + sp.ry * 0.05 * Math.sin(t * 2.1 + sd); }
      else {
        // down (0 .. 0.45), then up with the hand folding (0.45 .. 1); the body lifts on the downstroke
        const down = p < 0.45, u = down ? p / 0.45 : (p - 0.45) / 0.55;
        q.flap = down ? lerp(1.35, -1.0, ease(u)) : lerp(-1.0, 1.35, ease(u)); q.fold = down ? 0 : Math.sin(PI * u) * 0.8;
        q.by = sp.by - sp.ry * 0.16 * Math.sin(TAU * (p - 0.05)); q.tilt = -0.05 + 0.05 * Math.sin(TAU * p); q.tailA = 0.08 * Math.sin(TAU * p + 1);
      }
    }
    return q;
  }
  function birdQ(kind, sp, o, t, s) {
    const list = BIRD_POSES[kind], pose = poseName(o, list); let q = birdParams(kind, sp, pose, t, o, s);
    if (o.amount != null && +o.amount < 1) q = blendParams(birdParams(kind, sp, poseName({ pose: o.from || list[0] }, list), t, o, s), q, ease(clamp(+o.amount || 0, 0, 1)));
    if (o.mouth != null) q.beak = clamp(+o.mouth, 0, 1);
    return q;
  }
  // the whole bird's geometry from the pose numbers
  function birdRig(sp, q, look) {
    const k = 1 + q.puff, C = [q.bx, q.by - q.hop], tl = q.tilt, ct = Math.cos(tl), stl = Math.sin(tl);
    const Bp = (x, y) => [C[0] + x * ct - y * stl, C[1] + x * stl + y * ct];
    const rx = sp.rx * (1 + q.puff * 0.4) * (1 + 0.14 * q.fly), ry = sp.ry * k * (1 + q.sit * 0.08) * (1 - 0.14 * q.fly);
    const body = []; const N = 16;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU, c = Math.cos(a), sn = Math.sin(a);
      let f = 1 + (sp.chest + q.puff * 0.8) * Math.pow(Math.max(0, Math.cos(a - 0.55)), 2) - sp.rump * Math.pow(Math.max(0, -c), 3) * 0.6 - 0.08 * Math.pow(Math.max(0, -sn), 3);
      if (sp.fluffy && i % 2) f *= 1.035;
      body.push(Bp(rx * c * f, ry * sn * f));
    }
    const hc = [q.hx, q.hy - q.hop], hr = sp.hr, hA = q.hA + look.y * 0.25;
    const nb = Bp(rx * 0.55, -ry * 0.45), nm = [lerp(nb[0], hc[0], 0.5) - hr * 0.1, lerp(nb[1], hc[1], 0.55)];
    const neck = chainPts([nb, nm, hc], [sp.neckW * 0.62 * k, sp.neckW * 0.5 * (1 + q.puff), hr * 0.82]);
    const head = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; head.push([hc[0] + Math.cos(a) * hr, hc[1] + Math.sin(a) * hr * 0.98]); }
    // legs: hip inside the body, the knee hidden, the ankle (the backwards 'knee') and the scaly part below
    const legs = [];
    for (const far of [true, false]) {
      const bxk = far ? q.fX : q.nX, byk = far ? q.fY : q.nY, phi = far ? q.fP : q.nP, toe = far ? q.fT : q.nT;
      const H = Bp(far ? -rx * 0.12 : -rx * 0.02, ry * 0.32);
      let ball = [bxk + (far ? -4 : 0), -sp.toeW * 0.5 + byk - q.hop], A = [ball[0] - Math.sin(phi) * sp.legM, ball[1] - Math.cos(phi) * sp.legM];
      if (q.tuck > 0) { const Kt = Bp(-rx * 0.05, ry * 0.7), At = [Kt[0] - sp.legM * 0.7, Kt[1] + sp.legM * 0.25]; A = [lerp(A[0], Kt[0], q.tuck), lerp(A[1], Kt[1], q.tuck)]; ball = [lerp(ball[0], At[0], q.tuck), lerp(ball[1], At[1], q.tuck)]; }
      const K = ik(H, A, sp.legT * 0.9, sp.legT, 1);
      legs.push({ H, K, A, ball, toe: toe + q.tuck * 1.2, far });
    }
    // tail: a fan from the rump
    const rump = Bp(-rx * 0.72, ry * 0.02), ta = PI + tl + sp.tail[1] + q.tailA, tlen = sp.tail[0] * (1 - 0.15 * q.sit) + rx * 0.14, spread = sp.tail[2] + q.fan * 0.5, nf = sp.tail[3];
    const tips = []; for (let i = 0; i < nf; i++) { const a = ta + (i / (nf - 1) - 0.5) * spread, ln = tlen * (1 - 0.06 * Math.abs(i / (nf - 1) - 0.5) * 2); tips.push({ p: [rump[0] + Math.cos(a) * ln, rump[1] + Math.sin(a) * ln], o: rump }); }
    const tw = sp.ry * 0.5, tdir = [Math.cos(ta), Math.sin(ta)];
    const tailBase = [[rump[0] + tdir[1] * tw - tdir[0] * 6, rump[1] - tdir[0] * tw - tdir[1] * 6], [rump[0] - tdir[1] * tw - tdir[0] * 6, rump[1] + tdir[0] * tw - tdir[1] * 6]];
    const dd2 = (p, q2) => Math.hypot(p[0] - q2[0], p[1] - q2[1]);
    if (dd2(tips[0].p, tailBase[1]) > dd2(tips[tips.length - 1].p, tailBase[1])) tips.reverse();   // start the tips next to the second base point: no crossing
    const tail = fanPts(tailBase, tips, 0.07, 0.22);
    return { q, C, Bp, rx, ry, body, neck, head, hc, hr, hA, legs, tail, sp };
  }
  // the folded wing lying on the side of the body (body frame), with coverts, wing bars and long flight feathers at the tip
  function foldedWingPts(R, sp, lift) {
    const rx = R.rx, ry = R.ry, w = sp.wing, L1 = w[0], W1 = w[1], Bp = R.Bp, a = -lift * 0.5;
    const P0 = [[0.36, -0.5], [0.1, -0.66], [-0.4, -0.6], [-0.92, -0.42], [-1.3 * L1, -0.18], [-1.4 * L1, -0.04], [-1.18 * L1, 0.05], [-0.68, 0.2 * W1], [-0.18, 0.32 * W1], [0.22, 0.22], [0.42, -0.08]];
    return P0.map(([x, y]) => { const r = rot(x * rx + rx * 0.35, y * ry - ry * 0.12, a); return Bp(r[0] - rx * 0.35, r[1] + ry * 0.12); });
  }
  // a spread wing in flight. The wing turns about the body's long axis by the flap angle ph (radians: +1.4 up, 0 level
  // towards the viewer, -1 down) and is seen from slightly above, so it foreshortens mid-stroke; fold (0..1) bends the hand
  // back on the upstroke. far = the wing on the other side. Returns the scalloped outline, the tips' inner line, feather lines.
  const WING_EL = 0.45;
  // a spread wing in flight: it turns about the body's long axis by the flap angle ph (+1.35 up, 0 level, -1 down), seen
  // from slightly above so it foreshortens on the downstroke; on the upstroke (fold 0..1) it folds back into a raised,
  // bent wing (as cartoon birds do) instead of passing edge-on. far = the wing on the other side.
  function wingPts(S, span, chord, ph, fold, far) {
    const zs = far ? -1 : 1, sy = Math.sin(ph), cz = Math.cos(ph) * zs, vUp = sy * Math.cos(WING_EL) - cz * Math.sin(WING_EL);
    const vp = [span * -0.11, -span * vUp], vf = [span * 0.62 * -0.86, span * 0.62 * -0.5], f = clamp(fold, 0, 1);
    const v = [lerp(vp[0], vf[0], f), lerp(vp[1], vf[1], f)], c = [-chord * (1 - 0.25 * f), 0];
    if (far) { S = [S[0] - chord * 0.14, S[1] - chord * 0.08]; }
    const P = (a, b2, bk) => [S[0] + v[0] * a + c[0] * b2 - (bk || 0) * f * chord * 0.5, S[1] + v[1] * a + c[1] * b2];
    const base = [P(-0.05, 0.78), P(-0.04, -0.06), P(0.45, -0.1), P(0.78, -0.03, 0.3)];
    const tipsDef = [[1.0, 0.1, 0.9], [0.96, 0.32, 0.8], [0.88, 0.52, 0.6], [0.77, 0.68, 0.4], [0.6, 0.8, 0.1], [0.4, 0.86, 0], [0.2, 0.84, 0]];
    const rootDef = [[0.74, 0.12], [0.7, 0.2], [0.64, 0.28], [0.56, 0.34], [0.45, 0.4], [0.3, 0.42], [0.15, 0.42]];
    const tips = tipsDef.map(([a, b2, bk], i) => ({ p: P(a, b2, bk), o: P(rootDef[i][0], rootDef[i][1]) }));
    const F = fanPts(base, tips, 0.1, 0.34); F.lead = [P(0.3, -0.08), P(0.62, -0.08), P(0.78, -0.03, 0.3)];
    return F;
  }
  function spreadWing(R, sp, ph, fold, far) { return wingPts(R.Bp(R.rx * 0.3, -R.ry * 0.5), R.rx * 1.6 * sp.wing[0], R.ry * 1.5, ph, fold, far); }
  function birdPal(kind, o, sil) {
    let def = BIRD_SP[kind].col;
    if (kind === 'smallBird') { const v = o.variant, key = typeof v === 'number' ? SMALL_ORDER[((v | 0) % SMALL_ORDER.length + SMALL_ORDER.length) % SMALL_ORDER.length] : (SMALL_VARIANTS[v] ? v : 'blue'); def = Object.assign({}, def, SMALL_VARIANTS[key]); }
    const pal = palette(def, o.colors, sil);
    pal.shade = dk(pal.body, 0.18); pal.far = dk(pal.body, 0.22); pal.legFar = dk(pal.leg, 0.25); pal.bellyShade = mix(pal.belly, pal.body, 0.45); pal.lid = pal.head;
    pal.wingShade = dk(pal.wing, 0.15); pal.headShade = dk(pal.head, 0.15);
    return pal;
  }
  function birdDraw(kind, ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const sp = BIRD_SP[kind], st = setup(ctx, x, y, s, o, sp.H, [sp.bx, sp.by]), pal = birdPal(kind, o, st.sil), m = moodOf(o);
    const lk = lookOf(o, t, st.seed + 5), q = birdQ(kind, sp, o, t, s), R = birdRig(sp, q, lk);
    if (o.shadow !== false && !q.fly) groundShadow(ctx, sp.bx + 4, sp.rx * (q.sit ? 1.7 : 1.15) * (1 - 0.4 * clamp(q.hop / sp.H, 0, 1)), o.shadow == null ? 1 : +o.shadow, st.sil);
    if (q.sit > 0.5 && o.nest !== false) nest(ctx, sp.bx + 4, 0, sp.rx / 110, Object.assign({ layer: 'back', count: o.count == null ? 3 : o.count, seed: o.seed, silhouette: st.sil, _k: st.s }, o.nestOpts || {}));
    const lw = st.lw;
    // far wing (flight), far leg, tail
    if (q.fly) { const F = spreadWing(R, sp, q.flap, q.fold, true); partPts(st, [F.pts], pal.wingShade); if (!st.flat && st.lod) fillPts(st, fanTipPts(F, 4), dk(pal.wingDark, 0.1)); }
    if (q.sit < 0.5 && q.tuck < 0.5) { birdLeg(st, R.legs[0], sp, pal, true, q.curl); birdLeg(st, R.legs[1], sp, pal, false, q.curl); }
    partPts(st, [R.tail.pts], pal.tail);
    if (!st.flat && st.lod) { fillPts(st, fanTipPts(R.tail, 2), pal.tailBand); if (st.lod === 2) birdLines(st, R.tail.lines, dk(pal.tail, 0.25)); }
    // comb behind the head (hen)
    if (kind === 'hen') henComb(st, R, pal, false);
    // body, neck and head: one silhouette
    partPts(st, [R.body, R.neck, R.head], pal.body);
    if (!st.flat && st.det > 0.03) birdBodyDetails(kind, st, R, sp, pal, q);
    // the folded wing
    if (!q.fly) birdFoldedWing(kind, st, R, sp, pal, q);
    if (kind === 'hen') henComb(st, R, pal, true);
    birdHead(kind, st, R, sp, pal, q, m, lk, t, o);
    if (q.fly) { const F = spreadWing(R, sp, q.flap, q.fold, false); partPts(st, [F.pts], pal.wing); if (!st.flat && st.lod) { fillPts(st, fanTipPts(F, 4), pal.wingDark); if (st.lod === 2) birdLines(st, F.lines, dk(pal.wing, 0.3)); } }
    if (q.sit > 0.5 && o.nest !== false) nest(ctx, sp.bx + 4, 0, sp.rx / 110, Object.assign({ layer: 'front', count: o.count == null ? 3 : o.count, seed: o.seed, silhouette: st.sil, _k: st.s }, o.nestOpts || {}));
    void lw;
    finish(st, ctx);
  }
  function birdLines(st, lines, col) {
    const ctx = st.ctx; ctx.strokeStyle = col; ctx.lineWidth = Math.max(st.lw * 0.5, 1.2 / st.s); ctx.beginPath();
    for (const [a, b] of lines) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
  }
  // a stick leg: from the hidden knee through the ankle to the foot, three toes forward and one back (curl wraps a perch)
  function birdLeg(st, L_, sp, pal, far, curl) {
    if (st.flat) { const p = new Path2D(); closedPath(p, chainPts([L_.K, L_.A, L_.ball], [sp.toeW, sp.toeW * 0.6, sp.toeW * 0.5])); st.all.addPath(p); return; }
    const ctx = st.ctx, w = sp.toeW * 0.62, B = L_.ball, a0 = L_.toe, f = sp.foot, c = curl || 0, p = new Path2D();
    p.moveTo(L_.K[0], L_.K[1]); p.lineTo(L_.A[0], L_.A[1]); p.lineTo(B[0], B[1]);
    const toes = [[-0.32 - 0.5 * c, 0.78], [0.04 + 0.2 * c, 1], [PI - 0.25 + 0.4 * c, 0.5]];
    for (const [ta, tl] of toes) {
      const a = a0 + ta, len = f * tl;
      if (c > 0.05) { const m = [B[0] + Math.cos(a) * len * 0.55, B[1] + Math.sin(a) * len * 0.55], e = [B[0] + Math.cos(a + 1.2 * c * Math.sign(Math.cos(a))) * len * 0.9, B[1] + Math.sin(a + 1.2 * c * Math.sign(Math.cos(a))) * len * 0.9 + len * 0.35 * c]; p.moveTo(B[0], B[1]); p.quadraticCurveTo(m[0] + Math.cos(a) * len * 0.3, m[1], e[0], e[1]); }
      else { p.moveTo(B[0], B[1]); p.lineTo(B[0] + Math.cos(a) * len, B[1] + Math.sin(a) * len); }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = st.ink; ctx.lineWidth = w + st.lw * 2; ctx.stroke(p);
    ctx.strokeStyle = far ? pal.legFar : pal.leg; ctx.lineWidth = w; ctx.stroke(p);
    if (st.lod === 2 && !far) {   // scales on the scaly part
      ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = Math.max(1, st.lw * 0.35); ctx.beginPath();
      for (let i = 1; i <= 3; i++) { const t2 = i / 4, x = lerp(L_.A[0], B[0], t2), y = lerp(L_.A[1], B[1], t2); ctx.moveTo(x - w * 0.45, y - 1); ctx.lineTo(x + w * 0.45, y + 1); }
      ctx.stroke();
    }
  }
  function birdFoldedWing(kind, st, R, sp, pal, q) {
    const ctx = st.ctx, W = foldedWingPts(R, sp, q.wingLift);
    partPts(st, [W], pal.wing);
    if (st.flat || st.det < 0.05 || !st.lod) return;
    // flight feathers at the tip (darker), the coverts' scallops, the wing bars or streaks
    const n = W.length, tip = [W[3], W[4], W[5], W[6], W[7]], inner = [lerp(W[3][0], W[8][0], 0.42), lerp(W[3][1], W[8][1], 0.42)];
    fillPts(st, [W[3], W[4], W[5], W[6], [lerp(W[6][0], W[7][0], 0.6), lerp(W[6][1], W[7][1], 0.6)], inner].map((p, i) => i === 0 ? [lerp(p[0], W[2][0], 0.2), lerp(p[1], W[2][1], 0.2)] : p), pal.wingDark);
    void tip; void n;
    const Bp = R.Bp, rx = R.rx, ry = R.ry;
    if (kind === 'pigeon') {   // two dark bars across the wing
      for (const fx of [-0.42, -0.68]) fillPts(st, [Bp(rx * fx + rx * 0.06, -ry * 0.44), Bp(rx * fx + rx * 0.14, -ry * 0.42), Bp(rx * fx + rx * 0.06, -ry * 0.05), Bp(rx * fx - rx * 0.02, ry * 0.12), Bp(rx * fx - rx * 0.08, ry * 0.1), Bp(rx * fx - rx * 0.01, -ry * 0.08)], pal.bar);
    }
    if (kind === 'sparrow') {
      ctx.fillStyle = pal.streak; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Bp(rx * (0.25 - i * 0.16), -ry * (0.42 - (i % 2) * 0.12)); ctx.moveTo(a[0] + 3.2, a[1]); ctx.ellipse(a[0], a[1], 6, 2.2, R.q.tilt + 0.25, 0, TAU); }
      ctx.fill();
      fillPts(st, [Bp(rx * 0.1, -ry * 0.18), Bp(rx * 0.16, -ry * 0.12), Bp(-rx * 0.3, ry * 0.0), Bp(-rx * 0.34, -ry * 0.06)], pal.bar);
    }
    if (st.lod === 2) {   // coverts: a row of small scallops
      ctx.strokeStyle = rgba(dk(pal.wing, 0.35), 0.8); ctx.lineWidth = Math.max(1, st.lw * 0.45); ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = Bp(rx * (0.32 - i * 0.2), ry * 0.0), b = Bp(rx * (0.22 - i * 0.2), ry * 0.12); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2 + 3, b[0], b[1]); }
      ctx.stroke();
    }
    if (kind === 'crow' && st.lod) { ctx.strokeStyle = rgba(pal.sheen, 0.45); ctx.lineWidth = ry * 0.12; ctx.beginPath(); const a = Bp(rx * 0.2, -ry * 0.5), b = Bp(-rx * 0.7, -ry * 0.35); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - ry * 0.12, b[0], b[1]); ctx.stroke(); }
  }
  function birdBodyDetails(kind, st, R, sp, pal, q) {
    const ctx = st.ctx, Bp = R.Bp, rx = R.rx, ry = R.ry;
    // a lighter breast and belly, a shadow along the underside, a soft highlight on the back
    const b = R.body, n = b.length;   // body points: 0 front, 4 bottom, 8 back, 12 top
    const bellyPts = [b[0], b[1], b[2], b[3], b[4], b[5], b[6], Bp(-rx * 0.45, ry * 0.25), Bp(0, ry * 0.18), Bp(rx * 0.5, -ry * 0.05)];
    fillPts(st, bellyPts, pal.belly);
    const c = crescentPts(R.body, ry * 0.16, null, st.lw * 0.25, 0.35, 0.9); if (c) fillPts(st, c, kind === 'crow' ? pal.shade : pal.bellyShade);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = ry * 0.14; ctx.beginPath(); const h0 = Bp(rx * 0.35, -ry * 0.72), h1 = Bp(-rx * 0.45, -ry * 0.68); ctx.moveTo(h0[0], h0[1]); ctx.quadraticCurveTo((h0[0] + h1[0]) / 2, (h0[1] + h1[1]) / 2 - ry * 0.12, h1[0], h1[1]); ctx.stroke();
    void n;
    if (kind === 'pigeon') {   // the shiny green and purple neck
      const hc = R.hc, nb = Bp(rx * 0.55, -ry * 0.45), mid = [lerp(nb[0], hc[0], 0.45), lerp(nb[1], hc[1], 0.45)], dx = hc[0] - nb[0], dy = hc[1] - nb[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, w = sp.neckW * 0.42 * (1 + q.puff);
      const patch = (f0, f1, ww) => { const a = [lerp(nb[0], hc[0], f0), lerp(nb[1], hc[1], f0)], b2 = [lerp(nb[0], hc[0], f1), lerp(nb[1], hc[1], f1)]; return [[a[0] - uy * ww, a[1] + ux * ww], [b2[0] - uy * ww * 0.9, b2[1] + ux * ww * 0.9], [b2[0] + uy * ww * 0.9, b2[1] - ux * ww * 0.9], [a[0] + uy * ww, a[1] - ux * ww]]; };
      fillPts(st, patch(0.05, 0.42, w * 1.05), pal.shine2); fillPts(st, patch(0.35, 0.72, w * 0.95), pal.shine1);
      void mid;
    }
    if (kind === 'sparrow' && st.lod) {   // a few streaks on the back
      ctx.fillStyle = pal.streak; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = Bp(rx * (0.35 - i * 0.2), -ry * 0.62); ctx.moveTo(a[0] + 4, a[1]); ctx.ellipse(a[0], a[1], 5, 2, R.q.tilt + 0.3, 0, TAU); }
      ctx.fill();
    }
    if (kind === 'crow' && st.lod) { ctx.strokeStyle = rgba(pal.sheen, 0.35); ctx.lineWidth = R.hr * 0.25; ctx.beginPath(); ctx.arc(R.hc[0], R.hc[1], R.hr * 0.62, -2.6, -1.2); ctx.stroke(); }
    if (sp.fluffy && st.lod) {   // a few fluffy feather tufts on the breast
      ctx.strokeStyle = rgba(pal.bellyShade, 0.9); ctx.lineWidth = Math.max(1, st.lw * 0.5); ctx.beginPath();
      for (let i = 0; i < 4; i++) { const a = Bp(rx * (0.62 - i * 0.12), ry * (0.05 + i * 0.16)); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + 6, a[1] + 5, a[0] + 2, a[1] + 11); }
      ctx.stroke();
    }
  }
  function henComb(st, R, pal, front) {
    const hc = R.hc, hr = R.hr, a = R.hA, P_ = (x, y) => { const r = rot(x, y, a); return [hc[0] + r[0], hc[1] + r[1]]; };
    if (!front) {
      const comb = [[-hr * 0.55, -hr * 0.6], [-hr * 0.7, -hr * 1.05], [-hr * 0.38, -hr * 1.2], [-hr * 0.15, -hr * 1.0], [hr * 0.02, -hr * 1.45], [hr * 0.35, -hr * 1.12], [hr * 0.55, -hr * 1.3], [hr * 0.8, -hr * 0.95], [hr * 0.7, -hr * 0.6]].map(p => P_(p[0], p[1]));
      partPts(st, [comb], pal.comb);
    } else {
      const wat = [[hr * 0.62, hr * 0.38], [hr * 0.95, hr * 0.42], [hr * 1.02, hr * 0.85], [hr * 0.8, hr * 1.15], [hr * 0.55, hr * 0.85]].map(p => P_(p[0], p[1]));
      partPts(st, [wat], pal.comb);
    }
  }
  function birdHead(kind, st, R, sp, pal, q, m, lk, t, o) {
    const ctx = st.ctx, hc = R.hc, hr = R.hr, a = R.hA, P_ = (x, y) => { const r = rot(x, y, a); return [hc[0] + r[0], hc[1] + r[1]]; };
    const [bl, bh, hook] = sp.beak, open = q.beak;
    // beak: upper and lower halves hinged at the head
    const bx0 = hr * 0.72, upper = [[bx0 - 2, -bh * 0.55], [bx0 + bl * 0.55, -bh * 0.42], [bx0 + bl, bh * (0.04 + hook * 0.4)], [bx0 + bl * 0.6, bh * 0.12], [bx0 - 2, bh * 0.15]].map(p => P_(p[0], p[1]));
    const ja = open * 0.55, lower = [[bx0 - 2, bh * 0.12], [bx0 + bl * 0.82, bh * 0.14], [bx0 + bl * 0.6, bh * 0.42], [bx0 - 2, bh * 0.5]].map(p => { const r = rot(p[0] - bx0, p[1] - bh * 0.12, ja); return P_(bx0 + r[0], bh * 0.12 + r[1]); });
    if (open > 0.05 && !st.flat) fillPts(st, cw([upper[4], upper[3], upper[2], lower[1], lower[0]]), '#8E3346');
    partPts(st, [lower], dk(pal.beak, 0.12)); partPts(st, [upper], pal.beak);
    if (st.flat || st.det < 0.05) return;
    if (kind === 'pigeon' && st.lod) { const cp = [[bx0 + 1, -bh * 0.62], [bx0 + bl * 0.36, -bh * 0.62], [bx0 + bl * 0.4, -bh * 0.2], [bx0 + 2, -bh * 0.12]].map(p => P_(p[0], p[1])); fillPts(st, cw(cp), pal.cere); }
    if (kind === 'sparrow') {   // grey cap, pale cheek, dark eye stripe and bib
      fillPts(st, cw([[-hr * 0.2, -hr * 0.2], [hr * 0.55, hr * 0.0], [hr * 0.55, hr * 0.6], [-hr * 0.1, hr * 0.75], [-hr * 0.55, hr * 0.35]].map(p => P_(p[0], p[1]))), pal.cheekW);
      fillPts(st, cw([[hr * 0.42, hr * 0.5], [hr * 0.72, hr * 0.42], [hr * 0.5, hr * 0.95], [hr * 0.15, hr * 0.92]].map(p => P_(p[0], p[1]))), INK);
      fillPts(st, cw([[-hr * 0.9, -hr * 0.1], [-hr * 0.6, -hr * 0.75], [hr * 0.1, -hr * 0.98], [hr * 0.55, -hr * 0.68], [hr * 0.2, -hr * 0.42], [-hr * 0.45, -hr * 0.25]].map(p => P_(p[0], p[1]))), mix(pal.head, '#B1835A', 0.0));
    }
    if (m.smile > 0 && st.lod) { const ch = P_(hr * 0.18, hr * 0.42); ctx.fillStyle = rgba(pal.cheek, 0.55 * st.det); ctx.beginPath(); ctx.ellipse(ch[0], ch[1], hr * 0.24, hr * 0.14, a, 0, TAU); ctx.fill(); }
    const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 4);
    const e = P_(hr * 0.2, -hr * 0.2), er = hr * (kind === 'hen' ? 0.32 : kind === 'sparrow' || kind === 'smallBird' ? 0.34 : 0.36);
    ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(a * 0.4);
    eye(st, 0, 0, er, { lid: Math.max(q.lid >= 0 ? q.lid : m.lid, blink, q.closed ? 1 : 0), low: m.low, lx: lk.x, ly: lk.y, skin: pal.lid, iris: kind === 'crow' || kind === 'sparrow' || kind === 'smallBird' ? null : pal.iris, pup: kind === 'pigeon' ? 0.5 : m.pup, wide: m.wide });
    if (m.bUp > 0.5 || m.bTilt > 0.3) brow(st, 0, 0, er, m.bUp, m.bTilt, pal.headShade, er * 0.22);
    ctx.restore();
  }
  function pigeon(ctx, x, y, s, t, o) { birdDraw('pigeon', ctx, x, y, s, t, o); }
  function hen(ctx, x, y, s, t, o) { birdDraw('hen', ctx, x, y, s, t, o); }
  function crow(ctx, x, y, s, t, o) { birdDraw('crow', ctx, x, y, s, t, o); }
  function sparrow(ctx, x, y, s, t, o) { birdDraw('sparrow', ctx, x, y, s, t, o); }
  function smallBird(ctx, x, y, s, t, o) { birdDraw('smallBird', ctx, x, y, s, t, o); }

  // ----- a nest with eggs. (x, y) = the bottom of the nest; s = 1: about 240 wide. o: count (eggs, 0..7), layer: 'back' | 'front'
  // (two calls put a creature between them; no layer draws both), kind: 'straw' (bird nest) | 'mound' (dinosaur nest), eggColor, seed
  function nest(ctx, x, y, s, o) {
    o = o || {}; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 90, [-1, -49]), mound = o.kind === 'mound', w = 120, layer = o.layer;
    const col = mound ? { a: '#A07A55', b: '#7E5C3E', c: '#C29A70' } : { a: '#D9B26A', b: '#A87B3E', c: '#F0D38A' };
    const pal = palette(col, null, st.sil), eggC = st.sil ? mix(o.eggColor || '#FFF6E6', SIL, st.sil) : (o.eggColor || (mound ? '#EFE3CF' : '#FFF6E6'));
    const n = clamp(o.count == null ? 3 : +o.count | 0, 0, 7);
    if (layer !== 'front') {
      // the far rim and the hollow, then the eggs
      partPts(st, [[[-w, -48], [-w * 0.6, -70], [0, -76], [w * 0.6, -70], [w, -48], [w * 0.5, -40], [-w * 0.5, -40]]], pal.b);
      const nb = mound ? Math.ceil(n / 2) : n, xs = nb === 1 ? [0] : Array.from({ length: nb }, (_, i) => lerp(-w * 0.62, w * 0.62, i / (nb - 1)));
      for (let i = 0; i < nb; i++) egg(ctx, xs[i] * (1 - 0.05 * (i % 2)), (mound ? -46 : -34) - (i % 2) * 10, mound ? 0.82 : 0.9, { color: eggC, rot: (i - (nb - 1) / 2) * 0.12, seed: i + (o.seed | 0), spots: mound ? 0 : 1, silhouette: st.sil, _k: st.s, long: mound });
    }
    if (layer !== 'back') {
      const front = [[-w * 1.06, -52], [-w * 0.75, -38], [0, -32], [w * 0.75, -38], [w * 1.06, -52], [w * 1.02, -18], [w * 0.62, 2], [0, 6], [-w * 0.62, 2], [-w * 1.02, -18]];
      partPts(st, [front], pal.a);
      if (mound) { const nf = Math.floor(n / 2), xs = nf === 1 ? [0] : Array.from({ length: nf }, (_, i) => lerp(-w * 0.75, w * 0.75, i / Math.max(1, nf - 1))); for (let i = 0; i < nf; i++) egg(ctx, xs[i], -14 + (i % 2) * 6, 0.82, { color: eggC, rot: (i - (nf - 1) / 2) * 0.14, seed: 40 + i + (o.seed | 0), spots: 0, silhouette: st.sil, _k: st.s, long: true }); }
      if (!st.flat && st.lod) {   // twigs or a mud texture
        const ctx2 = st.ctx, r = L.rng(5 + (o.seed | 0)); ctx2.strokeStyle = pal.b; ctx2.lineWidth = mound ? 5 : 4; ctx2.beginPath();
        for (let i = 0; i < (mound ? 6 : 12); i++) { const px = (r() * 2 - 1) * w * 0.82, py = -26 + r() * 24, a = (r() - 0.5) * 0.7, ln = mound ? 10 : 22 + r() * 18; ctx2.moveTo(px - Math.cos(a) * ln / 2, py - Math.sin(a) * ln / 2); ctx2.lineTo(px + Math.cos(a) * ln / 2, py + Math.sin(a) * ln / 2); }
        ctx2.stroke();
        if (!mound) { ctx2.strokeStyle = pal.c; ctx2.beginPath(); for (let i = 0; i < 6; i++) { const px = (r() * 2 - 1) * w * 0.7, py = -20 + r() * 18, a = (r() - 0.5) * 0.6; ctx2.moveTo(px - Math.cos(a) * 14, py - Math.sin(a) * 14); ctx2.lineTo(px + Math.cos(a) * 14, py + Math.sin(a) * 14); } ctx2.stroke(); }
      }
    }
    finish(st, ctx);
  }
  // ----- an egg standing on its fat end at (x, y); s = 1: about 70 tall. o: color, spots (0..1), rot, crack (0..1), stone (0..1: a fossil egg), seed
  function egg(ctx, x, y, s, o) {
    o = o || {}; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 70, [0, -34]);
    if (o.rot) ctx.rotate(+o.rot || 0);
    const stone = clamp(+o.stone || 0, 0, 1), base = mix(o.color || '#FFF6E6', STONE, stone), c = st.sil ? mix(base, SIL, st.sil) : base;
    const pts = o.long ? [[0, 0], [-20, -6], [-26, -34], [-18, -66], [0, -80], [18, -66], [26, -34], [20, -6]] : [[0, 0], [-24, -6], [-31, -30], [-22, -56], [0, -68], [22, -56], [31, -30], [24, -6]];
    partPts(st, [pts], c);
    if (!st.flat && st.det > 0.05) {
      fillPts(st, crescentPts(pts, 7, null, st.lw * 0.25), dk(c, 0.1));
      if (st.lod) { st.ctx.fillStyle = 'rgba(255,255,255,0.5)'; st.ctx.beginPath(); st.ctx.ellipse(-11, -44, 5, 10, 0.35, 0, TAU); st.ctx.fill(); }
      if ((o.spots == null ? 1 : +o.spots) > 0 && st.lod) { const r = L.rng(3 + (o.seed | 0)); st.ctx.fillStyle = rgba(stone ? STONE_D : '#B98E5E', 0.45); st.ctx.beginPath(); for (let i = 0; i < 5; i++) { const px = (r() - 0.5) * 34, py = -12 - r() * 46, rr = 1.6 + r() * 2.2; st.ctx.moveTo(px + rr, py); st.ctx.arc(px, py, rr, 0, TAU); } st.ctx.fill(); }
      if (o.crack > 0) { const k = clamp(+o.crack, 0, 1); st.ctx.strokeStyle = st.ink; st.ctx.lineWidth = st.lw * 0.8; st.ctx.beginPath(); st.ctx.moveTo(-26, -30); st.ctx.lineTo(-14, -38 * k - 4); st.ctx.lineTo(-4, -28); st.ctx.lineTo(8, -40 * k); st.ctx.lineTo(18, -30); st.ctx.lineTo(28, -36); st.ctx.stroke(); }
    }
    finish(st, ctx);
  }

  // =================================================================================================================
  // THE SMALL FEATHERED DINOSAUR and its morph into a bird (Ep15 "little by little"). bird = 0: a turkey-sized feathered
  // theropod (snout with small teeth, clawed hands, short arm feathers, long bony tail feathered at the end); 0.5: an
  // Archaeopteryx-like animal (wings with three clawed fingers, teeth, a long bony tail feathered all along); 1: a pigeon-like
  // bird (beak, no teeth, no hand claws, a short fan tail). Every number below morphs smoothly with `bird`.
  // Local frame: ground at y = 0, facing +x. s = 1: about 300 tall and 560 long at bird = 0 (the size stays about the same).
  // =================================================================================================================
  const FD_K = {   // [bird = 0, 0.5, 1]
    hipY: [-168, -158, -112], pitch: [0.02, -0.04, -0.24], back: [64, 60, 58], shoulder: [120, 112, 112],
    dS: [24, 28, 48], vS: [42, 46, 64], dB: [30, 32, 60], vB: [62, 64, 86], dSh: [28, 28, 54], vSh: [56, 58, 78],
    n0: [32, 30, 22], n1: [28, 26, 19], n2: [26, 24, 17], na0: [-0.75, -0.85, -1.15], na1: [-1.05, -1.1, -1.25], na2: [-0.55, -0.6, -0.7],
    nd: [20, 22, 41], nv: [26, 28, 48], hr: [28, 29, 40], snout: [62, 56, 0], snoutH: [34, 32, 30], beak: [0, 0, 1], teeth: [1, 1, 0],
    tailK: [0.86, 0.95, 0.1], tailD: [22, 22, 46], tailF0: [0.55, 0.06, 0.0], tailFL: [52, 82, 88], tailFA: [0.42, 0.62, 0.09], tailFS: [0.12, 0.04, 0.12],
    armA: [36, 42, 52], armB: [34, 44, 50], armC: [26, 36, 46], armFL: [46, 104, 100], claws: [1, 1, 0], wingK: [0, 1, 1], armVis: [1, 0.15, 0],
    femur: [72, 68, 38], tibia: [86, 82, 42], meta: [60, 56, 32], legW: [15, 13, 11], thighR: [38, 34, 30], foot: [36, 34, 36], crest: [1, 0.8, 0], shine: [0, 0, 1]
  };
  const FD_C = {   // colours at bird = 0, 0.5 and 1
    body: ['#C97B4A', '#B9804F', '#9AA5B1'], belly: ['#E8B98F', '#E2C29E', '#B7C0CA'], feather: ['#A65E36', '#93603F', '#A9B3BE'], tip: ['#3FA7A3', '#3FA7A3', '#5C6672'],
    head: ['#C97B4A', '#B9804F', '#7D8996'], leg: ['#A65F36', '#B26B4E', '#E2737E'], beak: ['#4A4F58', '#4A4F58', '#4A4F58'], claw: ['#F4EAD6', '#F4EAD6', '#F4EAD6']
  };
  const FD_POSES = ['idle', 'walk', 'run', 'flap', 'brood'];
  function fdk(b, key) { const a = FD_K[key], u = clamp(b, 0, 1) * 2, i = u >= 1 ? 1 : 0, f = ease(u - i); return a[i] + (a[i + 1] - a[i]) * f; }
  function fdc(b, key, over) { const a = (over && over[key] && [over[key], over[key], over[key]]) || FD_C[key], u = clamp(b, 0, 1) * 2, i = u >= 1 ? 1 : 0; return mix(a[i], a[i + 1], ease(u - i)); }
  const FD_GAIT = { walk: { stride: 220, duty: 0.6, lift: 40, rate: 1.0 }, run: { stride: 430, duty: 0.36, lift: 64, rate: 2.0 } };
  function fdParams(b, pose, t, o, s) {
    const sd = o.seed || 0, br = Math.sin(t * 2.4 + sd), K = key => fdk(b, key);
    const q = { hx: 0, hy: K('hipY') + br * 2, pitch: K('pitch'), br, tR: 0.13, tC: -0.032, tW: 0.05, tP: t * 2 + sd, hA: 0.08 + br * 0.01, nR: 0, jaw: 0,
      nX: 22, nY: 0, nP: 0.42, nT: 0, fX: -16, fY: 0, fP: 0.46, fT: 0, flap: 0, fold: 0, wing: 0, sit: 0, lid: -1, armUp: 0 };
    if (pose === 'walk' || pose === 'run') {
      const run = pose === 'run', g = FD_GAIT[pose], p = phaseOf(o, t, g, s), fn = bipedFoot(p, g), ff = bipedFoot(frac(p + 0.5), g);
      q.nX = 18 + fn.x; q.nY = fn.y; q.fX = 6 + ff.x; q.fY = ff.y;
      const ank = f => f.st ? 0.4 + 0.6 * sstep(0.5, 1, f.u) : lerp(1.05, 0.3, sstep(0, 0.5, f.u)), toe = f => f.st ? 0 : 0.8 * Math.sin(PI * Math.min(1, f.u * 1.1));
      q.nP = ank(fn); q.fP = ank(ff); q.nT = toe(fn); q.fT = toe(ff);
      q.hy = K('hipY') + (run ? 10 : 5) * Math.cos(4 * PI * (p - 0.12)); q.pitch = K('pitch') + (run ? 0.14 : 0.03) + 0.015 * Math.sin(4 * PI * p);
      q.hA = (run ? 0.2 : 0.1) + 0.05 * Math.cos(4 * PI * (p - 0.25)); q.tP = 4 * PI * p + sd; q.tW = run ? 0.04 : 0.07; q.nR = run ? -0.3 : 0;
      q.armUp = run ? 0.3 : 0.12 * Math.sin(TAU * p);
    } else if (pose === 'flap') {
      const rate = 2.6 * (o.speed == null ? 1 : +o.speed || 0), p = o.phase != null ? frac(+o.phase || 0) : frac(t * rate + hash((sd | 0) + 4)), down = p < 0.45, u = down ? p / 0.45 : (p - 0.45) / 0.55;
      q.wing = 1; q.flap = down ? lerp(1.35, -0.9, ease(u)) : lerp(-0.9, 1.35, ease(u)); q.fold = down ? 0 : Math.sin(PI * u) * 0.7;
      q.hy = K('hipY') - 8 * Math.sin(TAU * (p - 0.05)); q.pitch = K('pitch') - 0.06; q.hA = 0.0; q.tR = 0.12; q.lid = 0;
    } else if (pose === 'brood') {
      q.sit = 1; q.hy = -92 + br * 2; q.pitch = -0.1 + 0.02 * b; q.tR = -0.12; q.tC = 0.03; q.hA = 0.14; q.lid = 0.38;
      q.nX = 30; q.nP = 1.45; q.fX = 20; q.fP = 1.45;
    }
    return q;
  }
  function fdRig(b, q, look) {
    const K = key => fdk(b, key), c = Math.cos(q.pitch), sn = Math.sin(q.pitch);
    const Lf = K('femur'), Lt = K('tibia'), Lm = K('meta'), reach = (Lf + Lt) * 0.97;
    const footOf = (bx, by, phi) => { const ball = [bx, -K('legW') * 0.45 + by]; return { ball, A: [ball[0] - Math.sin(phi) * Lm, ball[1] - Math.cos(phi) * Lm] }; };
    const fF = footOf(q.fX, q.fY, q.fP), fN = footOf(q.nX, q.nY, q.nP);
    let hy = q.hy; if (!q.sit) for (const [f, by] of [[fF, q.fY], [fN, q.nY]]) if (by > -6) { const dx = f.A[0] - q.hx; if (Math.abs(dx) < reach) hy = Math.max(hy, f.A[1] - Math.sqrt(reach * reach - dx * dx)); }
    q = Object.assign({}, q, { hy });
    const B = (dx, dy) => [q.hx + dx * c - dy * sn, q.hy + dx * sn + dy * c];
    const sac = B(-4, -24), back = B(K('back'), -28), sh = B(K('shoulder'), -22);
    const tk = K('tailK'), TL = [40, 38, 36, 34, 32, 30, 28, 26].map(l => l * tk), tail = []; let p = sac;
    for (let k = 0; k < TL.length; k++) { const a = PI + q.pitch * 0.5 + q.tR + q.tC * k + q.tW * Math.sin(q.tP - k * 0.6) * (k + 1) / 5; p = [p[0] + Math.cos(a) * TL[k], p[1] + Math.sin(a) * TL[k]]; tail.push(p); }
    const neck = []; p = sh; const nL = [K('n0'), K('n1'), K('n2')], nA = [K('na0'), K('na1'), K('na2')];
    for (let k = 0; k < 3; k++) { const a = q.pitch * 0.5 + nA[k] - q.nR * (k + 1) / 3 + look.y * 0.12; p = [p[0] + Math.cos(a) * nL[k], p[1] + Math.sin(a) * nL[k]]; neck.push(p); }
    const sp = tail.slice().reverse().concat([sac, back, sh], neck);
    const td = K('tailD'), brk = 1 + 0.03 * q.br, d = [], v = [];
    for (let k = 0; k < 8; k++) { const f = k / 7; d.push(4 + td * 0.85 * Math.pow(f, 1.1)); v.push(4 + td * Math.pow(f, 1.1)); }
    d.push(K('dS'), K('dB'), K('dSh'), K('nd'), K('nd') * 0.9, K('nd') * 0.85); v.push(K('vS'), K('vB') * brk, K('vSh') * brk, K('nv'), K('nv') * 0.85, K('nv') * 0.8);
    const head = { x: neck[2][0], y: neck[2][1], a: q.hA + q.pitch * 0.3 + look.y * 0.22 };
    const leg = (f, toe, far) => { const H = far ? [q.hx - 8, q.hy - 3] : [q.hx, q.hy]; return { H, K: ik(H, f.A, Lf, Lt, 1), A: f.A, ball: f.ball, toe, far }; };
    return { q, b, sp, d, v, sac, sh, tail, neck, head, legs: [leg(fF, q.fT, true), leg(fN, q.nT, false)], B };
  }
  // the arm: shoulder, elbow, wrist, hand tip; it folds from a forward-reaching dinosaur arm (bird 0) into a folded wing
  function fdArm(R, far, wForce) {
    const b = R.b, q = R.q, K = key => fdk(b, key), w = wForce == null ? K('wingK') : wForce, up = q.armUp;
    const S = R.B(K('shoulder') - 22 - (far ? 8 : 0), 10 - (far ? 4 : 0));
    const aE = lerp(1.85 - up, 2.5, w) + q.pitch, E = add(S, dirv(aE), K('armA'));
    const aW = lerp(0.45 - up, -0.42, w) + q.pitch, Wr = add(E, dirv(aW), K('armB'));
    const aH = lerp(0.95 - up * 0.5, 2.92, w) + q.pitch, Ht = add(Wr, dirv(aH), K('armC'));
    return { S, E, W: Wr, Ht, aH, aW, w };
  }
  // the arm's feathers: two outlines with the same structure, blended by `bird`: the dinosaur's feathered forearm (feathers
  // hanging back and down) and a folded wing lying along the body (long flight feathers reaching back past the hips)
  function fdWingFan(R, A_, far) {
    const b = R.b, K = key => fdk(b, key), fl = K('armFL'), w = A_.w, q = R.q, n = 7, pc = q.pitch * 0.6;
    const A0 = A_, tips0 = [], att0 = [];
    for (let i = 0; i < n; i++) { const f = i / (n - 1), at = f < 0.42 ? [lerp(A0.Ht[0], A0.W[0], f / 0.42), lerp(A0.Ht[1], A0.W[1], f / 0.42)] : [lerp(A0.W[0], A0.E[0], (f - 0.42) / 0.58), lerp(A0.W[1], A0.E[1], (f - 0.42) / 0.58)]; att0.push(at); const ang = lerp(1.95, 2.55, f) + pc, len = fl * (1 - 0.45 * f); tips0.push({ p: [at[0] + Math.cos(ang) * len, at[1] + Math.sin(ang) * len], o: at }); }
    // folded: the Archaeopteryx's long fan along the body, closing (towards the bird) into a teardrop whose feather tips
    // bunch at the wing tip over the tail
    const sh = K('shoulder'), dB = K('dB'), vB = K('vB'), cb = sstep(0.5, 1, b), fx = far ? 8 : 0, fy = far ? 8 : 0;
    const Wf = R.B(sh - lerp(2, 8, cb) - fx, vB * lerp(0.55, 0.3, cb) - fy), Ef = R.B(sh - lerp(62, 50, cb) - fx, -dB * lerp(0.92, 0.7, cb) - fy), tips1 = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), at = [lerp(Wf[0], Ef[0], f), lerp(Wf[1], Ef[1], f)], ang = lerp(PI + 0.26, PI - 0.06, f) + pc, len = lerp(fl * 1.3 + 40, fl * 0.62 + 10, f);
      const pA = [at[0] + Math.cos(ang) * len, at[1] + Math.sin(ang) * len], pB = R.B(-62 + 20 * f - fx, 10 - 26 * f - fy);
      tips1.push({ p: [lerp(pA[0], pB[0], cb), lerp(pA[1], pB[1], cb)], o: at });
    }
    const F0 = fanPts([A0.E, A0.W], tips0, 0.15, 0.36), F1 = fanPts([Ef, Wf], tips1, 0.13, 0.36), mixP = (P0, P1) => P0.map((p, i) => [lerp(p[0], P1[i][0], w), lerp(p[1], P1[i][1], w)]);
    return { pts: mixP(F0.pts, F1.pts), inner: mixP(F0.inner, F1.inner), lines: F0.lines.map((l, i) => mixP(l, F1.lines[i])), bend: [lerp(A0.W[0], Wf[0], w), lerp(A0.W[1], Wf[1], w)], notch: lerp(0.15, 0.13, w) };
  }
  // tail feathers: a row on each side of the bony tail (a frond); as the tail shortens they gather into a fan
  function fdTailRows(R) {
    const b = R.b, K = key => fdk(b, key), f0 = K('tailF0'), fl = K('tailFL'), fa = K('tailFA'), fs = K('tailFS'), q = R.q, rows = [];
    const bone = [R.sac].concat(R.tail), nF = 7;
    for (const side of [-1, 1]) {
      const att = [], tips = [];
      for (let i = 0; i < nF; i++) {
        const u = lerp(f0, 1, i / (nF - 1)), P_ = along(bone, u), a0 = P_.ang;
        const ang = a0 - side * (fa + fs * (1 - i / (nF - 1)) * 1.6), len = fl * (0.5 + 0.5 * Math.pow(i / (nF - 1), 0.6));
        att.push([P_.x, P_.y]); tips.push({ p: [P_.x + Math.cos(ang) * len, P_.y + Math.sin(ang) * len], o: [P_.x, P_.y] });
      }
      rows.push(fanPts(att.slice().reverse().slice(0, 1).concat(att.slice(0, 1)), tips.slice().reverse(), 0.12, 0.36));
      rows[rows.length - 1].att = att;
    }
    // close each row along the bone so the feathers grow out of the tail
    for (const F of rows) { F.pts = F.att.slice().concat(F.pts.slice(2)); }
    return rows;
  }
  function featheredDino(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const b = clamp(o.bird == null ? 0 : +o.bird || 0, 0, 1), st = setup(ctx, x, y, s * (o._fdk || 1), o, 300, [-9, -150]), m = moodOf(o), lk = lookOf(o, t, st.seed + 6);
    const pose = poseName(o, FD_POSES); let q = fdParams(b, pose, t, o, s);
    if (o.amount != null && +o.amount < 1) q = blendParams(fdParams(b, poseName({ pose: o.from || 'idle' }, FD_POSES), t, o, s), q, ease(clamp(+o.amount || 0, 0, 1)));
    if (o.mouth != null) q.jaw = clamp(+o.mouth, 0, 1);
    const R = fdRig(b, q, lk), cv = o.colors, sil = st.sil, C = k => { const c = fdc(b, k, cv); return sil > 0 ? mix(c, SIL, sil) : c; };
    const pal = { body: C('body'), belly: C('belly'), feather: C('feather'), tip: C('tip'), head: C('head'), leg: C('leg'), beak: C('beak'), claw: C('claw') };
    pal.far = dk(pal.body, 0.2); pal.featherFar = dk(pal.feather, 0.2); pal.tipFar = dk(pal.tip, 0.18); pal.legFar = dk(pal.leg, 0.25); pal.shade = dk(pal.body, 0.2); pal.bellyShade = mix(pal.belly, pal.body, 0.45);
    if (o.shadow !== false) groundShadow(ctx, 10, q.sit ? 260 : 210, o.shadow == null ? 1 : +o.shadow, st.sil);
    const nOpt = layer => ({ kind: 'mound', layer, count: o.count == null ? 8 : o.count, silhouette: sil, _k: st.s, seed: o.seed });
    if (q.sit && o.nest !== false) nest(ctx, 30, 0, 1.3, nOpt('back'));
    fdDraw(st, R, pal, m, lk, t, o, b);
    if (q.sit && o.nest !== false) nest(ctx, 30, 0, 1.3, nOpt('front'));
    if (q.sit) fdBroodWing(st, R, pal, b);
    finish(st, ctx);
  }
  function fdLeg(st, L_, pal, b, far) {
    const K = key => fdk(b, key), ctx = st.ctx, w = K('legW'), f = K('foot'), thR = K('thighR'), col = far ? pal.far : pal.body;
    const calf = [lerp(L_.K[0], L_.A[0], 0.3) - 4, lerp(L_.K[1], L_.A[1], 0.3)];
    const H0 = L_.H; partPts(st, [{ pts: limbPts([H0[0] - 6, H0[1] - 8], thR, L_.K, w * 0.95, 0.15, 0.1), k: far ? null : (i, p) => sstep(H0[1] - 26, H0[1] + 6, p[1]) }], col);
    if (st.flat) { closedPath(st.all, chainPts([L_.K, calf, L_.A, L_.ball], [w, w, w * 0.6, w * 0.5])); return; }
    const sk = lerp(1, 0.55, b);   // shin thickness: muscular dinosaur to slim bird
    partPts(st, [chainPts([L_.K, calf, L_.A], [w * 0.74 * sk + w * 0.16, w * 0.72 * sk + w * 0.12, w * 0.44])], far ? pal.legFar : pal.leg);
    const B2 = L_.ball, a0 = L_.toe, r0 = w * 0.31;
    const toes = [[-0.3, 0.82], [0.06, 1], [PI - 0.3, lerp(0.3, 0.52, b)]], parts = [rodPts(L_.A, B2, r0, r0 * 0.95)];
    for (const [ta, tl] of toes) parts.push(rodPts(B2, [B2[0] + Math.cos(a0 + ta) * f * tl, B2[1] + Math.sin(a0 + ta) * f * tl], r0 * 0.95, r0 * 0.8));
    partPts(st, parts, far ? pal.legFar : pal.leg, null, true);
    if (st.lod && b < 0.95) { const cp = []; for (const [ta, tl] of toes.slice(0, 2)) { const tp = [B2[0] + Math.cos(a0 + ta) * f * tl, B2[1] + Math.sin(a0 + ta) * f * tl]; clawPath(cp, tp[0], tp[1], a0 + ta + 0.3, 9, 3.4); } claws(st, cp, far ? dk(pal.claw, 0.12) : pal.claw); }
  }
  function fdArmDraw(st, R, pal, b, far) {
    const ctx = st.ctx, K = key => fdk(b, key), A_ = fdArm(R, far), F = fdWingFan(R, A_, far);
    partPts(st, [F.pts], far ? pal.featherFar : pal.feather);
    if (!st.flat && st.lod) { fillPts(st, fanTipPts(F, 2), far ? pal.tipFar : pal.tip); if (st.lod === 2 && !far) birdLines(st, F.lines, dk(pal.feather, 0.3)); }
    const vis = K('armVis'), cl = K('claws'), A0 = A_, sc = p => [lerp(A_.S[0], p[0], vis), lerp(A_.S[1], p[1], vis)];
    if (vis > 0.05) partPts(st, [chainPts([A0.S, A0.E, A0.W, [lerp(A0.W[0], A0.Ht[0], 0.4), lerp(A0.W[1], A0.Ht[1], 0.4)]].map(sc), [9 * vis + 1, 7.5 * vis + 1, 6.5 * vis + 1, 5 * vis + 1])], far ? pal.far : pal.body);
    if (cl > 0.05 && !st.flat) {
      // three clawed fingers: reaching forward on the dinosaur, sticking out of the bend of the wing on the Archaeopteryx
      const fp = [], cp = [], w = A_.w, hand = sc([lerp(A0.W[0], A0.Ht[0], 0.55), lerp(A0.W[1], A0.Ht[1], 0.55)]), kv = sstep(0.12, 0.45, vis), base = [lerp(F.bend[0], hand[0], kv), lerp(F.bend[1], hand[1], kv)];
      for (let i = 0; i < 3; i++) {
        const a = lerp(A0.aH - 0.35 + i * 0.32, 0.35 + R.q.pitch - i * 0.42, w), len = lerp(22, 17, w) * cl, at = add(base, dirv(a), lerp(0, 3, w)), tip = add(at, dirv(a), len);
        fp.push(rodPts(at, tip, 3.25 * cl, 3 * cl)); clawPath(cp, tip[0], tip[1], a + 0.4, 10 * cl, 3.4);
      }
      partPts(st, fp, far ? pal.far : pal.body, null, true);
      claws(st, cp, far ? dk(pal.claw, 0.12) : pal.claw);
    }
  }
  function fdDraw(st, R, pal, m, lk, t, o, b) {
    const ctx = st.ctx, q = R.q, K = key => fdk(b, key), n = R.sp.length;
    const wingS = far => R.B(K('shoulder') - 26 - (far ? 8 : 0), 4), span = (K('armA') + K('armB') + K('armC')) * 1.5, chord = K('armFL') * 0.78 + 12;
    // far wing or arm, far leg
    if (q.wing) { const F = wingPts(wingS(true), span, chord, q.flap, q.fold, true); partPts(st, [F.pts], pal.featherFar); if (!st.flat && st.lod) fillPts(st, fanTipPts(F, 4), pal.tipFar); }
    else if (!q.sit) fdArmDraw(st, R, pal, b, true);
    if (!q.sit) fdLeg(st, R.legs[0], pal, b, true);
    // tail feathers behind the tail
    const rows = fdTailRows(R);
    for (const F of rows) partPts(st, [F.pts], pal.feather);
    if (!st.flat && st.lod) for (const F of rows) fillPts(st, fanTipPts(F, F.att.length), pal.tip);
    // body, tail bone, neck and head (one silhouette)
    const T = tube(R.sp, R.d, R.v, 4, 0, q.sit ? -1 : 0), H = fdHead(R, b);
    partPts(st, [T.out, H.cran].concat(H.snout ? [H.snout] : []), pal.body);
    if (!st.flat && st.det > 0.03) {
      const up = T.up, bot = T.bot, ins = st.lw * 0.25, i0 = 5;
      const bel = []; for (let i = i0; i < n; i++) bel.push([bot[i][0] + up[i][0] * ins, bot[i][1] + up[i][1] * ins]);
      for (let i = n - 1; i >= i0; i--) { const k = i < 8 ? 0.75 : 0.5; bel.push([R.sp[i][0] - up[i][0] * R.v[i] * k, R.sp[i][1] - up[i][1] * R.v[i] * k]); }
      fillPts(st, bel, pal.belly);
      fillPts(st, bandPts(bot.slice(0, n - 1), up.slice(0, n - 1), R.v.slice(0, n - 1).map(v2 => Math.min(14, v2 * 0.2)), ins), pal.bellyShade);
      if (st.lod === 2) { const hw = Math.max(0.8, st.lw * 0.25); ctx.fillStyle = rgba(dk(pal.body, 0.25), 0.6); ctx.beginPath(); for (let k = 0; k < 7; k++) { const P_ = along(R.sp, 0.5 + k * 0.05), U = up[Math.min(n - 1, P_.i)], dd = R.d[Math.min(n - 1, P_.i)] * 0.4; const x0 = P_.x + U[0] * dd, y0 = P_.y + U[1] * dd; ctx.moveTo(x0 - 6, y0 - 2); ctx.quadraticCurveTo(x0, y0 + 6 + hw * 2, x0 + 6, y0 - 2); ctx.quadraticCurveTo(x0, y0 + 6 - hw * 2, x0 - 6, y0 - 2); } ctx.fill(); }
      const hl = [], hb = []; for (let i = 6; i < n - 1; i++) { const w = i === 6 || i === n - 2 ? 1.2 : 4.5, dd = R.d[i] * 0.55; hl.push([R.sp[i][0] + up[i][0] * (dd + w), R.sp[i][1] + up[i][1] * (dd + w)]); hb.push([R.sp[i][0] + up[i][0] * (dd - w), R.sp[i][1] + up[i][1] * (dd - w)]); }
      fillPts(st, hl.concat(hb.reverse()), 'rgba(255,255,255,0.22)');
      fdHeadDetails(st, R, H, pal, m, lk, t, o, b);
    }
    if (!q.sit) fdLeg(st, R.legs[1], pal, b, false);
    if (q.wing) { const F = wingPts(wingS(false), span, chord, q.flap, q.fold, false); partPts(st, [F.pts], pal.feather); if (!st.flat && st.lod) { fillPts(st, fanTipPts(F, 4), pal.tip); if (st.lod === 2) birdLines(st, F.lines, dk(pal.feather, 0.3)); } fdWingClaws(st, F, b, pal); }
    else if (!q.sit) fdArmDraw(st, R, pal, b, false);
  }
  // head: cranium circle with a snout (teeth) that gives way to a beak
  function fdHead(R, b) {
    const h = R.head, K = key => fdk(b, key), hr = K('hr'), snL = K('snout'), snH = K('snoutH'), W = pt => { const r = rot(pt[0], pt[1], h.a); return [h.x + r[0], h.y + r[1]]; };
    const cran = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; cran.push(W([Math.cos(a) * hr, Math.sin(a) * hr])); }
    const snout = snL > 4 ? [[hr * 0.2, -snH * 0.55], [hr * 0.5 + snL * 0.5, -snH * 0.42], [hr * 0.5 + snL, -snH * 0.12], [hr * 0.5 + snL + 4, snH * 0.12], [hr * 0.5 + snL * 0.6, snH * 0.42], [hr * 0.2, snH * 0.55]].map(W) : null;
    return { cran, snout, W, hr, snL, snH };
  }
  function fdHeadDetails(st, R, H, pal, m, lk, t, o, b) {
    const ctx = st.ctx, K = key => fdk(b, key), hr = H.hr, W = H.W, bk = K('beak'), te = K('teeth'), q = R.q;
    const cr = K('crest');   // a little crest of feathers (it shrinks away towards the bird)
    if (cr > 0.05) for (let i = 0; i < 3; i++) { const a = -2.2 + i * 0.35, base = W([Math.cos(a) * hr * 0.8, Math.sin(a) * hr * 0.8]), tip = W([Math.cos(a - 0.5) * hr * (0.8 + (0.8 + 0.15 * i) * cr), Math.sin(a - 0.5) * hr * (0.8 + (0.8 + 0.15 * i) * cr)]); partPts(st, [limbPts(base, 6 * cr + 1, tip, 2.5 * cr + 0.5, 0.1, 0.1)], i === 1 ? pal.tip : pal.feather); }
    if (H.snL > 4) {
      const snL = H.snL, snH = H.snH;
      if (te > 0.05) { ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw * 0.5; ctx.beginPath(); for (let i = 0; i < 4; i++) { const x = hr * 0.5 + snL * (0.32 + i * 0.17), a = W([x - 4, snH * 0.16]), c2 = W([x, snH * 0.16 + 9 * te]), d2 = W([x + 4, snH * 0.16]); ctx.moveTo(a[0], a[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); } ctx.fill(); ctx.stroke(); }
      const m0 = W([hr * 0.5 + snL, snH * 0.12]), m1 = W([hr * 0.5 + snL * 0.4, snH * 0.2]), m2 = W([hr * 0.15, snH * 0.12]), m3 = W([hr * 0.02, snH * 0.12 - 8 * m.smile]);
      ctx.strokeStyle = st.ink; ctx.lineWidth = st.lw; ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.quadraticCurveTo(m1[0], m1[1], m2[0], m2[1]); ctx.lineTo(m3[0], m3[1]); ctx.stroke();
      const ns = W([hr * 0.5 + snL * 0.82, -snH * 0.2]); ctx.fillStyle = st.ink; ctx.beginPath(); ctx.ellipse(ns[0], ns[1], 3.5, 2.2, R.head.a, 0, TAU); ctx.fill();
    }
    if (bk > 0.05) {   // the beak grows in (bird end): it scales up from nothing, no see-through fading
      const bl = 34 * bk, bh = 17 * Math.min(1, bk * 1.5), x0 = hr * 0.8, up = [[x0 - 2, -bh * 0.55], [x0 + bl * 0.55, -bh * 0.42], [x0 + bl, bh * 0.05], [x0 + bl * 0.6, bh * 0.14], [x0 - 2, bh * 0.15]].map(W), lo = [[x0 - 2, bh * 0.12], [x0 + bl * 0.82, bh * 0.14], [x0 + bl * 0.6, bh * 0.42], [x0 - 2, bh * 0.5]].map(W);
      partPts(st, [lo], dk(pal.beak, 0.12)); partPts(st, [up], pal.beak);
      if (bk > 0.6) { const ce = [[x0 + 1, -bh * 0.62], [x0 + bl * 0.36, -bh * 0.62], [x0 + bl * 0.4, -bh * 0.2], [x0 + 2, -bh * 0.12]].map(W); fillPts(st, cw(ce), '#F2F2EE'); }
    }
    const sh = K('shine');
    if (sh > 0.05) { const nk = R.neck, a = nk[0], c2 = nk[2], w = K('nd') * 0.7 * sh, dir = [c2[0] - a[0], c2[1] - a[1]], l = Math.hypot(dir[0], dir[1]) || 1, nx = -dir[1] / l, ny = dir[0] / l; fillPts(st, [[a[0] + nx * w, a[1] + ny * w], [c2[0] + nx * w * 0.8, c2[1] + ny * w * 0.8], [c2[0] - nx * w * 0.8, c2[1] - ny * w * 0.8], [a[0] - nx * w, a[1] - ny * w]], mix(pal.body, '#4FB39A', 0.7)); }
    if (m.smile > 0 && st.lod) { const ch = W([hr * 0.25, hr * 0.42]); ctx.fillStyle = rgba('#FF9FB2', 0.55 * st.det); ctx.beginPath(); ctx.ellipse(ch[0], ch[1], hr * 0.24, hr * 0.13, R.head.a, 0, TAU); ctx.fill(); }
    const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 6);
    const e = W([hr * 0.22, -hr * 0.18]), er = 13 * (hr / 28) * lerp(1, 0.85, b);
    ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(R.head.a * 0.4);
    eye(st, 0, 0, er, { lid: Math.max(q.lid >= 0 ? q.lid : m.lid, blink), low: m.low, lx: lk.x, ly: lk.y, skin: pal.head, iris: mix('#8A5A2B', '#F28C28', b), pup: m.pup, wide: m.wide });
    brow(st, 0, 0, er, m.bUp, m.bTilt, dk(pal.head, 0.3), er * 0.26);
    ctx.restore();
  }
  function fdWingClaws(st, F, b, pal) {
    const cl = fdk(b, 'claws'); if (cl < 0.05 || st.flat || !st.lod) return;
    const cp = [], L_ = F.lead;
    for (let i = 0; i < 3; i++) { const at = [lerp(L_[1][0], L_[2][0], i * 0.4), lerp(L_[1][1], L_[2][1], i * 0.4)], a = Math.atan2(L_[2][1] - L_[1][1], L_[2][0] - L_[1][0]) - 1.2; clawPath(cp, at[0], at[1], a, 11 * cl, 3.4); }
    claws(st, cp, pal.claw);
  }
  // brooding: wings spread forward and down over the eggs (like the famous fossils of a parent on its nest)
  function fdBroodWing(st, R, pal, b) {
    const K = key => fdk(b, key), S = R.B(K('shoulder') - 26, 8), len = (K('armA') + K('armB') + K('armC')) * 0.95, fl = Math.max(K('armFL'), 80), tips = [];
    const W1 = add(S, dirv(0.45), len * 0.55), W2 = add(S, dirv(0.32), len);
    for (let i = 0; i < 7; i++) { const f = i / 6, at = f < 0.45 ? [lerp(W2[0], W1[0], f / 0.45), lerp(W2[1], W1[1], f / 0.45)] : [lerp(W1[0], S[0], (f - 0.45) / 0.55), lerp(W1[1], S[1], (f - 0.45) / 0.55)], a = lerp(1.15, 2.2, f), ln = fl * (1 - 0.35 * f); tips.push({ p: [at[0] + Math.cos(a) * ln, at[1] + Math.sin(a) * ln], o: at }); }
    const F = fanPts([S, W1, W2], tips, 0.14, 0.36);
    partPts(st, [F.pts], pal.feather); if (!st.flat && st.lod) { fillPts(st, fanTipPts(F, 3), pal.tip); if (st.lod === 2) birdLines(st, F.lines, dk(pal.feather, 0.3)); }
  }
  // Archaeopteryx: the bird = 0.5 stage at crow size (birds' scale: about 300 long at s = 1)
  function archaeopteryx(ctx, x, y, s, t, o) { featheredDino(ctx, x, y, s, t, Object.assign({}, o || {}, { bird: (o && o.bird != null) ? o.bird : 0.5, _fdk: 0.52 })); }

  // ----- the Archaeopteryx fossil: the famous slab (skeleton with the head thrown back, wings spread with feather prints,
  // a long tail with pairs of feathers), in stone colours. (x, y) = the centre of the slab; s = 1: the slab is about 440 x 330.
  // o: slab (false: bones and prints only, to lay into your own rock), seed, alpha, silhouette
  function archaeopteryxFossil(ctx, x, y, s, t, o) {
    o = o || {}; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 330, [0, 0]), ctx2 = st.ctx, sil = st.sil, lod = st.lod;
    const C = c => (sil > 0 ? mix(c, SIL, sil) : c), stone = C(STONE), stoneD = C(STONE_D), printC = C('#A8957F');
    const bp = { bone: C('#E9DFCB'), boneD: C('#D6C9B1'), ink: C('#6E5E50'), hole: C('#9A8670') }, bst = Object.assign({}, st, { lw: st.lw * 0.9 });
    if (o.slab !== false) {
      const r = L.rng(17 + (o.seed | 0)), slab = []; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, rr = 1 + (r() - 0.5) * 0.08; slab.push([Math.cos(a) * 220 * rr, Math.sin(a) * 165 * rr * (1 - 0.15 * Math.pow(Math.cos(a), 8))]); }
      partPts(Object.assign({}, st, { ink: C('#5E5044') }), [slab], stone);
      if (!st.flat) {
        fillPts(st, crescentPts(slab, 16, null, st.lw * 0.3), dk(stone, 0.12));
        if (lod) { ctx2.fillStyle = mix(stone, stoneD, 0.3); ctx2.beginPath(); for (let i = 0; i < 16; i++) { const px = (r() - 0.5) * 380, py = (r() - 0.5) * 270, rr = 2 + r() * 4; ctx2.moveTo(px + rr, py); ctx2.arc(px, py, rr, 0, TAU); } ctx2.fill(); }
        ctx2.fillStyle = mix(stone, stoneD, 0.55); ctx2.beginPath(); for (const [ax, ay, bx, by] of [[150, -120, 118, -84], [118, -84, 132, -40], [-170, 70, -130, 92]]) { const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy), nx = -dy / l * 1.6, ny = dx / l * 1.6; ctx2.moveTo(ax + nx, ay + ny); ctx2.lineTo(bx + nx, by + ny); ctx2.lineTo(bx - nx, by - ny); ctx2.lineTo(ax - nx, ay - ny); ctx2.closePath(); } ctx2.fill();
      }
    }
    if (!st.flat) {
      // feather prints: two spread wings and pairs of feathers along the tail
      ctx2.fillStyle = printC; ctx2.beginPath();
      const leaf = (x0, y0, a, len, wd) => { const c = Math.cos(a), sn = Math.sin(a); for (let k = 0; k < 8 && Math.pow((x0 + c * len) / 200, 2) + Math.pow((y0 + sn * len) / 148, 2) > 1; k++) len *= 0.88; const P_ = (u, v) => [x0 + c * u - sn * v, y0 + sn * u + c * v], p1 = P_(len * 0.4, -wd), p2 = P_(len, 0), p3 = P_(len * 0.4, wd); ctx2.moveTo(x0, y0); ctx2.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); ctx2.quadraticCurveTo(p3[0], p3[1], x0, y0); };
      for (let i = 0; i < 8; i++) { leaf(-112 + i * 8, -92 + i * 4, -2.2 + i * 0.16, 112 - i * 7, 10); leaf(-108 + i * 8, -10 - i * 1, 2.75 - i * 0.14, 104 - i * 7, 10); }
      for (let i = 0; i < 8; i++) { const tx = 48 + i * 15.5, ty = 32 + i * 9.4; leaf(tx, ty, -0.9, 50 - i * 1.5, 7); leaf(tx, ty, 1.35, 50 - i * 1.5, 7); }
      ctx2.fill();
    }
    // bones: far leg; tail, back and the neck thrown back over the shoulders (segmented rods); ribs; pelvis; wings; near leg; skull
    const toes = (B_, a0, k) => [-0.45, -0.05, 0.38].map(da => chainPts([B_, add(B_, dirv(a0 + da), 11 * k), add(B_, dirv(a0 + da + 0.25), 22 * k)], [3.2, 2.6, 1.4]));
    const leg = (H, K, A, Bl, a0) => [bonePts(H, K, 5, 4.4, 1.3), bonePts(K, A, 4.4, 3.6, 1.3), rodPts(A, Bl, 3.4, 3), ...toes(Bl, a0, 1), rodPts(Bl, add(Bl, dirv(a0 + 2.6), 12), 2.6, 1.4)];
    boneLayer(bst, leg([16, 10], [42, 42], [22, 82], [46, 98], 0.25), bp, true);
    const cols = [], seps = [], col = (pts, nv, ch0, ch1) => { const F = polyFrames(pts), g = F.len / nv, vs = []; for (let k = 0; k < nv; k++) vs.push({ at: (k + 0.5) * g, cl: g * 0.4, ch: lerp(ch0, ch1, k / Math.max(1, nv - 1)), sl: 0, cv: 0 }); const c = columnPts(F, vs); cols.push(c.pts); seps.push(...c.seps); };
    col([[168, 104], [136, 84], [104, 64], [74, 46], [46, 30], [24, 18]], lod ? 15 : 10, 3.2, 5.6);
    col([[24, 18], [2, -2], [-20, -22], [-38, -42]], 5, 6.5, 6.5);
    col([[-38, -42], [-50, -66], [-44, -92], [-24, -110], [0, -116]], 6, 5.8, 5);
    const ribs = []; for (let i = 0; i < 4; i++) { const b0 = [10 - i * 12, 2 - i * 11], d = [0.74, -0.67]; ribs.push(chainPts([b0, [b0[0] + 16 + i * 2, b0[1] + 4], [b0[0] + 26 + i * 3, b0[1] + 20]], [2.6, 2.4, 1.6])); }
    boneLayer(bst, ribs, bp);
    boneLayer(bst, cols, bp);
    if (seps.length && !st.flat && lod) { const sp = new Path2D(); for (const q4 of seps) { sp.moveTo(q4[0][0], q4[0][1]); for (let i = 1; i < 4; i++) sp.lineTo(q4[i][0], q4[i][1]); sp.closePath(); } ctx2.fillStyle = bp.ink; ctx2.fill(sp); }
    const wing = (S, E, W, a0) => [bonePts(S, E, 4.6, 4, 1.3), rodPts(E, W, 3.6, 3.2), rodPts([E[0] + 3, E[1] + 5], [W[0] + 3, W[1] + 5], 2.4, 2.2), ...[-0.32, 0, 0.32].map(da => chainPts([W, add(W, dirv(a0 + da), 13), add(W, dirv(a0 + da * 1.3), 26)], [3, 2.4, 1.3]))];
    boneLayer(bst, [[[2, 6], [20, -2], [48, 6], [52, 20], [34, 28], [8, 22]], ...wing([-36, -40], [-74, -72], [-116, -98], -2.6), ...wing([-30, -34], [-70, -20], [-114, -10], 3.0)], bp);
    boneLayer(bst, leg([24, 18], [60, 50], [44, 96], [72, 112], 0.2), bp);
    // the skull: a bird-like head with small teeth, thrown back
    const skull = [[0, -110], [10, -128], [32, -136], [58, -130], [84, -116], [98, -104], [82, -98], [52, -96], [22, -94], [4, -98]], jaw = [[16, -96], [52, -94], [94, -101], [90, -92], [52, -86], [20, -88]];
    boneLayer(bst, [jaw], bp); boneLayer(bst, [skull], bp);
    if (!st.flat) {
      ctx2.fillStyle = bp.hole; const h = new Path2D(); circ(h, 30, -118, 8.5); h.moveTo(64, -114); h.ellipse(56, -114, 8, 4.5, 0.1, 0, TAU); ctx2.fill(h);
      if (lod) { const th = []; for (const tx of [58, 68, 78, 88]) th.push([[tx - 3, -98], [tx + 3, -98.5], [tx, -91]]); boneLayer(Object.assign({}, bst, { lw: bst.lw * 0.6 }), th, bp); }
    }
    finish(st, ctx);
  }
  // positions along any polyline by distance (as spineFrames, without the body thickness)
  function polyFrames(pts) {
    const n = pts.length, cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const up = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1; return [ty / l, -tx / l]; });
    const at = dist => {
      let i = 0; while (i < n - 2 && cum[i + 1] < dist) i++;
      const f = clamp((dist - cum[i]) / ((cum[i + 1] - cum[i]) || 1), 0, 1); let ux = lerp(up[i][0], up[i + 1][0], f), uy = lerp(up[i][1], up[i + 1][1], f); const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
      return { P: [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)], up: [ux, uy], tg: [-uy, ux], d: 0, v: 0 };
    };
    return { cum, at, len: cum[n - 1] };
  }

  // =================================================================================================================
  // OTHER ANIMALS (Ep16 survivors): shrew, turtle, frog, crocodile. Each faces +x with the ground at y = 0.
  // =================================================================================================================
  // ----- a small furry mammal (shrew-like). s = 1: about 70 tall, 170 long (tail included). poses: idle, scurry, sniff
  const SHREW_C = { body: '#A58B73', belly: '#E8D8C4', ear: '#F0B6B0', nose: '#E58C9A', tail: '#C9A68E', iris: '#2B2D42' };
  function shrew(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 70, [-14, -34]), pal = palette(SHREW_C, o.colors, st.sil), m = moodOf(o), pose = poseName(o, ['idle', 'scurry', 'sniff']), c2 = st.ctx;
    const g = { stride: 70, rate: 4.5 }, p = pose === 'scurry' ? phaseOf(o, t, g, s) : 0, run = pose === 'scurry' ? 1 : 0, sniff = pose === 'sniff' ? 1 : 0.3;
    const bob = run ? -4 * Math.abs(Math.sin(TAU * p)) : Math.sin(t * 3) * 1.2, tw = Math.sin(t * 18) * sniff * 2.2, hl = pose === 'sniff' ? 0.15 + 0.08 * Math.sin(t * 2.4) : 0;
    if (o.shadow !== false) groundShadow(c2, 0, 62, 1, st.sil);
    c2.translate(0, bob);
    const leg = (lx, ph) => { const sw = run ? Math.sin(TAU * p + ph) * 12 : 0, lift = run ? Math.max(0, Math.cos(TAU * p + ph)) * 6 : 0; return chainPts([[lx, -22], [lx + sw * 0.6 + 2, -10 - lift], [lx + sw + 6, -3 - lift - bob]], [7, 5, 4.5]); };
    partPts(st, [leg(-30, PI), leg(22, 0)], dk(pal.body, 0.2));
    const tail = chainPts([[-48, -26], [-80, -20 + Math.sin(t * 4) * 3], [-112, -30 + Math.sin(t * 4 - 1) * 5]], [6, 4, 2]);
    partPts(st, [tail], pal.tail);
    const hx = 46 + hl * 10, hy = -36 - hl * 6, body = [[-52, -30], [-40, -52], [-6, -60], [26, -54], [44, -40], [40, -16], [10, -8], [-30, -8], [-52, -16]];
    const head = [[hx - 22, hy - 14], [hx - 4, hy - 20], [hx + 18, hy - 10], [hx + 40 + tw, hy + 2], [hx + 18, hy + 10], [hx - 6, hy + 14], [hx - 24, hy + 6]];
    const ear = [[hx - 16, hy - 14], [hx - 20, hy - 30], [hx - 6, hy - 30], [hx - 2, hy - 18]];
    partPts(st, [ear], pal.body);
    partPts(st, [body, head], pal.body);
    if (!st.flat && st.det > 0.03) {
      fillPts(st, [[-44, -16], [-10, -10], [30, -16], [38, -26], [0, -22], [-36, -24]], pal.belly);
      fillPts(st, crescentPts(body, 6, null, st.lw * 0.25), dk(pal.body, 0.14));
      fillPts(st, [[hx - 14, hy - 17], [hx - 16, hy - 26], [hx - 8, hy - 26], [hx - 6, hy - 18]], pal.ear);
      c2.fillStyle = pal.nose; c2.beginPath(); c2.ellipse(hx + 40 + tw, hy + 2, 5, 4, 0, 0, TAU); c2.fill();
      if (st.lod) { c2.strokeStyle = rgba(INK, 0.55); c2.lineWidth = Math.max(1, st.lw * 0.4); c2.beginPath(); for (const [a, l] of [[-0.25, 22], [0.05, 24], [0.35, 20]]) { c2.moveTo(hx + 30 + tw, hy + 4); c2.lineTo(hx + 30 + tw + Math.cos(a + tw * 0.05) * l, hy + 4 + Math.sin(a + tw * 0.05) * l); } c2.stroke();
        c2.strokeStyle = rgba(dk(pal.body, 0.3), 0.7); c2.beginPath(); for (let i = 0; i < 5; i++) { const fx = -36 + i * 14; c2.moveTo(fx, -54 + Math.abs(i - 2) * 2); c2.lineTo(fx + 4, -48 + Math.abs(i - 2) * 2); } c2.stroke(); }
      const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 8);
      eye(st, hx + 6, hy - 4, 7, { lid: Math.max(m.lid, blink), lx: 0.6, ly: 0, skin: pal.body, pup: 0.62 });
    }
    partPts(st, [leg(-22, 0), leg(30, PI)], pal.body);
    finish(st, ctx);
  }
  // ----- a turtle. s = 1: about 110 tall, 230 long. poses: idle, walk, hide (head and legs pulled in; o.amount 0..1)
  const TURTLE_C = { shell: '#9C8A4A', shellD: '#7A6A33', rim: '#C2B070', skin: '#BCCB82', belly: '#E6DFA8' };
  function turtle(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 110, [4, -48]), pal = palette(TURTLE_C, o.colors, st.sil), m = moodOf(o), pose = poseName(o, ['idle', 'walk', 'hide']), c2 = st.ctx;
    const g = { stride: 60, rate: 0.9 }, p = pose === 'walk' ? phaseOf(o, t, g, s) : 0, walk = pose === 'walk' ? 1 : 0;
    const hide = pose === 'hide' ? (o.amount == null ? 1 : clamp(+o.amount, 0, 1)) : 0, hd = (1 - hide) * (0.85 + 0.15 * Math.sin(t * 1.3));
    if (o.shadow !== false) groundShadow(c2, 0, 120, 1, st.sil);
    const bob = walk ? -2 * Math.abs(Math.sin(TAU * p)) : 0; c2.translate(0, bob);
    const leg = (lx, ph, far) => { const sw = walk ? Math.sin(TAU * p + ph) * 14 : 0, lift = walk ? Math.max(0, Math.cos(TAU * p + ph)) * 6 : 0, k = 1 - hide * 0.8; return chainPts([[lx, -30], [lx + sw * 0.5 + 4, -16 - lift], [lx + sw + 8 * k, -4 - lift - bob]], [15 * k + 3, 13 * k + 3, 12 * k + 3]); };
    partPts(st, [leg(-52, PI, 1), leg(48, 0, 1)], dk(pal.skin, 0.18));
    const hx = 92 + 40 * hd - 30, hy = -46 + 6 * hide, neck = chainPts([[56, -40], [lerp(56, hx, 0.5), hy + 2], [hx, hy]], [14, 13, 12]);
    const head = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; head.push([hx + 6 + Math.cos(a) * 24, hy + Math.sin(a) * 19]); }
    const tail = chainPts([[-86, -30], [-106, -22], [-118 + 10 * hide, -18]], [9, 6, 3]);
    partPts(st, [tail, neck, head], pal.skin);
    const shell = [[-100, -32], [-88, -66], [-50, -94], [0, -104], [50, -94], [88, -66], [100, -32], [60, -22], [0, -18], [-60, -22]];
    partPts(st, [shell], pal.shell);
    if (!st.flat && st.det > 0.03) {
      fillPts(st, [[-100, -32], [-60, -22], [0, -18], [60, -22], [100, -32], [96, -24], [60, -14], [0, -10], [-60, -14], [-96, -24]], pal.rim);
      fillPts(st, crescentPts(shell, 10, null, st.lw * 0.25), pal.shellD);
      c2.strokeStyle = pal.shellD; c2.lineWidth = st.lw * 0.9; c2.beginPath();
      c2.moveTo(-30, -96); c2.lineTo(-40, -62); c2.lineTo(-20, -30); c2.moveTo(30, -96); c2.lineTo(40, -62); c2.lineTo(20, -30); c2.moveTo(-40, -62); c2.lineTo(-84, -50); c2.moveTo(40, -62); c2.lineTo(84, -50); c2.moveTo(-20, -30); c2.lineTo(20, -30); c2.moveTo(-40, -62); c2.lineTo(40, -62);
      c2.stroke();
      c2.fillStyle = 'rgba(255,255,255,0.25)'; c2.beginPath(); c2.ellipse(-36, -82, 18, 7, -0.5, 0, TAU); c2.fill();
      if (hd > 0.15) {
        const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 9);
        eye(st, hx + 10, hy - 6, 8.5, { lid: Math.max(m.lid, blink), lx: 0.7, ly: 0, skin: pal.skin, pup: 0.6 });
        c2.strokeStyle = st.ink; c2.lineWidth = st.lw; c2.beginPath(); c2.moveTo(hx + 28, hy + 6); c2.quadraticCurveTo(hx + 18, hy + 13, hx + 6, hy + 8 - 3 * m.smile); c2.stroke();
        if (m.smile > 0) { c2.fillStyle = rgba('#FF9FB2', 0.55); c2.beginPath(); c2.ellipse(hx + 4, hy + 6, 6, 3.5, 0, 0, TAU); c2.fill(); }
      }
    }
    partPts(st, [leg(-40, 0), leg(60, PI)], pal.skin);
    finish(st, ctx);
  }
  // ----- a frog. s = 1: about 110 tall, 150 long. poses: sit (throat breathing, blink), hop (a jump; phase 0..1 per hop)
  const FROG_C = { body: '#7CC24A', dark: '#5A9A32', belly: '#E8F6B8', spot: '#4E8C2A', iris: '#E8B23A' };
  function frog(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 110, [5, -46]), pal = palette(FROG_C, o.colors, st.sil), m = moodOf(o), pose = poseName(o, ['sit', 'idle', 'hop']), c2 = st.ctx;
    const g = { stride: 150, rate: 0.8 }, p = pose === 'hop' ? phaseOf(o, t, g, s) : 0, air = pose === 'hop' ? clamp((p - 0.15) / 0.55, 0, 1) : 0, inAir = pose === 'hop' && p > 0.15 && p < 0.7;
    const shift = pose === 'hop' ? g.stride * ((p < 0.15 ? 0 : p > 0.7 ? 1 : ease(air)) - p) : 0, jy = inAir ? -70 * Math.sin(PI * air) : 0, crouch = pose === 'hop' ? (p < 0.15 ? Math.sin(PI * p / 0.15) : p > 0.7 ? Math.sin(PI * (p - 0.7) / 0.3) * 0.6 : 0) : 0, ext = inAir ? Math.sin(PI * Math.min(1, air * 1.6)) : 0;
    if (o.shadow !== false) groundShadow(c2, shift, 70 * (1 - 0.3 * Math.min(1, -jy / 70)), 1, st.sil);
    c2.translate(shift, jy + crouch * 6);
    const th = Math.sin(t * 4.5) * (pose === 'hop' ? 0 : 1), tilt = inAir ? -0.35 * Math.sin(PI * air) : 0.05 * crouch;
    c2.rotate(tilt);
    // back legs: folded when sitting, kicking out behind in the air
    const hipF = [-30, -26], kneeF = [lerp(8, -40, ext), lerp(-28, -10, ext)], footF = [lerp(-34, -100, ext), lerp(-4, 4, ext)];
    const hip = [-22, -24], knee = [lerp(16, -30, ext), lerp(-22, -2, ext)], foot = [lerp(-24, -96, ext), lerp(0, 14, ext)];
    partPts(st, [chainPts([hipF, kneeF, footF], [16, 11, 8]), chainPts([footF, [footF[0] + 20, footF[1] + 2]], [6, 5])], pal.dark);
    const body = [[-48, -32], [-34, -62], [0, -76], [34, -76], [56, -60], [60, -40], [44, -20], [10, -10], [-26, -12], [-46, -20]];
    const eyeB = [[14, -76], [18, -96], [36, -102], [52, -92], [54, -74]];
    partPts(st, [body, eyeB], pal.body);
    if (!st.flat && st.det > 0.03) {
      fillPts(st, [[60, -40], [44, -20], [10, -10], [-10, -14], [8, -26 - th * 2], [40, -34 - th * 3]], pal.belly);
      fillPts(st, crescentPts(body, 8, null, st.lw * 0.25), pal.dark);
      c2.fillStyle = pal.spot; c2.beginPath(); for (const [sx, sy, r] of [[-24, -52, 7], [-2, -62, 6], [-36, -36, 5], [18, -50, 4.5]]) { c2.moveTo(sx + r, sy); c2.arc(sx, sy, r, 0, TAU); } c2.fill();
      const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 10);
      eye(st, 36, -88, 13, { lid: Math.max(m.lid, blink), lx: 0.6, ly: 0, skin: pal.body, iris: pal.iris, pup: 0.55 });
      c2.strokeStyle = st.ink; c2.lineWidth = st.lw; c2.beginPath(); c2.moveTo(60, -48); c2.quadraticCurveTo(36, -36 + m.smile * 4, 6, -44 - m.smile * 2); c2.stroke();
      if (m.smile > 0) { c2.fillStyle = rgba('#FF9FB2', 0.55); c2.beginPath(); c2.ellipse(24, -48, 8, 4, 0, 0, TAU); c2.fill(); }
    }
    partPts(st, [chainPts([hip, knee, foot], [18, 13, 9]), chainPts([foot, [foot[0] + 24, foot[1] + 3]], [7, 6])], pal.body);
    const arm = chainPts([[30, -30], [40 + ext * 20, -14 + ext * 4], [46 + ext * 30, -2 + ext * 4]], [8, 7, 6]);
    partPts(st, [arm], pal.body);
    finish(st, ctx);
  }
  // ----- a crocodile. s = 1: about 130 tall, 640 long. poses: idle (smile, blink), walk (a low, sprawling walk), smile (mouth open)
  const CROC_C = { body: '#7DA35B', dark: '#5C8140', belly: '#DDE5A4', scute: '#6A9149', iris: '#E8C23A', mouth: '#B35A62', tooth: '#FFFFFF' };
  function crocodile(ctx, x, y, s, t, o) {
    o = o || {}; t = +t || 0; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 130, [3, -49]), pal = palette(CROC_C, o.colors, st.sil), m = moodOf(o), pose = poseName(o, ['idle', 'walk', 'smile']), c2 = st.ctx;
    const g = { stride: 160, duty: 0.7, lift: 14, rate: 0.7 }, p = pose === 'walk' ? phaseOf(o, t, g, s) : 0, walk = pose === 'walk' ? 1 : 0;
    const open = o.mouth != null ? clamp(+o.mouth, 0, 1) : pose === 'smile' ? 0.55 + 0.1 * Math.sin(t * 2) : 0;
    if (o.shadow !== false) groundShadow(c2, 0, 320, 1, st.sil);
    const sp = [], d = [], v = [], tailN = 7;
    for (let k = 0; k <= tailN; k++) { const f = k / tailN; sp.push([-320 + f * 250, -34 - 6 * Math.sin(f * PI) + Math.sin(TAU * (walk ? p : t * 0.2) - f * 3) * 8 * (1 - f) * (walk ? 1 : 0.5)]); d.push(4 + 26 * Math.pow(f, 1.2)); v.push(4 + 20 * Math.pow(f, 1.2)); }
    sp.push([-10, -46], [80, -48], [150, -44]); d.push(36, 38, 30); v.push(28, 30, 26);
    const T = tube(sp, d, v, 4, 0, -1), n = sp.length;
    const legs = far => { const out = []; for (const [lx, ph] of [[-30, far ? PI : 0], [110, far ? 0 : PI]]) { const f = walk ? bipedFoot(frac(p + ph / TAU), g) : { x: 0, y: 0 }, base = [lx + (far ? -10 : 0), -40], footP = [lx + 10 + f.x + (far ? -10 : 0), f.y - 6]; out.push(chainPts([base, [lerp(base[0], footP[0], 0.5) - 8, -16 + f.y * 0.5], footP, [footP[0] + 24, footP[1] + 2]], [14, 12, 10, 7])); } return out; };
    partPts(st, legs(true), pal.dark);
    // the head turns up a little as the mouth opens (the lower jaw stays off the ground)
    const H0 = [140, -52], hu = -open * 0.16, ja = open * 0.18, HR = pt => { const r = rot(pt[0] - H0[0], pt[1] - H0[1], hu); return [H0[0] + r[0], H0[1] + r[1]]; }, J = pt => { const r = rot(pt[0] - H0[0], pt[1] - H0[1], hu + ja); return [H0[0] + r[0], H0[1] + r[1]]; };
    const upper = [[120, -78], [170, -86], [196, -78], [300, -66], [330, -58], [332, -46], [300, -44], [200, -46], [140, -44]].map(HR);
    const lower = [[130, -44], [200, -42], [300, -40], [326, -38], [322, -26], [290, -22], [200, -24], [140, -28]].map(J);
    if (open > 0.03 && !st.flat) fillPts(st, cw([[146, -44], [200, -46], [300, -44], [326, -44]].map(HR).concat([[300, -40], [200, -42], [146, -42]].map(J))), pal.mouth);
    partPts(st, [lower], pal.body);
    partPts(st, [T.out, upper], pal.body);
    if (!st.flat && st.det > 0.03) {
      fillPts(st, bandPts(T.bot.slice(2, n), T.up.slice(2, n), v.slice(2, n).map(x2 => x2 * 0.45), st.lw * 0.25), pal.belly);
      fillPts(st, cw([[200, -24], [290, -22], [322, -26], [318, -32], [290, -30], [200, -31]].map(J)), pal.belly);
      c2.fillStyle = pal.scute; c2.beginPath(); for (let k = 0; k < 16; k++) { const P_ = along(sp, 0.08 + k * 0.055), i = Math.min(n - 1, P_.i), U = T.up[i], dd = d[i] * 0.75, cx = P_.x + U[0] * dd, cy = P_.y + U[1] * dd, r = 3 + d[i] * 0.16; c2.moveTo(cx + r, cy); c2.ellipse(cx, cy, r, r * 0.7, 0, 0, TAU); } c2.fill();
      // small, rounded, friendly teeth; nostril; the eye on its bump
      c2.fillStyle = pal.tooth; c2.strokeStyle = st.ink; c2.lineWidth = st.lw * 0.5; c2.beginPath();
      for (let i = 0; i < 6; i++) { const tx = 190 + i * 22, a = HR([tx - 5, -45]), b2 = HR([tx, -36]), c3 = HR([tx + 5, -45]); c2.moveTo(a[0], a[1]); c2.quadraticCurveTo(b2[0], b2[1], c3[0], c3[1]); } c2.fill(); c2.stroke();
      const no = HR([318, -62]); c2.fillStyle = st.ink; c2.beginPath(); c2.ellipse(no[0], no[1], 4, 2.6, hu, 0, TAU); c2.fill();
      const blink = o.blink != null ? clamp(+o.blink, 0, 1) : blinkAt(t, st.seed + 11);
      partPts(st, [[[146, -76], [152, -100], [178, -102], [186, -80]].map(HR)], pal.body);
      const e = HR([166, -86]); eye(st, e[0], e[1], 12, { lid: Math.max(m.lid, blink, 0.15), lx: 0.6, ly: 0, skin: pal.body, iris: pal.iris, pup: 0.5 });
      if (open < 0.03) { c2.strokeStyle = st.ink; c2.lineWidth = st.lw; c2.beginPath(); c2.moveTo(150, -46); c2.quadraticCurveTo(144, -50 - m.smile * 4, 138, -56 - m.smile * 6); c2.stroke(); }
      if (m.smile > 0) { const ck = HR([164, -60]); c2.fillStyle = rgba('#FF9FB2', 0.55); c2.beginPath(); c2.ellipse(ck[0], ck[1], 9, 4.5, hu, 0, TAU); c2.fill(); }
    }
    partPts(st, legs(false), pal.body);
    finish(st, ctx);
  }

  // ----- helpers: footprints, a feather
  // a three-toed footprint pressed into mud or rock. (x, y) = the heel; s = 1: about 100 long, pointing up at rot = 0.
  // o: kind 'dino' (thick toes, claws) | 'bird' (thin toes and a toe behind), rot, color (the ground), depth 0..1, alpha
  function track(ctx, x, y, s, o) {
    o = o || {}; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 100, [1, -40]), c2 = st.ctx, bird = o.kind === 'bird';
    if (o.rot) c2.rotate(+o.rot || 0);
    const ground = o.color || '#C9B58B', dp = o.depth == null ? 1 : clamp(+o.depth, 0, 1), dent = dk(ground, 0.24 * dp + 0.06), wall = dk(ground, 0.4 * dp + 0.08), rim = lt(ground, 0.3);
    // one outline: a heel pad and three toes (the middle one longest) tapering to claw points; a bird adds a thin back toe
    const P0 = [0, -8], toes = bird ? [[-0.62, 58, 5.5], [0, 70, 5.5], [0.62, 58, 5.5]] : [[-0.52, 60, 13], [0, 80, 14], [0.52, 60, 13]];
    const pts = [], D = a => [Math.sin(a), -Math.cos(a)], at = (a, l, w) => { const d = D(a); return [P0[0] + d[0] * l - d[1] * w, P0[1] + d[1] * l + d[0] * w]; };
    if (bird) pts.push([5, 10], [4, 30], [0, 34], [-4, 30], [-5, 10]); else pts.push([13, 8], [0, 15], [-13, 8], [-19, -4]);
    for (let i = 0; i < 3; i++) {
      const [a, l, w] = toes[i];
      if (i > 0) { const m = (toes[i - 1][0] + a) / 2; pts.push(at(m, bird ? 6 : 4, 0)); }
      const tip = at(a, l + (bird ? 2 : 8), 0);
      pts.push(at(a, l * (bird ? 0.18 : 0.28), -w), at(a, l * 0.62, -w * 0.82), at(a, l * 0.9, -w * 0.4), tip);
      if (!bird) pts.push(tip);                      // a doubled point: the toe ends in a claw point
      pts.push(at(a, l * 0.9, w * 0.4), at(a, l * 0.62, w * 0.82), at(a, l * (bird ? 0.18 : 0.28), w));
    }
    if (!bird) pts.push([19, -4]);
    const shape = cw(pts);
    if (st.flat) { closedPath(st.all, shape); finish(st, ctx); return; }
    const rimP = new Path2D(); crv(rimP, shape.map(q => [q[0] + 2.5, q[1] + 3.5]), true); c2.fillStyle = rim; c2.fill(rimP);      // the lit lower rim
    fillPts(st, fatPts(shape, 1.5), wall); fillPts(st, shape, dent);                                                                  // the dent, its edge
    fillPts(st, crescentPts(shape, bird ? 3 : 7, [-0.5, -0.86], 0.5), wall);                                                           // the shaded upper wall
    finish(st, ctx);
  }
  // a single feather (floating, falling, in a hand). (x, y) = the base of the quill; s = 1: about 120 long, pointing up at rot = 0.
  // o: color, tip (tip colour, '' for none), rot, curl (-1..1 bends it)
  function feather(ctx, x, y, s, o) {
    o = o || {}; if (!(s > 0)) return;
    const st = setup(ctx, x, y, s, o, 120, [-1, -60]), c2 = st.ctx, col = st.sil ? mix(o.color || '#C47548', SIL, st.sil) : (o.color || '#C47548'), tip = o.tip === '' ? null : (o.tip || '#3FA7A3'), cu = clamp(+o.curl || 0, -1, 1) * 14;
    if (o.rot) c2.rotate(+o.rot || 0);
    const vane = [[0, -14], [-12, -40 + cu * 0.2], [-15, -78 + cu * 0.6], [-6 + cu, -116], [cu * 1.2, -124], [8 + cu, -112], [14, -74 + cu * 0.6], [11, -38], [3, -16]];
    partPts(st, [vane], col);
    if (!st.flat && st.det > 0.03) {
      if (tip) fillPts(st, [[-14, -86 + cu * 0.65], [-6 + cu, -116], [cu * 1.2, -124], [8 + cu, -112], [13, -86 + cu * 0.6]], st.sil ? mix(tip, SIL, st.sil) : tip);
      c2.strokeStyle = dk(col, 0.35); c2.lineWidth = st.lw * 0.8; c2.beginPath(); c2.moveTo(0, 0); c2.quadraticCurveTo(cu * 0.2, -60, cu * 1.1, -118); c2.stroke();
      if (st.lod) { c2.lineWidth = st.lw * 0.45; c2.beginPath(); for (let i = 0; i < 4; i++) { const yy = -36 - i * 20, xx = cu * (0.2 + i * 0.2); c2.moveTo(xx, yy); c2.lineTo(xx - 10, yy + 9); c2.moveTo(xx, yy - 4); c2.lineTo(xx + 9, yy + 5); } c2.stroke(); }
      c2.strokeStyle = st.ink; c2.lineWidth = st.lw; c2.beginPath(); c2.moveTo(0, 6); c2.lineTo(0, -14); c2.stroke();
    }
    finish(st, ctx);
  }

  // =================================================================================================================
  // registry and export
  // =================================================================================================================
  const C = {
    version: 1,
    rex, rexSkeleton, titanosaur, horned, pigeon, hen, crow, sparrow, smallBird, nest, egg, featheredDino, archaeopteryx, archaeopteryxFossil, shrew, turtle, frog, crocodile, track, foot: track, feather,
    util: { mix, rgba, crv, limb, palette },
    info: {
      rex: { poses: REX_POSES, cycles: ['walk', 'run', 'roar'], gait: REX_GAIT, center: RX.center, w: 780, h: 430, box: [-334, -430, 446, 8], boxAll: [-342, -536, 464, 10] },
      rexSkeleton: { poses: REX_POSES, center: RX.center, parts: ['legFar', 'tail', 'body', 'legNear', 'skull'], w: 766, h: 416, box: [-330, -416, 436, 2], boxAll: [-338, -526, 454, 2] },
      titanosaur: { poses: TITAN.poses, cycles: ['walk', 'munch'], gait: TITAN.gait, center: TITAN.center, w: 1074, h: 650, box: [-604, -650, 470, 8], boxAll: [-608, -650, 494, 8] },
      horned: { poses: HORNED.poses, cycles: ['walk', 'munch'], gait: HORNED.gait, center: HORNED.center, w: 660, h: 340, box: [-306, -340, 354, 6], boxAll: [-306, -340, 356, 6] },
      pigeon: { poses: BIRD_POSES.pigeon, cycles: ['walk', 'peck', 'coo', 'fly'], center: [BIRD_SP.pigeon.bx, BIRD_SP.pigeon.by], flyPoses: ['fly', 'glide'], gait: { walk: { stride: BIRD_SP.pigeon.stride, rate: BIRD_SP.pigeon.cadence } }, timeS: 2.4, w: 218, h: 150, box: [-126, -150, 92, 6], boxAll: [-136, -226, 112, 12] },
      hen: { poses: BIRD_POSES.hen, cycles: ['walk', 'peck', 'cluck'], center: [BIRD_SP.hen.bx, BIRD_SP.hen.by], gait: { walk: { stride: BIRD_SP.hen.stride, rate: BIRD_SP.hen.cadence } }, timeS: 1.6, w: 268, h: 248, box: [-148, -248, 120, 8], boxAll: [-148, -250, 166, 18] },
      crow: { poses: BIRD_POSES.crow, cycles: ['hop', 'walk', 'caw', 'fly'], center: [BIRD_SP.crow.bx, BIRD_SP.crow.by], flyPoses: ['fly'], gait: { walk: { stride: BIRD_SP.crow.stride, rate: BIRD_SP.crow.cadence }, hop: { stride: BIRD_SP.crow.stride * 1.6, rate: BIRD_SP.crow.cadence * 0.55 } }, timeS: 2.2, w: 304, h: 164, box: [-174, -164, 130, 6], boxAll: [-206, -274, 162, 6] },
      sparrow: { poses: BIRD_POSES.sparrow, cycles: ['hop', 'peck', 'fly'], center: [BIRD_SP.sparrow.bx, BIRD_SP.sparrow.by], flyPoses: ['fly'], gait: { hop: { stride: BIRD_SP.sparrow.stride * 1.6, rate: BIRD_SP.sparrow.cadence * 0.55 } }, timeS: 4, w: 118, h: 80, box: [-70, -80, 48, 2], boxAll: [-82, -118, 62, 6] },
      smallBird: { poses: BIRD_POSES.smallBird, cycles: ['hop', 'fly'], center: [BIRD_SP.smallBird.bx, BIRD_SP.smallBird.by], flyPoses: ['fly'], gait: { hop: { stride: BIRD_SP.smallBird.stride * 1.6, rate: BIRD_SP.smallBird.cadence * 0.55 } }, variants: SMALL_ORDER, timeS: 4, w: 102, h: 74, box: [-58, -74, 44, 12], boxAll: [-68, -106, 54, 12] },
      featheredDino: { poses: FD_POSES, cycles: ['walk', 'run', 'flap'], center: [-9, -150], gait: FD_GAIT, w: 550, h: 306, box: [-284, -306, 266, 6], boxAll: [-286, -322, 278, 12] },
      archaeopteryx: { poses: FD_POSES, cycles: [], center: [-5, -78], gait: { walk: { stride: FD_GAIT.walk.stride * 0.52, rate: 1 }, run: { stride: FD_GAIT.run.stride * 0.52, rate: 2 } }, timeS: 2, w: 298, h: 158, box: [-172, -158, 126, 4], boxAll: [-174, -164, 134, 22] },
      archaeopteryxFossil: { poses: ['slab'], center: [0, 0], anchor: 'center', w: 444, h: 332, box: [-222, -170, 222, 162], boxAll: [-222, -170, 222, 162] },
      shrew: { poses: ['idle', 'scurry', 'sniff'], cycles: ['scurry'], center: [-14, -34], gait: { scurry: { stride: 70, rate: 4.5 } }, timeS: 3, w: 208, h: 70, box: [-118, -70, 90, 2], boxAll: [-118, -74, 90, 4] },
      turtle: { poses: ['idle', 'walk', 'hide'], cycles: ['walk'], center: [4, -48], gait: { walk: { stride: 60, rate: 0.9 } }, timeS: 2, w: 260, h: 106, box: [-126, -106, 134, 10], boxAll: [-126, -108, 134, 12] },
      frog: { poses: ['sit', 'hop'], cycles: ['hop'], center: [5, -46], gait: { hop: { stride: 150, rate: 0.8 } }, timeS: 2.5, w: 114, h: 104, box: [-52, -104, 62, 12], boxAll: [-120, -174, 100, 14] },
      crocodile: { poses: ['idle', 'walk', 'smile'], cycles: ['walk'], center: [3, -49], gait: { walk: { stride: 160, rate: 0.7 } }, timeS: 1, w: 662, h: 106, box: [-328, -106, 334, 8], boxAll: [-328, -108, 334, 10] },
      track: { poses: ['dino', 'bird'], center: [1, -40], w: 70, h: 96, box: [-34, -96, 36, 16], boxAll: [-36, -96, 36, 36] },
      feather: { poses: ['feather'], center: [-1, -60], w: 34, h: 128, box: [-18, -128, 16, 8], boxAll: [-18, -128, 16, 8] },
      nest: { poses: ['both'], center: [-1, -49], w: 258, h: 106, box: [-130, -106, 128, 8], boxAll: [-130, -106, 128, 8] },
      egg: { poses: ['egg'], center: [0, -34], w: 64, h: 68, box: [-32, -68, 32, 0], boxAll: [-32, -68, 32, 0] },
    }
  };
  L.creatures = C;
})(typeof window !== 'undefined' ? window : globalThis);

/* Frame player shared by the video renderer and the interactive page */
(function (global) {
  const L = global.LSC;
  L.createPlayer = function (ctx, id, timeline) {
    const EP = L.episodes[id]; const T = timeline.lines;
    const scenes = EP.scenes.map(s => ({ ...s, start: T[s.from].start - (s.lead || 0) }));
    scenes.forEach((s, i) => { s.endT = i + 1 < scenes.length ? scenes[i + 1].start : timeline.duration; });
    scenes[0].start = timeline.titleEnd;
    function drawFrame(t) {
      ctx.save();
      if (t < timeline.titleEnd) { L.titleCard(ctx, t, t / timeline.titleEnd, EP.title); ctx.restore(); return; }
      const Lt = L.tl(t, T);
      let idx = scenes.findIndex(s => t >= s.start && t < s.endT); if (idx < 0) idx = scenes.length - 1;
      const S = scenes[idx]; const TR = 0.35;
      S.draw(ctx, t, Lt);
      for (const ln of EP.lines) { const Ln = T[ln.id]; if (!Ln) continue; const a = Math.min(L.seg(t, Ln.start - 0.15, Ln.start + 0.1), 1 - L.seg(t, Ln.end + 0.4, Ln.end + 0.7)); if (a > 0) L.caption(ctx, ln.text, a); }
      if (idx > 0 && S.transition !== 'cut') { const p = L.seg(t, S.start, S.start + TR); if (p < 1) L.wipe(ctx, 1 - p, S.wipeColor || L.P.blueDeep); }
      if (idx + 1 < scenes.length && scenes[idx + 1].transition !== 'cut') { const p = L.seg(t, S.endT - TR, S.endT); if (p > 0) L.wipe(ctx, p, scenes[idx + 1].wipeColor || L.P.blueDeep); }
      if (t > timeline.duration - 1.0) L.fade(ctx, L.seg(t, timeline.duration - 1.0, timeline.duration), '#000');
      ctx.restore();
    }
    return { drawFrame, scenes, episode: EP, timeline };
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 1 — Why does ice cream melt? */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  // ---- props ----
  function iceCube(ctx, x, y, s, melt, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (melt > 0.05) { const pr = 30 + 160 * E.out(melt); ctx.fillStyle = 'rgba(120,200,255,0.8)'; ctx.beginPath(); ctx.ellipse(0, 70, pr, pr * 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.stroke(); }
    const k = 1 - 0.7 * melt; const sz = 130 * k;
    ctx.fillStyle = '#BFE9FF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, -sz / 2, 70 - sz, sz, sz, 22 * k); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, -sz / 2 + 14, 70 - sz + 14, sz * 0.25, sz * 0.5, 8); ctx.fill();
    ctx.restore();
  }
  function freezer(ctx, x, y, open, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#EAF4FF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -170, -260, 340, 520, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9ED3FF'; roundRect(ctx, -150, -240, 300, 480, 20); ctx.fill();
    // door (pivot on left)
    ctx.save(); ctx.translate(-170, 0); ctx.scale(1 - open * 0.92, 1);
    ctx.fillStyle = '#F7FBFF'; roundRect(ctx, 0, -260, 340, 520, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.grey; roundRect(ctx, 290, -60, 22, 120, 10); ctx.fill(); ctx.stroke();
    L.snowflake(ctx, 170, -120, 50, t * 0.3, '#5FB8FF');
    ctx.restore(); ctx.restore();
  }
  function particles(ctx, t, o) {
    // o: {jiggle 0..1 (amplitude), bonds 0..1, flow 0..1 (0 grid, 1 liquid), alpha}
    const cols = 8, rows = 5, sx = 150, sy = 128, ox = W / 2 - (cols - 1) * sx / 2, oy = 290;
    const r = L.rng(42); const pts = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const ph = r() * 6.28, ph2 = r() * 6.28, fx = r(), fy = r();
      const gx = ox + j * sx, gy = oy + i * sy;
      // liquid position: pile at bottom with random spread
      const lx = 260 + fx * (W - 520), ly = 690 + fy * 170 + Math.sin(t * 1.5 + ph) * 10;
      const amp = 3 + 34 * o.jiggle;
      const jx = Math.sin(t * (6 + 10 * o.jiggle) + ph) * amp, jy = Math.cos(t * (7 + 9 * o.jiggle) + ph2) * amp;
      const f = E.inOut(o.flow); pts.push({ x: lerp(gx, lx, f) + jx + (f > 0 ? Math.sin(t * 2 + ph) * 60 * f : 0), y: lerp(gy, ly, f) + jy, i, j, ph });
    }
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.bonds > 0) { ctx.strokeStyle = `rgba(43,45,66,${0.9 * o.bonds})`; ctx.lineWidth = 10; ctx.lineCap = 'round'; for (const p of pts) { const right = pts.find(q => q.i === p.i && q.j === p.j + 1), down = pts.find(q => q.i === p.i + 1 && q.j === p.j); for (const q of [right, down]) if (q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } } }
    for (const p of pts) {
      circle(ctx, p.x, p.y, 46, P.pink, P.ink, 6);
      circle(ctx, p.x - 14, p.y - 8, 6, P.ink); circle(ctx, p.x + 14, p.y - 8, 6, P.ink);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); if (o.jiggle > 0.6) ctx.arc(p.x, p.y + 10, 10, 0, Math.PI * 2); else ctx.arc(p.x, p.y + 6, 12, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      circle(ctx, p.x - 20, p.y + 14, 7, 'rgba(255,255,255,0.5)');
    }
    ctx.restore();
  }
  function labBackground(ctx, color) { ctx.fillStyle = color || '#FFF0F6'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(255,120,170,0.25)'; ctx.lineWidth = 3; for (let x = 0; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }

  // main scene state helper (shared by video + interactive): sun position, melt
  function coneScene(ctx, t, o) {
    // o: {sunX, sunY, sunIn 0..1, melt, shiver, pipMood, heat, armR}
    L.sky(ctx); L.cloud(ctx, 300 + Math.sin(t * 0.3) * 20, 180, 1.1); L.cloud(ctx, 900 + Math.cos(t * 0.25) * 25, 110, 0.7);
    if (o.sunIn > 0) L.sun(ctx, o.sunX, o.sunY, 120 * o.sunIn, t);
    L.ground(ctx, 820); L.tree(ctx, 240, 830, 1.1);
    const sh = o.shiver ? Math.sin(t * 40) * 6 * o.shiver : 0;
    L.pip(ctx, { x: 620 + sh, y: 720, s: 1.35, t, mood: o.pipMood || 'happy', armR: o.armR == null ? -0.35 : o.armR, armL: 0.6, lookX: 0.7, lookY: -0.2 });
    if (o.heat > 0) { ctx.save(); ctx.globalAlpha = o.heat; L.heatWaves(ctx, 1010, 640, t, 3, 110); ctx.restore(); }
    if (o.coneScale > 0) L.iceCream(ctx, 880, 700, 0.9 * o.coneScale, o.melt, t, { puddleY: 850 });
    if (o.cold > 0) { ctx.save(); ctx.globalAlpha = o.cold; for (let i = 0; i < 5; i++) { const a = t * 0.8 + i * 1.26; L.snowflake(ctx, 880 + Math.cos(a) * 190, 480 + Math.sin(a) * 110, 22, t + i); } ctx.restore(); }
  }

  L.episodes.ep1 = {
    id: 'ep1', num: 1, title: 'Why does ice cream melt?', short: 'Melting ice cream', phrase: 'Heat makes it melt!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie
    thumb: { big: "ICE CREAM", small1: "Why does", small2: "melt?", bg: (ctx, t) => { L.sky(ctx); L.sun(ctx, 1600, 220, 130, t); L.ground(ctx, 820); L.iceCream(ctx, 1250, 760, 1.7, 0.35, t, { puddleY: 860 }); L.heatWaves(ctx, 1480, 560, t, 3, 140); } },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why does ice cream melt?", say: "Today's big question... Why does ice cream *melt*?", hold: 0.6 },
      { id: 'look', text: 'Look! Here is a lovely ice cream cone. It is cold and hard. Brrr!', say: "{sfx:pop}Look! Here is a lovely ice cream cone. Ooh... it is cold... and *hard*. {shiver}{sfx:shiver}Burr!{/shiver}", hold: 0.4 },
      { id: 'sunny', text: 'Now the sun is shining. It is warm. Watch what happens.', say: "{sfx:sparkle}Now... the sun is shining! It is *warm*. {w}Watch... what happens.{/w}", hold: 1.4 },
      { id: 'drip', text: 'Drip... drip... drip! The ice cream is turning into liquid. It is melting!', say: "{hi}{rise}{sfx:drip}Drip... {sfx:drip}drip... {sfx:drip}drip!{/rise}{/hi} The ice cream is turning into liquid. It is *melting*!", hold: 0.6 },
      { id: 'why', text: "Why? Let's look closer. Much, much closer.", say: "Why? Let's look closer. {sfx:zoom}Much... *much* closer.", hold: 0.8 },
      { id: 'bits', text: 'Ice cream is made of tiny, tiny bits, far too small to see.', say: "Ice cream is made of *tiny*, tiny bits... {w}far too small to see.{/w}", hold: 0.4 },
      { id: 'cold', text: 'When ice cream is cold, the tiny bits hold on to each other tightly. So the ice cream stays hard. We call that a solid.', say: "When ice cream is cold, the tiny bits hold on to each other... *tightly*. So the ice cream stays *hard*. We call that... {sfx:click}a *solid*.", hold: 0.6 },
      { id: 'warm', text: 'When something warm touches the ice cream, like the sun, or your warm hand, it gives the tiny bits heat.', say: "When something *warm* touches the ice cream... like the sun, or your warm hand... it gives the tiny bits *heat*.", hold: 0.4 },
      { id: 'wiggle', text: 'Heat makes the tiny bits wiggle and jiggle! They wiggle so much that they let go of each other.', say: "{sfx:wiggle}Heat makes the tiny bits *wiggle*, and *jiggle*! {sfx:wiggle}They wiggle so much... that they let *go* of each other.", hold: 0.6 },
      { id: 'flow', text: 'Now they can slide and flow. The ice cream becomes runny, like a liquid. That is melting!', say: "{sfx:whoosh}Now they can *slide*, and *flow*. The ice cream becomes runny, like a *liquid*. That... is *melting*!", hold: 0.8 },
      { id: 'sayit', text: 'So, heat makes solid ice cream melt into a liquid. Say it with me: heat makes it melt!', say: "So, heat makes solid ice cream melt into a liquid. Say it with me... {sfx:ding}*Heat* makes it *melt*! {pause 0.9} {slow}Heat... makes it... melt!{/slow}", hold: 1.4 },
      { id: 'freeze', text: 'And guess what? If we put the melted ice cream back in the freezer, the cold makes the tiny bits hold hands again, and it turns hard. It freezes!', say: "And guess what? If we put the melted ice cream back in the *freezer*... the cold makes the tiny bits hold hands again, and it turns *hard*. It *freezes*!", hold: 0.8 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for two ice cubes.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for *two* ice cubes.", hold: 0.3 },
      { id: 'try2', text: 'Put one in the sunshine, and one in the shade. Which one melts first? Watch and see!', say: "Put one in the *sunshine*... and one in the *shade*. {sfx:ding}Which one melts first? {w}Watch... and see!{/w}", hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: heat makes things melt. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... *heat* makes things *melt*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'look', offset: 0.2, name: 'pop' }, { line: 'look', offset: 2.6, name: 'shiver' },
      { line: 'sunny', offset: 0.3, name: 'sparkle' },
      { line: 'drip', offset: 0.0, name: 'drip' }, { line: 'drip', offset: 0.9, name: 'drip' }, { line: 'drip', offset: 1.8, name: 'drip' },
      { line: 'why', offset: 1.4, name: 'zoom' },
      { line: 'bits', offset: 0.1, name: 'bubble' }, { line: 'cold', offset: 0.6, name: 'click' },
      { line: 'wiggle', offset: 0.5, name: 'wiggle' }, { line: 'wiggle', offset: 2.0, name: 'wiggle' },
      { line: 'flow', offset: 0.3, name: 'whoosh' }, { line: 'sayit', offset: 3.2, name: 'ding' },
      { line: 'freeze', chunk: 'the cold makes', offset: 0.5, name: 'shiver' }, { line: 'freeze', chunk: 'it freezes', offset: 0.3, name: 'sparkle' },
      { line: 'try1', offset: 0.1, name: 'tada' }, { line: 'try2', offset: 4.2, name: 'ding' },
      { line: 'bye', offset: 0.0, name: 'tada' }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => L.iceCream(c, 0, 110, 0.8, 0, tt)) },
      {
        from: 'look', draw: (ctx, t, Lt) => {
          const coneScale = Lt.win('look', 0.1, 0.5, E.outBack);
          const shiver = Lt.cwin('look', 'burr', 0.2) * (1 - Lt.cwin('look', 'burr', 0.4, null, 1.0));
          const sunIn = Lt.cwin('sunny', 'the sun is shining', 1.2, E.outBack); const sunX = lerp(2100, 1480, sunIn), sunY = lerp(-100, 220, sunIn);
          const heat = Lt.cwin('sunny', 'it is warm', 0.8);
          const melt = 0.78 * Lt.span('drip', 'drip', E.inOut);
          const cold = Lt.after('look') && !Lt.after('sunny') ? Lt.cwin('look', 'it is cold', 0.5) : (1 - Lt.win('sunny', 0, 0.8));
          const mood = Lt.after('drip') ? (Lt.p('drip') < 0.9 ? 'wow' : 'talk') : (shiver > 0 ? 'sad' : 'talk');
          coneScene(ctx, t, { sunX, sunY, sunIn, heat, melt, coneScale, cold, shiver, pipMood: mood });
          L.sticker(ctx, 'cold and hard', 1300, 520, Lt.cwin('look', 'and hard', 0.5) * (1 - Lt.win('sunny', 0, 0.3)), { bg: '#BFE9FF', size: 72, rot: 0.08 });
          L.sticker(ctx, 'warm!', 1200, 420, Lt.cwin('sunny', 'it is warm', 0.5) * (1 - Lt.win('drip', 0, 0.3)), { bg: P.sun, size: 80, rot: -0.1 });
          L.sticker(ctx, 'MELTING!', 1300, 450, Lt.cwin('drip', 'it is melting', 0.5), { bg: P.pink, size: 96, rot: -0.08 });
        }
      },
      {
        from: 'why', transition: 'cut', draw: (ctx, t, Lt) => {
          coneScene(ctx, t, { sunX: 1480, sunY: 220, sunIn: 1, heat: 1, melt: 0.78, coneScale: 1, cold: 0, pipMood: 'think' });
          const p = seg(t, Lt.chunk('why', 'look closer'), Lt.end('why') + 0.6, E.in); const r = lerp(140, 2400, p); const mx = 880, my = 470;
          ctx.save(); ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.clip();
          labBackground(ctx); particles(ctx, t, { jiggle: 0.35, bonds: 0, flow: 0, alpha: 1 });
          ctx.restore();
          if (p < 1) L.magnifier(ctx, mx, my, r, p);
        }
      },
      {
        from: 'bits', transition: 'cut', draw: (ctx, t, Lt) => {
          labBackground(ctx);
          const bonds = Lt.win('cold', 0.4, 0.8) * (1 - Lt.cwin('wiggle', 'they wiggle so much', 1.2, null, 1.2));
          const jiggle = Lt.after('wiggle') ? lerp(0.1, 1, Lt.win('wiggle', 0.3, 2.5)) : (Lt.after('cold') ? 0.05 : 0.35);
          const flow = Lt.span('flow', 'flow', E.inOut);
          particles(ctx, t, { jiggle, bonds, flow, alpha: 1 });
          // icons
          if (Lt.after('cold') && !Lt.after('warm')) { const sp = Lt.win('cold', 0, 0.5, E.outBack); ctx.save(); ctx.translate(200, 200); ctx.scale(sp, sp); circle(ctx, 0, 0, 110, P.white, P.ink, 8); L.snowflake(ctx, 0, 0, 70, t * 0.5, '#5FB8FF'); ctx.restore(); }
          if (Lt.after('warm')) {
            const sp = Lt.win('warm', 0, 0.5, E.outBack); ctx.save(); ctx.translate(200, 200); ctx.scale(sp, sp); L.sun(ctx, 0, 0, 90, t); ctx.restore();
            const hp = Lt.cwin('warm', 'like the sun', 0.5, E.outBack, 1.0); if (hp > 0) { ctx.save(); ctx.translate(W - 220, 230); ctx.scale(hp, hp); L.hand(ctx, 0, 0, 1.3, 0.3); ctx.restore(); }
            const ap = Lt.cwin('warm', 'it gives the tiny', 0.6, null, 0.6); if (ap > 0 && !Lt.after('flow')) { ctx.save(); ctx.globalAlpha = ap; for (let i = 0; i < 5; i++) { const y = 260 + i * 110; const off = (t * 300) % 120; L.arrow(ctx, 300 + off, y, 420 + off, y, P.red, 12); L.arrow(ctx, W - 300 - off, y, W - 420 - off, y, P.red, 12); } L.heatWaves(ctx, 200, 420, t, 3, 110); ctx.restore(); }
          }
          L.sticker(ctx, 'tiny bits', W / 2, 200, Lt.win('bits', 1.4, 0.5) * (1 - Lt.win('cold', 0, 0.3)), { bg: P.pink, size: 80, rot: -0.06 });
          L.sticker(ctx, 'SOLID', W / 2, 200, Lt.cwin('cold', 'a solid', 0.5) * (1 - Lt.win('warm', 0, 0.3)), { bg: '#BFE9FF', size: 96, rot: 0.04 });
          L.sticker(ctx, 'HEAT', W / 2, 200, Lt.cwin('warm', 'it gives the tiny', 0.5, null, 1.2) * (1 - Lt.win('wiggle', 0.2, 0.3)), { bg: P.red, color: P.white, size: 96, rot: -0.05 });
          L.sticker(ctx, 'wiggle & jiggle!', W / 2, 200, Lt.win('wiggle', 0.8, 0.5) * (1 - Lt.win('flow', 0, 0.3)), { bg: P.sun, size: 84, rot: 0.05 });
          L.sticker(ctx, 'LIQUID', W / 2, 200, Lt.cwin('flow', 'that... is', 0.5, null, -0.3), { bg: P.blue, color: P.white, size: 96, rot: -0.04 });
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          coneScene(ctx, t, { sunX: 1480, sunY: 220, sunIn: 1, heat: 0.8, melt: 0.78, coneScale: 1, cold: 0, pipMood: 'talk', armR: Lt.cafter('sayit', 'heat makes it melt') ? -1.3 : -0.35 });
          L.sayItSticker(ctx, 'Heat makes it melt!', Lt.cwin('sayit', 'heat makes it melt', 0.8), t);
        }
      },
      {
        from: 'freeze', draw: (ctx, t, Lt) => {
          const fin = Lt.cwin('freeze', 'if we put', 1.0, E.outBack, 0.8); const fx = lerp(2200, 1500, fin);
          const slide = Lt.cwin('freeze', 'if we put', 1.0, E.inOut, 2.4); const doorOpen = fin > 0.9 ? (1 - Lt.cwin('freeze', 'the cold makes', 0.5)) + Lt.cwin('freeze', 'it freezes', 0.6, null, 0.3) : 0;
          const melt = 0.78 * (1 - Lt.cwin('freeze', 'the cold makes', 3.0, E.inOut, 0.5));
          L.sky(ctx); L.cloud(ctx, 300, 180, 1.1); L.ground(ctx, 820); L.tree(ctx, 240, 830, 1.1);
          L.pip(ctx, { x: 620, y: 720, s: 1.35, t, mood: Lt.cafter('freeze', 'it freezes') ? 'wow' : 'talk', armR: -0.3, armL: 0.6, lookX: 0.8 });
          const cx = lerp(880, fx, slide), cy = lerp(700, 860, slide);
          if (slide < 1) L.iceCream(ctx, cx, cy, 0.9, melt * (1 - slide), t, { puddleY: 850 });
          freezer(ctx, fx, 620, Math.min(1, doorOpen), t);
          if (slide >= 1) { ctx.save(); if (doorOpen < 0.5) { ctx.beginPath(); ctx.rect(fx - 150, 380, 300, 480); ctx.clip(); } L.iceCream(ctx, fx, 860, 0.85, melt, t); ctx.restore(); if (doorOpen < 0.5) { ctx.save(); ctx.translate(fx - 170, 0); L.roundRect(ctx, 0, 360, 340, 520, 30); ctx.fillStyle = '#F7FBFF'; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.stroke(); L.snowflake(ctx, 170, 500, 50, t * 0.3, '#5FB8FF'); ctx.restore(); } }
          if (Lt.cafter('freeze', 'the cold makes', 0.5) && !Lt.cafter('freeze', 'it freezes', 0.9)) { ctx.save(); ctx.globalAlpha = 0.9; for (let i = 0; i < 6; i++) { const a = t * 1.2 + i * 1.05; L.snowflake(ctx, fx + Math.cos(a) * 260, 600 + Math.sin(a) * 300, 24, t + i); } ctx.restore(); }
          L.sticker(ctx, 'FREEZE!', 1100, 300, Lt.cwin('freeze', 'it freezes', 0.5, null, 0.2), { bg: '#BFE9FF', size: 96, rot: -0.08 });
        }
      },
      {
        from: 'try1', draw: (ctx, t, Lt) => {
          L.sky(ctx); L.ground(ctx, 820);
          const split = Lt.win('try2', 0.3, 0.8, E.inOut);
          if (split > 0) { ctx.save(); ctx.globalAlpha = split; L.sun(ctx, 480, 300, 110, t); L.cloud(ctx, 1440, 260, 1.5, '#DDE6F0'); L.tree(ctx, 1700, 830, 1.2); ctx.fillStyle = 'rgba(60,80,120,0.25)'; ctx.fillRect(1120, 0, W - 1120, H); ctx.restore(); }
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.5, 0.6));
          const cp = Lt.cwin('try1', 'ask a grown-up', 0.6, E.outBack, 1.2);
          const meltL = Lt.cwin('try2', 'and one in the shade', 5.0, E.inOut, 0.6) * 0.9;
          if (cp > 0) { iceCube(ctx, lerp(760, 480, split), 700, cp * 1.7, meltL, t); iceCube(ctx, lerp(1160, 1440, split), 700, cp * 1.7, 0, t); }
          if (split > 0.9 && meltL > 0.2) L.heatWaves(ctx, 480, 560, t, 3, 90);
          L.sticker(ctx, 'Which melts first?', W / 2, 560, Lt.cwin('try2', 'which one melts', 0.6), { bg: P.sun, size: 72, rot: 0 });
          L.pip(ctx, { x: 960, y: 760, s: 0.75, t, mood: 'talk', armR: -0.4, armL: 0.6, lookY: -0.5 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Heat makes things melt!') }
    ],
    // ---- interactive mode ----
    interactive: {
      hint: 'Drag the sun close to the ice cream to melt it. Tap the freezer to make it hard again.',
      init: s => { s.sunX = 1650; s.sunY = 200; s.melt = 0; s.drag = false; s.cold = 0; s.lastCue = ''; s.refreeze = false; s.moved = false; },
      update: (s, dt, cue) => {
        const d = Math.hypot(s.sunX - 880, s.sunY - 520); const heat = clamp(1 - (d - 220) / 500, 0, 1);
        s.heat = heat; s.melt = clamp(s.melt + (heat * 0.22 - (s.cold > 0 ? 0.6 : 0.01)) * dt, 0, 0.85);
        if (s.cold > 0) s.cold = Math.max(0, s.cold - dt);
        // one cue per event: 'melt' once per melting, 'cold' once the freezer has made it hard again
        if (s.cold > 0) { if (s.refreeze && s.melt < 0.1) { s.refreeze = false; s.lastCue = 'cold'; cue('cold'); } }
        else if (heat > 0.5 && s.melt > 0.3 && s.lastCue !== 'melt') { s.lastCue = 'melt'; cue('melt'); }
      },
      draw: (ctx, s, t) => {
        coneScene(ctx, t, { sunX: s.sunX, sunY: s.sunY, sunIn: 1, heat: s.heat, melt: s.melt, coneScale: 1, cold: s.cold > 0 ? 1 : 0, pipMood: s.melt > 0.5 ? 'wow' : 'happy' });
        freezer(ctx, 1600, 640, 0, t); text(ctx, 'tap me', 1600, 950, { size: 60, weight: 600, color: P.ink });
        ctx.save(); ctx.globalAlpha = 0.9; L.sticker(ctx, s.melt > 0.6 ? 'LIQUID' : s.melt > 0.2 ? (s.cold > 0 ? 'freezing...' : 'melting...') : 'SOLID', 620, 300, 1, { bg: s.melt > 0.6 ? P.blue : s.melt > 0.2 ? (s.cold > 0 ? '#BFE9FF' : P.pink) : '#BFE9FF', color: s.melt > 0.6 ? P.white : P.ink, size: 72, rot: 0 }); ctx.restore();
        if (!s.moved) { text(ctx, 'drag me', s.sunX - 330, s.sunY - 30, { size: 64, weight: 600, color: P.ink }); L.arrow(ctx, s.sunX - 300, s.sunY + 30, s.sunX - 440, s.sunY + 160, P.sun, 12); }
      },
      pointer: (s, type, x, y) => {
        if (type === 'down') { if (Math.hypot(x - s.sunX, y - s.sunY) < 200) s.drag = true; else if (Math.abs(x - 1600) < 180 && Math.abs(y - 640) < 270) { s.cold = 4; s.refreeze = s.melt > 0.15; } }
        if (type === 'move' && s.drag) { s.sunX = clamp(x, 120, W - 120); s.sunY = clamp(y, 100, 760); if (Math.hypot(s.sunX - 1650, s.sunY - 200) > 60) s.moved = true; }
        if (type === 'up') s.drag = false;
      },
      cues: { melt: 'The sun is warm! Heat makes the ice cream melt.', cold: 'Brrr! The freezer is cold. The ice cream is hard again.' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 2 — Why does a ball always come down? */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  // parabola from (x0,y0) to apex height h and back to ground at x1; p 0..1
  function arc(p, x0, y0, x1, y1, h) { const x = lerp(x0, x1, p); const y = lerp(y0, y1, p) - 4 * h * p * (1 - p); return [x, y]; }
  function leaf(ctx, x, y, rot, s) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.green; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(0, -45, 50, 0); ctx.quadraticCurveTo(0, 45, -50, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.stroke(); ctx.restore(); }
  function drop(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.blue; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(22, 5, 0, 24); ctx.quadraticCurveTo(-22, 5, 0, -30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function toy(ctx, x, y, s) { // toy block with a star
    ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.purple; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, -50, -50, 100, 100, 16); ctx.fill(); ctx.stroke(); L.star(ctx, 0, 0, 30, P.sun); ctx.restore();
  }
  function earth(ctx, x, y, r, t) {
    circle(ctx, x, y, r, P.waterDeep, P.ink, 8);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = P.green;
    ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.25, r * 0.35, r * 0.28, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + r * 0.4, y + r * 0.1, r * 0.3, r * 0.4, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - r * 0.1, y + r * 0.55, r * 0.4, r * 0.2, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // smile
    circle(ctx, x - r * 0.18, y - r * 0.05, r * 0.05, P.ink); circle(ctx, x + r * 0.18, y - r * 0.05, r * 0.05, P.ink);
    ctx.strokeStyle = P.ink; ctx.lineWidth = r * 0.04; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + r * 0.08, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  function space(ctx, t) { ctx.fillStyle = P.night; ctx.fillRect(0, 0, W, H); const r = L.rng(5); for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, ph = r() * 6; circle(ctx, x, y, 2 + 2 * Math.sin(t * 2 + ph), 'rgba(255,255,255,0.8)'); } }
  function dust(ctx, x, y, p) { if (p <= 0 || p >= 1) return; ctx.save(); ctx.globalAlpha = 1 - p; for (let i = 0; i < 6; i++) { const a = Math.PI + i * Math.PI / 5; circle(ctx, x + Math.cos(a) * 120 * p, y + Math.sin(a) * 40 * p, 18 * (1 - p * 0.5), '#E8D8B0'); } ctx.restore(); }

  function throwScene(ctx, t, Lt, line, height, o) {
    // Curie throws at ~0.15 of the line; ball goes up then down landing at ~0.85
    o = o || {}; L.park(ctx, t, { house: true });
    const t0 = Lt.chunk(line, 'up...'), t1 = Lt.chunk(line, o.landNeedle || 'it comes') + 0.25; const fly = seg(t, t0, t1); const p = seg(t, Lt.start(line), t1 + 0.6); const [bx, by] = arc(fly, 760, 600, 1150, 820 - 60, height);
    const look = fly > 0 && fly < 1 ? clamp((by - 300) / 500, -1, 1) * -1 : 0;
    L.pip(ctx, { x: 620, y: 720, s: 1.3, t, mood: fly > 0.4 && fly < 0.95 ? 'wow' : 'talk', armR: fly > 0 && fly < 0.3 ? -1.4 : (fly <= 0 ? -0.3 : -0.9), armL: 0.6, lookX: fly > 0 ? lerp(0.3, 1, fly) : 0.6, lookY: -Math.abs(look) });
    const land = seg(t, t1, t1 + 0.5);
    L.ball(ctx, fly <= 0 ? 775 : bx, fly <= 0 ? 600 : by + (land > 0 ? Math.sin(land * Math.PI) * -40 : 0), 60, P.red, t, fly * 8);
    dust(ctx, 1150, 790, land * 1.5);
    if (o.arrowUp && fly > 0.05 && fly < 0.45) L.arrow(ctx, bx + 110, by + 40, bx + 110, by - 110, P.green, 12);
    if (o.arrowDown && fly > 0.55 && fly < 0.95) L.arrow(ctx, bx + 110, by - 110, bx + 110, by + 40, P.blue, 12);
  }

  L.episodes.ep2 = {
    id: 'ep2', num: 2, title: 'Why does a ball always come down?', short: 'Why things fall', phrase: 'Gravity pulls things down!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie
    thumb: { big: "COME DOWN?", small1: "Why does a ball always", small2: "", bg: (ctx, t) => { L.sky(ctx); L.sun(ctx, 1700, 200, 110, t); L.ground(ctx, 820); L.ball(ctx, 1250, 360, 150, P.red, t); L.arrow(ctx, 1480, 300, 1480, 640, P.blue, 22); } },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why does a ball always come down?", say: "Today's big question... Why does a ball *always* come down?", hold: 0.6 },
      { id: 'throw', text: 'Curie throws the ball up... up... up! And look. Down it comes.', say: "Curie throws the ball, {sfx:whoosh}{rise}up... up... up!{/rise} And look. {sfx:boing}{fall}Down... it comes.{/fall}", hold: 0.8 },
      { id: 'again', text: "Let's try again, higher! Up, up, up... and down. Every single time!", say: "Let's try again, *higher*! {sfx:whoosh}{rise}Up... up... up!{/rise} {fall}And... down.{/fall} {sfx:boing}{slow}Every... {pause 0.25} single... {pause 0.25} *time*!{/slow}", hold: 0.8 },
      { id: 'why', text: "Why doesn't the ball just float away into the sky?", say: "{sfx:bubble}Why doesn't the ball just float *away*... into the sky?", hold: 0.8 },
      { id: 'earth', text: "Here's the secret. Our Earth is enormous. And it pulls everything towards it.", say: "Here's the secret. {sfx:zoom}Our Earth... is *enormous*! And it pulls *everything* towards it.", hold: 0.6 },
      { id: 'gravity', text: 'This pull has a name: gravity. Gravity pulls the ball down.', say: "This pull has a name... {sfx:ding}*gravity*. Gravity pulls the ball *down*.", hold: 0.8 },
      { id: 'feel', text: "You can't see gravity. But you can feel it! Jump up... and gravity brings you back down. Thump!", say: "You can't *see* gravity. But you can *feel* it! {sfx:boing}Jump up... and gravity brings you back down. {lo}{sfx:thump}Thump!{/lo}", hold: 0.8 },
      { id: 'pulls', text: 'Gravity pulls the ball. Gravity pulls a leaf. Gravity pulls the rain. Gravity pulls you and me!', say: "{sfx:boing}Gravity pulls the ball. {sfx:whoosh}Gravity pulls a leaf. {sfx:drip}Gravity pulls the rain. {sfx:thump}Gravity pulls *you*... and *me*!", hold: 0.6 },
      { id: 'feet', text: "Gravity even keeps your feet on the ground, so you don't float away. Thank you, gravity!", say: "Gravity even keeps your feet on the ground, so you don't float away. {sfx:sparkle}Thank you, gravity!", hold: 0.6 },
      { id: 'together', text: 'Gravity pulls everything, big or small. A big ball and a small ball drop together... and land together!', say: "Gravity pulls everything, *big* or *small*. A big ball and a small ball drop together... {sfx:thump}and land *together*! {sfx:tada}", hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: gravity pulls things down!', say: "Say it with me... {sfx:ding}*Gravity* pulls things *down*! {pause 0.9} {slow}Gravity... pulls things... down!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Hold a ball in one hand, and a toy in the other, at the same height.", say: "{sfx:tada}Let's try it at home! Hold a ball in one hand, and a toy in the other... at the *same* height.", hold: 0.4 },
      { id: 'try2', text: 'Let go at the same time. Which one lands first? Watch closely!', say: "Let go at the *same* time. {sfx:ding}Which one lands first? {w}Watch closely!{/w}", hold: 1.8 },
      { id: 'bye', text: 'Great job, little scientist! Remember: gravity pulls everything down to the Earth. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... *gravity* pulls everything *down* to the Earth. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'throw', offset: 0.5, name: 'whoosh' }, { line: 'throw', offset: 3.6, name: 'boing' },
      { line: 'again', offset: 0.9, name: 'whoosh' }, { line: 'again', offset: 3.9, name: 'boing' },
      { line: 'why', offset: 0.3, name: 'bubble' }, { line: 'earth', offset: 1.2, name: 'zoom' }, { line: 'gravity', offset: 1.8, name: 'ding' },
      { line: 'feel', offset: 3.2, name: 'boing' }, { line: 'feel', offset: 4.6, name: 'thump' },
      { line: 'pulls', offset: 0.9, name: 'boing', vol: 0.6 }, { line: 'pulls', offset: 2.6, name: 'whoosh', vol: 0.5 }, { line: 'pulls', offset: 4.2, name: 'drip' }, { line: 'pulls', offset: 5.7, name: 'thump' },
      { line: 'feet', offset: 4.2, name: 'sparkle' }, { line: 'together', offset: 4.6, name: 'thump' }, { line: 'together', offset: 5.4, name: 'tada' },
      { line: 'sayit', offset: 1.4, name: 'ding' }, { line: 'try1', offset: 0.1, name: 'tada' }, { line: 'try2', chunk: 'let go', offset: 1.8, name: 'thump' },
      { line: 'bye', offset: 0.0, name: 'tada' }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { L.ball(c, -40, 20, 70, P.red, tt); L.arrow(c, 80, -70, 80, 90, P.blue, 12); }) },
      { from: 'throw', draw: (ctx, t, Lt) => { throwScene(ctx, t, Lt, 'throw', 420, { arrowUp: true, arrowDown: true }); } },
      { from: 'again', transition: 'cut', draw: (ctx, t, Lt) => { throwScene(ctx, t, Lt, 'again', 640, { arrowDown: true, landNeedle: 'down.' }); L.sticker(ctx, 'Every time!', 1450, 300, Lt.cwin('again', 'every', 0.5), { bg: P.sun, size: 84, rot: -0.08 }); } },
      {
        from: 'why', transition: 'cut', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: true });
          L.pip(ctx, { x: 620, y: 720, s: 1.3, t, mood: 'think', armR: -0.6, armL: 0.6, lookX: 0.5, lookY: -0.9 });
          const p = Lt.span('why'); ctx.save(); ctx.setLineDash([14, 12]); ctx.globalAlpha = 0.6; const y = lerp(760, -100, p); circle(ctx, 1150, y, 60, 'rgba(255,92,92,0.25)', P.red, 6); ctx.restore();
          L.questionMark(ctx, 1300, lerp(700, 200, p), 0.9, t);
          L.ball(ctx, 1150, 760, 60, P.red, t);
        }
      },
      {
        from: 'earth', draw: (ctx, t, Lt) => {
          space(ctx, t); const zoom = Lt.cwin('earth', 'our earth', 1.5, E.inOut, -0.2); const r = lerp(2600, 330, zoom); const cx = W / 2, cy = lerp(2600 + 700, 560, zoom);
          earth(ctx, cx, cy, r, t);
          // Curie standing on top
          L.pip(ctx, { x: cx, y: cy - r - 60 * (1 - zoom) - 80, s: 0.6 + 0.9 * (1 - zoom), t, mood: 'talk', armR: -0.4, armL: 0.6, bob: false });
          if (zoom > 0.95) {
            const ap = Lt.cwin('earth', 'and it pulls', 0.8); const items = [[-1, -0.3], [1, -0.3], [-0.85, 0.45], [0.85, 0.45], [0.55, -0.85]];
            ctx.save(); ctx.globalAlpha = ap;
            items.forEach(([dx, dy], i) => { const d = Math.hypot(dx, dy); const ux = dx / d, uy = dy / d; const x = cx + ux * (r + 190), y = cy + uy * (r + 190); if (i === 0) L.ball(ctx, x, y, 44, P.red, t); else if (i === 1) L.iceCream(ctx, x, y + 60, 0.4, 0, t); else if (i === 2) leaf(ctx, x, y, 0.5, 0.9); else if (i === 3) toy(ctx, x, y, 0.8); else drop(ctx, x, y, 1.6); L.arrow(ctx, x - ux * 80, y - uy * 80, x - ux * 160, y - uy * 160, P.sun, 12); });
            ctx.restore();
          }
          L.sticker(ctx, 'enormous!', 330, 200, Lt.cwin('earth', 'is enormous', 0.5) * (1 - Lt.cwin('earth', 'and it pulls', 0.3, null, 1.2)), { bg: P.sun, size: 80, rot: -0.1 });
          L.sticker(ctx, 'GRAVITY', W / 2, 200, Lt.cwin('gravity', 'gravity.', 0.6), { bg: P.purple, color: P.white, size: 110, rot: -0.04 });
        }
      },
      {
        from: 'feel', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: true });
          const jp = Lt.cwin('feel', 'jump up', 1.6, null, 0.3); const jy = -Math.sin(jp * Math.PI) * 330; const land = Lt.cwin('feel', 'jump up', 0.5, null, 1.85); const sq = land > 0 ? 0.2 * Math.sin(land * Math.PI) : (jp > 0 && jp < 0.15 ? -0.15 * Math.sin(jp / 0.15 * Math.PI) : 0);
          L.pip(ctx, { x: 820, y: 720 + jy, s: 1.3, t, mood: jp > 0 && jp < 1 ? 'wow' : 'talk', armR: jp > 0 && jp < 1 ? -1.4 : -0.4, armL: jp > 0 && jp < 1 ? 1.4 + Math.PI : 0.6, squash: sq, bob: false });
          if (jp > 0.35 && jp < 1) L.arrow(ctx, 1080, 420, 1080, 640, P.blue, 14);
          dust(ctx, 820, 800, land * 1.6);
          L.sticker(ctx, 'Thump!', 1250, 560, Lt.cwin('feel', 'thump', 0.4) * (1 - Lt.cwin('feel', 'thump', 0.3, null, 2.5)), { bg: P.sun, size: 96, rot: 0.1 });
          L.sticker(ctx, "can't see it... can feel it!", W / 2, 230, Lt.cwin('feel', 'but you can feel', 0.5) * (1 - Lt.cwin('feel', 'jump up', 0.3)), { bg: P.pink, size: 64, rot: -0.03 });
        }
      },
      {
        from: 'pulls', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: false, tree: false });
          const xs = [380, 760, 1140, 1520]; const needles = ['pulls the ball', 'pulls a leaf', 'pulls the rain', 'pulls you'];
          needles.forEach((nd, i) => {
            const p = Lt.cwin('pulls', nd, 1.1, E.in, 0.3); const y = lerp(200, 760, p); const x = xs[i];
            if (p <= 0) return;
            if (i === 0) L.ball(ctx, x, y, 56, P.red, t, p * 6);
            else if (i === 1) leaf(ctx, x + Math.sin(p * 9) * 60, lerp(200, 790, seg(p, 0, 1)), Math.sin(p * 9) * 0.6, 1.1);
            else if (i === 2) { for (let k = 0; k < 3; k++) drop(ctx, x - 70 + k * 70, y - k * 60, 1.6); }
            else L.pip(ctx, { x, y: Math.min(y, 720), s: 1.0, t, mood: 'wow', armR: -1.3, armL: 1.3 + Math.PI, bob: false });
            L.arrow(ctx, x + 120, y - 120, x + 120, y + 10, P.blue, 12);
          });
          L.sticker(ctx, 'GRAVITY', W / 2, 110, 1, { bg: P.purple, color: P.white, size: 80, rot: 0 });
          if (Lt.after('feet')) {
            const fp = Lt.win('feet', 0, 0.6, E.outBack); ctx.save(); ctx.globalAlpha = fp; L.arrow(ctx, 1520 - 160, 560, 1520 - 160, 700, P.blue, 12); L.arrow(ctx, 1520 + 160, 560, 1520 + 160, 700, P.blue, 12); ctx.restore();
            L.sticker(ctx, 'Thank you, gravity!', 820, 460, Lt.cwin('feet', 'thank you', 0.6), { bg: P.pink, size: 80, rot: -0.05 });
          }
        }
      },
      {
        from: 'together', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: true, tree: false });
          // shelf
          ctx.fillStyle = P.brown; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, 760, 300, 520, 28, 10); ctx.fill(); ctx.stroke(); roundRect(ctx, 790, 328, 20, 440, 6); ctx.fill(); ctx.stroke(); roundRect(ctx, 1250, 328, 20, 440, 6); ctx.fill(); ctx.stroke();
          const d = Lt.cwin('together', 'drop together', 1.0, E.in, 0.9); const yB = lerp(300 - 90, 800 - 90, d), yS = lerp(300 - 40, 800 - 40, d);
          L.ball(ctx, 900, yB, 90, P.red, t, d * 5); L.ball(ctx, 1140, yS, 40, P.green, t, d * 8);
          dust(ctx, 900, 800, Lt.cwin('together', 'drop together', 0.5, null, 1.9) * 1.5); dust(ctx, 1140, 800, Lt.cwin('together', 'drop together', 0.5, null, 1.9) * 1.5);
          L.pip(ctx, { x: 450, y: 720, s: 1.2, t, mood: d > 0 && d < 1 ? 'wow' : 'talk', armR: -0.6, armL: 0.6, lookX: 0.8, lookY: d > 0 ? lerp(-0.8, 0.6, d) : -0.6 });
          L.sticker(ctx, 'big', 900, 200, Lt.cwin('together', 'big or small', 0.4, null, 0.2) * (1 - Lt.cwin('together', 'drop together', 0.3, null, 1.9)), { bg: P.sun, size: 72, rot: -0.1 });
          L.sticker(ctx, 'small', 1140, 200, Lt.cwin('together', 'big or small', 0.4, null, 1.0) * (1 - Lt.cwin('together', 'drop together', 0.3, null, 1.9)), { bg: P.sun, size: 72, rot: 0.1 });
          L.sticker(ctx, 'together!', W / 2, 200, Lt.cwin('together', 'and land', 0.5, null, 0.4), { bg: P.green, color: P.white, size: 96, rot: -0.05 });
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: true }); L.pip(ctx, { x: 960, y: 720, s: 1.4, t, mood: 'talk', armR: -1.3, armL: 1.3 + Math.PI, lookY: -0.5 });
          L.ball(ctx, 1350, 760, 60, P.red, t); L.arrow(ctx, 1350, 520, 1350, 660, P.blue, 14);
          L.sayItSticker(ctx, 'Gravity pulls things down!', Lt.cwin('sayit', 'gravity pulls things', 0.8), t);
        }
      },
      {
        from: 'try1', draw: (ctx, t, Lt) => {
          L.sky(ctx); L.ground(ctx, 820); L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.2, 0.6));
          const hp = Lt.cwin('try1', 'hold a ball', 0.7, E.outBack);
          const d = Lt.cwin('try2', 'let go', 0.9, E.in, 0.9); const y = lerp(380, 740, d);
          if (hp > 0) {
            // hands open at try2 release
            const open = Lt.cwin('try2', 'let go', 0.3, null, 0.8);
            ctx.save(); ctx.globalAlpha = hp; L.hand(ctx, 700, 300 - open * 60, 1.3, Math.PI + 0.1); L.hand(ctx, 1220, 300 - open * 60, 1.3, Math.PI - 0.1); ctx.restore();
            L.ball(ctx, 700, y, 64, P.red, t, d * 5); toy(ctx, 1220, y, 1.1);
            ctx.save(); ctx.setLineDash([16, 14]); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(560, 380); ctx.lineTo(1360, 380); ctx.stroke(); ctx.restore();
            text(ctx, 'same height', 960, 350, { size: 40, weight: 600, color: P.ink });
          }
          dust(ctx, 700, 800, Lt.cwin('try2', 'let go', 0.5, null, 1.8) * 1.5); dust(ctx, 1220, 800, Lt.cwin('try2', 'let go', 0.5, null, 1.8) * 1.5);
          L.sticker(ctx, 'Which lands first?', W / 2, 560, Lt.cwin('try2', 'which one lands', 0.6), { bg: P.sun, size: 72, rot: 0 });
          L.pip(ctx, { x: 1650, y: 760, s: 0.8, t, mood: 'talk', armR: -0.4, armL: 0.6, lookX: -0.8, lookY: -0.3 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Gravity pulls things down!') }
    ],
    interactive: {
      hint: 'Drag the ball and let go to throw it. Try to make it float away — you can\'t! Tap the big and small balls to drop them together.',
      init: s => { s.bx = 760; s.by = 600; s.vx = 0; s.vy = 0; s.drag = false; s.lx = 0; s.ly = 0; s.flying = false; s.lastCue = ''; s.dropP = -1; s.throws = 0; },
      update: (s, dt, cue) => {
        if (s.flying) { s.vy += 1800 * dt; s.bx += s.vx * dt; s.by += s.vy * dt; if (s.by > 760) { s.by = 760; s.vy *= -0.4; s.vx *= 0.75; if (Math.abs(s.vy) < 120) { s.flying = false; s.vx = 0; s.vy = 0; if (s.throws >= 2) { s.lastCue = 'down'; cue('down'); } } } if (s.bx < 60 || s.bx > W - 60) { s.vx *= -0.8; s.bx = clamp(s.bx, 60, W - 60); } }
        if (s.dropP >= 0) { s.dropP += dt / 1.0; if (s.dropP > 1.6) { s.dropP = -1; s.lastCue = 'together'; cue('together'); } }
      },
      draw: (ctx, s, t) => {
        L.park(ctx, t, { house: false, tree: false, sunX: 240, sunY: 180, clouds: false }); L.cloud(ctx, 900 + Math.cos(t * 0.25) * 25, 130, 0.8);
        ctx.fillStyle = P.brown; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, 1300, 300, 420, 28, 10); ctx.fill(); ctx.stroke(); roundRect(ctx, 1330, 328, 20, 440, 6); ctx.fill(); ctx.stroke(); roundRect(ctx, 1670, 328, 20, 440, 6); ctx.fill(); ctx.stroke();
        const d = s.dropP < 0 ? 0 : E.in(clamp(s.dropP, 0, 1)); L.ball(ctx, 1420, lerp(210, 710, d), 90, P.red, t); L.ball(ctx, 1600, lerp(260, 760, d), 40, P.green, t);
        text(ctx, 'tap to drop', 1510, 80, { size: 60, weight: 600, color: P.ink });
        L.pip(ctx, { x: 420, y: 720, s: 1.2, t, mood: s.flying ? 'wow' : 'happy', armR: -0.6, armL: 0.6, lookX: clamp((s.bx - 420) / 600, -1, 1), lookY: clamp((s.by - 600) / 400, -1, 1) });
        if (s.drag) { L.arrow(ctx, s.bx, s.by, s.bx + (s.bx - s.lx) * 1.5, s.by + (s.by - s.ly) * 1.5, P.sun, 12); }
        L.ball(ctx, s.bx, s.by, 60, P.red, t, s.bx / 60);
        if (!s.flying && !s.drag && s.throws === 0) text(ctx, 'drag me and let go!', s.bx, s.by - 120, { size: 64, weight: 600, color: P.ink });
        if (s.flying && s.vy < 0) L.arrow(ctx, s.bx + 100, s.by - 100, s.bx + 100, s.by + 40, P.blue, 12);
      },
      pointer: (s, type, x, y) => {
        if (type === 'down') { if (Math.hypot(x - s.bx, y - s.by) < 150) { s.drag = true; s.flying = false; s.lx = x; s.ly = y; } else if (x > 1280 && y < 800 && s.dropP < 0) s.dropP = 0; }
        if (type === 'move' && s.drag) { s.lx = s.bx; s.ly = s.by; s.bx = clamp(x, 60, W - 60); s.by = clamp(y, 60, 760); }
        if (type === 'up' && s.drag) { s.drag = false; const maxUp = Math.sqrt(2 * 1800 * Math.max(0, s.by - 90)); s.vx = clamp((s.bx - s.lx) * 14, -1000, 1000); s.vy = clamp((s.by - s.ly) * 14, -maxUp, 1350); s.flying = true; s.throws++; }
      },
      cues: { down: 'Up it goes... and down it comes. Gravity pulls it down every time!', together: 'Big ball and small ball land together!' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 3 — Where does rain come from? */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  function sea(ctx, t, y, o) {
    o = o || {}; y = y || 760;
    ctx.fillStyle = P.water; ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(x / 90 + t * 2) * 10);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.waterDeep; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const yy = y + 70 + i * 50; const ox = (t * 40 + i * 120) % 300; for (let x = -300 + ox; x < W; x += 300) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 40, yy - 18, x + 80, yy); ctx.stroke(); } }
  }
  function hill(ctx, x, y, w, h, color) { ctx.fillStyle = color || P.ground; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - h * 2, x + w, y); ctx.closePath(); ctx.fill(); }
  function droplet(ctx, x, y, r, alpha, face) { // water bit with a face
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; circle(ctx, x, y, r, P.blue, P.ink, Math.max(3, r * 0.12));
    if (face !== false && r > 14) { circle(ctx, x - r * 0.35, y - r * 0.15, r * 0.12, P.ink); circle(ctx, x + r * 0.35, y - r * 0.15, r * 0.12, P.ink); ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(2, r * 0.08); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    circle(ctx, x - r * 0.4, y - r * 0.45, r * 0.18, 'rgba(255,255,255,0.7)'); ctx.restore();
  }
  function raindrop(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.blue; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(22, 5, 0, 24); ctx.quadraticCurveTo(-22, 5, 0, -30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function rain(ctx, t, x0, x1, y0, y1, n, seed, alpha) {
    const r = L.rng(seed || 9); ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.strokeStyle = P.blue; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), ph = r(), sp = 500 + r() * 300; const y = y0 + ((t * sp + ph * 1000) % (y1 - y0)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 34); ctx.stroke(); }
    ctx.restore();
  }
  function umbrella(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 170); ctx.arc(20, 170, 20, Math.PI, 0, true); ctx.stroke(); ctx.fillStyle = P.red; ctx.beginPath(); ctx.arc(0, 0, 160, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.sun; ctx.beginPath(); ctx.arc(0, 0, 160, Math.PI * 1.2, Math.PI * 1.45); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 160, Math.PI * 1.65, Math.PI * 1.9); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function glass(ctx, x, y, s, o) { // glass of iced water, (x,y) bottom centre
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1);
    ctx.fillStyle = 'rgba(190,230,255,0.85)'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-110, -300); ctx.lineTo(110, -300); ctx.lineTo(90, 0); ctx.lineTo(-90, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.water; ctx.beginPath(); ctx.moveTo(-104, -240); ctx.lineTo(104, -240); ctx.lineTo(90, 0); ctx.lineTo(-90, 0); ctx.closePath(); ctx.fill();
    for (const [cx, cy, r] of [[-40, -190, 0.2], [30, -150, -0.3], [-10, -90, 0.5]]) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(r); ctx.fillStyle = '#DDF3FF'; roundRect(ctx, -32, -32, 64, 64, 10); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; roundRect(ctx, -92, -280, 26, 250, 10); ctx.fill();
    if (o.drops > 0) { const r = L.rng(4); for (let i = 0; i < 26; i++) { const dx = (r() - 0.5) * 180, dy = -270 + r() * 250; const rr = (4 + r() * 9) * Math.min(1, o.drops * 1.5); if (i / 26 < o.drops) { circle(ctx, dx, dy, rr, 'rgba(255,255,255,0.9)', P.blueDeep, 2); } } }
    ctx.restore();
  }
  function cycleDiagram(ctx, t, p, o) {
    // circular diagram: sea (bottom), vapour up (right), cloud (top), rain down (left)
    o = o || {}; const cx = W / 2, cy = 520, R = 300;
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 10; ctx.setLineDash([24, 18]); ctx.lineDashOffset = -t * 60; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // arrows along the circle (clockwise): right side up, left side down
    for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + k * Math.PI / 2 + Math.PI / 4; const x = Math.cos(a) * R, y = Math.sin(a) * R; const dir = a + Math.PI / 2; L.arrow(ctx, x - Math.cos(dir) * 40, y - Math.sin(dir) * 40, x + Math.cos(dir) * 40, y + Math.sin(dir) * 40, P.ink, 10); }
    // icons
    const s = E.outBack(clamp(p, 0, 1)); ctx.scale(s, s);
    // sea bottom
    circle(ctx, 0, R, 90, P.white, P.ink, 8); ctx.save(); ctx.beginPath(); ctx.arc(0, R, 86, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = P.water; ctx.fillRect(-90, R - 10, 180, 100); ctx.restore();
    // vapour right
    circle(ctx, R, 0, 90, P.white, P.ink, 8); for (let i = 0; i < 5; i++) { const yy = 40 - ((t * 60 + i * 30) % 100); droplet(ctx, R - 40 + i * 20, yy, 12, 0.35 + 0.5 * ((yy + 60) / 100), false); }
    // cloud top
    circle(ctx, 0, -R, 90, P.white, P.ink, 8); L.cloud(ctx, 0, -R + 5, 0.8, '#E8EEF5', { outline: P.ink });
    // rain left
    circle(ctx, -R, 0, 90, P.white, P.ink, 8); ctx.save(); ctx.beginPath(); ctx.arc(-R, 0, 86, 0, Math.PI * 2); ctx.clip(); rain(ctx, t, -R - 70, -R + 70, -90, 90, 10, 13); ctx.restore();
    ctx.restore();
    if (o.labels) { text(ctx, 'sea', cx, cy + R + 130, { size: 44, weight: 700 }); text(ctx, 'vapour goes up', cx + R + 320, cy, { size: 44, weight: 700 }); text(ctx, 'cloud', cx, cy - R - 125, { size: 44, weight: 700 }); text(ctx, 'rain comes down', cx - R - 330, cy, { size: 44, weight: 700 }); }
  }

  // main sea scene used for 'sea' → 'river'
  function seaScene(ctx, t, o) {
    // o: {grey 0..1, sunHeat 0..1, vapour 0..1 (particles rising), vapourFade, cold 0..1, cloud 0..1, cloudGrey, rain 0..1, river 0..1, pip}
    o = o || {};
    L.sky(ctx, { top: o.grey ? lerpColor('#9ED3FF', '#8A94A6', o.grey) : undefined, bottom: o.grey ? lerpColor('#CDEBFF', '#C2C9D4', o.grey) : undefined });
    L.sun(ctx, 1620, o.sunY == null ? 220 : o.sunY, 120, t);
    if (o.sunHeat > 0) { ctx.save(); ctx.globalAlpha = o.sunHeat; L.heatWaves(ctx, 1400, 720, t, 4, 120, 'rgba(255,140,60,0.8)'); L.heatWaves(ctx, 1100, 720, t, 3, 100, 'rgba(255,140,60,0.8)'); ctx.restore(); }
    // hill + river on the left
    if (!(o.river > 0)) hill(ctx, 300, 790, 480, 90, '#F3DFA2');
    if (o.river > 0) { hill(ctx, 260, 780, 520, 260, P.ground); ctx.save(); ctx.globalAlpha = o.river; ctx.strokeStyle = P.water; ctx.lineWidth = 46; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(250, 420); ctx.quadraticCurveTo(300, 600, 520, 700); ctx.quadraticCurveTo(620, 740, 760, 775); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 8; ctx.setLineDash([30, 40]); ctx.lineDashOffset = -t * 120; ctx.stroke(); ctx.restore(); }
    sea(ctx, t, 760);
    // cloud
    const cx = 900, cy = 250;
    if (o.cloud > 0) { const cs = 1.2 + 1.4 * o.cloud; L.cloud(ctx, cx, cy, cs, o.cloudGrey > 0 ? lerpColor('#FFFFFF', '#8E97A8', o.cloudGrey) : '#FFFFFF', { outline: P.ink, face: o.cloudGrey > 0.6 ? 'sad' : true }); }
    // vapour particles
    if (o.vapour > 0) {
      const r = L.rng(21); for (let i = 0; i < 18; i++) {
        const x0 = 700 + r() * 1000, ph = r(), sp = 0.08 + r() * 0.05; const f = (t * sp + ph) % 1; if (f > o.vapour) continue;
        const x = lerp(x0, cx + (x0 - 1200) * 0.2, f * f), y = lerp(740, cy + 40, f); const a = o.vapourFade ? clamp(1 - f * 1.3, 0.15, 1) : 1;
        droplet(ctx, x + Math.sin(t * 3 + ph * 6) * 20, y, 22 * (1 - 0.4 * f), a);
      }
    }
    if (o.cold > 0) { ctx.save(); ctx.globalAlpha = o.cold; for (let i = 0; i < 7; i++) { const a = t * 0.6 + i * 0.9; L.snowflake(ctx, 300 + i * 230, 120 + Math.sin(a) * 50, 26, t + i); } ctx.restore(); }
    if (o.rain > 0) rain(ctx, t, cx - 230, cx + 230, cy + 90, 740, Math.floor(40 * o.rain) + 5, 17, Math.min(1, o.rain * 2));
    if (o.pip !== false) L.pip(ctx, { x: 330, y: 600, s: 1.0, t, mood: o.pipMood || 'talk', armR: o.armR == null ? -0.5 : o.armR, armL: 0.6, lookX: 0.8, lookY: o.lookY == null ? -0.4 : o.lookY });
  }
  function lerpColor(a, b, p) { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return 'rgb(' + pa.map((v, i) => Math.round(lerp(v, pb[i], p))).join(',') + ')'; }

  L.episodes.ep3 = {
    id: 'ep3', num: 3, title: 'Where does rain come from?', short: 'Where rain comes from', phrase: 'Sun up, rain down!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie
    thumb: { big: "RAIN", small1: "Where does", small2: "come from?", bg: (ctx, t) => { L.sky(ctx, { top: '#8A94A6', bottom: '#C2C9D4' }); L.cloud(ctx, 1250, 260, 2.6, '#9AA5B8', { outline: P.ink, face: 'sad' }); ctx.save(); ctx.strokeStyle = P.blue; ctx.lineWidth = 10; ctx.lineCap = 'round'; const r = L.rng(3); for (let i = 0; i < 40; i++) { const x = 900 + r() * 700, y = 420 + r() * 400; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 10, y + 50); ctx.stroke(); } ctx.restore(); L.ground(ctx, 820, '#7FB86A'); } },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: where does rain come from?", say: "Today's big question... Where does *rain* come from?", hold: 0.6 },
      { id: 'rain', text: "Pitter patter, pitter patter. It's raining! But where was all this water before?", say: "{sfx:rain}{hi}Pitter patter, pitter patter.{/hi} It's raining! But where was all this water... *before*?", hold: 0.8 },
      { id: 'sea', text: "Let's find out. Here is a big, blue sea. And here is the warm sun.", say: "Let's find out. {sfx:splash}Here is a big, *blue* sea. And here... {sfx:sparkle}is the warm *sun*.", hold: 0.6 },
      { id: 'warm', text: 'The sun warms the water. When water gets warm, tiny bits of it float up into the air.', say: "The sun *warms* the water. And when water gets warm... {sfx:bubble}tiny bits of it float *up*, into the air.", hold: 0.6 },
      { id: 'vapour', text: "They are so tiny, you can't see them. This is called water vapour. Up, up, up they go!", say: "They are *so* tiny, you can't see them. This is called... *water vapour*. {sfx:whoosh}{rise}Up... up... up they go!{/rise}", hold: 0.6 },
      { id: 'cold', text: 'High up in the sky, it is very cold. Brrr! The tiny bits of water get cold and huddle together.', say: "High up in the sky, it is *very* cold. {shiver}{sfx:shiver}Burr!{/shiver} The tiny bits of water get cold... and *huddle* together.", hold: 0.6 },
      { id: 'cloud', text: 'They make tiny droplets. Millions of tiny droplets together make... a cloud!', say: "They make tiny droplets. Millions of tiny droplets together make... {sfx:pop}{sfx:sparkle}a *cloud*!", hold: 0.8 },
      { id: 'join', text: 'The droplets bump into each other and join up. They get bigger... and bigger... and heavier.', say: "The droplets bump into each other, and join up. {sfx:plop}They get bigger... {sfx:plop}and bigger... {sfx:plop}and *heavier*.", hold: 0.6 },
      { id: 'fall', text: "When the drops get too heavy to float, down they fall. That's rain!", say: "When the drops get too heavy to float... {sfx:rain}*down* they fall. That's *rain*!", hold: 0.8 },
      { id: 'river', text: 'The rain fills the rivers, and the rivers run back to the sea. Then the sun warms the water again!', say: "{sfx:rain}The rain fills the rivers, and the rivers run back to the sea. Then the sun warms the water... *again*!", hold: 0.8 },
      { id: 'cycle', text: 'Up as vapour, cloud, rain, back to the sea. Round and round it goes. We call this the water cycle!', say: "{slow}Up as vapour... cloud... rain... back to the sea.{/slow} Round and round it goes. We call this... {sfx:ding}the *water cycle*!", hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: the sun lifts the water up, and the rain brings it down!', say: "Say it with me... {sfx:ding}The *sun* lifts the water *up*, and the *rain* brings it *down*! {pause 0.9} {slow}Sun lifts it up... rain brings it down!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a glass of very cold water with ice.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for a glass of *very* cold water, with ice.", hold: 0.4 },
      { id: 'try2', text: "Leave it on the table and wait. Look! Little drops appear on the outside of the glass. That's water vapour from the air, turning back into water. Just like a tiny cloud!", say: "Leave it on the table, and {w}wait...{/w} {pause 0.4} {sfx:sparkle}Look! Little drops appear on the *outside* of the glass. That's water vapour from the air, turning back into water. {sfx:ding}Just like a *tiny* cloud!", hold: 1.4 },
      { id: 'bye', text: 'Great job, little scientist! Remember: the sun lifts water up to make clouds, and clouds give us rain. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... the sun lifts water *up* to make clouds, and clouds give us *rain*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'rain', offset: 0.0, name: 'rain' }, { line: 'rain', offset: 2.5, name: 'rain' }, { line: 'sea', offset: 1.0, name: 'splash', vol: 0.5 }, { line: 'sea', offset: 3.4, name: 'sparkle' },
      { line: 'warm', offset: 3.0, name: 'bubble' }, { line: 'vapour', offset: 3.8, name: 'whoosh', vol: 0.6 }, { line: 'cold', offset: 2.8, name: 'shiver' },
      { line: 'cloud', offset: 4.0, name: 'pop' }, { line: 'cloud', offset: 4.2, name: 'sparkle' }, { line: 'join', offset: 1.2, name: 'plop', vol: 0.6 }, { line: 'join', offset: 2.4, name: 'plop', vol: 0.6 }, { line: 'join', offset: 3.6, name: 'plop', vol: 0.6 },
      { line: 'fall', offset: 2.6, name: 'rain' }, { line: 'river', offset: 0.5, name: 'rain', vol: 0.5 }, { line: 'cycle', offset: 5.6, name: 'ding' }, { line: 'sayit', offset: 1.4, name: 'ding' },
      { line: 'try1', offset: 0.1, name: 'tada' }, { line: 'try2', offset: 2.6, name: 'sparkle' }, { line: 'try2', offset: 9.0, name: 'ding' }, { line: 'bye', offset: 0.0, name: 'tada' }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { L.cloud(c, 0, -60, 1.1, '#9AA5B8', { outline: P.ink, face: 'sad' }); rain(c, tt, -120, 120, 20, 180, 10, 3); }) },
      {
        from: 'rain', draw: (ctx, t, Lt) => {
          L.sky(ctx, { top: '#8A94A6', bottom: '#C2C9D4' }); L.cloud(ctx, 500, 170, 1.8, '#9AA5B8', { outline: P.ink, face: 'sad' }); L.cloud(ctx, 1350, 140, 1.5, '#9AA5B8', { outline: P.ink, face: 'sad' });
          L.ground(ctx, 820, '#7FB86A'); L.house(ctx, 1550, 840, 1); rain(ctx, t, 0, W, 200, 830, 90, 9);
          ellipse(ctx, 700, 850, 150, 22, P.water, P.ink, 4); ellipse(ctx, 1200, 870, 110, 18, P.water, P.ink, 4);
          umbrella(ctx, 760, 420, 1); L.pip(ctx, { x: 760, y: 720, s: 1.2, t, mood: 'think', armR: -1.5, armL: 0.6, lookY: -0.8 });
          L.sticker(ctx, 'Where from?', 1300, 420, Lt.cwin('rain', 'but where', 0.5, null, 0.6), { bg: P.pink, size: 80, rot: -0.08 });
        }
      },
      {
        from: 'sea', draw: (ctx, t, Lt) => {
          const warmP = Lt.cwin('warm', 'the sun warms', 1.0, null, 0.4); const vap = Lt.after('warm') ? Lt.cwin('warm', 'tiny bits of it', 1.5) : 0;
          const coldP = Lt.win('cold', 0.4, 1.0) * (1 - Lt.cwin('cloud', 'a cloud', 0.8, null, -0.3));
          const cloudP = Lt.cwin('cloud', 'a cloud', 0.8, E.outBack) * 0.4 + Lt.span('join', 'join') * 0.6;
          const grey = Lt.span('join', 'join') * 0.9 * (1 - Lt.win('river', 2.5, 2.0));
          const rainP = Lt.after('fall') ? Lt.cwin('fall', 'down they fall', 1.0) * (1 - Lt.win('river', 2.5, 1.5)) : 0;
          const river = Lt.win('river', 0.5, 1.2);
          seaScene(ctx, t, { sunHeat: warmP * (1 - Lt.win('cold', 0, 1)) + Lt.cwin('river', 'then the sun', 1.0), vapour: vap * (1 - Lt.cwin('cloud', 'a cloud', 1.5, null, 0.7)), vapourFade: Lt.after('vapour'), cold: coldP, cloud: cloudP > 0 ? Math.min(1, cloudP) : 0, cloudGrey: grey, rain: rainP, river, pipMood: Lt.after('fall') && !Lt.after('river') ? 'wow' : 'talk', lookY: Lt.after('warm') ? -0.8 : -0.3 });
          L.sticker(ctx, 'warm', 1300, 480, Lt.cwin('warm', 'the sun warms', 0.5, null, 0.5) * (1 - Lt.cwin('warm', 'tiny bits of it', 0.3, null, 1.0)), { bg: P.sun, size: 72, rot: 0.06 });
          L.sticker(ctx, 'water vapour', 1200, 420, Lt.cwin('vapour', 'water vapour.', 0.5) * (1 - Lt.win('cold', 0, 0.3)), { bg: P.blue, color: P.white, size: 80, rot: -0.05 });
          if (Lt.cafter('vapour', 'up...') && !Lt.after('cold')) { for (let i = 0; i < 3; i++) { const yo = ((t * 150) % 120); L.arrow(ctx, 1500 + i * 90, 560 - yo + 60, 1500 + i * 90, 460 - yo + 60, P.blue, 10); } }
          L.sticker(ctx, 'cold up here!', 400, 230, Lt.win('cold', 0.8, 0.5) * (1 - Lt.win('cloud', 0, 0.3)), { bg: '#BFE9FF', size: 72, rot: -0.06 });
          L.sticker(ctx, 'a cloud!', 1350, 230, Lt.cwin('cloud', 'a cloud', 0.5, null, 0.2) * (1 - Lt.win('join', 0.5, 0.3)), { bg: P.white, size: 88, rot: 0.05 });
          L.sticker(ctx, 'heavy...', 1350, 230, Lt.cwin('join', 'and heavier', 0.5) * (1 - Lt.win('fall', 0, 0.3)), { bg: P.grey, size: 80, rot: 0.05 });
          L.sticker(ctx, 'RAIN!', 1350, 230, Lt.cwin('fall', "that's rain", 0.5) * (1 - Lt.win('river', 0, 0.3)), { bg: P.blue, color: P.white, size: 100, rot: -0.05 });
          L.sticker(ctx, 'back to the sea', 1250, 420, Lt.cwin('river', 'then the sun', 0.5, null, -1.2) * (1 - Lt.cwin('river', 'then the sun', 0.3, null, 1.5)), { bg: P.sun, size: 72, rot: 0.04 });
        }
      },
      {
        from: 'cycle', draw: (ctx, t, Lt) => {
          L.sky(ctx); cycleDiagram(ctx, t, Lt.win('cycle', 0.2, 0.8), { labels: Lt.win('cycle', 0.8, 0.2) > 0 });
          L.pip(ctx, { x: 220, y: 900, s: 0.8, t, mood: 'talk', armR: -0.8, armL: 0.6, lookX: 0.9, lookY: -0.5 });
          L.sticker(ctx, 'the water cycle', W / 2, 520, Lt.cwin('cycle', 'the water cycle', 0.6), { bg: P.sun, size: 84, rot: -0.03 });
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          seaScene(ctx, t, { sunHeat: 0.8, vapour: 1, vapourFade: true, cloud: 1, cloudGrey: 0.6, rain: 1, river: 1, armR: -1.3, pipMood: 'talk' });
          L.sayItSticker(ctx, 'Sun lifts it up, rain brings it down!', Lt.cwin('sayit', 'the sun lifts', 0.8), t);
        }
      },
      {
        from: 'try1', draw: (ctx, t, Lt) => {
          ctx.fillStyle = '#FFF4DF'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#D9B277'; ctx.fillRect(0, 760, W, H - 760); ctx.fillStyle = '#B98B4E'; ctx.fillRect(0, 760, W, 24);
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.2, 0.6));
          const gp = Lt.cwin('try1', 'ask a grown-up', 0.7, E.outBack, 1.0); const drops = Lt.cwin('try2', 'look!', 4.0, null, -1.0);
          if (gp > 0) { ctx.save(); ctx.translate(960, 760); ctx.scale(gp, gp); glass(ctx, 0, 0, 1.4, { drops }); ctx.restore(); }
          const mp = Lt.cwin('try2', 'little drops appear', 0.6, E.outBack, 0.6); if (mp > 0) { ctx.save(); ctx.translate(1350, 500); ctx.scale(mp, mp); ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.save(); ctx.clip(); ctx.fillStyle = '#DDF3FF'; ctx.fillRect(-170, -170, 340, 340); ctx.translate(-40, 0); const r = L.rng(8); for (let i = 0; i < 9; i++) droplet(ctx, (r() - 0.5) * 260, (r() - 0.5) * 260, 24 + r() * 18); ctx.restore(); L.magnifier(ctx, 0, 0, 170, 1); ctx.restore(); }
          L.pip(ctx, { x: 500, y: 640, s: 1.1, t, mood: Lt.cafter('try2', 'look!') ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.9, lookY: -0.2 });
          L.sticker(ctx, 'tiny cloud!', 1350, 800, Lt.cwin('try2', 'just like', 0.5), { bg: P.white, size: 80, rot: -0.06 });
          L.sticker(ctx, 'wait...', 1300, 300, Lt.cwin('try2', 'wait', 0.4) * (1 - Lt.cwin('try2', 'look!', 0.3)), { bg: P.sun, size: 72, rot: 0.06 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Rain comes from clouds!') }
    ],
    interactive: {
      hint: 'Drag the sun down to warm the sea and lift the water up. When the cloud gets heavy, tap it to make rain!',
      init: s => { s.sunY = 220; s.heat = 0; s.vap = 0; s.cloud = 0; s.grey = 0; s.rain = 0; s.drag = false; s.lastCue = ''; s.warmSaid = false; s.heavySaid = false; },
      update: (s, dt, cue) => {
        s.heat = clamp((s.sunY - 220) / 380, 0, 1);
        s.vap = clamp(s.vap + (s.heat * 0.5 - 0.08) * dt, 0, 1);
        if (s.vap > 0.5) s.cloud = clamp(s.cloud + 0.12 * dt, 0, 1);
        if (s.cloud > 0.95) s.grey = clamp(s.grey + 0.15 * dt, 0, 1);
        if (s.rain > 0) { s.rain -= dt / 4; s.cloud = clamp(s.cloud - dt / 5, 0, 1); s.grey = clamp(s.grey - dt / 3, 0, 1); if (s.rain <= 0) { s.rain = 0; } }
        if (s.heat > 0.6 && !s.warmSaid) { s.warmSaid = true; s.lastCue = 'warm'; cue('warm'); } if (s.heat < 0.2) s.warmSaid = false;
        if (s.grey > 0.9 && s.rain <= 0 && !s.heavySaid) { s.heavySaid = true; s.lastCue = 'heavy'; cue('heavy'); }
      },
      draw: (ctx, s, t) => {
        seaScene(ctx, t, { sunHeat: s.heat, vapour: s.vap, vapourFade: true, cloud: s.cloud, cloudGrey: s.grey, rain: s.rain, river: 1, pip: false, sunY: s.sunY });
        if (s.heat < 0.2) { text(ctx, 'drag me down', 1620, s.sunY + 215, { size: 64, weight: 600, color: P.ink }); L.arrow(ctx, 1620, s.sunY + 250, 1620, s.sunY + 330, P.sun, 12); }
        if (s.grey > 0.9 && s.rain <= 0) text(ctx, 'tap the cloud!', 900, 460, { size: 64, weight: 600, color: P.ink });
        L.pip(ctx, { x: 160, y: 462, s: 0.9, t, mood: s.rain > 0 ? 'wow' : 'happy', armR: -0.5, armL: 0.6, lookX: 0.8, lookY: -0.4 });
      },
      pointer: (s, type, x, y) => {
        if (type === 'down') { if (Math.hypot(x - 1620, y - s.sunY) < 200) s.drag = true; else if (Math.hypot(x - 900, y - 250) < 300 && s.grey > 0.9 && s.rain <= 0) { s.rain = 1; s.lastCue = 'rain'; s.heavySaid = false; } }
        if (type === 'move' && s.drag) s.sunY = clamp(y, 150, 600);
        if (type === 'up') s.drag = false;
      },
      cues: { warm: 'The sun warms the sea. Tiny bits of water float up!', heavy: 'The cloud is heavy now. Tap it!' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 4 — Why do I have a shadow? */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  // Curie's ground shadow: a skewed silhouette lying on the ground, direction away from the light
  function groundShadow(ctx, x, groundY, lightX, lightY, s, o) {
    o = o || {};
    const dx = x - lightX, dy = groundY - lightY; // light → pip
    const elev = Math.atan2(Math.max(10, dy), Math.abs(dx) || 1); // elevation angle of the light
    const len = clamp(190 / Math.tan(Math.max(0.12, elev)) * 0.9, 40, 1400) * s; // longer when the light is low
    const dir = dx >= 0 ? 1 : -1;
    ctx.save(); ctx.translate(x, groundY); ctx.fillStyle = o.color || 'rgba(30,40,70,0.55)';
    ctx.beginPath(); ctx.ellipse(dir * len / 2, 0, len / 2 + 30 * s, 48 * s, 0, 0, Math.PI * 2); ctx.fill();
    // head bump at far end
    ctx.beginPath(); ctx.ellipse(dir * (len - 10 * s), 0, 70 * s, 42 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return len;
  }
  function wall(ctx, lit, lx, ly) {
    ctx.fillStyle = '#5A5F7A'; ctx.fillRect(1200, 0, W - 1200, H); ctx.fillStyle = '#3E425A'; ctx.fillRect(0, 820, W, H - 820);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 4; for (let y = 0; y < 820; y += 120) { ctx.beginPath(); ctx.moveTo(1200, y); ctx.lineTo(W, y); ctx.stroke(); }
    if (lit > 0) { const g = ctx.createRadialGradient(1500, ly, 20, 1500, ly, 520); g.addColorStop(0, `rgba(255,236,150,${0.95 * lit})`); g.addColorStop(1, 'rgba(255,236,150,0)'); ctx.fillStyle = g; ctx.fillRect(1200, 0, W - 1200, 820); }
  }
  function beams(ctx, t, x0, y0, x1, blockX, alpha) {
    // straight rays from (x0,y0) fanning to the wall, stopping at blockX if given (within the pip's vertical span)
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (let i = -4; i <= 4; i++) {
      const y1 = y0 + i * 70; const tx = x1; const blocked = blockX && Math.abs(i) <= 2;
      const ex = blocked ? blockX - 20 : tx; const ey = y0 + (y1 - y0) * (ex - x0) / (tx - x0);
      ctx.strokeStyle = 'rgba(255,230,120,0.75)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.stroke();
      // moving arrow heads along the ray
      const f = (t * 0.6 + i * 0.13) % 1; const ax = lerp(x0, ex, f), ay = lerp(y0, ey, f); L.arrow(ctx, ax - 30, ay - (y1 - y0) / (tx - x0) * 30, ax, ay, P.sun, 10);
    }
    ctx.restore();
  }
  function darkRoom(ctx) { ctx.fillStyle = '#2A2E48'; ctx.fillRect(0, 0, W, H); }
  function pipSilhouette(ctx, x, y, s, alpha) { ctx.save(); ctx.globalAlpha = alpha == null ? 0.85 : alpha; ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#1C1F33'; ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(-42, 96, 34, 16, 0, 0, Math.PI * 2); ctx.ellipse(42, 96, 34, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 30; ctx.strokeStyle = '#1C1F33'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-82, 10); ctx.lineTo(-150, 40); ctx.moveTo(82, 10); ctx.lineTo(150, 40); ctx.stroke(); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -92); ctx.quadraticCurveTo(10, -140, 28, -160); ctx.stroke(); ctx.beginPath(); ctx.arc(28, -170, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  function handShadowDog(ctx, x, y, s, alpha) { // dog-head silhouette
    ctx.save(); ctx.globalAlpha = alpha == null ? 0.85 : alpha; ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#1C1F33';
    ctx.beginPath(); ctx.moveTo(-120, 0); ctx.quadraticCurveTo(-120, -110, -20, -110); ctx.lineTo(10, -150); ctx.lineTo(40, -110); ctx.quadraticCurveTo(140, -100, 170, -30); ctx.quadraticCurveTo(175, 10, 150, 10); ctx.lineTo(80, 0); ctx.quadraticCurveTo(90, 60, 40, 60); ctx.lineTo(-100, 60); ctx.quadraticCurveTo(-130, 60, -120, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // the tree's ground shadow: an ellipse stretching away from the light, longer when the light is low
  function treeShadow(ctx, sx, sy) {
    const tdx = 1650 - sx, tdy = 830 - sy; const telev = Math.atan2(Math.max(10, tdy), Math.abs(tdx) || 1); const tlen = clamp(240 / Math.tan(Math.max(0.12, telev)) * 0.9, 60, 1400); const tdir = tdx >= 0 ? 1 : -1;
    ctx.save(); ctx.fillStyle = 'rgba(30,40,70,0.45)'; ctx.beginPath(); ctx.ellipse(1650 + tdir * tlen / 2, 832, tlen / 2 + 40, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(1650 + tdir * (tlen - 20), 832, 110, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function sunArcScene(ctx, t, sunP, o) {
    // sunP 0..1: sun moves along an arc from left horizon (0) to right horizon (1)
    o = o || {}; const a = Math.PI * (1 - sunP); const sx = 960 + Math.cos(a) * 820, sy = 760 - Math.sin(a) * 620;
    const sky = sunP < 0.15 || sunP > 0.85 ? { top: '#F7A26B', bottom: '#FFD7B0' } : {}; L.sky(ctx, sky);
    L.sun(ctx, sx, sy, 110, t); L.ground(ctx, 820); treeShadow(ctx, sx, sy); L.tree(ctx, 1650, 830, 1.0);
    const len = groundShadow(ctx, 760, 822, sx, sy, 1.3);
    L.pip(ctx, { x: 760, y: 720, s: 1.3, t, mood: o.mood || 'talk', armR: -0.4, armL: 0.6, lookX: clamp((sx - 760) / 800, -1, 1), lookY: -0.6, bob: false });
    return { sx, sy, len };
  }

  L.episodes.ep4 = {
    id: 'ep4', num: 4, title: 'Why do I have a shadow?', short: 'Shadows', phrase: 'No light? Shadow!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie
    thumb: { big: "SHADOW?", small1: "Why do I have a", small2: "", pip: { x: 1050, y: 700 }, bg: (ctx, t) => { L.sky(ctx, { top: '#F7A26B', bottom: '#FFD7B0' }); L.sun(ctx, 250, 500, 110, t); L.ground(ctx, 820); ctx.fillStyle = 'rgba(30,40,70,0.55)'; ctx.beginPath(); ctx.ellipse(1050, 830, 520, 60, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(1480, 830, 120, 50, 0, 0, Math.PI * 2); ctx.fill(); } },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why do I have a shadow?", say: "Today's big question... Why do I have a *shadow*?", hold: 0.6 },
      { id: 'walk', text: "It's a sunny day. Curie is walking... and look! Something dark is following Curie on the ground.", say: "It's a sunny day. Curie is walking... {sfx:pop}and *look*! Something *dark* is following Curie, on the ground.", hold: 0.8 },
      { id: 'wave', text: "It's a shadow! When Curie waves, the shadow waves. When Curie jumps, the shadow jumps!", say: "{sfx:sparkle}It's a *shadow*! When Curie waves... the shadow *waves*. {sfx:boing}When Curie jumps... {sfx:thump}the shadow *jumps*!", hold: 0.8 },
      { id: 'torch', text: "Where does a shadow come from? Let's find out with a torch.", say: "Where does a shadow *come* from? Let's find out... {sfx:click}with a *torch*.", hold: 0.8 },
      { id: 'light', text: 'Light travels in straight lines, like tiny speedy arrows. Zoom!', say: "Light travels in *straight* lines, like tiny, speedy arrows. {sfx:whoosh}{hi}Zoom!{/hi}", hold: 0.8 },
      { id: 'wall', text: 'When the light hits the wall, the wall is bright.', say: "When the light hits the wall... {sfx:sparkle}the wall is *bright*.", hold: 0.6 },
      { id: 'block', text: "Now Curie stands in front of the torch. The light hits Curie and stops. It can't go through Curie!", say: "Now Curie stands in front of the torch. {sfx:thump}The light hits Curie... and *stops*. {sfx:click}It can't go *through* Curie!", hold: 0.6 },
      { id: 'shadow', text: "Behind Curie, no light can reach the wall. That dark spot is Curie's shadow.", say: "Behind Curie, *no* light can reach the wall. That dark spot... {sfx:pop}is Curie's *shadow*.", hold: 0.8 },
      { id: 'define', text: "A shadow is the place where the light can't go.", say: "{sfx:ding}{slow}A shadow is the place where the light *can't* go.{/slow}", hold: 1.0 },
      { id: 'lowhigh', text: 'Watch this. When the sun is low, the shadow is looong. When the sun is high, the shadow is short!', say: "Watch this! {sfx:whoosh}When the sun is *low*... {slow}the shadow is very, very *long*.{/slow} {sfx:whoosh}When the sun is *high*... the shadow is *short*!", hold: 0.8 },
      { id: 'noon', text: "That's why your shadow is long in the morning and evening, and short at noon, when the sun is high.", say: "{sfx:sparkle}That's why your shadow is long in the *morning* and *evening*... and short at *noon*, when the sun is high.", hold: 0.8 },
      { id: 'sayit', text: "Say it with me: a shadow is where the light can't go!", say: "Say it with me... {sfx:ding}A *shadow* is where the light *can't* go! {pause 0.9} {slow}A shadow... is where the light... can't go!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a torch. Make the room dark and shine it on the wall.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for a torch. Make the room *dark*, {sfx:click}and shine it on the wall.", hold: 0.4 },
      { id: 'try2', text: 'Put your hand in the light. Can you make a dog? A bird? Move your hand closer to the torch. Does the shadow get bigger, or smaller?', say: "{sfx:pop}Put your hand in the light. Can you make a *dog*? A *bird*? {sfx:whoosh}Move your hand *closer* to the torch. Does the shadow get *bigger*... or *smaller*?", hold: 1.6 },
      { id: 'bye', text: "Great job, little scientist! Remember: your body blocks the light, and that makes a shadow. See you next time at the Little Scientists Club! Bye-bye!", say: "{sfx:tada}Great job, little scientist! Remember... your body *blocks* the light, and that makes a *shadow*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'walk', offset: 3.2, name: 'pop' }, { line: 'wave', offset: 0.2, name: 'sparkle' }, { line: 'wave', offset: 4.2, name: 'boing' }, { line: 'wave', offset: 4.9, name: 'thump', vol: 0.6 },
      { line: 'torch', offset: 2.6, name: 'click' }, { line: 'light', offset: 3.4, name: 'whoosh' }, { line: 'wall', offset: 1.2, name: 'sparkle' }, { line: 'block', offset: 0.8, name: 'thump', vol: 0.5 }, { line: 'block', offset: 3.6, name: 'click' },
      { line: 'shadow', offset: 3.2, name: 'pop' }, { line: 'define', offset: 0.1, name: 'ding' }, { line: 'lowhigh', offset: 2.3, name: 'whoosh', vol: 0.5 }, { line: 'lowhigh', offset: 4.6, name: 'whoosh', vol: 0.5 }, { line: 'noon', offset: 0.1, name: 'sparkle' },
      { line: 'sayit', offset: 1.4, name: 'ding' }, { line: 'try1', offset: 0.1, name: 'tada' }, { line: 'try1', offset: 4.0, name: 'click' }, { line: 'try2', offset: 2.0, name: 'pop' }, { line: 'try2', offset: 6.3, name: 'whoosh', vol: 0.5 }, { line: 'bye', offset: 0.0, name: 'tada' }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { c.save(); c.fillStyle = 'rgba(30,40,70,0.55)'; c.beginPath(); c.ellipse(60, 120, 150, 36, 0, 0, Math.PI * 2); c.fill(); c.restore(); L.pip(c, { x: -60, y: 20, s: 0.7, t: tt, mood: 'wow', bob: false }); }) },
      {
        from: 'walk', draw: (ctx, t, Lt) => {
          L.sky(ctx); const sx = 1640, sy = 200; L.sun(ctx, sx, sy, 120, t); L.ground(ctx, 820); L.tree(ctx, 1500, 830, 1.0); L.house(ctx, 260, 840, 0.9);
          const wp = seg(t, Lt.start('walk') + 0.3, Lt.chunk('walk', 'and look')); const x = lerp(420, 900, wp); const hop = Math.abs(Math.sin(wp * 20)) * 14 * (wp < 1 ? 1 : 0);
          // wave & jump during 'wave'
          const wavep = Lt.cwin('wave', 'when curie waves', 1.6); const jp = Lt.cwin('wave', 'when curie jumps', 1.2, null, 0.3); const jy = -Math.sin(jp * Math.PI) * 240;
          const arm = wavep > 0 && wavep < 1 ? -1.3 + Math.sin(t * 10) * 0.4 : -0.4;
          groundShadow(ctx, x, 822, sx, sy, 1.3);
          if (jp > 0 && jp < 1) { /* shadow stays on ground, pip lifts */ }
          L.pip(ctx, { x, y: 720 - hop + jy, s: 1.3, t, mood: jp > 0 && jp < 1 ? 'wow' : (Lt.after('wave') ? 'talk' : 'happy'), armR: arm, armL: jp > 0 && jp < 1 ? 1.3 + Math.PI : 0.6, lookX: Lt.cafter('walk', 'and look') ? 0.3 : 0.9, lookY: Lt.cafter('walk', 'and look') ? 0.9 : 0.2, bob: false });
          if (Lt.cafter('walk', 'and look') && !Lt.after('wave')) L.arrow(ctx, 1180, 980, 1060, 860, P.red, 12);
          L.sticker(ctx, 'shadow!', 1300, 420, Lt.win('wave', 0.1, 0.5), { bg: P.purple, color: P.white, size: 90, rot: -0.08 });
        }
      },
      {
        from: 'torch', draw: (ctx, t, Lt) => {
          darkRoom(ctx); const on = Lt.after('light') ? 1 : 0; const lit = Lt.cwin('wall', 'the wall is bright', 0.8);
          const pipIn = Lt.win('block', 0.1, 0.9, E.outBack); const px = lerp(1000, 820, 1) ; const pipX = pipIn > 0 ? lerp(700, 850, pipIn) : null;
          wall(ctx, on * Math.max(lit, Lt.after('block') ? 1 : 0), 1500, 500);
          if (on) beams(ctx, t, 300, 500, 1200, pipIn > 0.95 ? pipX - 100 : null, 1);
          if (Lt.after('shadow') || (pipIn > 0.95 && Lt.after('block'))) { const sp = Lt.after('shadow') ? Lt.cwin('shadow', "is curie's shadow", 0.8, null, -0.4) : 0; pipSilhouette(ctx, 1500, 500, 1.9, 0.9 * Math.max(sp, 0.001)); }
          if (pipIn > 0) L.pip(ctx, { x: pipX, y: 500, s: 1.3 * pipIn, t, mood: Lt.after('shadow') ? 'wow' : 'talk', armR: -0.3, armL: 0.6, lookX: -0.9, bob: false });
          const tp = Lt.cwin('torch', 'with a torch', 0.8, E.outBack); if (tp > 0) { ctx.save(); ctx.translate(200, 500); ctx.scale(tp, tp); L.torch(ctx, 0, 0, 0, on, 1.2); ctx.restore(); }
          if (!Lt.after('block')) L.pip(ctx, { x: 500, y: 850, s: 0.8, t, mood: 'talk', armR: -0.5, armL: 0.6, lookX: 0.5, lookY: -0.5 });
          L.sticker(ctx, 'straight lines!', 760, 200, Lt.win('light', 0.8, 0.5) * (1 - Lt.win('wall', 0, 0.3)), { bg: P.sun, size: 80, rot: -0.05 });
          L.sticker(ctx, 'bright!', 1540, 220, Lt.cwin('wall', 'the wall is bright', 0.5, null, 0.5) * (1 - Lt.win('block', 0, 0.3)), { bg: P.sun, size: 88, rot: 0.06 });
          L.sticker(ctx, "can't go through", 760, 200, Lt.cwin('block', "it can't go", 0.5) * (1 - Lt.win('shadow', 0, 0.3)), { bg: P.red, color: P.white, size: 76, rot: -0.04 });
          L.sticker(ctx, 'shadow', 1560, 240, Lt.cwin('shadow', "is curie's shadow", 0.5, null, 0.4) * (1 - Lt.win('define', 0, 0.3)), { bg: P.purple, color: P.white, size: 96, rot: 0.05 });
          L.sticker(ctx, "where light can't go", 1200, 200, Lt.win('define', 0.6, 0.6), { bg: P.purple, color: P.white, size: 80, rot: -0.03 });
        }
      },
      {
        from: 'lowhigh', draw: (ctx, t, Lt) => {
          // sun low (0.08) → high (0.5) → low (0.9)
          let sp; const a = Lt.win('lowhigh', 0.2, 1.8), b = Lt.cwin('lowhigh', 'when the sun is high', 2.2, E.inOut, -0.6);
          if (!Lt.after('noon')) sp = a > 0 ? lerp(0.08, 0.5, b) : 0.08; else { const c = Lt.span('noon', 'noon', E.inOut); sp = lerp(0.06, 0.94, c); }
          const r = sunArcScene(ctx, t, sp, { mood: 'talk' });
          const low = sp < 0.25 || sp > 0.75;
          L.sticker(ctx, 'looong shadow', 1150, 500, Lt.cwin('lowhigh', 'the shadow is very', 0.5, null, 0.5) * (1 - Lt.cwin('lowhigh', 'when the sun is high', 0.3)), { bg: P.purple, color: P.white, size: 72, rot: -0.05 });
          L.sticker(ctx, 'short shadow', 1150, 500, Lt.cwin('lowhigh', 'the shadow is short', 0.5, null, 0.3) * (1 - Lt.win('noon', 0, 0.3)), { bg: P.purple, color: P.white, size: 72, rot: 0.05 });
          if (Lt.after('noon')) { const lbl = sp < 0.3 ? 'morning' : sp < 0.7 ? 'noon' : 'evening'; L.sticker(ctx, lbl, r.sx, r.sy - 200, 1, { bg: P.sun, size: 64, rot: 0 }); }
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          darkRoom(ctx); wall(ctx, 1, 1500, 500); beams(ctx, t, 300, 500, 1200, 750, 1); pipSilhouette(ctx, 1500, 500, 1.9, 0.9); L.pip(ctx, { x: 850, y: 500, s: 1.3, t, mood: 'talk', armR: -1.2, armL: 0.6, lookX: -0.5, bob: false }); L.torch(ctx, 200, 500, 0, 1, 1.2);
          L.sayItSticker(ctx, "A shadow is where light can't go!", Lt.cwin('sayit', 'a shadow is where', 0.8), t);
        }
      },
      {
        from: 'try1', draw: (ctx, t, Lt) => {
          darkRoom(ctx); const on = Lt.cafter('try1', 'and shine') ? 1 : 0; wall(ctx, on, 1500, 520);
          const hp = Lt.cwin('try2', 'put your hand', 0.6, E.outBack, 0.3); const closer = Lt.cwin('try2', 'move your hand', 1.5, E.inOut, 0.4); const hx = lerp(820, 560, closer);
          if (on) beams(ctx, t, 300, 520, 1200, hp > 0.9 ? hx - 60 : null, 1);
          if (hp > 0) { const sc = lerp(1.9, 3.4, closer); handShadowDog(ctx, 1500, 540, sc, 0.9 * hp); ctx.save(); ctx.translate(hx, 520); ctx.scale(hp, hp); L.hand(ctx, 0, 0, 1.3, 0.25); ctx.restore(); }
          L.torch(ctx, 200, 520, 0, on, 1.2);
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.2, 0.6));
          L.pip(ctx, { x: 500, y: 880, s: 0.8, t, mood: 'talk', armR: -0.5, armL: 0.6, lookX: 0.6, lookY: -0.5 });
          L.sticker(ctx, 'a dog!', 1560, 260, Lt.cwin('try2', 'can you make a dog', 0.5, null, 0.9) * (1 - Lt.cwin('try2', 'move your hand', 0.3)), { bg: P.sun, size: 80, rot: 0.06 });
          L.sticker(ctx, 'bigger or smaller?', 1200, 220, Lt.cwin('try2', 'does the shadow get', 0.6, null, 0.4), { bg: P.sun, size: 72, rot: -0.03 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Shadows: where light can\'t go!') }
    ],
    interactive: {
      hint: 'Drag the sun across the sky and watch Curie\'s shadow stretch and shrink. Drag Curie too!',
      init: s => { s.sunP = 0.15; s.dragSun = false; s.dragPip = false; s.pipX = 760; s.lastCue = ''; s.zone = 'low'; s.moved = false; s.cuedOnce = false; },
      update: (s, dt, cue) => {
        // say 'low'/'high' each time the sun enters that part of the sky (after the child has started dragging)
        const zone = (s.sunP < 0.2 || s.sunP > 0.8) ? 'low' : (s.sunP > 0.4 && s.sunP < 0.6) ? 'high' : 'mid';
        if (zone !== s.zone) { s.zone = zone; if (zone !== 'mid' && s.moved) { s.cuedOnce = true; s.lastCue = zone; cue(zone); } }
        else if (s.moved && !s.cuedOnce && zone !== 'mid') { s.cuedOnce = true; s.lastCue = zone; cue(zone); }
      },
      draw: (ctx, s, t) => {
        const a = Math.PI * (1 - s.sunP); const sx = 960 + Math.cos(a) * 820, sy = 760 - Math.sin(a) * 620;
        const sky = s.sunP < 0.15 || s.sunP > 0.85 ? { top: '#F7A26B', bottom: '#FFD7B0' } : {}; L.sky(ctx, sky);
        // dotted arc path
        ctx.save(); ctx.setLineDash([10, 18]); ctx.strokeStyle = 'rgba(43,45,66,0.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(960, 760, 820, 620, 0, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.restore();
        L.sun(ctx, sx, sy, 110, t); L.ground(ctx, 820); treeShadow(ctx, sx, sy); L.tree(ctx, 1650, 830, 1.0);
        const len = groundShadow(ctx, s.pipX, 822, sx, sy, 1.3);
        L.pip(ctx, { x: s.pipX, y: 720, s: 1.3, t, mood: len > 700 ? 'wow' : 'happy', armR: -0.4, armL: 0.6, lookX: clamp((sx - s.pipX) / 800, -1, 1), lookY: -0.6, bob: false });
        if (!s.moved) { const lx = clamp(sx, 340, W - 340); text(ctx, 'drag the sun', lx, sy - 190, { size: 64, weight: 600, color: P.ink }); L.arrow(ctx, lx + 190, sy - 200, lx + 300, sy - 200, P.sun, 12); L.arrow(ctx, lx - 190, sy - 200, lx - 300, sy - 200, P.sun, 12); }
        const lbl = s.sunP < 0.25 ? 'morning: long shadow' : s.sunP > 0.75 ? 'evening: long shadow' : s.sunP > 0.4 && s.sunP < 0.6 ? 'noon: short shadow' : 'in between';
        L.sticker(ctx, lbl, 960, 120, 1, { bg: P.purple, color: P.white, size: 60, rot: 0 });
      },
      pointer: (s, type, x, y) => {
        const a = Math.PI * (1 - s.sunP); const sx = 960 + Math.cos(a) * 820, sy = 760 - Math.sin(a) * 620;
        if (type === 'down') { if (Math.hypot(x - sx, y - sy) < 200) s.dragSun = true; else if (Math.abs(x - s.pipX) < 160 && y > 560 && y < 860) s.dragPip = true; }
        if (type === 'move') { if (s.dragSun) { const ang = Math.atan2(760 - y, x - 960); s.sunP = clamp(1 - ang / Math.PI, 0.03, 0.97); s.moved = true; } if (s.dragPip) s.pipX = clamp(x, 200, 1500); }
        if (type === 'up') { s.dragSun = false; s.dragPip = false; }
      },
      cues: { low: 'The sun is low, so the shadow is long!', high: 'The sun is high, so the shadow is short!' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 5 — Why do boats float? */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  const WATER_Y = 600; // pond surface in the side-view pond scene
  function pond(ctx, t, o) {
    o = o || {}; L.sky(ctx); L.sun(ctx, 1650, 180, 100, t); L.cloud(ctx, 400, 160, 1.0);
    // bank on the left
    ctx.fillStyle = P.ground; ctx.beginPath(); ctx.moveTo(0, 520); ctx.lineTo(430, 520); ctx.quadraticCurveTo(520, 530, 540, 620); ctx.lineTo(540, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.groundDark; ctx.fillRect(0, H - 60, W, 60);
    // water body
    const wy = o.waterY || WATER_Y;
    ctx.fillStyle = 'rgba(95,184,255,0.85)'; ctx.beginPath(); ctx.moveTo(500, wy); for (let x = 500; x <= W; x += 40) ctx.lineTo(x, wy + Math.sin(x / 80 + t * 2) * 6); ctx.lineTo(W, H - 60); ctx.lineTo(500, H - 60); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#B98B4E'; ctx.fillRect(500, H - 130, W - 500, 70); // pond bed
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const x = 650 + i * 260 + ((t * 30) % 60); ctx.beginPath(); ctx.moveTo(x, wy + 50 + i * 30); ctx.quadraticCurveTo(x + 40, wy + 35 + i * 30, x + 80, wy + 50 + i * 30); ctx.stroke(); }
  }
  function stone(ctx, x, y, s, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.greyDark; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-60, 10); ctx.quadraticCurveTo(-60, -50, 0, -50); ctx.quadraticCurveTo(70, -50, 60, 20); ctx.quadraticCurveTo(30, 50, -30, 45); ctx.closePath(); ctx.fill(); ctx.stroke(); circle(ctx, -20, -15, 10, 'rgba(255,255,255,0.3)'); ctx.restore(); }
  function boat(ctx, x, y, s, rot, color) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.fillStyle = color || P.red; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-130, -20); ctx.lineTo(130, -20); ctx.lineTo(90, 50); ctx.lineTo(-90, 50); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -150); ctx.lineTo(80, -40); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -160); ctx.stroke(); ctx.restore(); }
  function clayBall(ctx, x, y, s) { circle(ctx, x, y, 60 * s, '#C98C5A', P.ink, 6); circle(ctx, x - 20 * s, y - 20 * s, 14 * s, 'rgba(255,255,255,0.35)'); }
  function clayBoat(ctx, x, y, s, m) { // m: morph 0 (ball) → 1 (boat)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#C98C5A'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    const w = lerp(60, 150, m), top = lerp(-60, -30, m), bot = lerp(60, 50, m), inner = lerp(0, 40, m);
    ctx.beginPath(); ctx.moveTo(-w, top); ctx.quadraticCurveTo(-w * 1.1, bot, -w * 0.6, bot); ctx.lineTo(w * 0.6, bot); ctx.quadraticCurveTo(w * 1.1, bot, w, top); ctx.quadraticCurveTo(w * 0.5, top - inner * 0.0, 0, lerp(-60, -22, m)); ctx.quadraticCurveTo(-w * 0.5, top, -w, top); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (m > 0.5) { ctx.fillStyle = '#A8703F'; ctx.beginPath(); ctx.ellipse(0, -24, w * 0.8, 14 * (m - 0.5) * 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  function cork(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.fillStyle = '#E2B98B'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; roundRect(ctx, -34, -44, 68, 88, 14); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(120,80,40,0.5)'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-24, -30 + i * 20); ctx.lineTo(24, -26 + i * 20); ctx.stroke(); } ctx.restore(); }
  function coin(ctx, x, y, s) { circle(ctx, x, y, 36 * (s || 1), P.sun, P.ink, 5); text(ctx, '₹', x, y + 2, { size: 40 * (s || 1), weight: 700, color: P.ink }); }
  function spoon(ctx, x, y, s, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.grey; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, -60, 34, 46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); roundRect(ctx, -9, -20, 18, 130, 9); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function lid(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.purple; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 70, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
  function leafItem(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.green; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(0, -45, 50, 0); ctx.quadraticCurveTo(0, 45, -50, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.stroke(); ctx.restore(); }
  function splash(ctx, x, y, p) { if (p <= 0 || p >= 1) return; ctx.save(); ctx.globalAlpha = 1 - p; for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; const d = 40 + 160 * p; circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 1.3 + 60 * p * p, 10 + 8 * (1 - p), P.white, P.blueDeep, 3); } ctx.restore(); }
  function upArrows(ctx, x, y, n, len, alpha, color) { ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; for (let i = 0; i < n; i++) { const ax = x + (i - (n - 1) / 2) * 70; L.arrow(ctx, ax, y + len, ax, y, color || P.blue, 12); } ctx.restore(); }
  function tank(ctx, t, level, o) { // side-view glass tank; (x,y) = left-bottom at (560, 860), size 800x560; level: water height (px)
    o = o || {}; const x = 560, y = 860, w = 800, h = 560;
    ctx.fillStyle = 'rgba(230,245,255,0.6)'; ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = 'rgba(95,184,255,0.8)'; ctx.beginPath(); ctx.moveTo(x, y - level); for (let xx = x; xx <= x + w; xx += 40) ctx.lineTo(xx, y - level + Math.sin(xx / 60 + t * 2) * 4); ctx.lineTo(x + w, y); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    if (o.displaced > 0 && level > 300) { ctx.fillStyle = `rgba(255,190,80,${0.75 * o.displaced})`; ctx.fillRect(x, y - level, w, level - 300); }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - h); ctx.stroke();
    if (o.mark != null) { ctx.save(); ctx.setLineDash([14, 12]); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 60, y - o.mark); ctx.lineTo(x + w + 60, y - o.mark); ctx.stroke(); ctx.restore(); }
  }

  L.episodes.ep5 = {
    id: 'ep5', num: 5, title: 'Why do boats float?', short: 'Sink or float', phrase: 'Water pushes up!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie
    thumb: { big: "FLOAT?", small1: "Why do boats", small2: "", bg: (ctx, t) => { L.sky(ctx); L.sun(ctx, 1700, 200, 110, t); ctx.fillStyle = 'rgba(95,184,255,0.9)'; ctx.beginPath(); ctx.moveTo(0, 640); for (let x = 0; x <= 1920; x += 40) ctx.lineTo(x, 640 + Math.sin(x / 90) * 10); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080); ctx.closePath(); ctx.fill(); ctx.save(); ctx.translate(1300, 620); ctx.scale(1.8, 1.8); ctx.fillStyle = P.red; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-130, -20); ctx.lineTo(130, -20); ctx.lineTo(90, 50); ctx.lineTo(-90, 50); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -150); ctx.lineTo(80, -40); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why do boats float?", say: "Today's big question... Why do boats *float*?", hold: 0.6 },
      { id: 'stone', text: "Here's a big pond. Splash! Curie drops in a stone. Down it goes. It sinks.", say: "Here's a big pond. {sfx:splash}*Splash*! Curie drops in a stone. {fall}Down... it goes.{/fall} {sfx:plop}It *sinks*.", hold: 0.8 },
      { id: 'boat', text: 'Now Curie puts in a little toy boat. It stays on top. It floats!', say: "Now Curie puts in a little toy boat. {sfx:plop}It stays on *top*. {sfx:sparkle}It *floats*!", hold: 0.8 },
      { id: 'why', text: 'Why does the stone sink, but the boat floats?', say: "{sfx:bubble}Why does the stone *sink*... but the boat *floats*?", hold: 0.8 },
      { id: 'push', text: "Here's the secret: water pushes up! Try pushing a ball under the water in the bath. Can you feel the water pushing it back up?", say: "Here's the secret... {sfx:ding}water pushes *up*! Try pushing a ball under the water in the bath. {sfx:plop}Can you *feel* the water pushing it back up? {sfx:boing}", hold: 0.8 },
      { id: 'displace', text: 'When something sits in water, it pushes some water out of the way. And the water pushes back up!', say: "When something sits in water, it pushes some water *out of the way*. {sfx:splash}And the water... pushes *back up*!", hold: 0.8 },
      { id: 'stone2', text: "The stone is small and heavy. It pushes only a little water away, so the water's push is too small. Down it sinks.", say: "The stone is small, and *heavy*. It pushes only a *little* water away... so the water's push is too small. {sfx:plop}{fall}Down... it sinks.{/fall}", hold: 0.8 },
      { id: 'boat2', text: 'The boat is wide and hollow, full of air. It pushes a lot of water away. So the water pushes up hard, and holds the boat up. It floats!', say: "The boat is *wide*, and *hollow*, full of *air*. It pushes a *lot* of water away! So the water pushes up *hard*, and holds the boat up. {sfx:sparkle}It *floats*!", hold: 0.8 },
      { id: 'clay1', text: "Let's test it. Curie squashes some clay into a ball. Plop! It sinks.", say: "Let's test it. Curie squashes some clay into a *ball*. {sfx:splash}{lo}Plop!{/lo} {sfx:plop}It sinks.", hold: 0.8 },
      { id: 'clay2', text: 'Now Curie makes the same clay into a wide boat shape... It floats! Same clay, different shape!', say: "Now Curie makes the *same* clay into a wide boat shape... {sfx:wiggle}{pause 0.3} {sfx:tada}It *floats*! Same clay... *different* shape!", hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: water pushes up!', say: "Say it with me... {sfx:ding}*Water* pushes *up*! {pause 0.9} {slow}Water... pushes... up!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a bowl of water. Collect a spoon, a coin, a cork, a plastic lid, and a leaf.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for a bowl of water. Collect a spoon, a coin, a cork, a plastic lid... and a *leaf*.", hold: 0.4 },
      { id: 'try2', text: 'Guess first: will it sink, or float? Then drop it in. Were you right?', say: "Guess first... will it *sink*, or *float*? Then drop it in. Were you *right*?", hold: 1.8 },
      { id: 'bye', text: 'Great job, little scientist! Remember: water pushes up, and that is why boats float. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... water pushes *up*, and that is why boats *float*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'stone', offset: 1.6, name: 'splash' }, { line: 'stone', offset: 3.4, name: 'plop' }, { line: 'boat', offset: 1.6, name: 'plop', vol: 0.6 }, { line: 'boat', offset: 3.6, name: 'sparkle' },
      { line: 'why', offset: 0.3, name: 'bubble' }, { line: 'push', offset: 1.4, name: 'ding' }, { line: 'push', offset: 4.6, name: 'plop' }, { line: 'push', offset: 6.2, name: 'boing' },
      { line: 'displace', offset: 1.4, name: 'splash', vol: 0.6 }, { line: 'stone2', offset: 5.6, name: 'plop' }, { line: 'boat2', offset: 6.8, name: 'sparkle' },
      { line: 'clay1', offset: 2.8, name: 'splash', vol: 0.7 }, { line: 'clay1', offset: 3.4, name: 'plop' }, { line: 'clay2', offset: 2.2, name: 'wiggle' }, { line: 'clay2', offset: 4.6, name: 'tada' },
      { line: 'sayit', offset: 1.4, name: 'ding' }, { line: 'try1', offset: 0.1, name: 'tada' }, { line: 'try2', chunk: 'then drop it in', offset: 1.4, name: 'plop', vol: 0.6 }, { line: 'try2', chunk: 'then drop it in', offset: 2.15, name: 'plop', vol: 0.6 }, { line: 'try2', chunk: 'then drop it in', offset: 2.9, name: 'plop', vol: 0.6 }, { line: 'try2', chunk: 'then drop it in', offset: 3.65, name: 'plop', vol: 0.6 }, { line: 'try2', chunk: 'then drop it in', offset: 4.4, name: 'plop', vol: 0.6 },
      { line: 'bye', offset: 0.0, name: 'tada' }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { c.fillStyle = P.water; c.fillRect(-250, 60, 500, 120); boat(c, -30, 60 + Math.sin(tt * 2) * 6, 0.9, Math.sin(tt * 2) * 0.05); }) },
      {
        from: 'stone', draw: (ctx, t, Lt) => {
          pond(ctx, t);
          // stone: thrown at 1.2s, hits water 1.6, sinks to bed by 3.6
          const sp = Lt.cwin('stone', 'splash', 0.5, null, -0.45); const sk = Lt.cwin('stone', 'down...', 2.0, E.in, -0.2);
          const sx = lerp(420, 900, Math.max(sp, sk > 0 ? 1 : 0)); const sy = sp > 0 && sk === 0 ? 420 - Math.sin(sp * Math.PI) * 120 + sp * 180 : lerp(WATER_Y, 920 - 40, sk);
          const bp = Lt.cwin('boat', 'it stays on top', 0.6, null, -0.5); const bob = Math.sin(t * 2) * 8;
          const bx = lerp(420, 1250, bp), by = bp < 1 ? lerp(380, WATER_Y - 20, bp) : WATER_Y - 20 + bob;
          L.pip(ctx, { x: 300, y: 420, s: 1.1, t, mood: Lt.after('why') ? 'think' : (sk > 0 && sk < 1 ? 'wow' : 'talk'), armR: (sp > 0 && sp < 0.3) || (bp > 0 && bp < 0.3) ? -1.3 : -0.5, armL: 0.6, lookX: 0.9, lookY: 0.5 });
          if (sp > 0 || sk > 0) stone(ctx, sx, sy, 1, sp * 3 + sk * 2);
          splash(ctx, 900, WATER_Y, Lt.cwin('stone', 'splash', 0.8));
          if (bp > 0) boat(ctx, bx, by, 1, bp < 1 ? 0 : Math.sin(t * 2) * 0.06);
          splash(ctx, 1250, WATER_Y, Lt.cwin('boat', 'it stays on top', 0.7, null, 0.1) * 0.7);
          L.sticker(ctx, 'sinks', 900, 450, Lt.cwin('stone', 'it sinks', 0.5) * (1 - Lt.win('why', 0, 0.3)), { bg: P.greyDark, color: P.white, size: 84, rot: -0.08 });
          L.sticker(ctx, 'floats!', 1250, 420, Lt.cwin('boat', 'it floats', 0.5) * (1 - Lt.win('why', 0, 0.3)), { bg: P.sun, size: 90, rot: 0.06 });
          if (Lt.after('why')) { L.questionMark(ctx, 900, 400, 0.8, t); L.questionMark(ctx, 1250, 380, 0.8, t); }
        }
      },
      {
        from: 'push', draw: (ctx, t, Lt) => {
          // bath: hand pushes ball under water, ball pops back up
          L.sky(ctx, { top: '#E7F3FF', bottom: '#F4F9FF' }); ctx.fillStyle = '#DDE8F2'; ctx.fillRect(0, 760, W, H - 760);
          // tub
          ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, 460, 420, 1000, 400, 60); ctx.fill(); ctx.stroke();
          const wy = 520; ctx.fillStyle = 'rgba(95,184,255,0.85)'; ctx.beginPath(); ctx.moveTo(480, wy); for (let x = 480; x <= 1440; x += 40) ctx.lineTo(x, wy + Math.sin(x / 70 + t * 2) * 6); ctx.lineTo(1440, 790); ctx.lineTo(480, 790); ctx.closePath(); ctx.fill();
          const push = Lt.cwin('push', 'try pushing', 1.2, E.inOut, 0.9); const rel = Lt.cwin('push', 'can you feel', 0.5, E.out, 0.6); const pop = Lt.cwin('push', 'can you feel', 1.2, null, 0.6);
          const depth = push * 170 * (1 - rel); const by = wy - 60 + depth - (pop > 0 ? Math.sin(pop * Math.PI) * 120 : 0);
          L.ball(ctx, 960, by, 90, P.red, t);
          if (push > 0 && rel < 1) { ctx.save(); ctx.translate(960, by - 100 - 60 * (1 - push)); L.hand(ctx, 0, 0, 1.3, Math.PI); ctx.restore(); }
          if (push > 0.3) upArrows(ctx, 960, by + 100, 3, 110, Math.min(1, push * 1.5), P.blueDeep);
          L.pip(ctx, { x: 240, y: 640, s: 1.1, t, mood: pop > 0 && pop < 1 ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.9, lookY: 0.2 });
          L.sticker(ctx, 'water pushes up!', W / 2, 250, Lt.cwin('push', 'water pushes up', 0.6) * (1 - Lt.cwin('push', 'try pushing', 0.3)), { bg: P.blue, color: P.white, size: 88, rot: -0.04 });
          L.sticker(ctx, 'push... push...', 1250, 300, Lt.cwin('push', 'try pushing', 0.4, null, 1.2) * (1 - Lt.cwin('push', 'can you feel', 0.2, null, 0.6)), { bg: P.sun, size: 72, rot: 0.05 });
          L.sticker(ctx, 'pop!', 1250, 300, Lt.cwin('push', 'can you feel', 0.4, null, 0.8) * (1 - Lt.cwin('push', 'can you feel', 0.3, null, 3.0)), { bg: P.pink, size: 96, rot: -0.08 });
        }
      },
      {
        from: 'displace', draw: (ctx, t, Lt) => {
          L.sky(ctx, { top: '#E7F3FF', bottom: '#F4F9FF' }); ctx.fillStyle = '#DDE8F2'; ctx.fillRect(0, 860, W, H - 860);
          const phase = Lt.after('boat2') ? 'boat' : Lt.after('stone2') ? 'stone' : 'generic';
          let level = 300, displaced = 0, obj = null;
          if (phase === 'generic') { const inP = Lt.cwin('displace', 'when something sits', 1.2, E.inOut, 1.0); level = 300 + 70 * inP; displaced = inP; obj = () => L.ball(ctx, 960, lerp(400, 860 - 300 - 20, inP), 110, P.red, t); if (inP > 0.9) upArrows(ctx, 960, 860 - 300 + 80, 5, 130, Lt.cwin('displace', 'and the water', 0.6), P.blueDeep); }
          if (phase === 'stone') { const inP = Lt.cwin('stone2', 'down...', 1.6, E.in, -0.3); level = 300 + 18 * Math.min(1, inP * 3); displaced = Math.min(1, inP * 3); obj = () => stone(ctx, 960, lerp(430, 860 - 50, inP), 1.1, inP * 2); if (inP > 0.2) { upArrows(ctx, 960, 860 - 300 + 90, 1, 70, 1, P.blueDeep); L.arrow(ctx, 1200, 400, 1200, 620, P.red, 16); text(ctx, 'heavy', 1200, 360, { size: 44, weight: 700, color: P.red }); } }
          if (phase === 'boat') { const inP = Lt.cwin('boat2', 'the boat is wide', 1.4, E.inOut, 0.8); level = 300 + 90 * inP; displaced = inP; obj = () => boat(ctx, 960, lerp(380, 860 - 300 - 30, inP), 1.3, 0, P.red); if (inP > 0.9) { upArrows(ctx, 960, 860 - 300 + 70, 5, 150, Lt.cwin('boat2', 'so the water pushes', 0.6), P.blueDeep); } }
          tank(ctx, t, level, { displaced, displacedH: Math.max(12, level - 300), mark: 300 });
          if (obj) obj();
          if (phase === 'boat' && Lt.cafter('boat2', 'the boat is wide', 2.0)) text(ctx, 'full of air', 960, 440, { size: 40, weight: 700, color: P.ink });
          L.pip(ctx, { x: 260, y: 640, s: 1.1, t, mood: 'talk', armR: -0.6, armL: 0.6, lookX: 0.9, lookY: 0 });
          text(ctx, 'water line', 1560, 560, { size: 36, weight: 600, color: P.ink, align: 'left' });
          L.sticker(ctx, 'pushes water away', W / 2, 180, Lt.cwin('displace', 'and the water', 0.5, null, -1.0) * (1 - Lt.win('stone2', 0, 0.3)), { bg: P.sun, size: 72, rot: -0.03 });
          L.sticker(ctx, 'a little', 1500, 280, Lt.cwin('stone2', 'it pushes only', 0.5, null, 1.0) * (1 - Lt.win('boat2', 0, 0.3)), { bg: P.greyDark, color: P.white, size: 72, rot: 0.05 });
          L.sticker(ctx, 'sinks', W / 2, 180, Lt.cwin('stone2', 'it sinks', 0.5) * (1 - Lt.win('boat2', 0, 0.3)), { bg: P.greyDark, color: P.white, size: 84, rot: -0.05 });
          L.sticker(ctx, 'a lot!', 1500, 280, Lt.cwin('boat2', 'it pushes a lot', 0.5, null, 0.9), { bg: P.blue, color: P.white, size: 72, rot: 0.05 });
          L.sticker(ctx, 'floats!', W / 2, 180, Lt.cwin('boat2', 'it floats', 0.5), { bg: P.sun, size: 90, rot: -0.05 });
        }
      },
      {
        from: 'clay1', draw: (ctx, t, Lt) => {
          pond(ctx, t);
          const d1 = Lt.cwin('clay1', 'plop', 0.6, E.in, -0.6); const sk = Lt.cwin('clay1', 'plop', 1.6, E.in, 0.0);
          const cy1 = d1 < 1 ? lerp(380, WATER_Y, d1) : lerp(WATER_Y, 920 - 40, sk);
          const morph = Lt.cwin('clay2', 'now curie makes', 1.4, E.inOut, 1.6); const d2 = Lt.cwin('clay2', 'it floats', 0.6, E.in, -0.75); const bob = Math.sin(t * 2) * 8;
          L.pip(ctx, { x: 300, y: 420, s: 1.1, t, mood: Lt.cafter('clay2', 'it floats', -0.2) ? 'wow' : 'talk', armR: d1 > 0 && d1 < 0.4 ? -1.3 : -0.5, armL: 0.6, lookX: 0.9, lookY: 0.4 });
          if (!Lt.after('clay2')) { const sq = Lt.win('clay1', 0.8, 1.2); if (sq > 0) clayBall(ctx, lerp(520, 900, d1), sq < 1 ? 380 : cy1, 1); }
          splash(ctx, 900, WATER_Y, Lt.cwin('clay1', 'plop', 0.8));
          if (Lt.after('clay2')) { if (d2 === 0) { const lift = Lt.win('clay2', 0.3, 1.0, E.outBack); clayBoat(ctx, lerp(900, 520, lift), lerp(880, 380, lift), 1, morph); } else clayBoat(ctx, lerp(520, 1250, d2), d2 < 1 ? lerp(380, WATER_Y - 10, d2) : WATER_Y - 10 + bob, 1, 1); }
          splash(ctx, 1250, WATER_Y, Lt.cwin('clay2', 'it floats', 0.7, null, -0.2) * 0.7);
          L.sticker(ctx, 'plop! sinks', 900, 450, Lt.cwin('clay1', 'it sinks', 0.5) * (1 - Lt.win('clay2', 0, 0.3)), { bg: P.greyDark, color: P.white, size: 80, rot: -0.08 });
          L.sticker(ctx, 'floats!', 1250, 420, Lt.cwin('clay2', 'it floats', 0.5), { bg: P.sun, size: 90, rot: 0.06 });
          L.sticker(ctx, 'same clay!', 700, 230, Lt.cwin('clay2', 'same clay', 0.5), { bg: P.pink, size: 80, rot: -0.05 });
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          pond(ctx, t); boat(ctx, 1250, WATER_Y - 20 + Math.sin(t * 2) * 8, 1.1, Math.sin(t * 2) * 0.06); upArrows(ctx, 1250, WATER_Y + 60, 3, 120, 1, P.blueDeep);
          L.pip(ctx, { x: 300, y: 420, s: 1.1, t, mood: 'talk', armR: -1.3, armL: 1.3 + Math.PI, lookX: 0.5, lookY: -0.5 });
          L.sayItSticker(ctx, 'Water pushes up!', Lt.cwin('sayit', 'water pushes up', 0.8), t);
        }
      },
      {
        from: 'try1', draw: (ctx, t, Lt) => {
          ctx.fillStyle = '#FFF4DF'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#D9B277'; ctx.fillRect(0, 800, W, H - 800); ctx.fillStyle = '#B98B4E'; ctx.fillRect(0, 800, W, 24);
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.2, 0.6));
          // bowl
          const bp = Lt.cwin('try1', 'ask a grown-up', 0.6, E.outBack, 1.0); const wy = 560;
          if (bp > 0) { ctx.save(); ctx.translate(960, 800); ctx.scale(bp, bp); ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-420, -300); ctx.quadraticCurveTo(-420, 0, -200, 0); ctx.lineTo(200, 0); ctx.quadraticCurveTo(420, 0, 420, -300); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(95,184,255,0.85)'; ctx.beginPath(); ctx.moveTo(-440, wy - 800); for (let x = -440; x <= 440; x += 40) ctx.lineTo(x, wy - 800 + Math.sin(x / 70 + t * 2) * 5); ctx.lineTo(440, 0); ctx.lineTo(-440, 0); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.restore(); }
          // items appear on the table edge during try1, then drop during try2
          const items = [['spoon', 1], ['coin', 1], ['cork', 0], ['lid', 0], ['leaf', 0]]; const xs = [760, 860, 960, 1060, 1160];
          items.forEach(([name, sinks], i) => {
            const ap = Lt.cwin('try1', 'collect a spoon', 0.4, E.outBack, 0.3 + i * 0.6); if (ap <= 0) return;
            const dp = Lt.cwin('try2', 'then drop it in', 0.8, E.in, 0.6 + i * 0.75); const yTop = 300, yFloat = wy - 20, ySink = 740;
            const bob = Math.sin(t * 2 + i) * 6;
            const y = dp < 1 ? lerp(yTop, sinks ? ySink : yFloat, dp) : (sinks ? ySink : yFloat + bob);
            const x = xs[i]; ctx.save(); if (dp === 0) { ctx.translate(x, yTop); ctx.scale(ap, ap); ctx.translate(-x, -yTop); }
            if (name === 'spoon') spoon(ctx, x, y, 0.9, dp === 0 ? 0 : 0.4); else if (name === 'coin') coin(ctx, x, y, 1); else if (name === 'cork') cork(ctx, x, y, 0.9); else if (name === 'lid') lid(ctx, x, y, 0.9); else leafItem(ctx, x, y, 0.9);
            ctx.restore();
            if (dp > 0 && dp < 1) splash(ctx, x, wy, seg(dp, 0.6, 1));
            if (dp >= 1) text(ctx, sinks ? 'sinks' : 'floats', x, sinks ? ySink - 90 : yFloat - 90, { size: 36, weight: 700, color: sinks ? P.greyDark : P.blueDeep });
          });
          L.pip(ctx, { x: 400, y: 640, s: 1.0, t, mood: 'talk', armR: -0.5, armL: 0.6, lookX: 0.9, lookY: 0 });
          L.sticker(ctx, 'Sink or float?', 1500, 300, Lt.cwin('try2', 'will it sink', 0.6), { bg: P.sun, size: 72, rot: 0.04 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Water pushes up!') }
    ],
    interactive: {
      hint: 'Guess first, then drag each thing into the pond. Does it sink or float? Tap the clay to change its shape.',
      init: s => { s.items = [{ n: 'stone', x: 160, y: 300, sinks: true }, { n: 'boat', x: 300, y: 300, sinks: false }, { n: 'cork', x: 420, y: 300, sinks: false }, { n: 'coin', x: 160, y: 430, sinks: true }, { n: 'spoon', x: 300, y: 430, sinks: true }, { n: 'leaf', x: 420, y: 430, sinks: false }, { n: 'clay', x: 300, y: 560, sinks: true, shape: 0 }]; s.items.forEach(it => { it.hx = it.x; it.hy = it.y; it.vy = 0; it.inWater = false; it.splash = 0; }); s.drag = null; s.lastCue = ''; s.count = 0; },
      update: (s, dt, cue) => {
        for (const it of s.items) {
          if (it === s.drag) continue;
          if (it.x > 540) { // over the pond
            const target = it.sinks ? 920 - 50 : WATER_Y - 15;
            if (!it.inWater && it.y >= WATER_Y - 20) { it.inWater = true; it.splash = 0.01; s.count++; s.lastCue = it.sinks ? 'sink' : 'float'; cue(s.lastCue); }
            if (it.y < target) { it.vy += (it.inWater ? 300 : 1800) * dt; it.y = Math.min(target, it.y + it.vy * dt); } else { it.y = target; it.vy = 0; }
            if (it.splash > 0) { it.splash += dt * 1.5; if (it.splash > 1) it.splash = 0; }
          } else if (it.y !== it.hy || it.x !== it.hx) { it.x = it.hx; it.y = it.hy; it.inWater = false; it.vy = 0; }
        }
      },
      draw: (ctx, s, t) => {
        pond(ctx, t);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; roundRect(ctx, 80, 230, 420, 400, 30); ctx.fill(); text(ctx, 'drag us in!', 290, 195, { size: 56, weight: 700, stroke: P.white, strokeWidth: 12 });
        for (const it of s.items) {
          const bob = it.inWater && !it.sinks ? Math.sin(t * 2 + it.x) * 6 : 0; const x = it.x, y = it.y + bob;
          if (it.n === 'stone') stone(ctx, x, y, 0.8); else if (it.n === 'boat') boat(ctx, x, y, 0.55); else if (it.n === 'cork') cork(ctx, x, y, 0.8); else if (it.n === 'coin') coin(ctx, x, y, 0.9); else if (it.n === 'spoon') spoon(ctx, x, y, 0.7, 0.5); else if (it.n === 'leaf') leafItem(ctx, x, y, 0.8); else { clayBoat(ctx, x, y, 0.7, it.shape); if (it === s.drag || it.x < 540) text(ctx, 'tap to reshape', x, y + 78, { size: 40, weight: 600 }); }
          if (it.splash > 0) splash(ctx, it.x, WATER_Y, it.splash);
        }
        // sink/float labels, staggered so that neighbours do not overlap
        const labelled = s.items.filter(it => it.inWater && it.vy === 0).sort((a, b) => a.x - b.x); let prevX = -1e9, row = 0;
        for (const it of labelled) {
          const bob = !it.sinks ? Math.sin(t * 2 + it.x) * 6 : 0; const y = it.y + bob;
          row = (it.x - prevX < 190) ? (row + 1) % 2 : 0; prevX = it.x;
          const ly = it.sinks ? y + 80 + row * 52 : ((it.n === 'boat' || (it.n === 'clay' && it.shape > 0.5) ? y - 150 : y - 85) - row * 52);
          text(ctx, it.sinks ? 'sinks' : 'floats!', it.x, ly, { size: 48, weight: 700, color: it.sinks ? P.ink : P.blueDeep, stroke: P.white, strokeWidth: 8 });
        }
        L.pip(ctx, { x: 300, y: 820, s: 0.8, t, mood: 'happy', armR: -0.6, armL: 0.6, lookX: 0.8, lookY: -0.3 });
      },
      pointer: (s, type, x, y) => {
        if (type === 'down') { let best = null, bd = 1e9; for (const it of s.items) { const d = Math.hypot(x - it.x, y - it.y); if (d < 90 && d < bd) { best = it; bd = d; } } if (best) { if (best.n === 'clay' && best.x < 540) { best.tapT = Date.now(); } s.drag = best; s.dx = x - best.x; s.dy = y - best.y; s.downX = x; s.downY = y; } }
        if (type === 'move' && s.drag) { s.drag.x = clamp(x - s.dx, 60, W - 60); s.drag.y = clamp(y - s.dy, 100, 900); s.drag.inWater = false; s.drag.vy = 0; }
        if (type === 'up' && s.drag) { const it = s.drag; if (it.n === 'clay' && Math.hypot(x - s.downX, y - s.downY) < 10) { it.shape = it.shape > 0.5 ? 0 : 1; it.sinks = it.shape < 0.5; } s.drag = null; }
      },
      cues: { sink: 'Down it goes! It sinks.', float: 'It stays on top! The water pushes it up.' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 6 — What makes things happen? (causes, after Rothman's causal-pie model, for 5–6 year olds) */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  const SOIL = '#7A4F2A', SOIL_WET = '#55361B', POT = '#D9834A', STEM = '#3E9B4F', CAN = '#7FC8A9', TEDDY = '#C98C5A', TEDDY_LIGHT = '#EDD2AE', GERM = '#7ED957';
  // the four pieces of the flower's cause pie
  const PIE = [{ id: 'soil', color: '#A9733F' }, { id: 'seed', color: '#E7C27A' }, { id: 'water', color: '#5FB8FF' }, { id: 'sun', color: '#FFD23F' }];

  // ---------- props ----------
  function garden(ctx, t, o) {
    o = o || {}; L.sky(ctx, o.sky);
    const sx = o.sunX == null ? 1650 : o.sunX, sy = o.sunY == null ? 200 : o.sunY;
    if (o.beam) { ctx.save(); ctx.globalAlpha = o.beam.a; ctx.fillStyle = '#FFE680'; ctx.beginPath(); ctx.moveTo(sx - 60, sy + 40); ctx.lineTo(sx + 70, sy + 70); ctx.lineTo(o.beam.x + 200, o.beam.y); ctx.lineTo(o.beam.x - 200, o.beam.y); ctx.closePath(); ctx.fill(); ctx.restore(); }
    L.sun(ctx, sx, sy, 110, t);
    if (o.cloudSun) L.cloud(ctx, sx - 10, sy + 20, 1.45, '#B9C2D0', { outline: P.ink, face: 'sad' });
    if (o.clouds !== false) L.cloud(ctx, 760 + Math.cos(t * 0.25) * 25, 150, 0.8);
    L.ground(ctx, 820); if (o.tree !== false) L.tree(ctx, 200, 830, 1.0);
  }
  function seed(ctx, x, y, s, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); ellipse(ctx, 0, 0, 30, 20, '#8B5A2B', P.ink, 5); ellipse(ctx, -8, -6, 9, 5, 'rgba(255,255,255,0.4)'); ctx.restore(); }
  function drop(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = P.water; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(26, 6, 26, 14); ctx.arc(0, 14, 26, 0, Math.PI); ctx.quadraticCurveTo(-26, 6, 0, -34); ctx.closePath(); ctx.fill(); ctx.stroke(); circle(ctx, -9, 10, 6, 'rgba(255,255,255,0.7)'); ctx.restore(); }
  function soilIcon(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = SOIL; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-44, 20); ctx.quadraticCurveTo(-30, -22, -4, -18); ctx.quadraticCurveTo(22, -34, 44, 20); ctx.closePath(); ctx.fill(); ctx.stroke(); circle(ctx, -14, 4, 4, 'rgba(255,255,255,0.25)'); circle(ctx, 16, 0, 3, 'rgba(255,255,255,0.25)'); ctx.restore(); }
  function germ(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.sin((t || 0) * 3 + i) * 0.1; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); ctx.stroke(); }
    circle(ctx, 0, 0, 24, GERM, P.ink, 4); circle(ctx, -8, -4, 6, P.white); circle(ctx, 8, -4, 6, P.white); circle(ctx, -8, -4, 3, P.ink); circle(ctx, 8, -4, 3, P.ink);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 6, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.restore();
  }
  function mouthIcon(ctx, x, y, s) { // fingers going into a mouth
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#FFD9B8'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(14, -6, 36, Math.PI * 0.75, Math.PI * 2.25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7A2E3B'; ellipse(ctx, 4, 4, 16, 11, '#7A2E3B', P.ink, 4);
    L.hand(ctx, -42, 16, 0.42, 1.2);
    ctx.restore();
  }
  function pieIcon(ctx, id, s, t) {
    ctx.save(); ctx.scale(s, s);
    if (id === 'soil') soilIcon(ctx, 0, 0, 1); else if (id === 'seed') seed(ctx, 0, 0, 1.1, 0.3); else if (id === 'water') drop(ctx, 0, 4, 1); else if (id === 'sun') L.sun(ctx, 0, 0, 24, t || 0, { face: false });
    else if (id === 'germs') germ(ctx, 0, 0, 1, t); else if (id === 'mouth') mouthIcon(ctx, 0, 0, 1);
    ctx.restore();
  }
  // the cause pie: slices [{id,color,state,pop,lift}]; state 0 = missing (dashed), 1 = present, 2 = taken away (red X)
  function causePie(ctx, x, y, r, slices, t, o) {
    o = o || {}; const n = slices.length; ctx.save(); ctx.translate(x, y);
    const full = slices.every(s => s.state === 1 && (s.pop == null || s.pop >= 1));
    if (full || o.glow) { const ga = full ? 1 : o.glow; const g = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.7); g.addColorStop(0, `rgba(255,230,120,${0.55 * ga})`); g.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill(); }
    circle(ctx, 0, 0, r + 14, 'rgba(255,255,255,0.9)', P.ink, 6);
    slices.forEach((s, i) => {
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n, am = (a0 + a1) / 2;
      const pop = s.pop == null ? 1 : clamp(s.pop, 0, 1); const lift = s.lift || 0;
      const lv = s.liftVec || [Math.cos(am), Math.sin(am)]; ctx.save(); ctx.translate(Math.cos(am) * 3 + lv[0] * lift * 70, Math.sin(am) * 3 + lv[1] * lift * 70);
      if (s.state === 1) ctx.scale(Math.max(0.001, pop), Math.max(0.001, pop));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath();
      if (s.state === 1) { ctx.fillStyle = s.color; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(200,205,215,0.35)'; ctx.fill(); ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(43,45,66,0.6)'; ctx.lineWidth = 5; ctx.stroke(); ctx.setLineDash([]); }
      const ix = Math.cos(am) * r * 0.58, iy = Math.sin(am) * r * 0.58;
      ctx.save(); ctx.translate(ix, iy); ctx.globalAlpha = s.state === 1 ? 1 : 0.4; pieIcon(ctx, s.id, r / 150, t); ctx.restore();
      if (s.state === 2) { ctx.strokeStyle = P.red; ctx.lineWidth = Math.max(8, r * 0.09); ctx.lineCap = 'round'; const k = r * 0.26; ctx.beginPath(); ctx.moveTo(ix - k, iy - k); ctx.lineTo(ix + k, iy + k); ctx.moveTo(ix + k, iy - k); ctx.lineTo(ix - k, iy + k); ctx.stroke(); }
      ctx.restore();
    });
    if (o.label) text(ctx, o.label, 0, r + 56, { size: 40, weight: 700, color: P.ink, stroke: P.white, strokeWidth: 8 });
    ctx.restore();
  }
  // flower pot, bottom-centre at (x,y). o: soil 0..1, wet, seed, sprout 0..1, bloom 0..1, wilt 0..1, t, big (bloom scale)
  function pot(ctx, x, y, s, o) {
    o = o || {}; const t = o.t || 0; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = POT; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-72, 0); ctx.lineTo(-96, -150); ctx.lineTo(96, -150); ctx.lineTo(72, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C4703E'; roundRect(ctx, -106, -190, 212, 44, 10); ctx.fill(); ctx.stroke();
    if (o.soil > 0) { ctx.save(); ctx.translate(0, -190); ctx.scale(1, o.soil); ctx.fillStyle = o.wet ? SOIL_WET : SOIL; ctx.beginPath(); ctx.moveTo(-92, 0); ctx.quadraticCurveTo(-50, -34, 0, -30); ctx.quadraticCurveTo(50, -36, 92, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    if (o.seed) seed(ctx, 0, o.soil ? -214 : -40, 0.9, 0.2);
    if (o.sprout > 0) {
      const wilt = o.wilt || 0; const big = o.big || 1; const hgt = (120 * o.sprout + 150 * (o.bloom || 0)) * big; const sway = Math.sin(t * 2) * 4;
      const tx = wilt * 110 + sway, ty = -hgt * (1 - 0.35 * wilt);
      ctx.save(); ctx.translate(0, -214 * (o.soil || 1)); ctx.strokeStyle = o.pale ? '#EDE9D0' : STEM; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(wilt * 30, -hgt * 0.55, tx, ty); ctx.stroke();
      // leaves
      const leaf = (ly, dir, sc) => { if (sc <= 0) return; ctx.save(); ctx.translate(wilt * 12 * dir, ly); ctx.scale(dir * sc, sc); ctx.fillStyle = o.pale ? '#F3F0DA' : P.green; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(28, -34, 64, -22); ctx.quadraticCurveTo(40, 8, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); };
      leaf(-hgt * 0.42, 1, clamp(o.sprout * 1.4 - 0.3, 0, 1)); leaf(-hgt * 0.66, -1, clamp(o.sprout * 1.4 - 0.5, 0, 1));
      if (o.bloom > 0) {
        const b = clamp(o.bloom, 0, 1) * big; ctx.save(); ctx.translate(tx, ty); ctx.rotate(wilt * 1.2);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + t * 0.2; circle(ctx, Math.cos(a) * 30 * b, Math.sin(a) * 30 * b, 24 * b, o.petal || P.pink, P.ink, 4); }
        circle(ctx, 0, 0, 20 * b, P.sun, P.ink, 4); ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function teddy(ctx, x, y, s, t) { // sitting teddy, feet at (x,y)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const bob = Math.sin((t || 0) * 2) * 2; ctx.translate(0, bob);
    ellipse(ctx, -40, -14, 26, 18, TEDDY, P.ink, 5); ellipse(ctx, 40, -14, 26, 18, TEDDY, P.ink, 5);
    ellipse(ctx, 0, -72, 56, 60, TEDDY, P.ink, 5); ellipse(ctx, 0, -64, 30, 34, TEDDY_LIGHT);
    ellipse(ctx, -54, -84, 16, 36, TEDDY, P.ink, 5, 0.5); ellipse(ctx, 54, -84, 16, 36, TEDDY, P.ink, 5, -0.5);
    circle(ctx, -40, -164, 19, TEDDY, P.ink, 5); circle(ctx, 40, -164, 19, TEDDY, P.ink, 5); circle(ctx, -40, -164, 9, TEDDY_LIGHT); circle(ctx, 40, -164, 9, TEDDY_LIGHT);
    circle(ctx, 0, -138, 46, TEDDY, P.ink, 5); ellipse(ctx, 0, -124, 22, 15, TEDDY_LIGHT); circle(ctx, 0, -131, 6, P.ink);
    circle(ctx, -17, -146, 5, P.ink); circle(ctx, 17, -146, 5, P.ink);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -120, 9, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.fillStyle = P.red; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(-20, -108); ctx.lineTo(-20, -84); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(20, -108); ctx.lineTo(20, -84); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // watering can, body centre (x,y); tilt in radians (negative = pouring to the left); pour 0/1 draws drops falling to groundY
  function can(ctx, x, y, s, tilt, pour, t, groundY) {
    tilt = tilt || 0; ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
    ctx.fillStyle = CAN; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, -50, 46, Math.PI, 0); ctx.stroke(); ctx.strokeStyle = CAN; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-56, -10); ctx.lineTo(-132, -84); ctx.stroke(); ctx.strokeStyle = CAN; ctx.lineWidth = 12; ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = P.ink; roundRect(ctx, -70, -50, 140, 110, 22); ctx.fillStyle = CAN; ctx.fill(); ctx.stroke();
    circle(ctx, -138, -90, 20, CAN, P.ink, 6); ctx.fillStyle = P.ink; for (const [dx, dy] of [[-6, -6], [6, -6], [0, 4], [-7, 7], [7, 7]]) circle(ctx, -138 + dx, -90 + dy, 2.5, P.ink);
    ctx.restore();
    if (pour > 0) {
      const lx = -138 * s, ly = -90 * s; const rx = x + lx * Math.cos(tilt) - ly * Math.sin(tilt), ry = y + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      const gy = groundY == null ? ry + 220 : groundY; const r = L.rng(5);
      ctx.save(); for (let i = 0; i < 7; i++) { const ph = r(); const f = ((t || 0) * 1.3 + ph) % 1; ctx.globalAlpha = (1 - f * 0.5) * pour; drop(ctx, rx + (i - 3) * 14 + Math.sin(ph * 9) * 6, lerp(ry + 10, gy, f), 0.45); } ctx.restore();
    }
  }
  function cupboard(ctx, x, y, w, h, inner) { // cutaway cupboard, bottom-centre (x,y): dark inside, door open on the left
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#8C6A4F'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -w / 2, -h, w, h, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2B2234'; ctx.fillRect(-w / 2 + 16, -h + 16, w - 32, h - 32);
    if (inner) { ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + 16, -h + 16, w - 32, h - 32); ctx.clip(); ctx.globalAlpha = 0.4; inner(); ctx.restore(); }
    ctx.fillStyle = '#A47B5A'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-w / 2 + 16, -h + 16); ctx.lineTo(-w / 2 - 70, -h + 60); ctx.lineTo(-w / 2 - 70, -40); ctx.lineTo(-w / 2 + 16, -16); ctx.closePath(); ctx.fill(); ctx.stroke(); circle(ctx, -w / 2 - 50, -h / 2, 9, P.sun, P.ink, 4);
    ctx.restore();
  }
  function cup(ctx, x, y, s, o) { // clear cup, bottom-centre; o: wool, bean, sprout
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(230,245,255,0.8)'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-84, -176); ctx.lineTo(84, -176); ctx.lineTo(70, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (o.wool > 0) { ctx.save(); ctx.translate(0, -30); ctx.scale(o.wool, o.wool); ctx.fillStyle = o.wet ? '#DCEBF7' : P.white; ctx.strokeStyle = 'rgba(43,45,66,0.45)'; ctx.lineWidth = 4; for (const [cx, cy, r] of [[-34, 0, 30], [0, -12, 36], [34, 0, 30], [-14, 14, 26], [18, 14, 26]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } ctx.restore(); }
    if (o.bean) seed(ctx, 0, -84, 0.75, 0.3);
    if (o.sprout > 0) { const h = 150 * o.sprout; ctx.strokeStyle = STEM; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -92); ctx.quadraticCurveTo(6, -92 - h * 0.5, 0, -92 - h); ctx.stroke(); for (const d of [-1, 1]) { ctx.save(); ctx.translate(0, -92 - h * 0.95); ctx.scale(d * o.sprout, o.sprout); ctx.fillStyle = P.green; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(24, -30, 56, -20); ctx.quadraticCurveTo(34, 8, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } }
    ctx.restore();
  }
  function window_(ctx, x, y, t) { // a window with the sun in it
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#CDEBFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -150, -130, 300, 260, 18); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); roundRect(ctx, -150, -130, 300, 260, 18); ctx.clip(); L.sun(ctx, 10, -10, 62, t); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(0, 130); ctx.moveTo(-150, 0); ctx.lineTo(150, 0); ctx.stroke(); ctx.restore();
  }
  function night(ctx, a) { if (a <= 0) return; L.fade(ctx, a * 0.7, '#1F2A48'); ctx.save(); ctx.globalAlpha = a; circle(ctx, 1300, 150, 56, '#FFF7C2', P.ink, 5); circle(ctx, 1272, 132, 46, `rgba(31,42,72,${0.75 * a})`); ctx.restore(); }
  function dayLabel(ctx, Lt) { const d = Lt.cafter('wait', 'three days', -0.1) ? 3 : Lt.cafter('wait', 'two days', -0.1) ? 2 : Lt.cafter('wait', 'one day', -0.1) ? 1 : 0; if (!d) return; const p = d === 3 ? Lt.cwin('wait', 'three days', 0.4, E.outBack, -0.1) : d === 2 ? Lt.cwin('wait', 'two days', 0.4, E.outBack, -0.1) : Lt.cwin('wait', 'one day', 0.4, E.outBack, -0.1); L.sticker(ctx, 'Day ' + d, 1000, 120, p * (1 - Lt.win('grow', 0, 0.3)), { bg: P.white, size: 64, rot: 0 }); }
  function pieSlices(present, removed, pops) { return PIE.map((p, i) => ({ ...p, state: removed && removed.includes(p.id) ? 2 : (present ? present(p.id, i) : 1) ? 1 : 0, pop: pops ? pops(i) : 1 })); }
  const allFull = () => PIE.map(p => ({ ...p, state: 1 }));

  L.episodes.ep6 = {
    id: 'ep6', num: 6, title: 'What makes things happen?', short: 'Causes', phrase: 'Lots of pieces make it happen!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie
    thumb: { big: "HAPPEN?", small1: "What makes things", small2: "", bg: (ctx, t) => { L.sky(ctx); L.sun(ctx, 1770, 170, 95, t); L.ground(ctx, 820); causePie(ctx, 1060, 330, 170, PIE.map(p => ({ ...p, state: 1 })), t); pot(ctx, 1480, 900, 1.5, { soil: 1, sprout: 1, bloom: 1, t }); teddy(ctx, 880, 900, 1.0, t); } },
    props: { pot, causePie, teddy, can, seed, PIE },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: what makes things happen?", say: "Today's big question... What makes things *happen*?", hold: 0.6 },
      { id: 'seed', text: 'Curie has a tiny seed, and Curie wants a flower! But a seed on its own... just sits there.', say: "{sfx:pop}Curie has a *tiny* seed... and Curie wants a *flower*! But a seed on its own... {w}just sits there.{/w}", hold: 0.8 },
      { id: 'pieces', text: 'A flower needs lots of pieces. Soil! A seed! Water! And sunshine!', say: "A flower needs *lots* of pieces. {sfx:thump}*Soil*! {sfx:pop}A *seed*! {sfx:drip}*Water*! {sfx:sparkle}And *sunshine*!", hold: 0.6 },
      { id: 'pie', text: "Each piece is a slice of Curie's cause pie. When the pie is full... something will happen!", say: "{sfx:ding}Each piece is a slice of Curie's *cause pie*. When the pie is *full*... {sfx:tada}something *will* happen!", hold: 0.8 },
      { id: 'wait', text: 'Now we wait. Causes take time. One day... two days... three days...', say: "Now... we wait. {w}Causes take *time*.{/w} {sfx:click}One day... {sfx:click}two days... {sfx:click}three days...", hold: 0.6 },
      { id: 'grow', text: 'Pop! A little sprout! And... a flower! All the pieces together made it happen!', say: "{sfx:pop}{hi}Pop!{/hi} A little *sprout*! {sfx:sparkle}And... {sfx:tada}a *flower*! All the pieces *together*... made it *happen*!", hold: 1.0 },
      { id: 'test', text: 'Which pieces really matter? Scientists test it! Take one piece away... and see what happens.', say: "Which pieces *really* matter? {sfx:bubble}Scientists *test* it! Take one piece *away*... {w}and see what happens.{/w}", hold: 0.7 },
      { id: 'nowater', text: 'No water? Nothing grows. No flower! Water makes a difference, so water is a cause.', say: "{sfx:click}No *water*? {pause 0.4} Nothing grows. {lo}No flower!{/lo} Water makes a *difference*... so water *is* a cause.", hold: 0.8 },
      { id: 'nosun', text: 'No sunshine? Just a tiny white sprout. No flower! Sunshine is a cause too.', say: "{sfx:click}No *sunshine*? {pause 0.4} Just a tiny, *white* sprout. {lo}No flower!{/lo} Sunshine is a cause *too*.", hold: 0.8 },
      { id: 'teddy', text: 'Hmm. Teddy sat next to the pot all week. Did teddy make the flower grow?', say: "{sfx:bubble}Hmm. Teddy sat next to the pot *all* week. Did *teddy* make the flower grow?", hold: 0.6 },
      { id: 'teddytest', text: "Let's test! Take teddy away... the flower still grows! Teddy is not a cause. It was just there!", say: "Let's *test*! {sfx:whoosh}Take teddy *away*... {sfx:sparkle}the flower *still* grows! Teddy is *not* a cause. {hi}It was just *there*!{/hi}", hold: 0.9 },
      { id: 'rule', text: 'So, to make something happen, you need all the pieces. To stop it, just take one piece away!', say: "So... to *make* something happen, you need *all* the pieces. {sfx:ding}To *stop* it... just take *one* piece away!", hold: 0.9 },
      { id: 'hands', text: "Doctors use this trick! Germs on your hands and fingers in your mouth can make a tummy ache. Wash the germs away... and that tummy ache can't happen!", say: "{sfx:sparkle}Doctors use this trick! *Germs* on your hands and fingers in your *mouth* can make a *tummy ache*. {sfx:bubble}Wash the germs *away*... {sfx:ding}and *that* tummy ache can't happen!", hold: 0.8 },
      { id: 'sayit', text: 'Say it with me: lots of pieces make it happen!', say: "Say it with me... {sfx:ding}*Lots* of pieces make it *happen*! {pause 0.9} {slow}Lots of pieces... make it happen!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for two cups, cotton wool, and two bean seeds. Put a seed in each cup.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for *two* cups, cotton wool... and two *bean* seeds. {sfx:pop}Put a seed in *each* cup.", hold: 0.4 },
      { id: 'try2', text: 'Water one cup every day. Keep the other one dry. Wait a few days. Which one grows? Which piece was missing?', say: "{sfx:drip}Water *one* cup every day. {sfx:click}Keep the other one *dry*. {w}Wait a few days.{/w} {sfx:pop}Which one *grows*? {sfx:ding}Which piece was *missing*?", hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: lots of pieces together make things happen. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... *lots* of pieces together make things *happen*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'seed', offset: 0.1, name: 'pop' }, { line: 'pieces', chunk: 'soil', offset: 0, name: 'thump', vol: 0.6 }, { line: 'pieces', chunk: 'a seed', offset: 0, name: 'pop' }, { line: 'pieces', chunk: 'water', offset: 0, name: 'drip' }, { line: 'pieces', chunk: 'and sunshine', offset: 0, name: 'sparkle' },
      { line: 'pie', offset: 0.1, name: 'ding' }, { line: 'pie', chunk: 'something will happen', offset: 0, name: 'tada' }, { line: 'wait', chunk: 'one day', offset: 0, name: 'click' }, { line: 'wait', chunk: 'two days', offset: 0, name: 'click' }, { line: 'wait', chunk: 'three days', offset: 0, name: 'click' },
      { line: 'grow', offset: 0.05, name: 'pop' }, { line: 'grow', chunk: 'a flower', offset: 0, name: 'tada' }, { line: 'test', chunk: 'scientists test', offset: 0, name: 'bubble' }, { line: 'nowater', offset: 0.1, name: 'click' }, { line: 'nosun', offset: 0.1, name: 'click' },
      { line: 'teddy', offset: 0.1, name: 'bubble' }, { line: 'teddytest', chunk: 'take teddy away', offset: 0, name: 'whoosh' }, { line: 'teddytest', chunk: 'still grows', offset: 0, name: 'sparkle' }, { line: 'rule', chunk: 'to stop it', offset: 0, name: 'ding' },
      { line: 'hands', offset: 0.1, name: 'sparkle' }, { line: 'hands', chunk: 'wash the germs', offset: 0, name: 'bubble' }, { line: 'hands', chunk: "can't happen", offset: 0, name: 'ding' }, { line: 'sayit', offset: 1.4, name: 'ding' },
      { line: 'try1', offset: 0.1, name: 'tada' }, { line: 'try1', chunk: 'each cup', offset: 0, name: 'pop' }, { line: 'try2', chunk: 'water one cup', offset: 0, name: 'drip' }, { line: 'try2', chunk: 'keep the other', offset: 0, name: 'click' }, { line: 'try2', chunk: 'which one grows', offset: 0, name: 'pop' }, { line: 'try2', chunk: 'which piece', offset: 0, name: 'ding' }, { line: 'bye', offset: 0.0, name: 'tada' }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { seed(c, -190, 60, 1.6, 0.3); L.arrow(c, -120, 60, -10, 60, P.ink, 10); pot(c, 150, 190, 0.78, { soil: 1, sprout: 1, bloom: 1, t: tt }); }) },
      {
        from: 'seed', draw: (ctx, t, Lt) => {
          const potP = Lt.win('pieces', 0, 0.5, E.outBack);
          const soilP = Lt.cwin('pieces', 'soil', 0.5, E.out); const seedHop = Lt.cwin('pieces', 'a seed', 0.7, E.inOut); const waterP = Lt.cwin('pieces', 'water', 1.4); const sunP = Lt.cwin('pieces', 'and sunshine', 0.8);
          const pieP = Lt.win('pie', 0, 0.5, E.outBack); const sliceP = i => Lt.cwin('pie', 'each piece', 0.4, E.outBack, 0.5 + i * 0.32); const fullP = Lt.cwin('pie', 'when the pie is full', 0.6); const happenP = Lt.cwin('pie', 'something will happen', 0.6);
          const sproutP = Lt.cwin('grow', 'pop', 0.7, E.outBack); const bloomP = Lt.cwin('grow', 'a flower', 0.9, E.outBack, 0.1);
          const n1 = Lt.cwin('wait', 'two days', 0.9, null, -0.95), n2 = Lt.cwin('wait', 'three days', 0.9, null, -0.95); const nightA = Math.max(Math.sin(Math.PI * n1), Math.sin(Math.PI * n2)) * 0.75;
          garden(ctx, t, { beam: sunP > 0 ? { x: 1200, y: 540, a: 0.22 * Math.min(1, sunP * 2) } : null });
          if (sunP > 0) L.sparkles(ctx, 1650, 200, t, 8, 6, 200, P.white);
          if (pieP > 0) { ctx.save(); ctx.translate(330, 300); ctx.scale(pieP, pieP); causePie(ctx, 0, 0, 140, pieSlices((id, i) => sliceP(i) > 0, null, sliceP), t, { label: 'cause pie', glow: fullP }); ctx.restore(); }
          // the seed on the ground, then hopping into the pot
          const seedIn = Lt.cwin('seed', 'tiny seed', 0.4, E.outBack, 0.1);
          if (seedIn > 0 && seedHop < 1) { const hx = lerp(1000, 1200, seedHop), hy = lerp(806, 540, seedHop) - Math.sin(seedHop * Math.PI) * 240; ctx.save(); ctx.translate(hx, hy); ctx.scale(seedIn, seedIn); seed(ctx, 0, 0, 1.3, seedHop * 6); ctx.restore(); }
          if (potP > 0) { ctx.save(); ctx.translate(1200, 820); ctx.scale(potP, potP); pot(ctx, 0, 0, 1.35, { soil: soilP, wet: waterP > 0.5, seed: seedHop >= 1 && sproutP <= 0, sprout: sproutP, bloom: bloomP, t }); ctx.restore(); }
          if (waterP > 0 && waterP < 1) { const k = Math.sin(waterP * Math.PI); can(ctx, 1360, 400 - k * 20, 1.1, -0.75 * k, k > 0.35 ? 1 : 0, t, 545); }
          if (happenP > 0 || (sproutP > 0 && sproutP < 1) || (bloomP > 0 && bloomP < 1)) L.sparkles(ctx, 1200, 520, t, 9, 10, 220);
          // Curie
          const sits = Lt.cafter('seed', 'just sits there') && !Lt.after('pieces'); const waiting = Lt.after('wait') && !Lt.after('grow');
          L.pip(ctx, { x: 560, y: 720, s: 1.3, t, mood: sits || waiting ? 'think' : (sproutP > 0 && sproutP < 1) || (bloomP > 0 && bloomP < 1) ? 'wow' : 'talk', armR: waiting ? 0.6 : -0.5, armL: 0.6, lookX: 0.9, lookY: Lt.after('pieces') ? 0.1 : 0.6 });
          night(ctx, nightA); dayLabel(ctx, Lt);
          // stickers
          L.sticker(ctx, 'just sits there...', 1000, 620, Lt.cwin('seed', 'just sits there', 0.5) * (1 - Lt.win('pieces', 0, 0.3)), { bg: P.grey, size: 64, rot: -0.05 });
          const pieceLbl = [['soil!', 'soil', P.brown, P.white], ['a seed!', 'a seed', '#E7C27A', P.ink], ['water!', 'water', P.blue, P.white], ['sunshine!', 'and sunshine', P.sun, P.ink]];
          pieceLbl.forEach(([lbl, needle, bg, color], i) => { const next = pieceLbl[i + 1]; const a = Lt.cwin('pieces', needle, 0.4, null, 0.1) * (next ? 1 - Lt.cwin('pieces', next[1], 0.25) : 1 - Lt.win('pie', 0, 0.3)); L.sticker(ctx, lbl, 1610, 600, a, { bg, color, size: 76, rot: i % 2 ? 0.06 : -0.06 }); });
          L.sticker(ctx, 'something will happen!', 1000, 300, happenP * (1 - Lt.win('wait', 0, 0.3)), { bg: P.pink, size: 72, rot: -0.04 });
          L.sticker(ctx, 'sprout!', 1540, 520, Lt.cwin('grow', 'sprout', 0.5) * (1 - Lt.cwin('grow', 'a flower', 0.3)), { bg: P.green, color: P.white, size: 80, rot: 0.06 });
          L.sticker(ctx, 'a flower!', 1560, 380, Lt.cwin('grow', 'a flower', 0.5) * (1 - Lt.cwin('grow', 'all the pieces', 0.3)), { bg: P.pink, size: 88, rot: -0.05 });
          L.sticker(ctx, 'all the pieces together!', 720, 110, Lt.cwin('grow', 'all the pieces', 0.6), { bg: P.sun, size: 60, rot: 0.03 });
        }
      },
      {
        from: 'test', draw: (ctx, t, Lt) => {
          L.sky(ctx); L.sun(ctx, 1790, 150, 90, t); L.ground(ctx, 820);
          // table
          ctx.fillStyle = '#D9B277'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, 380, 700, 1440, 40, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#B98B4E'; for (const lx of [440, 1760]) { ctx.fillRect(lx - 20, 740, 40, 160); ctx.strokeRect(lx - 20, 740, 40, 160); }
          const lift = Lt.cwin('test', 'take one piece away', 0.7, E.inOut, 0.2) * (1 - Lt.win('nowater', 0, 0.4, E.inOut)); const qP = Lt.cwin('test', 'see what happens', 0.5, E.outBack);
          // pot A: all four pieces, flower
          pot(ctx, 600, 700, 0.8, { soil: 1, sprout: 1, bloom: 1, t });
          causePie(ctx, 600, 170, 80, PIE.map(p => ({ ...p, state: 1, lift: p.id === 'water' ? lift : 0, liftVec: [0, -1] })), t);
          if (lift > 0) { ctx.save(); ctx.translate(560, 215 - lift * 70); L.hand(ctx, 0, 0, 0.8, 0.9); ctx.restore(); }
          if (qP > 0 && !Lt.after('nowater')) L.questionMark(ctx, 1100, 400, qP, t);
          // pot B: no water
          const bIn = Lt.win('nowater', 0, 0.5, E.outBack); const waterCause = Lt.cwin('nowater', 'is a cause', 0.5);
          if (bIn > 0) { ctx.save(); ctx.translate(1040, 700); ctx.scale(bIn, bIn); pot(ctx, 0, 0, 0.8, { soil: 1, seed: true, t }); ctx.restore(); causePie(ctx, 1040, 170, 80, pieSlices(null, ['water']), t); }
          // pot C: no sunshine (inside a dark cupboard)
          const cIn = Lt.win('nosun', 0, 0.5, E.outBack);
          if (cIn > 0) { ctx.save(); ctx.translate(1480, 700); ctx.scale(cIn, cIn); cupboard(ctx, 0, 0, 330, 300, () => pot(ctx, 0, -20, 0.7, { soil: 1, wet: true, sprout: 0.45, pale: true, t })); ctx.restore(); causePie(ctx, 1480, 170, 80, pieSlices(null, ['sun']), t); }
          L.pip(ctx, { x: 200, y: 740, s: 1.1, t, mood: 'talk', armR: -0.6, armL: 0.6, lookX: 0.9, lookY: -0.3 });
          L.sticker(ctx, 'Scientists test!', 1200, 120, Lt.cwin('test', 'scientists test', 0.5) * (1 - Lt.win('nowater', 0, 0.3)), { bg: P.blue, color: P.white, size: 76, rot: -0.03 });
          L.sticker(ctx, 'no water', 1040, 400, Lt.cwin('nowater', 'no water', 0.4, null, 0.2) * (1 - Lt.cwin('nowater', 'no flower', 0.25)), { bg: P.greyDark, color: P.white, size: 60, rot: -0.04 });
          L.sticker(ctx, 'no flower!', 1040, 400, Lt.cwin('nowater', 'no flower', 0.4) * (1 - waterCause), { bg: P.greyDark, color: P.white, size: 66, rot: 0.04 });
          L.sticker(ctx, 'water is a cause!', 1040, 400, waterCause * (1 - Lt.win('nosun', 0, 0.3)), { bg: P.blue, color: P.white, size: 60, rot: -0.03 });
          const sunCause = Lt.cwin('nosun', 'sunshine is a cause', 0.5);
          L.sticker(ctx, 'no sunshine', 1480, 340, Lt.cwin('nosun', 'no sunshine', 0.4, null, 0.2) * (1 - Lt.cwin('nosun', 'white sprout', 0.25)), { bg: P.greyDark, color: P.white, size: 60, rot: 0.04 });
          L.sticker(ctx, 'tiny white sprout', 1480, 340, Lt.cwin('nosun', 'white sprout', 0.4) * (1 - Lt.cwin('nosun', 'no flower', 0.25)), { bg: P.grey, size: 56, rot: -0.03 });
          L.sticker(ctx, 'no flower!', 1480, 340, Lt.cwin('nosun', 'no flower', 0.4) * (1 - sunCause), { bg: P.greyDark, color: P.white, size: 66, rot: -0.04 });
          L.sticker(ctx, 'sunshine is a cause too!', 1380, 340, sunCause, { bg: P.sun, size: 58, rot: 0.03 });
        }
      },
      {
        from: 'teddy', draw: (ctx, t, Lt) => {
          garden(ctx, t);
          const away = Lt.cwin('teddytest', 'take teddy away', 0.9, E.inOut); const still = Lt.cwin('teddytest', 'still grows', 0.8, E.outBack); const tIn = Lt.win('teddy', 0, 0.5, E.outBack);
          causePie(ctx, 330, 300, 140, allFull(), t, { label: 'cause pie' });
          pot(ctx, 1050, 820, 1.2, { soil: 1, sprout: 1, bloom: 1, big: 1 + 0.15 * still, t });
          if (still > 0 && still < 1) L.sparkles(ctx, 1050, 420, t, 4, 10, 240);
          if (tIn > 0) { const tx = lerp(1330, 2150, away); ctx.save(); ctx.translate(tx, 820); ctx.scale(tIn, tIn); teddy(ctx, 0, 0, 1.0, t); ctx.restore(); if (Lt.cafter('teddy', 'did teddy') && away <= 0) L.questionMark(ctx, 1330, 540, 0.9, t); }
          L.pip(ctx, { x: 520, y: 720, s: 1.3, t, mood: Lt.after('teddytest') ? 'talk' : 'think', armR: away > 0 && away < 1 ? -0.2 : -0.5, armL: 0.6, lookX: 0.9, lookY: 0.2 });
          L.sticker(ctx, 'still grows!', 1540, 460, still * (1 - Lt.cwin('teddytest', 'not a cause', 0.3)), { bg: P.green, color: P.white, size: 80, rot: 0.05 });
          L.sticker(ctx, 'teddy is not a cause', 1530, 460, Lt.cwin('teddytest', 'not a cause', 0.5) * (1 - Lt.cwin('teddytest', 'just there', 0.3)), { bg: P.red, color: P.white, size: 66, rot: -0.04 });
          L.sticker(ctx, 'just there!', 1540, 460, Lt.cwin('teddytest', 'just there', 0.5), { bg: P.pink, size: 84, rot: 0.05 });
        }
      },
      {
        from: 'rule', draw: (ctx, t, Lt) => {
          L.sky(ctx, { top: '#E7F3FF', bottom: '#F4F9FF' }); ctx.fillStyle = '#DDE8F2'; ctx.fillRect(0, 760, W, H - 760);
          const a = Lt.cwin('rule', 'to make something', 0.6, E.outBack); const b = Lt.cwin('rule', 'to stop it', 0.6, E.outBack); const away = Lt.cwin('rule', 'take one piece away', 0.6, E.outBack);
          const panel = (x, p, draw) => { if (p <= 0) return; ctx.save(); ctx.translate(x + 400, 400); ctx.scale(p, p); ctx.translate(-x - 400, -400); ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, x, 140, 800, 520, 40); ctx.fill(); ctx.stroke(); draw(); ctx.restore(); };
          panel(100, a, () => { causePie(ctx, 330, 410, 100, allFull(), t); pot(ctx, 700, 640, 0.85, { soil: 1, sprout: 1, bloom: 1, t }); L.sticker(ctx, 'all the pieces', 400, 210, 1, { bg: P.green, color: P.white, size: 56, rot: 0 }); });
          panel(1020, b, () => { causePie(ctx, 1250, 410, 100, PIE.map(p => ({ ...p, state: p.id === 'water' && away > 0 ? 2 : 1, lift: p.id === 'water' ? away : 0, liftVec: [0, -1] })), t); pot(ctx, 1620, 640, 0.85, { soil: 1, seed: true, t }); L.sticker(ctx, 'take one away', 1320, 210, 1, { bg: P.red, color: P.white, size: 56, rot: 0 }); if (away > 0) L.sticker(ctx, 'no flower', 1620, 400, away, { bg: P.greyDark, color: P.white, size: 52, rot: -0.05 }); });
          L.pip(ctx, { x: 960, y: 790, s: 0.9, t, mood: 'talk', armR: b > 0 ? -1.0 : -0.5, armL: a > 0 ? 1.0 + Math.PI : 0.6, lookX: b > 0 ? 0.8 : -0.8, lookY: -0.5 });
        }
      },
      {
        from: 'hands', draw: (ctx, t, Lt) => {
          L.sky(ctx, { top: '#E7F3FF', bottom: '#F4F9FF' }); ctx.fillStyle = '#DDE8F2'; ctx.fillRect(0, 820, W, H - 820);
          // one spoken chunk carries germs → fingers in mouth → tummy ache, so the later beats are offsets from its start
          const g = Lt.cwin('hands', 'germs on your hands', 0.5, E.outBack, 0.1); const m = Lt.cwin('hands', 'germs on your hands', 1.0, E.inOut, 1.3); const ache = Lt.cwin('hands', 'germs on your hands', 0.5, E.outBack, 2.8); const wash = Lt.cwin('hands', 'wash the germs', 1.4, null, 0.1); const ok = Lt.cwin('hands', "can't happen", 0.5, E.outBack);
          // pie of two pieces
          if (g > 0) causePie(ctx, 960, 290, 110, [{ id: 'germs', color: GERM, state: wash > 0.7 ? 2 : 1, pop: g }, { id: 'mouth', color: '#FFD9B8', state: m > 0 ? 1 : 0, pop: m }], t, { label: 'tummy ache pie' });
          // the hand: on the left, moves to Curie's mouth, then to the basin
          const hx = wash > 0 ? lerp(1300, 520, Math.min(1, wash * 2)) : lerp(520, 1300, m), hy = wash > 0 ? lerp(700, 680, Math.min(1, wash * 2)) : lerp(620, 700, m), hs = wash > 0 ? lerp(1.3, 2.0, Math.min(1, wash * 2)) : lerp(2.0, 1.3, m);
          // basin and tap
          if (wash > 0) { ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(300, 740); ctx.quadraticCurveTo(300, 900, 520, 900); ctx.quadraticCurveTo(740, 900, 740, 740); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.grey; roundRect(ctx, 480, 440, 80, 60, 20); ctx.fill(); ctx.stroke(); roundRect(ctx, 520, 380, 36, 90, 14); ctx.fill(); ctx.stroke(); if (wash > 0.3) { ctx.fillStyle = 'rgba(95,184,255,0.8)'; ctx.fillRect(505, 500, 30, 230); const r = L.rng(9); for (let i = 0; i < 10; i++) { const f = ((t * 0.8 + r()) % 1); circle(ctx, 420 + r() * 200, 700 - f * 160, 10 + 10 * r(), 'rgba(255,255,255,0.8)', P.blueDeep, 3); } } }
          ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.3 + m * 0.6); L.hand(ctx, 0, 0, hs, 0);
          if (g > 0) { const gone = clamp((wash - 0.3) * 2, 0, 1); for (const [gx, gy, ph] of [[-30, -40, 0], [30, -10, 2], [-5, 30, 4]]) { const sc = (1 - gone) * g; if (sc <= 0) continue; ctx.save(); ctx.translate(gx + Math.sin(t * 3 + ph) * 4, gy); ctx.scale(sc, sc); germ(ctx, 0, 0, 0.8, t + ph); ctx.restore(); } }
          ctx.restore();
          const sad = ache > 0 && ok <= 0;
          L.pip(ctx, { x: 1450, y: 700, s: 1.3, t, mood: ok > 0 ? 'happy' : sad ? 'sad' : 'talk', armR: sad ? 1.3 : -0.5, armL: sad ? 1.3 : 0.6, lookX: -0.8, lookY: 0.2 });
          L.sticker(ctx, 'tummy ache!', 1450, 330, ache * (1 - Lt.cwin('hands', 'wash the germs', 0.3)), { bg: P.red, color: P.white, size: 76, rot: 0.05 });
          L.sticker(ctx, 'wash!', 520, 300, Lt.cwin('hands', 'wash the germs', 0.5) * (1 - ok), { bg: P.blue, color: P.white, size: 80, rot: -0.06 });
          L.sticker(ctx, "can't happen!", 1450, 330, ok, { bg: P.green, color: P.white, size: 80, rot: -0.04 });
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          garden(ctx, t, { sunX: 1790, sunY: 150, beam: { x: 1250, y: 650, a: 0.2 } }); pot(ctx, 1250, 820, 0.7, { soil: 1, sprout: 1, bloom: 1, t });
          L.pip(ctx, { x: 560, y: 720, s: 1.3, t, mood: 'talk', armR: -1.3, armL: 1.3 + Math.PI, lookX: 0.3, lookY: -0.5 });
          L.sayItSticker(ctx, 'Lots of pieces make it happen!', Lt.cwin('sayit', 'lots of pieces make it happen', 0.8), t);
        }
      },
      {
        from: 'try1', draw: (ctx, t, Lt) => {
          ctx.fillStyle = '#FFF4DF'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#D9B277'; ctx.fillRect(0, 800, W, H - 800); ctx.fillStyle = '#B98B4E'; ctx.fillRect(0, 800, W, 24);
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.2, 0.6));
          const c1 = Lt.cwin('try1', 'two cups', 0.5, E.outBack), c2 = Lt.cwin('try1', 'two cups', 0.5, E.outBack, 0.3); const wool = Lt.cwin('try1', 'cotton wool', 0.5, E.outBack); const beanP = Lt.cwin('try1', 'each cup', 0.6, E.in);
          const pour = Lt.cwin('try2', 'water one cup', 1.6); const dry = Lt.cwin('try2', 'keep the other', 0.5, E.outBack); const dayP = Lt.cwin('try2', 'wait a few days', 1.6); const sproutP = Lt.cwin('try2', 'which one grows', 0.8, E.outBack, 0.1); const missing = Lt.cwin('try2', 'which piece', 0.6, E.outBack);
          // both cups stand in the same sunshine: a wide window above them
          const win = Lt.win('try1', 0.3, 0.5, E.outBack); if (win > 0) { ctx.save(); ctx.translate(1000, 330); ctx.scale(win, win); window_(ctx, 0, 0, t); ctx.restore(); }
          if (win >= 1) { ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#FFE680'; ctx.beginPath(); ctx.moveTo(850, 440); ctx.lineTo(1150, 440); ctx.lineTo(1420, 800); ctx.lineTo(580, 800); ctx.closePath(); ctx.fill(); ctx.restore(); }
          const drawCup = (x, p, o) => { if (p <= 0) return; ctx.save(); ctx.translate(x, 800); ctx.scale(p, p); cup(ctx, 0, 0, 1.15, o); ctx.restore(); };
          const wet = pour > 0.3 || Lt.after('try2') && Lt.cafter('try2', 'keep the other');
          drawCup(780, c1, { wool, bean: beanP >= 1 && sproutP <= 0, sprout: sproutP, wet });
          drawCup(1220, c2, { wool, bean: beanP >= 1, sprout: 0 });
          if (beanP > 0 && beanP < 1) for (const x of [780, 1220]) seed(ctx, x, lerp(300, 700, beanP), 0.85, beanP * 6);
          // the can waters cup 1 only (again on each waiting day)
          const dayIdx = dayP > 0 && dayP < 1 ? Math.min(2, Math.floor(dayP * 3)) : -1; const dayPour = dayIdx >= 0 ? (dayP * 3 - dayIdx) : 0;
          const k = pour > 0 && pour < 1 ? Math.sin(pour * Math.PI) : (dayIdx >= 0 ? Math.sin(Math.min(1, dayPour * 1.6) * Math.PI) : 0);
          if (k > 0) can(ctx, 930, 470 - k * 10, 1.0, -0.7 * k, k > 0.3 ? 1 : 0, t, 640);
          if (dry > 0) { ctx.save(); ctx.translate(1430, 470); ctx.scale(dry, dry); can(ctx, 0, 0, 0.8, 0, 0, t); ctx.strokeStyle = P.red; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-90, -90); ctx.lineTo(90, 90); ctx.moveTo(90, -90); ctx.lineTo(-90, 90); ctx.stroke(); ctx.restore(); }
          if (dayIdx >= 0) L.sticker(ctx, 'Day ' + (dayIdx + 1), 1600, 320, 1, { bg: P.white, size: 60, rot: 0 });
          if (missing > 0) { ctx.save(); ctx.translate(1620, 560); ctx.scale(missing, missing); causePie(ctx, 0, 0, 80, pieSlices(null, ['water']), t); ctx.restore(); }
          L.pip(ctx, { x: 380, y: 640, s: 1.0, t, mood: 'talk', armR: -0.6, armL: 0.6, lookX: 0.9, lookY: 0 });
          L.sticker(ctx, 'dry', 1220, 540, dry * (1 - Lt.cwin('try2', 'which one grows', 0.3)), { bg: P.greyDark, color: P.white, size: 64, rot: -0.05 });
          L.sticker(ctx, 'Which one grows?', 1480, 220, Lt.cwin('try2', 'which one grows', 0.6) * (1 - missing), { bg: P.sun, size: 64, rot: -0.03 });
          L.sticker(ctx, 'Which piece was missing?', 1480, 220, missing, { bg: P.sun, size: 56, rot: 0.03 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Lots of pieces make it happen!') }
    ],
    interactive: {
      hint: 'Drag the pieces into the pot: soil, seed, water and sunshine. When the cause pie is full, wait and watch. Drag a piece back out to take it away, and try teddy too!',
      init: s => {
        s.items = [{ n: 'soil', hx: 170, hy: 640 }, { n: 'seed', hx: 300, hy: 640 }, { n: 'water', hx: 430, hy: 640 }, { n: 'sun', hx: 190, hy: 790 }, { n: 'teddy', hx: 380, hy: 800 }];
        s.items.forEach(it => { it.x = it.hx; it.y = it.hy; it.placed = false; });
        s.drag = null; s.day = 0; s.dayT = 0; s.grow = 0; s.wilt = 0; s.grown = false; s.wasFull = false; s.lastCue = ''; s.idle = 0; s.pour = 0; s.moved = false; s.awayTimer = 0; s.cueTeddy = false;
      },
      update: (s, dt, cue) => {
        const has = n => s.items.some(it => it.n === n && it.placed);
        const full = ['soil', 'seed', 'water', 'sun'].every(has);
        if (s.cueTeddy) { s.cueTeddy = false; s.lastCue = 'teddy'; cue('teddy'); }
        if (full && !s.wasFull && s.grow <= 0) { s.lastCue = 'wait'; cue('wait'); } // the pie just became full: now we wait
        s.wasFull = full;
        if (full) {
          s.idle = 0; s.awayTimer = 0; s.wilt = 0; // a piece put straight back cancels the wilt
          if (s.grow <= 0 && s.day < 3) { s.dayT += dt; if (s.dayT >= 1.4) { s.dayT = 0; s.day++; } }
          else { s.grow = Math.min(1, s.grow + dt * 0.55); if (s.grow >= 1 && !s.grown) { s.grown = true; s.lastCue = 'grow'; cue('grow'); } }
        } else {
          if (s.awayTimer > 0) { s.awayTimer -= dt; if (s.awayTimer <= 0) { s.lastCue = 'away'; cue('away'); } }
          if (s.grow > 0 && s.awayTimer <= 0) { s.wilt = Math.min(1, s.wilt + dt * 0.7); if (s.wilt >= 1) { s.grow = 0; s.wilt = 0; s.day = 0; s.dayT = 0; s.grown = false; } }
          else if (s.grow <= 0) { s.day = 0; s.dayT = 0; s.wilt = 0; s.grown = false; }
          const n = s.items.filter(it => it.placed && it.n !== 'teddy').length;
          if (!s.drag) s.idle += dt;
          if (n > 0 && n < 4 && s.idle > 6 && s.lastCue !== 'missing') { s.lastCue = 'missing'; cue('missing'); s.idle = 0; }
        }
        if (s.pour > 0) s.pour = Math.max(0, s.pour - dt);
      },
      draw: (ctx, s, t) => {
        const has = n => s.items.some(it => it.n === n && it.placed);
        const full = ['soil', 'seed', 'water', 'sun'].every(has);
        garden(ctx, t, { tree: false, clouds: false, cloudSun: !has('sun'), beam: has('sun') ? { x: 1200, y: 560, a: 0.2 } : null });
        // tray
        ctx.fillStyle = 'rgba(255,255,255,0.72)'; roundRect(ctx, 70, 560, 460, 330, 30); ctx.fill();
        const inTray = s.items.filter(it => !it.placed && it !== s.drag).length;
        text(ctx, inTray ? 'drag us into the pot!' : 'drag a piece back out!', 300, 525, { size: 50, weight: 700, stroke: P.white, strokeWidth: 12 });
        causePie(ctx, 300, 280, 130, PIE.map(p => ({ ...p, state: has(p.id) ? 1 : 0 })), t, { label: 'cause pie' });
        if (!s.moved) L.arrow(ctx, 570, 560, 900, 530, P.sun, 14);
        pot(ctx, 1200, 820, 1.25, { soil: has('soil') ? 1 : 0, wet: has('water'), seed: has('seed') && s.grow <= 0, sprout: clamp(s.grow * 2, 0, 1), bloom: clamp(s.grow * 2 - 1, 0, 1), wilt: s.wilt, t });
        if (s.grow > 0 && s.grow < 1 && s.wilt <= 0) L.sparkles(ctx, 1200, 480, t, 9, 8, 200);
        for (const it of s.items) if (it !== s.drag) drawItem(ctx, it, t, s);
        if (s.drag) drawItem(ctx, s.drag, t, s);
        if (full && s.grow < 1) { const lbl = s.day < 3 ? 'Day ' + (s.day + 1) : 'growing...'; L.sticker(ctx, lbl, 820, 100, 1, { bg: P.white, size: 60, rot: 0 }); if (s.day < 3) night(ctx, Math.max(0, Math.sin(Math.PI * s.dayT / 1.4)) * 0.45); }
        if (s.wilt > 0) L.sticker(ctx, 'a piece is missing!', 820, 100, 1, { bg: P.greyDark, color: P.white, size: 56, rot: 0 });
        else if (full && s.grow >= 1) L.sticker(ctx, 'all the pieces: a flower!', 820, 100, 1, { bg: P.pink, size: 56, rot: 0 });
        L.pip(ctx, { x: 700, y: 800, s: 0.95, t, mood: s.wilt > 0 ? 'sad' : s.grow >= 1 ? 'wow' : 'happy', armR: -0.6, armL: 0.6, lookX: 0.9, lookY: -0.1 });
      },
      pointer: (s, type, x, y) => {
        const slotOf = it => it.n === 'soil' ? [1200, 700, 150] : it.n === 'seed' ? [1200, 552, 70] : it.n === 'water' ? (s.pour > 0 ? [1360, 400, 120] : [980, 790, 95]) : it.n === 'sun' ? [1650, 200, 140] : [1440, 760, 110];
        if (type === 'down') {
          let best = null, bd = 1e9;
          for (const it of s.items) { const [sx, sy, sr] = it.placed ? slotOf(it) : [it.x, it.y, 85]; const d = Math.hypot(x - sx, y - sy); if (d < sr && d < bd) { best = it; bd = d; } }
          if (!best) return;
          s.drag = best; s.moved = true;
          if (best.placed) { best.placed = false; best.x = x; best.y = y; if (best.n !== 'teddy' && s.grow > 0.3) s.awayTimer = 0.7; }
          s.dx = x - best.x; s.dy = y - best.y;
        }
        if (type === 'move' && s.drag) { s.drag.x = clamp(x - s.dx, 40, W - 40); s.drag.y = clamp(y - s.dy, 80, H - 40); }
        if (type === 'up' && s.drag) {
          const it = s.drag; s.drag = null; s.idle = 0;
          const over = (Math.abs(it.x - 1200) < 320 && it.y > 260 && it.y < 920) || (it.n === 'sun' && Math.hypot(it.x - 1650, it.y - 200) < 230);
          if (over) { it.placed = true; if (it.n === 'water') s.pour = 1.6; if (it.n === 'teddy') s.cueTeddy = true; if (it.n !== 'teddy') s.lastCue = ''; }
          else { it.placed = false; it.x = it.hx; it.y = it.hy; }
        }
      },
      cues: { wait: 'The pie is full! Now we wait... causes take time.', grow: 'All the pieces together... and the flower grows!', away: "Take one piece away... and it doesn't happen!", teddy: 'Teddy is just there. Teddy is not a cause!', missing: "Something is missing, so the flower can't grow yet." }
    }
  };
  // item drawing for the interactive (tray icons, dragged icons, and placed props around the pot)
  function drawItem(ctx, it, t, s) {
    if (it.placed) {
      if (it.n === 'soil' || it.n === 'seed' || it.n === 'sun') return; // shown by the pot and the sky
      if (it.n === 'water') { if (s.pour > 0) { const k = Math.sin(Math.PI * clamp(s.pour / 1.6, 0, 1)); can(ctx, 1360, 400 - k * 20, 1.1, -0.75 * k, k > 0.3 ? 1 : 0, t, 545); } else can(ctx, 980, 790, 0.85, 0, 0, t); return; }
      teddy(ctx, 1440, 820, 0.95, t); return;
    }
    const sc = it === s.drag ? 1.15 : 1; ctx.save(); ctx.translate(it.x, it.y); ctx.scale(sc, sc);
    if (it.n === 'soil') soilIcon(ctx, 0, 0, 1.3); else if (it.n === 'seed') seed(ctx, 0, 0, 1.4, 0.3); else if (it.n === 'water') can(ctx, 14, 0, 0.5, 0, 0, t); else if (it.n === 'sun') L.sun(ctx, 0, 0, 40, t); else teddy(ctx, 0, 70, 0.55, t);
    ctx.restore();
    text(ctx, it.n === 'water' ? 'water' : it.n === 'sun' ? 'sunshine' : it.n, it.x, it.y + (it.n === 'teddy' ? 96 : 68), { size: 34, weight: 700, color: P.ink, stroke: P.white, strokeWidth: 7 });
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 7 — Why do magnets stick?
   Scaffold made by ./lsc.sh new. It already runs end to end (audio, preview, render, site), so build it up step by step.
   Replace every TODO (tools/check.py refuses TODOs) and read docs/STYLE_GUIDE.md + docs/PIPELINE.md first.
   The closest published episode is the best model for scene and interactive code: ep6.js (pie, pots, panels, drag-and-drop),
   ep5.js (sorting into water), ep4.js (light and shadows), ep3.js (cycle), ep2.js (throwing/falling), ep1.js (melting, zoom-in).

   Coordinates: a 1920 x 1080 canvas. Keep anything important above y = 800: the caption box covers the bottom.
   Everything is a pure function of time t: draw(ctx, t, Lt) must not keep state between frames (frames are rendered out of order).
   Lt (lib/scenes.js L.tl) anchors animation to the narration:
     Lt.p('line')                      0..1 across the spoken part of a line
     Lt.win('line', offset, dur)       0..1 over [line start + offset, + dur]
     Lt.cwin('line', 'words', dur, ease, offset)   0..1 starting when the chunk containing 'words' is spoken (+offset)
     Lt.cafter('line', 'words', offset) true once that chunk has started
     Lt.chunk('line', 'words')         start time of that chunk; Lt.after('line') / Lt.done('line'); Lt.span('a', 'b')
   A chunk is a sentence, or a piece of one split at "...". Needles must match the spoken (say) text: ./lsc.sh check verifies them. */
(function (global) {
  const L = global.LSC; const LSC = L; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  // The click, zip and plop sounds come just AFTER the spoken word (a sound effect must not land on the word it illustrates), and the picture lands on the sound:
  // seconds after the word starts
  const LAG = { fridge: 0.56, door: 0.58, zip: 0.55, pull: 0.62 };
  // ---------- props: magnets and the things we test ----------
  const STEEL = '#9AA3B5', STEEL_LIGHT = '#C9D0DC', WOOD = '#C98C5A', WOOD_DARK = '#B5713A';
  // horseshoe magnet: the two tips are at (0,0) pointing DOWN, the arc is on top; left arm red, right arm blue, silver tips.
  function horseshoe(ctx, x, y, s, rot, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
    const cy = -120, r = 53, tipTop = -36;
    ctx.strokeStyle = P.ink; ctx.lineWidth = 58; ctx.beginPath(); ctx.moveTo(-r, 6); ctx.lineTo(-r, cy); ctx.arc(0, cy, r, Math.PI, 2 * Math.PI); ctx.lineTo(r, 6); ctx.stroke();
    ctx.lineWidth = 46; ctx.strokeStyle = o.left || P.red; ctx.beginPath(); ctx.moveTo(-r, tipTop); ctx.lineTo(-r, cy); ctx.arc(0, cy, r, Math.PI, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = o.right || P.blue; ctx.beginPath(); ctx.moveTo(0, cy - r); ctx.arc(0, cy, r, Math.PI * 1.5, Math.PI * 2); ctx.lineTo(r, tipTop); ctx.stroke();
    ctx.strokeStyle = STEEL_LIGHT; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r, tipTop); ctx.moveTo(r, 0); ctx.lineTo(r, tipTop); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-r - 23, tipTop); ctx.lineTo(-r + 23, tipTop); ctx.moveTo(r - 23, tipTop); ctx.lineTo(r + 23, tipTop); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, cy, r + 10, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
    ctx.restore();
  }
  // the same magnet placed by its CENTRE (cx, cy), so it can turn and tumble about itself
  function horseshoeAt(ctx, cx, cy, s, rot, o) { rot = rot || 0; horseshoe(ctx, cx - Math.sin(rot) * 100 * s, cy + Math.cos(rot) * 100 * s, s, rot, o); }
  // bar magnet centred at (x,y), 340 x 100 at s = 1: the LEFT half is colour a, the RIGHT half colour b (red / blue)
  function bar(ctx, x, y, s, rot, a, b) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    ctx.save(); roundRect(ctx, -170, -50, 340, 100, 24); ctx.clip(); ctx.fillStyle = a || P.red; ctx.fillRect(-170, -50, 170, 100); ctx.fillStyle = b || P.blue; ctx.fillRect(0, -50, 170, 100); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-170, -40, 340, 14); ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 7; roundRect(ctx, -170, -50, 340, 100, 24); ctx.stroke(); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -50); ctx.lineTo(0, 50); ctx.stroke();
    ctx.restore();
  }
  function clip(ctx, x, y, s, rot) { // paper clip, centred, upright (about 52 x 150)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(-24, 52); ctx.lineTo(-24, -46); ctx.arc(0, -46, 24, Math.PI, 2 * Math.PI); ctx.lineTo(24, 42); ctx.arc(17, 42, 7, 0, Math.PI); ctx.lineTo(10, -34); ctx.arc(0, -34, 10, 0, Math.PI, true); ctx.lineTo(-10, 28); };
    ctx.strokeStyle = P.ink; ctx.lineWidth = 17; path(); ctx.stroke(); ctx.strokeStyle = STEEL_LIGHT; ctx.lineWidth = 8; path(); ctx.stroke();
    ctx.restore();
  }
  function nail(ctx, x, y, s, rot) { // iron nail, centred, lying along x (about 200 x 40)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.lineJoin = 'round'; ctx.fillStyle = STEEL; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-84, -8); ctx.lineTo(70, -8); ctx.lineTo(98, 0); ctx.lineTo(70, 8); ctx.lineTo(-84, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    roundRect(ctx, -100, -20, 20, 40, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-70, -5, 120, 4);
    ctx.restore();
  }
  function cap(ctx, x, y, s) { // steel bottle cap seen from above, centred (about 100 across)
    ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.fillStyle = STEEL;
    ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, rr = i % 2 ? 42 : 50; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    circle(ctx, 0, 0, 31, STEEL_LIGHT, P.ink, 4); circle(ctx, -10, -10, 8, 'rgba(255,255,255,0.75)');
    ctx.restore();
  }
  function pencil(ctx, x, y, s, rot) { // wooden pencil lying along x (about 230 x 34)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5;
    ctx.fillStyle = P.sun; ctx.fillRect(-90, -17, 148, 34); ctx.strokeRect(-90, -17, 148, 34);
    ctx.fillStyle = '#F2C9A0'; ctx.beginPath(); ctx.moveTo(58, -17); ctx.lineTo(104, 0); ctx.lineTo(58, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(90, -5); ctx.lineTo(104, 0); ctx.lineTo(90, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = P.pink; roundRect(ctx, -118, -17, 30, 34, 9); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,45,66,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-88, 0); ctx.lineTo(58, 0); ctx.stroke();
    ctx.restore();
  }
  function leaf(ctx, x, y, s, rot) { // green leaf (about 160 x 100)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.fillStyle = P.green; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-10, -62, 70, -4); ctx.quadraticCurveTo(0, 56, -70, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-86, 7); ctx.lineTo(52, -4); ctx.stroke(); ctx.lineWidth = 3;
    for (const k of [-34, -4, 26]) { ctx.beginPath(); ctx.moveTo(k, -3); ctx.lineTo(k + 18, -26); ctx.moveTo(k, -1); ctx.lineTo(k + 14, 22); ctx.stroke(); }
    ctx.restore();
  }
  function block(ctx, x, y, s, rot) { // plastic toy block (about 120 x 100)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5;
    for (const k of [-26, 26]) ellipse(ctx, k, -34, 18, 12, P.purple, P.ink, 5);
    ctx.fillStyle = '#B994FF'; roundRect(ctx, -58, -26, 116, 70, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.purple; roundRect(ctx, -58, -26, 116, 26, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; roundRect(ctx, -46, 14, 32, 8, 4); ctx.fill();
    ctx.restore();
  }
  function eraser(ctx, x, y, s, rot) { // pink rubber (about 120 x 56)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5;
    ctx.fillStyle = '#FFB3D9'; roundRect(ctx, -60, -28, 120, 56, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.white; ctx.fillRect(-18, -28, 36, 56); ctx.strokeRect(-18, -28, 36, 56); ctx.fillStyle = 'rgba(255,255,255,0.5)'; roundRect(ctx, -52, -20, 24, 8, 4); ctx.fill();
    ctx.restore();
  }
  function foil(ctx, x, y, s, rot, t) { // a sheet of shiny kitchen foil (about 220 x 130)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const g = ctx.createLinearGradient(-110, -65, 110, 65); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.35, '#C8D2E2'); g.addColorStop(0.62, '#F4F7FC'); g.addColorStop(1, '#AEB9CC');
    ctx.fillStyle = g; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-108, -50); ctx.lineTo(-40, -66); ctx.lineTo(30, -52); ctx.lineTo(108, -64); ctx.lineTo(96, 4); ctx.lineTo(110, 58); ctx.lineTo(30, 66); ctx.lineTo(-44, 52); ctx.lineTo(-110, 62); ctx.lineTo(-96, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,45,66,0.28)'; ctx.lineWidth = 3;
    for (const [a, b, c, d] of [[-70, -40, -20, 10], [10, -50, 50, -6], [-30, 30, 40, 46], [60, 10, 90, 40], [-90, 10, -50, 40]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    for (const [gx, gy, ph] of [[-60, -30, 0], [40, -34, 1.7], [70, 30, 3.1], [-20, 24, 4.4]]) { const k = 0.5 + 0.5 * Math.sin((t || 0) * 4 + ph); if (k > 0.2) { L.star(ctx, gx, gy, 11 + 14 * k, 'rgba(43,45,66,0.55)', (t || 0) + ph); L.star(ctx, gx, gy, 8 + 14 * k, P.white, (t || 0) + ph); } }
    ctx.restore();
  }
  // the things in the Magnet test: kind -> drawing (all centred at x,y; lying flat, as seen from the front of the table)
  const KINDS = { clip: [clip, 1.0, Math.PI / 2 - 0.5], nail: [nail, 1.0, 0], cap: [cap, 1.0, 0], pencil: [pencil, 1.0, 0], leaf: [leaf, 1.0, 0], block: [block, 1.0, 0], eraser: [eraser, 1.0, 0], foil: [foil, 1.0, 0] };
  function item(ctx, kind, x, y, s, rot, t) { const k = KINDS[kind]; k[0](ctx, x, y, (s == null ? 1 : s) * k[1], rot == null ? k[2] : rot, t); }

  // ---------- props: the kitchen, the lab table and effects ----------
  function kitchen(ctx) { // wall and floor (floor line at y = 780)
    ctx.fillStyle = '#FFF1D6'; ctx.fillRect(0, 0, W, 780); ctx.fillStyle = 'rgba(255,196,110,0.2)'; for (let x = 60; x < W; x += 180) ctx.fillRect(x, 0, 70, 780);
    ctx.fillStyle = '#E3B27A'; ctx.fillRect(0, 780, W, H - 780); ctx.fillStyle = '#C98C5A'; ctx.fillRect(0, 768, W, 16);
    ctx.strokeStyle = 'rgba(120,70,20,0.22)'; ctx.lineWidth = 4; for (const y of [870, 960, 1040]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  function lab(ctx) { // soft lab wall with a faint grid, floor from y = 790
    ctx.fillStyle = '#EEF6FF'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(78,168,255,0.12)'; ctx.lineWidth = 3;
    for (let x = 0; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 790); ctx.stroke(); } for (let y = 0; y < 790; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = '#DDE9F7'; ctx.fillRect(0, 790, W, H - 790);
  }
  function fridge(ctx, x, y, s) { // front view, bottom-centre (x,y); at s = 1 the body is 350 wide and 590 tall
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
    ctx.fillStyle = '#F6FAFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -175, -600, 350, 590, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(158,211,255,0.3)'; roundRect(ctx, -160, -586, 40, 560, 16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-175, -400); ctx.lineTo(175, -400); ctx.stroke();
    ctx.fillStyle = STEEL_LIGHT; roundRect(ctx, 118, -548, 22, 110, 11); ctx.fill(); ctx.stroke(); roundRect(ctx, 118, -380, 22, 200, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.fillRect(-140, -10, 56, 16); ctx.fillRect(84, -10, 56, 16);
    ctx.restore();
  }
  function woodDoor(ctx, x, y, s) { // front view, bottom-centre (x,y); 380 wide and 660 tall at s = 1
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8;
    ctx.fillStyle = '#8C6A4F'; ctx.fillRect(-190, -660, 380, 660); ctx.strokeRect(-190, -660, 380, 660);
    ctx.fillStyle = WOOD; ctx.fillRect(-165, -635, 330, 635); ctx.strokeRect(-165, -635, 330, 635);
    for (const [px, py, pw, ph] of [[-132, -604, 126, 250], [6, -604, 126, 250], [-132, -330, 126, 280], [6, -330, 126, 280]]) { ctx.fillStyle = WOOD_DARK; ctx.lineWidth = 6; roundRect(ctx, px, py, pw, ph, 10); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#D9A06E'; roundRect(ctx, px + 12, py + 12, pw - 24, ph - 24, 6); ctx.fill(); }
    ctx.strokeStyle = 'rgba(120,70,20,0.35)'; ctx.lineWidth = 3; for (const gy of [-560, -500, -280, -200]) { ctx.beginPath(); ctx.moveTo(-100, gy); ctx.quadraticCurveTo(-60, gy - 10, -20, gy); ctx.stroke(); ctx.beginPath(); ctx.moveTo(40, gy + 20); ctx.quadraticCurveTo(80, gy + 10, 110, gy + 20); ctx.stroke(); }
    circle(ctx, 118, -310, 22, P.sun, P.ink, 6); circle(ctx, 112, -317, 6, 'rgba(255,255,255,0.7)');
    ctx.restore();
  }
  function drawing(ctx, x, y, s, rot) { // Curie's drawing on paper (160 x 200): a rainbow, a sun and some grass
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1);
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.fillRect(-80, -100, 160, 200); ctx.strokeRect(-80, -100, 160, 200);
    ctx.fillStyle = P.ground; ctx.fillRect(-77, 62, 154, 35);
    ctx.lineCap = 'round'; ctx.lineWidth = 13; for (const [r, c] of [[54, P.red], [40, P.sun], [26, P.blue]]) { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(0, 62, r, Math.PI, 2 * Math.PI); ctx.stroke(); }
    circle(ctx, -46, -58, 19, P.sun, P.sunDeep, 4); ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(-46 + Math.cos(a) * 26, -58 + Math.sin(a) * 26); ctx.lineTo(-46 + Math.cos(a) * 36, -58 + Math.sin(a) * 36); ctx.stroke(); }
    ctx.restore();
  }
  // table seen from the front and a little from above: the top surface is a band from topY to topY + th, things rest on it
  function table(ctx, x0, x1, topY, th) {
    th = th || 66;
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.fillStyle = '#B98B4E'; for (const lx of [x0 + 70, x1 - 110]) { ctx.fillRect(lx, topY + th + 40, 40, H - topY - th - 40); ctx.strokeRect(lx, topY + th + 40, 40, H - topY - th - 40); }
    ctx.fillStyle = '#D9B277'; ctx.fillRect(x0 + 14, topY + th - 2, x1 - x0 - 28, 48); ctx.strokeRect(x0 + 14, topY + th - 2, x1 - x0 - 28, 48);
    ctx.fillStyle = '#F0CF9E'; roundRect(ctx, x0, topY, x1 - x0, th, 14); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // a hand (in a white sleeve coming from above the picture) holding a horseshoe magnet whose tips are at (x,y)
  function handMagnet(ctx, x, y, s, rot) {
    s = s || 1; const hs = 1.15 * s; const hy = y - 262 * s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.translate(-x, -y);
    const sh = hy + 400 - 24 * hs; if (sh > 40) { ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 7; roundRect(ctx, x - 70 * hs, -400, 140 * hs, sh, 20); ctx.fill(); ctx.stroke(); }
    L.hand(ctx, x, hy, hs, Math.PI);
    horseshoe(ctx, x, y, s, 0);
    ctx.restore();
  }
  // dotted pull lines between two points (moving dots show the direction), a = 0..1
  function pullLines(ctx, x1, y1, x2, y2, t, a) {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = P.blueDeep; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.setLineDash([2, 22]);
    for (const k of [-1, 0, 1]) { ctx.lineDashOffset = -t * 70 * (y2 > y1 ? -1 : 1); ctx.beginPath(); ctx.moveTo(x1 + k * 34, y1); ctx.quadraticCurveTo((x1 + x2) / 2 + k * 60, (y1 + y2) / 2, x2 + k * 20, y2); ctx.stroke(); }
    ctx.restore();
  }
  // two arrows pushing away from (x,y) along x, a = 0..1
  function pushArrows(ctx, x, y, len, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; L.arrow(ctx, x - 20, y, x - 20 - len, y, P.red, 16); L.arrow(ctx, x + 20, y, x + 20 + len, y, P.red, 16); ctx.restore(); }

  // ---------- helpers: things hanging from a magnet, badges, bursts, the fridge door ----------
  // a thing hanging from a magnet tip at (tx, ty): its top touches the tip; sway turns it about that point
  function hangClip(ctx, tx, ty, s, sway) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(sway || 0); clip(ctx, 0, 78 * s, s, 0); ctx.restore(); }
  function hangNail(ctx, tx, ty, s, sway) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(sway || 0); nail(ctx, 0, 100 * s, s, Math.PI / 2); ctx.restore(); }
  function tick(ctx, x, y, r, p) { // green badge with a white tick (pops in with p 0..1)
    if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    circle(ctx, 0, 0, r, P.green, P.ink, 7); ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.46, 0); ctx.lineTo(-r * 0.12, r * 0.34); ctx.lineTo(r * 0.5, -r * 0.36); ctx.stroke(); ctx.restore();
  }
  function cross(ctx, x, y, r, p) { // red badge with a white cross
    if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    circle(ctx, 0, 0, r, P.red, P.ink, 7); ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.4); ctx.moveTo(r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.4, r * 0.4); ctx.stroke(); ctx.restore();
  }
  function burst(ctx, x, y, r, p, color) { // short rays flying out of (x, y); p 0..1, fades away
    if (p <= 0 || p >= 1) return; ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color || P.sunDeep; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - p;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.2, r0 = r * (0.55 + 0.7 * p), r1 = r0 + r * 0.45; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    ctx.restore();
  }
  // where Curie's drawing and its magnet sit on the fridge door (fridge-local coordinates, see fridge())
  const FR = { dx: -28, dy: -215, ds: 1.04, my: -311, ms: 0.5 };
  function fridgeWithDrawing(ctx, fx, fy, fs) { // the finished picture: the fridge with the drawing held by the magnet
    fridge(ctx, fx, fy, fs); drawing(ctx, fx + FR.dx * fs, fy + FR.dy * fs, FR.ds * fs, 0); bar(ctx, fx + FR.dx * fs, fy + FR.my * fs, FR.ms * fs, 0, P.red, P.blue);
  }

  // the lab table: the top surface is a band from TOP to TOP + 100; the little things (scale IS) rest on it with their bottom at TOP + 80
  const TOP = 640, IS = 1.5, REST = { clip: 59, nail: 20, cap: 50, pencil: 17, leaf: 45, block: 44, eraser: 28, foil: 62 };
  function labStage(ctx) { lab(ctx); table(ctx, 470, 1880, TOP, 100); }
  function onTable(ctx, kind, x, s, rot, t, sc) { s = (s == null ? 1 : s) * (sc || IS); item(ctx, kind, x, TOP + 80 - REST[kind] * s, s, rot, t); }
  // a paper clip that lies at x0, trembles, zips up to the left tip (tx, ty) of a magnet exactly at time zipT, and then hangs there
  function zipClip(ctx, t, x0, pop, zipT, tx, ty, sway) {
    if (pop <= 0) return; const zp = seg(t, zipT - 0.25, zipT, E.in);
    if (zp >= 1) { hangClip(ctx, tx, ty, IS, sway); return; }
    const trem = seg(t, zipT - 0.55, zipT - 0.28) * (1 - zp);
    item(ctx, 'clip', lerp(x0, tx, zp) + Math.sin(t * 70) * 3 * trem, lerp(TOP + 80 - REST.clip * IS * pop, ty + 78 * IS, zp), IS * pop, lerp(Math.PI / 2 - 0.5, 0, zp) + Math.sin(t * 61) * 0.05 * trem, t);
  }
  function flipBar(ctx, x, y, s, flip, a, b) { // a bar magnet turning round (flip 0..1 = half a turn about its middle): its colours swap sides
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.cos(flip * Math.PI), 1); bar(ctx, 0, 0, s, 0, a, b); ctx.restore();
  }
  function noEye(ctx, x, y, s, p) { // an eye with a red slash: "we cannot see it"
    if (p <= 0) return; const k = E.outBack(clamp(p, 0, 1)) * s; ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineCap = 'round';
    ellipse(ctx, 0, 0, 90, 56, P.white, P.ink, 8); circle(ctx, 0, 0, 30, P.blue, P.ink, 6); circle(ctx, 0, 0, 13, P.ink); circle(ctx, -9, -9, 6, P.white);
    ctx.strokeStyle = P.white; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(-84, 70); ctx.lineTo(84, -70); ctx.stroke(); ctx.strokeStyle = P.red; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-84, 70); ctx.lineTo(84, -70); ctx.stroke();
    ctx.restore();
  }

  // the magnet with the three iron things hanging from it (clip left, cap in the middle, nail right); mx = middle of the tips, ty = their height
  function ironCluster(ctx, mx, ty, sm, t) {
    const k = 1.07 * sm, sw = Math.sin(t * 2.6) * 0.035;
    item(ctx, 'cap', mx, ty + 37 * sm, 0.72 * sm, 0, t); hangClip(ctx, mx - 53 * sm, ty, k, sw); hangNail(ctx, mx + 53 * sm, ty, k, -sw);
  }
  function noSign(ctx, x, y, r, p) { // "never in your mouth": a mouth and a magnet inside a red no-sign
    if (p <= 0) return; const k = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    circle(ctx, 0, 0, r, P.white); ellipse(ctx, -r * 0.18, r * 0.12, r * 0.42, r * 0.26, '#7A2E3B', P.ink, 6); ellipse(ctx, -r * 0.18, r * 0.2, r * 0.22, r * 0.1, '#FF8FA3');
    bar(ctx, r * 0.12, -r * 0.3, r / 360, -0.35, P.red, P.blue);
    ctx.strokeStyle = P.red; ctx.lineWidth = r * 0.17; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.66, -r * 0.66); ctx.lineTo(r * 0.66, r * 0.66); ctx.stroke();
    ctx.restore();
  }

  // ---------- Try it 1, "Magnet test": things on a table and a magnet to drag over them ----------
  // Iron things within MT.R of the magnet's tips tremble, then zip up and hang from it (clip: left tip, nail: right tip, cap: middle).
  // Things without iron only wobble and get a cross when the magnet is within MT.RN. Only the thing closest to the tips reacts, so testing
  // one thing never sets off its neighbour (an iron thing three fingers away would otherwise jump while Curie says "no pull").
  // The nail lies in the front row under the block, because the magnet's body is drawn above its tips: testing the block never covers the nail, and
  // once the nail has jumped to the magnet the block stays quiet (the nail keeps its place for the tips) until the magnet moves up to the block.
  // The clip above the cap is the one iron pair in a column: the clip may follow the cap. The state holds plain numbers only.
  const MT = { SM: 1.3, R: 235, RN: 165, X0: 150, X1: 1770, Y0: 310, Y1: 780, SX: 960, SY: 420, GRIP: -30, BX: 1690, BY: 110 }; // Y1 keeps a hanging nail on the screen; GRIP puts the tips at the finger
  const MT_THINGS = [ // kind, has iron, centre x, baseline y (the bottom of the thing), scale
    ['clip', 1, 600, 660, 1.5], ['pencil', 0, 960, 660, 1.25], ['leaf', 0, 1320, 660, 1.4], ['block', 0, 1680, 660, 1.5],
    ['cap', 1, 600, 840, 1.4], ['foil', 0, 960, 840, 1.25], ['eraser', 0, 1320, 840, 1.5], ['nail', 1, 1680, 840, 1.25]];
  function mtSlot(it, mx, my) { // where an iron thing hangs from a magnet whose tips are at (mx, my)
    const k = 1.07 * MT.SM, sw = it.sw || 0;
    if (it.k === 'clip') return { x: mx - 53 * MT.SM - Math.sin(sw) * 78 * k, y: my + Math.cos(sw) * 78 * k, rot: sw, sc: k };
    if (it.k === 'nail') return { x: mx + 53 * MT.SM - Math.sin(sw) * 100 * k, y: my + Math.cos(sw) * 100 * k, rot: Math.PI / 2 + sw, sc: k };
    return { x: mx, y: my + 37 * MT.SM, rot: 0, sc: 0.72 * MT.SM };
  }
  function mtInit(s) {
    s.mx = MT.SX; s.my = MT.SY; s.pmx = MT.SX; s.vx = 0; s.drag = false; s.dx = 0; s.dy = MT.GRIP; s.moved = false; s.lift = false;
    s.clock = 0; s.cueAt = {}; s.mood = 'happy'; s.moodT = 0; s.n = 0; s.done = false; s.bp = 0;
    s.items = MT_THINGS.map(([k, iron, x, base, sc]) => {
      const r0 = k === 'clip' ? Math.PI / 2 - 0.5 : 0, y = base - REST[k] * sc;
      return { k, iron: !!iron, hx: x, hy: y, x, y, r0, s0: sc, rot: r0, sc, st: 'rest', p: 0, dm: 0, sx: x, sy: y, sr: r0, ss: sc, sw: 0, sv: 0, vy: 0, wob: 0, near: false, dw: 0, said: false, ca: 9 };
    });
  }
  function mtUpdate(s, dt, cue) {
    s.clock += dt;
    // each cue once per event, and never twice within 3 s (the page also ignores the same cue within 4 s)
    const say = id => { if (s.clock - (s.cueAt[id] == null ? -99 : s.cueAt[id]) >= 3) { s.cueAt[id] = s.clock; cue(id); } };
    const snd = (f, d, o) => { if (LSC.sound) LSC.sound.tone(f, d, o); };
    if (s.drag) s.lift = false;
    if (s.lift) { s.my = Math.max(MT.Y0, s.my - 900 * dt); if (s.my <= MT.Y0) s.lift = false; }
    s.vx += ((s.mx - s.pmx) / Math.max(dt, 0.001) - s.vx) * Math.min(1, dt * 12); s.pmx = s.mx; // the sideways speed makes the hanging things swing
    s.moodT = Math.max(0, s.moodT - dt);
    let nearest = null, nd = 1e9; // the iron thing lying closest to the tips is the only one that can start to jump
    for (const it of s.items) if (it.st === 'rest' || it.st === 'trem') { const d = Math.hypot(it.x - s.mx, it.y - s.my); if (d < nd) { nd = d; nearest = it; } }
    let over = null, od = 1e9; // whose place on the table the tips are over: a thing that has jumped to the magnet keeps its place, so its neighbour does not start to react the moment it leaves
    for (const it of s.items) { const d = Math.hypot(it.hx - s.mx, it.hy - s.my); if (d < od) { od = d; over = it; } }
    for (const it of s.items) {
      it.wob = Math.max(0, it.wob - dt * 1.4); it.ca += dt;
      const d = Math.hypot(it.x - s.mx, it.y - s.my);
      if (!it.iron) {
        if (d < MT.RN && (it.near || it === over)) {
          if (!it.near) { it.near = true; it.wob = 1; it.ca = 0; it.dw = 0; s.mood = 'think'; s.moodT = 2.5; snd(190, 0.2, { type: 'triangle', vol: 0.16, glide: 120 }); } // the wobble and the cross come at once
          if (it === over) { it.dw += dt; if (it.dw >= 0.45 && !it.said) { it.said = true; say(it.k === 'foil' ? 'foil' : 'nope'); } } else it.dw = 0; // Curie speaks when the magnet stays a moment on it, not for a fly-by
        } else if (it.near && d > MT.RN + 55) { it.near = false; it.said = false; }
        continue;
      }
      if (it.st === 'rest' && d < MT.R && it === nearest) { it.st = 'trem'; it.p = 0; }
      if (it.st === 'trem') {
        if (d > MT.R + 70) it.st = 'rest'; // the magnet moved away in time: it settles again
        else { it.p += dt; if (it.p >= 0.2) { it.st = 'fly'; it.p = 0; it.sx = it.x; it.sy = it.y; it.sr = it.rot; it.ss = it.sc; } }
      } else if (it.st === 'fly') {
        it.p = Math.min(1, it.p + dt / 0.26); const sl = mtSlot(it, s.mx, s.my), e = E.in(it.p);
        it.x = lerp(it.sx, sl.x, e); it.y = lerp(it.sy, sl.y, e); it.rot = lerp(it.sr, sl.rot, e); it.sc = lerp(it.ss, sl.sc, e);
        if (it.p >= 1) { it.st = 'hang'; it.sw = 0; it.sv = 0; it.ca = 0; s.mood = 'wow'; s.moodT = 2.5; snd(900, 0.07, { type: 'square', vol: 0.09 }); if (LSC.sound) LSC.sound.noise(0.05, 0.18, { hp: 2500 }); say('iron'); }
      } else if (it.st === 'hang') {
        const target = clamp(-s.vx * 0.0003, -0.5, 0.5); it.sv += ((target - it.sw) * 70 - it.sv * 6) * dt; it.sw = clamp(it.sw + it.sv * dt, -0.7, 0.7);
        const sl = mtSlot(it, s.mx, s.my); it.x = sl.x; it.y = sl.y; it.rot = sl.rot; it.sc = sl.sc;
      } else if (it.st === 'drop') {
        const home = () => { it.st = 'rest'; it.x = it.hx; it.y = it.hy; it.rot = it.r0; it.sc = it.s0; it.vy = 0; it.wob = 0.5; snd(160, 0.08, { type: 'triangle', vol: 0.12 }); };
        if (it.dm === 0) { // it falls back onto the table
          it.vy += 3200 * dt; it.y += it.vy * dt; it.x += (it.hx - it.x) * Math.min(1, dt * 9); it.rot += (it.r0 - it.rot) * Math.min(1, dt * 12); it.sc += (it.s0 - it.sc) * Math.min(1, dt * 12);
          if (it.y >= it.hy) home();
        } else { // it hangs lower than its place: it hops back up
          it.p = Math.min(1, it.p + dt / 0.4); const e = E.inOut(it.p);
          it.x = lerp(it.sx, it.hx, e); it.y = lerp(it.sy, it.hy, e) - 90 * Math.sin(Math.PI * it.p); it.rot = lerp(it.sr, it.r0, e); it.sc = lerp(it.ss, it.s0, e);
          if (it.p >= 1) home();
        }
      }
    }
    const n = s.items.filter(it => it.iron && it.st === 'hang').length; s.n = n;
    if (n === 3 && !s.done) { s.done = true; [523, 659, 784].forEach(f => snd(f, 0.6, { type: 'triangle', vol: 0.1 })); } else if (n < 3) s.done = false;
    s.bp += ((n > 0 ? 1 : 0) - s.bp) * Math.min(1, dt * 10);
  }
  function mtDrop(s) { // "Drop them": the magnet goes back up and everything it holds falls onto the table
    for (const it of s.items) if (it.st === 'hang') { it.st = 'drop'; it.sx = it.x; it.sy = it.y; it.sr = it.rot; it.ss = it.sc; it.p = 0; it.vy = 0; it.dm = it.y < it.hy - 30 ? 0 : 1; }
    s.lift = true; s.drag = false; if (LSC.sound) LSC.sound.noise(0.1, 0.2, { lp: 1500 });
  }
  function mtMove(s, x, y) { s.mx = clamp(x + s.dx, MT.X0, MT.X1); s.my = clamp(y + s.dy, MT.Y0, MT.Y1); }
  function mtPointer(s, type, x, y) {
    if (type === 'down') {
      const onBody = Math.abs(x - s.mx) < 130 && y > s.my - 300 && y < s.my + 60;
      if (!onBody && s.n > 0 && Math.abs(x - MT.BX) < 170 && Math.abs(y - MT.BY) < 90) { mtDrop(s); return; }
      s.drag = true; s.moved = true; s.lift = false;
      // grab the magnet where it is (its body, or something hanging from it); a touch anywhere else brings the tips to the finger
      const onMagnet = Math.abs(x - s.mx) < 200 && y > s.my - 330 && y < s.my + 50, onHang = s.items.some(it => it.st === 'hang' && Math.hypot(x - it.x, y - it.y) < 130);
      if (onMagnet || onHang) { s.dx = s.mx - x; s.dy = s.my - y; } else { s.dx = 0; s.dy = MT.GRIP; }
      mtMove(s, x, y);
    } else if (type === 'move' && s.drag) mtMove(s, x, y);
    else if (type === 'up') s.drag = false;
  }
  function mtDraw(ctx, s, t) {
    lab(ctx); table(ctx, 400, 1880, 470, 400);
    ctx.save(); ctx.strokeStyle = 'rgba(150,100,40,0.16)'; ctx.lineWidth = 4; for (const y of [550, 745]) { ctx.beginPath(); ctx.moveTo(430, y); ctx.lineTo(1850, y); ctx.stroke(); } ctx.restore();
    L.pip(ctx, { x: 190, y: 860, s: 1.0, t, mood: s.n === 3 ? 'wow' : s.moodT > 0 ? s.mood : 'happy', armR: -0.5, armL: 0.6, lookX: 0.8 });
    // the things: those lying on the table first (back row, then front row), then the ones that are falling, flying or hanging
    const rank = it => it.st === 'rest' || it.st === 'trem' ? 0 : it.st === 'drop' ? 1 : 2;
    for (const it of s.items.slice().sort((a, b) => rank(a) - rank(b) || a.hy - b.hy)) {
      const tr = it.st === 'trem' ? 1 : 0;
      item(ctx, it.k, it.x + tr * Math.sin(t * 70) * 3, it.y, it.sc, it.rot + tr * Math.sin(t * 61) * 0.05 + Math.sin(t * 32) * 0.12 * it.wob, t);
    }
    for (const it of s.items) if (!it.iron && it.ca < 1.7) cross(ctx, it.x, it.y - REST[it.k] * it.sc - 44, 34, Math.min(1, it.ca / 0.18) * (1 - seg(it.ca, 1.35, 1.7)));
    for (const it of s.items) if (it.iron && it.st === 'hang' && it.ca < 0.45) burst(ctx, s.mx + (it.k === 'clip' ? -53 : it.k === 'nail' ? 53 : 0) * MT.SM, s.my + 18, 70, seg(it.ca, 0, 0.45));
    horseshoe(ctx, s.mx, s.my, MT.SM, 0);
    if (s.done) L.sparkles(ctx, s.mx, s.my + 90, t, 6, 8, 230);
    // counter, "Drop them" button and the first hint
    L.sticker(ctx, s.n === 3 ? 'All the iron things!' : 'iron things: ' + s.n + ' of 3', 420, 90, 1, { bg: s.n === 3 ? P.green : P.sun, color: s.n === 3 ? P.white : P.ink, size: 54, rot: -0.02 });
    if (s.bp > 0.02) {
      ctx.save(); ctx.translate(MT.BX, MT.BY); const k = E.outBack(clamp(s.bp, 0, 1)); ctx.scale(k, k); ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -170, -48, 340, 96, 32); ctx.fill(); ctx.stroke();
      L.arrow(ctx, -118, -26, -118, 28, P.ink, 10); text(ctx, 'Drop them', 24, 4, { size: 50, weight: 700 }); ctx.restore();
    }
    if (!s.moved) { text(ctx, 'drag me', s.mx, s.my - 320 + Math.sin(t * 3) * 6, { size: 64, weight: 700, stroke: P.white }); L.arrow(ctx, s.mx + 190, s.my - 90 + Math.sin(t * 3) * 6, s.mx + 330, s.my + 70 + Math.sin(t * 3) * 6, P.sun, 14); }
  }

  // ---------- Try it 2, "Push or pull": two bar magnets; drag the right one close, tap it to turn it round ----------
  // Blue facing red: within PP.PULL it snaps on with a click. Red facing red: it is pushed back, never closer than PP.GAP.
  const PP = { LX: 640, BY: 655, BS: 1.25, HW: 212.5, PULL: 360, GAP: 340, MAXX: 1670 }; PP.TOUCH = PP.LX + 2 * PP.HW; PP.REST = PP.TOUCH + PP.GAP;
  function ppInit(s) {
    s.x = 1560; s.tx = 1560; s.fl = 0; s.fa = 0; s.snap = false; s.sn = 0; s.sx = 1560; s.noPull = false; s.pushing = false;
    s.drag = false; s.dx = 0; s.fx = 0; s.x0 = 0; s.y0 = 0; s.tapOK = false; s.flipReq = false; s.moved = false; s.taps = 0;
    s.clock = 0; s.cueAt = {}; s.bt = 9; s.bk = 0; s.wob = 0; s.pa = 0; s.qa = 0; s.mood = 'happy'; s.moodT = 0; s.lbl = 'Push or pull?'; s.lt = 9;
  }
  function ppUpdate(s, dt, cue) {
    s.clock += dt; s.bt += dt; s.lt += dt; s.wob = Math.max(0, s.wob - dt * 1.3); s.moodT = Math.max(0, s.moodT - dt);
    const say = id => { if (s.clock - (s.cueAt[id] == null ? -99 : s.cueAt[id]) >= 3) { s.cueAt[id] = s.clock; cue(id); } };
    const snd = (f, d, o) => { if (LSC.sound) LSC.sound.tone(f, d, o); };
    const clickOn = () => { s.bt = 0; s.bk = 0; s.mood = 'wow'; s.moodT = 2.5; snd(1500, 0.05, { type: 'square', vol: 0.1 }); if (LSC.sound) LSC.sound.noise(0.05, 0.22, { hp: 2500 }); say('pull'); };
    const pushOff = () => { s.bt = 0; s.bk = 1; s.wob = 1; s.mood = 'wow'; s.moodT = 2.5; snd(260, 0.4, { type: 'sawtooth', vol: 0.09, glide: 110 }); say('push'); };
    s.fa += clamp(s.fl - s.fa, -dt / 0.45, dt / 0.45); // the picture of the magnet turns round over about half a second
    if (s.flipReq) { // a tap turns the magnet round
      s.flipReq = false; s.fl = 1 - s.fl; s.taps++; snd(s.fl ? 420 : 560, 0.1, { type: 'triangle', vol: 0.16 });
      if (s.fl === 1 && s.x < PP.REST + 8) { s.snap = false; s.sn = 0; pushOff(); }
    }
    if (s.fl === 0) { // blue faces red: they pull together
      s.pushing = false;
      if (s.snap) {
        if (s.sn < 1) {
          s.sn = Math.min(1, s.sn + dt / 0.2); s.x = lerp(s.sx, PP.TOUCH, E.in(s.sn));
          if (s.sn >= 1) { s.x = PP.TOUCH; if (s.drag) { s.dx = PP.TOUCH - s.fx; s.tx = PP.TOUCH; } clickOn(); }
        } else if (s.drag && s.tx - PP.TOUCH > 260) { s.snap = false; s.noPull = true; snd(700, 0.06, { type: 'triangle', vol: 0.14 }); } // pulled free by hand
        else s.x = s.drag ? PP.TOUCH + (s.tx - PP.TOUCH) * 0.2 : PP.TOUCH; // a little stretch while you tug
      }
      if (!s.snap) {
        if (s.drag) s.x += (s.tx - s.x) * Math.min(1, dt * 22);
        if (s.noPull && (!s.drag || s.x - PP.TOUCH > PP.PULL + 40)) s.noPull = false;
        if (!s.noPull && s.x - PP.TOUCH < PP.PULL) { s.snap = true; s.sn = 0; s.sx = s.x; }
      }
    } else { // red faces red: they push apart and cannot be brought closer than PP.GAP
      s.snap = false; s.sn = 0; s.noPull = false;
      s.x += (Math.max(s.drag ? s.tx : s.x, PP.REST) - s.x) * Math.min(1, dt * (s.drag ? 22 : 9));
      if (s.drag && s.tx < PP.REST - 20) { if (!s.pushing) { s.pushing = true; pushOff(); } s.wob = Math.max(s.wob, 0.5); } else if (!s.drag || s.tx > PP.REST + 60) s.pushing = false;
    }
    s.x = clamp(s.x, PP.TOUCH, PP.MAXX);
    const held = s.snap && s.sn >= 1, apart = s.fl === 1 && (s.pushing || s.x < PP.REST - 4);
    s.pa += ((held ? 1 : 0) - s.pa) * Math.min(1, dt * 10); s.qa += ((apart ? 1 : 0) - s.qa) * Math.min(1, dt * 10);
    const lbl = held ? 'red + blue = pull!' : s.fl === 1 && (s.pushing || s.x < PP.REST + 30) ? 'red + red = push!' : 'Push or pull?';
    if (lbl !== s.lbl) { s.lbl = lbl; s.lt = 0; }
  }
  function ppPointer(s, type, x, y) {
    if (type === 'down') {
      s.drag = true; s.moved = true; s.x0 = x; s.y0 = y; s.fx = x;
      const on = Math.abs(x - s.x) < PP.HW + 90 && Math.abs(y - PP.BY) < 230; // on the magnet: grab it where it is (a tap turns it); elsewhere: it comes to the finger
      s.tapOK = on; s.dx = on ? s.x - x : 0; s.tx = clamp(x + s.dx, PP.TOUCH, PP.MAXX);
    } else if (type === 'move' && s.drag) {
      s.fx = x; if (Math.hypot(x - s.x0, y - s.y0) > 60) s.tapOK = false; s.tx = clamp(x + s.dx, PP.TOUCH, PP.MAXX); // a child's tap wobbles: up to 60 units is still a tap
    } else if (type === 'up' && s.drag) { s.drag = false; if (s.tapOK) s.flipReq = true; s.tapOK = false; }
  }
  function ppDraw(ctx, s, t) {
    lab(ctx); table(ctx, 360, 1880, TOP, 100);
    const { LX, BY, BS, HW } = PP, bx = s.x + Math.sin(t * 46) * 6 * s.wob, hop = 90 * Math.sin(Math.PI * clamp(s.fa, 0, 1));
    L.pip(ctx, { x: 170, y: 860, s: 1.0, t, mood: s.moodT > 0 ? s.mood : 'happy', armR: -0.5, armL: 0.6, lookX: 0.8 });
    bar(ctx, LX, BY, BS, 0, P.blue, P.red);
    flipBar(ctx, bx, BY - hop, BS, s.fa, P.blue, P.red);
    if (s.pa > 0.02) { ctx.save(); ctx.globalAlpha = s.pa; L.arrow(ctx, LX - 60, BY - 118, LX + HW - 10, BY - 118, P.blueDeep, 16); L.arrow(ctx, bx + 60, BY - 118, bx - HW + 10, BY - 118, P.blueDeep, 16); ctx.restore(); }
    pushArrows(ctx, (LX + HW + bx - HW) / 2, BY - 118, 120, s.qa * (0.65 + 0.35 * Math.abs(Math.sin(t * 6))));
    burst(ctx, LX + HW, BY, 90, seg(s.bt, 0, 0.45), s.bk ? P.red : P.sunDeep);
    if (s.bk === 0 && s.bt < 1.2) L.sparkles(ctx, LX + HW, BY + 10, t, 5, 6, 120);
    L.sticker(ctx, s.lbl, 1100, 190, clamp(s.lt / 0.3, 0, 1), { bg: s.lbl.indexOf('pull!') > 0 ? P.blue : s.lbl.indexOf('push!') > 0 ? P.red : P.sun, color: s.lbl.indexOf('?') > 0 ? P.ink : P.white, size: 80, rot: -0.03 });
    const lx = Math.min(bx, 1640);
    if (!s.moved) { text(ctx, 'drag me', lx, BY - 195 + Math.sin(t * 3) * 6, { size: 64, weight: 700, stroke: P.white }); L.arrow(ctx, bx - 120, BY - 100, bx - 330, BY - 100, P.sun, 14); }
    else if (!s.taps) text(ctx, 'tap me to turn around', lx, BY - 195, { size: 46, weight: 700, stroke: P.white });
  }

  L.episodes.ep7 = {
    id: 'ep7', num: 7, title: 'Why do magnets stick?', short: 'Magnets', phrase: 'Magnets pull iron!',
    props: { ironCluster, noSign, labStage, onTable, zipClip, flipBar, noEye, horseshoe, horseshoeAt, hangClip, hangNail, tick, cross, burst, fridgeWithDrawing, bar, clip, nail, cap, pencil, leaf, block, eraser, foil, item, kitchen, lab, fridge, woodDoor, drawing, table, handMagnet, pullLines, pushArrows },
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie (Curie stands at x 560, y 760 unless pip is set)
    thumb: {
      big: 'MAGNETS', small1: 'Why do', small2: 'stick?', bg: (ctx, t) => {
        L.sky(ctx); L.sun(ctx, 1770, 170, 95, t); L.ground(ctx, 820);
        horseshoe(ctx, 1330, 610, 2.3, 0); hangClip(ctx, 1330 - 53 * 2.3, 610, 1.9, 0.05); hangNail(ctx, 1330 + 53 * 2.3, 610, 1.5, -0.04);
        cap(ctx, 960, 700, 1.3); L.arrow(ctx, 1030, 690, 1130, 650, P.sun, 14);
      }
    },
    // text = the caption on screen (and the site); say = what Curie speaks, with direction tags (docs/PIPELINE.md, "Narration markup")
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why do magnets stick?", say: "Today's big question... Why do magnets *stick*?", hold: 0.6 },
      { id: 'fridge', text: "Look! Curie made a drawing. She puts it on the fridge with a magnet. Click! It sticks!", say: "{sfx:pop}Look! Curie made a drawing. She puts it on the fridge... with a *magnet*. *Click*! It *sticks*!", hold: 0.6 },
      { id: 'door', text: "Now Curie tries the magnet on the wooden door. It does not stick! It falls off. Plop!", say: "Now Curie tries the magnet on the wooden *door*... It does *not* stick! It falls *off*, {lo}plop!{/lo}", hold: 0.8 },
      { id: 'why', text: "Why does a magnet stick to some things, but not to others? Let's find out!", say: "{sfx:bubble}*Why* does a magnet stick to some things... but *not* to others? {sfx:ding}Let's find *out*!", hold: 0.8 },
      { id: 'clip', text: "Scientists test it! Here is a paper clip. Zip! The magnet pulls it.", say: "Scientists *test* it! Here is a paper clip... {pause 0}*Zip*! The magnet *pulls* it.", hold: 0.5 },
      { id: 'nothing', text: "A pencil... nothing. A leaf... nothing. A plastic block... nothing.", say: "A *pencil*... nothing. A *leaf*... nothing. A plastic *block*... nothing.", hold: 0.6 },
      { id: 'iron', text: "The paper clip has iron in it! Magnets pull things with iron in them.", say: "The paper clip has... {sfx:ding}*iron* in it! Magnets *pull* things with iron in them.", hold: 0.9 },
      { id: 'foil', text: "Kitchen foil is shiny metal too... but the magnet does not pull it! Magnets pull iron, not every metal.", say: "{sfx:sparkle}Kitchen foil is shiny *metal* too... but the magnet does *not* pull it! Magnets pull *iron*... not every metal.", hold: 0.9 },
      { id: 'gap', text: "A magnet can pull a paper clip without even touching it! The pull is invisible. We cannot see it!", say: "A magnet can pull a paper clip... without even *touching* it! The pull is *invisible*. {w}We cannot see it!{/w}", hold: 0.8 },
      { id: 'ends', text: "Every magnet has two ends. A red end, and a blue end.", say: "Every magnet has *two* ends. A *red* end... and a *blue* end.", hold: 0.5 },
      { id: 'pull', text: "Watch! A red end and a blue end come close... Click! They pull together.", say: "Watch! A red end and a blue end come close... {pause 0}*Click*! They *pull* together.", hold: 0.5 },
      { id: 'push', text: "Now turn one around. Red and red... they push apart! The same ends push each other away.", say: "Now turn one *around*. Red and *red*... {sfx:boing}they push *apart*! The same ends push each other away.", hold: 0.9 },
      { id: 'home', text: "Now we know why! The fridge door has iron in it, so the magnet sticks. Wood has no iron in it, so the magnet falls off.", say: "{sfx:ding}Now we *know* why! The fridge door has *iron* in it... so the magnet *sticks*. *Wood* has *no* iron in it... so the magnet falls *off*.", hold: 0.8 },
      { id: 'sayit', text: 'Say it with me: magnets pull iron!', say: 'Say it with me... {sfx:ding}*Magnets* pull *iron*! {pause 0.9} {slow}Magnets... pull... iron!{/slow}', hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a fridge magnet. Find a paper clip, a pencil, a leaf, and some foil.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for a *fridge magnet*. Find a paper clip, a pencil, a leaf... and some *foil*.", hold: 0.4 },
      { id: 'try2', text: "Guess first: will it stick? Then test it. Keep magnets out of your mouth! Which things does the magnet pull?", say: "Guess *first*... will it *stick*? Then *test* it. Keep magnets *out* of your mouth! {sfx:ding}Which things does the magnet *pull*?", hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: magnets pull things with iron in them. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... magnets *pull* things with *iron* in them. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    // extra sound effects not written into `say` as {sfx:name}: anchored to a line (+offset s) or to a chunk ('chunk': words)
    sfx: [
      { line: 'fridge', chunk: 'click', offset: LAG.fridge, name: 'snap' }, { line: 'door', chunk: 'plop', offset: LAG.door, name: 'plop' }, { line: 'clip', chunk: 'zip', offset: LAG.zip, name: 'snap' }, { line: 'pull', chunk: 'click', offset: LAG.pull, name: 'snap' },
      { line: 'fridge', chunk: 'on the fridge', offset: 0.15, name: 'whoosh', vol: 0.45 }, { line: 'fridge', chunk: 'with a magnet', offset: 0, name: 'clink', vol: 0.7 }, { line: 'fridge', chunk: 'it sticks', offset: 0.05, name: 'sparkle' },
      { line: 'door', chunk: 'wooden door', offset: 0.15, name: 'pop' }, { line: 'door', chunk: 'wooden door', offset: 0.35, name: 'whoosh', vol: 0.4 }, { line: 'door', chunk: 'does not stick', offset: 0.35, name: 'scrape', vol: 0.5 }, { line: 'door', chunk: 'falls off', offset: 0.5, name: 'swish', vol: 0.4 },
      { line: 'clip', chunk: 'scientists test it', offset: 0, name: 'whoosh', vol: 0.45 }, { line: 'clip', chunk: 'here is a paper clip', offset: 0.05, name: 'pop' },
      { line: 'nothing', chunk: 'a pencil', offset: 0, name: 'pop' }, { line: 'nothing', chunk: 'a leaf', offset: 0, name: 'pop' }, { line: 'nothing', chunk: 'a plastic block', offset: 0, name: 'pop' },
      { line: 'nothing', chunk: 'a pencil', offset: 1.5, name: 'pluck_low', vol: 0.5 }, { line: 'nothing', chunk: 'a leaf', offset: 1.32, name: 'pluck_low', vol: 0.5 }, { line: 'nothing', chunk: 'a plastic block', offset: 1.8, name: 'pluck_low', vol: 0.5 },
      { line: 'iron', chunk: 'the paper clip has', offset: 0, name: 'pop' }, { line: 'iron', chunk: 'magnets pull', offset: 0, name: 'pop' }, { line: 'iron', chunk: 'magnets pull', offset: 0.15, name: 'whoosh', vol: 0.4 },
      { line: 'iron', chunk: 'magnets pull', offset: 0.9, name: 'snap' }, { line: 'iron', chunk: 'magnets pull', offset: 1.3, name: 'snap' }, { line: 'iron', chunk: 'magnets pull', offset: 1.7, name: 'snap' },
      { line: 'foil', chunk: 'does not pull', offset: 0, name: 'whoosh', vol: 0.4 }, { line: 'foil', chunk: 'magnets pull iron', offset: 0, name: 'pop' }, { line: 'foil', chunk: 'magnets pull iron', offset: 1.0, name: 'snap' }, { line: 'foil', chunk: 'magnets pull iron', offset: 1.15, name: 'ding', vol: 0.5 },
      { line: 'gap', chunk: 'a magnet can pull', offset: 0, name: 'whoosh', vol: 0.4 }, { line: 'gap', chunk: 'a magnet can pull', offset: 0.95, name: 'sparkle', vol: 0.7 }, { line: 'gap', chunk: 'without even touching', offset: 0.1, name: 'whoosh', vol: 0.5 }, { line: 'gap', chunk: 'we cannot see it', offset: 0.05, name: 'pop' },
      { line: 'ends', chunk: 'two ends', offset: 0, name: 'pop' }, { line: 'ends', chunk: 'two ends', offset: 0.35, name: 'pop' }, { line: 'ends', chunk: 'a red end', offset: 0, name: 'pop' }, { line: 'ends', chunk: 'and a blue end', offset: 0, name: 'pop' },
      { line: 'push', chunk: 'turn one around', offset: 0.15, name: 'swish', vol: 0.5 }, { line: 'push', chunk: 'the same ends', offset: 1.4, name: 'wiggle', vol: 0.6 },
      { line: 'home', chunk: 'fridge door has iron', offset: 0.05, name: 'pop' }, { line: 'home', chunk: 'fridge door has iron', offset: 1.58, name: 'sparkle', vol: 0.5 }, { line: 'home', chunk: 'so the magnet sticks', offset: 1.1, name: 'snap', vol: 0.6 },
      { line: 'home', chunk: 'wood has no iron', offset: 0.05, name: 'pop' }, { line: 'home', chunk: 'wood has no iron', offset: 1.2, name: 'pluck_low', vol: 0.45 },
      { line: 'home', chunk: 'falls off', offset: 0.2, name: 'pop' }, { line: 'home', chunk: 'falls off', offset: 0.72, name: 'swish', vol: 0.4 }, { line: 'home', chunk: 'falls off', offset: 1.3, name: 'plop', vol: 0.6 },
      { line: 'sayit', offset: 0.1, name: 'whoosh', vol: 0.4 },
      { line: 'try1', offset: 1.55, name: 'pop', vol: 0.7 }, { line: 'try1', chunk: 'ask a grown-up', offset: 1.6, name: 'pop' }, { line: 'try1', chunk: 'find a paper clip', offset: 0.5, name: 'pop' }, { line: 'try1', chunk: 'find a paper clip', offset: 1.1, name: 'pop' }, { line: 'try1', chunk: 'find a paper clip', offset: 1.7, name: 'pop' }, { line: 'try1', chunk: 'and some foil', offset: 0.3, name: 'pop' },
      { line: 'try2', chunk: 'will it stick', offset: 0, name: 'bubble', vol: 0.7 }, { line: 'try2', chunk: 'then test it', offset: 0.75, name: 'snap' }, { line: 'try2', chunk: 'keep magnets out', offset: 0, name: 'thump', vol: 0.5 }
    ],
    // scenes: each starts when its `from` line starts (minus optional lead) and lasts until the next scene; transition 'cut' = no wipe
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      {
        from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => {
          horseshoe(c, 0, 50, 1.15, 0); hangClip(c, -61, 50, 1.15, Math.sin(tt * 2.4) * 0.07);
        }, { word: 'Why?' })
      },
      {
        // Curie sticks her drawing on the fridge with a magnet: it flies to the door, the magnet clicks on with the click sound (just after "Click!")
        from: 'fridge', draw: (ctx, t, Lt) => {
          kitchen(ctx);
          const fx = 1340, fy = 780, fs = 1.2; fridge(ctx, fx, fy, fs);
          const tx = fx + FR.dx * fs, ty = fy + FR.dy * fs, ds = FR.ds * fs;
          const show = Lt.cwin('fridge', 'look', 0.5, E.outBack, 0.3), fly = Lt.cwin('fridge', 'on the fridge', 1.1, E.inOut, 0.1);
          const px = lerp(850, tx, fly), py = lerp(540, ty, fly) - Math.sin(fly * Math.PI) * 90;
          if (show > 0) drawing(ctx, px, py + (fly <= 0 ? Math.sin(t * 3) * 6 : 0), ds * show, fly < 1 ? lerp(-0.1, 0, fly) + Math.sin(t * 7) * 0.03 : 0);
          // the magnet pops up on "magnet", then flies to the top of the drawing and arrives with the click sound
          const mp = Lt.cwin('fridge', 'with a magnet', 0.45, E.outBack), hit = Lt.cwin('fridge', 'click', 0.5, E.in, LAG.fridge - 0.5), after = Lt.cwin('fridge', 'click', 0.3, null, LAG.fridge);
          const mx = tx + (hit <= 0 ? Math.sin(t * 3) * 10 : 0), my = lerp(fy + FR.my * fs - 230, fy + FR.my * fs, hit) + (hit <= 0 ? Math.sin(t * 5) * 7 : 0);
          if (mp > 0) bar(ctx, mx, my, FR.ms * fs * 1.2 * mp * (1 - 0.14 * Math.sin(after * Math.PI)), hit < 1 ? -0.25 * (1 - hit) : 0, P.red, P.blue);
          burst(ctx, tx, fy + FR.my * fs, 90, Lt.cwin('fridge', 'click', 0.5, null, LAG.fridge));
          if (Lt.cafter('fridge', 'it sticks')) L.sparkles(ctx, tx, ty - 40, t, 4, 7, 150);
          L.pip(ctx, { x: 520, y: 690, s: 1.3, t, mood: Lt.cafter('fridge', 'it sticks') ? 'wow' : 'talk', armR: -0.45 - 0.5 * Math.sin(fly * Math.PI), armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'Look!', 860, 230, Lt.cwin('fridge', 'look', 0.45) * (1 - Lt.cwin('fridge', 'made a drawing', 0.15, null, -0.1)), { bg: P.sun, rot: -0.06 });
          L.sticker(ctx, 'magnet', 860, 230, Lt.cwin('fridge', 'with a magnet', 0.45) * (1 - Lt.cwin('fridge', 'click', 0.15, null, -0.1)), { bg: P.blue, color: P.white, rot: 0.05 });
          L.sticker(ctx, 'Click!', 860, 230, Lt.cwin('fridge', 'click', 0.4) * (1 - Lt.cwin('fridge', 'it sticks', 0.15, null, -0.1)), { bg: P.sun, rot: 0.05, size: 110 });
          L.sticker(ctx, 'It sticks!', 860, 230, Lt.cwin('fridge', 'it sticks', 0.45), { bg: P.green, color: P.white, rot: -0.05 });
        }
      },
      {
        // the same magnet on the wooden door: it slips and falls, landing with the plop sound (just after "plop!")
        from: 'door', draw: (ctx, t, Lt) => {
          kitchen(ctx);
          const dx = 1340; woodDoor(ctx, dx, 780, 1.1);
          const go = Lt.cwin('door', 'wooden door', 1.5, E.inOut, 0.2), slip = Lt.cwin('door', 'does not stick', 1.7, E.in, 0.2);
          const f0 = Lt.chunk('door', 'falls off') + 0.3, f1 = Lt.chunk('door', 'plop') + LAG.door, fall = seg(t, f0, f1, E.in), landed = Math.max(0, t - f1);
          let mx, my, rot;
          if (fall <= 0) { mx = lerp(780, 1262, go); my = lerp(520, 470, go) + 38 * slip; rot = lerp(-0.2, 0, go) + 0.12 * slip; }
          else { mx = lerp(1262, 1210, fall); my = lerp(508, 756, fall); rot = lerp(0.12, Math.PI + 0.1, fall); }
          if (fall >= 1) { my = 756 - Math.abs(Math.sin(landed * 9)) * 46 * Math.exp(-landed * 4.5); rot = Math.PI + 0.1 - 0.05 * Math.min(1, landed * 3); }
          const pop = Lt.cwin('door', 'wooden door', 0.35, E.outBack, 0.15); if (pop > 0) bar(ctx, mx, my, 0.6 * pop, rot, P.red, P.blue);
          burst(ctx, 1210, 770, 70, Lt.cwin('door', 'plop', 0.5, null, LAG.door), P.greyDark);
          L.pip(ctx, { x: 520, y: 690, s: 1.3, t, mood: Lt.cafter('door', 'does not stick') ? 'think' : 'talk', armR: -0.45, armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'No stick!', 860, 230, Lt.cwin('door', 'does not stick', 0.45) * (1 - Lt.cwin('door', 'plop', 0.15, null, -0.1)), { bg: P.red, color: P.white, rot: -0.05 });
          L.sticker(ctx, 'plop!', 860, 230, Lt.cwin('door', 'plop', 0.45), { bg: P.pink, rot: 0.06, size: 104 });
        }
      },
      {
        // the question, with both pictures side by side: sticks to the fridge, falls off the door
        from: 'why', draw: (ctx, t, Lt) => {
          kitchen(ctx);
          fridgeWithDrawing(ctx, 400, 780, 0.95); woodDoor(ctx, 1520, 780, 0.85); bar(ctx, 1380, 756, 0.6, Math.PI + 0.05, P.red, P.blue);
          const idea = Lt.cwin('why', "let's find out", 0.6);
          L.pip(ctx, { x: 960, y: 690, s: 1.25, t, mood: idea > 0 ? 'wow' : 'think', armR: idea > 0 ? -1.2 : -0.9, armL: 0.6, lookX: -0.4, lookY: -0.5, bulb: idea });
          L.sticker(ctx, 'sticks!', 400, 130, Lt.cwin('why', 'why does', 0.5, null, 1.0), { bg: P.green, color: P.white, size: 80, rot: -0.06 });
          L.sticker(ctx, 'falls off', 1520, 130, Lt.cwin('why', 'but not', 0.5), { bg: P.red, color: P.white, size: 80, rot: 0.06 });
          if (idea <= 0) L.questionMark(ctx, 1140, 400, 0.9 + 0.08 * Math.sin(t * 3), t); else L.sparkles(ctx, 960, 480, t, 6, 7, 260);
        }
      },
      {
        // the test table: a hand with the magnet; the paper clip zips up while Curie says "Zip!" and arrives with the sound, then the magnet visits things that do not jump
        from: 'clip', draw: (ctx, t, Lt) => {
          labStage(ctx);
          const SM = 1.3, TIP = 330, CX = 700; // magnet scale, height of its tips, where the clip lies (it hangs under the left tip)
          const enter = Lt.cwin('clip', 'scientists test it', 0.9, E.outBack);
          const g1 = Lt.cwin('nothing', 'a pencil', 0.7, E.inOut, 0.05), g2 = Lt.cwin('nothing', 'a leaf', 0.7, E.inOut, 0.05), g3 = Lt.cwin('nothing', 'a plastic block', 0.7, E.inOut, 0.05);
          const mx = CX + 53 * SM + 291 * g1 + 320 * g2 + 320 * g3, my = lerp(-300, TIP, enter);
          const moving = Math.sin(Math.PI * g1) + Math.sin(Math.PI * g2) + Math.sin(Math.PI * g3);
          // the three things that do not jump
          [['pencil', 1060, 'a pencil', 0.85], ['leaf', 1380, 'a leaf', 0.85], ['block', 1700, 'a plastic block', 1.2]].forEach(([k, x, n, off], i) => {
            const ap = Lt.cwin('nothing', n, 0.35, E.outBack); if (ap > 0) onTable(ctx, k, x, ap, 0, t);
            L.sticker(ctx, 'nothing', x, 778, Lt.cwin('nothing', n, 0.45, null, off), { bg: P.greyDark, color: P.white, size: 52, rot: i % 2 ? 0.05 : -0.05 });
          });
          // the paper clip: pops in, trembles, zips up to the left tip (arriving with the zip sound), then hangs and sways
          const zipT = Lt.chunk('clip', 'zip') + LAG.zip, cp = Lt.cwin('clip', 'here is a paper clip', 0.35, E.outBack);
          zipClip(ctx, t, CX, cp, zipT, mx - 53 * SM, my, Math.sin((t - zipT) * 10) * 0.12 * Math.exp(-(t - zipT) * 3) + 0.14 * moving);
          handMagnet(ctx, mx, my, SM, 0);
          burst(ctx, mx - 53 * SM, TIP + 40, 90, seg(t, zipT, zipT + 0.45));
          L.pip(ctx, { x: 250, y: 690, s: 1.15, t, mood: Lt.cafter('clip', 'zip') && !Lt.after('nothing') ? 'wow' : Lt.after('nothing') ? 'think' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'Scientists test it!', 1350, 200, Lt.cwin('clip', 'scientists test it', 0.45) * (1 - Lt.cwin('clip', 'here is', 0.15, null, -0.1)), { bg: P.blue, color: P.white, size: 64, rot: 0 });
          L.sticker(ctx, 'Zip!', 1350, 200, Lt.cwin('clip', 'zip', 0.4) * (1 - Lt.cwin('clip', 'the magnet pulls', 0.15, null, -0.1)), { bg: P.sun, size: 110, rot: 0.06 });
          L.sticker(ctx, 'pull!', 1350, 200, Lt.cwin('clip', 'the magnet pulls', 0.45) * (1 - Lt.cwin('nothing', 'a pencil', 0.15, null, -0.1)), { bg: P.blue, color: P.white, size: 100, rot: -0.05 });
        }
      },
      {
        // iron: a magnified paper clip, and a magnet that pulls three iron things
        from: 'iron', draw: (ctx, t, Lt) => {
          lab(ctx);
          const mp = Lt.cwin('iron', 'the paper clip has', 0.5, E.outBack);
          if (mp > 0) {
            ctx.save(); ctx.translate(560, 450); ctx.scale(mp, mp); ctx.translate(-560, -450);
            ctx.save(); ctx.beginPath(); ctx.arc(560, 450, 222, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#F7FBFF'; ctx.fillRect(320, 210, 480, 480); clip(ctx, 560, 456 + Math.sin(t * 2) * 5, 2.3, 0.22); ctx.restore();
            L.magnifier(ctx, 560, 450, 230, 1); ctx.restore();
          }
          L.sparkles(ctx, 560, 450, t, 8, 6, 190 * Lt.cwin('iron', 'iron in it', 0.5));
          L.sticker(ctx, 'IRON', 560, 120, Lt.cwin('iron', 'iron in it', 0.5), { bg: STEEL_LIGHT, size: 112, rot: -0.05 });
          // right: a tray with an iron clip, a steel cap and an iron nail; the magnet comes down and pulls them up one after another
          const tp = Lt.cwin('iron', 'magnets pull', 0.45, E.outBack), SM = 1.4, MX = 1500, TIP = 330, md = Lt.cwin('iron', 'magnets pull', 0.7, E.outBack, 0.1), c0 = Lt.chunk('iron', 'magnets pull');
          if (tp > 0) {
            ctx.save(); ctx.translate(MX, 700); ctx.scale(tp, 1); ctx.translate(-MX, -700); ctx.fillStyle = '#D9B277'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, 1180, 700, 640, 40, 20); ctx.fill(); ctx.stroke(); ctx.restore();
            const hops = [['clip', 1260, MX - 53 * SM, TIP + 78 * 1.5, 1.5, 0.9], ['cap', 1500, MX, TIP + 52, 1.0, 1.3], ['nail', 1740, MX + 53 * SM, TIP + 100 * 1.5, 1.5, 1.7]];
            for (const [k, x0, x1, y1, sc, off] of hops) {
              const h = seg(t, c0 + off - 0.22, c0 + off, E.in), since = t - (c0 + off), sway = h >= 1 ? Math.sin(since * 10) * 0.1 * Math.exp(-since * 3) : 0;
              const rot = k === 'clip' ? lerp(Math.PI / 2 - 0.5, 0, h) : k === 'nail' ? lerp(0, Math.PI / 2, h) : 0;
              ctx.save(); ctx.translate(lerp(x0, x1, h), lerp(700 - REST[k] * sc * tp, y1, h)); ctx.rotate(sway); item(ctx, k, 0, 0, sc * tp, rot, t); ctx.restore();
            }
            handMagnet(ctx, MX, lerp(-300, TIP, md), SM, 0);
            for (const [, , x1, , , off] of hops) burst(ctx, x1, TIP + 30, 70, seg(t, c0 + off, c0 + off + 0.4));
          }
          L.pip(ctx, { x: 985, y: 700, s: 0.95, t, mood: Lt.cafter('iron', 'iron in it') ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.2 });
        }
      },
      {
        // foil: shiny metal, but the magnet does not pull it; it pulls the iron clip
        from: 'foil', draw: (ctx, t, Lt) => {
          labStage(ctx);
          const SM = 1.3, TIP = 330, FX = 1000, CX = 1560;
          const fp = Lt.cwin('foil', 'kitchen foil', 0.5, E.outBack), cp = Lt.cwin('foil', 'magnets pull iron', 0.35, E.outBack);
          const md = Lt.cwin('foil', 'does not pull', 0.8, E.outBack), g = Lt.cwin('foil', 'magnets pull iron', 0.8, E.inOut, 0.1);
          const mx = lerp(FX, CX + 53 * SM, g), my = lerp(-300, TIP, md), zipT = Lt.chunk('foil', 'magnets pull iron') + 1.0;
          if (fp > 0) onTable(ctx, 'foil', FX, 1.1 * fp, 0, t);
          zipClip(ctx, t, CX, cp, zipT, mx - 53 * SM, my, Math.sin((t - zipT) * 10) * 0.12 * Math.exp(-(t - zipT) * 3));
          if (md > 0) handMagnet(ctx, mx, my, SM, 0);
          burst(ctx, CX, TIP + 40, 90, seg(t, zipT, zipT + 0.45));
          tick(ctx, CX + 120, 520, 50, seg(t, zipT + 0.1, zipT + 0.5));
          cross(ctx, FX + 190, 520, 50, Lt.cwin('foil', 'not every metal', 0.4));
          L.pip(ctx, { x: 250, y: 690, s: 1.15, t, mood: Lt.cafter('foil', 'does not pull') ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'shiny metal', 520, 120, Lt.cwin('foil', 'shiny metal', 0.45) * (1 - Lt.cwin('foil', 'does not pull', 0.15, null, -0.1)), { bg: STEEL_LIGHT, size: 76, rot: -0.04 });
          L.sticker(ctx, 'no pull!', 520, 120, Lt.cwin('foil', 'does not pull', 0.45) * (1 - Lt.cwin('foil', 'magnets pull iron', 0.15, null, -0.1)), { bg: P.red, color: P.white, size: 84, rot: 0.05 });
          L.sticker(ctx, 'IRON', 520, 120, Lt.cwin('foil', 'magnets pull iron', 0.45) * (1 - Lt.cwin('foil', 'not every metal', 0.15, null, -0.1)), { bg: P.sun, size: 100, rot: -0.05 });
          L.sticker(ctx, 'not every metal', 520, 120, Lt.cwin('foil', 'not every metal', 0.45), { bg: P.blue, color: P.white, size: 72, rot: 0.04 });
        }
      },
      {
        // invisible pull: the paper clip floats on a thread under the magnet, without touching
        from: 'gap', draw: (ctx, t, Lt) => {
          labStage(ctx);
          const SM = 1.3, TIP = 330, CX = 1100, MX = CX + 53 * SM, GAP = 80;
          const md = Lt.cwin('gap', 'a magnet can pull', 0.9, E.outBack), my = lerp(-300, TIP, md);
          const rise = Lt.cwin('gap', 'a magnet can pull', 0.8, E.out, 0.9), rest = TOP + 80 - REST.clip * IS, up = TIP + 78 * IS + GAP, cy = lerp(rest, up, rise), rot = lerp(Math.PI / 2 - 0.5, 0, rise);
          const fl = Math.sin(t * 2.2) * 3 * rise;
          // a bit of tape on the table, and a thread from it to the clip
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.fillRect(CX - 36, TOP + 56, 72, 22); ctx.strokeRect(CX - 36, TOP + 56, 72, 22);
          ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CX, TOP + 62); ctx.quadraticCurveTo(CX + 16 * (1 - rise), (TOP + 62 + cy + 62 * IS) / 2, CX, cy + fl + 62 * IS); ctx.stroke();
          clip(ctx, CX, cy + fl, IS, rot);
          handMagnet(ctx, MX, my, SM, 0);
          // the gap, a pulsing ring
          const gp = Lt.cwin('gap', 'without even touching', 0.4);
          if (gp > 0) { ctx.save(); ctx.globalAlpha = gp; ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 8; ctx.setLineDash([16, 14]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.ellipse(CX, TIP + GAP / 2 + 20, 66 + 5 * Math.sin(t * 4), 52 + 5 * Math.sin(t * 4), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
          // the invisible pull: faint dotted lines that fade away on "cannot see it"
          pullLines(ctx, CX, TIP + 6, CX, TIP + GAP, t, 0.45 * Lt.cwin('gap', 'the pull is invisible', 0.4) * (1 - Lt.cwin('gap', 'we cannot see it', 0.5)));
          if (Lt.cafter('gap', 'we cannot see it', 0.2)) L.questionMark(ctx, 1360, 470, 0.8 + 0.06 * Math.sin(t * 3), t);
          L.pip(ctx, { x: 250, y: 690, s: 1.15, t, mood: Lt.cafter('gap', 'we cannot see it') ? 'think' : Lt.cafter('gap', 'without even touching') ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'no touching!', 700, 250, Lt.cwin('gap', 'without even touching', 0.45) * (1 - Lt.cwin('gap', 'the pull is invisible', 0.15, null, -0.1)), { bg: P.sun, size: 76, rot: -0.05 });
          L.sticker(ctx, 'invisible!', 700, 250, Lt.cwin('gap', 'the pull is invisible', 0.45) * (1 - Lt.cwin('gap', 'we cannot see it', 0.15, null, -0.1)), { bg: P.purple, color: P.white, size: 80, rot: 0.05 });
          noEye(ctx, 700, 250, 1.3, Lt.cwin('gap', 'we cannot see it', 0.45));
        }
      },
      {
        // every magnet has two ends: a red end and a blue end (a bar magnet and a horseshoe magnet, both with their ends picked out)
        from: 'ends', draw: (ctx, t, Lt) => {
          lab(ctx);
          const BX = 1130, BY = 540, BS = 1.9, HX = 1700, HY = 700, HS = 1.25, bob = Math.sin(t * 2) * 5;
          const bp = Lt.cwin('ends', 'two ends', 0.5, E.outBack), hp = Lt.cwin('ends', 'two ends', 0.5, E.outBack, 0.35);
          const red = Lt.cwin('ends', 'a red end', 1.6), blue = Lt.cwin('ends', 'blue end', 1.6);
          if (bp > 0) bar(ctx, BX, BY + bob, BS * bp, Math.sin(t * 1.5) * 0.02, P.red, P.blue);
          if (hp > 0) horseshoe(ctx, HX, HY + bob, HS * hp, 0);
          // a pulsing outline round the end that Curie is talking about
          const glow = (p, x, y, w, h) => { if (p <= 0 || p >= 1) return; ctx.save(); ctx.globalAlpha = Math.min(1, Math.sin(Math.PI * p) * 2); ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 10; ctx.setLineDash([20, 14]); ctx.lineDashOffset = -t * 40; roundRect(ctx, x - w / 2 - 14, y - h / 2 - 14, w + 28, h + 28, 40); ctx.stroke(); ctx.restore(); };
          glow(red, BX - BS * 85, BY + bob, BS * 170, BS * 100); glow(red, HX - 53 * HS, HY - 120 * HS + bob, 46 * HS + 20, 200 * HS);
          glow(blue, BX + BS * 85, BY + bob, BS * 170, BS * 100); glow(blue, HX + 53 * HS, HY - 120 * HS + bob, 46 * HS + 20, 200 * HS);
          L.pip(ctx, { x: 250, y: 690, s: 1.15, t, mood: 'talk', armR: -0.5, armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'two ends', 1130, 190, Lt.cwin('ends', 'two ends', 0.45) * (1 - Lt.cwin('ends', 'a red end', 0.15, null, -0.1)), { bg: P.sun, size: 84, rot: -0.04 });
          L.sticker(ctx, 'red end', 960, 330, Lt.cwin('ends', 'a red end', 0.45), { bg: P.red, color: P.white, size: 56, rot: -0.05 });
          L.sticker(ctx, 'blue end', 1300, 330, Lt.cwin('ends', 'blue end', 0.45), { bg: P.blue, color: P.white, size: 56, rot: 0.05 });
        }
      },
      {
        // two bar magnets: red and blue pull together (click), turned round red and red push apart
        from: 'pull', draw: (ctx, t, Lt) => {
          labStage(ctx);
          const LX = 720, BY = 665, BS = 1.1, HW = 187, TOUCH = LX + 2 * HW;
          const tA = Lt.chunk('pull', 'come close'), tC = Lt.chunk('pull', 'click') + LAG.pull, tT = Lt.chunk('push', 'turn one around'), tR = Lt.chunk('push', 'red and red'), tP = Lt.chunk('push', 'they push apart'), tS = Lt.chunk('push', 'the same ends'), tP2 = tS + 1.4;
          // where the right-hand magnet is: it comes close, snaps on, is turned round, comes close again and is pushed back (twice)
          let x = lerp(1620, 1280, seg(t, tA, tA + 2.4, E.inOut)), y = BY;
          if (t > tC - 0.55 && t < tC - 0.15) x += Math.sin(t * 60) * 3;
          if (t >= tC - 0.15) x = lerp(1280, TOUCH, seg(t, tC - 0.15, tC, E.in));
          if (t >= tC) y -= 7 * Math.max(0, Math.sin((t - tC) * 22)) * Math.exp(-(t - tC) * 9);
          const turn = seg(t, tT + 0.1, tT + 1.2, E.inOut);
          if (t >= tT + 0.1) { x = lerp(TOUCH, 1300, turn); y = BY - 80 * Math.sin(Math.PI * turn); }
          if (t >= tR) x = lerp(1300, 1195, seg(t, tR, tR + 0.9, E.inOut));
          const away = (t0, from, to) => { const k = t - t0, p = seg(t, t0, t0 + 0.4, E.out); return lerp(from, to, p) + Math.sin(k * 20) * 9 * Math.exp(-k * 4) * (k > 0 ? 1 : 0); };
          if (t >= tP) x = away(tP, 1195, 1480);
          if (t >= tS + 0.1) x = lerp(1480, 1210, seg(t, tS + 0.1, tS + 1.3, E.inOut));
          if (t >= tP2) x = away(tP2, 1210, 1480);
          bar(ctx, LX, BY, BS, 0, P.blue, P.red);
          flipBar(ctx, x, y, BS, turn, P.blue, P.red);
          // pull arrows (blue) while they hold together, push arrows (red) while they push apart, and a burst on the click
          const pa = seg(t, tC + 0.25, tC + 0.6) * (1 - seg(t, tT, tT + 0.25));
          if (pa > 0) { ctx.save(); ctx.globalAlpha = pa; L.arrow(ctx, LX - 60, BY - 105, LX + HW - 10, BY - 105, P.blueDeep, 16); L.arrow(ctx, x + 60, BY - 105, x - HW + 10, BY - 105, P.blueDeep, 16); ctx.restore(); }
          const mid = (LX + HW + x - HW) / 2, pushA = seg(t, tP, tP + 0.3);
          pushArrows(ctx, mid, BY - 105, 120, pushA * (0.55 + 0.45 * Math.abs(Math.sin((t - tP) * 5))));
          burst(ctx, LX + HW, BY, 90, seg(t, tC, tC + 0.45));
          burst(ctx, LX + HW + 20, BY, 90, seg(t, tP, tP + 0.45), P.red); burst(ctx, LX + HW + 20, BY, 90, seg(t, tP2, tP2 + 0.45), P.red);
          const mood = Lt.cafter('push', 'they push apart') ? 'wow' : Lt.cafter('push', 'turn one around') ? 'think' : Lt.cafter('pull', 'click') ? 'wow' : 'talk';
          L.pip(ctx, { x: 250, y: 690, s: 1.15, t, mood, armR: -0.5, armL: 0.6, lookX: 0.8 });
          const SX = 1100, SY = 200, ho = (id, n) => 1 - Lt.cwin(id, n, 0.15, null, -0.1);
          L.sticker(ctx, 'Watch!', SX, SY, Lt.cwin('pull', 'watch', 0.45) * ho('pull', 'come close'), { bg: P.blue, color: P.white, size: 84, rot: -0.04 });
          L.sticker(ctx, 'Click!', SX, SY, Lt.cwin('pull', 'click', 0.4) * ho('pull', 'they pull together'), { bg: P.sun, size: 112, rot: 0.05 });
          L.sticker(ctx, 'pull!', SX, SY, Lt.cwin('pull', 'they pull together', 0.45) * ho('push', 'turn one around'), { bg: P.blue, color: P.white, size: 104, rot: -0.05 });
          L.sticker(ctx, 'Turn!', SX, SY, Lt.cwin('push', 'turn one around', 0.45) * ho('push', 'they push apart'), { bg: P.pink, size: 96, rot: 0.05 });
          L.sticker(ctx, 'push!', SX, SY, Lt.cwin('push', 'they push apart', 0.45), { bg: P.red, color: P.white, size: 112, rot: -0.05 });
        }
      },
      {
        // back in the kitchen, now we know why: the fridge door has iron in it (the magnet sticks), wood has none (the magnet falls off the door again)
        from: 'home', draw: (ctx, t, Lt) => {
          kitchen(ctx);
          const fx = 400, fs = 0.95, wx = 1520, ws = 0.85, FY = 780;
          const idea = Lt.cwin('home', 'now we know', 0.6), pf = Lt.cwin('home', 'fridge door has iron', 0.45, E.out), pd = Lt.cwin('home', 'wood has no iron', 0.45, E.out);
          fridge(ctx, fx, FY, fs); drawing(ctx, fx + FR.dx * fs, FY + FR.dy * fs, FR.ds * fs, 0); woodDoor(ctx, wx, FY, ws);
          // a dashed outline round the fridge door while it is the one with iron in it
          const g = Lt.cwin('home', 'fridge door has iron', 0.5) * (1 - Lt.cwin('home', 'wood has no iron', 0.3, null, -0.2));
          if (g > 0) { ctx.save(); ctx.globalAlpha = g; ctx.strokeStyle = P.blueDeep; ctx.lineWidth = 10; ctx.setLineDash([20, 14]); ctx.lineDashOffset = -t * 40; roundRect(ctx, fx - 175 * fs - 9, FY - 600 * fs - 9, 350 * fs + 18, 590 * fs + 18, 36); ctx.stroke(); ctx.restore(); }
          // the fridge magnet clicks on again at "sticks"
          const mx0 = fx + FR.dx * fs, my0 = FY + FR.my * fs, st = Lt.cwin('home', 'so the magnet sticks', 0.5, null, 1.05);
          bar(ctx, mx0, my0, FR.ms * fs * (1 + 0.18 * Math.sin(Math.PI * st)), 0, P.red, P.blue);
          burst(ctx, mx0, my0, 80, st);
          if (Lt.cafter('home', 'so the magnet sticks', 1.1) && !Lt.cafter('home', 'wood has no iron')) L.sparkles(ctx, mx0, my0 - 60, t, 4, 7, 130);
          // the magnet on the wooden door: it appears on the door as Curie says "the magnet" (nothing flies up to it), slips a little on "falls", drops in the pause before "off" and lands just after it
          const a0 = Lt.chunk('home', 'falls off') + 0.2, f0 = Lt.chunk('home', 'falls off') + 0.72, f1 = f0 + 0.58;
          const pop = Lt.cwin('home', 'falls off', 0.35, E.outBack, 0.2), slide = seg(t, a0 + 0.1, f0, E.in), fall = seg(t, f0, f1, E.in), landed = Math.max(0, t - f1);
          let mx, my, rot;
          if (fall <= 0) { mx = 1490 - 10 * slide; my = 470 + 45 * slide; rot = 0.16 * slide; }
          else { mx = lerp(1480, 1380, fall); my = lerp(515, 756, fall); rot = lerp(0.16, Math.PI + 0.05, fall); }
          if (fall >= 1) { my = 756 - Math.abs(Math.sin(landed * 9)) * 40 * Math.exp(-landed * 4.5); rot = Math.PI + 0.05; }
          if (pop > 0) bar(ctx, mx, my, FR.ms * fs * pop, rot, P.red, P.blue); // the same size as the fridge magnet
          burst(ctx, 1380, 770, 64, seg(t, f1, f1 + 0.5), P.greyDark);
          // the badges: a tick on the fridge, a cross on the door
          tick(ctx, 320, 312, 46, Lt.cwin('home', 'fridge door has iron', 0.4, null, 1.58));
          cross(ctx, 1376, 268, 46, Lt.cwin('home', 'wood has no iron', 0.4, null, 1.2));
          // Curie: the idea, then she looks and points at the fridge, then at the door
          const armR = lerp(lerp(-1.2, 0.6, pf), -0.25, pd), armL = lerp(lerp(0.6, -0.25, pf), 0.6, pd), lookX = lerp(lerp(0, -0.8, pf), 0.8, pd);
          L.pip(ctx, { x: 960, y: 690, s: 1.25, t, mood: Lt.cafter('home', 'fridge door has iron') ? 'talk' : 'wow', armR, armL, lookX, bulb: idea });
          const ho = n => 1 - Lt.cwin('home', n, 0.15, null, -0.1);
          L.sticker(ctx, 'Now we know!', 960, 170, Lt.cwin('home', 'now we know', 0.45) * ho('fridge door has iron'), { bg: P.sun, size: 84, rot: -0.04 });
          L.sticker(ctx, 'has iron!', fx, 130, Lt.cwin('home', 'fridge door has iron', 0.45) * ho('so the magnet sticks'), { bg: STEEL_LIGHT, size: 80, rot: -0.05 });
          L.sticker(ctx, 'sticks!', fx, 130, Lt.cwin('home', 'so the magnet sticks', 0.45), { bg: P.green, color: P.white, size: 80, rot: 0.05 });
          L.sticker(ctx, 'no iron!', wx, 130, Lt.cwin('home', 'wood has no iron', 0.45) * ho('falls off'), { bg: P.red, color: P.white, size: 80, rot: 0.06 });
          L.sticker(ctx, 'falls off', wx, 130, Lt.cwin('home', 'falls off', 0.45), { bg: P.pink, size: 80, rot: -0.05 });
        }
      },
      {
        // say it with me: the magnet and the three iron things it pulls
        from: 'sayit', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: false, tree: false, sun: false });
          L.pip(ctx, { x: 620, y: 740, s: 1.35, t, mood: 'talk', armR: Lt.cafter('sayit', 'magnets pull iron') ? -1.3 : -0.35, armL: 0.6 });
          const SM = 1.2, MX = 1600, TIP = 520, ty = lerp(-300, TIP, Lt.win('sayit', 0.1, 0.8, E.outBack));
          ironCluster(ctx, MX, ty, SM, t); handMagnet(ctx, MX, ty, SM, 0);
          L.sayItSticker(ctx, 'Magnets pull iron!', Lt.cwin('sayit', 'magnets pull iron', 0.8), t);
        }
      },
      {
        // at home: a grown-up, a fridge magnet and four things to test
        from: 'try1', draw: (ctx, t, Lt) => {
          kitchen(ctx); table(ctx, 700, 1880, TOP, 100);
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.5, 0.6));
          const S2 = 1.15, X = { mag: 860, clip: 1060, pencil: 1290, leaf: 1520, foil: 1750 };
          const pop = (id, needle, off) => Lt.cwin(id, needle, 0.4, E.outBack, off);
          const pm = pop('try1', 'ask a grown-up', 1.6), pc = pop('try1', 'find a paper clip', 0.5), pp = pop('try1', 'find a paper clip', 1.1), pl = pop('try1', 'find a paper clip', 1.7), pf = pop('try1', 'and some foil', 0.3);
          // the test: a fridge magnet only pulls what it touches. It lifts a little, slides low along the table to the paper clip (touching its raised end),
          // the clip hops up onto it, and the magnet carries it away above the others, which stay where they are
          const tT = Lt.chunk('try2', 'then test it'), tK = tT + 0.5, tJ = tT + 0.75;
          const lift = seg(t, tT, tT + 0.25, E.out), appr = seg(t, tT + 0.05, tK, E.inOut), rise = seg(t, tK, tK + 0.55, E.inOut), sw = seg(t, tJ, tJ + 0.7, E.inOut);
          const mx = lerp(lerp(X.mag, X.clip + 70, appr), 1640, sw), my = lerp(lerp(TOP + 80 - 35, 555, lift), 370, rise);
          // things on the table
          if (pp > 0) onTable(ctx, 'pencil', X.pencil, pp, 0, t, S2); if (pl > 0) onTable(ctx, 'leaf', X.leaf, pl, 0, t, S2); if (pf > 0) onTable(ctx, 'foil', X.foil, pf * 0.9, 0, t, S2);
          if (pc > 0) {
            const zp = seg(t, tK, tJ, E.in), hx = mx - 70, hy = my + 35, trem = seg(t, tT + 0.3, tT + 0.4) * (1 - zp);
            if (zp >= 1) hangClip(ctx, hx, hy, S2, Math.sin((t - tJ) * 10) * 0.1 * Math.exp(-(t - tJ) * 3) + 0.12 * Math.sin(Math.PI * sw));
            else item(ctx, 'clip', lerp(X.clip, hx, zp) + Math.sin(t * 70) * 3 * trem, lerp(TOP + 80 - REST.clip * S2 * pc, hy + 78 * S2, zp) - 16 * Math.sin(Math.PI * zp), S2 * pc, lerp(Math.PI / 2 - 0.5, 0, zp) + Math.sin(t * 61) * 0.05 * trem, t);
          }
          if (pm > 0) bar(ctx, mx, my, 0.7 * pm, 0, P.red, P.blue);
          burst(ctx, mx - 70, my + 40, 70, seg(t, tJ, tJ + 0.45));
          // question marks while we guess, then the never-in-your-mouth sign, then the question again
          const tg = Lt.chunk('try2', 'will it stick');
          [X.clip, X.pencil, X.leaf, X.foil].forEach((x, i) => { const q = seg(t, tg + i * 0.12, tg + i * 0.12 + 0.4) * (1 - seg(t, tT, tT + 0.2)); if (q > 0) { ctx.save(); ctx.translate(x, 500); ctx.scale(q * 0.5, q * 0.5); L.questionMark(ctx, 0, 0, 1, t + i); ctx.restore(); } });
          noSign(ctx, 960, 350, 128, Lt.cwin('try2', 'keep magnets out', 0.5) * (1 - seg(t, Lt.chunk('try2', 'which things'), Lt.chunk('try2', 'which things') + 0.25)));
          L.pip(ctx, { x: 330, y: 700, s: 1.05, t, mood: Lt.cafter('try2', 'keep magnets out') && !Lt.cafter('try2', 'which things') ? 'think' : 'talk', armR: -0.4, armL: 0.6, lookX: 0.8 });
          L.sticker(ctx, 'Will it stick?', 1100, 290, Lt.cwin('try2', 'will it stick', 0.5) * (1 - Lt.cwin('try2', 'then test it', 0.15, null, -0.1)), { bg: P.sun, size: 80, rot: 0.03 });
          L.sticker(ctx, 'never in your mouth!', 960, 538, Lt.cwin('try2', 'keep magnets out', 0.5) * (1 - Lt.cwin('try2', 'which things', 0.15, null, -0.1)), { bg: P.red, color: P.white, size: 60, rot: -0.03 });
          L.sticker(ctx, 'Which ones?', 1100, 290, Lt.cwin('try2', 'which things', 0.5), { bg: P.sun, size: 88, rot: -0.03 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Magnets pull iron!') }
    ],
    // ---- Try it on the website: two activities ("Try it 1" and "Try it 2"), each with its own state, title, hint and cues ----
    interactives: [
      {
        title: 'Magnet test',
        hint: 'Drag the magnet near each thing. Iron things jump to the magnet. Which ones stick?',
        init: mtInit, update: mtUpdate, draw: mtDraw, pointer: mtPointer,
        cues: { iron: 'It sticks! That one has iron in it.', nope: 'No pull. That one has no iron in it.', foil: 'Foil is a metal, but it has no iron. No pull!' }
      },
      {
        title: 'Push or pull',
        hint: 'Drag the magnet towards the other one. Tap it to turn it around. Which ends pull, and which push?',
        init: ppInit, update: ppUpdate, draw: ppDraw, pointer: ppPointer,
        cues: { pull: 'Red and blue pull together. Click!', push: 'Red and red push apart! The same ends push each other away.' }
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 8 — How do we hear sounds?
   Big idea: every sound is made by something wiggling (vibrating). The wiggle pushes the air, the air passes it along to your
   ear, and the tiny drum inside your ear wiggles too. Big wiggles are loud, fast wiggles are high. Everything is a pure
   function of time t (frames are rendered out of order); there is no random state: L.rng(seed) gives repeatable scatter. */
(function (global) {
  const L = global.LSC; const LSC = L; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};
  const TAU = Math.PI * 2;
  const WOOD = '#E7A251', WOOD_DARK = '#B5713A', SKIN = '#F2C9A0', SKIN_DARK = '#E3A978', AIR = '#CFEAFF', AIR_EDGE = '#4EA8FF';

  // ---------- small shapes (sound is drawn as rings, notes and wiggly lines, never as text) ----------
  // a music note made of shapes; (x, y) = centre of the note head
  function note(ctx, x, y, s, color, alpha) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.fillStyle = color || P.purple; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(20, -4); ctx.lineTo(20, -92); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -92); ctx.bezierCurveTo(32, -66, 60, -64, 56, -34); ctx.bezierCurveTo(50, -56, 34, -58, 20, -64); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 25, 18, -0.45, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // expanding sound rings from (x, y); `age` = seconds since the sound began
  function rings(ctx, x, y, age, o) {
    o = o || {}; const n = o.n || 3, gap = o.gap || 0.35, life = o.life || 1.3, r0 = o.r0 || 40, r1 = o.r1 || 280, lw = o.lw || 10;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (age - i * gap) / life; if (a <= 0 || a >= 1) continue;
      ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (1 - a) * 0.9; ctx.strokeStyle = o.color || P.purple; ctx.lineWidth = lw * (1 - 0.4 * a);
      ctx.beginPath(); ctx.arc(x, y, lerp(r0, r1, E.out(a)), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  // a note that floats up from (x, y) over `life` seconds; age = seconds since it started
  function floatNote(ctx, x, y, age, o) {
    o = o || {}; const life = o.life || 2.2; const a = age / life; if (a <= 0 || a >= 1) return;
    const rise = (o.rise || 230) * E.out(a), sway = Math.sin(age * 3 + (o.ph || 0)) * 22;
    note(ctx, x + sway + (o.dx || 0) * a, y - rise, o.s || 0.75, o.color || P.purple, Math.min(1, a * 6) * (1 - Math.pow(a, 3)));
  }
  // pale grid; it extends beyond the frame so a shifted close-up (the zoom) never shows a gap
  function labBackground(ctx, color) {
    ctx.fillStyle = color || '#F1ECFF'; ctx.fillRect(-720, -720, W + 1440, H + 1440); ctx.strokeStyle = 'rgba(155,107,255,0.18)'; ctx.lineWidth = 3;
    for (let x = -720; x < W + 720; x += 120) { ctx.beginPath(); ctx.moveTo(x, -720); ctx.lineTo(x, H + 720); ctx.stroke(); }
    for (let y = -720; y < H + 720; y += 120) { ctx.beginPath(); ctx.moveTo(-720, y); ctx.lineTo(W + 720, y); ctx.stroke(); }
  }
  function panel(ctx, x, y, w, h, label, color) {
    ctx.fillStyle = P.white; roundRect(ctx, x, y, w, h, 30); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.stroke();
    if (label) L.sticker(ctx, label, x + w / 2, y, 1, { bg: color || P.green, color: P.white, size: 48, rot: 0 });
  }

  // ---------- strings ----------
  // a string vibrates in its simplest way: the middle moves most, the ends stay put. u = 0..1 along the string.
  const strDisp = (u, ph, amp) => amp * Math.cos(ph) * Math.sin(Math.PI * u);
  // draws a string from (x0, y) to (x1, y). amp = size of the wiggle (px), ph = phase (radians).
  // The two extreme positions are drawn faintly with a soft band between them: the "blurred" look of a fast wiggle.
  function stringLine(ctx, x0, x1, y, amp, ph, o) {
    o = o || {}; const lw = o.lw || 8, n = 30; const X = u => x0 + (x1 - x0) * u;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (amp > 1.5 && o.ghost !== false) {
      ctx.fillStyle = o.band || 'rgba(155,107,255,0.22)'; ctx.beginPath();
      for (let i = 0; i <= n; i++) ctx.lineTo(X(i / n), y - strDisp(i / n, 0, amp));
      for (let i = n; i >= 0; i--) ctx.lineTo(X(i / n), y + strDisp(i / n, 0, amp));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = o.ghostColor || 'rgba(43,45,66,0.3)'; ctx.lineWidth = lw * 0.7;
      for (const sg of [1, -1]) { ctx.beginPath(); for (let i = 0; i <= n; i++) { const yy = y + sg * strDisp(i / n, 0, amp); i ? ctx.lineTo(X(i / n), yy) : ctx.moveTo(X(i / n), yy); } ctx.stroke(); }
    }
    ctx.strokeStyle = o.color || P.ink; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const yy = y + strDisp(i / n, ph, amp); i ? ctx.lineTo(X(i / n), yy) : ctx.moveTo(X(i / n), yy); }
    ctx.stroke(); ctx.restore();
  }

  // ---------- Curie's box guitar ----------
  // Four strings of different lengths stretched from a curved neck (left) to the sound box (right); the longest string is at
  // the bottom. Longer string = lower sound (the pitches below are in Hz, longest to shortest). Strings are 1/pitch long.
  const GF = [196, 262, 330, 440];
  const GLEN = GF.map(f => 500 * 196 / f);        // 500, 374, 297, 223 (local px)
  // Local frame (origin = centre of the frame): sound box x 190..330, strings end at x = 190, neck at the left.
  // o.amp[i] / o.ph[i]: wiggle size (px) and phase of string i; o.gap: spacing of the strings; o.glow 0..1: sound hole glow.
  function guitar(ctx, x, y, s, t, o) {
    o = o || {}; const gap = o.gap || 70; const amp = o.amp || [0, 0, 0, 0], ph = o.ph || [0, 0, 0, 0];
    const yy = i => gap * (1.5 - i), xl = i => 190 - GLEN[i];
    const top = -(gap * 1.5 + 65), bot = gap * 1.5 + 65;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(-5, bot + 6, 350, 22, 0, 0, TAU); ctx.fill();
    // base bar and curved neck
    ctx.strokeStyle = P.ink; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(-326, bot - 14); ctx.lineTo(200, bot - 14); ctx.stroke();
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(-326, bot - 14); ctx.lineTo(200, bot - 14); ctx.stroke();
    const pts = [[xl(0) - 16, bot - 14], [xl(0) - 16, yy(0)], [xl(1) - 16, yy(1)], [xl(2) - 16, yy(2)], [xl(3) - 16, yy(3)], [xl(3) - 4, top + 24]];
    const neck = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
    ctx.strokeStyle = P.ink; ctx.lineWidth = 44; neck(); ctx.stroke(); ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 30; neck(); ctx.stroke();
    // sound box with its round hole
    ctx.fillStyle = WOOD; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, 190, top, 140, bot - top, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(ctx, 204, top + 14, 22, bot - top - 28, 10); ctx.fill();
    if (o.glow > 0) { const g = ctx.createRadialGradient(262, 0, 20, 262, 0, 120); g.addColorStop(0, 'rgba(255,230,80,' + (0.7 * o.glow) + ')'); g.addColorStop(1, 'rgba(255,230,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(262, 0, 120, 0, TAU); ctx.fill(); }
    circle(ctx, 262, 0, 48, '#4A2E1B', P.ink, 7); circle(ctx, 262, 0, 30, '#2B1A0F');
    // strings and tuning pegs
    for (let i = 0; i < 4; i++) { stringLine(ctx, xl(i), 190, yy(i), amp[i] || 0, ph[i] || 0, { lw: 7 }); circle(ctx, xl(i) - 16, yy(i), 10, '#FFF1C9', P.ink, 4); }
    ctx.restore();
  }

  // ---------- the ear ----------
  // outer ear facing left (sound arrives from the left); (x, y) = centre, about 300 px tall at s = 1
  function ear(ctx, x, y, s, t, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = SKIN; ctx.strokeStyle = P.ink; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, -150); ctx.bezierCurveTo(100, -150, 125, -40, 82, 40); ctx.bezierCurveTo(62, 100, 60, 152, 0, 152);
    ctx.bezierCurveTo(-42, 154, -52, 110, -40, 70); ctx.bezierCurveTo(-64, 20, -92, -40, -62, -102); ctx.bezierCurveTo(-46, -136, -24, -150, 0, -150); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = SKIN_DARK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-18, -104); ctx.bezierCurveTo(48, -112, 74, -42, 40, 30); ctx.stroke();
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-10, -62); ctx.bezierCurveTo(24, -64, 36, -26, 16, 8); ctx.stroke();
    circle(ctx, -26, 18, 15, SKIN_DARK, P.ink, 5);
    ctx.fillStyle = '#6B3A2A'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(-8, 30, 17, 30, 0.1, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // inside the ear, as a cut-away: a short tunnel that ends in a tiny drum. x, y = centre; about 640 px wide at s = 1.
  // o.wig = how much the tiny drum skin wiggles (px); o.t0 = start of the wiggle (seconds), o.pulses = air pushes arriving [{age}]
  function earInside(ctx, x, y, s, t, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // tunnel
    ctx.fillStyle = '#FBE3CC'; ctx.strokeStyle = P.ink; ctx.lineWidth = 9; roundRect(ctx, -320, -105, 430, 210, 60); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(227,169,120,0.45)'; roundRect(ctx, -300, -88, 390, 40, 20); ctx.fill();
    // the tiny drum at the end of the tunnel: a blue drum body with a pink skin facing the sound
    const wig = o.wig || 0, ph = o.ph || 0;
    ctx.fillStyle = P.blue; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, 108, -118, 120, 236, 26); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 7; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(130 + i * 26, -92); ctx.lineTo(144 + i * 26, 92); ctx.moveTo(144 + i * 26, -92); ctx.lineTo(130 + i * 26, 92); } ctx.stroke();
    const bulge = wig * Math.sin(ph);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 36; ctx.beginPath(); ctx.moveTo(108, -112); ctx.quadraticCurveTo(108 + bulge * 2, 0, 108, 112); ctx.stroke();
    ctx.strokeStyle = '#FFB5C8'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(108, -112); ctx.quadraticCurveTo(108 + bulge * 2, 0, 108, 112); ctx.stroke();
    ctx.restore();
  }

  // ---------- air: little bits that pass a push along ----------
  // The bits stay (nearly) where they are: each is pushed a little to the right as a push goes past, then comes back.
  // pulses = start times (seconds) of the pushes at x = xs; v = how fast a push travels (px per second); t = now.
  function pushAmount(x, t, pulses, xs, v, w, a) {
    let d = 0; for (const tk of pulses) { if (t < tk) continue; const z = (x - xs - v * (t - tk)) / w; d += a * Math.exp(-z * z); } return d;
  }
  function airBits(ctx, t, o) {
    // o: x0, x1 (first and last column), y (centre), rows, cols, gap (row spacing), pulses, xs, v, w, a, r (bit radius), alpha
    const cols = o.cols || 14, rows = o.rows || 3, gap = o.gap || 62, alpha = o.alpha == null ? 1 : o.alpha, r = o.r || 17, A = o.a || 26; if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    for (let j = 0; j < cols; j++) {
      const bx = lerp(o.x0, o.x1, j / (cols - 1)), d = pushAmount(bx, t, o.pulses || [], o.xs, o.v, o.w || 80, A), hl = clamp(d / A, 0, 1);
      const fill = `rgb(${Math.round(207 - 129 * hl)},${Math.round(234 - 66 * hl)},255)`;
      for (let i = 0; i < rows; i++) {
        const by = o.y + (i - (rows - 1) / 2) * gap;
        circle(ctx, bx + d, by, r + 4 * hl, fill, AIR_EDGE, 4); circle(ctx, bx + d - r * 0.3, by - r * 0.3, r * 0.22, 'rgba(255,255,255,0.9)');
      }
    }
    ctx.restore();
  }

  // ---------- the drum with rice ----------
  // (x, y) = centre of the drum skin; skin ellipse rx 300 x ry 66 at s = 1. dip = how far the skin moves down (px, can wobble).
  function drum(ctx, x, y, s, t, o) {
    o = o || {}; const dip = o.dip || 0; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
    const rx = 300, ry = 66, bh = 190;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0, bh + 44, rx + 30, 34, 0, 0, TAU); ctx.fill();
    // body
    ctx.fillStyle = P.red; ctx.strokeStyle = P.ink; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.lineTo(-rx, bh); ctx.ellipse(0, bh, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(rx, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; roundRect(ctx, -rx + 30, 40, 36, bh - 20, 14); ctx.fill();
    // zig-zag lacing
    ctx.strokeStyle = P.cream; ctx.lineWidth = 9; ctx.beginPath(); for (let i = -6; i <= 6; i++) { const px = i * 44, yy = 76 + (Math.abs(i) % 2 ? 0 : 0); ctx.moveTo(px, 36 + ry * Math.sqrt(Math.max(0, 1 - (px / rx) * (px / rx))) * 0.9 - 6); ctx.lineTo(px + 22, bh - 6 + ry * Math.sqrt(Math.max(0, 1 - ((px + 22) / rx) * ((px + 22) / rx))) * 0.7 - 20); } ctx.stroke();
    // rims and skin
    ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.fillStyle = P.sunDeep; ctx.beginPath(); ctx.ellipse(0, 0, rx + 8, ry + 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.cream; ctx.beginPath(); ctx.ellipse(0, dip, rx - 16, ry - 10, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  }
  // rice grains on the drum skin; hit = {age, k} k = strength 0..1 of the last hit (age in seconds since it); (x, y) = skin centre
  function rice(ctx, x, y, s, hit, o) {
    o = o || {}; const r = L.rng(2468); const n = o.n || 30; const hs = o.hopScale || 1; const dp = o.drop == null ? 1 : o.drop;   // drop 0..1: the grains pour in from above, each at its own moment
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (let i = 0; i < n; i++) {
      const gx = (r() * 2 - 1) * 215, gy = (r() * 2 - 1) * 28, rot = (r() - 0.5) * 1.6, d1 = r(), d2 = r(), d3 = r() * 2 - 1;
      let up = 0, dx = 0; let k = hit ? hit.k : 0;
      if (hit && hit.age > 0 && k > 0.02) {
        const H = hs * (22 + 200 * k * k) * (0.55 + 0.45 * d1), T = 0.22 + 0.55 * k, tt = hit.age - 0.02 * d2;
        if (tt > 0 && tt < T) { const q = tt / T; up = 4 * q * (1 - q) * H; dx = d3 * 46 * k * q; }
      }
      const q0 = clamp((dp - 0.55 * d1) / 0.45, 0, 1); if (q0 <= 0) continue;
      const fall = 440 * (1 - q0 * q0), sway = d3 * 36 * (1 - q0), fa = Math.min(1, q0 * 8);
      ctx.save(); ctx.globalAlpha = fa;
      ctx.fillStyle = 'rgba(43,45,66,0.16)'; ctx.beginPath(); ctx.ellipse(gx + dx * 0.4, gy + 6, 11 * (1 - 0.3 * Math.min(1, up / 160)), 4, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(gx + dx + sway, gy - up - 4 - fall); ctx.rotate(rot + up * 0.012 * d3 + fall * 0.01 * d3);
      ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.restore();
    }
    ctx.restore();
  }
  // drumstick: pivot (px, py) is Curie's hand; ang = direction (radians, 0 = right, negative = up); len in px
  function stick(ctx, px, py, ang, len, s) {
    s = s || 1; ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.lineCap = 'round';
    ctx.strokeStyle = P.ink; ctx.lineWidth = 24 * s; ctx.beginPath(); ctx.moveTo(-30 * s, 0); ctx.lineTo(len, 0); ctx.stroke();
    ctx.strokeStyle = '#F0C27A'; ctx.lineWidth = 13 * s; ctx.beginPath(); ctx.moveTo(-30 * s, 0); ctx.lineTo(len, 0); ctx.stroke();
    circle(ctx, len + 4, 0, 27 * s, P.pink, P.ink, 7 * s); circle(ctx, len - 5, -8 * s, 7 * s, 'rgba(255,255,255,0.7)');
    ctx.restore();
  }
  // loudness meter: 3 bars, `n` of them lit (0..3)
  function meter(ctx, x, y, n, t) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = P.white; roundRect(ctx, -110, -70, 220, 140, 28); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.stroke();
    const cols = [P.green, P.sun, P.red];
    for (let i = 0; i < 3; i++) { const h = 36 + i * 22, lit = n > i; ctx.fillStyle = lit ? cols[i] : 'rgba(43,45,66,0.12)'; roundRect(ctx, -80 + i * 56, 46 - h, 44, h, 10); ctx.fill(); if (lit) { ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.stroke(); } }
    ctx.restore();
  }

  // ---------- the home experiment: an open box with a rubber band over it (seen from above) ----------
  // (x, y) = centre; box 600 x 340 at s = 1. band: wiggle size amp (px), phase ph, tight 0..1 (tighter = thinner and straighter)
  function bandBox(ctx, x, y, s, t, o) {
    o = o || {}; const amp = o.amp || 0, ph = o.ph || 0, tight = o.tight || 0, k = o.stretch == null ? 1 : o.stretch;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(0, 190, 330, 24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#D9A066'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -300, -170, 600, 340, 30); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4A2E1B'; roundRect(ctx, -258, -128, 516, 256, 16); ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; roundRect(ctx, -288, -158, 576, 18, 8); ctx.fill();
    // the band: loose (thick) to tight (thin). stretch k < 1: the band is still being pulled out from the left end of the box
    const xr = lerp(-170, 318, E.out(k)), lw = lerp(20, 9, tight), col = o.color || P.red;
    ctx.strokeStyle = P.ink; ctx.lineWidth = lw + 8; ctx.beginPath(); ctx.moveTo(-318, 0); ctx.lineTo(xr, 0); ctx.stroke();
    if (amp > 1.5 && k >= 1) {
      const X = u => -258 + 516 * u; ctx.fillStyle = 'rgba(255,92,92,0.28)'; ctx.beginPath();
      for (let i = 0; i <= 24; i++) ctx.lineTo(X(i / 24), -strDisp(i / 24, 0, amp)); for (let i = 24; i >= 0; i--) ctx.lineTo(X(i / 24), strDisp(i / 24, 0, amp)); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    if (amp > 0.01 && k >= 1) { ctx.moveTo(-318, 0); for (let i = 0; i <= 24; i++) { const u = i / 24; ctx.lineTo(-258 + 516 * u, strDisp(u, ph, amp)); } ctx.lineTo(318, 0); }
    else { ctx.moveTo(-318, 0); ctx.lineTo(xr, 0); }
    ctx.stroke(); ctx.restore();
  }

  // ---------- scene helpers (shared by the video scenes and the Try-it pictures) ----------
  // Curie's box guitar stands in the park here, and Curie plucks its longest (lowest) string with her right hand.
  const G = { x: 1150, y: 641, s: 1.05 };
  const HOLE = { x: G.x + 262 * G.s, y: G.y };                      // the sound hole, where the rings start
  const CUR = { x: 640, y: 720, s: 1.3 };                           // Curie's place beside the guitar
  const VIS_HZ = 4.5;                                               // how fast the long string visibly wiggles in the park (the real one is far faster)
  // the park with Curie, her guitar, the pluck at time tp (anything < -50 means "not yet / long ago") and the rings, notes and glow it makes
  function twangScene(ctx, t, o) {
    L.park(ctx, t, { house: false });
    const age = t - o.tp, plucked = o.tp > -50 && age > 0;
    const amp = plucked ? 24 * Math.exp(-age / 1.0) : 0, glow = plucked ? Math.exp(-age / 0.9) : 0;
    guitar(ctx, G.x, G.y, G.s * (o.grow == null ? 1 : o.grow), t, { amp: [amp, 0, 0, 0], ph: [TAU * VIS_HZ * Math.max(0, age), 0, 0, 0], glow });
    if (plucked) {
      rings(ctx, HOLE.x, HOLE.y, age, { n: 3, r0: 56, r1: 330, color: P.purple, lw: 11 });
      floatNote(ctx, HOLE.x + 20, HOLE.y - 70, age - 0.15, { dx: 40, color: P.purple });
      floatNote(ctx, HOLE.x - 30, HOLE.y - 70, age - 0.6, { dx: -50, color: P.pink, ph: 1.7 });
      floatNote(ctx, HOLE.x + 70, HOLE.y - 70, age - 1.05, { dx: 30, color: P.blue, ph: 3.1 });
    }
    // Curie's right hand flicks up through the string at the pluck, then rests
    let a = 0.55; if (o.tp > -50) a = t < o.tp - 0.1 ? 0.55 : t < o.tp + 0.1 ? lerp(0.55, -0.2, seg(t, o.tp - 0.1, o.tp + 0.1, E.out)) : lerp(-0.2, 0.35, seg(t, o.tp + 0.1, o.tp + 0.8, E.inOut));
    if (o.arm != null) a = o.arm;
    L.pip(ctx, { x: CUR.x, y: CUR.y, s: CUR.s, t, mood: o.mood || 'talk', armR: a, armL: 0.6, lookX: 0.8, lookY: o.lookY == null ? 0 : o.lookY });
  }

  // The close-up of the string: pale lab grid, the wooden neck on the left and the sound box on the right, one big string.
  const BIG = { x0: 292, x1: 1628, y: 450 };
  function bigString(ctx, t, o) {
    o = o || {}; labBackground(ctx);
    ctx.fillStyle = WOOD_DARK; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, 236, 250, 56, 400, 22); ctx.fill(); ctx.stroke();
    circle(ctx, 264, BIG.y, 17, '#FFF1C9', P.ink, 5);
    ctx.fillStyle = WOOD; roundRect(ctx, 1628, 220, 170, 460, 30); ctx.fill(); ctx.stroke();
    circle(ctx, 1716, BIG.y, 58, '#4A2E1B', P.ink, 8); circle(ctx, 1716, BIG.y, 36, '#2B1A0F');
    const age = t - (o.t0 == null ? 0 : o.t0);
    stringLine(ctx, BIG.x0, BIG.x1, BIG.y, o.amp || 0, TAU * (o.hz || 4.5) * Math.max(0, age), { lw: 16 });
  }
  // what is inside the thought bubble of the question scene: an ear, and little notes drifting towards it
  function earBubble(ctx, t) {
    ear(ctx, 50, 10, 0.8, t);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.35 + i / 3) % 1; note(ctx, -280 + 210 * ph, -95 + 95 * i + Math.sin(t * 2 + i * 2) * 8, 0.7, [P.purple, P.pink, P.blue][i], Math.sin(Math.PI * ph)); }
  }
  // what a hit on the drum looks like: rings on the skin and rings of sound in the air; bigger hit (k 0..1) = bigger, stronger rings
  function hitFx(ctx, x, y, age, k) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 284, 56, 0, 0, TAU); ctx.clip();
    for (let i = 0; i < 3; i++) { const q = (age - 0.12 * i) / 0.7; if (q <= 0 || q >= 1) continue; const rr = Math.min(270, (40 + 230 * q) * (0.5 + 0.5 * k) + 20); ctx.globalAlpha = (1 - q) * 0.8; ctx.strokeStyle = P.purple; ctx.lineWidth = 5 + 4 * k; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.22, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    rings(ctx, x, y - 30, age, { n: k > 0.5 ? 3 : 2, gap: 0.3, life: 1.2 + 0.5 * k, r0: 100, r1: 140 + 300 * k, lw: 6 + 8 * k, color: P.purple, alpha: 0.35 + 0.5 * k });
  }
  // the YouTube thumbnail background: the box guitar with a wiggling string, rings of sound and notes
  function thumbBg(ctx, t) {
    L.sky(ctx); L.ground(ctx, 830);
    guitar(ctx, 1320, 560, 1.4, t, { amp: [34, 0, 0, 0], ph: [1.0, 0, 0, 0], glow: 0.9 });
    rings(ctx, 1320 + 262 * 1.4, 560, 0.9, { n: 3, gap: 0.3, life: 1.3, r0: 60, r1: 330, lw: 14 });
    note(ctx, 1130, 260, 1.2, P.purple); note(ctx, 1440, 150, 1.1, P.pink); note(ctx, 1720, 190, 1.0, P.blue);
  }

  // ---------- geometry and helpers for the two Try-it activities ----------
  // Try it 1: the box guitar, big, with its strings far enough apart to tap one at a time (zones are about 170 px tall)
  const TG = { x: 1060, y: 530, s: 1.22, gap: 140 };
  const tgY = i => TG.y + TG.s * TG.gap * (1.5 - i);                    // height of string i (0 = longest, at the bottom)
  const tgX0 = i => TG.x + TG.s * (190 - GLEN[i]);                      // where string i starts on the neck
  const TGX1 = TG.x + TG.s * 190;                                       // where every string ends, at the sound box
  const TG_HOLE = { x: TG.x + 262 * TG.s, y: TG.y };
  const tgZone = (x, y) => { for (let i = 0; i < 4; i++) if (Math.abs(y - tgY(i)) < 86 && x > tgX0(i) - 50 && x < TGX1 + 60) return i; return -1; };
  const NOTE_COLORS = [P.blue, P.green, P.pink, P.purple];              // low ... high
  function pluckString(s, i, x) {
    if (s.clock - s.t0[i] < 0.15) return;                                // a string cannot be plucked again within 0.15 s (a shaky finger on the border between strings)
    s.t0[i] = s.clock; s.plucks++; s.touched = true;
    s.notes.push({ x: clamp(x, tgX0(i) + 40, TGX1 - 40), i, t0: s.clock }); if (s.notes.length > 8) s.notes.shift();
    if (LSC.sound) LSC.sound.pluck(GF[i], 0.32);                        // a real plucked-string sound; the pitch follows the string length
    if (i === 0 || i === 3) { s.want = i === 0 ? 'low' : 'high'; s.wantAt = s.clock + 0.55; }
  }
  // Try it 2: Curie holds the drumstick; it turns about her shoulder. Pulling it back (up to PULL_MAX radians) sets the strength.
  const TC = { x: 380, y: 700, s: 1.15 }, TD = { x: 980, y: 545 };
  const TD_SH = { x: TC.x + 82 * TC.s, y: TC.y + 10 * TC.s }, TD_ARM = 70 * TC.s, TD_T = [780, 556];
  const TD_REACH = Math.hypot(TD_T[0] - TD_SH.x, TD_T[1] - TD_SH.y), TD_AH = Math.atan2(TD_T[1] - TD_SH.y, TD_T[0] - TD_SH.x), PULL_MAX = 1.25;
  function drumSwing(s, pull) { s.swing = true; s.swT = s.clock; s.swFrom = clamp(pull, 0.1, PULL_MAX); s.swK = clamp(pull / 1.1, 0.12, 1); s.pull = 0; }

  L.episodes.ep8 = {
    id: 'ep8', num: 8, title: 'How do we hear sounds?', short: 'Sound', phrase: 'Sounds are wiggles!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie (Curie stands at x 560, y 760)
    thumb: { big: 'SOUNDS?', small1: 'How do we hear', small2: '', bg: (ctx, t) => thumbBg(ctx, t) },
    // text = the caption on screen (and the site); say = what Curie speaks, with direction tags (docs/PIPELINE.md, "Narration markup")
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: how do we hear sounds?", say: "Today's big question... How do we *hear* sounds?", hold: 0.6 },
      { id: 'twang', text: 'Curie has a box guitar. Listen... Twang! Where does that sound come from?', say: "{sfx:pop}Curie has a *box* guitar. Listen... {sfx:pluck_low}*Twang*! {pause 0.5}Where does that *sound* come from?", hold: 0.8 },
      { id: 'closer', text: "Let's look closer. Much, much closer!", say: "Let's look *closer*. {sfx:zoom}Much... *much* closer!", hold: 0.4 },
      { id: 'string', text: 'Look at the string! It is wiggling... back and forth, super fast!', say: "{sfx:pop}Look at the *string*! {sfx:wiggle}It is *wiggling*... back and forth... *super* fast!", hold: 1.0 },
      { id: 'wiggle', text: 'When something wiggles like that, it makes a sound. Sounds are made by wiggles!', say: "When something wiggles like that... it makes a *sound*. {sfx:ding}Sounds are made by *wiggles*!", hold: 0.8 },
      { id: 'air', text: 'The wiggle pushes the air, and the air passes it along. Push... push... push... all the way to your ear!', say: "The wiggle *pushes* the air... and the air passes it *along*. {sfx:pop}Push... {sfx:pop}push... {sfx:pop}push... {pause 0.05}all the way... {sfx:ding}to your *ear*!", hold: 0.8 },
      { id: 'ear', text: 'Inside your ear is a tiny drum. The wiggle makes it wiggle too... and you hear the sound!', say: "Inside your *ear* is a *tiny* drum. {sfx:drum_soft}The wiggle makes it wiggle *too*... {sfx:sparkle}and you *hear* the sound!", hold: 0.8 },
      { id: 'feel', text: 'You can feel a wiggle! Gently put your fingers on your throat... and hum. Hmmm. Can you feel it buzz?', say: "You can *feel* a wiggle! Gently put your fingers on your *throat*... and hum. {slow}Hmmm.{/slow} Can you feel it *buzz*?", hold: 1.0 },
      { id: 'test', text: "Scientists test it! Let's put some rice on a drum.", say: "{sfx:ding}*Scientists* test it! Let's put some *rice* on a drum.", hold: 0.4 },
      { id: 'soft', text: 'A tiny tap makes tiny wiggles. The rice hops a little, and the sound is quiet.', say: "A *tiny* tap... makes *tiny* wiggles. The rice hops a little... {w}and the sound is quiet.{/w}", hold: 0.6 },
      { id: 'loud', text: 'A big bang makes big wiggles! The rice jumps way up, and the sound is loud!', say: "A *big* bang... makes *big* wiggles! The rice jumps way *up*... and the sound is *loud*!", hold: 0.8 },
      { id: 'highlow', text: "Now let's change how fast it wiggles. A short string wiggles faster, and makes a high sound. A long string wiggles slower, and makes a low sound.", say: "Now let's change how *fast* it wiggles. A *short* string wiggles *faster*... and makes a *high* sound. A *long* string wiggles *slower*... and makes a *low* sound.", hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: sounds are wiggles!', say: 'Say it with me... {sfx:ding}*Sounds* are *wiggles*! {pause 0.9} {slow}Sounds... are... wiggles!{/slow}', hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up to stretch a rubber band over an open box.", say: "{sfx:tada}Let's try it at home! Ask a grown-up to *stretch* a rubber band... over an open *box*.", hold: 0.4 },
      { id: 'try2', text: 'Pluck it gently, away from your face. Can you see it wiggle? Now stretch it tighter, with your grown-up. Is the sound higher, or lower?', say: "{sfx:pluck_low}*Pluck* it gently... away from your face. Can you *see* it wiggle? Now stretch it *tighter*, with your grown-up. {sfx:ding}Is the sound *higher*... or *lower*?", hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: sounds are made by wiggles. See you next time at the Little Scientists Club! Bye-bye!', say: '{sfx:tada}Great job, little scientist! Remember... sounds are made by *wiggles*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}', hold: 1.2 }
    ],
    // extra sound effects not written into `say` as {sfx:name}: anchored to a line (+offset s) or to a chunk ('chunk': words)
    sfx: [
      // the drum is hit twice in each of the two lines: once as the stick comes down ("makes tiny wiggles" / "makes big wiggles") and once
      // 0.15 s before Curie talks about the rice ("The rice hops a little" / "The rice jumps way up"), so the rice moves while she mentions it
      { line: 'soft', chunk: 'makes tiny', name: 'drum_soft' },
      { line: 'soft', chunk: 'the rice hops', name: 'drum_soft', offset: -0.15 },
      { line: 'loud', chunk: 'makes big', name: 'drum_loud' },
      { line: 'loud', chunk: 'the rice jumps', name: 'drum_loud', offset: -0.15 },
      // a short and a long string: the same loudness, only the pitch differs. pluck_high is louder than pluck_low when measured alone
      // (A-weighted, about +8 dB), so it is turned down (vol 0.5, residual about +2 dB A-weighted)
      { line: 'highlow', chunk: 'a short string', name: 'pluck_high', vol: 0.5 },
      { line: 'highlow', chunk: 'a long string', name: 'pluck_low' }
    ],
    // scenes: each starts when its `from` line starts and lasts until the next scene; transition 'cut' = no wipe
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => earBubble(c, tt), { word: 'How?' }) },
      {
        // Curie plucks her box guitar: rings and notes on "Twang!", a question mark on "Where does that sound come from?"
        from: 'twang', draw: (ctx, t, Lt) => {
          const tp = Lt.chunk('twang', 'twang'), asked = Lt.cafter('twang', 'where does that');
          twangScene(ctx, t, { tp, grow: Lt.win('twang', 0.1, 0.7, E.outBack), mood: asked ? 'think' : t >= tp ? 'wow' : 'talk', lookY: asked ? -0.5 : 0 });
          const qp = Lt.cwin('twang', 'where does that', 0.5, E.outBack);
          if (qp > 0) L.questionMark(ctx, 960, 390, qp * (1 + 0.08 * Math.sin(t * 3)), t);
        }
      },
      {
        // the magnifier grows over the longest string and fills the screen with the close-up
        from: 'closer', transition: 'cut', draw: (ctx, t, Lt) => {
          twangScene(ctx, t, { tp: -99, mood: 'think', lookY: -0.3, arm: 0.35 });
          const p = Math.pow(seg(t, Lt.chunk('closer', 'look closer'), Lt.end('closer') + 0.6), 3), r = lerp(140, 2600, p);
          const sx = G.x - 60 * G.s, sy = G.y + 105 * G.s;                 // the middle of the longest string in the park
          const mx = lerp(sx, 960, p), my = lerp(sy, BIG.y, p);
          ctx.save(); ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.clip();
          ctx.translate(mx - 960, my - BIG.y); bigString(ctx, t, { amp: 0 });
          ctx.restore();
          if (p < 1) L.magnifier(ctx, mx, my, r, p);
        }
      },
      {
        // close-up: the string wiggles back and forth (two extreme positions + a soft blur), then the wiggle makes rings of sound
        from: 'string', transition: 'cut', draw: (ctx, t, Lt) => {
          bigString(ctx, t, { amp: 64 * Lt.cwin('string', 'it is wiggling', 0.35, E.out), t0: Lt.chunk('string', 'it is wiggling'), hz: 4.5 });
          const ar = Lt.cwin('string', 'back and forth', 0.4) * (1 - Lt.win('wiggle', 0, 0.4));
          if (ar > 0) { ctx.save(); ctx.globalAlpha = ar; L.arrow(ctx, 960, 372, 960, 292, P.red, 14); L.arrow(ctx, 960, 528, 960, 608, P.red, 14); ctx.restore(); }
          const ra = t - Lt.chunk('wiggle', 'it makes a sound');
          if (ra > 0) {
            rings(ctx, 960, BIG.y, ra, { n: 6, gap: 0.45, life: 1.8, r0: 90, r1: 640, lw: 12, color: P.purple });
            floatNote(ctx, 700, 330, ra - 0.2, { rise: 150, life: 2.4, color: P.purple });
            floatNote(ctx, 1000, 330, ra - 0.8, { rise: 150, life: 2.4, color: P.pink, ph: 1.4 });
            floatNote(ctx, 1280, 330, ra - 1.4, { rise: 150, life: 2.4, color: P.blue, ph: 2.6 });
          }
          const cp = Lt.win('string', 0.05, 0.5, E.outBack);
          if (cp > 0) L.pip(ctx, { x: 420, y: 775, s: 0.75 * cp, t, mood: Lt.cafter('wiggle', 'sounds are made') ? 'wow' : 'talk', armR: -0.5 + Math.sin(t * 5) * 0.1, armL: 0.6, lookX: 0.9, lookY: -0.5 });
          L.sticker(ctx, 'wiggling!', 960, 190, Lt.cwin('string', 'it is wiggling', 0.5) * (1 - Lt.cwin('string', 'super fast', 0.3)), { bg: P.sun, rot: -0.04 });
          L.sticker(ctx, 'super fast!', 960, 190, Lt.cwin('string', 'super fast', 0.5) * (1 - Lt.win('wiggle', 0, 0.3)), { bg: P.pink, rot: 0.04 });
          L.sticker(ctx, 'made by wiggles!', 960, 190, Lt.cwin('wiggle', 'sounds are made', 0.6), { bg: P.purple, color: P.white, rot: -0.03 });
        }
      },
      {
        // the wiggle pushes the air; the air passes the push along, bit by bit, to the ear. Each "push..." sends one push along.
        from: 'air', draw: (ctx, t, Lt) => {
          labBackground(ctx);
          const XS = 600, XE = 1480;
          const tk = [Lt.chunkN('air', 0) + 0.5, Lt.chunkN('air', 2), Lt.chunkN('air', 3), Lt.chunkN('air', 4)];
          const V = (XE - XS) / (Lt.chunkN('air', 6) + 0.15 - Lt.chunkN('air', 4));          // each push starts on its "push..."; the last one (the third) reaches the ear just as "to your ear!" starts
          guitar(ctx, 330, 560, 0.75, t, { amp: [30, 0, 0, 0], ph: [TAU * 3.5 * t, 0, 0, 0] });
          airBits(ctx, t, { x0: 660, x1: 1480, y: 560, rows: 3, cols: 13, gap: 72, r: 21, pulses: tk, xs: XS, v: V, w: 90, a: 30, alpha: Lt.win('air', 0.1, 0.5) });
          for (const k of tk) {                                                              // a little arrow rides on each push
            const c = XS + V * (t - k); if (t < k || c > XE + 60) continue;
            ctx.save(); ctx.globalAlpha = 0.9 * (1 - seg(c, XE - 160, XE + 40)); L.arrow(ctx, c - 50, 430, c + 50, 430, P.blueDeep, 12); ctx.restore();
          }
          ear(ctx, 1650, 560, 1.05, t);
          const arr = t - (tk[3] + (XE - XS) / V);                                           // the last push gets to the ear
          if (arr > 0) rings(ctx, 1642, 592, arr, { n: 2, gap: 0.3, life: 1.0, r0: 30, r1: 130, lw: 8, color: P.blue });
          L.pip(ctx, { x: 960, y: 790, s: 0.62, t, mood: Lt.cafter('air', 'to your ear') ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.2, lookY: -0.7 });
          L.sticker(ctx, 'air', 1060, 320, Lt.cwin('air', 'the air passes', 0.5) * (1 - Lt.cwin('air', 'to your ear', 0.3)), { bg: AIR, rot: -0.05, size: 88 });
          L.sticker(ctx, 'your ear!', 1480, 320, Lt.cwin('air', 'to your ear', 0.5), { bg: P.pink, rot: 0.05, size: 80 });
        }
      },
      {
        // a peek inside the ear: a tunnel that ends in a tiny drum, which wiggles when the pushes arrive
        from: 'ear', draw: (ctx, t, Lt) => {
          labBackground(ctx);
          const LX = 1270, LY = 480, LR = 290, EX = 470, EY = 470;
          ear(ctx, EX, EY, 1.15, t);
          const lp = Lt.cwin('ear', 'inside your ear', 0.7, E.outBack, 0.15);
          if (lp > 0) {
            ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(486, 474); ctx.lineTo(LX - 250, LY - 160); ctx.lineTo(LX - 250, LY + 160); ctx.lineTo(486, 536); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(461, 505, 40, 0, TAU); ctx.stroke(); ctx.restore();
            // the lens
            const t1 = Lt.chunkN('ear', 1), HIT = 0.55;                                      // pushes enter the tunnel from "The wiggle makes it wiggle too"
            const pulses = [0, 1, 2, 3, 4, 5].map(i => t1 + 0.45 * i), V2 = 440 / HIT;
            const wig = 22 * seg(t, t1 + HIT, t1 + HIT + 0.5, E.out) * (1 - seg(t, Lt.end('ear') + 0.2, Lt.end('ear') + 1.0));
            ctx.save(); ctx.translate(LX, LY); ctx.scale(lp, lp);
            ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(0, 0, LR, 0, TAU); ctx.fill();
            ctx.save(); ctx.beginPath(); ctx.arc(0, 0, LR - 4, 0, TAU); ctx.clip();
            earInside(ctx, 44, 0, 0.95, t, { wig, ph: TAU * 3.2 * Math.max(0, t - t1 - HIT) });
            airBits(ctx, t, { x0: -235, x1: 95, y: 0, rows: 2, cols: 8, gap: 76, pulses, xs: -290, v: V2, w: 60, a: 18, alpha: 1 });
            ctx.restore(); ctx.strokeStyle = P.ink; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, LR, 0, TAU); ctx.stroke(); ctx.restore();
          }
          const hear = t - Lt.chunk('ear', 'and you hear');
          floatNote(ctx, EX + 90, EY - 130, hear, { rise: 150, life: 2.4, dx: 30, color: P.purple });
          floatNote(ctx, EX + 20, EY - 140, hear - 0.5, { rise: 150, life: 2.4, dx: -40, color: P.pink, ph: 1.5 });
          floatNote(ctx, EX + 150, EY - 100, hear - 1.0, { rise: 150, life: 2.4, dx: 20, color: P.blue, ph: 2.7 });
          L.pip(ctx, { x: 190, y: 770, s: 0.7, t, mood: Lt.cafter('ear', 'and you hear') ? 'wow' : 'talk', armR: -0.5, armL: 0.6, lookX: 0.8, lookY: -0.4 });
          L.sticker(ctx, 'tiny drum', 1270, 105, Lt.cwin('ear', 'inside your ear', 0.5, null, 1.2) * (1 - Lt.cwin('ear', 'the wiggle makes', 0.3)), { bg: P.blue, color: P.white, rot: -0.04, size: 80 });
          L.sticker(ctx, 'it wiggles too!', 1270, 105, Lt.cwin('ear', 'the wiggle makes', 0.5) * (1 - Lt.cwin('ear', 'and you hear', 0.3)), { bg: P.sun, rot: 0.04, size: 80 });
          L.sticker(ctx, 'you hear it!', 1270, 105, Lt.cwin('ear', 'and you hear', 0.5), { bg: P.pink, rot: -0.03, size: 80 });
        }
      },
      {
        // Curie hums with her fingers on her throat: the buzz is the wiggle you can feel
        from: 'feel', draw: (ctx, t, Lt) => {
          L.park(ctx, t, { house: false });
          const CX = 760, CY = 650, S = 1.5, hum = Lt.cafter('feel', 'hmmm'), humP = Lt.cwin('feel', 'hmmm', 0.4);
          const grip = Lt.cwin('feel', 'gently put', 0.6, E.outBack);                          // her hand goes to her throat
          L.pip(ctx, { x: CX, y: CY, s: S, t, mood: hum ? 'happy' : 'talk', blink: hum ? 1 : null, armR: lerp(-0.3, 2.3, E.inOut(grip)), armL: 0.6, lookX: 0.4 });
          const hx = CX + 26 * S, hy = CY + 80 * S, shx = CX + 82 * S, shy = CY + 10 * S, elx = CX + 92 * S, ely = CY + 66 * S;
          if (grip > 0.2) {                                                                     // arm (with an elbow) and hand drawn in front of her body
            const g = E.inOut(grip), ex = lerp(elx + 40, hx, g), ey = lerp(ely + 30, hy, g);
            ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const [col, lw] of [[P.pipDark, 36 * S], [P.pip, 27 * S]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(shx, shy); ctx.lineTo(elx, ely); ctx.lineTo(ex, ey); ctx.stroke(); }
            circle(ctx, ex, ey, 21 * S, P.pip, P.pipDark, 6 * S); ctx.restore();
          }
          if (humP > 0) {                                                                       // buzz marks around the hand, and notes from the hum
            ctx.save(); ctx.strokeStyle = P.purple; ctx.lineWidth = 9; ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) { const r = 56 + 26 * i, a = humP * (0.5 + 0.5 * Math.sin(t * 9 - i * 1.2)); ctx.globalAlpha = 0.9 * a; ctx.beginPath(); ctx.arc(hx, hy, r, -0.7, 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(hx, hy, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); }
            ctx.restore();
            const ha = t - Lt.chunk('feel', 'hmmm');
            floatNote(ctx, CX + 170, CY - 30, ha, { rise: 200, life: 2.6, dx: 60, color: P.purple });
            floatNote(ctx, CX + 120, CY - 40, ha - 0.8, { rise: 200, life: 2.6, dx: 90, color: P.pink, ph: 1.9 });
            floatNote(ctx, CX + 190, CY - 20, ha - 1.6, { rise: 200, life: 2.6, dx: 40, color: P.blue, ph: 3.3 });
          }
          L.sticker(ctx, 'feel a wiggle!', 1160, 320, Lt.cwin('feel', 'you can feel', 0.5) * (1 - Lt.cwin('feel', 'gently put', 0.3)), { bg: P.sun, rot: -0.05, size: 88 });
          L.sticker(ctx, 'your throat', 1160, 320, Lt.cwin('feel', 'gently put', 0.5) * (1 - Lt.cwin('feel', 'hmmm', 0.3)), { bg: P.pink, rot: 0.04, size: 88 });
          L.sticker(ctx, 'buzz!', 1160, 320, Lt.cwin('feel', 'hmmm', 0.5), { bg: P.purple, color: P.white, rot: -0.05, size: 96 });
        }
      },
      {
        // test: rice on a drum. A tiny tap = tiny wiggles (little hops, quiet); a big bang = big wiggles (high hops, loud).
        from: 'test', draw: (ctx, t, Lt) => {
          labBackground(ctx);
          const DX = 980, DY = 545, CX = 380, CY = 700, CS = 1.15, SHx = CX + 82 * CS, SHy = CY + 10 * CS, ARM = 70 * CS;
          const target = [780, 556], reach = Math.hypot(target[0] - SHx, target[1] - SHy), aH = Math.atan2(target[1] - SHy, target[0] - SHx);
          // two hits per line: one as the stick comes down ("makes tiny wiggles"), one 0.15 s before Curie talks about the rice ("The rice hops a little"), same strength
          const hits = [
            { t: Lt.chunk('soft', 'makes tiny'), from: Lt.start('soft'), lift: 0.26, k: 0.18 },
            { t: Lt.chunk('soft', 'the rice hops') - 0.15, from: Lt.chunk('soft', 'makes tiny') + 0.45, lift: 0.26, k: 0.18 },
            { t: Lt.chunk('loud', 'makes big'), from: Lt.start('loud'), lift: 0.95, k: 1 },
            { t: Lt.chunk('loud', 'the rice jumps') - 0.15, from: Lt.chunk('loud', 'makes big') + 0.45, lift: 0.95, k: 1 }
          ];
          // the stick head rests on the skin before the first hit and hovers at aR after every hit; before each hit it lifts (while Curie speaks)
          // and comes down exactly on the hit. The rest height is the same for every hit (it does not build up).
          const aR = aH - 0.14;
          const ang = tt => {
            let rest = aH;
            for (const h of hits) {
              if (tt < h.from) return rest;
              if (tt < h.t + 0.4) {
                const up = E.inOut(seg(tt, h.from + 0.05, h.t - 0.2)), down = E.in(seg(tt, h.t - 0.2, h.t)), rb = E.out(seg(tt, h.t + 0.03, h.t + 0.4));
                return lerp(lerp(lerp(rest, rest - h.lift, up), aH, down), aR, rb);
              }
              rest = aR;
            }
            return rest;
          };
          const a = ang(t), last = hits.filter(h => t >= h.t).pop(), age = last ? t - last.t : 0, k = last ? last.k : 0;
          const pop = Lt.win('test', 0.1, 0.6, E.outBack);
          if (pop > 0) {
            const dip = last ? 9 * k * Math.exp(-age / 0.35) * Math.cos(TAU * 5 * age) : 0;
            drum(ctx, DX, DY, pop, t, { dip });
            if (last && pop >= 1) hitFx(ctx, DX, DY, age, k);
            if (pop >= 1) rice(ctx, DX, DY, 1, last ? { age, k } : null, { drop: Lt.cwin('test', 'put some rice', 0.9, null, 0.5) });
          }
          const lit = last ? (k > 0.5 ? 3 : 1) : 0;                                            // the meter keeps showing how loud the last hit was
          if (pop >= 1) meter(ctx, 1660, 430, lit, t);
          L.pip(ctx, { x: CX, y: CY, s: CS, t, mood: Lt.cafter('loud', 'makes big') && t < Lt.start('highlow') ? 'wow' : 'talk', armR: a, armL: 0.6, lookX: 0.8, lookY: -0.2 });
          stick(ctx, SHx + ARM * Math.cos(a), SHy + ARM * Math.sin(a), a, reach - ARM - 4, CS);
          L.sticker(ctx, 'Scientists test it!', 960, 110, Lt.cwin('test', 'scientists', 0.5) * (1 - Lt.win('soft', 0, 0.3)), { bg: P.blue, color: P.white, size: 72, rot: 0 });
          L.sticker(ctx, 'tiny wiggles', 980, 205, Lt.cwin('soft', 'makes tiny', 0.5) * (1 - Lt.cwin('soft', 'and the sound', 0.3)), { bg: P.sun, size: 84, rot: -0.04 });
          L.sticker(ctx, 'quiet', 980, 205, Lt.cwin('soft', 'and the sound', 0.5) * (1 - Lt.win('loud', 0, 0.3)), { bg: '#BFE9FF', size: 96, rot: 0.04 });
          L.sticker(ctx, 'BIG wiggles!', 980, 205, Lt.cwin('loud', 'makes big', 0.5) * (1 - Lt.cwin('loud', 'and the sound', 0.3)), { bg: P.sun, size: 88, rot: -0.04 });
          L.sticker(ctx, 'LOUD!', 980, 205, Lt.cwin('loud', 'and the sound', 0.5), { bg: P.red, color: P.white, size: 110, rot: 0.04 });
        }
      },
      {
        // short and long string: the short one (a quarter as long) wiggles four times as fast and sounds high; the long one sounds low
        from: 'highlow', draw: (ctx, t, Lt) => {
          labBackground(ctx);
          const X0 = 280, YS = 330, YL = 590, LS = 240, LL = 960, AMP = 34, HZ_S = 5.6, HZ_L = 1.4;
          const tS = Lt.chunkN('highlow', 1), tL = Lt.chunkN('highlow', 3), bp = Lt.win('highlow', 0.05, 0.6, E.outBack);
          ctx.save(); ctx.translate(760, 460); ctx.scale(bp, bp); ctx.translate(-760, -460);
          ctx.fillStyle = '#F6E3C5'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, 170, 170, 1130, 570, 36); ctx.fill(); ctx.stroke();
          ctx.fillStyle = WOOD_DARK; roundRect(ctx, X0 - 18, 250, 36, 400, 14); ctx.fill(); ctx.stroke();
          for (const [y, len] of [[YS, LS], [YL, LL]]) { ctx.fillStyle = WOOD_DARK; roundRect(ctx, X0 + len - 14, y - 46, 28, 92, 12); ctx.fill(); ctx.stroke(); circle(ctx, X0, y, 10, '#FFF1C9', P.ink, 4); circle(ctx, X0 + len, y, 10, '#FFF1C9', P.ink, 4); }
          const env = (tt, t0) => tt < t0 ? 0 : AMP * Math.exp(-(tt - t0) / 6);
          stringLine(ctx, X0, X0 + LS, YS, env(t, tS), TAU * HZ_S * Math.max(0, t - tS), { lw: 11 });
          stringLine(ctx, X0, X0 + LL, YL, env(t, tL), TAU * HZ_L * Math.max(0, t - tL), { lw: 11 });
          ctx.restore();
          if (bp >= 1) {
            const ls = Lt.cwin('highlow', 'a short string', 0.4), ll = Lt.cwin('highlow', 'a long string', 0.4);
            ctx.save(); roundRect(ctx, 170, 170, 1130, 570, 36); ctx.clip();                    // the rings stay on the board
            // both strings make the same rings (same size, thickness and life): the high sound is not louder or bigger, it only comes more often
            if (t >= tS) rings(ctx, X0 + LS / 2, YS, t - tS, { n: 4, gap: 0.3, life: 1.4, r0: 50, r1: 260, lw: 11, color: P.pink });
            if (t >= tL) rings(ctx, X0 + LL / 2, YL, t - tL, { n: 4, gap: 0.6, life: 1.4, r0: 50, r1: 260, lw: 11, color: P.blue });
            ctx.restore();
            ctx.save(); ctx.globalAlpha = ls; text(ctx, 'short string', X0 + LS / 2 + 42, YS - 122, { size: 46, weight: 600 }); ctx.globalAlpha = ll; text(ctx, 'long string', X0 + LL / 2, YL - 92, { size: 48, weight: 600 }); ctx.restore();
          }
          L.pip(ctx, { x: 1735, y: 712, s: 0.75, t, mood: 'talk', armR: -0.5, armL: 0.6, lookX: -0.8, lookY: -0.3 });
          L.sticker(ctx, 'high', 1480, YS, Lt.cwin('highlow', 'makes a high', 0.5), { bg: P.pink, size: 110, rot: -0.05 });
          L.sticker(ctx, 'low', 1480, YL, Lt.cwin('highlow', 'makes a low', 0.5), { bg: P.blue, color: P.white, size: 110, rot: 0.05 });
        }
      },
      {
        from: 'sayit', draw: (ctx, t, Lt) => {
          const c1 = Lt.chunk('sayit', 'sounds are wiggles'), c2 = Lt.chunkN('sayit', 2);   // the phrase and its slow repeat each make the string twang
          twangScene(ctx, t, { tp: t >= c2 ? c2 : t >= c1 ? c1 : -99, mood: 'talk', lookY: -0.2 });
          L.sayItSticker(ctx, 'Sounds are wiggles!', Lt.cwin('sayit', 'sounds are wiggles', 0.8), t);
        }
      },
      {
        // try at home: a rubber band over an open box (seen from above), plucked gently; then stretched tighter by the grown-up
        from: 'try1', draw: (ctx, t, Lt) => {
          ctx.fillStyle = '#E9C48E'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = '#D3A56C'; ctx.lineWidth = 5; for (let y = 90; y < H; y += 180) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
          L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.5, 0.6));
          const BX = 1050, BY = 570, BS = 1.25;
          const boxP = Lt.cwin('try1', 'ask a grown-up', 0.6, E.outBack, 0.9), stretch = Lt.cwin('try1', 'over an open', 0.9, null, -0.3);
          const tP = Lt.start('try2'), tT = Lt.chunk('try2', 'now stretch'), tight = Lt.cwin('try2', 'now stretch', 0.9, E.inOut, 0.3);
          const wiggle = t >= tP ? 24 * (1 - Lt.cwin('try2', 'now stretch', 0.4, null, 0.2)) : 0;
          if (boxP > 0) bandBox(ctx, BX, BY, BS * boxP, t, { stretch, tight, amp: wiggle, ph: TAU * 2.5 * Math.max(0, t - tP) });
          // the grown-up's hand holds the band's end while it is stretched over the box, and again when it is made tighter
          const endX = BX + BS * lerp(-170, 318, E.out(stretch));
          const gh = Lt.cwin('try1', 'ask a grown-up', 0.5, E.outBack, 0.9) * (1 - Lt.cwin('try1', 'over an open', 0.6, null, 1.4)) + Lt.cwin('try2', 'now stretch', 0.5, E.outBack) * (1 - Lt.cwin('try2', 'is the sound higher', 0.5));
          if (gh > 0.01) { ctx.save(); ctx.globalAlpha = Math.min(1, gh); L.hand(ctx, endX + 78, BY, 1.1, -Math.PI / 2); ctx.restore(); }
          if (tight > 0.05 && t < Lt.chunk('try2', 'is the sound higher') + 0.4) { ctx.save(); ctx.globalAlpha = tight; L.arrow(ctx, BX + BS * 330, BY - 100, BX + BS * 330 + 120, BY - 100, P.green, 14); L.arrow(ctx, BX - BS * 330, BY - 100, BX - BS * 330 - 120, BY - 100, P.green, 14); ctx.restore(); }
          // a finger plucks the band gently, then moves away
          const fin = seg(t, tP - 1.0, tP - 0.3, E.out), fout = seg(t, tP + 0.15, tP + 0.6);
          if (fin > 0 && fout < 1) { const fy = lerp(140, BY - 100, fin) - 90 * seg(t, tP, tP + 0.15, E.out); ctx.save(); ctx.globalAlpha = Math.min(1, fin * 3) * (1 - fout); L.hand(ctx, BX, fy, 1.0, Math.PI); ctx.restore(); }
          L.pip(ctx, { x: 360, y: 760, s: 0.8, t, mood: t >= tP && t < tT ? 'wow' : 'talk', armR: -0.4, armL: 0.6, lookX: 0.8, lookY: -0.2 });
          L.sticker(ctx, 'gently!', 1050, 250, Lt.cwin('try2', 'pluck it gently', 0.5) * (1 - Lt.cwin('try2', 'away from', 0.3)), { bg: P.green, color: P.white, size: 84, rot: -0.04 });
          L.sticker(ctx, 'away from your face!', 1050, 250, Lt.cwin('try2', 'away from', 0.5) * (1 - Lt.cwin('try2', 'can you see', 0.3)), { bg: P.red, color: P.white, size: 76, rot: 0.03 });
          L.sticker(ctx, 'higher... or lower?', 1050, 250, Lt.cwin('try2', 'is the sound higher', 0.6), { bg: P.sun, size: 84, rot: -0.03 });
        }
      },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Sounds are wiggles!') }
    ],
    // ---- Try it on the website: two activities (docs/PIPELINE.md, "Try it") ----
    interactives: [
      {
        // ---- Try it 1: pluck the strings. Long strings wiggle slowly and sound low; short strings wiggle fast and sound high. ----
        title: 'Pluck the strings',
        hint: 'Tap a string to pluck it. Long strings make low sounds and short strings make high sounds.',
        init: s => { s.clock = 0; s.t0 = [-99, -99, -99, -99]; s.notes = []; s.touched = false; s.down = false; s.zone = -1; s.py = 0; s.plucks = 0; s.lastCue = ''; s.want = ''; s.wantAt = 0; },
        update: (s, dt, cue) => {
          s.clock += dt;
          s.notes = s.notes.filter(n => s.clock - n.t0 < 2.4);
          // one cue per event, a moment after the pluck so the child hears the pitch first: 'low' for the longest string, 'high' for the shortest (not again for the same string in a row)
          if (s.want && s.clock >= s.wantAt) { if (s.lastCue !== s.want) { s.lastCue = s.want; cue(s.want); } s.want = ''; }
        },
        draw: (ctx, s, t) => {
          L.park(ctx, t, { house: false, tree: false });
          const amps = [], phs = []; let glow = 0, lastAge = 99, lastI = 0;
          for (let i = 0; i < 4; i++) {
            const age = s.clock - s.t0[i];
            amps.push(age >= 0 && age < 4 ? 34 * Math.exp(-age / 1.2) : 0); phs.push(TAU * (VIS_HZ * GF[i] / GF[0]) * Math.max(0, age));   // shorter string = faster wiggle
            if (age < lastAge) { lastAge = age; lastI = i; } if (age < 3) glow = Math.max(glow, Math.exp(-age / 0.9));
          }
          guitar(ctx, TG.x, TG.y, TG.s, t, { gap: TG.gap, amp: amps, ph: phs, glow });
          if (lastAge < 2.4) rings(ctx, TG_HOLE.x, TG_HOLE.y, lastAge, { n: 3, r0: 60, r1: 320, color: NOTE_COLORS[lastI], lw: 11 });
          for (const n of s.notes) floatNote(ctx, n.x, tgY(n.i) - 30, s.clock - n.t0, { rise: Math.min(260, tgY(n.i) - 130), life: 2.4, color: NOTE_COLORS[n.i], s: 0.85, ph: n.i * 1.3, dx: (n.i - 1.5) * 24 });
          L.pip(ctx, { x: 340, y: 760, s: 1.0, t, mood: lastAge < 1.0 ? 'wow' : 'happy', armR: lastAge < 0.3 ? -0.9 : 0.2, armL: 0.6, lookX: 0.9 });
          if (!s.touched) { text(ctx, 'tap a string', 1160, 105, { size: 64, weight: 600 }); const bob = 10 * Math.sin(t * 4); L.arrow(ctx, 1160, 150, 1160, 236 + bob, P.sunDeep, 14); }
        },
        pointer: (s, type, x, y) => {
          // A finger takes a string when it touches within 86 px of it, or comes within 60 px of it while moving, and keeps it until it is more than
          // 100 px away: a finger resting on the border between two strings (or shaking a little) plucks once, a swipe plucks each string it passes.
          if (type === 'down') { s.down = true; s.py = y; s.zone = tgZone(x, y); if (s.zone >= 0) pluckString(s, s.zone, x); }
          else if (type === 'move' && s.down) {
            const z = s.zone;
            if (!(z >= 0 && Math.abs(y - tgY(z)) <= 100 && x > tgX0(z) - 100 && x < TGX1 + 110)) {
              s.zone = -1;
              for (const i of y >= s.py ? [3, 2, 1, 0] : [0, 1, 2, 3]) {                  // in the order the finger meets them (top string first when moving down)
                const ly = tgY(i);
                if (x > tgX0(i) - 50 && x < TGX1 + 60 && (Math.abs(y - ly) < 60 || (ly - s.py) * (ly - y) < 0)) { pluckString(s, i, x); s.zone = i; }
              }
            }
            s.py = y;
          }
          else if (type === 'up') { s.down = false; s.zone = -1; }
        },
        cues: { low: 'A long string wiggles more slowly. A low sound!', high: 'A short string wiggles faster. A high sound!' }
      },
      {
        // ---- Try it 2: tap the drum. Pull the stick back and let go: a small pull = small wiggles (quiet, rice hops a little); a big pull = big wiggles (loud, rice jumps). ----
        title: 'Tap the drum',
        hint: 'Pull the drumstick back and let go. A small pull taps softly; a big pull bangs hard. Watch the rice!',
        init: s => { s.clock = 0; s.drag = false; s.pull = 0; s.swing = false; s.swT = -99; s.swFrom = 0; s.swK = 0; s.hitT = -99; s.hitK = 0; s.hits = 0; s.touched = false; s.lastCue = ''; s.want = ''; s.wantAt = 0; },
        update: (s, dt, cue) => {
          s.clock += dt;
          if (s.swing && s.clock - s.swT >= 0.16) {                                  // the stick reaches the drum
            s.swing = false; s.hitT = s.clock; s.hitK = s.swK; s.pull = 0; s.hits++;
            if (LSC.sound) LSC.sound.drum(0.12 + 0.7 * s.swK);                       // the louder, the bigger the pull
            s.want = s.swK < 0.4 ? 'quiet' : s.swK > 0.7 ? 'loud' : ''; s.wantAt = s.clock + 0.5;   // Curie speaks after the rice has hopped
          }
          if (s.want && s.clock >= s.wantAt) { if (s.lastCue !== s.want) { s.lastCue = s.want; cue(s.want); } s.want = ''; }
        },
        draw: (ctx, s, t) => {
          labBackground(ctx);
          const age = s.clock - s.hitT, hitAge = age < 3 ? age : -1;
          let a = TD_AH - s.pull;                                                    // the stick turns about Curie's shoulder
          if (s.swing) a = TD_AH - s.swFrom * (1 - E.in(clamp((s.clock - s.swT) / 0.16, 0, 1)));
          else if (!s.drag && age >= 0 && age < 0.35) a = TD_AH - 0.12 * Math.sin(age / 0.35 * Math.PI);
          const dip = hitAge >= 0 ? 9 * s.hitK * Math.exp(-hitAge / 0.35) * Math.cos(TAU * 5 * hitAge) : 0;
          drum(ctx, TD.x, TD.y, 1, t, { dip });
          if (hitAge >= 0) hitFx(ctx, TD.x, TD.y, hitAge, s.hitK);
          rice(ctx, TD.x, TD.y, 1, hitAge >= 0 ? { age: hitAge, k: s.hitK } : null);
          // the path of the stick head (a guide), the loudness meter (live while pulling) and its label
          ctx.save(); ctx.strokeStyle = 'rgba(155,107,255,0.55)'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.setLineDash([2, 26]); ctx.beginPath(); ctx.arc(TD_SH.x, TD_SH.y, TD_REACH, TD_AH - PULL_MAX, TD_AH); ctx.stroke(); ctx.restore();
          const level = k => k < 0.4 ? 1 : k < 0.7 ? 2 : 3, lit = s.drag ? level(clamp(s.pull / 1.1, 0.12, 1)) : (hitAge >= 0 && age < 1.8 ? level(s.hitK) : 0);
          meter(ctx, 1680, 420, lit, t); text(ctx, ['', 'quiet', 'louder', 'LOUD!'][lit], 1680, 530, { size: 48, weight: 700, color: lit === 3 ? P.red : P.ink });
          L.pip(ctx, { x: TC.x, y: TC.y, s: TC.s, t, mood: hitAge >= 0 && hitAge < 1.2 && s.hitK > 0.7 ? 'wow' : 'happy', armR: a, armL: 0.6, lookX: 0.8, lookY: -0.2 });
          stick(ctx, TD_SH.x + TD_ARM * Math.cos(a), TD_SH.y + TD_ARM * Math.sin(a), a, TD_REACH - TD_ARM - 4, TC.s);
          if (!s.touched) { text(ctx, 'drag me', 600, 330, { size: 64, weight: 600 }); const bob = 8 * Math.sin(t * 4); L.arrow(ctx, 650, 396, 748, 520 + bob, P.sunDeep, 14); }
        },
        pointer: (s, type, x, y) => {
          if (type === 'down' && !s.swing) {
            const a = TD_AH - s.pull;
            if (Math.hypot(x - (TD_SH.x + TD_REACH * Math.cos(a)), y - (TD_SH.y + TD_REACH * Math.sin(a))) < 150) { s.drag = true; s.touched = true; }
            else if (((x - TD.x) / 300) ** 2 + ((y - TD.y) / 90) ** 2 < 1) drumSwing(s, 0.33);   // a tap on the drum itself is a soft tap ('drag me' stays until the stick is grabbed)
          }
          if (type === 'move' && s.drag) {
            // the pull is the angle of the finger about Curie's shoulder; past the top of the arc (and round to the left) it stays at the maximum, and it only
            // flips back to 0 behind Curie (below and left of her shoulder), where the two ends of the arc are equally far away
            let d = TD_AH - Math.atan2(y - TD_SH.y, x - TD_SH.x); if (d < PULL_MAX / 2 - Math.PI) d += 2 * Math.PI;
            s.pull = clamp(d, 0, PULL_MAX);
          }
          if (type === 'up' && s.drag) { s.drag = false; drumSwing(s, Math.max(0.13, s.pull)); }
        },
        cues: { quiet: 'A small tap makes small wiggles: a quiet sound.', loud: 'A big bang makes big wiggles: a loud sound! Look at the rice jump!' }
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 9 — Why is it dark at night?
   Props: the garden at Curie's house (sky, sun on its arc, stars, moon, lit windows), the Earth seen from above the North Pole
   (sun on the left, sunlit half bright, far half dark, counter-clockwise spin) with Curie's house on the rim, and a small "window"
   onto a house. The video and BOTH Try-it activities use the same functions, so the pictures always agree.
   One number drives everything: psi, the time of day as an angle. psi = 0 midnight, PI/2 sunrise, PI noon, 3PI/2 sunset.
   On screen (y down) the house on the rim sits at angle -psi, so noon is the left (facing the sun), sunset the bottom,
   midnight the right (far side), sunrise the top: the Earth turns counter-clockwise, as seen from above the North Pole. */
(function (global) {
  const L = global.LSC; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};
  const PI = Math.PI, TAU = PI * 2, NAVY = '#1F2A48';

  // ---------- small helpers ----------
  const rgb = c => typeof c === 'string' ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : c;
  const mix = (a, b, p) => { const A = rgb(a), B = rgb(b); return A.map((v, i) => v + (B[i] - v) * p); };
  const css = c => 'rgb(' + c.map(Math.round).join(',') + ')';
  const mixc = (a, b, p) => css(mix(a, b, p));
  const sstep = (a, b, x) => { const p = clamp((x - a) / (b - a), 0, 1); return p * p * (3 - 2 * p); };
  // a smooth curve through keys [time, value, speed] (cubic Hermite): motion never jerks between keys
  function curve(t, K) {
    const n = K.length; if (t <= K[0][0]) return K[0][1]; if (t >= K[n - 1][0]) return K[n - 1][1];
    let i = 0; while (t > K[i + 1][0]) i++;
    const [t0, v0, d0] = K[i], [t1, v1, d1] = K[i + 1], h = Math.max(1e-6, t1 - t0), u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * d0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * d1;
  }

  // ---------- time of day -> sky ----------
  const elev = psi => -Math.cos(psi);                 // sun height: 1 at noon, 0 at sunrise and sunset, -1 at midnight
  const nightOf = psi => sstep(0.0, -0.4, elev(psi)); // 0 in the day .. 1 in the dark
  // sky colours by sun height e: [e, top, bottom]; blended smoothly between neighbours
  const SKYSTOPS = [[-0.35, '#121A3A', '#2A3A72'], [-0.12, '#3E3F8C', '#9A6FB0'], [-0.04, '#8C5AA6', '#F08A9E'], [0.05, '#F58B6A', '#FFD08A'], [0.26, '#F8B8A6', '#FFEBC6'], [0.46, '#C3D3F5', '#F4F2E6'], [0.7, '#9ED3FF', '#CDEBFF']];   // night, blue hour, plum, sunrise, peach, pale, day (never passes through grey)
  function skyCols(e) {
    let i = 0; while (i < SKYSTOPS.length - 2 && e > SKYSTOPS[i + 1][0]) i++;
    const A = SKYSTOPS[i], B = SKYSTOPS[i + 1], p = sstep(A[0], B[0], e);
    return [css(mix(A[1], B[1], p)), css(mix(A[2], B[2], p))];
  }
  const STARS = (() => { const r = L.rng(5), a = []; for (let i = 0; i < 34; i++) a.push([70 + r() * 1780, 50 + r() * 480, 0.6 + r() * 0.8, r() * 6]); return a; })();
  function stars(ctx, t, a) {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = a;
    for (const [x, y, k, ph] of STARS) L.star(ctx, x, y, 12 * k * (0.75 + 0.25 * Math.sin(t * 2 + ph)), '#FFF7C2', t * 0.3 + ph);
    ctx.restore();
  }
  function moon(ctx, x, y, r, a) {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();       // a crescent: the disc without a bite
    ctx.fillStyle = '#FFF7C2'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x - r * 0.5, y - r * 0.36, r * 0.82, 0, TAU, true); ctx.fill();
    ctx.restore();
  }

  // ---------- Curie's house (red roof); lit 0..1 turns the windows on ----------
  function houseD(ctx, x, y, s, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#FFE1A8'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.fillRect(-120, -140, 240, 160); ctx.strokeRect(-120, -140, 240, 160);
    ctx.fillStyle = o.roof || P.red; ctx.beginPath(); ctx.moveTo(-140, -140); ctx.lineTo(0, -240); ctx.lineTo(140, -140); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const wx of [-85, 25]) { ctx.fillStyle = o.lit > 0 ? mixc(P.blue, '#FFE680', o.lit) : P.blue; ctx.fillRect(wx, -100, 60, 60); ctx.strokeRect(wx, -100, 60, 60); }
    ctx.fillStyle = P.brown; roundRect(ctx, -30, -60, 60, 80, 10); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // yellow windows drawn on top of the night shade (so they glow)
  function litWindows(ctx, x, y, s, a) {
    if (a <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
    for (const wx of [-85, 25]) {
      const g = ctx.createRadialGradient(wx + 30, -70, 10, wx + 30, -70, 110); g.addColorStop(0, 'rgba(255,230,128,0.55)'); g.addColorStop(1, 'rgba(255,230,128,0)'); ctx.fillStyle = g; ctx.fillRect(wx - 80, -180, 220, 220);
      ctx.fillStyle = '#FFE680'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.fillRect(wx, -100, 60, 60); ctx.strokeRect(wx, -100, 60, 60);
      ctx.beginPath(); ctx.moveTo(wx + 30, -100); ctx.lineTo(wx + 30, -40); ctx.moveTo(wx, -70); ctx.lineTo(wx + 60, -70); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the garden at Curie's house, for any time of day ----------
  // The sun rides an arc: rises at the left, highest at noon, sets at the right, and the hill hides it in the dark.
  const GARDEN = { cx: 910, rx: 520, ry: 640, hy: 830, houseX: 1690, houseY: 852, houseS: 0.88, treeX: 150 };
  function sunPos(psi) { const a = 1.5 * PI - psi; return { x: GARDEN.cx + Math.cos(a) * GARDEN.rx, y: GARDEN.hy - Math.sin(a) * GARDEN.ry }; }
  // o.curie = options for L.pip (x, y, s, mood, arms ...); o.sun false hides the sun; o.moon false hides the moon
  function garden(ctx, t, psi, o) {
    o = o || {}; const e = elev(psi), nt = nightOf(psi), cols = skyCols(e), sp = sunPos(psi);
    L.sky(ctx, { top: cols[0], bottom: cols[1] });
    if (o.sun !== false) L.sun(ctx, sp.x, sp.y, 105, t);
    if (o.path) sunPath(ctx, o.path);
    L.ground(ctx, 820); L.tree(ctx, GARDEN.treeX, 832, 1.0); houseD(ctx, GARDEN.houseX, GARDEN.houseY, GARDEN.houseS);
    L.fade(ctx, 0.5 * nt, NAVY);                       // the dark: one soft shade over the sky, hill, tree and house
    stars(ctx, t, sstep(-0.05, -0.45, e)); if (o.moon !== false) moon(ctx, 1180, 175, 54, sstep(-0.12, -0.5, e));
    litWindows(ctx, GARDEN.houseX, GARDEN.houseY, GARDEN.houseS, sstep(0.0, -0.4, e));
    if (o.curie) L.pip(ctx, Object.assign({ t, x: 720, y: 720, s: 1.35, bulb: nt }, o.curie));   // Curie keeps her colours: her antenna lights up in the dark
    return { sun: sp, e, night: nt };
  }
  // the sun with its eyes shut and a night cap: the wrong idea ("the sun goes to sleep"), shown gently
  function sleepySun(ctx, x, y, r, t, a) {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = Math.min(1, a);
    L.sun(ctx, x, y, r, t, { face: false });
    ctx.strokeStyle = P.ink; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sx * r * 0.32, y - r * 0.12, r * 0.15, 0.1 * PI, 0.9 * PI); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.3, r * 0.1, r * 0.08, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = P.blue; ctx.strokeStyle = P.ink; ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(x - r * 0.75, y - r * 0.5); ctx.quadraticCurveTo(x - r * 0.1, y - r * 1.5, x + r * 0.95, y - r * 1.05); ctx.lineTo(x + r * 0.72, y - r * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
    circle(ctx, x + r * 0.95, y - r * 1.05, r * 0.17, P.white, P.ink, r * 0.06);
    for (let i = 0; i < 3; i++) { const f = (t * 0.5 + i / 3) % 1; ctx.globalAlpha = Math.min(1, a) * (1 - f); text(ctx, 'z', x + r * (1.1 + 0.3 * i + 0.2 * f), y - r * (0.1 + 0.55 * f + 0.35 * i), { size: r * (0.3 + 0.12 * i), weight: 700, color: P.white, stroke: P.ink, strokeWidth: r * 0.08 }); }
    ctx.restore();
  }

  // ---------- space and the Earth seen from above the North Pole ----------
  function space(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0B1030'); g.addColorStop(1, '#1E2A5E'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = L.rng(11);
    for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * H, ph = r() * 6, k = 0.5 + r() * 0.8; L.star(ctx, x, y, 7 * k * (0.75 + 0.25 * Math.sin(t * 2 + ph)), 'rgba(255,255,255,0.75)', t * 0.2 + ph); }
  }
  // continents: [x, y, rx, ry, rotation] in the Earth's own frame, as fractions of the radius
  const LAND = [[-0.36, -0.36, 0.30, 0.19, 0.5], [-0.05, -0.64, 0.17, 0.11, -0.3], [0.38, -0.30, 0.24, 0.15, 0.9], [0.46, 0.18, 0.2, 0.28, 0.2], [-0.05, 0.1, 0.2, 0.15, -0.5], [-0.42, 0.42, 0.26, 0.15, -0.3], [0.1, 0.64, 0.16, 0.1, 0.4], [-0.68, 0.02, 0.1, 0.17, 0.1]];
  // The Earth at (cx, cy), radius R. psi turns it (counter-clockwise); dark 0..1 = how much the far half is shaded.
  function earthTop(ctx, t, cx, cy, R, psi, o) {
    o = o || {}; const dark = o.dark == null ? 1 : o.dark;
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.save(); ctx.clip();
    ctx.fillStyle = o.base || P.blue; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    ctx.save(); ctx.rotate(-psi); if (o.surface) o.surface(ctx, R); else { ctx.fillStyle = '#6FCB7F'; ctx.strokeStyle = '#3F9F59'; ctx.lineWidth = Math.max(2, R * 0.02);
    for (const [x, y, rx, ry, rot] of LAND) {
      ctx.beginPath(); ctx.ellipse(x * R, y * R, rx * R, ry * R, rot, 0, TAU); ctx.ellipse(x * R + rx * R * 0.7 * Math.cos(rot), y * R + rx * R * 0.7 * Math.sin(rot) - ry * R * 0.25, rx * R * 0.55, ry * R * 0.8, rot + 0.4, 0, TAU);
      ctx.fill(); ctx.stroke();
    } }
    ctx.restore();
    const aL = o.shadeL || 0, aR = Math.max(aL, 0.76 * dark);
    if (aR > 0) { const g = ctx.createLinearGradient(-0.1 * R, 0, 0.14 * R, 0); g.addColorStop(0, 'rgba(16,24,58,' + aL + ')'); g.addColorStop(1, 'rgba(16,24,58,' + aR + ')'); ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(4, R * 0.03); ctx.stroke();
    circle(ctx, 0, 0, R * 0.045, P.white, P.ink, Math.max(2, R * 0.015));      // the pole: the Earth spins around this dot
    ctx.restore();
  }
  // Curie's house as a round badge pinned on the rim (b = 0), or the house on the other side of the world (b = PI).
  // The badge shows that place's sky: blue in the lit half, dark with a lit window in the dark half.
  function rimHouse(ctx, t, cx, cy, R, psi, b, o) {
    o = o || {}; const a = o.a == null ? 1 : o.a; if (a <= 0) return;
    const ang = -psi + b, x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R, rb = Math.max(34, o.rb || 0.24 * R) * E.outBack(clamp(a, 0, 1));
    const nt = clamp((Math.cos(ang) - 0.03) / 0.2, 0, 1);       // 0 in the lit half .. 1 in the dark half
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, rb, 0, TAU); ctx.clip();
    ctx.fillStyle = css(mix('#9ED3FF', '#1B2552', nt)); ctx.fillRect(-rb, -rb, 2 * rb, 2 * rb);
    ctx.fillStyle = css(mix(P.ground, '#2F4A5E', nt)); ctx.fillRect(-rb, rb * 0.4, 2 * rb, rb);
    if (nt > 0.1) { ctx.globalAlpha = nt; L.star(ctx, -rb * 0.55, -rb * 0.5, rb * 0.13, '#FFF7C2', t); L.star(ctx, rb * 0.5, -rb * 0.6, rb * 0.1, '#FFF7C2', -t); ctx.globalAlpha = 1; }
    houseD(ctx, 0, rb * 0.5, rb * 0.0054, { roof: o.roof, lit: nt });
    ctx.restore();
    circle(ctx, 0, 0, rb, null, P.ink, 6);
    if (o.ring > 0) circle(ctx, 0, 0, rb + 11 + 3 * Math.sin(t * 5), null, o.ringColor || P.red, 7);
    ctx.restore();
    return { x, y, ang, night: Math.cos(ang) > 0 };
  }
  // light from the sun (left) reaching the Earth; k < 1 draws a smaller set (the little inset)
  function rays(ctx, t, x0f, cx, cy, R, a, k) {
    if (a <= 0) return; k = k || 1; ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
    for (let n = -2; n <= 2; n++) {
      const dy = n * 84 * k; if (Math.abs(dy) > R * 0.8) continue; const y = cy + dy, x0 = typeof x0f === 'function' ? x0f(y) : x0f, x1 = cx - Math.sqrt(Math.max(0, R * R - dy * dy)) - 24 * k;
      ctx.strokeStyle = 'rgba(255,214,70,0.85)'; ctx.lineWidth = 11 * k; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      const f = (t * 0.55 + n * 0.17 + 5) % 1, ax = lerp(x0 + 50 * k, x1, f); L.arrow(ctx, ax - 40 * k, y, ax, y, '#FFB020', 11 * k);
    }
    ctx.restore();
  }
  // The sun is far bigger than the Earth: a huge disc cut off by the edge of the picture (its light still comes from the left).
  // S = {x, y, r}; o.p (0..1) slides it in from the left; o.face = {x, y, s} draws a smile on the part we can see; o.halo and o.line = glow size and outline width.
  function bigSun(ctx, t, S, o) {
    o = o || {}; const p = o.p == null ? 1 : Math.min(1, o.p); if (p <= 0) return; const lw = o.line || 16;
    ctx.save(); ctx.translate(-(1 - p) * (o.slide || 420), 0);
    const h = o.halo || 230, g = ctx.createRadialGradient(S.x, S.y, S.r, S.x, S.y, S.r + h);
    g.addColorStop(0, 'rgba(255,200,60,0.5)'); g.addColorStop(0.4, 'rgba(255,190,60,0.2)'); g.addColorStop(1, 'rgba(255,190,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(S.x, S.y, S.r + h, 0, TAU); ctx.fill();
    circle(ctx, S.x, S.y, S.r, P.sun, P.sunDeep, lw);
    ctx.save(); ctx.beginPath(); ctx.arc(S.x, S.y, S.r - lw / 2, 0, TAU); ctx.clip();            // a lighter patch, so that it looks round
    const gx = S.x + S.r * 0.62, gy = S.y - S.r * 0.12, g2 = ctx.createRadialGradient(gx, gy, S.r * 0.02, gx, gy, S.r * 0.62);
    g2.addColorStop(0, 'rgba(255,246,170,0.6)'); g2.addColorStop(1, 'rgba(255,246,170,0)'); ctx.fillStyle = g2; ctx.fillRect(S.x - S.r, S.y - S.r, 2 * S.r, 2 * S.r);
    ctx.restore();
    if (o.face) {
      const f = o.face;
      circle(ctx, f.x - f.s * 0.3, f.y - f.s * 0.15, f.s * 0.08, P.ink); circle(ctx, f.x + f.s * 0.3, f.y - f.s * 0.15, f.s * 0.08, P.ink);
      ctx.strokeStyle = P.ink; ctx.lineWidth = f.s * 0.07; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(f.x, f.y + f.s * 0.1, f.s * 0.35, 0.15 * PI, 0.85 * PI); ctx.stroke();
      circle(ctx, f.x - f.s * 0.45, f.y + f.s * 0.15, f.s * 0.1, 'rgba(255,120,120,0.5)'); circle(ctx, f.x + f.s * 0.45, f.y + f.s * 0.15, f.s * 0.1, 'rgba(255,120,120,0.5)');
    }
    ctx.restore();
  }
  // a track round the Earth: the day half yellow, the night half dark; dp/np = how much of each has been drawn (0..1)
  function dayNightTrack(ctx, cx, cy, R, dp, np) {
    ctx.save(); ctx.translate(cx, cy); ctx.lineWidth = 20; ctx.lineCap = 'butt';
    if (dp > 0) { ctx.strokeStyle = P.sun; ctx.beginPath(); ctx.arc(0, 0, R + 18, -PI / 2, -PI / 2 - PI * dp, true); ctx.stroke(); }
    if (np > 0) { ctx.strokeStyle = '#6B74D8'; ctx.beginPath(); ctx.arc(0, 0, R + 18, PI / 2, PI / 2 - PI * np, true); ctx.stroke(); }
    ctx.restore();
  }
  // curved arrow round the Earth: the spin direction (counter-clockwise on screen)
  function spinArrow(ctx, cx, cy, R, a, t, gap) {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy);
    const r = R + (gap == null ? 52 : gap), a0 = 2.35, a1 = 0.65, ph = 0.1 * Math.sin(t * 2);          // from the lower left, round the bottom (screen angles decrease = counter-clockwise)
    ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r, a0 + ph, a1 + ph, true); ctx.stroke();
    const ea = a1 + ph, ex = Math.cos(ea) * r, ey = Math.sin(ea) * r, d = ea - PI / 2;   // arrow head tangent to the circle, pointing counter-clockwise
    ctx.fillStyle = P.sunDeep; ctx.beginPath(); ctx.moveTo(ex + Math.cos(d) * 34, ey + Math.sin(d) * 34); ctx.lineTo(ex + Math.cos(d + 2.4) * 34, ey + Math.sin(d + 2.4) * 34); ctx.lineTo(ex + Math.cos(d - 2.4) * 34, ey + Math.sin(d - 2.4) * 34); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- a round "window" onto a house: the sky and the lights at that time of day ----------
  function porthole(ctx, t, x, y, r, psi, o) {
    o = o || {}; const e = elev(psi), nt = nightOf(psi), cols = skyCols(e), hor = y + r * 0.34;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    const g = ctx.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    const a = 1.5 * PI - psi; L.sun(ctx, x + Math.cos(a) * r * 0.66, hor - Math.sin(a) * r * 0.95, r * 0.2, t, { face: false });
    ctx.fillStyle = mixc(P.ground, NAVY, nt * 0.7); ctx.fillRect(x - r, hor, 2 * r, 2 * r);
    const hs = r * 0.0024, hx = x + r * 0.05, hyy = hor + r * 0.34; houseD(ctx, hx, hyy, hs);
    ctx.fillStyle = 'rgba(31,42,72,' + (0.42 * nt) + ')'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); litWindows(ctx, hx, hyy, hs, nt);
    if (nt > 0.05) {
      ctx.globalAlpha = nt; L.star(ctx, x - r * 0.5, y - r * 0.55, r * 0.1, '#FFF7C2', t); L.star(ctx, x + r * 0.45, y - r * 0.6, r * 0.08, '#FFF7C2', -t); L.star(ctx, x - r * 0.1, y - r * 0.8, r * 0.07, '#FFF7C2', t * 0.5);
      moon(ctx, x - r * 0.58, y - r * 0.22, r * 0.17, 1);
      for (let i = 0; i < 3; i++) { const f = (t * 0.45 + i / 3) % 1; ctx.globalAlpha = nt * (1 - f); text(ctx, 'z', x + r * (0.18 + 0.2 * i + 0.1 * f), y - r * (0.0 + 0.35 * f + 0.14 * i), { size: r * (0.2 + 0.07 * i), weight: 700, color: P.white, stroke: P.ink, strokeWidth: r * 0.05 }); }
    }
    ctx.restore();
    circle(ctx, x, y, r + 5, null, P.ink, 6); circle(ctx, x, y, r - 4, null, o.ring || P.red, 11);
  }
  // a child asleep in bed with the moon at the window: night on the other side of the world (round window)
  function bedroom(ctx, t, x, y, r, o) {
    o = o || {}; ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.fillStyle = '#2A3A72'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.fillStyle = '#222F5E'; ctx.fillRect(x - r, y + r * 0.42, 2 * r, r);
    ctx.fillStyle = '#12193A'; roundRect(ctx, x - r * 0.62, y - r * 0.8, r * 0.62, r * 0.62, r * 0.06); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.stroke();
    moon(ctx, x - r * 0.38, y - r * 0.5, r * 0.15, 1); L.star(ctx, x - r * 0.2, y - r * 0.68, r * 0.05, '#FFF7C2', t);
    ctx.fillStyle = P.white; roundRect(ctx, x - r * 0.35, y + r * 0.1, r * 0.55, r * 0.26, r * 0.1); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.stroke();   // pillow
    circle(ctx, x - r * 0.1, y + r * 0.1, r * 0.2, '#F2C9A0', P.ink, 5);                                                                                       // head
    ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(x - r * 0.1 + sx * r * 0.075, y + r * 0.1, r * 0.04, 0.15 * PI, 0.85 * PI); ctx.stroke(); }
    ctx.fillStyle = P.blue; roundRect(ctx, x - r * 0.62, y + r * 0.2, r * 1.3, r * 0.42, r * 0.1); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.stroke(); // blanket
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - r * 0.45, y + r * 0.34); ctx.lineTo(x + r * 0.5, y + r * 0.34); ctx.stroke();
    for (let i = 0; i < 3; i++) { const f = (t * 0.45 + i / 3) % 1; ctx.globalAlpha = 1 - f; text(ctx, 'z', x + r * (0.3 + 0.18 * i + 0.1 * f), y - r * (0.05 + 0.3 * f + 0.14 * i), { size: r * (0.2 + 0.07 * i), weight: 700, color: P.white, stroke: P.ink, strokeWidth: r * 0.05 }); }
    ctx.restore();
    circle(ctx, x, y, r + 5, null, P.ink, 6); circle(ctx, x, y, r - 4, null, o.ring || P.purple, 11);
  }

  // ---------- scene pieces ----------
  const ES = { cx: 960, cy: 410, R: 250 };   // the Earth scene: the Earth in the middle
  // The sun is far bigger than the Earth (and very far away): a huge disc cut off by the left edge of the picture. Its light still comes from the left.
  const SUN = { x: -190, y: 410, r: 500 }, SUNFACE = { x: 150, y: 400, s: 190 };
  const sunEdge = y => SUN.x + Math.sqrt(Math.max(0, SUN.r * SUN.r - (y - SUN.y) * (y - SUN.y))) + 24;      // where the light rays start at height y
  const CURIE = { x: 340, y: 765, s: 0.78 };                                                                  // Curie watches from the lower left, clear of the sun
  const dayNight = psi => (elev(psi) > 0 ? 'Day!' : 'Night!');

  // a little night picture for the thought bubble of the question: a house under the moon and stars
  function nightCard(c, tt) {
    c.save(); roundRect(c, -260, -170, 520, 340, 40); c.clip();
    const g = c.createLinearGradient(0, -170, 0, 170); g.addColorStop(0, '#121A3A'); g.addColorStop(1, '#2A3A72'); c.fillStyle = g; c.fillRect(-260, -170, 520, 340);
    L.star(c, -170, -110, 15, '#FFF7C2', tt); L.star(c, 20, -128, 11, '#FFF7C2', -tt); L.star(c, 200, -30, 12, '#FFF7C2', tt * 0.7); L.star(c, -80, -30, 9, '#FFF7C2', tt);
    moon(c, 150, -95, 46, 1); c.fillStyle = '#2F4A5E'; c.fillRect(-260, 100, 520, 90);
    houseD(c, -30, 125, 0.85); litWindows(c, -30, 125, 0.85, 1);
    c.restore(); roundRect(c, -260, -170, 520, 340, 40); c.strokeStyle = P.ink; c.lineWidth = 7; c.stroke();
  }

  // The garden day: evening, night, morning, and then the morning goes on slowly while Curie asks if the sun sleeps.
  function gardenPsi(t, Lt) {
    return curve(t, [
      [Lt.start('evening'), 4.38, 0.25], [Lt.chunk('evening', 'and down') + 0.3, 4.712, 0.2], [Lt.chunk('evening', 'and it gets dark') + 0.3, 5.1, 0.35], [Lt.chunk('evening', 'good night'), 5.5, 0.3],
      [Lt.start('morning'), 6.4, 0.35], [Lt.chunk('morning', 'the sun comes up'), 7.8, 0.9], [Lt.chunk('morning', 'good morning'), 8.55, 0.4],
      [Lt.end('morning'), 8.75, 0.06], [Lt.start('earth'), 9.1, 0.06]
    ]);
  }
  function eveningScene(ctx, t, Lt) {
    const psi = gardenPsi(t, Lt), up = Lt.cafter('morning', 'the sun comes up'), gm = Lt.cafter('morning', 'good morning');
    const yawn = Lt.cafter('evening', 'good night') && !Lt.after('morning');
    const curie = yawn ? { mood: 'wow', blink: 1, armR: 0.6, armL: 0.6, lookX: 0.2 }
      : gm ? { mood: 'wow', armR: -1.2, armL: -1.2, lookX: -0.5, lookY: -0.5 }
        : up ? { mood: 'talk', armR: -0.9, armL: 0.6, lookX: -0.8, lookY: -0.4 }
          : Lt.after('morning') ? { mood: 'talk', armR: 0.5, armL: 0.6, lookX: 0.1 }
            : { mood: 'talk', armR: -0.5, armL: 0.6, lookX: 0.8, lookY: Lt.cafter('evening', 'and it gets dark') ? -0.6 : -0.1 };
    garden(ctx, t, psi, { curie });
    const ev = Lt.cwin('evening', "it's evening", 0.5, null, 0.2) * (1 - Lt.cwin('evening', 'and it gets dark', 0.3));
    L.sticker(ctx, 'evening', 560, 180, ev, { bg: '#F7A26B', size: 84, rot: -0.06 });
    L.sticker(ctx, 'dark', 560, 180, Lt.cwin('evening', 'and it gets dark', 0.5) * (1 - Lt.win('morning', 0, 0.3)), { bg: '#3B4BA8', color: P.white, size: 88, rot: 0.05 });
    L.sticker(ctx, 'morning', 1540, 190, Lt.cwin('morning', 'in the morning', 0.5, null, 0.3), { bg: P.sun, size: 84, rot: -0.05 });
  }

  // "Does the sun go to sleep?" then the garden shrinks into a round picture that flies away: up into space.
  const GARDEN_FOCUS = [960, 540];
  // more sky above and at the sides, more grass below the garden picture: the shrinking picture is then always a full round window.
  // The extra pieces run 60 px UNDER the garden's own edges (the garden is drawn on top), so no hairline seam shows where they meet.
  function gardenExtend(ctx, psi) {
    const cols = skyCols(elev(psi)), m = 2400, wide = W + 2 * m, o = 60;
    ctx.fillStyle = cols[0]; ctx.fillRect(-m, -m, wide, m + o);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); ctx.fillStyle = g; ctx.fillRect(-m, 0, m + o, H); ctx.fillRect(W - o, 0, m + o, H);
    ctx.fillStyle = P.ground; ctx.fillRect(-m, 860, m + o, H - 860); ctx.fillRect(W - o, 810, m + o, H - 810);
    ctx.fillStyle = P.groundDark; ctx.fillRect(-m, H - 90, wide, 90 + m);
  }
  function whyScene(ctx, t, Lt) {
    const psi = gardenPsi(t, Lt), z = Lt.cwin('why', "let's fly up", 3.6, E.inOut);
    const bp = Lt.cwin('why', 'does the sun go', 0.6) * (1 - Lt.cwin('why', "let's fly up", 0.5));
    const curie = { mood: Lt.cafter('why', 'and find out') ? 'wow' : Lt.cafter('why', "let's fly up") ? 'talk' : 'think', armR: -0.9, armL: 0.6, lookX: 0.6, lookY: -0.6 };
    if (z <= 0) {
      garden(ctx, t, psi, { curie });
      L.thoughtBubble(ctx, 1230, 380, 700, 480, bp, 1);
      if (bp > 0.5) { sleepySun(ctx, 1200, 430, 118, t, 1); L.questionMark(ctx, 1520, 300, 1 + 0.1 * Math.sin(t * 3), t); }
      return;
    }
    space(ctx, t);
    const cx = lerp(960, ES.cx, z), cy = lerp(540, ES.cy, z), r = lerp(1300, ES.R, z), s = lerp(1, ES.R / 760, z);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-GARDEN_FOCUS[0], -GARDEN_FOCUS[1]);
    gardenExtend(ctx, psi);
    garden(ctx, t, psi, { curie });
    ctx.fillStyle = P.groundDark; ctx.fillRect(-2400, H - 6, W + 4800, 2600);       // the dark grass band again, over the garden's bottom edge (no light hairline while it shrinks)
    ctx.restore();
    circle(ctx, cx, cy, r, null, P.ink, lerp(8, 8, z));
  }

  // The time of day for the whole space scene: the house on the rim (and the continents) follow it.
  function earthPsi(t, Lt) {
    const sp = Lt.chunk('spin', 'and our earth'), hs = Lt.start('house'), tn = Lt.chunk('turn', 'the earth turns'), ni = Lt.chunk('turn', "it's night"), te = Lt.end('turn'),
      l0 = Lt.chunk('oneday', 'one whole spin') + 0.45, l1 = Lt.chunk('oneday', 'and one night') + 0.05, l2 = Lt.chunk('oneday', 'then it starts') + 0.35, ot = Lt.start('other'), sk = Lt.start('sky');
    return curve(t, [[sp, -0.9, 0], [hs, PI - 0.2, 0.12], [tn, PI + 0.15, 0.16], [ni, TAU, 0.45], [te, TAU + 0.5, 0.25], [l0, 2.5 * PI, 1.6], [l1, 3.5 * PI, 1.6], [l2, 4.5 * PI, 1.6], [ot, 5 * PI, 0.12], [sk, 5 * PI + 0.8, 0.12]]);
  }
  // the spot of the round windows on the right of the space scene
  const PH = { x: 1560, y1: 235, y2: 625, r: 120 };
  function pop(ctx, x, y, p, fn) { if (p <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.translate(-x, -y); fn(); ctx.restore(); }
  function dnSticker(ctx, psi, x, y, p, size) { L.sticker(ctx, dayNight(psi), x, y, p, { bg: elev(psi) > 0 ? P.sun : '#3B4BA8', color: elev(psi) > 0 ? P.ink : P.white, size: size || 56, rot: 0.04 }); }

  function earthScene(ctx, t, Lt) {
    const { cx, cy, R } = ES, psi = earthPsi(t, Lt), A = (id, n, d, o) => Lt.cwin(id, n, d || 0.5, null, o || 0);
    space(ctx, t);
    const sunP = Lt.cwin('earth', 'and here is the sun', 0.7, E.outBack), lit = A('earth', 'and here is the sun', 1.0);
    rays(ctx, t, sunEdge, cx, cy, R, A('earth', 'and here is the sun', 0.8, 0.5));
    bigSun(ctx, t, SUN, { p: sunP, face: SUNFACE });
    // the lit half and the dark half, as a track round the Earth (and the road the house will travel)
    dayNightTrack(ctx, cx, cy, R, A('half', 'that side has day', 0.7), A('half', 'it has night', 0.7));
    earthTop(ctx, t, cx, cy, R, psi, { dark: lit });
    spinArrow(ctx, cx, cy, R, A('spin', 'and our earth', 0.5, 0.3) * (1 - A('house', 'look', 0.4)), t);
    // Curie's house on the rim, and the house on the other side of the world
    const hp = A('house', "here's curie's house", 0.5), op = A('other', "it's night for children", 0.5);
    rimHouse(ctx, t, cx, cy, R, psi, 0, { a: hp, ring: hp });
    rimHouse(ctx, t, cx, cy, R, psi, PI, { a: op, ring: op, roof: P.purple, ringColor: P.purple });
    // round windows on the right: Curie's garden now, and a bedroom on the other side
    pop(ctx, PH.x, PH.y1, Lt.cwin('house', 'right now it faces', 0.5, E.outBack), () => porthole(ctx, t, PH.x, PH.y1, PH.r, psi, { ring: P.red }));
    const gp = Lt.cwin('house', 'right now it faces', 0.4, null, 0.3); dnSticker(ctx, psi, PH.x, PH.y1 + PH.r + 62, gp, 56);
    pop(ctx, PH.x, PH.y2, Lt.cwin('other', "it's night for children", 0.5, E.outBack, 0.3), () => bedroom(ctx, t, PH.x, PH.y2, PH.r, { ring: P.purple }));
    L.sticker(ctx, 'Night!', PH.x, PH.y2 + PH.r + 56, A('other', "it's night for children", 0.4, 0.8), { bg: '#3B4BA8', color: P.white, size: 52, rot: -0.04 });
    // stickers, one at a time in the same spot
    const gone = id => 1 - Lt.cwin(id, id === 'half' ? 'the sun can only' : 'one whole spin', 0.3);
    L.sticker(ctx, 'Earth', cx, 100, A('earth', 'here is our earth', 0.5, 0.5) * (1 - A('half', 'the sun can only', 0.3)), { bg: P.blue, color: P.white, size: 72, rot: -0.04 });
    L.sticker(ctx, 'Sun', 520, 150, A('earth', 'and here is the sun', 0.5, 0.4) * (1 - A('earth', "the sun doesn't", 0.3)), { bg: P.sun, size: 72, rot: -0.05 });
    L.sticker(ctx, 'awake!', 520, 150, A('earth', "the sun doesn't") * (1 - A('earth', 'it keeps on shining', 0.3)), { bg: P.green, color: P.white, size: 72, rot: 0.05 });
    L.sticker(ctx, 'shining!', 520, 150, A('earth', 'it keeps on shining') * gone('half'), { bg: P.sun, size: 72, rot: -0.04 });
    L.sticker(ctx, 'DAY', cx - 0.54 * R, cy - 20, A('half', 'that side has day', 0.5, 0.2) * (1 - A('spin', 'and our earth', 0.4)), { bg: P.sun, size: 56, rot: -0.05 });
    L.sticker(ctx, 'NIGHT', cx + 0.52 * R, cy - 20, A('half', 'it has night', 0.5, 0.0) * (1 - A('spin', 'and our earth', 0.4)), { bg: '#3B4BA8', color: P.white, size: 52, rot: 0.05 });
    L.sticker(ctx, "Curie's house", 610, 170, A('house', "here's curie's house", 0.5, 0.3) * (1 - A('turn', 'the earth turns', 0.3)), { bg: P.red, color: P.white, size: 52, rot: -0.04 });
    L.sticker(ctx, 'still shining!', 500, 140, A('turn', 'the sun is still shining') * gone('oneday'), { bg: P.sun, size: 60, rot: -0.04 });
    const dn = Lt.cwin('other', 'so when', 0.3);
    L.sticker(ctx, 'one day', 650, 770, A('oneday', 'one whole spin', 0.5, 1.0) * (1 - dn), { bg: P.sun, size: 64, rot: -0.04 });
    L.sticker(ctx, 'one night', 1400, 700, A('oneday', 'and one night') * (1 - dn), { bg: '#3B4BA8', color: P.white, size: 64, rot: 0.04 });
    L.sticker(ctx, 'again!', cx, 775, A('oneday', 'then it starts') * (1 - dn), { bg: P.green, color: P.white, size: 72, rot: 0.04 });
    // Curie watches from the corner
    const mood = Lt.cafter('turn', "it's night") && !Lt.after('oneday') ? 'wow' : 'talk';
    L.pip(ctx, { x: CURIE.x, y: CURIE.y, s: CURIE.s, t, mood, armR: -0.5, armL: 0.6, lookX: 0.9, lookY: -0.3 });
  }

  // the little top-view Earth in a corner panel (video "sky" scene and Try it 2)
  const INSET = { x: 1440, y: 30, w: 440, h: 400, cx: 1698, cy: 235, R: 125, sun: { x: 1110, y: 235, r: 400 } };   // (the Earth sits left of centre so the house badge never touches the right edge)
  function insetEarth(ctx, t, psi, o) {
    o = o || {}; const I = INSET;
    ctx.save(); roundRect(ctx, I.x, I.y, I.w, I.h, 36); ctx.fillStyle = '#16204A'; ctx.fill(); ctx.save(); ctx.clip();
    const r = L.rng(3); for (let i = 0; i < 16; i++) L.star(ctx, I.x + r() * I.w, I.y + r() * I.h, 4 + 4 * r(), 'rgba(255,255,255,0.7)', t * 0.2 + i);
    rays(ctx, t, y => I.sun.x + Math.sqrt(Math.max(0, I.sun.r * I.sun.r - (y - I.sun.y) * (y - I.sun.y))) + 14, I.cx, I.cy, I.R, 1, 0.42);
    bigSun(ctx, t, I.sun, { halo: 110, line: 8 });                                  // the sun is far bigger than the Earth: we only see its edge
    if (o.sunRing > 0) circle(ctx, I.sun.x, I.sun.y, I.sun.r + 12 + 3 * Math.sin(t * 5), null, P.red, 6);
    earthTop(ctx, t, I.cx, I.cy, I.R, psi, { dark: 1 });
    spinArrow(ctx, I.cx, I.cy, I.R * 0.9, o.arrow || 0, o.wiggle ? t * 9 : t);
    rimHouse(ctx, t, I.cx, I.cy, I.R, psi, 0, { ring: 1 });
    ctx.restore(); roundRect(ctx, I.x, I.y, I.w, I.h, 36); ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.stroke(); ctx.restore();
  }
  // the dotted path the sun seems to follow in the garden sky
  function sunPath(ctx, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([10, 18]); ctx.strokeStyle = 'rgba(43,45,66,0.4)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(GARDEN.cx, GARDEN.hy, GARDEN.rx, GARDEN.ry, 0, PI, TAU); ctx.stroke(); ctx.restore();
  }

  // "In the garden the sun seems to move ... but we are turning": the garden, and the Earth turning in the corner
  function skyPsi(t, Lt) {
    const k0 = Lt.start('sky'), tn = Lt.chunk('sky', 'the sun seems') + 2.2, ts = Lt.chunk('sky', 'and go down') + 1.25;
    return curve(t, [[k0, 1.4, 0.8], [tn, PI, 0.8], [ts, 1.5 * PI, 0.8], [Lt.end('sky'), 7.8, 0.6]]);
  }
  function skyScene(ctx, t, Lt) {
    const psi = skyPsi(t, Lt), sp = sunPos(psi), up = elev(psi) > 0, spins = Lt.cafter('sky', 'the earth spins');
    const curie = { mood: spins ? 'wow' : 'talk', armR: spins ? -1.3 : -0.5, armL: 0.6, lookX: up ? clamp((sp.x - 720) / 500, -1, 1) : 0.4, lookY: up ? -0.5 : -0.2 };
    garden(ctx, t, psi, { curie, path: 0.9 });
    const ip = Lt.cwin('sky', 'in the garden', 0.5, E.outBack, 0.2), stays = Lt.cwin('sky', "isn't really going up", 0.5);
    pop(ctx, INSET.x + INSET.w / 2, INSET.y + INSET.h / 2, ip, () => insetEarth(ctx, t, psi, { sunRing: stays * (1 - Lt.cwin('sky', 'we are turning', 0.3)), arrow: Lt.cwin('sky', 'we are turning', 0.6) }));
    L.sticker(ctx, 'sun stays!', 1550, 520, stays * (1 - Lt.cwin('sky', 'we are turning', 0.3)), { bg: P.sun, size: 60, rot: -0.04 });
    L.sticker(ctx, 'we turn!', 1550, 520, Lt.cwin('sky', 'we are turning', 0.5) * (1 - Lt.cwin('sky', 'the earth spins', 0.3)), { bg: P.pink, size: 64, rot: 0.04 });
    L.sticker(ctx, 'Earth spins!', 1550, 520, Lt.cwin('sky', 'the earth spins', 0.5), { bg: '#3B4BA8', color: P.white, size: 56, rot: -0.04 });
  }
  function sayitScene(ctx, t, Lt) {
    const psi = curve(t, [[Lt.start('sayit'), 7.7, 0.3], [Lt.end('sayit') + 1.4, 8.1, 0.2]]);
    garden(ctx, t, psi, { curie: { mood: 'talk', armR: Lt.cafter('sayit', 'the earth spins') ? -1.3 : -0.35, armL: 0.6, lookX: 0.3 } });
    L.sayItSticker(ctx, 'The Earth spins!', Lt.cwin('sayit', 'the earth spins', 0.8), t);
  }

  // ---------- at home: a torch and a ball on a table, seen from above (the same picture as space) ----------
  const HOME = { bx: 1100, by: 520, br: 170, tx: 500, ty: 520 };
  function ballSurface(c, R) {          // an orange ball with white stripes, drawn in the ball's own (turning) frame
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = R * 0.11; c.lineCap = 'round';
    c.beginPath(); c.arc(-R * 0.62, 0, R * 0.8, -0.85, 0.85); c.stroke(); c.beginPath(); c.arc(R * 0.62, 0, R * 0.8, PI - 0.85, PI + 0.85); c.stroke();
    for (const [x, y] of [[0, -0.55], [0.12, 0.5], [-0.1, 0.05]]) circle(c, x * R, y * R, R * 0.07, '#FFE680');
  }
  // an eye with a red "no" sign: never shine a torch in eyes
  function noEye(ctx, x, y, r, p) {
    if (p <= 0) return; ctx.save(); ctx.translate(x, y); const s = E.outBack(clamp(p, 0, 1)); ctx.scale(s, s);
    circle(ctx, 0, 0, r, P.white, P.ink, 7);
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-r * 0.62, 0); ctx.quadraticCurveTo(0, -r * 0.62, r * 0.62, 0); ctx.quadraticCurveTo(0, r * 0.62, -r * 0.62, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    circle(ctx, 0, 0, r * 0.2, P.blue, P.ink, 5); circle(ctx, 0, 0, r * 0.09, P.ink);
    ctx.strokeStyle = P.red; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r - 4, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.68, -r * 0.68); ctx.lineTo(r * 0.68, r * 0.68); ctx.stroke();
    ctx.restore();
  }
  function tryScene(ctx, t, Lt) {
    const { bx, by, br, tx, ty } = HOME, dark = Lt.cwin('try2', 'make the room dark', 0.8, E.inOut), on = Lt.cwin('try2', 'shine the torch', 0.6, null, 0.1);
    ctx.fillStyle = mixc('#E8C48C', '#1F2542', dark); ctx.fillRect(0, 0, W, H);           // the table seen from above; the room goes dark
    ctx.strokeStyle = mixc('#D2A96C', '#262C50', dark); ctx.lineWidth = 6; for (let x = 0; x <= W; x += 240) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    if (on > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(tx + 55, 0, bx - br, 0); g.addColorStop(0, 'rgba(255,214,90,' + 0.5 * on + ')'); g.addColorStop(1, 'rgba(255,214,90,' + 0.16 * on + ')');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tx + 55, ty - 14); ctx.lineTo(bx, by - br); ctx.lineTo(bx, by + br); ctx.lineTo(tx + 55, ty + 14); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    const tp = Lt.cwin('try1', 'ask a grown-up', 0.6, E.outBack, 1.2), bp = Lt.cwin('try1', 'ask a grown-up', 0.6, E.outBack, 1.6), hp = Lt.cwin('try1', 'put a sticker', 0.5);
    pop(ctx, tx - 100, ty, tp, () => L.torch(ctx, tx, ty, 0, on > 0.5, 1.3));
    const psi = curve(t, [[Lt.chunk('try2', 'turn the ball'), 3.4, 0.3], [Lt.chunk('try2', 'when is it night') - 0.25, 4.72, 0.4], [Lt.end('try2'), 5.7, 0.4]]);
    pop(ctx, bx, by, bp, () => earthTop(ctx, t, bx, by, br, psi, { base: '#FF9B3F', surface: ballSurface, dark: on, shadeL: 0.55 * dark * (1 - on) }));
    rimHouse(ctx, t, bx, by, br, psi, 0, { a: hp, ring: hp, ringColor: P.sun });
    const turn = Lt.cwin('try2', 'turn the ball', 0.6, E.outBack);
    spinArrow(ctx, bx, by, br, turn, t, 80);
    if (turn > 0) L.hand(ctx, lerp(1620, 1345, E.out(turn)), lerp(790, 745, E.out(turn)), 1.2, -0.77 + 0.06 * Math.sin(t * 2));
    L.tryBanner(ctx, Lt.win('try1', 0, 0.6));
    const gb = Lt.win('try1', 1.5, 0.6); if (gb > 0) { ctx.save(); ctx.globalAlpha = gb; ctx.fillStyle = 'rgba(255,255,255,0.88)'; roundRect(ctx, 1550, 405, 300, 46, 23); ctx.fill(); ctx.restore(); }   // a pale plate keeps the words readable in the dark room
    L.grownUpBadge(ctx, 1700, 300, gb);
    const eyes = Lt.cwin('try2', 'never in eyes', 0.5) * (1 - Lt.cwin('try2', 'turn the ball', 0.3));
    L.sticker(ctx, 'never in eyes!', 960, 275, eyes, { bg: P.red, color: P.white, size: 60, rot: -0.03 }); noEye(ctx, 1500, 610, 72, eyes);
    L.sticker(ctx, 'day?', bx, 250, Lt.cwin('try2', 'when is it day', 0.5) * (1 - Lt.cwin('try2', 'when is it night', 0.3)), { bg: P.sun, size: 80, rot: -0.05 });
    L.sticker(ctx, 'night?', bx, 250, Lt.cwin('try2', 'when is it night', 0.5), { bg: '#3B4BA8', color: P.white, size: 80, rot: 0.05 });
    L.pip(ctx, { x: 330, y: 760, s: 0.8, t, mood: 'talk', armR: Lt.cafter('try2', 'never in eyes') && !Lt.cafter('try2', 'turn the ball') ? -1.3 : -0.4, armL: 0.6, lookX: 0.7 });
  }

  L.episodes.ep9 = {
    id: 'ep9', num: 9, title: 'Why is it dark at night?', short: 'Day and night', phrase: 'The Earth spins!',
    // YouTube thumbnail (render/art.js): the night garden with a big moon behind Curie
    thumb: { big: 'NIGHT?', small1: 'Why is it dark at', small2: '', bg: (ctx, t) => { garden(ctx, t, 0, { sun: false, moon: false }); moon(ctx, 1560, 270, 130, 1); } },
    // text = the caption on screen (and the site); say = what Curie speaks, with direction tags (docs/PIPELINE.md, "Narration markup")
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why is it dark at night?", say: "Today's big question... Why is it *dark* at night?", hold: 0.6 },
      { id: 'evening', text: "It's evening. The sun goes down... and down... and it gets dark. Good night!", say: "It's evening. The sun goes down... and *down*... and it gets *dark*. {w}Good night!{/w}", hold: 0.9 },
      { id: 'morning', text: 'In the morning, the sun comes up again. Good morning!', say: "In the morning... the sun comes *up* again. Good *morning*!", hold: 0.8 },
      { id: 'why', text: "Does the sun go to sleep at night? Let's fly up into space and find out!", say: "Does the sun go to *sleep* at night? Let's fly up into space... and find *out*!", hold: 0.6 },
      { id: 'earth', text: "Here is our Earth, a giant ball. And here is the sun. The sun doesn't go to sleep. It keeps on shining!", say: "Here is our *Earth*, a giant ball. And here is the *sun*. The sun doesn't go to *sleep*. It keeps on *shining*!", hold: 0.8 },
      { id: 'half', text: 'The sun can only shine on one side of the Earth. That side has day. The other side is dark: it has night.', say: "The sun can only shine on *one* side of the Earth. That side has *day*. The other side is *dark*... it has *night*.", hold: 0.6 },
      { id: 'spin', text: 'And our Earth is always spinning, slowly, round and round.', say: "And our Earth is *always* spinning... slowly, round and *round*.", hold: 0.5 },
      { id: 'house', text: "Look, here's Curie's house! Right now it faces the sun. It's daytime!", say: "Look... here's Curie's *house*! Right now it faces the *sun*. It's *daytime*!", hold: 0.6 },
      { id: 'turn', text: "The Earth turns... and turns. Now Curie's house faces away from the sun. It's night! The sun is still shining.", say: "The Earth turns... and *turns*. Now Curie's house faces *away* from the sun. It's *night*! The sun is *still* shining.", hold: 0.9 },
      { id: 'oneday', text: 'One whole spin takes one day and one night. Then it starts all over again!', say: "One *whole* spin takes one *day*... and one *night*. Then it starts all over *again*!", hold: 0.7 },
      { id: 'other', text: "So when it's day for you, it's night for children on the other side of the world!", say: "So when it's *day* for you... it's *night* for children on the other side of the *world*!", hold: 1.0 },
      { id: 'sky', text: "In the garden, the sun seems to come up and go down. But the sun isn't really going up and down. We are turning! The Earth spins.", say: "In the garden, the sun *seems* to come up... and go down. But the sun isn't *really* going up and down. We are *turning*! The Earth *spins*.", hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: the Earth spins!', say: "Say it with me... {sfx:ding}The *Earth* spins! {pause 0.9} {slow}The Earth... spins!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a torch and a ball. Put a sticker on the ball: that's your house.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for a *torch* and a *ball*. Put a sticker on the ball... that's your *house*.", hold: 0.4 },
      { id: 'try2', text: 'Make the room dark. Shine the torch on the ball, never in eyes! Turn the ball slowly. When is it day at your house? When is it night?', say: "Make the room *dark*. Shine the torch on the ball... never in *eyes*! Turn the ball *slowly*. When is it *day* at your house? When is it *night*?", hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: the Earth spins, and that makes day and night. See you next time at the Little Scientists Club! Bye-bye!', say: "{sfx:tada}Great job, little scientist! Remember... the *Earth* spins, and that makes *day* and *night*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    sfx: [
      { line: 'evening', chunk: 'and it gets dark', offset: 0.1, name: 'owl' },
      { line: 'morning', chunk: 'good morning', offset: 0, name: 'chime' },
      { line: 'why', chunk: "let's fly up", offset: 0.1, name: 'zoom' },
      { line: 'earth', chunk: 'here is our earth', offset: 0.6, name: 'pop', vol: 0.6 },
      { line: 'earth', chunk: 'and here is the sun', offset: 0.1, name: 'pop' },
      { line: 'earth', chunk: 'it keeps on shining', offset: 0.1, name: 'sparkle' },
      { line: 'half', chunk: 'that side has day', offset: 0.1, name: 'sparkle' },
      { line: 'half', chunk: 'it has night', offset: 0, name: 'owl', vol: 0.7 },
      { line: 'house', chunk: 'curie', offset: 0.3, name: 'pop' },
      { line: 'house', chunk: "it's daytime", offset: 0, name: 'chime', vol: 0.8 },
      { line: 'turn', chunk: 'the earth turns', offset: 0.1, name: 'whoosh', vol: 0.4 },
      { line: 'turn', chunk: "it's night", offset: 0, name: 'owl' },
      { line: 'oneday', chunk: 'one whole spin', offset: 0.2, name: 'whoosh', vol: 0.4 },
      { line: 'other', chunk: "it's night for children", offset: 0, name: 'owl', vol: 0.7 },
      { line: 'sky', chunk: 'we are turning', offset: 0, name: 'pop' },
      { line: 'try1', chunk: 'put a sticker', offset: 0, name: 'pop' },
      { line: 'try2', chunk: 'shine the torch', offset: 0, name: 'click' },
      { line: 'try2', chunk: 'when is it day', offset: 0, name: 'ding' }
    ],
    // scenes: each starts when its `from` line starts (minus optional lead) and lasts until the next scene; transition 'cut' = no wipe
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => nightCard(c, tt), { word: 'Why?' }) },
      { from: 'evening', draw: (ctx, t, Lt) => eveningScene(ctx, t, Lt) },
      { from: 'why', draw: (ctx, t, Lt) => whyScene(ctx, t, Lt) },
      { from: 'earth', transition: 'cut', draw: (ctx, t, Lt) => earthScene(ctx, t, Lt) },
      { from: 'sky', draw: (ctx, t, Lt) => skyScene(ctx, t, Lt) },
      { from: 'sayit', draw: (ctx, t, Lt) => sayitScene(ctx, t, Lt) },
      { from: 'try1', draw: (ctx, t, Lt) => tryScene(ctx, t, Lt) },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'The Earth spins!') }
    ],
    // ---- Try it on the website: TWO activities ----
    // Both use the picture of the video: the Earth from above, the sun on the left, Curie's house on the rim, turning counter-clockwise.
    // The child drags round the Earth and the Earth follows the finger (psi = the time of day, see the top of this file).
    interactives: [
      {
        title: 'Spin the Earth',
        hint: "Drag around the Earth to spin it. Put Curie's house in the sunshine, then in the dark.",
        init: s => { s.psi = 3.7; s.drag = false; s.lastAng = 0; s.moved = false; s.zone = 'day'; },
        update: (s, dt, cue) => {
          // the house crosses the line between day and night: Curie says so, once per crossing (a small gap stops flicker)
          const e = elev(s.psi);
          if (s.zone === 'day' && e < -0.08) { s.zone = 'night'; if (s.moved) cue('night'); }
          else if (s.zone === 'night' && e > 0.08) { s.zone = 'day'; if (s.moved) cue('day'); }
        },
        draw: (ctx, s, t) => {
          const { cx, cy, R } = ES, night = elev(s.psi) < 0;
          space(ctx, t); rays(ctx, t, sunEdge, cx, cy, R, 1); bigSun(ctx, t, SUN, { face: SUNFACE });
          dayNightTrack(ctx, cx, cy, R, 1, 1); earthTop(ctx, t, cx, cy, R, s.psi, { dark: 1 });
          if (!s.moved) spinArrow(ctx, cx, cy, R, 1, t);
          rimHouse(ctx, t, cx, cy, R, s.psi, 0, { ring: 1 });
          porthole(ctx, t, PH.x, PH.y1, PH.r, s.psi, { ring: P.red }); dnSticker(ctx, s.psi, PH.x, PH.y1 + PH.r + 62, 1, 56);
          L.sticker(ctx, 'DAY', cx - 150, 72, 1, { bg: P.sun, size: 52, rot: -0.04 }); L.sticker(ctx, 'NIGHT', cx + 150, 72, 1, { bg: '#3B4BA8', color: P.white, size: 46, rot: 0.04 });   // above the yellow and the violet half of the ring, out of the way of the house
          L.pip(ctx, { x: CURIE.x, y: CURIE.y - 5, s: 0.8, t, mood: night ? 'happy' : 'wow', blink: night ? 1 : undefined, armR: night ? 0.5 : -0.6, armL: 0.6, lookX: 0.8 });
          if (night) for (let i = 0; i < 3; i++) { const f = (t * 0.45 + i / 3) % 1; ctx.save(); ctx.globalAlpha = 1 - f; text(ctx, 'z', CURIE.x + 85 + 24 * i + 14 * f, CURIE.y - 125 - 50 * f - 18 * i, { size: 40 + 10 * i, weight: 700, color: P.white, stroke: P.ink, strokeWidth: 8 }); ctx.restore(); }
          if (!s.moved) text(ctx, 'drag me', cx, cy + R + 118, { size: 60, weight: 600, color: P.white, stroke: P.ink, strokeWidth: 12 });
        },
        pointer: (s, type, x, y) => {
          const dx = x - ES.cx, dy = y - ES.cy, d = Math.hypot(dx, dy);
          if (type === 'down' && d < ES.R + 150 && d > 30) { s.drag = true; s.lastAng = Math.atan2(dy, dx); }
          if (type === 'move' && s.drag && d > 30) { const a = Math.atan2(dy, dx); let da = a - s.lastAng; while (da > PI) da -= TAU; while (da < -PI) da += TAU; s.psi = (((s.psi - da) % TAU) + TAU) % TAU; s.lastAng = a; s.moved = true; }
          if (type === 'up') s.drag = false;
        },
        cues: { day: "Curie's house faces the sun. It's daytime!", night: "Curie's house turned away from the sun. It's night!" }
      },
      {
        title: 'Sunrise, sunset',
        hint: "Spin the little Earth. Watch the sky over Curie's garden: the sun comes up, then goes down!",
        init: s => { s.psi = 0.9; s.drag = false; s.lastAng = 0; s.moved = false; s.zone = 'night'; s.flash = 0; s.cw = 0; s.wrong = 0; },
        update: (s, dt, cue) => {
          s.flash = Math.max(0, s.flash - dt); s.wrong = Math.max(0, s.wrong - dt);
          const e = elev(s.psi);
          if (s.zone === 'night' && e > 0.05) { s.zone = 'day'; s.flash = 2.5; if (s.moved) cue('sunrise'); }
          else if (s.zone === 'day' && e < -0.05) { s.zone = 'night'; if (s.moved) cue('sunset'); }
        },
        draw: (ctx, s, t) => {
          const e = elev(s.psi), sp = sunPos(s.psi), I = INSET;
          const curie = e < -0.12 ? { mood: 'happy', blink: 1, armR: 0.5, armL: 0.6, lookX: 0.3 } : { mood: s.flash > 0 ? 'wow' : 'happy', armR: s.flash > 0 ? -1.2 : -0.6, armL: s.flash > 0 ? -1.2 : 0.6, lookX: clamp((sp.x - 720) / 500, -1, 1), lookY: -0.4 };
          garden(ctx, t, s.psi, { curie, path: 0.9 });
          const psiMod = ((s.psi % TAU) + TAU) % TAU, label = e < -0.12 ? 'Night' : psiMod < PI ? (e < 0.55 ? 'Morning' : 'Noon') : (e < 0.55 ? 'Evening' : 'Noon');
          L.sticker(ctx, label, 330, 130, 1, { bg: e < -0.12 ? '#3B4BA8' : P.sun, color: e < -0.12 ? P.white : P.ink, size: 60, rot: -0.03 });
          insetEarth(ctx, t, s.psi, { arrow: Math.max(s.moved ? 0 : 1, Math.min(1, s.wrong * 2)), wiggle: s.wrong > 0 });          // dragging the wrong way: the arrow wiggles to show the way
          if (s.wrong > 0 || !s.moved) text(ctx, s.wrong > 0 ? 'this way!' : 'drag me', I.cx, I.y + I.h + 52, { size: 60, weight: 600, color: P.ink, stroke: P.white, strokeWidth: 12 });
        },
        pointer: (s, type, x, y) => {
          const I = INSET, dx = x - I.cx, dy = y - I.cy, d = Math.hypot(dx, dy), inside = x > I.x - 40 && x < I.x + I.w + 40 && y > I.y - 40 && y < I.y + I.h + 40;
          if (type === 'down' && inside && d > 22) { s.drag = true; s.lastAng = Math.atan2(dy, dx); s.cw = 0; }                 // a new drag starts with a clean count of wrong-way movement
          if (type === 'move' && s.drag && d > 22) {
            const a = Math.atan2(dy, dx); let da = a - s.lastAng; while (da > PI) da -= TAU; while (da < -PI) da += TAU; s.lastAng = a;
            if (da < 0) { s.psi = (((s.psi - da) % TAU) + TAU) % TAU; s.moved = true; s.cw = 0; s.wrong = 0; }   // counter-clockwise: the day goes forward (and the "this way!" warning goes away)
            else if (da > 0) { s.cw += da; if (s.cw > 0.12) { s.wrong = 1.6; s.cw = 0; } }               // clockwise: the Earth only spins one way, so nothing happens and the arrow shows the way
          }
          if (type === 'up') s.drag = false;
        },
        cues: { sunrise: 'The sun comes up. Good morning!', sunset: 'The sun goes down. Good night!' }
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 10 — Where does the sugar go? (dissolving: sugar and salt spread out in water as tiny bits; still there; sand does not dissolve)
   Props: glass (tumbler with contents), spoon, crystals, jars, shaker, dish, kitchen; the tiny-bits model (a lattice of water bits with a
   sugar clump that is pulled apart and spreads out between them: copied and adapted from the Episode 1 idea).
   Everything is a pure function of t. */
(function (global) {
  const L = global.LSC; const LSC = L; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  // ---------- colours ----------
  const WATER_C = 'rgba(110,200,255,0.62)', LEMON_C = 'rgba(255,230,100,0.85)', WATER_BIT = '#9AD4FF', SUGAR_BIT = '#FFD6EB';
  const SAND_C = '#E3B873', SAND_D = '#B98B4E', SALT_C = '#EEF3FC', PEBBLE_C = '#9AA4B5', STEEL = '#DDE3EE';

  // ---------- the glass: local frame, bottom-centre at (0,0), open top; the inside is a trapezoid ----------
  const GL = { h: 260, wb: 74, wt: 98 };
  const glassHW = y => lerp(GL.wb, GL.wt, clamp(-y / GL.h, 0, 1)); // half width of the inside at height y (y <= 0)
  function glassBody(ctx, inset) { const i = inset || 0; ctx.beginPath(); ctx.moveTo(-GL.wt + i * 0.6, -GL.h); ctx.lineTo(-GL.wb + i, -i); ctx.lineTo(GL.wb - i, -i); ctx.lineTo(GL.wt - i * 0.6, -GL.h); }
  // o: level 0..1, color, t, wave (px), tilt (rad, about the bottom), inner(ctx, surfaceY) draws the contents (glass coordinates, clipped to the liquid)
  function glass(ctx, x, y, s, o) {
    o = o || {}; const t = o.t || 0, lvl = o.level == null ? 0.8 : o.level, wave = o.wave == null ? 3 : o.wave, lw = 8 / s;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    glassBody(ctx); ctx.closePath(); ctx.fillStyle = 'rgba(232,245,255,0.45)'; ctx.fill();
    if (lvl > 0) {
      const ly = -(GL.h - 24) * lvl;
      ctx.save(); glassBody(ctx, 3 / s); ctx.closePath(); ctx.clip();
      ctx.fillStyle = o.color || WATER_C; ctx.beginPath(); ctx.moveTo(-GL.wt, 0); ctx.lineTo(-GL.wt, ly);
      for (let xx = -GL.wt; xx <= GL.wt + 1; xx += 14) ctx.lineTo(xx, ly + Math.sin(xx / 26 + t * 2.4) * wave);
      ctx.lineTo(GL.wt, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4 / s; ctx.beginPath();
      for (let xx = -GL.wt; xx <= GL.wt + 1; xx += 14) { const yy = ly + Math.sin(xx / 26 + t * 2.4) * wave; xx === -GL.wt ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke();
      if (o.inner) o.inner(ctx, ly);
      ctx.restore();
    }
    if (o.outer) o.outer(ctx);
    ctx.strokeStyle = P.ink; ctx.lineWidth = lw; glassBody(ctx); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 9 / s; ctx.beginPath(); ctx.moveTo(-GL.wt + 22, -GL.h + 40); ctx.lineTo(-GL.wb + 18, -96); ctx.stroke();
    ctx.restore();
  }

  // ---------- crystals (sugar or salt): little white cubes ----------
  function crystal(ctx, x, y, r, rot, a) {
    if (a <= 0 || r <= 0.4) return; ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = clamp(r * 0.26, 1.4, 3.2); ctx.lineJoin = 'round';
    roundRect(ctx, -r, -r, 2 * r, 2 * r, r * 0.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9DCF3'; ctx.beginPath(); ctx.moveTo(r * 0.82, -r * 0.1); ctx.lineTo(r * 0.82, r * 0.62); ctx.lineTo(-r * 0.1, r * 0.82); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // a pyramid of up to 20 crystals on the glass floor (rows of 6, 5, 4, 3, 2), filled from the middle of each row outwards
  const PILE = (() => { const rows = [6, 5, 4, 3, 2], out = [], r = L.rng(77); rows.forEach((n, ri) => { const xs = []; for (let i = 0; i < n; i++) xs.push((i - (n - 1) / 2) * 23); xs.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b); xs.forEach(x => out.push({ x: x + (r() - 0.5) * 3, y: -13 - ri * 19 + (r() - 0.5) * 3, rot: (r() - 0.5) * 0.7 })); }); return out; })();
  // draw crystals i = 0..n-1 of the pile; size(i) gives 0..1 (1 = whole)
  function pile(ctx, n, size, jig) { for (let i = 0; i < n; i++) { const z = size ? size(i) : 1; if (z <= 0.02) continue; const q = PILE[i], j = jig || 0; crystal(ctx, q.x + Math.sin(j * 9 + i * 2.1) * 3 * Math.min(1, j * 4), q.y - (1 - z) * 6, 11 * z, q.rot + (1 - z) * 1.2, Math.min(1, z * 1.8)); } }
  // crystals are used up from the top of the pile downwards: crystal i of n, when a fraction d (0..1) of all of them has dissolved
  const erode = (i, n, d) => clamp(n * (1 - d) - i, 0, 1);
  function sugarHeap(ctx, x, y, s, sand) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = sand ? SAND_C : '#FFFFFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-36, 6); ctx.quadraticCurveTo(-34, -36, 0, -40); ctx.quadraticCurveTo(34, -36, 36, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = sand ? SAND_D : '#C9DCF3'; for (const [dx, dy] of [[-16, -10], [10, -20], [18, -4], [-4, -28], [-24, -2]]) ctx.fillRect(dx - 3.5, dy - 3.5, 7, 7);
    ctx.restore();
  }
  function sugarCube(ctx, x, y, s, rot) { // a lump of sugar, bottom-centre (x,y)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.fillStyle = '#FFFFFF'; roundRect(ctx, -52, -92, 96, 92, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EAF2FC'; ctx.beginPath(); ctx.moveTo(-52, -92); ctx.lineTo(-30, -118); ctx.lineTo(66, -118); ctx.lineTo(44, -92); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9DCF3'; ctx.beginPath(); ctx.moveTo(44, -92); ctx.lineTo(66, -118); ctx.lineTo(66, -22); ctx.lineTo(44, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9DCF3'; for (const [dx, dy] of [[-30, -60], [-8, -30], [10, -70], [-34, -20]]) ctx.fillRect(dx - 3, dy - 3, 6, 6);
    ctx.restore();
  }

  // ---------- spoon: bowl centre (bx,by), the handle runs from the bowl along angle `ang` for `len` px; heap = sugar on the bowl; drop = a drop of lemonade ----------
  function spoon(ctx, bx, by, ang, len, s, o) {
    o = o || {}; ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); ctx.scale(s, s);
    ctx.fillStyle = STEEL; ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const hl = Math.max(60, len / s);
    ctx.beginPath(); ctx.moveTo(26, -7); ctx.lineTo(hl - 9, -10); ctx.arc(hl - 9, 0, 10, -Math.PI / 2, Math.PI / 2); ctx.lineTo(26, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(-8, -6, 18, 8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (o.heap > 0) sugarHeap(ctx, bx, by - 8 * s, s * o.heap, o.sand);
    if (o.drop > 0) { ctx.save(); ctx.translate(bx, by - 2 * s); ctx.scale(s * o.drop, s * o.drop); ctx.fillStyle = o.dropColor || LEMON_C; ctx.strokeStyle = P.ink; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(15, -4, 15, 3); ctx.arc(0, 3, 15, 0, Math.PI); ctx.quadraticCurveTo(-15, -4, 0, -26); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  }
  // the spoon stirring in a glass at (gx,gy) scale gs: the bowl circles near the bottom (angle phi), the handle leans on the right rim
  function stirPose(gx, gy, gs, phi, rr) {
    const R = { x: gx + 72 * gs, y: gy - (GL.h - 2) * gs }, B = { x: gx + Math.cos(phi) * rr * gs, y: gy - 66 * gs + Math.sin(phi) * rr * 0.2 * gs };
    return { x: B.x, y: B.y, ang: Math.atan2(R.y - B.y, R.x - B.x), len: Math.hypot(R.x - B.x, R.y - B.y) + 125 * gs };
  }
  // swirl lines in the water (glass coordinates); a = 0..1 strength, phi = turning angle
  function swirl(ctx, phi, a, ly) {
    if (a <= 0) return; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha *= clamp(a, 0, 1);
    for (let k = 0; k < 3; k++) { const yy = -70 - k * 52; if (yy < ly + 18) continue; const rx = 60 - k * 9, a0 = phi * (1 + k * 0.15) + k * 2; ctx.beginPath(); ctx.ellipse(0, yy, rx, 15, 0, a0, a0 + 2.0); ctx.stroke(); }
    ctx.restore();
  }
  function lemonSlice(ctx, x, y, s, rot) { // a lemon wheel on the rim
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    circle(ctx, 0, 0, 40, '#FFD93B', P.ink, 5); circle(ctx, 0, 0, 31, '#FFF3A8');
    ctx.strokeStyle = '#FFD93B'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5); ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- jars and dishes ----------
  const JAR_DOTS = (() => { const r = L.rng(5), out = []; for (let i = 0; i < 22; i++) out.push({ x: -50 + r() * 100, y: -180 + r() * 170, a: r() }); return out; })();
  // a storage jar, bottom-centre (x,y), tipped about its middle by rot; what = 'sugar' | 'salt' | 'sand' | 'pebbles'
  function jar(ctx, x, y, s, rot, what) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(0, -100); ctx.rotate(rot || 0); ctx.translate(0, 100); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    const stuff = what === 'sugar' ? '#FFFFFF' : what === 'salt' ? SALT_C : what === 'sand' ? SAND_C : 'rgba(235,245,255,0.95)';
    ctx.fillStyle = 'rgba(235,245,255,0.97)'; roundRect(ctx, -66, -190, 132, 190, 26); ctx.fill(); roundRect(ctx, -46, -228, 92, 46, 10); ctx.fill();
    ctx.fillStyle = stuff; roundRect(ctx, -59, -183, 118, 177, 21); ctx.fill(); roundRect(ctx, -40, -221, 80, 44, 8); ctx.fill();
    if (what === 'pebbles') { const r = L.rng(9); for (let i = 0; i < 8; i++) { const px = -42 + (i % 3) * 42 + (r() - 0.5) * 12, py = -30 - Math.floor(i / 3) * 56 - (r() * 8); ellipse(ctx, px, py, 24 + r() * 6, 18 + r() * 4, PEBBLE_C, P.ink, 3.5, (r() - 0.5) * 0.6); } }
    else for (const d of JAR_DOTS) { ctx.fillStyle = what === 'sand' ? SAND_D : what === 'salt' ? '#C9D6EA' : '#C9DCF3'; ctx.fillRect(d.x - 3, d.y - 3, 6, 6); }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, -66, -190, 132, 190, 26); ctx.stroke(); roundRect(ctx, -46, -228, 92, 46, 10); ctx.stroke();
    ctx.fillStyle = P.white; ctx.lineWidth = 4; roundRect(ctx, -50, -126, 100, 52, 14); ctx.fill(); ctx.stroke();
    text(ctx, what, 0, -99, { size: what === 'pebbles' ? 25 : 36, weight: 700 });
    ctx.restore();
  }
  function shaker(ctx, x, y, s, rot) { // salt shaker, bottom-centre; rot tips it about its middle
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(0, -70); ctx.rotate(rot || 0); ctx.translate(0, 70); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.fillStyle = 'rgba(235,245,255,0.97)'; roundRect(ctx, -44, -140, 88, 140, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SALT_C; roundRect(ctx, -37, -120, 74, 114, 16); ctx.fill();
    ctx.fillStyle = STEEL; roundRect(ctx, -46, -176, 92, 44, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; for (const dx of [-24, -8, 8, 24]) circle(ctx, dx, -154, 4.5, P.ink);
    text(ctx, 'salt', 0, -62, { size: 30, weight: 700 });
    ctx.restore();
  }
  // a shallow dish, bottom-centre (x,y); level 0..1 of the water; salt 0..1 = how many salt crystals lie on the bottom
  const DISH_SALT = (() => { const r = L.rng(31), out = []; for (let i = 0; i < 14; i++) out.push({ x: -112 + (i % 7) * 37 + (r() - 0.5) * 16, y: -14 - Math.floor(i / 7) * 22 - r() * 6, rot: (r() - 0.5) * 0.8, k: i / 14 }); return out; })();
  function dish(ctx, x, y, s, level, salt, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(-220, -90); ctx.lineTo(-150, -4); ctx.quadraticCurveTo(-140, 4, -120, 4); ctx.lineTo(120, 4); ctx.quadraticCurveTo(140, 4, 150, -4); ctx.lineTo(220, -90); };
    path(); ctx.closePath(); ctx.fillStyle = 'rgba(240,248,255,0.9)'; ctx.fill();
    if (level > 0) { ctx.save(); path(); ctx.closePath(); ctx.clip(); const ly = -8 - 76 * level; ctx.fillStyle = WATER_C; ctx.fillRect(-230, ly, 460, 100); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); for (let xx = -230; xx <= 230; xx += 14) { const yy = ly + Math.sin(xx / 26 + (t || 0) * 2.4) * 2; xx === -230 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); } ctx.stroke(); ctx.restore(); }
    for (const c of DISH_SALT) { const k = clamp(salt * 1.6 - c.k * 0.6, 0, 1); if (k > 0) crystal(ctx, c.x, c.y, 10 * (0.4 + 0.6 * E.outBack(k)), c.rot, 1); }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 7; path(); ctx.stroke();
    ctx.restore();
  }

  // ---------- rooms ----------
  function window_(ctx, x, y, t, w, h) { // a window with the sun in it
    w = w || 300; h = h || 260; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#CDEBFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, -w / 2, -h / 2, w, h, 18); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); roundRect(ctx, -w / 2, -h / 2, w, h, 18); ctx.clip(); L.sun(ctx, w * 0.03, -h * 0.04, h * 0.24, t); L.cloud(ctx, -w * 0.28, h * 0.22, 0.45); ctx.restore();
    ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke(); ctx.restore();
  }
  // the kitchen: tiled wall, window, counter whose top edge is at counterY (things stand on it)
  function kitchen(ctx, t, o) {
    o = o || {}; const cy = o.counterY == null ? 740 : o.counterY;
    ctx.fillStyle = '#FFF4DF'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#FFE8C0'; ctx.fillRect(0, cy - 300, W, 300);
    ctx.strokeStyle = 'rgba(185,139,78,0.25)'; ctx.lineWidth = 3; for (let x = 0; x <= W; x += 120) { ctx.beginPath(); ctx.moveTo(x, cy - 300); ctx.lineTo(x, cy); ctx.stroke(); } for (let y = cy - 300; y < cy; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    if (o.window !== false) window_(ctx, o.windowX == null ? 1560 : o.windowX, o.windowY == null ? 250 : o.windowY, t);
    if (o.before) o.before();
  }
  function counter(ctx, cy) { // drawn after Curie so that she stands behind it
    cy = cy == null ? 740 : cy; ctx.fillStyle = '#D9B277'; ctx.fillRect(0, cy, W, 44); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.fillStyle = '#B98B4E'; ctx.fillRect(0, cy + 44, W, 20); ctx.fillStyle = '#C79A5B'; ctx.fillRect(0, cy + 64, W, H - cy - 64);
    ctx.strokeStyle = 'rgba(43,45,66,0.35)'; ctx.lineWidth = 4; for (let x = 0; x <= W; x += 480) { ctx.beginPath(); ctx.moveTo(x, cy + 64); ctx.lineTo(x, H); ctx.stroke(); }
  }
  function lab(ctx) { ctx.fillStyle = '#EEF6FF'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(95,184,255,0.14)'; ctx.lineWidth = 3; for (let x = 0; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } }
  function panel(ctx, x, y, w, h, p) { // a white card that pops in; returns false when not visible yet
    if (p <= 0) return false; const cx = x + w / 2, cy = y + h / 2; ctx.save(); ctx.translate(cx, cy); ctx.scale(p, p); ctx.translate(-cx, -cy);
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; roundRect(ctx, x, y, w, h, 40); ctx.fill(); ctx.stroke(); return true;
  }

  // ---------- the tiny-bits model ----------
  // A lattice of water bits with a clump of sugar bits (one grain). Each sugar bit is pulled out of the clump and swaps places with the
  // water bit at its destination, so nothing ever overlaps. makeField() decides the sites, the clump and the destinations (deterministic).
  function makeField(spec) {
    const rg = L.rng(spec.seed || 3), sites = [];
    if (spec.within) { // a hex lattice cut to a circle (for the small lens)
      for (let r = -4; r <= 4; r++) for (let c = -5; c <= 5; c++) { const x = c * spec.dx + (r & 1 ? spec.dx / 2 : 0), y = r * spec.dy; if (Math.hypot(x, y) <= spec.within) sites.push({ x: spec.x0 + x, y: spec.y0 + y, r: r + 4, c: c + 5 }); }
    } else spec.rows.forEach((n, r) => { for (let c = 0; c < n; c++) sites.push({ x: spec.x0 + c * spec.dx + (r & 1 ? spec.dx / 2 : 0), y: spec.y0 + r * spec.dy, r, c }); });
    sites.forEach(s => { s.ph = rg() * 6.28; s.ph2 = rg() * 6.28; s.fr = 0.8 + rg() * 0.5; });
    let clump;
    if (spec.clump) { const key = new Set(spec.clump.map(([r, c]) => r + ':' + c)); clump = sites.filter(s => key.has(s.r + ':' + s.c)); }
    else { const near = (a) => Math.hypot(a.x - spec.cx, a.y - spec.cy); clump = sites.slice().sort((a, b) => near(a) - near(b)).slice(0, spec.n); }
    clump.forEach(s => { s.clump = true; });
    const rest = sites.filter(s => !s.clump);
    const cx = clump.reduce((a, s) => a + s.x, 0) / clump.length, cy = clump.reduce((a, s) => a + s.y, 0) / clump.length;
    const used = new Set(), dest = [];
    for (const [tx, ty] of spec.targets) { let best = null, bd = 1e18; for (const q of rest) { if (used.has(q)) continue; const d = (q.x - tx) ** 2 + (q.y - ty) ** 2; if (d < bd) { bd = d; best = q; } } used.add(best); dest.push(best); }
    const ang = (x, y) => Math.atan2(y - cy, x - cx);
    const cs = clump.slice().sort((a, b) => ang(a.x, a.y) - ang(b.x, b.y)), ds = dest.slice().sort((a, b) => ang(a.x, a.y) - ang(b.x, b.y));
    cs.forEach((q, i) => { q.dest = ds[i]; ds[i].src = q; });
    const dmax = Math.max(...clump.map(q => Math.hypot(q.x - cx, q.y - cy))) || 1;
    clump.forEach(q => { const d = Math.hypot(q.x - cx, q.y - cy); q.order = 1 - d / dmax; q.out = { x: (q.x - cx) / (d || 1), y: (q.y - cy) / (d || 1) }; });
    const bonds = []; for (let i = 0; i < clump.length; i++) for (let j = i + 1; j < clump.length; j++) if (Math.hypot(clump[i].x - clump[j].x, clump[i].y - clump[j].y) < spec.dx * 1.2) bonds.push([clump[i], clump[j]]);
    return { sites, clump, rest, dest, bonds, r: spec.r, cx, cy, dx: spec.dx };
  }
  function bit(ctx, x, y, r, fill, busy, a, face, lwMin) {
    if (a <= 0.01) return; ctx.save(); ctx.globalAlpha *= Math.min(1, a); circle(ctx, x, y, r, fill, P.ink, Math.max(2.5, r * 0.14, lwMin || 0));
    if (face) {
      circle(ctx, x - r * 0.3, y - r * 0.18, r * 0.13, P.ink); circle(ctx, x + r * 0.3, y - r * 0.18, r * 0.13, P.ink);
      ctx.strokeStyle = P.ink; ctx.lineWidth = Math.max(2, r * 0.09); ctx.lineCap = 'round'; ctx.beginPath(); if (busy) ctx.arc(x, y + r * 0.26, r * 0.2, 0, Math.PI * 2); else ctx.arc(x, y + r * 0.12, r * 0.27, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    circle(ctx, x - r * 0.5, y + r * 0.34, r * 0.14, 'rgba(255,255,255,0.55)'); ctx.restore();
  }
  // o: k (scale), ox/oy (screen position of the field point fx/fy), fall (undefined = the grain is there; 0..1 = it is falling in; <= 0 = not yet),
  //    bonds 0..1, tug 0..1 (blue arrows pulling the outer bits), rel 0..1 (how far the sugar bits have spread), jig (px), faces
  function bitsField(F, ctx, t, o) {
    o = o || {}; const k = o.k == null ? 1 : o.k, R = F.r, jig = o.jig == null ? 7 : o.jig, faces = o.faces !== false && R * k >= 12, lw = 1.7 / k;
    const fall = o.fall == null ? 1 : o.fall, present = fall > 0, landed = fall >= 1, rel = o.rel || 0, tug = o.tug || 0, ba = o.bonds == null ? 1 : o.bonds;
    ctx.save(); ctx.translate(o.ox || 0, o.oy || 0); ctx.scale(k, k); ctx.translate(-(o.fx || 0), -(o.fy || 0));
    const wob = (s, a) => ({ x: Math.sin(t * 3.1 * s.fr + s.ph) * a, y: Math.cos(t * 2.7 * s.fr + s.ph2) * a });
    const rho = q => seg(rel, 0.45 * q.order, 0.45 * q.order + 0.55, E.inOut);
    const bulge = R * 1.3, D = 2 * R + 4, off = present && !landed ? -(1 - E.in(clamp(fall / 0.85, 0, 1))) * 760 : 0;
    // where every sugar bit is (it leaves the clump along a curve, pulled outwards first) and where its swap partner (a water bit) is
    const sp = new Map(), wp = new Map(), movers = [];
    if (present) for (const q of F.clump) {
      const e = rho(q), d = q.dest, dx = d.x - q.x, dy = d.y - q.y, dd = Math.hypot(dx, dy) || 1, nx = -dy / dd, ny = dx / dd, bw = Math.sin(Math.PI * e) * bulge, tg = tug * (1 - e), w = wob(q, jig * (0.35 + 0.65 * e) + tug * 2);
      const a = { e, x: lerp(q.x, d.x, e) + nx * bw + q.out.x * tg * R * 0.28 + w.x, y: lerp(q.y, d.y, e) + ny * bw + q.out.y * tg * R * 0.28 + w.y + off, busy: (e > 0.02 && e < 0.98) || tg > 0.5 };
      sp.set(q, a); const sw = d, w2 = wob(sw, jig), b = { e, x: lerp(sw.x, q.x, e) - nx * bw + w2.x, y: lerp(sw.y, q.y, e) - ny * bw + w2.y, busy: e > 0.02 && e < 0.98 };
      wp.set(sw, b); if (e > 0.005 && e < 0.995) { movers.push(a, b); }
    }
    // things on the move push each other and the bits they pass aside a little, so nothing sits on top of anything else
    for (const m of movers) { m.px = m.x; m.py = m.y; }
    for (const m of movers) for (const n of movers) { if (m === n) continue; const dx = m.px - n.px, dy = m.py - n.py, d = Math.hypot(dx, dy); if (d < D) { const u = d > 0.5 ? 1 / d : 0, push = (D - d) * 0.5; m.x += (u ? dx * u : 0) * push; m.y += (u ? dy * u : -1) * push; } }
    const nudge = (x, y) => { let X = x, Y = y; for (const m of movers) { const dx = x - m.px, dy = y - m.py, d = Math.hypot(dx, dy); if (d < D) { const u = d > 0.5 ? 1 / d : 0, push = (D - d) * 0.9; X += (u ? dx * u : 0) * push; Y += (u ? dy * u : -1) * push; } } return { x: X, y: Y }; };
    // water bits
    for (const s of F.sites) {
      if (s.clump) { const sq = present ? 1 - seg(fall, 0.8, 1) : 1; if (sq > 0.01 && !(landed && rel > 0)) { const w = wob(s, jig), r2 = R * (0.3 + 0.7 * sq); bit(ctx, s.x + w.x, s.y + w.y, r2, WATER_BIT, false, sq, faces, lw); } continue; }
      if (s.src && wp.has(s)) { const b = wp.get(s); bit(ctx, b.x, b.y, R, WATER_BIT, b.busy, 1, faces, lw); continue; }
      const w = wob(s, jig), n = movers.length ? nudge(s.x + w.x, s.y + w.y) : { x: s.x + w.x, y: s.y + w.y }; bit(ctx, n.x, n.y, R, WATER_BIT, false, 1, faces, lw);
    }
    if (present) {
      // bonds (they hold the grain together and let go as the bits leave)
      if (ba > 0 && rel < 1) { ctx.save(); ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(4, R * 0.24); for (const [a, b] of F.bonds) { const pa = sp.get(a), pb = sp.get(b), rest = Math.hypot(a.x - b.x, a.y - b.y) || 1, stretch = (Math.hypot(pa.x - pb.x, pa.y - pb.y) - rest) / rest, al = ba * (1 - Math.min(1, Math.max(rho(a), rho(b)) * 2.2)) * (1 - clamp(stretch / 0.5, 0, 1)); if (al <= 0.02) continue; ctx.globalAlpha = al; ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); } ctx.restore(); }
      // sugar bits
      for (const q of F.clump) { const a = sp.get(q); bit(ctx, a.x, a.y, R, SUGAR_BIT, a.busy, 1, faces, lw); }
      // blue arrows: the water pulls the outer sugar bits
      if (tug > 0 && rel < 0.6) { ctx.save(); ctx.globalAlpha = tug * (1 - seg(rel, 0.35, 0.6)); for (const q of F.clump) { if (q.order > 0.45) continue; const sx = q.x + q.out.x * (R + 14), sy = q.y + q.out.y * (R + 14) + off; L.arrow(ctx, sx, sy, sx + q.out.x * R * 1.6, sy + q.out.y * R * 1.6, P.blue, Math.max(6, R * 0.22)); } ctx.restore(); }
    }
    ctx.restore();
  }
  // the big model (the screen is one lens into the glass) and the small one (the lens in Try it 1)
  const FIELD = makeField({ x0: 150, y0: 250, dx: 135, dy: 120, rows: [13, 12, 13, 12, 13], r: 42, seed: 3,
    clump: [[1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [2, 6], [3, 3], [3, 4], [3, 5]],
    targets: [[330, 290], [800, 290], [1270, 290], [1700, 290], [190, 490], [1230, 490], [1640, 490], [380, 690], [960, 690], [1500, 690]] });
  const LENS = makeField({ x0: 0, y0: 0, dx: 62, dy: 54, within: 150, r: 19, seed: 8, cx: -62, cy: 0, n: 7,
    targets: [[40, -100], [100, -40], [112, 30], [50, 100], [-40, 110], [-100, 62], [-60, -105]] });

  function lemon(ctx, x, y, s) { // a whole lemon on the counter, bottom-centre
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ellipse(ctx, 0, -38, 56, 40, '#FFD93B', P.ink, 6); circle(ctx, 56, -38, 8, '#FFD93B', P.ink, 5); circle(ctx, -56, -38, 8, '#FFD93B', P.ink, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-20, -56, 16, 8, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.green; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -76); ctx.quadraticCurveTo(24, -108, 52, -92); ctx.quadraticCurveTo(34, -70, 4, -76); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // linear blend of two spoon poses {x, y, ang, len}
  const mixPose = (a, b, q) => ({ x: lerp(a.x, b.x, q), y: lerp(a.y, b.y, q), ang: lerp(a.ang, b.ang, q), len: lerp(a.len, b.len, q) });
  // a path through key poses [{p, x, y, ang}] with a soft ease on every leg
  function keyPose(p, KF) {
    for (let i = 0; i < KF.length - 1; i++) if (p <= KF[i + 1].p) { const q = E.inOut(clamp((p - KF[i].p) / (KF[i + 1].p - KF[i].p), 0, 1)); return { x: lerp(KF[i].x, KF[i + 1].x, q), y: lerp(KF[i].y, KF[i + 1].y, q), ang: lerp(KF[i].ang, KF[i + 1].ang, q), len: 380 }; }
    const l = KF[KF.length - 1]; return { x: l.x, y: l.y, ang: l.ang, len: 380 };
  }

  // ---------- the lemonade shot: stir, gone, taste (and the still picture the zoom starts from) ----------
  const KT = { gx: 1000, gy: 740, gs: 1.55, cx: 500, cy: 650 };
  function kitchenStory(ctx, t, Lt, o) {
    o = o || {}; const { gx, gy, gs, cx, cy } = KT, N = 9;
    const gIn = Lt.cwin('stir', 'curie is making', 0.5, E.outBack, 0.05), jarIn = Lt.cwin('stir', 'curie is making', 0.5, E.outBack, 0.4);
    const arrive = Lt.cwin('stir', 'in goes a spoon', 0.55, E.out), tip = Lt.cwin('stir', 'in goes a spoon', 0.4, E.inOut, 0.5), fall = Lt.cwin('stir', 'in goes a spoon', 0.7, null, 0.7);
    const T0 = Lt.chunk('stir', 'in goes a spoon'), T1 = Lt.chunk('stir', 'stir... stir'), T2 = Lt.chunk('gone', 'look') + 0.15;
    const dip = Lt.cwin('stir', 'stir... stir', 0.45, E.inOut), leave = seg(t, T2, T2 + 0.7, E.inOut);
    const dis = seg(t, T1 + 0.45, Lt.chunk('gone', 'the sugar is gone') + 0.2, E.inOut);
    const tasteA = Lt.chunk('taste', 'curie tastes'), yum = Lt.chunk('taste', 'yum'), tp = seg(t, tasteA + 0.05, yum - 0.08), back = seg(t, yum + 0.35, yum + 1.1, E.inOut);
    const phiAt = tt => Math.max(0, tt - T1) * 2 * Math.PI * 1.45;
    const hover = { x: gx + 40, y: gy - GL.h * gs - 120, ang: -0.32, len: 380 }, away = { x: 1860, y: 110, ang: -0.35, len: 380 };
    // ---- where the spoon is ----
    let sp = null, heap = 0, drop = 0;
    if (t < T1) { if (arrive > 0) { sp = { x: lerp(away.x, hover.x, arrive), y: lerp(away.y, hover.y, arrive), ang: hover.ang - 0.5 * tip, len: 380 }; heap = 1 - Math.min(1, fall * 2); } }
    else if (t < tasteA) {
      const sPose = stirPose(gx, gy, gs, phiAt(Math.min(t, T2)), 42);
      if (t <= T2) sp = t < T1 + 0.5 ? mixPose({ x: hover.x, y: hover.y, ang: hover.ang - 0.5, len: 380 }, sPose, dip) : sPose;
      else if (leave < 1) sp = mixPose(sPose, away, leave);
    } else {
      const W1 = { x: gx + 14, y: gy - 300 * gs / 1.55 + 30 }, mouth = { x: cx + 52, y: cy + 46 };
      const KF = [{ p: 0, x: away.x, y: away.y, ang: -0.35 }, { p: 0.34, x: W1.x, y: W1.y, ang: -1.3 }, { p: 0.5, x: gx + 14, y: gy - 430, ang: -1.25 }, { p: 0.7, x: gx - 190, y: gy - 470, ang: -0.9 }, { p: 1, x: mouth.x, y: mouth.y, ang: -0.45 }];
      const at = keyPose(tp, KF);
      if (t < yum + 0.35) sp = at; else if (back < 1) sp = mixPose(at, away, back);
      drop = seg(tp, 0.42, 0.5) * (1 - seg(t, yum - 0.04, yum + 0.2));
    }
    // ---- Curie ----
    const sweet = Lt.cafter('taste', "it's sweet"), still = Lt.cafter('taste', 'so the sugar must');
    let mood = 'talk', armR = -0.5;
    if (Lt.after('gone')) { mood = Lt.cafter('gone', 'where did it go') ? 'think' : Lt.cafter('gone', 'the sugar is gone') ? 'wow' : 'talk'; armR = Lt.cafter('gone', 'look') && !Lt.cafter('gone', 'where did it go') ? -1.25 : -0.45; }
    if (Lt.after('taste')) { mood = t < yum - 0.1 ? 'talk' : still ? 'think' : 'happy'; if (t >= yum - 0.1 && t < yum - 0.1 + 0.3) mood = 'wow'; armR = -0.3; }
    if (o.mood) mood = o.mood;
    const hop = Math.sin(Math.PI * seg(t, yum, yum + 0.45)) * 34;
    const bulb = o.bulb != null ? o.bulb : Lt.cwin('taste', 'so the sugar must', 0.5);
    kitchen(ctx, t);
    L.pip(ctx, { x: cx, y: cy - (Lt.after('taste') ? hop : 0), s: 1.3, t, mood, armR, armL: 0.6, lookX: 0.8, lookY: 0.1, bulb });
    counter(ctx, gy);
    // jar and lemon on the counter
    if (jarIn > 0) { ctx.save(); ctx.translate(1500, gy); ctx.scale(jarIn, jarIn); jar(ctx, 0, 0, 0.95, 0, 'sugar'); ctx.restore(); lemon(ctx, 1710, gy, 0.9 * jarIn); }
    // glass of lemonade: crystals fall, pile up, dissolve
    const fi = i => seg(fall, i * 0.05, i * 0.05 + 0.5);
    if (gIn > 0) {
      ctx.save(); ctx.translate(gx, gy); ctx.scale(gIn, gIn); ctx.translate(-gx, -gy);
      const stirAmt = (t >= T1 + 0.3 && t < T2 + 0.4 ? 1 : 0);
      glass(ctx, gx, gy, gs, { t, color: LEMON_C, level: 0.78, wave: 3 + 3 * stirAmt, inner: (c, ly) => { swirl(c, phiAt(t) * 1.4, stirAmt * clamp((t - T1 - 0.2) * 2, 0, 1) * (1 - leave)); pile(c, N, i => fi(i) >= 1 ? erode(i, N, dis) : 0, stirAmt && dis < 1 ? t : 0); } });
      lemonSlice(ctx, gx - 92 * gs * 0.95, gy - GL.h * gs + 6, 0.9, -0.3);
      ctx.restore();
    }
    // crystals falling from the spoon
    if (fall > 0 && fall < 1.4) for (let i = 0; i < N; i++) { const f = fi(i); if (f <= 0 || f >= 1) continue; const q = PILE[i], bx = lerp(hover.x - 20 + (i % 3) * 22, gx + q.x * gs, E.out(f)), by = lerp(hover.y + 8, gy + q.y * gs, E.in(f)); crystal(ctx, bx, by, 11 * gs, f * 5 + i, 1); }
    if (sp) spoon(ctx, sp.x, sp.y, sp.ang, sp.len, 1.2, { heap: heap > 0.02 ? heap * 1.2 : 0, drop });
    // stickers and question marks
    if (Lt.after('gone')) { const q1 = Lt.cwin('gone', 'where did it go', 0.4, E.outBack), q2 = Lt.cwin('gone', 'where did it go', 0.4, E.outBack, 0.25); const qa = 1 - Lt.win('taste', 0, 0.3); if (q1 > 0) L.questionMark(ctx, 850, 215, 0.8 * q1 * qa, t); if (q2 > 0) L.questionMark(ctx, 1170, 235, 0.8 * q2 * qa, t); }
    L.sticker(ctx, 'SWEET!', 560, 262, Lt.cwin('taste', "it's sweet", 0.5) * (1 - Lt.win('closer', 0.35, 0.3)), { bg: P.pink, size: 92, rot: -0.08 });
    if (o.after) o.after();
  }


  // ---------- sand: grains that fall into the glass, swirl while stirred, then sink and stay ----------
  const SAND = (() => { const r = L.rng(21), out = []; for (let i = 0; i < 56; i++) { const x = (r() - 0.5) * 128, m = Math.max(0, 1 - Math.pow(x / 70, 2)); out.push({ x, y: -6 - r() * (8 + 30 * m), s: 3.3 + r() * 2.0, rho: 14 + r() * 56, ph: r() * 6.28, hy: -45 - r() * 150, w: 0.8 + r() * 0.8, k: r() }); } return out; })();
  // fell: 0..1 the grains have dropped in (from x0 in glass coordinates); settle: 0..1 they have sunk to the floor; phi: the stirring angle
  function sandInGlass(ctx, fell, settle, phi, x0) {
    if (fell <= 0) return; ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    for (const g of SAND) {
      const f = seg(fell, g.k * 0.5, g.k * 0.5 + 0.5), se = seg(settle, g.k * 0.45, g.k * 0.45 + 0.55, E.in); if (f <= 0) continue;
      const a = g.ph + phi * g.w, sx = lerp(x0 + (g.k - 0.5) * 16, Math.cos(a) * g.rho, E.out(f)), sy = lerp(-330, g.hy, E.in(f)) + Math.sin(a) * g.rho * 0.16 * f;
      const x = lerp(sx, g.x, se), y = lerp(sy, g.y, se); ctx.save(); ctx.translate(x, y); ctx.rotate(g.ph + se); ctx.fillStyle = g.k > 0.5 ? SAND_C : '#D5A460'; ctx.fillRect(-g.s, -g.s, 2 * g.s, 2 * g.s); ctx.strokeRect(-g.s, -g.s, 2 * g.s, 2 * g.s); ctx.restore();
    }
    ctx.restore();
  }
  // a spoon that waits above a glass, tips (pours), dips in and stirs, then leaves. g = {gx, gy, gs}; T = {a: arrives, tip, dip, out} in seconds
  function spoonRun(t, g, T, away) {
    const hover = { x: g.gx + 40, y: g.gy - GL.h * g.gs - 120, ang: -0.32, len: 380 };
    const arrive = seg(t, T.a, T.a + 0.55, E.out), tip = seg(t, T.tip, T.tip + 0.4, E.inOut), dip = seg(t, T.dip, T.dip + 0.45, E.inOut), leave = seg(t, T.out, T.out + 0.7, E.inOut);
    const phi = Math.max(0, Math.min(t, T.out) - T.dip) * 2 * Math.PI * 1.45; let sp = null;
    if (t < T.dip) { if (arrive > 0) sp = { x: lerp(away.x, hover.x, arrive), y: lerp(away.y, hover.y, arrive), ang: hover.ang - 0.5 * tip, len: 380 }; }
    else { const sPose = stirPose(g.gx, g.gy, g.gs, phi, 42); sp = t < T.dip + 0.5 ? mixPose({ x: hover.x, y: hover.y, ang: hover.ang - 0.5, len: 380 }, sPose, dip) : sPose; if (leave > 0) sp = mixPose(sPose, away, leave); if (leave >= 1) sp = null; }
    return { sp, tip, phi, hover, stirring: t >= T.dip + 0.3 && t < T.out + 0.3, leave };
  }
  // ---------- the sand test ----------
  function sandShot(ctx, t, Lt) {
    const { gx, gy, gs, cx, cy } = KT;
    const jIn = Lt.cwin('test', 'scientists test it', 0.5, E.outBack, 0.2), pourA = Lt.cwin('test', "let's try sand", 0.6, E.inOut, 0.1), retA = Lt.cwin('sand', 'stir... stir', 0.6, E.inOut);
    const fell = Lt.cwin('test', "let's try sand", 1.4, null, 0.75), T1 = Lt.chunk('sand', 'stir... stir'), T2 = Lt.chunk('sand', 'the sand sinks');
    const settle = seg(t, T2 + 0.2, T2 + 2.3, E.inOut);
    const run = spoonRun(t, { gx, gy, gs }, { a: T1 - 0.4, tip: 1e9, dip: T1 + 0.1, out: T2 }, { x: 1860, y: 110, ang: -0.35, len: 380 });
    const murk = seg(fell, 0.3, 1) * (1 - settle);
    const mood = Lt.cafter('sand', "sand doesn't dissolve") ? 'wow' : Lt.cafter('sand', 'the sand sinks') ? 'think' : 'talk';
    kitchen(ctx, t);
    L.pip(ctx, { x: cx, y: cy, s: 1.3, t, mood, armR: Lt.cafter('test', 'scientists test it') && !Lt.after('sand') ? -1.1 : -0.45, armL: 0.6, lookX: 0.8, lookY: 0.1 });
    counter(ctx, gy);
    lemon(ctx, 1710, gy, 0.9);
    glass(ctx, gx, gy, gs, { t, color: WATER_C, level: 0.78, wave: 3 + 3 * (run.stirring ? 1 : 0), inner: (c, ly) => { c.fillStyle = 'rgba(205,160,95,' + (0.34 * murk) + ')'; c.fillRect(-100, ly - 5, 200, -ly + 10); swirl(c, run.phi * 1.4, run.stirring ? 1 : 0, ly); }, outer: c => sandInGlass(c, fell, settle, run.phi, 39) });
    // the sand jar: tips over the glass, then goes back
    if (jIn > 0) { const k = pourA * (1 - retA); ctx.save(); const jx = lerp(1500, 1155, k), jy = lerp(gy, 353, k); ctx.translate(jx, jy); ctx.scale(jIn, jIn); ctx.translate(-jx, -jy); jar(ctx, jx, jy, 0.95, -1.9 * k, 'sand'); ctx.restore(); }
    if (run.sp) spoon(ctx, run.sp.x, run.sp.y, run.sp.ang, run.sp.len, 1.2, {});
    L.sticker(ctx, 'Scientists test it!', 760, 205, Lt.cwin('test', 'scientists test it', 0.5) * (1 - Lt.cwin('test', 'does everything', 0.3)), { bg: P.blue, color: P.white, size: 76, rot: -0.03 });
    const qa = Lt.cwin('test', 'does everything', 0.5, E.outBack) * (1 - Lt.cwin('test', "let's try sand", 0.3)); if (qa > 0) L.questionMark(ctx, 1000, 215, 0.85 * qa, t);
    L.sticker(ctx, 'sand!', 1500, 440, Lt.cwin('test', "let's try sand", 0.5) * (1 - Lt.cwin('sand', 'stir... stir', 0.3)), { bg: SAND_C, size: 80, rot: 0.06 });
    L.sticker(ctx, 'sinks!', 760, 215, Lt.cwin('sand', 'the sand sinks', 0.5) * (1 - Lt.cwin('sand', "sand doesn't dissolve", 0.3)), { bg: P.greyDark, color: P.white, size: 84, rot: -0.05 });
    L.sticker(ctx, "does not dissolve!", 960, 200, Lt.cwin('sand', "sand doesn't dissolve", 0.5), { bg: P.red, color: P.white, size: 76, rot: -0.03 });
  }

  // ---------- the zoom lens and the tiny-bits scenes ----------
  // a circular window (centre cx,cy radius r) onto the bits model, magnified by k; f = bitsField options
  function lensView(ctx, t, cx, cy, r, k, f) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#EEF6FF'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-960, -490);
    ctx.strokeStyle = 'rgba(95,184,255,0.14)'; ctx.lineWidth = 3 / k; ctx.beginPath();
    for (let x = -2400; x <= 4200; x += 120) { ctx.moveTo(x, -2400); ctx.lineTo(x, 3400); }
    for (let y = -2400; y <= 3400; y += 120) { ctx.moveTo(-2400, y); ctx.lineTo(4200, y); }
    ctx.stroke(); ctx.restore();
    bitsField(FIELD, ctx, t, Object.assign({ k, ox: cx, oy: cy, fx: 960, fy: 490 }, f || {}));
    ctx.restore();
    if (r < 1000) L.magnifier(ctx, cx, cy, r, 1);
  }
  function bigCube(ctx, x, y, hs, a) { // a whole grain of sugar, drawn big
    if (a <= 0) return; ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 10;
    ctx.fillStyle = '#FFFFFF'; roundRect(ctx, -hs, -hs, 2 * hs, 2 * hs, hs * 0.16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9DCF3'; ctx.beginPath(); ctx.moveTo(hs * 0.8, -hs * 0.1); ctx.lineTo(hs * 0.8, hs * 0.62); ctx.lineTo(-hs * 0.1, hs * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; roundRect(ctx, -hs * 0.72, -hs * 0.72, hs * 0.5, hs * 0.14, hs * 0.07); ctx.fill();
    ctx.restore();
  }
  function legend(ctx, x, y, p) { // water / sugar key
    if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = P.white; roundRect(ctx, -250, -52, 500, 104, 40); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.stroke();
    circle(ctx, -190, 0, 25, WATER_BIT, P.ink, 4); text(ctx, 'water', -145, 3, { size: 46, weight: 600, align: 'left' });
    circle(ctx, 38, 0, 25, SUGAR_BIT, P.ink, 4); text(ctx, 'sugar', 83, 3, { size: 46, weight: 600, align: 'left' });
    ctx.restore();
  }
  // zoom in: the lens pops over the glass, then grows until the bits fill the screen
  function closerScene(ctx, t, Lt) {
    const pop = Lt.cwin('closer', "let's look closer", 0.55, E.outBack, 0.1), gp = seg(t, Lt.chunk('closer', 'much...') - 0.1, Lt.start('bits') - 0.35, E.in);
    const mood = Lt.cafter('closer', 'much...') ? 'wow' : Lt.cafter('closer', "let's look closer") ? 'wink' : 'think';
    kitchenStory(ctx, t, Lt, { mood });
    const r = pop <= 0 ? 0 : gp > 0 ? lerp(150, 2400, gp) : 150 * pop;
    if (r > 2) lensView(ctx, t, 1000, 520, r, clamp(r / 1250, 0.11, 1), { rel: 1 }); // the sugar is still in the lemonade: its bits are spread out among the water bits
  }
  // the model at full size: a grain falls in, is made of bits, the water bits pull them apart and they spread out
  function bitsScene(ctx, t, Lt) {
    lab(ctx);
    const C1 = Lt.chunk('bits', 'a grain of sugar'), C2 = Lt.chunk('bits', 'just like ice cream'), S1 = Lt.chunk('spread', 'the water bits pull'), S2 = Lt.chunk('spread', 'then the sugar bits'), S3 = Lt.chunk('spread', 'between the water bits');
    const fall = seg(t, C1 + 0.05, C1 + 0.95), cubeA = 1 - seg(t, C1 + 1.55, C1 + 2.25), bonds = seg(t, C1 + 2.0, C1 + 2.7);
    const tug = seg(t, S1 + 0.2, S1 + 1.0, E.inOut) * (1 - seg(t, S2 - 0.3, S2 + 0.5)), rel = 0.22 * seg(t, S1 + 0.3, S1 + 1.9, E.inOut) + 0.78 * seg(t, S2, S3 + 1.3, E.inOut);
    bitsField(FIELD, ctx, t, { fall, bonds, tug, rel });
    if (fall > 0) { const off = fall >= 1 ? 0 : -(1 - E.in(clamp(fall / 0.85, 0, 1))) * 760; bigCube(ctx, FIELD.cx, FIELD.cy + off, 236, cubeA); }
    legend(ctx, 1560, 118, Lt.cwin('bits', 'a grain of sugar', 0.5, null, 1.2));
    L.sticker(ctx, 'a grain of sugar', 780, 118, Lt.cwin('bits', 'a grain of sugar', 0.45, null, 0.45) * (1 - Lt.cwin('bits', 'a grain of sugar', 0.25, null, 1.7)), { bg: P.white, size: 72, rot: -0.03 });
    L.sticker(ctx, 'tiny bits!', 780, 118, Lt.cwin('bits', 'a grain of sugar', 0.45, null, 1.75) * (1 - Lt.cwin('bits', 'just like ice cream', 0.25)), { bg: P.pink, size: 78, rot: 0.03 });
    // the ice cream from Episode 1
    const ib = Lt.cwin('bits', 'just like ice cream', 0.5, E.outBack) * (1 - Lt.cwin('spread', 'the water bits pull', 0.3, null, 0.2));
    if (ib > 0) { ctx.save(); ctx.translate(205, 108); ctx.scale(ib, ib); circle(ctx, 0, 0, 88, P.white, P.ink, 7); L.iceCream(ctx, 0, 58, 0.29, 0, t); ctx.restore(); L.sticker(ctx, 'like ice cream!', 620, 118, ib, { bg: P.white, size: 62, rot: -0.04 }); }
    L.sticker(ctx, 'pull!', 960, 118, Lt.cwin('spread', 'the water bits pull', 0.4, null, 0.55) * (1 - Lt.cwin('spread', 'then the sugar bits', 0.25)), { bg: P.blue, color: P.white, size: 84, rot: -0.04 });
    L.sticker(ctx, 'spread out!', 960, 118, Lt.cwin('spread', 'then the sugar bits', 0.45) * (1 - Lt.cwin('spread', 'between the water bits', 0.25)), { bg: P.pink, size: 84, rot: 0.03 });
    L.sticker(ctx, 'between the water bits', 800, 118, Lt.cwin('spread', 'between the water bits', 0.45), { bg: P.white, size: 66, rot: -0.02 });
  }
  // zoom out: the bits get too tiny to see; the sugar dissolves
  function dissolveScene(ctx, t, Lt) {
    const T0 = Lt.chunk('dissolve', 'now they are') + 0.1, zp = seg(t, T0, T0 + 2.0, E.out), r = lerp(1250, 150, zp);
    const D = Lt.cwin('dissolve', 'the sugar dissolves', 0.5, null);
    kitchenStory(ctx, t, Lt, { mood: D > 0 ? 'happy' : 'talk', bulb: 0 });
    lensView(ctx, t, 1000, 520, r, clamp(r / 1250, 0.11, 1), { rel: 1 });
    L.sticker(ctx, 'too tiny to see', 1000, 190, Lt.cwin('dissolve', 'now they are', 0.5, null, 1.2) * (1 - Lt.cwin('dissolve', 'the sugar dissolves', 0.25)), { bg: P.white, size: 78, rot: -0.03 });
    L.sticker(ctx, 'DISSOLVES!', 1000, 190, D, { bg: P.blue, color: P.white, size: 100, rot: 0.03 });
    if (D > 0) L.sparkles(ctx, 1000, 500, t, 4, 7, 300);
  }

  // ---------- pink sugar bits spreading through the water of a glass (glass coordinates), from (x0,y0); a = 0..1 ----------
  const DOTS = (() => { const r = L.rng(12), out = []; for (let i = 0; i < 26; i++) out.push({ x: (r() * 2 - 1) * 62, y: -30 - r() * 140, ph: r() * 6.28, k: r(), s: 0.8 + r() * 0.5 }); return out; })();
  function dotsInGlass(ctx, t, a, x0, y0, rad) {
    if (a <= 0) return;
    for (const d of DOTS) { const e = E.out(seg(a, d.k * 0.5, d.k * 0.5 + 0.5)); circle(ctx, lerp(x0, d.x, e) + Math.sin(t * 2.2 * d.s + d.ph) * 3, lerp(y0, d.y, e) + Math.cos(t * 2.0 * d.s + d.ph) * 3, rad, SUGAR_BIT, P.ink, 2.2); }
  }
  function notEqual(ctx, x, y, p) { // a big "is not equal to" sign
    if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
    for (const [w, c] of [[44, P.ink], [26, P.red]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-58, -26); ctx.lineTo(58, -26); ctx.moveTo(-58, 26); ctx.lineTo(58, 26); ctx.moveTo(34, -88); ctx.lineTo(-34, 88); ctx.stroke(); }
    ctx.restore();
  }
  function tick(ctx, x, y, r, p) { if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s); circle(ctx, 0, 0, r, P.green, P.ink, 8); ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 0.1, r * 0.38); ctx.lineTo(r * 0.5, -r * 0.34); ctx.stroke(); ctx.restore(); }
  function cross(ctx, x, y, r, p) { if (p <= 0) return; const s = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(s, s); circle(ctx, 0, 0, r, P.red, P.ink, 8); ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * 0.36, -r * 0.36); ctx.lineTo(r * 0.36, r * 0.36); ctx.moveTo(r * 0.36, -r * 0.36); ctx.lineTo(-r * 0.36, r * 0.36); ctx.stroke(); ctx.restore(); }
  function table(ctx, x, y, w) { // an outdoor table, top edge at y
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.fillStyle = '#B5713A';
    for (const sx of [-1, 1]) { roundRect(ctx, x + sx * (w / 2 - 70) - 14, y + 20, 28, 170, 8); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#D9B277'; roundRect(ctx, x - w / 2, y, w, 36, 12); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // ---------- not melting: two panels ----------
  function notmeltScene(ctx, t, Lt) {
    const M = Lt.chunk('notmelt', 'melting needs heat'), D = Lt.chunk('notmelt', 'dissolving is tiny bits');
    ctx.fillStyle = P.cream; ctx.fillRect(0, 0, W, H);
    const pL = Lt.win('notmelt', 0.1, 0.5, E.outBack), pR = Lt.win('notmelt', 0.4, 0.5, E.outBack);
    if (panel(ctx, 140, 140, 700, 500, pL)) {
      const melt = 0.9 * seg(t, M + 0.3, M + 3.6, E.inOut);
      L.sun(ctx, 710, 272, 56, t);
      if (t > M + 0.05) L.heatWaves(ctx, 560, 520, t, 3, 170, 'rgba(255,90,60,0.85)');
      L.iceCream(ctx, 330, 575, 0.95, melt, t, { puddleY: 581 });
      ctx.restore();
    }
    if (panel(ctx, 1080, 140, 700, 500, pR)) {
      const gx = 1430, gy = 590, gs = 1.2, fallP = seg(t, D + 0.05, D + 0.85, E.in), cubeA = 1 - seg(t, D + 0.95, D + 1.5), spread = seg(t, D + 1.0, D + 2.6);
      const cubeY = lerp(-262 + 8 * Math.sin(t * 3), -16, fallP);
      glass(ctx, gx, gy, gs, { t, color: WATER_C, level: 0.78, inner: c => dotsInGlass(c, t, spread, 0, -44, 9.5), outer: c => { if (cubeA > 0) { c.save(); c.globalAlpha *= cubeA; sugarCube(c, 0, cubeY, 0.62, 0.15 * (1 - fallP)); c.restore(); } } });
      ctx.restore();
    }
    notEqual(ctx, 960, 380, Lt.cwin('notmelt', 'dissolving is not melting', 0.5, null, 1.0));
    L.sticker(ctx, 'MELTING', 490, 125, pL, { bg: P.red, color: P.white, size: 64, rot: -0.04 });
    L.sticker(ctx, 'DISSOLVING', 1430, 125, pR, { bg: P.blue, color: P.white, size: 64, rot: 0.03 });
    L.sticker(ctx, 'needs heat!', 490, 715, Lt.cwin('notmelt', 'melting needs heat', 0.5, null, 0.5), { bg: P.sun, size: 64, rot: -0.03 });
    L.sticker(ctx, 'in water!', 1430, 715, Lt.cwin('notmelt', 'dissolving is tiny bits', 0.5, null, 1.9), { bg: '#BFE6FF', size: 64, rot: 0.03 });
    const talk = Lt.cafter('notmelt', 'dissolving is tiny bits') ? 'happy' : 'talk';
    L.pip(ctx, { x: 960, y: 705, s: 0.8, t, mood: talk, armR: -0.9, armL: 0.6, lookX: 0 });
  }

  // ---------- salt comes back ----------
  const SALT_GRAINS = (() => { const r = L.rng(41), out = []; for (let i = 0; i < 16; i++) out.push({ x: (r() - 0.5) * 70, k: r(), rot: r() * 6 }); return out; })();
  function saltScene(ctx, t, Lt) {
    const S0 = Lt.start('salt'), C1 = Lt.chunk('salt', 'and if the salty water'), C2 = Lt.chunk('salt', 'the salt comes back'), C3 = Lt.chunk('salt', 'it was there all along');
    L.park(ctx, t, { tree: false, sunX: 1640, sunY: 200, sunR: 120 });
    const DX = 1130, DY = 712, DS = 1.25, dry = seg(t, C1 + 0.4, C1 + 2.8, E.inOut), back = seg(t, C2, C2 + 1.0), level = 1 - dry;
    const mood = Lt.cafter('salt', 'it was there all along') ? 'happy' : Lt.cafter('salt', 'the salt comes back') ? 'wow' : Lt.cafter('salt', 'and if the salty water') ? 'think' : 'talk';
    L.pip(ctx, { x: 430, y: 690, s: 1.3, t, mood, armR: mood === 'wow' ? -1.2 : -0.5, armL: 0.6, lookX: 0.8 });
    table(ctx, DX, DY, 800);
    dish(ctx, DX, DY, DS, level, back, t);
    // the shaker comes over the dish, tips, pours and goes home
    const come = seg(t, S0, S0 + 0.6, E.out), tipA = E.inOut(seg(t, S0 + 0.3, S0 + 0.8)), goHome = seg(t, C1 - 0.1, C1 + 0.5, E.inOut);
    if (t < C1 + 0.7) {
      const k = come * (1 - goHome), sx = lerp(1450, 1085, k), sy = lerp(DY, 482, k), rot = 2.5 * tipA * (1 - goHome);
      shaker(ctx, sx, sy, 0.9, rot);
      const surf = DY + DS * (-8 - 76);
      for (const g of SALT_GRAINS) { const f = seg(t, S0 + 0.8 + g.k * 0.5, S0 + 1.35 + g.k * 0.5), fade = 1 - seg(t, S0 + 1.45 + g.k * 0.4, S0 + 1.9 + g.k * 0.4); if (f <= 0 || f >= 1 && fade <= 0) continue; crystal(ctx, DX + g.x * 0.8, lerp(500, surf + 18, E.in(f)), 7, g.rot + f * 4, f >= 1 ? fade : 1); }
    }
    if (t > C1 + 0.4 && t < C2 + 0.25) L.heatWaves(ctx, DX, 575, t, 3, 130);
    if (back > 0) L.sparkles(ctx, DX, 640, t, 3, 8, 210);
    const day = (n, a, b) => Lt.cwin('salt', 'and if the salty water', 0.3, null, a) * (1 - Lt.cwin('salt', 'and if the salty water', 0.3, null, b));
    L.sticker(ctx, 'Day 1', DX, 330, day(1, 0.4, 1.1), { bg: P.white, size: 88, rot: -0.04 });
    L.sticker(ctx, 'Day 2', DX, 330, day(2, 1.15, 1.85), { bg: P.white, size: 88, rot: 0.03 });
    L.sticker(ctx, 'Day 3', DX, 330, day(3, 1.9, 2.8), { bg: P.white, size: 88, rot: -0.03 });
    L.sticker(ctx, 'SALT!', DX, 330, Lt.cwin('salt', 'the salt comes back', 0.5, null, 0.1) * (1 - Lt.cwin('salt', 'it was there all along', 0.25)), { bg: SALT_C, size: 96, rot: 0.03 });
    L.sticker(ctx, 'it was there!', DX, 330, Lt.cwin('salt', 'it was there all along', 0.5, null, 0.2), { bg: P.pink, size: 84, rot: -0.03 });
  }

  // ---------- say it with me ----------
  function sayitScene(ctx, t, Lt) {
    const mood = Lt.cafter('sayit', "it's still... there") ? 'happy' : Lt.cafter('sayit', "it's still there") ? 'talk' : Lt.cafter('sayit', 'say it with me') ? 'happy' : 'think';
    const up = Lt.cafter('sayit', 'say it with me') ? 1 : 0, w = Math.sin(t * 7) * 0.25 * up;
    kitchen(ctx, t);
    L.pip(ctx, { x: 480, y: 650, s: 1.3, t, mood, armR: up ? -1.15 + w : -0.45, armL: up ? -0.95 - w : 0.6, lookX: 0.8, bulb: 0 });
    counter(ctx, 740);
    glass(ctx, 1250, 740, 1.25, { t, color: LEMON_C, level: 0.78 });
    lemonSlice(ctx, 1250 - 92 * 1.25 * 0.95, 740 - GL.h * 1.25 + 6, 0.9, -0.3);
    lensView(ctx, t, 1345, 590, 120, 0.11, { rel: 1 });
    const q = Lt.cwin('sayit', 'so where did the sugar go', 0.5, E.outBack) * (1 - Lt.cwin('sayit', 'say it with me', 0.3)); if (q > 0) L.questionMark(ctx, 1000, 330, 0.9 * q, t);
    if (Lt.cafter('sayit', "it's still there")) L.sparkles(ctx, 1260, 520, t, 6, 7, 330); // behind the sticker, so they never land on its words
    L.sayItSticker(ctx, "It's still there!", Lt.cwin('sayit', "it's still there", 0.8), t);
  }

  // ---------- try it at home: two glasses, sugar and sand ----------
  const HG = [{ gx: 860, gy: 760, gs: 1.5 }, { gx: 1340, gy: 760, gs: 1.5 }];
  // one glass at home with its spoon: kind 'sugar' | 'sand'; T = {a: spoon arrives, tip, dip, out}; pop = 0..1 how far the glass has appeared
  function homeGlass(ctx, t, g, kind, T, pop, from) {
    const run = spoonRun(t, g, T, from), N = 9, fall = seg(t, T.tip + 0.1, T.tip + 0.8), fell = seg(t, T.tip + 0.1, T.tip + 1.1);
    const dis = seg(t, T.dip + 0.5, T.dip + 1.9, E.inOut), settle = seg(t, T.out + 0.1, T.out + 2.0, E.inOut), fi = i => seg(fall, i * 0.05, i * 0.05 + 0.5), stirAmt = run.stirring ? 1 : 0;
    if (pop > 0) {
      ctx.save(); ctx.translate(g.gx, g.gy); ctx.scale(pop, pop); ctx.translate(-g.gx, -g.gy);
      glass(ctx, g.gx, g.gy, g.gs, { t, color: WATER_C, level: 0.75, wave: 3 + 3 * stirAmt,
        inner: (c, ly) => {
          if (kind === 'sand') { c.fillStyle = 'rgba(205,160,95,' + (0.32 * seg(fell, 0.3, 1) * (1 - settle)) + ')'; c.fillRect(-100, ly - 5, 200, -ly + 10); }
          swirl(c, run.phi * 1.4, stirAmt * clamp((t - T.dip - 0.2) * 2, 0, 1) * (1 - run.leave), ly);
          if (kind === 'sugar') pile(c, N, i => fi(i) >= 1 ? erode(i, N, dis) : 0, stirAmt && dis < 1 ? t : 0);
        },
        outer: c => { if (kind === 'sand') sandInGlass(c, fell, settle, run.phi, 33); } });
      ctx.restore();
    }
    if (kind === 'sugar' && fall > 0 && fall < 1.4) for (let i = 0; i < N; i++) { const f = fi(i); if (f <= 0 || f >= 1) continue; const q = PILE[i], bx = lerp(run.hover.x - 20 + (i % 3) * 22, g.gx + q.x * g.gs, E.out(f)), by = lerp(run.hover.y + 8, g.gy + q.y * g.gs, E.in(f)); crystal(ctx, bx, by, 11 * g.gs, f * 5 + i, 1); }
    if (run.sp) spoon(ctx, run.sp.x, run.sp.y, run.sp.ang, run.sp.len, 1.2, { heap: 1 - Math.min(1, fall * 2.2), sand: kind === 'sand' });
    return run;
  }
  function tryScene(ctx, t, Lt) {
    const A0 = Lt.chunk('try1', "let's try it at home"), A1 = Lt.chunk('try1', 'ask a grown-up'), A2 = Lt.chunk('try1', 'and a spoon of sand');
    const B0 = Lt.chunk('try2', 'stir the sugar'), B1 = Lt.chunk('try2', 'and the sand into the other'), B2 = Lt.chunk('try2', 'which one disappears');
    const C0 = Lt.chunk('try3', 'taste only'), C1 = Lt.chunk('try3', 'is the sugar still there'), [g1, g2] = HG;
    const mood = t >= C1 ? 'think' : t >= A0 + 0.6 && t < A1 ? 'happy' : 'talk';
    kitchen(ctx, t, { counterY: 760, window: false });
    L.pip(ctx, { x: 340, y: 650, s: 1.15, t, mood, armR: t < A1 ? -1.0 + Math.sin(t * 8) * 0.3 : -0.45, armL: 0.6, lookX: 0.8, bulb: t >= C1 ? Lt.cwin('try3', 'is the sugar still there', 0.5) : 0 });
    counter(ctx, 760);
    homeGlass(ctx, t, g1, 'sugar', { a: A1 + 2.3, tip: B0 + 0.2, dip: B0 + 0.9, out: B1 + 0.35 }, Lt.cwin('try1', 'ask a grown-up', 0.45, E.outBack, 1.0), { x: g1.gx - 260, y: 70, ang: -0.35, len: 380 });
    homeGlass(ctx, t, g2, 'sand', { a: A2 + 0.2, tip: B1 + 0.15, dip: B1 + 0.95, out: B2 + 0.0 }, Lt.cwin('try1', 'ask a grown-up', 0.45, E.outBack, 1.25), { x: g2.gx + 260, y: 70, ang: -0.35, len: 380 });
    L.tryBanner(ctx, Lt.cwin('try1', "let's try it at home", 0.5) * (1 - Lt.cwin('try1', 'ask a grown-up', 0.3, null, 0.2)));
    L.grownUpBadge(ctx, 180, 300, Lt.cwin('try1', 'ask a grown-up', 0.5, null, 0.15));
    L.sticker(ctx, 'sugar', g1.gx - 300, 470, Lt.cwin('try1', 'ask a grown-up', 0.4, null, 2.4) * (1 - Lt.cwin('try2', 'which one disappears', 0.3)), { bg: P.white, size: 60, rot: -0.04 });
    L.sticker(ctx, 'sand', g2.gx + 300, 470, Lt.cwin('try1', 'and a spoon of sand', 0.4, null, 0.3) * (1 - Lt.cwin('try2', 'which one disappears', 0.3)), { bg: SAND_C, size: 60, rot: 0.04 });
    const q = Lt.cwin('try2', 'which one disappears', 0.5, E.outBack) * (1 - Lt.cwin('try3', 'taste only', 0.3));
    if (q > 0) { L.questionMark(ctx, g1.gx, 290, 0.8 * q, t); L.questionMark(ctx, g2.gx, 290, 0.8 * q, t); }
    tick(ctx, g1.gx, 290, 62, Lt.cwin('try3', 'taste only', 0.45, null, 0.9) * (1 - Lt.cwin('try3', 'is the sugar still there', 0.3)));
    cross(ctx, g2.gx, 290, 62, Lt.cwin('try3', 'taste only', 0.45, null, 1.1));
    L.sticker(ctx, 'OK!', 400, 250, Lt.cwin('try3', 'taste only', 0.45, null, 2.6), { bg: P.green, color: P.white, size: 84, rot: -0.05 });
    const sq = Lt.cwin('try3', 'is the sugar still there', 0.5, E.outBack, 0.3); if (sq > 0) L.questionMark(ctx, g1.gx, 290, 0.8 * sq, t); // pops once the tick above has faded, so the two never overlap
  }

  // ======================================================================
  // Website: Try it 1 "Stir the sugar" and Try it 2 "Does it dissolve?"
  // ======================================================================
  const snd = (f, ...a) => { try { if (LSC.sound && LSC.sound[f]) LSC.sound[f](...a); } catch (e) { /* no sound is fine */ } };
  const ease2 = (a, b, k) => a + (b - a) * k;
  // a path through key poses [{p, x, y, ang, len}]
  function keyPose2(p, KF) {
    for (let i = 0; i < KF.length - 1; i++) if (p <= KF[i + 1].p) { const q = E.inOut(clamp((p - KF[i].p) / (KF[i + 1].p - KF[i].p), 0, 1)); return { x: lerp(KF[i].x, KF[i + 1].x, q), y: lerp(KF[i].y, KF[i + 1].y, q), ang: lerp(KF[i].ang, KF[i + 1].ang, q), len: lerp(KF[i].len, KF[i + 1].len, q) }; }
    const l = KF[KF.length - 1]; return { x: l.x, y: l.y, ang: l.ang, len: l.len };
  }
  function coach(ctx, str, y, cx) { // the instruction pill at the top of a Try-it
    cx = cx == null ? W / 2 : cx; ctx.save(); ctx.font = '700 54px Fredoka'; const w = ctx.measureText(str).width + 90; ctx.fillStyle = P.white; roundRect(ctx, cx - w / 2, y - 52, w, 104, 52); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
    text(ctx, str, cx, y + 3, { size: 54, weight: 700 });
  }
  function handle(ctx, str, x, y, t, arrowTo) { // "drag me" / "tap me" label with a bobbing arrow
    const b = Math.sin(t * 4) * 8; ctx.save(); ctx.font = '700 50px Fredoka'; const w = ctx.measureText(str).width + 60; ctx.fillStyle = P.sun; roundRect(ctx, x - w / 2, y - 40 + b, w, 80, 40); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
    text(ctx, str, x, y + 3 + b, { size: 50, weight: 700 });
    if (arrowTo) L.arrow(ctx, arrowTo[0], arrowTo[1], arrowTo[2], arrowTo[3], P.ink, 10);
  }
  function roundArrow(ctx, cx, cy, rx, ry, t) { // a curling arrow that goes round and round: "stir like this"
    const a0 = t * 2.6, a1 = a0 + 4.4, ex = Math.cos(a1) * rx, ey = Math.sin(a1) * ry, tx = -Math.sin(a1) * rx, ty = Math.cos(a1) * ry, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
    const head = () => { ctx.beginPath(); ctx.moveTo(ex + ux * 42, ey + uy * 42); ctx.lineTo(ex - uy * 31, ey + ux * 31); ctx.lineTo(ex + uy * 31, ey - ux * 31); ctx.closePath(); };
    ctx.save(); ctx.translate(cx, cy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = P.white; ctx.lineWidth = 27; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke(); head(); ctx.lineWidth = 15; ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a0, a1); ctx.stroke(); head(); ctx.fill();
    ctx.restore();
  }
  function tinyLens(ctx, t, cx, cy, r, f) { // the magnifier on the website: the small bits model
    const k = (r - 10) / 172; ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#EEF6FF'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    bitsField(LENS, ctx, t, Object.assign({ k, ox: cx, oy: cy, fx: 0, fy: 0, jig: 3 }, f || {})); ctx.restore(); L.magnifier(ctx, cx, cy, r, 1);
  }
  function meter(ctx, x, y, w, h, level, label) { // a thermometer-like bar
    ctx.save(); ctx.lineJoin = 'round'; ctx.fillStyle = P.white; roundRect(ctx, x - w / 2, y, w, h, w / 2); ctx.fill();
    const fh = (h - 20) * clamp(level, 0, 1); if (fh > 1) { ctx.save(); roundRect(ctx, x - w / 2 + 9, y + 10, w - 18, h - 20, w / 2 - 9); ctx.clip(); ctx.fillStyle = P.pink; ctx.fillRect(x - w / 2, y + h - 10 - fh, w, fh + 12); ctx.restore(); }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 7; roundRect(ctx, x - w / 2, y, w, h, w / 2); ctx.stroke(); ctx.restore();
    text(ctx, label, x, y - 38, { size: 54, weight: 700 });
  }

  // ---------------- Try it 1: Stir the sugar ----------------
  const TK = { gx: 760, gy: 900, gs: 2.2, jx: 165, jy: 900, js: 1.3, cx: 1230, cy: 830, lx: 1560, ly: 360, lr: 185, mx: 1560, my: 650, mw: 90, mh: 250 };
  const TKN = 20;
  const tkPourPose = () => ({ x: TK.gx + 235, y: TK.gy - 500 });
  const tkJarHit = (s, x, y) => Math.hypot(x - s.jx, y - (s.jy - 100 * TK.js)) < 150;
  const tkCurieHit = (x, y) => Math.hypot(x - TK.cx, y - TK.cy) < 160;
  function tkInGlass(x, y) { const lx = (x - TK.gx) / TK.gs, ly = (y - TK.gy) / TK.gs; return ly > -GL.h - 80 && ly < 14 && Math.abs(lx) < glassHW(clamp(ly, -GL.h, 0)) + 26; }
  function tkBowl(x, y) { const ly = clamp((y - TK.gy) / TK.gs, -168, -36), hw = glassHW(ly) - 36, lx = clamp((x - TK.gx) / TK.gs, -hw, hw); return { x: TK.gx + lx * TK.gs, y: TK.gy + ly * TK.gs }; }
  const tkPresent = s => s.c.reduce((a, b) => a + b, 0);
  const TK_TASTE = { plain: 'just water', none: 'not sweet yet', some: 'a bit sweet', sweet: 'SWEET!' };
  function tkInit(s) {
    s.c = []; s.f = []; s.fd = []; for (let i = 0; i < TKN; i++) { s.c.push(0); s.f.push(1); s.fd.push(0); }
    s.added = 0; s.diss = 0; s.base = 0; s.rel = 0; s.lensFall = 0; s.meter = 0;
    s.mode = ''; s.px = 0; s.py = 0; s.gox = 0; s.goy = 0; s.drag = 0;
    s.jx = TK.jx; s.jy = TK.jy; s.jr = 0; s.pourT = -1; s.pourFrom = { x: TK.jx, y: TK.jy }; s.pourMade = false;
    const b = tkBowl(TK.gx + 24, TK.gy - 70 * TK.gs); s.sx = b.x; s.sy = b.y; s.path = 0; s.stirAmt = 0; s.swirl = 0; s.tick = 0;
    s.sipT = -1; s.sipKind = ''; s.sipFrom = { x: b.x, y: b.y }; s.sipCued = false; s.full = 0; s.t = 0;
    s.moved = false; s.stirred = false; s.tapped = false; s.tasted = false; s.goneArmed = false; s.sweetReady = false; s.lit = false;
  }
  function tkAddSugar(s) {
    let made = 0; for (let i = 0; i < TKN && made < 5; i++) if (s.c[i] <= 0.001) { s.c[i] = 1; s.f[i] = 0; s.fd[i] = made * 0.1; made++; }
    if (made) {
      const first = s.added <= 0; // the lens starts over only for the very first sugar: later sugar joins what is already in the water
      s.added += made; s.goneArmed = true; s.sweetReady = false; s.lit = false; s.base = tkPresent(s);
      if (first) { s.lensFall = 0; s.rel = 0; }
      snd('noise', 0.45, 0.12, { lp: 3500 });
    } else s.full = 1.8;
  }
  function tkUpdate(s, dt, cue) {
    s.t += dt; const home = { x: TK.jx, y: TK.jy };
    // the jar: tips over the glass and pours, is carried, or glides home
    if (s.pourT >= 0) {
      s.pourT += dt; const pp = tkPourPose(), A = E.inOut(seg(s.pourT, 0, 0.5)), C = E.inOut(seg(s.pourT, 1.2, 1.7));
      if (s.pourT < 1.2) { s.jx = lerp(s.pourFrom.x, pp.x, A); s.jy = lerp(s.pourFrom.y, pp.y, A); s.jr = -1.9 * A; } else { s.jx = lerp(pp.x, home.x, C); s.jy = lerp(pp.y, home.y, C); s.jr = -1.9 * (1 - C); }
      if (!s.pourMade && s.pourT >= 0.55) { s.pourMade = true; tkAddSugar(s); }
      if (s.pourT >= 1.7) { s.pourT = -1; s.jx = home.x; s.jy = home.y; s.jr = 0; }
    } else if (s.mode === 'jar') { const over = tkInGlass(s.px, s.py) ? 1 : 0; s.jr += (-0.9 * over - s.jr) * (1 - Math.pow(0.001, dt)); }
    else { const k = 1 - Math.pow(0.0004, dt); s.jx += (home.x - s.jx) * k; s.jy += (home.y - s.jy) * k; s.jr += (0 - s.jr) * k; }
    // crystals fall in
    for (let i = 0; i < TKN; i++) if (s.c[i] > 0 && s.f[i] < 1) { if (s.fd[i] > 0) s.fd[i] -= dt; else s.f[i] = Math.min(1, s.f[i] + dt / 0.55); }
    // stirring: the more the spoon moves, the faster the sugar dissolves (and a very little by itself)
    const moved = s.path; s.path = 0; const spd = dt > 0 ? moved / dt : 0;
    s.stirAmt += (clamp(spd / 900, 0, 1) - s.stirAmt) * (1 - Math.pow(0.02, dt)); s.swirl += moved * 0.012;
    let d = moved * 0.0023 + 0.02 * dt;
    for (let i = TKN - 1; i >= 0 && d > 1e-9; i--) if (s.c[i] > 0 && s.f[i] >= 1) { const take = Math.min(s.c[i], d); s.c[i] -= take; d -= take; s.diss += take; if (s.c[i] < 0.03) { s.diss += s.c[i]; s.c[i] = 0; } }
    const present = tkPresent(s);
    if (s.goneArmed && s.added > 0 && present <= 0.001) { s.goneArmed = false; s.sweetReady = true; cue('gone'); snd('tone', 880, 0.18, { vol: 0.12 }); snd('tone', 1320, 0.3, { vol: 0.1 }); }
    // the lens shows how much of the sugar has spread out (it only ever spreads further); the meter how much sugar has dissolved: the sugar you can't see still makes it sweet
    const target = s.base > 0 ? clamp(1 - present / s.base, 0, 1) : 0; if (target > s.rel) s.rel += (target - s.rel) * (1 - Math.pow(0.05, dt));
    s.lensFall = s.added > 0 ? Math.min(1, s.lensFall + dt / 0.9) : 0; s.meter += (clamp(s.diss / 20, 0, 1) - s.meter) * (1 - Math.pow(0.1, dt));
    s.full = Math.max(0, s.full - dt);
    s.tick -= dt; if (s.mode === 'spoon' && s.stirAmt > 0.25 && s.tick <= 0) { s.tick = 0.32; snd('tone', 1900, 0.08, { vol: 0.05, type: 'triangle' }); }
    // tasting: the spoon carries a drop to Curie
    if (s.sipT >= 0) {
      s.sipT += dt; if (!s.sipCued && s.sipT >= 1.35) { s.sipCued = true; snd('tone', 660, 0.15, { vol: 0.1 }); if (s.sipKind === 'sweet' && s.sweetReady) { s.sweetReady = false; s.lit = true; cue('sweet'); } }
      if (s.sipT >= 2.8) s.sipT = -1;
    }
  }
  function tkPointer(s, type, x, y) {
    if (type === 'down') {
      if (s.mode) return; s.px = x; s.py = y;
      if (s.pourT < 0 && tkJarHit(s, x, y)) { s.mode = 'jar'; s.moved = true; s.gox = s.jx - x; s.goy = s.jy - y; s.drag = 0; return; }
      if (tkCurieHit(x, y)) { s.tapped = true; if (s.sipT < 0) { const present = tkPresent(s); s.sipT = 0; s.sipCued = false; s.sipKind = s.added <= 0 ? 'plain' : present <= 0.001 ? 'sweet' : s.diss < 0.75 ? 'none' : 'some'; /* how sweet follows how much has dissolved, like the meter */ s.sipFrom = { x: s.sx, y: s.sy }; s.tasted = true; } return; }
      if (tkInGlass(x, y)) { s.mode = 'spoon'; const b = tkBowl(x, y); s.sx = b.x; s.sy = b.y; }
    } else if (type === 'move') {
      if (s.mode === 'jar') { s.drag += Math.hypot(x - s.px, y - s.py); s.px = x; s.py = y; s.jx = clamp(x + s.gox, 90, W - 90); s.jy = clamp(y + s.goy, 330, H - 10); }
      else if (s.mode === 'spoon') { const b = tkBowl(x, y); s.path += Math.hypot(b.x - s.sx, b.y - s.sy); s.sx = b.x; s.sy = b.y; s.px = x; s.py = y; if (s.path > 2) s.stirred = true; }
    } else if (type === 'up') {
      if (s.mode === 'jar') { s.mode = ''; if (tkInGlass(s.px, s.py) || s.drag < 30) { s.pourT = 0; s.pourFrom = { x: s.jx, y: s.jy }; s.pourMade = false; } }
      else if (s.mode === 'spoon') s.mode = '';
    }
  }
  function tkDraw(ctx, s, t) {
    const G = TK, present = tkPresent(s), sip = s.sipT;
    const R = { x: G.gx + 72 * G.gs, y: G.gy - (GL.h - 2) * G.gs };
    const poseAt = (bx, by) => ({ x: bx, y: by, ang: Math.atan2(R.y - by, R.x - bx), len: Math.hypot(R.x - bx, R.y - by) + 60 * G.gs });
    // ---- the spoon ----
    let sp = poseAt(s.sx, s.sy), drop = 0;
    if (sip >= 0) {
      const mouth = { p: 1, x: G.cx - 62, y: G.cy + 46, ang: -0.5, len: 330 }, from = poseAt(s.sipFrom.x, s.sipFrom.y), back = poseAt(s.sx, s.sy);
      const KF = [{ p: 0, x: from.x, y: from.y, ang: from.ang, len: from.len }, { p: 0.3, x: G.gx + 20, y: G.gy - 600, ang: -1.2, len: 330 }, { p: 0.62, x: G.gx + 330, y: G.gy - 470, ang: -0.95, len: 330 }, mouth];
      if (sip < 1.9) sp = keyPose2(sip / 1.35, KF); else sp = mixPose(mouth, back, E.inOut(seg(sip, 1.9, 2.7)));
      drop = seg(sip / 1.35, 0.3, 0.4) * (1 - seg(sip, 1.3, 1.55));
    }
    // ---- Curie ----
    let mood = s.sweetReady && sip < 0 ? 'think' : 'happy', hop = 0;
    const unsweet = s.sipKind === 'plain' || s.sipKind === 'none';
    if (sip >= 1.35) { mood = sip < 1.7 ? 'wow' : unsweet ? 'think' : 'happy'; if (!unsweet) hop = Math.sin(Math.PI * seg(sip, 1.55, 2.0)) * 30; }
    const bulb = s.lit && (sip < 0 || sip >= 1.7) ? 1 : 0;
    kitchen(ctx, t, { counterY: G.gy, window: false });
    L.pip(ctx, { x: G.cx, y: G.cy - hop, s: 1.25, t, mood, armR: 0.6, armL: sip >= 0 && sip < 1.9 ? -0.9 : -0.45, lookX: -0.8, lookY: 0.1, bulb });
    counter(ctx, G.gy);
    // ---- the glass ----
    const stir = s.stirAmt;
    glass(ctx, G.gx, G.gy, G.gs, { t, color: WATER_C, level: 0.8, wave: 3 + 5 * stir, inner: (c, ly) => { swirl(c, s.swirl, clamp(stir * 1.6, 0, 1), ly); pile(c, TKN, i => s.f[i] >= 1 ? s.c[i] : 0, stir > 0.15 ? t : 0); } });
    // crystals still falling from the jar
    for (let i = 0; i < TKN; i++) { if (s.c[i] <= 0 || s.f[i] >= 1 || s.fd[i] > 0) continue; const f = s.f[i], q = PILE[i], mx = G.gx + 78 + (i % 3) * 14 - 14; crystal(ctx, lerp(mx, G.gx + q.x * G.gs, E.out(f)), lerp(G.gy - 580, G.gy + q.y * G.gs, E.in(f)), 11 * G.gs, f * 5 + i, 1); }
    spoon(ctx, sp.x, sp.y, sp.ang, sp.len, 1.7, { drop, dropColor: '#8FD0FF' });
    // ---- the jar ----
    ctx.save(); jar(ctx, s.jx, s.jy, G.js, s.jr, 'sugar'); ctx.restore();
    // ---- lens, meter ----
    const ringX = G.gx + 50, ringY = G.gy - 280, dx = G.lx - ringX, dy = G.ly - ringY, dl = Math.hypot(dx, dy), nx = -dy / dl, ny = dx / dl;
    ctx.save(); ctx.fillStyle = 'rgba(95,184,255,0.13)'; ctx.beginPath(); ctx.moveTo(ringX + nx * 46, ringY + ny * 46); ctx.lineTo(G.lx + nx * G.lr, G.ly + ny * G.lr); ctx.lineTo(G.lx - nx * G.lr, G.ly - ny * G.lr); ctx.lineTo(ringX - nx * 46, ringY - ny * 46); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(43,45,66,0.4)'; ctx.lineWidth = 5; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.arc(ringX, ringY, 46, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    tinyLens(ctx, t, G.lx, G.ly, G.lr, { fall: s.lensFall, rel: s.rel });
    if (s.added > 0) { ctx.save(); ctx.translate(1650, 96); ctx.scale(0.78, 0.78); legend(ctx, 0, 0, 1); ctx.restore(); }
    meter(ctx, G.mx, G.my, G.mw, G.mh, s.meter, 'sweet');
    // ---- words ----
    const coachText = s.added <= 0 ? 'Drag the sugar into the glass!' : present > 0.001 ? (s.stirred ? 'Keep stirring! Where does the sugar go?' : 'Now stir with the spoon!') : s.lit ? 'Sweet! The sugar is still there!' : 'Can you see the sugar? Tap Curie to taste!';
    coach(ctx, coachText, 80, 860);
    if (!s.moved) handle(ctx, 'drag me', G.jx, 520, t, [G.jx + 100, 560, G.jx + 330, 640]);
    if (s.added > 0 && !s.stirred && present > 0.001 && sip < 0 && s.pourT < 0) { roundArrow(ctx, s.sx, s.sy - 10, 140, 62, t); handle(ctx, 'stir me', s.sx - 70, s.sy - 200, t, null); } // "stir me": a round arrow on the spoon until the first stir
    if ((!s.tapped || s.sweetReady) && sip < 0) handle(ctx, 'tap me', G.cx, 560, t, s.sweetReady ? [G.cx, 610, G.cx, 660] : null);
    if (s.full > 0) L.sticker(ctx, 'enough sugar!', 960, 300, clamp(s.full * 2, 0, 1), { bg: P.sun, size: 70, rot: -0.03 });
    if (sip >= 1.35 && sip < 2.7) L.sticker(ctx, TK_TASTE[s.sipKind] || 'yum', 1160, 290, seg(sip, 1.35, 1.7), { bg: unsweet ? P.white : P.pink, size: s.sipKind === 'sweet' ? 84 : 66, rot: -0.05 });
  }
  const tryStir = {
    title: 'Stir the sugar',
    hint: 'Drag the sugar into the glass, then stir with the spoon (round and round). Where does it go? Tap Curie to taste!',
    init: tkInit, update: tkUpdate, draw: tkDraw, pointer: tkPointer,
    cues: { gone: 'The sugar disappeared... or did it?', sweet: 'Yum, sweet! The sugar is still there.' }
  };

  // ---------------- Try it 2: Does it dissolve? ----------------
  // four jars on a shelf (sugar, salt, sand, pebbles) and four glasses of water: drag a jar over a glass (or tap it) to pour; the glass is stirred; sugar and salt dissolve, sand and pebbles stay
  const TD = { what: ['sugar', 'salt', 'sand', 'pebbles'], gx: [340, 700, 1060, 1420], gy: 930, gs: 1.2, sy: 470, js: 0.9, cx: 1730, cy: 850 };
  const TD_N = { sugar: 9, salt: 12 }, TD_STIR = { sugar: 3.0, salt: 3.0, sand: 2.4, pebbles: 2.4 }, TD_END = { sugar: 3.4, salt: 3.4, sand: 4.0, pebbles: 3.2 };
  const tdDis = w => w === 'sugar' || w === 'salt';
  const tdHome = k => ({ x: TD.gx[k], y: TD.sy });
  const tdPourPose = i => ({ x: TD.gx[i] + 150, y: TD.gy - 245 });
  const PEBS = [{ x: -38, y: -17, rx: 27, ry: 17, rot: -0.2 }, { x: 4, y: -16, rx: 31, ry: 19, rot: 0.15 }, { x: 44, y: -15, rx: 22, ry: 15, rot: 0.45 }, { x: -12, y: -42, rx: 24, ry: 16, rot: -0.35 }];
  // the glass whose column the point (x, y) is in (below the shelf), or -1
  function tdGlassAt(x, y) { if (y < 520) return -1; let b = -1, bd = 1e9; for (let i = 0; i < 4; i++) { const d = Math.abs(x - TD.gx[i]); if (d < bd) { bd = d; b = i; } } return bd < 230 ? b : -1; }
  function tdGlassHit(x, y) { for (let i = 0; i < 4; i++) if (Math.abs(x - TD.gx[i]) < 150 && y > TD.gy - 340 && y < TD.gy + 30) return i; return -1; }
  function tdJarAt(s, x, y) { let b = -1, bd = 1e9; s.j.forEach((j, k) => { if (j.pourT >= 0) return; const d = Math.abs(x - j.x); if (d < 125 && y > j.y - 270 && y < j.y + 40 && d < bd) { bd = d; b = k; } }); return b; }
  function tdInit(s) {
    s.t = 0; s.moved = false; s.tapped = false; s.mode = ''; s.k = -1; s.px = 0; s.py = 0; s.gox = 0; s.goy = 0; s.drag = 0; s.last = ''; s.cheer = 0; s.tick = 0;
    s.res = {}; s.rt = {}; TD.what.forEach(w => { s.res[w] = ''; s.rt[w] = -9; });
    s.j = TD.what.map((w, k) => { const h = tdHome(k); return { x: h.x, y: h.y, r: 0, pourT: -1, to: 0, fx: h.x, fy: h.y, made: false }; });
    s.g = TD.what.map(() => ({ what: '', age: 0, cued: false, res: '', re: 0, sa: 0, sp: 0, phi: 0, settle: 0, land: 0, rt: -9 }));
  }
  function tdStart(s, i, w) { const g = s.g[i]; g.what = w; g.age = 0; g.cued = false; g.res = ''; g.re = 0; g.sa = 0; g.sp = 0; g.settle = 0; g.phi = 0; g.land = 0; g.rt = -9; snd('noise', 0.3, 0.1, { lp: 3000 }); }
  function tdUpdate(s, dt, cue) {
    s.t += dt; s.cheer = Math.max(0, s.cheer - dt); let anyStir = false;
    s.j.forEach((j, k) => {
      const home = tdHome(k);
      if (j.pourT >= 0) {
        j.pourT += dt; const pp = tdPourPose(j.to), A = E.inOut(seg(j.pourT, 0, 0.45)), C = E.inOut(seg(j.pourT, 1.15, 1.6));
        if (j.pourT < 1.15) { j.x = lerp(j.fx, pp.x, A); j.y = lerp(j.fy, pp.y, A); j.r = -1.9 * A; } else { j.x = lerp(pp.x, home.x, C); j.y = lerp(pp.y, home.y, C); j.r = -1.9 * (1 - C); }
        if (!j.made && j.pourT >= 0.5) { j.made = true; tdStart(s, j.to, TD.what[k]); }
        if (j.pourT >= 1.6) { j.pourT = -1; j.x = home.x; j.y = home.y; j.r = 0; }
      } else if (s.mode === 'jar' && s.k === k) {
        const over = tdGlassAt(j.x, j.y - 90) >= 0 || tdGlassAt(s.px, s.py) >= 0 ? 1 : 0; j.r += (-0.8 * over - j.r) * (1 - Math.pow(0.001, dt));
      } else { const q = 1 - Math.pow(0.0004, dt); j.x += (home.x - j.x) * q; j.y += (home.y - j.y) * q; j.r += (0 - j.r) * q; }
    });
    s.g.forEach(g => {
      if (!g.what) return; const w = g.what; g.age += dt; if (g.re > 0) g.re = Math.max(0, g.re - dt);
      const stirring = (g.age > 0.9 && g.age < TD_STIR[w]) || g.re > 0; if (stirring) anyStir = true;
      g.sa += ((stirring ? 1 : 0) - g.sa) * (1 - Math.pow(0.002, dt)); g.sp += ((stirring ? 1 : 0) - g.sp) * (1 - Math.pow(0.003, dt)); g.phi += dt * 9 * g.sa;
      if (w === 'sand') { if (stirring) g.settle = Math.max(0, g.settle - dt * 3); else if (g.age > 0.9) g.settle = Math.min(1, g.settle + dt / 1.4); }
      if (w === 'pebbles') { const n = PEBS.filter((p, k) => g.age >= k * 0.12 + 0.5).length; if (n > g.land) { g.land = n; snd('tone', 170, 0.2, { vol: 0.16, glide: 80 }); } }
      if (!g.cued && g.age >= TD_END[w] && (w !== 'sand' || g.settle >= 0.999)) {
        g.cued = true; g.res = tdDis(w) ? 'yes' : 'no'; g.rt = s.t; s.res[w] = g.res; s.rt[w] = s.t; s.last = w; s.cheer = 1.4;
        if (g.res === 'yes') { snd('tone', 880, 0.18, { vol: 0.12 }); snd('tone', 1320, 0.3, { vol: 0.1 }); } else snd('tone', 200, 0.3, { vol: 0.14, type: 'triangle' });
        cue(g.res === 'yes' ? 'dissolves' : 'stays');
      }
    });
    s.tick -= dt; if (anyStir && s.tick <= 0) { s.tick = 0.33; snd('tone', 1900, 0.08, { vol: 0.04, type: 'triangle' }); }
  }
  // a glass is taken when it holds something, or when a jar that is still pouring is about to fill it (the glass only gets its contents half a second into the pour)
  const tdTargeted = (s, i) => s.j.some(j => j.pourT >= 0 && j.to === i);
  const tdTaken = (s, i) => !!s.g[i].what || tdTargeted(s, i);
  // the free glass nearest to glass `near` (the first free one when near < 0), or -1 when every glass is taken
  function tdFree(s, near) { let best = -1, bd = 1e9; for (let i = 0; i < 4; i++) { if (tdTaken(s, i)) continue; const d = near < 0 ? i : Math.abs(i - near); if (d < bd) { bd = d; best = i; } } return best; }
  function tdPointer(s, type, x, y) {
    if (type === 'down') {
      if (s.mode) return; s.px = x; s.py = y;
      const k = tdJarAt(s, x, y);
      if (k >= 0) { const j = s.j[k]; s.mode = 'jar'; s.k = k; s.moved = true; s.gox = j.x - x; s.goy = j.y - y; s.drag = 0; return; }
      const i = tdGlassHit(x, y); if (i >= 0) { s.tapped = true; const g = s.g[i]; if (g.what && g.cued && g.re <= 0) g.re = 1.6; }
    } else if (type === 'move') {
      if (s.mode === 'jar') { const j = s.j[s.k]; s.drag += Math.hypot(x - s.px, y - s.py); s.px = x; s.py = y; j.x = clamp(x + s.gox, 90, W - 90); j.y = clamp(y + s.goy, 300, H - 20); }
    } else if (type === 'up') {
      if (s.mode === 'jar') {
        const k = s.k, j = s.j[k]; s.mode = ''; s.k = -1;
        let to = tdGlassAt(j.x, j.y - 90); if (to < 0) to = tdGlassAt(s.px, s.py);
        const tap = to < 0 && s.drag < 30;
        // a tap on a jar, or a drop on a glass that is already in use, pours into a free glass (the nearest one to where it was dropped); with none free it fills the chosen glass again
        if (tap || (to >= 0 && tdTaken(s, to))) { const f = tdFree(s, tap ? -1 : to); to = f >= 0 ? f : tap ? k : to; }
        if (to >= 0 && tdTargeted(s, to)) to = -1; // that glass is just being filled by another jar: leave it alone
        if (to >= 0) { j.pourT = 0; j.to = to; j.fx = j.x; j.fy = j.y; j.made = false; }
      }
    }
  }
  function tdDots(ctx, t, a, x0, y0, rad, col) { // the tiny bits spread out through the water
    if (a <= 0) return;
    for (const d of DOTS) { const e = E.out(seg(a, d.k * 0.5, d.k * 0.5 + 0.5)); circle(ctx, lerp(x0, d.x, e) + Math.sin(t * 2.2 * d.s + d.ph) * 3, lerp(y0, d.y, e) + Math.cos(t * 2.0 * d.s + d.ph) * 3, rad, col, P.ink, 2); }
  }
  function tdStirPose(gx, gy, gs, phi) { // the bowl circles near the bottom, the handle leans on the right rim and sticks out a little
    const R = { x: gx + 72 * gs, y: gy - (GL.h - 2) * gs }, B = { x: gx + Math.cos(phi) * 42 * gs, y: gy - 66 * gs + Math.sin(phi) * 8.4 * gs };
    return { x: B.x, y: B.y, ang: Math.atan2(R.y - B.y, R.x - B.x), len: Math.hypot(R.x - B.x, R.y - B.y) + 40 * gs };
  }
  function tdGlass(ctx, s, i, t) {
    const G = TD, g = s.g[i], gx = G.gx[i], gy = G.gy, gs = G.gs, w = g.what, age = g.age, crys = tdDis(w), N = TD_N[w] || 0, sz = w === 'salt' ? 0.72 : 1;
    const fi = k => seg(age, k * 0.05, k * 0.05 + 0.5), dis = crys ? seg(age, 1.1, 3.1, E.inOut) : 0, fell = w === 'sand' ? seg(age, 0, 0.9) : 0;
    const murk = w === 'sand' ? seg(fell, 0.3, 1) * (1 - g.settle) : 0, bits = crys ? seg(age, 2.0, 3.4) : 0;
    glass(ctx, gx, gy, gs, { t, color: WATER_C, level: 0.78, wave: 3 + 4 * g.sa,
      inner: (c, ly) => {
        if (murk > 0) { c.fillStyle = 'rgba(205,160,95,' + (0.34 * murk) + ')'; c.fillRect(-100, ly - 5, 200, -ly + 10); }
        swirl(c, g.phi * 1.4, g.sa, ly);
        if (crys) { pile(c, N, k => fi(k) >= 1 ? sz * erode(k, N, dis) : 0, g.sa > 0.2 && dis < 1 ? t : 0); tdDots(c, t, bits, 0, -30, 4.6, w === 'salt' ? '#DCE6F7' : SUGAR_BIT); }
        if (w === 'pebbles') for (let k = 0; k < PEBS.length; k++) { if (seg(age, k * 0.12, k * 0.12 + 0.5) < 1) continue; const p = PEBS[k]; ellipse(c, p.x, p.y, p.rx, p.ry, PEBBLE_C, P.ink, 3, p.rot + Math.sin(t * 9 + k) * 0.06 * g.sa); }
      },
      outer: c => {
        if (crys && age < 1.2) for (let k = 0; k < N; k++) { const f = fi(k); if (f <= 0 || f >= 1) continue; const q = PILE[k], x0 = 33 + (k % 3) * 9 - 9; crystal(c, lerp(x0, q.x, E.out(f)), lerp(-270, q.y, E.in(f)), 11 * sz, f * 5 + k, 1); }
        if (w === 'pebbles') for (let k = 0; k < PEBS.length; k++) { const f = seg(age, k * 0.12, k * 0.12 + 0.5); if (f <= 0 || f >= 1) continue; const p = PEBS[k]; ellipse(c, lerp(33, p.x, E.out(f)), lerp(-270, p.y, E.in(f)), p.rx, p.ry, PEBBLE_C, P.ink, 3, p.rot + f * 3); }
        if (w === 'sand') sandInGlass(c, fell, g.settle, g.phi, 33);
      } });
    if (g.sp > 0.03) { // the spoon dips in and stirs
      const hover = { x: gx + 30, y: gy - GL.h * gs - 30, ang: -0.45, len: 260 }, sPose = tdStirPose(gx, gy, gs, g.phi), pose = mixPose(hover, sPose, E.inOut(clamp(g.sp, 0, 1)));
      ctx.save(); ctx.globalAlpha *= clamp(g.sp * 4, 0, 1); spoon(ctx, pose.x, pose.y, pose.ang, pose.len, 1.0, {}); ctx.restore();
    }
  }
  function namePill(ctx, str, x, y, p) {
    if (p <= 0) return; const sc = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.font = '700 46px Fredoka'; const w = ctx.measureText(str).width + 64;
    ctx.fillStyle = P.white; roundRect(ctx, -w / 2, -37, w, 74, 37); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.stroke(); text(ctx, str, 0, 3, { size: 46, weight: 700 }); ctx.restore();
  }
  const TD_SAY = { sugar: 'Sugar dissolves!', salt: 'Salt dissolves!', sand: 'Sand sinks and stays!', pebbles: 'Pebbles sink and stay!' };
  function tdDraw(ctx, s, t) {
    const G = TD, tested = G.what.filter(w => s.res[w]).length, busy = s.g.some(g => g.what && !g.cued);
    kitchen(ctx, t, { counterY: G.gy, window: false });
    // the shelf with the four jars on it
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    for (const bx of [250, 1500]) { ctx.fillStyle = '#B98B4E'; ctx.beginPath(); ctx.moveTo(bx - 40, G.sy + 28); ctx.lineTo(bx + 40, G.sy + 28); ctx.lineTo(bx, G.sy + 92); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#D9B277'; roundRect(ctx, 200, G.sy, 1340, 30, 10); ctx.fill(); ctx.stroke(); ctx.restore();
    const carried = (j, k) => j.pourT >= 0 || (s.mode === 'jar' && s.k === k);
    s.j.forEach((j, k) => { if (!carried(j, k)) jar(ctx, j.x, j.y, G.js, j.r, G.what[k]); });
    // Curie (the sparkles when every jar has been tested go behind her)
    if (tested >= 4) L.sparkles(ctx, G.cx - 10, 720, t, 4, 7, 170);
    const hop = Math.sin(Math.PI * clamp(1 - s.cheer / 1.0, 0, 1)) * (s.cheer > 0 && s.last ? 26 : 0), kindYes = tdDis(s.last);
    const mood = s.cheer > 0.2 ? (kindYes ? 'wow' : 'think') : tested >= 4 ? 'happy' : 'happy';
    L.pip(ctx, { x: G.cx, y: G.cy - hop, s: 1.0, t, mood, armR: tested >= 4 ? -1.0 + Math.sin(t * 8) * 0.25 : 0.6, armL: -0.45, lookX: -0.8, lookY: 0.1, bulb: tested >= 4 ? 1 : 0 });
    counter(ctx, G.gy);
    for (let i = 0; i < 4; i++) { tdGlass(ctx, s, i, t); const g = s.g[i]; if (g.what) { namePill(ctx, g.what, G.gx[i], 1005, seg(g.age, 0.3, 0.6)); if (g.res === 'yes') tick(ctx, G.gx[i], 556, 44, seg(s.t - g.rt, 0, 0.4)); else if (g.res === 'no') cross(ctx, G.gx[i], 556, 44, seg(s.t - g.rt, 0, 0.4)); } }
    // results on the jars: a tick for the ones that dissolve, a cross for the ones that stay
    TD.what.forEach((w, k) => { const j = s.j[k]; if (!s.res[w] || carried(j, k)) return; const p = seg(s.t - s.rt[w], 0, 0.4); (s.res[w] === 'yes' ? tick : cross)(ctx, j.x + 66, j.y - 178, 30, p); });
    // jars on the move (being carried or pouring) are drawn on top
    s.j.forEach((j, k) => { if (carried(j, k)) jar(ctx, j.x, j.y, G.js, j.r, G.what[k]); });
    // words
    const coachText = tested >= 4 && !busy ? 'Sugar and salt dissolve. Sand and pebbles stay!' : busy ? 'Stir, stir... does it dissolve?' : s.last ? TD_SAY[s.last] + ' Try another jar!' : 'Drag a jar into a glass!';
    coach(ctx, coachText, 80, 960);
    if (!s.moved) handle(ctx, 'drag me', G.gx[0], 215, t, [G.gx[0] + 70, 530, G.gx[0] + 70, 600]);
  }
  const tryDissolve = {
    title: 'Does it dissolve?',
    hint: 'Drag each jar into a glass. Which ones dissolve? Which ones sink and stay?',
    init: tdInit, update: tdUpdate, draw: tdDraw, pointer: tdPointer,
    cues: { dissolves: 'It dissolves! The tiny bits spread out in the water.', stays: 'It doesn\'t dissolve. It sinks to the bottom and stays there.' }
  };

//@@TRY2@@

//@@MORE@@
  L.episodes.ep10 = {
    id: 'ep10', num: 10, title: 'Where does the sugar go?', short: 'Dissolving', phrase: 'It\'s still there!',
    // YouTube thumbnail (render/art.js): big word, small text above/below, and the background drawn behind Curie (Curie stands at x 560, y 760 unless pip is set)
    thumb: { big: 'SUGAR', small1: 'Where does the', small2: 'go?', bg: (ctx, t) => {
      kitchen(ctx, t, { counterY: 860, window: false }); counter(ctx, 860);
      jar(ctx, 990, 860, 1.5, 0, 'sugar');
      glass(ctx, 1340, 860, 2.6, { t, color: WATER_C, level: 0.72, wave: 4 });
      sugarCube(ctx, 1340, 206, 1.3, 0.2);
      L.questionMark(ctx, 1745, 380, 1.7, t); L.sparkles(ctx, 1340, 300, t, 5, 7, 230);
    } },
    // text = the caption on screen (and the site); say = what Curie speaks, with direction tags (docs/PIPELINE.md, "Narration markup")
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: where does the sugar go?", say: "Today's big question... Where does the sugar go?", hold: 0.6 },
      { id: 'stir', text: 'Curie is making lemonade! In goes a spoon of sugar. Stir, stir, stir!', say: '{sfx:pop}Curie is making *lemonade*! In goes a spoon of sugar. {sfx:swish}Stir... stir... stir!', hold: 0.5 },
      { id: 'gone', text: 'Look! The sugar is gone! Where did it go?', say: '{sfx:pop}Look! The sugar is *gone*! Where did it *go*?', hold: 1.0 },
      { id: 'taste', text: "Curie tastes a drop. Yum! It's sweet! So the sugar must still be there.", say: "Curie tastes a *drop*... {sfx:pop}Yum! It's *sweet*! {sfx:ding}So the sugar must *still* be there.", hold: 0.8 },
      { id: 'closer', text: "But why can't we see it? Let's look closer. Much, much closer.", say: "But *why* can't we see it? Let's look closer. {sfx:zoom}Much... *much* closer.", hold: 0.8 },
      { id: 'bits', text: 'A grain of sugar is made of tiny, tiny bits. Just like ice cream, remember?', say: '{sfx:bubble}A *grain* of sugar is made of *tiny*, tiny bits. Just like *ice cream*, remember?', hold: 0.5 },
      { id: 'spread', text: 'The water bits pull the sugar bits apart. Then the sugar bits spread out between the water bits.', say: 'The *water* bits pull the *sugar* bits apart. {sfx:whoosh}Then the sugar bits spread *out*... between the water bits.', hold: 0.6 },
      { id: 'dissolve', text: 'Now they are too tiny to see. We say the sugar dissolves!', say: 'Now they are too tiny to see. We say... {sfx:sparkle}the sugar *dissolves*!', hold: 1.2 },
      { id: 'notmelt', text: 'Dissolving is not melting! Melting needs heat, like the sun. Dissolving is tiny bits spreading out, in water.', say: 'Dissolving is *not* melting! Melting needs *heat*, like the sun. {sfx:bubble}Dissolving is tiny bits spreading *out*, in water.', hold: 1.0 },
      { id: 'test', text: "Scientists test it! Does everything dissolve? Let's try sand.", say: "{sfx:bubble}Scientists *test* it! Does *everything* dissolve? Let's try *sand*.", hold: 0.5 },
      { id: 'sand', text: "Stir, stir... The sand sinks to the bottom, and stays there. Sand doesn't dissolve!", say: "{sfx:swish}Stir... stir... {sfx:plop}The sand *sinks* to the bottom, and *stays* there. Sand doesn't *dissolve*!", hold: 1.0 },
      { id: 'salt', text: 'Salt dissolves too. And if the salty water dries up in the sun... the salt comes back! It was there all along.', say: 'Salt dissolves *too*. And if the salty water dries up in the sun... {sfx:sparkle}the *salt* comes back! It was there all *along*.', hold: 1.0 },
      { id: 'sayit', text: "So where did the sugar go? Say it with me: it's still there!", say: "So where did the sugar go? Say it with me... {sfx:ding}It's *still* there! {pause 0.9} {slow}It's still... there!{/slow}", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for two glasses of water, a spoon of sugar, and a spoon of sand.", say: "{sfx:tada}Let's try it at home! Ask a grown-up for *two* glasses of water, a spoon of sugar... and a spoon of *sand*.", hold: 0.4 },
      { id: 'try2', text: 'Stir the sugar into one glass, and the sand into the other. Which one disappears?', say: 'Stir the *sugar* into one glass... and the *sand* into the other. {sfx:ding}Which one *disappears*?', hold: 0.8 },
      { id: 'try3', text: 'Taste only the sugar water, and only if your grown-up says yes. Is the sugar still there?', say: 'Taste *only* the sugar water, and only if your grown-up says *yes*. {sfx:ding}Is the sugar *still* there?', hold: 1.6 },
      { id: 'bye', text: "Great job, little scientist! Remember: when sugar dissolves, it's still there. See you next time at the Little Scientists Club! Bye-bye!", say: "{sfx:tada}Great job, little scientist! Remember... when sugar *dissolves*, it's *still* there. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}", hold: 1.2 }
    ],
    // extra sound effects not written into `say` as {sfx:name}: anchored to a line (+offset s) or to a chunk ('chunk': words)
    sfx: [
      { line: 'stir', chunk: 'stir... stir', offset: 0.4, name: 'clink', vol: 0.5 },
      { line: 'gone', chunk: 'the sugar is gone', offset: 0.15, name: 'sparkle', vol: 0.4 },
      { line: 'taste', chunk: 'curie tastes', offset: 0.45, name: 'clink', vol: 0.35 },
      { line: 'test', chunk: "let's try sand", offset: 0.8, name: 'scrape', vol: 0.3 },
      { line: 'salt', chunk: 'salt dissolves too', offset: 0.85, name: 'scrape', vol: 0.25 },
      { line: 'try2', chunk: 'stir the sugar', offset: 0.35, name: 'scrape', vol: 0.2 },
      { line: 'try2', chunk: 'stir the sugar', offset: 1.0, name: 'swish', vol: 0.3 },
      { line: 'try2', chunk: 'and the sand into the other', offset: 0.25, name: 'scrape', vol: 0.25 },
      { line: 'try2', chunk: 'and the sand into the other', offset: 1.0, name: 'swish', vol: 0.3 }
    ],
    // scenes: each starts when its `from` line starts (minus optional lead) and lasts until the next scene; transition 'cut' = no wipe
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { sugarCube(c, -190, 150 - 10 * Math.abs(Math.sin(tt * 2.6)), 0.95); L.arrow(c, -100, 90, 10, 90, P.ink, 10); glass(c, 120, 170, 1.0, { t: tt, level: 0.7 }); }, { word: 'Where?' }) },
      { from: 'stir', draw: (ctx, t, Lt) => kitchenStory(ctx, t, Lt) },
      { from: 'closer', transition: 'cut', draw: (ctx, t, Lt) => closerScene(ctx, t, Lt) },
      { from: 'bits', draw: (ctx, t, Lt) => bitsScene(ctx, t, Lt) },
      { from: 'dissolve', transition: 'cut', draw: (ctx, t, Lt) => dissolveScene(ctx, t, Lt) },
      { from: 'notmelt', draw: (ctx, t, Lt) => notmeltScene(ctx, t, Lt) },
      { from: 'test', draw: (ctx, t, Lt) => sandShot(ctx, t, Lt) },
      { from: 'salt', draw: (ctx, t, Lt) => saltScene(ctx, t, Lt) },
      { from: 'sayit', draw: (ctx, t, Lt) => sayitScene(ctx, t, Lt) },
      { from: 'try1', draw: (ctx, t, Lt) => tryScene(ctx, t, Lt) },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'It\'s still there!') }
    ],
    // ---- Try it on the website: TWO activities ("Stir the sugar", "Does it dissolve?"); coordinates are 1920 x 1080 canvas units ----
    interactives: [tryStir, tryDissolve]
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Episode 11 — Why do rolling things stop? (friction: rubbing slows moving things; smooth floors rub less; friction is useful)
   Story: Curie's toy car rolls across the room and stops -> zoom on the wheel (it rubs on the floor, pulling back) -> the word
   "friction" -> fair test: same ramp, same car, three floors (carpet / wood / ice) -> useful friction (shoes grip, bike brakes)
   -> say it -> try at home (book ramp, toy car, towel). Try it 1 "Ramp race", Try it 2 "Push the box". */
(function (global) {
  const L = global.LSC; const LSC = L; const { W, H, P, E, seg, clamp, lerp, circle, ellipse, text, roundRect } = L;
  L.episodes = L.episodes || {};

  // ---------- colours of the floors (the same everywhere: video, close-up, Try it) ----------
  const WOOD = '#D9A066', WOOD_D = '#B97F3F', CARPET = '#F0709A', CARPET_D = '#D24E7C', ICE = '#C9EDFF', ICE_D = '#8FD3FF';
  const GRASS = '#6BCB77', GRASS_D = '#4FAF5E', SAND = '#F0D58C', SAND_D = '#D9B968', BOOK = '#E8504A', TOWEL = '#4DBFB8';

  // ---------- motion helpers (pure functions of time) ----------
  // distance covered by something that speeds up from rest over ta s (from t0), cruises at v until td, then slows steadily (constant slowing) to a stop over tdec s
  function moveDist(t, t0, ta, v, td, tdec) {
    if (t <= t0) return 0;
    const a = Math.min(t, t0 + ta) - t0; let d = 0.5 * v * a * a / ta;
    if (t > t0 + ta) d += v * (Math.min(t, td) - (t0 + ta));
    if (t > td) { const k = Math.min(tdec, t - td); d += v * k - 0.5 * v * k * k / tdec; }
    return d;
  }
  function moveSpeed(t, t0, ta, v, td, tdec) {
    if (t <= t0) return 0; if (t < t0 + ta) return v * (t - t0) / ta; if (t <= td) return v;
    const k = t - td; return k >= tdec ? 0 : v * (1 - k / tdec);
  }
  
  // ---------- props ----------
  // the toy car: bottom-centre at (x, y); s = scale; o: {rot (slope), spin (wheel angle), omega (wheel rad/s, hides the marks when very fast), tread}
  function wheel(ctx, x, y, r, spin, omega, tread, lw) {
    ctx.save(); ctx.translate(x, y);
    if (tread) { ctx.fillStyle = P.ink; ctx.save(); ctx.rotate(spin); for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI * 2 / 24); ctx.beginPath(); ctx.moveTo(-r * 0.1, -r + 2); ctx.lineTo(-r * 0.065, -r * 1.13); ctx.lineTo(r * 0.065, -r * 1.13); ctx.lineTo(r * 0.1, -r + 2); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    circle(ctx, 0, 0, r, P.ink);
    circle(ctx, 0, 0, r * 0.6, P.grey, P.ink, lw * 0.8);
    const a = omega == null ? 1 : clamp((46 - omega) / 16, 0, 1);
    ctx.save(); ctx.rotate(spin); ctx.globalAlpha = a; ctx.fillStyle = P.white; roundRect(ctx, -r * 0.1, -r * 0.56, r * 0.2, r * 0.36, r * 0.08); ctx.fill(); ctx.restore();
    if (a < 1) { ctx.save(); ctx.globalAlpha = 0.4 * (1 - a); ctx.strokeStyle = P.white; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    circle(ctx, 0, 0, r * 0.13, P.ink);
    ctx.restore();
  }
  function car(ctx, x, y, s, o) {
    o = o || {}; if (s <= 0) return; const lw = clamp(6 * Math.sqrt(s), 4, 11) / s;
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw;
    ctx.fillStyle = P.blue; ctx.beginPath(); ctx.moveTo(-52, -56); ctx.quadraticCurveTo(-46, -94, -20, -96); ctx.lineTo(26, -96); ctx.quadraticCurveTo(50, -94, 58, -56); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E6F4FF'; roundRect(ctx, -36, -86, 30, 26, 7); ctx.fill(); ctx.stroke(); roundRect(ctx, 4, -86, 40, 26, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.blueDeep; roundRect(ctx, -86, -62, 172, 42, 16); ctx.fill(); ctx.stroke();
    L.star(ctx, 0, -41, 13, P.sun, 0);
    circle(ctx, 80, -44, 7, P.sun, P.ink, lw * 0.7); circle(ctx, -80, -44, 6, P.red, P.ink, lw * 0.7);
    for (const wx of [-50, 50]) wheel(ctx, wx, -27, 27, o.spin || 0, o.omega, o.tread, lw);
    ctx.restore();
  }
  // faint lines trailing behind a moving car (a = 0..1 speed); they shrink and vanish as the car slows
  function speedLines(ctx, x, y, a, s) {
    if (a <= 0.04) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1) * 0.6; ctx.strokeStyle = P.greyDark; ctx.lineCap = 'round'; ctx.lineWidth = 9 * Math.max(0.6, s);
    [[-20, 1], [-52, 0.7], [-84, 0.9]].forEach(([dy, k]) => { const x0 = x - 100 * s, x1 = x0 - (40 + 190 * a) * k * s; ctx.beginPath(); ctx.moveTo(x0, y + dy * s); ctx.lineTo(x1, y + dy * s); ctx.stroke(); });
    ctx.restore();
  }
  // red arrows pointing left (rubbing pulls back): n arrows stacked, each len long; (x, y) = the right end of the lowest arrow
  function rubArrows(ctx, x, y, n, len, lw, alpha, dir) {
    if (n < 1 || alpha <= 0.02) return; ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); const gap = lw * 2.7 + 6;
    for (let i = 0; i < n; i++) { const yy = y - i * gap; if (dir < 0) L.arrow(ctx, x, yy, x + len, yy, P.red, lw); else L.arrow(ctx, x, yy, x - len, yy, P.red, lw); }
    ctx.restore();
  }
  function flag(ctx, x, y, color, p, t, s) {
    if (p <= 0) return; s = s || 1; const k = E.outBack(clamp(p, 0, 1)) * s; ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const w = Math.sin(t * 5) * 4;
    ctx.fillStyle = color; ctx.strokeStyle = P.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(3, -100); ctx.quadraticCurveTo(32, -106 + w, 66, -86 + w * 0.5); ctx.quadraticCurveTo(34, -72 + w, 3, -66); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -104); ctx.stroke(); circle(ctx, 0, -106, 6, P.ink);
    ctx.restore();
  }
  // a strip of floor: kind = ice | wood | carpet | grass | sand | plain; top edge at y, thickness h
  function floorStrip(ctx, kind, x0, x1, y, h, t, o) {
    o = o || {}; const lw = o.lw || 6; const r = L.rng(11); ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = lw;
    if (kind === 'carpet') {
      ctx.fillStyle = CARPET; ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x0, y);
      for (let x = x0; x < x1; x += 22) ctx.quadraticCurveTo(Math.min(x + 11, x1), y - 15, Math.min(x + 22, x1), y);
      ctx.lineTo(x1, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();
      const n = Math.floor((x1 - x0) * h / 520); for (let i = 0; i < n; i++) circle(ctx, x0 + 12 + r() * (x1 - x0 - 24), y + 10 + r() * (h - 20), 3.5 + r() * 3, CARPET_D);
    } else if (kind === 'wood') {
      ctx.fillStyle = WOOD; ctx.fillRect(x0, y, x1 - x0, h); ctx.strokeRect(x0, y, x1 - x0, h);
      ctx.strokeStyle = WOOD_D; ctx.lineWidth = Math.max(3, lw * 0.6); const rows = Math.max(1, Math.round(h / 40));
      for (let i = 1; i < rows; i++) { const yy = y + i * h / rows; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
      for (let i = 0; i < rows; i++) { const y0 = y + i * h / rows, y1 = y0 + h / rows; for (let x = x0 + 90 + ((i * 97) % 230); x < x1; x += 270) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); } }
      ctx.strokeStyle = 'rgba(120,70,20,0.3)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; const n = Math.floor((x1 - x0) / 60);
      for (let i = 0; i < n; i++) { const gx = x0 + 20 + r() * (x1 - x0 - 60), gy = y + 8 + r() * (h - 16); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 26 + r() * 20, gy); ctx.stroke(); }
    } else if (kind === 'ice') {
      ctx.fillStyle = ICE; ctx.fillRect(x0, y, x1 - x0, h); ctx.strokeRect(x0, y, x1 - x0, h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x0 + 6, y + 5, x1 - x0 - 12, Math.min(8, h * 0.18));
      ctx.lineCap = 'round'; const n = Math.floor((x1 - x0) / 150);
      for (let i = 0; i < n; i++) { const gx = x0 + 40 + r() * (x1 - x0 - 120), gy = y + h * (0.35 + 0.45 * r()), ph = r() * 6.28, a = 0.45 + 0.4 * Math.sin(t * 1.6 + ph); ctx.strokeStyle = `rgba(255,255,255,${clamp(a, 0.2, 0.95)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx, gy + 12); ctx.lineTo(gx + 26, gy - 12); ctx.stroke(); ctx.beginPath(); ctx.moveTo(gx + 34, gy + 12); ctx.lineTo(gx + 46, gy - 4); ctx.stroke(); }
    } else if (kind === 'grass') {
      ctx.fillStyle = GRASS; ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x0, y);
      for (let x = x0; x < x1; x += 20) { ctx.lineTo(Math.min(x + 6, x1), y - 12 - 8 * ((x / 20) % 3)); ctx.lineTo(Math.min(x + 20, x1), y); }
      ctx.lineTo(x1, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = GRASS_D; ctx.lineWidth = 4; ctx.lineCap = 'round'; const n = Math.floor((x1 - x0) / 40);
      for (let i = 0; i < n; i++) { const gx = x0 + 14 + r() * (x1 - x0 - 28), gy = y + 16 + r() * (h - 24); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 5, gy - 16); ctx.moveTo(gx + 8, gy); ctx.lineTo(gx + 12, gy - 14); ctx.stroke(); }
    } else if (kind === 'sand') {
      ctx.fillStyle = SAND; ctx.beginPath(); ctx.moveTo(x0, y + h); ctx.lineTo(x0, y);
      for (let x = x0; x < x1; x += 60) ctx.quadraticCurveTo(Math.min(x + 30, x1), y - 10, Math.min(x + 60, x1), y);
      ctx.lineTo(x1, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();
      const n = Math.floor((x1 - x0) * h / 260); for (let i = 0; i < n; i++) circle(ctx, x0 + 10 + r() * (x1 - x0 - 20), y + 8 + r() * (h - 14), 2.5 + r() * 3, SAND_D);
    } else { ctx.fillStyle = '#E3E8F0'; ctx.fillRect(x0, y, x1 - x0, h); ctx.strokeRect(x0, y, x1 - x0, h); }
    ctx.restore();
  }
  function labBg(ctx, color) {
    ctx.fillStyle = color || '#EAF4FF'; ctx.fillRect(-W, -H, 3 * W, 3 * H);
    ctx.strokeStyle = 'rgba(78,168,255,0.16)'; ctx.lineWidth = 3;
    for (let x = -W; x <= 2 * W; x += 120) { ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, 2 * H); ctx.stroke(); }
    for (let y = -H; y <= 2 * H; y += 120) { ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(2 * W, y); ctx.stroke(); }
  }
  // a room: cream wall with a window, white skirting, wooden floor. The floor surface (where wheels touch) is at FLOOR_Y.
  const FLOOR_Y = 790;
  function room(ctx, t) {
    ctx.fillStyle = '#FFF0D4'; ctx.fillRect(0, 0, W, 706);
    ctx.fillStyle = 'rgba(255,196,120,0.2)'; for (let x = 40; x < W; x += 160) ctx.fillRect(x, 0, 70, 706);
    // window
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 7; roundRect(ctx, 1390, 120, 320, 290, 20); ctx.fill(); ctx.stroke();
    const g = ctx.createLinearGradient(0, 140, 0, 390); g.addColorStop(0, P.skyDeep); g.addColorStop(1, P.sky); ctx.fillStyle = g; roundRect(ctx, 1412, 142, 276, 246, 10); ctx.fill();
    L.cloud(ctx, 1500 + Math.sin(t * 0.3) * 10, 250, 0.55);
    ctx.strokeStyle = P.white; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(1550, 142); ctx.lineTo(1550, 388); ctx.moveTo(1412, 265); ctx.lineTo(1688, 265); ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, 1412, 142, 276, 246, 10); ctx.stroke();
    ctx.fillStyle = '#F4E3C0'; roundRect(ctx, 1368, 404, 364, 26, 8); ctx.fill(); ctx.stroke();
    // little picture on the wall
    ctx.fillStyle = P.white; roundRect(ctx, 520, 150, 170, 140, 14); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = P.skyDeep; roundRect(ctx, 538, 168, 134, 104, 8); ctx.fill(); L.star(ctx, 605, 220, 36, P.sun, 0.2);
    // skirting + floor
    ctx.fillStyle = P.white; ctx.fillRect(0, 676, W, 30); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 676); ctx.lineTo(W, 676); ctx.moveTo(0, 706); ctx.lineTo(W, 706); ctx.stroke();
    ctx.fillStyle = WOOD; ctx.fillRect(0, 706, W, H - 706);
    ctx.strokeStyle = WOOD_D; ctx.lineWidth = 4; const ys = [706, 766, 838, 926, 1030];
    for (let i = 1; i < ys.length; i++) { ctx.beginPath(); ctx.moveTo(0, ys[i]); ctx.lineTo(W, ys[i]); ctx.stroke(); }
    for (let i = 0; i < ys.length - 1; i++) for (let x = 90 + ((i * 131) % 330); x < W; x += 380) { ctx.beginPath(); ctx.moveTo(x, ys[i]); ctx.lineTo(x, ys[i + 1]); ctx.stroke(); }
  }
  // Curie's trainers: drawn on top of her feet (feet bottom is at y + 112 s)
  function trainer(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 5 / s;
    ctx.fillStyle = P.red; roundRect(ctx, -50, -50, 100, 42, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(-30, -48); ctx.quadraticCurveTo(0, -60, 30, -48); ctx.lineTo(20, -36); ctx.lineTo(-20, -36); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3 / s; [-30, -22].forEach(yy => { ctx.beginPath(); ctx.moveTo(-14, yy); ctx.lineTo(14, yy); ctx.stroke(); });
    ctx.fillStyle = P.white; ctx.strokeStyle = P.ink; ctx.lineWidth = 5 / s; roundRect(ctx, -54, -14, 108, 18, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.moveTo(-46, 4); for (let i = 0; i < 8; i++) { ctx.lineTo(-46 + i * 13 + 6.5, 10); ctx.lineTo(-46 + (i + 1) * 13, 4); } ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function curieShoes(ctx, o) { // o = the same x, y, s, t (and bob) that went to L.pip
    const s = o.s || 1, by = (o.bob === false ? 0 : Math.sin((o.t || 0) * 2.2) * 4) * s;
    trainer(ctx, o.x - 42 * s, o.y + 112 * s + by, 0.78 * s); trainer(ctx, o.x + 42 * s, o.y + 112 * s + by, 0.78 * s);
  }
  // close-up of a trainer sole on the ground: kind 'grass' (the teeth bite into the soft grass) or 'ice' (the teeth rest on the smooth ice and the sole slides by `shift`); centre (0, 0), radius ~250
  function soleCloseup(ctx, kind, t, shift) {
    ctx.fillStyle = '#EAF6FF'; ctx.fillRect(-400, -400, 800, 800);
    const top = 62, hi = top - 24, lo = top + 36, X0 = -840;
    const zig = dx => { ctx.moveTo(X0 + dx, hi); for (let i = 0; i < 31; i++) { ctx.lineTo(X0 + dx + i * 56 + 28, lo); ctx.lineTo(X0 + dx + i * 56 + 56, hi); } };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    const sole = dx => {
      ctx.fillStyle = '#3A3D5C'; ctx.beginPath(); zig(dx); ctx.lineTo(X0 + dx + 31 * 56, -400); ctx.lineTo(X0 + dx, -400); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.red; ctx.fillRect(X0 + dx, -400, 31 * 56, 320); ctx.strokeStyle = P.ink; ctx.beginPath(); ctx.moveTo(X0 + dx, -80); ctx.lineTo(X0 + dx + 31 * 56, -80); ctx.stroke();
      ctx.beginPath(); zig(dx); ctx.stroke();
    };
    if (kind === 'grass') {
      ctx.fillStyle = GRASS; ctx.beginPath(); zig(0); ctx.lineTo(X0 + 31 * 56, 400); ctx.lineTo(X0, 400); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = GRASS_D; ctx.lineWidth = 6; for (let i = -5; i <= 5; i++) { const gx = i * 56 + 14 + (i % 2) * 14, gy = 150 + ((i * 37) % 70); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 6, gy - 26); ctx.moveTo(gx + 12, gy); ctx.lineTo(gx + 16, gy - 22); ctx.stroke(); }
      sole(0);
    } else {
      ctx.fillStyle = ICE; ctx.fillRect(-400, lo, 800, 400); ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-400, lo); ctx.lineTo(400, lo); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-230, lo + 60); ctx.lineTo(-120, lo + 60); ctx.moveTo(60, lo + 100); ctx.lineTo(210, lo + 100); ctx.stroke();
      sole(shift || 0);
    }
  }
  function bikeWheel(ctx, x, y, R, ang, n) {
    n = n || 10;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    circle(ctx, 0, 0, R, P.ink); circle(ctx, 0, 0, R - 36, '#EEF2F8'); circle(ctx, 0, 0, R - 36, null, P.ink, 7); circle(ctx, 0, 0, R - 52, null, P.greyDark, 8);
    ctx.save(); ctx.rotate(ang); ctx.strokeStyle = P.greyDark; ctx.lineWidth = 5; for (let i = 0; i < n; i++) { ctx.rotate(Math.PI * 2 / n); ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, R - 54); ctx.stroke(); }
    ctx.fillStyle = P.sun; circle(ctx, R - 44 - 36, 0, 12, P.sun, P.ink, 4); ctx.restore();
    circle(ctx, 0, 0, 34, P.grey, P.ink, 7); circle(ctx, 0, 0, 12, P.ink);
    ctx.restore();
  }
  function crate(ctx, x, y, size, tilt, o) { // bottom-centre origin; a wooden crate (Try it 2)
    o = o || {}; ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0); const h = size, w = size; ctx.lineJoin = 'round';
    ctx.fillStyle = '#C98C4B'; ctx.strokeStyle = P.ink; ctx.lineWidth = 7; roundRect(ctx, -w / 2, -h, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E3A560'; roundRect(ctx, -w / 2 + 14, -h + 14, w - 28, h - 28, 8); ctx.fill(); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w / 2 + 16, -h + 16); ctx.lineTo(w / 2 - 16, -16); ctx.moveTo(w / 2 - 16, -h + 16); ctx.lineTo(-w / 2 + 16, -16); ctx.stroke();
    ctx.restore();
  }
  function cushion(ctx, x, y, w, h) { // bottom-centre origin
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.fillStyle = P.purple; ctx.strokeStyle = P.ink; ctx.lineWidth = 7; roundRect(ctx, -w / 2, -h, w, h, 44); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(ctx, -w / 2 + 22, -h + 20, w * 0.5, 22, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(43,45,66,0.35)'; ctx.lineWidth = 4; ctx.setLineDash([10, 9]); roundRect(ctx, -w / 2 + 20, -h + 20, w - 40, h - 40, 30); ctx.stroke(); ctx.setLineDash([]);
    circle(ctx, 0, -h / 2, 9, '#6E45D9', P.ink, 4);
    ctx.restore();
  }
  function bookRamp(ctx, x0, y0, x1, y1, th) { // a big book seen from the side: red covers, cream pages; its top surface runs from (x0, y0) to (x1, y1)
    const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0), c = 9;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(a); ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6;
    ctx.fillStyle = BOOK; roundRect(ctx, 0, 0, len, th, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.cream; roundRect(ctx, 16, c, len - 22, th - 2 * c, 3); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(43,45,66,0.3)'; ctx.lineWidth = 2; for (let yy = c + 6; yy < th - c - 2; yy += 6) { ctx.beginPath(); ctx.moveTo(20, yy); ctx.lineTo(len - 10, yy); ctx.stroke(); }
    ctx.fillStyle = '#C23B36'; roundRect(ctx, 0, 0, 14, th, 7); ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.stroke();
    ctx.restore();
  }
  function towel(ctx, x0, x1, y, p) { // a striped towel lying on the floor, unrolled left to right (p 0..1)
    if (p <= 0) return; const xe = lerp(x0, x1, clamp(p, 0, 1)); ctx.save(); ctx.beginPath(); ctx.rect(x0 - 40, y - 80, xe - x0 + 40, 140); ctx.clip();
    ctx.fillStyle = TOWEL; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; roundRect(ctx, x0, y - 22, x1 - x0, 50, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let x = x0 + 30; x < x1 - 20; x += 60) ctx.fillRect(x, y - 20, 18, 46);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x1 - 2, y - 14 + i * 8); ctx.lineTo(x1 + 14, y - 16 + i * 8); ctx.stroke(); }
    ctx.restore();
  }
  function block(ctx, x, y, size, color, p) { // a toy block marking a spot; bottom-centre origin, pops in
    if (p <= 0) return; const k = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineJoin = 'round';
    ctx.fillStyle = color; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, -size / 2, -size, size, size, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, -size / 2 + 8, -size + 8, size * 0.35, size * 0.2, 5); ctx.fill();
    ctx.restore();
  }
  // a sticker that pops in at pIn and pops out as pOut goes 0 -> 1
  function stk(ctx, str, x, y, pIn, pOut, o) { L.sticker(ctx, str, x, y, pIn * (1 - (pOut || 0)), o); }

  // ---------- the room scene: Curie rolls the car, it slows and stops (used by 'roll' and, frozen at the end, by 'why') ----------
  const RC = { x0: 650, x1: 1450, s: 1.55 };
  function roomCar(ctx, t, Lt) {
    room(ctx, t);
    const tP = Lt.chunk('roll', 'wheee'), tS = Lt.chunk('roll', 'and stops') + 0.55, T = tS - tP, D = RC.x1 - RC.x0;
    const p = clamp((t - tP) / T, 0, 1), x = RC.x0 + D * E.out(p), v = (p > 0 && p < 1) ? 2 * D * (1 - p) / T : 0;
    const ap = Lt.cwin('roll', 'curie rolls', 0.45, E.outBack, 1.0);
    if (ap > 0) { speedLines(ctx, x, FLOOR_Y, v / (2 * D / T), RC.s); car(ctx, x, FLOOR_Y, RC.s * ap, { spin: (x - RC.x0) / (27 * RC.s), omega: v / (27 * RC.s) }); }
    return { x, v };
  }
  // ---------- the close-up: the same car, magnified 7 times, wheel and floor ----------
  const CU = { cs: 7, wx: 820, fy: 695 };
  const NAME_F = 0.46;   // the word "friction" starts this long after the start of its chunk "rubbing friction." (a lone "friction." is heard as "a fraction")
  const bump = x => 24 * Math.abs(Math.sin(x / 24.8)) * (0.75 + 0.25 * Math.sin(x / 97 + 1));
  function closeup(ctx, t, Lt) {
    labBg(ctx);
    const cs = CU.cs, wr = 27 * cs, V1 = 330;
    // the wheel starts slowing on "and slows it down" and creeps to a stop while "friction" is said (steady slowing, so the rubbing marks fade with the speed)
    const tR = Lt.chunk('rub', 'the wheels rub'), tD = Lt.chunk('rub', 'and slows') + 0.15, TD = Lt.chunk('name', 'friction.') + NAME_F + 0.45 - tD;
    const d = moveDist(t, tR, 0.6, V1, tD, TD), v = moveSpeed(t, tR, 0.6, V1, tD, TD), sp = v / V1, fade = clamp(sp * 4, 0, 1);
    car(ctx, CU.wx - 50 * cs, CU.fy, cs, { spin: d / wr, omega: v / wr, tread: true });
    // the floor, magnified: bumpy, scrolling left while the wheel turns
    ctx.beginPath(); ctx.moveTo(-20, H + 40); for (let x = -20; x <= W + 20; x += 6) ctx.lineTo(x, CU.fy - bump(x + d)); ctx.lineTo(W + 20, H + 40); ctx.closePath();
    ctx.fillStyle = WOOD; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.save(); ctx.clip(); ctx.strokeStyle = WOOD_D; ctx.lineWidth = 5;
    for (let k = -1; k < 8; k++) { const x = (((k * 330 - d) % 2310) + 2310) % 2310 - 200; ctx.beginPath(); ctx.moveTo(x, CU.fy + 20); ctx.lineTo(x, H + 40); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, CU.fy + 110); ctx.lineTo(W, CU.fy + 110); ctx.stroke(); ctx.restore();
    // rubbing at the touching place: ring + zigzag marks (only while it moves)
    const rubOn = Lt.cafter('rub', 'the wheels rub');
    if (rubOn) {
      const rp = Lt.cwin('rub', 'the wheels rub', 0.4, E.outBack);
      ctx.save(); ctx.translate(CU.wx, CU.fy - 6); ctx.scale(rp, rp); ctx.setLineDash([16, 12]); ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 112 + 5 * Math.sin(t * 5), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(0.25 + sp, 0, 1) * fade; ctx.strokeStyle = '#FF8A3D'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [-78, 0, 78].forEach((ox, i) => { const w = Math.sin(t * 14 + i * 2) * 3; ctx.beginPath(); for (let k = 0; k <= 5; k++) { const xx = CU.wx + ox - 30 + k * 12, yy = CU.fy - 22 + (k % 2 ? -12 : 12) + w; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); });
      ctx.restore();
    }
    if (Lt.cafter('rub', 'the rubbing pulls')) {
      const ap = Lt.cwin('rub', 'the rubbing pulls', 0.45, E.outBack), sh = 4 * Math.sin(t * 9) * sp;
      ctx.save(); ctx.translate(sh, 0); ctx.globalAlpha = clamp(ap, 0, 1) * fade; L.arrow(ctx, 1010, 752, 700, 752, P.red, 22); L.arrow(ctx, 960, 818, 740, 818, P.red, 18); ctx.restore();
    }
  }

  // ---------- the fair test: three lanes, same ramp, same car, different floors ----------
  const RAMP = { xT: 270, xF: 640, h: 110, f0: 0.5 }, CAR_S = 0.8, LANE_V0 = 600, LANE_H = 64;   // low ramps: the waiting cars stay clear of the floor strip of the lane above
  const RLEN = Math.hypot(RAMP.xF - RAMP.xT, RAMP.h) * (1 - RAMP.f0), RTH = Math.atan2(RAMP.h, RAMP.xF - RAMP.xT), RTR = 2 * RLEN / LANE_V0;
  const RXS = lerp(RAMP.xT, RAMP.xF, RAMP.f0);
  // each lane: floor, distance the car goes after the ramp, and the word where the car comes to rest (tStop = that chunk + off)
  const LANES = [
    { key: 'carpet', y: 285, d: 260, line: 'carpet', chunk: 'stops quickly', off: 0.25, color: CARPET, arrows: [3, 92, 11] },
    { key: 'wood', y: 505, d: 600, line: 'floor', chunk: 'rolls further', off: 0.7, color: '#C77D2E', arrows: [2, 66, 9] },
    { key: 'ice', y: 725, d: 1000, line: 'ice', chunk: 'before it stops', off: 0.8, color: ICE_D, arrows: [1, 40, 7] }
  ];
  LANES.forEach(l => { l.tf = 2 * l.d / LANE_V0; l.total = RTR + l.tf; l.rel = l.off - l.total; /* release time relative to the stop chunk */ });
  function laneRun(t, tRel, lane) {
    const tau = t - tRel, mu = LANE_V0 * LANE_V0 / (2 * lane.d); let s = 0, v = 0;
    if (tau > 0 && tau < RTR) { const a = LANE_V0 / RTR; s = 0.5 * a * tau * tau; v = a * tau; }
    else if (tau >= RTR) { const k = Math.min(tau - RTR, lane.tf); s = RLEN + LANE_V0 * k - 0.5 * mu * k * k; v = LANE_V0 - mu * k; }
    if (s <= RLEN) { const f = RAMP.f0 + (1 - RAMP.f0) * s / RLEN; return { x: lerp(RAMP.xT, RAMP.xF, f), y: lane.y - RAMP.h * (1 - f), rot: RTH, spin: s / (27 * CAR_S), omega: v / (27 * CAR_S), v, onFloor: false }; }
    const fd = s - RLEN; return { x: RAMP.xF + fd, y: lane.y, rot: RTH * (1 - seg(fd, 0, 30)), spin: s / (27 * CAR_S), omega: v / (27 * CAR_S), v, onFloor: true };
  }
  function testScene(ctx, t, Lt) {
    ctx.fillStyle = '#EEF6FF'; ctx.fillRect(0, 0, W, H);
    const pRamp = i => Lt.cwin('test', 'scientists test', 0.5, E.outBack, 0.2 + i * 0.22);
    const pulse = Lt.cwin('test', 'same ramp', 0.9), pCar = i => Lt.cwin('test', 'same car', 0.5, E.outBack, i * 0.2);
    const pFloor = Lt.cwin('test', 'different floors', 1.0, E.inOut), pLab = i => Lt.cwin('test', 'different floors', 0.4, E.outBack, 0.5 + i * 0.25);
    LANES.forEach((ln, i) => {
      const y = ln.y, pr = pRamp(i); if (pr <= 0) return;
      // floor strip: plain at first, then it takes the colour of its floor, wiping in from the left
      ctx.save(); ctx.globalAlpha = clamp(pr, 0, 1); floorStrip(ctx, 'plain', 250, W + 20, y, LANE_H, t); ctx.restore();
      if (pFloor > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, y - 30, lerp(250, W + 20, pFloor), LANE_H + 60); ctx.clip(); floorStrip(ctx, ln.key, 250, W + 20, y, LANE_H, t); ctx.restore(); }
      // ramp (a wedge); pops in on its foot
      ctx.save(); ctx.translate((RAMP.xT + RAMP.xF) / 2, y); ctx.scale(pr, pr); ctx.translate(-(RAMP.xT + RAMP.xF) / 2, -y);
      ctx.fillStyle = '#D5DAE6'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(RAMP.xT, y - RAMP.h); ctx.lineTo(RAMP.xF, y); ctx.lineTo(RAMP.xT, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(43,45,66,0.2)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(RAMP.xT + 8, y - RAMP.h + 40); ctx.lineTo(RAMP.xF - 90, y - 8); ctx.stroke();
      ctx.restore();
      if (pulse > 0 && pulse < 1) { ctx.save(); ctx.globalAlpha = Math.sin(pulse * Math.PI) * 0.95; ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 11; ctx.setLineDash([18, 12]); ctx.beginPath(); ctx.moveTo(RAMP.xT - 8, y - RAMP.h - 8); ctx.lineTo(RAMP.xF + 10, y - 2); ctx.lineTo(RAMP.xT - 8, y - 2); ctx.closePath(); ctx.stroke(); ctx.restore(); }
    });
    // the common start: a dashed line through the three cars
    const sp = Lt.cwin('test', 'same car', 0.5);
    if (sp > 0) { ctx.save(); ctx.globalAlpha = sp * 0.8; ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 6; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.moveTo(RXS, 150); ctx.lineTo(RXS, 800); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
    LANES.forEach((ln, i) => {
      const y = ln.y, tStop = Lt.chunk(ln.line, ln.chunk) + ln.off, run = laneRun(t, tStop - ln.total, ln);
      const pc = pCar(i);
      if (pc > 0) {
        const fp = seg(t, tStop + 0.05, tStop + 0.45);
        if (run.onFloor && run.v > 6) { speedLines(ctx, run.x, run.y, run.v / LANE_V0, CAR_S); const [n, len, lw] = ln.arrows; rubArrows(ctx, run.x - 92 * CAR_S, run.y - 16, n, len, lw, clamp(run.v / 60, 0, 1), 1); }
        car(ctx, run.x, run.y, CAR_S * pc, { rot: run.rot, spin: run.spin, omega: run.omega });
        flag(ctx, RAMP.xF + ln.d + 100, y + 4, ln.color, fp, t, 1.15);
      }
      const lp = pLab(i); if (lp > 0) { ctx.save(); ctx.translate(1860, y + LANE_H / 2 + 2); ctx.scale(lp, lp); text(ctx, ['carpet', 'wood', 'ice'][i], 0, 0, { size: 46, weight: 700, color: P.white, stroke: P.ink, strokeWidth: 10, align: 'right' }); ctx.restore(); }
    });
    // Curie, small, on the left
    L.pip(ctx, { x: 148, y: 500, s: 0.8, t, mood: Lt.cafter('ice', 'before it stops') && t > Lt.chunk('ice', 'before it stops') + 0.8 ? 'wow' : 'talk', armR: -0.9, armL: 1.0, lookX: 0.8 });
    // stickers: one at a time, same spot
    const X = 1000, Y = 76, o = { size: 72, rot: -0.03 };
    const h = (id, n) => Lt.cwin(id, n, 0.25);
    stk(ctx, 'Fair test!', X, Y, Lt.cwin('test', 'scientists test', 0.5), h('test', 'same ramp'), Object.assign({ bg: P.blue, color: P.white }, o));
    stk(ctx, 'same ramp!', X, Y, Lt.cwin('test', 'same ramp', 0.5), h('test', 'same car'), Object.assign({ bg: P.sun }, o));
    stk(ctx, 'same car, same start!', X, Y, Lt.cwin('test', 'same car', 0.5), h('test', 'different floors'), Object.assign({ bg: P.sun }, o));
    stk(ctx, 'different floors!', X, Y, Lt.cwin('test', 'different floors', 0.5), h('carpet', 'there is lots'), Object.assign({ bg: P.pink }, o));
    stk(ctx, 'LOTS of rubbing', X, Y, Lt.cwin('carpet', 'there is lots', 0.5), h('floor', 'there is less'), Object.assign({ bg: CARPET, color: P.white }, o));
    stk(ctx, 'LESS rubbing', X, Y, Lt.cwin('floor', 'there is less', 0.5), h('ice', 'there is hardly'), Object.assign({ bg: '#C77D2E', color: P.white }, o));
    stk(ctx, 'HARDLY any rubbing', X, Y, Lt.cwin('ice', 'there is hardly', 0.5), 0, Object.assign({ bg: ICE_D }, o));
  }

  // ---------- useful friction: shoes grip, shoes slip on ice, bike brakes ----------
  // a magnifier lens that pops in; inner(ctx) draws the picture around (0, 0)
  function lens(ctx, cx, cy, r, p, inner) {
    if (p <= 0) return; const k = E.outBack(clamp(p, 0, 1)), R = r * k;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip(); ctx.translate(cx, cy); ctx.scale(k, k); inner(ctx); ctx.restore();
    L.magnifier(ctx, cx, cy, R, 1);
  }
  function dashedLink(ctx, x0, y0, x1, y1, a) {
    if (a <= 0) return; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.setLineDash([16, 14]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
  }
  function dashedRing(ctx, x, y, r, p, t) {
    if (p <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(p, p); ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 8; ctx.setLineDash([16, 12]); ctx.beginPath(); ctx.arc(0, 0, r + 4 * Math.sin(t * 5), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  const GP = { x: 520, y: 620, s: 1.55 };                   // Curie, walking on the grass (feet bottom at y + 112 s)
  function gripScene(ctx, t, Lt) {
    L.sky(ctx); L.sun(ctx, 1740, 150, 95, t); L.cloud(ctx, 260 + Math.sin(t * 0.3) * 20, 170, 1.0); L.cloud(ctx, 1560 + Math.cos(t * 0.25) * 25, 400, 0.7);
    L.ground(ctx, 700);
    // grass tufts drift past: she is walking along
    ctx.save(); ctx.strokeStyle = GRASS_D; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) { const x = (((i * 163 - t * 120) % 2300) + 2300) % 2300 - 190, y = 760 + (i % 3) * 42; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y - 24); ctx.moveTo(x + 12, y); ctx.lineTo(x + 14, y - 28); ctx.moveTo(x + 26, y); ctx.lineTo(x + 34, y - 22); ctx.stroke(); }
    ctx.restore();
    const w = t * 6, lift = 18 * GP.s, fy = GP.y + 112 * GP.s + Math.sin(t * 2.2) * 4 * GP.s;
    const happy = Lt.cafter('grip', "don't slip");
    L.pip(ctx, { x: GP.x, y: GP.y, s: GP.s, t, mood: happy ? 'happy' : 'talk', armR: 0.35 + 0.45 * Math.sin(w), armL: 0.35 - 0.45 * Math.sin(w), lookX: 0.8 });
    trainer(ctx, GP.x - 42 * GP.s, fy - Math.max(0, Math.sin(w)) * lift, 0.78 * GP.s); trainer(ctx, GP.x + 42 * GP.s, fy - Math.max(0, -Math.sin(w)) * lift, 0.78 * GP.s);
    // the lens on the sole: its teeth bite into the grass
    const lp = Lt.cwin('grip', 'it helps your shoes', 0.5, E.outBack, 0.35), LX = 1230, LY = 470, LR = 240, sx = GP.x + 42 * GP.s, sy = fy - 30;
    dashedLink(ctx, sx + 66, sy - 30, LX - LR * 0.92, LY + LR * 0.4, lp);
    dashedRing(ctx, sx, sy, 78, lp, t);
    lens(ctx, LX, LY, LR, lp, c => { c.translate(0, -34); soleCloseup(c, 'grass', t, 0); });
    const o = { size: 84, rot: -0.04 }, X = 960, Y = 140;
    stk(ctx, 'Friction is useful!', X, Y, Lt.cwin('grip', 'friction is useful', 0.5), Lt.cwin('grip', 'it helps your shoes', 0.25, null, 0.6), Object.assign({ bg: P.red, color: P.white }, o));
    stk(ctx, 'GRIP!', X, Y, Lt.cwin('grip', 'it helps your shoes', 0.5, null, 0.7), Lt.cwin('grip', "don't slip", 0.25), Object.assign({ bg: P.sun, size: 100 }, o));
    stk(ctx, 'no slipping!', X, Y, Lt.cwin('grip', "don't slip", 0.5, null, 0.2), 0, Object.assign({ bg: P.green, color: P.white }, o));
  }
  // Curie walks in over the ice at `walk` px/s (the walk cycle of the grip scene), her feet slip at x = xs, and she glides on at the same speed, slowing steadily to a stop over T seconds (D = 0.5 * walk * T)
  const SL = { xs: 540, walk: 180, fy: 790, s: 1.3, T: 4.5 };
  SL.D = 0.5 * SL.walk * SL.T;
  function slipScene(ctx, t, Lt) {
    L.sky(ctx, { top: '#BFE3FF', bottom: '#F2FAFF' });
    L.snowflake(ctx, 250, 150 + Math.sin(t) * 6, 34, t * 0.3); L.snowflake(ctx, 1500, 90 + Math.sin(t * 0.8) * 6, 26, -t * 0.25); L.snowflake(ctx, 1040, 330 + Math.sin(t * 1.1) * 6, 22, t * 0.4);
    ctx.fillStyle = ICE; ctx.fillRect(0, 740, W, H - 740); ctx.strokeStyle = P.ink; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 740); ctx.lineTo(W, 740); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(0, 747, W, 9);
    ctx.lineCap = 'round'; ctx.lineWidth = 6; for (let i = 0; i < 9; i++) { const gx = 110 + i * 215 + ((i * 53) % 90), gy = 780 + ((i * 37) % 40), a = clamp(0.5 + 0.4 * Math.sin(t * 1.6 + i), 0.15, 0.95); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(gx, gy + 14); ctx.lineTo(gx + 30, gy - 14); ctx.moveTo(gx + 40, gy + 14); ctx.lineTo(gx + 54, gy - 2); ctx.stroke(); }
    const tS = Lt.chunk('slip', 'whoops'), p = clamp((t - tS) / SL.T, 0, 1), x = t < tS ? SL.xs - SL.walk * (tS - t) : SL.xs + SL.D * E.out(p), v0 = 2 * SL.D / SL.T, sp = (p > 0 && p < 1) ? 1 - p : 0;
    const lose = Lt.cwin('slip', 'whoops', 0.25, E.out, -0.1), flail = clamp(sp * 2.5, 0, 1) * lose, y = SL.fy - 112 * SL.s;
    const wk = clamp(1 - (t - tS) / 0.15, 0, 1), w = t * 6, lift = 18 * SL.s;   // the walk cycle (as in the grip scene) lasts until her feet slip
    const mood = t >= tS + SL.T - 0.3 ? 'happy' : t >= tS - 0.15 ? 'wow' : 'talk';
    ellipse(ctx, x, SL.fy + 12, 120 * SL.s, 16, 'rgba(43,45,66,0.12)');
    if (sp > 0.05) { ctx.save(); ctx.globalAlpha = clamp(sp * 1.5, 0, 0.8); ctx.strokeStyle = P.blueDeep; ctx.lineWidth = 8; ctx.lineCap = 'round'; [[-8, 1], [-40, 0.7], [-72, 0.9]].forEach(([dy, k]) => { const x0 = x - 130 * SL.s; ctx.beginPath(); ctx.moveTo(x0, SL.fy + dy); ctx.lineTo(x0 - (40 + 200 * sp * (v0 / 350)) * k, SL.fy + dy); ctx.stroke(); }); ctx.restore(); }
    const pvx = x - 42 * SL.s; ctx.save(); ctx.translate(pvx, SL.fy); ctx.rotate(-0.4 * flail + 0.04 * Math.sin(t * 9) * sp); ctx.translate(-pvx, -SL.fy);
    L.pip(ctx, { x, y, s: SL.s, t, mood, armR: lerp(lerp(0.4, 0.35 + 0.45 * Math.sin(w), wk), -0.9 + 0.7 * Math.sin(t * 10), flail), armL: lerp(lerp(0.4, 0.35 - 0.45 * Math.sin(w), wk), -0.9 - 0.7 * Math.sin(t * 10), flail), lookX: 0.6 });
    const by = Math.sin(t * 2.2) * 4 * SL.s;
    trainer(ctx, x - 42 * SL.s, SL.fy + by - Math.max(0, Math.sin(w)) * lift * wk, 0.78 * SL.s); trainer(ctx, x + 42 * SL.s + 40 * flail * SL.s, SL.fy + by - 10 * flail * SL.s - Math.max(0, -Math.sin(w)) * lift * wk, 0.78 * SL.s);
    ctx.restore();
    // the lens on the sole: smooth ice, nothing to bite, the sole just slides
    const lp = Lt.cwin('slip', 'there is hardly', 0.5, E.outBack, 0.2), sh = 130 * E.out(clamp((t - tS) / 1.6, 0, 1));
    lens(ctx, 1500, 440, 240, lp, c => { c.translate(0, -34); soleCloseup(c, 'ice', t, sh); L.arrow(c, 140 + sh * 0.2, 120, 80 + sh * 0.2, 120, P.red, 14); });
    const o = { size: 84, rot: -0.04 }, X = 830, Y = 150;
    stk(ctx, 'slippery ice!', X, Y, Lt.cwin('slip', 'but on slippery', 0.5), Lt.cwin('slip', 'whoops', 0.25, null, -0.1), Object.assign({ bg: ICE_D }, o));
    stk(ctx, 'Whoops!', X, Y, Lt.cwin('slip', 'whoops', 0.5, null, -0.1), Lt.cwin('slip', 'there is hardly', 0.25, null, 0.2), Object.assign({ bg: P.red, color: P.white, size: 108 }, o));
    stk(ctx, 'hardly any rubbing!', X, Y, Lt.cwin('slip', 'there is hardly', 0.5, null, 0.4), 0, Object.assign({ bg: ICE_D }, o));
  }
  const BK = { cx: 840, cy: 520, R: 270, W0: 6, TW: 2.3, phi: -Math.PI / 2 + 0.44, span: 0.25, th: 28, rim: 58, away: 64 };   // the bike wheel: W0 = rad/s while rolling, TW = seconds it takes to stop once the pad touches; the pad squeezes the grey rim (radius R - rim .. R - rim + th), away = how far outside it waits
  function brakeScene(ctx, t, Lt) {
    labBg(ctx);
    const { cx, cy, R, W0, TW, phi, span, th, rim, away } = BK, tP = Lt.chunk('brakes', 'they rub') + 0.3, tC = tP + 0.35;
    const close = seg(t, tP, tC, E.out), k = clamp(t - tC, 0, TW), ang = t <= tC ? W0 * t : W0 * tC + W0 * (k - k * k / (2 * TW)), om = t <= tC ? W0 : W0 * (1 - k / TW), sp = clamp(om / W0, 0, 1), fade = clamp(sp * 4, 0, 1);
    bikeWheel(ctx, cx, cy, R, ang, 10);
    // white swish marks on the tyre: they fade as the wheel slows
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.globalAlpha = sp * 0.8; ctx.strokeStyle = P.white; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, R - 18, i * Math.PI * 2 / 3, i * Math.PI * 2 / 3 + 0.5); ctx.stroke(); } ctx.restore();
    // fork, handlebar and lever
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const cr = { x: cx - 60, y: cy - R - 110 };
    ctx.strokeStyle = P.ink; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cr.x, cr.y); ctx.stroke(); ctx.strokeStyle = P.red; ctx.lineWidth = 24; ctx.stroke();
    circle(ctx, cx, cy, 24, P.grey, P.ink, 7);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(cr.x, cr.y); ctx.lineTo(cr.x + 150, cr.y - 18); ctx.stroke(); ctx.strokeStyle = P.greyDark; ctx.lineWidth = 18; ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 42; ctx.beginPath(); ctx.moveTo(cr.x + 150, cr.y - 18); ctx.lineTo(cr.x + 245, cr.y - 14); ctx.stroke(); ctx.strokeStyle = P.sun; ctx.lineWidth = 26; ctx.stroke();
    const piv = { x: cr.x + 175, y: cr.y - 2 }, la = lerp(0.62, 0.2, close), tip = { x: piv.x + 112 * Math.cos(la), y: piv.y + 112 * Math.sin(la) };
    ctx.strokeStyle = P.ink; ctx.lineWidth = 24; ctx.beginPath(); ctx.moveTo(piv.x, piv.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); ctx.strokeStyle = P.sun; ctx.lineWidth = 12; ctx.stroke();
    // the brake: a curved rubber pad on an arm from the fork; it waits outside, then comes in and squeezes the grey rim (like a real rim brake)
    const rIn = R - rim + away * (1 - close), rOut = rIn + th, pe = { x: cx + rOut * Math.cos(phi), y: cy + rOut * Math.sin(phi) };
    ctx.strokeStyle = P.ink; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(cr.x, cr.y); ctx.lineTo(pe.x, pe.y); ctx.stroke(); ctx.strokeStyle = P.grey; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + pe.x) / 2 + 20, Math.max(tip.y, pe.y) + 50 - 30 * close, (cr.x + pe.x) / 2 + 10, (cr.y + pe.y) / 2 + 6); ctx.stroke();
    ctx.fillStyle = '#FF8A3D'; ctx.strokeStyle = P.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, rOut, phi - span, phi + span); ctx.arc(cx, cy, rIn, phi + span, phi - span, true); ctx.closePath(); ctx.fill(); ctx.stroke();
    // rubbing where the pad touches the rim (the marks and the pull-back arrow fade as the wheel stops)
    const rubP = Lt.cwin('brakes', 'they rub', 0.4, E.outBack, 0.45), rc = R - rim + th / 2, cxp = cx + R * Math.cos(phi), cyp = cy + R * Math.sin(phi);
    if (rubP > 0) {
      ctx.save(); ctx.translate(cx + rc * Math.cos(phi), cy + rc * Math.sin(phi)); ctx.scale(rubP, rubP); ctx.setLineDash([16, 12]); ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 84 + 5 * Math.sin(t * 5), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(0.25 + sp, 0, 1) * fade; ctx.strokeStyle = '#FF8A3D'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [phi - span - 0.17, phi + span + 0.17].forEach((a0, i) => { const w = Math.sin(t * 14 + i * 2) * 3; ctx.save(); ctx.translate(cx + rc * Math.cos(a0), cy + rc * Math.sin(a0)); ctx.rotate(a0 + Math.PI / 2); ctx.beginPath(); for (let q = 0; q <= 4; q++) { const xx = -24 + q * 12, yy = (q % 2 ? -11 : 11) + w; q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.restore(); });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(rubP, 0, 1) * fade; ctx.translate(4 * Math.sin(t * 9) * sp, 0); L.arrow(ctx, cxp + 350, cyp + 86, cxp + 170, cyp + 86, P.red, 20); ctx.restore();
    }
    L.pip(ctx, { x: 1650, y: 330, s: 0.95, t, mood: 'talk', armL: -0.6, armR: 0.5, lookX: -0.7, lookY: 0.3 });
    const o = { size: 84, rot: -0.05 }, X = 1440, Y = 640;
    stk(ctx, 'Bike brakes!', X, Y, Lt.cwin('brakes', 'bike brakes', 0.5), Lt.cwin('brakes', 'they rub', 0.25), Object.assign({ bg: P.blue, color: P.white }, o));
    stk(ctx, 'rub the wheel!', X, Y, Lt.cwin('brakes', 'they rub', 0.5), Lt.cwin('brakes', 'to slow', 0.25), Object.assign({ bg: P.sun }, o));
    stk(ctx, 'slows the bike!', X, Y, Lt.cwin('brakes', 'to slow', 0.5), 0, Object.assign({ bg: P.red, color: P.white }, o));
  }
  // ---------- say it: Curie with her arms up; the car rolls in from the left, slowing steadily, and stops on the last "down!" (the rubbing arrows fade with its speed) ----------
  const SY = { x0: -190, x1: 1020 };
  function sayScene(ctx, t, Lt) {
    room(ctx, t);
    const t0 = Lt.start('sayit'), T = Lt.end('sayit') - 0.1 - t0, D = SY.x1 - SY.x0, p = clamp((t - t0) / T, 0, 1);
    const x = SY.x0 + D * E.out(p), v = p < 1 ? 2 * D * (1 - p) / T : 0, a = 0.8 + 0.2 * Math.sin(t * 3);
    speedLines(ctx, x, FLOOR_Y, v / (2 * D / T), RC.s);
    car(ctx, x, FLOOR_Y, RC.s, { spin: (x - SY.x0) / (27 * RC.s), omega: v / (27 * RC.s) });
    rubArrows(ctx, x - 92 * RC.s, FLOOR_Y - 16, 3, 150, 15, a * clamp(v / 60, 0, 1), 1);
    L.pip(ctx, { x: 1550, y: 696, s: 1.3, t, mood: 'talk', armR: -1.3, armL: 1.3 + Math.PI, lookX: -0.4, lookY: -0.5 });
    L.sayItSticker(ctx, 'Rubbing slows it down!', Lt.cwin('sayit', 'rubbing slows it down', 0.8), t);
  }

  // ---------- try at home: a book ramp on a cushion, a toy car, two blocks and a towel ----------
  const HM = { floor: 772, th: 40, a: 0.4, hx: 690, len: 423.5, cs: 0.85, s0: 90, V0: 560, d1: 470, d2: 200, dropL: 40, towel: [1120, 1490], cush: { x: 530, w: 340, h: 220 } };
  HM.ex = HM.hx + HM.len * Math.cos(HM.a); HM.ey = HM.floor - HM.th * Math.cos(HM.a); HM.hy = HM.ey - HM.len * Math.sin(HM.a);
  HM.Lr = HM.len - HM.s0; HM.tr = 2 * HM.Lr / HM.V0; HM.td = HM.dropL / HM.V0; HM.start = { x: HM.hx + HM.s0 * Math.cos(HM.a), y: HM.hy + HM.s0 * Math.sin(HM.a) };
  HM.stop = d => HM.ex + HM.dropL + d;
  function homePose(tm, D) {   // the car tm seconds after it was let go: speeds up on the book, then slows steadily on the floor (D = how far it goes after the book)
    const tf = 2 * D / HM.V0, mu = HM.V0 * HM.V0 / (2 * D); let s = 0, v = 0, done = false;
    if (tm >= HM.tr + HM.td) { const k = Math.min(tm - HM.tr - HM.td, tf); s = HM.Lr + HM.dropL + HM.V0 * k - 0.5 * mu * k * k; v = HM.V0 - mu * k; done = tm - HM.tr - HM.td >= tf; }
    else if (tm >= HM.tr) { s = HM.Lr + HM.V0 * (tm - HM.tr); v = HM.V0; }
    else if (tm > 0) { const a = HM.V0 / HM.tr; s = 0.5 * a * tm * tm; v = a * tm; }
    let x, y, rot;
    if (s <= HM.Lr) { const d = HM.s0 + s; x = HM.hx + d * Math.cos(HM.a); y = HM.hy + d * Math.sin(HM.a); rot = HM.a; }
    else if (s <= HM.Lr + HM.dropL) { const dx = s - HM.Lr, ta = Math.tan(HM.a), c = (HM.floor - HM.ey - ta * HM.dropL) / (HM.dropL * HM.dropL); x = HM.ex + dx; y = HM.ey + ta * dx + c * dx * dx; rot = HM.a * (1 - dx / HM.dropL); }
    else { x = HM.ex + s - HM.Lr; y = HM.floor; rot = 0; }
    return { x, y, rot, s, v, done };
  }
  function popAt(ctx, cx, cy, p, fn) { if (p <= 0) return; const k = E.outBack(clamp(p, 0, 1)); ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); fn(); ctx.restore(); }
  function tryScene(ctx, t, Lt) {
    ctx.fillStyle = '#FFF4DF'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#D9B277'; ctx.fillRect(0, 730, W, H - 730); ctx.fillStyle = '#B98B4E'; ctx.fillRect(0, 730, W, 22);
    ctx.strokeStyle = '#B98B4E'; ctx.lineWidth = 4; [850, 960, 1050].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
    L.tryBanner(ctx, Lt.win('try1', 0, 0.6)); L.grownUpBadge(ctx, 180, 300, Lt.win('try1', 1.2, 0.6));
    const t1 = Lt.chunk('try1', 'roll a toy') + 0.6, t2 = Lt.chunk('try2', 'and roll the car') + 1.2, tB = Lt.chunk('try2', 'now lay a towel') + 1.0;
    const cp = Lt.cwin('try1', 'ask a grown-up', 0.5, E.outBack, 1.2), bp = Lt.cwin('try1', 'ask a grown-up', 0.5, E.outBack, 2.0), ap = Lt.cwin('try1', 'roll a toy', 0.45, E.outBack);
    const tp = Lt.cwin('try2', 'now lay a towel', 1.0, E.out, 0.4);
    L.pip(ctx, { x: 170, y: 650, s: 0.9, t, mood: Lt.cafter('try2', 'stop... now') ? 'think' : 'talk', armR: 0.1, armL: 0.6, lookX: 0.8 });
    popAt(ctx, HM.cush.x, 780 - HM.cush.h / 2, cp, () => cushion(ctx, HM.cush.x, 780, HM.cush.w, HM.cush.h));
    if (tp > 0) towel(ctx, HM.towel[0], HM.towel[1], HM.floor - 6, tp);
    popAt(ctx, (HM.hx + HM.ex) / 2, (HM.hy + HM.ey) / 2, bp, () => bookRamp(ctx, HM.hx, HM.hy, HM.ex, HM.ey, HM.th));
    // blocks that mark where the car stopped
    const x1 = HM.stop(HM.d1) + 86 * HM.cs + 48, x2 = HM.stop(HM.d2) + 86 * HM.cs + 48;
    block(ctx, x1, HM.floor + 12, 80, P.green, Lt.cwin('try2', 'put a block', 0.4, null, 0.3));
    block(ctx, x2, HM.floor + 12, 80, P.sun, Lt.cwin('try2', 'stop... now', 0.4, null, 1.0));
    // the car
    let pose = { x: HM.start.x, y: HM.start.y, rot: HM.a, s: 0, v: 0, hop: false };
    if (t >= t2) pose = homePose(t - t2, HM.d2);
    else if (t >= tB + 0.9) pose = { x: HM.start.x, y: HM.start.y, rot: HM.a, s: 0, v: 0 };
    else if (t >= tB) { const q = seg(t, tB, tB + 0.9, E.inOut), e = homePose(1e9, HM.d1); pose = { x: lerp(e.x, HM.start.x, q), y: lerp(e.y, HM.start.y, q) - 150 * Math.sin(Math.PI * q), rot: lerp(0, HM.a, q), s: q * 200, v: 0, hop: true }; }
    else if (t >= t1) pose = homePose(t - t1, HM.d1);
    if (ap > 0) {
      const onFloor = pose.rot < 0.05 && !pose.hop;
      if (onFloor && pose.v > 20) { speedLines(ctx, pose.x, pose.y, pose.v / HM.V0, HM.cs); const tw = t >= t2 && tp > 0.99 && pose.x > HM.towel[0] - 20, [n, len, lw] = tw ? [3, 92, 11] : [2, 66, 9]; rubArrows(ctx, pose.x - 92 * HM.cs, pose.y - 16, n, len, lw, clamp(pose.v / 60, 0, 1), 1); }
      car(ctx, pose.x, pose.y, HM.cs * ap, { rot: pose.rot, spin: pose.s / (27 * HM.cs), omega: pose.v / (27 * HM.cs) });
    }
    // where? marks, and the "same spot" pointer
    const q1 = Lt.cwin('try2', 'stop on the floor', 0.45, E.outBack, 0.2) * (1 - Lt.cwin('try2', 'put a block', 0.2, null, 0.3)), q2 = Lt.cwin('try2', 'stop... now', 0.45, E.outBack) * (1 - Lt.cwin('try2', 'stop... now', 0.2, null, 1.0));
    if (q1 > 0) L.questionMark(ctx, HM.stop(HM.d1) + 20, 600, q1 * (1 + 0.06 * Math.sin(t * 3)), t);
    if (q2 > 0) L.questionMark(ctx, HM.stop(HM.d2) + 20, 600, q2 * (1 + 0.06 * Math.sin(t * 3)), t);
    const sameP = Lt.cwin('try2', 'and roll the car', 0.5, null, 0.1) * (1 - Lt.cwin('try2', 'stop... now', 0.25));
    if (sameP > 0) { stk(ctx, 'same spot!', 930, 400, sameP, 0, { bg: P.pink, size: 76, rot: -0.05 }); ctx.save(); ctx.globalAlpha = clamp(sameP, 0, 1); L.arrow(ctx, 870, 470, HM.start.x + 10, HM.start.y - 100, P.sunDeep, 14); ctx.restore(); }
  }

  // ---------- Try it 1: the ramp race (geometry and the physics of the run) ----------
  const RR = { xT: 150, yT: 320, xF: 580, yF: 620, f0: 0.28, stripY: 620, stripH: 110, x1: 1880, v0t: 1.1, cs: 1.1 };
  const RR_LEN = Math.hypot(RR.xF - RR.xT, RR.yF - RR.yT) * (1 - RR.f0), RR_TH = Math.atan2(RR.yF - RR.yT, RR.xF - RR.xT), RR_V0 = 2 * RR_LEN / RR.v0t;
  const RR_START = { x: lerp(RR.xT, RR.xF, RR.f0), y: lerp(RR.yT, RR.yF, RR.f0) };
  const FLOOR_D = { ice: 1130, wood: 700, carpet: 380, grass: 250 };   // how far the car goes after the ramp (px): ice far, grass short
  const FLOOR_CUE = { ice: 'far', wood: 'middle', carpet: 'short', grass: 'short' };
  const FLOOR_ORDER = ['ice', 'wood', 'carpet', 'grass'], FLOOR_NAME = { ice: 'Ice', wood: 'Wood', carpet: 'Carpet', grass: 'Grass' };
  const FLOOR_COL = { ice: ICE_D, wood: '#C77D2E', carpet: CARPET, grass: GRASS };
  const SW = { y: 905, w: 300, h: 170, xs: [480, 810, 1140, 1470] };
  const RR_ARROWS = { ice: [1, 50, 8], wood: [2, 76, 10], carpet: [3, 104, 12], grass: [4, 108, 12] };   // rubbing arrows: how many, how long, how thick
  function rrRun(floor, tm) {   // the car's state tm seconds after it was let go
    const d = FLOOR_D[floor], tf = 2 * d / RR_V0, mu = RR_V0 * RR_V0 / (2 * d); let s = 0, v = 0, done = false;
    if (tm > 0 && tm < RR.v0t) { const a = RR_V0 / RR.v0t; s = 0.5 * a * tm * tm; v = a * tm; }
    else if (tm >= RR.v0t) { const k = Math.min(tm - RR.v0t, tf); s = RR_LEN + RR_V0 * k - 0.5 * mu * k * k; v = RR_V0 - mu * k; done = tm - RR.v0t >= tf; }
    if (s <= RR_LEN) { const f = RR.f0 + (1 - RR.f0) * s / RR_LEN; return { x: lerp(RR.xT, RR.xF, f), y: lerp(RR.yT, RR.yF, f), rot: RR_TH, s, v, done: false }; }
    const fd = s - RR_LEN; return { x: RR.xF + fd, y: RR.yF, rot: RR_TH * (1 - seg(fd, 0, 36)), s, v, done };
  }

  // ---------- Try it 2: push the box ----------
  const PB = { size: 170, strip: 100, xmin: 430, xmax: 1770, x0: 490, hit: 130, sx0: 330, sx1: 1880 };
  const PB_LANES = {   // y = top edge of the strip; vmax = fastest the box follows the finger (px/s); k = how quickly it catches up; acc = px/s^2; mu = steady slowing once let go (px/s^2); cap = fastest it may slide away
    ice: { y: 370, vmax: 1500, k: 14, acc: 6000, mu: 230, cap: 650 },
    sand: { y: 830, vmax: 125, k: 4, acc: 900, mu: 3200, cap: 125 }
  };
  const PB_METER = { x: 1250, w: 300, h: 38, ice: 545, sand: 615 };
  const soundOn = f => { try { if (L.sound) f(L.sound); } catch (e) { /* no sound is fine */ } };

  // ---- Try it 1 drawing ----
  function rrCarPose(s) {   // where the car is now: waiting at the top, rolling, waiting at its stop, or hopping back to the top
    if (s.tm >= 0) return rrRun(s.floor, s.tm);
    if (s.back >= 1.0) { const q = clamp((s.back - 1.0) / 0.7, 0, 1), e = E.inOut(q); return { x: lerp(s.stopX, RR_START.x, e), y: lerp(RR.yF, RR_START.y, e) - 150 * Math.sin(Math.PI * q), rot: RR_TH * e, s: 0, v: 0, hop: q }; }
    if (s.back >= 0) return { x: s.stopX, y: RR.yF, rot: 0, s: 0, v: 0 };
    return { x: RR_START.x, y: RR_START.y, rot: RR_TH, s: 0, v: 0 };
  }
  function rrDraw(ctx, s, t) {
    ctx.fillStyle = '#EEF6FF'; ctx.fillRect(0, 0, W, H);
    const busy = s.tm >= 0 || s.back >= 0, pose = rrCarPose(s);
    // the ramp, the platform under it and the chosen floor
    floorStrip(ctx, 'plain', -20, RR.xF, RR.stripY, RR.stripH, t);
    floorStrip(ctx, s.floor, RR.xF, W + 20, RR.stripY, RR.stripH, t);
    ctx.fillStyle = '#D5DAE6'; ctx.strokeStyle = P.ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(RR.xT, RR.yT); ctx.lineTo(RR.xF, RR.yF); ctx.lineTo(RR.xT, RR.yF); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,45,66,0.2)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(RR.xT + 12, RR.yT + 50); ctx.lineTo(RR.xF - 110, RR.yF - 10); ctx.stroke();
    // the same start every time
    ctx.save(); ctx.globalAlpha = 0.7; ctx.strokeStyle = P.sunDeep; ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.beginPath(); ctx.moveTo(RR_START.x, 250); ctx.lineTo(RR_START.x, RR.stripY + RR.stripH); ctx.stroke(); ctx.restore();
    // flags left by earlier runs
    FLOOR_ORDER.forEach((f, i) => {
      const x = s.flags[f]; if (x == null) return; const fx = x + 86 * RR.cs + 18;
      flag(ctx, fx, RR.stripY + 4, FLOOR_COL[f], 1, t, 1.2);
      text(ctx, FLOOR_NAME[f], fx + 30, RR.stripY - 160 - (i % 2) * 50, { size: 42, weight: 700, color: P.ink, stroke: P.white, strokeWidth: 9 });
    });
    // the car, with rubbing arrows and speed lines while it rolls on the floor
    if (pose.v > 6 && pose.rot < 0.05) { speedLines(ctx, pose.x, pose.y, pose.v / RR_V0, RR.cs); const [n, len, lw] = RR_ARROWS[s.floor]; rubArrows(ctx, pose.x - 92 * RR.cs, pose.y - 16, n, len, lw, clamp(pose.v / 60, 0, 1), 1); }
    car(ctx, pose.x, pose.y, RR.cs, { rot: pose.rot, spin: pose.s / (27 * RR.cs), omega: pose.v / (27 * RR.cs) });
    // "tap me" until the first run
    if (s.runs === 0 && !busy) {
      const bob = Math.sin(t * 4) * 8; text(ctx, 'tap me', RR_START.x, 215 + bob, { size: 60, weight: 700, color: P.ink, stroke: P.white, strokeWidth: 12 }); L.arrow(ctx, RR_START.x, 262 + bob, RR_START.x, 322 + bob, P.red, 14);
    }
    // the four floors to pick from
    FLOOR_ORDER.forEach((f, i) => {
      const x = SW.xs[i], y = SW.y, sel = s.floor === f, k = sel ? 1.07 + 0.02 * Math.sin(t * 4) : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.globalAlpha = busy && !sel ? 0.5 : 1;
      ctx.save(); ctx.beginPath(); roundRect(ctx, -SW.w / 2, -SW.h / 2, SW.w, SW.h, 26); ctx.clip(); floorStrip(ctx, f, -SW.w / 2 - 10, SW.w / 2 + 10, -SW.h / 2 - 34, SW.h + 34, t, { lw: 4 }); ctx.restore();
      ctx.lineWidth = sel ? 14 : 8; ctx.strokeStyle = sel ? FLOOR_COL[f] : P.ink; roundRect(ctx, -SW.w / 2, -SW.h / 2, SW.w, SW.h, 26); ctx.stroke(); if (sel) { ctx.lineWidth = 5; ctx.strokeStyle = P.ink; roundRect(ctx, -SW.w / 2 - 8, -SW.h / 2 - 8, SW.w + 16, SW.h + 16, 32); ctx.stroke(); }
      text(ctx, FLOOR_NAME[f], 0, 4, { size: 54, weight: 700, color: P.ink, stroke: P.white, strokeWidth: 12 });
      ctx.restore();
    });
    // Curie: wow after a long roll, happy after a short one
    const last = s.last, mood = s.tm >= 0 ? 'talk' : last === 'ice' || last === 'wood' ? 'wow' : last ? 'happy' : 'talk';
    L.pip(ctx, { x: 170, y: 860, s: 0.78, t, mood, armR: -0.5, armL: 0.6, lookX: 0.8, lookY: -0.2 });
  }
  // ---- Try it 2 drawing ----
  function crateAt(ctx, lane, b, t, eff) {
    const L2 = PB_LANES[lane], by = L2.y + 8, tilt = lane === 'ice' ? clamp(b.v / 3000, -0.08, 0.08) : 0;
    if (Math.abs(b.v) > 100 && lane === 'ice') { ctx.save(); ctx.globalAlpha = clamp(Math.abs(b.v) / 500, 0, 0.7); ctx.strokeStyle = P.blueDeep; ctx.lineWidth = 8; ctx.lineCap = 'round'; const dir = Math.sign(b.v); [[-30, 1], [-70, 0.7], [-110, 0.9]].forEach(([dy, kk]) => { const x0 = b.x - dir * (PB.size / 2 + 14); ctx.beginPath(); ctx.moveTo(x0, by + dy * 1.2); ctx.lineTo(x0 - dir * (30 + Math.abs(b.v) * 0.12) * kk, by + dy * 1.2); ctx.stroke(); }); ctx.restore(); }
    crate(ctx, b.x, by, PB.size, tilt);
  }
  function meter(ctx, y, v, label, t) {
    const x = PB_METER.x, w = PB_METER.w, h = PB_METER.h;
    text(ctx, label, x - 18, y + 2, { size: 40, weight: 700, color: P.ink, align: 'right' });
    ctx.fillStyle = P.white; roundRect(ctx, x, y - h / 2, w, h, h / 2); ctx.fill();
    if (v > 0.01) { ctx.save(); ctx.beginPath(); roundRect(ctx, x, y - h / 2, w, h, h / 2); ctx.clip(); ctx.fillStyle = v > 0.66 ? P.red : v > 0.33 ? P.sunDeep : P.green; ctx.fillRect(x, y - h / 2, w * clamp(v, 0, 1), h); ctx.restore(); }
    ctx.strokeStyle = P.ink; ctx.lineWidth = 6; roundRect(ctx, x, y - h / 2, w, h, h / 2); ctx.stroke();
  }
  function pbDraw(ctx, s, t) {
    ctx.fillStyle = '#EEF6FF'; ctx.fillRect(0, 0, W, H);
    const I = PB_LANES.ice, S = PB_LANES.sand;
    floorStrip(ctx, 'ice', PB.sx0, PB.sx1, I.y, PB.strip, t); floorStrip(ctx, 'sand', PB.sx0, PB.sx1, S.y, PB.strip, t);
    text(ctx, 'ice', PB.sx1 - 30, I.y + 54, { size: 54, weight: 700, color: P.white, stroke: P.ink, strokeWidth: 10, align: 'right' }); text(ctx, 'sand', PB.sx1 - 30, S.y + 54, { size: 54, weight: 700, color: P.white, stroke: P.ink, strokeWidth: 10, align: 'right' });
    crateAt(ctx, 'ice', s.ice, t); crateAt(ctx, 'sand', s.sand, t);
    meter(ctx, PB_METER.ice, s.effIce, 'ice effort', t); meter(ctx, PB_METER.sand, s.eff, 'sand effort', t);
    // Curie, at the left between the lanes: easy on ice, straining on sand
    const strain = s.eff > 0.45, mood = strain ? 'sad' : s.drag === 'ice' || Math.abs(s.ice.v) > 120 ? 'wow' : 'happy';
    const cx = 195, cy = 640;
    L.pip(ctx, { x: cx, y: cy, s: 1.0, t, mood, armR: strain ? -0.3 : 0.4, armL: strain ? 0.3 : 0.4, lookX: 0.8, lookY: 0.3 });
    if (strain) for (let i = 0; i < 3; i++) { const q = ((t * 1.3 + i / 3) % 1); ctx.save(); ctx.globalAlpha = 1 - q; circle(ctx, cx + 100 + i * 22, cy - 80 - q * 34 + (i % 2) * 14, 10 - 3 * q, P.blue, P.ink, 3); ctx.restore(); }
    if (!s.touched) {
      const bob = Math.sin(t * 4) * 8;
      [I.y + 8 - PB.size, S.y + 8 - PB.size].forEach(y => { text(ctx, 'drag me', PB.x0, y - 52 + bob, { size: 58, weight: 700, color: P.ink, stroke: P.white, strokeWidth: 12 }); L.arrow(ctx, PB.x0 + 120, y + PB.size / 2 + bob, PB.x0 + 250, y + PB.size / 2 + bob, P.red, 14); });
    }
  }

  L.episodes.ep11 = {
    id: 'ep11', num: 11, title: 'Why do rolling things stop?', short: 'Friction', phrase: 'Rubbing slows it down!',
    thumb: {
      big: 'STOP?', small1: 'Why do rolling things', small2: '',
      bg: (ctx, t) => {
        L.sky(ctx); L.sun(ctx, 1700, 200, 110, t); L.ground(ctx, 820);
        speedLines(ctx, 1420, 820, 0.45, 2.6);
        car(ctx, 1420, 830, 2.6, { spin: 0.6 });
        flag(ctx, 1725, 836, P.red, 1, t, 2.2);
      }
    },
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", say: "Hello, little scientists! I'm *Curie*! Welcome... to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why do rolling things stop?", say: "Today's big question... Why do rolling things *stop*?", hold: 0.6 },
      { id: 'roll', text: 'Curie rolls her toy car across the floor. Wheee! It rolls... and rolls... and slows down... and stops.', say: 'Curie rolls her toy car across the floor. {hi}Wheee!{/hi} It rolls... and rolls... and *slows* down... and *stops*.', hold: 0.8 },
      { id: 'why', text: "Why did it stop? Nobody grabbed it! Let's look closer.", say: "*Why* did it stop? Nobody *grabbed* it! Let's look *closer*.", hold: 0.8 },
      { id: 'rub', text: "Here's the secret. The wheels rub on the floor as they roll. The rubbing pulls back on the car... and slows it down.", say: "Here's the *secret*... The wheels *rub* on the floor, as they roll. The rubbing pulls *back* on the car... and slows it *down*.", hold: 0.5 },
      { id: 'name', text: 'Scientists call this rubbing friction.', say: 'Scientists call this... rubbing *friction*.', hold: 0.8 },
      { id: 'test', text: 'Scientists test it! Same ramp, same car, but different floors.', say: '{sfx:ding}Scientists *test* it! Same *ramp*... same *car*... but *different* floors.', hold: 0.5 },
      { id: 'carpet', text: 'On bumpy carpet, there is lots of rubbing. The car stops quickly!', say: 'On *bumpy* carpet... there is *lots* of rubbing. The car stops *quickly*!', hold: 0.6 },
      { id: 'floor', text: 'On a smooth wooden floor, there is less rubbing. The car rolls further.', say: 'On a *smooth* wooden floor... there is *less* rubbing. The car rolls *further*.', hold: 0.6 },
      { id: 'ice', text: 'On slippery ice, there is hardly any rubbing! The car rolls a long, long way... before it stops.', say: 'On *slippery* ice... there is *hardly any* rubbing! The car rolls a *long*, long way... before it stops.', hold: 1.0 },
      { id: 'grip', text: "And friction is useful, too! It helps your shoes grip the ground, so you don't slip.", say: "And *friction* is useful, too! It helps your shoes *grip* the ground... so you don't slip.", hold: 0.4 },
      { id: 'slip', text: 'But on slippery ice... whoops! There is hardly any rubbing, so Curie slips and slides!', say: 'But on *slippery* ice... {sfx:boing}*Whoops*! There is hardly any rubbing, so Curie slips and slides!', hold: 0.6 },
      { id: 'brakes', text: 'Bike brakes use rubbing, too. They rub the wheel to slow the bike down.', say: 'Bike brakes use *rubbing*, too. They *rub* the wheel... to slow the bike *down*.', hold: 0.6 },
      { id: 'sayit', text: 'Say it with me: rubbing slows it down!', say: 'Say it with me... {sfx:ding}*Rubbing* slows it *down*! {pause 0.9} {slow}Rubbing... slows it... down!{/slow}', hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up to help you make a ramp with a big book. Roll a toy car down it.", say: "{sfx:tada}Let's try it at home! Ask a grown-up to help you make a *ramp*, with a big *book*. Roll a toy *car* down it.", hold: 0.4 },
      { id: 'try2', text: 'Where does it stop on the floor? Put a block there! Now lay a towel at the bottom, and roll the car again from the same spot. Where does it stop now?', say: '{sfx:ding}Where does it stop on the *floor*? Put a *block* there! Now lay a *towel* at the bottom... and roll the car again, from the *same* spot. {sfx:ding}Where does it stop... *now*?', hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: rubbing slows things down. See you next time at the Little Scientists Club! Bye-bye!', say: '{sfx:tada}Great job, little scientist! Remember... *rubbing* slows things *down*. See you next time, at the Little Scientists Club! {hi}Bye-bye!{/hi}', hold: 1.2 }
    ],
    sfx: [
      { line: 'roll', offset: 1.0, name: 'pop', vol: 0.7 },
      { line: 'roll', chunk: 'wheee', name: 'rumble' },
      { line: 'roll', chunk: 'and rolls', name: 'rumble', vol: 0.7 },
      { line: 'roll', chunk: 'and slows', name: 'rumble', vol: 0.45 },
      { line: 'why', chunk: "let's look", offset: 0.1, name: 'zoom' },
      { line: 'name', chunk: 'friction.', offset: 1.3, name: 'ding' },   // just after the word, so the soft "f" of "friction" stays clear
      // the three cars of the fair test: rolling sound from the moment each is let go, a soft pop when its flag goes up
      { line: 'carpet', chunk: 'stops quickly', offset: LANES[0].rel, name: 'rumble', vol: 0.55 },
      { line: 'carpet', chunk: 'stops quickly', offset: LANES[0].off + 0.05, name: 'pop', vol: 0.7 },
      { line: 'floor', chunk: 'rolls further', offset: LANES[1].rel, name: 'rumble', vol: 0.55 },
      { line: 'floor', chunk: 'rolls further', offset: LANES[1].off + 0.05, name: 'pop', vol: 0.7 },
      { line: 'ice', chunk: 'before it stops', offset: LANES[2].rel, name: 'rumble', vol: 0.4 },
      { line: 'ice', chunk: 'before it stops', offset: LANES[2].rel + 1.2, name: 'rumble', vol: 0.3 },
      { line: 'ice', chunk: 'before it stops', offset: LANES[2].rel + 2.4, name: 'rumble', vol: 0.2 },
      { line: 'ice', chunk: 'before it stops', offset: LANES[2].off + 0.05, name: 'pop', vol: 0.7 },
      { line: 'slip', chunk: 'there is hardly', offset: 0.1, name: 'whoosh', vol: 0.5 },
      { line: 'brakes', chunk: 'they rub', offset: 0.25, name: 'scrape', vol: 0.8 },
      { line: 'brakes', chunk: 'to slow', offset: 0.1, name: 'scrape', vol: 0.6 },
      { line: 'try1', chunk: 'roll a toy', offset: 0.6, name: 'rumble', vol: 0.5 },
      { line: 'try2', chunk: 'and roll the car', offset: 1.2, name: 'rumble', vol: 0.5 }
    ],
    scenes: [
      { from: 'hello', draw: (ctx, t, Lt) => L.scenes.intro(ctx, t, Lt) },
      { from: 'q', draw: (ctx, t, Lt) => L.scenes.question(ctx, t, Lt, (c, tt) => { car(c, 0, 90, 1.25, { spin: tt * 2 }); }, { word: 'Why?' }) },
      {
        from: 'roll', draw: (ctx, t, Lt) => {
          roomCar(ctx, t, Lt);
          const tP = Lt.chunk('roll', 'wheee'), push = seg(t, tP - 0.3, tP + 0.05, E.in), back = seg(t, tP + 0.15, tP + 1.0);
          L.pip(ctx, { x: 330, y: 654, s: 1.3, t, mood: Lt.cafter('roll', 'and stops') ? 'wow' : 'talk', armR: lerp(lerp(-0.8, 0.35, push), -0.3, back), armL: 0.6, lookX: 0.8 });
          const o = { size: 84, rot: -0.06 };
          stk(ctx, 'Wheee!', 1000, 250, Lt.cwin('roll', 'wheee', 0.5), Lt.cwin('roll', 'it rolls', 0.25, null, 0.9), Object.assign({ bg: P.sun }, o));
          stk(ctx, 'slows down...', 1000, 250, Lt.cwin('roll', 'and slows', 0.5), Lt.cwin('roll', 'and stops', 0.25), Object.assign({ bg: P.blue, color: P.white }, o));
          stk(ctx, 'STOPS!', 1000, 250, Lt.cwin('roll', 'and stops', 0.5, null, 0.3), 0, Object.assign({ bg: P.red, color: P.white, size: 96 }, o));
        }
      },
      {
        from: 'why', transition: 'cut', draw: (ctx, t, Lt) => {
          roomCar(ctx, t, Lt);
          const q = Lt.cwin('why', 'why did it stop', 0.5, E.outBack), sh = Lt.cwin('why', 'nobody grabbed', 0.4, E.outBack);
          L.pip(ctx, { x: 330, y: 654, s: 1.3, t, mood: 'think', armR: lerp(-0.4, -0.7, sh), armL: lerp(0.6, -0.7, sh), lookX: 0.8, lookY: -0.2 });
          if (q > 0) L.questionMark(ctx, RC.x1, 535, q * (1 + 0.08 * Math.sin(t * 3)), t);
          if (sh > 0) { // an empty hand, crossed out: nobody grabbed the car
            const fade = 1 - Lt.cwin('why', "let's look", 0.3); ctx.save(); ctx.globalAlpha = clamp(fade, 0, 1); ctx.translate(1000, 440); ctx.scale(sh, sh);
            L.hand(ctx, 0, 0, 1.5, 0.2); ctx.strokeStyle = P.red; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-140, -150); ctx.lineTo(140, 150); ctx.moveTo(140, -150); ctx.lineTo(-140, 150); ctx.stroke(); ctx.restore();
          }
          // the magnifier grows until the close-up fills the picture
          const p = seg(t, Lt.chunk('why', "let's look"), Lt.end('why') + 0.6, E.in);
          if (p > 0) {
            const mx = RC.x1 + 50 * RC.s, my = 740, r = lerp(140, 2400, p);
            ctx.save(); ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.clip(); ctx.translate((mx - CU.wx) * (1 - p), (my - CU.fy) * (1 - p)); closeup(ctx, t, Lt); ctx.restore();
            if (p < 1) L.magnifier(ctx, mx, my, r, p);
          }
        }
      },
      {
        from: 'rub', transition: 'cut', draw: (ctx, t, Lt) => {
          closeup(ctx, t, Lt);
          L.pip(ctx, { x: 1700, y: 235, s: 0.8, t, mood: 'talk', armL: -0.6, armR: 0.5, lookX: -0.7, lookY: 0.4 });
          const o = { size: 88, rot: -0.07 }, X = 1430, Y = 440;
          stk(ctx, 'rub!', X, Y, Lt.cwin('rub', 'the wheels rub', 0.5), Lt.cwin('rub', 'the rubbing pulls', 0.25), Object.assign({ bg: P.sun }, o));
          stk(ctx, 'pulls back!', X, Y, Lt.cwin('rub', 'the rubbing pulls', 0.5), Lt.cwin('rub', 'and slows', 0.25), Object.assign({ bg: P.red, color: P.white }, o));
          stk(ctx, 'slows down!', X, Y, Lt.cwin('rub', 'and slows', 0.5), Lt.cwin('name', 'scientists call', 0.25), Object.assign({ bg: P.blue, color: P.white }, o));
          L.sticker(ctx, 'FRICTION', X - 40, Y, Lt.cwin('name', 'friction.', 0.6, null, NAME_F), { bg: P.red, color: P.white, size: 110, rot: -0.05 });
        }
      },
      { from: 'test', draw: (ctx, t, Lt) => testScene(ctx, t, Lt) },
      { from: 'grip', draw: (ctx, t, Lt) => gripScene(ctx, t, Lt) },
      { from: 'slip', draw: (ctx, t, Lt) => slipScene(ctx, t, Lt) },
      { from: 'brakes', draw: (ctx, t, Lt) => brakeScene(ctx, t, Lt) },
      { from: 'sayit', draw: (ctx, t, Lt) => sayScene(ctx, t, Lt) },
      { from: 'try1', draw: (ctx, t, Lt) => tryScene(ctx, t, Lt) },
      { from: 'bye', draw: (ctx, t, Lt) => L.scenes.outro(ctx, t, Lt, 'Rubbing slows it down!') }
    ],
    interactives: [
      {
        title: 'Ramp race',
        hint: 'Pick a floor: ice, wood, carpet or grass. Then tap the car to let it go! Where does it stop?',
        init: s => { s.floor = 'ice'; s.tm = -1; s.back = -1; s.flags = { ice: null, wood: null, carpet: null, grass: null }; s.stopX = RR_START.x; s.runs = 0; s.last = ''; s.snd = 0; s.pending = ''; s.lastCue = ''; },
        update: (s, dt, cue) => {
          if (s.pending) { cue(s.pending); s.lastCue = s.pending; s.pending = ''; }
          if (s.tm >= 0) {
            s.tm += dt; const r = rrRun(s.floor, s.tm), f = clamp(r.v / RR_V0, 0, 1);
            s.snd -= dt; if (s.snd <= 0 && r.v > 25) { s.snd = 0.2; soundOn(S => S.noise(0.26, 0.04 + 0.07 * f, { lp: 500 + 900 * f })); }
            if (r.done) { s.stopX = r.x; s.flags[s.floor] = r.x; s.last = s.floor; s.runs++; s.tm = -1; s.back = 0; s.pending = FLOOR_CUE[s.floor]; soundOn(S => S.tone(660, 0.14, { type: 'triangle', vol: 0.22 })); }
          } else if (s.back >= 0) { s.back += dt; if (s.back >= 1.7) s.back = -1; }
        },
        draw: (ctx, s, t) => rrDraw(ctx, s, t),
        pointer: (s, type, x, y) => {
          if (type !== 'down') return;
          const busy = s.tm >= 0 || s.back >= 0;
          for (let i = 0; i < 4; i++) if (Math.abs(x - SW.xs[i]) < SW.w / 2 + 20 && Math.abs(y - SW.y) < SW.h / 2 + 20) { if (!busy && s.floor !== FLOOR_ORDER[i]) { s.floor = FLOOR_ORDER[i]; soundOn(S => S.tone(440 + 110 * i, 0.12, { type: 'triangle', vol: 0.2 })); } return; }
          if (!busy && Math.hypot(x - RR_START.x, y - (RR_START.y - 55)) < 160) { s.tm = 0; s.snd = 0; }
        },
        cues: {
          far: 'Slippery ice hardly rubs at all. The car rolls a long, long way!',
          middle: 'Smooth wood rubs a little. The car rolls quite far.',
          short: 'Bumpy floors rub a lot. The car stops quickly!'
        }
      },
      {
        title: 'Push the box',
        hint: "Push the box along with your finger. On ice it slides easily; on sand it's hard work!",
        init: s => { s.ice = { x: PB.x0, v: 0 }; s.sand = { x: PB.x0, v: 0 }; s.drag = ''; s.fx = 0; s.grab = 0; s.downX = 0; s.moved = 0; s.touched = false; s.eff = 0; s.effIce = 0; s.snd = 0; s.pending = ''; s.lastCue = ''; },
        update: (s, dt, cue) => {
          if (s.pending) { cue(s.pending); s.lastCue = s.pending; s.pending = ''; }
          const I = PB_LANES.ice, S = PB_LANES.sand, bi = s.ice, bs = s.sand;
          // ice: the box follows the finger closely; once let go it keeps sliding and slows down steadily
          if (s.drag === 'ice') { const dx = s.fx + s.grab - bi.x; bi.v += clamp(clamp(dx * I.k, -I.vmax, I.vmax) - bi.v, -I.acc * dt, I.acc * dt); s.effIce += (clamp(Math.abs(dx) / 260, 0, 1) * 0.4 - s.effIce) * Math.min(1, dt * 8); }
          else { const d = I.mu * dt; bi.v = Math.abs(bi.v) <= d ? 0 : bi.v - Math.sign(bi.v) * d; s.effIce *= 1 - Math.min(1, dt * 6); }
          bi.x += bi.v * dt; if (bi.x < PB.xmin) { bi.x = PB.xmin; bi.v = Math.max(0, bi.v); } if (bi.x > PB.xmax) { bi.x = PB.xmax; bi.v = Math.min(0, bi.v); }
          // sand: the box only creeps along while it is pushed, the finger runs ahead (effort), and it stops at once when let go
          if (s.drag === 'sand') { const dx = s.fx + s.grab - bs.x; bs.v += clamp(clamp(dx * S.k, -S.vmax, S.vmax) - bs.v, -S.acc * dt, S.acc * dt); const tgt = (Math.abs(dx) > 6 || Math.abs(bs.v) > 5) ? clamp(0.3 + Math.abs(dx) / 260, 0, 1) : 0; s.eff += (tgt - s.eff) * Math.min(1, dt * 8); }
          else { const d = S.mu * dt; bs.v = Math.abs(bs.v) <= d ? 0 : bs.v - Math.sign(bs.v) * d; s.eff *= 1 - Math.min(1, dt * 5); }
          bs.x += bs.v * dt; if (bs.x < PB.xmin) { bs.x = PB.xmin; bs.v = Math.max(0, bs.v); } if (bs.x > PB.xmax) { bs.x = PB.xmax; bs.v = Math.min(0, bs.v); }
          // soft sounds while a box moves
          s.snd -= dt; if (s.snd <= 0) { if (Math.abs(bi.v) > 60) { s.snd = 0.18; soundOn(Z => Z.noise(0.2, 0.025 + 0.04 * clamp(Math.abs(bi.v) / 650, 0, 1), { hp: 1800 })); } else if (Math.abs(bs.v) > 10) { s.snd = 0.14; soundOn(Z => Z.noise(0.16, 0.07, { lp: 900 })); } }
        },
        draw: (ctx, s, t) => pbDraw(ctx, s, t),
        pointer: (s, type, x, y) => {
          if (type === 'down' && !s.drag) {
            let best = '', bd = 1e9;
            for (const k of ['ice', 'sand']) { const b = s[k], d = Math.hypot(x - b.x, y - (PB_LANES[k].y + 8 - PB.size / 2)); if (d < PB.hit && d < bd) { best = k; bd = d; } }
            if (best) { s.drag = best; s.grab = s[best].x - x; s.fx = x; s.downX = x; s.moved = 0; s.touched = true; }
          } else if (type === 'move' && s.drag) { s.fx = clamp(x, PB.xmin - 200, PB.xmax + 200); s.moved = Math.max(s.moved, Math.abs(x - s.downX)); }
          else if (type === 'up' && s.drag) {
            const k = s.drag, b = s[k]; s.drag = '';
            if (k === 'ice') { b.v = clamp(b.v, -PB_LANES.ice.cap, PB_LANES.ice.cap); if (Math.abs(b.v) >= 140) s.pending = 'slide'; }
            else if (s.moved >= 40) s.pending = 'hard';
          }
        },
        cues: {
          slide: 'On ice, a little push... and it slides and slides!',
          hard: "Sand rubs a lot. It's hard to push, and it stops right away!"
        }
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
