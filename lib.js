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
  // Curie asks the big question with a thought bubble; drawInBubble(ctx,t) draws the topic prop centred at 0,0
  L.scenes.question = function (ctx, t, Lt, drawInBubble) {
    L.park(ctx, t, { house: true });
    L.pip(ctx, { x: 620, y: 720, s: 1.4, t, mood: 'think', armR: -0.9, armL: 0.6, lookX: 0.6, lookY: -0.6 });
    const bp = Lt.win('q', 0.1, 0.6); L.thoughtBubble(ctx, 1230, 380, 700, 480, bp, 1);
    if (bp > 0.5) { ctx.save(); ctx.translate(1180, 400); drawInBubble(ctx, t); ctx.restore(); L.questionMark(ctx, 1500, 320, 1 + 0.1 * Math.sin(t * 3), t); }
    L.sticker(ctx, 'Why?', 380, 300, Lt.cwin('q', 1, 0.5), { bg: P.pink, rot: -0.12 });
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
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why does ice cream melt?", hold: 0.6 },
      { id: 'look', text: 'Look! Here is a lovely ice cream cone. It is cold and hard. Brrr!', say: 'Look! Here is a lovely ice cream cone. It is cold, and hard. Burr!', hold: 0.4 },
      { id: 'sunny', text: 'Now the sun is shining. It is warm. Watch what happens.', hold: 1.4 },
      { id: 'drip', text: 'Drip... drip... drip! The ice cream is turning into liquid. It is melting!', hold: 0.6 },
      { id: 'why', text: "Why? Let's look closer. Much, much closer.", hold: 0.8 },
      { id: 'bits', text: 'Ice cream is made of tiny, tiny bits, far too small to see.', hold: 0.4 },
      { id: 'cold', text: 'When ice cream is cold, the tiny bits hold on to each other tightly. So the ice cream stays hard. We call that a solid.', hold: 0.6 },
      { id: 'warm', text: 'When something warm touches the ice cream, like the sun, or your warm hand, it gives the tiny bits heat.', hold: 0.4 },
      { id: 'wiggle', text: 'Heat makes the tiny bits wiggle and jiggle! They wiggle so much that they let go of each other.', hold: 0.6 },
      { id: 'flow', text: 'Now they can slide and flow. The ice cream becomes runny, like a liquid. That is melting!', hold: 0.8 },
      { id: 'sayit', text: 'So, heat makes solid ice cream melt into a liquid. Say it with me: heat makes it melt!', hold: 1.4 },
      { id: 'freeze', text: 'And guess what? If we put the melted ice cream back in the freezer, the cold makes the tiny bits hold hands again, and it turns hard. It freezes!', hold: 0.8 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for two ice cubes.", hold: 0.3 },
      { id: 'try2', text: 'Put one in the sunshine, and one in the shade. Which one melts first? Watch and see!', hold: 1.6 },
      { id: 'bye', text: 'Great job, little scientist! Remember: heat makes things melt. See you next time at the Little Scientists Club! Bye-bye!', hold: 1.2 }
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
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why does a ball always come down?", hold: 0.6 },
      { id: 'throw', text: 'Curie throws the ball up... up... up! And look. Down it comes.', hold: 0.8 },
      { id: 'again', text: "Let's try again, higher! Up, up, up... and down. Every single time!", hold: 0.8 },
      { id: 'why', text: "Why doesn't the ball just float away into the sky?", hold: 0.8 },
      { id: 'earth', text: "Here's the secret. Our Earth is enormous. And it pulls everything towards it.", hold: 0.6 },
      { id: 'gravity', text: 'This pull has a name: gravity. Gravity pulls the ball down.', hold: 0.8 },
      { id: 'feel', text: "You can't see gravity. But you can feel it! Jump up... and gravity brings you back down. Thump!", hold: 0.8 },
      { id: 'pulls', text: 'Gravity pulls the ball. Gravity pulls a leaf. Gravity pulls the rain. Gravity pulls you and me!', hold: 0.6 },
      { id: 'feet', text: "Gravity even keeps your feet on the ground, so you don't float away. Thank you, gravity!", hold: 0.6 },
      { id: 'together', text: 'Gravity pulls everything, big or small. A big ball and a small ball drop together... and land together!', hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: gravity pulls things down!', hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Hold a ball in one hand, and a toy in the other, at the same height.", hold: 0.4 },
      { id: 'try2', text: 'Let go at the same time. Which one lands first? Watch closely!', hold: 1.8 },
      { id: 'bye', text: 'Great job, little scientist! Remember: gravity pulls everything down to the Earth. See you next time at the Little Scientists Club! Bye-bye!', hold: 1.2 }
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
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: where does rain come from?", hold: 0.6 },
      { id: 'rain', text: "Pitter patter, pitter patter. It's raining! But where was all this water before?", hold: 0.8 },
      { id: 'sea', text: "Let's find out. Here is a big, blue sea. And here is the warm sun.", hold: 0.6 },
      { id: 'warm', text: 'The sun warms the water. When water gets warm, tiny bits of it float up into the air.', hold: 0.6 },
      { id: 'vapour', text: "They are so tiny, you can't see them. This is called water vapour. Up, up, up they go!", hold: 0.6 },
      { id: 'cold', text: 'High up in the sky, it is very cold. Brrr! The tiny bits of water get cold and huddle together.', say: 'High up in the sky, it is very cold. Burr! The tiny bits of water get cold, and huddle together.', hold: 0.6 },
      { id: 'cloud', text: 'They make tiny droplets. Millions of tiny droplets together make... a cloud!', hold: 0.8 },
      { id: 'join', text: 'The droplets bump into each other and join up. They get bigger... and bigger... and heavier.', hold: 0.6 },
      { id: 'fall', text: "When the drops get too heavy to float, down they fall. That's rain!", hold: 0.8 },
      { id: 'river', text: 'The rain fills the rivers, and the rivers run back to the sea. Then the sun warms the water again!', hold: 0.8 },
      { id: 'cycle', text: 'Up as vapour, cloud, rain, back to the sea. Round and round it goes. We call this the water cycle!', hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: the sun lifts the water up, and the rain brings it down!', hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a glass of very cold water with ice.", hold: 0.4 },
      { id: 'try2', text: "Leave it on the table and wait. Look! Little drops appear on the outside of the glass. That's water vapour from the air, turning back into water. Just like a tiny cloud!", hold: 1.4 },
      { id: 'bye', text: 'Great job, little scientist! Remember: the sun lifts water up to make clouds, and clouds give us rain. See you next time at the Little Scientists Club! Bye-bye!', hold: 1.2 }
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
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why do I have a shadow?", hold: 0.6 },
      { id: 'walk', text: "It's a sunny day. Curie is walking... and look! Something dark is following Curie on the ground.", hold: 0.8 },
      { id: 'wave', text: "It's a shadow! When Curie waves, the shadow waves. When Curie jumps, the shadow jumps!", hold: 0.8 },
      { id: 'torch', text: "Where does a shadow come from? Let's find out with a torch.", hold: 0.8 },
      { id: 'light', text: 'Light travels in straight lines, like tiny speedy arrows. Zoom!', hold: 0.8 },
      { id: 'wall', text: 'When the light hits the wall, the wall is bright.', hold: 0.6 },
      { id: 'block', text: "Now Curie stands in front of the torch. The light hits Curie and stops. It can't go through Curie!", hold: 0.6 },
      { id: 'shadow', text: "Behind Curie, no light can reach the wall. That dark spot is Curie's shadow.", hold: 0.8 },
      { id: 'define', text: "A shadow is the place where the light can't go.", hold: 1.0 },
      { id: 'lowhigh', text: 'Watch this. When the sun is low, the shadow is looong. When the sun is high, the shadow is short!', say: 'Watch this! When the sun is low, the shadow is very, very long. When the sun is high, the shadow is short!', hold: 0.8 },
      { id: 'noon', text: "That's why your shadow is long in the morning and evening, and short at noon, when the sun is high.", hold: 0.8 },
      { id: 'sayit', text: "Say it with me: a shadow is where the light can't go!", hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a torch. Make the room dark and shine it on the wall.", hold: 0.4 },
      { id: 'try2', text: 'Put your hand in the light. Can you make a dog? A bird? Move your hand closer to the torch. Does the shadow get bigger, or smaller?', hold: 1.6 },
      { id: 'bye', text: "Great job, little scientist! Remember: your body blocks the light, and that makes a shadow. See you next time at the Little Scientists Club! Bye-bye!", hold: 1.2 }
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
    lines: [
      { id: 'hello', text: "Hello, little scientists! I'm Curie. Welcome to the Little Scientists Club!", hold: 0.3 },
      { id: 'q', text: "Today's big question: why do boats float?", hold: 0.6 },
      { id: 'stone', text: "Here's a big pond. Splash! Curie drops in a stone. Down it goes. It sinks.", hold: 0.8 },
      { id: 'boat', text: 'Now Curie puts in a little toy boat. It stays on top. It floats!', hold: 0.8 },
      { id: 'why', text: 'Why does the stone sink, but the boat floats?', hold: 0.8 },
      { id: 'push', text: "Here's the secret: water pushes up! Try pushing a ball under the water in the bath. Can you feel the water pushing it back up?", hold: 0.8 },
      { id: 'displace', text: 'When something sits in water, it pushes some water out of the way. And the water pushes back up!', hold: 0.8 },
      { id: 'stone2', text: "The stone is small and heavy. It pushes only a little water away, so the water's push is too small. Down it sinks.", hold: 0.8 },
      { id: 'boat2', text: 'The boat is wide and hollow, full of air. It pushes a lot of water away. So the water pushes up hard, and holds the boat up. It floats!', hold: 0.8 },
      { id: 'clay1', text: "Let's test it. Curie squashes some clay into a ball. Plop! It sinks.", hold: 0.8 },
      { id: 'clay2', text: 'Now Curie makes the same clay into a wide boat shape... It floats! Same clay, different shape!', hold: 1.0 },
      { id: 'sayit', text: 'Say it with me: water pushes up!', hold: 1.4 },
      { id: 'try1', text: "Let's try it at home! Ask a grown-up for a bowl of water. Collect a spoon, a coin, a cork, a plastic lid, and a leaf.", hold: 0.4 },
      { id: 'try2', text: 'Guess first: will it sink, or float? Then drop it in. Were you right?', hold: 1.8 },
      { id: 'bye', text: 'Great job, little scientist! Remember: water pushes up, and that is why boats float. See you next time at the Little Scientists Club! Bye-bye!', hold: 1.2 }
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
