// weapons.js — Kagerou pistol + Oni scattergun: primitive viewmodels, hitscan, kick.
(function () {
  const CFG = window.CFG;

  function mat(color, emissive) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) m.emissive = new THREE.Color(emissive);
    return m;
  }

  function box(g, w, h, d, x, y, z, m) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); g.add(mesh); return mesh;
  }
  function buildPistol() {
    const g = new THREE.Group();
    box(g, 0.07, 0.09, 0.34, 0, 0, -0.12, mat(0xd8dde8));
    box(g, 0.05, 0.05, 0.1, 0, 0.055, -0.05, mat(0x9aa4ba));       // slide serrations block
    box(g, 0.06, 0.16, 0.08, 0, -0.11, 0.02, mat(0x222633));
    box(g, 0.035, 0.05, 0.05, 0, -0.06, -0.05, mat(0x2a2f3f));     // trigger guard
    box(g, 0.02, 0.015, 0.2, 0, 0.052, -0.14, mat(0x27e8ff, 0x27e8ff));
    box(g, 0.012, 0.03, 0.012, 0, 0.075, -0.26, mat(0x27e8ff, 0x27e8ff)); // front sight
    return g;
  }
  function buildScatter() {
    const g = new THREE.Group();
    box(g, 0.09, 0.085, 0.5, 0, 0.01, -0.2, mat(0x4a3038));
    box(g, 0.1, 0.07, 0.18, 0, -0.055, -0.22, mat(0x1c1f2b));      // pump
    box(g, 0.055, 0.045, 0.3, 0, 0.062, -0.16, mat(0x2a2f3f));     // top rib
    box(g, 0.07, 0.17, 0.09, 0, -0.12, 0.06, mat(0x1c1f2b));
    box(g, 0.075, 0.1, 0.14, 0, -0.02, 0.12, mat(0x3a2830));       // stock stub
    box(g, 0.05, 0.02, 0.02, 0, 0.055, -0.4, mat(0xffb13d, 0xffb13d));
    return g;
  }
  function buildRocket() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.62, 12), mat(0x3b3f52));
    tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.02, -0.16); g.add(tube);
    for (const z of [-0.32, -0.05]) {                              // reinforcement rings
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.014, 8, 14), mat(0x9aa4ba));
      r.position.set(0, 0.02, z); g.add(r);
    }
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.1, 12), mat(0x2a2f3f));
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.02, -0.47); g.add(muzzle);
    box(g, 0.05, 0.06, 0.04, 0, 0.09, -0.4, mat(0xff5a3c, 0xff5a3c));  // loaded-warhead telltale
    box(g, 0.06, 0.15, 0.08, 0, -0.1, 0.02, mat(0x1c1f2b));            // grip
    box(g, 0.03, 0.045, 0.05, 0, -0.05, -0.08, mat(0x2a2f3f));         // trigger guard
    box(g, 0.05, 0.05, 0.16, 0, 0.02, 0.14, mat(0x3b3f52));            // rear cap
    box(g, 0.02, 0.02, 0.02, 0.045, 0.09, -0.2, mat(0x27e8ff, 0x27e8ff)); // smart-lock dot
    return g;
  }

  function Weapons(camera) {
    this.camera = camera;
    this.ray = new THREE.Raycaster();
    this.defs = CFG.weapons;
    this.cur = 'pistol';
    this.cool = 0; this.kick = 0; this.kickV = 0; this.flashT = 0;
    this.ammo = { pistol: Infinity, scatter: CFG.weapons.scatter.ammoStart, rocket: CFG.weapons.rocket.ammoStart };
    this.models = { pistol: buildPistol(), scatter: buildScatter(), rocket: buildRocket() };
    for (const k in this.models) { camera.add(this.models[k]); this.models[k].visible = k === 'pistol'; }
    this.rockets = [];   // live projectiles: { mesh, vel, ttl, light }
    // muzzle flash quad
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xfff2b8, transparent: true, depthWrite: false }));
    this.flash.visible = false; camera.add(this.flash);
    this._d = new THREE.Vector3(); this._o = new THREE.Vector3();
  }

  Weapons.prototype.switchTo = function (name) {
    if (!this.defs[name] || name === this.cur) return;
    this.models[this.cur].visible = false;
    this.cur = name;
    this.models[name].visible = true;
    this.cool = Math.max(this.cool, 0.12);
    if (window.Audio) window.Audio.ui('switch');
  };

  // hook tables filled by game.js: targets (raycast list), onHit(enemy, dmg, point)
  Weapons.prototype.tryFire = function (player, targets, hooks) {
    if (this.cool > 0) return false;
    const def = this.defs[this.cur];
    if (this.ammo[this.cur] <= 0) { if (this.cur !== 'pistol') this.switchTo('pistol'); return false; }
    this.cool = def.rate;
    if (this.ammo[this.cur] !== Infinity) this.ammo[this.cur]--;
    this.kickV = def.kick;
    this.flashT = 0.11;
    this.flash.visible = true;
    player.forward(this._d);
    this._o.copy(player.eye);

    if (this.cur === 'rocket') {                      // ballistic projectile, not hitscan
      const dir = this._d.clone();
      dir.x += (U.rng() * 2 - 1) * def.spread; dir.y += (U.rng() * 2 - 1) * def.spread; dir.normalize();
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.34, 10),
        new THREE.MeshLambertMaterial({ color: 0xff5a3c, emissive: 0xff5a3c }));
      body.rotation.x = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 10),
        new THREE.MeshLambertMaterial({ color: 0xd8dde8 }));
      nose.rotation.x = -Math.PI / 2; nose.position.z = -0.24;
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      glow.position.z = 0.22;
      g.add(body, nose, glow);
      g.position.copy(this._o).addScaledVector(dir, 0.5);
      const light = new THREE.PointLight(0xffb13d, 14, 7, 2);
      g.add(light);
      window.__game.scene.add(g);
      this.rockets.push({ mesh: g, vel: dir.multiplyScalar(def.projSpeed), ttl: 4 });
      if (hooks.onFire) hooks.onFire(this.cur, def, []);
      return true;
    }

    const hits = [];
    for (let p = 0; p < def.pellets; p++) {
      const dx = (U.rng() * 2 - 1) * def.spread, dy = (U.rng() * 2 - 1) * def.spread;
      const dir = this._d.clone();
      dir.x += dx; dir.y += dy; dir.normalize();
      this.ray.set(this._o, dir);
      this.ray.far = def.range;
      const isect = this.ray.intersectObjects(targets, true);
      if (isect.length) {
        const it = isect[0];
        let owner = it.object;
        while (owner && !owner.userData.enemy && owner.parent) owner = owner.parent;
        hits.push({ point: it.point, dist: it.distance, owner: owner && owner.userData.enemy ? owner : null });
        if (hooks.onShot) hooks.onShot(it.point, owner && owner.userData.enemy ? owner : null);
      } else {
        hits.push({ point: this._o.clone().add(dir.multiplyScalar(def.range)), dist: def.range, owner: null });
      }
    }
    if (hooks.onFire) hooks.onFire(this.cur, def, hits);
    return true;
  };

  // rocket flight + splash: direct hit full dmg, radius dmg falls off linearly
  Weapons.prototype.updateRockets = function (dt) {
    const def = this.defs.rocket, half = CFG.arena.half, sc = window.__game.scene;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vel.y -= def.projGrav * dt;
      r.mesh.position.addScaledVector(r.vel, dt);
      r.mesh.lookAt(r.mesh.position.clone().add(r.vel));
      r.ttl -= dt;
      const p = r.mesh.position;
      let boom = null;
      for (const e of window.Game.enemies) {
        const c = e.group.position.clone().setY(e.group.position.y + (e.kind === 'oni' ? 1.2 : 0));
        if (c.distanceTo(p) < CFG[e.kind].radius + 0.55) { boom = { direct: e, point: p.clone() }; break; }
      }
      if (!boom && (p.y < 0.12 || Math.abs(p.x) > half + 1 || Math.abs(p.z) > half + 1 || p.y > 30 || r.ttl <= 0))
        boom = { direct: null, point: p.clone() };
      if (boom) { this.explode(boom.point, boom.direct); sc.remove(r.mesh); this.rockets.splice(i, 1); }
    }
  };
  Weapons.prototype.explode = function (point, direct) {
    const def = this.defs.rocket;
    if (window.Fx) window.Fx.onExplosion(point);
    if (window.Audio) window.Audio.ui('boom');
    for (const e of window.Game.enemies.slice()) {
      const c = e.group.position.clone().setY(e.group.position.y + (e.kind === 'oni' ? 1.2 : 0));
      const d = c.distanceTo(point);
      let dmg = 0;
      if (e === direct) dmg = def.dmg;
      else if (d < def.splashR) dmg = Math.max(12, def.splash * (1 - d / def.splashR));
      if (dmg > 0) {
        const died = e.hurt(dmg);
        if (window.Fx) window.Fx.dmgNum(c.setY(e.group.position.y + 1.4), Math.round(dmg), false);
        void died;
      }
    }
  };

  Weapons.prototype.update = function (dt, player) {
    // cooldown decays per-frame, not per-tryFire-call (tap fires cost one call)
    this.cool -= dt;
    // recoil spring on the viewmodel
    this.kickV = U.damp(this.kickV, 0, 12, dt);
    this.kick = U.damp(this.kick, this.kickV, 26, dt);
    const m = this.models[this.cur];
    const bobX = Math.sin(player.bob) * 0.012, bobY = Math.abs(Math.cos(player.bob)) * 0.012;
    // camera looks down -z: viewmodel must sit at NEGATIVE z in camera space
    m.position.set(0.22 + bobX, -0.16 + bobY - this.kick * 0.02, -0.30 + Math.min(this.kick * 0.05, 0.08));
    m.rotation.set(this.kick * 0.16, 0, 0);
    this.flash.position.copy(m.position).add(new THREE.Vector3(0, 0.05, -0.34));
    this.flash.rotation.z += dt * 40;
    this.flashT -= dt;
    if (this.flashT <= 0) this.flash.visible = false;
  };

  window.Weapons = Weapons;
})();
