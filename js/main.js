// main.js — boot, input, loop, HUD wiring, debug contract.
(function () {
  const CFG = window.CFG, qs = new URLSearchParams(location.search);
  const AUTO = qs.has('auto');
  if (qs.has('seed')) U.seed(parseInt(qs.get('seed'), 10) || 7);
  const canvas = U.el('c');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.05, 220);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const world = World.build(scene);
  const cel = new CelPass(renderer);
  if (qs.get('manga') === '0') cel.enabled = false;
  const lockres = qs.has('lockres') || qs.has('t');

  window.__game = { scene, camera, renderer, cel, world, qs, ray: new THREE.Raycaster() };
  Fx.init();
  const player = new Player(new THREE.Vector3(0, 0.1, 14), world.colliders);
  const weapons = new Weapons(camera);
  window.__game.player = player; window.__game.weapons = weapons;

  const targets = () => world.group.children.concat(Game.enemies.map(e => e.group));
  const hooks = {
    onFire: (kind) => window.Audio.fire(kind),
    onShot: (point, ownerMesh) => {
      Fx.onShotHit(point, ownerMesh);
      const def = weapons.defs[weapons.cur];
      if (ownerMesh) ownerMesh.userData.enemy.hurt(def.dmg);
    },
  };

  // ---- input ----
  const inp = { fwd: 0, back: 0, left: 0, right: 0, jump: 0, dash: 0, fire: 0, dx: 0, dy: 0 };
  window.__inp = inp;
  const playModes = () => Game.mode === 'combat' || Game.mode === 'break';
  function key(e, down) {
    if (!playModes() && !AUTO) return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': inp.fwd = down; break;
      case 'KeyS': case 'ArrowDown': inp.back = down; break;
      case 'KeyA': case 'ArrowLeft': inp.left = down; break;
      case 'KeyD': case 'ArrowRight': inp.right = down; break;
      case 'Space': if (down) inp.jump = true; e.preventDefault(); break;
      case 'ShiftLeft': case 'ShiftRight': if (down) inp.dash = true; break;
      case 'Digit1': if (down) weapons.switchTo('pistol'); break;
      case 'Digit2': if (down) weapons.switchTo('scatter'); break;
      case 'KeyR': if (down && playModes()) startRun(); break;
    }
  }
  window.addEventListener('keydown', e => key(e, 1));
  window.addEventListener('keyup', e => key(e, 0));
  window.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) { inp.dx += e.movementX; inp.dy += e.movementY; }
  });
  window.addEventListener('mousedown', e => { if (e.button === 0) inp.fire = 1; });
  window.addEventListener('mouseup', e => { if (e.button === 0) inp.fire = 0; });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && playModes()) { Game.mode = 'pause'; show('pause'); }
  });

  // ---- panels / flow ----
  function show(id) {
    for (const p of ['menu', 'pause', 'endpanel']) U.el(p).style.display = p === id ? 'flex' : 'none';
  }
  function hideAll() { show(''); }
  function startRun() {
    hideAll();
    Game.start();
    if (!AUTO && canvas.requestPointerLock) canvas.requestPointerLock();
  }
  U.el('btn-play').onclick = () => { window.Audio.enable(); startRun(); };
  U.el('btn-resume').onclick = () => { hideAll(); Game.mode = 'combat'; canvas.requestPointerLock && canvas.requestPointerLock(); };
  U.el('btn-restart').onclick = startRun;
  U.el('btn-quit').onclick = () => { Game.mode = 'menu'; show('menu'); refreshMenuBest(); };
  U.el('snd').onclick = function () {
    window.Audio.enable(); this.textContent = 'Sound on'; this.classList.add('on');
  };
  function refreshMenuBest() {
    const b = Game.best();
    U.el('menu-best').textContent = b > 0 ? 'Best of the day: ' + U.fmt(b) : 'No score yet today';
  }
  U.el('endpanel').addEventListener('click', startRun);

  // ---- resize + dynamic resolution ----
  let W = 0, H = 0, scale = CFG.resMax;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    cel.setSize(W, H, scale);
  }
  window.addEventListener('resize', resize); resize();

  // ---- debug state jumps + attract ----
  const simT = qs.has('t') ? parseFloat(qs.get('t')) : Infinity;
  const stReq = qs.get('state');
  let sim = 0, frames = 0, msEma = 16.6, last = performance.now();
  show('menu'); refreshMenuBest();
  if (AUTO) { setTimeout(() => { hideAll(); Game.start(); }, 100); }
  else if (stReq && stReq !== 'menu') {
    setTimeout(() => { hideAll(); Game.debugState(stReq, player); }, 100);
  }

  // ---- HUD ----
  function updateHud() {
    const vis = playModes();
    for (const id of ['xhair', 'hud-bl', 'hud-br', 'hud-tc'])
      U.el(id).style.display = vis ? 'block' : 'none';
    U.el('hp').textContent = Math.max(0, Math.ceil(player.hp));
    U.el('armor').textContent = Math.ceil(player.armor);
    U.el('ammo').textContent = weapons.cur === 'pistol' ? '\u221E' : weapons.ammo.scatter;
    U.el('wname').textContent = weapons.defs[weapons.cur].name;
    U.el('score').textContent = U.fmt(Game.score);
    U.el('combo').textContent = Game.combo > 1 ? '\u00D7' + Game.combo : '';
    U.el('waveinfo').textContent = Game.mode === 'break'
      ? 'NEXT WAVE ' + Math.ceil(Game.breakT)
      : (Game.mode === 'combat' ? 'WAVE ' + Game.wave + ' / ' + CFG.waves.length : '');
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t0 = performance.now();
    if (sim < simT) {
      sim += dt;
      cel.tick(dt);
      if (playModes()) {
        if (AUTO) Bot.update(dt, inp, player, Game, weapons);
        player.update(dt, inp);
        if (inp.fire) weapons.tryFire(player, targets(), hooks);
        Game.update(dt, player);
      }
      if (Game.mode === 'end' && U.el('endpanel').style.display !== 'flex') {
        U.el('end-title').textContent = Game.endTitle;
        U.el('end-score').textContent = U.fmt(Game.score);
        U.el('end-best').textContent = 'Best of the day: ' + U.fmt(Game.best());
        show('endpanel');
      }
    }
    weapons.update(dt, player);
    Fx.update(dt, cel);
    camera.position.copy(player.eye).add(Fx.shakeVec);
    camera.rotation.set(player.pitch, player.yaw, 0);
    cel.render(scene, camera);
    updateHud();
    const ms = performance.now() - t0;
    msEma = msEma * 0.92 + ms * 0.08;
    frames++;
    window.__frameMs = Math.round(msEma * 10) / 10;
    window.__fps = Math.round(1000 / msEma);
    if (!lockres) {
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
    return JSON.stringify({
      mode: Game.mode, wave: Game.wave, score: Game.score, combo: Game.combo,
      kills: Game.kills, hp: Math.ceil(player.hp), armor: Math.ceil(player.armor),
      alive: Game.enemies.length, cel: cel.enabled, scale: Math.round(scale * 100) / 100,
    });
  };
  requestAnimationFrame(frame);
})();
