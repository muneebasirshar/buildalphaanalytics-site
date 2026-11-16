import * as THREE from "three";

const section = document.getElementById("hero");
const canvas = document.getElementById("hero-webgl");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 780px)").matches;

const vertexShader = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aSeed;
  attribute float aKind;
  uniform float uProgress;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  varying float vKind;
  void main() {
    float delay = aSeed * 0.5;
    float t = clamp(uProgress * 1.5 - delay, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(position, aTarget, t);
    float drift = 1.0 - t * 0.85;
    p.x += sin(uTime * 0.7 + aSeed * 40.0) * 0.06 * drift;
    p.y += cos(uTime * 0.5 + aSeed * 23.0) * 0.06 * drift + sin(uTime * 0.9 + aSeed * 9.0) * 0.012;
    p.z += sin(uTime * 0.4 + aSeed * 13.0) * 0.05 * drift;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float base = aKind > 1.5 ? 3.2 : (aKind > 0.5 ? 2.4 : 1.6);
    gl_PointSize = base * uPixelRatio * (16.0 / max(1.0, -mv.z));
    vAlpha = (0.22 + 0.78 * t) * smoothstep(-28.0, -6.0, mv.z);
    vKind = aKind;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uPaper;
  uniform vec3 uAmber;
  varying float vAlpha;
  varying float vKind;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float glow = pow(1.0 - r * 2.0, 1.5);
    vec3 col = vKind > 1.5 ? uAmber : uPaper;
    float a = glow * vAlpha * (vKind > 0.5 ? 0.9 : 0.45);
    gl_FragColor = vec4(col, a);
  }
`;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const forcedProgress = parseFloat(new URLSearchParams(location.search).get("p"));

function sectionProgress() {
  if (!Number.isNaN(forcedProgress)) return Math.min(1, Math.max(0, forcedProgress));
  const scrollable = section.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  const top = section.getBoundingClientRect().top;
  return Math.min(1, Math.max(0, -top / scrollable));
}

if (section && canvas) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  const group = new THREE.Group();
  scene.add(group);

  // ---- a 3D bar chart + forecast line that the particles assemble into ----
  const BARS = 14;
  const COUNT = isMobile ? 2400 : 5600;
  const rand = mulberry32(7);
  const spacing = 0.62, barW = 0.36, barDepth = 0.36, floorY = -1.6;
  const x0 = -((BARS - 1) * spacing) / 2;
  const heights = [];
  for (let i = 0; i < BARS; i++) {
    const trend = 0.9 + 2.4 * (i / (BARS - 1));
    const wobble = 0.55 * Math.sin(i * 1.9 + 0.6) * (1 - i / (BARS * 1.6));
    heights.push(Math.max(0.5, trend + wobble));
  }
  const lineY = (i) => floorY + heights[i] + 0.55;

  const scatter = new Float32Array(COUNT * 3);
  const target = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const kind = new Float32Array(COUNT);
  const nBar = Math.floor(COUNT * 0.58);
  const nLine = Math.floor(COUNT * 0.17);
  let p = 0;
  for (let i = 0; i < nBar; i++, p++) {
    const b = Math.floor(rand() * BARS);
    const h = heights[b];
    const yy = rand() * h;
    target[p * 3] = x0 + b * spacing + (rand() - 0.5) * barW;
    target[p * 3 + 1] = floorY + yy;
    target[p * 3 + 2] = (rand() - 0.5) * barDepth;
    kind[p] = yy > h - 0.14 ? 2 : 1;
  }
  for (let i = 0; i < nLine; i++, p++) {
    const t = rand() * (BARS - 1);
    const i0 = Math.floor(t), i1 = Math.min(BARS - 1, i0 + 1), f = t - i0;
    target[p * 3] = x0 + t * spacing + (rand() - 0.5) * 0.05;
    target[p * 3 + 1] = lineY(i0) * (1 - f) + lineY(i1) * f + (rand() - 0.5) * 0.07;
    target[p * 3 + 2] = (rand() - 0.5) * 0.08;
    kind[p] = 2;
  }
  for (; p < COUNT; p++) {
    target[p * 3] = (rand() - 0.5) * 11;
    target[p * 3 + 1] = floorY - 0.05 + (rand() - 0.5) * 0.04;
    target[p * 3 + 2] = (rand() - 0.5) * 6 - 0.5;
    kind[p] = 0;
  }
  for (let i = 0; i < COUNT; i++) {
    scatter[i * 3] = (rand() - 0.5) * 16;
    scatter[i * 3 + 1] = floorY - 0.6 + Math.pow(rand(), 1.8) * 5.5;
    scatter[i * 3 + 2] = (rand() - 0.5) * 9 - 1;
    seed[i] = rand();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));

  const uniforms = {
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uPaper: { value: new THREE.Color("#EDE9E0") },
    uAmber: { value: new THREE.Color("#E3A008") },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  group.add(points);

  const grid = new THREE.GridHelper(14, 20, 0xede9e0, 0xede9e0);
  grid.position.y = floorY - 0.08;
  grid.material.transparent = true;
  grid.material.opacity = 0;
  grid.material.depthWrite = false;
  group.add(grid);

  // ---- state ----
  let progress = 0, time = 0, last = performance.now();
  let visible = true, looping = false;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function update(dt) {
    progress = reduceMotion ? 1 : sectionProgress();
    time += dt;
    uniforms.uProgress.value = progress;
    uniforms.uTime.value = time;
    grid.material.opacity = 0.16 * smoothstep(0.15, 0.6, progress);
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    camera.position.set(mouse.x * 0.9, 0.9 + mouse.y * 0.5 - progress * 0.35, 11.5 - progress * 2.4);
    camera.lookAt(0, -0.3 + progress * 0.4, 0);
    group.rotation.y = -0.42 + progress * 0.55 + mouse.x * 0.06;
    group.position.y = -0.25;
  }

  let lastRenderAt = 0;
  function render() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lastRenderAt = now;
    update(dt);
    renderer.render(scene, camera);
  }
  canvas.__render = render;

  function loop() {
    if (!looping) return;
    render();
    requestAnimationFrame(loop);
  }

  function startLoop() {
    if (looping || reduceMotion) return;
    looping = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  resize();
  render();

  if (!reduceMotion) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) { render(); startLoop(); } else looping = false;
    }).observe(section);

    // Also render directly on scroll/pointer events so the scene stays in step
    // even when the page's animation frames are throttled.
    window.addEventListener("scroll", () => { if (!looping || performance.now() - lastRenderAt > 120) render(); }, { passive: true });
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  window.addEventListener("resize", () => { resize(); render(); });
}
