// cel.js — the manga look: toon quantize + depth/normal edge outlines + screentone,
// rendered as a full-frame post pass (locked technique, see REQUIREMENTS.md).
// Pipeline: scene -> [color RT + depth] + [normal RT] -> composite ShaderMaterial -> canvas.
(function () {
  const VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const FRAG = `
    uniform sampler2D tColor, tNormal, tDepth;
    uniform vec2 uTexel, uRes;
    uniform float uNear, uFar, uSteps, uEdgeN, uEdgeD, uEdgeW;
    uniform float uHalftone, uTime, uExp;
    uniform vec3 uInk, uShadowTint, uLvl;
    uniform float uInvert, uSpeed, uFlash, uTone, uAspect;
    uniform mat4 uCamMat; uniform float uTanF;
    varying vec2 vUv;

    const float TAU = 6.2831853;
    float linz(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      if (z >= 1.0) return 1e6;
      float n = z * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - n * (uFar - uNear));
    }
    void main() {
      vec3 c = texture2D(tColor, vUv).rgb;
      // quantize in perceptual space: Lambert lands at 0.1-0.2 linear, which would
      // collapse into band 0; sqrt-luma matches how the eye reads ink vs paper
      float l = min(sqrt(max(dot(c, vec3(0.299, 0.587, 0.114)), 0.0)) * uExp, 1.0);

      // --- 3-step toon ramp: luminance SNAPPED to ink levels (flat within band) ---
      float t = l * uSteps;
      float b0 = smoothstep(0.95, 1.05, t);   // 0->1 crossing into band1
      float b1 = smoothstep(1.95, 2.05, t);   // 1->2 crossing into band2
      vec3 col = c * mix(uShadowTint, vec3(1.0), b0);
      float lo = max(dot(col, vec3(0.299, 0.587, 0.114)), 1e-4);
      float lT = mix(mix(uLvl.x, uLvl.y, b0), uLvl.z, b1);
      col *= lT / lo;
      float d0 = linz(vUv);
      float sky = step(1e5, d0);   // background pixels: no tone, no ink

      // --- screentone halftone in true-shadow areas ---
      float shadeW = (1.0 - b0) * smoothstep(0.42, 0.16, l) * uHalftone * (1.0 - sky);
      if (shadeW > 0.001) {
        // dots anchored in WORLD space (via view-position reconstruction) so they
        // travel with the surface; screen-space dots swim during motion and read
        // as a translucent grille over walls
        vec2 nd = vUv * 2.0 - 1.0;
        vec3 vp = vec3(nd.x * uTanF * uAspect, nd.y * uTanF, -1.0) * d0;
        vec3 wp = (uCamMat * vec4(vp, 1.0)).xyz;
        vec2 hp = vec2(wp.x + wp.z, wp.y + wp.z * 0.5) / 0.085;
        float d = length(fract(hp) - 0.5);
        float rad = mix(0.40, 0.05, clamp(l * 1.8, 0.0, 1.0));
        float cov = smoothstep(rad + 0.07, rad - 0.07, d);
        col *= mix(1.0, 1.0 - 0.7 * cov, shadeW);
      }

      // --- ink outlines: normal-difference + depth-discontinuity ---
      vec3 n0 = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
      float e = 0.0;
      vec2 o1 = uTexel * uEdgeW, o2 = uTexel * uEdgeW * vec2(-1.0, 1.0);
      e += 1.0 - dot(n0, normalize(texture2D(tNormal, vUv + o1).xyz * 2.0 - 1.0));
      e += 1.0 - dot(n0, normalize(texture2D(tNormal, vUv - o1).xyz * 2.0 - 1.0));
      e += 1.0 - dot(n0, normalize(texture2D(tNormal, vUv + o2).xyz * 2.0 - 1.0));
      e += 1.0 - dot(n0, normalize(texture2D(tNormal, vUv - o2).xyz * 2.0 - 1.0));
      float edge = smoothstep(uEdgeN, uEdgeN + 0.35, e) * (1.0 - sky);
      if (sky < 0.5) {
        float dx = linz(vUv + o1), dy = linz(vUv + o2);
        float rel = max(abs(dx - d0), abs(dy - d0)) / max(d0, 0.001);
        edge = max(edge, smoothstep(uEdgeD, uEdgeD * 2.2, rel));
      }
      col = mix(col, uInk, clamp(edge, 0.0, 1.0));

      // --- expressive overlays (driven by fx module) ---
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float r = length(p);
      if (uSpeed > 0.001) {
        float a = atan(p.y, p.x);
        float k = fract(a * (56.0 / TAU) + uTime * 0.55);
        float w = smoothstep(0.0, 0.30, k) * (1.0 - smoothstep(0.5, 0.86, k));
        float band = w * smoothstep(0.06, 0.42, r);
        col = mix(col, vec3(1.0), band * uSpeed * 0.9);
        col = mix(col, uInk * 2.0, band * uSpeed * 0.22);
        col *= 1.0 - uSpeed * 0.3 * smoothstep(0.02, 0.14, r) * (1.0 - smoothstep(0.14, 0.3, r));
      }
      if (uTone > 0.001) {
        float v = smoothstep(0.28, 0.8, r) * uTone;
        vec2 h2 = (vUv * uRes) / 5.0;
        float d2 = length(fract(h2 + vec2(2.5)) - 0.5);
        float cov2 = smoothstep(0.4, 0.22, d2);
        col = mix(col, vec3(0.62, 0.04, 0.12), v * (0.5 + 0.5 * cov2));
      }
      col = mix(col, vec3(1.0) - col, uInvert);
      col = mix(col, vec3(1.0), uFlash);

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`;

  function CelPass(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.scale = 1;
    this.fx = { invert: 0, speed: 0, flash: 0, tone: 0 };
    this.time = 0;
    const C = window.CFG.cel;
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtColor = new THREE.WebGLRenderTarget(2, 2, {
      ...opts,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(2, 2, THREE.UnsignedIntType),
    });
    this.rtColor.texture.colorSpace = THREE.SRGBColorSpace;
    this.rtNormal = new THREE.WebGLRenderTarget(2, 2, opts);

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tColor: { value: this.rtColor.texture },
        tNormal: { value: this.rtNormal.texture },
        tDepth: { value: this.rtColor.depthTexture },
        uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() },
        uNear: { value: 0.05 }, uFar: { value: 220 },
        uSteps: { value: C.rampSteps }, uEdgeN: { value: C.edgeN }, uEdgeD: { value: C.edgeD },
        uEdgeW: { value: C.edgeW }, uHalftone: { value: C.halftone ? 1 : 0 },
        uExp: { value: C.exposure }, uTime: { value: 0 },
        uInk: { value: new THREE.Vector3(...C.ink) },
        uShadowTint: { value: new THREE.Vector3(...C.shadowTint) },
        uLvl: { value: new THREE.Vector3(...C.levels) },
        uInvert: { value: 0 }, uSpeed: { value: 0 }, uFlash: { value: 0 }, uTone: { value: 0 },
        uAspect: { value: 1 },
        uCamMat: { value: new THREE.Matrix4() }, uTanF: { value: 1.0 },
      },
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.normalMat = new THREE.MeshNormalMaterial();
    this._savedBg = null;
  }

  CelPass.prototype.setSize = function (w, h, scale) {
    this.scale = U.clamp(scale, window.CFG.resMin, window.CFG.resMax);
    const rw = Math.max(2, Math.round(w * this.scale)), rh = Math.max(2, Math.round(h * this.scale));
    this.rtColor.setSize(rw, rh);
    this.rtNormal.setSize(rw, rh);
    const u = this.mat.uniforms;
    u.uTexel.value.set(1 / rw, 1 / rh);
    u.uRes.value.set(rw, rh);
    u.uAspect.value = w / h;
  };

  CelPass.prototype.render = function (scene, camera) {
    const r = this.renderer;
    this.time += r.getRenderTarget() === null ? 0 : 0; // time set externally via tick
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    const u = this.mat.uniforms;
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    camera.updateMatrixWorld();
    u.uCamMat.value.copy(camera.matrixWorld);
    u.uTanF.value = Math.tan(camera.fov * Math.PI / 360);
    u.uTime.value = this.time;
    u.uInvert.value = this.fx.invert; u.uSpeed.value = this.fx.speed;
    u.uFlash.value = this.fx.flash;   u.uTone.value = this.fx.tone;

    r.setRenderTarget(this.rtColor);
    r.clear();
    r.render(scene, camera);

    this._savedBg = scene.background; scene.background = null;
    scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.rtNormal);
    r.clear();
    r.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = this._savedBg;

    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  };

  CelPass.prototype.tick = function (dt) { this.time += dt; };
  window.CelPass = CelPass;
})();
