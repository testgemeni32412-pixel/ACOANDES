/*
 * Música ambiental generativa del recorrido.
 * Se compone en tiempo real con la Web Audio API: no usa archivos ni pistas
 * de terceros, así que es 100 % libre de derechos y no pesa nada.
 *
 * Capas: colchón de acordes (pad), bajo suave, piano eléctrico con eco,
 * reverberación y un leve crujido de vinilo. Cada categoría del recorrido
 * tiene su propia progresión; el cambio entra en el siguiente acorde.
 *
 * API pública: window.AcoMusic
 *   start()          crea/reanuda el audio (llamar desde un clic o toque)
 *   setMuted(bool)   silencia con fundido
 *   isMuted()
 *   setMood(nombre)  'exteriores' | 'comunes' | 'aulas'
 *   level()          nivel 0..1 aproximado, para animar el ecualizador
 */
(function () {
  'use strict';

  const BEAT = 60 / 68;          // 68 BPM
  const STEP = BEAT / 2;         // corchea
  const STEPS_PER_CHORD = 16;    // 8 tiempos por acorde
  const LOOKAHEAD = 0.5;
  const MASTER_LEVEL = 0.5;

  // Todo en Do mayor / La menor para que los cambios de ambiente sean suaves.
  const MOODS = {
    exteriores: { // luminoso, con color lidio
      chords: [[53, 57, 60, 64, 67], [55, 59, 64, 69], [52, 55, 59, 62], [57, 60, 64, 67]],
      bright: 3400, density: 0.5
    },
    comunes: { // cálido
      chords: [[48, 55, 59, 64], [57, 60, 64, 67], [50, 53, 57, 60, 64], [55, 60, 62, 65]],
      bright: 2700, density: 0.42
    },
    aulas: { // tranquilo, para concentrarse
      chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 64, 69]],
      bright: 2100, density: 0.3
    }
  };
  const SCALE = [72, 74, 76, 79, 81, 84, 86, 88]; // pentatónica de Do, registro alto

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);

  let ctx = null;
  let master, warmth, analyser, padBus, keysBus, reverb, delay;
  let muted = true;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let chordIndex = 0;
  let mood = 'exteriores';
  let pendingMood = null;
  let melodyNote = 4;
  let levelData = null;

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function vinyl() {
    const rate = ctx.sampleRate;
    const len = rate * 4;
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);   // ruido suave
      d[i] = b * 0.5;
      if (Math.random() < 0.00018) d[i] += rand(-0.7, 0.7); // crujidos
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(hp).connect(g).connect(warmth);
    src.start();
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC({ latencyHint: 'playback' });

    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    levelData = new Uint8Array(analyser.frequencyBinCount);

    warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = MOODS[mood].bright;
    warmth.Q.value = 0.4;

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;

    // Eco del piano: corchea con puntillo, con filtro en la realimentación.
    delay = ctx.createDelay(2);
    delay.delayTime.value = STEP * 1.5;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 2200;
    delay.connect(fbFilter).connect(fb).connect(delay);

    padBus = ctx.createGain();
    padBus.gain.value = 0.9;
    keysBus = ctx.createGain();
    keysBus.gain.value = 0.55;

    padBus.connect(warmth);
    keysBus.connect(warmth);
    keysBus.connect(delay);
    delay.connect(warmth);
    warmth.connect(master);
    warmth.connect(reverb);
    reverb.connect(wet).connect(master);
    master.connect(comp).connect(analyser).connect(ctx.destination);

    vinyl();
    return true;
  }

  function pad(notes, t, dur) {
    const per = 0.045 / Math.sqrt(notes.length);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(800, t + dur + 3);
    filter.connect(padBus);
    notes.forEach((m) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(per, t + 2.4);
      g.gain.setValueAtTime(per, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 3);
      g.connect(filter);
      [['sine', 0], ['triangle', 5], ['triangle', -6]].forEach(([type, cents]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = hz(m);
        o.detune.value = cents;
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 3.1);
      });
    });
  }

  function bass(m, t, dur) {
    const root = m >= 52 ? m - 24 : m - 12;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(root);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.11, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.9);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(warmth);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function key(m, t, vel) {
    const f = hz(m);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07 * vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 2.6);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator(); // armónico tipo piano eléctrico
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(keysBus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 2.7);
    o2.stop(t + 2.7);
  }

  function schedule(s, t) {
    const pos = s % STEPS_PER_CHORD;
    if (pos === 0) {
      if (pendingMood) {
        mood = pendingMood;
        pendingMood = null;
        warmth.frequency.setTargetAtTime(MOODS[mood].bright, t, 1.5);
      }
      const chords = MOODS[mood].chords;
      const chord = chords[chordIndex % chords.length];
      chordIndex++;
      const dur = STEP * STEPS_PER_CHORD;
      pad(chord, t, dur);
      bass(chord[0], t, dur / 2);
      bass(chord[0], t + dur / 2, dur / 2);
    }
    // Melodía: paseo aleatorio por la pentatónica, más probable en tiempos fuertes.
    const strong = pos % 4 === 0;
    const chance = MOODS[mood].density * (strong ? 1 : 0.45);
    if (pos > 1 && Math.random() < chance) {
      melodyNote = Math.max(0, Math.min(SCALE.length - 1, melodyNote + Math.round(rand(-2, 2))));
      key(SCALE[melodyNote], t + rand(0, 0.025), strong ? 1 : 0.7);
    }
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      schedule(step, nextTime);
      nextTime += STEP;
      step++;
    }
  }

  function run() {
    if (timer) return;
    nextTime = Math.max(nextTime, ctx.currentTime + 0.1);
    tick();
    timer = setInterval(tick, 150);
  }

  function halt() {
    clearInterval(timer);
    timer = null;
  }

  function fadeTo(value, seconds) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(value, now + seconds);
  }

  let suspendTimer = null;

  const api = {
    start() {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_e) { /* iOS 16.4+ */ }
      if (!ctx && !build()) return false;
      muted = false;
      clearTimeout(suspendTimer);
      ctx.resume().then(() => {
        run();
        fadeTo(MASTER_LEVEL, 2.5);
      });
      return true;
    },
    setMuted(value) {
      if (value === muted) return;
      if (!value) { api.start(); return; }
      muted = true;
      if (!ctx) return;
      fadeTo(0, 0.6);
      clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => { if (muted) { halt(); ctx.suspend(); } }, 700);
    },
    isMuted() { return muted; },
    setMood(name) {
      if (!MOODS[name] || name === mood) return;
      pendingMood = name;
    },
    level() {
      if (!ctx || muted || ctx.state !== 'running') return 0;
      analyser.getByteFrequencyData(levelData);
      let sum = 0;
      for (let i = 1; i < 10; i++) sum += levelData[i];
      return Math.min(1, sum / (9 * 200));
    }
  };

  // Al ocultar la pestaña se pausa (ahorra batería en celular) y se reanuda al volver.
  document.addEventListener('visibilitychange', () => {
    if (!ctx || muted) return;
    if (document.hidden) { halt(); ctx.suspend(); }
    else ctx.resume().then(run);
  });

  window.AcoMusic = api;
})();
