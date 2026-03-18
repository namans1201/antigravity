/* ============================================================
   Antigravity — CSS Houdini PaintWorklet
   Runs on the browser paint thread; stateless — position and
   scale are pure functions of (particleIndex, mouseX, mouseY, time).
   ============================================================ */

// ── Noise helpers ─────────────────────────────────────────────
function hash(n) {
  return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
  const a = hash(ix   + iy*57),     b = hash(ix+1 + iy*57);
  const c = hash(ix   + (iy+1)*57), d = hash(ix+1 + (iy+1)*57);
  return a + (b-a)*ux + (c-a)*uy + (b-a+a-b-c+d)*ux*uy;
}
function ss(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function lerpRGB(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}
function hexToRGB(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
// Read a CSS custom property as a plain number regardless of whether
// it was registered (<number>) or is unregistered (CSSUnparsedValue).
function getProp(props, name) {
  const v = props.get(name);
  if (!v) return 0;
  if (typeof v.value === 'number') return v.value;
  return parseFloat(v.toString()) || 0;
}

// ── Palettes ──────────────────────────────────────────────────
const DARK_PAL  = ['#318bf7','#bada4c','#e35058'].map(hexToRGB);
const LIGHT_PAL = ['#6aaef6','#8ecf8a','#f4949c'].map(hexToRGB);

// ── Ring constants ────────────────────────────────────────────
const DEFAULT_COUNT   = 700;
const DEFAULT_RING_R  = 0.55;
const DEFAULT_RING_W  = 0.45;
const DEFAULT_RING_W2 = 0.10;
const DEFAULT_RING_D  = 0.28;

class AntigravityPainter {
  static get inputProperties() {
    return [
      '--mouse-x', '--mouse-y', '--ag-time', '--ag-dark', '--ag-hovering',
      '--particle-count', '--particle-size',
      '--ring-radius', '--ring-width', '--ring-width2', '--ring-depth',
      '--particle-alpha'
    ];
  }

  constructor() {
    // Cache particle home positions per aspect ratio to avoid regenerating each frame
    this._homes      = null;
    this._homeAspect = null;
    // Internal ring/cursor position for smooth inertial following
    this._ringX = -9999;
    this._ringY = -9999;
    this._lastT = 0;
    this._inited = false;
  }

  _buildHomes(aspect, count) {
    if (this._homeAspect === aspect && this._homes && this._homes.length === count) return this._homes;
    const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
    const rows = Math.max(1, Math.round(count / cols));
    const homes = [];
    let idx = 0;
    outer: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= COUNT) break outer;
        const jx = (hash(idx * 3.7 + 1.1) - 0.5) * (2 * aspect / cols) * 0.85;
        const jy = (hash(idx * 5.3 + 2.2) - 0.5) * (2        / rows) * 0.85;
        homes.push([
          (c + 0.5) / cols * 2 * aspect - aspect + jx,   // world x ∈ [-aspect, aspect]
          (r + 0.5) / rows * 2 - 1 + jy,                 // world y ∈ [-1, 1]
          hash(idx * 2.1 + 0.5) * 100,                   // noiseOx
          hash(idx * 3.9 + 0.7) * 100,                   // noiseOy
          hash(idx * 7.3 + 0.3),                          // seedPhase (for flow animation)
        ]);
        idx++;
      }
    }
    this._homes      = homes;
    this._homeAspect = aspect;
    return homes;
  }

  paint(ctx, geom, props) {
    const W = geom.width, H = geom.height;
    if (W === 0 || H === 0) return;
    const aspect = W / H;

    const mx       = getProp(props, '--mouse-x');
    const my       = getProp(props, '--mouse-y');
    const t        = getProp(props, '--ag-time');
    const dark     = getProp(props, '--ag-dark');
    const hovering = getProp(props, '--ag-hovering');

    const pal = dark ? DARK_PAL : LIGHT_PAL;

    // Read configurable properties (with sensible defaults)
    const particleCount = Math.max(32, Math.round(getProp(props, '--particle-count') || DEFAULT_COUNT));
    const particleSize  = Math.max(0.1, (getProp(props, '--particle-size') || 1.0));
    const ringR  = (getProp(props, '--ring-radius') || DEFAULT_RING_R);
    const ringW  = (getProp(props, '--ring-width')  || DEFAULT_RING_W);
    const ringW2 = (getProp(props, '--ring-width2') || DEFAULT_RING_W2);
    const ringD  = (getProp(props, '--ring-depth')  || DEFAULT_RING_D);
    const particleAlpha = (getProp(props, '--particle-alpha') || 1.0);

    // Mouse in world space
    const mwx_prop = hovering ? (mx / W * 2 - 1) * aspect : -9999;
    const mwy_prop = hovering ? 1 - my / H * 2             : -9999;

    // Smoothly follow the incoming mouse position on the paint thread itself
    // so the ring/particles lag behind the real pointer with inertia.
    if (!this._inited) {
      this._ringX = mwx_prop;
      this._ringY = mwy_prop;
      this._inited = true;
      this._lastT = t;
    }
    const dt = Math.max(0.016, t - this._lastT);
    this._lastT = t;

    if (hovering) {
      // follow factor: smaller → slower follow. 0.01–0.06 range.
      const follow = 0.02; // very gentle, slower follow for extra inertia
      this._ringX += (mwx_prop - this._ringX) * follow;
      this._ringY += (mwy_prop - this._ringY) * follow;
    } else {
      // fade out slowly when not hovering
      this._ringX += (-9999 - this._ringX) * 0.03;
      this._ringY += (-9999 - this._ringY) * 0.03;
    }

    // Use the internal, smoothed ring position for all distance/angle math
    const mwx = this._ringX;
    const mwy = this._ringY;

    // Oscillating ring radius (matches real site update), allow override
    const rr = ringR + Math.sin(t) * 0.03 + Math.cos(t * 3) * 0.02;

    const homes = this._buildHomes(aspect, particleCount);

    for (let i = 0; i < homes.length; i++) {
      const [rx, ry, noiseOx, noiseOy, seedPhase] = homes[i];

      // Time-evolving noise drift (slower, smaller amplitude for "water bubble" feel)
      const nt = t * 0.02; // even slower temporal evolution for large-wavelength motion
      const dx = (vnoise(rx * 1.1 + noiseOx,      ry * 1.1 + nt)      - 0.5) * 0.01 * aspect;
      const dy = (vnoise(rx * 1.1 + noiseOy + 50, ry * 1.1 + nt + 10) - 0.5) * 0.01;

      let cx = rx + dx;
      let cy = ry + dy;

      // Ring distance (aspect-corrected for isotropic circle on screen)
      const ddx  = (cx - mwx) / aspect;
      const ddy  =  cy - mwy;
      const dist = hovering ? Math.sqrt(ddx*ddx + ddy*ddy) : 9999;

      // Ring bands — clamped before pow() to prevent NaN
      const tv  = Math.max(0, ss(rr - RING_W*2,  rr, dist) - ss(rr, rr + RING_W,  dist));
      const tv2 = Math.max(0, ss(rr - RING_W2*2, rr, dist) - ss(rr, rr + RING_W2, dist));
      const tv3 = Math.max(0, ss(rr + RING_W2, rr, dist));

      let scale = tv*tv * 1.2 + tv2*tv2*tv2 * 4.0 + tv3 * 0.5;
      scale = Math.min(scale, 1.4);
      if (scale < 0.05) continue;

      // Displacement: ring snap + flowing outward drift
      if (hovering && dist > 0.01) {
        const len  = Math.sqrt(ddx*ddx + ddy*ddy);
        const outX = (ddx * aspect) / len;
        const outY =  ddy           / len;

        // Ring snap (pushes particles away from ring position)
        const snapF = Math.pow(tv2, 0.75) * RING_D;
        cx -= (mwx - cx) * snapF * 0.25;
        cy -= (mwy - cy) * snapF * 0.25;

        // Continuous outward flow — gentler for a slow watery motion
        const flowStr = ss(RING_R + RING_W, 0, dist) * 0.01;
        const tPhase  = (t * 0.35 + seedPhase * 6.2832) % (Math.PI * 2);
        const flowPulse = 0.65 + 0.35 * Math.sin(tPhase);
        cx += outX * flowStr * flowPulse;
        cy += outY * flowStr * flowPulse;
      }

      // Very slow large-wavelength bubble drift (gives a drifting ocean/bubble look)
      const slowDrift = Math.sin(t * 0.06 + seedPhase * 6.2832) * 0.01;
      cx += slowDrift * 0.5;
      cy += Math.cos(t * 0.045 + seedPhase * 6.2832) * 0.008;

      // World → screen pixels
      const screenX = (cx + aspect) / (2 * aspect) * W;
      const screenY = (1 - cy) * 0.5 * H;

      // Color: world-space noise (same formula as real site fragment shader)
      const noiseC   = vnoise(rx * 2 + 74.664, ry * 2 + 91.556 + t * 0.5);
      const progress = Math.max(0, Math.min(1, noiseC));
      const h = 0.5;
      const col = progress < h
        ? lerpRGB(pal[0], pal[1], progress / h)
        : lerpRGB(pal[1], pal[2], (progress - h) / (1 - h));

      // Particle size in pixels (tunable)
      const baseMaxR = dark ? 11.0 : 8.5;
      const maxR = baseMaxR * particleSize;
      const r    = scale * maxR;

      // Orientation: radially away from cursor
      const angle = Math.atan2(cy - mwy, cx - mwx);

      // Alpha
      const alpha = (dark ? 0.75 : 0.65) * Math.min(scale, 1.0) * particleAlpha;

      // Draw oriented capsule (wide pill pointing away from cursor)
      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(-angle);

      const capW = r * 3.0, capH = r * 0.95, capR = capH / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-capW / 2, -capH / 2, capW, capH, capR);
      } else {
        // Fallback: draw rounded rect manually
        ctx.moveTo(-capW/2 + capR, -capH/2);
        ctx.lineTo( capW/2 - capR, -capH/2);
        ctx.arcTo(  capW/2, -capH/2,  capW/2,  capH/2, capR);
        ctx.lineTo( capW/2 - capR,  capH/2);
        ctx.arcTo(  capW/2,  capH/2, -capW/2,  capH/2, capR);
        ctx.lineTo(-capW/2 + capR,  capH/2);
        ctx.arcTo( -capW/2,  capH/2, -capW/2, -capH/2, capR);
        ctx.lineTo(-capW/2 + capR, -capH/2);
        ctx.arcTo( -capW/2, -capH/2,  capW/2, -capH/2, capR);
        ctx.closePath();
      }
      const [R, G, B] = col;
      ctx.fillStyle = `rgba(${R|0},${G|0},${B|0},${alpha.toFixed(3)})`;
      ctx.fill();
      ctx.restore();
    }
  }
}

registerPaint('antigravity', AntigravityPainter);
