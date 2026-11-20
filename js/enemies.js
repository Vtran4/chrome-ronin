// enemies.js — drone grunt (hovering swarm shooter) + chrome oni (telegraph charger) + pickups.
(function () {
  const CFG = window.CFG;
  function mat(color, emissive) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) m.emissive = new THREE.Color(emissive);
    return m;
  }

  // ---------- shared tracer flash ----------
  const _tracer = (a, b, color) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len), mat(color, color));
    g.position.copy(a).addScaledVector(dir, 0.5);
    g.lookAt(b);
    g.userData.ttl = 0.07;
    window.__game.scene.add(g);
    return g;
  };

  // ---------- base ----------
  function Enemy(kind, pos) {
    const S = CFG[kind];
    this.kind = kind; this.s = S; this.hp = S.hp; this.dead = false;
    this.atkCd = U.rand(1.2, 2.4); this.flashT = 0; this.ttlFx = [];
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.userData.enemy = this;
    this.velY = 0;
  }
  Enemy.prototype.hurt = function (dmg) {
    if (this.dead) return false;
    this.hp -= dmg; this.flashT = 0.06;
    for (const m of this.group.children)
      if (m.material && m.material.emissive && m.userData.baseEm !== undefined)
        m.material.emissive.setHex(0xffffff);
    return this.hp <= 0 ? (this.die(), true) : false;
  };
  Enemy.prototype._unflash = function () {
    for (const m of this.group.children)
      if (m.material && m.material.emissive && m.userData.baseEm !== undefined)
        m.material.emissive.setHex(m.userData.baseEm);
  };
  Enemy.prototype._los = function (to) {
    const r = window.__game.ray;
    const from = this.group.position.clone().setY(this.group.position.y + 1);
    const d = to.clone().sub(from); const dist = d.length(); d.normalize();
    r.set(from, d); r.far = dist;
    return r.intersectObjects(window.__game.world.group.children, true).length === 0;
  };
  Enemy.prototype.updateFx = function (dt) {
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this._unflash(); }
    for (let i = this.ttlFx.length - 1; i >= 0; i--) {
      const f = this.ttlFx[i]; f.userData.ttl -= dt;
      if (f.userData.ttl <= 0) { window.__game.scene.remove(f); this.ttlFx.splice(i, 1); }
    }
  };

  // ---------- drone grunt ----------
  function Drone(pos) { Enemy.call(this, 'drone', pos); this.shots = []; this.build(); }
  Drone.prototype = Object.create(Enemy.prototype);
  Drone.prototype.build = function () {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xff2e88, 0xff2e88));
    core.userData.baseEm = 0xff2e88;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 20), mat(0xcfd6e4));
    ring.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), mat(0x27e8ff, 0x27e8ff));
    eye.position.set(0, 0, -0.32); eye.userData.baseEm = 0x27e8ff;
    this.group.add(core, ring, eye);
    this.ring = ring;
    this.hoverBase = U.rand(CFG.drone.hover[0], CFG.drone.hover[1]);
  };
  Drone.prototype.update = function (dt, player) {
    this.updateFx(dt);
    // drone plasma orbs: visible, dodgeable — speed is defense
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.mesh.position.addScaledVector(s.vel, dt);
      s.ttl -= dt;
      const d = s.mesh.position.distanceTo(player.eye.clone().setY(player.pos.y + 0.9));
      if (d < 0.75) { player.hurt(this.s.dmg); this.popShot(i); continue; }
      const gy = s.mesh.position.y, hx = Math.abs(s.mesh.position.x), hz = Math.abs(s.mesh.position.z);
      if (s.ttl <= 0 || gy < 0.05 || hx > CFG.arena.half || hz > CFG.arena.half) this.popShot(i);
    }
    this.ring.rotation.z += dt * 9;
    const g = this.group.position, to = player.eye.clone().sub(g);
    const flat = new THREE.Vector3(to.x, 0, to.z), dist = flat.length();
    flat.normalize();
    // orbit at ~7m, closing when far, backed off when close
    const want = dist > 8 ? 1 : dist < 5.5 ? -0.8 : 0;
    const strafe = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(Math.sin(performance.now() * 0.0011 + g.x) * 2.2);
    const mv = flat.multiplyScalar(want * this.s.speed).add(strafe);
    g.addScaledVector(mv, dt);
    g.y = U.damp(g.y, Math.min(this.hoverBase, 5), 2.5, dt);
    g.x = U.clamp(g.x, -CFG.arena.half + 1, CFG.arena.half - 1);
    g.z = U.clamp(g.z, -CFG.arena.half + 1, CFG.arena.half - 1);
    this.group.lookAt(player.eye.x, g.y, player.eye.z);
    // plasma attack with LOS: telegraph flash then fire a dodgeable orb
    this.atkCd -= dt;
    if (this.atkCd <= 0 && dist < 15 && this._los(player.eye)) {
      this.atkCd = CFG.drone.attackCd * U.rand(0.85, 1.25);
      const from = g.clone().add(new THREE.Vector3(0, 0, -0.45).applyQuaternion(this.group.quaternion));
      const aim = player.eye.clone().setY(player.pos.y + 0.9).addScaledVector(player.vel, 0.18);
      const vel = aim.sub(from).normalize().multiplyScalar(15);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat(0xff2e88, 0xff2e88));
      mesh.position.copy(from);
      window.__game.scene.add(mesh);
      this.shots.push({ mesh, vel, ttl: 3 });
      if (window.Audio) window.Audio.ui('switch');
    }
  };
  Drone.prototype.popShot = function (i) {
    const s = this.shots[i];
    window.__game.scene.remove(s.mesh);
    this.shots.splice(i, 1);
  };
  Drone.prototype.die = function () { while (this.shots.length) this.popShot(0); this.dead = true; };

  // ---------- chrome oni ----------
  function Oni(pos) { Enemy.call(this, 'oni', pos); this.build();
    this.state = 'chase'; this.stateT = 0; this.lungeDir = new THREE.Vector3(); }
  Oni.prototype = Object.create(Enemy.prototype);
  Oni.prototype.build = function () {
    const chrome = mat(0xb9c2d4);
    const dark = mat(0x2a2f3f);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.62), chrome);
    torso.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), dark);
    head.position.y = 1.95;
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 6), mat(0xffb13d, 0xffb13d));
    hornL.position.set(-0.18, 2.3, 0); hornL.userData.baseEm = 0xffb13d;
    const hornR = hornL.clone(); hornR.position.x = 0.18;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), mat(0xff2e88, 0xff2e88));
    eyeL.position.set(-0.12, 2.0, -0.24); eyeL.userData.baseEm = 0xff2e88;
    const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), chrome);
    armL.position.set(-0.62, 1.2, 0);
    const armR = armL.clone(); armR.position.x = 0.62;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.26), dark);
    legL.position.set(-0.22, 0.3, 0);
    const legR = legL.clone(); legR.position.x = 0.22;
    this.group.add(torso, head, hornL, hornR, eyeL, eyeR, armL, armR, legL, legR);
    this.limbs = [armL, armR, legL, legR];
  };
  Oni.prototype.update = function (dt, player) {
    this.updateFx(dt);
    const g = this.group.position;
    const flat = new THREE.Vector3(player.pos.x - g.x, 0, player.pos.z - g.z);
    const dist = flat.length(); flat.normalize();
    this.group.rotation.y = Math.atan2(-flat.x, -flat.z) + Math.PI;
    this.stateT += dt;
    if (this.state === 'chase') {
      const step = flat.clone().multiplyScalar(this.s.speed * dt);
      g.add(step); this._walkAnim(dt);
      if (dist < this.s.lungeRange && this.atkCd <= 0) {
        this.state = 'telegraph'; this.stateT = 0;
        this.lungeDir.copy(flat);
        for (const m of [this.group.children[2], this.group.children[3]])
          m.material.emissiveIntensity = 2.2;
      }
    } else if (this.state === 'telegraph') {
      // rears up — the manga "pose" the player must learn to read
      this.limbs[0].rotation.x = -2.2 * (this.stateT / this.s.telegraph);
      this.limbs[1].rotation.x = -2.2 * (this.stateT / this.s.telegraph);
      if (this.stateT >= this.s.telegraph) { this.state = 'lunge'; this.stateT = 0; }
    } else if (this.state === 'lunge') {
      g.addScaledVector(this.lungeDir, this.s.lungeSpeed * dt);
      this.limbs[0].rotation.x = -2.2 + 3.0 * (this.stateT / this.s.lungeTime);
      this.limbs[1].rotation.x = -2.2 + 3.0 * (this.stateT / this.s.lungeTime);
      // contact damage: swept sphere vs player cylinder
      if (new THREE.Vector2(g.x - player.pos.x, g.z - player.pos.z).length() < this.s.radius + CFG.radius + 0.4
          && player.pos.y < g.y + 2.1 && player.pos.y + 1.8 > g.y)
        player.hurt(this.s.dmg);
      if (this.stateT >= this.s.lungeTime) { this.state = 'recover'; this.stateT = 0; this.atkCd = this.s.attackCd; }
    } else if (this.state === 'recover') {
      this.limbs[0].rotation.x = U.damp(this.limbs[0].rotation.x, 0, 8, dt);
      this.limbs[1].rotation.x = this.limbs[0].rotation.x;
      if (this.stateT > 0.55) this.state = 'chase';
    }
    this.atkCd -= dt;
    g.x = U.clamp(g.x, -CFG.arena.half + 1, CFG.arena.half - 1);
    g.z = U.clamp(g.z, -CFG.arena.half + 1, CFG.arena.half - 1);
    g.y = 0;
  };
  Oni.prototype._walkAnim = function (dt) {
    this.wt = (this.wt || 0) + dt * 8;
    this.limbs[2].rotation.x = Math.sin(this.wt) * 0.5;
    this.limbs[3].rotation.x = -Math.sin(this.wt) * 0.5;
  };
  Oni.prototype.die = function () { this.dead = true; if (window.Fx) window.Fx.onFinisher(this.group.position); };

  // ---------- pickups ----------
  const PICK = {
    health: { color: 0x35e07a, size: 0.28 }, armor: { color: 0x27a6ff, size: 0.3 }, ammo: { color: 0xffb13d, size: 0.26 },
  };
  window.Enemies = {
    spawn: function (kind, pos) {
      const e = kind === 'drone' ? new Drone(pos) : new Oni(pos);
      window.__game.scene.add(e.group);
      return e;
    },
    dropPickup: function (pos) {
      const roll = U.rng(), D = CFG.drop;
      let kind = null;
      if (roll < D.health) kind = 'health';
      else if (roll < D.health + D.armor) kind = 'armor';
      else if (roll < D.health + D.armor + D.ammo) kind = 'ammo';
      if (!kind) return null;
      const P = PICK[kind];
      const m = new THREE.Mesh(new THREE.BoxGeometry(P.size, P.size, P.size), mat(P.color, P.color));
      m.userData.baseEm = P.color;
      m.position.set(pos.x, 0.45, pos.z);
      m.userData.pickup = kind;
      window.__game.scene.add(m);
      return m;
    },
    PICK: PICK,
  };
})();
