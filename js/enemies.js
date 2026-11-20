// enemies.js — drone grunt (hover swarm shooter) + chrome oni (telegraph charger)
// + wisp (blinking skirmisher) + pickups. Smarter AI: separation, hit-jink, feints.
(function () {
  const CFG = window.CFG;
  function mat(color, emissive) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) m.emissive = new THREE.Color(emissive);
    return m;
  }
  const scene = () => window.__game.scene;

  // ---------- base ----------
  function Enemy(kind, pos) {
    const S = CFG[kind];
    this.kind = kind; this.s = S; this.hp = S.hp; this.dead = false;
    this.atkCd = U.rand(1.2, 2.4); this.flashT = 0; this.ttlFx = [];
    this.shots = []; this.jinkT = 0; this.jinkSign = 1; this.hits = 0;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.userData.enemy = this;
    this.velY = 0;
  }
  Enemy.prototype.hurt = function (dmg) {
    if (this.dead) return false;
    this.hp -= dmg; this.flashT = 0.06; this.hits++;
    this.jinkT = 0.5; this.jinkSign = U.rng() < 0.5 ? -1 : 1;   // sidestep after being hit
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
      if (f.userData.ttl <= 0) { scene().remove(f); this.ttlFx.splice(i, 1); }
    }
    if (this.jinkT > 0) this.jinkT -= dt;
  };
  // flocking separation: never stack on a neighbour
  Enemy.prototype._separate = function (g, out) {
    out.set(0, 0, 0);
    for (const o of window.Game.enemies) {
      if (o === this || o.dead) continue;
      const p = o.group.position;
      const dx = g.x - p.x, dz = g.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < 2.6 && d2 > 0.0001) { const d = Math.sqrt(d2); out.x += dx / d; out.z += dz / d; }
    }
  };
  // shared dodgeable-orb plumbing (drone + wisp)
  Enemy.prototype._fireOrb = function (from, aim, speed, color, r, dmg) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(color, color));
    mesh.position.copy(from);
    scene().add(mesh);
    this.shots.push({ mesh, vel: aim.clone().sub(from).normalize().multiplyScalar(speed), ttl: 3.4, dmg });
  };
  Enemy.prototype._stepShots = function (dt, player) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.mesh.position.addScaledVector(s.vel, dt);
      s.ttl -= dt;
      const d = s.mesh.position.distanceTo(player.eye.clone().setY(player.pos.y + 0.9));
      if (d < 0.75) { player.hurt(s.dmg); this.popShot(i); continue; }
      const gy = s.mesh.position.y, hx = Math.abs(s.mesh.position.x), hz = Math.abs(s.mesh.position.z);
      if (s.ttl <= 0 || gy < 0.05 || hx > CFG.arena.half || hz > CFG.arena.half) this.popShot(i);
    }
  };
  Enemy.prototype.popShot = function (i) {
    scene().remove(this.shots[i].mesh);
    this.shots.splice(i, 1);
  };
  Enemy.prototype._drainShots = function () { while (this.shots.length) this.popShot(0); };

  // ---------- drone grunt ----------
  function Drone(pos) { Enemy.call(this, 'drone', pos); this.build(); }
  Drone.prototype = Object.create(Enemy.prototype);
  Drone.prototype.build = function () {
    const shell = mat(0xd8dde8);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), mat(0xff2e88, 0xff2e88));
    core.userData.baseEm = 0xff2e88;
    const shellA = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 4, 0, Math.PI * 2, 0.35, 0.9), shell);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 24), mat(0xcfd6e4));
    ring.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), mat(0x27e8ff, 0x27e8ff));
    eye.position.set(0, 0, -0.34); eye.userData.baseEm = 0x27e8ff;
    const finA = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.18), shell); finA.position.set(0, 0.4, 0);
    const finB = finA.clone(); finB.rotation.y = Math.PI / 2;
    const podL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), mat(0x2a2f3f));
    podL.position.set(-0.36, -0.14, 0);
    const podR = podL.clone(); podR.position.x = 0.36;
    this.group.add(core, shellA, ring, eye, finA, finB, podL, podR);
    this.ring = ring; this.core = core;
    this.hoverBase = U.rand(CFG.drone.hover[0], CFG.drone.hover[1]);
    this.strafePhase = U.rand(0, 6.28);
  };
  Drone.prototype.update = function (dt, player) {
    this.updateFx(dt);
    this._stepShots(dt, player);
    this.ring.rotation.z += dt * 9;
    this.core.scale.setScalar(1 + Math.sin(performance.now() * 0.006 + this.strafePhase) * 0.06);
    const g = this.group.position, to = player.eye.clone().sub(g);
    const flat = new THREE.Vector3(to.x, 0, to.z), dist = flat.length();
    flat.normalize();
    // smarter: hold the 6–11m shooting band, orbit, jink after hits, separate from flock
    const want = dist > 11 ? 1 : dist < 6 ? -0.9 : 0;
    const strafe = new THREE.Vector3(-flat.z, 0, flat.x)
      .multiplyScalar(Math.sin(performance.now() * 0.0011 + this.strafePhase) * 2.4);
    if (this.jinkT > 0) strafe.addScaledVector(new THREE.Vector3(-flat.z, 0, flat.x), this.jinkSign * 6.5 * this.jinkT);
    const sep = new THREE.Vector3(); this._separate(g, sep);
    const mv = flat.clone().multiplyScalar(want * this.s.speed).add(strafe).addScaledVector(sep, 2.2);
    g.addScaledVector(mv, dt);
    g.y = U.damp(g.y, Math.min(this.hoverBase, 5), 2.5, dt);
    g.x = U.clamp(g.x, -CFG.arena.half + 1, CFG.arena.half - 1);
    g.z = U.clamp(g.z, -CFG.arena.half + 1, CFG.arena.half - 1);
    this.group.lookAt(player.eye.x, g.y, player.eye.z);
    this.atkCd -= dt;
    if (this.atkCd <= 0 && dist < 15 && this._los(player.eye)) {
      this.atkCd = CFG.drone.attackCd * U.rand(0.85, 1.25);
      const from = g.clone().add(new THREE.Vector3(0, 0, -0.45).applyQuaternion(this.group.quaternion));
      const aim = player.eye.clone().setY(player.pos.y + 0.9).addScaledVector(player.vel, 0.18);
      this._fireOrb(from, aim, 15, 0xff2e88, 0.13, this.s.dmg);
      if (window.Audio) window.Audio.ui('switch');
    }
  };
  Drone.prototype.die = function () { this._drainShots(); this.dead = true; };

  // ---------- chrome oni ----------
  function Oni(pos) { Enemy.call(this, 'oni', pos); this.build();
    this.state = 'chase'; this.stateT = 0; this.lungeDir = new THREE.Vector3(); this.feint = false; }
  Oni.prototype = Object.create(Enemy.prototype);
  Oni.prototype.build = function () {
    const chrome = mat(0xb9c2d4), dark = mat(0x2a2f3f);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.62), chrome);
    torso.position.y = 1.15;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.1), mat(0xff2e88, 0xff2e88));
    chest.position.set(0, 1.35, -0.35); chest.userData.baseEm = 0xff2e88;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), dark);
    head.position.y = 1.95;
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 6), mat(0xffb13d, 0xffb13d));
    hornL.position.set(-0.18, 2.3, 0); hornL.userData.baseEm = 0xffb13d;
    const hornR = hornL.clone(); hornR.position.x = 0.18;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), mat(0xff2e88, 0xff2e88));
    eyeL.position.set(-0.12, 2.0, -0.24); eyeL.userData.baseEm = 0xff2e88;
    const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
    const padL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), chrome);
    padL.position.set(-0.62, 1.62, 0); padL.scale.y = 0.7;
    const padR = padL.clone(); padR.position.x = 0.62;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), chrome);
    armL.position.set(-0.62, 1.2, 0);
    const armR = armL.clone(); armR.position.x = 0.62;
    const fistL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), dark);
    fistL.position.set(0, -0.55, 0); armL.add(fistL);
    const fistR = fistL.clone(); armR.add(fistR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.26), dark);
    legL.position.set(-0.22, 0.3, 0);
    const legR = legL.clone(); legR.position.x = 0.22;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), dark);
    back.position.set(0, 1.35, 0.38);
    this.group.add(torso, chest, head, hornL, hornR, eyeL, eyeR, padL, padR, armL, armR, legL, legR, back);
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
      const sep = new THREE.Vector3(); this._separate(g, sep);
      const step = flat.clone().multiplyScalar(this.s.speed * dt).addScaledVector(sep, 1.4 * dt);
      g.add(step); this._walkAnim(dt);
      if (dist < this.s.lungeRange && this.atkCd <= 0) {
        this.state = 'telegraph'; this.stateT = 0;
        this.feint = U.rng() < this.s.feint;        // sometimes it fakes the lunge
        this.lungeDir.copy(flat);
        for (const m of [this.group.children[3], this.group.children[4]])
          m.material.emissiveIntensity = 2.2;
      }
    } else if (this.state === 'telegraph') {
      // rears up — the manga "pose" the player must learn to read
      const k = Math.min(this.stateT / this.s.telegraph, 1);
      this.limbs[0].rotation.x = -2.2 * k;
      this.limbs[1].rotation.x = -2.2 * k;
      if (this.stateT >= this.s.telegraph) {
        if (this.feint) {                           // feint: pose, no lunge, snap back fast
          this.state = 'recover'; this.stateT = 0; this.atkCd = this.s.attackCd * 0.55;
          if (window.Fx) window.Fx.speed = Math.max(window.Fx.speed, 0.4);
        } else { this.state = 'lunge'; this.stateT = 0; }
      }
    } else if (this.state === 'lunge') {
      g.addScaledVector(this.lungeDir, this.s.lungeSpeed * dt);
      this.limbs[0].rotation.x = -2.2 + 3.0 * (this.stateT / this.s.lungeTime);
      this.limbs[1].rotation.x = -2.2 + 3.0 * (this.stateT / this.s.lungeTime);
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

  // ---------- wisp: blinking skirmisher — picks its distance, punishes standing still ----------
  function Wisp(pos) { Enemy.call(this, 'wisp', pos); this.build();
    this.chargeT = -1; this.blinkT = 2; }
  Wisp.prototype = Object.create(Enemy.prototype);
  Wisp.prototype.build = function () {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), mat(0x9ff0ff, 0x27e8ff));
    core.userData.baseEm = 0x27e8ff;
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 20), mat(0xcfd6e4));
    ringA.rotation.x = 0.9;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.03, 8, 20), mat(0xff2e88, 0xff2e88));
    ringB.rotation.x = -0.7; ringB.userData.baseEm = 0xff2e88;
    const shroud = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), mat(0x2a2f3f));
    shroud.position.y = -0.3;
    this.group.add(core, ringA, ringB, shroud);
    this.core = core; this.ringA = ringA; this.ringB = ringB;
    this.hoverBase = U.rand(CFG.wisp.hover[0], CFG.wisp.hover[1]);
    this.orbitSign = U.rng() < 0.5 ? -1 : 1;
  };
  Wisp.prototype._blink = function (player) {
    if (window.Fx) window.Fx.poof(this.group.position, 0x27e8ff);
    const f = player.forward(new THREE.Vector3());
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const p = player.pos.clone().addScaledVector(f, -U.rand(4.5, 7))
      .addScaledVector(right, U.rand(-4, 4));
    p.x = U.clamp(p.x, -CFG.arena.half + 2, CFG.arena.half - 2);
    p.z = U.clamp(p.z, -CFG.arena.half + 2, CFG.arena.half - 2);
    p.y = this.hoverBase;
    this.group.position.copy(p);
    this.blinkT = CFG.wisp.blinkCd; this.hits = 0;
    if (window.Audio) window.Audio.ui('blink');
  };
  Wisp.prototype.update = function (dt, player) {
    this.updateFx(dt);
    this._stepShots(dt, player);
    this.ringA.rotation.z += dt * 3; this.ringB.rotation.z -= dt * 4;
    const g = this.group.position;
    const flat = new THREE.Vector3(player.pos.x - g.x, 0, player.pos.z - g.z);
    const dist = flat.length(); flat.normalize();
    this.blinkT -= dt;
    // blink away when crowded or when it has eaten several hits
    if (this.blinkT <= 0 && (dist < 4.5 || this.hits >= 4)) this._blink(player);
    // kite: orbit at its preferred band, never camp
    const lo = this.s.prefer[0], hi = this.s.prefer[1];
    const want = dist > hi ? 0.9 : dist < lo ? -1 : 0;
    const orbit = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(this.orbitSign * 2.8);
    if (this.jinkT > 0) orbit.addScaledVector(new THREE.Vector3(flat.z, 0, -flat.x), this.jinkSign * 5 * this.jinkT);
    const sep = new THREE.Vector3(); this._separate(g, sep);
    g.addScaledVector(flat.clone().multiplyScalar(want * this.s.speed), dt);
    g.addScaledVector(orbit, dt);
    g.addScaledVector(sep, 2 * dt);
    g.y = U.damp(g.y, this.hoverBase + Math.sin(performance.now() * 0.0016) * 0.5, 3, dt);
    g.x = U.clamp(g.x, -CFG.arena.half + 1, CFG.arena.half - 1);
    g.z = U.clamp(g.z, -CFG.arena.half + 1, CFG.arena.half - 1);
    this.group.lookAt(player.eye.x, g.y, player.eye.z);
    // charge-up burst: bright-core telegraph, then 3 fast orbs — dodge or break LOS
    this.atkCd -= dt;
    if (this.chargeT >= 0) {
      this.chargeT -= dt;
      this.core.scale.setScalar(1 + 0.7 * (1 - Math.max(this.chargeT, 0) / this.s.charge));
      if (this.chargeT <= 0) {
        this.core.scale.setScalar(1);
        this._fireBurst(player, 0);
        this.atkCd = CFG.wisp.attackCd * U.rand(0.85, 1.2);
      }
    } else if (this.atkCd <= 0 && dist < 16 && dist > 4 && this._los(player.eye)) {
      this.chargeT = this.s.charge;
    }
  };
  // staggered 3-shot burst via self-referencing timers guarded by dead flag
  Wisp.prototype._fireBurst = function (player, n) {
    if (this.dead || n >= this.s.burst) return;
    const from = this.group.position.clone();
    const aim = player.eye.clone().setY(player.pos.y + 0.9).addScaledVector(player.vel, 0.15);
    this._fireOrb(from, aim, 19, 0x27e8ff, 0.11, this.s.dmg);
    if (window.Audio) window.Audio.ui('switch');
    setTimeout(() => this._fireBurst(player, n + 1), 130);
  };
  Wisp.prototype.die = function () {
    this._drainShots(); this.dead = true;
    if (window.Fx) window.Fx.poof(this.group.position.clone().setY(1.4), 0x27e8ff);
  };

  // ---------- pickups ----------
  const PICK = {
    health: { color: 0x35e07a, size: 0.28 }, armor: { color: 0x27a6ff, size: 0.3 },
    ammo: { color: 0xffb13d, size: 0.26 }, rocket: { color: 0xff5a3c, size: 0.3 },
  };
  window.Enemies = {
    spawn: function (kind, pos) {
      const e = kind === 'drone' ? new Drone(pos) : kind === 'wisp' ? new Wisp(pos) : new Oni(pos);
      scene().add(e.group);
      return e;
    },
    dropPickup: function (pos) {
      const roll = U.rng(), D = CFG.drop;
      let kind = null;
      if (roll < D.health) kind = 'health';
      else if (roll < D.health + D.armor) kind = 'armor';
      else if (roll < D.health + D.armor + D.ammo) kind = 'ammo';
      else if (roll < D.health + D.armor + D.ammo + D.rocket) kind = 'rocket';
      if (!kind) return null;
      const P = PICK[kind];
      const geo = kind === 'rocket'
        ? new THREE.CylinderGeometry(0.1, 0.1, 0.42, 8)
        : new THREE.BoxGeometry(P.size, P.size, P.size);
      const m = new THREE.Mesh(geo, mat(P.color, P.color));
      m.userData.baseEm = P.color;
      m.position.set(pos.x, 0.45, pos.z);
      m.userData.pickup = kind;
      scene().add(m);
      return m;
    },
    PICK: PICK,
  };
})();
