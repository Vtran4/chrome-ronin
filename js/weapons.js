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
    box(g, 0.06, 0.16, 0.08, 0, -0.11, 0.02, mat(0x222633));
    box(g, 0.02, 0.015, 0.2, 0, 0.052, -0.14, mat(0x27e8ff, 0x27e8ff));
    return g;
  }
  function buildScatter() {
    const g = new THREE.Group();
    box(g, 0.09, 0.085, 0.5, 0, 0.01, -0.2, mat(0xb8443f));
    box(g, 0.1, 0.07, 0.18, 0, -0.055, -0.22, mat(0x222633));
    box(g, 0.07, 0.17, 0.09, 0, -0.12, 0.06, mat(0x222633));
    box(g, 0.05, 0.02, 0.02, 0, 0.055, -0.4, mat(0xffb13d, 0xffb13d));
    return g;
  }

  function Weapons(camera) {
    this.camera = camera;
    this.ray = new THREE.Raycaster();
    this.defs = CFG.weapons;
    this.cur = 'pistol';
    this.cool = 0; this.kick = 0; this.kickV = 0; this.flashT = 0;
    this.ammo = { pistol: Infinity, scatter: CFG.weapons.scatter.ammoStart };
    this.models = { pistol: buildPistol(), scatter: buildScatter() };
    for (const k in this.models) { camera.add(this.models[k]); this.models[k].visible = k === 'pistol'; }
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
    this.cool -= 1 / 60;
    if (this.cool > 0) return false;
    const def = this.defs[this.cur];
    if (this.ammo[this.cur] <= 0) { if (this.cur === 'scatter') this.switchTo('pistol'); return false; }
    this.cool = def.rate;
    if (this.ammo[this.cur] !== Infinity) this.ammo[this.cur]--;
    this.kickV = def.kick;
    this.flashT = 0.05;
    this.flash.visible = true;

    player.forward(this._d);
    this._o.copy(player.eye);
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

  Weapons.prototype.update = function (dt, player) {
    // recoil spring on the viewmodel
    this.kickV = U.damp(this.kickV, 0, 12, dt);
    this.kick = U.damp(this.kick, this.kickV, 26, dt);
    const m = this.models[this.cur];
    const bobX = Math.sin(player.bob) * 0.012, bobY = Math.abs(Math.cos(player.bob)) * 0.012;
    m.position.set(0.22 + bobX, -0.19 + bobY - this.kick * 0.02, 0.32 - Math.min(this.kick * 0.06, 0.1));
    m.rotation.set(this.kick * 0.16, 0, 0);
    this.flash.position.copy(m.position).add(new THREE.Vector3(0, 0.03, -0.32));
    this.flash.rotation.z += dt * 40;
    this.flashT -= dt;
    if (this.flashT <= 0) this.flash.visible = false;
  };

  window.Weapons = Weapons;
})();
