/*
 * SalvageAudio — self-contained Web Audio soundscape for a salvage tug.
 * Call start() directly from a pointer/key gesture, then update() each frame.
 * All synthesis is local; no downloads, dependencies, or autoplay attempts.
 */

const clamp = (value, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : lo));
const note = (midi) => 440 * 2 ** ((midi - 69) / 12);

export class SalvageAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.disposed = false;
    this._starting = null;
    this._nodes = [];
    this._voices = new Set();
    this._lastEvent = new Map();
    this._state = { thrust: 0, boost: false, tension: 0, danger: 0, speed: 0, paused: false };
  }

  async start() {
    if (this.disposed) return false;
    if (this._starting) return this._starting;
    this._starting = (async () => {
      try {
        if (!this.context) {
          const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!AudioContextClass) return false;
          this.context = new AudioContextClass({ latencyHint: 'interactive' });
          this._build();
        }
        if (this.context.state === 'suspended') await this.context.resume();
        this.update(this._state);
        return this.context.state === 'running';
      } catch (error) {
        // Audio remains optional if a browser/device rejects its initialization.
        this.lastError = error;
        return false;
      }
    })();
    try { return await this._starting; }
    finally { this._starting = null; }
  }

  _keep(node) { this._nodes.push(node); return node; }

  _gain(value, target) {
    const node = this._keep(this.context.createGain());
    node.gain.value = value;
    if (target) node.connect(target);
    return node;
  }

  _target(param, value, seconds = 0.08) {
    if (param && this.context && this.context.state !== 'closed') {
      param.setTargetAtTime(value, this.context.currentTime, seconds);
    }
  }

  _noiseBuffer(brown = false) {
    const c = this.context;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 2), c.sampleRate);
    const values = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < values.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        previous = (previous + 0.02 * white) / 1.02;
        values[i] = previous * 3.5;
      } else values[i] = white;
    }
    // A short crossfade makes the two-second noise loop seam unobtrusive.
    const fade = Math.min(512, values.length >> 2);
    for (let i = 0; i < fade; i++) {
      const mix = i / fade;
      values[values.length - fade + i] = values[values.length - fade + i] * (1 - mix) + values[i] * mix;
    }
    return buffer;
  }

  _tone(type, frequency, level, target, cutoff = null) {
    const osc = this._keep(this.context.createOscillator());
    const gain = this._gain(level, target);
    osc.type = type;
    osc.frequency.value = frequency;
    let filter = null;
    if (cutoff) {
      filter = this._keep(this.context.createBiquadFilter());
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.5;
      osc.connect(filter).connect(gain);
    } else osc.connect(gain);
    osc.start();
    return { osc, gain, filter };
  }

  _loopNoise(buffer, type, frequency, q, target) {
    const source = this._keep(this.context.createBufferSource());
    const filter = this._keep(this.context.createBiquadFilter());
    const gain = this._gain(0, target);
    source.buffer = buffer;
    source.loop = true;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    source.connect(filter).connect(gain);
    source.start(0, Math.random());
    return { source, filter, gain };
  }

  _build() {
    const c = this.context;
    this._white = this._noiseBuffer(false);
    this._brown = this._noiseBuffer(true);

    const compressor = this._keep(c.createDynamicsCompressor());
    compressor.threshold.value = -19;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    const limiter = this._keep(c.createDynamicsCompressor());
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.08;
    this._master = this._gain(0, compressor);
    compressor.connect(limiter).connect(c.destination);
    this._continuous = this._gain(1, this._master);
    this._effects = this._gain(0.86, this._master);
    this._outcomes = this._gain(0.86, this._master);
    this._engineBus = this._gain(1, this._continuous);
    this._musicBus = this._gain(1, this._continuous);

    // A small synthetic stereo room keeps the pad spacious and machinery dry.
    // Only a little event sound enters it, so repeated shots retain definition.
    if (c.createConvolver) {
      const room = this._keep(c.createConvolver());
      const impulse = c.createBuffer(2, Math.ceil(c.sampleRate * 1.9), c.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const values = impulse.getChannelData(channel);
        let smooth = 0;
        for (let i = 0; i < values.length; i++) {
          smooth = smooth * 0.56 + (Math.random() * 2 - 1) * 0.44;
          values[i] = smooth * (1 - i / values.length) ** 3.2;
        }
      }
      room.buffer = impulse;
      const wet = this._gain(0.20, this._continuous);
      room.connect(wet);
      this._musicBus.connect(room);
      const effectsSend = this._gain(0.085, room);
      this._effects.connect(effectsSend);
    }

    // Bass fundamentals, a softened mechanical harmonic, and filtered exhaust.
    this._bass = this._tone('sine', 43, 0, this._engineBus);
    this._body = this._tone('triangle', 86.5, 0, this._engineBus, 300);
    this._grit = this._tone('sawtooth', 43.3, 0, this._engineBus, 180);
    this._exhaust = this._loopNoise(this._white, 'lowpass', 450, 0.55, this._engineBus);
    this._rumble = this._loopNoise(this._brown, 'lowpass', 150, 0.6, this._engineBus);

    // Load sounds emerge only toward the taut end of the cable's range.
    this._strain = this._tone('triangle', 116, 0, this._engineBus, 440);
    this._strainNoise = this._loopNoise(this._brown, 'bandpass', 620, 2.2, this._engineBus);
    const flex = this._tone('sine', 2.3, 2.5, this._strain.osc.frequency);
    this._flex = flex;

    // Widely spaced D-minor/add-nine tones: a quiet, slowly breathing music bed.
    this._pads = [38, 45, 53, 64].map((midi, i) => {
      let destination = this._musicBus;
      if (c.createStereoPanner) {
        const pan = this._keep(c.createStereoPanner());
        pan.pan.value = [-0.55, 0.45, -0.3, 0.6][i];
        pan.connect(destination);
        destination = pan;
      }
      const tone = this._tone(i === 0 ? 'sine' : 'triangle', note(midi), 0, destination, 620);
      tone.osc.detune.value = [-3, 2, -4, 3][i];
      return tone;
    });
    this._dangerPad = this._tone('sine', note(51), 0, this._musicBus); // restrained E-flat tension
    this._musicStart = c.currentTime;
    this._target(this._master.gain, this.muted ? 0 : 0.58, 0.22);
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this._master) this._target(this._master.gain, this.muted ? 0 : 0.58, 0.05);
  }

  update(state = {}) {
    Object.assign(this._state, state);
    const c = this.context;
    if (!c || c.state === 'closed' || !this._bass || this.disposed) return;
    const thrust = clamp(this._state.thrust);
    const speed = clamp(this._state.speed);
    const tension = clamp(this._state.tension);
    const danger = clamp(this._state.danger);
    const boost = Boolean(this._state.boost);
    const paused = Boolean(this._state.paused);
    const load = Math.max(0, (tension - 0.48) / 0.52) ** 1.7;
    const drive = thrust * (boost ? 1.3 : 1);
    const fundamental = 42 + speed * 17 + drive * 13;
    this._target(this._continuous.gain, paused ? 0 : 1, paused ? 0.045 : 0.18);
    this._target(this._effects.gain, paused ? 0 : 0.86, 0.045);
    this._target(this._bass.osc.frequency, fundamental, 0.14);
    this._target(this._bass.gain.gain, 0.020 + drive * 0.092 + speed * 0.014, 0.09);
    this._target(this._body.osc.frequency, fundamental * 2.012, 0.14);
    this._target(this._body.gain.gain, 0.004 + drive * 0.025 + load * 0.007);
    this._target(this._body.filter.frequency, 190 + drive * 260 + speed * 100);
    this._target(this._grit.osc.frequency, fundamental * 1.008, 0.16);
    this._target(this._grit.gain.gain, drive * 0.008 + load * 0.006);
    this._target(this._grit.filter.frequency, 135 + drive * 260);
    this._target(this._exhaust.filter.frequency, 300 + drive * 1350 + speed * 180, 0.12);
    this._target(this._exhaust.gain.gain, drive * 0.058 + speed * 0.009, 0.1);
    this._target(this._rumble.gain.gain, 0.014 + drive * 0.075 + load * 0.022, 0.13);
    this._target(this._strain.osc.frequency, 102 + load * 40, 0.22);
    this._target(this._strain.gain.gain, load * 0.013, 0.22);
    this._target(this._strainNoise.gain.gain, load * 0.08, 0.22);
    this._target(this._strainNoise.filter.frequency, 480 + load * 480, 0.3);

    const time = c.currentTime - this._musicStart;
    this._pads.forEach((pad, i) => {
      const breath = 0.78 + 0.22 * Math.sin(time * (0.13 + i * 0.024) + i * 1.8);
      const base = [0.016, 0.010, 0.008, 0.006][i];
      this._target(pad.gain.gain, base * breath * (1 + danger * 0.12), 1.1);
      this._target(pad.filter.frequency, 450 + danger * 250, 1.7);
    });
    const slowPulse = 0.65 + 0.35 * Math.sin(time * (1.2 + danger * 0.7));
    this._target(this._dangerPad.gain.gain, danger ** 2 * 0.010 * slowPulse, 0.4);
  }

  _voice(pan, duration, outcome = false) {
    if (this._voices.size >= 28) this._cleanup(this._voices.values().next().value);
    const c = this.context;
    const output = c.createGain();
    output.gain.value = 1;
    const voice = { nodes: [output], sources: [], output, timer: null };
    const destination = outcome ? this._outcomes : this._effects;
    if (c.createStereoPanner) {
      const stereo = c.createStereoPanner();
      stereo.pan.value = clamp(pan, -1, 1) * 0.82;
      output.connect(stereo).connect(destination);
      voice.nodes.push(stereo);
    } else output.connect(destination);
    this._voices.add(voice);
    voice.timer = globalThis.setTimeout(() => this._cleanup(voice), (duration + 0.25) * 1000);
    return voice;
  }

  _cleanup(voice) {
    if (!voice || !this._voices.has(voice)) return;
    this._voices.delete(voice);
    if (voice.timer !== null) globalThis.clearTimeout(voice.timer);
    for (const source of voice.sources) { try { source.stop(); } catch {} }
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
  }

  _envelope(voice, peak, duration, delay = 0, attack = 0.003) {
    const c = this.context;
    const gain = c.createGain();
    const t = c.currentTime + delay;
    const a = Math.min(attack, duration * 0.3);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.00001, t + duration);
    gain.gain.setValueAtTime(0, t + duration + 0.01);
    gain.connect(voice.output);
    voice.nodes.push(gain);
    return { gain, t };
  }

  _hitTone(voice, type, from, to, peak, duration, delay = 0, cutoff = 0, attack = 0.003) {
    const c = this.context;
    const { gain, t } = this._envelope(voice, peak, duration, delay, attack);
    const source = c.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(from, t);
    source.frequency.exponentialRampToValueAtTime(Math.max(10, to), t + duration);
    if (cutoff) {
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.55;
      source.connect(filter).connect(gain);
      voice.nodes.push(filter);
    } else source.connect(gain);
    source.start(t);
    source.stop(t + duration + 0.025);
    voice.sources.push(source);
    voice.nodes.push(source);
  }

  _hitNoise(voice, type, frequency, peak, duration, delay = 0, q = 0.7, brown = false) {
    const c = this.context;
    const { gain, t } = this._envelope(voice, peak, duration, delay, 0.002);
    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    source.buffer = brown ? this._brown : this._white;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    source.connect(filter).connect(gain);
    source.start(t, Math.random() * 0.5);
    source.stop(t + duration + 0.025);
    voice.sources.push(source);
    voice.nodes.push(source, filter);
  }

  event(name, pan = 0) {
    const c = this.context;
    const outcome = name === 'win' || name === 'lose';
    if (!c || c.state !== 'running' || this.muted || this.disposed || (this._state.paused && !outcome)) return;
    const cooldown = { shot: 0.045, enemyShot: 0.06, hit: 0.065, cargoHit: 0.08, explosion: 0.13, warning: 3.8, boost: 0.8 }[name] ?? 0.14;
    if (c.currentTime - (this._lastEvent.get(name) ?? -Infinity) < cooldown) return;
    this._lastEvent.set(name, c.currentTime);
    const variance = 0.95 + Math.random() * 0.10;
    let v;
    switch (name) {
      case 'shot':
        v = this._voice(pan, 0.24);
        this._hitTone(v, 'triangle', 245 * variance, 70, 0.20, 0.13);
        this._hitTone(v, 'sawtooth', 660 * variance, 170, 0.035, 0.075, 0, 2100);
        this._hitNoise(v, 'bandpass', 2100, 0.14, 0.07, 0, 0.8);
        break;
      case 'enemyShot':
        v = this._voice(pan, 0.28);
        this._hitTone(v, 'triangle', 480 * variance, 95, 0.105, 0.20);
        this._hitTone(v, 'sine', 950 * variance, 250, 0.024, 0.12);
        this._hitNoise(v, 'bandpass', 1700, 0.065, 0.06);
        break;
      case 'hit':
        v = this._voice(pan, 0.48);
        this._hitNoise(v, 'lowpass', 1400, 0.25, 0.20);
        this._hitTone(v, 'sine', 150 * variance, 42, 0.24, 0.30);
        this._hitTone(v, 'triangle', 370 * variance, 155, 0.06, 0.17, 0, 1700);
        break;
      case 'cargoHit':
        v = this._voice(pan, 0.85);
        this._hitNoise(v, 'bandpass', 2100, 0.15, 0.10, 0, 0.6);
        this._hitTone(v, 'sine', 112 * variance, 49, 0.20, 0.38);
        [347, 581, 913].forEach((f, i) => this._hitTone(v, 'sine', f * variance, f * variance * 0.975, [0.065, 0.043, 0.023][i], 0.60 - i * 0.12, i * 0.009));
        break;
      case 'explosion':
        v = this._voice(pan, 1.7);
        this._hitNoise(v, 'lowpass', 1900, 0.34, 0.62);
        this._hitNoise(v, 'lowpass', 250, 0.46, 1.3, 0.015, 0.7, true);
        this._hitTone(v, 'sine', 130, 27, 0.40, 0.88);
        this._hitTone(v, 'triangle', 250, 48, 0.085, 0.40, 0.02, 1000);
        break;
      case 'attach':
        v = this._voice(pan, 0.75);
        this._hitNoise(v, 'bandpass', 1300, 0.12, 0.10);
        this._hitTone(v, 'triangle', 210, 78, 0.12, 0.16);
        this._hitTone(v, 'sine', note(69), note(69), 0.065, 0.32, 0.13, 0, 0.008);
        this._hitTone(v, 'sine', note(76), note(76), 0.055, 0.34, 0.25, 0, 0.008);
        break;
      case 'detach':
        v = this._voice(pan, 0.5);
        this._hitNoise(v, 'highpass', 700, 0.085, 0.14);
        this._hitTone(v, 'triangle', 240, 100, 0.07, 0.16);
        this._hitTone(v, 'sine', 490, 245, 0.045, 0.28, 0.065);
        break;
      case 'boost':
        v = this._voice(pan, 0.7);
        this._hitNoise(v, 'lowpass', 1700, 0.18, 0.50);
        this._hitTone(v, 'sine', 55, 105, 0.16, 0.45, 0, 0, 0.035);
        break;
      case 'warning':
        v = this._voice(pan, 0.8);
        this._hitTone(v, 'sine', note(65), note(65), 0.064, 0.22, 0, 0, 0.018);
        this._hitTone(v, 'sine', note(62), note(62), 0.048, 0.28, 0.25, 0, 0.018);
        break;
      case 'win':
        v = this._voice(pan, 2.9, true);
        [62, 65, 69, 74, 76].forEach((midi, i) => {
          this._hitTone(v, 'sine', note(midi), note(midi), 0.07, 1.65, i * 0.15, 0, 0.025);
          this._hitTone(v, 'triangle', note(midi) * 2, note(midi) * 2, 0.009, 1.15, i * 0.15, 1700, 0.025);
        });
        break;
      case 'lose':
        v = this._voice(pan, 2.3, true);
        [57, 53, 50, 38].forEach((midi, i) => this._hitTone(v, 'sine', note(midi), note(midi) * 0.994, 0.075, 1.4, i * 0.17, 0, 0.035));
        break;
      default: break;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of [...this._voices]) this._cleanup(voice);
    for (const node of this._nodes) {
      try { if (typeof node.stop === 'function') node.stop(); } catch {}
      try { node.disconnect(); } catch {}
    }
    this._nodes.length = 0;
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
  }
}

export default SalvageAudio;
