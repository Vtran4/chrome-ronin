// config.js — every tunable in one place. Units: meters, seconds.
window.CFG = {
  // ---- cel / ink post pass ----
  cel: {
    rampSteps: 3,          // toon quantization levels
    exposure: 1.15,         // ramp exposure on perceptual (sqrt) luma
    ink: [0.02, 0.02, 0.04], // outline color
    edgeN: 0.45,           // normal-edge sensitivity (0..1, lower = more edges)
    edgeD: 0.010,          // depth-edge relative threshold
    edgeW: 2.6,            // outline width in texels
    halftone: true,        // screentone dots in shadow regions
    shadowTint: [0.72, 0.78, 1.12], // cool ink-shadow tint
    levels: [0.015, 0.17, 0.60],    // snapped ink level per band (LINEAR luma ≈ sRGB .13/.45/.80)
  },
  // ---- player movement ----
  walk: 7.4, airCtl: 0.9, jumpV: 6.4, gravity: 19,
  dashSpeed: 17, dashTime: 0.16, dashCd: 0.75, iframe: 0.30,
  eyeH: 1.62, radius: 0.38,
  // ---- player economy ----
  hpMax: 100, armorMax: 100, armorFrac: 0.6,
  // ---- rocketpack: jump, then hold jump to thrust upward on fuel ----
  rocketpack: { thrust: 26, maxUp: 7, burn: 0.5, regen: 1.0, jumpCost: 0.06 },
  // ---- weapons ----
  weapons: {
    pistol:  { name: 'KAGEROU',     dmg: 14, rate: 0.16, spread: 0.008, pellets: 1, range: 60, kick: 0.9, ammoMax: Infinity },
    scatter: { name: 'ONI SCATTER', dmg: 10, rate: 0.62, spread: 0.055, pellets: 8, range: 24, kick: 2.6, ammoMax: 60, ammoStart: 24 },
    rocket:  { name: 'OTSUSHIMI',   dmg: 80, rate: 1.05, spread: 0.004, pellets: 1, range: 60, kick: 3.4, ammoMax: 12, ammoStart: 3,
               projSpeed: 21, projGrav: 9, splash: 60, splashR: 3.8 },
  },
  crit: { chance: 0.15, mult: 2 },
  // ---- enemies ----
  drone: { hp: 26, speed: 4.2, dmg: 6,  attackCd: 1.9, score: 100, radius: 0.45, hover: [1.1, 2.4] },
  oni:   { hp: 95, speed: 3.1, dmg: 24, attackCd: 2.2, score: 400, radius: 0.6,
           telegraph: 0.55, lungeSpeed: 14, lungeTime: 0.35, lungeRange: 3.4, feint: 0.3 },
  wisp:  { hp: 42, speed: 5.4, dmg: 8, attackCd: 2.3, score: 250, radius: 0.42,
           hover: [1.5, 3.4], prefer: [8, 13], charge: 0.7, burst: 3, blinkCd: 4.5 },
  drop:  { health: 0.26, armor: 0.15, ammo: 0.42, rocket: 0.14, healthAmt: 18, armorAmt: 20, ammoAmt: 8, rocketAmt: 2 },
  // ---- waves: [drones, onis, wisps] per wave ----
  waves: [[4,0,0],[5,1,0],[6,1,1],[8,2,1],[10,3,2]],
  waveBreak: 8, spawnGap: 1.1, maxAlive: 9,
  // ---- scoring ----
  comboMax: 8, comboStep: 2, // +2 mult per N clean kills
  comboPerStep: 3,
  // ---- render ----
  fov: 95, resMin: 0.55, resMax: 1.0, targetMs: 16.6,
  arena: { half: 21, wallH: 7 },
};
