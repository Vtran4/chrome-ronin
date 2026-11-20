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
      // panel-split overlay (3 slanted gutters)
      const p = document.createElement('div');
      p.id = 'panelsplit';
      p.innerHTML = '<div></div><div></div><div></div>';
      document.body.appendChild(p);
      this._panelEl = p;
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
        const s = this.sparks[i]; s.userData.ttl -= dt; s.scale.addScalar(dt * 6);
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
