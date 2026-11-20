// world.js — open rooftop dojo above a procedural neon cityscape.
// Rooftop: floor, parapets, cover, banners. City: 3 instanced skyline layers
// with lit-window facades, painted manga sky (gradient + stars + striped moon).
// Exports World.build(scene) -> { colliders: [AABB], half, group }
(function () {
  const INK_FLAT = 0x838da6, DARK = 0x97a2bc, MID = 0xb3bdd6, CYAN = 0x27e8ff, MAG = 0xff2e88, AMBER = 0xffb13d;

  function mat(color, emissive) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) m.emissive = new THREE.Color(emissive), m.emissiveIntensity = 1;
    return m;
  }
  // Arena props use FLAT unlit paper-grey: Lambert shading lands prop faces on the
  // same ink band as the near-black towers (measured 0.161 vs 0.161 sRGB), which
  // reads as "background grid on a glass box". Unlit grey quantizes to the lightest
  // band, so every prop pops white against the ink city behind it.
  function propMat(color) { return new THREE.MeshBasicMaterial({ color }); }
  // crisp lit-window facade: dark plate + random neon windows, nearest-filtered
  function facadeTex(seedLit, warm) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const p = cv.getContext('2d');
    p.fillStyle = '#0b0e1a'; p.fillRect(0, 0, 64, 64);
    p.strokeStyle = '#1a2036'; p.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { p.beginPath(); p.moveTo(0, i * 8); p.lineTo(64, i * 8); p.stroke(); }
    const cols = ['#ffd9a0', '#ffb13d', '#27e8ff', '#ff2e88', '#eaf6ff', '#ffd9a0'];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (Math.random() < seedLit) {
        p.fillStyle = warm ? cols[Math.floor(Math.random() * 2)] : cols[Math.floor(Math.random() * cols.length)];
        p.fillRect(c * 8 + 2, r * 8 + 2, 4, 5);
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  // painted manga sky: night gradient, star dust, striped moon, cloud slashes
  function skyTex() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024;
    const p = cv.getContext('2d');
    const g = p.createLinearGradient(0, 0, 0, 1024);
    g.addColorStop(0, '#04060e'); g.addColorStop(0.42, '#131a38');
    g.addColorStop(0.68, '#3a2350'); g.addColorStop(0.84, '#a03a70');
    g.addColorStop(0.93, '#d1587e'); g.addColorStop(1, '#241a3a');
    p.fillStyle = g; p.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 240; i++) {
      const y = Math.random() * 620;
      p.fillStyle = 'rgba(240,246,255,' + (0.25 + Math.random() * 0.7) + ')';
      p.fillRect(Math.random() * 512, y, Math.random() < 0.12 ? 2 : 1, 1);
    }
    // striped manga moon
    p.fillStyle = '#f5f2e9'; p.beginPath(); p.arc(150, 250, 88, 0, Math.PI * 2); p.fill();
    p.strokeStyle = '#101322'; p.lineWidth = 6; p.stroke();
    p.strokeStyle = 'rgba(140,150,180,.8)'; p.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      p.beginPath(); p.moveTo(70, 205 + i * 30);
      p.bezierCurveTo(140, 190 + i * 30, 220, 220 + i * 30, 236, 210 + i * 30); p.stroke();
    }
    p.fillStyle = 'rgba(20,24,46,.85)';
    for (let i = 0; i < 5; i++) {
      p.beginPath(); p.ellipse(90 + Math.random() * 340, 480 + Math.random() * 220, 130 + Math.random() * 90, 16, -0.06, 0, Math.PI * 2); p.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  window.World = {
    build: function (scene) {
      const CFG = window.CFG, half = CFG.arena.half;
      const colliders = [];
      const group = new THREE.Group(); scene.add(group);

      const add = (w, h, d, x, y, z, m, solid) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z);
        group.add(mesh);
        if (solid !== false)
          colliders.push(new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d)));
        return mesh;
      };
      const neon = (w, h, d, x, y, z, c) => add(w, h, d, x, y, z, mat(c, c), false);
      const clip = (w, h, d, x, y, z) =>  // invisible containment only
        colliders.push(new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d)));

      // ---------- rooftop ----------
      // textured rooftop deck (panel grid + speckle)
      const fc = document.createElement('canvas'); fc.width = fc.height = 128;
      {
        const p = fc.getContext('2d');
        p.fillStyle = '#8a94ad'; p.fillRect(0, 0, 128, 128);
        p.strokeStyle = '#69738d'; p.lineWidth = 3;
        p.strokeRect(0, 0, 128, 128);
        p.beginPath(); p.moveTo(64, 0); p.lineTo(64, 128); p.moveTo(0, 64); p.lineTo(128, 64); p.stroke();
        p.fillStyle = 'rgba(40,46,66,.25)';
        for (let i = 0; i < 26; i++) p.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
      }
      const ftex = new THREE.CanvasTexture(fc);
      ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(14, 14);
      ftex.colorSpace = THREE.SRGBColorSpace;
      add(half * 2 + 2, 1, half * 2 + 2, 0, -0.5, 0, new THREE.MeshLambertMaterial({ color: 0xcfd6e4, map: ftex }));

      // waist parapets with neon crown (the city is open beyond them)
      const PAR = 1.15, pmat = propMat(0xaab4cc);
      add(half * 2, PAR, 1, 0, PAR / 2, -half - 0.5, pmat);
      add(half * 2, PAR, 1, 0, PAR / 2, half + 0.5, pmat);
      add(1, PAR, half * 2, -half - 0.5, PAR / 2, 0, pmat);
      add(1, PAR, half * 2, half + 0.5, PAR / 2, 0, pmat);
      neon(half * 2, 0.14, 0.22, 0, PAR + 0.06, -half - 0.5, CYAN);
      neon(half * 2, 0.14, 0.22, 0, PAR + 0.06, half + 0.5, MAG);
      neon(0.22, 0.14, half * 2, -half - 0.5, PAR + 0.06, 0, MAG);
      neon(0.22, 0.14, half * 2, half + 0.5, PAR + 0.06, 0, CYAN);
      neon(half * 2 - 6, 0.06, 0.5, 0, 0.03, 0, AMBER);
      // invisible containment so thrust never flies you off the roof
      clip(half * 2, 34, 1, 0, 17, -half - 0.5);
      clip(half * 2, 34, 1, 0, 17, half + 0.5);
      clip(1, 34, half * 2, -half - 0.5, 17, 0);
      clip(1, 34, half * 2, half + 0.5, 17, 0);

      // cover blocks with panel/hazard decals
      const panelTex = (() => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        const p = cv.getContext('2d');
        p.fillStyle = '#b3bdd6'; p.fillRect(0, 0, 64, 64);
        p.strokeStyle = '#7e88a3'; p.lineWidth = 2;
        p.strokeRect(2, 2, 60, 60);
        p.beginPath(); p.moveTo(2, 32); p.lineTo(62, 32); p.stroke();
        p.fillStyle = '#ffb13d'; p.fillRect(6, 52, 52, 6);
        p.fillStyle = '#101322';
        for (let i = 0; i < 5; i++) p.fillRect(8 + i * 11, 52, 5, 6);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
      })();
      const panelMat = new THREE.MeshBasicMaterial({ map: panelTex });
      add(3.2, 1.1, 3.2, -7, 0.55, -6, panelMat);
      add(3.2, 1.1, 3.2, 7.4, 0.55, 6.2, panelMat);
      add(2.2, 2.3, 2.2, 0, 1.15, -11, panelMat);
      add(2.2, 2.3, 2.2, -11.5, 1.15, 8, panelMat);
      add(5.0, 0.8, 1.6, 10, 0.4, -8.5, propMat(0x97a2bc));
      add(1.4, 4.2, 7.0, -14, 2.1, -2, propMat(0x97a2bc));
      add(1.4, 4.2, 7.0, 14, 2.1, 2, propMat(0x97a2bc));
      add(6, 1.8, 6, -6, 0.9, 13, panelMat);
      add(6, 0.9, 2, -6, 0.45, 7.6, panelMat);
      add(2.6, 0.7, 2.6, -6, 0.35, 17.4, panelMat);
      neon(3.4, 0.08, 0.16, -7, 1.14, -6 + 1.68, CYAN);
      neon(6.2, 0.08, 0.16, -6, 1.84, 13 - 2.92, MAG);

      // AC units + antenna mast with blinking beacon
      add(1.6, 0.9, 1.2, 16, 0.45, 14, propMat(0x97a2bc));
      add(1.2, 0.7, 1.2, 12.5, 0.35, -16, propMat(0x97a2bc));
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5.5, 6), propMat(0x7a8399));
      mast.position.set(18, 2.75, -18); group.add(mast);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(0xff2e88, 0xff2e88));
      beacon.position.set(18, 5.6, -18); beacon.userData.beacon = true; group.add(beacon);

      // hand-lettered vertical banners on corner masts
      function banner(text, color, x, y, z, ry) {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512;
        const p = cv.getContext('2d');
        p.fillStyle = '#181d2e'; p.fillRect(0, 0, 128, 512);
        p.strokeStyle = color; p.lineWidth = 7; p.strokeRect(7, 7, 114, 498);
        p.fillStyle = color; p.textAlign = 'center'; p.textBaseline = 'middle';
        p.font = '900 92px "Yu Gothic", "MS Gothic", sans-serif';
        for (let i = 0; i < text.length; i++) p.fillText(text[i], 64, 74 + i * 110);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6.0),
          new THREE.MeshLambertMaterial({ map: t, emissive: 0x3a3a3a, side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.rotation.y = ry || 0;
        group.add(m);
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, y + 3.4, 0.12), mat(0x5a6377));
        pole.position.set(x, (y + 3.4) / 2 - 1.7, z);
        group.add(pole);
      }
      banner('電脳道場', '#ff2e88', -19.2, 4.6, -19.2, Math.PI / 4);
      banner('撃的', '#27e8ff', 19.2, 4.6, -19.2, -Math.PI / 4);
      banner('ねおん', '#ffb13d', -19.2, 4.6, 19.2, Math.PI / 4);
      banner('浪人', '#27e8ff', 19.2, 4.6, 19.2, -Math.PI / 4);

      // ---------- cityscape: 3 instanced skyline layers ----------
      function layer(count, rMin, rMax, hMin, hMax, tex, base, emissive) {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.translate(0, 0.5, 0);                    // grow from the ground up
        const m = new THREE.MeshLambertMaterial({
          color: base, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: emissive,
        });
        const im = new THREE.InstancedMesh(geo, m, count);
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.random() * 0.35;
          const r = U.rand(rMin, rMax);
          const w = U.rand(5, 14), h = U.rand(hMin, hMax), d = U.rand(5, 14);
          e.set(0, Math.random() * Math.PI, 0); q.setFromEuler(e);
          mtx.compose(new THREE.Vector3(Math.cos(a) * r, -3.2, Math.sin(a) * r), q, new THREE.Vector3(w, h, d));
          im.setMatrixAt(i, mtx);
        }
        im.instanceMatrix.needsUpdate = true;
        scene.add(im);
        return im;
      }
      layer(46, 46, 80, 18, 62, facadeTex(0.5, false), 0x39415c, 1.15);
      layer(80, 95, 160, 30, 100, facadeTex(0.42, true), 0x2c3350, 0.95);
      layer(130, 175, 300, 45, 170, facadeTex(0.3, true), 0x232a45, 0.7);
      // city floor the towers rise from, far below the rooftop
      add(900, 2, 900, 0, -4.4, 0, mat(0x171c30), false);

      // painted sky
      scene.background = skyTex();

      // lights
      scene.add(new THREE.HemisphereLight(0x6a7aa8, 0x241a3a, 1.5));
      const sun = new THREE.DirectionalLight(0xeaf0ff, 2.7);
      sun.position.set(-9, 16, 7); scene.add(sun);
      const p1 = new THREE.PointLight(CYAN, 22, 16, 2); p1.position.set(-half + 2, 3, -half + 2); scene.add(p1);
      const p2 = new THREE.PointLight(MAG, 22, 16, 2); p2.position.set(half - 2, 3, half - 2); scene.add(p2);
      scene.fog = new THREE.Fog(0x1b2140, 90, 430);

      return { colliders: colliders, half: half, group: group };
    },
  };
})();
