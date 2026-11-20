// audio.js — WebAudio synth SFX only (no music). Build complete with sound off.
(function () {
  const A = { ctx: null, master: null, on: false };
  A.enable = function () {
    if (this.ctx) { this.ctx.resume(); this.on = true; return; }
    const C = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = C;
    this.master = C.createGain(); this.master.gain.value = 0.5;
    this.master.connect(C.destination);
    this.on = true;
  };
  const noiseBuf = (C, s) => {
    const b = C.createBuffer(1, C.sampleRate * s, C.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  };
  A._noise = function (dur, freq, q, gain, slideTo) {
    const C = this.ctx, n = C.createBufferSource(); n.buffer = noiseBuf(C, dur);
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, C.currentTime + dur);
    const g = C.createGain(); g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + dur);
    n.connect(f).connect(g).connect(this.master); n.start();
  };
  A._tone = function (type, f0, f1, dur, gain) {
    const C = this.ctx, o = C.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, C.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), C.currentTime + dur);
    const g = C.createGain(); g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, C.currentTime + dur);
    o.connect(g).connect(this.master); o.start(); o.stop(C.currentTime + dur + 0.02);
  };
  A.fire = function (kind) {
    if (!this.on) return;
    if (kind === 'pistol') { this._tone('square', 720, 130, 0.07, 0.22); this._noise(0.06, 2600, 1.2, 0.16); }
    else if (kind === 'rocket') {
      this._tone('sine', 150, 38, 0.42, 0.55);
      this._noise(0.34, 500, 0.7, 0.42, 120);
      this._noise(0.18, 2400, 1.4, 0.2, 700);
    }
    else { this._tone('sine', 220, 45, 0.22, 0.5); this._noise(0.18, 900, 0.8, 0.35, 150); }
  };
  A.ui = function (name) {
    if (!this.on) return;
    if (name === 'kill') this._tone('sawtooth', 880, 110, 0.16, 0.18);
    else if (name === 'dash') this._noise(0.22, 400, 1.6, 0.3, 3200);
    else if (name === 'hurt') this._tone('square', 140, 60, 0.14, 0.3);
    else if (name === 'pickup') { this._tone('triangle', 660, 660, 0.07, 0.2); setTimeout(() => this._tone('triangle', 990, 990, 0.1, 0.2), 70); }
    else if (name === 'switch') this._tone('square', 400, 550, 0.05, 0.12);
    else if (name === 'click') this._tone('square', 500, 300, 0.06, 0.15);
    else if (name === 'blink') { this._tone('square', 1400, 320, 0.09, 0.16); this._noise(0.09, 3200, 2.2, 0.14, 900); }
    else if (name === 'boom') { this._tone('sine', 170, 26, 0.55, 0.7); this._noise(0.5, 700, 0.5, 0.5, 90); }
  };
  // continuous thruster wash while rocketpacking (gain-ramped, never breaks the loop)
  A.thrust = function (on) {
    if (!this.on) return;
    if (on && !this._thr) {
      const C = this.ctx, n = C.createBufferSource();
      n.buffer = noiseBuf(C, 1.5); n.loop = true;
      const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.8;
      const g = C.createGain(); g.gain.value = 0.0001;
      g.gain.linearRampToValueAtTime(0.14, C.currentTime + 0.08);
      n.connect(f).connect(g).connect(this.master); n.start();
      this._thr = { n, g };
    } else if (!on && this._thr) {
      const t = this._thr; this._thr = null;
      t.g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
      setTimeout(() => { try { t.n.stop(); } catch (e) { /* already done */ } }, 200);
    }
  };
  window.Audio = A;
})();
