(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SiltControls = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
  const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < .001;

  function padButton(button) {
    return typeof button === 'number'
      ? clamp(button, 0, 1)
      : Math.max(button && button.pressed ? 1 : 0, clamp(button && button.value, 0, 1));
  }

  function stickVector(x, y, deadzone = .18) {
    x = clamp(x, -1, 1); y = clamp(y, -1, 1);
    const length = Math.hypot(x, y);
    if (length <= deadzone) return { x: 0, y: 0 };
    const scale = (Math.min(1, length) - deadzone) / (1 - deadzone) / length;
    return { x: x * scale, y: y * scale };
  }

  // This is the one malformed HID report Wayfarer found in the wild. Keep the
  // correction restricted to that browser, OS, device, report shape and data.
  function firefoxSN30Candidate(userAgent, pad) {
    return /\bFirefox\/\d/.test(userAgent) && /Macintosh|Mac OS X/.test(userAgent) &&
      !/FxiOS|iPhone|iPad|Android/.test(userAgent) && pad.mapping === '' &&
      /^2dc8-2101-8BitDo SN30 Pro for Android$/i.test(pad.id) && pad.axes.length === 7;
  }

  const encodedFirefoxAxis = value => Number.isInteger(value) && Math.abs(value) <= 65535 && Math.abs(value % 2) === 1;
  function hasFirefoxSN30Signature(axes) {
    const sticks = Array.from(axes).slice(1, 5);
    return sticks.length === 4 && sticks.every(value => value === 0 || encodedFirefoxAxis(value)) &&
      sticks.filter(value => Math.abs(value) > 1).length >= 2;
  }
  function decodeFirefoxSN30Axis(value) {
    if (!encodedFirefoxAxis(value)) return 0;
    const signed = (value - 1) / 2, unsigned = signed < 0 ? signed + 65536 : signed;
    return unsigned * 2 / 65535 - 1;
  }
  const firefoxSN30Axes = axes => Array.from(axes).slice(1, 5).map(decodeFirefoxSN30Axis);

  const FIREFOX_BUTTON_STEPS = [
    [0, 'A / bottom face button'], [1, 'B / right face button'],
    [2, 'X / left face button'], [3, 'Y / top face button'],
    [4, 'LB / left shoulder'], [5, 'RB / right shoulder'],
    [6, 'LT / left trigger'], [7, 'RT / right trigger'],
    [8, 'Select / View'], [9, 'Start / Menu'], [11, 'R3 / right stick click'],
    [12, 'D-pad up'], [13, 'D-pad down'], [14, 'D-pad left'], [15, 'D-pad right']
  ];
  const firefoxButtonKey = sample => `${sample.id}:${sample.rawAxes.length}:${sample.values.length}`;
  const sameSource = (a, b) => a && b && a.kind === b.kind && a.index === b.index &&
    (a.kind === 'button' || a.index !== 0 || close(a.pressed, b.pressed));

  function validFirefoxButtons(profile, sample) {
    if (!profile || profile.version !== 1 || profile.key !== firefoxButtonKey(sample) ||
      !Array.isArray(profile.bindings) || profile.bindings.length !== 17) return false;
    const used = [];
    for (const [slot] of FIREFOX_BUTTON_STEPS) {
      const binding = profile.bindings[slot];
      if (!binding || !Number.isInteger(binding.index) || binding.index < 0) return false;
      if (binding.kind === 'button') {
        if (binding.index >= sample.values.length) return false;
      } else if (binding.kind === 'axis') {
        if (!(slot >= 12 ? binding.index === 0 : (slot === 6 || slot === 7) && [5, 6].includes(binding.index))) return false;
        if (binding.index >= sample.rawAxes.length || !Number.isFinite(binding.rest) ||
          !Number.isFinite(binding.pressed) || Math.abs(binding.pressed - binding.rest) < .1) return false;
      } else return false;
      if (used.some(item => sameSource(item, binding))) return false;
      used.push(binding);
    }
    return profile.bindings[10] === null && profile.bindings[16] === null;
  }

  function mappedFirefoxButtons(profile, sample) {
    const out = Array(17).fill(0);
    for (const [slot] of FIREFOX_BUTTON_STEPS) {
      const binding = profile.bindings[slot];
      if (binding.kind === 'button') out[slot] = clamp(sample.values[binding.index], 0, 1);
      else if (binding.index === 0) out[slot] = close(sample.rawAxes[0], binding.pressed) ? 1 : 0;
      else out[slot] = clamp((sample.rawAxes[binding.index] - binding.rest) / (binding.pressed - binding.rest), 0, 1);
    }
    return out;
  }

  class FirefoxButtonSetup {
    constructor(sample) {
      this.key = firefoxButtonKey(sample); this.deviceIndex = sample.index; this.step = 0;
      this.bindings = Array(17).fill(null); this.baseline = this.snapshot(sample);
      this.phase = 'arming'; this.message = 'Release every button to begin.';
      this.candidate = null; this.stableSince = null; this.done = false; this.lost = false;
    }
    snapshot(sample) { return { values: sample.values.slice(), rawAxes: sample.rawAxes.slice() }; }
    get label() { return (FIREFOX_BUTTON_STEPS[this.step] || [0, 'Complete'])[1]; }
    update(sample, now) {
      if (this.done || this.lost) return;
      if (!sample.id || sample.index !== this.deviceIndex || firefoxButtonKey(sample) !== this.key) {
        this.lost = true; this.message = 'Controller changed or disconnected. Start setup again.'; return;
      }
      const slot = FIREFOX_BUTTON_STEPS[this.step][0];
      const down = sample.values.flatMap((value, index) => value > .5 ? [index] : []);
      if (this.phase === 'arming') {
        if (!sample.values.some(value => value > .25)) {
          this.baseline = this.snapshot(sample); this.phase = 'waiting'; this.message = '';
        }
        return;
      }
      if (this.phase === 'retry') {
        if (!down.length && (!this.candidate || this.released(sample))) {
          this.phase = 'waiting'; this.candidate = null; this.baseline = this.snapshot(sample);
        }
        return;
      }
      if (this.phase === 'waiting') {
        const axisIndices = slot >= 12 ? [0] : (slot === 6 || slot === 7 ? [5, 6] : []);
        const moved = axisIndices.filter(index => Number.isFinite(sample.rawAxes[index]) &&
          Math.abs(sample.rawAxes[index] - this.baseline.rawAxes[index]) > .35);
        if (down.length > 1 || (!down.length && moved.length > 1)) {
          this.message = `Press only ${this.label}, then release it.`; this.phase = 'retry'; return;
        }
        const candidate = down.length === 1
          ? { kind: 'button', index: down[0] }
          : moved.length === 1
            ? { kind: 'axis', index: moved[0], rest: this.baseline.rawAxes[moved[0]], pressed: sample.rawAxes[moved[0]] }
            : null;
        if (!candidate) return;
        this.candidate = candidate;
        if (this.bindings.some(binding => sameSource(binding, candidate))) {
          this.message = `That input is already assigned. Release it and try ${this.label}.`;
          this.phase = 'retry'; return;
        }
        this.phase = 'holding'; this.message = `Release ${this.label}.`; this.stableSince = null;
      }
      if (this.phase === 'holding') {
        const binding = this.candidate;
        if (binding.kind === 'axis' && binding.index !== 0 &&
          (sample.rawAxes[binding.index] - binding.rest) * (binding.pressed - binding.rest) > 0 &&
          Math.abs(sample.rawAxes[binding.index] - binding.rest) > Math.abs(binding.pressed - binding.rest)) {
          binding.pressed = sample.rawAxes[binding.index];
        }
        if (this.released(sample)) {
          if (this.stableSince === null) this.stableSince = now;
          if (now - this.stableSince >= 180) this.finishStep(sample);
        } else this.stableSince = null;
      }
    }
    released(sample) {
      if (sample.values.some(value => value > .25)) return false;
      const binding = this.candidate;
      return !binding || binding.kind === 'button' || close(sample.rawAxes[binding.index], binding.rest);
    }
    confirmRelease(sample) {
      if (this.phase !== 'holding' || !this.candidate || !sample.id ||
        firefoxButtonKey(sample) !== this.key || sample.index !== this.deviceIndex) return;
      const binding = this.candidate;
      if (sample.values.some(value => value > .25)) { this.message = 'Release all buttons first.'; return; }
      if (binding.kind === 'axis') {
        const rest = sample.rawAxes[binding.index];
        if (!Number.isFinite(rest) || Math.abs(rest - binding.pressed) < .1) {
          this.message = `Release ${this.label} first.`; return;
        }
        binding.rest = rest;
      }
      this.finishStep(sample);
    }
    finishStep(sample) {
      this.bindings[FIREFOX_BUTTON_STEPS[this.step][0]] = { ...this.candidate };
      this.step++; this.candidate = null; this.stableSince = null;
      this.baseline = this.snapshot(sample); this.phase = 'waiting'; this.message = '';
      this.done = this.step === FIREFOX_BUTTON_STEPS.length;
    }
    get profile() { return this.done ? { version: 1, key: this.key, bindings: this.bindings } : null; }
  }

  const identity = pad => `${pad.index}:${pad.id}:${pad.mapping}:${pad.axes.length}:${pad.buttons.length}`;
  class GamepadInput {
    constructor(userAgent = (root.navigator && root.navigator.userAgent) || '') {
      this.userAgent = userAgent; this.active = null; this.activePad = null;
      this.history = new Map(); this.focused = false; this.allowRaw = new Set();
      this.firefoxProfiles = new Map(); this.setupIndex = null;
      this.status = { kind: 'waiting', count: 0 };
    }
    suspend() { this.focused = false; }
    disconnect(index) {
      for (const [key, state] of this.history) if (state.index === index) this.history.delete(key);
      if (this.status.index === index) { this.active = null; this.activePad = null; }
    }
    useRaw(id, on) { on ? this.allowRaw.add(id) : this.allowRaw.delete(id); this.suspend(); }
    setFirefoxProfile(profile) { this.firefoxProfiles.set(profile.key, profile); this.suspend(); }
    startSetup(index) { this.setupIndex = index; this.suspend(); }
    endSetup() { this.setupIndex = null; this.suspend(); }
    rumble(strong = .18, weak = .35, duration = 55) {
      const actuator = this.activePad && (this.activePad.vibrationActuator ||
        (this.activePad.hapticActuators && this.activePad.hapticActuators[0]));
      if (!actuator || typeof actuator.playEffect !== 'function') return;
      try { Promise.resolve(actuator.playEffect('dual-rumble', {
        duration, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1)
      })).catch(function () {}); } catch (_) {}
    }
    poll(read, focused = true) {
      let pads;
      try {
        if (typeof read !== 'function') { this.status = { kind: 'unavailable', count: 0 }; this.suspend(); return null; }
        pads = Array.from(read() || []).filter(pad => pad && pad.connected);
      } catch (error) {
        this.status = { kind: error && error.name === 'SecurityError' ? 'blocked' : 'unavailable', count: 0 };
        this.suspend(); return null;
      }
      const seen = new Set(), samples = [];
      for (const pad of pads) {
        const key = identity(pad), old = this.history.get(key);
        const firefoxCandidate = firefoxSN30Candidate(this.userAgent, pad);
        const firefoxSN30 = firefoxCandidate && !!((old && old.firefoxSN30) || hasFirefoxSN30Signature(pad.axes));
        const awaitingFirefox = firefoxCandidate && !firefoxSN30 && Array.from(pad.axes).slice(1, 5)
          .some(value => !Number.isFinite(value) || Math.abs(value) > 1);
        const axes = firefoxSN30 ? firefoxSN30Axes(pad.axes)
          : awaitingFirefox ? [0, 0, 0, 0]
            : Array.from(pad.axes, value => clamp(value, -1, 1));
        const rawValues = Array.from(pad.buttons, padButton);
        const rawSample = { id: pad.id, rawAxes: Array.from(pad.axes), values: rawValues };
        const profile = firefoxCandidate ? this.firefoxProfiles.get(firefoxButtonKey(rawSample)) : null;
        const firefoxMapped = !!(profile && validFirefoxButtons(profile, rawSample));
        const values = firefoxCandidate
          ? (firefoxMapped ? mappedFirefoxButtons(profile, rawSample) : Array(17).fill(0))
          : rawValues;
        const held = values.map(value => value > .25);
        const blocked = !old || !this.focused || !focused
          ? held.slice()
          : held.map((value, index) => value && old.blocked[index]);
        const buttons = held.map((value, index) => value && !blocked[index]);
        const edges = buttons.map((value, index) => value && !(old && old.buttons[index]));
        const standard = pad.mapping === 'standard' || firefoxSN30 || firefoxMapped ||
          (!firefoxCandidate && this.allowRaw.has(pad.id));
        const meaningfulAxis = standard && axes.slice(0, 4).some((value, index) =>
          Math.abs(value) > .25 && (Math.abs((old && old.axes[index]) || 0) <= .25 ||
            Math.abs(value - ((old && old.axes[index]) || 0)) > .12));
        const intent = focused && (edges.some(Boolean) || meaningfulAxis);
        const left = stickVector(axes[0], axes[1]), right = stickVector(axes[2], axes[3]);
        const navX = left.x < -.65 ? -1 : left.x > .65 ? 1 : 0;
        const navY = left.y < -.65 ? -1 : left.y > .65 ? 1 : 0;
        const sample = { pad, key, axes, values, rawValues, buttons, edges, standard, intent,
          left, right, navX, navY, firefoxSN30, firefoxCandidate, firefoxMapped };
        samples.push(sample); seen.add(key);
        this.history.set(key, { index: pad.index, axes, buttons, blocked, navX, navY, firefoxSN30 });
      }
      for (const key of this.history.keys()) if (!seen.has(key)) this.history.delete(key);
      const selected = this.setupIndex !== null
        ? samples.find(sample => sample.pad.index === this.setupIndex)
        : samples.find(sample => sample.intent && sample.key !== this.active) ||
          samples.find(sample => sample.key === this.active) ||
          samples.find(sample => sample.standard) || samples[0];
      this.focused = focused;
      if (!selected) {
        this.active = null; this.activePad = null; this.status = { kind: 'waiting', count: 0 }; return null;
      }
      const old = this.history.get(selected.key);
      // old now contains this frame; recover prior nav intent from a private cache.
      const priorNav = selected.priorNav || this._navByKey && this._navByKey.get(selected.key) || { x: 0, y: 0 };
      if (!this._navByKey) this._navByKey = new Map();
      this._navByKey.set(selected.key, { x: selected.navX, y: selected.navY });
      const { pad, key, axes, rawValues, buttons, edges, standard, intent,
        left, right, navX, navY, firefoxSN30, firefoxCandidate, firefoxMapped } = selected;
      this.active = key; this.activePad = pad;
      this.status = { kind: standard ? 'connected' : 'unmapped', count: pads.length,
        id: pad.id, index: pad.index, mapping: pad.mapping || 'unrecognized',
        raw: !firefoxCandidate && this.allowRaw.has(pad.id), axes,
        rawAxes: Array.from(pad.axes), values: rawValues,
        firefoxSN30, firefoxCandidate, firefoxMapped };
      if (!focused || !standard || this.setupIndex !== null) return null;
      return {
        move: left, aim: right, buttons, edges, intent,
        active: !!(left.x || left.y || right.x || right.y || buttons.some(Boolean)),
        fire: !!buttons[7], sprint: !!buttons[6],
        use: !!edges[0], cancel: !!edges[1], reload: !!edges[2], swap: !!edges[3],
        pack: !!edges[8], pause: !!edges[9],
        navLeft: !!edges[14] || (navX < 0 && priorNav.x >= 0),
        navRight: !!edges[15] || (navX > 0 && priorNav.x <= 0),
        navUp: !!edges[12] || (navY < 0 && priorNav.y >= 0),
        navDown: !!edges[13] || (navY > 0 && priorNav.y <= 0)
      };
    }
  }

  return {
    padButton, stickVector, firefoxSN30Candidate, hasFirefoxSN30Signature,
    decodeFirefoxSN30Axis, firefoxSN30Axes, FIREFOX_BUTTON_STEPS,
    firefoxButtonKey, validFirefoxButtons, mappedFirefoxButtons,
    FirefoxButtonSetup, GamepadInput
  };
});
