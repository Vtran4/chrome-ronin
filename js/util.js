// util.js — seeded rng + small helpers (classic-script style, like prior builds)
(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const U = {
    rng: mulberry32(1234),
    seed(n) { U.rng = mulberry32(n >>> 0); },
    rand(a = 1, b) { return b === undefined ? U.rng() * a : a + U.rng() * (b - a); },
    irand(a, b) { return Math.floor(U.rand(a, b + 1)); },
    pick(arr) { return arr[Math.floor(U.rng() * arr.length)]; },
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    damp(cur, target, lambda, dt) { return target + (cur - target) * Math.exp(-lambda * dt); },
    len2(x, z) { return Math.hypot(x, z); },
    el(id) { return document.getElementById(id); },
    fmt(n) { return n.toLocaleString('en-US'); },
  };
  window.U = U;
})();
