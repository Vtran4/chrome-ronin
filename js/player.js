// player.js — FPS controller: pointer-lock look, DOOM-fast movement, AABB collision.
(function () {
  const CFG = window.CFG;
  const HEIGHT = 1.8;

  function Player(spawn, colliders) {
    this.pos = spawn.clone();          // feet position
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.pitch = 0; // faces -z-ish
    this.onGround = false; this.canAirDash = true;
    this.dashT = 0; this.dashCd = 0; this.iframe = 0;
    this.hp = CFG.hpMax; this.armor = 0;
    this.colliders = colliders;
    this.eye = new THREE.Vector3();
    this.bob = 0; this.landT = 0;
  }

  Player.prototype.aabb = function (out) {
    out.min.set(this.pos.x - CFG.radius, this.pos.y, this.pos.z - CFG.radius);
    out.max.set(this.pos.x + CFG.radius, this.pos.y + HEIGHT, this.pos.z + CFG.radius);
    return out;
  };

  const _b = new THREE.Box3(), _p = new THREE.Box3();
  Player.prototype._resolveAxis = function (axis, dir) {
    this.aabb(_p);
    // EPS: standing ON a surface is not an overlap — three's intersectsBox is inclusive
    const EPS = 0.0015;
    for (const c of this.colliders) {
      _b.copy(c);
      _b.min.addScalar(EPS); _b.max.addScalar(-EPS);
      if (!_p.intersectsBox(_b)) continue;
      if (axis === 'y') {
        if (dir <= 0) { this.pos.y = Math.max(this.pos.y, c.max.y); this.vel.y = Math.max(0, this.vel.y); this.onGround = true; this.canAirDash = true; }
        else { this.pos.y = c.min.y - HEIGHT - EPS; this.vel.y = 0; }
      } else if (axis === 'x') {
        // push out to the nearer face, biased by travel direction
        const toMin = Math.abs(this.pos.x - c.min.x), toMax = Math.abs(c.max.x - this.pos.x);
        const side = dir > 0 ? -1 : dir < 0 ? 1 : (toMin < toMax ? -1 : 1);
        this.pos.x = side < 0 ? c.min.x - CFG.radius - EPS : c.max.x + CFG.radius + EPS;
        this.vel.x = 0;
      } else {
        const toMin = Math.abs(this.pos.z - c.min.z), toMax = Math.abs(c.max.z - this.pos.z);
        const side = dir > 0 ? -1 : dir < 0 ? 1 : (toMin < toMax ? -1 : 1);
        this.pos.z = side < 0 ? c.min.z - CFG.radius - EPS : c.max.z + CFG.radius + EPS;
        this.vel.z = 0;
      }
      this.aabb(_p);
    }
  };

  Player.prototype.update = function (dt, inp) {
    // --- look ---
    this.yaw -= inp.dx * 0.0023;
    this.pitch = U.clamp(this.pitch - inp.dy * 0.0023, -1.45, 1.45);
    inp.dx = 0; inp.dy = 0;

    // --- wish direction (DOOM: speed is defense) ---
    let wx = 0, wz = 0;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    if (inp.fwd) { wx -= s; wz -= c; }
    if (inp.back) { wx += s; wz += c; }
    if (inp.left) { wx -= c; wz += s; }
    if (inp.right) { wx += c; wz -= s; }
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    // --- dash ---
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    if (inp.dash && this.dashCd <= 0 && (this.onGround || this.canAirDash)) {
      if (!this.onGround) this.canAirDash = false;
      let dx = wx, dz = wz;
      if (wl === 0) { dx = -s; dz = -c; }       // no input: dash forward
      this.vel.x = dx * CFG.dashSpeed; this.vel.z = dz * CFG.dashSpeed;
      this.vel.y = Math.min(this.vel.y, 1.2);
      this.dashT = CFG.dashTime; this.dashCd = CFG.dashCd; this.iframe = CFG.iframe;
      if (window.Fx) window.Fx.onDash();
      inp.dash = false;
    }

    // --- ground accel (snappy) / air control (keeps momentum) ---
    if (this.dashT > 0) {
      this.dashT -= dt;                        // dash overrides: no friction
    } else {
      const target = this.onGround ? CFG.walk : CFG.walk * CFG.airCtl;
      const ax = wx * target, az = wz * target;
      const rate = this.onGround ? 14 : 3.5;
      this.vel.x = U.damp(this.vel.x, ax, rate, dt);
      this.vel.z = U.damp(this.vel.z, az, rate, dt);
      if (inp.jump && this.onGround) { this.vel.y = CFG.jumpV; this.onGround = false; inp.jump = false; }
      this.vel.y -= CFG.gravity * dt;
    }

    // --- integrate + collide, axis by axis ---
    this.onGround = false;
    this.pos.x += this.vel.x * dt; this._resolveAxis('x', Math.sign(this.vel.x));
    this.pos.z += this.vel.z * dt; this._resolveAxis('z', Math.sign(this.vel.z));
    this.pos.y += this.vel.y * dt; this._resolveAxis('y', Math.sign(this.vel.y) || -1);

    // fell out of the world safety net
    if (this.pos.y < -6) { this.pos.set(0, 3, 12); this.vel.set(0, 0, 0); this.hurt(15); }

    // view bob while running fast on ground
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && sp > 1) this.bob += dt * sp * 1.35;
    this.eye.set(this.pos.x, this.pos.y + CFG.eyeH + Math.sin(this.bob) * 0.045, this.pos.z);
  };

  Player.prototype.hurt = function (dmg) {
    if (this.iframe > 0) return false;
    const soak = Math.min(this.armor, dmg * CFG.armorFrac);
    this.armor -= soak; this.hp -= dmg - soak;
    this.iframe = 0.22;
    if (window.Fx) window.Fx.onHurt();
    if (window.Game && Game.onPlayerHurt) Game.onPlayerHurt();
    return true;
  };

  Player.prototype.ammoScatter = function (n) {
    const w = window.__game && window.__game.weapons;
    if (w) w.ammo.scatter = Math.min(CFG.weapons.scatter.ammoMax, w.ammo.scatter + n);
  };

  Player.prototype.forward = function (out) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  };

  window.Player = Player;
})();
