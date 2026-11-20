// fx.js — the expressive manga layer: impact invert, speed lines, onomatopoeia,
// panel-split finisher, sparks, camera shake. All decaying timers drive cel uniforms / DOM.
(function () {
  const CFG = window.CFG;
  const SFX_WORDS = ['ドーン!', 'バン!', 'パシン!', 'DOMYO!', 'BAM!', 'ドンッ!'];
  const FINISHER_WORDS = ['ザマァ!', '斬!!', 'DOMYO!!'];

  const Fx = {
    invert: 0, speed: 0, tone: 0, shakeMag: 0, shakeVec: new THREE.Vector3(),
    sparks: [], words: [], panelT: 0, _panelEl: null,

    init: function () {
      // onomatopoeia pool
      this.pool = [];
      for (let i = 0; i < 8; i++) {
        const d = document.createElement('div');
        d.className = 'onomatopoeia';
        document.body.appendChild(d);
        this.pool.push(d);
      }
      // floating damage-number pool
      this.dmgPool = [];
      for (let i = 0; i < 26; i++) {
        const d = document.createElement('div');
        d.className = 'dmgnum';
        document.body.appendChild(d);
        this.dmgPool.push(d);
      }
      // panel-split overlay (3 slanted gutters)
      const p = document.createElement('div');
      p.id = 'panelsplit';
      p.innerHTML = '<div></div><div></div><div></div>';
      document.body.appendChild(p);
      this._panelEl = p;
    },

    // hand-lettered damage numbers projected from world space
    dmgNum: function (pos, amount, crit) {
      const el = this.dmgPool[this._dmgIdx = ((this._dmgIdx || 0) + 1) % this.dmgPool.length];
      const v = pos.clone().project(window.__game.camera);
      if (v.z > 1) return; // behind camera
      const x = (v.x * 0.5 + 0.5) * window.innerWidth + U.rand(-16, 16);
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight + U.rand(-10, 10);
      el.style.left = U.clamp(x, 24, window.innerWidth - 60) + 'px';
      el.style.top = U.clamp(y, 40, window.innerHeight - 80) + 'px';
      el.textContent = crit ? amount + '!!' : amount;
      el.classList.toggle('crit', !!crit);
      el.classList.remove('fly'); void el.offsetWidth; el.classList.add('fly');
    },

    // teleport/blink puff: ink sparks + soft tone
    poof: function (pos, color) {
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5),
          new THREE.MeshBasicMaterial({ color: color }));
        s.position.copy(pos).add(new THREE.Vector3(U.rand(-0.4, 0.4), U.rand(-0.3, 0.5), U.rand(-0.4, 0.4)));
        s.userData.ttl = 0.22; s.scale.addScalar(0.6);
        window.__game.scene.add(s); this.sparks.push(s);
      }
      this.speed = Math.max(this.speed, 0.35);
    },

    // rocket detonation: the big manga beat
    onExplosion: function (point) {
      this.invert = 1; this.invertFrames = 3;
      this.shake(0.9);
      this.tone = Math.max(this.tone, 0.7);
      this._word(point.clone().setY(Math.max(point.y, 1.2)), 'DOMYO!!', true);
      for (let i = 0; i < 9; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd23e : 0xff5a3c }));
        s.position.copy(point).add(new THREE.Vector3(U.rand(-0.9, 0.9), U.rand(-0.6, 1.1), U.rand(-0.9, 0.9)));
        s.userData.ttl = 0.28; s.scale.addScalar(1.1);
        window.__game.scene.add(s); this.sparks.push(s);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.09, 8, 22),
        new THREE.MeshBasicMaterial({ color: 0xf5f2e9 }));
      ring.position.copy(point); ring.rotation.x = Math.PI / 2;
      ring.userData.ttl = 0.3; ring.userData.ringGrow = true;
      window.__game.scene.add(ring); this.sparks.push(ring);
    },

    _word: function (pos, text, big) {
      const el = this.pool[Math.floor(U.rng() * this.pool.length)];
      const v = pos.clone().project(window.__game.camera);
      if (v.z > 1) return; // behind camera
      const x = (v.x * 0.5 + 0.5) * window.innerWidth, y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = U.clamp(x, 80, window.innerWidth - 160) + 'px';
      el.style.top = U.clamp(y, 60, window.innerHeight - 120) + 'px';
      el.textContent = text;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      if (big) el.classList.add('big'); else el.classList.remove('big');
    },

    onDash: function () { this.speed = 1.0; if (window.Audio) window.Audio.ui('dash'); },
    onHurt: function () { this.tone = 1; this.shake(0.5); if (window.Audio) window.Audio.ui('hurt'); },
    shake: function (m) { this.shakeMag = Math.max(this.shakeMag, m); },

    onShotHit: function (point, enemyMesh) {
      const col = enemyMesh ? 0xffe58a : 0x9fb4ff;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5),
        new THREE.MeshBasicMaterial({ color: col }));
      s.position.copy(point); s.userData.ttl = 0.16;
      window.__game.scene.add(s); this.sparks.push(s);
      this.shake(0.06);
    },

    onKill: function (enemy, point) {
      this.invert = 1;                 // 1–2 frame impact invert
      this.invertFrames = 2;
      this.shake(0.35);
      this._word(point, U.pick(SFX_WORDS), false);
      if (window.Audio) window.Audio.ui('kill');
    },

    onFinisher: function (pos) {       // oni death: panel-split freeze
      this.panelT = 0.7;
      this._panelEl.classList.remove('on'); void this._panelEl.offsetWidth;
      this._panelEl.classList.add('on');
      this._word(pos.clone().setY(1.6), U.pick(FINISHER_WORDS), true);
      this.invertFrames = 3;
    },

    update: function (dt, cel) {
      this.speed = Math.max(0, this.speed - dt * 4.2);
      this.tone = Math.max(0, this.tone - dt * 1.6);
      if (this.invertFrames > 0) { this.invertFrames--; if (this.invertFrames <= 0) this.invert = 0; }
      if (this.panelT > 0) { this.panelT -= dt; if (this.panelT <= 0) this._panelEl.classList.remove('on'); }
      for (let i = this.sparks.length - 1; i >= 0; i--) {
        const s = this.sparks[i]; s.userData.ttl -= dt; s.scale.addScalar(dt * (s.userData.ringGrow ? 22 : 6));
        if (s.userData.ttl <= 0) { window.__game.scene.remove(s); this.sparks.splice(i, 1); }
      }
      // camera shake (main reads shakeVec)
      if (this.shakeMag > 0.005) {
        this.shakeVec.set(U.rand(-1, 1), U.rand(-1, 1), U.rand(-1, 1)).multiplyScalar(this.shakeMag * 0.09);
        this.shakeMag *= Math.exp(-7 * dt);
      } else this.shakeVec.set(0, 0, 0);
      // low-hp heartbeat tone
      const p = window.__game.player;
      const lowHp = p ? U.clamp(1 - p.hp / 35, 0, 1) * 0.5 : 0;
      if (lowHp > this.tone) this.tone = lowHp;
      cel.fx.invert = this.invert; cel.fx.speed = this.speed;
      cel.fx.tone = this.tone;
      // white pop only for the first ~2 frames of the panel-split
      cel.fx.flash = this.panelT > 0.64 ? 0.7 : 0;
    },
  };
  window.Fx = Fx;
})();
