// All of the game's sound is synthesised with WebAudio — no audio files. A two-oscillator
// engine whose pitch follows the throttle, wind noise that rises with airspeed, a stall
// beeper, and small one-shot voices for the ring chime, the crate, touchdown and the
// crash. The context stays locked until the first key or click, as browsers require.

/** Creates the sound engine. Nothing sounds until unlock() runs inside a user gesture. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let engineFilter = null;
  let windGain = null;
  let windFilter = null;
  let beepOsc = null;
  let beepGain = null;
  let muted = false;
  let beepPhase = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // Engine: a saw and a square sub through one low-pass, pitch set by the throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = ctx.createOscillator();
    engineSub.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineSub.start();

    // Wind: looped white noise through a band-pass that opens with speed.
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    noise.start();

    // The stall beeper, gated in update().
    beepOsc = ctx.createOscillator();
    beepOsc.type = 'square';
    beepOsc.frequency.value = 920;
    beepGain = ctx.createGain();
    beepGain.gain.value = 0;
    beepOsc.connect(beepGain);
    beepGain.connect(master);
    beepOsc.start();
  }

  /** A short pitched blip with an envelope — the atom every one-shot is built from. */
  function blip(freqA, freqB, seconds, type, gain, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t0 + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  /** A burst of filtered noise — canvas for the crash, the drop clunk, tyre squeak. */
  function burst(seconds, freq, gain, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  return {
    unlock,

    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
    },

    isMuted() {
      return muted;
    },

    /** The continuous voices: engine note, wind and the stall beeper. */
    update(dt, plane) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const rpm = 0.25 + plane.throttle * 0.95 + plane.speed * 0.002;
      engineOsc.frequency.setTargetAtTime(38 + rpm * 62, t, 0.06);
      engineSub.frequency.setTargetAtTime(19 + rpm * 31, t, 0.06);
      engineFilter.frequency.setTargetAtTime(240 + rpm * 780, t, 0.08);
      engineGain.gain.setTargetAtTime(plane.dead ? 0 : 0.028 + plane.throttle * 0.075, t, 0.09);
      windFilter.frequency.setTargetAtTime(320 + plane.speed * 11, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.16, plane.speed * 0.0016) * (plane.onGround ? 0.3 : 1), t, 0.12);
      beepPhase += dt * 7;
      const beeping = plane.stalled && !plane.onGround && !plane.dead;
      beepGain.gain.setTargetAtTime(beeping && beepPhase % 1 < 0.55 ? 0.05 : 0, t, 0.015);
    },

    ring() {
      blip(1318, 1318, 0.14, 'sine', 0.16);
      blip(1760, 1760, 0.22, 'sine', 0.14, 0.09);
    },

    drop() {
      burst(0.12, 700, 0.2);
      blip(220, 130, 0.16, 'triangle', 0.12);
    },

    crateDown() {
      burst(0.2, 420, 0.22);
    },

    touchdown(grade) {
      burst(0.1, 2400, 0.1);
      if (grade === 'perfect') {
        blip(1046, 1046, 0.12, 'sine', 0.1, 0.05);
        blip(1568, 1568, 0.18, 'sine', 0.1, 0.16);
      }
    },

    takeoff() {
      blip(660, 990, 0.18, 'triangle', 0.08);
    },

    crash() {
      burst(0.7, 900, 0.5);
      blip(160, 38, 0.65, 'sawtooth', 0.3);
    },

    finish() {
      blip(784, 784, 0.14, 'triangle', 0.12);
      blip(988, 988, 0.14, 'triangle', 0.12, 0.13);
      blip(1318, 1318, 0.3, 'triangle', 0.13, 0.26);
    },
  };
}
