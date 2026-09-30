/* ==========================================================
   audio.js — sintetizador WebAudio minimalista (sin archivos)
   ========================================================== */
'use strict';
(function (TP) {
  const A = { ctx: null, master: null, noiseBuf: null, last: {} };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.connect(A.ctx.destination);
    A.setVolume();
    const len = A.ctx.sampleRate * 1.5;
    A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };
  A.setVolume = function () {
    if (!A.master) return;
    const o = TP.Save.opts();
    A.master.gain.value = o.sound ? o.volume * 0.5 : 0;
  };

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(type, f0, f1, dur, vol, delay) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filt, f0, f1, q, delay) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const s = c.createBufferSource(); s.buffer = A.noiseBuf;
    const f = c.createBiquadFilter(); f.type = filt || 'lowpass';
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    f.Q.value = q || 1;
    const g = c.createGain();
    env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const S = {
    drill: p => { const h = (p && p.hard) || 1; noise(0.09 + h * 0.02, 0.22, 'bandpass', 900 - h * 80, 400, 3); tone('square', 70 + h * 6, 55, 0.08, 0.05); },
    break: p => { noise(0.18, 0.25, 'lowpass', 1400, 200, 1); },
    step: () => { noise(0.04, 0.05, 'lowpass', 500, 200, 1); },
    ore: p => { const b = 520 + ((p && p.v) || 0) * 12; tone('triangle', b, b * 1.5, 0.12, 0.12); tone('sine', b * 2, b * 2, 0.12, 0.05, 0.06); },
    pickup: () => { tone('square', 330, 660, 0.1, 0.07); tone('square', 660, 990, 0.1, 0.05, 0.08); },
    explode: p => { const r = (p && p.r) || 1; noise(0.7 + r * 0.2, 0.7, 'lowpass', 900, 40, 0.7); tone('sine', 90, 30, 0.6, 0.35); },
    sonar: () => { tone('sine', 1320, 1300, 0.6, 0.12); tone('sine', 1320, 1310, 0.5, 0.05, 0.45); },
    hurt: () => { tone('sawtooth', 180, 60, 0.18, 0.14); noise(0.12, 0.15, 'highpass', 2000, 800, 1); },
    deny: () => { tone('square', 110, 100, 0.07, 0.06); },
    fall: () => { noise(0.25, 0.25, 'lowpass', 300, 60, 1); },
    thud: () => { noise(0.15, 0.18, 'lowpass', 250, 60, 1); tone('sine', 70, 40, 0.15, 0.1); },
    steam: () => { noise(0.5, 0.12, 'highpass', 3000, 5000, 0.5); },
    bomb: () => { tone('square', 880, 880, 0.05, 0.05); tone('square', 880, 880, 0.05, 0.05, 0.12); },
    tick: () => { tone('square', 1200, 1200, 0.03, 0.035); },
    wake: () => { tone('sawtooth', 60, 45, 0.6, 0.12); noise(0.5, 0.08, 'lowpass', 200, 80, 4); },
    bite: () => { noise(0.1, 0.3, 'bandpass', 600, 300, 2); tone('sawtooth', 120, 50, 0.15, 0.12); },
    wormdie: () => { tone('sawtooth', 200, 40, 0.8, 0.14); noise(0.6, 0.2, 'lowpass', 800, 60, 1); },
    quake: () => { noise(1.6, 0.5, 'lowpass', 120, 40, 1); tone('sine', 40, 30, 1.5, 0.3); },
    hover: () => { tone('square', 1800, 1800, 0.012, 0.018); },
    click: () => { tone('square', 900, 600, 0.04, 0.05); },
    type: () => { noise(0.025, 0.08, 'bandpass', 3000 + Math.random() * 1500, 2000, 4); },
    buy: () => { tone('triangle', 660, 660, 0.06, 0.09); tone('triangle', 990, 990, 0.1, 0.08, 0.07); },
    drop: () => { tone('sine', 300, 500, 0.07, 0.08); },
    medal: () => { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.25, 0.1, i * 0.12)); },
    strike: () => { tone('sawtooth', 220, 110, 0.5, 0.15); tone('sawtooth', 165, 82, 0.6, 0.12, 0.25); },
    alarm: () => { tone('square', 880, 660, 0.12, 0.06); },
    descend: () => { noise(1.4, 0.2, 'lowpass', 400, 80, 2); tone('sine', 220, 55, 1.4, 0.15); },
    victory: () => { [392, 523, 659, 784, 659, 1046].forEach((f, i) => tone('triangle', f, f, 0.4, 0.1, i * 0.18)); },
    death: () => { tone('sawtooth', 300, 30, 1.8, 0.18); noise(1.5, 0.3, 'lowpass', 600, 40, 1); }
  };

  A.play = function (name, p) {
    if (!A.ctx || !TP.Save.opts().sound) return;
    const now = performance.now();
    const minGap = name === 'type' ? 25 : name === 'hover' ? 30 : 35;
    if (A.last[name] && now - A.last[name] < minGap) return;
    A.last[name] = now;
    try { S[name] && S[name](p); } catch (e) { /* silencio */ }
  };

  TP.Audio = A;
})(window.TP);
