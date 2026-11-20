// world.js — procedural cyberpunk arena, greybox first, neon trim second.
// Exports World.build(scene) -> { colliders: [AABB], bounds }
(function () {
  function mat(color, emissive) {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissive) m.emissive = new THREE.Color(emissive), m.emissiveIntensity = 1;
    return m;
  }
  const INK_FLAT = 0x838da6, DARK = 0x97a2bc, MID = 0xb3bdd6, CYAN = 0x27e8ff, MAG = 0xff2e88, AMBER = 0xffb13d;

  window.World = {
    build: function (scene) {
      const CFG = window.CFG, half = CFG.arena.half, wallH = CFG.arena.wallH;
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

      // floor + perimeter walls (walls drawn as slabs, colliders on inside faces)
      add(half * 2 + 2, 1, half * 2 + 2, 0, -0.5, 0, mat(INK_FLAT));
      add(half * 2, wallH, 1, 0, wallH / 2, -half - 0.5, mat(DARK));
      add(half * 2, wallH, 1, 0, wallH / 2, half + 0.5, mat(DARK));
      add(1, wallH, half * 2, -half - 0.5, wallH / 2, 0, mat(DARK));
      add(1, wallH, half * 2, half + 0.5, wallH / 2, 0, mat(DARK));
      // neon crown around the walls + a floor stripe down the middle
      neon(half * 2, 0.14, 0.22, 0, wallH - 0.5, -half + 0.1, CYAN);
      neon(half * 2, 0.14, 0.22, 0, wallH - 0.5, half - 0.1, MAG);
      neon(0.22, 0.14, half * 2, -half + 0.1, wallH - 0.5, 0, MAG);
      neon(0.22, 0.14, half * 2, half - 0.1, wallH - 0.5, 0, CYAN);
      neon(half * 2 - 6, 0.06, 0.5, 0, 0.03, 0, AMBER);

      // cover blocks: crates and monoliths, hand-placed for lanes + high ground
      add(3.2, 1.1, 3.2, -7, 0.55, -6, mat(MID));
      add(3.2, 1.1, 3.2, 7.4, 0.55, 6.2, mat(MID));
      add(2.2, 2.3, 2.2, 0, 1.15, -11, mat(MID));
      add(2.2, 2.3, 2.2, -11.5, 1.15, 8, mat(MID));
      add(5.0, 0.8, 1.6, 10, 0.4, -8.5, mat(DARK));
      add(1.4, 4.2, 7.0, -14, 2.1, -2, mat(DARK));
      add(1.4, 4.2, 7.0, 14, 2.1, 2, mat(DARK));
      // high-ground platform with ramps implied by low step boxes
      add(6, 1.8, 6, -6, 0.9, 13, mat(MID));
      add(6, 0.9, 2, -6, 0.45, 7.6, mat(MID));
      add(2.6, 0.7, 2.6, -6, 0.35, 17.4, mat(MID));
      // neon edging on the big blocks
      neon(3.4, 0.08, 0.16, -7, 1.14, -6 + 1.68, CYAN);
      neon(6.2, 0.08, 0.16, -6, 1.84, 13 - 2.92, MAG);

      // hand-lettered vertical banners (canvas textures — same pipeline as the HUD look)
      function banner(text, color, x, y, z, ry) {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512;
        const p = cv.getContext('2d');
        p.fillStyle = '#181d2e'; p.fillRect(0, 0, 128, 512);
        p.strokeStyle = color; p.lineWidth = 7; p.strokeRect(7, 7, 114, 498);
        p.fillStyle = color; p.textAlign = 'center'; p.textBaseline = 'middle';
        p.font = '900 92px "Yu Gothic", "MS Gothic", sans-serif';
        for (let i = 0; i < text.length; i++) p.fillText(text[i], 64, 74 + i * 110);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6.0),
          new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv), emissive: 0x3a3a3a, side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.rotation.y = ry || 0;
        group.add(m);
      }
      banner('電脳道場', '#ff2e88', -12, 3.6, -20.35, 0);
      banner('撃的', '#27e8ff', 12, 3.6, -20.35, 0);
      banner('ねおん', '#ffb13d', -20.35, 3.6, -6, Math.PI / 2);
      banner('浪人', '#27e8ff', 20.35, 3.6, 6, Math.PI / 2);

      // lights
      scene.add(new THREE.HemisphereLight(0x6a7aa8, 0x1c1826, 1.35));
      const sun = new THREE.DirectionalLight(0xeaf0ff, 2.7);
      sun.position.set(-9, 16, 7); scene.add(sun);
      const p1 = new THREE.PointLight(CYAN, 22, 16, 2); p1.position.set(-half + 2, 3, -half + 2); scene.add(p1);
      const p2 = new THREE.PointLight(MAG, 22, 16, 2); p2.position.set(half - 2, 3, half - 2); scene.add(p2);
      scene.background = new THREE.Color(0x0d1020);
      scene.fog = new THREE.Fog(0x0d1020, 30, 64);

      return { colliders: colliders, half: half, group: group };
    },
  };
})();
