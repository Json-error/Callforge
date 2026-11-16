// 3D background: a spiraling football flying over a night-lit football field.
import * as THREE from "three";

export function startScene(canvas) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    canvas.style.background = "radial-gradient(ellipse at 60% 20%, #1a2a1e, #06080d 70%)";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const bg = new THREE.Color("#06080d");
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 14, 70);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  // ---------- Lights ----------
  scene.add(new THREE.HemisphereLight("#bcd4ff", "#0b1a10", 0.55));
  const key = new THREE.DirectionalLight("#ffe2c4", 2.6);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#ff8a3d", 2.2);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  const fill = new THREE.PointLight("#6aa8ff", 18, 30);
  fill.position.set(-3, 3, 5);
  scene.add(fill);

  // ---------- Field ----------
  const field = makeField();
  scene.add(field);

  // Stadium light glows on the horizon
  const glowTex = makeGlowTexture();
  const lights = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const m = new THREE.SpriteMaterial({ map: glowTex, color: "#fff2dc", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const s = new THREE.Sprite(m);
    s.position.set(side * (18 + Math.random() * 4), 9 + Math.random() * 2, -20 - Math.floor(i / 2) * 22);
    s.scale.setScalar(7);
    lights.add(s);
  }
  scene.add(lights);

  // Floating dust / stars
  const dustCount = 900;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 60;
    dustPos[i * 3 + 1] = Math.random() * 22 + 0.5;
    dustPos[i * 3 + 2] = -Math.random() * 120 + 10;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: "#ffd2a8", size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(dust);

  // ---------- Football ----------
  const ball = makeFootball();
  const ballPivot = new THREE.Group(); // tilt/orientation of flight
  ballPivot.add(ball);
  scene.add(ballPivot);

  // Spiral trail
  const trailLen = 40;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(trailLen * 3);
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: "#ff7a1a", transparent: true, opacity: 0.35 }));
  scene.add(trail);
  let trailInit = false;

  // ---------- Interaction ----------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollT = 0, scrollTarget = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener("scroll", readScroll, { passive: true });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();
  readScroll();

  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let spin = 0;
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); loop(); }
  });

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const narrow = camera.aspect < 0.9;

    scrollT += (scrollTarget - scrollT) * 0.08;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    // Camera flies downfield as the page scrolls
    const camZ = 12 - scrollT * 70;
    camera.position.set(pointer.x * 0.8, 4.2 - scrollT * 1.2 - pointer.y * 0.4, camZ);
    camera.lookAt(pointer.x * 0.4, 1.2, camZ - 14);

    // Ball flies ahead of the camera on a gentle arc, drifting side to side
    const hero = Math.max(0, 1 - scrollT * 6); // 1 at top, 0 after the hero
    const sideX = narrow ? 0.5 : 0.15; // hero: centered in the gap between headline and photo card
    ball.scale.setScalar(narrow ? 0.55 : 0.9);
    const bx = THREE.MathUtils.lerp(Math.sin(scrollT * 9) * (narrow ? 0.6 : 1.8), sideX, hero);
    const by = 2.9 + Math.sin(t * 1.3) * 0.18 + Math.sin(scrollT * Math.PI * 6) * 0.35 + (narrow ? 1.2 : 0.55) * hero;
    const bz = camZ - 7.5 + hero * 0.5;
    ballPivot.position.set(bx, by, bz);

    // Orientation: nose pointed down the field, slight upward tilt + wobble
    ballPivot.rotation.set(
      0,
      Math.PI / 2 + 0.35 + Math.sin(t * 0.6) * 0.12 + pointer.x * 0.25,
      0.25 + Math.sin(t * 0.9) * 0.05 - pointer.y * 0.15
    );
    spin += dt * (reduceMotion ? 0.6 : 7.5);
    ball.rotation.x = spin; // spiral around the long axis

    // Trail behind the ball (world space)
    ballPivot.updateMatrixWorld();
    tmp.set(-1.35, 0, 0).applyMatrix4(ballPivot.matrixWorld);
    if (!trailInit) {
      for (let i = 0; i < trailLen; i++) trailPos.set([tmp.x, tmp.y, tmp.z], i * 3);
      trailInit = true;
    }
    trailPos.copyWithin(3, 0, (trailLen - 1) * 3);
    // offset tail backward a bit each frame so it reads as motion
    for (let i = 1; i < trailLen; i++) trailPos[i * 3 + 2] += 0.06;
    trailPos[0] = tmp.x; trailPos[1] = tmp.y; trailPos[2] = tmp.z;
    trailGeo.attributes.position.needsUpdate = true;

    dust.rotation.y = Math.sin(t * 0.05) * 0.05;
    dust.position.y = Math.sin(t * 0.3) * 0.2;

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    frame();
    requestAnimationFrame(loop);
  }
  loop();
}

// ---------- Builders ----------

function makeFootball() {
  // Prolate spheroid from a lathe profile (long axis along Y, rotated to X below)
  const pts = [];
  const L = 1.35, R = 0.82, seg = 48;
  for (let i = 0; i <= seg; i++) {
    const y = -L + (2 * L * i) / seg;
    const k = 1 - Math.pow(Math.abs(y) / L, 2);
    const r = R * Math.pow(Math.max(k, 0), 0.72);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  const geo = new THREE.LatheGeometry(pts, 96);
  geo.computeVertexNormals();

  const { map, bump } = makeLeatherTextures();
  const mat = new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 2.2,
    roughness: 0.62,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const group = new THREE.Group();
  mesh.rotation.z = Math.PI / 2; // long axis -> X
  group.add(mesh);

  // 3D laces on top of the ball
  const laceMat = new THREE.MeshStandardMaterial({ color: "#f4efe6", roughness: 0.5 });
  const laces = new THREE.Group();
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.035, 0.05), laceMat);
  spine.position.y = 0.825;
  laces.add(spine);
  for (let i = 0; i < 8; i++) {
    const x = -0.4 + (i * 0.8) / 7;
    const r = 0.82 * Math.pow(1 - Math.pow(Math.abs(x) / 1.35, 2), 0.72);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.28), laceMat);
    bar.position.set(x, r + 0.01, 0);
    laces.add(bar);
  }
  group.add(laces);
  return group;
}

function makeLeatherTextures() {
  const W = 1024, H = 512; // u (around) x v (along)
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#4a230f");
  grad.addColorStop(0.5, "#7a3d1b");
  grad.addColorStop(1, "#4a230f");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // pebble grain
  for (let i = 0; i < 26000; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    g.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,200,150,0.05)";
    g.beginPath();
    g.arc(x, y, Math.random() * 1.8 + 0.4, 0, Math.PI * 2);
    g.fill();
  }

  // white stripes near each tip (v ~ 0.2 and 0.8)
  g.fillStyle = "#f2ece2";
  g.fillRect(0, H * 0.17, W, H * 0.035);
  g.fillRect(0, H * 0.795, W, H * 0.035);

  // seams between the four panels
  g.strokeStyle = "rgba(20,8,2,0.85)";
  g.lineWidth = 4;
  for (let k = 0; k < 4; k++) {
    const x = (W * (k + 0.5)) / 4;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  // bump map: grain + grooved seams
  const b = document.createElement("canvas");
  b.width = 512; b.height = 256;
  const bg = b.getContext("2d");
  bg.fillStyle = "#808080";
  bg.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 14000; i++) {
    const v = 128 + (Math.random() * 90 - 20);
    bg.fillStyle = `rgb(${v},${v},${v})`;
    bg.beginPath();
    bg.arc(Math.random() * 512, Math.random() * 256, Math.random() * 1.4 + 0.5, 0, Math.PI * 2);
    bg.fill();
  }
  bg.strokeStyle = "#202020";
  bg.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    const x = (512 * (k + 0.5)) / 4;
    bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, 256); bg.stroke();
  }
  const bump = new THREE.CanvasTexture(b);
  return { map, bump };
}

function makeField() {
  // 120 yards long; texture repeats along the length for an endless run downfield
  const W = 512, H = 1024;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? "#0f3d22" : "#124728";
    g.fillRect(0, (H * i) / stripes, W, H / stripes);
  }
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 5;
  for (let i = 0; i <= stripes; i++) {
    const y = (H * i) / stripes;
    g.beginPath(); g.moveTo(24, y); g.lineTo(W - 24, y); g.stroke();
  }
  // hash marks
  g.lineWidth = 3;
  for (let i = 0; i < stripes * 5; i++) {
    const y = (H * i) / (stripes * 5);
    [[24, 44], [W * 0.38, W * 0.38 + 16], [W * 0.62 - 16, W * 0.62], [W - 44, W - 24]].forEach(([a, b2]) => {
      g.beginPath(); g.moveTo(a, y); g.lineTo(b2, y); g.stroke();
    });
  }
  // sidelines
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(24, 0); g.lineTo(24, H); g.moveTo(W - 24, 0); g.lineTo(W - 24, H); g.stroke();
  // yard numbers
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.font = "bold 46px Arial";
  g.textAlign = "center";
  const nums = [10, 20, 30, 40, 50];
  for (let i = 0; i < stripes; i += 2) {
    const y = (H * i) / stripes;
    const n = String(nums[(i / 2) % nums.length]);
    g.save(); g.translate(78, y); g.rotate(Math.PI / 2); g.fillText(n, 0, 16); g.restore();
    g.save(); g.translate(W - 78, y); g.rotate(-Math.PI / 2); g.fillText(n, 0, 16); g.restore();
  }
  // subtle turf noise
  for (let i = 0; i < 30000; i++) {
    g.fillStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.07)" : "rgba(120,255,160,0.03)";
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  tex.anisotropy = 8;

  const geo = new THREE.PlaneGeometry(26, 200);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -80);
  return mesh;
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.15, "rgba(255,240,210,0.8)");
  r.addColorStop(0.5, "rgba(255,180,100,0.15)");
  r.addColorStop(1, "rgba(255,160,80,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
