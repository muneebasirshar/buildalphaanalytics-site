import * as THREE from "three";

const section = document.getElementById("why");
const canvas = document.getElementById("why-webgl");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 780px)").matches;

const PAPER = 0xede9e0, AMBER = 0xe3a008, INK = 0x12161c;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function sectionProgress() {
  const r = section.getBoundingClientRect();
  return Math.min(1, Math.max(0, (window.innerHeight - r.top) / (r.height + window.innerHeight)));
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(227,160,8,1)");
  g.addColorStop(0.35, "rgba(227,160,8,0.45)");
  g.addColorStop(1, "rgba(227,160,8,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

if (section && canvas) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(INK, 7, 26);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  // floor grid receding into fog
  const grid = new THREE.GridHelper(44, 44, PAPER, PAPER);
  grid.position.y = -0.45;
  grid.material.transparent = true;
  grid.material.opacity = 0.14;
  grid.material.depthWrite = false;
  scene.add(grid);

  // ---- the forecast line: past (paper) → today → forecast (amber) ----
  const N = 48, TODAY = 28;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const x = -7.5 + (16 * i) / (N - 1);
    const y = 1.6 + 0.11 * i + 0.4 * Math.sin(i * 0.55) + 0.18 * Math.sin(i * 1.7 + 1.0);
    pts.push(new THREE.Vector3(x, y, 0));
  }
  const pastCurve = new THREE.CatmullRomCurve3(pts.slice(0, TODAY + 1));
  const futureCurve = new THREE.CatmullRomCurve3(pts.slice(TODAY));

  const pastGeo = new THREE.TubeGeometry(pastCurve, 140, 0.035, 8, false);
  const past = new THREE.Mesh(pastGeo, new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.85 }));
  scene.add(past);

  const futGeo = new THREE.TubeGeometry(futureCurve, 120, 0.05, 8, false);
  const future = new THREE.Mesh(futGeo, new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 1 }));
  scene.add(future);
  const haloGeo = new THREE.TubeGeometry(futureCurve, 120, 0.16, 8, false);
  const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(halo);

  // sample dots on the past line
  const dotPos = new Float32Array((TODAY + 1) * 3);
  for (let i = 0; i <= TODAY; i++) { dotPos[i * 3] = pts[i].x; dotPos[i * 3 + 1] = pts[i].y; dotPos[i * 3 + 2] = 0; }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
  const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: PAPER, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(dots);

  // "today" marker
  const todayX = pts[TODAY].x;
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.015, 2.8, 0.015), new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.35 }));
  marker.position.set(todayX, 3.1, 0);
  scene.add(marker);
  const markerBase = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 32), new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  markerBase.rotation.x = -Math.PI / 2;
  markerBase.position.set(todayX, -0.44, 0);
  scene.add(markerBase);

  // glowing head of the forecast line
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.scale.set(1.1, 1.1, 1);
  scene.add(head);

  // floating KPI cards at different depths
  const cards = [];
  const cardSpecs = [
    { pos: [-4.6, 2.9, -2.4], w: 1.8, h: 1.0, fill: 0.62, pulse: false },
    { pos: [2.2, 3.4, -4.2], w: 2.0, h: 1.1, fill: 0.78, pulse: true },
    { pos: [6.4, 1.6, -1.6], w: 1.6, h: 0.9, fill: 0.45, pulse: false },
  ];
  for (const spec of cardSpecs) {
    const g = new THREE.Group();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.05, depthWrite: false }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry), new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.45 }));
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * 0.8 * spec.fill, 0.05), new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.9 }));
    bar.position.set(-spec.w * 0.4 + (spec.w * 0.8 * spec.fill) / 2, -spec.h * 0.28, 0.01);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(spec.w * 0.45, 0.04), new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.5 }));
    label.position.set(-spec.w * 0.4 + spec.w * 0.225, spec.h * 0.28, 0.01);
    g.add(plane, edges, bar, label);
    g.position.set(...spec.pos);
    g.rotation.y = -0.25;
    scene.add(g);
    cards.push({ g, plane, spec });
  }

  const pastIndex = pastGeo.index.count, futIndex = futGeo.index.count, haloIndex = haloGeo.index.count;
  let progress = 0, time = 0, last = performance.now(), looping = false;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setRange(geo, total, f) {
    geo.setDrawRange(0, Math.max(0, Math.floor((total * f) / 6) * 6));
  }

  function update(dt) {
    progress = reduceMotion ? 0.7 : sectionProgress();
    time += dt;
    const fPast = smoothstep(0.08, 0.42, progress);
    const fFut = smoothstep(0.36, 0.8, progress);
    setRange(pastGeo, pastIndex, fPast);
    setRange(futGeo, futIndex, fFut);
    setRange(haloGeo, haloIndex, fFut);
    dots.geometry.setDrawRange(0, Math.floor(fPast * (TODAY + 1)));

    const headPt = futureCurve.getPointAt(Math.min(0.999, Math.max(0.001, fFut)));
    head.position.copy(headPt);
    head.material.opacity = fFut > 0.01 ? 0.75 + 0.25 * Math.sin(time * 4) : 0;
    head.scale.setScalar(1 + 0.15 * Math.sin(time * 3));

    marker.material.opacity = 0.35 * smoothstep(0.25, 0.4, progress);
    markerBase.material.opacity = 0.6 * smoothstep(0.25, 0.4, progress);

    for (const c of cards) {
      c.g.position.y = c.spec.pos[1] + Math.sin(time * 0.6 + c.spec.pos[0]) * 0.08;
      c.plane.material.opacity = c.spec.pulse ? 0.05 + 0.22 * Math.max(0, Math.sin(time * 1.4)) : 0.05;
    }

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    camera.position.set(0.4 + progress * 1.8 + mouse.x * 0.9, 2.6 + mouse.y * 0.5, 10.5);
    camera.lookAt(0.6 + progress * 2.2, 1.9, -1.5);
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

  resize();
  render();

  if (!reduceMotion) {
    new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting;
      if (on && !looping) { render(); looping = true; last = performance.now(); requestAnimationFrame(loop); }
      if (!on) looping = false;
    }, { rootMargin: "10% 0px" }).observe(section);

    window.addEventListener("scroll", () => { if (!looping || performance.now() - lastRenderAt > 120) render(); }, { passive: true });
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  window.addEventListener("resize", () => { resize(); render(); });
}
