(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const TAU = Math.PI * 2;
  const SAVE_KEY = 'silt-and-signal-save-v1';
  const CONTROL_LAYOUT_KEY = 'silt-controller-layouts-v1';
  const FIREFOX_PROFILE_KEY = 'silt-firefox-buttons-v1';
  const { GamepadInput, FirefoxButtonSetup, FIREFOX_BUTTON_STEPS } = window.SiltControls;
  const COLORS = {
    ink: '#17151f', void: '#0b1012', plum: '#30243a', plum2: '#46324c',
    paper: '#eee4c6', paperDim: '#b8ae91', teal: '#3b8179', tealBright: '#69a79a',
    olive: '#68745c', oliveDark: '#3b4338', silt: '#6b5b45', siltDark: '#40382f',
    rust: '#c45e3f', amber: '#e4aa45', hazard: '#b6d64a', blood: '#bd4059',
    water: '#2b5959', concrete: '#76766c', steel: '#51605c', white: '#fff8df'
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const lerpAngle = (a, b, t) => a + angleDelta(a, b) * clamp(t, 0, 1);
  const expEase = (rate, dt) => 1 - Math.exp(-rate * dt);
  const pointSegmentDistance = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  };
  const hash = (x, y, seed = 1) => {
    let n = Math.imul((x | 0) ^ Math.imul(y | 0, 374761393), 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };

  class RNG {
    constructor(seed) { this.s = seed >>> 0 || 1; }
    next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(a) { return a[Math.floor(this.next() * a.length)]; }
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  }

  const ITEMS = {
    parts: { name: 'Machine parts', short: 'PARTS', use: 'Repairs and shelter upgrades', stack: 3, weight: 1 },
    cloth: { name: 'Dry cloth', short: 'CLOTH', use: 'Bandages, filters, weatherproofing', stack: 3, weight: .5 },
    medicine: { name: 'Sealed medicine', short: 'MEDICINE', use: 'Use now or bank for the clinic', stack: 2, weight: .4, usable: true },
    cleanwater: { name: 'Clean water', short: 'CLEAN WATER', use: 'Reduces exposure and restores breath', stack: 2, weight: 1.2, usable: true },
    bandage: { name: 'Field bandage', short: 'BANDAGE', use: 'Stops bleeding and restores body', stack: 2, weight: .2, usable: true },
    regulator: { name: 'Pressure regulator', short: 'REGULATOR', use: 'Waterworks objective · heavy', stack: 1, weight: 4, quest: true },
    shotgun: { name: 'Break-action shotgun', short: '12-GAUGE', use: 'A loud, decisive close-range tool', stack: 1, weight: 3.5, weapon: 'shotgun' },
    carbine: { name: 'Patrol carbine', short: 'CARBINE', use: 'Controllable fire at middle distance', stack: 1, weight: 3, weapon: 'carbine' }
  };

  const WEAPONS = {
    prybar: { name: 'PRY BAR', ammo: null, mag: 0, delay: .48, damage: 34, range: 68, length: 42, turn: 8.4, sound: .35, condition: 'SOLID STEEL', melee: true },
    revolver: { name: '.22 SERVICE REVOLVER', ammo: 'ammo22', mag: 6, delay: .32, damage: 27, range: 650, speed: 1050, spread: .024, reload: 1.75, sound: .66, length: 30, turn: 13, recoil: 5.5, color: COLORS.amber },
    shotgun: { name: 'BREAK-ACTION 12-GAUGE', ammo: 'shells', mag: 2, delay: .72, damage: 14, pellets: 7, range: 330, speed: 920, spread: .17, reload: 2.35, sound: 1, length: 57, turn: 7.2, recoil: 13, color: COLORS.rust },
    carbine: { name: 'PATROL CARBINE', ammo: 'carbineAmmo', mag: 12, delay: .145, damage: 21, range: 700, speed: 1200, spread: .042, reload: 2.05, sound: .86, length: 55, turn: 8.8, recoil: 7.5, color: COLORS.tealBright }
  };

  const defaultSave = () => ({
    version: 1, day: 1, minutes: 490, prologueDone: false,
    prologue: { satchel: false, fuse: false, cloth: false },
    contractAccepted: false, regulatorBanked: false, finalChoice: null,
    campLevel: 1, packSize: 4, upgrades: { bag: false, cape: false, survey: false, medroll: false },
    stash: { parts: 1, cloth: 0, medicine: 1, cleanwater: 1, bandage: 0, ammo22: 0, shells: 0, carbineAmmo: 0 },
    prepared: { bandage: false, medicine: false, cleanwater: false },
    weapons: { revolver: false, shotgun: false, carbine: false },
    condition: { revolver: 84, shotgun: 72, carbine: 68 },
    selectedLong: null,
    skills: { marksmanship: 0, fieldcraft: 0, mechanics: 0, nerve: 0 },
    runs: 0, extractions: 0, deaths: 0, sound: true
  });

  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!raw || raw.version !== 1) return defaultSave();
      const base = defaultSave();
      return Object.assign(base, raw, {
        prologue: Object.assign(base.prologue, raw.prologue || {}),
        upgrades: Object.assign(base.upgrades, raw.upgrades || {}),
        stash: Object.assign(base.stash, raw.stash || {}),
        prepared: Object.assign(base.prepared, raw.prepared || {}),
        weapons: Object.assign(base.weapons, raw.weapons || {}),
        condition: Object.assign(base.condition, raw.condition || {}),
        skills: Object.assign(base.skills, raw.skills || {})
      });
    } catch (_) { return defaultSave(); }
  }

  let save = loadSave();
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {} refreshTitle(); };

  const G = {
    w: innerWidth, h: innerHeight, dpr: 1, time: 0, dt: 0, last: 0,
    mode: 'title', area: null, player: null, camera: { x: 0, y: 0, zoom: 1, shake: 0, shakeX: 0, shakeY: 0 },
    bullets: [], particles: [], decals: [], soundMarks: [], nearest: null,
    lowland: null, returnPos: null, transition: 0, transitionTask: null,
    panel: null, screen: 'title-screen', toastTimer: 0, weather: 0, seed: 1, runActive: false,
    touch: matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  };

  const input = {
    keys: new Set(), pressed: new Set(), mouse: { x: innerWidth / 2, y: innerHeight / 2, down: false, active: false },
    moveStick: { x: 0, y: 0 }, aimStick: { x: 0, y: 0 }, touchFire: false,
    pad: null, actions: new Set(), device: G.touch ? 'touch' : 'keyboard',
    moveOwner: G.touch ? 'touch' : 'keyboard', aimOwner: 'move',
    press(code) { return this.pressed.has(code); },
    queue(action, device = this.device) { this.actions.add(action); setInputDevice(device); },
    consume(action) { const on = this.actions.has(action); this.actions.delete(action); return on; },
    clearFrame() { this.pressed.clear(); }
  };
  const controller = new GamepadInput();
  let buttonSetup = null, buttonSetupNote = '', pauseReturn = null, lastControllerUI = 0;
  try {
    const profiles = JSON.parse(localStorage.getItem(FIREFOX_PROFILE_KEY) || '[]');
    if (Array.isArray(profiles)) for (const profile of profiles.slice(0, 16))
      if (profile && typeof profile.key === 'string') controller.firefoxProfiles.set(profile.key, profile);
  } catch (_) {}
  try {
    const ids = JSON.parse(localStorage.getItem(CONTROL_LAYOUT_KEY) || '[]');
    if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') controller.allowRaw.add(id);
  } catch (_) {}

  class SoundEngine {
    constructor() { this.ctx = null; this.master = null; this.noise = null; this.lastStep = 0; }
    unlock() {
      if (!save.sound) return;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = .34; this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate * .45, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    suspend() { if (this.ctx && this.ctx.state === 'running') try { Promise.resolve(this.ctx.suspend()).catch(() => {}); } catch (_) {} }
    panNode(x = null) {
      if (!this.ctx || !this.master) return null;
      if (x == null || !this.ctx.createStereoPanner || !G.player) return this.master;
      const p = this.ctx.createStereoPanner(); p.pan.value = clamp((x - G.player.x) / 650, -1, 1); p.connect(this.master); return p;
    }
    tone(freq, dur, type = 'sine', vol = .12, slide = 1, x = null) {
      if (!save.sound) return; this.unlock(); if (!this.ctx) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(25, freq * slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(this.panNode(x)); o.start(t); o.stop(t + dur + .02);
    }
    burst(dur = .12, vol = .2, cutoff = 900, x = null) {
      if (!save.sound) return; this.unlock(); if (!this.ctx || !this.noise) return;
      const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      s.buffer = this.noise; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.panNode(x)); s.start(t); s.stop(t + dur + .02);
    }
    gun(key, x) {
      if (key === 'revolver') { this.burst(.13, .24, 1250, x); this.tone(118, .16, 'square', .09, .48, x); }
      if (key === 'shotgun') { this.burst(.24, .38, 880, x); this.tone(78, .28, 'sawtooth', .13, .36, x); }
      if (key === 'carbine') { this.burst(.09, .21, 1700, x); this.tone(150, .1, 'square', .07, .62, x); }
    }
    pickup() { this.tone(420, .07, 'sine', .06, 1.6); setTimeout(() => this.tone(670, .09, 'sine', .05, 1.3), 45); }
    ui() { this.tone(280, .045, 'square', .035, 1.2); }
    hurt() { this.burst(.16, .14, 420); this.tone(90, .18, 'sawtooth', .07, .65); }
    reload(x) { this.burst(.035, .045, 2600, x); }
    step(surface, x, heavy = false) {
      if (G.time - this.lastStep < .12) return; this.lastStep = G.time;
      const profile = {
        water: [.065, .038, 920, 92], concrete: [.032, .03, 1850, 146],
        metal: [.026, .025, 2600, 310], road: [.04, .027, 780, 116],
        grass: [.05, .022, 430, 82], silt: [.055, .028, 560, 74]
      }[surface] || [.045, .024, 520, 86];
      this.burst(profile[0], profile[1] * (heavy ? 1.35 : 1), profile[2], x);
      this.tone(profile[3], .045, surface === 'metal' ? 'triangle' : 'sine', .018 * (heavy ? 1.25 : 1), .72, x);
    }
    melee(kind, x) {
      if (kind === 'swing') { this.burst(.07, .055, 1200, x); this.tone(132, .08, 'triangle', .025, .62, x); }
      else if (kind === 'metal') { this.burst(.08, .11, 2800, x); this.tone(420, .13, 'square', .035, .42, x); }
      else if (kind === 'body') { this.burst(.1, .12, 540, x); this.tone(88, .12, 'sine', .04, .5, x); }
    }
  }
  const sound = new SoundEngine();

  function setInputDevice(device, aim = false) {
    if (!['keyboard','mouse','touch','gamepad'].includes(device)) return;
    const changed = input.device !== device; input.device = device;
    document.body.classList.toggle('input-gamepad', device === 'gamepad');
    document.body.dataset.input = device;
    if (aim) input.aimOwner = device;
    if (changed && device === 'gamepad' && G.mode === 'play') toast('CONTROLLER READY · RT ATTACK · LT SPRINT', 1.8);
  }

  function refreshTitle() {
    let has=false;try{has=!!localStorage.getItem(SAVE_KEY);}catch(_){}
    $('continue-btn').classList.toggle('hidden', !has);
    $('continue-detail').textContent = has ? `DAY ${String(save.day).padStart(2, '0')} · ${save.extractions} SAFE RETURNS` : '';
    $('new-btn').textContent = has ? 'NEW SURVIVOR · RESET' : 'NEW SURVIVOR';
    $('sound-btn').textContent = save.sound ? 'SOUND ON' : 'SOUND OFF';
    $('sound-btn').setAttribute('aria-pressed', String(save.sound));
  }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(n => n.classList.remove('active'));
    if (id) $(id).classList.add('active');
    G.screen = id;
  }
  function setPlayUI(on) {
    $('hud').classList.toggle('hidden', !on);
    $('weapon-hud').classList.toggle('hidden', !on);
    $('pause-btn').classList.toggle('hidden', !on);
    $('touch-ui').classList.toggle('hidden', !(on && G.touch));
  }
  function toast(message, seconds = 2.5) {
    const el = $('toast'); el.textContent = message; el.classList.remove('hidden'); G.toastTimer = seconds;
  }
  function formatTime() {
    const m = Math.floor(save.minutes % 1440), h = Math.floor(m / 60), min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  function skillLevel(key) { return Math.min(4, Math.floor(Math.sqrt(save.skills[key] || 0) / 2.2)); }

  function makePlayer(x, y, camp = false) {
    const unlocked = save.weapons.revolver ? ['revolver','prybar'] : ['prybar'];
    if (save.weapons.shotgun && save.selectedLong === 'shotgun') unlocked.push('shotgun');
    if (save.weapons.carbine && save.selectedLong === 'carbine') unlocked.push('carbine');
    return {
      x, y, vx: 0, vy: 0, r: 16, angle: 0, hp: 100, maxHp: 100, stamina: 100,
      exposure: 0, bleeding: 0, inventory: camp ? [] : [], cap: save.packSize,
      weaponList: unlocked, weaponIndex: 0, mags: { revolver: 0, shotgun: 0, carbine: 0 },
      ammo: { ammo22: 0, shells: 0, carbineAmmo: 0 }, cooldown: 0, reload: 0,
      reloadingWeapon: null, invuln: 0, step: 0, stepDistance: 0, stepSide: 1, camp, alive: true, noise: 0, runValue: 0, maxDistance: 0,
      secure: ['bandage'], lastAimSource: 'move', aimAngle: 0, bodyAngle: 0, weaponAngle: 0,
      recoil: 0, recoilV: 0, moveLean: 0, settle: 0, obstruction: 0, wallObstruction: false,
      meleeTime: 0, meleeHit: false, meleeHeading: 0, lastSurface: 'silt'
    };
  }

  const rect = (type, x, y, w, h, extra = {}) => Object.assign({ type, x, y, w, h, solid: false, active: true }, extra);
  const circle = (type, x, y, r, extra = {}) => Object.assign({ type, x, y, r, solid: false, active: true }, extra);
  const path = (points, width, kind = 'road') => ({ points, width, kind });

  function scatterPlants(area, rng, count, bounds, avoid = []) {
    for (let i = 0; i < count; i++) {
      let x, y, tries = 0;
      do { x = rng.range(bounds.x, bounds.x + bounds.w); y = rng.range(bounds.y, bounds.y + bounds.h); tries++; }
      while (tries < 10 && avoid.some(a => Math.hypot(x - a.x, y - a.y) < (a.r || 170)));
      const roll = rng.next();
      area.decor.push(circle(roll < .34 ? 'fern' : roll < .54 ? 'aster' : roll < .77 ? 'grass' : 'deadgrass', x, y, rng.range(9, 22), { seed: rng.int(1, 99999), z: y }));
    }
  }

  function addTree(area, x, y, r, seed) {
    area.objects.push(circle('tree', x, y, r, { solid: true, seed, z: y + r * .65 }));
  }
  function addRock(area, x, y, r, seed) {
    area.objects.push(circle('rock', x, y, r, { solid: true, seed, z: y + r * .5 }));
  }
  function spawnClear(area,x,y,r=18){return x>r&&y>r&&x<area.w-r&&y<area.h-r&&!area.objects.some(o=>o.active&&(o.solid||o.interact)&&pointInObject(x,y,o,r+(o.interact?12:0)));}

  function makePrologue() {
    const area = { kind: 'prologue', name: 'DROWNED MILE', w: 1500, h: 900, bg: '#33382f', objects: [], decor: [], paths: [], enemies: [], zones: [], notes: [], lights: [] };
    area.paths.push(path([{x:0,y:515},{x:420,y:500},{x:780,y:450},{x:1500,y:470}], 105, 'oldroad'));
    area.paths.push(path([{x:430,y:500},{x:610,y:330},{x:780,y:275}], 25, 'trail'));
    area.paths.push(path([{x:760,y:465},{x:855,y:640}], 22, 'trail'));
    area.paths.push(path([{x:900,y:470},{x:1160,y:445}], 30, 'trail'));
    [[505,430],[590,355],[675,305],[735,280]].forEach((p,i)=>area.objects.push(circle('surveystake',p[0],p[1],4,{z:p[1]+12,seed:i})));
    area.objects.push(rect('wreckbus', 300, 470, 220, 86, { solid: true, interact: 'prologue_satchel', label: save.prologue.satchel ? 'EMPTY WRECK' : 'SEARCH THE WRECK', z: 545 }));
    area.objects.push(circle('utilitypole', 760, 278, 25, { solid: true, interact: 'prologue_fuse', label: save.prologue.fuse ? 'STRIPPED RELAY' : 'REMOVE CERAMIC FUSE', z: 300 }));
    area.objects.push(rect('fieldbag', 846, 620, 52, 34, { interact: 'prologue_cloth', label: save.prologue.cloth ? 'EMPTY DRY BAG' : 'OPEN THE DRY BAG', z: 640 }));
    area.objects.push(rect('shelter', 1110, 365, 260, 170, { solid: true, z: 520 }));
    area.objects.push(circle('handset', 1080, 475, 18, { interact: 'prologue_repair', label: 'REPAIR THE SHELTER RELAY', z: 490 }));
    area.objects.push(rect('sign', 948, 433, 45, 30, { z: 454, text: 'PUBLIC SHELTER 4' }));
    area.zones.push({ type: 'water', x: 0, y: 690, w: 1500, h: 210 });
    const rng = new RNG(1907);
    scatterPlants(area, rng, 125, {x:20,y:50,w:1460,h:780}, [{x:410,y:510,r:220},{x:1160,y:450,r:220}]);
    for (let i = 0; i < 16; i++) addTree(area, rng.range(60,1440), rng.pick([rng.range(80,190),rng.range(705,825)]), rng.range(28,48), rng.int(1,9999));
    return area;
  }

  function makeCamp() {
    const area = { kind: 'camp', name: 'SURVEY SHELTER', w: 1400, h: 900, bg: '#30372f', objects: [], decor: [], paths: [], enemies: [], zones: [], notes: [], lights: [] };
    area.paths.push(path([{x:130,y:690},{x:380,y:545},{x:720,y:500},{x:1380,y:465}], 44, 'trail'));
    area.paths.push(path([{x:660,y:505},{x:660,y:210}], 25, 'trail'));
    area.objects.push(rect('tarp', 300, 360, 265, 175, { solid: true, z: 520, level: save.campLevel }));
    area.objects.push(rect('workbench', 612, 310, 116, 47, { solid: true, interact: 'workbench', label: 'USE WORKBENCH', z: 350 }));
    area.objects.push(rect('stash', 368, 552, 82, 58, { solid: true, interact: 'stash', label: 'OPEN STASH', z: 603 }));
    area.objects.push(circle('campfire', 645, 550, 34, { solid: false, z: 575 }));
    area.lights.push({x:645,y:550,r:185,color:'rgba(228,170,69,.28)',kind:'fire'});
    area.objects.push(circle('npc', 805, 485, 18, { solid: true, interact: 'mara', label: save.regulatorBanked && !save.finalChoice ? 'SPEAK WITH MARA' : 'TALK TO MARA VALE', z: 505, npcName: 'Mara Vale', anchorX:805, anchorY:485, bodyAngle:-.4, gazeAngle:-.4, idlePhase:'watch', idleClock:5.5 }));
    area.objects.push(rect('routepost', 1150, 410, 58, 92, { solid: true, interact: 'depart', label: save.contractAccepted ? 'ENTER THE LOWLAND' : 'ROUTE CLOSED · SPEAK WITH MARA', z: 495 }));
    area.objects.push(circle('radio', 508, 330, 20, { interact: 'radio', label: 'CHECK THE RELAY', z: 350 }));
    area.objects.push(circle('worklight', 554, 348, 10, { z: 360, color:'amber' }));
    area.lights.push({x:554,y:348,r:118,color:'rgba(228,170,69,.2)',kind:'lamp'});
    area.objects.push(rect('pump', 760, 400, 50, 62, { solid: true, z: 455 }));
    area.objects.push(rect('sign', 985, 448, 55, 34, { z: 475, text: 'LOWLAND →' }));
    const rng = new RNG(4815 + save.campLevel);
    scatterPlants(area, rng, 115, {x:20,y:30,w:1360,h:820}, [{x:500,y:480,r:300},{x:1020,y:465,r:220}]);
    for (let i=0;i<18;i++) addTree(area,rng.pick([rng.range(45,210),rng.range(1220,1360),rng.range(50,1350)]),rng.pick([rng.range(70,190),rng.range(690,840)]),rng.range(25,48),rng.int(1,9999));
    return area;
  }

  function semanticPOI(area, kind, x, y, rng) {
    const add = o => area.objects.push(o);
    if (kind === 'yard') {
      add(rect('servicehall', x-125, y-95, 250, 145, {solid:true,z:y+38, poi:'SERVICE YARD'}));
      add(rect('gatefence', x-175, y+75, 350, 18, {solid:true,z:y+92}));
      add(circle('fuelbowser', x+145, y-48, 38, {solid:true,z:y-13}));
      add(rect('cache', x-35, y+105, 58, 42, {interact:'loot',label:'SEARCH TOOL LOCKER',loot:[['parts',2],['cloth',1]],z:y+140}));
      add(rect('weaponcase', x+98, y+90, 70, 35, {interact:'loot',label:'OPEN ARMORY CASE',loot:[['shotgun',1],['shells',4]],z:y+120}));
      area.notes.push({x:x-75,y:y+70,text:'“KEEP THE PUMPS CLEAN / KEEP THE FUTURE MOVING”'});
      add(circle('worklight',x-148,y+54,10,{z:y+65,color:'amber'}));
      area.lights.push({x:x-148,y:y+54,r:112,color:'rgba(228,170,69,.18)',kind:'lamp'});
    } else if (kind === 'chapel') {
      add(rect('chapel', x-98, y-125, 196, 220, {solid:true,z:y+85, poi:'FLOOD CHAPEL'}));
      add(circle('bell', x+125, y-92, 30, {solid:true,z:y-66}));
      add(rect('cache', x-35, y+120, 65, 42, {interact:'loot',label:'SEARCH RELIEF CRATE',loot:[['medicine',2],['cleanwater',1],['cloth',1]],z:y+155}));
      area.notes.push({x:x+38,y:y+100,text:'RIVER HEIGHT, YEAR 6 — CUT INTO THE STONE'});
      add(circle('worklight',x+76,y+106,8,{z:y+116,color:'candle'}));
      area.lights.push({x:x+76,y:y+106,r:76,color:'rgba(196,94,63,.16)',kind:'candle'});
    } else if (kind === 'relay') {
      add(rect('relayhut', x-95, y-72, 190, 138, {solid:true,z:y+53, poi:'RANGER RELAY'}));
      add(circle('mast', x+110, y-86, 27, {solid:true,z:y-63}));
      add(rect('cache', x-38, y+92, 65, 42, {interact:'loot',label:'SEARCH RANGER CACHE',loot:[['ammo22',18],['bandage',1],['parts',1]],z:y+126}));
      add(rect('weaponcase', x+62, y+83, 73, 36, {interact:'loot',label:'OPEN PATROL CASE',loot:[['carbine',1],['carbineAmmo',16]],z:y+114}));
      area.notes.push({x:x-48,y:y+75,text:'LAST LOG: “THE SIGNAL IS ANSWERING ITSELF.”'});
      add(circle('worklight',x+109,y-116,9,{z:y-106,color:'teal'}));
      area.lights.push({x:x+109,y:y-116,r:126,color:'rgba(105,167,154,.18)',kind:'beacon'});
    }
    for(let placed=0,tries=0;placed<5&&tries<50;tries++){const rx=x+rng.range(-220,220),ry=y+rng.range(-190,190),rr=rng.range(18,34);if(!spawnClear(area,rx,ry,rr+18))continue;addRock(area,rx,ry,rr,rng.int(1,9999));placed++;}
  }

  function addStoryCluster(area, kind, x, y, seed) {
    area.objects.push(circle('storycluster', x, y, 42, { z:y+18, kind, seed, solid:false }));
    if(kind==='survey'){
      area.objects.push(circle('surveystake',x-32,y-25,4,{z:y-10,seed:seed%9}));
      area.objects.push(circle('surveystake',x+30,y+18,4,{z:y+34,seed:(seed+1)%9}));
    }
  }

  function scavProfile(id) {
    const coats=['#4a4749','#505b4b','#51433f','#3f5150'];
    const trims=[COLORS.rust,'#837052',COLORS.teal,'#5d5063'];
    return { coat:coats[Math.floor(hash(id,1,3)*coats.length)], trim:trims[Math.floor(hash(id,2,5)*trims.length)], hood:hash(id,3,7)>.44, pack:hash(id,4,9)>.34, left:hash(id,5,11)>.5?-1:1, bulk:.9+hash(id,6,13)*.2 };
  }

  function spawnEnemy(area, type, x, y, rng) {
    const stats = type === 'hound' ? {hp:48,r:14,speed:128} : type === 'wader' ? {hp:82,r:20,speed:54} : {hp:68,r:17,speed:75};
    const id=rng.int(1,1e8), angle=rng.range(0,TAU);
    area.enemies.push(Object.assign({type,x,y,vx:0,vy:0,angle,bodyAngle:angle,weaponAngle:angle,alert:0,aim:0,cooldown:rng.range(.2,1),alive:true,hit:0,id,recoil:0,recoilV:0,idlePhase:'hold',idleClock:rng.range(2.5,6.5),idleHeading:angle,profile:type==='scav'?scavProfile(id):null},stats));
  }

  function makeLowland(seed) {
    const rng = new RNG(seed), area = { kind:'lowland', name:'THE LOWLAND', w:2600, h:1800, bg:'#30382f', objects:[], decor:[], paths:[], enemies:[], zones:[], notes:[], lights:[], seed };
    area.paths.push(path([{x:0,y:920},{x:380,y:900},{x:720,y:820},{x:1150,y:910},{x:1580,y:820},{x:2070,y:1010},{x:2600,y:960}], 88, 'oldroad'));
    area.paths.push(path([{x:440,y:880},{x:680,y:420},{x:1140,y:330},{x:1640,y:480}], 30, 'trail'));
    area.paths.push(path([{x:950,y:900},{x:1100,y:1320},{x:1530,y:1460},{x:2210,y:1150}], 34, 'trail'));
    area.paths.push(path([{x:1650,y:850},{x:1900,y:470},{x:2380,y:250}], 26, 'trail'));
    area.zones.push({type:'water',x:0,y:1510,w:2600,h:290});
    area.zones.push({type:'water',x:1740,y:0,w:330,h:520});
    area.zones.push({type:'exposure',x:1430,y:1150,w:310,h:270,strength:7});
    area.zones.push({type:'exposure',x:2050,y:380,w:260,h:220,strength:10});
    area.objects.push(rect('extract', 84, 825, 105, 130, {interact:'extract',label:'RETURN TO SHELTER',z:948}));
    area.objects.push(rect('bunkerhead', 2220, 975, 230, 160, {solid:true,z:1120,poi:'SILT WATERWORKS'}));
    area.objects.push(circle('bunkerdoor', 2190, 1080, 31, {interact:'enter_bunker',label:'DESCEND INTO WATERWORKS',z:1108}));
    area.objects.push(rect('signalexit', 2350, 160, 115, 86, {interact:'premium_extract',label:'CALL RELAY PICKUP',z:236,locked:save.finalChoice!=='relay'}));
    const slots = rng.shuffle([
      {x:730,y:390},{x:1140,y:1300},{x:1630,y:570}
    ]);
    const kinds = rng.shuffle(['yard','chapel','relay']);
    kinds.forEach((k,i)=>semanticPOI(area,k,slots[i].x,slots[i].y,rng));
    addStoryCluster(area,'survey',430,815,seed^41);
    addStoryCluster(area,'repair',1285,1015,seed^73);
    addStoryCluster(area,'memorial',1965,665,seed^109);
    const avoids = slots.map(s=>({x:s.x,y:s.y,r:270})).concat([{x:2250,y:1060,r:280},{x:130,y:900,r:220}]);
    scatterPlants(area,rng,360,{x:35,y:35,w:2530,h:1680},avoids);
    for(let i=0;i<48;i++){
      let x=rng.range(80,2520),y=rng.range(70,1490); if(avoids.some(a=>Math.hypot(x-a.x,y-a.y)<a.r)) continue;
      if(rng.next()<.68)addTree(area,x,y,rng.range(25,53),rng.int(1,9999));else addRock(area,x,y,rng.range(17,36),rng.int(1,9999));
    }
    for(let i=0,tries=0;i<16&&tries<180;tries++){
      const x=rng.range(520,2440),y=rng.range(130,1460);if(Math.hypot(x-130,y-900)<390||!spawnClear(area,x,y,24))continue;
      spawnEnemy(area,rng.next()<.42?'hound':rng.next()<.72?'scav':'wader',x,y,rng);i++;
    }
    for(let i=0,tries=0;i<10&&tries<100;tries++){const x=rng.range(430,2440),y=rng.range(100,1450);if(!spawnClear(area,x,y,12))continue;area.objects.push(circle('looseLoot',x,y,12,{interact:'loot',label:'PICK UP SUPPLIES',loot:[[rng.pick(['parts','cloth','bandage','cleanwater']),1]],z:y}));i++;}
    return area;
  }

  function makeBunker(seed) {
    const rng = new RNG(seed ^ 0x91f5), area = {kind:'bunker',name:'SILT WATERWORKS',w:1160,h:900,bg:'#171d1e',objects:[],decor:[],paths:[],enemies:[],zones:[],notes:[],floors:[],lights:[]};
    const layouts = [
      [[0,1],[1,1],[1,0],[2,0],[2,1],[3,1],[3,2]],
      [[0,1],[1,1],[1,2],[2,2],[2,1],[2,0],[3,0],[3,1]],
      [[0,1],[1,1],[1,0],[2,0],[2,1],[2,2],[3,2],[3,1]]
    ];
    const cells = rng.pick(layouts), cw=250,ch=230,ox=70,oy=55;
    cells.forEach((c,i)=>{
      const floor={x:ox+c[0]*cw,y:oy+c[1]*ch,w:220,h:195,room:i};area.floors.push(floor);
      area.lights.push({x:floor.x+floor.w*.5,y:floor.y+26,r:i%3===1?118:142,color:i%4===2?'rgba(196,94,63,.18)':'rgba(105,167,154,.17)',kind:i%4===2?'emergency':'fixture',clip:floor,on:hash(i,seed,17)>.16});
    });
    for(let i=0;i<cells.length-1;i++){
      const a=cells[i],b=cells[i+1],ax=ox+a[0]*cw+110,ay=oy+a[1]*ch+98,bx=ox+b[0]*cw+110,by=oy+b[1]*ch+98;
      if(a[0]!==b[0])area.floors.push({x:Math.min(ax,bx)-2,y:ay-33,w:Math.abs(bx-ax)+4,h:66,corridor:true});
      else area.floors.push({x:ax-33,y:Math.min(ay,by)-2,w:66,h:Math.abs(by-ay)+4,corridor:true});
    }
    const start=area.floors[0], end=area.floors[cells.length-1];
    area.objects.push(circle('ladder',start.x+55,start.y+98,24,{interact:'exit_bunker',label:'CLIMB TO THE LOWLAND',z:start.y+122}));
    area.objects.push(circle('regulator',end.x+150,end.y+95,25,{interact:'regulator',label:'REMOVE PRESSURE REGULATOR',z:end.y+120}));
    area.objects.push(rect('controlbank',end.x+28,end.y+25,58,105,{solid:true,z:end.y+125}));
    const mid=area.floors[Math.floor(cells.length/2)];
    area.objects.push(rect('cache',mid.x+125,mid.y+110,58,38,{interact:'loot',label:'SEARCH MAINTENANCE LOCKER',loot:[['parts',2],['medicine',1],['carbineAmmo',12]],z:mid.y+145}));
    area.objects.push(circle('valve',mid.x+48,mid.y+148,18,{interact:'purge',label:'[MECHANICS] BLEED THE FILTER LINE',z:mid.y+168}));
    area.zones.push({type:'exposure',x:mid.x+20,y:mid.y+20,w:150,h:120,strength:13});
    area.notes.push({x:end.x+28,y:end.y+158,text:'PRESSURE IS A PROMISE KEPT BY WALLS'});
    for(let i=1;i<cells.length;i+=2){const f=area.floors[i];for(let tries=0;tries<12;tries++){const x=f.x+rng.range(48,172),y=f.y+rng.range(48,146);if(!spawnClear(area,x,y,24))continue;spawnEnemy(area,i%4===1?'scav':'wader',x,y,rng);break;}}
    return area;
  }

  function enterArea(area, x, y, camp = false) {
    G.area = area; G.bullets.length = 0; G.particles.length = 0; G.decals.length = 0; G.soundMarks.length = 0;
    G.player = makePlayer(x,y,camp); G.camera.x=x; G.camera.y=y; G.nearest=null;
    if (area.kind === 'prologue') addInventory('bandage',1,true);
    if (area.kind === 'camp') prepareCampAmmo();
    updateHUD(true);
  }

  function loadPrologue() { G.seed=1907; enterArea(makePrologue(),145,495,false); G.runActive=false; setObjective(); }
  function loadCamp(message) { enterArea(makeCamp(),660,625,true); G.runActive=false; if(message) toast(message,3.5); setObjective(); persist(); }

  function prepareCampAmmo() {
    const p=G.player; p.weaponList=save.weapons.revolver?['revolver','prybar']:['prybar'];
    if(save.weapons.shotgun&&save.selectedLong==='shotgun')p.weaponList.push('shotgun');
    if(save.weapons.carbine&&save.selectedLong==='carbine')p.weaponList.push('carbine');
    p.weaponIndex=0;
    p.mags.revolver=save.weapons.revolver?Math.min(6,save.stash.ammo22):0;
    p.ammo.ammo22=Math.max(0,save.stash.ammo22-p.mags.revolver);
  }

  function withdrawAmmo() {
    const p=G.player, plans={ammo22:24,shells:8,carbineAmmo:30};
    if(save.weapons.revolver && save.stash.ammo22<6){save.stash.ammo22+=6; toast('RELIEF CACHE · 6 .22 ROUNDS',2.2);}
    const carriedAmmo=new Set(p.weaponList.map(key=>WEAPONS[key].ammo).filter(Boolean));
    Object.keys(plans).forEach(k=>{if(!carriedAmmo.has(k))return;const q=Math.min(save.stash[k]||0,plans[k]);p.ammo[k]=q;save.stash[k]-=q;});
    p.weaponList.forEach(key=>{const w=WEAPONS[key];if(!w.ammo)return;const q=Math.min(w.mag,p.ammo[w.ammo]);p.mags[key]=q;p.ammo[w.ammo]-=q;});
    persist();
  }

  function startRun() {
    if(!save.contractAccepted){toast('Mara needs to show you the route first.');return;}
    save.runs++; save.minutes+=45; G.seed=(save.day*92821+save.runs*1777+1907)>>>0;
    G.lowland=makeLowland(G.seed); enterArea(G.lowland,245,905,false); G.runActive=true; withdrawAmmo();
    const relief=save.upgrades.medroll?2:1;addInventory('bandage',relief,true);const secured=G.player.inventory.find(s=>s.key==='bandage');if(secured)secured.secured=relief;
    for(const key of ['bandage','medicine','cleanwater'])if(save.prepared[key]&&(save.stash[key]||0)>0&&addInventory(key,1,true)){save.stash[key]--;}
    persist();setObjective();toast('OUTING BEGINS · RETURN WEST TO BANK WHAT YOU CARRY',3.1);
  }

  function enterBunker() {
    G.returnPos={x:G.player.x,y:G.player.y}; const inventory=G.player.inventory, p=G.player, old={hp:p.hp,stamina:p.stamina,exposure:p.exposure,bleeding:p.bleeding,weaponList:p.weaponList,mags:p.mags,ammo:p.ammo,weaponIndex:p.weaponIndex};
    old.runValue=p.runValue;old.maxDistance=p.maxDistance;enterArea(makeBunker(G.seed),145,383,false); Object.assign(G.player,old);G.player.inventory=inventory;G.player.cap=save.packSize;setObjective();toast('SILT WATERWORKS · SOUND CARRIES THROUGH CONCRETE',2.7);
  }

  function exitBunker() {
    const inventory=G.player.inventory,p=G.player,old={hp:p.hp,stamina:p.stamina,exposure:p.exposure,bleeding:p.bleeding,weaponList:p.weaponList,mags:p.mags,ammo:p.ammo,weaponIndex:p.weaponIndex,runValue:p.runValue,maxDistance:p.maxDistance};
    G.area=G.lowland;G.player=makePlayer(G.returnPos.x-35,G.returnPos.y+20,false);Object.assign(G.player,old);G.player.inventory=inventory;G.bullets.length=0;G.particles.length=0;setObjective();toast('BACK IN THE LOWLAND',1.8);
  }

  function transition(task) { if(G.transition!==0)return;G.transition=.001;G.transitionTask=task; }

  function addInventory(key, qty=1, quiet=false) {
    const p=G.player,item=ITEMS[key]; if(!item)return false;
    if(key==='ammo22'||key==='shells'||key==='carbineAmmo')return false;
    const openInStacks=p.inventory.reduce((n,s)=>n+(s.key===key?item.stack-s.qty:0),0);
    const emptySlots=Math.max(0,p.cap-p.inventory.length);
    if(openInStacks+emptySlots*item.stack<qty){if(!quiet)toast('PACK FULL · RETURN OR USE SOMETHING');return false;}
    let remain=qty;
    for(const slot of p.inventory){if(slot.key===key&&slot.qty<item.stack){const q=Math.min(remain,item.stack-slot.qty);slot.qty+=q;remain-=q;if(!remain)break;}}
    while(remain>0&&p.inventory.length<p.cap){const q=Math.min(remain,item.stack);p.inventory.push({key,qty:q});remain-=q;}
    if(remain>0){if(!quiet)toast('PACK FULL · RETURN OR USE SOMETHING');return false;}
    if(!quiet){sound.pickup();toast(`${item.short} ×${qty}`);}return true;
  }

  function pickupLoot(list,obj) {
    let took=false;const remaining=[];
    for(const [key,qty] of list){
      if(key==='ammo22'||key==='shells'||key==='carbineAmmo'){
        G.player.ammo[key]+=qty;took=true;sound.pickup();toast(`${key==='ammo22'?'.22 ROUNDS':key==='shells'?'12-GAUGE SHELLS':'CARBINE ROUNDS'} ×${qty}`);
      } else if(addInventory(key,qty)) took=true;else remaining.push([key,qty]);
    }
    obj.loot=remaining;if(took){obj.active=remaining.length>0;G.player.runValue+=1;save.skills.fieldcraft+=.18;}
  }

  function hasItem(key, qty=1) { return G.player.inventory.reduce((n,s)=>n+(s.key===key?s.qty:0),0)>=qty; }
  function removeItem(key, qty=1) {
    for(let i=G.player.inventory.length-1;i>=0&&qty>0;i--){const s=G.player.inventory[i];if(s.key!==key)continue;const q=Math.min(qty,s.qty);s.qty-=q;qty-=q;if(s.qty<=0)G.player.inventory.splice(i,1);}return qty<=0;
  }

  function useItem(index) {
    const p=G.player,s=p.inventory[index];if(!s)return;const key=s.key;
    if(key==='bandage'){
      if(p.hp>=p.maxHp&&p.bleeding<=0){toast('NO WOUND NEEDS DRESSING');return;}
      p.bleeding=0;p.hp=Math.min(p.maxHp,p.hp+(save.upgrades.medroll?35:24));sound.tone(330,.16,'sine',.06,1.6);toast('WOUND DRESSED');
    } else if(key==='medicine'){
      p.bleeding=0;p.hp=Math.min(p.maxHp,p.hp+48);p.exposure=Math.max(0,p.exposure-12);sound.tone(360,.18,'sine',.06,1.8);toast('MEDICINE USED');
    } else if(key==='cleanwater'){
      p.exposure=Math.max(0,p.exposure-28);p.stamina=100;sound.tone(210,.2,'sine',.045,1.4);toast('CLEAN WATER · EXPOSURE REDUCED');
    } else {toast(ITEMS[key].use);return;}
    s.qty--;if(s.secured)s.secured--;if(s.qty<=0)p.inventory.splice(index,1);closePanel();updateHUD(true);
  }

  function inventoryWeight(){return G.player.inventory.reduce((n,s)=>n+ITEMS[s.key].weight*s.qty,0);}

  function bankRun(premium=false) {
    if(G.mode!=='play'||G.transition!==0||!G.player?.alive)return;
    const p=G.player,meaningful=p.runValue>0||p.maxDistance>420;
    for(const s of p.inventory){
      const it=ITEMS[s.key],qty=Math.max(0,s.qty-(s.secured||0));if(qty<=0)continue;
      if(it.weapon){save.weapons[it.weapon]=true;save.selectedLong=it.weapon;toast(`${it.name.toUpperCase()} SECURED AT SHELTER`,3);}
      else if(s.key==='regulator')save.regulatorBanked=true;
      else save.stash[s.key]=(save.stash[s.key]||0)+qty;
    }
    for(const key of ['revolver','shotgun','carbine']){const w=WEAPONS[key];if(p.weaponList.includes(key))save.stash[w.ammo]=(save.stash[w.ammo]||0)+(p.mags[key]||0);}
    for(const k of ['ammo22','shells','carbineAmmo'])save.stash[k]=(save.stash[k]||0)+(p.ammo[k]||0);
    let message='OUTING ABORTED · NOTHING GAINED, NOTHING LOST';
    if(meaningful){save.extractions++;save.day++;save.minutes=premium?save.minutes+90:490;save.skills.fieldcraft+=1.2;if(save.finalChoice==='commons'&&save.extractions%2===0){save.stash.medicine++;message='THE COMMONS SHARED ONE SEALED MEDICINE';}else message=save.regulatorBanked&&!save.finalChoice?'THE PRESSURE REGULATOR IS HOME · MARA IS WAITING':`SAFE RETURN · DAY ${String(save.day).padStart(2,'0')}`;}
    persist();transition(()=>loadCamp(message));
  }

  function playerDeath() {
    const p=G.player;if(!p.alive)return;p.alive=false;setPlayUI(false);save.deaths++;save.day++;save.minutes=550;save.stash.ammo22=Math.max(save.stash.ammo22,6);persist();
    setTimeout(()=>{G.mode='dead';setPlayUI(false);showScreen('death-screen');},650);
  }

  function objective() {
    if(G.area?.kind==='prologue'){
      if(!save.prologue.satchel)return ['Search the stranded bus','A sling and a tool may still be inside.'];
      if(!save.prologue.fuse)return ['Recover the relay fuse','Follow the blue survey stakes uphill.'];
      if(!save.prologue.cloth)return ['Find dry cloth','A sealed field bag lies south of the road.'];
      return ['Repair the survey shelter','Fit the fuse and bind the cracked lead.'];
    }
    if(G.area?.kind==='camp'){
      if(save.regulatorBanked&&!save.finalChoice)return ['Decide who gets the water','Mara is waiting beside the handpump.'];
      if(!save.contractAccepted)return ['Speak with Mara Vale','Ask what silenced the settlement pump.'];
      return ['Prepare an outing','Use the bench, then take the east route.'];
    }
    if(G.area?.kind==='bunker')return hasItem('regulator')?['Get the regulator home','Climb out, then extract from the Lowland.']:['Recover the pressure regulator','The control room lies beyond the pump galleries.'];
    if(hasItem('regulator'))return ['Extract with the regulator','Return west—or risk the relay pickup.'];
    return ['Find the Silt Waterworks','Explore, scavenge, and leave whenever the risk is enough.'];
  }
  function setObjective(){const o=objective();$('objective-label').textContent=o[0];$('objective-detail').textContent=o[1];}

  function prologueInteract(action,obj) {
    if(action==='prologue_satchel'&&!save.prologue.satchel){save.prologue.satchel=true;G.player.cap=4;sound.pickup();toast('FOUND · SLING BAG + PRY BAR');}
    else if(action==='prologue_fuse'&&!save.prologue.fuse){save.prologue.fuse=true;sound.pickup();toast('FOUND · CERAMIC RELAY FUSE');}
    else if(action==='prologue_cloth'&&!save.prologue.cloth){save.prologue.cloth=true;sound.pickup();toast('FOUND · DRY CLOTH');}
    else if(action==='prologue_repair'){
      if(!(save.prologue.satchel&&save.prologue.fuse&&save.prologue.cloth)){toast('THE LEAD NEEDS A FUSE, DRY CLOTH, AND A TOOL');return;}
      save.prologueDone=true;save.weapons.revolver=true;save.stash.ammo22=18;save.skills.mechanics+=2;persist();sound.tone(92,.6,'sine',.08,1.8);sound.tone(440,.12,'square',.06,1.4);toast('SHELTER POWERED · RANGER SIDEARM RECOVERED',3);
      transition(()=>loadCamp('A SHELTER IS NOT A HOME. IT IS A BEGINNING.'));
    } else return;
    obj.label='EMPTY';persist();setObjective();
  }

  function interact() {
    if(G.mode!=='play'||G.panel||G.transition!==0||!G.player?.alive)return;
    const obj=G.nearest;if(!obj||!obj.active)return;sound.ui();
    if(obj.interact?.startsWith('prologue_'))return prologueInteract(obj.interact,obj);
    if(obj.interact==='loot')return pickupLoot(obj.loot,obj);
    if(obj.interact==='workbench')return openPanel('bench');
    if(obj.interact==='stash')return openPanel('pack');
    if(obj.interact==='mara')return openPanel('mara');
    if(obj.interact==='radio')return toast(save.finalChoice==='relay'?'THE HILL RELAY MARKS MOVEMENT BEYOND YOUR MAP':'STATIC, THEN THREE DISTANT CLICKS');
    if(obj.interact==='depart')return startRun();
    if(obj.interact==='extract')return bankRun(false);
    if(obj.interact==='premium_extract'){
      if(save.finalChoice!=='relay'){toast('NO ONE IS LISTENING ON THIS FREQUENCY');return;}return bankRun(true);
    }
    if(obj.interact==='enter_bunker')return transition(enterBunker);
    if(obj.interact==='exit_bunker')return transition(exitBunker);
    if(obj.interact==='purge'){
      if(save.skills.mechanics<2&&!hasItem('parts')){toast('NEEDS PRACTICED MECHANICS OR ONE MACHINE PART');return;}
      if(save.skills.mechanics<2)removeItem('parts',1);const zone=G.area.zones.find(z=>z.type==='exposure');if(zone)zone.strength=-4;obj.interact=null;obj.label='FILTER LINE PURGED';save.skills.mechanics+=.35;sound.tone(72,.7,'sawtooth',.07,.55,obj.x);toast('FILTER LINE PURGED · CONTAMINATION FALLING',2.8);return;
    }
    if(obj.interact==='regulator'){
      if(hasItem('regulator')){toast('THE REGULATOR IS ALREADY IN YOUR PACK');return;}
      if(addInventory('regulator',1)){obj.active=false;G.player.runValue+=5;save.skills.mechanics+=1;setObjective();sound.tone(74,.4,'square',.08,.65);G.camera.shake=7;}
    }
  }

  function currentWeapon(){return WEAPONS[G.player.weaponList[G.player.weaponIndex]];}
  function currentWeaponKey(){return G.player.weaponList[G.player.weaponIndex];}
  function localPoint(x,y,a,forward,side=0){return{x:x+Math.cos(a)*forward-Math.sin(a)*side,y:y+Math.sin(a)*forward+Math.cos(a)*side};}
  function meleeProgress(p){const w=WEAPONS.prybar;return p.meleeTime>0?clamp((w.delay-p.meleeTime)/w.delay,0,1):1;}
  function meleeAngle(p,progress=meleeProgress(p)){
    if(p.meleeTime<=0)return p.weaponAngle;
    if(progress<.22)return p.meleeHeading+lerp(-.28,-1.08,progress/.22);
    if(progress<.64)return p.meleeHeading+lerp(-1.08,1.02,(progress-.22)/.42);
    return p.meleeHeading+lerp(1.02,0,(progress-.64)/.36);
  }
  function segmentBlockPoint(x1,y1,x2,y2,r=1){
    const length=Math.hypot(x2-x1,y2-y1),steps=Math.max(1,Math.ceil(length/5));
    for(let i=1;i<=steps;i++){const t=i/steps,x=lerp(x1,x2,t),y=lerp(y1,y2,t);if(blocked(x,y,r))return{x,y,t};}
    return null;
  }
  function weaponObstruction(p,angle,length){
    const root=localPoint(p.x,p.y,angle,12,3),end=localPoint(root.x,root.y,angle,length,0),hit=segmentBlockPoint(root.x,root.y,end.x,end.y,2.5);
    const wallT=hit?.t??2;if(!G.area)return{amount:hit?clamp(1-wallT,0,1):0,wall:!!hit};let actorT=2;
    for(const e of G.area.enemies){if(!e.alive)continue;const t=segmentCircleT(root.x,root.y,end.x,end.y,e.x,e.y,e.r+4);if(t!=null&&t<actorT)actorT=t;}
    if(actorT<wallT)return{amount:clamp(1-actorT,0,1),wall:false};
    if(hit)return{amount:clamp(1-wallT,0,1),wall:true};
    return{amount:0,wall:false};
  }
  function computePlayerRig(p,overrideAngle=null){
    const key=currentWeaponKey(),w=WEAPONS[key],angle=overrideAngle==null?(key==='prybar'?meleeAngle(p):p.weaponAngle):overrideAngle;
    const obstruction=key==='prybar'?0:(p.obstruction||0),recoil=p.recoil||0,effectiveLength=Math.max(4,w.length*(1-obstruction)-2-recoil);
    const rear=localPoint(p.x,p.y,angle,10-recoil*.32,4),front=localPoint(rear.x,rear.y,angle,Math.max(1,Math.min(25,w.length*.52,effectiveLength*.72)-recoil*.12),0);
    const muzzle=localPoint(rear.x,rear.y,angle,effectiveLength,0);
    const leftShoulder=localPoint(p.x,p.y,p.bodyAngle,2,-9),rightShoulder=localPoint(p.x,p.y,p.bodyAngle,2,9);
    return{key,w,angle,rear,front,muzzle,leftShoulder,rightShoulder,obstruction,baseLength:w.length};
  }
  function computeEnemyRig(e){
    const angle=e.weaponAngle==null?e.angle:e.weaponAngle,side=e.profile?.left||1,baseLength=44,rear=localPoint(e.x,e.y,angle,8,side*3),raw=localPoint(rear.x,rear.y,angle,baseLength,0),hit=G.area?segmentBlockPoint(rear.x,rear.y,raw.x,raw.y,2.5):null,wallT=hit?.t??2,actorT=G.player?.alive?(segmentCircleT(rear.x,rear.y,raw.x,raw.y,G.player.x,G.player.y,G.player.r+4)??2):2,contactT=Math.min(wallT,actorT),obstruction=contactT<=1?1-contactT:0,length=Math.max(4,baseLength*(1-obstruction)-2-(e.recoil||0)),front=localPoint(rear.x,rear.y,angle,Math.min(18,length*.72),0),muzzle=localPoint(rear.x,rear.y,angle,length,0);
    return{angle,rear,front,muzzle,side,obstruction,baseLength,wallObstruction:wallT<=actorT&&wallT<=1};
  }

  function surfaceAt(x,y){
    if(!G.area)return'silt';
    if(G.area.kind==='bunker')return'concrete';
    for(const z of G.area.zones)if(z.type==='water'&&x>z.x&&x<z.x+z.w&&y>z.y&&y<z.y+z.h)return'water';
    for(const road of G.area.paths)for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i];if(pointSegmentDistance(x,y,a.x,a.y,b.x,b.y)<road.width*.5)return road.kind==='oldroad'?'road':'silt';}
    return hash(Math.floor(x/90),Math.floor(y/90),G.area.seed||31)>.48?'grass':'silt';
  }
  function footContact(p,heavy=false){
    const side=p.stepSide;p.stepSide*=-1;const foot=localPoint(p.x,p.y,p.bodyAngle,-4,side*8),surface=surfaceAt(foot.x,foot.y);p.lastSurface=surface;
    const colors={water:COLORS.tealBright,concrete:COLORS.concrete,road:COLORS.silt,grass:COLORS.olive,silt:COLORS.silt};
    if(surface==='water')particle(foot.x,foot.y,0,0,.42,colors.water,18,'ripple');
    else for(let i=0;i<(heavy?5:3);i++){const a=p.bodyAngle+Math.PI+(Math.random()-.5)*1.5,s=(heavy?34:21)*(0.45+Math.random());particle(foot.x,foot.y,Math.cos(a)*s,Math.sin(a)*s,.25+Math.random()*.2,colors[surface]||COLORS.silt,1.2+Math.random()*1.4,'contact');}
    sound.step(surface,p.x,heavy);
  }

  function cycleWeapon() {
    if(G.mode!=='play'||G.panel||G.transition!==0)return;const p=G.player;if(p.reload>0||p.meleeTime>0||p.weaponList.length<2)return;p.weaponIndex=(p.weaponIndex+1)%p.weaponList.length;p.cooldown=.18;sound.ui();updateWeaponHUD();
  }

  function startReload() {
    if(G.mode!=='play'||G.panel||G.transition!==0)return;const p=G.player,key=currentWeaponKey(),w=WEAPONS[key];if(!w.ammo||p.reload>0||p.mags[key]>=w.mag||p.ammo[w.ammo]<=0)return;
    p.reload=w.reload*(1-Math.min(.12,skillLevel('mechanics')*.03));p.reloadingWeapon=key;sound.reload(p.x);const rig=computePlayerRig(p),side=p.bodyAngle+Math.PI/2;
    if(key==='shotgun')for(let i=0;i<Math.max(1,w.mag-p.mags[key]);i++)particle(rig.rear.x,rig.rear.y,Math.cos(side)*(35+i*12),Math.sin(side)*(35+i*12),.55,COLORS.amber,3,'casing');
    if(key==='carbine')particle(rig.rear.x,rig.rear.y,Math.cos(side)*26,Math.sin(side)*26,.62,'#303839',7,'magazine');
    toast('RELOADING',.8);
  }

  function finishReload() {
    const p=G.player,key=p.reloadingWeapon,w=WEAPONS[key];if(!w)return;const q=Math.min(w.mag-p.mags[key],p.ammo[w.ammo]);p.mags[key]+=q;p.ammo[w.ammo]-=q;p.reloadingWeapon=null;sound.reload(p.x);updateWeaponHUD();
  }

  function fireWeapon() {
    const p=G.player,key=currentWeaponKey(),w=WEAPONS[key];if(p.cooldown>0||p.reload>0||p.camp||!p.alive)return;
    if(w.melee){
      p.cooldown=w.delay;p.meleeTime=w.delay;p.meleeHeading=p.weaponAngle;p.meleeHit=false;p.settle=.18;sound.melee('swing',p.x);controller.rumble(.04,.13,48);return;
    }
    if((p.mags[key]||0)<=0){p.cooldown=.2;sound.tone(120,.045,'square',.04,.75,p.x);startReload();return;}
    const rig=computePlayerRig(p);if(p.wallObstruction&&rig.obstruction>.05){p.cooldown=.14;sound.melee('metal',rig.muzzle.x);p.recoilV+=2.2;controller.rumble(.18,.22,55);return;}
    p.mags[key]--;p.cooldown=w.delay;save.condition[key]=Math.max(0,(save.condition[key]||70)-.045);
    const handlingPenalty=save.condition[key]<25?.018:0, skillBonus=Math.min(.15,skillLevel('marksmanship')*.035), moveBloom=Math.hypot(p.vx,p.vy)>60?.018:0;
    const count=w.pellets||1;
    for(let i=0;i<count;i++){
      const a=rig.angle+(Math.random()-.5)*(w.spread+handlingPenalty+moveBloom)*(1-skillBonus)*2;
      G.bullets.push({x:rig.muzzle.x,y:rig.muzzle.y,px:rig.muzzle.x,py:rig.muzzle.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,life:w.range/w.speed,damage:w.damage,from:'player',color:w.color,r:2.2});
    }
    p.vx-=Math.cos(rig.angle)*(key==='shotgun'?42:8);p.vy-=Math.sin(rig.angle)*(key==='shotgun'?42:8);p.recoilV+=w.recoil;p.noise=w.sound;G.camera.shake=key==='shotgun'?9:3;
    if(key==='carbine'){const side=rig.angle-Math.PI/2;particle(rig.rear.x,rig.rear.y,Math.cos(side)*72+Math.cos(rig.angle)*18,Math.sin(side)*72+Math.sin(rig.angle)*18,.42,COLORS.amber,2.4,'casing');}
    muzzle(rig.muzzle.x,rig.muzzle.y,rig.angle,w.color);sound.gun(key,p.x);controller.rumble(key==='shotgun'?.55:.18,key==='shotgun'?.85:.38,key==='shotgun'?115:58);addSoundMark(p.x,p.y,w.sound*720,w.sound);updateWeaponHUD();
  }

  function updateMelee(p,dt){
    if(p.meleeTime<=0)return;
    const w=WEAPONS.prybar,prev=meleeProgress(p);p.meleeTime=Math.max(0,p.meleeTime-dt);const now=meleeProgress(p),angle=meleeAngle(p,now),rig=computePlayerRig(p,angle);
    if(!p.meleeHit&&now>=.25&&now<=.7&&prev<=.68){
      const wall=segmentBlockPoint(rig.rear.x,rig.rear.y,rig.muzzle.x,rig.muzzle.y,4),wallT=wall?.t??2;let actor=null,actorT=2;
      for(const e of G.area.enemies){if(!e.alive)continue;const t=segmentCircleT(rig.rear.x,rig.rear.y,rig.muzzle.x,rig.muzzle.y,e.x,e.y,e.r+6);if(t!=null&&t<actorT){actor=e;actorT=t;}}
      if(actor&&actorT<wallT){p.meleeHit=true;p.meleeTime=Math.min(p.meleeTime,w.delay*.31);p.recoilV+=4;damageEnemy(actor,w.damage,angle);sound.melee('body',actor.x);controller.rumble(.32,.5,78);G.camera.shake=5;}
      else if(wall){p.meleeHit=true;p.meleeTime=Math.min(p.meleeTime,w.delay*.28);p.recoilV+=5;G.camera.shake=3;sound.melee('metal',wall.x);controller.rumble(.4,.28,82);for(let i=0;i<5;i++)particle(wall.x,wall.y,(Math.random()-.5)*85,(Math.random()-.5)*85,.2,COLORS.concrete,2,'spark');}
    }
    if(p.meleeTime<=0){p.meleeTime=0;p.meleeHit=false;}
  }

  function damageEnemy(e,amount,angle) {
    if(!e.alive)return;e.hp-=amount;e.hit=.14;e.alert=1;e.x+=Math.cos(angle)*5;e.y+=Math.sin(angle)*5;spawnHit(e.x,e.y,COLORS.blood);save.skills.marksmanship+=.11;
    if(e.hp<=0){e.alive=false;G.decals.push({x:e.x,y:e.y,type:'blood',r:e.r*1.3,seed:e.id});sound.tone(78,.13,'sawtooth',.045,.5,e.x);const loot=e.type==='scav'?[['ammo22',6],['parts',1]]:e.type==='wader'?[['medicine',1]]:[['cloth',1]];G.area.objects.push(circle('corpse',e.x,e.y,e.r+8,{interact:'loot',label:'SEARCH REMAINS',loot,z:e.y+5}));}
  }

  function hurtPlayer(amount, bleed=.08, angle=0) {
    const p=G.player;if(p.invuln>0||!p.alive)return;p.hp-=amount;p.invuln=.28;p.bleeding=Math.min(3,p.bleeding+(Math.random()<bleed?1:0));p.vx+=Math.cos(angle)*28;p.vy+=Math.sin(angle)*28;G.camera.shake=8;sound.hurt();controller.rumble(.48,.7,120);spawnHit(p.x,p.y,COLORS.blood);if(p.hp<=0)playerDeath();
  }

  function enemyFire(e) {
    const p=G.player,rig=computeEnemyRig(e),a=rig.angle+(Math.random()-.5)*.075;
    if(rig.wallObstruction&&rig.obstruction>.05){e.cooldown=.18;e.aim=Math.max(.72,e.aim);sound.melee('metal',rig.muzzle.x);return;}
    G.bullets.push({x:rig.muzzle.x,y:rig.muzzle.y,px:rig.muzzle.x,py:rig.muzzle.y,vx:Math.cos(a)*820,vy:Math.sin(a)*820,life:.72,damage:16,from:'enemy',color:COLORS.blood,r:2});
    muzzle(rig.muzzle.x,rig.muzzle.y,rig.angle,COLORS.blood);sound.gun('revolver',e.x);addSoundMark(e.x,e.y,480,.7);e.recoilV+=6;e.cooldown=1.15+Math.random()*.55;e.aim=0;
  }

  function addSoundMark(x,y,r,intensity){G.soundMarks.push({x,y,r,life:1,intensity});}
  function particle(x,y,vx,vy,life,color,size=3,type='dot'){G.particles.push({x,y,vx,vy,life,max:life,color,size,type});}
  function muzzle(x,y,a,color){for(let i=0;i<8;i++){const q=a+(Math.random()-.5)*.75,s=Math.random()*150+40;particle(x,y,Math.cos(q)*s,Math.sin(q)*s,.08+Math.random()*.1,color,2+Math.random()*3,'spark');}particle(x,y,0,0,.08,COLORS.white,18,'flash');}
  function spawnHit(x,y,color){for(let i=0;i<7;i++){const a=Math.random()*TAU,s=30+Math.random()*95;particle(x,y,Math.cos(a)*s,Math.sin(a)*s,.25+Math.random()*.3,color,2+Math.random()*2);}}
  function spawnArc(x,y,a){G.particles.push({x,y,vx:0,vy:0,life:.16,max:.16,color:COLORS.paper,size:64,type:'arc',angle:a});}

  function pointInRect(x,y,o,pad=0){return x>o.x-pad&&x<o.x+o.w+pad&&y>o.y-pad&&y<o.y+o.h+pad;}
  function pointInObject(x,y,o,pad=0){return o.r!=null?Math.hypot(x-o.x,y-o.y)<o.r+pad:pointInRect(x,y,o,pad);}
  function bunkerWalkable(x,y,r=0){
    if(G.area.kind!=='bunker')return x>=r&&y>=r&&x<=G.area.w-r&&y<=G.area.h-r;
    const points=[[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]];
    return points.every(p=>G.area.floors.some(f=>pointInRect(p[0],p[1],f,0)));
  }
  function blocked(x,y,r,ignore=null){
    if(!bunkerWalkable(x,y,r))return true;
    for(const o of G.area.objects){if(o===ignore||!o.active||!o.solid)continue;if(pointInObject(x,y,o,r))return true;}
    return false;
  }
  function moveEntity(e,dx,dy){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8)),sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){if(!blocked(e.x+sx,e.y,e.r,e))e.x+=sx;else e.vx*=.2;if(!blocked(e.x,e.y+sy,e.r,e))e.y+=sy;else e.vy*=.2;}
  }
  function lineClear(a,b){
    const d=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.ceil(d/18);
    for(let i=2;i<steps-1;i++){const t=i/steps,x=lerp(a.x,b.x,t),y=lerp(a.y,b.y,t);if(!bunkerWalkable(x,y,2))return false;for(const o of G.area.objects){if(!o.active||!o.solid)continue;if(pointInObject(x,y,o,1))return false;}}
    return true;
  }
  function segmentCircle(x1,y1,x2,y2,cx,cy,r){
    const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy;if(!l2)return Math.hypot(cx-x1,cy-y1)<=r;
    const t=clamp(((cx-x1)*dx+(cy-y1)*dy)/l2,0,1),x=x1+t*dx,y=y1+t*dy;return Math.hypot(cx-x,cy-y)<=r;
  }
  function segmentCircleT(x1,y1,x2,y2,cx,cy,r){
    const dx=x2-x1,dy=y2-y1,fx=x1-cx,fy=y1-cy,a=dx*dx+dy*dy;if(!a)return null;
    const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r;if(c<=0)return 0;const disc=b*b-4*a*c;if(disc<0)return null;
    const root=Math.sqrt(disc),t1=(-b-root)/(2*a),t2=(-b+root)/(2*a);if(t1>=0&&t1<=1)return t1;if(t2>=0&&t2<=1)return t2;return null;
  }
  function onScreenWorld(x,y,margin=0){const z=G.camera.zoom;return Math.abs(x-G.camera.x)<G.w/(2*z)+margin&&Math.abs(y-G.camera.y)<G.h/(2*z)+margin;}

  function controlFrame(){
    const keyboardMove={x:(input.keys.has('KeyD')?1:0)-(input.keys.has('KeyA')?1:0),y:(input.keys.has('KeyS')?1:0)-(input.keys.has('KeyW')?1:0)};
    const keyboardAim={x:(input.keys.has('ArrowRight')?1:0)-(input.keys.has('ArrowLeft')?1:0),y:(input.keys.has('ArrowDown')?1:0)-(input.keys.has('ArrowUp')?1:0)};
    const padMove=input.pad?.move||{x:0,y:0},padAim=input.pad?.aim||{x:0,y:0};
    const move=input.moveOwner==='gamepad'?padMove:input.moveOwner==='touch'?input.moveStick:keyboardMove;
    let aim={x:0,y:0},aimed=false;
    if(input.aimOwner==='mouse'&&input.mouse.active&&G.player){const world=screenToWorld(input.mouse.x,input.mouse.y);aim={x:world.x-G.player.x,y:world.y-G.player.y};aimed=true;}
    else if(input.aimOwner==='gamepad'&&Math.hypot(padAim.x,padAim.y)>.01){aim=padAim;aimed=true;}
    else if(input.aimOwner==='touch'&&Math.hypot(input.aimStick.x,input.aimStick.y)>.01){aim=input.aimStick;aimed=true;}
    else if(input.aimOwner==='keyboard'&&Math.hypot(keyboardAim.x,keyboardAim.y)>.01){aim=keyboardAim;aimed=true;}
    let fireSource=null;
    if(input.mouse.down)fireSource='mouse';else if(input.keys.has('Space'))fireSource='keyboard';else if(input.touchFire)fireSource='touch';else if(input.pad?.fire)fireSource='gamepad';
    return {move,aim,aimed,fire:!!fireSource,fireSource,sprint:input.keys.has('ShiftLeft')||input.keys.has('ShiftRight')||Math.hypot(input.moveStick.x,input.moveStick.y)>.92||!!input.pad?.sprint};
  }

  function updatePlayer(dt){
    const p=G.player;if(!p||!p.alive)return;
    const controls=controlFrame();let mx=controls.move.x,my=controls.move.y;
    const ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;}
    const weight=inventoryWeight(),encumber=Math.max(0,weight-7),sprinting=controls.sprint&&p.stamina>3&&ml>.2;
    p.inWater=G.area.zones.some(z=>z.type==='water'&&p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+z.h);
    let speed=(sprinting?205:138)*(1-Math.min(.26,encumber*.022));
    if(p.inWater)speed*=.56;
    if(p.meleeTime>0)speed*=.62;else if(p.reload>0)speed*=.82;
    if(sprinting){p.stamina=Math.max(0,p.stamina-dt*(18+encumber+(p.inWater?12:0)));p.noise=Math.max(p.noise,.28);}else p.stamina=Math.min(100,p.stamina+dt*(p.inWater?5:17-encumber*.35));
    const targetVx=mx*speed,targetVy=my*speed,accel=1-Math.pow(.0001,dt),beforeX=p.x,beforeY=p.y;
    p.vx=lerp(p.vx,targetVx,accel);p.vy=lerp(p.vy,targetVy,accel);moveEntity(p,p.vx*dt,p.vy*dt);
    const moved=Math.hypot(p.x-beforeX,p.y-beforeY);if(moved>.001){p.step=(p.step+moved/(sprinting?42:34))%1;p.stepDistance+=moved;const stride=sprinting?32:27;while(p.stepDistance>=stride){p.stepDistance-=stride;footContact(p,sprinting);}}

    const ax=controls.aim.x,ay=controls.aim.y,aimed=controls.aimed;
    if(aimed){p.aimAngle=Math.atan2(ay,ax);p.lastAimSource=input.aimOwner;}else if(ml>.15){p.aimAngle=Math.atan2(my,mx);p.lastAimSource='move';}
    const moveAngle=ml>.15?Math.atan2(my,mx):p.aimAngle,bodyTarget=p.meleeTime>0?p.meleeHeading:(ml>.15?moveAngle:p.aimAngle);
    p.bodyAngle=lerpAngle(p.bodyAngle,bodyTarget,expEase(ml>.15?7.5:4.2,dt));
    const key=currentWeaponKey(),w=WEAPONS[key],weaponTarget=p.reload>0?p.bodyAngle+(key==='shotgun'?.62:key==='carbine'?.48:.34):p.aimAngle;
    if(p.meleeTime<=0)p.weaponAngle=lerpAngle(p.weaponAngle,weaponTarget,expEase(w.turn*(p.reload>0?.72:1),dt));
    p.angle=p.weaponAngle;p.moveLean=lerp(p.moveLean,clamp(angleDelta(p.bodyAngle,moveAngle),-.35,.35),expEase(5,dt));
    p.recoilV+=(-p.recoil*74-p.recoilV*15)*dt;p.recoil+=p.recoilV*dt;if(p.recoil<0){p.recoil=0;p.recoilV=Math.max(0,p.recoilV);}
    p.settle=Math.max(0,p.settle-dt);if(w.melee){p.obstruction=0;p.wallObstruction=false;}else{const contact=weaponObstruction(p,p.weaponAngle,w.length);p.obstruction=contact.amount;p.wallObstruction=contact.wall;}

    const touchAligned=Math.abs(angleDelta(p.weaponAngle,p.aimAngle))<.11;
    if(controls.fire&&(!['touch','gamepad'].includes(controls.fireSource)||touchAligned))fireWeapon();
    p.cooldown=Math.max(0,p.cooldown-dt);p.invuln=Math.max(0,p.invuln-dt);p.noise=Math.max(0,p.noise-dt*.55);updateMelee(p,dt);
    if(p.reload>0){p.reload-=dt;if(p.reload<=0)finishReload();}
    if(p.bleeding>0){p.hp-=dt*(.65+p.bleeding*.38);if(p.hp<=0){playerDeath();return;}}

    let exposureRate=-3.8;
    for(const z of G.area.zones){if(z.type==='exposure'&&p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+z.h)exposureRate=Math.max(exposureRate,z.strength*(save.upgrades.cape?.65:1));}
    if(G.area.kind==='bunker')exposureRate=Math.max(exposureRate,.8*(save.upgrades.cape?.65:1));
    p.exposure=clamp(p.exposure+dt*exposureRate,0,100);
    if(p.exposure>82){p.hp-=dt*(p.exposure-80)*.045;if(p.hp<=0){playerDeath();return;}}
    if(G.area.kind==='lowland')p.maxDistance=Math.max(p.maxDistance,Math.hypot(p.x-245,p.y-905));

    G.nearest=null;let nd=96;
    for(const o of G.area.objects){if(!o.active||!o.interact)continue;const d=o.r!=null?Math.hypot(p.x-o.x,p.y-o.y)-o.r:Math.hypot(p.x-clamp(p.x,o.x,o.x+o.w),p.y-clamp(p.y,o.y,o.y+o.h));if(d<nd){nd=d;G.nearest=o;}}
    for(const n of G.area.notes){if(!n.seen&&Math.hypot(p.x-n.x,p.y-n.y)<85){n.seen=true;toast(n.text,3.2);save.skills.fieldcraft+=.08;}}

    const camEase=1-Math.pow(.001,dt);G.camera.x=lerp(G.camera.x,p.x+Math.cos(p.aimAngle)*35,camEase);G.camera.y=lerp(G.camera.y,p.y+Math.sin(p.aimAngle)*24,camEase);
  }

  function updateAmbientPeople(dt){
    if(G.area?.kind!=='camp'||!G.player)return;
    for(const o of G.area.objects){if(o.type!=='npc')continue;
      const playerDist=Math.hypot(G.player.x-o.x,G.player.y-o.y);o.idleClock=(o.idleClock||0)-dt;
      if(playerDist<155){o.idlePhase='social';o.idleClock=1.2;o.gazeAngle=Math.atan2(G.player.y-o.y,G.player.x-o.x);}
      else if(o.idleClock<=0){
        const order=['route','pump','listen','gloves','watch'],i=(order.indexOf(o.idlePhase)+1)%order.length;o.idlePhase=order[i];
        o.idleClock=3.5+hash(i,save.day,4815)*4.5;
      }
      const targets={route:{x:1150,y:455},pump:{x:785,y:430},listen:{x:508,y:330},gloves:{x:645,y:550},watch:{x:900,y:430}},t=o.idlePhase==='social'?G.player:(targets[o.idlePhase]||targets.watch);
      const desired=Math.atan2(t.y-o.y,t.x-o.x);o.gazeAngle=lerpAngle(o.gazeAngle??desired,desired,expEase(3.2,dt));o.bodyAngle=lerpAngle(o.bodyAngle??desired,desired,expEase(o.idlePhase==='social'?3.1:1.15,dt));
      o.idleWeight=lerp(o.idleWeight||0,o.idlePhase==='watch'?0:1,expEase(o.idlePhase==='social'?6:2.2,dt));o.blink=.5+.5*Math.sin(G.time*(.7+hash(3,save.day,8)*.25)+2.3);
    }
  }

  function updateEnemies(dt){
    const p=G.player;if(!p)return;
    for(const e of G.area.enemies){if(!e.alive)continue;e.hit=Math.max(0,e.hit-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.recoilV+=(-(e.recoil||0)*68-(e.recoilV||0)*14)*dt;e.recoil=(e.recoil||0)+e.recoilV*dt;if(e.recoil<0){e.recoil=0;e.recoilV=Math.max(0,e.recoilV);}
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),visible=d<620&&lineClear(e,p),heard=d<90+p.noise*720;
      if(visible||heard)e.alert=clamp(e.alert+dt*(visible?2.6:1.2),0,1);else e.alert=clamp(e.alert-dt*.16,0,1);
      if(e.alert>.22){
        e.idlePhase='hold';e.idleClock=Math.max(e.idleClock||0,2);e.bodyAngle=lerpAngle(e.bodyAngle??e.angle,a,expEase(e.type==='hound'?7:4,dt));e.angle=e.bodyAngle;
        if(e.type==='hound'){
          if(d>34){e.vx=Math.cos(a)*e.speed;e.vy=Math.sin(a)*e.speed;moveEntity(e,e.vx*dt,e.vy*dt);}else if(e.cooldown<=0){hurtPlayer(14,.22,a);e.cooldown=.82;}
        }else if(e.type==='wader'){
          if(d>48){e.vx=Math.cos(a)*e.speed;e.vy=Math.sin(a)*e.speed;moveEntity(e,e.vx*dt,e.vy*dt);}else if(e.cooldown<=0){hurtPlayer(22,.18,a);p.exposure=clamp(p.exposure+8,0,100);e.cooldown=1.28;}
        }else{
          const ideal=245;if(d>ideal+45){e.vx=Math.cos(a)*e.speed;e.vy=Math.sin(a)*e.speed;}else if(d<ideal-55){e.vx=-Math.cos(a)*e.speed*.65;e.vy=-Math.sin(a)*e.speed*.65;}else{e.vx=Math.cos(a+Math.PI/2)*e.speed*.32;e.vy=Math.sin(a+Math.PI/2)*e.speed*.32;}
          moveEntity(e,e.vx*dt,e.vy*dt);
          e.weaponAngle=lerpAngle(e.weaponAngle??e.angle,a,expEase(5.7,dt));
          const aligned=Math.abs(angleDelta(e.weaponAngle,a))<.075;
          if(visible&&d<560&&onScreenWorld(e.x,e.y,100)){e.aim=clamp(e.aim+dt*(e.alert>.8?.9:.35),0,1);if(e.aim>=1&&e.cooldown<=0&&aligned)enemyFire(e);}else e.aim=Math.max(0,e.aim-dt*1.6);
        }
      }else{
        e.idleClock=(e.idleClock||0)-dt;
        if(e.idleClock<=0){e.idleIndex=(e.idleIndex||0)+1;const phase=e.idleIndex%3;e.idlePhase=phase===0?'hold':phase===1?'scan':'step';e.idleClock=e.idlePhase==='step'?1.1:2.4+hash(e.id,e.idleIndex,19)*3;e.idleHeading=(e.idleHeading??e.angle)+(hash(e.id,e.idleIndex,23)-.5)*1.45;}
        let idleAim=e.idleHeading??e.angle;
        if(e.idlePhase==='scan')idleAim+=(hash(e.id,e.idleIndex||0,29)>.5?1:-1)*Math.sin((1-e.idleClock/5)*Math.PI)*.52;
        if(e.idlePhase==='step'){e.vx=Math.cos(idleAim)*e.speed*.18;e.vy=Math.sin(idleAim)*e.speed*.18;moveEntity(e,e.vx*dt,e.vy*dt);}
        e.bodyAngle=lerpAngle(e.bodyAngle??e.angle,idleAim,expEase(e.type==='scav'?1.6:2.4,dt));e.angle=e.bodyAngle;
        if(e.type==='scav'){e.weaponAngle=lerpAngle(e.weaponAngle??e.angle,idleAim,expEase(1.25,dt));e.aim=Math.max(0,e.aim-dt*1.6);}
      }
    }
  }

  function updateBullets(dt){
    for(let i=G.bullets.length-1;i>=0;i--){const b=G.bullets[i];b.px=b.x;b.py=b.y;const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;b.life-=dt;
      const wall=segmentBlockPoint(b.px,b.py,nx,ny,1),wallT=wall?.t??2;let actor=null,actorT=2;
      if(b.from==='player')for(const e of G.area.enemies){if(!e.alive)continue;const t=segmentCircleT(b.px,b.py,nx,ny,e.x,e.y,e.r);if(t!=null&&t<actorT){actor=e;actorT=t;}}
      else if(G.player.alive){const t=segmentCircleT(b.px,b.py,nx,ny,G.player.x,G.player.y,G.player.r);if(t!=null){actor=G.player;actorT=t;}}
      let hit=false;if(actor&&actorT<wallT){b.x=lerp(b.px,nx,actorT);b.y=lerp(b.py,ny,actorT);if(b.from==='player')damageEnemy(actor,b.damage,Math.atan2(b.vy,b.vx));else hurtPlayer(b.damage,.16,Math.atan2(b.vy,b.vx));hit=true;}
      else if(wall){b.x=wall.x;b.y=wall.y;hit=true;for(let q=0;q<3;q++)particle(b.x,b.y,(Math.random()-.5)*75,(Math.random()-.5)*75,.18,COLORS.concrete,2,'spark');}
      else{b.x=nx;b.y=ny;}
      if(hit||b.life<=0)G.bullets.splice(i,1);
    }
  }
  function updateParticles(dt){
    for(let i=G.particles.length-1;i>=0;i--){const p=G.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.02,dt);p.vy*=Math.pow(.02,dt);p.life-=dt;if(p.life<=0)G.particles.splice(i,1);}
    for(let i=G.soundMarks.length-1;i>=0;i--){G.soundMarks[i].life-=dt;if(G.soundMarks[i].life<=0)G.soundMarks.splice(i,1);}
  }

  function ambientTick(){
    if(G.mode!=='play'||!save.sound||!G.player)return;
    if(G.player.exposure>18&&Math.random()<.55){sound.tone(980+Math.random()*500,.018,'square',.022,.7);}
    else if(G.area.kind==='bunker'&&Math.random()<.22){sound.tone(46,.7,'sine',.025,.84,G.player.x+(Math.random()-.5)*500);}
    else if(Math.random()<.12){const x=G.player.x+(Math.random()>.5?1:-1)*(350+Math.random()*400);sound.tone(310+Math.random()*120,.18,'sine',.018,.55,x);addSoundMark(x,G.player.y+(Math.random()-.5)*300,180,.28);}
  }

  function scopeButtons(){
    const root=G.panel?$('panel'):(G.screen?$(G.screen):null);if(!root)return[];
    return [...root.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter(el=>{
      const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&!el.classList.contains('hidden');
    });
  }
  function defaultFocus(){
    const preferred=G.panel?$('panel-body').querySelector('button:not([disabled])'):
      G.screen==='title-screen'?(!$('continue-btn').classList.contains('hidden')?$('continue-btn'):$('new-btn')):
      G.screen==='story-screen'?$('begin-btn'):G.screen==='death-screen'?$('retry-btn'):
      G.screen==='pause-screen'?$('resume-btn'):G.screen==='choice-screen'?document.querySelector('.choice'):null;
    (preferred||scopeButtons()[0])?.focus({preventScroll:true});
  }
  function moveFocus(dx,dy){
    const list=scopeButtons();if(!list.length)return;const current=document.activeElement;
    if(!list.includes(current)){defaultFocus();return;}
    const a=current.getBoundingClientRect(),ax=a.left+a.width/2,ay=a.top+a.height/2;let best=null,score=Infinity;
    for(const el of list){if(el===current)continue;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,vx=x-ax,vy=y-ay;
      if((dx<0&&vx>=-2)||(dx>0&&vx<=2)||(dy<0&&vy>=-2)||(dy>0&&vy<=2))continue;
      const along=Math.abs(dx?vx:vy),across=Math.abs(dx?vy:vx),candidate=along+across*2.35;if(candidate<score){score=candidate;best=el;}}
    if(best)best.focus({preventScroll:true});
  }
  function activateFocused(){
    const list=scopeButtons(),active=document.activeElement;if(list.includes(active))active.click();else{defaultFocus();const now=document.activeElement;if(list.includes(now))now.click();}
  }
  function showPause(reason='manual'){
    if(G.mode==='paused')return;if(G.panel){G.panel=null;$('panel').classList.add('hidden');}
    pauseReturn={mode:G.mode,screen:G.screen};G.mode='paused';setPlayUI(false);showScreen('pause-screen');clearTransientInput();controller.suspend();sound.suspend();
    const playing=pauseReturn.mode==='play';$('pause-kicker').textContent=playing?'FIELD CONTROLS · TIME STOPPED':'FIELD CONTROLS · INPUT CHECK';
    $('pause-copy').textContent=reason==='focus'?'The game paused when focus left. Release held controls before returning.':playing?'The Lowland is frozen. Held controls must be released before they can act again.':'Check every input path before you get up.';
    $('resume-btn').textContent=playing?'BACK TO THE LOWLAND':'BACK';controllerUI();setTimeout(defaultFocus,0);
  }
  function resumePause(){
    if(G.mode!=='paused'||!pauseReturn)return;const back=pauseReturn;pauseReturn=null;clearTransientInput();controller.suspend();G.mode=back.mode;showScreen(back.screen);setPlayUI(back.mode==='play');if(back.mode==='play')sound.unlock();
  }
  function processActions(){
    if(input.consume('pause')){G.mode==='paused'?resumePause():showPause();return true;}
    if(G.mode==='paused'){
      if(input.consume('cancel')||input.consume('use'))resumePause();
      input.actions.clear();return true;
    }
    if(G.panel){
      if(input.consume('cancel')||input.consume('pack'))closePanel();else if(input.consume('use'))activateFocused();
      input.actions.clear();return true;
    }
    if(G.mode!=='play'){
      if(input.consume('cancel')&&G.screen!=='title-screen'){G.mode='title';showScreen('title-screen');setPlayUI(false);}
      else if(input.consume('use'))activateFocused();
      input.actions.clear();return true;
    }
    if(input.consume('cancel')){showPause();return true;}
    if(input.consume('pack')){openPanel('pack');return true;}
    if(input.consume('reload'))startReload();
    if(input.consume('swap'))cycleWeapon();
    if(input.consume('use')){interact();if(G.transition!==0)return true;}
    input.actions.clear();return false;
  }

  function update(dt){
    G.time+=dt;G.dt=dt;G.camera.shake=Math.max(0,G.camera.shake-dt*32);if(G.camera.shake<=0)G.camera.shakeX=G.camera.shakeY=0;if(G.toastTimer>0){G.toastTimer-=dt;if(G.toastTimer<=0)$('toast').classList.add('hidden');}
    if(processActions()){input.clearFrame();return;}
    if(G.transition!==0){
      if(G.transition>0){G.transition+=dt*2.2;if(G.transition>=1){const task=G.transitionTask;G.transitionTask=null;G.transition=-1;if(task)task();}}
      else {G.transition+=dt*2.2;if(G.transition>=0)G.transition=0;}
      input.clearFrame();return;
    }
    if(G.mode==='play'&&!G.panel){updatePlayer(dt);if(G.panel||G.transition!==0||!G.player?.alive){input.clearFrame();return;}updateAmbientPeople(dt);updateEnemies(dt);if(!G.player.alive){input.clearFrame();return;}updateBullets(dt);updateParticles(dt);save.minutes+=dt*.55;updateHUD();}
    else updateParticles(dt);
    input.clearFrame();
  }

  function updateHUD(force=false){
    if(!G.player)return;const p=G.player;
    $('hp-fill').style.width=`${clamp(p.hp/p.maxHp*100,0,100)}%`;$('hp-text').textContent=Math.max(0,Math.ceil(p.hp));
    $('stamina-fill').style.width=`${p.stamina}%`;$('stamina-text').textContent=Math.ceil(p.stamina);
    $('exposure-fill').style.width=`${p.exposure}%`;$('exposure-text').textContent=Math.ceil(p.exposure);
    $('day-label').textContent=`DAY ${String(save.day).padStart(2,'0')} · ${formatTime()}${p.bleeding>0?' · BLEEDING':''}`;
    $('area-label').textContent=G.area?.name||'THE LOWLAND';
    const prompt=$('prompt');if(G.nearest&&G.mode==='play'&&!G.panel){prompt.classList.remove('hidden');$('prompt-key').textContent=input.device==='gamepad'?'A':input.device==='touch'?'USE':'E';$('prompt-text').textContent=G.nearest.label||'USE';}else prompt.classList.add('hidden');
    if(force||Math.floor(G.time*8)%2===0)updateWeaponHUD();
  }
  function updateWeaponHUD(){
    if(!G.player)return;const key=currentWeaponKey(),w=WEAPONS[key],p=G.player;
    $('weapon-label').textContent=w.name;
    if(w.melee){$('ammo-mag').textContent='—';$('ammo-reserve').textContent='—';$('weapon-condition').textContent=w.condition;}
    else {$('ammo-mag').textContent=p.mags[key]??0;$('ammo-reserve').textContent=p.ammo[w.ammo]??0;const c=save.condition[key]||0;$('weapon-condition').textContent=p.reload>0?`RELOADING ${Math.max(0,p.reload).toFixed(1)}s`:c>65?'SERVICEABLE':c>25?'WORN':'NEEDS BENCH REPAIR';}
  }

  function openPanel(type){
    if(G.mode!=='play'||G.transition!==0)return;G.panel=type;const panel=$('panel'),body=$('panel-body');panel.classList.remove('hidden');$('prompt').classList.add('hidden');
    if(type==='pack'){ $('panel-kicker').textContent=G.player.camp?'SHELTER STORES':'FIELD KIT';$('panel-title').textContent='Pack & condition';body.innerHTML=packHTML(); }
    if(type==='bench'){ $('panel-kicker').textContent='SURVEY SHELTER';$('panel-title').textContent='Workbench';body.innerHTML=benchHTML(); }
    if(type==='mara'){ $('panel-kicker').textContent='ROUTE WARDEN';$('panel-title').textContent='Mara Vale';body.innerHTML=maraHTML(); }
    body.querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',()=>useItem(Number(b.dataset.use))));
    body.querySelectorAll('[data-drop]').forEach(b=>b.addEventListener('click',()=>dropItem(Number(b.dataset.drop))));
    body.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>buyUpgrade(b.dataset.upgrade)));
    body.querySelectorAll('[data-long]').forEach(b=>b.addEventListener('click',()=>selectLong(b.dataset.long)));
    body.querySelectorAll('[data-supply]').forEach(b=>b.addEventListener('click',()=>toggleSupply(b.dataset.supply)));
    const choiceOpen=body.querySelector('[data-choice-open]');if(choiceOpen)choiceOpen.addEventListener('click',()=>{closePanel();window.__showFinalChoice();});
    const accept=body.querySelector('[data-accept]');if(accept)accept.addEventListener('click',acceptContract);
    const repair=body.querySelector('[data-repair]');if(repair)repair.addEventListener('click',repairWeapons);
    sound.ui();if(input.device==='gamepad')setTimeout(defaultFocus,0);
  }
  function closePanel(){G.panel=null;$('panel').classList.add('hidden');sound.ui();}

  function packHTML(){
    const p=G.player,slots=[];for(let i=0;i<p.cap;i++){const s=p.inventory[i];if(s){const it=ITEMS[s.key],action=it.usable?`data-use="${i}"`:(!p.camp&&!it.quest?`data-drop="${i}"`:'');slots.push(`<button class="slot" ${action}><em>${s.qty}</em><b>${it.name}</b><small>${it.use}${s.secured?' · recovery kit':it.usable?' · tap to use':(!p.camp&&!it.quest?' · tap to discard one':'')}</small></button>`);}else slots.push('<div class="slot empty"><b>Empty slot</b><small>Space is a kind of readiness.</small></div>');}
    const stash=Object.entries(save.stash).map(([k,v])=>`<div class="resource-row"><span>${resourceName(k)}</span><b>${v}</b></div>`).join('');
    const skills=Object.keys(save.skills).map(k=>`<div class="skill-row"><span>${k[0].toUpperCase()+k.slice(1)}</span><b>${['UNTESTED','PRACTICED','STEADY','SEASONED','EXPERT'][skillLevel(k)]}</b></div>`).join('');
    const loadout=p.camp&&(save.weapons.shotgun||save.weapons.carbine)?`<p class="section-label">LONG GUN · CARRY ONE</p><div class="upgrade-grid">${save.weapons.shotgun?`<button class="upgrade ${save.selectedLong==='shotgun'?'owned':''}" data-long="shotgun"><span><strong>Break-action shotgun</strong><small>Close · loud · two shells</small></span><b>${save.selectedLong==='shotgun'?'PACKED':'SELECT'}</b></button>`:''}${save.weapons.carbine?`<button class="upgrade ${save.selectedLong==='carbine'?'owned':''}" data-long="carbine"><span><strong>Patrol carbine</strong><small>Mid-range · controllable · scarce rounds</small></span><b>${save.selectedLong==='carbine'?'PACKED':'SELECT'}</b></button>`:''}</div>`:'';
    const supplies=p.camp?`<p class="section-label">FIELD PROVISIONS · ONE EACH</p><div class="upgrade-grid">${['bandage','medicine','cleanwater'].map(k=>`<button class="upgrade ${save.prepared[k]?'owned':''}" data-supply="${k}" ${!save.prepared[k]&&(save.stash[k]||0)<1?'disabled':''}><span><strong>${ITEMS[k].name}</strong><small>${ITEMS[k].use}</small></span><b>${save.prepared[k]?'PACKED':(save.stash[k]||0)>0?'SELECT':'NONE'}</b></button>`).join('')}</div>`:'';
    return `<p class="field-note">${G.player.camp?'Select provisions for the next outing. Banked supplies stay safe until packed.':'Extraction banks the pack. Death does not.'}</p><p class="section-label">FIELD PACK · ${inventoryWeight().toFixed(1)} KG</p><div class="inventory-grid">${slots.join('')}</div>${loadout}${supplies}<p class="section-label">SHELTER STORES</p>${stash}<p class="section-label">PRACTICE · NO LEVEL SCALING</p>${skills}`;
  }
  function resourceName(k){return ({parts:'MACHINE PARTS',cloth:'DRY CLOTH',medicine:'MEDICINE',cleanwater:'CLEAN WATER',bandage:'BANDAGES',ammo22:'.22 ROUNDS',shells:'12-GAUGE SHELLS',carbineAmmo:'CARBINE ROUNDS'})[k]||k.toUpperCase();}
  function dropItem(index){const s=G.player.inventory[index];if(!s||ITEMS[s.key].quest)return;const name=ITEMS[s.key].short;s.qty--;if(s.qty<=0)G.player.inventory.splice(index,1);closePanel();toast(`${name} DISCARDED · SPACE MADE`);}

  const UPGRADE_DATA={
    bag:{name:'Waxed field bag',desc:'Four more carry slots. More choice, and more at risk.',cost:{parts:4,cloth:2}},
    cape:{name:'Oilskin rain cape',desc:'Reduces exposure gained in contaminated ground by 35%.',cost:{cloth:4,parts:2}},
    survey:{name:'Survey table',desc:'Marks major sites and the waterworks on your field map.',cost:{parts:5,cleanwater:1}},
    medroll:{name:'Organized medical roll',desc:'Carry a second starting bandage; dress wounds more effectively.',cost:{medicine:2,cloth:2}}
  };
  function costText(cost){return Object.entries(cost).map(([k,v])=>`${v} ${resourceName(k)}`).join(' · ');}
  function canPay(cost){return Object.entries(cost).every(([k,v])=>(save.stash[k]||0)>=v);}
  function benchHTML(){
    const cards=Object.entries(UPGRADE_DATA).map(([k,u])=>`<button class="upgrade ${save.upgrades[k]?'owned':''}" data-upgrade="${k}" ${save.upgrades[k]?'disabled':''}><span><strong>${u.name}</strong><small>${u.desc}</small></span><b>${save.upgrades[k]?'BUILT':costText(u.cost)}</b></button>`).join('');
    return `<p class="field-note">Nothing here raises weapon damage or makes bullets harmless. The bench buys reliability, access, and room to prepare.</p><div class="upgrade-grid">${cards}</div><p class="section-label">MAINTENANCE</p><button class="upgrade" data-repair><span><strong>Clean and repair carried arms</strong><small>Restores all secured weapon condition. Poor condition increases sway; it never causes a surprise jam.</small></span><b>2 MACHINE PARTS</b></button>`;
  }
  function buyUpgrade(key){const u=UPGRADE_DATA[key];if(!u||save.upgrades[key])return;if(!canPay(u.cost)){toast('NOT ENOUGH BANKED SUPPLIES');return;}Object.entries(u.cost).forEach(([k,v])=>save.stash[k]-=v);save.upgrades[key]=true;if(key==='bag'){save.packSize=8;G.player.cap=8;}save.campLevel=Math.min(4,save.campLevel+1);save.skills.mechanics+=1;persist();sound.tone(160,.16,'square',.07,1.7);openPanel('bench');toast(`${u.name.toUpperCase()} BUILT`);}
  function repairWeapons(){if(save.stash.parts<2){toast('NEED 2 MACHINE PARTS');return;}save.stash.parts-=2;Object.keys(save.condition).forEach(k=>save.condition[k]=100);save.skills.mechanics+=.6;persist();openPanel('bench');toast('WEAPONS CLEANED · CONDITION 100%');}
  function selectLong(key){if(!save.weapons[key])return;save.selectedLong=save.selectedLong===key?null:key;persist();prepareCampAmmo();openPanel('pack');toast(save.selectedLong?`${WEAPONS[key].name} PACKED FOR NEXT OUTING`:'SIDEARM ONLY');}
  function toggleSupply(key){if(!save.prepared.hasOwnProperty(key))return;if(!save.prepared[key]&&(save.stash[key]||0)<1){toast('NONE BANKED');return;}save.prepared[key]=!save.prepared[key];persist();openPanel('pack');}

  function maraHTML(){
    if(save.regulatorBanked&&!save.finalChoice)return `<p class="field-note">“You got it back. Good. Now comes the expensive part: deciding which promise we keep.”</p><p>The Commons can restart the clinic cistern. The Relay Crew can cool the hill transmitter and map what moves beyond us.</p><button class="primary" data-choice-open>DECIDE THE REGULATOR'S USE</button>`;
    if(!save.contractAccepted)return `<p class="field-note">“Our pump did not break. Something below the old waterworks took the pressure regulator. Without it, the clinic cistern is three dry days from trouble.”</p><p>The western marker always brings you home. Go as far as you judge wise. A live scout with half a pack is worth more than a dead hero with a full one.</p><button class="primary" data-accept>TAKE THE WATERWORKS ROUTE</button>`;
    if(save.finalChoice==='commons')return `<p class="field-note">“The clinic has clean water because you came back. People remember material things.”</p><p>The Commons now adds one sealed medicine to your shelter stores after every second safe return.</p>`;
    if(save.finalChoice==='relay')return `<p class="field-note">“The transmitter is cool and talking. The Crew marked a northern pickup point on every outing.”</p><p>You traded water today for knowledge tomorrow. Keep listening.</p>`;
    return `<p class="field-note">“You do not owe the Lowland a glorious death. Mark what you learn. Bring home what matters.”</p><p>The waterworks lies in the east. Extract whenever your judgment says the pack is valuable enough.</p>`;
  }
  function acceptContract(){save.contractAccepted=true;save.skills.nerve+=.5;persist();closePanel();setObjective();toast('ROUTE OPEN · THE WEST MARKER IS ALWAYS A SAFE EXIT',3);}

  window.__showFinalChoice=()=>{G.mode='choice';setPlayUI(false);showScreen('choice-screen');};
  function resolveChoice(choice){save.finalChoice=choice;save.campLevel=Math.min(4,save.campLevel+1);save.skills.nerve+=2;if(choice==='commons')save.stash.medicine+=2;else save.upgrades.survey=true;persist();G.mode='play';showScreen(null);setPlayUI(true);G.area=makeCamp();G.player.x=805;G.player.y=555;setObjective();toast(choice==='commons'?'THE CLINIC CISTERN RUNS CLEAN':'THE HILL TRANSMITTER ANSWERS',4);}

  function roundedPath(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
  function polygon(c,pts){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();}
  function strokeLine(c,pts,color,width=2){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function worldToScreen(x,y){const z=G.camera.zoom;return{x:(x-G.camera.x)*z+G.w/2+(G.camera.shakeX||0),y:(y-G.camera.y)*z+G.h/2+(G.camera.shakeY||0)};}
  function screenToWorld(x,y){const z=G.camera.zoom;return{x:(x-G.w/2-(G.camera.shakeX||0))/z+G.camera.x,y:(y-G.h/2-(G.camera.shakeY||0))/z+G.camera.y};}

  function prepareCameraShake(){
    const amount=G.camera.shake||0;if(amount<=0){G.camera.shakeX=0;G.camera.shakeY=0;return;}const tick=Math.floor(G.time*120);
    G.camera.shakeX=(hash(tick,17,G.seed||1)-.5)*amount;G.camera.shakeY=(hash(23,tick,G.seed||1)-.5)*amount;
  }

  function setWorldTransform(){
    const z=G.camera.zoom,sx=G.camera.shakeX||0,sy=G.camera.shakeY||0;
    ctx.setTransform(G.dpr*z,0,0,G.dpr*z,G.dpr*(G.w/2-G.camera.x*z+sx),G.dpr*(G.h/2-G.camera.y*z+sy));
  }
  function resetTransform(){ctx.setTransform(G.dpr,0,0,G.dpr,0,0);}

  function drawAttract(){
    resetTransform();ctx.fillStyle='#202a27';ctx.fillRect(0,0,G.w,G.h);
    const spacing=58;
    ctx.strokeStyle='rgba(105,167,154,.07)';ctx.lineWidth=1;
    for(let y=-spacing;y<G.h+spacing;y+=spacing){ctx.beginPath();for(let x=-20;x<G.w+20;x+=20){const yy=y+Math.sin(x*.018+G.time*.08+y)*8;ctx.lineTo(x,yy);}ctx.stroke();}
    for(let i=0;i<42;i++){const x=hash(i,7,2)*G.w,y=hash(i,9,5)*G.h,r=8+hash(i,1,8)*22;ctx.strokeStyle=`rgba(238,228,198,${.015+hash(i,2,4)*.025})`;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}
    const g=ctx.createRadialGradient(G.w*.52,G.h*.43,20,G.w*.52,G.h*.43,Math.max(G.w,G.h)*.7);g.addColorStop(0,'rgba(59,129,121,.18)');g.addColorStop(.48,'rgba(48,36,58,.15)');g.addColorStop(1,'rgba(11,16,18,.84)');ctx.fillStyle=g;ctx.fillRect(0,0,G.w,G.h);
  }

  function drawGround(area){
    const z=G.camera.zoom,left=G.camera.x-G.w/(2*z)-80,top=G.camera.y-G.h/(2*z)-80,right=G.camera.x+G.w/(2*z)+80,bottom=G.camera.y+G.h/(2*z)+80;
    ctx.fillStyle=area.bg;ctx.fillRect(0,0,area.w,area.h);
    if(area.kind==='bunker'){
      ctx.fillStyle='#101517';ctx.fillRect(0,0,area.w,area.h);
      for(const f of area.floors){
        ctx.fillStyle=f.corridor?'#343b39':'#3d4440';ctx.fillRect(f.x,f.y,f.w,f.h);
        if(!f.corridor){ctx.strokeStyle='#758076';ctx.lineWidth=7;ctx.strokeRect(f.x,f.y,f.w,f.h);ctx.strokeStyle='rgba(10,15,17,.52)';ctx.lineWidth=2;ctx.strokeRect(f.x+9,f.y+9,f.w-18,f.h-18);}
        ctx.strokeStyle='rgba(238,228,198,.065)';ctx.lineWidth=1;
        for(let x=f.x+22;x<f.x+f.w;x+=34){ctx.beginPath();ctx.moveTo(x,f.y+8);ctx.lineTo(x,f.y+f.h-8);ctx.stroke();}
      }
      for(let y=Math.floor(top/36)*36;y<bottom;y+=36)for(let x=Math.floor(left/36)*36;x<right;x+=36)if(bunkerWalkable(x,y)){const h=hash(x/36,y/36,area.w);ctx.fillStyle=h>.7?'rgba(105,167,154,.055)':'rgba(11,16,18,.06)';ctx.fillRect(x+3,y+3,2+h*8,1.5);}
      for(const light of area.lights){ctx.save();ctx.translate(light.x,light.y);ctx.fillStyle=light.on?(light.kind==='emergency'?COLORS.rust:COLORS.tealBright):'#29302f';ctx.strokeStyle=COLORS.ink;ctx.lineWidth=2;roundedPath(ctx,-17,-5,34,10,3);ctx.fill();ctx.stroke();if(light.on){ctx.globalAlpha=.45+.15*Math.sin(G.time*5+light.x);ctx.fillStyle=COLORS.paper;ctx.fillRect(-10,-1,20,2);}ctx.restore();}
      return;
    }
    for(const zone of area.zones){
      if(zone.type==='water'){
        ctx.fillStyle=COLORS.water;ctx.fillRect(zone.x,zone.y,zone.w,zone.h);ctx.strokeStyle='rgba(105,167,154,.28)';ctx.lineWidth=2;
        for(let y=zone.y+16;y<zone.y+zone.h;y+=24){ctx.beginPath();for(let x=zone.x;x<zone.x+zone.w;x+=28)ctx.lineTo(x,y+Math.sin(x*.027+y*.013+G.time*.22)*4);ctx.stroke();}
      } else {
        ctx.fillStyle='rgba(182,214,74,.075)';ctx.fillRect(zone.x,zone.y,zone.w,zone.h);ctx.strokeStyle='rgba(182,214,74,.16)';ctx.lineWidth=2;ctx.setLineDash([12,14]);ctx.strokeRect(zone.x+5,zone.y+5,zone.w-10,zone.h-10);ctx.setLineDash([]);
      }
    }
    for(const road of area.paths){
      ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(road.points[0].x,road.points[0].y);for(let i=1;i<road.points.length;i++)ctx.lineTo(road.points[i].x,road.points[i].y);
      ctx.strokeStyle=road.kind==='oldroad'?COLORS.siltDark:'#4a4939';ctx.lineWidth=road.width+12;ctx.stroke();ctx.strokeStyle=road.kind==='oldroad'?'#67604d':'#66644c';ctx.lineWidth=road.width;ctx.stroke();
      if(road.kind==='oldroad'){ctx.strokeStyle='rgba(238,228,198,.17)';ctx.lineWidth=2;ctx.setLineDash([18,24]);ctx.stroke();ctx.setLineDash([]);}
    }
    const grid=42;
    for(let y=Math.floor(top/grid)*grid;y<bottom;y+=grid)for(let x=Math.floor(left/grid)*grid;x<right;x+=grid){
      const h=hash(x/grid,y/grid,area.seed||19);if(h<.52)continue;ctx.save();ctx.translate(x+h*18,y+hash(y/grid,x/grid,3)*19);ctx.rotate(h*TAU);ctx.strokeStyle=h>.84?'rgba(238,228,198,.09)':'rgba(11,16,18,.09)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,0);ctx.quadraticCurveTo(0,-3,7,1);ctx.stroke();ctx.restore();
    }
    ctx.strokeStyle='rgba(105,167,154,.08)';ctx.lineWidth=1;
    for(let y=Math.floor(top/180)*180;y<bottom;y+=180){ctx.beginPath();for(let x=left;x<right;x+=28)ctx.lineTo(x,y+Math.sin(x*.009+y)*12);ctx.stroke();}
  }

  function drawDecor(o){
    const c=ctx;c.save();c.translate(o.x,o.y);const rnd=hash(o.seed||1,3,7);
    if(o.type==='grass'||o.type==='deadgrass'){
      c.strokeStyle=o.type==='grass'?'#738064':'#89775a';c.lineWidth=1.5;c.lineCap='round';for(let i=0;i<5;i++){const a=-2.1+i*.33+(rnd-.5)*.12;c.beginPath();c.moveTo(0,4);c.quadraticCurveTo(Math.cos(a)*o.r*.35,Math.sin(a)*o.r*.25,Math.cos(a)*o.r,Math.sin(a)*o.r);c.stroke();}
    }else if(o.type==='fern'){
      c.rotate((rnd-.5)*1.2);c.strokeStyle='#6f8067';c.lineWidth=2;c.beginPath();c.moveTo(-o.r*.7,o.r*.6);c.quadraticCurveTo(0,0,o.r*.8,-o.r*.7);c.stroke();for(let i=1;i<6;i++){const t=i/6,x=lerp(-o.r*.55,o.r*.6,t),y=lerp(o.r*.48,-o.r*.55,t),s=Math.sin(t*Math.PI)*o.r*.42;c.lineWidth=1.2;c.beginPath();c.moveTo(x,y);c.lineTo(x-s,y-s*.25);c.moveTo(x,y);c.lineTo(x+s*.8,y+s*.45);c.stroke();}
    }else if(o.type==='aster'){
      c.strokeStyle='#77856c';c.lineWidth=1.4;c.beginPath();c.moveTo(0,o.r*.7);c.lineTo(0,-o.r*.35);c.stroke();for(let j=0;j<2;j++){const yy=-o.r*.25-j*o.r*.24;c.fillStyle=j?'#d8cfd5':'#ddd1b6';for(let i=0;i<7;i++){const a=i/7*TAU;c.beginPath();c.ellipse(Math.cos(a)*4,yy+Math.sin(a)*4,3.2,1.5,a,0,TAU);c.fill();}c.fillStyle=COLORS.amber;c.beginPath();c.arc(0,yy,2.2,0,TAU);c.fill();}
    }
    c.restore();
  }

  function drawTree(o){
    const c=ctx,near=G.player&&Math.hypot(G.player.x-o.x,G.player.y-o.y)<o.r+46;c.save();if(near)c.globalAlpha=.34;
    c.translate(o.x,o.y);c.fillStyle='rgba(15,17,18,.3)';c.beginPath();c.ellipse(10,o.r*.55,o.r*1.05,o.r*.48,-.25,0,TAU);c.fill();
    c.strokeStyle='#25231f';c.lineWidth=7;c.beginPath();c.moveTo(0,o.r*.65);c.lineTo(-2,-o.r*.15);c.stroke();
    const rnd=new RNG(o.seed||1);for(let i=0;i<7;i++){const a=i/7*TAU+rnd.range(-.25,.25),rr=o.r*rnd.range(.35,.65),x=Math.cos(a)*rr*.72,y=Math.sin(a)*rr*.55-o.r*.18,r=o.r*rnd.range(.44,.62);c.fillStyle=i%3===0?'#445344':i%2?'#53624d':'#39493f';c.strokeStyle=COLORS.ink;c.lineWidth=2.2;c.beginPath();for(let q=0;q<8;q++){const qa=q/8*TAU,qr=r*(.78+hash(q,o.seed,9)*.28);c.lineTo(x+Math.cos(qa)*qr,y+Math.sin(qa)*qr);}c.closePath();c.fill();c.stroke();}
    c.strokeStyle='rgba(238,228,198,.13)';c.lineWidth=1.2;c.beginPath();c.moveTo(-o.r*.62,-o.r*.35);c.quadraticCurveTo(0,-o.r*.84,o.r*.48,-o.r*.47);c.stroke();c.restore();
  }

  function drawRock(o){const c=ctx,r=o.r,rng=new RNG(o.seed||1),pts=[];for(let i=0;i<8;i++){const a=i/8*TAU,rr=r*rng.range(.75,1.12);pts.push([o.x+Math.cos(a)*rr,o.y+Math.sin(a)*rr*.68]);}c.fillStyle='rgba(10,13,14,.25)';c.beginPath();c.ellipse(o.x+5,o.y+8,r*1.05,r*.55,0,0,TAU);c.fill();polygon(c,pts);c.fillStyle='#66685f';c.strokeStyle=COLORS.ink;c.lineWidth=2.2;c.fill();c.stroke();strokeLine(c,[[o.x-r*.6,o.y-r*.08],[o.x-r*.16,o.y-r*.42],[o.x+r*.42,o.y-r*.22]],'rgba(238,228,198,.2)',1.4);}

  function buildingBase(o,fill='#5c625c',roof='#424b47'){
    const c=ctx;c.fillStyle='rgba(8,12,13,.32)';c.fillRect(o.x+14,o.y+18,o.w,o.h);c.fillStyle=fill;c.strokeStyle=COLORS.ink;c.lineWidth=3;c.fillRect(o.x,o.y,o.w,o.h);c.strokeRect(o.x,o.y,o.w,o.h);c.fillStyle=roof;c.fillRect(o.x+8,o.y+8,o.w-16,o.h-23);c.strokeStyle='rgba(238,228,198,.15)';c.lineWidth=1.5;c.strokeRect(o.x+12,o.y+12,o.w-24,o.h-31);}

  function drawObject(o){
    if(!o.active)return;const c=ctx;
    if(o.type==='tree')return drawTree(o);if(o.type==='rock')return drawRock(o);
    c.save();
    if(o.type==='wreckbus'){
      c.translate(o.x,o.y);c.rotate(-.035);c.fillStyle='rgba(10,12,14,.32)';c.fillRect(12,15,o.w,o.h);c.fillStyle='#6a654d';c.strokeStyle=COLORS.ink;c.lineWidth=3;roundedPath(c,0,0,o.w,o.h,15);c.fill();c.stroke();c.fillStyle='#263538';for(let i=0;i<5;i++){c.fillRect(25+i*34,12,27,30);c.strokeStyle='rgba(238,228,198,.2)';c.strokeRect(25+i*34,12,27,30);}c.fillStyle=COLORS.rust;c.fillRect(7,55,o.w-14,8);c.fillStyle='#222228';for(const x of [32,o.w-38]){c.beginPath();c.arc(x,o.h,17,0,TAU);c.fill();c.strokeStyle='#77736b';c.lineWidth=3;c.stroke();}c.fillStyle=COLORS.paper;c.font='bold 9px monospace';c.fillText('LOWLAND TRANSIT 08',62,67);c.strokeStyle=COLORS.ink;c.beginPath();c.moveTo(100,0);c.lineTo(82,38);c.lineTo(111,24);c.stroke();
    }else if(o.type==='utilitypole'||o.type==='mast'){
      c.translate(o.x,o.y);c.fillStyle='rgba(10,12,14,.3)';c.beginPath();c.ellipse(12,16,28,13,.3,0,TAU);c.fill();c.strokeStyle=o.type==='mast'?'#667872':'#4e4739';c.lineWidth=o.type==='mast'?7:9;c.beginPath();c.moveTo(0,18);c.lineTo(0,-85);c.stroke();c.lineWidth=3;c.beginPath();c.moveTo(-24,-58);c.lineTo(24,-58);c.stroke();for(const x of [-19,19]){c.fillStyle=COLORS.paper;c.beginPath();c.arc(x,-58,5,0,TAU);c.fill();}c.strokeStyle=COLORS.tealBright;c.lineWidth=1.5;for(let r=18;r<44;r+=11){c.beginPath();c.arc(0,-83,r,-2.65,-.48);c.stroke();}
    }else if(o.type==='fieldbag'){
      c.translate(o.x,o.y);c.rotate(.16);c.fillStyle='#716343';c.strokeStyle=COLORS.ink;c.lineWidth=2;roundedPath(c,0,0,o.w,o.h,5);c.fill();c.stroke();c.strokeStyle=COLORS.paperDim;c.setLineDash([3,3]);c.strokeRect(6,6,o.w-12,o.h-12);c.setLineDash([]);c.fillStyle=COLORS.rust;c.fillRect(19,-3,12,8);
    }else if(o.type==='shelter'||o.type==='servicehall'||o.type==='relayhut'||o.type==='bunkerhead'){
      buildingBase(o,o.type==='shelter'?'#56635a':o.type==='bunkerhead'?'#74746a':'#626860',o.type==='bunkerhead'?'#414748':'#3c4c48');
      c.fillStyle='#202a2b';const doors=o.type==='bunkerhead'?2:1;for(let i=0;i<doors;i++)c.fillRect(o.x+o.w*(.35+i*.28)-22,o.y+o.h-31,44,31);
      c.strokeStyle=COLORS.rust;c.lineWidth=3;c.beginPath();c.moveTo(o.x+15,o.y+o.h-18);c.lineTo(o.x+o.w-15,o.y+o.h-18);c.stroke();
      c.fillStyle=COLORS.paper;c.font='bold 9px monospace';c.textAlign='center';c.fillText(o.type==='shelter'?'SURVEY 4':o.type==='servicehall'?'LOWLAND SERVICE DIV.':o.type==='relayhut'?'RANGER RELAY 12':'SILT WATERWORKS',o.x+o.w/2,o.y+o.h-43);c.textAlign='left';
      for(let x=o.x+20;x<o.x+o.w-20;x+=34){c.strokeStyle='rgba(23,21,31,.34)';c.lineWidth=1;c.beginPath();c.moveTo(x,o.y+12);c.lineTo(x-13,o.y+o.h-55);c.stroke();}
    }else if(o.type==='chapel'){
      buildingBase(o,'#66675e','#4b504c');c.fillStyle='#303b3b';c.fillRect(o.x+o.w*.5-25,o.y+o.h-50,50,50);c.fillStyle=COLORS.paperDim;c.beginPath();c.arc(o.x+o.w/2,o.y+48,17,0,TAU);c.fill();c.fillStyle='#394a4a';c.beginPath();c.arc(o.x+o.w/2,o.y+48,11,0,TAU);c.fill();c.strokeStyle=COLORS.rust;c.lineWidth=3;c.beginPath();c.moveTo(o.x+o.w/2,o.y+10);c.lineTo(o.x+o.w/2,o.y-30);c.moveTo(o.x+o.w/2-14,o.y-18);c.lineTo(o.x+o.w/2+14,o.y-18);c.stroke();
    }else if(o.type==='tarp'){
      c.fillStyle='rgba(8,12,13,.32)';c.beginPath();c.ellipse(o.x+o.w*.53,o.y+o.h*.7,o.w*.56,o.h*.38,0,0,TAU);c.fill();polygon(c,[[o.x+10,o.y+o.h],[o.x+o.w*.42,o.y+4],[o.x+o.w-8,o.y+o.h]]);c.fillStyle='#476864';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.fill();c.stroke();polygon(c,[[o.x+o.w*.42,o.y+4],[o.x+o.w*.64,o.y+o.h],[o.x+o.w-8,o.y+o.h]]);c.fillStyle='#354d4a';c.fill();c.strokeStyle='rgba(238,228,198,.3)';c.setLineDash([7,6]);c.beginPath();c.moveTo(o.x+15,o.y+o.h-8);c.lineTo(o.x+o.w*.42,o.y+10);c.lineTo(o.x+o.w-12,o.y+o.h-8);c.stroke();c.setLineDash([]);c.fillStyle=COLORS.amber;c.fillRect(o.x+o.w*.42-4,o.y-7,8,16);
    }else if(o.type==='workbench'){
      c.fillStyle='rgba(0,0,0,.25)';c.fillRect(o.x+7,o.y+9,o.w,o.h);c.fillStyle='#68563e';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.fillRect(o.x,o.y,o.w,o.h);c.strokeRect(o.x,o.y,o.w,o.h);c.fillStyle='#7b8179';c.fillRect(o.x+8,o.y+7,35,8);c.fillStyle=COLORS.rust;c.fillRect(o.x+52,o.y+8,12,25);c.strokeStyle=COLORS.paperDim;c.lineWidth=2;c.beginPath();c.arc(o.x+86,o.y+17,12,0,TAU);c.stroke();
    }else if(o.type==='stash'||o.type==='cache'||o.type==='weaponcase'){
      c.fillStyle='rgba(0,0,0,.27)';c.fillRect(o.x+5,o.y+7,o.w,o.h);c.fillStyle=o.type==='weaponcase'?'#455953':'#665b43';c.strokeStyle=COLORS.ink;c.lineWidth=2;roundedPath(c,o.x,o.y,o.w,o.h,4);c.fill();c.stroke();c.strokeStyle=COLORS.paperDim;c.lineWidth=1;c.strokeRect(o.x+5,o.y+5,o.w-10,o.h-10);c.fillStyle=o.type==='weaponcase'?COLORS.rust:COLORS.amber;c.fillRect(o.x+o.w/2-5,o.y+o.h/2-4,10,8);
    }else if(o.type==='campfire'){
      c.translate(o.x,o.y);c.fillStyle='rgba(228,170,69,.1)';c.beginPath();c.arc(0,0,58+Math.sin(G.time*4)*3,0,TAU);c.fill();c.strokeStyle='#4b3f34';c.lineWidth=8;c.beginPath();c.moveTo(-20,12);c.lineTo(20,-10);c.moveTo(-20,-10);c.lineTo(20,12);c.stroke();c.fillStyle=COLORS.rust;c.beginPath();c.moveTo(-10,4);c.quadraticCurveTo(-2,-35,4,-9);c.quadraticCurveTo(17,-29,13,9);c.closePath();c.fill();c.fillStyle=COLORS.amber;c.beginPath();c.moveTo(-3,7);c.quadraticCurveTo(2,-18,7,5);c.closePath();c.fill();for(let i=0;i<3;i++){const phase=(G.time*.42+i*.31)%1;c.globalAlpha=1-phase;c.fillStyle=COLORS.paperDim;c.beginPath();c.arc(Math.sin(i*2.7+G.time)*5,-18-phase*28,1.2+phase,0,TAU);c.fill();}c.globalAlpha=1;
    }else if(o.type==='worklight'){
      c.translate(o.x,o.y);c.fillStyle='rgba(8,11,13,.3)';c.beginPath();c.ellipse(5,9,15,7,0,0,TAU);c.fill();c.strokeStyle='#444b48';c.lineWidth=3;c.beginPath();c.moveTo(-7,12);c.lineTo(0,-11);c.lineTo(8,12);c.moveTo(0,-11);c.lineTo(0,-23);c.stroke();c.fillStyle=o.color==='teal'?COLORS.tealBright:o.color==='candle'?COLORS.rust:COLORS.amber;c.strokeStyle=COLORS.paperDim;c.lineWidth=1.5;c.beginPath();c.arc(0,-24,o.color==='candle'?4:6,0,TAU);c.fill();c.stroke();
    }else if(o.type==='npc'){
      c.restore();drawPerson(o);c.save();
    }else if(o.type==='routepost'||o.type==='extract'||o.type==='signalexit'){
      c.translate(o.x,o.y);const w=o.w||80,h=o.h||90;c.fillStyle='rgba(0,0,0,.25)';c.fillRect(7,8,w,h);c.strokeStyle=COLORS.ink;c.lineWidth=5;c.beginPath();c.moveTo(w*.25,h);c.lineTo(w*.25,8);c.moveTo(w*.75,h);c.lineTo(w*.75,8);c.stroke();c.fillStyle=o.type==='extract'?COLORS.rust:o.type==='signalexit'?COLORS.teal:'#596456';c.strokeStyle=COLORS.paperDim;c.lineWidth=2;c.fillRect(0,0,w,50);c.strokeRect(0,0,w,50);c.fillStyle=COLORS.paper;c.font='bold 9px monospace';c.textAlign='center';c.fillText(o.type==='extract'?'WEST / HOME':o.type==='signalexit'?'RELAY PICKUP':'EAST ROUTE',w/2,22);c.fillText(o.type==='signalexit'?'△ △ △':'→ → →',w/2,38);c.textAlign='left';
    }else if(o.type==='radio'||o.type==='handset'){
      c.translate(o.x,o.y);c.fillStyle='#3f504d';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.fillRect(-15,-11,30,23);c.strokeRect(-15,-11,30,23);c.fillStyle=COLORS.tealBright;c.beginPath();c.arc(-7,-2,3,0,TAU);c.fill();c.strokeStyle=COLORS.paperDim;c.lineWidth=1;c.beginPath();c.moveTo(7,-9);c.lineTo(7,8);c.stroke();c.beginPath();c.moveTo(14,-9);c.lineTo(23,-28);c.stroke();
    }else if(o.type==='pump'||o.type==='fuelbowser'||o.type==='controlbank'){
      const x=o.x,y=o.y,w=o.w||70,h=o.h||90;c.fillStyle='rgba(0,0,0,.28)';c.fillRect(x+7,y+8,w,h);c.fillStyle=o.type==='fuelbowser'?'#6a5541':'#55615c';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);c.fillStyle='#273536';c.fillRect(x+10,y+12,w-20,Math.min(30,h*.3));c.strokeStyle=COLORS.rust;c.lineWidth=3;c.beginPath();c.moveTo(x+8,y+h-16);c.lineTo(x+w-8,y+h-16);c.stroke();
    }else if(o.type==='gatefence'){
      c.strokeStyle='#6b716c';c.lineWidth=3;for(let x=o.x;x<o.x+o.w;x+=22){c.beginPath();c.moveTo(x,o.y+o.h);c.lineTo(x+10,o.y);c.stroke();}c.strokeStyle=COLORS.ink;c.lineWidth=4;c.strokeRect(o.x,o.y,o.w,o.h);
    }else if(o.type==='bell'){
      c.translate(o.x,o.y);c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(5,8,31,16,0,0,TAU);c.fill();c.fillStyle='#7b6751';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.beginPath();c.moveTo(-17,5);c.quadraticCurveTo(-15,-26,0,-29);c.quadraticCurveTo(15,-26,17,5);c.lineTo(23,12);c.lineTo(-23,12);c.closePath();c.fill();c.stroke();c.fillStyle=COLORS.rust;c.beginPath();c.arc(0,15,5,0,TAU);c.fill();
    }else if(o.type==='bunkerdoor'||o.type==='ladder'){
      c.translate(o.x,o.y);c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.arc(4,6,o.r+5,0,TAU);c.fill();c.fillStyle='#475653';c.strokeStyle=COLORS.ink;c.lineWidth=4;c.beginPath();c.arc(0,0,o.r,0,TAU);c.fill();c.stroke();c.strokeStyle=COLORS.amber;c.lineWidth=2;c.beginPath();c.arc(0,0,o.r*.58,0,TAU);c.stroke();for(let i=0;i<6;i++){const a=i/6*TAU;c.beginPath();c.arc(Math.cos(a)*o.r*.76,Math.sin(a)*o.r*.76,2.5,0,TAU);c.fillStyle=COLORS.paperDim;c.fill();}
    }else if(o.type==='valve'){
      c.translate(o.x,o.y);c.fillStyle='#63716b';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.beginPath();c.arc(0,0,11,0,TAU);c.fill();c.stroke();c.strokeStyle=COLORS.rust;c.lineWidth=4;for(let i=0;i<6;i++){const a=i/6*TAU;c.beginPath();c.moveTo(Math.cos(a)*7,Math.sin(a)*7);c.lineTo(Math.cos(a)*21,Math.sin(a)*21);c.stroke();}c.beginPath();c.arc(0,0,17,0,TAU);c.stroke();
    }else if(o.type==='regulator'){
      c.translate(o.x,o.y);c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(4,7,30,18,0,0,TAU);c.fill();c.fillStyle='#687873';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.beginPath();c.arc(0,0,21,0,TAU);c.fill();c.stroke();c.strokeStyle=COLORS.amber;c.lineWidth=3;c.beginPath();c.arc(0,0,12,0,TAU);c.stroke();for(let i=0;i<5;i++){const a=i/5*TAU;c.beginPath();c.moveTo(Math.cos(a)*10,Math.sin(a)*10);c.lineTo(Math.cos(a)*28,Math.sin(a)*28);c.stroke();}
    }else if(o.type==='looseLoot'){
      c.translate(o.x,o.y);c.fillStyle='rgba(228,170,69,.16)';c.beginPath();c.arc(0,0,15+Math.sin(G.time*3+o.x)*2,0,TAU);c.fill();c.fillStyle=COLORS.amber;c.strokeStyle=COLORS.ink;c.lineWidth=2;polygon(c,[[-8,5],[-5,-7],[7,-5],[9,6]]);c.fill();c.stroke();
    }else if(o.type==='storycluster'){
      c.translate(o.x,o.y);c.rotate((hash(o.seed,2,4)-.5)*.5);c.strokeStyle=COLORS.ink;c.lineWidth=2;
      if(o.kind==='repair'){
        c.fillStyle='#514b3d';roundedPath(c,-37,-19,52,33,4);c.fill();c.stroke();c.fillStyle='#6d7771';for(const p of [[-27,-9],[-8,6],[8,-10]]){c.beginPath();c.arc(p[0],p[1],4,0,TAU);c.fill();c.stroke();}c.strokeStyle=COLORS.rust;c.lineWidth=3;c.beginPath();c.moveTo(10,10);c.lineTo(34,-12);c.moveTo(22,-14);c.lineTo(35,4);c.stroke();
      }else if(o.kind==='memorial'){
        c.fillStyle='#66685f';for(let i=0;i<3;i++){const x=-24+i*23;c.beginPath();c.moveTo(x-7,14);c.lineTo(x-5,-15-i*3);c.lineTo(x+6,-18-i*3);c.lineTo(x+8,14);c.closePath();c.fill();c.stroke();}c.fillStyle=COLORS.paperDim;for(let i=0;i<5;i++){c.beginPath();c.arc(-30+i*14,20+(i%2)*4,2.5,0,TAU);c.fill();}
      }else{
        c.strokeStyle=COLORS.tealBright;c.lineWidth=2;c.setLineDash([5,4]);c.beginPath();c.moveTo(-35,-18);c.lineTo(32,22);c.stroke();c.setLineDash([]);c.fillStyle='#77736b';c.beginPath();c.arc(0,1,12,0,TAU);c.stroke();c.beginPath();c.arc(0,1,5,0,TAU);c.stroke();c.fillStyle=COLORS.paperDim;c.fillRect(-4,-3,8,8);
      }
    }else if(o.type==='corpse'){
      c.translate(o.x,o.y);c.rotate(hash(o.x,o.y,2)*TAU);c.fillStyle='#34303a';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.beginPath();c.ellipse(0,0,o.r*1.1,o.r*.58,0,0,TAU);c.fill();c.stroke();c.strokeStyle=COLORS.rust;c.lineWidth=3;c.beginPath();c.moveTo(-o.r*.6,-2);c.lineTo(o.r*.5,2);c.stroke();
    }else if(o.type==='surveystake'){
      c.translate(o.x,o.y);c.strokeStyle=COLORS.ink;c.lineWidth=4;c.beginPath();c.moveTo(0,13);c.lineTo(0,-15);c.stroke();c.fillStyle=COLORS.tealBright;c.strokeStyle=COLORS.paper;c.lineWidth=1;polygon(c,[[-7,-16],[8,-13],[5,-4],[-7,-7]]);c.fill();c.stroke();c.fillStyle=COLORS.paper;c.font='bold 7px monospace';c.fillText(String((o.seed||0)+1),-2,-8);
    }else if(o.type==='sign'){
      c.fillStyle='#52635d';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.fillRect(o.x,o.y,o.w,o.h);c.strokeRect(o.x,o.y,o.w,o.h);c.fillStyle=COLORS.paper;c.font='7px monospace';c.textAlign='center';c.fillText('CIVIL WORKS',o.x+o.w/2,o.y+13);c.fillStyle=COLORS.amber;c.fillText('◉',o.x+o.w/2,o.y+25);c.textAlign='left';
    }
    c.restore();
    if(o.poi&&onScreenWorld(o.x,o.y,60))drawPOILabel(o);
    if(o.interact&&o.active&&G.nearest===o)drawInteractRing(o);
  }

  function drawPOILabel(o){const x=o.r!=null?o.x:o.x+o.w/2,y=o.r!=null?o.y-o.r-20:o.y-18;ctx.save();ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='rgba(23,21,31,.82)';const w=ctx.measureText(o.poi).width+18;ctx.fillRect(x-w/2,y-13,w,20);ctx.fillStyle=COLORS.paper;ctx.fillText(o.poi,x,y+1);ctx.restore();}
  function drawInteractRing(o){const x=o.r!=null?o.x:o.x+o.w/2,y=o.r!=null?o.y:o.y+o.h/2,r=(o.r||Math.min(o.w,o.h)/2)+11;ctx.save();ctx.strokeStyle=COLORS.amber;ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.lineDashOffset=-G.time*12;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.restore();}

  function drawPerson(o){
    const c=ctx,a=o.bodyAngle??-.4,gaze=o.gazeAngle??a,phase=o.idlePhase||'watch',weight=o.idleWeight||0;
    c.save();c.translate(o.x,o.y);c.rotate(a);
    c.fillStyle='rgba(8,11,13,.32)';c.beginPath();c.ellipse(-2,7,20,11,.08,0,TAU);c.fill();
    const shift=Math.sin(G.time*.72+3.1)*weight*1.2;c.strokeStyle=COLORS.ink;c.lineWidth=2.5;c.fillStyle='#2e2a30';
    for(const s of [-1,1]){c.beginPath();c.ellipse(-7+s*shift,s*7,8,5,0,0,TAU);c.fill();c.stroke();}
    c.fillStyle='#5d7169';polygon(c,[[-13,-11],[-3,-17],[12,-11],[16,2],[8,14],[-10,13],[-16,1]]);c.fill();c.stroke();
    c.fillStyle='#73563f';roundedPath(c,-14,5,15,14,3);c.fill();c.stroke();c.fillStyle=COLORS.rust;c.fillRect(-14,7,3,10);
    c.restore();
    const head=localPoint(o.x,o.y,lerpAngle(a,gaze,.72),10,0);c.save();c.translate(head.x,head.y);c.rotate(gaze);c.fillStyle='#b79070';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.beginPath();c.ellipse(0,0,8,7,0,0,TAU);c.fill();c.stroke();c.fillStyle='#29212b';c.beginPath();c.arc(-1,0,7.5,Math.PI*.54,Math.PI*1.46);c.fill();c.fillStyle=COLORS.amber;c.fillRect(1,-8,3,16);c.fillStyle=COLORS.paper;if((o.blink||0)>.96)c.fillRect(4,-2,2.5,1);else{c.beginPath();c.arc(5,-2,1,0,TAU);c.fill();}c.restore();
    const shoulderL=localPoint(o.x,o.y,a,2,-9),shoulderR=localPoint(o.x,o.y,a,2,9);let handL=localPoint(o.x,o.y,a,10,-12),handR=localPoint(o.x,o.y,a,10,12);
    if(phase==='pump'){handL=localPoint(o.x,o.y,gaze,19,-5);handR=localPoint(o.x,o.y,gaze,15,6);}else if(phase==='listen'){handL=localPoint(head.x,head.y,gaze,0,-8);}else if(phase==='gloves'){handL=localPoint(o.x,o.y,a,11,-2);handR=localPoint(o.x,o.y,a,11,2);}
    c.strokeStyle='#5d7169';c.lineWidth=6;c.lineCap='round';for(const pair of [[shoulderL,handL],[shoulderR,handR]]){c.beginPath();c.moveTo(pair[0].x,pair[0].y);c.lineTo(pair[1].x,pair[1].y);c.stroke();}c.fillStyle='#b79070';for(const hand of [handL,handR]){c.beginPath();c.arc(hand.x,hand.y,3.2,0,TAU);c.fill();}
  }

  function drawHeldWeapon(rig,key,reload=0,enemy=false){
    const c=ctx,len=Math.hypot(rig.muzzle.x-rig.rear.x,rig.muzzle.y-rig.rear.y),base=rig.baseLength||WEAPONS[key]?.length||len;c.save();c.translate(rig.rear.x,rig.rear.y);c.rotate(rig.angle);c.lineCap='round';c.lineJoin='round';
    if(key==='prybar'){
      c.strokeStyle='#9aa09a';c.lineWidth=4.2;c.beginPath();c.moveTo(-5,0);c.lineTo(len-5,0);c.quadraticCurveTo(len+2,-1,len+4,-8);c.stroke();c.strokeStyle='#4d5553';c.lineWidth=1.2;c.beginPath();c.moveTo(2,-1);c.lineTo(len-6,-1);c.stroke();
    }else if(key==='revolver'){
      c.scale(Math.max(.08,len/base),1);c.fillStyle='#4d3b30';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.fillRect(-7,1,10,10);c.strokeRect(-7,1,10,10);c.fillStyle='#7d8680';c.fillRect(-3,-4,base+3,8);c.strokeRect(-3,-4,base+3,8);c.fillStyle='#343a39';c.beginPath();c.arc(7,reload>.25&&reload<.8?6:0,6,0,TAU);c.fill();c.stroke();
    }else if(key==='shotgun'){
      c.scale(Math.max(.08,len/base),1);c.fillStyle='#594334';c.strokeStyle=COLORS.ink;c.lineWidth=2;polygon(c,[[-13,-6],[14,-5],[20,-3],[17,6],[-11,7]]);c.fill();c.stroke();const progress=reload?1-reload:0,open=Math.sin(progress*Math.PI)*.58;c.save();c.translate(15,0);c.rotate(open);c.fillStyle='#78837d';c.fillRect(0,-5,base-15,4);c.fillRect(0,2,base-15,4);c.strokeRect(0,-5,base-15,11);c.restore();
    }else{
      c.scale(Math.max(.08,len/base),1);c.fillStyle=enemy?'#656d68':'#50635e';c.strokeStyle=COLORS.ink;c.lineWidth=2;polygon(c,[[-12,-6],[29,-5],[34,-2],[31,6],[-10,7]]);c.fill();c.stroke();c.fillStyle='#252d2d';c.fillRect(10,5,10,12);c.fillRect(27,-3,Math.max(4,base-27),6);if(reload>.28&&reload<.76){c.save();c.translate(14,9+Math.sin((reload-.28)/.48*Math.PI)*8);c.rotate(.18);c.fillRect(-4,0,9,14);c.restore();}
    }
    c.restore();
  }

  function drawPlayer(p){
    const c=ctx,rig=computePlayerRig(p),gait=Math.sin(p.step*TAU),moving=Math.hypot(p.vx,p.vy)>12?1:0;
    if(p.inWater){c.strokeStyle='rgba(105,167,154,.48)';c.lineWidth=2;for(let i=0;i<2;i++){c.beginPath();c.ellipse(p.x,p.y+7,23+i*8+Math.sin(G.time*3+i)*2,8+i*3,0,0,TAU);c.stroke();}}
    c.fillStyle='rgba(8,11,13,.38)';c.beginPath();c.ellipse(p.x+4,p.y+8,23,12,p.bodyAngle*.06,0,TAU);c.fill();
    const footL=localPoint(p.x,p.y,p.bodyAngle,-6+gait*5*moving,-8),footR=localPoint(p.x,p.y,p.bodyAngle,-6-gait*5*moving,8);
    for(const foot of [footL,footR]){c.save();c.translate(foot.x,foot.y);c.rotate(p.bodyAngle);c.fillStyle='#26232c';c.strokeStyle=COLORS.ink;c.lineWidth=2.5;c.beginPath();c.ellipse(0,0,8,4.7,0,0,TAU);c.fill();c.stroke();c.restore();}
    c.save();c.translate(p.x,p.y);c.rotate(p.bodyAngle);
    if(save.upgrades.cape){c.fillStyle='rgba(48,36,58,.88)';c.strokeStyle=COLORS.ink;c.lineWidth=2;polygon(c,[[-18,-10],[-4,-14],[10,-8],[2,0],[-18,12],[-23,2]]);c.fill();c.stroke();}
    const long=p.weaponList.find(k=>k==='shotgun'||k==='carbine');if(long&&long!==rig.key){c.strokeStyle=long==='shotgun'?'#776859':'#61736d';c.lineWidth=5;c.beginPath();c.moveTo(-19,-12);c.lineTo(19,13);c.stroke();c.strokeStyle=COLORS.ink;c.lineWidth=1.5;c.stroke();}
    const packFill=clamp(p.inventory.length/Math.max(1,p.cap),0,1);c.fillStyle=packFill>.7?'#8a7150':'#806c50';c.strokeStyle=COLORS.ink;c.lineWidth=2;roundedPath(c,-17,-9,13+packFill*5,19,4);c.fill();c.stroke();c.strokeStyle=COLORS.paperDim;c.lineWidth=1;c.setLineDash([3,3]);c.strokeRect(-14,-6,8+packFill*5,13);c.setLineDash([]);
    c.fillStyle=p.invuln>0&&Math.floor(G.time*20)%2?COLORS.rust:'#4b665d';c.strokeStyle=COLORS.ink;c.lineWidth=2.5;polygon(c,[[-10,-13],[9,-11],[16,-2],[11,12],[-9,14],[-16,3]]);c.fill();c.stroke();c.fillStyle=COLORS.tealBright;c.fillRect(-5,-12,4,25);c.restore();
    const headAngle=lerpAngle(p.bodyAngle,rig.angle,.68),head=localPoint(p.x,p.y,headAngle,11,0);c.save();c.translate(head.x,head.y);c.rotate(headAngle);c.fillStyle='#b89470';c.strokeStyle=COLORS.ink;c.lineWidth=2;c.beginPath();c.ellipse(0,0,7.8,7,0,0,TAU);c.fill();c.stroke();c.fillStyle='#362b28';c.beginPath();c.arc(-1,0,7.4,Math.PI*.55,Math.PI*1.45);c.fill();c.fillStyle=COLORS.paper;c.beginPath();c.arc(4,-2.2,1,0,TAU);c.fill();if(G.area.kind==='bunker'){c.fillStyle=COLORS.tealBright;c.strokeStyle=COLORS.ink;c.lineWidth=1;c.fillRect(4,-3,4,6);c.strokeRect(4,-3,4,6);}c.restore();
    c.strokeStyle='#607970';c.lineWidth=6;c.lineCap='round';for(const pair of [[rig.leftShoulder,rig.front],[rig.rightShoulder,rig.rear]]){c.beginPath();c.moveTo(pair[0].x,pair[0].y);c.lineTo(pair[1].x,pair[1].y);c.stroke();c.strokeStyle=COLORS.ink;c.lineWidth=1.2;c.stroke();c.strokeStyle='#607970';c.lineWidth=6;}
    drawHeldWeapon(rig,rig.key,p.reload>0?clamp(p.reload/(rig.w.reload||1),0,1):0);
    c.fillStyle='#b89470';c.strokeStyle=COLORS.ink;c.lineWidth=1.2;for(const hand of [rig.rear,rig.front]){c.beginPath();c.arc(hand.x,hand.y,3.2,0,TAU);c.fill();c.stroke();}
    if(rig.key==='prybar'&&p.meleeTime>0){const progress=meleeProgress(p);if(progress>.2&&progress<.72){c.save();c.globalAlpha=Math.sin((progress-.2)/.52*Math.PI)*.26;c.strokeStyle=COLORS.paper;c.lineWidth=5;c.beginPath();c.arc(p.x,p.y,WEAPONS.prybar.length+8,p.meleeHeading-.95,rig.angle);c.stroke();c.restore();}}
    if(p.bleeding>0){c.strokeStyle=COLORS.blood;c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,23,-1.2,-.2);c.stroke();}
  }

  function drawEnemy(e){
    const c=ctx;if(!e.alive)return;c.save();c.translate(e.x,e.y);c.rotate(e.bodyAngle??e.angle);
    c.fillStyle='rgba(5,8,9,.35)';c.beginPath();c.ellipse(2,7,e.r*1.1,e.r*.55,0,0,TAU);c.fill();
    if(e.type==='hound'){
      c.fillStyle=e.hit>0?COLORS.rust:'#51453d';c.strokeStyle=COLORS.ink;c.lineWidth=2.5;polygon(c,[[-17,-8],[1,-12],[17,-5],[21,1],[10,6],[2,13],[-14,9],[-22,3]]);c.fill();c.stroke();c.fillStyle='#6e5a48';polygon(c,[[10,-4],[25,-10],[21,3],[12,5]]);c.fill();c.stroke();c.fillStyle=COLORS.blood;c.beginPath();c.arc(21,-4,2,0,TAU);c.fill();for(const sx of [-1,1]){c.strokeStyle='#2a2526';c.lineWidth=4;c.beginPath();c.moveTo(-9,sx*6);c.lineTo(-16,sx*12);c.stroke();}
    }else if(e.type==='wader'){
      c.fillStyle=e.hit>0?COLORS.rust:'#596550';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.beginPath();c.ellipse(0,0,19,25,.2,0,TAU);c.fill();c.stroke();c.fillStyle='#78835d';c.beginPath();c.arc(15,-6,11,0,TAU);c.fill();c.stroke();c.fillStyle=COLORS.hazard;for(const p of [[8,-12],[2,7],[-8,-5],[17,-2]]){c.beginPath();c.arc(p[0],p[1],2.5,0,TAU);c.fill();}c.strokeStyle='#424a3c';c.lineWidth=6;c.beginPath();c.moveTo(-8,13);c.lineTo(-21,24);c.moveTo(5,17);c.lineTo(10,29);c.stroke();
    }else{
      const profile=e.profile||scavProfile(e.id),bulk=profile.bulk||1;if(profile.pack){c.fillStyle='#352f31';c.strokeStyle=COLORS.ink;c.lineWidth=2;roundedPath(c,-18,-10,14,20,4);c.fill();c.stroke();}
      c.fillStyle=e.hit>0?COLORS.rust:profile.coat;c.strokeStyle=COLORS.ink;c.lineWidth=3;polygon(c,[[-12*bulk,-12],[8,-11],[16,-2],[10,13],[-10,14],[-17,2]]);c.fill();c.stroke();c.fillStyle=profile.trim;c.fillRect(-4,-11,4,24);
      c.fillStyle='#b28c6d';c.beginPath();c.ellipse(10,0,7.5,7,0,0,TAU);c.fill();c.stroke();if(profile.hood){c.strokeStyle='#2f2c31';c.lineWidth=4;c.beginPath();c.arc(8,0,9,Math.PI*.55,Math.PI*1.45);c.stroke();}
      c.fillStyle=COLORS.blood;c.beginPath();c.arc(13,-2,1.5,0,TAU);c.fill();
    }
    c.restore();
    if(e.type==='scav'){
      const rig=computeEnemyRig(e),body=e.bodyAngle??e.angle,left=localPoint(e.x,e.y,body,2,-9),right=localPoint(e.x,e.y,body,2,9);c.strokeStyle=e.profile?.coat||'#4a4749';c.lineWidth=5.5;c.lineCap='round';for(const pair of [[left,rig.front],[right,rig.rear]]){c.beginPath();c.moveTo(pair[0].x,pair[0].y);c.lineTo(pair[1].x,pair[1].y);c.stroke();}drawHeldWeapon(rig,'carbine',0,true);c.fillStyle='#b28c6d';for(const hand of [rig.rear,rig.front]){c.beginPath();c.arc(hand.x,hand.y,3,0,TAU);c.fill();}
      if(e.aim>0){c.strokeStyle=`rgba(189,64,89,${.15+e.aim*.55})`;c.lineWidth=1.25;c.setLineDash([5,8]);c.beginPath();c.moveTo(rig.muzzle.x,rig.muzzle.y);c.lineTo(rig.muzzle.x+Math.cos(rig.angle)*Math.min(560,dist(e,G.player)+80),rig.muzzle.y+Math.sin(rig.angle)*Math.min(560,dist(e,G.player)+80));c.stroke();c.setLineDash([]);}
    }
    if(e.alert>.15){ctx.fillStyle='rgba(11,16,18,.72)';ctx.fillRect(e.x-18,e.y-e.r-17,36,4);ctx.fillStyle=e.aim>.6?COLORS.blood:COLORS.amber;ctx.fillRect(e.x-18,e.y-e.r-17,36*clamp(e.hp/(e.type==='hound'?48:e.type==='wader'?82:68),0,1),4);}
  }

  function drawDecals(){for(const d of G.decals){if(d.type==='blood'){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(hash(d.seed,2,7)*TAU);ctx.fillStyle='rgba(91,30,51,.48)';ctx.beginPath();for(let i=0;i<9;i++){const a=i/9*TAU,r=d.r*(.55+hash(i,d.seed,4)*.55);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.58);}ctx.closePath();ctx.fill();ctx.restore();}}}
  function drawProjectiles(){
    for(const b of G.bullets){ctx.strokeStyle=b.color;ctx.lineWidth=b.r;ctx.beginPath();ctx.moveTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const p of G.particles){const t=clamp(p.life/p.max,0,1);ctx.save();ctx.globalAlpha=t;ctx.translate(p.x,p.y);
      if(p.type==='flash'){ctx.globalCompositeOperation='screen';ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size*t,0,TAU);ctx.fill();}
      else if(p.type==='arc'){ctx.strokeStyle=p.color;ctx.lineWidth=4*t;ctx.rotate(p.angle);ctx.beginPath();ctx.arc(0,0,p.size,-.65,.65);ctx.stroke();}
      else if(p.type==='ripple'){ctx.strokeStyle=p.color;ctx.lineWidth=1.5*t;ctx.beginPath();ctx.ellipse(0,0,p.size*(1.25-t*.25),p.size*.34*(1.25-t*.25),0,0,TAU);ctx.stroke();}
      else{ctx.fillStyle=p.color;if(p.type==='spark'){ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillRect(-p.size*2,-p.size/2,p.size*4,p.size);}else if(p.type==='contact'){ctx.beginPath();ctx.ellipse(0,0,p.size*(1+t),p.size*.45,0,0,TAU);ctx.fill();}else if(p.type==='casing'){ctx.rotate(G.time*18+p.x);ctx.fillRect(-p.size*1.5,-p.size*.42,p.size*3,p.size*.84);}else if(p.type==='magazine'){ctx.rotate(G.time*6+p.y);ctx.fillRect(-p.size*.45,-p.size,p.size*.9,p.size*2);}else{ctx.beginPath();ctx.arc(0,0,p.size*t,0,TAU);ctx.fill();}}
      ctx.restore();
    }
  }

  function drawSoundCues(){
    for(const s of G.soundMarks){if(onScreenWorld(s.x,s.y,0)){ctx.strokeStyle=`rgba(228,170,69,${s.life*.18})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,s.y,s.r*(1-s.life),0,TAU);ctx.stroke();}}
    resetTransform();for(const s of G.soundMarks){if(onScreenWorld(s.x,s.y,0))continue;const dx=s.x-G.player.x,dy=s.y-G.player.y,a=Math.atan2(dy,dx),cx=G.w/2+Math.cos(a)*Math.min(G.w*.38,260),cy=G.h/2+Math.sin(a)*Math.min(G.h*.34,190);ctx.save();ctx.translate(cx,cy);ctx.rotate(a);ctx.strokeStyle=`rgba(228,170,69,${s.life*.7})`;ctx.lineWidth=2;for(let r=8;r<24;r+=7){ctx.beginPath();ctx.arc(0,0,r,-.7,.7);ctx.stroke();}ctx.restore();}
  }

  function drawCrosshair(){
    if(!G.player||G.player.camp)return;const p=G.player,rig=computePlayerRig(p),w=rig.w;let range=95;
    if(rig.key==='prybar')range=Math.hypot(rig.muzzle.x-p.x,rig.muzzle.y-p.y);else if(p.lastAimSource==='mouse'){const target=screenToWorld(input.mouse.x,input.mouse.y);range=clamp(Math.hypot(target.x-p.x,target.y-p.y),75,480);}
    const world=rig.key==='prybar'?rig.muzzle:localPoint(rig.muzzle.x,rig.muzzle.y,rig.angle,Math.max(0,range-Math.hypot(rig.muzzle.x-p.x,rig.muzzle.y-p.y)),0),pos=worldToScreen(world.x,world.y);
    resetTransform();const turnError=Math.abs(angleDelta(p.weaponAngle,p.aimAngle)),bloom=(w.spread||.02)*180+3+turnError*14+rig.obstruction*8;ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(G.time*.18);ctx.strokeStyle=p.wallObstruction&&rig.obstruction>.05?COLORS.rust:rig.key==='shotgun'?COLORS.rust:COLORS.paper;ctx.globalAlpha=.82;ctx.lineWidth=1.5;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(bloom,0);ctx.lineTo(bloom+6,0);ctx.stroke();}ctx.fillStyle=turnError<.11?COLORS.amber:COLORS.paperDim;ctx.beginPath();ctx.arc(0,0,1.5,0,TAU);ctx.fill();ctx.restore();
  }

  function drawMiniMap(){
    if(!save.upgrades.survey||G.area?.kind!=='lowland')return;resetTransform();const w=154,h=92,x=G.w-w-16,y=Math.min(90+parseFloat(getComputedStyle(document.documentElement).fontSize),G.h-h-150);ctx.fillStyle='rgba(23,21,31,.84)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(238,228,198,.25)';ctx.strokeRect(x,y,w,h);ctx.strokeStyle='rgba(105,167,154,.22)';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x+i*w/4,y);ctx.lineTo(x+i*w/4,y+h);ctx.stroke();}
    const mark=(wx,wy,color,r=3)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+wx/G.area.w*w,y+wy/G.area.h*h,r,0,TAU);ctx.fill();};mark(G.player.x,G.player.y,COLORS.paper,3.5);mark(130,900,COLORS.rust,4);mark(2310,1050,COLORS.amber,4);if(save.finalChoice==='relay')mark(2400,200,COLORS.tealBright,4);ctx.fillStyle=COLORS.paperDim;ctx.font='8px monospace';ctx.fillText('SURVEY TABLE / LIVE TRACE',x+7,y+12);
  }

  function drawLighting(){
    resetTransform();const c=ctx,hour=(save.minutes%1440)/60,isBunker=G.area.kind==='bunker',dark=isBunker ? .76 : (hour<6||hour>20 ? .54 : hour<8||hour>18 ? .25 : .075);
    c.save();c.fillStyle=isBunker?`rgba(8,11,14,${dark})`:`rgba(39,26,48,${dark})`;c.fillRect(0,0,G.w,G.h);
    const lights=(G.area.lights||[]).filter(l=>l.on!==false).slice();
    for(const p of G.particles){if(p.type!=='flash'||p.life<=0)continue;const clip=isBunker?G.area.floors.find(f=>pointInRect(p.x,p.y,f,0)):null;lights.push({x:p.x,y:p.y,r:54+32*(p.life/p.max),color:p.color===COLORS.rust?'rgba(196,94,63,.3)':p.color===COLORS.blood?'rgba(189,64,89,.24)':'rgba(228,170,69,.28)',kind:'muzzle',...(clip?{clip}:{})});}
    if(isBunker){const floor=G.area.floors.find(f=>pointInRect(G.player.x,G.player.y,f,0));if(floor)lights.push({x:G.player.x,y:G.player.y,r:182,color:'rgba(238,228,198,.13)',kind:'headlamp',clip:floor});}
    c.globalCompositeOperation='screen';c.globalAlpha=isBunker?1:clamp(.48+dark,0,1);
    for(const light of lights){const p=worldToScreen(light.x,light.y),flicker=light.kind==='fire'?1+Math.sin(G.time*8.3+light.x)*.035:1,r=light.r*G.camera.zoom*flicker;if(p.x+r<0||p.y+r<0||p.x-r>G.w||p.y-r>G.h)continue;c.save();if(light.clip){const a=worldToScreen(light.clip.x,light.clip.y),b=worldToScreen(light.clip.x+light.clip.w,light.clip.y+light.clip.h);c.beginPath();c.rect(a.x,a.y,b.x-a.x,b.y-a.y);c.clip();}const g=c.createRadialGradient(p.x,p.y,light.kind==='headlamp'?9:4,p.x,p.y,r);g.addColorStop(0,light.color);g.addColorStop(.32,light.color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(p.x-r,p.y-r,r*2,r*2);c.restore();}
    c.restore();
    const vignette=c.createRadialGradient(G.w/2,G.h/2,Math.min(G.w,G.h)*.28,G.w/2,G.h/2,Math.max(G.w,G.h)*.72);vignette.addColorStop(0,'rgba(11,16,18,0)');vignette.addColorStop(1,`rgba(11,16,18,${isBunker ? .34 : .28})`);c.fillStyle=vignette;c.fillRect(0,0,G.w,G.h);
    if(G.player.exposure>15){ctx.fillStyle=`rgba(182,214,74,${(G.player.exposure-15)/1000})`;ctx.fillRect(0,0,G.w,G.h);}
  }

  function drawWorld(){
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=COLORS.void;ctx.fillRect(0,0,canvas.width,canvas.height);if(!G.area||!G.player){drawAttract();return;}
    G.camera.zoom=clamp(Math.min(G.w/900,G.h/620),G.touch?.7:.72,1.18);prepareCameraShake();setWorldTransform();drawGround(G.area);drawDecals();
    for(const d of G.area.decor)if(onScreenWorld(d.x,d.y,50))drawDecor(d);
    const list=[];for(const o of G.area.objects)if(o.active&&onScreenWorld(o.r!=null?o.x:o.x+o.w/2,o.r!=null?o.y:o.y+o.h/2,Math.max(o.r||0,o.w||0,o.h||0)+60))list.push({z:o.z||((o.y||0)+(o.h||0)),kind:'object',o});
    for(const e of G.area.enemies)if(e.alive&&onScreenWorld(e.x,e.y,80))list.push({z:e.y+e.r,kind:'enemy',o:e});list.push({z:G.player.y+G.player.r,kind:'player',o:G.player});list.sort((a,b)=>a.z-b.z);
    for(const d of list){if(d.kind==='object')drawObject(d.o);else if(d.kind==='enemy')drawEnemy(d.o);else drawPlayer(d.o);}
    drawProjectiles();drawSoundCues();drawLighting();drawCrosshair();drawMiniMap();
    if(G.transition!==0){resetTransform();ctx.fillStyle=`rgba(11,16,18,${G.transition>0?clamp(G.transition,0,1):clamp(-G.transition,0,1)})`;ctx.fillRect(0,0,G.w,G.h);}
  }

  function resize(){
    G.w=Math.max(320,innerWidth);G.h=Math.max(320,innerHeight);G.dpr=Math.min(2,Math.max(1,devicePixelRatio||1));
    canvas.width=Math.floor(G.w*G.dpr);canvas.height=Math.floor(G.h*G.dpr);canvas.style.width=`${G.w}px`;canvas.style.height=`${G.h}px`;ctx.imageSmoothingEnabled=true;
  }

  const touchResetters=[];
  function bindStick(node,key){
    let pointer=null,touchId=null;
    const set=(cx,cy)=>{const r=node.getBoundingClientRect(),x=cx-(r.left+r.width/2),y=cy-(r.top+r.height/2),len=Math.hypot(x,y),max=r.width*.34,nx=len>max?x/len*max:x,ny=len>max?y/len*max:y;input[key].x=nx/max;input[key].y=ny/max;node.firstElementChild.style.transform=`translate(${nx}px,${ny}px)`;setInputDevice('touch',key==='aimStick');if(key==='aimStick'){input.aimOwner='touch';input.touchFire=len>max*.4;}else input.moveOwner='touch';};
    const clear=e=>{if(e&&e.pointerId!=null&&pointer!=null&&e.pointerId!==pointer)return;pointer=null;touchId=null;input[key].x=0;input[key].y=0;node.firstElementChild.style.transform='translate(0,0)';if(key==='aimStick')input.touchFire=false;};
    touchResetters.push(clear);
    if(window.PointerEvent){
      node.addEventListener('pointerdown',e=>{if(pointer!=null)return;e.preventDefault();pointer=e.pointerId;node.setPointerCapture?.(pointer);set(e.clientX,e.clientY);sound.unlock();});
      node.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();set(e.clientX,e.clientY);}});
      node.addEventListener('pointerup',clear);node.addEventListener('pointercancel',clear);node.addEventListener('lostpointercapture',clear);
    }else{
      node.addEventListener('touchstart',e=>{if(touchId!=null)return;e.preventDefault();const t=e.changedTouches[0];touchId=t.identifier;set(t.clientX,t.clientY);sound.unlock();},{passive:false});
      node.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===touchId){e.preventDefault();set(t.clientX,t.clientY);}},{passive:false});
      node.addEventListener('touchend',e=>{for(const t of e.changedTouches)if(t.identifier===touchId)clear();},{passive:false});node.addEventListener('touchcancel',clear,{passive:false});
    }
  }

  function bindAction(node,action){
    if(window.PointerEvent)node.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();setInputDevice('touch');sound.unlock();input.queue(action,'touch');});
    else node.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();setInputDevice('touch');sound.unlock();input.queue(action,'touch');},{passive:false});
  }

  function clearTransientInput(){
    input.keys.clear();input.pressed.clear();input.actions.clear();input.mouse.down=false;input.mouse.active=false;input.touchFire=false;input.pad=null;input.moveOwner=input.device==='touch'?'touch':'keyboard';input.aimOwner='move';
    for(const reset of touchResetters)reset();controller.suspend();
  }

  window.addEventListener('keydown',e=>{
    if(e.target instanceof Element&&e.target.closest('input,select')&&e.code!=='Escape')return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code))e.preventDefault();
    sound.unlock();setInputDevice('keyboard');
    if(e.code==='Escape'){
      if(!e.repeat)input.queue(G.panel?'cancel':'pause','keyboard');return;
    }
    if(G.mode!=='play'||G.panel)return;
    const fresh=!input.keys.has(e.code);input.keys.add(e.code);if(!fresh)return;input.pressed.add(e.code);
    if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))input.moveOwner='keyboard';
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))input.aimOwner='keyboard';
    if(e.code==='KeyE')input.queue('use','keyboard');
    if(e.code==='KeyR')input.queue('reload','keyboard');
    if(e.code==='KeyQ')input.queue('swap','keyboard');
    if(e.code==='Tab')input.queue('pack','keyboard');
  });
  window.addEventListener('keyup',e=>input.keys.delete(e.code));
  window.addEventListener('blur',()=>{if(G.mode==='play')showPause('focus');else{clearTransientInput();sound.suspend();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(G.mode==='play')showPause('focus');else{clearTransientInput();sound.suspend();}}});
  window.addEventListener('gamepaddisconnected',e=>{const active=controller.status.index===e.gamepad.index;controller.disconnect(e.gamepad.index);if(active&&G.mode==='play')showPause('focus');});

  const mouseMove=e=>{const dx=e.clientX-input.mouse.x,dy=e.clientY-input.mouse.y;input.mouse.x=e.clientX;input.mouse.y=e.clientY;if(Math.hypot(dx,dy)>2){input.mouse.active=true;input.aimOwner='mouse';setInputDevice('mouse',true);}};
  if(window.PointerEvent){
    canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')mouseMove(e);});
    canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){input.mouse.down=true;input.mouse.x=e.clientX;input.mouse.y=e.clientY;input.mouse.active=true;input.aimOwner='mouse';setInputDevice('mouse',true);sound.unlock();}});
    window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'&&e.button===0)input.mouse.down=false;});
    window.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')input.mouse.down=false;});
  }else{
    canvas.addEventListener('mousemove',mouseMove);canvas.addEventListener('mousedown',e=>{if(e.button===0){input.mouse.down=true;input.mouse.active=true;input.aimOwner='mouse';setInputDevice('mouse',true);sound.unlock();}});window.addEventListener('mouseup',()=>input.mouse.down=false);
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());

  function controllerUI(){
    const s=controller.status,connected=s.id!==undefined,focused=!document.hidden&&(!document.hasFocus||document.hasFocus());
    const message=s.kind==='blocked'?'Controller access is blocked in this page. Open the game directly.':s.kind==='unavailable'?'Controller access is unavailable in this browser.':!connected?'No controller detected. Click inside the game, then press a controller button.':!focused?'Controller connected. Click inside the game to play.':s.kind==='unmapped'?'Controller detected, but its layout is not recognized.':s.raw?'Controller connected · using your standard-order fallback.':'Controller connected · standard layout.';
    $('controller-status').textContent=s.firefoxCandidate?(s.firefoxMapped?'Firefox controller ready · measured button map loaded.':'Firefox SN30 detected · measure its buttons below.')+(s.firefoxSN30?' Stick correction active.':' Move each stick once to identify its report.'):message;
    const ua=navigator.userAgent||'',browserTag=ua.match(/(?:Firefox|Edg|Chrome)\/[\d.]+/)?.[0]||(/Safari/.test(ua)?'Safari '+(ua.match(/Version\/([\d.]+)/)?.[1]||''):'Browser');
    $('controller-device').textContent=connected?`${s.id} · slot ${s.index+1} · ${s.count} detected · ${browserTag} · ${s.mapping}`:'';
    $('controller-live').textContent=connected?`Axes ${s.rawAxes.map((v,i)=>`${i}:${String(v)}`).join(' / ')||'none'} · active buttons ${s.values.flatMap((v,i)=>v>.25?[i+1]:[]).join(', ')||'none'}${s.firefoxSN30?' · corrected '+s.axes.map(v=>v.toFixed(3)).join(' / '):''}`:'';
    $('controller-raw-label').classList.toggle('hidden',!connected||s.mapping==='standard'||s.firefoxCandidate);$('controller-raw').checked=!!s.raw;
    $('firefox-buttons').classList.toggle('hidden',!s.firefoxCandidate&&!buttonSetup);$('firefox-setup').classList.toggle('hidden',!!buttonSetup);$('firefox-setup-prep').classList.toggle('hidden',!!buttonSetup);$('firefox-setup-progress').classList.toggle('hidden',!buttonSetup);
    $('firefox-setup').textContent=s.firefoxMapped?'REDO FIREFOX BUTTON SETUP':'SET UP FIREFOX BUTTONS';$('firefox-setup-note').textContent=buttonSetupNote;
    if(buttonSetup){$('firefox-setup-prompt').textContent=`${buttonSetup.step+1} / ${FIREFOX_BUTTON_STEPS.length} · PRESS AND RELEASE ${buttonSetup.label.toUpperCase()}`;$('firefox-setup-message').textContent=buttonSetup.message;$('firefox-setup-released').classList.toggle('hidden',buttonSetup.phase!=='holding');}
    $('controller-intro').textContent=s.firefoxCandidate&&!s.firefoxMapped?'Firefox SN30 needs button setup · open Controls.':connected?(s.kind==='unmapped'?'Controller layout unrecognized · open Controls.':'Controller ready · left/right sticks move/aim · RT attacks.'):'Controller: click the game, then press a button.';
  }
  function cancelButtonSetup(message='Setup canceled. Your previous mapping is unchanged.'){buttonSetup=null;buttonSetupNote=message;controller.endSetup();controllerUI();}
  function finishButtonSetup(){
    const profile=buttonSetup.profile;controller.setFirefoxProfile(profile);buttonSetup=null;controller.endSetup();
    try{localStorage.setItem(FIREFOX_PROFILE_KEY,JSON.stringify([...controller.firefoxProfiles.values()]));buttonSetupNote='Buttons saved in Firefox. View opens the pack; L3 remains unassigned.';}
    catch(_){buttonSetupNote='Buttons work for this session; browser storage is unavailable.';}controllerUI();
  }
  function pollGamepad(now){
    const focused=!document.hidden&&(!document.hasFocus||document.hasFocus());
    const pad=controller.poll(typeof navigator.getGamepads==='function'?()=>navigator.getGamepads():null,focused);
    if(buttonSetup){
      if(!focused){cancelButtonSetup('Setup canceled when the game lost focus.');input.pad=null;return;}
      buttonSetup.update(controller.status,now);if(buttonSetup.lost)cancelButtonSetup(buttonSetup.message);else if(buttonSetup.done)finishButtonSetup();input.pad=null;return;
    }
    input.pad=pad;
    if(pad){
      if(pad.intent)setInputDevice('gamepad');
      if(Math.hypot(pad.move.x,pad.move.y)>.01&&(pad.intent||input.moveOwner==='gamepad'))input.moveOwner='gamepad';
      if(Math.hypot(pad.aim.x,pad.aim.y)>.01&&(pad.intent||input.aimOwner==='gamepad')){input.aimOwner='gamepad';setInputDevice('gamepad',true);}
      if(pad.pause)input.queue('pause','gamepad');if(pad.use)input.queue('use','gamepad');if(pad.cancel)input.queue('cancel','gamepad');if(pad.reload)input.queue('reload','gamepad');if(pad.swap)input.queue('swap','gamepad');if(pad.pack)input.queue('pack','gamepad');
      if(G.panel||G.mode!=='play'){if(pad.navLeft)moveFocus(-1,0);if(pad.navRight)moveFocus(1,0);if(pad.navUp)moveFocus(0,-1);if(pad.navDown)moveFocus(0,1);}
    }
    if(now-lastControllerUI>100){controllerUI();lastControllerUI=now;}
  }

  bindStick($('move-stick'),'moveStick');bindStick($('aim-stick'),'aimStick');
  bindAction($('touch-use'),'use');bindAction($('touch-reload'),'reload');bindAction($('touch-swap'),'swap');bindAction($('touch-pack'),'pack');

  $('continue-btn').addEventListener('click',()=>{clearTransientInput();sound.unlock();G.mode='play';showScreen(null);setPlayUI(true);save.prologueDone?loadCamp('FIELD RECORD RESUMED'):loadPrologue();});
  $('new-btn').addEventListener('click',()=>{sound.unlock();showScreen('story-screen');});
  $('begin-btn').addEventListener('click',()=>{clearTransientInput();const soundPref=save.sound;save=defaultSave();save.sound=soundPref;persist();sound.unlock();if(sound.master)sound.master.gain.value=save.sound ? .34 : 0;G.mode='play';showScreen(null);setPlayUI(true);loadPrologue();toast('YOU OWN ALMOST NOTHING · FOLLOW THE SURVEY STAKES',3.2);});
  $('retry-btn').addEventListener('click',()=>{clearTransientInput();sound.unlock();G.mode='play';showScreen(null);setPlayUI(true);loadCamp('YOU MADE IT BACK WITH WHAT WAS SECURED.');});
  $('controls-btn').addEventListener('click',()=>showPause());$('pause-btn').addEventListener('click',()=>showPause());$('resume-btn').addEventListener('click',resumePause);
  $('panel-close').addEventListener('click',closePanel);
  $('sound-btn').addEventListener('click',()=>{save.sound=!save.sound;persist();if(save.sound)sound.unlock();else if(sound.master)sound.master.gain.value=0;if(save.sound&&sound.master)sound.master.gain.value=.34;});
  document.querySelectorAll('.choice').forEach(b=>b.addEventListener('click',()=>resolveChoice(b.dataset.choice)));
  $('controller-raw').addEventListener('change',()=>{const s=controller.status;if(!s.id)return;controller.useRaw(s.id,$('controller-raw').checked);try{localStorage.setItem(CONTROL_LAYOUT_KEY,JSON.stringify([...controller.allowRaw]));}catch(_){}controllerUI();});
  $('firefox-setup').addEventListener('click',()=>{const s=controller.status;if(!s.firefoxCandidate)return;buttonSetup=new FirefoxButtonSetup(s);buttonSetupNote='';controller.startSetup(s.index);controllerUI();});
  $('firefox-setup-released').addEventListener('click',()=>{if(!buttonSetup)return;buttonSetup.confirmRelease(controller.status);if(buttonSetup.done)finishButtonSetup();else controllerUI();});
  $('firefox-setup-cancel').addEventListener('click',()=>cancelButtonSetup());
  window.addEventListener('resize',resize,{passive:true});

  let accumulator=0;
  function loop(ts){
    pollGamepad(ts);if(!G.last)G.last=ts;let frame=Math.min(.05,(ts-G.last)/1000);G.last=ts;accumulator+=frame;
    while(accumulator>=1/60){update(1/60);accumulator-=1/60;}
    drawWorld();requestAnimationFrame(loop);
  }

  resize();refreshTitle();setInputDevice(input.device);controllerUI();setPlayUI(false);showScreen('title-screen');setInterval(ambientTick,1750);requestAnimationFrame(loop);
})();
