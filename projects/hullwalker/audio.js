/*
 * Hullwalker EVA audio — synthesized locally, with no downloaded sound assets.
 * Adapted from this project's SalvageAudio Web Audio voice/envelope machinery.
 * Sound perspective: inside the helmet, structure-borne boots and suit valves.
 * Call start() from the first user gesture (and subsequent resume gestures).
 * update({ attached, thrust, downThrust, braking, charge, speed, paused })
 * thrust/downThrust: actual 0..1 control effort; speed: movement magnitude.
 * event('step', leftOrRightPan), attach, detach, service, win, recall, rcs.
 */

const clamp = (v, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(Number(v)) ? Number(v) : low));
const note = midi => 440 * 2 ** ((midi - 69) / 12);

export class EVAAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.disposed = false;
    this.lastError = null;
    this._starting = null;
    this._nodes = [];
    this._voices = new Set();
    this._lastEvent = new Map();
    this._targets = new WeakMap();
    this._wasJet = false;
    this._state = { attached: true, thrust: 0, downThrust: 0, braking: false, charge: 0, speed: 0, paused: false };
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
        // Safari can use "interrupted" after a device/audio-session interruption.
        if (this.context.state === 'suspended' || this.context.state === 'interrupted') await this.context.resume();
        if (this.disposed || !this.context) return false;
        this.update(this._state);
        return this.context.state === 'running';
      } catch (error) {
        this.lastError = error;
        return false;
      }
    })();
    try { return await this._starting; }
    finally { this._starting = null; }
  }

  _keep(node) { this._nodes.push(node); return node; }

  _gain(level, destination) {
    const gain = this._keep(this.context.createGain());
    gain.gain.value = level;
    if (destination) gain.connect(destination);
    return gain;
  }

  _target(param, value, seconds = 0.08) {
    if (!param || !this.context || this.context.state === 'closed') return;
    const previous = this._targets.get(param);
    // Avoid adding identical automation events every animation frame.
    if (previous !== undefined && Math.abs(previous - value) < Math.max(0.000005, Math.abs(value) * 0.004)) return;
    this._targets.set(param, value);
    param.setTargetAtTime(value, this.context.currentTime, seconds);
  }

  _noiseBuffer(brown = false) {
    const c = this.context;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 3), c.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.025 * white) / 1.025;
      data[i] = brown ? last * 3.4 : white;
    }
    const fade = Math.min(512, data.length >> 2);
    for (let i = 0; i < fade; i++) {
      const f = i / fade;
      data[data.length - fade + i] = data[data.length - fade + i] * (1 - f) + data[i] * f;
    }
    return buffer;
  }

  _tone(type, frequency, destination, cutoff = 0) {
    const osc = this._keep(this.context.createOscillator());
    const gain = this._gain(0, destination);
    osc.type = type;
    osc.frequency.value = frequency;
    let filter;
    if (cutoff) {
      filter = this._keep(this.context.createBiquadFilter());
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      filter.Q.value = 0.55;
      osc.connect(filter).connect(gain);
    } else osc.connect(gain);
    osc.start();
    return { osc, gain, filter };
  }

  _noise(type, frequency, q, destination, brown = false) {
    const c = this.context;
    const source = this._keep(c.createBufferSource());
    const filter = this._keep(c.createBiquadFilter());
    const gain = this._gain(0, destination);
    source.buffer = brown ? this._brown : this._white;
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
    this._white = this._noiseBuffer();
    this._brown = this._noiseBuffer(true);
    const compressor = this._keep(c.createDynamicsCompressor());
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;
    const limiter = this._keep(c.createDynamicsCompressor());
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    this._master = this._gain(0, compressor);
    compressor.connect(limiter).connect(c.destination);
    this._active = this._gain(this._state.paused ? 0 : 1, this._master);
    this._ambience = this._gain(1, this._active);
    this._effects = this._gain(1, this._active);
    this._music = this._gain(1, this._ambience);

    // Music is the only spacious element. Suit/boot/RCS sounds remain close and dry.
    if (c.createConvolver) {
      const room = this._keep(c.createConvolver());
      const impulse = c.createBuffer(2, Math.ceil(c.sampleRate * 2.3), c.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        let smooth = 0;
        for (let i = 0; i < data.length; i++) {
          smooth = smooth * 0.75 + (Math.random() * 2 - 1) * 0.25;
          data[i] = smooth * (1 - i / data.length) ** 3;
        }
      }
      room.buffer = impulse;
      const send = this._gain(0.16, room);
      const wet = this._gain(0.45, this._ambience);
      this._music.connect(send);
      room.connect(wet);
    }

    this._vent = this._noise('bandpass', 440, 0.65, this._ambience);
    this._breath = this._noise('bandpass', 950, 0.8, this._ambience);
    this._breathBody = this._noise('lowpass', 230, 0.6, this._ambience, true);
    this._hull = this._noise('lowpass', 125, 0.6, this._ambience, true);
    this._hullTone = this._tone('sine', 57.6, this._ambience);
    this._jet = this._noise('bandpass', 1850, 0.58, this._ambience);
    this._jetBody = this._noise('lowpass', 520, 0.5, this._ambience);
    this._charge = this._tone('sine', 112, this._ambience);

    // Widely voiced D-add-nine, more air than melody, without a dramatic loop.
    this._pads = [38, 57, 64, 69].map((midi, i) => {
      let destination = this._music;
      if (c.createStereoPanner) {
        const pan = this._keep(c.createStereoPanner());
        pan.pan.value = [-0.35, 0.52, -0.62, 0.28][i];
        pan.connect(destination);
        destination = pan;
      }
      const tone = this._tone(i === 0 ? 'sine' : 'triangle', note(midi), destination, 800);
      tone.osc.detune.value = [-2, 2, -3, 3][i];
      return tone;
    });
    this._timeOrigin = c.currentTime;
    this._target(this._master.gain, this.muted ? 0 : 0.78, 0.15);
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this._master) this._target(this._master.gain, this.muted ? 0 : 0.78, 0.045);
  }

  update(state = {}) {
    Object.assign(this._state, state);
    const c = this.context;
    if (!c || c.state === 'closed' || !this._master || this.disposed) return;
    const s = this._state;
    const attached = Boolean(s.attached);
    const paused = Boolean(s.paused);
    const speed = clamp(s.speed, 0, 10);
    const thrust = attached ? 0 : clamp(s.thrust);
    const down = attached ? 0 : clamp(s.downThrust);
    // Brake only sounds while correcting actual motion; drifting alone is silent.
    const brake = !attached && s.braking ? clamp(speed * 1.5) : 0;
    const jet = Math.max(thrust * 0.78, down, brake * 0.85);
    const charge = attached ? clamp(s.charge) : 0;
    const t = c.currentTime - this._timeOrigin;
    this._target(this._active.gain, paused ? 0 : 1, paused ? 0.035 : 0.15);

    // Gentle natural inhale/exhale with a rest between breaths, not constant wind.
    const cycle = (t / 5.4) % 1;
    const inhale = cycle < 0.36 ? Math.sin(cycle / 0.36 * Math.PI) ** 1.4 : 0;
    const exhale = cycle >= 0.43 && cycle < 0.89 ? Math.sin((cycle - 0.43) / 0.46 * Math.PI) ** 1.8 : 0;
    this._target(this._vent.gain.gain, 0.008, 0.3);
    this._target(this._breath.gain.gain, inhale * 0.033 + exhale * 0.023, 0.07);
    this._target(this._breath.filter.frequency, 800 + inhale * 350 - exhale * 180, 0.12);
    this._target(this._breathBody.gain.gain, inhale * 0.012 + exhale * 0.019, 0.1);
    this._target(this._hull.gain.gain, attached ? 0.013 + clamp(speed / 3) * 0.008 : 0, 0.14);
    this._target(this._hullTone.gain.gain, attached ? 0.0028 : 0, 0.16);
    this._target(this._jet.gain.gain, jet * 0.12, jet ? 0.028 : 0.055);
    this._target(this._jetBody.gain.gain, jet * 0.039, 0.035);
    this._target(this._jet.filter.frequency, 1500 + down * 550 + thrust * 300, 0.07);
    this._target(this._charge.gain.gain, charge * 0.008, 0.05);
    this._target(this._charge.osc.frequency, 112 + charge * 65, 0.09);

    this._pads.forEach((pad, i) => {
      const swell = 0.73 + 0.27 * Math.sin(t * (0.12 + i * 0.027) + i * 1.7);
      this._target(pad.gain.gain, [0.009, 0.0042, 0.0037, 0.0027][i] * swell, 0.8);
    });
    const firing = !paused && jet > 0.07;
    if (firing && !this._wasJet) this.event('rcs');
    if (!firing && this._wasJet && !paused) this._valveClose();
    this._wasJet = firing;
  }

  _voice(pan, duration) {
    if (this._voices.size >= 24) this._cleanup(this._voices.values().next().value);
    const c = this.context;
    const output = c.createGain();
    const voice = { output, nodes: [output], sources: [], timer: null };
    if (c.createStereoPanner) {
      const stereo = c.createStereoPanner();
      stereo.pan.value = clamp(pan, -1, 1) * 0.65;
      output.connect(stereo).connect(this._effects);
      voice.nodes.push(stereo);
    } else output.connect(this._effects);
    this._voices.add(voice);
    voice.timer = globalThis.setTimeout(() => this._cleanup(voice), (duration + 0.3) * 1000);
    return voice;
  }

  _cleanup(voice) {
    if (!voice || !this._voices.has(voice)) return;
    this._voices.delete(voice);
    globalThis.clearTimeout(voice.timer);
    for (const source of voice.sources) { try { source.stop(); } catch {} }
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
  }

  _envelope(voice, peak, duration, delay = 0, attack = 0.003) {
    const c = this.context;
    const gain = c.createGain();
    const t = c.currentTime + delay;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + Math.min(attack, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.00001, t + duration);
    gain.gain.setValueAtTime(0, t + duration + 0.01);
    gain.connect(voice.output);
    voice.nodes.push(gain);
    return { gain, t };
  }

  _hitTone(v, type, from, to, peak, duration, delay = 0, cutoff = 0, attack = 0.003) {
    const c = this.context;
    const { gain, t } = this._envelope(v, peak, duration, delay, attack);
    const source = c.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(from, t);
    source.frequency.exponentialRampToValueAtTime(Math.max(10, to), t + duration);
    if (cutoff) {
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = cutoff; filter.Q.value = 0.5;
      source.connect(filter).connect(gain);
      v.nodes.push(filter);
    } else source.connect(gain);
    source.start(t); source.stop(t + duration + 0.025);
    v.sources.push(source); v.nodes.push(source);
  }

  _hitNoise(v, type, frequency, peak, duration, delay = 0, q = 0.7, brown = false) {
    const c = this.context;
    const { gain, t } = this._envelope(v, peak, duration, delay);
    const source = c.createBufferSource();
    const filter = c.createBiquadFilter();
    source.buffer = brown ? this._brown : this._white;
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    source.connect(filter).connect(gain);
    source.start(t, Math.random() * 0.8); source.stop(t + duration + 0.025);
    v.sources.push(source); v.nodes.push(source, filter);
  }

  _canPlay() {
    return this.context && this.context.state === 'running' && !this.disposed && !this.muted && !this._state.paused;
  }

  _valveClose() {
    if (!this._canPlay()) return;
    const v = this._voice(0.1, 0.12);
    this._hitTone(v, 'sine', 520, 300, 0.025, 0.035);
    this._hitNoise(v, 'bandpass', 1550, 0.045, 0.025, 0.013);
  }

  event(name, pan = 0) {
    if (!this._canPlay()) return;
    const c = this.context;
    const cooldown = { step: 0.15, attach: 0.25, detach: 0.18, service: 0.4, win: 2, recall: 0.4, rcs: 0.12 }[name];
    if (cooldown === undefined || c.currentTime - (this._lastEvent.get(name) ?? -Infinity) < cooldown) return;
    this._lastEvent.set(name, c.currentTime);
    const variance = 0.93 + Math.random() * 0.14;
    let v;
    switch (name) {
      case 'step':
        v = this._voice(pan, 0.46);
        // Soft weight/contact, damped plate resonance, second-stage magnetic catch.
        this._hitNoise(v, 'lowpass', 460, 0.15, 0.072);
        this._hitTone(v, 'sine', 143 * variance, 54 * variance, 0.155, 0.18);
        this._hitNoise(v, 'bandpass', 1250 * variance, 0.115, 0.045, 0.006);
        this._hitTone(v, 'sine', 325 * variance, 316 * variance, 0.032, 0.23, 0.012);
        this._hitTone(v, 'sine', 571 * variance, 568 * variance, 0.016, 0.13, 0.013);
        this._hitNoise(v, 'bandpass', 2250, 0.051, 0.027, 0.062);
        // Cloth/boot movement is quieter than the contact itself.
        this._hitNoise(v, 'bandpass', 770, 0.025, 0.17, 0.048);
        break;
      case 'attach':
        v = this._voice(pan, 0.82);
        this._hitTone(v, 'sine', 165, 43, 0.235, 0.32);
        this._hitNoise(v, 'lowpass', 920, 0.17, 0.13);
        this._hitTone(v, 'sine', 311, 302, 0.045, 0.40);
        this._hitTone(v, 'sine', 521, 510, 0.025, 0.25, 0.018);
        this._hitNoise(v, 'bandpass', 1800, 0.075, 0.035, 0.07);
        this._hitNoise(v, 'bandpass', 2100, 0.052, 0.026, 0.115);
        this._hitTone(v, 'sine', note(77), note(77), 0.029, 0.14, 0.19, 0, 0.008);
        break;
      case 'detach':
        v = this._voice(pan, 0.45);
        this._hitNoise(v, 'bandpass', 1500, 0.085, 0.033);
        this._hitNoise(v, 'bandpass', 1100, 0.062, 0.038, 0.038);
        this._hitTone(v, 'triangle', 184, 81, 0.052, 0.17, 0, 450);
        this._hitNoise(v, 'bandpass', 2000, 0.040, 0.19, 0.03);
        break;
      case 'rcs':
        v = this._voice(pan, 0.14);
        this._hitNoise(v, 'bandpass', 1600, 0.08, 0.028);
        this._hitTone(v, 'sine', 430, 260, 0.039, 0.042);
        this._hitNoise(v, 'bandpass', 2200, 0.04, 0.075, 0.015);
        break;
      case 'service':
        v = this._voice(pan, 0.65);
        this._hitNoise(v, 'bandpass', 1600, 0.048, 0.035);
        [74, 81].forEach((m, i) => this._hitTone(v, 'sine', note(m), note(m), 0.047, 0.23, 0.06 + i * 0.13, 0, 0.012));
        break;
      case 'win':
        v = this._voice(pan, 2.4);
        [62, 69, 74, 76].forEach((m, i) => {
          this._hitTone(v, 'sine', note(m), note(m), 0.061, 1.5, i * 0.16, 0, 0.035);
          this._hitTone(v, 'triangle', note(m) * 2, note(m) * 2, 0.008, 1.05, i * 0.16, 1600, 0.035);
        });
        break;
      case 'recall':
        v = this._voice(pan, 0.95);
        [69, 62, 74].forEach((m, i) => this._hitTone(v, 'sine', note(m), note(m), 0.046, 0.35, i * 0.17, 0, 0.014));
        this._hitNoise(v, 'bandpass', 1000, 0.034, 0.3, 0.16);
        break;
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
    this._white = this._brown = null;
    this._lastEvent.clear();
  }
}

export default EVAAudio;
