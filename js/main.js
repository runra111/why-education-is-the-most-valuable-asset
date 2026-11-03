(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

const slides = $$('.slide');
const N = slides.length;

/* ───────────────── slide config: accent colours + orb positions ───────────────── */
const COLORS = { gold: '#ffc247', mint: '#3ee6b8', coral: '#ff6b5a', ice: '#9db4ff', paper: '#f4f1ea' };
const INK = '#07070a';
const CFG = [
  { b: '#4a3cff', o1: [28, 42, 1],   o2: [82, 80, 1] },
  { b: '#7a3cff', o1: [78, 40, 1.1], o2: [14, 86, 1] },
  { b: '#1c2a7a', o1: [40, 50, 1.2], o2: [88, 18, .8] },
  { b: '#4a3cff', o1: [80, 55, 1],   o2: [8, 20, 1] },
  { b: '#0b5fff', o1: [72, 50, 1],   o2: [12, 82, 1] },
  { b: '#7a2bff', o1: [74, 60, 1],   o2: [10, 22, 1] },
  { b: '#2a2a35', o1: [50, 50, 1.4], o2: [50, 50, 1.1] },
  { b: '#4a3cff', o1: [20, 72, 1],   o2: [86, 22, 1] },
];
const accentOf = i => COLORS[slides[i].dataset.accent] || COLORS.gold;
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };

const orb1 = $('#orb1'), orb2 = $('#orb2');
function setTheme(i) {
  const c = CFG[i];
  const root = document.documentElement;
  root.style.setProperty('--accent', accentOf(i));
  root.style.setProperty('--accent2', c.b);
  orb1.style.transform = `translate3d(${c.o1[0]}vw, ${c.o1[1]}vh, 0) scale(${c.o1[2]})`;
  orb2.style.transform = `translate3d(${c.o2[0]}vw, ${c.o2[1]}vh, 0) scale(${c.o2[2]})`;
}

/* ───────────────── word-by-word text split ───────────────── */
function splitWords(root) {
  let idx = 0;
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        let text = n.textContent;
        // punctuation glued to the previous word (e.g. "<em>system</em>,") stays with it
        const glued = text.match(/^[^\s\w]+/);
        const prevWi = n.previousSibling && n.previousSibling.nodeType === 1 && $$('.wi', n.previousSibling).pop();
        if (glued && prevWi) { prevWi.textContent += glued[0]; text = text.slice(glued[0].length); }
        text.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.className = 'wi'; i.style.setProperty('--i', idx++); i.textContent = part;
          w.appendChild(i); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(root);
}
$$('[data-split]').forEach(splitWords);

/* ───────────────── liquid transition ───────────────── */
const lc = $('#liquid'), lx = lc.getContext('2d');
let LW = 0, LH = 0;
function sizeLiquid() {
  const d = Math.min(devicePixelRatio || 1, 1.5);
  LW = innerWidth; LH = innerHeight;
  lc.width = LW * d; lc.height = LH * d;
  lx.setTransform(d, 0, 0, d, 0, 0);
}
sizeLiquid();

function wave(x, t, amp, seed) {
  const k = x / LW;
  return amp * (Math.sin(k * 6.2 + t * 2.4 + seed) * .55 + Math.sin(k * 12.5 - t * 3.3 + seed * 2) * .25 + Math.sin(k * 3.1 + t * 1.3 - seed) * .35);
}
function bump(x, t, amp, p) {
  const cx = LW * (.5 + .32 * Math.sin(p * 3.4 + 1));
  const w = LW * .22;
  return amp * Math.exp(-Math.pow((x - cx) / w, 2));
}

function runLiquid(dir, color, onCover, onDone, drainOnly) {
  if (reduce) { onCover && onCover(); setTimeout(() => onDone && onDone(), 80); return; }
  const D = .62, S = [0, .11, .22];
  const tEnter = drainOnly ? 0 : D + S[2];
  const total = tEnter + D + S[2];
  const colors = [color, mix(color.startsWith('#') ? color : '#ffc247', INK, .6), INK];
  const M = LH * .06, A = LH * .1;
  const t0 = performance.now();
  let covered = !!drainOnly;
  if (drainOnly) onCover && onCover();

  function layerPath(j, t) {
    const pe = drainOnly ? 1 : clamp((t - S[j]) / D);
    const pd = clamp((t - tEnter - S[2 - j]) / D);
    const ph = performance.now() / 1000;
    let top = -M, bottom = LH + M, env = 0, p = 0;
    if (pd > 0) { p = easeIO(pd); bottom = lerp(LH + M, -M, p); env = Math.pow(Math.sin(Math.PI * pd), .9); }
    else if (pe < 1) { p = easeIO(pe); top = lerp(LH + M, -M, p); env = Math.pow(Math.sin(Math.PI * pe), .9); }
    if (pd >= 1) return null;
    const seed = j * 1.7;
    const edge = (x, base) => base - (wave(x, ph, A * .55, seed) + bump(x, ph, A * 1.1, p + j * .1)) * env;
    lx.beginPath();
    const step = LW / 48;
    for (let x = 0; x <= LW + step; x += step) { const y = (pd > 0 || pe >= 1) ? top : edge(x, top); x === 0 ? lx.moveTo(x, y) : lx.lineTo(x, y); }
    for (let x = LW; x >= -step; x -= step) { const y = pd > 0 ? edge(x, bottom) : bottom; lx.lineTo(x, y); }
    lx.closePath();
    return true;
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    lx.clearRect(0, 0, LW, LH);
    lx.save();
    if (dir < 0) { lx.translate(0, LH); lx.scale(1, -1); }
    for (let j = 0; j < 3; j++) { if (layerPath(j, t)) { lx.fillStyle = colors[j]; lx.fill(); } }
    lx.restore();
    if (!covered && t >= tEnter) { covered = true; onCover && onCover(); }
    if (t < total) requestAnimationFrame(frame);
    else { lx.clearRect(0, 0, LW, LH); onDone && onDone(); }
  }
  requestAnimationFrame(frame);
}

/* ───────────────── effects: canvases + svg scenes ───────────────── */
const fx = {};
const Fx = {};   // per-slide runtime { ctx, W, H }
function sizeCanvas(i) {
  const f = Fx[i]; if (!f) return;
  const d = Math.min(devicePixelRatio || 1, 2);
  f.W = f.c.clientWidth; f.H = f.c.clientHeight;
  f.c.width = f.W * d; f.c.height = f.H * d;
  f.ctx.setTransform(d, 0, 0, d, 0, 0);
  fx[i] && fx[i].resize && fx[i].resize(f.W, f.H);
}
slides.forEach((s, i) => { const c = $('canvas.fx', s); if (c) Fx[i] = { c, ctx: c.getContext('2d'), W: 0, H: 0 }; });

/* — rising golden particles (title + finale) — */
function risingParticles(count, speedMul) {
  let P = [], W = 0, H = 0;
  const make = (fresh) => ({ x: rand(0, W), y: fresh ? rand(0, H) : H + rand(10, 80), r: rand(.8, 3.4), v: rand(10, 38) * speedMul, ph: rand(0, 6.28), a: rand(.2, .85), tw: rand(.6, 2) });
  return {
    resize(w, h) { W = w; H = h; P = Array.from({ length: count }, () => make(true)); },
    reset() {},
    draw(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        p.y -= p.v * dt; p.x += Math.sin(t * .5 + p.ph) * 12 * dt;
        if (p.y < -20) Object.assign(p, make(false));
        const a = p.a * (.6 + .4 * Math.sin(t * p.tw + p.ph));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, `rgba(255,194,71,${a})`); g.addColorStop(1, 'rgba(255,194,71,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(255,236,190,${Math.min(1, a + .2)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .7, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}
fx[0] = risingParticles(95, 1);
fx[6] = risingParticles(55, 1.1);
fx[7] = risingParticles(70, 1.4);

/* — slide 3: the lights go out — */
fx[2] = (() => {
  let dots = [], W = 0, H = 0, seeds = [];
  const GAP = 38;
  function build() {
    dots = [];
    const cols = Math.ceil(W / GAP) + 1, rows = Math.ceil(H / GAP) + 1;
    seeds = [[rand(.1, .9) * W, rand(.1, .9) * H], [rand(.1, .9) * W, rand(.1, .9) * H], [rand(.1, .9) * W, rand(.1, .9) * H]];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * GAP + (r % 2 ? GAP / 2 : 0), y = r * GAP;
      let d = 1e9; for (const s of seeds) d = Math.min(d, Math.hypot(x - s[0], y - s[1]));
      const survivor = Math.random() < .035;
      dots.push({ x, y, die: 1.1 + d / 330 + rand(0, 1.1), s: survivor, ph: rand(0, 6.28), r: rand(1.4, 2.6) });
    }
  }
  return {
    resize(w, h) { W = w; H = h; build(); },
    reset() { build(); },
    draw(ctx, w, h, t) {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        let a, hue = '255,194,71';
        if (t < d.die - .3) a = .55 + .25 * Math.sin(t * 2 + d.ph);
        else if (t < d.die) { a = Math.random() < .5 ? .9 : .1; }
        else if (d.s) { a = .12 + .5 * Math.max(0, Math.sin(t * 3 + d.ph * 5)); hue = '255,107,90'; }
        else { a = Math.max(.05, .5 - (t - d.die) * 1.6); hue = a > .12 ? '200,170,120' : '157,180,255'; if (a <= .06) a = .05; }
        ctx.fillStyle = `rgba(${hue},${a})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      }
    }
  };
})();

/* — slide 4: economy chart (SVG, driven from JS) — */
fx[3] = (() => {
  const X0 = 50, X1 = 730, Y0 = 400, Y1 = 40;
  const edu = [10, 14, 19, 25, 31, 38, 44, 37, 40, 48, 58, 69, 81, 94];
  const res = [10, 15, 21, 28, 35, 42, 47, 21, 19, 21, 23, 25, 26, 27];
  const n = edu.length, px = i => X0 + i * (X1 - X0) / (n - 1), py = v => Y0 - v / 100 * (Y0 - Y1);
  const smooth = vals => {
    const p = vals.map((v, i) => [px(i), py(v)]);
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, k = 1 / 6;
      d += ` C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const svg = $('#chart');
  const grid = $('#cGrid');
  [0, 25, 50, 75, 100].forEach(v => {
    grid.appendChild(svgEl('line', { x1: X0, x2: X1, y1: py(v), y2: py(v), class: v === 0 ? 'base' : '' }));
  });
  const pe = $('#cEdu'), pr = $('#cRes'), pa = $('#cArea');
  const dEdu = smooth(edu), dRes = smooth(res);
  pe.setAttribute('d', dEdu); pr.setAttribute('d', dRes);
  pa.setAttribute('d', dEdu + ` L${X1},${Y0} L${X0},${Y0} Z`);
  const cx0 = px(6.3), cx1 = px(8.3);
  const crisis = $('#cCrisis'), crisisT = $('#cCrisisT');
  crisis.setAttribute('x', cx0); crisis.setAttribute('y', Y1 - 14); crisis.setAttribute('width', cx1 - cx0); crisis.setAttribute('height', Y0 - Y1 + 14);
  crisisT.setAttribute('x', (cx0 + cx1) / 2); crisisT.setAttribute('y', Y1 + 6);
  const labE = $('#cLabEdu'), labR = $('#cLabRes');
  labE.setAttribute('x', X1); labE.setAttribute('y', py(94) - 24); labE.setAttribute('text-anchor', 'end');
  labR.setAttribute('x', X1); labR.setAttribute('y', py(27) + 34); labR.setAttribute('text-anchor', 'end');
  const dotE = $('#cDotEdu'), dotR = $('#cDotRes'), rect = $('#areaRect');
  const LE = pe.getTotalLength(), LR = pr.getTotalLength();
  [pe, pr].forEach((p, k) => { const L = k ? LR : LE; p.style.strokeDasharray = L; });
  const table = path => { const L = path.getTotalLength(), arr = []; for (let i = 0; i <= 260; i++) { const l = L * i / 260; arr.push([l, path.getPointAtLength(l).x]); } return arr; };
  const tE = table(pe), tR = table(pr);
  const lenAtX = (tb, x) => { for (let i = 1; i < tb.length; i++) if (tb[i][1] >= x) { const a = tb[i - 1], b = tb[i]; return lerp(a[0], b[0], (x - a[1]) / Math.max(.0001, b[1] - a[1])); } return tb[tb.length - 1][0]; };
  function render(p) {
    const x = X0 + p * (X1 - X0);
    const le = lenAtX(tE, x), lr = lenAtX(tR, x);
    pe.style.strokeDashoffset = LE - le; pr.style.strokeDashoffset = LR - lr;
    const a = pe.getPointAtLength(le), b = pr.getPointAtLength(lr);
    dotE.setAttribute('cx', a.x); dotE.setAttribute('cy', a.y); dotR.setAttribute('cx', b.x); dotR.setAttribute('cy', b.y);
    rect.setAttribute('width', Math.max(0, x - X0 + X0));
    dotE.style.opacity = dotR.style.opacity = p > .005 ? 1 : 0;
    crisis.classList.toggle('on', x > cx0 + 10);
    labE.classList.toggle('on', p > .92); labR.classList.toggle('on', p > .92);
  }
  render(0);
  return { resize() {}, reset() { render(0); }, draw(_c, _w, _h, t) { render(easeIO(clamp((t - .9) / 3.4))); }, svg: true };
})();

/* — slide 5: chaos → system (particles snap to a lattice) — */
fx[4] = (() => {
  let P = [], T = [], L = [], W = 0, H = 0, R = 0, cx = 0, cy = 0;
  function build() {
    const narrow = W < 900;
    cx = narrow ? W * .5 : W * .7; cy = narrow ? H * .66 : H * .5;
    const rx = narrow ? W * .42 : W * .26, ry = narrow ? H * .2 : H * .37;
    const s = clamp(Math.min(rx, ry) * .26, 30, 62), rowH = s * .866;
    T = [];
    for (let r = -14; r <= 14; r++) for (let c = -14; c <= 14; c++) {
      const x = c * s + (r & 1 ? s / 2 : 0), y = r * rowH;
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) T.push({ x: cx + x, y: cy + y });
    }
    R = Math.max(rx, ry);
    L = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
      if (Math.hypot(T[i].x - T[j].x, T[i].y - T[j].y) < s * 1.1) L.push([i, j]);
    }
    seed();
  }
  function seed() {
    P = T.map(() => ({ x: rand(0, W), y: rand(0, H), vx: rand(-60, 60), vy: rand(-60, 60), d: rand(0, 1.4), s: 0 }));
  }
  return {
    resize(w, h) { W = w; H = h; build(); },
    reset() { seed(); },
    draw(ctx, w, h, t, dt) {
      ctx.clearRect(0, 0, w, h);
      const t0 = 1.5;
      P.forEach((p, i) => {
        const go = t - t0 - p.d;
        if (go < 0) {
          p.vx += rand(-1, 1) * 520 * dt; p.vy += rand(-1, 1) * 520 * dt;
          p.vx *= .93; p.vy *= .93;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
        } else {
          const k = 1 - Math.exp(-dt * 4.2);
          p.x += (T[i].x - p.x) * k; p.y += (T[i].y - p.y) * k;
          p.s = Math.min(1, p.s + dt * 1.2);
        }
      });
      const lineA = clamp((t - t0 - 1.7) / 1.2);
      if (lineA > 0) {
        const pulse = ((t - t0 - 2.6) * 190) % (R * 1.7);
        ctx.lineWidth = 1;
        L.forEach(([i, j]) => {
          const a = P[i], b = P[j];
          const mx = (a.x + b.x) / 2 - cx, my = (a.y + b.y) / 2 - cy;
          const near = Math.max(0, 1 - Math.abs(Math.hypot(mx, my) - pulse) / 60);
          ctx.strokeStyle = `rgba(62,230,184,${lineA * (.16 + .6 * near)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
      }
      P.forEach(p => {
        const s = p.s;
        ctx.fillStyle = s > 0 ? `rgba(${Math.round(lerp(235, 62, s))},${Math.round(lerp(235, 230, s))},${Math.round(lerp(235, 184, s))},${lerp(.45, .95, s)})` : 'rgba(235,235,235,.45)';
        ctx.beginPath(); ctx.arc(p.x, p.y, lerp(1.8, 3.4, s), 0, 6.283); ctx.fill();
      });
    }
  };
})();

/* — slide 6: social elevator (SVG, driven from JS) — */
fx[5] = (() => {
  const FL = 100, BASE = 438, NF = 5;
  const floors = $('#lFloors'), cab = $('#lCab'), cable = $('#lCable'), burst = $('#lBurst'), top = $('.l-lab--top');
  for (let i = 0; i < NF; i++) {
    const y = 530 - i * FL;
    if (i > 0) floors.appendChild(svgEl('line', { class: 'l-floor', x1: 170, x2: 350, y1: y, y2: y }));
    floors.appendChild(svgEl('circle', { class: 'l-fdot', cx: 384, cy: y - 46, r: 5, id: 'fd' + i }));
    const t = svgEl('text', { class: 'l-fnum mono', x: 400, y: y - 41, id: 'fn' + i }); t.textContent = String(i + 1).padStart(2, '0'); floors.appendChild(t);
  }
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * Math.PI * 2, r0 = 70;
    const ln = svgEl('line', { x1: Math.cos(a) * r0, y1: Math.sin(a) * r0, x2: Math.cos(a) * (r0 + 26), y2: Math.sin(a) * (r0 + 26) });
    ln.style.setProperty('--tx', Math.cos(a) * 46 + 'px'); ln.style.setProperty('--ty', Math.sin(a) * 46 + 'px');
    burst.appendChild(ln);
  }
  [0, .18, .36].forEach(d => { const c = svgEl('circle', { cx: 0, cy: 0, r: 56 }); c.style.animationDelay = d + 's'; burst.appendChild(c); });
  let fired = false;
  function setFloor(k) { for (let i = 0; i < NF; i++) { const on = i <= k; $('#fd' + i).classList.toggle('on', on); $('#fn' + i).classList.toggle('on', on); } }
  function render(f) {  // f: 0..4 (float)
    const y = BASE - f * FL;
    cab.setAttribute('transform', `translate(0,${y})`);
    cable.setAttribute('y2', y);
  }
  function reset() { render(0); setFloor(0); burst.classList.remove('go'); top.classList.remove('on'); fired = false; }
  reset();
  return {
    resize() {}, reset, svg: true,
    draw(_c, _w, _h, t) {
      const T0 = 1.3, TR = .85, PA = .32;
      let f = 0, reached = 0;
      const tt = t - T0;
      if (tt > 0) {
        const seg = TR + PA, k = Math.min(NF - 1, Math.floor(tt / seg));
        const local = tt - k * seg;
        f = k + (k >= NF - 1 ? 0 : easeIO(clamp(local / TR)));
        if (tt >= (NF - 1) * seg) f = NF - 1;
        reached = Math.floor(f + .001);
        if (k < NF - 1 && local >= TR) reached = k + 1;
        if (k < NF - 1 && local < TR) reached = k;
      }
      render(f); setFloor(Math.min(NF - 1, reached));
      if (f >= NF - 1 && !fired) {
        fired = true; burst.setAttribute('transform', `translate(260,${BASE - (NF - 1) * FL + 42})`);
        burst.classList.add('go'); top.classList.add('on');
      }
    }
  };
})();

/* ───────────────── presenter script ───────────────── */
const NOTES = [
  `<p><b>Greeting.</b> “Good day, everyone! Have any of you ever asked yourselves why we even need education, or maybe thought that it is not necessary at all? So today, I want to share three reasons why it is the most valuable asset we have.”</p>`,
  `<p><b>Hook.</b> Play the short video (“You Don’t Need College”), then move on to the next slide.</p>
   <p><b>Tip:</b> after pressing play, click on an empty part of the slide (or use the arrow buttons) so the keyboard works again.</p>`,
  `<p><b>Opening question.</b> “What would our world look like without education?”</p>
   <p>Let the silence do some work: the lights go out one by one. No medicine, no technology, no economy.</p>`,
  `<p><b>Argument 1 · Education builds a strong and resilient economy.</b></p>
   <p><b>Argument:</b> higher education creates a flexible and crisis-resistant national economy.</p>
   <p><b>Why:</b> unlike economies that rely only on raw natural resources, educated workers quickly learn new skills when markets shift, while university research centers create new patents, technology startups, and high-value exports.</p>
   <p><b>Example:</b> Switzerland connects top technical universities like ETH Zurich directly with businesses to produce advanced clusters in biotechnology and AI, keeping its economy profitable even during global supply crises.</p>
   <p><b>Conclusion:</b> therefore, funding higher education is the best long-term economic insurance because it transforms citizens into an adaptable, high-value asset for the country.</p>`,
  `<p><b>Argument 2 · Education provides a system, not chaos.</b></p>
   <p><b>Argument:</b> higher education teaches people how to organize information into a clear system instead of consuming random facts.</p>
   <p><b>Why:</b> in the modern digital world, people face information overload; a structured academic base helps them filter useful data, think critically, and easily learn new practical tools without starting from zero every time.</p>
   <p><b>Example:</b> in the IT and Data Science industries, studies by Coursera show that employees with structured, foundational skills adapt much faster to new technologies and drive higher economic growth.</p>
   <p><b>Conclusion:</b> therefore, good education is valuable not because it makes us memorize facts, but because it builds a strong mental framework to navigate an unpredictable world.</p>`,
  `<p><b>Argument 3 · Education as a social elevator: from background to breakthrough.</b></p>
   <p><b>Argument:</b> quality education reduces social inequality by working as a powerful social elevator for talented youth.</p>
   <p><b>Why:</b> it creates fair opportunities where personal talent, discipline, and hard work matter much more than family wealth or social connections.</p>
   <p><b>Example:</b> in Kazakhstan, institutions like NIS, NU, and KazNU give full grants to bright students from ordinary families. A great role model is Mikhail Lomtadze (head of Kaspi.kz), who used his top education (including Harvard) as a springboard to build a huge tech company, and today his business actively hires graduates from these institutions based entirely on their talent and hard work.</p>
   <p><b>Conclusion:</b> therefore, accessible high-standard education serves as a true social elevator, proving that a young person’s future can be determined by their own abilities rather than their family’s background.</p>`,
  `<p><b>Photo slide (second to last).</b> Caption on the photo: “How do you like it, Elon Musk?” This is the answer to the video from the start of the talk.</p>`,
  `<p><b>To sum up.</b> “Quality education builds a strong economy, helps us organize information, and acts as a fair social elevator. By supporting education today, we create a successful future for everyone.”</p>`,
];
const notes = $('#notes'), notesBody = $('#notesBody'), notesTitle = $('#notesTitle');
function showNotes(i) { notesBody.innerHTML = NOTES[i] || ''; notesTitle.textContent = `Script · slide ${String(i + 1).padStart(2, '0')}`; }
function toggleNotes(force) { const open = force ?? notes.hidden; notes.hidden = !open; if (open) showNotes(cur); }

/* ───────────────── HUD ───────────────── */
const dots = $('#dots');
slides.forEach((s, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" aria-label="Go to slide ${i + 1}: ${s.dataset.title}"></button>`;
  li.firstChild.addEventListener('click', () => go(i));
  dots.appendChild(li);
});
$('#tot').textContent = String(N).padStart(2, '0');
function updateHud(i) {
  $('#cur').textContent = String(i + 1).padStart(2, '0');
  $('#slideName').textContent = slides[i].dataset.title;
  $$('li', dots).forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
  $('#prev').style.opacity = i === 0 ? .35 : 1; $('#next').style.opacity = i === N - 1 ? .35 : 1;
  if (!notes.hidden) showNotes(i);
}

/* ───────────────── video helpers ───────────────── */
const yt = $('#ytFrame');
function loadVideo() { if (yt && !yt.src) yt.src = yt.dataset.src; }
function pauseVideo() { try { yt.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'); } catch (e) {} }

/* ───────────────── navigation ───────────────── */
let cur = 0, busy = true, queued = null, shown = 0, enterT = 0;

function activate(i) {
  slides.forEach((s, k) => { if (k !== i) s.classList.remove('is-active', 'is-in', 'is-leaving'); });
  const s = slides[i];
  s.classList.remove('is-leaving'); s.classList.add('is-active');
  void s.offsetWidth;
  s.classList.add('is-in');
  shown = i; enterT = performance.now();
  sizeCanvas(i);
  fx[i] && fx[i].reset && fx[i].reset();
  if (i === 0 || i === 1) loadVideo();
}

function go(to) {
  if (to < 0 || to >= N || to === cur) return;
  if (busy) { queued = to; return; }
  busy = true;
  const dir = to > cur ? 1 : -1;
  const from = cur;
  slides[from].classList.add('is-leaving');
  if (from === 1) pauseVideo();
  setTheme(to);
  runLiquid(dir, accentOf(to), () => {
    cur = to; activate(to); updateHud(to);
    history.replaceState(null, '', '#' + (to + 1));
  }, () => {
    busy = false;
    if (queued !== null) { const q = queued; queued = null; go(q); }
  });
}

/* ───────────────── input ───────────────── */
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); go(cur + 1); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(cur - 1); }
  else if (k === 'Home') go(0);
  else if (k === 'End') go(N - 1);
  else if (k === 'f' || k === 'F') toggleFs();
  else if (k === 'n' || k === 'N') toggleNotes();
  else if (k === 'Escape') toggleNotes(false);
  else if (/^[1-9]$/.test(k)) go(+k - 1);
});
let lastWheel = 0;
addEventListener('wheel', e => {
  if (e.target.closest && e.target.closest('.notes')) return;
  const now = performance.now();
  if (Math.abs(e.deltaY) < 24 || now - lastWheel < 800) return;
  lastWheel = now; go(cur + (e.deltaY > 0 ? 1 : -1));
}, { passive: true });
let tx = 0, ty = 0;
addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 55) return;
  go(cur + ((Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? 1 : -1));
}, { passive: true });
$('#next').addEventListener('click', () => go(cur + 1));
$('#prev').addEventListener('click', () => go(cur - 1));
$('#brand').addEventListener('click', e => { e.preventDefault(); go(0); });
$('#notesBtn').addEventListener('click', () => toggleNotes());
$('#notesClose').addEventListener('click', () => toggleNotes(false));
function toggleFs() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
$('#fsBtn').addEventListener('click', toggleFs);
document.addEventListener('fullscreenchange', () => { $('#fsBtn').textContent = document.fullscreenElement ? 'Exit' : 'Fullscreen'; });

addEventListener('resize', () => { sizeLiquid(); slides.forEach((_, i) => Fx[i] && sizeCanvas(i)); });

/* ───────────────── main loop ───────────────── */
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const f = fx[shown];
  if (f && f.draw) {
    const t = (now - enterT) / 1000;
    const r = Fx[shown];
    if (r) f.draw(r.ctx, r.W, r.H, t, dt); else f.draw(null, 0, 0, t, dt);
  }
  requestAnimationFrame(loop);
}

/* ───────────────── boot ───────────────── */
function boot() {
  const hash = parseInt(location.hash.slice(1), 10);
  cur = hash >= 1 && hash <= N ? hash - 1 : 0;
  slides.forEach((_, i) => Fx[i] && sizeCanvas(i));
  setTheme(cur); updateHud(cur);
  document.body.style.setProperty('--boot', '1');
  // start fully covered by ink, then the liquid drains away to reveal the first slide
  lx.fillStyle = INK; lx.fillRect(0, 0, LW, LH);
  runLiquid(1, accentOf(cur), () => { activate(cur); }, () => { busy = false; if (queued !== null) { const q = queued; queued = null; go(q); } }, true);
  requestAnimationFrame(t => { last = t; loop(t); });
  setTimeout(loadVideo, 2500);
}
const ready = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
ready.then(boot);
})();
