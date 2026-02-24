/* ============================================================
   ANTIGRAVITY CLONE — app.js
   Faithful port of antigravity.google particle system.

   Real site architecture (from main-ag.js analysis):
   - CPU simulation: pos *= 0.8 damping + ring displacement
   - Scale: world simplex noise baseline + ring proximity boost
   - Particle shape: sdRoundBox oriented radially toward cursor
   - Color: world-space simplex noise (spatial variation), NOT velocity
   - gl_PointSize = scale * 7 * (pixelRatio * 0.5) * particleScale
   ============================================================ */

// ── DOM refs ──────────────────────────────────────────────────
const canvas      = document.getElementById('canvas');
const cursorDot   = document.getElementById('cursorDot');
const cursorRing  = document.getElementById('cursorRing');
const themeToggle = document.getElementById('themeToggle');
const promptScreen  = document.getElementById('promptScreen');
const displayScreen = document.getElementById('displayScreen');
const wordInput   = document.getElementById('wordInput');
const goBtn       = document.getElementById('goBtn');
const backBtn     = document.getElementById('backBtn');
const wordDisplay = document.getElementById('wordDisplay');

// ── State ─────────────────────────────────────────────────────
let mx = -9999, my = -9999;
let ringX = -9999, ringY = -9999;
let W = window.innerWidth, H = window.innerHeight;
let isDark = false;
let isHovering = false;

// ── Init Theme ────────────────────────────────────────────────
document.documentElement.setAttribute('data-theme', 'light');

// ── THEME TOGGLE ──────────────────────────────────────────────
themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  applyThemeToShader();
});

// ── MOUSE TRACKING ────────────────────────────────────────────
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; isHovering = true; });
document.addEventListener('mouseleave', () => { mx = -9999; my = -9999; isHovering = false; });

// Custom cursor disabled — using OS default cursor
cursorDot.style.display  = 'none';
cursorRing.style.display = 'none';

// =============================================================
// THREE.JS PARTICLE SYSTEM  (faithful antigravity.google port)
// =============================================================

// ── CPU Noise helpers ─────────────────────────────────────────
function _h(n) { return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
  const a = _h(ix   + iy*57),     b = _h(ix+1 + iy*57);
  const c = _h(ix   + (iy+1)*57), d = _h(ix+1 + (iy+1)*57);
  return a + (b-a)*ux + (c-a)*uy + (b-a+a-b-c+d)*ux*uy;
}
// Approx snoise(vec3) via value noise — for CPU simulation only
function snoiseCPU(x, y, z) {
  return (vnoise(x + z * 3.7, y + z * 2.1) - 0.5) * 2.0;
}
function ss(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x-e0)/(e1-e0)));
  return t*t*(3-2*t);
}

// ── RENDERER ──────────────────────────────────────────────────
console.log('[AG] Three.js version:', THREE.REVISION, '| WebGL2 available:', !!window.WebGL2RenderingContext);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
let aspect   = W / H;
const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 1);
camera.position.z = 0.5;

// ── PARTICLE BUFFERS ──────────────────────────────────────────
const COUNT = 700;

const refPos  = new Float32Array(COUNT * 2); // home position
const posDisp = new Float32Array(COUNT * 2); // accumulated displacement (decays 80%/frame)
const noiseOx = new Float32Array(COUNT);     // per-particle x noise offset
const noiseOy = new Float32Array(COUNT);     // per-particle y noise offset
const seeds   = new Float32Array(COUNT * 2); // random seeds

// GPU attribute arrays (written every frame)
const gpuPos  = new Float32Array(COUNT * 3); // world-space xyz
const scaleArr = new Float32Array(COUNT);    // drives gl_PointSize
const angleArr = new Float32Array(COUNT);    // atan2 ring->particle for dash rotation

function initParticles() {
  aspect = W / H;
  const cols = Math.round(Math.sqrt(COUNT * aspect));
  const rows = Math.round(COUNT / cols);
  let idx = 0;
  outer: for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (idx >= COUNT) break outer;
      const jx = (Math.random() - 0.5) * (2 * aspect / cols) * 0.85;
      const jy = (Math.random() - 0.5) * (2        / rows) * 0.85;
      refPos[idx*2]    = (c + 0.5) / cols * 2 * aspect - aspect + jx;
      refPos[idx*2+1]  = (r + 0.5) / rows * 2 - 1 + jy;
      posDisp[idx*2]   = 0;
      posDisp[idx*2+1] = 0;
      noiseOx[idx]     = Math.random() * 100;
      noiseOy[idx]     = Math.random() * 100;
      seeds[idx*2]     = Math.random();
      seeds[idx*2+1]   = Math.random();
      const rn = (seeds[idx*2+1] + 1.5) * 0.5;
      scaleArr[idx]    = Math.pow(rn, 2) * 0.6 * Math.random();
      gpuPos[idx*3]    = refPos[idx*2];
      gpuPos[idx*3+1]  = refPos[idx*2+1];
      gpuPos[idx*3+2]  = 0;
      idx++;
    }
  }
}
initParticles();

// ── GEOMETRY ──────────────────────────────────────────────────
const geometry = new THREE.BufferGeometry();
const posAttr  = new THREE.BufferAttribute(gpuPos,    3);
const sclAttr  = new THREE.BufferAttribute(scaleArr,  1);
const angAttr  = new THREE.BufferAttribute(angleArr,  1);
posAttr.usage = THREE.DynamicDrawUsage;
sclAttr.usage = THREE.DynamicDrawUsage;
angAttr.usage = THREE.DynamicDrawUsage;
geometry.setAttribute('position', posAttr);
geometry.setAttribute('aScale',   sclAttr);
geometry.setAttribute('aAngle',   angAttr);
// Skip auto bounding sphere (particles move every frame; avoids NaN radius warning)
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,0,0), 100);

// ── COLOURS (exact from antigravity.google bundle) ────────────
// Dark:  exact real-site values — blue / lime-green / coral-red
const DARK_PAL  = [new THREE.Color('#318bf7'), new THREE.Color('#bada4c'), new THREE.Color('#e35058')];
// Light: same hue family but pastel — periwinkle / sage / rose
const LIGHT_PAL = [new THREE.Color('#6aaef6'), new THREE.Color('#8ecf8a'), new THREE.Color('#f4949c')];

// ── GLSL 3D Simplex Noise  (same as zp.noise in real bundle) ──
const GLSL_SIMPLEX = `
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute4(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 tayInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute4(permute4(permute4(
    i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))
    +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=tayInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ── SHADER MATERIAL ───────────────────────────────────────────
const ptMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uColor1:        { value: LIGHT_PAL[0].clone() },
    uColor2:        { value: LIGHT_PAL[1].clone() },
    uColor3:        { value: LIGHT_PAL[2].clone() },
    uPixelRatio:    { value: renderer.getPixelRatio() },
    uParticleScale: { value: 2.0 },
    uAlpha:         { value: 1.0 },
    uRingPos:       { value: new THREE.Vector2(-9999, -9999) },
    uTime:          { value: 0.0 },
    uLightMode:     { value: 1.0 },
  },

  vertexShader: `
    precision highp float;
    attribute float aScale;
    attribute float aAngle;
    uniform float uPixelRatio;
    uniform float uParticleScale;
    varying float vScale;
    varying float vAngle;
    varying vec2  vLocalPos;
    void main() {
      vScale    = aScale;
      vAngle    = aAngle;
      vLocalPos = position.xy;
      gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      // Exact real-site formula: scale * 7 * (pixelRatio * 0.5) * particleScale
      gl_PointSize = max(0.0, vScale) * 7.0 * (uPixelRatio * 0.5) * uParticleScale;
    }
  `,

  fragmentShader: `
    precision highp float;
    uniform vec3  uColor1;
    uniform vec3  uColor2;
    uniform vec3  uColor3;
    uniform vec2  uRingPos;
    uniform float uAlpha;
    uniform float uTime;
    uniform float uLightMode;
    varying float vScale;
    varying float vAngle;
    varying vec2  vLocalPos;

    ${GLSL_SIMPLEX}

    // Signed distance: axis-aligned rounded rectangle
    float sdRoundBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }

    vec2 rotate2D(vec2 v, float a) {
      return vec2(cos(a)*v.x - sin(a)*v.y, sin(a)*v.x + cos(a)*v.y);
    }

    void main() {
      // Color: world-space simplex noise  (exact real-site fragment code)
      float noiseColor = snoise(vec3(vLocalPos * 2.0 + vec2(74.664, 91.556),
                                     uTime * 0.5));
      noiseColor = (noiseColor + 1.0) * 0.5;  // remap [-1,1] -> [0,1]

      // Use linear progress (not squared) so all three colours spread evenly.
      // h=0.5 means color2 is at the midpoint, color3 fills the upper half.
      float h        = 0.5;
      float progress = smoothstep(0.0, 1.0, noiseColor);
      vec3  col      = mix(
        mix(uColor1, uColor2, progress / h),
        mix(uColor2, uColor3, (progress - h) / max(1.0 - h, 0.001)),
        step(h, progress)
      );

      // Orientation noise
      float noiseAngle = snoise(vec3(vLocalPos * 10.0 + vec2(18.4924, 72.9744),
                                      uTime * 0.85));

      // Shape: capsule oriented radially toward ring centre
      vec2 uv = gl_PointCoord.xy - vec2(0.5);
      uv.y *= -1.0;
      uv = rotate2D(uv, -vAngle + noiseAngle * 0.5);

      // sdRoundBox: wide short pill (same half-extents as real site)
      float sdf     = sdRoundBox(uv, vec2(0.5, 0.2), 0.25);
      float rounded = smoothstep(0.1, 0.0, sdf);

      float a = uAlpha * rounded * smoothstep(0.0, 0.15, vScale);
      a *= mix(0.95, 0.80, uLightMode);

      if (a < 0.01) discard;
      gl_FragColor = vec4(col, a);
    }
  `,

  transparent: true,
  depthTest:   false,
  depthWrite:  false,
});

function applyThemeToShader() {
  const p = isDark ? DARK_PAL : LIGHT_PAL;
  ptMaterial.uniforms.uColor1.value.copy(p[0]);
  ptMaterial.uniforms.uColor2.value.copy(p[1]);
  ptMaterial.uniforms.uColor3.value.copy(p[2]);
  ptMaterial.uniforms.uLightMode.value  = isDark ? 0.0 : 1.0;
  ptMaterial.uniforms.uParticleScale.value = isDark ? 3.0 : 2.0;
}

scene.add(new THREE.Points(geometry, ptMaterial));

// ── SIMULATION  (faithful CPU port of real site's GLSL RTT pass) ─
// Real site GLSL:
//   pos *= .8                                                 (damped accumulator)
//   pos -= (ringPos - refPos) * pow(t2, .75) * RING_D        (ring push)
//   finalPos = refPos + disp + pos * .25                     (world position)
//   scale += (t - scale) * .2                                (scale spring)
//   t includes world noise baseline -> all particles visible  (key difference!)
const RING_R = 0.55;   // ring sits further out from cursor
const RING_W  = 0.45;  // wide falloff — outer edge ~1.0 unit from cursor
const RING_W2 = 0.10;  // inner bright shell
const RING_D  = 0.3;

function simulate(t) {
  const nt  = t * 0.5;
  const rwx = isHovering ? ((mx / W) * 2 - 1) * aspect : -9999;
  const rwy = isHovering ? 1 - (my / H) * 2             : -9999;
  const rr  = RING_R + Math.sin(t) * 0.03 + Math.cos(t * 3) * 0.02;

  ptMaterial.uniforms.uRingPos.value.set(rwx, rwy);
  ptMaterial.uniforms.uTime.value = t;

  for (let i = 0; i < COUNT; i++) {
    const i2 = i * 2, i3 = i * 3;
    const rx = refPos[i2], ry = refPos[i2+1];

    // Noise displacement (ports real site snoise displacement calls)
    const n1 = snoiseCPU(rx * 4 + noiseOx[i],       ry * 4 + nt * 0.35);
    const n2 = snoiseCPU(rx * 4 + noiseOy[i] + 50,  ry * 4 + nt * 0.35);
    const n3 = snoiseCPU(rx * 20 + noiseOx[i] + 10, ry * 20 + nt * 0.5);
    const n4 = snoiseCPU(rx * 20 + noiseOy[i] + 60, ry * 20 + nt * 0.5);
    let dx = n1 * 0.03 + n3 * 0.005;
    let dy = n2 * 0.03 + n4 * 0.005;
    dx += Math.sin(rx * 20 + nt * 4) * 0.02;
    dy += Math.cos(ry * 20 + nt * 3) * 0.02;

    // Ring distance (aspect-corrected for isotropic ring on screen)
    const ddx  = (rx - rwx) / aspect;
    const ddy  =  ry - rwy;
    const dist = Math.sqrt(ddx*ddx + ddy*ddy);

    // Smoothstep ring bands (exact real site formula)
    // IMPORTANT: each band is a difference of two [0,1] values, so it can be
    // negative. Clamp before any pow() — Math.pow(negative, 0.75) === NaN.
    const tv  = Math.max(0, ss(rr - RING_W*2,  rr, dist) - ss(rr, rr + RING_W,  dist));
    const tv2 = Math.max(0, ss(rr - RING_W2*2, rr, dist) - ss(rr, rr + RING_W2, dist));
    const tv3 = Math.max(0, ss(rr + RING_W2, rr, dist)); // 1 inside ring, 0 outside

    // Ring scale — the ONLY source of scale; no ambient field.
    // Particles are invisible (scale≈0) far from cursor and
    // swell large as they enter the ring zone from all directions.
    let tRing = Math.pow(tv, 2) * 1.2 + Math.pow(tv2, 3) * 4.0 + tv3 * 0.5;

    // No ambient baseline — background stays completely empty.
    const tBase  = 0.0;

    const tTotal = Math.min(tBase + tRing, 1.4);

    // Damped accumulator (real site: pos *= 0.8)
    posDisp[i2]   *= 0.8;
    posDisp[i2+1] *= 0.8;
    if (isHovering) {
      // Ring snap displacement (existing)
      posDisp[i2]   -= (rwx - rx) * Math.pow(tv2, 0.75) * RING_D;
      posDisp[i2+1] -= (rwy - ry) * Math.pow(tv2, 0.75) * RING_D;

      // Gentle outward radial flow — all particles in the visible zone
      // slowly drift away from the cursor each frame, creating a flowing look.
      // ss() gives strongest push near cursor, fading to 0 at the outer edge.
      const flowInfluence = ss(RING_R + RING_W, 0.0, dist);
      if (flowInfluence > 0.0 && dist > 0.01) {
        const outX = (ddx * aspect) / dist;
        const outY =  ddy           / dist;
        const flowStr = flowInfluence * 0.022;
        posDisp[i2]   += outX * flowStr;
        posDisp[i2+1] += outY * flowStr;
      }
    }

    // Scale spring (real site: scaleDiff = t - scale; scaleDiff *= .2; scale += scaleDiff)
    scaleArr[i] += (tTotal - scaleArr[i]) * 0.2;
    if (!isFinite(scaleArr[i]) || scaleArr[i] < 0) scaleArr[i] = 0;

    // Final world position (real site: finalPos = curentPos + disp + pos * 0.25)
    const fx = rx + dx + posDisp[i2]   * 0.25;
    const fy = ry + dy + posDisp[i2+1] * 0.25;
    gpuPos[i3]   = isFinite(fx) ? fx : rx;
    gpuPos[i3+1] = isFinite(fy) ? fy : ry;
    gpuPos[i3+2] = 0;
    // Guard: if posDisp went NaN, reset it
    if (!isFinite(posDisp[i2]))   posDisp[i2]   = 0;
    if (!isFinite(posDisp[i2+1])) posDisp[i2+1] = 0;

    // Angle from ring center to particle (for dash/pill orientation in frag shader)
    angleArr[i] = Math.atan2(gpuPos[i3+1] - rwy, gpuPos[i3] - rwx);
  }

  posAttr.needsUpdate = true;
  sclAttr.needsUpdate = true;
  angAttr.needsUpdate = true;
}

// ── RENDER LOOP ───────────────────────────────────────────────
function renderFrame() {
  requestAnimationFrame(renderFrame);
  simulate(performance.now() / 1000);
  renderer.render(scene, camera);
}
renderFrame();

// ── RESIZE ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  W = window.innerWidth;
  H = window.innerHeight;
  aspect = W / H;
  renderer.setSize(W, H);
  camera.left   = -aspect;
  camera.right  =  aspect;
  camera.top    =  1;
  camera.bottom = -1;
  camera.updateProjectionMatrix();
  initParticles();
  for (let i = 0; i < COUNT; i++) {
    gpuPos[i*3]   = refPos[i*2];
    gpuPos[i*3+1] = refPos[i*2+1];
    gpuPos[i*3+2] = 0;
  }
});

// =============================================================
// UI LOGIC
// =============================================================

function syncBtn() {
  goBtn.classList.toggle('ready', wordInput.value.trim().length > 0);
}
wordInput.addEventListener('input',  syncBtn);
wordInput.addEventListener('keyup',  syncBtn);
wordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); launch(); }
});
goBtn.addEventListener('click',   () => launch());
backBtn.addEventListener('click', () => reset());
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && displayScreen.classList.contains('active')) reset();
});

function launch() {
  const word = wordInput.value.trim();
  if (!word) return;
  wordDisplay.textContent = word;
  promptScreen.classList.remove('active');
  setTimeout(() => {
    promptScreen.style.display = 'none';
    displayScreen.classList.add('active');
    wordDisplay.style.animation = 'none';
    void wordDisplay.offsetWidth;
    wordDisplay.style.animation = '';
  }, 450);
}

function reset() {
  displayScreen.classList.remove('active');
  setTimeout(() => {
    promptScreen.style.display = '';
    promptScreen.classList.add('active');
    wordInput.value = '';
    goBtn.classList.remove('ready');
    wordInput.focus();
  }, 400);
}

setTimeout(() => wordInput.focus(), 80);
