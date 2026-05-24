// Antigravity particle field — faithful CPU port of the GLSL RTT sim in
// antigravity.google. Three.js renders 700 points; CPU updates state per frame.
// GLSL reference (per-particle, real site):
//   pos *= 0.8                                          // damped accumulator
//   pos -= (ringPos - refPos) * pow(t2, 0.75) * RING_D  // ring push
//   scale += (t - scale) * 0.2                          // scale spring
//   finalPos = refPos + noiseDisp + pos * 0.25

// ── DOM ──────────────────────────────────────────────────────
const canvas        = document.getElementById('canvas');
const themeToggle   = document.getElementById('themeToggle');
const promptScreen  = document.getElementById('promptScreen');
const displayScreen = document.getElementById('displayScreen');
const wordInput     = document.getElementById('wordInput');
const goBtn         = document.getElementById('goBtn');
const backBtn       = document.getElementById('backBtn');
const wordDisplay   = document.getElementById('wordDisplay');

// ── State ────────────────────────────────────────────────────
let mx = -9999, my = -9999, isHovering = false;
let W = window.innerWidth, H = window.innerHeight;
let aspect = W / H;
let isDark = false;

document.documentElement.setAttribute('data-theme', 'light');
document.addEventListener('mousemove',  e => { mx = e.clientX; my = e.clientY; isHovering = true; });
document.addEventListener('mouseleave', ()  => { mx = my = -9999; isHovering = false; });

themeToggle.addEventListener('click', () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  applyTheme();
});

// ── CPU noise helpers (displacement only; color noise lives in GLSL) ──
const hash = n => ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix     + iy * 57),       b = hash(ix + 1 + iy * 57);
  const c = hash(ix     + (iy + 1) * 57), d = hash(ix + 1 + (iy + 1) * 57);
  return a + (b - a) * ux + (c - a) * uy + (b - a + a - b - c + d) * ux * uy;
}
const snoise = (x, y, z) => (vnoise(x + z * 3.7, y + z * 2.1) - 0.5) * 2;
const ss = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ── Renderer / scene ─────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 1);
camera.position.z = 0.5;

// ── Particle buffers ─────────────────────────────────────────
const COUNT = 700;
const refPos  = new Float32Array(COUNT * 2);  // home position (set once at init)
const posDisp = new Float32Array(COUNT * 2);  // accumulated displacement (decays 0.8/frame)
const noiseO  = new Float32Array(COUNT * 2);  // per-particle noise phase
const gpuPos  = new Float32Array(COUNT * 3);  // world xyz (updated per frame)
const scaleAr = new Float32Array(COUNT);      // gl_PointSize driver
const angleAr = new Float32Array(COUNT);      // dash orientation (radial from cursor)

function initParticles() {
  aspect = W / H;
  const cols = Math.round(Math.sqrt(COUNT * aspect));
  const rows = Math.round(COUNT / cols);
  let i = 0;
  for (let r = 0; r < rows && i < COUNT; r++) {
    for (let c = 0; c < cols && i < COUNT; c++, i++) {
      const jx = (Math.random() - 0.5) * (2 * aspect / cols) * 0.85;
      const jy = (Math.random() - 0.5) * (2          / rows) * 0.85;
      refPos [i*2]   = (c + 0.5) / cols * 2 * aspect - aspect + jx;
      refPos [i*2+1] = (r + 0.5) / rows * 2 - 1 + jy;
      posDisp[i*2]   = posDisp[i*2+1] = 0;
      noiseO [i*2]   = Math.random() * 100;
      noiseO [i*2+1] = Math.random() * 100;
      gpuPos [i*3]   = refPos[i*2];
      gpuPos [i*3+1] = refPos[i*2+1];
      gpuPos [i*3+2] = 0;
    }
  }
}
initParticles();

const geometry = new THREE.BufferGeometry();
const dyn = THREE.DynamicDrawUsage;
geometry.setAttribute('position', new THREE.BufferAttribute(gpuPos,  3).setUsage(dyn));
geometry.setAttribute('aScale',   new THREE.BufferAttribute(scaleAr, 1).setUsage(dyn));
geometry.setAttribute('aAngle',   new THREE.BufferAttribute(angleAr, 1).setUsage(dyn));
// Particles move every frame; skip auto-bounds (avoids NaN-radius warnings).
geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

// ── Palette (exact values from antigravity.google bundle) ────
const DARK_PAL  = [0x318bf7, 0xbada4c, 0xe35058].map(v => new THREE.Color(v));
const LIGHT_PAL = [0x6aaef6, 0x8ecf8a, 0xf4949c].map(v => new THREE.Color(v));

// ── GLSL 3D simplex (Ashima/Ian McEwan) — used for color/orientation ──
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
  vec3 g=step(x0.yzx,x0.xyz), l=1.-g;
  vec3 i1=min(g.xyz,l.zxy), i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx, x2=x0-i2+C.yyy, x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute4(permute4(permute4(
    i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))
    +i.x+vec4(0.,i1.x,i2.x,1.));
  vec3 ns=(1./7.)*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z), y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy, y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy), b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1., s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy, a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x), p1=vec3(a0.zw,h.y), p2=vec3(a1.xy,h.z), p3=vec3(a1.zw,h.w);
  vec4 norm=tayInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const material = new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false,
  uniforms: {
    uColor1:        { value: LIGHT_PAL[0].clone() },
    uColor2:        { value: LIGHT_PAL[1].clone() },
    uColor3:        { value: LIGHT_PAL[2].clone() },
    uPixelRatio:    { value: renderer.getPixelRatio() },
    uParticleScale: { value: 3.5 },
    uTime:          { value: 0 },
    uLightMode:     { value: 1 },
  },
  vertexShader: `
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
      // Real-site formula: scale * 7 * (pixelRatio * 0.5) * particleScale
      gl_PointSize = max(0.0, vScale) * 7.0 * (uPixelRatio * 0.5) * uParticleScale;
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform vec3  uColor1, uColor2, uColor3;
    uniform float uTime, uLightMode;
    varying float vScale, vAngle;
    varying vec2  vLocalPos;
    ${GLSL_SIMPLEX}

    float sdRoundBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }
    vec2 rotate2D(vec2 v, float a) {
      float c = cos(a), s = sin(a);
      return vec2(c*v.x - s*v.y, s*v.x + c*v.y);
    }
    void main() {
      // Spatial colour: simplex over world position blends the three palette stops.
      float n = snoise(vec3(vLocalPos * 2.0 + vec2(74.664, 91.556), uTime * 0.5));
      float p = smoothstep(0.0, 1.0, (n + 1.0) * 0.5);
      vec3  col = mix(mix(uColor1, uColor2, p / 0.5),
                      mix(uColor2, uColor3, (p - 0.5) / 0.5),
                      step(0.5, p));

      // Dash shape: short pill oriented radially from the cursor, jittered by noise.
      float angleN = snoise(vec3(vLocalPos * 10.0 + vec2(18.4924, 72.9744), uTime * 0.85));
      vec2  uv  = gl_PointCoord - 0.5;  uv.y = -uv.y;
      uv  = rotate2D(uv, -vAngle + angleN * 0.5);
      float sdf = sdRoundBox(uv, vec2(0.5, 0.2), 0.25);
      float a   = smoothstep(0.1, 0.0, sdf) * smoothstep(0.0, 0.15, vScale);
      a *= mix(0.95, 0.80, uLightMode);
      if (a < 0.01) discard;
      gl_FragColor = vec4(col, a);
    }
  `,
});

function applyTheme() {
  const p = isDark ? DARK_PAL : LIGHT_PAL;
  material.uniforms.uColor1.value.copy(p[0]);
  material.uniforms.uColor2.value.copy(p[1]);
  material.uniforms.uColor3.value.copy(p[2]);
  material.uniforms.uLightMode.value     = isDark ? 0 : 1;
  material.uniforms.uParticleScale.value = isDark ? 5.0 : 3.5;
}

scene.add(new THREE.Points(geometry, material));

// ── Simulation ───────────────────────────────────────────────
const RING_R = 0.175, RING_W = 0.05, RING_W2 = 0.015, RING_D = 0.3;

function simulate(t) {
  const nt = t * 0.5;
  const rwx = isHovering ? ((mx / W) * 2 - 1) * aspect : -9999;
  const rwy = isHovering ?  1 - (my / H) * 2          : -9999;
  // Subtle radial pulse so the ring breathes (real site uses sin+cos modulation).
  const rr  = RING_R + Math.sin(t) * 0.03 + Math.cos(t * 3) * 0.02;

  material.uniforms.uTime.value = t;

  const posAttr = geometry.attributes.position;
  const sclAttr = geometry.attributes.aScale;
  const angAttr = geometry.attributes.aAngle;

  for (let i = 0; i < COUNT; i++) {
    const i2 = i * 2, i3 = i * 3;
    const rx = refPos[i2], ry = refPos[i2 + 1];

    // Two-octave noise displacement (large-scale drift + fine jitter)
    const n1 = snoise(rx *  4 + noiseO[i2],       ry *  4 + nt * 0.35);
    const n2 = snoise(rx *  4 + noiseO[i2+1] + 50, ry *  4 + nt * 0.35);
    const n3 = snoise(rx * 20 + noiseO[i2]   + 10, ry * 20 + nt * 0.5 );
    const n4 = snoise(rx * 20 + noiseO[i2+1] + 60, ry * 20 + nt * 0.5 );
    const dx = n1 * 0.03 + n3 * 0.005 + Math.sin(rx * 20 + nt * 4) * 0.02;
    const dy = n2 * 0.03 + n4 * 0.005 + Math.cos(ry * 20 + nt * 3) * 0.02;

    // Aspect-corrected distance to ring centre.
    const ddx = (rx - rwx) / aspect;
    const ddy =  ry - rwy;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);

    // Smoothstep bands. Clamp before pow() — neg^0.75 = NaN.
    const tv  = Math.max(0, ss(rr - RING_W  * 2,  rr, dist) - ss(rr, rr + RING_W,  dist));
    const tv2 = Math.max(0, ss(rr - RING_W2 * 2, rr, dist) - ss(rr, rr + RING_W2, dist));
    const tv3 = Math.max(0, ss(rr + RING_W2, rr, dist));

    // Ring scale boost + noise-driven baseline (so the whole field stays visible).
    const tRing = tv * tv * 0.4 + tv2 * tv2 * tv2 * 0.8 + tv3 * 0.15;
    const nBase = snoise(rx * 2 + 18.4924, ry * 2 + 72.9744, nt * 0.5);
    const tBase = ((nBase + 1.5) * 0.5) ** 2 * 0.6;
    const tTotal = Math.min(tBase + tRing, 1.2);

    // Damped displacement accumulator + ring push.
    posDisp[i2]   *= 0.8;
    posDisp[i2+1] *= 0.8;
    if (isHovering) {
      const k = Math.pow(tv2, 0.75) * RING_D;
      posDisp[i2]   -= (rwx - rx) * k;
      posDisp[i2+1] -= (rwy - ry) * k;
    }

    // Scale spring + write attributes.
    scaleAr[i] += (tTotal - scaleAr[i]) * 0.2;
    if (scaleAr[i] < 0 || !isFinite(scaleAr[i])) scaleAr[i] = 0;
    if (!isFinite(posDisp[i2]))   posDisp[i2]   = 0;
    if (!isFinite(posDisp[i2+1])) posDisp[i2+1] = 0;

    const fx = rx + dx + posDisp[i2]   * 0.25;
    const fy = ry + dy + posDisp[i2+1] * 0.25;
    gpuPos[i3]   = isFinite(fx) ? fx : rx;
    gpuPos[i3+1] = isFinite(fy) ? fy : ry;
    gpuPos[i3+2] = 0;
    angleAr[i]   = Math.atan2(gpuPos[i3+1] - rwy, gpuPos[i3] - rwx);
  }

  posAttr.needsUpdate = sclAttr.needsUpdate = angAttr.needsUpdate = true;
}

// ── Render loop ──────────────────────────────────────────────
(function loop() {
  requestAnimationFrame(loop);
  simulate(performance.now() / 1000);
  renderer.render(scene, camera);
})();

window.addEventListener('resize', () => {
  W = window.innerWidth; H = window.innerHeight; aspect = W / H;
  renderer.setSize(W, H);
  camera.left = -aspect; camera.right = aspect;
  camera.top  =  1;      camera.bottom = -1;
  camera.updateProjectionMatrix();
  initParticles();
});

// ── UI ───────────────────────────────────────────────────────
const syncBtn = () => goBtn.classList.toggle('ready', wordInput.value.trim().length > 0);
wordInput.addEventListener('input', syncBtn);
wordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); launch(); } });
goBtn.addEventListener('click',  launch);
backBtn.addEventListener('click', reset);
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
