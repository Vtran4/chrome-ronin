// game.js — state machine: menu → combat ↔ break → end; waves, score, combo, drops.
(function () {
  const CFG = window.CFG;
  const Game = {
    mode: 'menu', wave: 0, score: 0, kills: 0, clean: 0, combo: 1,
    enemies: [], pickups: [], queue: [], spawnT: 0, breakT: 0, endTitle: 'RUN OVER',

    best: function () {
      const k = 'cr_best_' + new Date().toISOString().slice(0, 10);
      return parseInt(localStorage.getItem(k) || '0', 10);
    },
    _saveBest: function () {
      const k = 'cr_best_' + new Date().toISOString().slice(0, 10);
      if (this.score > this.best()) localStorage.setItem(k, String(this.score));
    },

    start: function () {
      this._clearAll();
      this.score = 0; this.kills = 0; this.clean = 0; this.combo = 1; this.wave = 0;
      const g = window.__game;
      g.player.hp = CFG.hpMax; g.player.armor = 0;
      g.player.pos.set(0, 0.1, 14); g.player.vel.set(0, 0, 0);
      g.player.yaw = Math.PI; g.player.pitch = 0;
      g.weapons.ammo = { pistol: Infinity, scatter: CFG.weapons.scatter.ammoStart };
      g.weapons.switchTo('pistol');
      this.nextWave();
    },

    _clearAll: function () {
      const sc = window.__game.scene;
      for (const e of this.enemies) sc.remove(e.group);
      for (const p of this.pickups) sc.remove(p);
      this.enemies = []; this.pickups = []; this.queue = [];
    },

    nextWave: function () {
      this.wave++;
      const w = CFG.waves[Math.min(this.wave - 1, CFG.waves.length - 1)];
      this.queue = [];
      for (let i = 0; i < w[0]; i++) this.queue.push('drone');
      for (let i = 0; i < w[1]; i++) this.queue.push('oni');
      // shuffle spawn order
      for (let i = this.queue.length - 1; i > 0; i--) { const j = U.irand(0, i); const t = this.queue[i]; this.queue[i] = this.queue[j]; this.queue[j] = t; }
      this.spawnT = 1.2; // brief breathing room before first spawn
      this.mode = 'combat';
      if (window.Audio) window.Audio.ui('click');
    },

    _spawnOne: function () {
      const kind = this.queue.pop();
      const a = U.rand(0, Math.PI * 2), r = U.rand(12, 17);
      const pos = new THREE.Vector3(Math.cos(a) * r, kind === 'drone' ? 1.6 : 0, Math.sin(a) * r);
      pos.x = U.clamp(pos.x, -CFG.arena.half + 2, CFG.arena.half - 2);
      pos.z = U.clamp(pos.z, -CFG.arena.half + 2, CFG.arena.half - 2);
      this.enemies.push(window.Enemies.spawn(kind, pos));
    },

    onKill: function (enemy) {
      const p = enemy.group.position.clone();
      this.kills++; this.clean++;
      this.combo = Math.min(CFG.comboMax, 1 + Math.floor(this.clean / CFG.comboPerStep));
      this.score += enemy.s.score * this.combo;
      window.Fx.onKill(enemy, p.setY(1.4));
      const drop = window.Enemies.dropPickup(p);
      if (drop) this.pickups.push(drop);
    },

    onPlayerHurt: function () { this.clean = 0; this.combo = 1; },

    update: function (dt, player) {
      if (this.mode === 'combat' || this.mode === 'break') {
        // spawn cadence
        if (this.queue.length && this.mode === 'combat') {
          this.spawnT -= dt;
          if (this.spawnT <= 0 && this.enemies.length < CFG.maxAlive) {
            this._spawnOne(); this.spawnT = CFG.spawnGap * U.rand(0.7, 1.25);
          }
        }
        // enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (e.dead) { this.onKill(e); window.__game.scene.remove(e.group); this.enemies.splice(i, 1); continue; }
          e.update(dt, player);
        }
        // pickups
        for (let i = this.pickups.length - 1; i >= 0; i--) {
          const m = this.pickups[i];
          m.rotation.y += dt * 2.4; m.position.y = 0.45 + Math.sin(performance.now() * 0.004 + i) * 0.08;
          const d = Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z);
          if (d < 1.1 && Math.abs(m.position.y - player.pos.y) < 2) {
            const D = CFG.drop;
            if (m.userData.pickup === 'health') player.hp = Math.min(CFG.hpMax, player.hp + D.healthAmt);
            else if (m.userData.pickup === 'armor') player.armor = Math.min(CFG.armorMax, player.armor + D.armorAmt);
            else player.ammoScatter((D.ammoAmt));
            window.Audio.ui('pickup');
            window.__game.scene.remove(m); this.pickups.splice(i, 1);
          }
        }
        // wave clear → break → next
        if (this.mode === 'combat' && this.queue.length === 0 && this.enemies.length === 0) {
          if (this.wave >= CFG.waves.length) return this._end('AREA CLEARED');
          this.mode = 'break'; this.breakT = CFG.waveBreak;
          player.ammoScatter(10); // resupply between waves
        } else if (this.mode === 'break') {
          this.breakT -= dt;
          if (this.breakT <= 0) this.nextWave();
        }
        // death
        if (player.hp <= 0) return this._end('YOU DIED');
      }
    },

    _end: function (title) {
      this.mode = 'end'; this.endTitle = title;
      this._saveBest();
      if (document.exitPointerLock) document.exitPointerLock();
      if (window.Audio) window.Audio.ui('kill');
    },

    // --- debug jumps for pw_run shots mode ---
    debugState: function (name, player) {
      if (name === 'combat') { this.start(); this.wave = 2; this.queue = ['drone', 'drone', 'oni', 'drone']; this.mode = 'combat'; this.spawnT = 0.01;
        player.pos.set(0, 0.1, 6); player.yaw = 0; }
      else if (name === 'fx') { this.start();
        player.pos.set(0, 0.1, 6); player.yaw = 0;
        this.enemies.push(window.Enemies.spawn('drone', new THREE.Vector3(1.2, 1.8, 0))); }
      else if (name === 'finisher') {
        this.start();
        player.pos.set(0, 0.1, 8); player.yaw = 0;
        const e = window.Enemies.spawn('oni', new THREE.Vector3(0.8, 0, 4.5));
        this.enemies.push(e);
        // die inside the shots-mode screenshot window so the panel-split is on frame
        setTimeout(function () { const en = window.Game.enemies[0]; if (en) en.hurt(999); }, 1250);
      }
      else if (name === 'endscreen') { this.score = 18450; this._end('YOU DIED'); }
    },
  };
  window.Game = Game;
})();
