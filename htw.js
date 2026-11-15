/* "How things work" asset: the production bicycle (Episode 26, "How does a bicycle work?").

   const bike = L.three.kits.bike(T, L3, opts);        // opts: { color: '#D81428' } frame paint (optional)
   A child's bicycle facing +x (front wheel at +x, drive train on the +z side, towards the default camera), both tyres on
   y = 0, centred near x = 0. 1 unit is about 30 cm. Everything is procedural and posed ONLY by

     bike.userData.set({ crank, wheel, front, steer, ghost, glow: { pedal, ring, chain, sprocket, wheel, brake }, marker, dot, brake, stand })

   set() is pure: every call sets every pose, colour and opacity from its argument (missing fields take their defaults).
     crank    radians, pedalling forward increases it (the cranks turn clockwise seen from +z). 0 = the +z pedal at the top.
              The chain travels crank x (chainring pitch radius): its top run moves towards the chainring. The sprocket
              (on a freewheel) always follows the chain: sprocket angle = 2 x crank (32 teeth / 16 teeth).
     wheel    back-wheel angle in radians (default 2 x crank), positive = rolling towards +x.
     front    front-wheel angle (default 0), same sign.      steer   handlebar/fork angle about the head tube (default 0;
              positive turns the front wheel towards -z, the rider's left).
     ghost    0..1 fades frame, saddle, handlebar, fork and front wheel (to 16 % at 1) so the drive train stands out. The
              brake parts fade with them unless brake > 0 or glow.brake > 0.
     glow.*   0..1 lights a part in its code colour: pedal (pedals + cranks, blue), ring (chainring, gold), chain (indigo),
              sprocket (gold), wheel (back tyre + rim, mint: the tyre itself stays dark at 0), brake (pads, orange; extra).
     marker   0..1 pops in the pink follow-me chain link (on the top run for crank 0 .. about 2.2).
     dot      0..1 pops in the pink dots: one on the back tyre (top of the wheel at wheel = 0), one on the +z pedal.
     brake    0..1 squeezes the lever on the +z grip; the two pads close on the back rim (touching at 1).
     stand    0..1 shows the workshop stand: it holds the back axle and lifts the BACK wheel by stand x info.lift (0.12).
              The front tyre stays on the ground, so the bike pitches by up to 2.75 degrees (pedals stay level).

   bike.userData.anchor = { pedal, ring, chainTop, sprocket, wheel, contact, brake, lever, saddle,   (as in docs/HTW3D.md)
                            marker, dot, front, bars }                                              (extras)
     Object3Ds that follow the parts (use L3.at(world, anchor.ring)); contact = where the back tyre meets the ground.
   bike.userData.info = key dimensions (wheel radius, axle and bottom-bracket positions, pitch radii, chain data ...).
   bike.userData.debug = { rollers, ring, sprocket } for the chain-seating test (out/kit/check_chain.js).

   Colour code: pedal + crank blue #3B82F6, toothed wheels gold #FFC233, chain indigo #4338CA, follow-me pink #FF4D8D,
   tyres dark, frame candy red. No DOM or THREE access at load time. */
(function (global) {
  const L = global.LSC; if (!L || !L.three) return;
  L.three.kits.bike = function (T, L3, opts) {
    opts = opts || {};
    const PI = Math.PI, V3 = (x, y, z) => new T.Vector3(x, y, z || 0);
    const clamp01 = v => Math.max(0, Math.min(1, +v || 0)), num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
    const ease = k => k * k * (3 - 2 * k);
    const C = { blue: '#3B82F6', gold: '#FFC233', chain: '#4338CA', pink: '#FF4D8D', red: opts.color || '#D81428', mint: '#34E0C2', pad: '#FF7A1A' };

    // ------------------------------------------------------------------ dimensions
    const RW = 0.84, WB = 2.5, AX = -WB / 2, FX = WB / 2, AY = RW, LIFT = 0.12;
    const p = 0.075, NB = 32, NA = 16, rB = NB * p / (2 * PI), rA = NA * p / (2 * PI), NL = 58, ZC = 0.16, BY = 0.78;
    const total = NL * p;
    const lenFor = d => { const b = Math.asin((rB - rA) / d); return 2 * Math.sqrt(d * d - (rB - rA) * (rB - rA)) + (PI + 2 * b) * rB + (PI - 2 * b) * rA; };
    let lo = 0.6, hi = 2; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (lenFor(mid) < total) lo = mid; else hi = mid; }
    const CS = (lo + hi) / 2, BX = AX + Math.sqrt(CS * CS - (AY - BY) * (AY - BY));
    const base = Math.atan2(BY - AY, BX - AX), beta = Math.asin((rB - rA) / CS), seg = Math.sqrt(CS * CS - (rB - rA) * (rB - rA));
    const arcB = (PI + 2 * beta) * rB, up = base + PI / 2 + beta, dn = base - PI / 2 - beta;
    // chain path: s = 0 at the top of the sprocket, along the top run to the chainring, round it, back along the lower run
    function chainPt(s, out) {
      s = ((s % total) + total) % total; let x, y;
      if (s < seg) { const k = s / seg, cu = Math.cos(up), su = Math.sin(up); x = AX + cu * rA + (BX + cu * rB - AX - cu * rA) * k; y = AY + su * rA + (BY + su * rB - AY - su * rA) * k; }
      else if ((s -= seg) < arcB) { const a = up - s / rB; x = BX + Math.cos(a) * rB; y = BY + Math.sin(a) * rB; }
      else if ((s -= arcB) < seg) { const k = s / seg, cd = Math.cos(dn), sd = Math.sin(dn); x = BX + cd * rB + (AX + cd * rA - BX - cd * rB) * k; y = BY + sd * rB + (AY + sd * rA - BY - sd * rB) * k; }
      else { const a = dn - (s - seg) / rA; x = AX + Math.cos(a) * rA; y = AY + Math.sin(a) * rA; }
      out[0] = x; out[1] = y; return out;
    }

    // ------------------------------------------------------------------ materials
    const ENV = L3.env();
    const std = (color, o) => { const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, metalness: 0 }, o || {})); m.envMap = ENV; m.envMapIntensity = m.metalness > 0.5 ? 1.15 : 0.45; return m; };
    const candy = (color, o) => { const m = new T.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1 }, o || {})); m.envMap = ENV; m.envMapIntensity = 0.75; return m; };
    // tyre texture: tread blocks in the middle, a cream line on each side wall (u goes round the wheel, v across the tyre)
    function tyreTex() {
      const w = 1024, h = 64, mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const c1 = mk(), g = c1.getContext('2d'), c2 = mk(), b = c2.getContext('2d');
      g.fillStyle = '#31343f'; g.fillRect(0, 0, w, h); b.fillStyle = '#9a9a9a'; b.fillRect(0, 0, w, h);
      for (const q of [g, b]) { q.lineCap = 'butt'; q.strokeStyle = q === g ? '#1b1d25' : '#202020'; q.lineWidth = 5;
        for (let i = 0; i < 64; i++) { const x = i * 16 + 8; q.beginPath(); q.moveTo(x - 6, 19); q.lineTo(x + 3, 32); q.lineTo(x - 6, 45); q.stroke(); }
        q.lineWidth = 2; q.beginPath(); q.moveTo(0, 18); q.lineTo(w, 18); q.moveTo(0, 46); q.lineTo(w, 46); q.stroke(); }
      g.fillStyle = '#F4E7C8'; g.fillRect(0, 7, w, 4); g.fillRect(0, 53, w, 4); b.fillStyle = '#c8c8c8'; b.fillRect(0, 6, w, 6); b.fillRect(0, 52, w, 6);
      const t1 = new T.CanvasTexture(c1); t1.colorSpace = T.SRGBColorSpace; const t2 = new T.CanvasTexture(c2);
      for (const t of [t1, t2]) { t.wrapS = T.RepeatWrapping; t.anisotropy = 4; }
      return [t1, t2];
    }
    const [tyMap, tyBump] = tyreTex();
    const tyreMat = () => { const m = std('#ffffff', { roughness: 0.8, map: tyMap, bumpMap: tyBump, bumpScale: 1.6 }); m.envMapIntensity = 0.25; return m; };
    const steelMat = () => std('#E6EAF0', { metalness: 0.9, roughness: 0.3 });
    // frame group (ghostable, set 0), brake group (ghostable, set 1), drive train (never ghosted)
    const GH = [[], []]; const gm = (m, set) => { m.userData.ghostSet = set || 0; GH[set || 0].push(m); return m; };
    const paint = gm(candy(C.red)), steelF = gm(steelMat()), tanF = gm(std('#B8713A', { roughness: 0.55 })), creamF = gm(candy('#FFF1D6', { roughness: 0.4 }));
    const tyreF = gm(tyreMat()), darkF = gm(std('#3a3f4c', { roughness: 0.5, metalness: 0.4 }));
    const brakeSteel = gm(steelMat(), 1), brakeBlack = gm(std('#2d3039', { roughness: 0.45 }), 1), padM = gm(std(C.pad, { roughness: 0.6 }), 1);
    const tyreR = tyreMat(), metalR = steelMat(), steelD = std('#AEB5C2', { metalness: 1, roughness: 0.3 });
    const crankM = candy(C.blue), ringM = candy(C.gold, { metalness: 0.25, roughness: 0.3 }), sprM = candy(C.gold, { metalness: 0.25, roughness: 0.3 });
    const plateM = candy(C.chain, { roughness: 0.3 }), rollM = std('#D6D3FF', { metalness: 0.35, roughness: 0.3 });
    const pinkM = candy(C.pink, { emissive: C.pink, emissiveIntensity: 0.3 }), whiteM = candy('#ffffff'), yellowM = std('#FFD84A', { roughness: 0.35, emissive: '#FFB800', emissiveIntensity: 0.2 });
    const woodM = std('#D9A566', { roughness: 0.6 }), woodD = std('#B37A3F', { roughness: 0.6 }), tealM = candy('#22A7A0');
    const depthM = new T.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

    // ------------------------------------------------------------------ geometry helpers
    const Y = V3(0, 1, 0), M4 = new T.Matrix4(), Q = new T.Quaternion(), ONE = V3(1, 1, 1);
    const xf = (g, px, py, pz, rx, ry, rz) => { Q.setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)); g.applyMatrix4(M4.compose(V3(px || 0, py || 0, pz || 0), Q, ONE)); return g; };
    const cyl = (a, b, r, sg, r2) => { const d = b.clone().sub(a), g = new T.CylinderGeometry(r2 == null ? r : r2, r, d.length(), sg || 18); Q.setFromUnitVectors(Y, d.clone().normalize()); g.applyMatrix4(M4.compose(a.clone().add(b).multiplyScalar(0.5), Q, ONE)); return g; };
    const zcyl = (r, len, sg, x, y, z) => { const g = new T.CylinderGeometry(r, r, len, sg || 20); g.rotateX(PI / 2); g.translate(x || 0, y || 0, z || 0); return g; };
    const ball = (c, r) => { const g = new T.SphereGeometry(r, 18, 12); g.translate(c.x, c.y, c.z); return g; };
    const curve = (pts, r, n, sg) => new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.5), n || 28, r, sg || 12, false);
    // ext(..., inset = true): the outline is the widest section (the chamfer is cut into it), so tooth valleys keep their exact size
    const ext = (shape, depth, bev, bs, cs, inset) => { const g = new T.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: inset ? -bev : 0, bevelSegments: bs || 2, curveSegments: cs || 12 }); g.translate(0, 0, -(depth - 2 * bev) / 2); return g; };
    const rbox = (w, h, d, r) => { r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4); const s = new T.Shape(), x = w / 2 - r, y = h / 2 - r; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y); return ext(s, d, r, 3); };
    const lathe = (pts, sg) => { const g = new T.LatheGeometry(pts.map(q => new T.Vector2(q[0], q[1])), sg || 72); g.rotateX(PI / 2); return g; }; // axis along z
    function merge(list) {
      let n = 0; const parts = list.map(g => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return q; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let k = 0;
      for (const q of parts) { pos.set(q.attributes.position.array, k * 3); nor.set(q.attributes.normal.array, k * 3); if (q.attributes.uv) uv.set(q.attributes.uv.array, k * 2); k += q.attributes.position.count; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g;
    }
    // static geometry is collected per (group, material) and merged into one mesh each (the renderer is CPU-only)
    const bins = [], ghostMeshes = [[], []], ghostTwins = [[], []];
    const put = (group, mat, geo) => { let e = bins.find(b => b.group === group && b.mat === mat); if (!e) bins.push(e = { group, mat, list: [] }); e.list.push(geo); return geo; };
    function flush() {
      for (const e of bins) { const geo = e.list.length === 1 && !e.list[0].index ? e.list[0] : merge(e.list); const m = new T.Mesh(geo, e.mat); m.castShadow = m.receiveShadow = true; e.group.add(m);
        const gs = e.mat.userData.ghostSet; if (gs != null) { ghostMeshes[gs].push(m); const tw = new T.Mesh(geo, depthM); tw.renderOrder = 1; tw.visible = false; e.group.add(tw); ghostTwins[gs].push(tw); } }
      bins.length = 0;
    }
    // toothed wheel: N teeth; the roller centres sit on the pitch circle r, in round valleys centred on the angles k * 2 pi / N
    function gearGeo(N, r, o) {
      const st = 2 * PI / N, pts = [], tipR = r + o.tip;
      for (let i = 0; i < N; i++) { const a = i * st, cx = r * Math.cos(a), cy = r * Math.sin(a);
        for (let j = 0; j <= 8; j++) { const an = a + PI + (100 - j * 25) * PI / 180; pts.push(new T.Vector2(cx + o.seat * Math.cos(an), cy + o.seat * Math.sin(an))); }
        for (const sg of [-1, 1]) { const an = (i + 0.5) * st + sg * o.tipHalf / tipR; pts.push(new T.Vector2(tipR * Math.cos(an), tipR * Math.sin(an))); } }
      const s = new T.Shape(pts); for (const [hx, hy, hr] of o.holes || []) { const h = new T.Path(); h.absarc(hx, hy, hr, 0, PI * 2, true); s.holes.push(h); }
      return ext(s, o.thick, 0.004, 1, 20, true);
    }
    const ringHoles = (n, rad, hr, a0) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * 2 * PI + (a0 || 0)) * rad, Math.sin(i / n * 2 * PI + (a0 || 0)) * rad, hr]);

    // ------------------------------------------------------------------ scene graph
    const g = new T.Group(), U = g.userData;
    const rig = new T.Group(); g.add(rig);                       // pitches about the front tyre's contact point (stand)
    const body = new T.Group(); body.position.set(-FX, 0, 0); rig.add(body);   // bike coordinates (ground y = 0)
    const A = {}; const anchor = (name, parent, x, y, z) => { const o = new T.Object3D(); o.position.set(x, y, z); parent.add(o); A[name] = o; return o; };

    // ---- wheels
    const RC = RW - 0.075;   // centre of the tyre's cross-section
    function buildWheel(grp, tyM, meM) {
      const prof = []; for (let i = 0; i <= 20; i++) { const a = (-150 + i * 15) * PI / 180; prof.push([RC + 0.075 * Math.cos(a) * (1 - 0.06 * Math.cos(a) * Math.cos(a)) / 0.94, 0.072 * Math.sin(a)]); }
      put(grp, tyM, lathe(prof, 96));
      put(grp, meM, lathe([[0.706, -0.05], [0.662, -0.05], [0.646, -0.024], [0.646, 0.024], [0.662, 0.05], [0.706, 0.05], [0.712, 0.042], [0.7, 0.03]], 72));
      for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI, z = i % 2 ? 0.07 : -0.07, tw = (i % 4 < 2 ? 1 : -1) * 0.42; put(grp, meM, cyl(V3(Math.cos(a + tw) * 0.062, Math.sin(a + tw) * 0.062, z), V3(Math.cos(a) * 0.65, Math.sin(a) * 0.65, z * 0.15), 0.0065, 5)); }
      put(grp, meM, zcyl(0.042, 0.17, 20)); for (const z of [-1, 1]) put(grp, meM, zcyl(0.075, 0.012, 24, 0, 0, z * 0.07));
      put(grp, meM, cyl(V3(0.646, 0, 0), V3(0.58, 0, 0), 0.009, 6));   // valve
    }
    const rear = new T.Group(); rear.position.set(AX, AY, 0); body.add(rear); buildWheel(rear, tyreR, metalR);
    // painted dots on the back tyre (both sides)
    const dotW = new T.Group(); rear.add(dotW); for (const z of [-1, 1]) { const d1 = new T.SphereGeometry(0.085, 20, 12); d1.scale(1, 1, 0.3); d1.translate(0, RC, z * 0.068); put(dotW, pinkM, d1); const d2 = new T.SphereGeometry(0.04, 14, 10); d2.scale(1, 1, 0.3); d2.translate(0, RC, z * 0.09); put(dotW, whiteM, d2); }
    anchor('dot', rear, 0, RC, 0.09);

    // ---- frame (static part)
    const BB = V3(BX, BY), AXL = V3(AX, AY), FAX = V3(FX, AY);
    const hu = V3(-Math.sin(20 * PI / 180), Math.cos(20 * PI / 180)), hn = V3(hu.y, -hu.x);    // steering axis (up) and its forward normal
    const along = (o, d, k) => o.clone().addScaledVector(d, k);
    const CB = along(along(FAX, hn, -0.1), hu, 0.97);          // fork crown, on the steering axis
    const HTB = along(CB, hu, 0.05), HTT = along(CB, hu, 0.46);
    const sd = V3(-Math.cos(73 * PI / 180), Math.sin(73 * PI / 180)), SC = along(BB, sd, 1.02);   // seat tube direction, seat cluster
    const TT1 = along(CB, hu, 0.38), TT2 = along(BB, sd, 0.93), DT1 = along(CB, hu, 0.13);
    put(body, paint, cyl(HTB, HTT, 0.064, 24)); for (const k of [0.05, 0.46]) put(body, steelF, cyl(along(CB, hu, k - 0.012), along(CB, hu, k + 0.012), 0.07, 24));
    put(body, paint, cyl(BB, SC, 0.05, 20)); put(body, paint, cyl(TT1, TT2, 0.046, 20)); put(body, paint, cyl(DT1, BB, 0.056, 20));
    put(body, paint, zcyl(0.074, 0.26, 24, BX, BY, 0)); for (const z of [-1, 1]) put(body, steelF, zcyl(0.06, 0.012, 20, BX, BY, z * 0.136));
    put(body, steelF, cyl(along(BB, sd, 1.0), along(BB, sd, 1.035), 0.057, 20));                 // seat clamp collar
    put(body, creamF, cyl(along(BB, sd, 0.42), along(BB, sd, 0.6), 0.0515, 20));                 // cream panel on the seat tube
    put(body, creamF, cyl(along(DT1, BB.clone().sub(DT1).normalize(), 0.3), along(DT1, BB.clone().sub(DT1).normalize(), 0.72), 0.0575, 20));
    { const b = new T.SphereGeometry(0.04, 16, 10); b.scale(0.5, 1, 1); const c = along(along(CB, hu, 0.26), hn, 0.058); xf(b, c.x, c.y, 0, 0, 0, 20 * PI / 180); put(body, steelF, b); }   // head badge
    // stays: smooth S-bends that clear the tyre, the chainring and the chain
    const csDir = AXL.clone().sub(BB).normalize(), ssDir = SC.clone().sub(AXL).normalize(), SSL = SC.distanceTo(AXL) - 0.07;
    const ZD = 0.106;   // dropouts: the stays run INSIDE the chain line, so nothing of the frame covers the drive train
    const csPts = z => [[0, 0.1], [0.4, ZD], [CS - 0.3, ZD], [CS, ZD]].map(q => { const v = along(BB, csDir, q[0]); v.z = z * q[1]; return v; });
    const ssPts = z => [[0, ZD], [0.3, ZD], [0.72, ZD - 0.004], [0.98, 0.085], [SSL, 0.05]].map(q => { const v = along(AXL, ssDir, q[0]); v.z = z * q[1]; return v; });
    const ssCurve = new T.CatmullRomCurve3(ssPts(1), false, 'catmullrom', 0.5);
    for (const z of [-1, 1]) {
      put(body, paint, curve(csPts(z), 0.027, 36, 12)); put(body, paint, curve(ssPts(z), 0.022, 36, 12));
      put(body, paint, zcyl(0.062, 0.026, 20, AX, AY, z * ZD)); if (z < 0) put(body, steelF, new T.CylinderGeometry(0.036, 0.036, 0.026, 6).rotateX(PI / 2).translate(AX, AY, z * (ZD + 0.026)));
    }
    put(body, steelF, zcyl(0.018, 0.42, 10, AX, AY, 0.01));
    // brake bridge between the seat stays (above the tyre)
    const bridgeP = ssCurve.getPoint(0.86); put(body, paint, cyl(V3(bridgeP.x, bridgeP.y, -bridgeP.z), bridgeP, 0.016, 10));
    // seat post + saddle
    const SP = along(BB, sd, 1.22); put(body, steelF, cyl(along(BB, sd, 0.98), SP, 0.03, 16));
    (function () {
      const sg = new T.SphereGeometry(1, 30, 20); sg.rotateZ(PI / 2); const P = sg.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (x + 1) / 2, k = clamp01((t - 0.3) / 0.5), w = 0.185 + (0.055 - 0.185) * ease(k);
        const top = y > 0 ? Math.pow(y, 0.55) * 0.045 : -Math.pow(-y, 0.6) * 0.085 * (1 - 0.55 * t); P.setXYZ(i, x * 0.34, top + 0.075 * (1 - t) * (1 - t) - 0.016 * Math.sin(t * PI) - 0.02 * t * t, z * w * (1 - 0.3 * Math.max(0, -y))); }
      sg.computeVertexNormals(); xf(sg, SP.x + 0.02, SP.y + 0.085, 0, 0, 0, -0.03); put(body, tanF, sg);
      put(body, steelF, rbox(0.12, 0.05, 0.07, 0.015).translate(SP.x, SP.y + 0.01, 0));
    })();
    anchor('saddle', body, SP.x, SP.y + 0.15, 0);

    // ---- steering assembly (fork, front wheel, stem, handlebar, grips, bell, brake lever)
    const pivot = new T.Group(); pivot.position.copy(CB); pivot.rotation.z = 20 * PI / 180; body.add(pivot);
    const steerG = new T.Group(); pivot.add(steerG);
    const SG = new T.Group(); pivot.updateMatrix(); SG.matrix.copy(pivot.matrix).invert(); SG.matrix.decompose(SG.position, SG.quaternion, SG.scale); steerG.add(SG);   // children of SG are in bike coordinates
    put(SG, paint, rbox(0.11, 0.075, 0.3, 0.03).applyMatrix4(M4.compose(CB.clone(), Q.setFromEuler(new T.Euler(0, 0, 20 * PI / 180)), ONE)));
    for (const z of [-1, 1]) { const pts = [[0, 0, 0.115], [0.3, 0, 0.118], [0.62, 0.012, 0.125], [0.85, 0.05, 0.128]].map(q => { const v = along(along(CB, hu, -q[0]), hn, q[1]); v.z = z * q[2]; return v; }); pts.push(V3(FX, AY, z * 0.128));
      put(SG, paint, curve(pts, 0.03, 30, 12)); put(SG, paint, zcyl(0.05, 0.024, 18, FX, AY, z * 0.128)); put(SG, steelF, new T.CylinderGeometry(0.032, 0.032, 0.024, 6).rotateX(PI / 2).translate(FX, AY, z * 0.152)); }
    put(SG, steelF, zcyl(0.016, 0.34, 10, FX, AY, 0));
    const front = new T.Group(); front.position.set(FX, AY, 0); SG.add(front); buildWheel(front, tyreF, steelF);
    anchor('front', SG, FX, AY, 0.1);
    const STT = along(CB, hu, 0.66), KC = along(STT, hn, 0.09);            // stem top, bar clamp
    put(SG, steelF, cyl(along(CB, hu, 0.47), STT, 0.03, 16)); put(SG, steelF, ball(STT, 0.03)); put(SG, steelF, cyl(STT, KC, 0.027, 14)); put(SG, steelF, zcyl(0.04, 0.09, 18, KC.x, KC.y, 0));
    const barEnd = z => V3(KC.x - 0.2, KC.y + 0.2, z * 0.56), barIn = z => V3(KC.x - 0.145, KC.y + 0.2, z * 0.37);
    put(SG, steelF, curve([barEnd(-1), barIn(-1), V3(KC.x - 0.04, KC.y + 0.1, -0.2), V3(KC.x, KC.y, -0.06), V3(KC.x, KC.y, 0.06), V3(KC.x - 0.04, KC.y + 0.1, 0.2), barIn(1), barEnd(1)], 0.023, 64, 12));
    for (const z of [-1, 1]) { const a = barIn(z), b = barEnd(z), d = b.clone().sub(a).normalize();
      put(SG, tanF, cyl(along(a, d, 0.01), b, 0.036, 18)); put(SG, tanF, cyl(along(a, d, 0.0), along(a, d, 0.022), 0.047, 18)); put(SG, tanF, cyl(along(b, d, -0.012), along(b, d, 0.012), 0.045, 18)); put(SG, tanF, ball(along(b, d, 0.01), 0.04));
      for (let i = 1; i < 5; i++) put(SG, tanF, cyl(along(a, d, 0.035 * i + 0.01), along(a, d, 0.035 * i + 0.022), 0.0395, 18)); }
    { const bp = V3(KC.x - 0.075, KC.y + 0.145, -0.27); const dome = new T.SphereGeometry(0.058, 20, 10, 0, PI * 2, 0, PI / 2); dome.translate(bp.x, bp.y + 0.035, bp.z); put(SG, steelF, dome); put(SG, darkF, cyl(bp, V3(bp.x, bp.y + 0.04, bp.z), 0.03, 12)); }   // bell
    anchor('bars', SG, KC.x - 0.1, KC.y + 0.2, 0);
    // brake lever on the +z grip: clamp (static) + blade (pivots towards the grip)
    const gd = barEnd(1).sub(barIn(1)).normalize(), LP = along(barIn(1), gd, -0.05).add(V3(0.055, -0.012, 0));   // lever pivot
    put(SG, brakeBlack, cyl(along(barIn(1), gd, -0.075), along(barIn(1), gd, -0.02), 0.034, 16)); put(SG, brakeBlack, rbox(0.085, 0.04, 0.05, 0.012).translate(LP.x - 0.025, LP.y, LP.z));
    const leverG = new T.Group(); leverG.position.copy(LP); SG.add(leverG); const leverYaw = Math.atan2(gd.x, gd.z);
    put(leverG, brakeSteel, curve([V3(0, 0, 0), V3(0.04, -0.004, 0.05), V3(0.06, -0.008, 0.15), V3(0.05, -0.012, 0.27)], 0.015, 20, 10)); put(leverG, brakeSteel, ball(V3(0.05, -0.012, 0.27), 0.024)); put(leverG, brakeSteel, new T.CylinderGeometry(0.02, 0.02, 0.05, 12));
    anchor('lever', leverG, 0.04, 0, 0.15);
    // brake cable: lever -> round the front -> top tube (on the steering assembly), then under the top tube to the seat cluster
    const ttd = TT2.clone().sub(TT1).normalize(), cab = k => along(TT1, ttd, k).add(V3(0, -0.058, 0.02));
    put(SG, brakeBlack, curve([V3(LP.x - 0.03, LP.y, LP.z - 0.02), V3(LP.x + 0.06, LP.y - 0.05, LP.z - 0.12), V3(KC.x + 0.16, KC.y - 0.06, 0.16), V3(KC.x + 0.1, KC.y - 0.28, 0.06), cab(0.1)], 0.009, 40, 6));
    const cabStop = along(SC, ssDir, -0.04).add(V3(-0.065, 0.0, 0));
    put(body, brakeBlack, curve([cab(0.1), cab(0.4), cab(0.72), along(TT2, ttd, -0.1).add(V3(0, -0.07, 0.05)), along(BB, sd, 0.9).add(V3(-0.005, 0, 0.066)), along(cabStop, V3(0.6, 0.3, 0).normalize(), 0.045).add(V3(0, 0, 0.04)), cabStop], 0.009, 40, 6)); put(body, brakeSteel, ball(cabStop, 0.016));

    // ---- rim brake on the back wheel: two arms pivoting on seat-stay bosses, pads beside the rim
    let tb = 0.3; for (let i = 0; i < 400; i++) { tb = i / 400; if (ssCurve.getPoint(tb).distanceTo(V3(AX, AY, ssCurve.getPoint(tb).z)) >= 0.6) break; }
    const boss = ssCurve.getPoint(tb), calG = new T.Group(); calG.position.set(boss.x, boss.y, 0); calG.rotation.z = Math.atan2(ssDir.y, ssDir.x) - PI / 2; body.add(calG);   // local +y runs up the seat stay
    const PADY = 0.683 - 0.6, GAP = 0.03, PADZ = 0.05 + GAP, ARMPHI = Math.asin(GAP / PADY), AO = 0.042, ARMTOP = [0.34, 0.05], YOKE0 = 0.5, CXO = -0.06;
    const arms = [], padGs = [];
    for (const z of [-1, 1]) { const ag = new T.Group(); ag.position.set(CXO, 0, z * boss.z); calG.add(ag); arms.push(ag);
      put(calG, brakeSteel, zcyl(0.02, 0.075, 12, CXO, 0, z * (boss.z + 0.022))); put(calG, paint, cyl(V3(0, 0, z * boss.z), V3(CXO, 0, z * boss.z), 0.017, 10));
      put(ag, brakeSteel, curve([V3(0, 0, z * AO), V3(0, PADY, z * AO), V3(0, 0.2, z * (AO + 0.01)), V3(0, ARMTOP[0], z * ARMTOP[1])], 0.018, 16, 10)); put(ag, brakeSteel, ball(V3(0, ARMTOP[0], z * ARMTOP[1]), 0.026)); put(ag, brakeSteel, ball(V3(0, 0, z * AO), 0.022));
      const pg = new T.Group(); pg.position.set(0, PADY, 0); ag.add(pg); padGs.push(pg);
      put(pg, padM, rbox(0.19, 0.06, 0.032, 0.014).translate(0, 0, z * (PADZ + 0.016 - boss.z)));
      put(pg, brakeSteel, zcyl(0.012, boss.z + AO - PADZ - 0.03, 8, 0, 0, z * ((PADZ + 0.03 + boss.z + AO) / 2 - boss.z))); }
    anchor('brake', calG, CXO, PADY, 0.1);
    const wireG = new T.CylinderGeometry(0.008, 0.008, 1, 6), wires = [0, 1, 2].map(() => { const m = new T.Mesh(wireG, brakeSteel); m.castShadow = true; calG.add(m); ghostMeshes[1].push(m); return m; });
    const yoke = new T.Mesh(new T.SphereGeometry(0.02, 12, 8), brakeSteel); yoke.castShadow = true; calG.add(yoke); ghostMeshes[1].push(yoke);
    calG.updateMatrix(); const stopL = cabStop.clone().applyMatrix4(M4.copy(calG.matrix).invert());
    const va = V3(), vb = V3(), vd = V3();
    const wire = (m, a, b) => { vd.subVectors(b, a); const len = vd.length(); m.position.addVectors(a, b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y, vd.divideScalar(len)); m.scale.set(1, len, 1); };

    // ---- crank set: chainring (32 teeth), cranks, pedals
    const crankG = new T.Group(); crankG.position.set(BX, BY, 0); body.add(crankG);
    const TOOTH = { seat: 0.0225, tip: 0.031, tipHalf: 0.005, thick: 0.03 };
    const ring = new T.Mesh(gearGeo(NB, rB, Object.assign({ holes: ringHoles(5, 0.215, 0.082, PI / 2 + PI / 5) }, TOOTH)), ringM); ring.position.z = ZC; ring.rotation.z = up + seg / rB; ring.castShadow = ring.receiveShadow = true; crankG.add(ring);
    put(crankG, crankM, zcyl(0.105, 0.03, 28, 0, 0, ZC + 0.012)); put(crankG, steelD, zcyl(0.03, 0.56, 12)); put(crankG, steelD, zcyl(0.045, 0.012, 16, 0, 0, 0.26));
    const CL = 0.42, ZARM = 0.235, ZPED = 0.378, pedals = [];
    for (const s of [1, -1]) {
      const pts = []; for (let i = 0; i <= 12; i++) { const a = PI + i / 12 * PI; pts.push(new T.Vector2(0.06 * Math.cos(a), 0.06 * Math.sin(a))); } for (let i = 0; i <= 12; i++) { const a = i / 12 * PI; pts.push(new T.Vector2(0.04 * Math.cos(a), CL + 0.04 * Math.sin(a))); }
      put(crankG, crankM, xf(ext(new T.Shape(pts), 0.035, 0.008, 2), 0, 0, s * ZARM, 0, 0, s > 0 ? 0 : PI));
      put(crankG, steelD, zcyl(0.024, 0.012, 12, 0, s * CL, s * (ZARM + 0.02)));
      const pd = new T.Group(); pd.position.set(0, s * CL, s * ZPED); crankG.add(pd); pedals.push(pd);
      put(pd, crankM, rbox(0.26, 0.058, 0.19, 0.022)); for (const x of [-1, 1]) put(pd, yellowM, rbox(0.022, 0.034, 0.12, 0.008).translate(x * 0.124, 0, 0));
      for (const x of [-0.075, 0, 0.075]) for (const y of [-1, 1]) put(pd, whiteM, rbox(0.03, 0.016, 0.15, 0.006).translate(x, y * 0.027, 0));
      put(pd, steelD, zcyl(0.017, 0.07, 10, 0, 0, -s * 0.115));
    }
    const dotP = new T.Group(); dotP.position.set(0, 0, 0.096); pedals[0].add(dotP);
    { const d1 = new T.SphereGeometry(0.05, 18, 10); d1.scale(1.6, 0.55, 0.3); put(dotP, pinkM, d1); const d2 = new T.SphereGeometry(0.02, 12, 8); d2.scale(1.6, 0.6, 0.3); d2.translate(0, 0, 0.012); put(dotP, whiteM, d2); }
    anchor('pedal', pedals[0], 0, 0, 0.1);
    anchor('ring', body, BX, BY, ZC + 0.03);

    // ---- sprocket (16 teeth) on a freewheel: it follows the chain; the wheel has its own angle
    const sprG = new T.Group(); sprG.position.set(AX, AY, 0); body.add(sprG);
    const spr = new T.Mesh(gearGeo(NA, rA, Object.assign({ holes: ringHoles(4, 0.115, 0.034, PI / 4) }, TOOTH)), sprM); spr.position.z = ZC; spr.castShadow = spr.receiveShadow = true; sprG.add(spr);
    put(sprG, sprM, zcyl(0.06, 0.07, 20, 0, 0, ZC + 0.0)); put(sprG, steelD, new T.CylinderGeometry(0.036, 0.036, 0.024, 6).rotateX(PI / 2).translate(0, 0, ZC + 0.047));
    const sprPhase = dn + (2 * seg + arcB) / rA;
    anchor('sprocket', body, AX, AY, ZC + 0.03); anchor('wheel', body, AX, AY, 0.1); anchor('contact', body, AX, 0, 0);
    { const q = chainPt(seg / 2, [0, 0]); anchor('chainTop', body, q[0], q[1], ZC); }

    // ---- chain: NL rollers with pins, inner and outer plate pairs (alternating links), and the pink follow-me link
    const plateShape = (re, w) => { const pts = []; for (let i = 0; i <= 10; i++) { const a = (-105 + i * 21) * PI / 180; pts.push(new T.Vector2(p / 2 + re * Math.cos(a), re * Math.sin(a))); } pts.push(new T.Vector2(0, w)); for (let i = 0; i <= 10; i++) { const a = (75 + i * 21) * PI / 180; pts.push(new T.Vector2(-p / 2 + re * Math.cos(a), re * Math.sin(a))); } pts.push(new T.Vector2(0, -w)); return new T.Shape(pts); };
    const plateOne = () => ext(plateShape(0.0205, 0.0135), 0.008, 0.0015, 1);
    const innerG = merge([plateOne().translate(0, 0, 0.025), plateOne().translate(0, 0, -0.025)]), outerG = merge([plateOne().translate(0, 0, 0.0345), plateOne().translate(0, 0, -0.0345)]);
    const rollG = merge([zcyl(0.0212, 0.04, 12), zcyl(0.0085, 0.086, 8)]);
    const NH = NL / 2, rollI = new T.InstancedMesh(rollG, rollM, NL), innerI = new T.InstancedMesh(innerG, plateM, NH), outerI = new T.InstancedMesh(outerG, plateM, NH);
    for (const im of [rollI, innerI, outerI]) { im.castShadow = im.receiveShadow = true; im.frustumCulled = false; body.add(im); }
    const FOLLOW = 4, hot = new T.Group(); body.add(hot);
    { const big = () => ext(plateShape(0.034, 0.03), 0.012, 0.003, 1); put(hot, pinkM, big().translate(0, 0, 0.046)); put(hot, pinkM, big().translate(0, 0, -0.046)); for (const x of [-1, 1]) put(hot, whiteM, zcyl(0.014, 0.112, 12, x * p / 2, 0, 0)); }
    anchor('marker', hot, 0, 0, 0.06);

    // ---- workshop stand (one-sided, behind the wheel so the drive train stays in clear view): holds the -z end of the back axle
    const standG = new T.Group(); g.add(standG); const SH = AY + LIFT;
    put(standG, woodD, rbox(1.0, 0.05, 0.84, 0.02).translate(0, 0.025, -0.2)); put(standG, woodM, rbox(0.1, SH + 0.02, 0.1, 0.025).translate(0, (SH + 0.07) / 2 + 0.02, -0.46));
    put(standG, woodM, cyl(V3(-0.36, 0.05, -0.46), V3(-0.03, SH * 0.62, -0.46), 0.032, 10)); put(standG, woodM, cyl(V3(0.36, 0.05, -0.46), V3(0.03, SH * 0.62, -0.46), 0.032, 10));
    put(standG, tealM, rbox(0.17, 0.15, 0.13, 0.035).translate(0, SH, -0.45)); put(standG, steelD, zcyl(0.04, 0.24, 16, 0, SH, -0.285)); put(standG, tealM, zcyl(0.05, 0.03, 16, 0, SH, -0.385));
    for (const x of [-0.42, 0.42]) for (const z of [-0.55, 0.15]) put(standG, tealM, zcyl(0.028, 0.03, 12, x, 0.055, z));

    flush();

    // ------------------------------------------------------------------ pose
    const D = new T.Object3D(), P = []; for (let k = 0; k < NL; k++) P.push([0, 0]);
    const col = (m, hex, lightHex) => ({ m, c0: new T.Color(hex), c1: new T.Color(lightHex) });
    const GLOW = {
      pedal: { parts: [col(crankM, C.blue, '#5AA2FF')], e: new T.Color('#1463FF'), k: 1.25 },
      ring: { parts: [col(ringM, C.gold, '#FFD83A')], e: new T.Color('#FF9A00'), k: 1.05, base: 0.14 },
      sprocket: { parts: [col(sprM, C.gold, '#FFD83A')], e: new T.Color('#FF9A00'), k: 1.05, base: 0.14 },
      chain: { parts: [col(plateM, C.chain, '#6A58FF'), col(rollM, '#D6D3FF', '#FFFFFF')], e: new T.Color('#4630FF'), k: 1.5 },
      wheel: { parts: [col(tyreR, '#ffffff', '#ffffff'), col(metalR, '#DDE2EA', '#E9FFFA')], e: new T.Color(C.mint), k: 0.5 },
      brake: { parts: [col(padM, C.pad, '#FFB05A')], e: new T.Color('#FF6A00'), k: 0.8 }
    };
    function setGhost(set, gh) {
      const on = gh > 0.001, op = 1 - 0.84 * gh;
      for (const m of GH[set]) { if (m.transparent !== on) { m.transparent = on; m.needsUpdate = true; } m.opacity = on ? op : 1; m.depthWrite = !on; }
      for (const m of ghostMeshes[set]) { m.renderOrder = on ? 2 : 0; m.castShadow = gh < 0.5; } for (const t of ghostTwins[set]) t.visible = on;
    }
    U.set = function (o) {
      o = o || {}; const crank = num(o.crank, 0), wheel = num(o.wheel, 2 * crank), frontA = num(o.front, 0), steer = num(o.steer, 0);
      const ghost = clamp01(o.ghost), marker = clamp01(o.marker), dot = clamp01(o.dot), brake = clamp01(o.brake), stand = clamp01(o.stand), gl = o.glow || {};
      // stand: the back axle rises, the bike pitches about the front contact point
      const sp = -stand * LIFT / WB, phi = Math.asin(sp), cp = Math.cos(phi);
      rig.position.set(FX + RW * sp, RW * (1 - cp), 0); rig.rotation.z = phi;
      standG.visible = stand > 0.001; if (standG.visible) { const k = ease(Math.min(1, stand * 2.5)); standG.position.set(FX - WB * cp, 0, 0); standG.scale.set(k, (AY + stand * LIFT) / SH, k); }
      // rotations (clockwise seen from +z = rolling towards +x)
      crankG.rotation.z = -crank; for (const pd of pedals) pd.rotation.z = crank - phi;
      rear.rotation.z = -wheel; sprG.rotation.z = sprPhase - crank * rB / rA; front.rotation.z = -frontA; steerG.rotation.y = steer;
      // chain
      const s0 = crank * rB; D.rotation.set(0, 0, 0); D.scale.set(1, 1, 1);
      for (let k = 0; k < NL; k++) { const q = chainPt(k * p + s0, P[k]); D.position.set(q[0], q[1], ZC); D.updateMatrix(); rollI.setMatrixAt(k, D.matrix); }
      for (let k = 0; k < NL; k++) { const a = P[k], b = P[(k + 1) % NL]; D.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ZC); D.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); D.updateMatrix(); (k % 2 ? innerI : outerI).setMatrixAt(k >> 1, D.matrix);
        if (k === FOLLOW) { hot.position.copy(D.position); hot.rotation.z = D.rotation.z; } }
      rollI.instanceMatrix.needsUpdate = innerI.instanceMatrix.needsUpdate = outerI.instanceMatrix.needsUpdate = true;
      hot.visible = marker > 0.001; hot.scale.setScalar(0.35 + 0.65 * ease(marker));
      const dk = Math.max(0.001, ease(dot)); dotW.visible = dotP.visible = dot > 0.001; dotP.scale.setScalar(dk);
      for (const c of dotW.children) { c.position.set(0, RC * (1 - dk), 0); c.scale.setScalar(dk); }   // each dot grows about its own centre on the tyre
      // brake: lever, arms, pads, wires
      leverG.rotation.set(0, leverYaw - brake * 0.3, 0);
      const ya = YOKE0 + 0.035 * brake; va.set(CXO, ya, 0); yoke.position.copy(va);
      for (let i = 0; i < 2; i++) { const z = i ? 1 : -1, a = -z * ARMPHI * brake; arms[i].rotation.x = a; padGs[i].rotation.x = -a;
        vb.set(CXO, ARMTOP[0] * Math.cos(a) - z * ARMTOP[1] * Math.sin(a), z * boss.z + ARMTOP[0] * Math.sin(a) + z * ARMTOP[1] * Math.cos(a)); wire(wires[i], va, vb); }
      wire(wires[2], va, stopL);
      // ghosting
      setGhost(0, ghost); setGhost(1, ghost * (1 - Math.max(clamp01(brake / 0.15), clamp01(gl.brake))));
      // glow: emissive lift in the code colour + a lighter body colour (the shading stays, so the part keeps its shape)
      for (const name in GLOW) { const G = GLOW[name], v = clamp01(gl[name]); for (const q of G.parts) { q.m.color.copy(q.c0).lerp(q.c1, 0.55 * v); q.m.emissive.copy(G.e); q.m.emissiveIntensity = (G.base || 0) + (G.k - (G.base || 0)) * v; } }
      return g;
    };
    U.anchor = A;
    U.info = { wheelRadius: RW, wheelbase: WB, rearAxle: [AX, AY, 0], frontAxle: [FX, AY, 0], bottomBracket: [BX, BY, 0], chainZ: ZC, ringTeeth: NB, sprocketTeeth: NA, ringPitchRadius: rB, sprocketPitchRadius: rA,
      pitch: p, links: NL, chainstay: CS, topRun: seg, crankLength: CL, lift: LIFT, length: WB + 2 * RW, height: KC.y + 0.24, saddleY: SP.y + 0.14, seatRadius: TOOTH.seat, followLink: FOLLOW,
      chainPoint: (k, crank) => chainPt(k * p + crank * rB, [0, 0]) };
    U.debug = { rollers: rollI, ring, sprocket: spr };
    U.set({});
    return g;
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Rainbow Curie in 3D ("How things work", theme "Curie's Toy Workshop").
   L.three.kits.curie(T, L3) -> Group. She faces +z at rotation 0, feet on y = 0 at her origin, about 2.9 units tall at s = 1.

   group.userData.pose(o, t) sets EVERYTHING from its arguments (pure function of (o, t), nothing is remembered):
     o = { x = 0, y = 0, z = 0, ry = 0, s = 1,
           mood = 'happy' | 'talk' | 'think' | 'wow' | 'sad' | 'wink',
           armL = 0, armR = 0,     radians: 0 hangs by her side, 1.2 points sideways/forward, 2.6 straight up (cheer).
                                   armL is HER left arm (+x in her own frame: screen right when she faces the camera)
           lookX = 0, lookY = 0,   -1..1: pupils look towards her +x / up
           bulb = 0.4,             0..1: antenna bulb glow (0 = lamp off, still yellow)
           goggles = 0,            0..1: Peek-Inside Goggles pop down from the forehead onto her eyes (hidden at 0)
           bob = 1,                idle bounce amount (0 = perfectly still)
           squash = 0,             > 0 squashes (shorter and wider), < 0 stretches; about -0.4..0.4
           blink }                 optional 0..1: force the eyelids (added to the automatic blink)
     t = time in seconds: drives the blink (every 3.7 s, 0.15 s long, first at t = 2.6), the idle bounce and the 'talk' mouth.
   group.userData.anchor = { bulb, handL, handR, mouth, top }: Object3Ds for labels (L3.at(world, anchor.bulb)).
   group.userData.BLINK = { every, length, first }. */
(function (global) {
  const L = global.LSC; if (!L || !L.three) return;
  L.three.kits.curie = function (T, L3) {
    const P = Math.PI, g = new T.Group(), U = g.userData, env = L3.env();
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, v) => { v = clamp((v - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };
    const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
    const mesh = (geo, m, x, y, z, noShadow) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = !noShadow; o.receiveShadow = !noShadow; return o; };
    const ctex = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx; };
    const std = (color, o) => { const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0 }, o || {})); m.envMap = env; m.envMapIntensity = 0.5; return m; };

    // ---------- materials
    const cols = ['#FF4B55', '#FF9326', '#FFD21F', '#3FCB5C', '#2E9BF5', '#8659F2'];
    const rainbow = ctex(16, 512, (c, W, H) => { const gr = c.createLinearGradient(0, 0, 0, H), a = 0.13, b = 0.89, st = (b - a) / 6; gr.addColorStop(0, cols[0]); cols.forEach((k, i) => { gr.addColorStop(a + i * st + st * 0.2, k); gr.addColorStop(a + (i + 1) * st - st * 0.2, k); }); gr.addColorStop(1, cols[5]); c.fillStyle = gr; c.fillRect(0, 0, W, H); });
    const skin = new T.MeshPhysicalMaterial({ map: rainbow, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.3, sheenRoughness: 0.5, sheenColor: new T.Color('#FFF1E0') }); skin.envMap = env; skin.envMapIntensity = 0.55;
    const limb = std('#5A4FA0', { roughness: 0.42 }), lidM = std('#FFC53D', { roughness: 0.5 }), lineM = std('#2B2D42', { roughness: 0.5 }), lashM = std('#3A3170', { roughness: 0.5 });
    const eyeTx = ctex(1024, 512, (c, W, H) => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); const sh = c.createRadialGradient(512, 256, 150, 512, 256, 330); sh.addColorStop(0, 'rgba(190,200,235,0)'); sh.addColorStop(1, 'rgba(190,200,235,0.55)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
      c.fillStyle = '#2A2060'; c.beginPath(); c.arc(512, 256, 128, 0, 7); c.fill(); const ir = c.createLinearGradient(0, 140, 0, 372); ir.addColorStop(0, '#3B2F8F'); ir.addColorStop(0.55, '#5B4BD0'); ir.addColorStop(1, '#9A8BFF'); c.fillStyle = ir; c.beginPath(); c.arc(512, 256, 118, 0, 7); c.fill();
      c.strokeStyle = 'rgba(190,180,255,0.35)'; c.lineWidth = 3; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.2832; c.beginPath(); c.moveTo(512 + Math.cos(a) * 78, 256 + Math.sin(a) * 78); c.lineTo(512 + Math.cos(a) * 112, 256 + Math.sin(a) * 112); c.stroke(); }
      c.fillStyle = '#17132E'; c.beginPath(); c.arc(512, 256, 74, 0, 7); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(468, 206, 36, 0, 7); c.fill(); c.beginPath(); c.arc(558, 304, 15, 0, 7); c.fill(); });
    const eyeM = new T.MeshPhysicalMaterial({ map: eyeTx, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }); eyeM.envMap = env; eyeM.envMapIntensity = 0.9;

    // ---------- body (everything that bounces, squashes and stretches lives in root; the feet stay planted)
    const root = new T.Group(); g.add(root);
    const CY = 1.15, bodyGeo = new T.SphereGeometry(1, 64, 48); bodyGeo.rotateZ(-0.5);   // diagonal rainbow
    const body = mesh(bodyGeo, skin, 0, CY, 0); body.scale.set(1, 1.06, 0.95); root.add(body);
    const feet = []; for (const s of [-1, 1]) { const ft = mesh(new T.SphereGeometry(0.3, 28, 20), limb, s * 0.42, 0.165, 0.16); ft.scale.set(1, 0.55, 1.4); ft.rotation.y = s * 0.15; g.add(ft); feet.push(ft); }
    // point on the body surface for a given (x, y relative to the body centre), plus the outward normal frame
    const onBody = (x, y, lift) => { const z = 0.95 * Math.sqrt(Math.max(0, 1 - x * x - (y / 1.06) * (y / 1.06))); const n = new T.Vector3(x, y / (1.06 * 1.06), z / (0.95 * 0.95)).normalize(); return { p: new T.Vector3(x, y, z).addScaledVector(n, lift || 0), n }; };
    const frame = (o, n) => { const zx = n.clone(), xx = new T.Vector3(0, 1, 0).cross(zx).normalize(), yy = zx.clone().cross(xx); o.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xx, yy, zx)); };

    // ---------- eyes: glossy textured balls that turn for the gaze; an upper and a lower lid (half spheres) roll over them
    const ER = 0.325, eyes = [];
    const lidGeo = new T.SphereGeometry(1, 36, 12, 0, P * 2, 0, P / 2), lashGeo = new T.TorusGeometry(1, 0.034, 8, 40); lashGeo.rotateX(P / 2);
    for (const s of [-1, 1]) {
      const eg = new T.Group(); eg.position.set(s * 0.375, 1.46, 0.775); eg.rotation.y = s * 0.1; eg.scale.set(1, 1.13, 0.62); root.add(eg);
      const gz = new T.Group(); eg.add(gz); const ball = mesh(new T.SphereGeometry(ER, 48, 32), eyeM, 0, 0, 0, true); ball.rotation.y = -P / 2; gz.add(ball);
      const up = mesh(lidGeo, lidM, 0, 0, 0, true); up.scale.setScalar(ER * 1.035); up.add(mesh(lashGeo, lashM, 0, 0, 0, true)); eg.add(up);
      const lo = mesh(lidGeo, lidM, 0, 0, 0, true); lo.scale.setScalar(ER * 1.06); const loLash = mesh(lashGeo, lashM, 0, 0, 0, true); lo.add(loLash); eg.add(lo);
      eyes.push({ s, gz, up, lo, loLash });
    }
    // brows: a soft tapered arc on a pivot through the body centre (so it slides over the forehead), tilting about the surface normal
    const browGeo = (function () { const c = new T.QuadraticBezierCurve3(new T.Vector3(-0.17, -0.02, 0), new T.Vector3(0, 0.06, 0), new T.Vector3(0.17, -0.02, 0)); const ge = new T.TubeGeometry(c, 16, 0.042, 10); ge.scale(1, 1, 0.55); return ge; })();
    const brows = []; for (const s of [-1, 1]) { const piv = new T.Group(); piv.position.set(0, CY, 0); root.add(piv); const h = new T.Group(), q = onBody(s * 0.4, 0.78, 0.012); h.position.copy(q.p); frame(h, q.n); piv.add(h);
      const b = mesh(browGeo, limb, 0, 0, 0, true); for (const e of [-1, 1]) { const cap = mesh(new T.SphereGeometry(0.042, 12, 8), limb, e * 0.17, -0.02, 0, true); cap.scale.z = 0.55; b.add(cap); } h.add(b); brows.push({ s, piv, b }); }
    // cheeks
    for (const s of [-1, 1]) { const ch = new T.Mesh(new T.SphereGeometry(0.17, 24, 16), new T.MeshStandardMaterial({ color: '#FF6A8E', transparent: true, opacity: 0.85, roughness: 0.9, depthWrite: false })); ch.position.set(s * 0.69, 1.1, 0.665); ch.rotation.y = s * 0.8; ch.scale.set(1, 0.62, 0.22); root.add(ch); }

    // ---------- mouths (one set per mood; pose() shows the right one)
    function arcMouth(R, tube, arc, mid) { const m = mesh(new T.TorusGeometry(R, tube, 12, 32, arc), lineM, 0, 0, 0, true); m.geometry.rotateZ(mid - arc / 2); for (const e of [-1, 1]) { const a = mid + e * arc / 2; m.add(mesh(new T.SphereGeometry(tube, 12, 8), lineM, Math.cos(a) * R, Math.sin(a) * R, 0, true)); } return m; }
    const mouthAt = (m, x, y, tilt) => { const q = onBody(x, y - CY, -0.012); m.position.copy(q.p).y += CY; frame(m, q.n); m.rotateZ(tilt || 0); root.add(m); return m; };
    const M = {};
    M.smile = mouthAt(arcMouth(0.2, 0.034, P * 0.8, -P / 2), 0, 1.13);
    M.grin = mouthAt(arcMouth(0.23, 0.037, P * 0.86, -P / 2), 0, 1.15);
    M.frown = mouthAt(arcMouth(0.17, 0.032, P * 0.56, P / 2), 0, 0.84);
    M.side = mouthAt(arcMouth(0.11, 0.033, P * 0.7, -P / 2), 0.2, 1.07, 0.3);
    // open talking mouth: D shape with teeth and tongue; pose() scales it for the syllables
    M.open = new T.Group(); mouthAt(M.open, 0, 1.11); const openIn = new T.Group(); M.open.add(openIn);
    (function () { const ms = new T.Shape(); ms.moveTo(-0.25, 0); ms.quadraticCurveTo(0, -0.05, 0.25, 0); ms.absellipse(0, 0, 0.25, 0.27, 0, P, true);
      const mg = new T.ExtrudeGeometry(ms, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.015, bevelSegments: 3, curveSegments: 24 });
      openIn.add(mesh(mg, std('#6E1B3A', { roughness: 0.6 }), 0, 0, 0, true)); const tg = mesh(new T.SphereGeometry(0.13, 24, 16), std('#FF7E9D', { roughness: 0.5 }), 0, -0.2, 0.014, true); tg.scale.set(1.15, 0.6, 0.18); openIn.add(tg);
      const th = mesh(new T.CapsuleGeometry(0.03, 0.24, 6, 12), std('#ffffff', { roughness: 0.3 }), 0, -0.047, 0.024, true); th.rotation.z = P / 2; th.scale.z = 0.35; openIn.add(th); M.teeth = th; })();
    // 'wow': a round O
    M.wow = new T.Group(); mouthAt(M.wow, 0, 1.0);
    (function () { const o = mesh(new T.SphereGeometry(1, 32, 20), std('#6E1B3A', { roughness: 0.6 }), 0, 0, 0, true); o.scale.set(0.15, 0.185, 0.03); M.wow.add(o); const lip = mesh(new T.TorusGeometry(1, 0.13, 10, 40), lineM, 0, 0, 0.004, true); lip.scale.set(0.15, 0.185, 0.15); M.wow.add(lip);
      const tg = mesh(new T.SphereGeometry(0.09, 20, 12), std('#FF7E9D', { roughness: 0.5 }), 0, -0.1, 0.012, true); tg.scale.set(1.1, 0.6, 0.2); M.wow.add(tg); })();

    // ---------- arms: pivot at the shoulder, arm hangs along -y, round mitten hand with a thumb
    const arms = {}; for (const s of [-1, 1]) { const arm = new T.Group(); arm.position.set(s * 0.9, 1.22, 0.1); arm.rotation.order = 'YZX';
      arm.add(mesh(new T.CapsuleGeometry(0.105, 0.42, 8, 16), limb, 0, -0.3, 0)); const hand = mesh(new T.SphereGeometry(0.175, 24, 16), limb, 0, -0.63, 0); arm.add(hand); arm.add(mesh(new T.SphereGeometry(0.075, 16, 12), limb, -s * 0.05, -0.56, 0.15));
      root.add(arm); arms[s] = arm; arm.userData.hand = hand; }

    // ---------- antenna and bulb
    const ant = new T.Group(); ant.position.set(0, 2.17, 0); root.add(ant);
    ant.add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(0.02, 0.26, 0), new T.Vector3(0.1, 0.5, 0)]), 16, 0.034, 10), limb));
    const bulbM = new T.MeshStandardMaterial({ color: '#FFD633', emissive: '#F59E00', emissiveIntensity: 0.9, roughness: 0.25 }); bulbM.envMap = env; bulbM.envMapIntensity = 0.5;
    const bulb = mesh(new T.SphereGeometry(0.16, 32, 20), bulbM, 0.12, 0.6, 0); ant.add(bulb);
    const glowM = new T.SpriteMaterial({ map: ctex(128, 128, (c, S) => { const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); gr.addColorStop(0, 'rgba(255,225,120,0.9)'); gr.addColorStop(0.3, 'rgba(255,200,60,0.35)'); gr.addColorStop(1, 'rgba(255,190,40,0)'); c.fillStyle = gr; c.fillRect(0, 0, S, S); }), blending: T.AdditiveBlending, depthWrite: false, transparent: true });
    const glow = new T.Sprite(glowM); glow.position.copy(bulb.position); ant.add(glow);

    // ---------- Peek-Inside Goggles: chunky yellow rims, pale blue lenses, dark strap; on a pivot through the body centre
    const gog = new T.Group(); gog.position.set(0, CY, 0); root.add(gog);
    (function () { const yel = std('#FFBE0B', { roughness: 0.25 }); yel.envMapIntensity = 0.6; const yel2 = std('#F2A900', { roughness: 0.4, side: T.DoubleSide }); const strapM = std('#2E2A4F', { roughness: 0.7 });
      const lensM = new T.MeshStandardMaterial({ color: '#BFE6FF', transparent: true, opacity: 0.36, roughness: 0.05, depthWrite: false }); lensM.envMap = env; lensM.envMapIntensity = 1.4;
      const glintM = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false });
      const RR = 0.36, barrel = new T.CylinderGeometry(RR + 0.045, RR + 0.075, 0.2, 36, 1, true); barrel.rotateX(P / 2); barrel.translate(0, 0, -0.1);
      for (const s of [-1, 1]) { const h = new T.Group(); h.position.set(s * 0.395, 0.31, 1.03); h.rotation.y = s * 0.3; h.scale.y = 1.06; gog.add(h);
        h.add(mesh(new T.TorusGeometry(RR + 0.01, 0.07, 14, 40), yel)); h.add(mesh(barrel, yel2));
        const lens = new T.Mesh(new T.CircleGeometry(RR, 40), lensM); lens.position.z = -0.015; lens.renderOrder = 3; h.add(lens);
        const gl = new T.Mesh(new T.CapsuleGeometry(0.028, 0.16, 4, 10), glintM); gl.position.set(-0.13, 0.13, -0.008); gl.rotation.z = -0.75; gl.scale.z = 0.1; gl.renderOrder = 4; h.add(gl); }
      const bridge = mesh(new T.CapsuleGeometry(0.06, 0.1, 6, 12), yel, 0, 0.33, 1.0); bridge.rotation.z = P / 2; gog.add(bridge);
      const gap = 0.86, sg = new T.TorusGeometry(1, 0.03, 8, 56, P * 2 - 2 * gap); sg.rotateZ(P / 2 + gap); sg.rotateX(P / 2); sg.scale(0.975, 2.5, 0.925); const strap = mesh(sg, strapM, 0, 0.31, 0); gog.add(strap); })();

    U.anchor = { bulb, handL: arms[1].userData.hand, handR: arms[-1].userData.hand, mouth: M.smile, top: ant };
    const BL = U.BLINK = { every: 3.7, length: 0.15, first: 2.6 };

    // mood table: lids (upper, lower: 0 open .. 1 shut), brows (raise in radians over the forehead, tilt: + = inner end up)
    const MOOD = {
      happy: { m: 'smile', up: 0, lo: 0.1, raise: 0, tilt: 0.06 },
      talk: { m: 'open', up: 0, lo: 0.05, raise: 0.03, tilt: 0.04 },
      wow: { m: 'wow', up: -0.16, lo: 0, raise: 0.15, tilt: 0.1 },
      think: { m: 'side', up: 0.52, lo: 0.12, raise: 0.02, tilt: -0.12 },
      sad: { m: 'frown', up: 0.46, lo: 0, raise: 0.05, tilt: 0.42 },
      wink: { m: 'grin', up: 0, lo: 0.12, raise: 0.05, tilt: 0.06 }
    };
    const REST = 0.45;   // how much upper lid shows when the eye is open
    U.pose = function (o, t) {
      o = o || {}; t = num(t, 0);
      const md = MOOD[o.mood] ? o.mood : 'happy', K = MOOD[md], s = num(o.s, 1), bob = num(o.bob, 1), sq = clamp(num(o.squash, 0), -0.8, 0.8), gg = clamp(num(o.goggles, 0), 0, 1);
      g.position.set(num(o.x, 0), num(o.y, 0), num(o.z, 0)); g.rotation.set(0, num(o.ry, 0), 0); g.scale.setScalar(s); g.visible = true;
      // idle bounce + squash and stretch (volume kept)
      const ph = t * 2.4, sy = (1 - 0.3 * sq) * (1 + 0.012 * bob * Math.sin(ph + 1.1)), sx = 1 / Math.sqrt(sy);
      root.position.set(0, 0.035 * bob * (0.5 + 0.5 * Math.sin(ph)), 0); root.scale.set(sx, sy, sx); root.rotation.set(0, 0, 0.012 * bob * Math.sin(ph * 0.5 + 0.4));
      feet.forEach(f => f.scale.set(sx, 0.55, 1.4 * sx));
      // eyes
      const bp = (((t - BL.first) % BL.every) + BL.every) % BL.every, auto = bp < BL.length ? Math.sin(P * bp / BL.length) : 0, blink = clamp(auto + num(o.blink, 0), 0, 1);
      const lx = clamp(num(o.lookX, 0), -1, 1), ly = clamp(num(o.lookY, 0), -1, 1);
      for (const e of eyes) { const wink = md === 'wink' && e.s === 1;
        const cu = clamp(Math.max(K.up + (wink ? 0.3 : 0), blink) - 0.06 * Math.max(0, ly) + 0.1 * Math.max(0, -ly), -0.2, 1), cl = wink ? 0.9 : Math.max(K.lo, blink * 0.42);
        e.up.rotation.set(-P / 2 + REST + cu * (0.68 + P / 2 - REST), 0, 0); e.lo.rotation.set(P - (-P / 2 + cl * (P / 2 + 0.75)), 0, 0);
        e.loLash.visible = cl > 0.2; e.gz.rotation.set(-ly * 0.36, lx * 0.46 - e.s * 0.05, 0, 'YXZ'); }
      // brows (they lift a little to stay above the goggles)
      for (const b of brows) { let raise = K.raise, tilt = K.tilt;
        if (md === 'think') { raise = b.s === 1 ? 0.13 : -0.03; tilt = b.s === 1 ? 0.02 : -0.22; } if (md === 'wink') raise = b.s === 1 ? -0.035 : 0.1;
        raise += 0.05 * ly + 0.1 * sstep(0.45, 1, gg); b.piv.rotation.set(-raise, 0, 0); b.b.rotation.set(0, 0, -b.s * tilt); }
      // mouth
      for (const k of ['smile', 'grin', 'frown', 'side', 'open', 'wow']) M[k].visible = k === K.m;
      if (md === 'talk') { const a = Math.abs(Math.sin(t * 6.1)), b2 = Math.abs(Math.sin(t * 9.7 + 1.1)), en = 0.72 + 0.28 * Math.sin(t * 2.3 + 0.5), op = clamp(0.08 + 0.92 * (0.56 * a + 0.44 * b2) * en, 0, 1);
        openIn.scale.set(0.84 - 0.1 * op, 0.16 + 0.8 * op, 1); M.teeth.visible = op > 0.3; }
      // arms
      for (const sgn of [-1, 1]) { const a = clamp(num(sgn === 1 ? o.armL : o.armR, 0), -0.4, 3), A = 0.3 + a * 0.98; arms[sgn].rotation.set(0, -sgn * 0.42 * Math.sin(Math.min(A, P)), sgn * A, 'YZX'); }
      // antenna and bulb
      const bl = clamp(num(o.bulb, 0.4), 0, 1); ant.rotation.set(0, 0, 0.05 * bob * Math.sin(ph - 0.7) - 0.25 * sq * 0.3);
      bulbM.emissiveIntensity = 0.04 + 0.9 * bl; bulbM.envMapIntensity = 0.5 - 0.3 * bl; bulbM.color.setRGB(0.5 + 0.5 * bl, 0.36 + 0.34 * bl, 0.06 + 0.02 * bl); glow.visible = bl > 0.02; glowM.opacity = Math.min(1, bl * 1.1); glow.scale.setScalar(0.45 + 0.6 * bl);
      // goggles: pop out on the forehead, then swing down onto the eyes with a little overshoot
      gog.visible = gg > 0.001;
      if (gog.visible) { const k = sstep(0, 0.32, gg), e = sstep(0.18, 1, gg), over = Math.sin(P * sstep(0.55, 1, gg)) * 0.07; gog.scale.setScalar(k * (1 + 0.12 * Math.sin(P * sstep(0, 0.45, gg)))); gog.rotation.set(-0.52 * (1 - e) + over, 0, 0); }
    };
    U.pose({}, 0);
    return g;
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Explanation layer for "How things work": numbered step tokens, chunky toy arrows and glowing rings.
   All three are ordinary scene objects (they are lit, sorted and hidden by depth like everything else): put them a little
   in front of the part they explain. Every show() is a pure function of its arguments.

   L.three.kits.token(T, L3, n, color, size = 0.3) -> Group: a glossy coin (radius `size`) with a white face, a rim in `color`
       and the number n (1-9) in bold dark blue.  token.userData.face(camera) turns it to the camera (call it every frame,
       after the camera is placed);  token.userData.show(p) pops it in, p 0..1 (hidden at 0, a little overshoot on the way).
   L.three.kits.arrow(T, L3, { color = '#FF3F8E', length = 1.2, width = 0.16, curve = 0 }) -> Group: a rounded 3D arrow lying
       in its xy plane, starting at its origin and pointing along +x. `width` is the shaft width (the head is 2.5 x wider);
       `curve` is the arc angle in radians: the arrow bends around +z (positive = towards +y, anticlockwise seen from +z),
       keeping its length.  arrow.userData.show(p) grows it from the tail, p 0..1 (hidden at 0);  arrow.userData.tip is an
       Object3D that rides on the arrow's point (for L3.at(world, arrow.userData.tip)).
   L.three.kits.halo(T, L3, color = '#FFC233', radius = 0.5) -> Mesh: a soft glowing ring in its xy plane (facing +z).
       halo.userData.show(p, t): p 0..1 fades and pops it in (hidden at 0), t (seconds) makes it pulse gently. */
(function (global) {
  const L = global.LSC; if (!L || !L.three) return;
  const clamp01 = v => Math.max(0, Math.min(1, +v || 0));
  const backOut = p => { const c = 1.70158 * 1.25, q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; };   // overshoots to about 1.1, lands on 1
  const cache = {};
  function ctex(T, w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return tx; }

  // ---------- numbered step token
  L.three.kits.token = function (T, L3, n, color, size) {
    color = color || '#FF3F8E'; size = size || 0.3; n = String(n == null ? 1 : n);
    const g = new T.Group(), coin = new T.Group(), U = g.userData, env = L3.env(); g.add(coin);
    const face = cache['n' + n] || (cache['n' + n] = ctex(T, 256, 256, (c, S) => { const gr = c.createRadialGradient(S * 0.42, S * 0.36, S * 0.1, S / 2, S / 2, S * 0.62); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#E9EDF8'); c.fillStyle = gr; c.fillRect(0, 0, S, S);
      c.fillStyle = '#1B2559'; c.font = '700 ' + (n.length > 1 ? 150 : 196) + 'px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; const m = c.measureText(n), asc = m.actualBoundingBoxAscent || 140, desc = m.actualBoundingBoxDescent || 0, off = ((m.actualBoundingBoxRight || 0) - (m.actualBoundingBoxLeft || 0)) / 2;
      c.fillText(n, S / 2 - off, S / 2 + (asc - desc) / 2); }));
    const rimM = new T.MeshStandardMaterial({ color, roughness: 0.22, emissive: color, emissiveIntensity: 0.28 }); rimM.envMap = env; rimM.envMapIntensity = 0.6;
    const faceM = new T.MeshStandardMaterial({ map: face, roughness: 0.3, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.42 }); faceM.envMap = env; faceM.envMapIntensity = 0.25;
    const th = 0.2, body = new T.CylinderGeometry(1, 1, th, 48); body.rotateX(Math.PI / 2);
    const b = new T.Mesh(body, rimM); b.castShadow = true; coin.add(b);
    const rim = new T.Mesh(new T.TorusGeometry(0.9, 0.12, 12, 56), rimM); rim.position.z = th / 2 - 0.02; rim.castShadow = true; coin.add(rim);
    const f = new T.Mesh(new T.CircleGeometry(0.8, 48), faceM); f.position.z = th / 2 + 0.004; coin.add(f);
    const q = new T.Quaternion();
    U.n = n; U.color = color; U.size = size;
    U.face = function (camera) { camera.getWorldQuaternion(g.quaternion); if (g.parent) { g.parent.getWorldQuaternion(q); g.quaternion.premultiply(q.invert()); } };
    U.show = function (p) { p = clamp01(p); g.visible = p > 0.001; coin.scale.setScalar(Math.max(0.001, U.size * backOut(p))); coin.rotation.z = (1 - p) * -0.5; };
    U.show(1);
    return g;
  };

  // ---------- chunky rounded arrow
  L.three.kits.arrow = function (T, L3, o) {
    o = o || {}; const color = o.color || '#FF3F8E', LEN = o.length || 1.2, W = o.width || 0.16, curve = o.curve || 0;
    const g = new T.Group(), U = g.userData, env = L3.env();
    const head = Math.min(W * 1.9, LEN * 0.5), HW = W * 1.25, th = W * 0.5, bev = W * 0.16, minShaft = W * 0.8, N = curve ? Math.max(6, Math.ceil(Math.abs(curve) * 14)) : 1;
    // outline in "straight" space: round tail at x = 0, shaft to x = LEN - head, head to the tip at x = LEN
    const pts = [], V = (x, y) => new T.Vector2(x, y), X1 = LEN - head;
    for (let i = 0; i <= 10; i++) { const a = Math.PI / 2 + i / 10 * Math.PI; pts.push(V(W / 2 + Math.cos(a) * W / 2, Math.sin(a) * W / 2)); }
    for (let i = 1; i <= N; i++) pts.push(V(W / 2 + (X1 - W / 2) * i / N, -W / 2));
    const round = (P, A, B, r) => { const a = A.clone().sub(P), b = B.clone().sub(P); r = Math.min(r, a.length() * 0.45, b.length() * 0.45); const p0 = P.clone().addScaledVector(a.normalize(), r), p1 = P.clone().addScaledVector(b.normalize(), r); for (let i = 0; i <= 5; i++) { const k = i / 5, u = 1 - k; pts.push(V(u * u * p0.x + 2 * u * k * P.x + k * k * p1.x, u * u * p0.y + 2 * u * k * P.y + k * k * p1.y)); } };
    const c1 = V(X1, -HW), tip = V(LEN, 0), c2 = V(X1, HW), rc = W * 0.3;
    round(c1, V(X1, -W / 2), tip, rc); round(tip, c1, c2, rc * 0.8); round(c2, tip, V(X1, W / 2), rc);
    for (let i = N; i >= 1; i--) pts.push(V(W / 2 + (X1 - W / 2) * i / N, W / 2));
    const geo = new T.ExtrudeGeometry(new T.Shape(pts), { depth: th - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 1 }); geo.translate(0, 0, -(th - 2 * bev) / 2);
    const mat = new T.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.3 }); mat.envMap = env; mat.envMapIntensity = 0.5;
    const m = new T.Mesh(geo, mat); m.castShadow = true; m.frustumCulled = false; g.add(m);
    const tipO = new T.Object3D(); g.add(tipO);
    const pos = geo.attributes.position, nor = geo.attributes.normal, P0 = pos.array.slice(), N0 = nor.array.slice(), R = curve ? LEN / curve : 0, headFrom = X1 - Math.min(bev * 0.5, (X1 - W / 2) / N * 0.4);
    let last = -1;
    U.color = color; U.length = LEN; U.tip = tipO;
    U.show = function (p) {
      p = clamp01(p); g.visible = p > 0.001; if (!g.visible || p === last) return; last = p;
      const Lp = LEN * p, shaft = Math.max(minShaft, Lp - head), k = Math.min(1, Lp / (minShaft + head)), sc = (shaft - W / 2) / (X1 - W / 2), pa = pos.array, na = nor.array;
      for (let i = 0; i < P0.length; i += 3) { const x0 = P0[i]; let x = x0 >= headFrom ? shaft + (x0 - X1) : x0 <= W / 2 ? x0 : W / 2 + (x0 - W / 2) * sc, y = P0[i + 1] * k; x *= k;
        if (R) { const a = x / R, s = Math.sin(a), c = Math.cos(a); pa[i] = s * (R - y); pa[i + 1] = R - c * (R - y); na[i] = N0[i] * c - N0[i + 1] * s; na[i + 1] = N0[i] * s + N0[i + 1] * c; } else { pa[i] = x; pa[i + 1] = y; }
        pa[i + 2] = P0[i + 2] * k; }
      pos.needsUpdate = true; nor.needsUpdate = true;
      const xe = (shaft + head) * k; if (R) { const a = xe / R; tipO.position.set(Math.sin(a) * R, R - Math.cos(a) * R, 0); tipO.rotation.z = a; } else { tipO.position.set(xe, 0, 0); tipO.rotation.z = 0; }
    };
    U.show(1);
    return g;
  };

  // ---------- glowing ring
  L.three.kits.halo = function (T, L3, color, radius) {
    color = color || '#FFC233'; radius = radius || 0.5;
    const tube = Math.max(0.016, radius * 0.055), E = 1.6;   // the glow card reaches out to E x radius
    const ringM = new T.MeshBasicMaterial({ color: new T.Color(color).lerp(new T.Color('#ffffff'), 0.18), transparent: true, depthWrite: false, toneMapped: false });
    const ring = new T.Mesh(new T.TorusGeometry(radius, tube, 10, 72), ringM), U = ring.userData; ring.renderOrder = 7;
    const tx = cache.halo || (cache.halo = ctex(T, 256, 256, (c, S) => { const r0 = 1 / E, gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); const st = [[0, 0], [r0 * 0.55, 0], [r0 * 0.86, 0.34], [r0, 0.8], [Math.min(0.99, r0 * 1.14), 0.36], [Math.min(0.995, r0 * 1.38), 0.1], [1, 0]]; for (const [p, a] of st) gr.addColorStop(p, 'rgba(255,255,255,' + a + ')'); c.fillStyle = gr; c.fillRect(0, 0, S, S); }));
    const glowM = new T.MeshBasicMaterial({ map: tx, color, transparent: true, depthWrite: false, toneMapped: false });
    const glow = new T.Mesh(new T.PlaneGeometry(2 * radius * E, 2 * radius * E), glowM); glow.position.z = -tube * 0.5; glow.renderOrder = 6; ring.add(glow);
    U.color = color; U.radius = radius;
    U.show = function (p, t) { p = clamp01(p); t = +t || 0; const pulse = 0.5 + 0.5 * Math.sin(t * 4.5); ring.visible = p > 0.001;
      ring.scale.setScalar(Math.max(0.001, (0.6 + 0.4 * backOut(p)) * (1 + 0.045 * pulse))); ringM.opacity = Math.min(1, p * 1.5) * (0.82 + 0.18 * pulse); glowM.opacity = p * (0.55 + 0.4 * pulse); };
    U.show(1, 0);
    return ring;
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* "How things work" asset: the sunny street (theme D), the real-world opening of an episode.

   const world = L.three.kits.street(T, L3);   ->   { scene, camera, sun, aimSun(x, y, z, half), info }
   A bright neighbourhood lane on a sunny morning, seen from the +z side. Ground is y = 0.
     z  2.0 .. 11.2   grey road: nothing stands on it or near it, so the view of the lane from the +z side is clear. Beyond it
                      (z > 11.5) a far kerb, grass, a hedge at z 27 and trees at z 31+: keep the camera at z < 24.
     z -1.6 .. 2.0    the painted bike lane (teal green, so dark tyres and a red frame separate from it), along x, -60 .. 60.
                      The bike rides near z = 0 from x = -9 to +9; Curie's spot is around x = -3, z = 1.2.
     z -1.9 .. -3.9   kerb and pavement (y = 0.16) with a lamp post (x -6.4) and a post box (x 5.3)
     z -4.1           garden wall with pillars and two gates, then a flowering hedge, rounded trees, four pastel houses
                      (z -15 .. -19), a far tree line and hills fading into blue haze (scene.fog), sky dome and soft clouds.
   Lights: one warm sun (the only shadow caster light, 2048 map; road, lane, kerb and pavement receive) + a sky/ground
   hemisphere. world.aimSun(x, y, z, half) moves the sun's shadow box so it is centred on (x, y, z) and 2 x half wide: call
   it every frame with the bike's position (pure setter; default aimSun(0, 0.5, 0, 7)). The sun direction never changes.
   Camera: PerspectiveCamera, fov 32, default position (0, 2, 12.6) looking at (0, 1.35, 0): set it per shot (L3.shoot).
   The set is static (no update function). Background detail is baked into vertex colours (soft top-to-bottom shading on
   houses and foliage), so it costs a handful of draw calls. No DOM or THREE access at load time. */
(function (global) {
  const L = global.LSC; if (!L || !L.three) return;
  L.three.kits.street = function (T, L3) {
    const PI = Math.PI, V3 = (x, y, z) => new T.Vector3(x, y, z || 0);
    function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function ctex(w, h, fn, rx, ry) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; if (rx) { tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(rx, ry); } return tx; }
    const lam = (color, o) => new T.MeshLambertMaterial(Object.assign({ color }, o || {}));
    const HAZE = '#d3e7f8';
    const scene = new T.Scene(); scene.fog = new T.Fog(HAZE, 17, 92);
    const camera = new T.PerspectiveCamera(32, 16 / 9, 0.1, 420); camera.position.set(0, 2, 12.6); camera.lookAt(0, 1.35, 0);

    // ---------------------------------------------------------------- lights
    scene.add(new T.HemisphereLight('#dcecff', '#d8cfa6', 1.75));
    const sun = new T.DirectionalLight('#fff0d2', 3.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; scene.add(sun); scene.add(sun.target);
    function aimSun(x, y, z, half) { half = half || 7; sun.target.position.set(x, y, z); sun.position.set(x - 5, y + 9.5, z + 8.5); const c = sun.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 1; c.far = 40; c.updateProjectionMatrix(); sun.target.updateMatrixWorld(); }
    aimSun(0, 0.5, 0, 7);

    // ---------------------------------------------------------------- geometry helpers (everything static is merged)
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), ONE = V3(1, 1, 1), Y = V3(0, 1, 0), CC = new T.Color(), C2 = new T.Color();
    // paint a geometry with a vertex-colour gradient: colour at the bottom = c * (1 - dark), at the top = c lerped to white by light
    function tint(g, color, dark, light, y0, y1) {
      const P = g.attributes.position, n = P.count, col = new Float32Array(n * 3); if (y0 == null) { g.computeBoundingBox(); y0 = g.boundingBox.min.y; y1 = g.boundingBox.max.y; }
      CC.set(color); for (let i = 0; i < n; i++) { const k = Math.max(0, Math.min(1, (P.getY(i) - y0) / Math.max(1e-6, y1 - y0))); C2.copy(CC).multiplyScalar(1 - (dark || 0) * (1 - k)).lerp(WHITE, (light || 0) * k); col[i * 3] = C2.r; col[i * 3 + 1] = C2.g; col[i * 3 + 2] = C2.b; }
      g.setAttribute('color', new T.BufferAttribute(col, 3)); return g;
    }
    const WHITE = new T.Color('#ffffff');
    const place = (g, x, y, z, ry, sx, sy, sz, rz) => { Q.setFromEuler(new T.Euler(0, ry || 0, rz || 0)); g.applyMatrix4(M4.compose(V3(x, y, z), Q, V3(sx || 1, sy || sx || 1, sz || sx || 1))); return g; };
    function merge(list) {
      let n = 0; const parts = list.map(g => { const q = g.index ? g.toNonIndexed() : g; n += q.attributes.position.count; return q; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3).fill(1), uv = new Float32Array(n * 2); let k = 0;
      for (const q of parts) { const c = q.attributes.position.count; pos.set(q.attributes.position.array, k * 3); nor.set(q.attributes.normal.array, k * 3); if (q.attributes.color) col.set(q.attributes.color.array, k * 3); if (q.attributes.uv) uv.set(q.attributes.uv.array, k * 2); k += c; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); return g;
    }
    const bins = {}; const put = (bin, g) => { (bins[bin] = bins[bin] || []).push(g); return g; };
    const flush = (bin, mat, cast, recv) => { if (!bins[bin]) return null; const m = new T.Mesh(merge(bins[bin]), mat); m.castShadow = !!cast; m.receiveShadow = !!recv; scene.add(m); delete bins[bin]; return m; };
    const box = (w, h, d) => new T.BoxGeometry(w, h, d);
    const rbox = (w, h, d, r) => { r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4); const s = new T.Shape(), x = w / 2 - r, y = h / 2 - r; s.moveTo(-x, -y); s.lineTo(x, -y); s.lineTo(x, y); s.lineTo(-x, y); s.lineTo(-x, -y); const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -(d - 2 * r) / 2); return g; };

    // ---------------------------------------------------------------- sky and clouds (not fogged, not tone mapped)
    const skyT = ctex(8, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); [[0, '#2f86ea'], [0.3, '#56a4f3'], [0.43, '#9fd0fa'], [0.5, HAZE], [1, HAZE]].forEach(q => gr.addColorStop(q[0], q[1])); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    scene.add(new T.Mesh(new T.SphereGeometry(320, 32, 16), new T.MeshBasicMaterial({ map: skyT, side: T.BackSide, fog: false, toneMapped: false })));
    (function () { const R = rng(11), spots = [[-58, 21, -125, 1.5], [-14, 30, -135, 1.25], [34, 19, -120, 1.6], [78, 28, -130, 1.3], [-96, 31, -122, 1.2]];
      for (const [x, y, z, k] of spots) { const n = 7; for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5, r = (3.4 - Math.abs(u) * 3.6 + R() * 0.9) * k; const s = new T.SphereGeometry(r, 20, 14); s.scale(1.15, 0.78, 1); tint(s, '#ffffff', 0.2, 0); const P = s.attributes.color; for (let j = 0; j < P.count; j++) P.setXYZ(j, P.getX(j) * 0.96, P.getY(j) * 0.985, 1);   // cool, soft underside
        put('cloud', place(s, x + u * 16 * k, y + r * 0.5 + R() * 0.7, z + R() * 2)); } }
      flush('cloud', new T.MeshBasicMaterial({ vertexColors: true, fog: false, toneMapped: false })); })();

    // ---------------------------------------------------------------- ground
    const speck = (base, s1, s2, rep, seed) => ctex(256, 256, (g, w, h) => { const R = rng(seed || 5); g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? s1 : s2; g.globalAlpha = 0.25 + R() * 0.4; const r = 0.6 + R() * 1.6; g.beginPath(); g.arc(R() * w, R() * h, r, 0, 7); g.fill(); } g.globalAlpha = 1; }, rep[0], rep[1]);
    const gplane = (x0, x1, z0, z1, y, m, recv, order) => { const pl = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), m); pl.rotation.x = -PI / 2; pl.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); pl.receiveShadow = !!recv; if (order) pl.renderOrder = order; scene.add(pl); return pl; };
    const LANE0 = -1.6, LANE1 = 2.0, ROAD1 = 11.2;
    gplane(-70, 70, LANE1, ROAD1, 0, lam('#ffffff', { map: speck('#8d949f', '#a7aeb9', '#757c88', [90, 6]) }), true);
    gplane(-70, 70, LANE0, LANE1, 0, lam('#ffffff', { map: speck('#35b08a', '#4cc49c', '#2a9c79', [90, 2.4], 9) }), true);
    const paintM = lam('#fbfaf2', { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    gplane(-70, 70, LANE1 - 0.08, LANE1 + 0.08, 0.002, paintM, true); gplane(-70, 70, LANE0 + 0.12, LANE0 + 0.2, 0.002, paintM, true);
    for (let i = -13; i < 13; i++) gplane(i * 5, i * 5 + 2.6, 6.6, 6.76, 0.002, paintM, true);
    // painted bicycle symbols and arrows on the lane (near side, so the bike does not ride over them at z = 0)
    const symT = ctex(512, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = g.fillStyle = '#fbfaf2'; g.lineWidth = 15; g.lineCap = g.lineJoin = 'round';
      for (const x of [118, 394]) { g.beginPath(); g.arc(x, 158, 68, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(118, 158); g.lineTo(196, 72); g.lineTo(338, 72); g.lineTo(394, 158); g.moveTo(196, 72); g.lineTo(256, 158); g.lineTo(338, 72); g.moveTo(118, 158); g.lineTo(256, 158); g.moveTo(182, 50); g.lineTo(196, 72); g.moveTo(160, 50); g.lineTo(210, 50); g.moveTo(338, 72); g.lineTo(326, 44); g.lineTo(356, 40); g.stroke(); });
    const symM = lam('#ffffff', { map: symT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const x of [-10.5, 2.4, 14.5]) gplane(x - 0.95, x + 0.95, 0.72, 1.67, 0.003, symM, true, 1);
    // kerb, pavement, soft contact shadows (painted gradients) where the kerb and the wall meet the ground
    const KERB = 0.16;
    put('stone', tint(place(rbox(140, KERB + 0.1, 0.34, 0.03), 0, KERB / 2 - 0.05, LANE0 - 0.15), '#cfd3d8', 0.12, 0.15));
    const paveT = ctex(256, 256, (g, w, h) => { const R = rng(8); g.fillStyle = '#dccbae'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.5 ? '#e9dbc3' : '#cdbb9a'; g.globalAlpha = 0.3; g.fillRect(R() * w, R() * h, 2 + R() * 3, 2 + R() * 3); } g.globalAlpha = 1; g.strokeStyle = '#b6a384'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h / 2); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 4, h / 2); g.lineTo(w / 4, h); g.moveTo(3 * w / 4, h / 2); g.lineTo(3 * w / 4, h); g.stroke(); }, 70, 1);
    gplane(-70, 70, -3.92, LANE0 - 0.3, KERB, lam('#ffffff', { map: paveT }), true);
    const aoT = ctex(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(60,50,40,0.42)'); gr.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const aoM = new T.MeshBasicMaterial({ map: aoT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    gplane(-70, 70, -3.92, -3.37, KERB + 0.003, aoM, false, 1); gplane(-70, 70, LANE0 + 0.01, LANE0 + 0.3, 0.004, aoM, false, 1);
    const grassM = lam('#ffffff', { map: ctex(256, 256, (g, w, h) => { const R = rng(3); g.fillStyle = '#7ccb5c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = R() < 0.5 ? '#90d86c' : '#69bb4e'; g.globalAlpha = 0.35; g.beginPath(); g.arc(R() * w, R() * h, 4 + R() * 14, 0, 7); g.fill(); } g.globalAlpha = 1; }, 34, 18) }); gplane(-90, 90, -100, -3.9, KERB - 0.01, grassM); gplane(-90, 90, ROAD1 + 0.3, 110, KERB - 0.01, grassM);

    // ---------------------------------------------------------------- garden wall with pillars and two gates
    const GATES = [-10.4, 8.3], WZ = -4.1, inGate = (x, m) => GATES.some(gx => Math.abs(x - gx) < 0.95 + (m || 0));
    const brickT = ctex(256, 128, (g, w, h) => { const R = rng(4); g.fillStyle = '#fbefd6'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e9d7b3'; g.lineWidth = 2; for (let r = 0; r < 4; r++) { g.beginPath(); g.moveTo(0, r * 32 + 1); g.lineTo(w, r * 32 + 1); g.stroke(); for (let c = 0; c < 4; c++) { const x = c * 64 + (r % 2) * 32; g.beginPath(); g.moveTo(x, r * 32); g.lineTo(x, r * 32 + 32); g.stroke(); if (R() < 0.5) { g.fillStyle = R() < 0.5 ? '#fff7e4' : '#f2e3c4'; g.fillRect(x + 2, r * 32 + 3, 60, 28); } } } const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(120,90,50,0.16)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 1, 1);
    brickT.wrapS = T.RepeatWrapping;
    (function () { const edges = [-66, GATES[0] - 0.95, GATES[0] + 0.95, GATES[1] - 0.95, GATES[1] + 0.95, 66];
      for (let i = 0; i < edges.length; i += 2) { const x0 = edges[i], x1 = edges[i + 1], w = x1 - x0, g = box(w, 0.92, 0.36), uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * w / 1.5);
        put('wall', place(g, (x0 + x1) / 2, KERB + 0.46, WZ)); put('stone', tint(place(rbox(w + 0.06, 0.1, 0.5, 0.03), (x0 + x1) / 2, KERB + 0.97, WZ), '#fff8ea', 0.1, 0)); }
      const pillar = x => { put('stone', tint(place(rbox(0.56, 1.3, 0.56, 0.04), x, KERB + 0.65, WZ), '#fff3dc', 0.16, 0.1)); put('stone', tint(place(rbox(0.7, 0.12, 0.7, 0.04), x, KERB + 1.36, WZ), '#fff8ea', 0.05, 0)); put('stone', tint(place(new T.SphereGeometry(0.2, 20, 14), x, KERB + 1.58, WZ), '#fff3dc', 0.22, 0.25)); };
      for (let x = -31.5; x <= 32; x += 7) if (!inGate(x, 0.6)) pillar(x); for (const gx of GATES) { pillar(gx - 1.15); pillar(gx + 1.15); put('stone', tint(place(box(1.5, 0.03, 12), gx, KERB + 0.005, WZ - 5.8), '#ead9b8', 0, 0)); }
      flush('wall', lam('#ffffff', { map: brickT }), true, false); })();

    // ---------------------------------------------------------------- foliage: lumpy spheres, colour baked per vertex (dark, cool underside; sunny top)
    function lumpy(seed, amp) { const g = new T.SphereGeometry(1, 24, 16), P = g.attributes.position, v = V3(), a = seed * 1.7, f = 3.1;
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = Math.sin(v.x * f + a) * Math.sin(v.y * f * 1.3 + a * 2) + Math.sin(v.z * f * 1.1 + a * 3) * Math.sin(v.x * f * 0.7 + v.y * f + a); v.multiplyScalar(1 + amp * n * 0.5); P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); g.userData.noise = a; return g; }
    const lumps = [lumpy(1, 0.12), lumpy(2, 0.12), lumpy(3, 0.12)], LEAF = ['#5fc044', '#4eb040', '#78d052', '#43a240'];
    function blob(bin, x, y, z, sx, sy, sz, li, mi, dark) { const src = lumps[li % 3], g = src.clone(), P = g.attributes.position, n = P.count, col = new Float32Array(n * 3); CC.set(LEAF[mi % 4]);
      for (let i = 0; i < n; i++) { const yy = P.getY(i), r = Math.hypot(P.getX(i), yy, P.getZ(i)), k = Math.max(0, Math.min(1, (yy + 1) / 2)), crease = Math.max(0, Math.min(1, (1.04 - r) * 6));   // crease: the dips between the lumps
        C2.copy(CC).multiplyScalar((1 - (dark == null ? 0.42 : dark) * (1 - k) * (1 - k)) * (1 - 0.22 * crease)); C2.lerp(SUNNY, 0.22 * k * k); C2.lerp(COOL, 0.12 * (1 - k)); col[i * 3] = C2.r; col[i * 3 + 1] = C2.g; col[i * 3 + 2] = C2.b; }
      g.setAttribute('color', new T.BufferAttribute(col, 3)); put(bin, place(g, x, y, z, li * 1.3 + mi, sx, sy, sz)); }
    const SUNNY = new T.Color('#e8f58a'), COOL = new T.Color('#2f7f8f');
    const blobShadowT = ctex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(30,70,40,0.5)'); gr.addColorStop(0.6, 'rgba(30,70,40,0.28)'); gr.addColorStop(1, 'rgba(30,70,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const blobShadowM = new T.MeshBasicMaterial({ map: blobShadowT, transparent: true, depthWrite: false });
    const groundShadow = (x, z, rx, rz) => { const m = new T.Mesh(new T.PlaneGeometry(rx * 2, rz * 2), blobShadowM); m.rotation.x = -PI / 2; m.position.set(x + rx * 0.25, KERB + 0.004, z - rz * 0.25); m.renderOrder = 1; scene.add(m); };
    // hedge behind the wall, with flowers; gaps at the gates
    (function () { const R = rng(21), FL = ['#ff6fa8', '#ffffff', '#ffd23f', '#ff8a5c'];
      for (let x = -34; x < 35; x += 1.3) { const r = 0.92 + R() * 0.26, xx = x + R() * 0.3, zz = -5.15 - R() * 0.3, yy = KERB + 0.78 + R() * 0.2, li = Math.floor(R() * 3), mi = Math.floor(R() * 3); if (inGate(xx, 0.75)) continue;
        blob('veg', xx, yy, zz, r, r * (0.9 + R() * 0.2), r * 0.9, li, mi);
        for (let i = 0; i < 3; i++) { const a = (R() - 0.5) * 1.6, e = 0.15 + R() * 0.75, fr = 0.07 + R() * 0.03, s = new T.SphereGeometry(fr, 8, 6); tint(s, FL[Math.floor(R() * 4)], 0.1, 0.2); put('veg', place(s, xx + Math.sin(a) * Math.cos(e) * r * 0.97, yy + Math.sin(e) * r * 0.95, zz + Math.cos(a) * Math.cos(e) * r * 0.86)); } } })();
    function tree(x, z, k, mi) { const tr = new T.CylinderGeometry(0.16 * k, 0.3 * k, 3 * k, 12); tint(tr, '#a8744a', 0.25, 0.1); put('veg', place(tr, x, KERB + 1.5 * k, z));
      blob('veg', x, KERB + 4.1 * k, z, 1.9 * k, 1.7 * k, 1.8 * k, mi, mi); blob('veg', x - 1.2 * k, KERB + 3.5 * k, z + 0.3 * k, 1.3 * k, 1.2 * k, 1.3 * k, mi + 1, mi + 2); blob('veg', x + 1.25 * k, KERB + 3.6 * k, z + 0.2 * k, 1.35 * k, 1.25 * k, 1.3 * k, mi + 2, mi + 1); blob('veg', x + 0.2 * k, KERB + 5.2 * k, z - 0.2 * k, 1.2 * k, 1.1 * k, 1.2 * k, mi, mi + 2);
      groundShadow(x, z, 2.9 * k, 1.9 * k); }
    tree(-6.6, -11.5, 1.0, 0); tree(3.6, -13.5, 1.05, 1); tree(15.5, -11, 1.1, 2); tree(-17.5, -11, 1.2, 1); tree(16, -27, 1.6, 0); tree(-17, -28, 1.6, 2); tree(30, -24, 1.5, 1); tree(-31, -22, 1.5, 0);
    (function () { const R = rng(31); for (let x = -80; x < 80; x += 5.5) blob('veg', x + R() * 2, 2 + R(), -38 - R() * 4, 4 + R() * 1.5, 3.5 + R() * 2, 3, Math.floor(R() * 3), Math.floor(R() * 4), 0.3);
      for (const [x, r] of [[-64, 36], [6, 44], [74, 38]]) { const h = new T.SphereGeometry(r, 32, 12, 0, PI * 2, 0, PI / 2); h.scale(1, 0.36, 1); tint(h, '#86d264', 0.25, 0.12); put('veg', place(h, x, -1, -90)); } })();
    // far side of the road (z > 11: behind the default camera, it only shows in shots that look along the street) and the street's two ends
    (function () { const R = rng(47); put('stone', tint(place(rbox(140, KERB + 0.1, 0.34, 0.03), 0, KERB / 2 - 0.05, ROAD1 + 0.15), '#cfd3d8', 0.12, 0.15));
      for (let x = -66; x < 67; x += 1.5) blob('veg', x + R() * 0.4, KERB + 0.9 + R() * 0.25, 27 + R() * 0.5, 1.15 + R() * 0.3, 1.1 + R() * 0.3, 1.0, Math.floor(R() * 3), Math.floor(R() * 3));
      for (const [x, z, k, mi] of [[-40, 31, 1.5, 0], [-22, 34, 1.7, 1], [-6, 31, 1.4, 2], [11, 35, 1.8, 0], [27, 31, 1.5, 1], [44, 34, 1.7, 2]]) tree(x, z, k, mi);
      for (let x = -80; x < 80; x += 6) blob('veg', x + R() * 2, 2.5 + R(), 52 + R() * 4, 4.5 + R() * 1.5, 4 + R() * 2, 3, Math.floor(R() * 3), Math.floor(R() * 4), 0.3);
      for (const [x, z, r] of [[-50, 100, 40], [30, 104, 46], [-112, -6, 34], [112, -8, 34], [-104, 40, 30], [104, 44, 30]]) { const h = new T.SphereGeometry(r, 32, 12, 0, PI * 2, 0, PI / 2); h.scale(1, 0.36, 1); tint(h, '#86d264', 0.25, 0.12); put('veg', place(h, x, -1, z)); } })();
    flush('veg', lam('#ffffff', { vertexColors: true }), false, false);

    // ---------------------------------------------------------------- houses: one merged mesh, colours and soft shading baked per vertex
    function house(x, z, w, h, d, wallC, roofC, doorC, trimC, ry) {
      const parts = [], add = (g, color, dark, light, px, py, pz, rz) => { tint(g, color, dark, light); parts.push(place(g, px, py, pz, 0, 1, 1, 1, rz)); };
      add(rbox(w, h, d, 0.06), wallC, 0.2, 0.08, 0, h / 2, 0); add(box(w + 0.16, 0.5, d + 0.16), wallC, 0.34, -0.3, 0, 0.25, 0);                                  // body + darker plinth
      const rh = w * 0.42, sh = new T.Shape(); sh.moveTo(-w / 2 * 0.985, 0); sh.lineTo(w / 2 * 0.985, 0); sh.lineTo(0, rh * 0.985); sh.closePath();
      { const g = new T.ExtrudeGeometry(sh, { depth: d - 0.04, bevelEnabled: false }); g.translate(0, 0, -(d - 0.04) / 2); add(g, wallC, 0.0, 0.12, 0, h, 0); }
      const sl = Math.hypot(w / 2 + 0.45, rh * (1 + 0.9 / w)) + 0.1, an = Math.atan2(rh, w / 2);
      for (const s of [-1, 1]) { const cx = s * (w / 4 + 0.16), cy = h + rh / 2 - 0.02; add(rbox(sl, 0.2, d + 0.9, 0.05), roofC, 0.12, 0.1, cx, cy + 0.1, 0, -s * an); add(rbox(sl - 0.25, 0.13, 0.1, 0.03), trimC, 0.05, 0, cx - s * 0.02, cy - 0.06, d / 2 + 0.03, -s * an); }   // roof slabs + white bargeboards on the gable
      add(rbox(0.66, 1.6, 0.66, 0.05), wallC, 0.22, 0.05, w * 0.27, h + rh * 0.66, -d * 0.15); add(rbox(0.8, 0.14, 0.8, 0.04), trimC, 0.05, 0, w * 0.27, h + rh * 0.66 + 0.83, -d * 0.15);
      const fz = d / 2;
      add(rbox(1.25, 2.15, 0.14, 0.05), trimC, 0.1, 0, -w * 0.22, 1.05, fz + 0.01); add(rbox(0.98, 1.92, 0.16, 0.05), doorC, 0.3, 0.12, -w * 0.22, 1.0, fz + 0.04);
      add(new T.SphereGeometry(0.06, 10, 8), '#ffd76a', 0.2, 0.3, -w * 0.22 + 0.32, 1.0, fz + 0.14); add(rbox(1.7, 0.16, 0.7, 0.05), '#e7dcc6', 0.2, 0, -w * 0.22, 0.08, fz + 0.35);                      // knob, step
      add(rbox(1.85, 0.14, 0.85, 0.04), roofC, 0.15, 0.1, -w * 0.22, 2.34, fz + 0.34, 0); for (const s of [-1, 1]) add(rbox(0.1, 2.14, 0.1, 0.03), trimC, 0.12, 0, -w * 0.22 + s * 0.78, 1.2, fz + 0.66);                                                                                                  // porch canopy
      const win = (wx, wy, ww, wh, shutters) => { add(rbox(ww + 0.24, wh + 0.24, 0.14, 0.04), trimC, 0.12, 0, wx, wy, fz + 0.01); add(rbox(ww, wh, 0.16, 0.03), '#7fc4f2', 0.38, 0.5, wx, wy, fz + 0.03);
        add(box(0.07, wh, 0.18), trimC, 0.05, 0, wx, wy, fz + 0.03); add(box(ww, 0.07, 0.18), trimC, 0.05, 0, wx, wy + wh * 0.12, fz + 0.03); add(rbox(ww + 0.44, 0.1, 0.26, 0.03), trimC, 0.15, 0, wx, wy - wh / 2 - 0.15, fz + 0.08);
        if (shutters) for (const s of [-1, 1]) add(rbox(0.36, wh + 0.16, 0.08, 0.02), doorC, 0.25, 0.1, wx + s * (ww / 2 + 0.33), wy, fz + 0.02);
        else { add(rbox(ww + 0.3, 0.2, 0.26, 0.04), '#b9703f', 0.2, 0, wx, wy - wh / 2 - 0.02, fz + 0.14); for (let i = 0; i < 5; i++) { add(new T.SphereGeometry(0.11, 8, 6), i % 2 ? '#ff6fa8' : '#ffd23f', 0.15, 0.2, wx + (i - 2) * ww * 0.2, wy - wh / 2 + 0.13, fz + 0.16); } } };
      win(w * 0.2, h * 0.5, 1.35, 1.25, true); win(0, h + rh * 0.36, 0.95, 0.95, false); if (h * 0.8 > 2.6) win(-w * 0.22, h * 0.82 + 0.25, 0.8, 0.6, false);
      const m = M4.compose(V3(x, KERB, z), Q.setFromEuler(new T.Euler(0, ry || 0, 0)), ONE).clone(); for (const g of parts) put('house', g.applyMatrix4(m));
      groundShadow(x + 0.6, z - 0.6, w * 0.75, d * 0.8);
    }
    house(-10.4, -15.5, 6.4, 3.7, 5.5, '#ffdf7e', '#e0603f', '#3f8fd0', '#fffaf0', 0.06);
    house(8.3, -16.5, 6.8, 4.0, 5.5, '#fbb39a', '#5b82b4', '#2fa58f', '#fff8ec', -0.08);
    house(23, -17.5, 6.2, 3.7, 5.5, '#aee6d4', '#d06a50', '#f2b23e', '#fffaf0', -0.2);
    house(-25, -18.5, 6.6, 3.9, 5.5, '#cfe0fa', '#8d6f96', '#e86a5a', '#fffaf0', 0.2);
    flush('house', lam('#ffffff', { vertexColors: true }), false, false);

    // ---------------------------------------------------------------- street furniture on the pavement (behind the lane)
    (function () { const lx = -6.4, lz = -2.75, px = 5.3, pz = -2.9;
      put('prop', tint(place(new T.CylinderGeometry(0.11, 0.16, 0.5, 14), lx, KERB + 0.25, lz), '#3d7a6c', 0.2, 0.1)); put('prop', tint(place(new T.CylinderGeometry(0.055, 0.075, 3.5, 12), lx, KERB + 2.2, lz), '#3d7a6c', 0.15, 0.15));
      put('prop', tint(place(new T.CylinderGeometry(0.09, 0.09, 0.08, 12), lx, KERB + 3.95, lz), '#3d7a6c', 0, 0)); put('prop', tint(place(new T.CylinderGeometry(0.24, 0.15, 0.42, 14), lx, KERB + 4.2, lz), '#fff6cf', 0.05, 0.4)); put('prop', tint(place(new T.ConeGeometry(0.32, 0.2, 14), lx, KERB + 4.51, lz), '#3d7a6c', 0.1, 0.15)); put('prop', tint(place(new T.SphereGeometry(0.05, 8, 6), lx, KERB + 4.64, lz), '#3d7a6c', 0, 0));
      put('prop', tint(place(new T.CylinderGeometry(0.27, 0.27, 1.05, 20), px, KERB + 0.6, pz), '#e8483f', 0.25, 0.12)); put('prop', tint(place(new T.CylinderGeometry(0.3, 0.3, 0.14, 20), px, KERB + 0.07, pz), '#33363f', 0, 0.1)); { const cap = new T.SphereGeometry(0.31, 20, 10, 0, PI * 2, 0, PI / 2); cap.scale(1, 0.55, 1); put('prop', tint(place(cap, px, KERB + 1.12, pz), '#e8483f', 0.05, 0.2)); }
      put('prop', tint(place(box(0.26, 0.045, 0.04), px, KERB + 0.95, pz + 0.265), '#33363f', 0, 0)); put('prop', tint(place(box(0.2, 0.16, 0.02), px, KERB + 0.7, pz + 0.27), '#fff3dc', 0, 0));
      flush('prop', lam('#ffffff', { vertexColors: true }), true, false); })();
    flush('stone', lam('#ffffff', { vertexColors: true }), true, true);

    return { scene, camera, sun, aimSun, info: { laneZ: [LANE0, LANE1], kerbY: KERB, wallZ: WZ, curie: [-3, 0, 1.2], ride: [-9, 9], gates: GATES } };
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Curie's Toy Workshop: the set for "How things work" (theme A), with its lights and camera.
   L.three.kits.workshop(T, L3) -> world = {
     scene, camera (PerspectiveCamera, fov 32, at the wide shot),
     sun          the one shadow-casting key light (DirectionalLight, from the window side: upper right, a little to the front),
     turntable    Group centred on the origin (its own origin is on the FLOOR, y = 0); turntable.rotation.y may be animated.
                  Put the object on it at y = world.floorY (as a child of the turntable to turn with it, or in the scene).
     floorY       height of the turntable's top surface (0.15);  ttRadius = 3.0 (usable flat top: 2.85)
     curieSpot    { x: -3.6, z: 1.4 } (floor level, y = 0: she stands on the rug beside the turntable)
     upper        Group with everything above the wainscot (pegboard, shelves, window): hide it in low close-ups to save time
     beam, pool   the window sunbeam (Mesh) and the light-pool decals (array of Mesh): hide them if they get in the way
     rim, hemi    the other lights (no shadows)
     shots        { wide, low, lowL, lowR, curie } camera presets for L3.shoot(world, shot) / L3.mix(a, b, k) }
   Layout: back wall at z = -3.6, floor y = 0, pegboard above the turntable, workbench and shelves on the left (behind Curie),
   round window on the right. Everything is static and merged per material; nothing comes closer than 3 units to the origin
   above y = 0.2, so a 4.4-long object can turn freely on the turntable. */
(function (global) {
  const L = global.LSC; if (!L || !L.three) return;
  L.three.kits.workshop = function (T, L3) {
    const P = Math.PI;
    const PAL = { honey: '#E3A857', wall: '#FFF2DA', sage: '#A9D3C8', peg: '#EFD9AE', red: '#E8323C', blue: '#1E9BFF', gold: '#FFC31F', pink: '#FF3F8E', purple: '#5A4FA0', teal: '#22A7A0', mustard: '#F7B92B', cream: '#FFF4DC' };
    // ---------- helpers
    function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const mesh = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; };
    const MC = {}; const memo = (k, color, o, f) => { if (o && Object.values(o).some(v => v && typeof v === 'object')) return f(); const key = k + color + JSON.stringify(o || 0); return MC[key] || (MC[key] = f()); };
    // set dressing is Phong (a toy-plastic highlight, no environment map): env-mapped PBR on the props cost about 200 ms a frame in the software renderer
    const std = (color, o) => memo('s', color, o, () => { o = Object.assign({ roughness: 0.55, metalness: 0 }, o || {}); const metal = o.metalness > 0.5, k = 1 - o.roughness;
      return new T.MeshPhongMaterial({ color: metal ? new T.Color(color).multiplyScalar(0.8) : color, specular: new T.Color(metal ? '#ffffff' : '#fff6e8').multiplyScalar(metal ? 0.9 : 0.12 + 0.5 * k * k), shininess: metal ? 70 : 12 + 110 * k * k, emissive: new T.Color(color).multiplyScalar(metal ? 0.14 : 0.09) }); });
    const matte = (color, o) => memo('l', color, o, () => new T.MeshLambertMaterial(Object.assign({ color }, o || {})));
    const candy = (color, o) => std(color, Object.assign({ roughness: 0.22 }, o || {}));
    const add = (p, o, x, y, z) => { if (x !== undefined) o.position.set(x, y, z); p.add(o); return o; };
    function canvasTex(w, h, fn, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 1; if (repeat) { tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(repeat[0], repeat[1]); } return tx; }
    // merge every static mesh under root into one mesh per material (far fewer draw calls: the renderer is CPU-only)
    function mergeStatic(root) {
      root.updateMatrixWorld(true); const inv = new T.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), list = [], mtx = new T.Matrix4();
      root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.keep && !Array.isArray(o.material)) list.push(o); });
      for (const o of list) { const key = o.material.uuid + '|' + o.castShadow + '|' + o.receiveShadow + '|' + o.renderOrder; let e = groups.get(key); if (!e) groups.set(key, e = { o, parts: [], n: 0 });
        const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); ge.applyMatrix4(mtx.multiplyMatrices(inv, o.matrixWorld)); e.parts.push(ge); e.n += ge.attributes.position.count; o.parent.remove(o); }
      for (const e of groups.values()) { const pos = new Float32Array(e.n * 3), nor = new Float32Array(e.n * 3), uv = new Float32Array(e.n * 2); let k = 0;
        for (const ge of e.parts) { pos.set(ge.attributes.position.array, k * 3); nor.set(ge.attributes.normal.array, k * 3); if (ge.attributes.uv) uv.set(ge.attributes.uv.array, k * 2); k += ge.attributes.position.count; ge.dispose(); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
        const m = new T.Mesh(g, e.o.material); m.castShadow = e.o.castShadow; m.receiveShadow = e.o.receiveShadow; m.renderOrder = e.o.renderOrder; m.userData.keep = true; root.add(m); }
    }
    // rounded box (rounded on every edge)
    function rb(w, h, d, r, m) {
      r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3); const iw = w - 2 * r, ih = h - 2 * r, c = Math.min(r * 0.9, iw / 2, ih / 2), s = new T.Shape(), x = -iw / 2, y = -ih / 2;
      if (c > 2e-3) { s.moveTo(x + c, y); s.lineTo(x + iw - c, y); s.absarc(x + iw - c, y + c, c, -P / 2, 0, false); s.lineTo(x + iw, y + ih - c); s.absarc(x + iw - c, y + ih - c, c, 0, P / 2, false); s.lineTo(x + c, y + ih); s.absarc(x + c, y + ih - c, c, P / 2, P, false); s.lineTo(x, y + c); s.absarc(x + c, y + c, c, P, 1.5 * P, false); }
      else { s.moveTo(x, y); s.lineTo(x + iw, y); s.lineTo(x + iw, y + ih); s.lineTo(x, y + ih); s.lineTo(x, y); }
      const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 }); g.translate(0, 0, -(d - 2 * r) / 2); return mesh(g, m);
    }
    const ball = (parent, p, r, m) => add(parent, mesh(new T.SphereGeometry(r, 16, 10), m), p[0], p[1], p[2]);
    // wood planks texture (tiles seamlessly); planks run along u
    function woodTex(seed, o) {
      o = Object.assign({ rows: 8, h: 33, s: 66, l: 62, jit: 4, seam: 0.32, size: 1024, grain: 22 }, o || {});
      return canvasTex(o.size, o.size, (g, S) => { const r = rng(seed), ph = S / o.rows;
        for (let i = 0; i < o.rows; i++) { const x0 = r() * S, a = S * (0.35 + 0.3 * r()); const planks = [[x0, a], [x0 + a, S - a]];
          for (const [px, len] of planks) { const ll = o.l + (r() - 0.5) * 2 * o.jit, hh = o.h + (r() - 0.5) * 5; const lines = []; for (let k = 0; k < o.grain; k++) lines.push([r() * ph, r() * 6.3, 0.006 + r() * 0.01, 1 + r() * 2.5, 0.05 + r() * 0.1, 6 + r() * 12]);
            for (const off of [0, -S]) { g.save(); g.beginPath(); g.rect(px + off, i * ph, len, ph); g.clip(); g.fillStyle = `hsl(${hh},${o.s}%,${ll}%)`; g.fillRect(px + off, i * ph, len, ph);
              for (const [y0, p0, f, amp, al, dk] of lines) { g.strokeStyle = `hsla(${hh - 5},${o.s}%,${ll - dk}%,${al})`; g.lineWidth = 1.5; g.beginPath(); for (let xx = 0; xx <= len; xx += 24) { const yy = i * ph + y0 + Math.sin(xx * f + p0) * amp; xx ? g.lineTo(px + off + xx, yy) : g.moveTo(px + off + xx, yy); } g.stroke(); }
              g.fillStyle = `rgba(90,45,10,${o.seam})`; g.fillRect(px + off, i * ph, 3, ph); g.restore(); } }
          g.fillStyle = `rgba(90,45,10,${o.seam})`; g.fillRect(0, i * ph, S, 3); g.fillStyle = 'rgba(255,240,210,0.22)'; g.fillRect(0, i * ph + 3, S, 2); }
      });
    }
    function gearGeo(N, r, o) {
      o = Object.assign({ root: 0.016, tip: 0.02, thick: 0.026, holes: [], bevel: 0.004 }, o || {}); const s = new T.Shape(), st = 2 * P / N, rr = r - o.root, rt = r + o.tip, pts = [];
      for (let i = 0; i < N; i++) for (const [f, rad] of [[0.25, rr], [0.36, rt - o.tip * 0.35], [0.42, rt], [0.58, rt], [0.64, rt - o.tip * 0.35], [0.75, rr]]) { const a = (i + f) * st; pts.push(new T.Vector2(Math.cos(a) * rad, Math.sin(a) * rad)); }
      s.setFromPoints(pts); for (const [hx, hy, hr] of o.holes) { const h = new T.Path(); h.absarc(hx, hy, hr, 0, P * 2, true); s.holes.push(h); }
      const g = new T.ExtrudeGeometry(s, { depth: o.thick - 2 * o.bevel, bevelEnabled: true, bevelThickness: o.bevel, bevelSize: o.bevel, bevelSegments: 1, curveSegments: 10 }); g.translate(0, 0, -(o.thick - 2 * o.bevel) / 2); return g;
    }
    const ringHoles = (n, rad, hr) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * 6.2832) * rad, Math.sin(i / n * 6.2832) * rad, hr]);

    const scene = new T.Scene(); scene.background = new T.Color('#F6E8CF');
    const camera = new T.PerspectiveCamera(32, 16 / 9, 0.5, 80);
    const WZ = -3.6, TT = 0.15, TR = 3.0, WAIN = 2.0;
    const WIN = new T.Vector3(4.1, 3.25, WZ + 0.1), WR = 1.1, POOL = new T.Vector3(1.55, TT, 0.55), sunDir = POOL.clone().sub(WIN).normalize();

    // ---------- lights: warm key from the window side (the only shadow caster), sky/bounce fill, rim from behind the window.
    // (A third, front fill light was tried: about 100 ms a frame for no visible gain.)
    const hemi = new T.HemisphereLight('#DCEBFF', '#F0C38C', 0.84); scene.add(hemi);
    const sun = new T.DirectionalLight('#FFE3B8', 3.0); sun.position.set(8, 9.5, 5.4); sun.target.position.set(-0.6, 0.8, -0.4); sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -9.5, right: 8.5, top: 6.5, bottom: -6, near: 2, far: 34 }); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2.2; scene.add(sun, sun.target);
    const rim = new T.DirectionalLight('#FFE2B0', 1.2); rim.position.set(6, 7, -9); rim.target.position.set(-0.5, 1, 0); scene.add(rim, rim.target);

    // ---------- the set
    const set = new T.Group(); scene.add(set);
    const floorTx = woodTex(11, { rows: 8, l: 63, s: 64, h: 34 }); floorTx.wrapS = floorTx.wrapT = T.RepeatWrapping; floorTx.repeat.set(7, 7); floorTx.center.set(0.5, 0.5); floorTx.rotation = P / 2;
    const floor = mesh(new T.PlaneGeometry(44, 44), matte('#fff', { map: floorTx })); floor.rotation.x = -P / 2; floor.position.set(0, 0, 8); floor.castShadow = false; floor.renderOrder = 4; set.add(floor);
    const benchTx = woodTex(5, { rows: 5, l: 66, h: 35, size: 512, grain: 12 }); benchTx.wrapS = benchTx.wrapT = T.RepeatWrapping; benchTx.repeat.set(0.5, 0.5);
    const woodM = matte('#fff', { map: benchTx }), woodDark = matte('#C98B45'), woodPale = matte('#F2CF95'), sageM = matte('#93C4B8');
    const steel = std('#CFD5DE', { metalness: 1, roughness: 0.32 });
    // back wall: plaster (a soft vertical gradient: warmer and darker towards the ceiling), sage wainscot, cap rail, baseboard
    const wallTx = canvasTex(8, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#F3DFBE'); gr.addColorStop(0.45, '#FFF2DA'); gr.addColorStop(1, '#FFF4E0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
    const wall = mesh(new T.PlaneGeometry(40, 9), matte('#fff', { map: wallTx }), 0, 4.5, WZ); wall.castShadow = false; wall.renderOrder = 4; set.add(wall);
    const slatTx = canvasTex(256, 64, (g, W, H) => { g.fillStyle = PAL.sage; g.fillRect(0, 0, W, H); const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,40,30,0.30)'); gr.addColorStop(0.04, 'rgba(255,255,255,0.20)'); gr.addColorStop(0.1, 'rgba(255,255,255,0)'); gr.addColorStop(0.94, 'rgba(0,40,30,0)'); gr.addColorStop(1, 'rgba(0,40,30,0.22)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }, [58, 1]);
    const wains = mesh(new T.PlaneGeometry(40, WAIN), matte('#fff', { map: slatTx }), 0, WAIN / 2, WZ + 0.04); wains.castShadow = false; wains.renderOrder = 3; set.add(wains);
    add(set, rb(40, 0.14, 0.16, 0.05, sageM), 0, WAIN + 0.04, WZ + 0.09); add(set, rb(40, 0.26, 0.1, 0.04, sageM), 0, 0.13, WZ + 0.07);
    // pegboard with chunky tools
    const pegTx = canvasTex(512, 512, (g, S) => { g.fillStyle = PAL.peg; g.fillRect(0, 0, S, S); const r = rng(3); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(150,105,50,${0.03 + r() * 0.04})`; g.fillRect(r() * S, r() * S, 2 + r() * 10, 1.5); } const n = 12, st = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = (i + 0.5) * st, y = (j + 0.5) * st; g.fillStyle = 'rgba(255,250,235,0.7)'; g.beginPath(); g.arc(x + 1.2, y + 1.8, 6.6, 0, 7); g.fill(); g.fillStyle = '#8A6238'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.fillStyle = '#5E4022'; g.beginPath(); g.arc(x - 0.8, y - 1, 4.2, 0, 7); g.fill(); } }, [2.4, 1.0]);
    const PB = { x: -0.5, y: 3.44, w: 5.4, h: 2.24 };
    const peg = mesh(new T.PlaneGeometry(PB.w, PB.h), matte('#fff', { map: pegTx }), PB.x, PB.y, WZ + 0.08); peg.castShadow = false; peg.renderOrder = 3; set.add(peg);
    add(set, rb(PB.w + 0.24, 0.16, 0.16, 0.05, woodM), PB.x, PB.y + PB.h / 2 + 0.04, WZ + 0.1); add(set, rb(PB.w + 0.24, 0.16, 0.16, 0.05, woodM), PB.x, PB.y - PB.h / 2 - 0.04, WZ + 0.1);
    add(set, rb(0.16, PB.h + 0.2, 0.16, 0.05, woodM), PB.x - PB.w / 2 - 0.04, PB.y, WZ + 0.1); add(set, rb(0.16, PB.h + 0.2, 0.16, 0.05, woodM), PB.x + PB.w / 2 + 0.04, PB.y, WZ + 0.1);
    (function () {
      const tools = new T.Group(); tools.position.set(PB.x, PB.y, WZ + 0.2); set.add(tools);
      const pin = (x, y) => { const p = mesh(new T.CylinderGeometry(0.03, 0.03, 0.22, 10), steel, x, y, 0); p.rotation.x = P / 2; tools.add(p); };
      const blueM = candy('#2D8CF0'), redM = candy(PAL.red), yelM = candy(PAL.mustard), tealM = candy(PAL.teal);
      const w = new T.Group(); w.add(rb(0.17, 0.9, 0.08, 0.035, blueM)); const h1 = mesh(new T.TorusGeometry(0.17, 0.065, 12, 24, P * 1.45), blueM, 0, 0.57, 0); h1.rotation.z = P / 2 + P * 0.275; w.add(h1); w.add(mesh(new T.TorusGeometry(0.12, 0.055, 12, 24), blueM, 0, -0.55, 0)); w.position.set(-2.1, 0.05, 0.02); w.rotation.z = 0.12; tools.add(w); pin(-2.13, -0.43);
      const hm = new T.Group(); hm.add(mesh(new T.CylinderGeometry(0.055, 0.065, 1.05, 16), woodPale)); const hh = rb(0.56, 0.24, 0.22, 0.07, redM); hh.position.y = 0.55; hm.add(hh); hm.position.set(-1.25, -0.02, 0.03); hm.rotation.z = -0.1; tools.add(hm); pin(-1.45, 0.4); pin(-1.0, 0.4);
      for (const [x, c, sc] of [[-0.42, yelM, 1], [0.03, tealM, 0.85]]) { const sd = new T.Group(); sd.add(mesh(new T.CapsuleGeometry(0.1, 0.3, 8, 16), c, 0, 0.3, 0)); sd.add(mesh(new T.CylinderGeometry(0.028, 0.028, 0.6, 10), steel, 0, -0.25, 0)); sd.add(rb(0.07, 0.1, 0.02, 0.008, steel)).position.y = -0.58; sd.scale.setScalar(sc); sd.position.set(x, 0.12, 0.05); tools.add(sd); pin(x, 0.12 + 0.06 * sc); }
      const g1 = mesh(gearGeo(12, 0.34, { root: 0.05, tip: 0.06, thick: 0.08, bevel: 0.012, holes: [[0, 0, 0.09]].concat(ringHoles(6, 0.19, 0.055)) }), candy('#FFC21A', { metalness: 0.25 }), 1.1, 0.5, 0); tools.add(g1); pin(1.1, 0.5);
      const g2 = mesh(gearGeo(9, 0.22, { root: 0.045, tip: 0.05, thick: 0.08, bevel: 0.012, holes: [[0, 0, 0.07]] }), tealM, 1.95, 0.62, 0); g2.rotation.z = 0.2; tools.add(g2); pin(1.95, 0.62);
      const g3 = mesh(gearGeo(8, 0.17, { root: 0.04, tip: 0.045, thick: 0.08, bevel: 0.012, holes: [[0, 0, 0.055]] }), candy('#FF8A3D'), 0.7, -0.12, 0); tools.add(g3); pin(0.7, -0.12);
      const ty = new T.Group(); ty.add(mesh(new T.TorusGeometry(0.44, 0.085, 16, 48), std('#343A4A', { roughness: 0.85 }))); ty.add(mesh(new T.TorusGeometry(0.44, 0.02, 8, 48), std(PAL.cream, { roughness: 0.6 }), 0, 0, 0.075)); ty.position.set(1.98, -0.45, 0.04); tools.add(ty); pin(1.98, -0.02);
      const ru = rb(1.5, 0.16, 0.04, 0.015, yelM); ru.position.set(-1.45, -0.9, 0); tools.add(ru); for (let i = 0; i < 14; i++) tools.add(mesh(new T.BoxGeometry(0.012, i % 2 ? 0.05 : 0.08, 0.01), std('#6B4A12'), -2.1 + i * 0.1, -0.85, 0.022));
      const sp = new T.Group(); sp.add(rb(0.13, 0.85, 0.07, 0.03, redM)); sp.add(mesh(new T.TorusGeometry(0.13, 0.05, 12, 24), redM, 0, 0.5, 0)); sp.add(mesh(new T.TorusGeometry(0.1, 0.045, 12, 24), redM, 0, -0.48, 0)); sp.position.set(0.55, -0.72, 0.02); sp.rotation.z = 1.25; tools.add(sp);
    })();
    // round window with sky
    const skyTx = canvasTex(512, 512, (g, S) => { const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#7CC6FF'); gr.addColorStop(0.6, '#CDEBFF'); gr.addColorStop(0.75, '#F4FBFF'); g.fillStyle = gr; g.fillRect(0, 0, S, S); const sg = g.createRadialGradient(S * 0.68, S * 0.26, 0, S * 0.68, S * 0.26, S * 0.5); sg.addColorStop(0, 'rgba(255,250,215,1)'); sg.addColorStop(0.16, 'rgba(255,244,190,0.85)'); sg.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = sg; g.fillRect(0, 0, S, S); g.fillStyle = 'rgba(255,255,255,0.95)'; for (const [x, y, r] of [[120, 250, 40], [165, 232, 52], [215, 252, 38], [330, 330, 30], [368, 318, 40], [405, 334, 28]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } g.fillStyle = '#8FD46A'; g.beginPath(); g.ellipse(170, 520, 330, 150, 0, 0, 7); g.fill(); g.fillStyle = '#6FC25A'; g.beginPath(); g.ellipse(430, 540, 260, 140, 0, 0, 7); g.fill(); });
    const glass = new T.Mesh(new T.CircleGeometry(WR, 64), new T.MeshBasicMaterial({ map: skyTx, color: new T.Color(1.35, 1.3, 1.2) })); glass.position.set(WIN.x, WIN.y, WZ + 0.03); glass.userData.keep = true; set.add(glass);
    const wf = mesh(new T.TorusGeometry(WR + 0.06, 0.13, 10, 48), woodM, WIN.x, WIN.y, WZ + 0.1); wf.castShadow = false; set.add(wf);
    for (const rot of [0, P / 2]) { const b = rb(2 * WR, 0.11, 0.1, 0.035, woodM); b.rotation.z = rot; b.castShadow = false; add(set, b, WIN.x, WIN.y, WZ + 0.1); }
    // sunbeam (faint additive shaft) from the window down to the light pool
    const beam = (function () { const len = WIN.distanceTo(POOL) - 0.2; const g = new T.CylinderGeometry(WR * 0.95, WR * 1.25, len, 40, 1, true);
      const gt = canvasTex(8, 256, (c, W, H) => { const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#555555'); gr.addColorStop(1, '#000000'); c.fillStyle = gr; c.fillRect(0, 0, W, H); });
      const b = new T.Mesh(g, new T.MeshBasicMaterial({ color: '#FFD9A0', map: gt, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })); b.position.copy(WIN).addScaledVector(sunDir, len / 2 + 0.1); b.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), sunDir.clone().negate()); b.renderOrder = 5; b.userData.keep = true; scene.add(b); return b; })();
    // jars, tins, books
    const glassM = new T.MeshPhongMaterial({ color: '#EAF7FF', transparent: true, opacity: 0.3, specular: '#ffffff', shininess: 90, depthWrite: false });
    function jar(x, y, z, r, h, lidC, bitsC, seed) { const g = new T.Group(); g.position.set(x, y, z); const R = rng(seed);
      const gl = new T.Mesh(new T.CylinderGeometry(r, r, h, 18, 1, true), glassM); gl.position.y = h / 2; gl.renderOrder = 3; g.add(gl);
      g.add(mesh(new T.CylinderGeometry(r * 1.06, r * 1.06, h * 0.16, 24), candy(lidC), 0, h * 1.05, 0));
      const bm = bitsC.map(c => std(c, { metalness: 0.6, roughness: 0.35 })); for (let i = 0; i < 18; i++) { const a = R() * 6.28, rad = Math.sqrt(R()) * r * 0.72, yy = 0.05 + R() * h * 0.55; const b = R() < 0.5 ? mesh(new T.CylinderGeometry(0.04, 0.04, 0.04, 6), bm[i % bm.length]) : mesh(new T.SphereGeometry(0.04, 6, 4), bm[i % bm.length]); b.position.set(Math.cos(a) * rad, yy, Math.sin(a) * rad); b.rotation.set(R() * 3, R() * 3, R() * 3); b.castShadow = false; g.add(b); }
      set.add(g); return g; }
    function tin(x, y, z, r, h, c, band) { const g = new T.Group(); g.position.set(x, y, z); g.add(mesh(new T.CylinderGeometry(r, r, h, 24), candy(c), 0, h / 2, 0)); g.add(mesh(new T.CylinderGeometry(r * 1.015, r * 1.015, h * 0.3, 24), std(band, { roughness: 0.6 }), 0, h / 2, 0)); g.add(mesh(new T.CylinderGeometry(r * 1.04, r * 1.04, h * 0.08, 24), steel, 0, h, 0)); set.add(g); return g; }
    // workbench (left, behind Curie)
    const BX = -5.75, BTOP = 1.62;
    (function () { const g = new T.Group(); g.position.set(BX, 0, WZ + 0.85); set.add(g); const top = BTOP;
      add(g, rb(4.9, 0.24, 1.5, 0.07, woodM), 0, top - 0.12, 0); for (const sx of [-2.15, 2.15]) for (const sz of [-0.55, 0.55]) add(g, rb(0.26, top - 0.24, 0.26, 0.06, woodDark), sx, (top - 0.24) / 2, sz);
      add(g, rb(4.5, 0.12, 1.2, 0.04, woodDark), 0, 0.42, 0); add(g, rb(4.1, 0.5, 0.1, 0.04, woodPale), 0, top - 0.52, 0.62);
      [-1.35, 0, 1.35].forEach((x, i) => { add(g, rb(1.2, 0.36, 0.06, 0.03, woodM), x, top - 0.52, 0.68); ball(g, [x, top - 0.52, 0.76], 0.075, candy([PAL.red, PAL.mustard, PAL.blue][i])); });
      const tb = candy(PAL.red); add(g, rb(1.1, 0.5, 0.55, 0.08, tb), -0.75, top + 0.25, 0.1); add(g, rb(1.14, 0.1, 0.59, 0.04, candy('#C8232D')), -0.75, top + 0.5, 0.1); g.add(mesh(new T.TorusGeometry(0.2, 0.04, 10, 24, P), steel, -0.75, top + 0.55, 0.1)); add(g, rb(0.16, 0.12, 0.04, 0.02, std(PAL.mustard, { metalness: 0.7, roughness: 0.3 })), -0.75, top + 0.4, 0.39);
      const oc = new T.Group(); oc.add(mesh(new T.CylinderGeometry(0.2, 0.24, 0.3, 24), candy(PAL.mustard), 0, 0.15, 0)); oc.add(mesh(new T.ConeGeometry(0.2, 0.22, 24), candy(PAL.mustard), 0, 0.41, 0)); const spt = mesh(new T.CylinderGeometry(0.018, 0.03, 0.5, 10), steel, 0.2, 0.62, 0); spt.rotation.z = -0.8; oc.add(spt); oc.position.set(0.3, top, 0.2); g.add(oc);
      // a little stool under the bench end and a ball on the floor: something for the low camera to find
      add(g, rb(0.9, 0.5, 0.7, 0.06, woodPale), 1.2, 0.73, 0.05); ball(g, [-1.3, 0.72, 0.1], 0.24, candy(PAL.teal));
    })();
    jar(BX - 1.5, BTOP, WZ + 0.6, 0.26, 0.6, PAL.blue, ['#C9CED8', '#FFC31F'], 21);
    // shelves above the bench
    (function () { const SX = -5.9, S1 = 2.64, S2 = 3.6, Z = WZ + 0.36;
      for (const y of [S1, S2]) { add(set, rb(4.3, 0.12, 0.62, 0.04, woodM), SX, y, Z); for (const x of [SX - 1.8, SX + 1.8]) add(set, rb(0.1, 0.4, 0.5, 0.03, sageM), x, y - 0.22, WZ + 0.3); }
      const a = S1 + 0.06, b = S2 + 0.06;
      jar(SX - 1.55, a, Z + 0.02, 0.3, 0.62, PAL.red, ['#C9CED8', '#9AA3B5'], 1); jar(SX - 0.75, a, Z + 0.02, 0.27, 0.54, PAL.mustard, ['#FFC31F', '#FF8A3D'], 2); jar(SX, a, Z + 0.02, 0.3, 0.64, PAL.teal, ['#58B4F0', '#C9CED8'], 3); jar(SX + 0.85, a, Z + 0.02, 0.25, 0.5, PAL.pink, ['#C9CED8', '#FF6B6B'], 4); tin(SX + 1.55, a, Z + 0.02, 0.22, 0.5, '#58B4F0', PAL.cream);
      tin(SX - 1.65, b, Z + 0.02, 0.24, 0.56, PAL.mustard, PAL.cream); tin(SX - 1.05, b, Z + 0.02, 0.2, 0.42, PAL.red, PAL.cream); jar(SX - 0.25, b, Z + 0.02, 0.3, 0.56, PAL.blue, ['#FFC31F', '#C9CED8'], 5);
      [[PAL.teal, 0.2, 0.68], ['#FF8A3D', 0.16, 0.6], [PAL.purple, 0.22, 0.72], [PAL.red, 0.15, 0.64]].reduce((x, [c, w, h]) => { add(set, rb(w, h, 0.46, 0.03, std(c, { roughness: 0.6 })), x + w / 2, b + h / 2, Z); return x + w + 0.015; }, SX + 0.5);
    })();
    // right-hand corner: crate of balls
    (function () { const g = new T.Group(); g.position.set(5.45, 0, WZ + 0.75); set.add(g); for (let i = 0; i < 3; i++) { add(g, rb(1.5, 0.26, 0.08, 0.03, woodPale), 0, 0.2 + i * 0.32, 0.5); add(g, rb(1.5, 0.26, 0.08, 0.03, woodPale), 0, 0.2 + i * 0.32, -0.5); add(g, rb(0.08, 0.26, 1.0, 0.03, woodPale), -0.72, 0.2 + i * 0.32, 0); add(g, rb(0.08, 0.26, 1.0, 0.03, woodPale), 0.72, 0.2 + i * 0.32, 0); }
      ball(g, [-0.3, 1.1, 0.05], 0.36, candy(PAL.blue)); ball(g, [0.33, 1.05, -0.1], 0.3, candy(PAL.mustard)); ball(g, [0.1, 1.28, 0.25], 0.22, candy(PAL.red)); })();
    // rug
    const RUG = 4.35, rugTx = canvasTex(512, 512, (g, S) => { const c = S / 2; for (const [f, col] of [[1, '#E9D2A6'], [0.965, '#2E9C97'], [0.915, '#F5E6C6'], [0.80, '#F08A5D'], [0.775, '#F5E6C6']]) { g.fillStyle = col; g.beginPath(); g.arc(c, c, c * f, 0, 7); g.fill(); } const r = rng(8); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '120,80,40'},0.06)`; g.fillRect(r() * S, r() * S, 3, 3); } });
    const rug = mesh(new T.CircleGeometry(RUG, 72), matte('#fff', { map: rugTx }), 0, 0.02, 0); rug.rotation.x = -P / 2; rug.castShadow = false; rug.renderOrder = 3; set.add(rug);
    const rugEdge = mesh(new T.TorusGeometry(RUG, 0.035, 6, 72), matte('#E2C690'), 0, 0.015, 0); rugEdge.rotation.x = P / 2; rugEdge.castShadow = false; set.add(rugEdge);
    add(set, mesh(new T.CylinderGeometry(TR - 0.2, TR - 0.2, 0.06, 56), woodDark), 0, 0.03, 0);

    // ---------- turntable (its own group, so it can turn): wooden top, teal edge, cream studs and a ring of painted ticks
    const turntable = new T.Group(); scene.add(turntable);
    (function () { const ttTx = woodTex(31, { rows: 6, l: 71, h: 37, s: 58, size: 512, grain: 10, seam: 0.2 }); const topM = matte('#fff', { map: ttTx });   // Lambert on purpose: a glossy flat top mirrors the studio's ceiling lamp and washes out the shadows
      const disc = mesh(new T.CylinderGeometry(TR, TR, TT - 0.03, 72), [candy(PAL.teal), topM, woodDark], 0, (TT - 0.03) / 2 + 0.03, 0); disc.castShadow = false; disc.renderOrder = 2; disc.userData.keep = true; turntable.add(disc);
      const r2 = mesh(new T.TorusGeometry(TR, 0.045, 8, 80), candy(PAL.teal), 0, TT - 0.045, 0); r2.rotation.x = P / 2; turntable.add(r2);
      const line = mesh(new T.RingGeometry(TR - 0.34, TR - 0.3, 72), matte('#D9A862'), 0, TT + 0.002, 0); line.rotation.x = -P / 2; line.castShadow = false; turntable.add(line);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; const d = mesh(new T.SphereGeometry(0.05, 12, 8), std(i % 4 ? PAL.cream : '#FF8A3D', { roughness: 0.4 }), Math.cos(a) * (TR - 0.16), TT - 0.01, Math.sin(a) * (TR - 0.16)); d.scale.y = 0.35; d.castShadow = false; turntable.add(d); }
      mergeStatic(turntable); })();

    // sunlight pool from the window (cheap additive decals: one on the floor, one on the turntable top; they do not turn)
    const pool = (function () { const tx = canvasTex(256, 256, (g, S) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.filter = 'blur(7px)'; g.fillStyle = '#fff'; g.beginPath(); g.arc(S / 2, S / 2, S * 0.4, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(S / 2 - 7, 0, 14, S); g.fillRect(0, S / 2 - 7, S, 14); g.filter = 'none'; });
      const m = new T.MeshBasicMaterial({ map: tx, color: new T.Color('#FFBE78').multiplyScalar(0.15), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      const hx = sunDir.x, hz = sunDir.z, hl = Math.hypot(hx, hz), ang = Math.atan2(hx, hz), stretch = 1 / Math.abs(sunDir.y), R = WR * 1.25, W = 2 * R / 0.8, H = 2 * R * stretch / 0.8;
      // floor-level decal (the part beyond the turntable), drawn with the turntable disc cut out by depth
      const d1 = new T.Mesh(new T.PlaneGeometry(W, H), m); d1.rotation.order = 'YXZ'; d1.rotation.y = ang; d1.rotation.x = -P / 2; d1.position.set(POOL.x - hx / hl * 0.15, 0.03, POOL.z - hz / hl * 0.15); d1.renderOrder = 6; scene.add(d1);
      // turntable-top decal: a disc the size of the turntable whose UVs place the same pool image
      const cg = new T.CircleGeometry(TR - 0.04, 56), uv = cg.attributes.uv, ps = cg.attributes.position, c = Math.cos(ang), sn = Math.sin(ang);
      for (let i = 0; i < ps.count; i++) { const dx = ps.getX(i) - POOL.x, dz = -ps.getY(i) - POOL.z; const along = dx * sn + dz * c, across = dx * c - dz * sn; uv.setXY(i, across / W + 0.5, -along / H + 0.5); }
      const d2 = new T.Mesh(cg, m); d2.rotation.x = -P / 2; d2.position.set(0, TT + 0.006, 0); d2.renderOrder = 6; scene.add(d2); return [d1, d2]; })();

    // everything above the wainscot goes in its own group, so low close-ups (which never see it) can skip it
    const upper = new T.Group(); scene.add(upper); set.updateMatrixWorld(true);
    (function () { const bx = new T.Box3(); for (const c of set.children.slice()) { if (c === wall) continue; bx.setFromObject(c); if (bx.min.y > WAIN + 0.12) upper.add(c); } })();
    mergeStatic(set); mergeStatic(upper);

    const shots = {
      wide: { p: [-1, 2.6, 9.5], l: [-0.6, 1.3, 0], fov: 32 },
      low: { p: [0.4, 1.25, 7.2], l: [0, 0.95, 0], fov: 24 },
      lowL: { p: [-4.0, 1.3, 6.0], l: [0, 0.95, 0], fov: 24 },
      lowR: { p: [4.0, 1.3, 6.0], l: [0, 0.95, 0], fov: 24 },
      curie: { p: [-2.3, 1.75, 7.0], l: [-3.45, 1.5, 1.4], fov: 26 }
    };
    const world = { scene, camera, sun, turntable, floorY: TT, ttRadius: TR, curieSpot: { x: -3.6, z: 1.4 }, upper, beam, pool, rim, hemi, shots };
    L3.shoot(world, shots.wide); camera.updateProjectionMatrix();
    return world;
  };
})(typeof window !== 'undefined' ? window : globalThis);
