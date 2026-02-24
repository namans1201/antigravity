import * as THREE from 'three';

// --- Simplex Noise GLSL ---
const simplexNoise = `
//
// Description : Array and textureless GLSL 2D/3D/4D simplex 
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
// 

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
  { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
  }
`;

// --- SHADERS ---

// 1. Simulation Vertex (Pass-through)
const simVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`;

// 2. Simulation Fragment (Physics)
const simFragmentShader = `
precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform sampler2D uPosNearest;

uniform vec2 uMousePos;
uniform float uTime;
uniform float uDeltaTime;
uniform float uIsHovering;
uniform vec2 uResolution; // Texture size (so we can use gl_FragCoord)

varying vec2 vUv;

vec2 hash( vec2 p ){
    p = vec2( dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)) );
    return fract(sin(p)*43758.5453);
}

void main() {
    // Instead of hardcoded size, use uv
    vec2 simTexCoords = vUv;
    vec4 pFrame = texture2D(uPosition, simTexCoords);

    float scale = pFrame.z;
    float velocity = pFrame.w;
    vec2 refPos = texture2D(uPosRefs, simTexCoords).xy;
    vec2 nearestPos = texture2D(uPosNearest, simTexCoords).xy;
    float seed = hash(simTexCoords).x;
    float seed2 = hash(simTexCoords).y;

    float time = uTime * .5;
    float lifeEnd = 3. + sin(seed2 * 100.) * 1.;
    float lifeTime = mod((seed * 100.) + time, lifeEnd);

    vec2 disp = vec2(0., 0.);
    vec2 pos = pFrame.xy; // Current position

    float distRadius = 0.15; // Interaction radius

    vec2 targetPos = refPos;
    // Morph logic: move to nearestPos if hovering
    targetPos = mix(targetPos, nearestPos, uIsHovering * uIsHovering);

    // Simple ease towards target
    vec2 direction = targetPos - pos;

    // "Magnetic" mouse interaction (based on logic inferred from main.js and shader)
    // The original shader code had:
    // float dist = length(targetPos - pos);
    // float distStrength = smoothstep(distRadius, 0., dist);
    // if(dist > 0.005){ pos += direction * distStrength; } -> This logic is weird if direction is normalized.
    // Wait, extracting the original logic carefully:
    
    // Original extracted snippet:
    /*
    vec2 direction = normalize(targetPos - pos);
    direction *= .01;
    float dist = length(targetPos - pos);
    float distStrength = smoothstep(distRadius, 0., dist); // This makes it move SLOWER as it gets CLOSER? No, 0 is destination.
    // Wait, smoothstep(edge0, edge1, x). If dist is 0.15 -> 0. If dist is 0 -> 1.
    // So distStrength is closer to 1 when closer to target.
    
    if(dist > 0.005){
         pos += direction * distStrength; 
         // This moves particles towards target.
    }
    */
    
    // Let's implement basic homing w/ noise
    float distToTarget = length(targetPos - pos);
    if(distToTarget > 0.001) {
        pos += (targetPos - pos) * 0.1; // Easing
    }

    // Mouse Interaction
    // In original code, mouse interaction seemed handled by offsets or a separate loop?
    // Let's look at simMaterial uniforms: uRingRadius, uRingDisplacement.
    // And render shader had mouse interaction!
    // But GPGPU usually handles position updates.
    
    // Let's add repulsion from mouse
    float mouseDist = length(pos - uMousePos);
    float mouseRadius = 0.3;
    if(mouseDist < mouseRadius) {
        vec2 pushDir = normalize(pos - uMousePos);
        float pushStrength = (1.0 - mouseDist/mouseRadius) * 0.05;
        pos += pushDir * pushStrength;
    }


    if(lifeTime < .01){
        pos = refPos;
        pFrame.xy = refPos;
        scale = 0.;
    }

    // Add scale logic from original
    // float targetScale = ...
    float targetScale = smoothstep(.01, 0.5, lifeTime) - smoothstep(0.5, 1., lifeTime/lifeEnd);
    // Modify scale based on hovering
    targetScale += smoothstep(0.1, 0., smoothstep(0.001, .1, length(targetPos - pos))) * 1.5 * uIsHovering;

    float scaleDiff = targetScale - scale;
    scaleDiff *= .1;
    scale += scaleDiff;

    vec2 finalPos = pos;
    velocity = smoothstep(distRadius, .001, length(targetPos - pos)) * uIsHovering;

    gl_FragColor = vec4(finalPos, scale, velocity);
}
`;

// 3. Render Vertex Shader
const renderVertexShader = `
precision highp float;
attribute vec4 seeds;

uniform sampler2D uPosition;
uniform float uTime;
uniform float uParticleScale;
uniform float uPixelRatio;
uniform int uColorScheme;
uniform float uIsHovering;
uniform float uPulseProgress;

varying vec4 vSeeds;
varying float vVelocity;
varying vec2 vLocalPos;
varying vec2 vScreenPos;
varying float vScale;

${simplexNoise}

void main() {
    vSeeds = seeds;
    vec2 uv = position.xy; // This is actually uv from geometry because we use points/mesh?
    // Wait, Geometry in main.js uses 'uv' attribute for texture lookup
    // The geometry is Points? Or InstancedMesh?
    // "this.mesh = new ef(t, this.renderMaterial)" -> t = BufferGeometry.
    // t.setAttribute("position", ... r ... count*3) -> this is actual 3D position?
    // No, looked like: i[s*2]=a/this.size, i[s*2+1]=l/this.size -> UVs!
    // The "position" attribute in Geometry seems to be just placeholder or maybe initial positions?
    // In GPGPU Points, we usually use the attribute to lookup texture.
    
    // Let's assume standard GPGPU point rendering:
    // attribute 'uv' is passed to lookup texture.
    
    vec4 pos = texture2D(uPosition, uv); 

    // Noise displacement (from original code)
    float noiseX = snoise(vec3( vec2(pos.xy * 10.), uTime * .2 + 100.));
    float noiseY = snoise(vec3( vec2(pos.xy * 10.), uTime * .2));
    float noiseX2 = snoise(vec3( vec2(pos.xy * .5), uTime * .15 + 45.));
    float noiseY2 = snoise(vec3( vec2(pos.xy * .5), uTime * .15 + 87.));

    // make a smooth disc shape distortion
    float cDist = length(pos.xy) * 1.;
    float progress = uPulseProgress;
    // ... skipping pulse logic for now to keep it simple ...
    
    // Hover distortion
    float dist = smoothstep(0., 0.9, pos.w); // pos.w is velocity
    dist = mix(0., dist, uIsHovering);

    pos.y += noiseY * 0.005 * dist;
    pos.x += noiseX * 0.005 * dist;
    pos.y += noiseY2 * 0.02;
    pos.x += noiseX2 * 0.02;

    vVelocity = pos.w;
    vScale = pos.z;
    vLocalPos = pos.xy;
    
    vec4 viewSpace  = modelViewMatrix * vec4(vec3(pos.xy, 0.), 1.0);
    gl_Position = projectionMatrix * viewSpace;
    vScreenPos = gl_Position.xy;

    float minScale = .25;
    minScale += float(uColorScheme) * .75;

    // Apply scaling
    gl_PointSize = ((vScale * 7.) * (uPixelRatio * 0.5) * uParticleScale) + (minScale * uPixelRatio);
    gl_PointSize = max(gl_PointSize, 0.0); // Safety
}
`;

// 4. Render Fragment Shader
const renderFragmentShader = `
precision highp float;

varying vec4 vSeeds;
varying vec2 vScreenPos;
varying vec2 vLocalPos;
varying float vScale;
varying float vVelocity;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

uniform vec2 uMousePos;
uniform vec2 uRez;

uniform float uAlpha;
uniform float uTime;
uniform int uColorScheme;

// Include noise again if needed? Or passed? Fragment shader needs its own functions.
${simplexNoise}

#define PI 3.1415926535897932384626433832795

float sdRoundBox( in vec2 p, in vec2 b, in vec4 r )
{
    r.xy = (p.x>0.0)?r.xy : r.zw;
    r.x  = (p.y>0.0)?r.x  : r.y;
    vec2 q = abs(p)-b+r.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}

vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, s, -s, c);
    return m * v;
}

void main() {

    float uBorderSize = 0.2;
    float ratio = uRez.x / uRez.y;

    // Mouse interaction for rotation/color?
    // Original: float angle = atan(vLocalPos.y - uMousePos.y, vLocalPos.x - uMousePos.x);

    vec2 uv = gl_PointCoord.xy;
    uv -= vec2(0.5);
    uv.y *= -1.;

    // Shape Drawing
    // Original draws multiple shapes and mixes them?
    
    // Background Color Mixing based on 'velocity' (progress)
    float h = 0.8; 
    float progress = vVelocity;
    // Mix 3 colors
    vec3 col = mix(mix(uColor1, uColor2, progress/h), mix(uColor2, uColor3, (progress - h)/(1.0 - h)), step(h, progress));
    vec3 color = col;

    float dist = length(uv);
    float dr = .5;
    
    // Circle shape
    float t = smoothstep(dr, dr-0.05, dist);

    // Alpha based on scale
    float a = uAlpha * t * smoothstep(0.1, 0.2, vScale);

    if(a < 0.01) discard;

    gl_FragColor = vec4(color, a);
}
`;


// --- MAIN SCRIPT ---

const SIZE = 256; // Texture size (256x256 particles)
const COUNT = SIZE * SIZE;

let renderer, scene, camera;
let simScene, simCamera, simMaterial;
let rt1, rt2; // Ping-pong buffers
let renderMaterial, particlesMesh;
let mouse = new THREE.Vector2(0, 0);
let rawMouse = new THREE.Vector2(0, 0); // Normalized -1 to 1

init();
animate();

function init() {
    // 1. Setup Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance" 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 2. Setup Render Camera (Perspective)
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3.5;

    // 3. Setup Simulation Scene (GPGPU)
    simScene = new THREE.Scene();
    simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // 4. Create Initial Data Textures
    const initialPosData = new Float32Array(COUNT * 4);
    const initialPosNearestData = new Float32Array(COUNT * 4);
    
    for (let i = 0; i < COUNT; i++) {
        // Random spread for background
        const x = (Math.random() * 2 - 1) * 2.0; 
        const y = (Math.random() * 2 - 1) * 1.0;
        const z = Math.random(); // Scale
        const w = 0; // Velocity/Progress

        initialPosData[i * 4] = x;
        initialPosData[i * 4 + 1] = y;
        initialPosData[i * 4 + 2] = z;
        initialPosData[i * 4 + 3] = w;

        // Target: same for now, or maybe organized in grid?
        initialPosNearestData[i * 4] = x;
        initialPosNearestData[i * 4 + 1] = y;
    }

    const posTex = new THREE.DataTexture(initialPosData, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    
    const posNearestTex = new THREE.DataTexture(initialPosNearestData, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType);
    posNearestTex.needsUpdate = true;

    // 5. Setup Ping-Pong Render Targets
    rt1 = new THREE.WebGLRenderTarget(SIZE, SIZE, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        stencilBuffer: false,
        depthBuffer: false
    });
    rt2 = rt1.clone();

    // 6. Setup Simulation Material
    simMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uPosition: { value: posTex },
            uPosRefs: { value: posTex },
            uPosNearest: { value: posNearestTex },
            uMousePos: { value: new THREE.Vector2(0, 0) },
            uTime: { value: 0 },
            uDeltaTime: { value: 0 },
            uIsHovering: { value: 0 }, // 0 = background mode, 1 = text mode
            uResolution: { value: new THREE.Vector2(SIZE, SIZE) }
        },
        vertexShader: simVertexShader,
        fragmentShader: simFragmentShader
    });

    const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
    simScene.add(simQuad);

    // Initial render to fill rt1 with posTex data (optional, but good practice)
    renderer.setRenderTarget(rt1);
    renderer.render(simScene, simCamera);
    renderer.setRenderTarget(null);

    // 7. Setup Render Scene (Particles)
    scene = new THREE.Scene();

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3); // Not used really, but needed for bounding box maybe?
    const uvs = new Float32Array(COUNT * 2);
    
    for (let i = 0; i < COUNT; i++) {
        const u = (i % SIZE) / SIZE;
        const v = Math.floor(i / SIZE) / SIZE;
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
        positions[i*3] = 0; 
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); // IMPORTANT: Used for texture lookup

    renderMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uPosition: { value: null }, // Will set to rt2.texture
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color("#318bf7") }, // Google Blue
            uColor2: { value: new THREE.Color("#bada4c") }, // Greenish
            uColor3: { value: new THREE.Color("#e35058") }, // Red
            uAlpha: { value: 1.0 },
            uIsHovering: { value: 0 },
            uMousePos: { value: new THREE.Vector2(0, 0) },
            uRez: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uParticleScale: { value: 1.0 },
            uPixelRatio: { value: window.devicePixelRatio },
            uColorScheme: { value: 0 }
        },
        vertexShader: renderVertexShader,
        fragmentShader: renderFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.NormalBlending 
    });

    particlesMesh = new THREE.Points(geometry, renderMaterial);
    scene.add(particlesMesh);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderMaterial.uniforms.uRez.value.set(window.innerWidth, window.innerHeight);
    renderMaterial.uniforms.uPixelRatio.value = window.devicePixelRatio;
}

function onMouseMove(e) {
    // Map mouse to [-1, 1] for shader
    rawMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    rawMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    // Convert to world space for sim if needed?
    // The shader seems to use raw world coordinates or screen relative?
    // Let's assume the particle world in clip space [-1, 1] or similar
    
    // Project mouse to World Plane z=0?
    // Since camera is at z=3.5, and particles at 0.
    const vec = new THREE.Vector3(rawMouse.x, rawMouse.y, 0.5);
    vec.unproject(camera);
    const dir = vec.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    mouse.copy(pos); // World position on z=0 plane
}

const clock = new THREE.Clock();
let step = 0;

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    const dt = clock.getDelta();

    // 1. Simulation Step (GPGPU)
    
    // Ping-pong
    const currentRt = step % 2 === 0 ? rt1 : rt2;
    const nextRt = step % 2 === 0 ? rt2 : rt1;
    
    simMaterial.uniforms.uPosition.value = currentRt.texture;
    simMaterial.uniforms.uTime.value = time;
    simMaterial.uniforms.uDeltaTime.value = dt;
    simMaterial.uniforms.uMousePos.value = mouse; // Pass world mouse pos
    
    renderer.setRenderTarget(nextRt);
    renderer.render(simScene, simCamera);
    renderer.setRenderTarget(null);

    // 2. Render Step
    renderMaterial.uniforms.uPosition.value = nextRt.texture;
    renderMaterial.uniforms.uTime.value = time;
    renderMaterial.uniforms.uMousePos.value = mouse;

    renderer.render(scene, camera);
    
    step++;
}
