// bot.js — auto player: attract mode + the pw_run `bot` gate. Uses the same input struct.
(function () {
  const CFG = window.CFG;
  window.Bot = {
    t: 0, strafeSign: 1, strafeT: 0,
    update: function (dt, inp, player, game, weapons) {
      if (game.mode !== 'combat' && game.mode !== 'break') { inp.fire = false; return; }
      this.t += dt; this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeSign = U.rng() < 0.5 ? -1 : 1; this.strafeT = U.rand(0.7, 1.8); }

      // nearest enemy
      let best = null, bd = 1e9;
      for (const e of game.enemies) {
        const d = e.group.position.distanceToSquared(player.eye);
        if (d < bd) { bd = d; best = e; }
      }
      // or nearest pickup when not threatened
      let goal = null;
      if (best && bd > 14 * 14) { goal = null; }
      if (!goal && game.pickups.length && (!best || bd > 100 || player.hp < 45)) {
        let pd = 1e9;
        for (const p of game.pickups) { const d = p.position.distanceToSquared(player.pos); if (d < pd) { pd = d; goal = p.position; } }
      }

      const target = goal || (best ? best.group.position.clone().setY(1.4) : null);
      if (target) {
        const dx = target.x - player.pos.x, dz = target.z - player.pos.z;
        const wantYaw = Math.atan2(-dx, -dz);
        const wantPitch = Math.atan2(target.y - player.eye.y, Math.hypot(dx, dz));
        let dy = ((wantYaw - player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const err = U.rand(-0.05, 0.05);
        player.yaw += U.clamp(dy + err, -0.14, 0.14);
        player.pitch = U.clamp(player.pitch + U.clamp(wantPitch - player.pitch + err, -0.1, 0.1), -1.4, 1.4);
        // movement: approach to ~8m, strafe; walk forward toward goal
        const dist = Math.hypot(dx, dz);
        const fleeing = player.hp < 42 && !goal;
        const fwd = goal ? true : (fleeing ? false : dist > 9);
        const back = fleeing ? dist < 15 : (goal === null && dist < 5.5);
        inp.fwd = fwd; inp.back = back;
        inp.left = this.strafeSign > 0; inp.right = this.strafeSign < 0;
        if (U.rng() < 0.002) inp.jump = true;
        if (U.rng() < (fleeing ? 0.02 : 0.004) && best && dist > 8) inp.dash = true;
      } else { inp.fwd = inp.back = inp.left = inp.right = false; }

      // weapon choice + fire when roughly on target
      if (best) {
        const dist = Math.sqrt(bd);
        // rocket when a cluster of 3+ sits in the mid range and we have ammo
        let cluster = 0;
        for (const e of game.enemies) {
          const d = e.group.position.distanceTo(player.pos);
          if (d < 12) cluster++;
        }
        if (weapons.ammo.rocket > 0 && cluster >= 3 && dist > 6) weapons.switchTo('rocket');
        else if (dist < 11 && weapons.ammo.scatter > 0) weapons.switchTo('scatter');
        else weapons.switchTo('pistol');
        const aimY = weapons.cur === 'rocket'
          ? best.group.position.y + Math.min(2.2, dist * dist * CFG.weapons.rocket.projGrav / (2 * CFG.weapons.rocket.projSpeed * CFG.weapons.rocket.projSpeed) * 1.15)
          : best.group.position.y;
        const dx = best.group.position.x - player.pos.x, dz = best.group.position.z - player.pos.z;
        const wantYaw = Math.atan2(-dx, -dz);
        const wantPitch = weapons.cur === 'rocket'
          ? Math.atan2(aimY - player.eye.y, Math.hypot(dx, dz)) : player.pitch;
        player.pitch = U.clamp(player.pitch + U.clamp(wantPitch - player.pitch, -0.08, 0.08), -1.4, 1.4);
        let dy = Math.abs(((wantYaw - player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        inp.fire = dy < 0.16 && best.group.position.y < 3.8;
      } else inp.fire = false;
    },
  };
})();
