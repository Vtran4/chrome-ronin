// main.js — boot, loop, debug contract (G0: cel pass on greybox).
(function () {
  const CFG = window.CFG, qs = new URLSearchParams(location.search);
  const canvas = U.el('c');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.05, 220);
  camera.position.set(0, CFG.eyeH, 14);
  camera.lookAt(0, 1.4, -6);

  const world = World.build(scene);
  const cel = new CelPass(renderer);
  if (qs.get('manga') === '0') cel.enabled = false;
  const lockres = qs.has('lockres') || qs.has('t');

  // G0 demo shapes: prove outlines on curved + angular forms
  const demo = new THREE.Group(); scene.add(demo);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xe8e4da }));
  cube.position.set(-3.2, 1.3, -4); demo.add(cube);
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16),
    new THREE.MeshLambertMaterial({ color: 0xff4f7e }));
  sph.position.set(3.2, 1.4, -4); demo.add(sph);
  const torus = new THREE.Mesh(new THREE.TorusKnotGeometry(0.6, 0.22, 64, 12),
    new THREE.MeshLambertMaterial({ color: 0x35e0a1 }));
  torus.position.set(0, 2.2, -9); demo.add(torus);

  // ---- resize + dynamic resolution ----
  let W = 0, H = 0, scale = CFG.resMax;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    cel.setSize(W, H, scale);
  }
  window.addEventListener('resize', resize); resize();

  // ---- time + freeze ----
  const simT = qs.has('t') ? parseFloat(qs.get('t')) : Infinity;
  let sim = 0, frames = 0, msEma = 16.6, last = performance.now();

  function frame(now) {
    let dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t0 = performance.now();
    if (sim < simT) {
      sim += dt;
      cube.rotation.set(sim * 0.9, sim * 1.3, 0);
      torus.rotation.set(sim * 0.7, sim * 0.5, 0);
      sph.position.y = 1.4 + Math.sin(sim * 2) * 0.35;
      cel.tick(dt);
    }
    cel.render(scene, camera);
    const ms = performance.now() - t0;
    msEma = msEma * 0.92 + ms * 0.08;
    frames++;
    window.__frameMs = Math.round(msEma * 10) / 10;
    window.__fps = Math.round(1000 / msEma);
    if (!lockres) { // gentle dynamic scaler toward the 16.6ms budget
      const want = msEma > CFG.targetMs * 1.12 ? -0.06 : msEma < CFG.targetMs * 0.85 ? 0.03 : 0;
      const ns = U.clamp(scale + want, CFG.resMin, CFG.resMax);
      if (ns !== scale) { scale = ns; cel.setSize(W, H, scale); }
    }
    if (!window.__ready && frames > 2) {
      window.__ready = true;
      const b = U.el('boot'); if (b) b.style.display = 'none';
    }
    requestAnimationFrame(frame);
  }
  window.__state = function () {
    return JSON.stringify({ mode: 'greybox', wave: 0, score: 0, combo: 1, kills: 0, hp: CFG.hpMax, armor: 0, cel: cel.enabled, scale: scale });
  };
  window.__game = { renderer, scene, camera, cel, world, qs };
  requestAnimationFrame(frame);
})();
