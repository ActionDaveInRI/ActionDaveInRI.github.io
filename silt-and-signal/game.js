(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  let ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
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
    regulator: { name: 'Pressure regulator', short: 'REGULATOR', use: 'Waterworks objective · visibly lashed to your pack', stack: 1, weight: 4, quest: true },
    relaycell: { name: 'Ceramic power cell', short: 'POWER CELL', use: 'Fit at Nine-Mile pump or rescue beacon', stack: 1, weight: 1.6 },
    shotgun: { name: 'Break-action shotgun', short: '12-GAUGE', use: 'A loud, decisive close-range tool', stack: 1, weight: 3.5, weapon: 'shotgun' },
    carbine: { name: '5.56 patrol carbine', short: 'CARBINE', use: 'Controllable fire at middle distance', stack: 1, weight: 3, weapon: 'carbine' },
    colt: { name: '.45 Colt trail revolver', short: '.45 COLT', use: 'Heavy, deliberate six-shooter', stack:1, weight:1.2, weapon:'colt' },
    field410: { name: '.410 folding single-shot', short: '.410', use: 'Light hunting gun · one shot before reloading', stack:1, weight:2.1, weapon:'field410' },
    pistol9: { name: '9mm service pistol', short:'9MM', use:'Quick follow-ups · twelve-round magazine', stack:1, weight:.9, weapon:'pistol9' },
    coltWreck:{name:'Seized .45 Colt revolver',short:'.45 PROJECT',use:'Restore at the shelter workbench',stack:1,weight:1.2},
    field410Wreck:{name:'Damaged .410 single-shot',short:'.410 PROJECT',use:'Restore at the shelter workbench',stack:1,weight:2.1},
    pistol9Wreck:{name:'Damaged 9mm pistol',short:'9MM PROJECT',use:'Restore at the shelter workbench',stack:1,weight:.9},
    burnerSalvage:{name:'Sealed incendiary salvage',short:'INCENDIARY SALVAGE',use:'Recover and bank for fire-bottle projects',stack:2,weight:.7},
    demoSalvage:{name:'Sealed demolition salvage',short:'DEMOLITION SALVAGE',use:'Recover and bank for remote-charge projects',stack:2,weight:1},
    firebottle:{name:'Fire bottle',short:'FIRE BOTTLE',use:'Wield, aim and fire to throw · burns for 6 seconds · harms you too',stack:2,weight:.8,tool:'firebottle'},
    charge:{name:'Remote charge',short:'REMOTE CHARGE',use:'Fire to throw; fire again to detonate · one deployed at a time',stack:2,weight:1.2,tool:'charge'}
  };

  const WEAPONS = {
    prybar: { name: 'PRY BAR', ammo: null, mag: 0, delay: .48, damage: 34, range: 68, length: 42, turn: 8.4, sound: .35, condition: 'SOLID STEEL', melee: true },
    revolver: { name: '.22 SERVICE REVOLVER', ammo: 'ammo22', mag: 6, delay: .32, damage: 27, range: 650, speed: 1050, spread: .024, reload: 1.75, sound: .66, length: 19, artLength:30, turn: 19, recoil: 3.5, color: COLORS.amber },
    shotgun: { name: 'BREAK-ACTION 12-GAUGE', ammo: 'shells', mag: 2, delay: .72, damage: 14, pellets: 7, range: 330, speed: 920, spread: .17, reload: 2.35, sound: 1, length: 39, artLength:57, turn: 13, recoil: 9, color: COLORS.rust },
    carbine: { name: '5.56 PATROL CARBINE', ammo: 'carbineAmmo', mag: 12, delay: .145, damage: 21, range: 700, speed: 1200, spread: .042, reload: 2.05, sound: .86, length: 37, artLength:55, turn: 16, recoil: 5, color: COLORS.tealBright },
    colt:{name:'.45 COLT TRAIL REVOLVER',ammo:'ammo45',mag:6,delay:.52,damage:47,range:590,speed:940,spread:.029,reload:2.45,sound:.84,length:25,artLength:36,turn:15,recoil:7,color:COLORS.amber},
    field410:{name:'.410 FOLDING SINGLE-SHOT',ammo:'shells410',mag:1,delay:.64,damage:13,pellets:5,range:300,speed:890,spread:.12,reload:1.42,sound:.76,length:36,artLength:57,turn:17,recoil:6,color:COLORS.rust},
    pistol9:{name:'9MM SERVICE PISTOL',ammo:'ammo9',mag:12,delay:.21,damage:25,range:550,speed:1080,spread:.036,reload:1.45,sound:.74,length:18,artLength:29,turn:22,recoil:4,color:COLORS.tealBright},
    firebottle:{name:'FIRE BOTTLE',tool:true,ammo:null,mag:0,delay:.6,range:260,length:13,turn:19,color:COLORS.rust},
    charge:{name:'REMOTE CHARGE',tool:true,ammo:null,mag:0,delay:.5,range:260,length:12,turn:19,color:COLORS.amber}
  };
  const AMMO_KEYS=['ammo22','ammo45','shells410','ammo9','shells','carbineAmmo'];
  const SIDEARMS=['revolver','colt','pistol9'],LONG_GUNS=['field410','shotgun','carbine'];
  const firearmKeys=[...SIDEARMS,...LONG_GUNS];
  const PROVISIONS=['bandage','medicine','cleanwater','relaycell','firebottle','charge'];
  const weaponFamily=key=>key==='colt'?'revolver':key==='field410'?'shotgun':key;

  const defaultSave = () => ({
    version: 1, day: 1, minutes: 490, prologueDone: false,
    prologue: { satchel: false, fuse: false, cloth: false },
    contractAccepted: false, regulatorBanked: false, finalChoice: null,
    campLevel: 1, packSize: 4, upgrades: { bag: false, cape: false, survey: false, medroll: false, helmet: false, vest: false, respirator: false },
    kit: {}, fittings: {}, weaponMods: {}, trackedRecipe: null, story: { surveyor: false, pump: false, beacon: false },
    stash: { parts: 1, cloth: 0, medicine: 1, cleanwater: 1, bandage: 0, ammo22: 0, ammo45:0, shells410:0, ammo9:0, coltWreck:0,field410Wreck:0,pistol9Wreck:0, shells: 0, carbineAmmo: 0 },
    prepared: { bandage: false, medicine: false, cleanwater: false, relaycell: false, firebottle:false,charge:false },
    weapons: { revolver: false, shotgun: false, carbine: false, colt:false,field410:false,pistol9:false },
    condition: { revolver: 84, shotgun: 72, carbine: 68,colt:72,field410:72,pistol9:72 },
    selectedLong: null,selectedSide:'revolver',
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
        skills: Object.assign(base.skills, raw.skills || {}),
        kit: Object.assign(base.kit, raw.kit || {}),
        fittings: Object.assign(base.fittings, raw.fittings || {}),
        weaponMods: Object.assign(base.weaponMods, raw.weaponMods || {}),
        story: Object.assign(base.story, raw.story || {})
      });
    } catch (_) { return defaultSave(); }
  }

  let save = loadSave();
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) {} refreshTitle(); };

  const G = {
    w: innerWidth, h: innerHeight, dpr: 1, time: 0, dt: 0, last: 0,
    mode: 'title', area: null, player: null, camera: { x: 0, y: 0, zoom: 1, shake: 0, shakeX: 0, shakeY: 0 },
    bullets: [], particles: [], decals: [], soundMarks: [], fieldEffects:[], nearest: null,
    lowland: null, bunker: null, extraction: null, returnPos: null, transition: 0, transitionTask: null,
    panel: null, screen: 'title-screen', toastTimer: 0, weather: 0, seed: 1, runActive: false,
    touch: matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0,
    viewport: null, benchCategory: 'arms', benchSelection: 'wrap', benchNotice: ''
  };

  function viewportProfile(width,height,touch=false,requestedDpr=1){
    const w=Math.max(320,Math.round(width||320)),h=Math.max(320,Math.round(height||320)),aspect=w/h;
    const portrait=aspect<.82,shortLandscape=!portrait&&h<600,wide=aspect>2.05;
    let zoom;
    if(portrait)zoom=Math.max(w/410,h/850);
    else if(shortLandscape)zoom=Math.max(h/500,w/1150);
    else zoom=Math.max(h/620,w/1600);
    zoom=Math.max(.58,zoom);
    const pixelBudget=touch?5500000:10000000,rawDpr=clamp(requestedDpr||1,1,2);
    const dpr=Math.min(rawDpr,Math.sqrt(pixelBudget/(w*h)));
    return {w,h,aspect,portrait,shortLandscape,wide,kind:portrait?'portrait':shortLandscape?'short-landscape':wide?'wide':'standard',zoom,dpr,biasPixels:touch?(portrait?Math.min(64,h*.075):shortLandscape?16:28):0};
  }

  const input = {
    keys: new Set(), pressed: new Set(), mouse: { x: innerWidth / 2, y: innerHeight / 2, down: false, active: false },
    moveStick: { x: 0, y: 0 }, aimStick: { x: 0, y: 0 }, touchFlash:0, touchGesture:null, touchAttack:null,
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
      if(key==='colt'){this.burst(.18,.31,1050,x);this.tone(88,.22,'square',.11,.4,x);return;}
      if(key==='field410'){this.burst(.17,.27,1100,x);this.tone(104,.18,'sawtooth',.09,.4,x);return;}
      if(key==='pistol9'){this.burst(.09,.23,1950,x);this.tone(148,.11,'square',.07,.48,x);return;}
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
    if(changed&&device==='touch'){input.mouse.down=false;input.keys.delete('Space');input.pad=null;}
    if(changed&&device!=='touch'){for(const reset of touchResetters)reset();input.touchAttack=null;input.touchFlash=0;if(input.moveOwner==='touch')input.moveOwner=device==='gamepad'?'gamepad':'keyboard';if(input.aimOwner==='touch')input.aimOwner='move';}
    if(device==='touch')G.touch=true;
    document.body.classList.toggle('input-gamepad', device === 'gamepad');
    document.body.dataset.input = device;
    if(device!=='touch'){input.touchSprint=false;$('touch-run').textContent='WALK';$('touch-run').setAttribute('aria-pressed','false');}
    $('touch-ui').classList.toggle('hidden',!(G.mode==='play'&&G.touch&&device==='touch'));
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
    $('touch-ui').classList.toggle('hidden', !(on && G.touch && input.device==='touch'));
  }
  function toast(message, seconds = 2.5) {
    const el = $('toast'); el.textContent = message; el.classList.remove('hidden'); G.toastTimer = seconds;
  }
  function formatTime() {
    const m = Math.floor(save.minutes % 1440), h = Math.floor(m / 60), min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  function skillLevel(key) { return Math.min(4, Math.floor(Math.sqrt(save.skills[key] || 0) / 2.2)); }

  // This is the one source of truth for worn art AND mechanical effects.
  function wears(key){return !!save.upgrades[key]&&save.kit[key]!==false;}
  const FITTINGS={
    wrap:{weapon:'prybar',name:'Laced pry-bar grip',desc:'A quick, controlled swing for keeping moving.',benefit:'0.40 s swing · faster recovery',trade:'30 damage instead of 34',cost:{cloth:1,parts:1},stats:{delay:.40,damage:30,turn:10}},
    weight:{weapon:'prybar',name:'Counterweighted pry bar',desc:'A heavy head that interrupts a rushing attacker.',benefit:'46 damage · interrupts melee wind-ups',trade:'0.68 s swing · slower to redirect',cost:{parts:3,cloth:1},stats:{delay:.68,damage:46,turn:6.6,stagger:.55}},
    brace:{weapon:'revolver',name:'Detachable shoulder brace',desc:'Turn the little .22 into a steady, deliberate tool.',benefit:'55% tighter base spread · 30% less recoil',trade:'25% slower aim rotation',cost:{parts:2,cloth:1},stats:{spread:.0108,recoil:2.45,turn:14.25}},
    loader:{weapon:'revolver',name:'Cylinder loading tray',desc:'A belt-mounted tray keeps the next cylinder ready.',benefit:'Reload in 1.15 s instead of 1.75 s',trade:'Replaces the shoulder-brace loadout',cost:{parts:3,cloth:1},stats:{reload:1.15}},
    choke:{weapon:'shotgun',name:'Reclaimed choke collar',desc:'A narrower pattern rewards a careful center hit.',benefit:'35% tighter pellet pattern',trade:'Less forgiving at close range',cost:{parts:3},stats:{spread:.1105}},
    sling:{weapon:'carbine',name:'Tension shooting sling',desc:'A visible cloth sling steadies follow-up shots.',benefit:'35% less recoil',trade:'Reload takes 2.35 s instead of 2.05 s',cost:{cloth:2,parts:1},stats:{recoil:3.25,reload:2.35}}
  };
  function weaponSpec(key){const base=WEAPONS[key],id=save.weaponMods[key],mod=save.fittings[id]&&FITTINGS[id]?.weapon===key?FITTINGS[id]:null;return mod?{...base,...mod.stats,mod:id}:base;}
  function kitStats(){return {armor:(wears('vest')?.18:0)+(wears('helmet')?.07:0),filter:(wears('cape')?.65:1)*(wears('respirator')?.55:1),weight:(wears('vest')?2.8:0)+(wears('helmet')?1.1:0)+(wears('respirator')?.5:0),capacity:wears('bag')?8:4};}

  function makePlayer(x, y, camp = false) {
    const side=SIDEARMS.includes(save.selectedSide)&&save.weapons[save.selectedSide]?save.selectedSide:save.weapons.revolver?'revolver':SIDEARMS.find(k=>save.weapons[k]);
    const unlocked = side ? [side,'prybar'] : ['prybar'];
    if(LONG_GUNS.includes(save.selectedLong)&&save.weapons[save.selectedLong])unlocked.push(save.selectedLong);
    if(camp)for(const k of ['firebottle','charge'])if(save.prepared[k]&&save.stash[k]>0)unlocked.push(k);
    return {
      x, y, vx: 0, vy: 0, r: 16, angle: 0, hp: 100, maxHp: 100, stamina: 100,
      exposure: 0, bleeding: 0, inventory: [], cap: kitStats().capacity,
      weaponList: unlocked, weaponIndex: 0, mags: Object.fromEntries(firearmKeys.map(k=>[k,0])),
      ammo: Object.fromEntries(AMMO_KEYS.map(k=>[k,0])), cooldown: 0, reload: 0,
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
    area.lights.push({x:665,y:315,r:155,color:'rgba(248,192,108,.25)',kind:'lamp'});
    area.objects.push(rect('stash', 368, 552, 82, 58, { solid: true, interact: 'stash', label: 'OPEN STASH', z: 603 }));
    area.objects.push(circle('campfire', 645, 550, 34, { solid: false, z: 575 }));
    area.lights.push({x:645,y:550,r:185,color:'rgba(228,170,69,.28)',kind:'fire'});
    area.objects.push(circle('npc', 805, 485, 18, { solid: true, interact: 'mara', label: save.regulatorBanked && !save.finalChoice ? 'SPEAK WITH MARA' : 'TALK TO MARA VALE', z: 505, npcName: 'Mara Vale', anchorX:805, anchorY:485, bodyAngle:-.4, gazeAngle:-.4, idlePhase:'watch', idleClock:5.5 }));
    area.objects.push(rect('routepost', 1150, 410, 58, 92, { solid: true, interact: 'depart', label: save.contractAccepted ? 'ENTER THE LOWLAND' : 'ROUTE CLOSED · SPEAK WITH MARA', z: 495 }));
    area.objects.push(circle('radio', 508, 330, 20, { interact: 'radio', label: 'CHECK THE RELAY', z: 350 }));
    area.objects.push(circle('worklight', 554, 348, 10, { z: 360, color:'amber' }));
    area.lights.push({x:554,y:348,r:118,color:'rgba(228,170,69,.2)',kind:'lamp'});
    area.objects.push(rect('pump', 760, 400, 50, 62, { solid: true, z: 455 }));
    area.objects.push(rect('cot',900,570,86,42,{z:612,occupied:save.story.surveyor}));
    area.objects.push(circle('cistern',845,345,35,{solid:true,z:374,working:save.finalChoice==='commons'}));
    if(save.story.surveyor)area.objects.push(circle('surveyor',945,625,18,{solid:true,interact:'surveyor',label:'TALK TO IVO',z:644,rescued:true}));
    if(save.finalChoice==='relay')area.objects.push(circle('mast',955,302,22,{solid:true,z:320}));
    if(save.story.pump)area.objects.push(rect('waterbarrels',660,232,70,45,{solid:true,z:277}));
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
      add(rect('cache',x+30,y+160,44,30,{interact:'loot',label:'SEARCH SEALED SALVAGE',loot:[['burnerSalvage',2]],z:y+187}));
      add(rect('weaponcase', x+98, y+90, 70, 35, {interact:'loot',label:'OPEN ARMORY CASE',loot:[['shotgun',1],['shells',4]],z:y+120}));
      add(rect('weaponcase',x-105,y+155,64,32,{interact:'loot',label:'RECOVER 9MM PROJECT',loot:[['pistol9Wreck',1],['ammo9',24]],z:y+182}));
      add(rect('powercase',x-120,y+103,57,38,{interact:'loot',label:'RECOVER CERAMIC POWER CELL',loot:[['relaycell',1]],z:y+138}));
      area.notes.push({x:x-75,y:y+70,text:'“KEEP THE PUMPS CLEAN / KEEP THE FUTURE MOVING”'});
      add(circle('worklight',x-148,y+54,10,{z:y+65,color:'amber'}));
      area.lights.push({x:x-148,y:y+54,r:112,color:'rgba(228,170,69,.18)',kind:'lamp'});
    } else if (kind === 'chapel') {
      add(rect('chapel', x-98, y-125, 196, 220, {solid:true,z:y+85, poi:'FLOOD CHAPEL'}));
      add(circle('bell', x+125, y-92, 30, {solid:true,z:y-66}));
      add(rect('cache', x-35, y+120, 65, 42, {interact:'loot',label:'SEARCH RELIEF CRATE',loot:[['medicine',2],['cleanwater',1],['cloth',1]],z:y+155}));
      add(rect('weaponcase',x+80,y+160,60,30,{interact:'loot',label:'SEARCH WARDEN LOCKBOX',loot:[['coltWreck',1],['ammo45',12]],z:y+186}));
      area.notes.push({x:x+38,y:y+100,text:'RIVER HEIGHT, YEAR 6 — CUT INTO THE STONE'});
      add(circle('worklight',x+76,y+106,8,{z:y+116,color:'candle'}));
      area.lights.push({x:x+76,y:y+106,r:76,color:'rgba(196,94,63,.16)',kind:'candle'});
    } else if (kind === 'relay') {
      add(rect('relayhut', x-95, y-72, 190, 138, {solid:true,z:y+53, poi:'RANGER RELAY'}));
      add(circle('mast', x+110, y-86, 27, {solid:true,z:y-63}));
      add(rect('cache', x-38, y+92, 65, 42, {interact:'loot',label:'SEARCH RANGER CACHE',loot:[['ammo22',18],['bandage',1],['parts',1]],z:y+126}));
      add(rect('weaponcase', x+62, y+83, 73, 36, {interact:'loot',label:'OPEN PATROL CASE',loot:[['carbine',1],['carbineAmmo',16]],z:y+114}));
      add(rect('cache',x-100,y+146,44,30,{interact:'loot',label:'RECOVER DEMOLITION SALVAGE',loot:[['demoSalvage',2]],z:y+174}));
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

  function spawnEnemy(area, type, x, y, rng, equipped=null) {
    const stats = type === 'hound' ? {hp:48,r:14,speed:128} : type === 'wader' ? {hp:82,r:20,speed:54} : {hp:68,r:17,speed:75};
    const id=rng.int(1,1e8), angle=rng.range(0,TAU);
    const weapon=type==='scav'?(equipped||(area.kind==='lowland'&&x<1050?'revolver':['pistol9','colt','field410','shotgun','carbine'][Math.floor(hash(id,12,4)*5)])):null,w=WEAPONS[weapon];
    area.enemies.push(Object.assign({type,x,y,vx:0,vy:0,angle,bodyAngle:angle,weaponAngle:angle,weapon,rounds:w?.mag||0,reserve:w?(w.pellets?6:w.mag*2):0,reload:0,alert:0,aim:0,cooldown:rng.range(.2,1),alive:true,hit:0,id,recoil:0,recoilV:0,idlePhase:'hold',idleClock:rng.range(2.5,6.5),idleHeading:angle,profile:type==='scav'?scavProfile(id):null},stats));
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
    area.landmarks=kinds.map((kind,i)=>({kind,x:slots[i].x,y:slots[i].y}));
    addNineMile(area);
    area.objects.push(rect('weaponcase',650,1035,66,34,{interact:'loot',label:'SEARCH HUNTER’S LOCKER',loot:[['field410Wreck',1],['shells410',8],['parts',1]],z:1065}));
    addStoryCluster(area,'survey',430,815,seed^41);
    addStoryCluster(area,'repair',1285,1015,seed^73);
    addStoryCluster(area,'memorial',1965,665,seed^109);
    const avoids = slots.map(s=>({x:s.x,y:s.y,r:270})).concat([{x:2250,y:1060,r:280},{x:130,y:900,r:220},{x:1510,y:1080,r:240},{x:540,y:1110,r:180}]);
    scatterPlants(area,rng,360,{x:35,y:35,w:2530,h:1680},avoids);
    for(let i=0;i<48;i++){
      let x=rng.range(80,2520),y=rng.range(70,1490); if(avoids.some(a=>Math.hypot(x-a.x,y-a.y)<a.r)) continue;
      if(rng.next()<.68)addTree(area,x,y,rng.range(25,53),rng.int(1,9999));else addRock(area,x,y,rng.range(17,36),rng.int(1,9999));
    }
    // Two readable early sidearm encounters; never depend on random archetype rolls.
    for(const [sx,sy] of [[570,790],[860,965]]){for(let n=0;n<20;n++){const x=sx+n%5*24,y=sy+Math.floor(n/5)*26;if(spawnClear(area,x,y,24)){spawnEnemy(area,'scav',x,y,rng,'revolver');break;}}}
    for(let i=area.enemies.length,tries=0;i<16&&tries<180;tries++){
      const x=rng.range(520,2440),y=rng.range(130,1460);if(Math.hypot(x-130,y-900)<390||!spawnClear(area,x,y,24))continue;
      spawnEnemy(area,rng.next()<.42?'hound':rng.next()<.72?'scav':'wader',x,y,rng);i++;
    }
    for(let i=0,tries=0;i<10&&tries<100;tries++){const x=rng.range(430,2440),y=rng.range(100,1450);if(!spawnClear(area,x,y,12))continue;area.objects.push(circle('looseLoot',x,y,12,{interact:'loot',label:'PICK UP SUPPLIES',loot:[[rng.pick(['parts','cloth','bandage','cleanwater']),1]],z:y}));i++;}
    return area;
  }

  function addNineMile(area){
    area.paths.push(path([{x:420,y:910},{x:530,y:1080},{x:790,y:1160}],25,'trail'));
    area.paths.push(path([{x:1240,y:960},{x:1480,y:1040},{x:1610,y:1060}],31,'trail'));
    area.objects.push(rect('skiff',480,1070,138,50,{solid:true,z:1117}));
    if(!save.story.surveyor)area.objects.push(circle('surveyor',546,1165,18,{interact:'surveyor',label:'SPEAK TO THE INJURED SURVEYOR',z:1185,rescued:false}));
    area.objects.push(rect('switchhouse',1460,1030,102,62,{solid:true,interact:'infrastructure',label:'NINE-MILE SWITCH HOUSE',z:1092,poi:'NINE-MILE PUMP'}));
    area.objects.push(circle('beacon',1630,1050,21,{interact:'beacon',label:save.story.beacon?'SIGNAL PICKUP · HOLD POSITION':'EXAMINE RESCUE BEACON',z:1069}));
    area.objects.push(rect('waterbarrels',1530,1150,65,40,{solid:true,z:1190,interact:'refill',label:'CHECK WATER TANK',used:false}));
    if(!save.story.pump)area.zones.push({type:'water',x:1400,y:1190,w:320,h:230,drainable:true});
    area.objects.push(rect('cache',1510,1390,64,40,{interact:'loot',label:'SEARCH FLOOD STORAGE',loot:[['parts',3],['cloth',2]],z:1425}));
    area.notes.push({x:1430,y:1040,text:'ONE LIVE CIRCUIT: drainage brings water; the beacon brings a way home. Cells fit either.'});
    if(save.story.surveyor)for(const [i,p] of [[410,930],[570,975],[785,950],[1040,930],[1260,990],[1435,1040]].entries())area.objects.push(circle('surveystake',p[0],p[1],4,{seed:i,z:p[1]+14}));
    applyInfrastructure(area);
  }

  function applyInfrastructure(area){
    if(area.kind!=='lowland')return;
    if(save.story.pump){area.zones=area.zones.filter(z=>!z.drainable);for(const z of area.zones)if(z.type==='exposure'&&z.x===1430)z.strength=0;}
    const beacon=area.objects.find(o=>o.type==='beacon');if(beacon)beacon.label=save.story.beacon?'SIGNAL PICKUP · HOLD POSITION':'EXAMINE RESCUE BEACON';
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
    area.objects.push(rect('powercase',start.x+137,start.y+126,51,32,{interact:'loot',label:'RECOVER SPARE POWER CELL',loot:[['relaycell',1]],z:start.y+157}));
    area.objects.push(rect('breaker',start.x+168,start.y+24,31,40,{solid:true,interact:'breaker',label:'RESTORE GALLERY LIGHTS · NOISY',z:start.y+64}));
    area.objects.push(rect('cot',mid.x+20,mid.y+24,78,31,{z:mid.y+55,occupied:false}));
    area.objects.push(circle('valve',mid.x+48,mid.y+148,18,{interact:'purge',label:'[MECHANICS] BLEED THE FILTER LINE',z:mid.y+168}));
    area.zones.push({type:'exposure',x:mid.x+20,y:mid.y+20,w:150,h:120,strength:13});
    area.notes.push({x:end.x+28,y:end.y+158,text:'PRESSURE IS A PROMISE KEPT BY WALLS'});
    for(let i=1;i<cells.length;i+=2){const f=area.floors[i];for(let tries=0;tries<12;tries++){const x=f.x+rng.range(48,172),y=f.y+rng.range(48,146);if(!spawnClear(area,x,y,24))continue;spawnEnemy(area,i%4===1?'scav':'wader',x,y,rng);break;}}
    return area;
  }

  function enterArea(area, x, y, camp = false) {
    G.area = area; G.bullets.length = 0; G.particles.length = 0; G.decals.length = 0; G.soundMarks.length = 0;G.fieldEffects=[];
    G.player = makePlayer(x,y,camp); G.camera.x=x; G.camera.y=y; G.nearest=null;
    if (area.kind === 'prologue') addInventory('bandage',1,true);
    if (area.kind === 'camp') prepareCampAmmo();
    updateHUD(true);
  }

  function loadPrologue() { G.seed=1907; enterArea(makePrologue(),145,495,false); G.runActive=false; setObjective(); }
  function loadCamp(message) { enterArea(makeCamp(),660,625,true); G.runActive=false;G.extraction=null; if(message) toast(message,3.5); setObjective(); persist(); }

  function prepareCampAmmo() {
    const p=G.player;p.weaponList=makePlayer(p.x,p.y,true).weaponList;p.weaponIndex=0;
    for(const k of firearmKeys)p.mags[k]=0;for(const a of AMMO_KEYS)p.ammo[a]=0;
    for(const key of p.weaponList){const w=WEAPONS[key];if(!w.ammo)continue;p.mags[key]=Math.min(w.mag,save.stash[w.ammo]||0);p.ammo[w.ammo]=Math.max(0,(save.stash[w.ammo]||0)-p.mags[key]);}
  }

  function withdrawAmmo() {
    const p=G.player, plans={ammo22:24,ammo45:18,shells410:10,ammo9:36,shells:8,carbineAmmo:30};
    if(save.weapons.revolver && save.stash.ammo22<6){save.stash.ammo22+=6; toast('RELIEF CACHE · 6 .22 ROUNDS',2.2);}
    const carriedAmmo=new Set(p.weaponList.map(key=>WEAPONS[key].ammo).filter(Boolean));
    Object.keys(plans).forEach(k=>{if(!carriedAmmo.has(k))return;const q=Math.min(save.stash[k]||0,plans[k]);p.ammo[k]=q;save.stash[k]-=q;});
    p.weaponList.forEach(key=>{const w=WEAPONS[key];if(!w.ammo)return;const q=Math.min(w.mag,p.ammo[w.ammo]);p.mags[key]=q;p.ammo[w.ammo]-=q;});
    persist();
  }

  function startRun() {
    if(!save.contractAccepted){toast('Mara needs to show you the route first.');return;}
    const packing=departurePlan();if(packing.slots>kitStats().capacity){openPanel('pack');toast(`PROVISIONS NEED ${packing.slots} SLOTS · DESELECT SOMETHING OR WEAR THE FIELD BAG`,4);return;}
    save.runs++; save.minutes+=45; G.seed=(save.day*92821+save.runs*1777+1907)>>>0;
    G.bunker=null;G.extraction=null;G.lowland=makeLowland(G.seed); enterArea(G.lowland,245,905,false); G.runActive=true; withdrawAmmo();
    const relief=wears('medroll')?2:1;addInventory('bandage',relief,true);const secured=G.player.inventory.find(s=>s.key==='bandage');if(secured)secured.secured=relief;
    for(const key of PROVISIONS)if(save.prepared[key]&&(save.stash[key]||0)>0&&addInventory(key,1,true)){save.stash[key]--;}
    persist();setObjective();toast('OUTING BEGINS · RETURN WEST TO BANK WHAT YOU CARRY',3.1);
  }

  function enterBunker() {
    G.returnPos={x:G.player.x,y:G.player.y};G.bunker ||= makeBunker(G.seed);switchFieldArea(G.bunker,145,383);toast('SILT WATERWORKS · SOUND CARRIES THROUGH CONCRETE',2.7);
  }

  function exitBunker() {
    switchFieldArea(G.lowland,G.returnPos.x-35,G.returnPos.y+20);toast('BACK IN THE LOWLAND',1.8);
  }

  function switchFieldArea(area,x,y){
    G.area=area;Object.assign(G.player,{x,y,vx:0,vy:0,meleeTime:0,reload:0,reloadingWeapon:null,obstruction:0,wallObstruction:false});
    G.bullets.length=0;G.particles.length=0;G.decals.length=0;G.soundMarks.length=0;G.fieldEffects=[];G.nearest=null;G.extraction=null;G.camera.x=x;G.camera.y=y;clearTransientInput();setObjective();updateHUD(true);
  }

  function transition(task) { if(G.transition!==0)return;G.transition=.001;G.transitionTask=task; }

  function addInventory(key, qty=1, quiet=false) {
    const p=G.player,item=ITEMS[key]; if(!item)return false;
    if(AMMO_KEYS.includes(key))return false;
    const openInStacks=p.inventory.reduce((n,s)=>n+(s.key===key?item.stack-s.qty:0),0);
    const emptySlots=Math.max(0,p.cap-p.inventory.length);
    if(openInStacks+emptySlots*item.stack<qty){if(!quiet)toast('PACK FULL · RETURN OR USE SOMETHING');return false;}
    let remain=qty;
    for(const slot of p.inventory){if(slot.key===key&&slot.qty<item.stack){const q=Math.min(remain,item.stack-slot.qty);slot.qty+=q;remain-=q;if(!remain)break;}}
    while(remain>0&&p.inventory.length<p.cap){const q=Math.min(remain,item.stack);p.inventory.push({key,qty:q});remain-=q;}
    if(remain>0){if(!quiet)toast('PACK FULL · RETURN OR USE SOMETHING');return false;}
    if(item.tool&&!p.weaponList.includes(item.tool))p.weaponList.push(item.tool);
    if(!quiet){sound.pickup();toast(`${item.short} ×${qty}`);}return true;
  }

  function pickupLoot(list,obj) {
    let took=false;const remaining=[];
    for(const [key,qty] of list){
      if(AMMO_KEYS.includes(key)){
        G.player.ammo[key]=(G.player.ammo[key]||0)+qty;took=true;sound.pickup();toast(`${resourceName(key)} ×${qty}`);
      } else if(addInventory(key,qty)) took=true;else remaining.push([key,qty]);
    }
    obj.loot=remaining;if(took){if(!remaining.length){obj.opened=true;obj.interact=null;if(['looseLoot','corpse'].includes(obj.type))obj.active=false;}G.player.runValue+=1;save.skills.fieldcraft+=.18;}
  }

  function hasItem(key, qty=1) { return G.player.inventory.reduce((n,s)=>n+(s.key===key?s.qty:0),0)>=qty; }
  function removeItem(key, qty=1) {
    for(let i=G.player.inventory.length-1;i>=0&&qty>0;i--){const s=G.player.inventory[i];if(s.key!==key)continue;const q=Math.min(qty,s.qty);s.qty-=q;s.secured=Math.max(0,(s.secured||0)-q);qty-=q;if(s.qty<=0)G.player.inventory.splice(i,1);}return qty<=0;
  }

  function useItem(index) {
    const p=G.player,s=p.inventory[index];if(!s)return;const key=s.key;
    if(key==='bandage'){
      if(p.hp>=p.maxHp&&p.bleeding<=0){toast('NO WOUND NEEDS DRESSING');return;}
      p.bleeding=0;p.hp=Math.min(p.maxHp,p.hp+(wears('medroll')?35:24));sound.tone(330,.16,'sine',.06,1.6);toast('WOUND DRESSED');
    } else if(key==='medicine'){
      p.bleeding=0;p.hp=Math.min(p.maxHp,p.hp+48);p.exposure=Math.max(0,p.exposure-12);sound.tone(360,.18,'sine',.06,1.8);toast('MEDICINE USED');
    } else if(key==='cleanwater'){
      p.exposure=Math.max(0,p.exposure-28);p.stamina=100;sound.tone(210,.2,'sine',.045,1.4);toast('CLEAN WATER · EXPOSURE REDUCED');
    } else {toast(ITEMS[key].use);return;}
    s.qty--;if(s.secured)s.secured--;if(s.qty<=0)p.inventory.splice(index,1);closePanel();updateHUD(true);
  }

  function inventoryWeight(){return kitStats().weight+G.player.inventory.reduce((n,s)=>n+(ITEMS[s.key]?.weight||0)*s.qty,0);}

  function bankRun(premium=false) {
    if(G.mode!=='play'||G.transition!==0||!G.player?.alive||!G.runActive)return;G.runActive=false;G.extraction=null;
    const p=G.player,meaningful=p.runValue>0||p.maxDistance>420;
    for(const s of p.inventory){
      const it=ITEMS[s.key],qty=Math.max(0,s.qty-(s.secured||0));if(qty<=0)continue;
      if(it.weapon){const first=!save.weapons[it.weapon];save.weapons[it.weapon]=true;if(first)save[LONG_GUNS.includes(it.weapon)?'selectedLong':'selectedSide']=it.weapon;toast(`${it.name.toUpperCase()} SECURED AT SHELTER`,3);}
      else if(s.key==='regulator')save.regulatorBanked=true;
      else save.stash[s.key]=(save.stash[s.key]||0)+qty;
    }
    for(const key of firearmKeys){const w=WEAPONS[key];if(p.weaponList.includes(key))save.stash[w.ammo]=(save.stash[w.ammo]||0)+(p.mags[key]||0);}
    for(const k of AMMO_KEYS)save.stash[k]=(save.stash[k]||0)+(p.ammo[k]||0);
    let message='BACK AT SHELTER · UNSPENT SUPPLIES BANKED';
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
    if(obj.interact==='surveyor')return openPanel('surveyor');
    if(obj.interact==='infrastructure')return openPanel('infrastructure');
    if(obj.interact==='beacon')return save.story.beacon?beginExtraction():openPanel('infrastructure');
    if(obj.interact==='refill'){
      if(!save.story.pump)return toast('BROWN WATER · RESTORE DRAINAGE AT THE SWITCH HOUSE');
      if(obj.used)return toast('THE TANK NEEDS TIME TO REFILL · TRY NEXT OUTING');
      if(addInventory('cleanwater',1)){obj.used=true;G.player.runValue++;}return;
    }
    if(obj.interact==='breaker'){
      if(obj.on)return toast('GALLERY POWER IS ALREADY ON');obj.on=true;G.area.powered=true;
      for(const light of G.area.lights)light.on=true;
      G.player.noise=1;addSoundMark(obj.x,obj.y,650,1);sound.tone(74,.65,'sawtooth',.08,1.5,obj.x);toast('GALLERY LIGHTS ON · THE STARTER ECHOES THROUGH THE PIPES',3);return;
    }
    if(obj.interact==='radio')return toast(save.finalChoice==='relay'?'THE HILL RELAY MARKS MOVEMENT BEYOND YOUR MAP':'STATIC, THEN THREE DISTANT CLICKS');
    if(obj.interact==='depart')return startRun();
    if(obj.interact==='extract')return bankRun(false);
    if(obj.interact==='premium_extract'){
      if(save.finalChoice!=='relay'){toast('NO ONE IS LISTENING ON THIS FREQUENCY');return;}return beginExtraction();
    }
    if(obj.interact==='enter_bunker')return transition(enterBunker);
    if(obj.interact==='exit_bunker')return transition(exitBunker);
    if(obj.interact==='purge'){
      if(skillLevel('mechanics')<1&&!hasItem('parts')){toast('NEEDS PRACTICED MECHANICS OR ONE MACHINE PART');return;}
      if(skillLevel('mechanics')<1)removeItem('parts',1);const zone=G.area.zones.find(z=>z.type==='exposure');if(zone)zone.strength=0;G.area.purged=true;obj.interact=null;obj.label='FILTER LINE PURGED';save.skills.mechanics+=.35;sound.tone(72,.7,'sawtooth',.07,.55,obj.x);toast('FILTER LINE PURGED · CONTAMINATION FALLING',2.8);return;
    }
    if(obj.interact==='regulator'){
      if(hasItem('regulator')){toast('THE REGULATOR IS ALREADY IN YOUR PACK');return;}
      if(addInventory('regulator',1)){obj.active=false;G.player.runValue+=5;save.skills.mechanics+=1;setObjective();sound.tone(74,.4,'square',.08,.65);G.camera.shake=7;}
    }
  }

  function helpSurveyor(){
    if(save.story.surveyor||G.area.kind!=='lowland')return;
    const supply=hasItem('bandage')?'bandage':hasItem('medicine')?'medicine':null;
    if(!supply){toast('IVO NEEDS ONE BANDAGE OR SEALED MEDICINE');return;}
    removeItem(supply);save.story.surveyor=true;save.skills.fieldcraft+=1;G.player.runValue+=2;
    const o=G.area.objects.find(o=>o.type==='surveyor');if(o){o.rescued=true;o.label='IVO · HEADING TO SHELTER';}
    persist();closePanel();sound.pickup();toast('IVO CAN WALK AGAIN · NEXT OUTING, FOLLOW HIS BLUE SURVEY FLAGS',4);
  }
  function installCircuit(key){
    if(!['pump','beacon'].includes(key)||save.story[key]||G.area.kind!=='lowland')return;
    if(!hasItem('relaycell')){toast('NEEDS A CERAMIC POWER CELL · SERVICE YARD OR BUNKER ENTRY');return;}
    removeItem('relaycell');save.story[key]=true;save.skills.mechanics+=1.5;G.player.runValue+=3;applyInfrastructure(G.area);persist();closePanel();
    sound.tone(83,.55,'sawtooth',.08,1.6);toast(key==='pump'?'PUMP RUNNING · FLOOD BASIN DRAINED · CLEAN WATER AT THE TANK':'RESCUE BEACON LIVE · A SECOND WAY HOME',4);setObjective();
  }
  function beginExtraction(){
    if(G.extraction)return;G.extraction={x:G.player.x,y:G.player.y,hp:G.player.hp,remaining:5,total:5};toast('PICKUP IN 5 SECONDS · HOLD POSITION, DO NOT FIRE',2.5);
  }
  function updateExtraction(dt){
    const e=G.extraction,p=G.player;if(!e)return;
    if(Math.hypot(p.x-e.x,p.y-e.y)>24||p.hp<e.hp-.1||p.noise>.6){G.extraction=null;toast('PICKUP INTERRUPTED · SIGNAL AGAIN WHEN READY');return;}
    e.remaining-=dt;if(e.remaining<=0)bankRun(true);
  }

  function currentWeapon(){return weaponSpec(G.player.weaponList[G.player.weaponIndex]);}
  function currentWeaponKey(){return G.player.weaponList[G.player.weaponIndex];}
  function localPoint(x,y,a,forward,side=0){return{x:x+Math.cos(a)*forward-Math.sin(a)*side,y:y+Math.sin(a)*forward+Math.cos(a)*side};}
  function meleeProgress(p){const w=weaponSpec('prybar');return p.meleeTime>0?clamp((w.delay-p.meleeTime)/w.delay,0,1):1;}
  function meleeAngle(p,progress=null){
    if(progress==null){if(p.meleeTime<=0)return p.weaponAngle;progress=meleeProgress(p);}
    if(p.meleeRecoverAngle!=null&&progress>=p.meleeRecoverStart)return lerpAngle(p.meleeRecoverAngle,p.meleeHeading,clamp((progress-p.meleeRecoverStart)/(1-p.meleeRecoverStart),0,1));
    if(progress<.22)return lerpAngle(p.meleeStartAngle??p.weaponAngle,p.meleeHeading-1.08,progress/.22);
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
    for(const e of G.area.enemies){if(!e.alive)continue;const t=actorHitT(root.x,root.y,end.x,end.y,e,4);if(t!=null&&t<actorT)actorT=t;}
    if(actorT<wallT)return{amount:clamp(1-actorT,0,1),wall:false};
    if(hit)return{amount:clamp(1-wallT,0,1),wall:true};
    return{amount:0,wall:false};
  }
  function computePlayerRig(p,overrideAngle=null){
    const key=p.weaponList[p.weaponIndex],w=weaponSpec(key),angle=overrideAngle==null?(key==='prybar'?meleeAngle(p):p.weaponAngle):overrideAngle;
    const obstruction=key==='prybar'||w.tool?0:(p.obstruction||0),recoil=p.recoil||0,effectiveLength=Math.max(4,w.length*(1-obstruction)-2-recoil);
    const rear=localPoint(p.x,p.y,angle,10-recoil*.32,4),front=localPoint(rear.x,rear.y,angle,Math.max(1,Math.min(25,w.length*.52,effectiveLength*.72)-recoil*.12),0);
    const muzzle=localPoint(rear.x,rear.y,angle,effectiveLength,0);
    const leftShoulder={x:p.x-8,y:p.y-6},rightShoulder={x:p.x+8,y:p.y-6};
    return{key,w,mod:w.mod,angle,rear,front,muzzle,leftShoulder,rightShoulder,obstruction,baseLength:w.artLength||w.length};
  }
  function computeEnemyRig(e){
const key=e.weapon||'carbine',w=WEAPONS[key],angle=e.weaponAngle==null?e.angle:e.weaponAngle,side=e.profile?.left||1,baseLength=w.length,rear=localPoint(e.x,e.y,angle,8,side*3),raw=localPoint(rear.x,rear.y,angle,baseLength,0),hit=G.area?segmentBlockPoint(rear.x,rear.y,raw.x,raw.y,2.5):null,wallT=hit?.t??2,actorT=G.player?.alive?(actorHitT(rear.x,rear.y,raw.x,raw.y,G.player,4)??2):2,contactT=Math.min(wallT,actorT),obstruction=contactT<=1?1-contactT:0,length=Math.max(4,baseLength*(1-obstruction)-2-(e.recoil||0)),front=localPoint(rear.x,rear.y,angle,Math.min(18,length*.72),0),muzzle=localPoint(rear.x,rear.y,angle,length,0);
    return{key,w,angle,rear,front,muzzle,side,obstruction,baseLength:w.artLength||w.length,wallObstruction:wallT<=actorT&&wallT<=1};
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
    if(G.mode!=='play'||G.panel||G.transition!==0)return;const p=G.player;if(p.meleeTime>0||p.weaponList.length<2)return;cancelTouchAttack();p.reload=0;p.reloadingWeapon=null;p.weaponIndex=(p.weaponIndex+1)%p.weaponList.length;p.cooldown=.18;sound.ui();updateWeaponHUD();
  }

  function startReload() {
    if(G.mode!=='play'||G.panel||G.transition!==0)return;const p=G.player,key=currentWeaponKey(),w=weaponSpec(key);if(!w.ammo||p.reload>0||p.mags[key]>=w.mag||p.ammo[w.ammo]<=0)return;
    p.reload=w.reload*(1-Math.min(.12,skillLevel('mechanics')*.03));p.reloadingWeapon=key;sound.reload(p.x);const rig=computePlayerRig(p),side=p.bodyAngle+Math.PI/2;
    if(w.pellets)for(let i=0;i<Math.max(1,w.mag-p.mags[key]);i++)particle(rig.rear.x,rig.rear.y,Math.cos(side)*(35+i*12),Math.sin(side)*(35+i*12),.55,COLORS.amber,3,'casing');
    if(key==='carbine'||key==='pistol9')particle(rig.rear.x,rig.rear.y,Math.cos(side)*26,Math.sin(side)*26,.62,'#303839',key==='pistol9'?4:7,'magazine');
    toast('RELOADING',.8);
  }

  function finishReload() {
    const p=G.player,key=p.reloadingWeapon,w=WEAPONS[key];if(!w)return;const q=Math.min(w.mag-p.mags[key],p.ammo[w.ammo]);p.mags[key]+=q;p.ammo[w.ammo]-=q;p.reloadingWeapon=null;sound.reload(p.x);updateWeaponHUD();
  }

  function fireWeapon() {
    if(G.area?.kind==='prologue'&&!save.prologue.satchel)return false;
    const p=G.player,key=currentWeaponKey(),w=weaponSpec(key);if(p.cooldown>0||p.reload>0||p.camp&&!w.melee||!p.alive)return false;
    if(w.tool){useFieldTool(key);return true;}
    if(w.melee){
      p.cooldown=w.delay;p.meleeTime=w.delay;p.meleeStartAngle=p.weaponAngle;p.meleeHeading=p.aimAngle;p.meleeRecoverAngle=null;p.meleeHit=false;p.settle=.18;sound.melee('swing',p.x);controller.rumble(.04,.13,48);return true;
    }
    if((p.mags[key]||0)<=0){p.cooldown=.2;sound.tone(120,.045,'square',.04,.75,p.x);startReload();return;}
    const rig=computePlayerRig(p);if(p.wallObstruction&&rig.obstruction>.05){p.cooldown=.14;sound.melee('metal',rig.muzzle.x);p.recoilV+=2.2;controller.rumble(.18,.22,55);return;}
    p.mags[key]--;p.cooldown=w.delay;save.condition[key]=Math.max(0,(save.condition[key]??70)-.045);
    const handlingPenalty=save.condition[key]<25?.018:0, skillBonus=Math.min(.15,skillLevel('marksmanship')*.035), moveBloom=Math.hypot(p.vx,p.vy)>60?.018:0;
    const count=w.pellets||1;
    for(let i=0;i<count;i++){
      const a=rig.angle+(Math.random()-.5)*(w.spread+handlingPenalty+moveBloom)*(1-skillBonus)*2;
      G.bullets.push({x:rig.muzzle.x,y:rig.muzzle.y,px:rig.muzzle.x,py:rig.muzzle.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,life:w.range/w.speed,damage:w.damage,from:'player',color:w.color,r:2.2});
    }
    p.vx-=Math.cos(rig.angle)*w.recoil*3;p.vy-=Math.sin(rig.angle)*w.recoil*3;p.recoilV+=w.recoil;p.noise=w.sound;G.camera.shake=w.recoil;
    if(key==='carbine'||key==='pistol9'){const side=rig.angle-Math.PI/2;particle(rig.rear.x,rig.rear.y,Math.cos(side)*72+Math.cos(rig.angle)*18,Math.sin(side)*72+Math.sin(rig.angle)*18,.42,COLORS.amber,2.4,'casing');}
    muzzle(rig.muzzle.x,rig.muzzle.y,rig.angle,w.color);sound.gun(key,p.x);controller.rumble(key==='shotgun'?.55:.18,key==='shotgun'?.85:.38,key==='shotgun'?115:58);addSoundMark(p.x,p.y,w.sound*720,w.sound);updateWeaponHUD();
    return true;
  }

  function updateMelee(p,dt){
    if(p.meleeTime<=0)return;
    const w=weaponSpec('prybar'),prev=meleeProgress(p);p.meleeTime=Math.max(0,p.meleeTime-dt);const now=meleeProgress(p),from=Math.max(.25,prev),to=Math.min(.7,now);
    // Sweep the actual blade path across the entire active interval, even at low FPS.
    const steps=Math.max(1,Math.ceil((to-from)*2.1/.42/.1));
    for(let sample=0;!p.meleeHit&&from<=to&&sample<=steps;sample++){
      const angle=meleeAngle(p,lerp(from,to,sample/steps)),rig=computePlayerRig(p,angle);
      const wall=segmentBlockPoint(rig.rear.x,rig.rear.y,rig.muzzle.x,rig.muzzle.y,4),wallT=wall?.t??2;let actor=null,actorT=2;
      for(const e of G.area.enemies){if(!e.alive)continue;const t=actorHitT(rig.rear.x,rig.rear.y,rig.muzzle.x,rig.muzzle.y,e,5);if(t!=null&&t<actorT){actor=e;actorT=t;}}
      if(actor&&actorT<wallT){p.meleeHit=true;p.meleeTime=Math.min(p.meleeTime,w.delay*.31);p.recoilV+=4;damageEnemy(actor,w.damage,angle);if(w.stagger){actor.windup=0;actor.strike=0;actor.cooldown=Math.max(actor.cooldown||0,w.stagger);actor.stagger=w.stagger;actor.aim=0;}sound.melee('body',actor.x);controller.rumble(.32,.5,78);G.camera.shake=5;}
      else if(wall){p.meleeHit=true;p.meleeTime=Math.min(p.meleeTime,w.delay*.28);p.recoilV+=5;G.camera.shake=3;sound.melee('metal',wall.x);controller.rumble(.4,.28,82);for(let i=0;i<5;i++)particle(wall.x,wall.y,(Math.random()-.5)*85,(Math.random()-.5)*85,.2,COLORS.concrete,2,'spark');}
      if(p.meleeHit){p.meleeRecoverAngle=angle;p.meleeRecoverStart=meleeProgress(p);}
    }
    if(p.meleeTime<=0){p.meleeTime=0;p.meleeHit=false;p.weaponAngle=p.meleeHeading;}
  }

  function damageEnemy(e,amount,angle) {
    if(!e.alive)return;e.hp-=amount;e.hit=.14;e.alert=1;e.x+=Math.cos(angle)*5;e.y+=Math.sin(angle)*5;spawnHit(e.x,e.y,COLORS.blood);save.skills.marksmanship+=.11;
    if(e.hp<=0){e.alive=false;G.decals.push({x:e.x,y:e.y,type:'blood',r:e.r*1.3,seed:e.id});sound.tone(78,.13,'sawtooth',.045,.5,e.x);const w=WEAPONS[e.weapon||'carbine'],ammo=Math.max(0,(e.rounds??w.mag)+(e.reserve??6)),loot=e.type==='scav'?[[w.ammo,ammo],['parts',1]].filter(([,q])=>q>0):e.type==='wader'?[['medicine',1]]:[['cloth',1]];G.area.objects.push(circle('corpse',e.x,e.y,e.r+8,{interact:'loot',label:e.type==='scav'?`SEARCH ${resourceName(w.ammo).toUpperCase()} SCAVENGER`:'SEARCH REMAINS',loot,weapon:e.weapon,z:e.y+5}));}
  }

  function hurtPlayer(amount, bleed=.08, angle=0) {
    if(G.extraction&&G.player.invuln<=0&&G.player.alive){G.extraction=null;toast('PICKUP INTERRUPTED · YOU TOOK A HIT');}
    const p=G.player;if(p.invuln>0||!p.alive)return;const armor=kitStats().armor;p.hp-=amount*(1-armor);p.invuln=.28;p.bleeding=Math.min(3,p.bleeding+(Math.random()<bleed*(1-armor)?1:0));p.vx+=Math.cos(angle)*28;p.vy+=Math.sin(angle)*28;G.camera.shake=8;sound.hurt();controller.rumble(.48,.7,120);spawnHit(p.x,p.y,armor>0?COLORS.concrete:COLORS.blood);if(p.hp<=0)playerDeath();
  }

  function enemyFire(e) {
    const rig=computeEnemyRig(e),w=rig.w;if(e.reload>0)return;if(e.rounds==null)e.rounds=w.mag;if(e.rounds<=0){if(e.reserve>0){e.reload=w.reload+.55;e.aim=0;}return;}
    if(rig.wallObstruction&&rig.obstruction>.05){e.cooldown=.18;e.aim=Math.max(.72,e.aim);sound.melee('metal',rig.muzzle.x);return;}
    e.rounds--;for(let i=0;i<(w.pellets||1);i++){const a=rig.angle+(Math.random()-.5)*(w.pellets?w.spread*2:.075);G.bullets.push({x:rig.muzzle.x,y:rig.muzzle.y,px:rig.muzzle.x,py:rig.muzzle.y,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,life:w.range/w.speed,damage:rig.key==='revolver'?12:w.pellets?5:rig.key==='colt'?24:16,from:'enemy',color:COLORS.rust,r:2});}
    muzzle(rig.muzzle.x,rig.muzzle.y,rig.angle,COLORS.rust);sound.gun(rig.key,e.x);addSoundMark(e.x,e.y,w.sound*620,.7);e.recoilV+=w.recoil;e.cooldown=1.15+Math.random()*.55;e.aim=0;
  }
  function toolTarget(p=G.player){
    const rig=computePlayerRig(p);let range=180;if(p.lastAimSource==='mouse'){const at=screenToWorld(input.mouse.x,input.mouse.y);range=clamp(dist(at,p),70,260);}const end=localPoint(p.x,p.y,rig.angle,range,0),wall=segmentBlockPoint(rig.rear.x,rig.rear.y,end.x,end.y,7);return wall?localPoint(wall.x,wall.y,rig.angle,-13,0):end;
  }
  function useFieldTool(key){
    const p=G.player,armed=G.fieldEffects.find(e=>e.kind==='charge');p.cooldown=.55;
    if(key==='charge'&&armed){if(armed.flight>0){toast('WAIT FOR THE CHARGE TO LAND');return;}blast(armed);G.fieldEffects=G.fieldEffects.filter(e=>e!==armed);updateWeaponHUD();return;}
    if(!hasItem(key)){toast('NO '+ITEMS[key].short+' IN YOUR PACK');return;}const target=toolTarget(p),rig=computePlayerRig(p);removeItem(key);G.fieldEffects.push({kind:key,x:target.x,y:target.y,fromX:rig.rear.x,fromY:rig.rear.y,flight:.6,maxFlight:.6,life:key==='firebottle'?6:Infinity,tick:0,r:key==='firebottle'?55:85});sound.tone(190,.12,'triangle',.05,.7);toast(key==='charge'?'CHARGE THROWN · RELEASE, THEN FIRE TO DETONATE':'FIRE BOTTLE THROWN · KEEP CLEAR',1.8);updateHUD(true);
  }
  function effectCanHit(effect,actor){return dist(effect,actor)<=effect.r&&!segmentBlockPoint(effect.x,effect.y,actor.x,actor.y,1);}
  function blast(effect){
    for(const e of G.area.enemies)if(e.alive&&effectCanHit(effect,e))damageEnemy(e,120*(1-dist(effect,e)/effect.r*.55),Math.atan2(e.y-effect.y,e.x-effect.x));
    if(effectCanHit(effect,G.player))hurtPlayer(85*(1-dist(effect,G.player)/effect.r*.5),.1);G.player.noise=1;G.camera.shake=14;sound.burst(.42,.48,540,effect.x);sound.tone(54,.45,'sine',.18,.28,effect.x);addSoundMark(effect.x,effect.y,950,1);particle(effect.x,effect.y,0,0,.27,COLORS.amber,effect.r,'blast');for(let i=0;i<20;i++){const a=i/20*TAU;particle(effect.x,effect.y,Math.cos(a)*140,Math.sin(a)*140,.5,COLORS.silt,5,'contact');}
  }
  function updateFieldEffects(dt){
    for(let i=G.fieldEffects.length-1;i>=0;i--){const e=G.fieldEffects[i];if(e.flight>0){e.flight=Math.max(0,e.flight-dt);if(!e.flight)sound.burst(.07,.07,1800,e.x);continue;}if(e.kind==='charge')continue;e.life-=dt;e.tick-=dt;if(e.tick<=0){e.tick=.5;for(const actor of G.area.enemies)if(actor.alive&&effectCanHit(e,actor))damageEnemy(actor,7,Math.atan2(actor.y-e.y,actor.x-e.x));if(effectCanHit(e,G.player))hurtPlayer(7,0);addSoundMark(e.x,e.y,190,.25);}if(e.life<=0)G.fieldEffects.splice(i,1);}
  }
  function drawFieldEffects(){
    for(const e of G.fieldEffects){ctx.save();if(e.flight>0){const t=1-e.flight/e.maxFlight,x=lerp(e.fromX,e.x,t),y=lerp(e.fromY,e.y,t);ctx.fillStyle='rgba(7,19,19,.25)';ctx.beginPath();ctx.ellipse(x,y+10,8,4,0,0,TAU);ctx.fill();ctx.translate(x,y-Math.sin(t*Math.PI)*55);ctx.rotate(t*4);drawToolShape(e.kind);ctx.restore();continue;}
      ctx.translate(e.x,e.y);ctx.strokeStyle=e.kind==='charge'?'rgba(232,183,98,.5)':'rgba(226,132,67,.5)';ctx.lineWidth=1;ctx.setLineDash([4,7]);ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.stroke();ctx.setLineDash([]);
      if(e.kind==='charge'){drawToolShape('charge');ctx.fillStyle=Math.sin(G.time*6)>0?'#f2ca7a':'#675b39';ctx.fillRect(-1,-3,2,2);}else{ctx.fillStyle='rgba(180,76,30,.14)';ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.fill();for(let n=0;n<17;n++){const a=hash(n,3,11)*TAU,r=Math.sqrt(hash(n,4,23))*e.r*.9,x=Math.cos(a)*r,y=Math.sin(a)*r;ctx.fillStyle=n%2?'#d8833e':'#e5ad62';const h=10+Math.sin(G.time*8+n*4)*5;ctx.beginPath();ctx.moveTo(x-3,y+2);ctx.quadraticCurveTo(x-3,y-8,x+Math.sin(G.time*6+n)*3,y-h);ctx.quadraticCurveTo(x+6,y-4,x+3,y+2);ctx.fill();}}
      ctx.restore();
    }
  }
  function drawToolShape(key){
    const c=ctx;if(key==='firebottle'){c.fillStyle='#658e75';roundedPath(c,-5,-4,10,14,3);c.fill();c.fillStyle='#b7c5a0';c.fillRect(-2,-10,4,7);c.fillStyle='#d5bc83';c.fillRect(-5,0,10,5);strokeLine(c,[[-3,6],[-3,-2]],'#cad8b0',1);}
    else{c.fillStyle='#987153';roundedPath(c,-9,-6,18,12,2);c.fill();c.fillStyle='#3f594e';c.fillRect(-4,-6,5,12);c.fillStyle='#d0b788';c.fillRect(3,-3,4,5);}
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

  function combatShapes(e,pad=0){
    const a=e.weaponAngle??e.angle??e.bodyAngle??0;
return(e.type==='hound'?[[0,-2,16],[Math.cos(a)>=0?20:-20,-6,8]]:[[0,-3,e.type==='wader'?14:11],[Math.cos(a)*2,-22,7.5],[0,12,9]]).map(([x,y,r])=>({x:e.x+x,y:e.y+y,r:r+pad}));
  }
  function actorHitT(x1,y1,x2,y2,e,pad=0){let hit=null;for(const s of combatShapes(e,pad)){const t=segmentCircleT(x1,y1,x2,y2,s.x,s.y,s.r);if(t!=null&&(hit==null||t<hit))hit=t;}return hit;}

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
    if(input.device!=='touch'){if(input.mouse.down)fireSource='mouse';else if(input.keys.has('Space'))fireSource='keyboard';else if(input.pad?.fire)fireSource='gamepad';}
    return {move,aim,aimed,fire:!!fireSource,fireSource,sprint:input.keys.has('ShiftLeft')||input.keys.has('ShiftRight')||input.touchSprint||!!input.pad?.sprint};
  }

  function updatePlayer(dt){
    const p=G.player;if(!p||!p.alive)return;
    updateTouchCombat(dt);
    const controls=controlFrame();let mx=controls.move.x,my=controls.move.y;
    const ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;}
    const weight=inventoryWeight(),encumber=Math.max(0,weight-7),sprinting=controls.sprint&&p.stamina>3&&ml>.2;
    p.inWater=G.area.zones.some(z=>z.type==='water'&&p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+z.h);
    let speed=(sprinting?205:138)*(1-Math.min(.26,encumber*.022));
    if(p.inWater)speed*=.56;
    if(p.meleeTime>0)speed*=.62;else if(p.reload>0)speed*=.82;
    if(sprinting){p.stamina=Math.max(0,p.stamina-dt*(18+encumber+(p.inWater?12:0)));p.noise=Math.max(p.noise,.28);}else p.stamina=Math.min(100,p.stamina+dt*(p.inWater?5:17-encumber*.35));
    const targetVx=mx*speed,targetVy=my*speed,accel=expEase(ml>.05?19:28,dt),beforeX=p.x,beforeY=p.y;
    p.vx=lerp(p.vx,targetVx,accel);p.vy=lerp(p.vy,targetVy,accel);moveEntity(p,p.vx*dt,p.vy*dt);
    const moved=Math.hypot(p.x-beforeX,p.y-beforeY);if(moved>.001){p.step=(p.step+moved/(sprinting?42:34))%1;p.stepDistance+=moved;const stride=sprinting?32:27;while(p.stepDistance>=stride){p.stepDistance-=stride;footContact(p,sprinting);}}

    const ax=controls.aim.x,ay=controls.aim.y,aimed=controls.aimed;
    if(aimed){p.aimAngle=Math.atan2(ay,ax);p.lastAimSource=input.aimOwner;}else if(ml>.15&&input.aimOwner==='move'){p.aimAngle=Math.atan2(my,mx);p.lastAimSource='move';}
    const moveAngle=ml>.15?Math.atan2(my,mx):p.aimAngle,bodyTarget=p.meleeTime>0?p.meleeHeading:(ml>.15?moveAngle:p.aimAngle);
    p.bodyAngle=lerpAngle(p.bodyAngle,bodyTarget,expEase(ml>.15?7.5:4.2,dt));
    const key=currentWeaponKey(),w=weaponSpec(key),weaponTarget=p.reload>0?p.bodyAngle+(w.pellets?.62:key==='carbine'?.48:.34):p.aimAngle;
    if(p.meleeTime<=0)p.weaponAngle=lerpAngle(p.weaponAngle,weaponTarget,expEase(w.turn*(p.reload>0?.72:1),dt));
    p.angle=p.weaponAngle;p.moveLean=lerp(p.moveLean,clamp(angleDelta(p.bodyAngle,moveAngle),-.35,.35),expEase(5,dt));
    p.recoilV+=(-p.recoil*74-p.recoilV*15)*dt;p.recoil+=p.recoilV*dt;if(p.recoil<0){p.recoil=0;p.recoilV=Math.max(0,p.recoilV);}
    p.settle=Math.max(0,p.settle-dt);if(w.melee||w.tool){p.obstruction=0;p.wallObstruction=false;}else{const contact=weaponObstruction(p,p.weaponAngle,w.length);p.obstruction=contact.amount;p.wallObstruction=contact.wall;}

    if(!controls.fire)p.toolHeld=false;
    const queued=input.touchAttack?.key===key&&input.device==='touch';
    // A touch trigger is consumed this frame, even when blocked or empty.
    // It must never become a delayed shot after a reload, turn, or recovery.
    input.touchAttack=null;
    if((controls.fire||queued)&&(!w.tool||!p.toolHeld)&&(!w.tool||p.cooldown<=0&&p.reload<=0)){
      const accepted=fireWeapon();if(accepted){if(w.tool)p.toolHeld=true;if(queued)input.touchFlash=.12;}
    }
    p.cooldown=Math.max(0,p.cooldown-dt);p.invuln=Math.max(0,p.invuln-dt);p.noise=Math.max(0,p.noise-dt*.55);updateMelee(p,dt);
    if(p.reload>0){p.reload-=dt;if(p.reload<=0)finishReload();}
    if(p.bleeding>0){p.hp-=dt*(.65+p.bleeding*.38);if(p.hp<=0){playerDeath();return;}}

    let exposureRate=-3.8;
    for(const z of G.area.zones){if(z.type==='exposure'&&z.strength>0&&p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+z.h)exposureRate=Math.max(exposureRate,z.strength*kitStats().filter);}
    if(G.area.kind==='bunker'&&!G.area.purged)exposureRate=Math.max(exposureRate,.8*kitStats().filter);
    p.exposure=clamp(p.exposure+dt*exposureRate,0,100);
    if(p.exposure>82){p.hp-=dt*(p.exposure-80)*.045;if(p.hp<=0){playerDeath();return;}}
    if(G.area.kind==='lowland')p.maxDistance=Math.max(p.maxDistance,Math.hypot(p.x-245,p.y-905));

    G.nearest=null;let nd=96;
    for(const o of G.area.objects){if(!o.active||!o.interact)continue;const d=o.r!=null?Math.hypot(p.x-o.x,p.y-o.y)-o.r:Math.hypot(p.x-clamp(p.x,o.x,o.x+o.w),p.y-clamp(p.y,o.y,o.y+o.h));if(d<nd){nd=d;G.nearest=o;}}
    for(const n of G.area.notes){if(!n.seen&&Math.hypot(p.x-n.x,p.y-n.y)<85){n.seen=true;toast(n.text,3.2);save.skills.fieldcraft+=.08;}}

    const visibleW=G.w/G.camera.zoom,visibleH=G.h/G.camera.zoom,lookX=clamp(visibleW*.035,22,52),lookY=clamp(visibleH*.03,18,34),bias=(G.viewport?.biasPixels||0)/G.camera.zoom;
    const camEase=expEase(11,dt);G.camera.x=lerp(G.camera.x,p.x,camEase);G.camera.y=lerp(G.camera.y,p.y+bias,camEase);
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
      e.vx=0;e.vy=0;
      if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);continue;}
      if(e.reload>0){e.reload=Math.max(0,e.reload-dt);e.aim=0;if(e.reload===0){const q=Math.min(WEAPONS[e.weapon||'carbine'].mag,e.reserve||0);e.rounds=q;e.reserve-=q;sound.reload(e.x);}}
      const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),visible=d<620&&lineClear(e,p),heard=d<90+p.noise*720;
      if(visible||heard)e.alert=clamp(e.alert+dt*(visible?2.6:1.2),0,1);else e.alert=clamp(e.alert-dt*.16,0,1);
      if(e.alert>.22){
        e.idlePhase='hold';e.idleClock=Math.max(e.idleClock||0,2);e.bodyAngle=e.windup>0||e.strike>0?e.attackAngle:lerpAngle(e.bodyAngle??e.angle,a,expEase(e.type==='hound'?7:4,dt));e.angle=e.bodyAngle;
        if(e.type==='hound'||e.type==='wader'){
          const hound=e.type==='hound',range=hound?43:61,duration=hound?.3:.58;
          if(e.windup>0){e.windup=Math.max(0,e.windup-dt);e.vx=e.vy=0;if(e.windup===0){const hit=dist(e,p)<range+8&&Math.abs(angleDelta(e.attackAngle,Math.atan2(p.y-e.y,p.x-e.x)))<.9&&!segmentBlockPoint(e.x,e.y,p.x,p.y,2);if(hit){hurtPlayer(hound?14:22,.18,e.attackAngle);if(!hound)p.exposure=clamp(p.exposure+8,0,100);}sound.melee(hit?'body':'air',e.x);e.cooldown=hound?.82:1.28;e.strike=.18;}}
          else if(d>range){e.vx=Math.cos(a)*e.speed;e.vy=Math.sin(a)*e.speed;moveEntity(e,e.vx*dt,e.vy*dt);}
          else if(e.cooldown<=0){e.windup=duration;e.attackDuration=duration;e.attackAngle=e.bodyAngle=e.angle=a;sound.tone(hound?180:94,.1,'sawtooth',.027,.7,e.x);}
          e.strike=Math.max(0,(e.strike||0)-dt);
        }else{
          const ideal=WEAPONS[e.weapon||'carbine'].pellets?175:e.weapon==='carbine'?285:225;if(d>ideal+45){e.vx=Math.cos(a)*e.speed;e.vy=Math.sin(a)*e.speed;}else if(d<ideal-55){e.vx=-Math.cos(a)*e.speed*.65;e.vy=-Math.sin(a)*e.speed*.65;}else{e.vx=Math.cos(a+Math.PI/2)*e.speed*.32;e.vy=Math.sin(a+Math.PI/2)*e.speed*.32;}
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
      e.pace=(e.pace||0)+Math.hypot(e.vx,e.vy)*dt*.14;
    }
  }

  function updateBullets(dt){
    for(let i=G.bullets.length-1;i>=0;i--){const b=G.bullets[i];b.px=b.x;b.py=b.y;const nx=b.x+b.vx*dt,ny=b.y+b.vy*dt;b.life-=dt;
      const wall=segmentBlockPoint(b.px,b.py,nx,ny,1),wallT=wall?.t??2;let actor=null,actorT=2;
      if(b.from==='player')for(const e of G.area.enemies){if(!e.alive)continue;const t=actorHitT(b.px,b.py,nx,ny,e);if(t!=null&&t<actorT){actor=e;actorT=t;}}
      else if(G.player.alive){const t=actorHitT(b.px,b.py,nx,ny,G.player);if(t!=null){actor=G.player;actorT=t;}}
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
    if(best)best.focus();
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
    if(G.mode==='play'&&!G.panel){updatePlayer(dt);if(G.panel||G.transition!==0||!G.player?.alive){input.clearFrame();return;}updateAmbientPeople(dt);updateEnemies(dt);if(!G.player.alive){input.clearFrame();return;}updateBullets(dt);updateFieldEffects(dt);updateParticles(dt);updateExtraction(dt);save.minutes+=dt*.55;updateHUD();}
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
    if(!G.player)return;const key=currentWeaponKey(),w=weaponSpec(key),p=G.player;
    updateTouchPad();
    $('weapon-label').textContent=G.area?.kind==='prologue'&&!save.prologue.satchel?'EMPTY HANDS':w.name+(w.mod?' · FITTED':'');
    if(w.melee){$('ammo-mag').textContent='—';$('ammo-reserve').textContent='—';$('weapon-condition').textContent=w.condition;}
    else if(w.tool){const deployed=key==='charge'&&G.fieldEffects.some(e=>e.kind==='charge');$('ammo-mag').textContent=G.player.camp?save.stash[key]||0:p.inventory.reduce((n,s)=>n+(s.key===key?s.qty:0),0);$('ammo-reserve').textContent='—';$('weapon-condition').textContent=deployed?'FIRE TO DETONATE':'FIRE TO THROW · KEEP CLEAR';}
    else {$('ammo-mag').textContent=p.mags[key]??0;$('ammo-reserve').textContent=p.ammo[w.ammo]??0;const c=save.condition[key]||0;$('weapon-condition').textContent=p.reload>0?`RELOADING ${Math.max(0,p.reload).toFixed(1)}s`:c>65?'SERVICEABLE':c>25?'WORN':'NEEDS BENCH REPAIR';}
  }

  function openPanel(type){
    clearTransientInput();
    if(G.mode!=='play'||G.transition!==0)return;G.panel=type;const panel=$('panel'),body=$('panel-body');panel.classList.remove('hidden');$('prompt').classList.add('hidden');
    if(type==='pack'){ $('panel-kicker').textContent=G.player.camp?'SHELTER STORES':'FIELD KIT';$('panel-title').textContent='Pack & condition';body.innerHTML=packHTML(); }
    panel.classList.toggle('workshop-panel',type==='bench');
    if(type==='bench'){ $('panel-kicker').textContent='SURVEY SHELTER · SALVAGE & REBUILD';$('panel-title').textContent='The workbench';body.innerHTML=benchHTML(); }
    if(type==='mara'){ $('panel-kicker').textContent='ROUTE WARDEN';$('panel-title').textContent='Mara Vale';body.innerHTML=maraHTML(); }
    if(type==='infrastructure'){ $('panel-kicker').textContent='CIVIL WORKS · NINE-MILE';$('panel-title').textContent='A circuit, a consequence';body.innerHTML=infrastructureHTML(); }
    if(type==='surveyor'){ $('panel-kicker').textContent='SURVEY CREW · IVO';$('panel-title').textContent=save.story.surveyor?'Someone came back':'One bandage between us';body.innerHTML=surveyorHTML(); }
    if(type==='journal'){ $('panel-kicker').textContent='FIELD RECORD';$('panel-title').textContent='The Lowland remembers';body.innerHTML=journalHTML(); }
    body.querySelectorAll('[data-use]').forEach(b=>b.addEventListener('click',()=>useItem(Number(b.dataset.use))));
    body.querySelectorAll('[data-drop]').forEach(b=>b.addEventListener('click',()=>dropItem(Number(b.dataset.drop))));
    body.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>buyUpgrade(b.dataset.upgrade)));
    body.querySelectorAll('[data-long]').forEach(b=>b.addEventListener('click',()=>selectLong(b.dataset.long)));
    body.querySelectorAll('[data-sidearm]').forEach(b=>b.addEventListener('click',()=>{if(!G.player.camp||!save.weapons[b.dataset.sidearm])return;save.selectedSide=b.dataset.sidearm;persist();prepareCampAmmo();openPanel('pack');}));
    body.querySelectorAll('[data-bench-category]').forEach(b=>b.addEventListener('click',()=>{G.benchCategory=b.dataset.benchCategory;G.benchSelection=null;G.benchNotice='';openPanel('bench');}));
    body.querySelectorAll('[data-recipe]').forEach(b=>b.addEventListener('click',()=>{G.benchSelection=b.dataset.recipe;G.benchNotice='';openPanel('bench');}));
    body.querySelectorAll('[data-craft]').forEach(b=>b.addEventListener('click',()=>craftRecipe(b.dataset.craft)));
    body.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>{save.trackedRecipe=save.trackedRecipe===b.dataset.track?null:b.dataset.track;persist();openPanel('bench');}));
    body.querySelectorAll('[data-supply]').forEach(b=>b.addEventListener('click',()=>toggleSupply(b.dataset.supply)));
    body.querySelectorAll('[data-kit]').forEach(b=>b.addEventListener('click',()=>toggleKit(b.dataset.kit)));
    body.querySelectorAll('[data-equip]').forEach(b=>b.addEventListener('click',()=>equipFoundWeapon(Number(b.dataset.equip))));
    body.querySelectorAll('[data-circuit]').forEach(b=>b.addEventListener('click',()=>installCircuit(b.dataset.circuit)));
    body.querySelectorAll('[data-help-ivo]').forEach(b=>b.addEventListener('click',helpSurveyor));
    body.querySelectorAll('[data-journal]').forEach(b=>b.addEventListener('click',()=>openPanel('journal')));
    body.querySelectorAll('[data-pack]').forEach(b=>b.addEventListener('click',()=>openPanel('pack')));
    const choiceOpen=body.querySelector('[data-choice-open]');if(choiceOpen)choiceOpen.addEventListener('click',()=>{closePanel();window.__showFinalChoice();});
    const accept=body.querySelector('[data-accept]');if(accept)accept.addEventListener('click',acceptContract);
    if(type==='pack')drawKitPreview();if(type==='bench')drawBenchPreview();sound.ui();setTimeout(()=>{if(type==='bench')(body.querySelector('[data-recipe].selected')||body.querySelector('button:not([disabled])'))?.focus({preventScroll:true});else defaultFocus();},0);
  }
  function closePanel(){G.panel=null;$('panel').classList.add('hidden');sound.ui();}

  function quickHeal(){const p=G.player;if(!p||G.mode!=='play'||G.panel)return;const key=p.bleeding>0||p.hp<p.maxHp?(hasItem('bandage')?'bandage':'medicine'):p.exposure>5?'cleanwater':null;const index=p.inventory.findIndex(s=>s.key===key);if(index<0){toast(key?'NO SUITABLE SUPPLY IN YOUR PACK':'NO TREATMENT NEEDED');return;}useItem(index);}

  function packHTML(){
    const p=G.player,slots=[];for(let i=0;i<p.cap;i++){const s=p.inventory[i];if(s){const it=ITEMS[s.key],action=(it.weapon||it.tool)?`data-equip="${i}"`:it.usable?`data-use="${i}"`:'';slots.push(`<div class="slot"><em>${s.qty}</em><b>${it.name}</b><small>${it.use}${s.secured?' · recovery kit':''}</small><div class="slot-actions">${action?`<button ${action}>${it.weapon||it.tool?'WIELD':'USE'}</button>`:''}${!p.camp&&!it.quest?`<button data-drop="${i}" aria-label="Discard one ${it.name}">DISCARD</button>`:''}</div></div>`);}else slots.push('<div class="slot empty"><b>Empty slot</b><small>Room to bring something home.</small></div>');}
    const stash=Object.entries(save.stash).filter(([,v])=>v>0).map(([k,v])=>`<div class="resource-row"><span>${resourceName(k)}</span><b>${v}</b></div>`).join('');
    const skills=Object.keys(save.skills).map(k=>`<div class="skill-row"><span>${k[0].toUpperCase()+k.slice(1)}</span><b>${['UNTESTED','PRACTICED','STEADY','SEASONED','EXPERT'][skillLevel(k)]}</b></div>`).join('');
    const loadout=p.camp?[[SIDEARMS,'SIDEARM','sidearm',save.selectedSide],[LONG_GUNS,'LONG GUN · OPTIONAL','long',save.selectedLong]].map(([keys,label,attr,selected])=>`<p class="section-label">${label} · CARRY ONE</p><div class="upgrade-grid">${keys.filter(k=>save.weapons[k]).map(k=>`<button class="upgrade ${selected===k?'owned':''}" data-${attr}="${k}"><span><strong>${ITEMS[k]?.name||WEAPONS[k].name}</strong><small>${WEAPONS[k].mag} loaded · ${resourceName(WEAPONS[k].ammo)} · ${save.stash[WEAPONS[k].ammo]||0} stored</small></span><b>${selected===k?'PACKED':'SELECT'}</b></button>`).join('')||'<p>No secured weapon in this slot.</p>'}</div>`).join(''):'';
    const supplies=p.camp?`<p class="section-label">FIELD PROVISIONS · ${departurePlan().slots}/${kitStats().capacity} SLOTS INCLUDING RECOVERY KIT</p><div class="upgrade-grid">${PROVISIONS.map(k=>`<button class="upgrade ${save.prepared[k]&&(save.stash[k]||0)>0?'owned':''}" data-supply="${k}" ${!save.prepared[k]&&(save.stash[k]||0)<1?'disabled':''}><span><strong>${ITEMS[k].name}</strong><small>${ITEMS[k].use}</small></span><b>${(save.stash[k]||0)<1?'NONE':save.prepared[k]?'PACKED':'SELECT'}</b></button>`).join('')}</div>`:'';
    const carriedPack=`<p class="section-label">FIELD PACK · ${inventoryWeight().toFixed(1)} KG</p><div class="inventory-grid">${slots.join('')}</div>`;
    return `${p.camp?'':carriedPack}<button class="journal-link" data-journal>FIELD RECORD · ROUTES & CONSEQUENCES</button>${kitHTML()}<p class="field-note">${p.camp?'Select provisions for the next outing. Banked supplies stay safe until packed.':'Extraction banks the pack. Death does not. H or HEAL uses a carried dressing.'}</p>${p.camp?carriedPack:''}${loadout}${supplies}<p class="section-label">SHELTER STORES</p>${stash}<p class="section-label">PRACTICE · NO LEVEL SCALING</p>${skills}`;
  }
  function resourceName(k){return ({parts:'Machine parts',cloth:'Dry cloth',medicine:'Medicine',cleanwater:'Clean water',bandage:'Bandages',relaycell:'Power cells',ammo22:'.22 rounds',ammo45:'.45 Colt rounds',ammo9:'9mm rounds',shells410:'.410 shells',shells:'12-gauge shells',carbineAmmo:'5.56 / .223 rounds'})[k]||ITEMS[k]?.name||k.toUpperCase();}
  function departurePlan(){const quantities={bandage:wears('medroll')?2:1};for(const k of PROVISIONS)if(save.prepared[k]&&(save.stash[k]||0)>0)quantities[k]=(quantities[k]||0)+1;return{quantities,slots:Object.entries(quantities).reduce((n,[k,q])=>n+Math.ceil(q/ITEMS[k].stack),0)};}
  function dropItem(index){const p=G.player,s=p.inventory[index];if(!s||p.camp||ITEMS[s.key].quest)return;if(p.reload>0||p.meleeTime>0){toast('FINISH THE CURRENT ACTION BEFORE DISCARDING');return;}const key=s.key,w=ITEMS[key].weapon,name=ITEMS[key].short,active=currentWeaponKey();removeItem(key,1);if(w&&!save.weapons[w]&&!hasItem(key)){p.ammo[WEAPONS[w].ammo]+=p.mags[w]||0;p.mags[w]=0;p.weaponList=p.weaponList.filter(k=>k!==w);p.weaponIndex=Math.max(0,p.weaponList.indexOf(active));p.obstruction=0;}closePanel();updateHUD(true);toast(`${name} DISCARDED · SPACE MADE`);}

  const UPGRADE_DATA={
    bag:{name:'Waxed field bag',desc:'Four more carry slots. More choice, and more at risk.',cost:{parts:4,cloth:2}},
    cape:{name:'Oilskin rain cape',desc:'Reduces exposure gained in contaminated ground by 35%.',cost:{cloth:4,parts:2}},
    survey:{name:'Survey table',desc:'Marks major sites and the waterworks on your field map.',cost:{parts:5,cleanwater:1}},
    medroll:{name:'Organized medical roll',desc:'Worn on the belt. Carry a second starting bandage; dress wounds more effectively.',cost:{medicine:2,cloth:2}},
    helmet:{name:'Salvaged civil helmet',desc:'Visible steel shell. 7% less impact damage; adds 1.1 kg.',cost:{parts:3,cloth:1}},
    vest:{name:'Patchwork plate vest',desc:'Visible chest plates. 18% less impact damage; adds 2.8 kg. Weight eats into your carrying margin.',cost:{parts:6,cloth:3}},
    respirator:{name:'Rebuilt filter respirator',desc:'Visible face mask and filters. 45% less exposure gain; adds 0.5 kg. Combines with the oilskin cape.',cost:{parts:4,cloth:2}}
  };
  const WEARABLES=['bag','cape','medroll','helmet','vest','respirator'];
  function kitHTML(){
    const stats=kitStats(),owned=WEARABLES.filter(k=>save.upgrades[k]);
    return `<div class="kit-view"><canvas id="kit-preview" width="680" height="400" aria-label="Your actual worn equipment"></canvas><span>WORN, HOLSTERED & CARRIED</span></div><div class="kit-stats"><span>Impact protection <b>${Math.round(stats.armor*100)}%</b></span><span>Exposure reduction <b>${Math.round((1-stats.filter)*100)}%</b></span><span>Carry slots <b>${stats.capacity}</b></span></div><p class="section-label">WORN KIT${G.player.camp?' · TAP TO CHANGE':' · CHANGE AT SHELTER'}</p><div class="gear-grid">${owned.length?owned.map(k=>`<button data-kit="${k}" class="gear ${wears(k)?'equipped':''}" ${G.player.camp?'':'disabled'}><b>${UPGRADE_DATA[k].name}</b><small>${wears(k)?'WORN':'STORED'}</small></button>`).join(''):'<p class="field-note">A coat, boots, and what you can recover. The workbench turns supplies into visible equipment.</p>'}</div>`;
  }
  function toggleKit(key){if(!G.player.camp||!WEARABLES.includes(key)||!save.upgrades[key])return;save.kit[key]=!wears(key);G.player.cap=kitStats().capacity;save.packSize=G.player.cap;persist();openPanel('pack');}
  function equipFoundWeapon(index){const item=G.player.inventory[index],key=ITEMS[item?.key]?.weapon||ITEMS[item?.key]?.tool,p=G.player;if(!key)return;if(p.reload>0||p.meleeTime>0){toast('FINISH THE CURRENT ACTION BEFORE CHANGING ARMS');return;}if(!p.weaponList.includes(key))p.weaponList.push(key);p.weaponIndex=p.weaponList.indexOf(key);p.obstruction=0;p.cooldown=Math.max(p.cooldown,.25);closePanel();updateHUD(true);toast(WEAPONS[key].tool?'FIRE TO THROW · REMOTE CHARGE: FIRE AGAIN TO DETONATE':'WEAPON IN HAND · RELOAD FROM YOUR CARRIED AMMUNITION');}
  function drawKitPreview(){
    const node=$('kit-preview');if(!node?.getContext)return;const previous=ctx;try{ctx=node.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,680,400);ctx.setTransform(4.8,0,0,4.8,325,205);const p={...G.player,x:0,y:0,vx:0,vy:0,step:0,bodyAngle:-.48,weaponAngle:-.38,aimAngle:-.38,meleeHeading:-.38,meleeTime:0,recoil:0,obstruction:0,invuln:0};drawPlayer(p);}finally{ctx=previous;}
  }
  function drawBenchPreview(){
    const node=$('bench-preview'),r=RECIPES[G.benchSelection];if(!node?.getContext||!r)return;const previous=ctx;
    try{ctx=node.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,680,270);ctx.strokeStyle='rgba(177,202,165,.09)';ctx.lineWidth=1;for(let x=0;x<680;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,270);ctx.stroke();}for(let y=0;y<270;y+=34){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(680,y);ctx.stroke();}
      ctx.fillStyle='rgba(5,17,17,.28)';ctx.beginPath();ctx.ellipse(350,198,210,18,0,0,TAU);ctx.fill();
      if(r.weapon){const w=WEAPONS[r.weapon],scale=LONG_GUNS.includes(r.weapon)?5.7:6.8;ctx.translate(r.weapon==='prybar'?210:270,125);ctx.scale(scale,scale);const rear={x:0,y:0},angle=-.12,muzzle=localPoint(0,0,angle,w.length,0);drawHeldWeapon({rear,muzzle,angle,baseLength:w.artLength||w.length,mod:r.type==='fitting'?G.benchSelection:weaponSpec(r.weapon).mod},r.weapon);if(G.benchSelection==='loader'){ctx.fillStyle='#a18b61';roundedPath(ctx,2,12,14,8,2);ctx.fill();for(let x=4;x<15;x+=3){ctx.fillStyle='#e0bd76';ctx.fillRect(x,13,1.8,5);}}
      }else if(r.type==='gear'){ctx.translate(330,144);ctx.scale(3.9,3.9);const p={...G.player,x:0,y:0,vx:0,vy:0,step:0,inventory:[],weaponList:['prybar'],weaponIndex:0,bodyAngle:.4,weaponAngle:.4,meleeTime:0,recoil:0,obstruction:0};drawHumanoid(p,{player:true,angle:.4,previewKit:G.benchSelection});if(G.benchSelection==='survey'){ctx.fillStyle='#bbbc94';ctx.fillRect(20,-15,30,24);strokeLine(ctx,[[23,2],[31,-9],[38,-4],[46,-12]],'#46695e',1.5);}
      }else{ctx.translate(285,126);ctx.rotate(-.14);for(let i=0;i<(G.benchSelection==='dressings'?2:1);i++){const x=i*100;ctx.fillStyle='#aeb69c';roundedPath(ctx,x,-27,76,56,12);ctx.fill();ctx.fillStyle='#e4dfbd';ctx.beginPath();ctx.ellipse(x+10,0,17,28,0,0,TAU);ctx.fill();ctx.strokeStyle='#929d83';ctx.lineWidth=2;for(let n=8;n<26;n+=5){ctx.beginPath();ctx.ellipse(x+10,0,n*.5,n,0,0,TAU);ctx.stroke();}ctx.fillStyle='#6b846f';ctx.fillRect(x+44,-27,9,54);}}
    }finally{ctx=previous;}
  }
  function infrastructureHTML(){return `<p class="field-note">The pump and rescue beacon share a stripped switch house. One ceramic cell powers one circuit. Find another cell and you can restore both.</p><p>Cells survive extraction in your stores; select one in Field provisions to carry it back out. Sources: the Service Yard's striped case and the Waterworks entrance cabinet.</p><div class="upgrade-grid">${[['pump','Drain the flood basin','The southern basin dries, its contamination clears, and the tank provides one clean water each outing.'],['beacon','Power the rescue beacon','Opens a second extraction here. Hold still for five seconds without firing or taking a hit.']].map(([k,name,desc])=>`<button class="upgrade ${save.story[k]?'owned':''}" data-circuit="${k}" ${save.story[k]?'disabled':''}><span><strong>${name}</strong><small>${desc}</small></span><b>${save.story[k]?'RUNNING':'1 POWER CELL'}</b></button>`).join('')}</div>`;}
  function surveyorHTML(){return save.story.surveyor?`<p class="field-note">“I counted the flags all the way back. Next time you go out, look for my blue cloth. It marks the dry approach to Nine-Mile—not a promise that nothing will shoot at you.”</p><p>Ivo has a place at the shelter now. His route markers remain between outings.</p>`:`<p class="field-note">“The skiff hit a submerged barrier. I can walk, but this won't stop bleeding. You have a dressing?”</p><p>Give Ivo one bandage or medicine. He can get himself to the shelter; on later outings, his flags mark the route to Nine-Mile. That is one less healing item in your own pack.</p><button class="primary" data-help-ivo>GIVE A DRESSING</button>`;}
  function journalHTML(){
    const entries=[['Bring the regulator home',save.regulatorBanked,'Eastern Waterworks → return west. A heavy piece, visibly strapped to your pack.'],['A place for Ivo',save.story.surveyor,'The grounded skiff south-east of the west exit. Bring a bandage or medicine.'],['Clean water at Nine-Mile',save.story.pump,'Fit a ceramic cell to the pump. The basin and the shelter change.'],['Another way home',save.story.beacon,'Fit a second cell to the beacon. Pickups take five exposed seconds.']];
    return `<p class="field-note">You keep repairs, people helped, and banked kit. Loose supplies and uncleared encounters change between outings. The western route is always open.</p>${entries.map(([name,done,desc])=>`<article class="record ${done?'complete':''}"><small>${done?'DONE · LASTING CHANGE':'OPEN THREAD'}</small><h3>${name}</h3><p>${desc}</p></article>`).join('')}<p>Field clothing, weapons, protective gear, belt supplies, and the regulator are visible on your survivor. Small loose salvage stays inside the bag.</p><button class="secondary" data-pack>BACK TO FIELD KIT</button>`;
  }
  function costText(cost){return Object.entries(cost).map(([k,v])=>`${v} ${resourceName(k)}`).join(' · ');}
  function canPay(cost){return Object.entries(cost).every(([k,v])=>(save.stash[k]||0)>=v);}
  const RECIPES={
    ...Object.fromEntries(Object.entries(FITTINGS).map(([id,r])=>[id,{...r,type:'fitting',category:'arms'}])),
    restore410:{type:'weapon',category:'arms',weapon:'field410',name:'Restore the .410 single-shot',desc:'A light folding gun recovered from the hunter’s locker. One careful shot, then reload.',benefit:'5 pellets × 13 damage · 1.42 s reload',trade:'One shell · .410 ammunition only',cost:{field410Wreck:1,parts:2,cloth:1}},
    restore45:{type:'weapon',category:'arms',weapon:'colt',name:'Restore the .45 Colt',desc:'The flood warden’s heavy six-shooter. Slower, louder and harder hitting than the little .22.',benefit:'47 damage · six-round cylinder',trade:'2.45 s reload · strong recoil',cost:{coltWreck:1,parts:3,cloth:1}},
    restore9:{type:'weapon',category:'arms',weapon:'pistol9',name:'Restore the 9mm service pistol',desc:'A compact service pistol for quick follow-up shots.',benefit:'12-round magazine · 1.45 s reload',trade:'25 damage · wider spread than the .22',cost:{pistol9Wreck:1,parts:3,cloth:1}},
    dressing:{type:'supply',category:'supplies',name:'Fold a field dressing',desc:'Put dry cloth to work now, or save it for a fitting.',benefit:'1 field bandage → shelter stores',trade:'Select it in Pack before departing',cost:{cloth:1},output:{bandage:1}},
    dressings:{type:'supply',category:'supplies',name:'Prepare a dressing bundle',desc:'Clean and portion the cloth at the shelter.',benefit:'2 field bandages → shelter stores',trade:'Uses one clean water as well as cloth',cost:{cloth:1,cleanwater:1},output:{bandage:2}},
    firebottle:{type:'supply',category:'arms',weapon:'firebottle',name:'Fire bottle',desc:'An improvised tool for holding a narrow approach, made from recovered incendiary salvage.',benefit:'A burning patch that lasts 6 seconds',trade:'Hurts you too · fire to throw · pack before leaving',cost:{burnerSalvage:1,cloth:1},output:{firebottle:1}},
    charge:{type:'supply',category:'arms',weapon:'charge',name:'Remote demolition charge',desc:'A recovered demolition pack with a salvaged remote. Throws and detonates with the same attack control.',benefit:'Up to 120 damage inside the marked blast area',trade:'Harms you too · one deployed charge · lost on leaving the area',cost:{demoSalvage:1,parts:1},output:{charge:1}},
    ...Object.fromEntries(Object.entries(UPGRADE_DATA).map(([id,r])=>[id,{...r,type:'gear',category:'gear',benefit:r.desc,trade:'Build once · change worn kit in Pack'}])),
    ...Object.fromEntries(firearmKeys.map(k=>['repair_'+k,{type:'repair',category:'care',weapon:k,name:'Service '+(ITEMS[k]?.name||'.22 revolver'),desc:'Clean and replace worn working parts. Service only the gun that needs attention.',benefit:'Restore condition to 100%',trade:'Does not provide ammunition',cost:{parts:1,cloth:1}}]))
  };
  const salvageHint=k=>({parts:'Tool lockers at the Service Yard; armed scavengers.',cloth:'Relief crates and the Nine-Mile flood store.',cleanwater:'Flood Chapel relief crate; a restored Nine-Mile tank.',medicine:'Flood Chapel relief crate.',coltWreck:'The warden’s lockbox beside Flood Chapel.',field410Wreck:'Hunter’s locker east of the grounded skiff, near the western route.',pistol9Wreck:'The small weapon case at the Service Yard.',burnerSalvage:'Sealed salvage case at the Service Yard.',demoSalvage:'Salvage case behind the Ranger Relay.'})[k]||'Search field caches and return with the salvage.';
  function recipeState(id){const r=RECIPES[id];if(!r)return{};const owned=r.type==='gear'?!!save.upgrades[id]:r.type==='fitting'?!!save.fittings[id]:r.type==='weapon'?!!save.weapons[r.weapon]:false;const equipped=r.type==='fitting'&&save.weaponMods[r.weapon]===id;const locked=(r.type==='fitting'&&r.weapon!=='prybar'||r.type==='repair')&&!save.weapons[r.weapon];const done=r.type==='repair'&&(save.condition[r.weapon]??100)>=100;return{owned,equipped,locked,done,ready:!locked&&!done&&(owned||canPay(r.cost))};}
  function benchHTML(){
    const list=Object.entries(RECIPES).filter(([,r])=>r.category===G.benchCategory&&(r.type!=='repair'||save.weapons[r.weapon]));
    if(!list.some(([k])=>k===G.benchSelection))G.benchSelection=list[0]?.[0];const id=G.benchSelection,r=RECIPES[id],s=recipeState(id);
    const tabs=[['arms','Arms'],['supplies','Supplies'],['gear','Equipment'],['care','Maintenance']].map(([k,n])=>`<button data-bench-category="${k}" aria-pressed="${G.benchCategory===k}">${n}</button>`).join('');
    const cards=list.map(([k,u])=>{const q=recipeState(k);return `<button class="recipe-card ${k===id?'selected':''}" data-recipe="${k}" aria-pressed="${k===id}"><small>${u.type==='weapon'?'RESTORE A FIREARM':u.type==='fitting'?WEAPONS[u.weapon].name:u.type==='repair'?`${Math.round(save.condition[u.weapon]??100)}% CONDITION`:'SHELTER PROJECT'}</small><strong>${u.name}</strong><span>${q.equipped?'FITTED':q.owned?'BUILT':q.done?'SERVICED':q.locked?'RECOVER THE WEAPON':q.ready?'READY TO MAKE':'SALVAGE NEEDED'}</span></button>`;}).join('');
    if(!r)return `<nav class="bench-tabs" aria-label="Workbench categories">${tabs}</nav><p>No secured firearms need a maintenance listing yet.</p>`;
    const ingredients=Object.entries(r.cost).map(([k,q])=>`<div class="ingredient ${(save.stash[k]||0)<q?'missing':''}"><span>${resourceName(k)}</span><b>${save.stash[k]||0} / ${q}</b></div>`).join('');
    const sources=Object.entries(r.cost).filter(([k,q])=>(save.stash[k]||0)<q).map(([k])=>salvageHint(k));
    const action=s.equipped?'REMOVE FITTING':s.owned&&r.type==='fitting'?'FIT · NO COST':s.owned?'ALREADY BUILT':s.done?'ALREADY SERVICED':s.locked?'RECOVER & BANK THIS GUN':r.type==='weapon'?'RESTORE & EQUIP':r.type==='repair'?'SERVICE WEAPON':r.type==='fitting'?'BUILD & FIT':'MAKE PROJECT';
    return `<nav class="bench-tabs" aria-label="Workbench categories">${tabs}</nav><div class="workshop-layout"><div class="recipe-list">${cards}</div><article class="recipe-detail"><div class="assembly-view"><canvas id="bench-preview" width="680" height="270" aria-label="${r.name} procedural preview"></canvas><span>${r.type==='fitting'?'ONE FITTING PER WEAPON · SWAP FREELY':'SALVAGE → WORKING KIT'}</span></div><small class="recipe-kind">${s.equipped?'FITTED TO YOUR WEAPON':r.type==='repair'?`CURRENT CONDITION ${Math.round(save.condition[r.weapon]??100)}%`:'PROJECT / '+String(list.findIndex(([k])=>k===id)+1).padStart(2,'0')}</small><h3>${r.name}</h3><p>${r.desc}</p><div class="recipe-result"><b>${r.benefit}</b><span>${r.trade}</span></div>${!s.owned?`<p class="section-label">BANKED MATERIALS</p><div class="ingredients">${ingredients}</div>`:''}<div class="craft-actions"><button class="primary" data-craft="${id}" ${!s.ready||(s.owned&&r.type!=='fitting')?'disabled':''}>${action}</button>${!s.owned?`<button data-track="${id}" aria-pressed="${save.trackedRecipe===id}">${save.trackedRecipe===id?'UNPIN':'PIN SALVAGE'}</button>`:''}</div><p class="craft-notice" role="status" aria-live="polite">${G.benchNotice|| (s.locked?'Find and extract with this weapon before modifying it.':sources.length?[...new Set(sources)].join(' '):s.owned?'Your built equipment stays at the shelter between outings.':'All materials ready. Crafting is immediate.')}</p></article></div>`;
  }
  function buyUpgrade(key){craftRecipe(key);}
  function craftRecipe(id){
    if(!G.player?.camp||G.mode!=='play'||G.transition!==0)return;const r=RECIPES[id],s=recipeState(id);if(!r||!s.ready||(s.owned&&r.type!=='fitting'))return;
    if(!s.owned)Object.entries(r.cost).forEach(([k,q])=>save.stash[k]-=q);
    if(r.type==='fitting'){save.fittings[id]=true;save.weaponMods[r.weapon]=s.equipped?null:id;G.benchNotice=s.equipped?'Fitting stored. Original handling restored.':'Fitting attached. Its handling and appearance are live.';}
    else if(r.type==='gear'){save.upgrades[id]=true;save.kit[id]=true;save.packSize=G.player.cap=kitStats().capacity;save.campLevel=Math.min(4,save.campLevel+1);G.benchNotice='Built and worn. Change worn equipment in Pack.';}
    else if(r.type==='weapon'){save.weapons[r.weapon]=true;save.condition[r.weapon]=100;save[LONG_GUNS.includes(r.weapon)?'selectedLong':'selectedSide']=r.weapon;prepareCampAmmo();G.benchNotice='Restored and selected. Bring compatible ammunition from your stores.';}
    else if(r.type==='supply'){for(const [k,q]of Object.entries(r.output))save.stash[k]=(save.stash[k]||0)+q;G.benchNotice='Made and banked. Select these provisions in Pack before leaving.';}
    else{save.condition[r.weapon]=100;G.benchNotice='Working parts serviced. Condition restored to 100%.';}
    save.skills.mechanics+=s.owned?0:.4;if(save.trackedRecipe===id)save.trackedRecipe=null;G.benchSelection=id;persist();sound.tone(r.type==='supply'?390:180,.12,'triangle',.08,1.6);sound.burst(.06,.045,2100);openPanel('bench');updateHUD(true);
  }
  function selectLong(key){if(!save.weapons[key])return;save.selectedLong=save.selectedLong===key?null:key;persist();prepareCampAmmo();openPanel('pack');toast(save.selectedLong?`${WEAPONS[key].name} PACKED FOR NEXT OUTING`:'SIDEARM ONLY');}
  function toggleSupply(key){if(!save.prepared.hasOwnProperty(key))return;if(!save.prepared[key]&&(save.stash[key]||0)<1){toast('NONE BANKED');return;}save.prepared[key]=!save.prepared[key];persist();prepareCampAmmo();openPanel('pack');}

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
    if(area.kind==='camp'){const ground=ctx.createRadialGradient(680,470,110,680,470,540);ground.addColorStop(0,'#535b44');ground.addColorStop(.52,'#404e3d');ground.addColorStop(1,area.bg);ctx.fillStyle=ground;ctx.fillRect(120,30,1120,850);}
    if(area.kind==='bunker'){
      ctx.fillStyle='#101517';ctx.fillRect(0,0,area.w,area.h);
      for(const f of area.floors){
        ctx.fillStyle=f.corridor?'#343b39':'#3d4440';ctx.fillRect(f.x,f.y,f.w,f.h);
        if(!f.corridor){ctx.strokeStyle='#758076';ctx.lineWidth=7;ctx.strokeRect(f.x,f.y,f.w,f.h);ctx.strokeStyle='rgba(10,15,17,.52)';ctx.lineWidth=2;ctx.strokeRect(f.x+9,f.y+9,f.w-18,f.h-18);ctx.fillStyle='#252f30';ctx.fillRect(f.x+5,f.y+5,f.w-10,11);strokeLine(ctx,[[f.x+12,f.y+18],[f.x+f.w-15,f.y+18],[f.x+f.w-15,f.y+f.h-24]],'#85654a',4);strokeLine(ctx,[[f.x+12,f.y+15],[f.x+f.w-18,f.y+15]],'#b3a078',1);ctx.fillStyle='rgba(122,137,111,.15)';ctx.fillRect(f.x+17,f.y+f.h-21,f.w-35,5);ctx.font='bold 16px monospace';ctx.fillStyle='rgba(205,191,151,.17)';ctx.fillText(['01 / INTAKE','FILTER HALL','KEEP CLEAR','PUMP GALLERY'][f.room%4],f.x+21,f.y+f.h-35);}
        ctx.strokeStyle='rgba(238,228,198,.065)';ctx.lineWidth=1;
        for(let x=f.x+22;x<f.x+f.w;x+=34){ctx.beginPath();ctx.moveTo(x,f.y+8);ctx.lineTo(x,f.y+f.h-8);ctx.stroke();}
      }
      for(let y=Math.floor(top/36)*36;y<bottom;y+=36)for(let x=Math.floor(left/36)*36;x<right;x+=36)if(bunkerWalkable(x,y)){const h=hash(x/36,y/36,area.w);ctx.fillStyle=h>.7?'rgba(105,167,154,.055)':'rgba(11,16,18,.06)';ctx.fillRect(x+3,y+3,2+h*8,1.5);}
      for(const light of area.lights){ctx.save();ctx.translate(light.x,light.y);ctx.fillStyle=light.on?(light.kind==='emergency'?COLORS.rust:COLORS.tealBright):'#29302f';ctx.strokeStyle=COLORS.ink;ctx.lineWidth=2;roundedPath(ctx,-17,-5,34,10,3);ctx.fill();ctx.stroke();if(light.on){ctx.globalAlpha=.45+.15*Math.sin(G.time*5+light.x);ctx.fillStyle=COLORS.paper;ctx.fillRect(-10,-1,20,2);}ctx.restore();}
      return;
    }
    // Low-frequency material masses first; tiny flecks never define the terrain.
    for(let y=Math.floor((top-210)/240)*240;y<bottom+210;y+=240)for(let x=Math.floor((left-210)/240)*240;x<right+210;x+=240){const h=hash(x/240,y/240,area.seed||19);if(h<.32)continue;const cx=x+h*160,cy=y+hash(y,x,21)*170,r=150+h*80,g=ctx.createRadialGradient(cx,cy,4,cx,cy,r);g.addColorStop(0,h>.65?'rgba(157,146,91,.15)':'rgba(10,36,34,.15)');g.addColorStop(1,'rgba(30,55,39,0)');ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,2*r,2*r);}
    for(const zone of area.zones){
      if(zone.type==='water'){
        ctx.fillStyle='#445347';roundedPath(ctx,zone.x-14,zone.y-12,zone.w+28,zone.h+24,16);ctx.fill();ctx.fillStyle='#203d3c';ctx.fillRect(zone.x-3,zone.y-3,zone.w+6,zone.h+6);const water=ctx.createLinearGradient(zone.x,zone.y,zone.x+zone.w,zone.y+zone.h);water.addColorStop(0,'#426865');water.addColorStop(.6,'#30534f');water.addColorStop(1,'#253f3c');ctx.fillStyle=water;ctx.fillRect(zone.x,zone.y,zone.w,zone.h);ctx.strokeStyle='rgba(155,187,164,.16)';ctx.lineWidth=.8;
        for(let y=Math.max(zone.y+16,Math.floor(top/24)*24);y<Math.min(zone.y+zone.h,bottom);y+=24){ctx.beginPath();for(let x=Math.max(zone.x,left);x<Math.min(zone.x+zone.w,right);x+=24)ctx.lineTo(x,y+Math.sin(x*.027+y*.013+G.time*.5)*3);ctx.stroke();}
        for(let x=Math.max(zone.x,left);x<Math.min(zone.x+zone.w,right);x+=28){const h=hash(x,zone.y,32);ctx.fillStyle=h>.5?'#82845c':'#4b6250';ctx.beginPath();ctx.ellipse(x,zone.y+3,13+h*9,5+h*3,0,0,TAU);ctx.fill();strokeLine(ctx,[[x,zone.y+4],[x+Math.sin(G.time*1.4+x)*2-4,zone.y-10-h*10]],'#8b9471',1.4);}
      } else {
        if(zone.strength<=0)continue;ctx.fillStyle='rgba(182,214,74,.075)';ctx.fillRect(zone.x,zone.y,zone.w,zone.h);ctx.strokeStyle='rgba(182,214,74,.2)';ctx.lineWidth=2;ctx.setLineDash([12,14]);ctx.strokeRect(zone.x+5,zone.y+5,zone.w-10,zone.h-10);ctx.setLineDash([]);for(let i=0;i<8;i++){const x=zone.x+20+hash(i,zone.x,3)*(zone.w-40),y=zone.y+20+hash(i,zone.y,5)*(zone.h-40);ctx.fillStyle='rgba(139,166,69,.16)';ctx.beginPath();ctx.ellipse(x,y,18+i*2,8+i,0,0,TAU);ctx.fill();ctx.strokeStyle='rgba(182,214,74,.3)';ctx.beginPath();ctx.arc(x,y,3+(G.time*.9+i)%4,0,TAU);ctx.stroke();}
      }
    }
    for(const road of area.paths){
      ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(road.points[0].x,road.points[0].y);for(let i=1;i<road.points.length;i++)ctx.lineTo(road.points[i].x,road.points[i].y);
      ctx.strokeStyle=road.kind==='oldroad'?'#3e463b':'rgba(115,115,82,.08)';ctx.lineWidth=road.width+20;ctx.stroke();ctx.strokeStyle=road.kind==='oldroad'?'#676451':'#686953';ctx.lineWidth=road.width;ctx.stroke();ctx.strokeStyle='rgba(159,154,115,.10)';ctx.lineWidth=road.width*.54;ctx.stroke();
      if(road.kind==='oldroad'){ctx.strokeStyle='rgba(238,228,198,.17)';ctx.lineWidth=2;ctx.setLineDash([18,24]);ctx.stroke();ctx.setLineDash([]);}
      // Broken shoulders and wheel wear follow each road, never a world-space scatter.
      for(let n=1;n<road.points.length;n++){const a=road.points[n-1],b=road.points[n],len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;for(let d=0;d<len;d+=17){const t=d/len,h=hash(n,d,41),x=lerp(a.x,b.x,t),y=lerp(a.y,b.y,t);if(!onScreenWorld(x,y,80)||h<.72)continue;for(const side of [-1,1]){const edge=road.width*(.46+h*.12);ctx.fillStyle=h>.6?'rgba(130,133,86,.13)':'rgba(36,56,40,.15)';ctx.beginPath();ctx.ellipse(x+nx*edge*side,y+ny*edge*side,8+h*10,3+h*3,Math.atan2(b.y-a.y,b.x-a.x),0,TAU);ctx.fill();}if(road.kind!=='oldroad'&&h>.55){strokeLine(ctx,[[x-3,y],[x+4,y+2]],'rgba(187,168,119,.16)',2);}}}
      for(let i=1;i<road.points.length;i++){const a=road.points[i-1],b=road.points[i],len=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;for(let d=12;d<len;d+=37){const h=hash(d,i,area.seed||13),x=lerp(a.x,b.x,d/len)+nx*(h-.5)*road.width*.8,y=lerp(a.y,b.y,d/len)+ny*(h-.5)*road.width*.8;if(!onScreenWorld(x,y,30))continue;strokeLine(ctx,[[x-8,y-4],[x-1,y+2],[x+4,y-1],[x+11,y+4]],road.kind==='oldroad'?'rgba(20,29,28,.24)':'rgba(174,163,117,.12)',road.kind==='oldroad'?1.4:2.5);}}
    }
    const grid=42;
    for(let y=Math.floor(top/grid)*grid;y<bottom;y+=grid)for(let x=Math.floor(left/grid)*grid;x<right;x+=grid){
      const h=hash(x/grid,y/grid,area.seed||19);if(h<.52)continue;ctx.save();ctx.translate(x+h*18,y+hash(y/grid,x/grid,3)*19);ctx.rotate(h*TAU);ctx.strokeStyle=h>.84?'rgba(238,228,198,.09)':'rgba(11,16,18,.09)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,0);ctx.quadraticCurveTo(0,-3,7,1);ctx.stroke();ctx.restore();
    }
    if(area.kind==='lowland'){
      strokeLine(ctx,[[1498,1060],[1498,1148],[1554,1170]],save.story.pump?'#84947c':'#51483d',7);strokeLine(ctx,[[1510,1060],[1580,1010],[1630,1050]],save.story.beacon?'#b39b63':'#423c35',2.5);
      if(save.story.pump){
        ctx.fillStyle='#505b47';roundedPath(ctx,1390,1181,340,248,12);ctx.fill();ctx.fillStyle='#746d50';ctx.fillRect(1400,1190,320,230);strokeLine(ctx,[[1400,1420],[1400,1190],[1720,1190]],'#9b9773',4);strokeLine(ctx,[[1404,1418],[1719,1418],[1719,1192]],'#354c41',5);
        for(let i=0;i<17;i++){const x=1410+hash(i,17,23)*300,y=1200+hash(i,23,19)*200;ctx.fillStyle=i%3?'rgba(48,64,46,.13)':'rgba(175,161,104,.15)';ctx.beginPath();ctx.ellipse(x,y,12+hash(i,8,2)*31,6+hash(i,3,8)*11,hash(i,4,2),0,TAU);ctx.fill();strokeLine(ctx,[[x-9,y-5],[x,y],[x+9,y-3],[x+14,y+4]],'#596148',.7);}
        for(let i=0;i<3;i++){ctx.fillStyle='#405e55';ctx.beginPath();ctx.ellipse(1450+i*74,1320+Math.sin(i*2)*51,21+i*8,7+i*2,-.3,0,TAU);ctx.fill();}
        strokeLine(ctx,[[1498,1190],[1498,1225],[1517,1253]],'#474b39',10);strokeLine(ctx,[[1496,1190],[1496,1225],[1515,1253]],'#929075',2);
      }
    }
    if(area.kind==='camp'){
      // Worn workshop platform: broad timber planes keep the station grounded.
      ctx.fillStyle='rgba(12,27,24,.3)';ctx.fillRect(592,288,170,104);for(let y=290;y<388;y+=12){ctx.fillStyle=y%24?'#5b6550':'#656b52';ctx.fillRect(591,y,164,10);strokeLine(ctx,[[594,y],[751,y]],'#8e9171',.8);}
      for(const x of [600,745])for(let y=295;y<389;y+=24){ctx.fillStyle='#303d33';ctx.fillRect(x,y,2,2);}
      ctx.fillStyle='#303e31';ctx.fillRect(591,388,164,5);strokeLine(ctx,[[591,388],[755,388]],'#a4a181',1);
    }
  }

  function drawDecor(o){
    const c=ctx;if(o.type==='aster'&&hash(Math.floor(o.x/130),Math.floor(o.y/130),19)<.86)return;c.save();c.translate(o.x,o.y);const rnd=hash(o.seed||1,3,7);
    c.globalAlpha=.72;c.transform(1,0,Math.sin(G.time*1.2+o.x*.008)*.06,1,0,0);if(o.type==='aster')c.scale(.65,.65);
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
    const c=ctx,near=G.player&&Math.hypot(G.player.x-o.x,G.player.y-o.y)<o.r+42,r=o.r,pine=hash(o.seed,5,37)>.64;c.save();
    c.translate(o.x,o.y);c.fillStyle='rgba(8,25,26,.23)';c.beginPath();c.ellipse(r*.32,r*.56,r*1.12,r*.62,.35,0,TAU);c.fill();
    strokeLine(c,[[-r*.3,r*.72],[0,r*.42],[r*.2,r*.69]],'#343e32',4);strokeLine(c,[[0,r*.65],[-2,-r*.25]],'#514d38',7);strokeLine(c,[[-2,r*.58],[-3,-r*.18]],'#948367',1.5);
    if(near)c.globalAlpha=.3;c.translate(Math.sin(G.time*.9+o.seed)*1.2,0);
    if(pine){for(let i=0;i<4;i++){const y=r*.36-i*r*.3,w=r*(.92-i*.17);c.fillStyle=['#304d43','#3d5a49','#4b6850','#607959'][i];polygon(c,[[-w,y+12],[-w*.55,y-8],[-w*.76,y-6],[0,y-r*.72],[w*.75,y-6],[w*.5,y-8],[w,y+12],[w*.36,y+6],[0,y+15],[-w*.38,y+7]]);c.fill();strokeLine(c,[[-w*.75,y+6],[0,y-r*.6],[w*.4,y-7]],'rgba(182,190,128,.17)',1.1);}}
    else{
      if(!o.canopy){const rnd=new RNG(o.seed||1);o.canopy=Array.from({length:7},(_,i)=>{const a=i/7*TAU+rnd.range(-.25,.25),rr=r*rnd.range(.35,.65);return{x:Math.cos(a)*rr*.72,y:Math.sin(a)*rr*.55-r*.18,r:r*rnd.range(.44,.62),shade:i%3};});}
      for(const [i,lobe] of o.canopy.entries()){const crown=c.createLinearGradient(lobe.x-lobe.r,lobe.y-lobe.r,lobe.x+lobe.r,lobe.y+lobe.r);crown.addColorStop(0,['#78916a','#8c9c70','#677f61'][lobe.shade]);crown.addColorStop(.4,['#4e7057','#66825c','#456c55'][lobe.shade]);crown.addColorStop(1,'#284e43');c.fillStyle=crown;c.strokeStyle='rgba(17,48,39,.25)';c.lineWidth=.6;c.beginPath();for(let q=0;q<10;q++){const a=q/10*TAU,rr=lobe.r*(.8+hash(q,o.seed,9)*.24);c.lineTo(lobe.x+Math.cos(a)*rr,lobe.y+Math.sin(a)*rr*.87);}c.closePath();c.fill();c.stroke();c.fillStyle='rgba(198,202,137,.12)';for(let k=0;k<4;k++){const a=hash(k,i,o.seed)*TAU,rr=lobe.r*.6;c.beginPath();c.ellipse(lobe.x+Math.cos(a)*rr-3,lobe.y+Math.sin(a)*rr-5,4,2,a,0,TAU);c.fill();}}
    }c.restore();
  }

  function drawRock(o){const c=ctx,r=o.r,pts=[];for(let i=0;i<8;i++){const a=i/8*TAU,rr=r*(.78+hash(i,o.seed||1,5)*.3);pts.push([o.x+Math.cos(a)*rr,o.y+Math.sin(a)*rr*.68]);}c.fillStyle='rgba(10,22,23,.3)';c.beginPath();c.ellipse(o.x+7,o.y+9,r*1.08,r*.58,.12,0,TAU);c.fill();polygon(c,pts);c.fillStyle='#747b6c';c.strokeStyle='#27332e';c.lineWidth=2;c.fill();c.stroke();polygon(c,[pts[0],pts[1],pts[2],[o.x-r*.2,o.y-r*.12]]);c.fillStyle='#465a52';c.fill();polygon(c,[pts[4],pts[5],pts[6],[o.x+r*.06,o.y-r*.25]]);c.fillStyle='#91957b';c.fill();strokeLine(c,[[o.x-r*.58,o.y-r*.08],[o.x-r*.13,o.y-r*.37],[o.x+r*.4,o.y-r*.23]],'#b4b298',1);c.fillStyle='#667343';for(let i=0;i<3;i++){c.beginPath();c.ellipse(o.x-r*.5+i*8,o.y+r*.2,5+i,2.5,.3,0,TAU);c.fill();}}

  function buildingBase(o,fill='#5c625c',roof='#424b47'){
    const c=ctx,edge=o.y+o.h-38;c.fillStyle='rgba(8,23,22,.23)';polygon(c,[[o.x,o.y+o.h],[o.x+o.w,o.y+o.h],[o.x+o.w+27,o.y+o.h+18],[o.x+19,o.y+o.h+18]]);c.fill();
    const wall=c.createLinearGradient(0,edge,0,o.y+o.h);wall.addColorStop(0,'#869080');wall.addColorStop(1,fill);c.fillStyle=wall;c.fillRect(o.x,edge,o.w,38);c.fillStyle='#3e4b43';c.fillRect(o.x,edge,o.w,5);c.fillRect(o.x,o.y+o.h-4,o.w,4);
    c.fillStyle=roof;polygon(c,[[o.x-5,o.y-20],[o.x+o.w-5,o.y-20],[o.x+o.w+5,edge],[o.x-5,edge]]);c.fill();
    for(let x=o.x+10;x<o.x+o.w;x+=14){strokeLine(c,[[x,o.y-17],[x+5,edge-2]],'#688076',1.2);strokeLine(c,[[x+2,o.y-17],[x+7,edge-2]],'rgba(19,44,42,.36)',2);}
    strokeLine(c,[[o.x-4,edge],[o.x-4,o.y-20],[o.x+o.w-5,o.y-20]],'#a5b19a',2);strokeLine(c,[[o.x-5,edge],[o.x+o.w+5,edge]],'#253f3c',4);
    for(let i=0;i<6;i++){const x=o.x+15+hash(i,o.x,17)*(o.w-30),y=o.y+hash(i,o.y,19)*Math.max(1,o.h-58);c.fillStyle='rgba(161,111,64,.24)';c.fillRect(x,y,5,15+hash(i,8,2)*18);}
    c.fillStyle='#2a4542';c.fillRect(o.x+o.w-48,o.y+4,27,18);c.strokeStyle='#7e9788';c.lineWidth=1;c.strokeRect(o.x+o.w-48,o.y+4,27,18);for(let i=0;i<5;i++)strokeLine(c,[[o.x+o.w-44+i*4,o.y+6],[o.x+o.w-44+i*4,o.y+20]],'#a6b09a',.8);
  }

  function drawFieldObject(o){
    const c=ctx;c.save();c.translate(o.x,o.y);c.strokeStyle='#162124';c.lineWidth=2;
    if(o.type==='surveyor'){
      c.restore();drawPerson({...o,bodyAngle:o.rescued?-.6:.35,gazeAngle:Math.atan2(G.player.y-o.y,G.player.x-o.x),idlePhase:o.rescued?'watch':'gloves'});c.save();c.translate(o.x,o.y);c.fillStyle=o.rescued?'#9bb393':'#bb6851';c.fillRect(-10,9,12,4);c.fillStyle='#d4c6a1';c.font='10px monospace';c.textAlign='center';c.fillText('IVO',0,-32);
    }else if(o.type==='skiff'){
      c.fillStyle='rgba(8,14,15,.35)';c.beginPath();c.ellipse(68,28,80,30,-.06,0,TAU);c.fill();c.fillStyle='#527371';polygon(c,[[0,20],[24,0],[108,1],[144,22],[117,48],[26,47]]);c.fill();c.stroke();c.fillStyle='#273d3e';polygon(c,[[17,21],[33,9],[105,10],[125,22],[110,38],[34,37]]);c.fill();for(const x of [40,73,105]){c.fillStyle='#947b54';c.fillRect(x,8,8,31);c.strokeRect(x,8,8,31);}strokeLine(c,[[25,44],[2,58],[-22,52]],'#b8ab85',2);strokeLine(c,[[25,-6],[115,57]],'#9b875e',3);c.fillStyle='#dcba82';c.font='9px monospace';c.fillText('SURVEY 06',38,44);
    }else if(o.type==='cot'){
      c.fillStyle='#283b39';c.fillRect(-3,-3,o.w+6,o.h+6);c.strokeRect(-3,-3,o.w+6,o.h+6);c.fillStyle=o.occupied?'#8c7760':'#655f4a';c.fillRect(0,0,o.w,o.h);c.fillStyle='#b7ab89';c.fillRect(5,4,17,o.h-8);for(let x=29;x<o.w-5;x+=13)strokeLine(c,[[x,4],[x-3,o.h-4]],'rgba(20,30,28,.3)',1.4);if(o.occupied){c.fillStyle='#516e61';c.fillRect(24,4,o.w-29,o.h-8);}
    }else if(o.type==='switchhouse'||o.type==='breaker'){
      const w=o.w,h=o.h;c.fillStyle='rgba(8,12,13,.3)';c.fillRect(7,9,w,h);c.fillStyle='#627875';roundedPath(c,0,0,w,h,3);c.fill();c.stroke();c.fillStyle='#213637';c.fillRect(8,8,w-16,h-16);c.fillStyle='#a99464';c.fillRect(11,h-12,w-22,5);for(let i=0;i<(w>60?3:1);i++){const x=15+i*26,on=o.type==='breaker'?o.on:i===0?save.story.pump:i===1?save.story.beacon:save.story.pump&&save.story.beacon;c.fillStyle=on?'#9db991':'#84543c';c.beginPath();c.arc(x,17,3,0,TAU);c.fill();c.strokeStyle='#a4ada1';c.lineWidth=2;strokeLine(c,[[x,26],[x+3,39]],'#a4ada1',3);}if(w>60){c.fillStyle='#d7c99c';c.font='bold 8px monospace';c.fillText('DRAIN / RESCUE',9,53);}
    }else if(o.type==='powercase'){
      c.fillStyle=o.opened?'#3b4240':'#716b4c';roundedPath(c,0,0,o.w,o.h,4);c.fill();c.stroke();c.fillStyle=o.opened?'#182627':'#b3a780';c.fillRect(6,6,o.w-12,o.h-12);for(let x=8;x<o.w-8;x+=11){c.fillStyle='#282e29';c.fillRect(x,2,5,4);}if(!o.opened){c.fillStyle='#e0d6af';c.fillRect(15,10,26,13);c.strokeRect(15,10,26,13);c.fillStyle=COLORS.rust;c.fillRect(21,10,4,13);}
    }else if(o.type==='beacon'){
      c.fillStyle='rgba(7,16,16,.35)';c.beginPath();c.ellipse(8,13,30,12,0,0,TAU);c.fill();strokeLine(c,[[-17,17],[0,-43],[17,17]],'#6a7e73',4);strokeLine(c,[[0,6],[0,-71]],'#acb39b',3);c.fillStyle='#243a3b';c.fillRect(-16,-44,32,22);c.strokeRect(-16,-44,32,22);c.fillStyle=save.story.beacon?'#a9d3ac':'#805340';c.fillRect(-11,-39,22,6);if(save.story.beacon){c.globalAlpha=.35+.25*Math.sin(G.time*3);c.strokeStyle='#afceac';c.lineWidth=1.3;for(let r=11;r<36;r+=11){c.beginPath();c.arc(0,-65,r,-2.6,-.5);c.stroke();}c.globalAlpha=1;}
    }else if(o.type==='waterbarrels'||o.type==='cistern'){
      const count=o.type==='cistern'?1:2;for(let i=0;i<count;i++){const x=i*32,r=o.type==='cistern'?30:15,top=-22,bottom=14;c.fillStyle='rgba(8,24,21,.27)';c.beginPath();c.ellipse(x+6,bottom+5,r+5,7,0,0,TAU);c.fill();const body=c.createLinearGradient(x-r,0,x+r,0);body.addColorStop(0,'#657e70');body.addColorStop(.4,'#4b6d65');body.addColorStop(1,'#294d48');c.fillStyle=body;c.fillRect(x-r,top,2*r,bottom-top);c.beginPath();c.ellipse(x,bottom,r,7,0,0,TAU);c.fill();for(const y of [-12,5]){c.strokeStyle='#263f38';c.lineWidth=2;c.beginPath();c.ellipse(x,y,r,6,0,0,Math.PI);c.stroke();}c.fillStyle='#7c9785';c.beginPath();c.ellipse(x,top,r,7,0,0,TAU);c.fill();c.strokeStyle='#b0b89a';c.lineWidth=1;c.stroke();c.fillStyle='#2d514b';c.beginPath();c.ellipse(x,top,r-3,4,0,0,TAU);c.fill();c.fillStyle=save.story.pump||o.working?'#9dbb9b':'#8d6c48';c.fillRect(x+4,top-3,4,3);}
    if(o.working){strokeLine(c,[[30,8],[42,8],[42,27]],'#a6bd9c',4);c.strokeStyle='rgba(127,196,192,.7)';c.lineWidth=2;c.beginPath();c.moveTo(42,27);c.lineTo(42,39+Math.sin(G.time*6)*3);c.stroke();}
    }
    c.restore();
  }

  function drawWorkstation(o){
    const c=ctx;c.save();c.translate(o.x,o.y);c.fillStyle='rgba(7,23,21,.3)';polygon(c,[[0,30],[o.w,30],[o.w+27,55],[20,55]]);c.fill();
    c.fillStyle='#3b4132';c.fillRect(8,18,o.w-16,18);c.fillStyle='#7c7050';c.fillRect(10,22,o.w-20,5);for(const x of [7,o.w-14]){c.fillStyle='#69563b';c.fillRect(x,6,7,39);strokeLine(c,[[x,7],[x,43]],'#ad9161',1.4);}
    c.fillStyle='#58675b';c.fillRect(19,10,22,12);c.fillStyle='#bcb18c';c.fillRect(48,9,16,14);strokeLine(c,[[51,9],[51,23]],'#577465',3);
    c.fillStyle='#51402f';c.fillRect(-3,5,o.w+6,11);const wood=c.createLinearGradient(0,-23,o.w,10);wood.addColorStop(0,'#c4a36c');wood.addColorStop(.48,'#aa8655');wood.addColorStop(1,'#796243');c.fillStyle=wood;polygon(c,[[-4,-23],[o.w+1,-23],[o.w+5,6],[-3,6]]);c.fill();strokeLine(c,[[-4,-23],[o.w,-23]],'#ead09b',1.3);strokeLine(c,[[-3,7],[o.w+4,7]],'#d1ad70',1);
    for(const y of [-15,-5])strokeLine(c,[[-2,y],[o.w+2,y+1]],'rgba(61,50,32,.32)',.7);
    c.fillStyle='#31554e';c.fillRect(22,-19,48,22);strokeLine(c,[[26,-16],[65,-16],[65,0]],'#739787',.7);
    const key=G.benchSelection&&RECIPES[G.benchSelection]?.weapon||'revolver',w=WEAPONS[key];drawHeldWeapon({rear:{x:35,y:-9},muzzle:{x:35+w.length*.6,y:-9},angle:0,baseLength:w.artLength||w.length,mod:weaponSpec(key).mod},key);
    // Vise jaws, screw, and attached lamp are readable from the normal play view.
    c.fillStyle='#536b62';c.fillRect(o.w-28,-17,17,18);c.fillStyle='#9db09b';c.fillRect(o.w-31,-17,7,9);c.fillRect(o.w-13,-17,7,9);strokeLine(c,[[o.w-30,-5],[o.w-8,-5]],'#c6c8ab',2);strokeLine(c,[[o.w-18,0],[o.w-18,12]],'#627467',2);
    strokeLine(c,[[7,-22],[5,-48],[28,-58]],'#3d554d',3);strokeLine(c,[[6,-47],[28,-57]],'#aab296',1);c.fillStyle='#477566';polygon(c,[[21,-62],[31,-62],[39,-53],[15,-53]]);c.fill();c.fillStyle='#ffe2a0';c.fillRect(16,-53,22,2);
    c.restore();
  }
  function drawObject(o){
    if(!o.active)return;const c=ctx;
    if(o.type==='tree')return drawTree(o);if(o.type==='rock')return drawRock(o);
    c.save();
    if(['surveyor','skiff','cot','switchhouse','breaker','powercase','beacon','waterbarrels','cistern'].includes(o.type)){
      drawFieldObject(o);
    }else if(o.type==='wreckbus'){
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
      const shade=c.createRadialGradient(o.x+o.w*.56,o.y+o.h*.9,20,o.x+o.w*.56,o.y+o.h*.9,o.w*.57);shade.addColorStop(0,'rgba(7,23,23,.38)');shade.addColorStop(1,'rgba(7,23,23,0)');c.fillStyle=shade;c.fillRect(o.x-35,o.y+35,o.w+80,o.h+50);c.fillStyle='rgba(7,23,23,.25)';c.beginPath();c.ellipse(o.x+o.w*.53,o.y+o.h,o.w*.44,13,0,0,TAU);c.fill();polygon(c,[[o.x+10,o.y+o.h],[o.x+o.w*.42,o.y+4],[o.x+o.w-8,o.y+o.h]]);c.fillStyle='#476864';c.strokeStyle=COLORS.ink;c.lineWidth=3;c.fill();c.stroke();polygon(c,[[o.x+o.w*.42,o.y+4],[o.x+o.w*.64,o.y+o.h],[o.x+o.w-8,o.y+o.h]]);c.fillStyle='#354d4a';c.fill();c.strokeStyle='rgba(238,228,198,.3)';c.setLineDash([7,6]);c.beginPath();c.moveTo(o.x+15,o.y+o.h-8);c.lineTo(o.x+o.w*.42,o.y+10);c.lineTo(o.x+o.w-12,o.y+o.h-8);c.stroke();c.setLineDash([]);c.fillStyle=COLORS.amber;c.fillRect(o.x+o.w*.42-4,o.y-7,8,16);
    }else if(o.type==='workbench'){
      drawWorkstation(o);
    }else if(o.type==='stash'||o.type==='cache'||o.type==='weaponcase'){
      c.fillStyle='rgba(0,0,0,.27)';c.fillRect(o.x+5,o.y+7,o.w,o.h);c.fillStyle=o.type==='weaponcase'?'#455953':'#665b43';c.strokeStyle=COLORS.ink;c.lineWidth=2;roundedPath(c,o.x,o.y,o.w,o.h,4);c.fill();c.stroke();c.strokeStyle=COLORS.paperDim;c.lineWidth=1;c.strokeRect(o.x+5,o.y+5,o.w-10,o.h-10);c.fillStyle=o.opened?'#162724':o.type==='weaponcase'?COLORS.rust:COLORS.amber;c.fillRect(o.x+o.w/2-5,o.y+o.h/2-4,10,8);if(o.opened){c.fillStyle='#23322f';c.fillRect(o.x+7,o.y+8,o.w-14,o.h-15);c.fillStyle='#73715a';c.fillRect(o.x,o.y-7,o.w,12);c.strokeRect(o.x,o.y-7,o.w,12);}
    }else if(o.type==='campfire'){
      c.translate(o.x,o.y);c.fillStyle='#29362e';c.beginPath();c.ellipse(0,8,27,17,0,0,TAU);c.fill();for(const a of [-.5,.55]){c.save();c.rotate(a);c.fillStyle='#69513a';roundedPath(c,-21,-2,42,8,3);c.fill();strokeLine(c,[[-17,0],[18,0]],'#aa7650',1);c.restore();}for(let i=0;i<5;i++){const x=(i-2)*5,sway=Math.sin(G.time*7+i)*3,h=20+Math.sin(G.time*5+i*2)*7;c.fillStyle=i%2?'rgba(236,135,59,.8)':'rgba(189,76,42,.7)';c.beginPath();c.moveTo(x-6,7);c.quadraticCurveTo(x-8,-5,x+sway,-h);c.quadraticCurveTo(x+10,-1,x+5,7);c.fill();}c.fillStyle='#ffe4a2';c.beginPath();c.moveTo(-5,7);c.quadraticCurveTo(-3,-9,2,-12);c.quadraticCurveTo(8,-2,7,7);c.fill();for(let i=0;i<4;i++){const t=(G.time*.22+i*.24)%1;c.globalAlpha=(1-t)*.13;c.fillStyle='#adb19a';c.beginPath();c.ellipse(Math.sin(i+G.time)*6+t*15,-23-t*58,6+t*12,9+t*12,-.3,0,TAU);c.fill();}c.globalAlpha=1;
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
    drawMaterialDetail(o);
    if(o.poi&&G.nearest===o)drawPOILabel(o);
    if(o.interact&&o.active&&G.nearest===o)drawInteractRing(o);
  }

  function drawMaterialDetail(o){
    if(o.type==='workbench')return;
    const c=ctx;c.save();c.translate(o.x,o.y);c.lineCap='round';
    if(o.type==='tarp'){
      const peak=o.w*.42;for(const t of [.18,.36,.56,.77])strokeLine(c,[[peak,13],[o.w*t,o.h-3]],t<.5?'rgba(201,205,162,.16)':'rgba(15,34,32,.23)',1.6);
      c.fillStyle='#263f3c';polygon(c,[[peak+5,o.h*.45],[o.w*.64,o.h],[o.w*.47,o.h]]);c.fill();strokeLine(c,[[peak+5,o.h*.45],[o.w*.47,o.h]],'#9a9b7f',1.5);
      for(const [ax,ay,bx,by] of [[12,o.h-8,-19,o.h+13],[o.w-14,o.h-9,o.w+20,o.h+10],[peak,8,peak+36,-18]]){strokeLine(c,[[ax,ay],[bx,by]],'#a4a183',1);strokeLine(c,[[bx-2,by-4],[bx+2,by+5]],'#77604a',3);}
      c.fillStyle='#6e8270';polygon(c,[[peak-22,42],[peak-5,53],[peak-12,74],[peak-32,65]]);c.fill();c.strokeStyle='#b0b197';c.lineWidth=.8;c.setLineDash([2,3]);c.stroke();c.setLineDash([]);
    }else if(o.type==='workbench'){
      for(let y=10;y<o.h;y+=11){strokeLine(c,[[3,y],[o.w-3,y+2]],'#453f31',1);strokeLine(c,[[5,y+2],[o.w-7,y+3]],'rgba(208,179,121,.15)',.7);}
      for(const x of [5,o.w-5])for(const y of [5,o.h-5]){c.fillStyle='#272f2c';c.beginPath();c.arc(x,y,1.4,0,TAU);c.fill();}
      c.fillStyle='#314747';c.fillRect(12,13,37,22);c.strokeStyle='#718b7b';c.lineWidth=.7;c.strokeRect(15,16,31,16);strokeLine(c,[[18,29],[22,21],[37,24],[42,19]],'#b6baa1',1);
      strokeLine(c,[[55,31],[63,12]],'#a8ada0',3);c.strokeStyle='#a8ada0';c.lineWidth=2;c.beginPath();c.arc(64,10,4,-2.6,.4);c.stroke();strokeLine(c,[[76,36],[92,31]],'#b29159',3);strokeLine(c,[[92,25],[94,36]],'#73847b',4);
      c.fillStyle='#323d37';c.fillRect(o.w-17,2,13,14);strokeLine(c,[[o.w-21,4],[o.w-7,4]],'#9daba0',3);
    }else if(['pump','fuelbowser','controlbank'].includes(o.type)){
      const w=o.w||70,h=o.h||90;c.strokeStyle='#809086';c.lineWidth=1;c.strokeRect(4,4,w-8,h-8);c.fillStyle='#768d7b';c.font='7px monospace';c.fillText(o.type==='fuelbowser'?'FUEL':'04 / P',12,23);
      for(let i=0;i<4;i++)strokeLine(c,[[11,h-32+i*3],[w-12,h-32+i*3]],'#303e3c',1.2);c.fillStyle='#bea471';c.beginPath();c.arc(w-13,h*.55,3,0,TAU);c.fill();
      strokeLine(c,[[w-3,17],[w+8,24],[w+8,h-15],[w-3,h-12]],'#233732',3);strokeLine(c,[[5,h-6],[12,h-8],[17,h-5]],'#977652',1.5);
    }else if(['stash','cache','weaponcase'].includes(o.type)&&!o.opened){
      for(const x of [9,o.w-12]){c.fillStyle='#343e35';c.fillRect(x,1,4,o.h-2);c.fillStyle='#a8ad8e';c.fillRect(x-1,o.h*.4,6,5);}
      c.strokeStyle='#9a9674';c.lineWidth=1;for(let i=0;i<3;i++)strokeLine(c,[[o.w*.25+i*8,9],[o.w*.25+i*8+5,8]],'#979171',.8);
    }else if(o.type==='campfire'){
      for(let i=0;i<9;i++){const a=i/9*TAU;c.fillStyle=i<4?'#666956':'#4f5447';c.strokeStyle='#27332c';c.lineWidth=1;c.beginPath();c.ellipse(Math.cos(a)*26,Math.sin(a)*15+9,6,4,a,0,TAU);c.fill();c.stroke();}
    }
    c.restore();
  }

  function drawPOILabel(o){const x=o.r!=null?o.x:o.x+o.w/2,y=o.r!=null?o.y-o.r-20:o.y-18;ctx.save();ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle='rgba(23,21,31,.82)';const w=ctx.measureText(o.poi).width+18;ctx.fillRect(x-w/2,y-13,w,20);ctx.fillStyle=COLORS.paper;ctx.fillText(o.poi,x,y+1);ctx.restore();}
  function drawInteractRing(o){const x=o.r!=null?o.x:o.x+o.w/2,y=o.r!=null?o.y:o.y+o.h/2,r=(o.r||Math.min(o.w,o.h)/2)+11;ctx.save();ctx.strokeStyle=COLORS.amber;ctx.lineWidth=2;ctx.setLineDash([5,6]);ctx.lineDashOffset=-G.time*12;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.restore();}

  function drawPerson(o){drawHumanoid(o,{angle:o.gazeAngle??o.bodyAngle??.5,coat:o.type==='surveyor'?'#8a7755':'#647a73',trim:'#a1b0a0',pack:false,hair:o.type==='surveyor'?'#75604a':'#3b342e'});}

  function drawHeldWeapon(rig,key,reload=0,enemy=false){
    const original=key,c=ctx,len=Math.hypot(rig.muzzle.x-rig.rear.x,rig.muzzle.y-rig.rear.y),base=rig.baseLength||WEAPONS[key]?.length||len;key=weaponFamily(key);c.save();c.translate(rig.rear.x,rig.rear.y);c.rotate(rig.angle);c.lineCap='round';c.lineJoin='round';
    if(key==='prybar'){
      c.strokeStyle='#9aa09a';c.lineWidth=4.2;c.beginPath();c.moveTo(-5,0);c.lineTo(len-5,0);c.quadraticCurveTo(len+2,-1,len+4,-8);c.stroke();c.strokeStyle='#4d5553';c.lineWidth=1.2;c.beginPath();c.moveTo(2,-1);c.lineTo(len-6,-1);c.stroke();
    }else if(key==='revolver'){
      c.scale(Math.max(.08,len/base),1);c.strokeStyle='#172123';c.lineWidth=1.4;c.fillStyle='#75543a';polygon(c,[[-5,1],[2,2],[1,12],[-6,10],[-8,5]]);c.fill();c.stroke();strokeLine(c,[[-5,5],[-2,8]],'#ad8d61',1);c.fillStyle='#65736f';polygon(c,[[-5,-3],[10,-4],[15,-2],[base,-2],[base,2],[12,2],[9,5],[-4,4]]);c.fill();c.stroke();strokeLine(c,[[13,-1],[base-2,-1]],'#c2c7b2',.9);c.strokeStyle='#172123';c.lineWidth=1;c.beginPath();c.ellipse(5,6,4,3,0,0,TAU);c.stroke();c.fillStyle='#454f4d';const cy=reload>.25&&reload<.8?5:0;roundedPath(c,1,cy-4,9,8,2);c.fill();c.stroke();strokeLine(c,[[3,cy-2],[8,cy-2]],'#99a49b',1.1);strokeLine(c,[[3,cy+2],[8,cy+2]],'#748078',.8);c.fillStyle='#222d2c';c.fillRect(base-4,-3.5,2,2);
    }else if(key==='shotgun'){
      c.scale(Math.max(.08,len/base),1);c.fillStyle='#795940';c.strokeStyle='#172123';c.lineWidth=1.5;polygon(c,[[-14,-5],[-9,-5],[2,-2],[13,-3],[17,0],[10,4],[2,3],[-9,7],[-14,7]]);c.fill();c.stroke();strokeLine(c,[[-10,-2],[1,1]],'#aa8659',1);c.fillStyle='#2d3431';c.fillRect(-15,-5,3,12);c.fillStyle='#79817a';roundedPath(c,7,-4,12,8,2);c.fill();c.stroke();const progress=reload?1-reload:0,open=Math.sin(progress*Math.PI)*.58;c.save();c.translate(17,0);c.rotate(open);c.fillStyle='#505e5c';const bore=original==='field410'?2.1:3.8;c.fillRect(0,-bore,base-17,bore*2);c.strokeRect(0,-bore,base-17,bore*2);strokeLine(c,[[1,-2],[base-18,-2]],'#a3b0a3',1);if(original!=='field410')strokeLine(c,[[1,1],[base-18,1]],'#1b2a29',1);c.fillStyle='#876644';roundedPath(c,4,-4.8,15,9.6,2);c.fill();c.stroke();for(let x=7;x<17;x+=3)strokeLine(c,[[x,-3],[x,3]],'#b09060',.65);c.restore();
    }else if(key==='pistol9'){
      c.scale(Math.max(.08,len/base),1);c.strokeStyle='#17282b';c.lineWidth=1.3;c.fillStyle='#3c4640';polygon(c,[[-4,-1],[6,1],[3,13],[-5,12],[-8,6]]);c.fill();c.stroke();for(let y=4;y<11;y+=2)strokeLine(c,[[-5,y],[2,y+1]],'#899182',.8);c.fillStyle='#718c88';roundedPath(c,-7,-5,base+7,9,2);c.fill();c.stroke();strokeLine(c,[[-5,-3],[base-2,-3]],'#c1d0bb',1.2);c.fillStyle='#2a3d3b';c.fillRect(base-2,-3,2,6);for(let x=-3;x<5;x+=2)strokeLine(c,[[x,-4],[x,2]],'#354e48',1);c.strokeStyle='#afbcac';c.beginPath();c.ellipse(9,7,5,3,0,0,TAU);c.stroke();
    }else if(key==='firebottle'||key==='charge'){
      c.translate(len*.5,0);c.rotate(-Math.PI/2);drawToolShape(key);
    }else{
      c.scale(Math.max(.08,len/base),1);c.strokeStyle='#172123';c.lineWidth=1.4;c.fillStyle=enemy?'#706650':'#7c6b49';polygon(c,[[-14,-5],[-8,-5],[3,-2],[5,2],[-9,7],[-14,7]]);c.fill();c.stroke();strokeLine(c,[[-11,-2],[-3,0]],'#b5a174',.9);c.fillStyle='#2b3837';c.fillRect(-15,-5,3,12);c.fillStyle=enemy?'#686f65':'#677d72';roundedPath(c,0,-4.5,25,9,2);c.fill();c.stroke();strokeLine(c,[[2,-3],[21,-3]],'#a8b5a5',.9);c.fillStyle='#2b3735';c.fillRect(6,3,5,8);c.fillRect(11,3,7,10);c.fillRect(24,-2,base-24,4);c.strokeRect(24,-2,base-24,4);c.fillStyle='#756448';roundedPath(c,23,-4,17,8,2);c.fill();c.stroke();for(let x=26;x<38;x+=3)strokeLine(c,[[x,-2],[x,2]],'#baa177',.65);c.fillStyle='#182724';c.fillRect(base-7,-4,2,4);c.fillRect(base-2,-3,2,6);if(reload>.28&&reload<.76){c.save();c.translate(14,9+Math.sin((reload-.28)/.48*Math.PI)*8);c.rotate(.18);c.fillRect(-3,0,7,11);c.restore();}
    }
    c.restore();
    // Fittings use the same local frame as the actual weapon, including its recoil.
    const mod=rig.mod;c.save();c.translate(rig.rear.x,rig.rear.y);c.rotate(rig.angle);
    if(mod==='wrap'){for(let x=-4;x<10;x+=2.6)strokeLine(c,[[x,-2.5],[x+2,2.5]],'#caab76',2);}
    if(mod==='weight'){c.fillStyle='#75847c';roundedPath(c,len-11,-6,8,11,2);c.fill();strokeLine(c,[[len-9,-5],[len-5,-5]],'#d3ccb0',1);}
    if(mod==='brace'){strokeLine(c,[[-5,0],[-23,-3],[-27,8]],'#a69773',3);strokeLine(c,[[-25,-4],[-29,9]],'#293c37',3);}
    if(mod==='choke'){c.fillStyle='#b2b59f';c.fillRect(len-6,-4,6,8);strokeLine(c,[[len-5,-3],[len-1,-3]],'#efe0b3',1);}
    if(mod==='sling'){c.strokeStyle='#bcaa7c';c.lineWidth=2;c.beginPath();c.moveTo(-8,4);c.quadraticCurveTo(6,22,len-8,3);c.stroke();}
    if(original==='colt'){strokeLine(c,[[7,-2.4],[len-2,-2.4]],'#c9c7aa',.9);c.fillStyle='#444e49';c.fillRect(2,-3,4,6);strokeLine(c,[[2,-2],[5,-2]],'#a8b4a3',.8);}
    if(original==='field410'){strokeLine(c,[[len*.5,-1],[len-2,-1]],'#adbba3',.7);}
    c.restore();
  }

  // Actor origins remain at the combat torso; screen-up height is visual only.
  // Hands, held weapons and projectiles still use the very same physical rig.
  function drawHumanoid(p, style={}){
    const c=ctx,a=style.angle??p.weaponAngle??p.bodyAngle??0,side=Math.cos(a),back=Math.sin(a)<-.6;
    const moving=Math.hypot(p.vx||0,p.vy||0)>10,gait=Math.sin((p.step||0)*TAU),bob=moving?Math.abs(gait)*.65:Math.sin(G.time*1.7+(p.id||0))*.18;
    const coat=style.coat||'#476d68',trim=style.trim||'#839786',skin=style.skin||'#b59376',player=!!style.player,rig=style.rig;
    const gear=k=>player&&(style.previewKit===k||wears(k)),carried=k=>player&&(p.inventory.some(s=>s.key===k&&s.qty>0)||(p.camp&&save.prepared[k]&&(save.stash[k]||0)>0));
    const pack=player?(G.area?.kind!=='prologue'||save.prologue.satchel):style.pack;
    c.save();c.translate(p.x,p.y);c.fillStyle='rgba(7,18,18,.18)';c.beginPath();c.ellipse(8,23,24,8,-.16,0,TAU);c.fill();c.fillStyle='rgba(5,17,16,.38)';c.beginPath();c.ellipse(0,21,13,4.5,0,0,TAU);c.fill();
    for(const s of [-1,1]){
      const step=moving?gait*s:0,footX=s*5+step*Math.cos(p.bodyAngle||a)*4,footY=20+step*Math.sin(p.bodyAngle||a)*4;
      strokeLine(c,[[s*4,3],[s*5+step*1.6,12],[footX,footY]],'#233a38',6);
      strokeLine(c,[[s*4-1,4],[s*5-1,12]],'#4e6255',2);
      c.fillStyle='#202b2a';roundedPath(c,footX-4,footY-2,9,5,2);c.fill();strokeLine(c,[[footX-2,footY-1],[footX+3,footY-1]],'#849080',1);
    }
    if(gear('cape')){c.fillStyle='#343b4a';c.beginPath();c.moveTo(-9,-17);c.quadraticCurveTo(-15,0,-13+gait*1.5,12);c.quadraticCurveTo(0,16,13-gait*1.5,11);c.lineTo(8,-17);c.closePath();c.fill();strokeLine(c,[[-8,-12],[-8,9],[-3,12]],'#626979',1);}
    if(pack){const bx=back?-11:-15,bw=gear('bag')?16:11;c.fillStyle='#483f31';roundedPath(c,bx,-18,bw,25,3);c.fill();c.fillStyle='#807354';roundedPath(c,bx+1,-17,bw-2,22,3);c.fill();c.fillStyle='#a39469';roundedPath(c,bx+2,-17,bw-4,6,2);c.fill();strokeLine(c,[[bx+3,-11],[bx+3,2]],'#b6aa81',1);c.fillStyle='#434333';c.fillRect(bx+5,-5,4,3);}
    if(player&&pack){
      const longs=p.weaponList.filter(k=>LONG_GUNS.includes(k)&&k!==rig?.key);
      for(const [i,key]of longs.entries()){const rear={x:-10-i*6,y:6},angle=-1.68,w=weaponSpec(key),muzzle=localPoint(rear.x,rear.y,angle,w.length*.86);c.globalAlpha=.82;drawHeldWeapon({rear,muzzle,angle,baseLength:w.artLength,mod:w.mod},key);c.globalAlpha=1;}
      if(rig?.key!=='prybar')strokeLine(c,[[11,-21],[14,8],[17,7]],'#86958c',2);
      if(carried('regulator')){c.fillStyle='#5f7770';c.beginPath();c.ellipse(-17,1,7,8,0,0,TAU);c.fill();c.strokeStyle='#ad9c70';c.lineWidth=1.6;c.beginPath();c.arc(-17,1,4,0,TAU);c.stroke();strokeLine(c,[[-22,-4],[-12,6]],'#484635',2);}
    }
    c.restore();
    const drawArms=()=>{
      const shoulders=[{x:p.x-8,y:p.y-7},{x:p.x+8,y:p.y-7}],hands=rig?[rig.front,rig.rear]:[{x:p.x-12,y:p.y+4+bob},{x:p.x+12,y:p.y+3-bob}];
      for(let i=0;i<2;i++){const s=shoulders[i],h=hands[i],elbow={x:lerp(s.x,h.x,.42)+(i?3:-3),y:lerp(s.y,h.y,.42)+5};strokeLine(c,[[s.x,s.y],[elbow.x,elbow.y],[h.x,h.y]],'#1b3434',6);strokeLine(c,[[s.x-1,s.y-1],[elbow.x-1,elbow.y-1],[h.x,h.y]],coat,4.4);}
      if(rig)drawHeldWeapon(rig,rig.key||'carbine',style.reload||0,!!style.enemy);
      c.fillStyle=skin;for(const h of hands){c.beginPath();c.arc(h.x,h.y,2.4,0,TAU);c.fill();}
    };
    if(back)drawArms();
    c.save();c.translate(p.x,p.y-bob);
    const fabric=c.createLinearGradient(-12,-18,11,9);fabric.addColorStop(0,trim);fabric.addColorStop(.42,coat);fabric.addColorStop(1,'#263f3b');c.fillStyle=fabric;
    c.beginPath();c.moveTo(-7,-17);c.quadraticCurveTo(-13,-13,-10,-3);c.lineTo(-8,2);c.quadraticCurveTo(0,5,9,2);c.lineTo(11,-8);c.quadraticCurveTo(10,-17,5,-17);c.closePath();c.fill();
    strokeLine(c,[[-7,-13],[-6,4]],'rgba(212,221,186,.27)',1);
    c.fillStyle='#252f2b';c.fillRect(-9,0,18,3);c.fillStyle='#b1a47c';c.fillRect(1,0,3,3);
    if(gear('vest')){c.fillStyle='#394b48';roundedPath(c,-8,-14,16,17,2);c.fill();c.fillStyle='#687c6c';polygon(c,[[-6,-13],[6,-13],[7,-6],[-7,-6]]);c.fill();strokeLine(c,[[-5,-11],[5,-11]],'#a8b198',.8);for(const x of [-6,1]){c.fillStyle='#586853';roundedPath(c,x,-3,5,5,1);c.fill();}}
    if(pack&&!back)strokeLine(c,[[-8,-15],[-4,-8],[7,3]],'#b3a074',1.6);
    if(player&&pack){
      if(p.weaponList.some(k=>SIDEARMS.includes(k)&&k!==rig?.key)){c.fillStyle='#4c3b2e';roundedPath(c,8,1,5,10,2);c.fill();strokeLine(c,[[9,0],[13,0]],'#93a198',2);}
      if(player&&save.weaponMods.revolver==='loader'){c.fillStyle='#a4936b';roundedPath(c,4,5,7,6,1);c.fill();for(let x=5;x<10;x+=2){c.fillStyle='#e0c18c';c.fillRect(x,6,1,3);}}
      if(gear('medroll')||carried('bandage')||carried('medicine')){c.fillStyle='#a29777';roundedPath(c,-8,6,9,5,2);c.fill();strokeLine(c,[[-5,6],[-5,11]],'#d4c9a7',1);}
      if(carried('cleanwater')){c.fillStyle='#5b8c88';roundedPath(c,-13,5,5,8,2);c.fill();c.fillStyle='#b8bd9e';c.fillRect(-12,3,3,2);}
      if(carried('relaycell')){c.fillStyle='#c5bd9c';roundedPath(c,5,-14,4,7,1);c.fill();c.fillStyle='#a85e43';c.fillRect(5,-12,4,1.5);}
      for(const [key,x]of [['firebottle',-12],['charge',10]])if(carried(key)&&rig?.key!==key){c.save();c.translate(x,7);c.scale(.45,.45);drawToolShape(key);c.restore();}
    }
    // Head always sits above the chest, never at the tip of the aim vector.
    const hx=side*2,hy=-22;c.fillStyle='#223a37';c.beginPath();c.ellipse(hx,hy+2,8,8,0,0,TAU);c.fill();
    c.fillStyle=back?'#4b493a':skin;c.beginPath();c.ellipse(hx,hy,6.7,7.5,0,0,TAU);c.fill();
    if(!back){c.fillStyle='#cfb291';c.beginPath();c.ellipse(hx+side*3,hy+1,3.8,5,0,0,TAU);c.fill();c.fillStyle='#3a372c';c.fillRect(hx+side*4,hy-1,1.5,1);c.fillStyle='#907554';c.fillRect(hx-3,hy+5,6,2);}
    c.fillStyle=style.hair||'#4c4434';c.beginPath();c.ellipse(hx-1,hy-4,6.5,4,0,Math.PI,TAU);c.lineTo(hx+5,hy-2);c.quadraticCurveTo(hx,hy-5,hx-6,hy);c.closePath();c.fill();
    if(gear('helmet')||style.helmet){c.fillStyle='#6e7c5d';c.beginPath();c.ellipse(hx,hy-2,8,7,0,Math.PI,TAU);c.lineTo(hx+8,hy);c.quadraticCurveTo(hx,hy+2,hx-8,hy);c.closePath();c.fill();strokeLine(c,[[hx-5,hy-6],[hx+2,hy-7],[hx+5,hy-4]],'#a5b08a',1.3);strokeLine(c,[[hx-8,hy],[hx+8,hy]],'#364d43',2);}
    if(gear('respirator')&&!back){c.fillStyle='#2e4948';roundedPath(c,hx-5,hy+2,10,6,2);c.fill();c.fillStyle='#89a395';for(const x of [-5,5]){c.beginPath();c.arc(hx+x,hy+5,2.5,0,TAU);c.fill();}}
    c.restore();if(!back)drawArms();
    if(player&&p.bleeding>0){c.fillStyle=COLORS.blood;c.beginPath();c.arc(p.x+11,p.y+16,2.5,0,TAU);c.fill();}
  }

  function drawPlayer(p){
    const empty=G.area?.kind==='prologue'&&!save.prologue.satchel,rig=computePlayerRig(p);
    drawHumanoid(p,{player:true,rig:empty?null:rig,angle:rig.angle,reload:p.reload>0?clamp(p.reload/(rig.w.reload||1),0,1):0,coat:p.invuln>0&&Math.floor(G.time*20)%2?'#99745b':'#456e69'});
    if(rig.key==='prybar'&&p.meleeTime>0){const progress=meleeProgress(p);if(progress>.2&&progress<.72){ctx.save();ctx.globalAlpha=Math.sin((progress-.2)/.52*Math.PI)*.21;ctx.strokeStyle=COLORS.paper;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,WEAPONS.prybar.length+8,p.meleeHeading-.95,rig.angle);ctx.stroke();ctx.restore();}}
  }

  function drawEnemy(e){
    const c=ctx;if(!e.alive)return;
    if(e.type==='scav'){const profile=e.profile||scavProfile(e.id),rig=computeEnemyRig(e);drawHumanoid({...e,step:(e.pace||0)/TAU},{rig,angle:rig.angle,reload:e.reload>0?clamp(e.reload/(rig.w.reload+.55),0,1):0,coat:e.hit>0?'#a16850':profile.coat,trim:profile.trim,pack:profile.pack,enemy:true,helmet:profile.hood});
      if(e.aim>0){c.strokeStyle=`rgba(199,109,76,${.1+e.aim*.5})`;c.lineWidth=1;c.setLineDash([4,8]);c.beginPath();c.moveTo(rig.muzzle.x,rig.muzzle.y);c.lineTo(rig.muzzle.x+Math.cos(rig.angle)*Math.min(560,dist(e,G.player)),rig.muzzle.y+Math.sin(rig.angle)*Math.min(560,dist(e,G.player)));c.stroke();c.setLineDash([]);}
    }else if(e.type==='wader'){const facing=e.windup>0||e.strike>0?e.attackAngle:e.angle;drawHumanoid({...e,step:(e.pace||0)/TAU},{angle:facing,coat:e.hit>0?'#a16850':'#657660',trim:'#879577',skin:'#a2ad7d',hair:'#68765a'});
      const hand=localPoint(e.x,e.y,facing,e.strike>0?58:e.windup>0?10:25,0);strokeLine(c,[[e.x+9,e.y-8],[hand.x,hand.y]],'#748463',6);c.fillStyle='#c4c6a1';c.beginPath();c.arc(hand.x,hand.y,3,0,TAU);c.fill();
    }else{
      c.save();c.translate(e.x,e.y);c.fillStyle='rgba(8,19,17,.3)';c.beginPath();c.ellipse(5,11,24,7,-.1,0,TAU);c.fill();const facing=Math.cos(e.angle)>=0?1:-1;c.scale(facing,1);const pace=Math.sin(e.pace||0);
      for(const [x,s]of [[-12,1],[12,-1]]){strokeLine(c,[[x,-1],[x+pace*s*4,10],[x+pace*s*4+3,12]],'#3d453a',4);}
      c.fillStyle=e.hit>0?COLORS.rust:'#665d49';c.beginPath();c.ellipse(-2,-2,21,10,-.1,0,TAU);c.fill();c.fillStyle='#8a7a5a';c.beginPath();c.ellipse(-3,-7,15,4,0,0,TAU);c.fill();
      c.fillStyle='#605b45';polygon(c,[[10,-8],[17,-17],[22,-10],[30,-6],[28,0],[15,2]]);c.fill();strokeLine(c,[[-19,-5],[-27,-10],[-30,-6]],'#545941',3);c.fillStyle='#cbae69';c.beginPath();c.arc(21,-8,1.4,0,TAU);c.fill();c.fillStyle='#202c2a';c.fillRect(27,-5,4,3);c.restore();
    }
    if(e.windup>0){const range=e.type==='hound'?51:69,progress=1-e.windup/(e.attackDuration||1);c.strokeStyle=`rgba(231,161,100,${.25+progress*.55})`;c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,range,e.attackAngle-.9,e.attackAngle+.9);c.stroke();}
    if(e.alert>.15){c.fillStyle='rgba(11,22,21,.6)';c.fillRect(e.x-14,e.y-38,28,3);c.fillStyle=e.aim>.6?COLORS.rust:COLORS.amber;c.fillRect(e.x-14,e.y-38,28*clamp(e.hp/(e.type==='hound'?48:e.type==='wader'?82:68),0,1),3);}
  }

  function drawDecals(){for(const d of G.decals){if(d.type==='blood'){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(hash(d.seed,2,7)*TAU);ctx.fillStyle='rgba(91,30,51,.48)';ctx.beginPath();for(let i=0;i<9;i++){const a=i/9*TAU,r=d.r*(.55+hash(i,d.seed,4)*.55);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.58);}ctx.closePath();ctx.fill();ctx.restore();}}}
  function drawProjectiles(){
    for(const b of G.bullets){ctx.strokeStyle=b.color;ctx.lineWidth=b.r;ctx.beginPath();ctx.moveTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.lineTo(b.x,b.y);ctx.stroke();}
    for(const p of G.particles){const t=clamp(p.life/p.max,0,1);ctx.save();ctx.globalAlpha=t;ctx.translate(p.x,p.y);
      if(p.type==='flash'){ctx.globalCompositeOperation='screen';ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(0,0,p.size*t,0,TAU);ctx.fill();}
      else if(p.type==='blast'){ctx.strokeStyle=p.color;ctx.lineWidth=12*t;ctx.beginPath();ctx.arc(0,0,p.size*(1-t*.7),0,TAU);ctx.stroke();}
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
    if(w.tool){const armed=rig.key==='charge'&&G.fieldEffects.find(e=>e.kind==='charge'),target=armed||toolTarget(p),r=rig.key==='charge'?85:55;ctx.save();setWorldTransform();ctx.strokeStyle='rgba(236,190,113,.68)';ctx.lineWidth=1.2;ctx.setLineDash([5,6]);ctx.beginPath();ctx.arc(target.x,target.y,r,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=COLORS.paper;ctx.beginPath();ctx.arc(target.x,target.y,2,0,TAU);ctx.fill();ctx.restore();return;}
    if(rig.key==='prybar')range=Math.hypot(rig.muzzle.x-p.x,rig.muzzle.y-p.y);else if(p.lastAimSource==='mouse'){const target=screenToWorld(input.mouse.x,input.mouse.y);range=clamp(Math.hypot(target.x-p.x,target.y-p.y),75,480);}
    const world=rig.key==='prybar'?rig.muzzle:localPoint(rig.muzzle.x,rig.muzzle.y,rig.angle,Math.max(0,range-Math.hypot(rig.muzzle.x-p.x,rig.muzzle.y-p.y)),0),pos=worldToScreen(world.x,world.y);
    resetTransform();const turnError=Math.abs(angleDelta(p.weaponAngle,p.aimAngle)),bloom=(w.spread||.02)*180+3+turnError*14+rig.obstruction*8;ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(G.time*.18);ctx.strokeStyle=p.wallObstruction&&rig.obstruction>.05?COLORS.rust:rig.key==='shotgun'?COLORS.rust:COLORS.paper;ctx.globalAlpha=.82;ctx.lineWidth=1.5;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(bloom,0);ctx.lineTo(bloom+6,0);ctx.stroke();}ctx.fillStyle=turnError<.11?COLORS.amber:COLORS.paperDim;ctx.beginPath();ctx.arc(0,0,1.5,0,TAU);ctx.fill();ctx.restore();
  }

  function drawMiniMap(){
    if(!save.upgrades.survey||G.area?.kind!=='lowland')return;resetTransform();const compact=G.viewport?.portrait||G.viewport?.shortLandscape,w=compact?126:154,h=compact?76:92,x=G.w-w-(G.viewport?.shortLandscape?214:16),y=G.viewport?.shortLandscape?8:Math.min(90+parseFloat(getComputedStyle(document.documentElement).fontSize),G.h-h-(G.touch?154:24));ctx.fillStyle='rgba(23,21,31,.84)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(238,228,198,.25)';ctx.strokeRect(x,y,w,h);ctx.strokeStyle='rgba(105,167,154,.22)';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x+i*w/4,y);ctx.lineTo(x+i*w/4,y+h);ctx.stroke();}
    const mark=(wx,wy,color,r=3)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+wx/G.area.w*w,y+wy/G.area.h*h,r,0,TAU);ctx.fill();};for(const road of G.area.paths){ctx.beginPath();road.points.forEach((p,i)=>i?ctx.lineTo(x+p.x/G.area.w*w,y+p.y/G.area.h*h):ctx.moveTo(x+p.x/G.area.w*w,y+p.y/G.area.h*h));ctx.strokeStyle='rgba(185,166,118,.32)';ctx.lineWidth=1;ctx.stroke();}for(const l of G.area.landmarks||[])mark(l.x,l.y,COLORS.paperDim,2);mark(1500,1080,save.story.pump?COLORS.tealBright:COLORS.hazard,3);mark(G.player.x,G.player.y,COLORS.paper,3.5);mark(130,900,COLORS.rust,4);mark(2310,1050,COLORS.amber,4);if(save.finalChoice==='relay')mark(2400,200,COLORS.tealBright,4);if(save.story.beacon)mark(1630,1050,COLORS.tealBright,3);ctx.fillStyle=COLORS.paperDim;ctx.font='8px monospace';ctx.fillText('SURVEY TABLE / LIVE TRACE',x+7,y+12);
  }

  function drawExtraction(){
    if(!G.extraction)return;const e=G.extraction,p=worldToScreen(e.x,e.y);resetTransform();ctx.strokeStyle=COLORS.tealBright;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,38,-Math.PI/2,-Math.PI/2+TAU*(1-e.remaining/e.total));ctx.stroke();ctx.fillStyle=COLORS.paper;ctx.textAlign='center';ctx.font='bold 12px monospace';ctx.fillText(`PICKUP ${Math.ceil(e.remaining)}s`,p.x,p.y-48);ctx.textAlign='left';
  }

  function drawRouteHint(){
    if(G.panel||!G.player||G.mode!=='play')return;let action,label;
    if(G.area.kind==='prologue'){const key=!save.prologue.satchel?'satchel':!save.prologue.fuse?'fuse':!save.prologue.cloth?'cloth':'repair';action='prologue_'+key;label={satchel:'FIELD BAG',fuse:'RELAY FUSE',cloth:'DRY CLOTH',repair:'SHELTER'}[key];}
    else if(G.area.kind==='camp'){action=save.contractAccepted?'depart':'mara';label=save.contractAccepted?'LOWLAND ROUTE':'MARA';}
    else if(G.area.kind==='bunker'){action=hasItem('regulator')?'exit_bunker':'regulator';label=hasItem('regulator')?'WAY OUT':'REGULATOR';}
    else{action=hasItem('regulator')?'extract':'enter_bunker';label=hasItem('regulator')?'HOME':'WATERWORKS';}
    let o=G.area.objects.find(o=>o.active&&o.interact===action);const recipe=RECIPES[save.trackedRecipe];if(recipe&&G.area.kind==='lowland'&&!hasItem('regulator')){const missing=Object.keys(recipe.cost).filter(k=>(save.stash[k]||0)+G.player.inventory.reduce((n,s)=>n+(s.key===k?s.qty:0),0)<recipe.cost[k]);const sources=G.area.objects.filter(v=>v.active&&v.interact==='loot'&&v.loot?.some(([k,q])=>q>0&&missing.includes(k)));sources.sort((a,b)=>dist(a,G.player)-dist(b,G.player));if(sources.length){o=sources[0];label='PROJECT SALVAGE';}}
    if(!o||G.nearest===o)return;const x=o.r!=null?o.x:o.x+o.w/2,y=o.r!=null?o.y:o.y+o.h/2,q=worldToScreen(x,y),p=worldToScreen(G.player.x,G.player.y),a=Math.atan2(q.y-p.y,q.x-p.x);
    const pad=48,top=G.touch?171:112,bottom=G.h-(G.touch?235:70);if(bottom<top+30)return;const sx=clamp(q.x,pad,G.w-pad),sy=clamp(q.y-34,top,bottom),off=Math.abs(sx-q.x)>1||Math.abs(sy-q.y+34)>1;
    resetTransform();ctx.save();ctx.translate(sx,sy);ctx.fillStyle='rgba(15,34,32,.8)';roundedPath(ctx,-44,-12,88,29,5);ctx.fill();ctx.fillStyle='#dfc78c';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(label,0,7);if(off){ctx.translate(0,-20);ctx.rotate(a);polygon(ctx,[[6,0],[-4,-4],[-2,0],[-4,4]]);ctx.fill();}ctx.restore();
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
    G.camera.zoom=G.viewport?.zoom||1;prepareCameraShake();setWorldTransform();drawGround(G.area);drawDecals();
    for(const d of G.area.decor)if(onScreenWorld(d.x,d.y,50))drawDecor(d);
    const list=[];for(const o of G.area.objects)if(o.active&&onScreenWorld(o.r!=null?o.x:o.x+o.w/2,o.r!=null?o.y:o.y+o.h/2,Math.max(o.r||0,o.w||0,o.h||0)+60))list.push({z:o.z||((o.y||0)+(o.h||0)),kind:'object',o});
    for(const e of G.area.enemies)if(e.alive&&onScreenWorld(e.x,e.y,80))list.push({z:e.y+e.r,kind:'enemy',o:e});list.push({z:G.player.y+G.player.r,kind:'player',o:G.player});list.sort((a,b)=>a.z-b.z);
    for(const d of list){if(d.kind==='object')drawObject(d.o);else if(d.kind==='enemy')drawEnemy(d.o);else drawPlayer(d.o);}
    drawFieldEffects();drawProjectiles();drawSoundCues();drawLighting();drawCrosshair();drawMiniMap();drawExtraction();drawRouteHint();
    if(G.transition!==0){resetTransform();ctx.fillStyle=`rgba(11,16,18,${G.transition>0?clamp(G.transition,0,1):clamp(-G.transition,0,1)})`;ctx.fillRect(0,0,G.w,G.h);}
  }

  function resize(){
    const visual=window.visualViewport,profile=viewportProfile(visual?.width||innerWidth,visual?.height||innerHeight,G.touch,devicePixelRatio||1);G.viewport=profile;G.w=profile.w;G.h=profile.h;G.dpr=profile.dpr;G.camera.zoom=profile.zoom;
    canvas.width=Math.floor(G.w*G.dpr);canvas.height=Math.floor(G.h*G.dpr);canvas.style.width=`${G.w}px`;canvas.style.height=`${G.h}px`;ctx.imageSmoothingEnabled=true;
    document.body.dataset.layout=profile.kind;document.documentElement.style?.setProperty('--app-width',`${G.w}px`);document.documentElement.style?.setProperty('--app-height',`${G.h}px`);
  }

  const touchResetters=[];
  let resetCombatPad=()=>{};
  function cancelTouchAttack(){resetCombatPad();input.touchAttack=null;input.touchFlash=0;}
  function touchCombatReady(){return G.mode==='play'&&!G.panel&&G.transition===0&&G.player?.alive;}
  function updateTouchPad(){
    if(!G.player)return;const key=currentWeaponKey(),w=weaponSpec(key),empty=G.area?.kind==='prologue'&&!save.prologue.satchel,safe=G.player.camp&&!w.melee,armed=key==='charge'&&G.fieldEffects.some(e=>e.kind==='charge');
    const reloading=G.player.reload>0,g=input.touchGesture,aiming=g&&(g.dragged||g.age>.3),action=w.melee?'STRIKE':w.tool?(armed?'DETONATE':'THROW'):'FIRE';
    const label=empty?'UNARMED':safe?'SAFE AREA':reloading?'RELOAD':aiming?'AIM':action;
    const hint=empty?'FIND YOUR FIELD BAG':safe?'SWAP TO PRY BAR':reloading?'TAP AGAIN WHEN READY':aiming?'RELEASE SAFELY · AIM STAYS':`DRAG AIM · TAP ${action}`;
    if($('touch-attack-label').textContent!==label)$('touch-attack-label').textContent=label;if($('touch-attack-hint').textContent!==hint)$('touch-attack-hint').textContent=hint;
    $('aim-stick').setAttribute('aria-label',label+'. '+hint);$('aim-stick').classList.toggle('firing',input.touchFlash>0);$('aim-stick').classList.toggle('aiming',!!g);
  }
  function updateTouchCombat(dt){
    input.touchFlash=Math.max(0,input.touchFlash-dt);
    if(input.device!=='touch'||!touchCombatReady()){if(input.touchGesture||input.touchAttack)cancelTouchAttack();return;}
    const key=currentWeaponKey(),g=input.touchGesture;
    if(g&&g.key!==key){cancelTouchAttack();return;}
    if(g)g.age+=dt;
    const tap=input.touchAttack;
    if(tap){if(tap.key!==key||Date.now()>tap.expiresAt||G.player.reload>0||G.player.cooldown>0)input.touchAttack=null;else{input.aimStick.x=Math.cos(tap.angle);input.aimStick.y=Math.sin(tap.angle);input.aimOwner='touch';}}
    updateTouchPad();
  }
  function bindCombatPad(node){
    let pointer=null,touchId=null;
    const reset=()=>{const captured=pointer;pointer=null;touchId=null;input.touchGesture=null;node.firstElementChild.style.transform='translate(0,0)';node.classList.remove('aiming');if(captured!=null&&node.hasPointerCapture?.(captured))node.releasePointerCapture(captured);};
    resetCombatPad=reset;touchResetters.push(()=>{reset();input.touchAttack=null;input.aimStick.x=input.aimStick.y=0;});
    const begin=(x,y)=>{
      if(!touchCombatReady())return false;
      const angle=input.aimOwner==='touch'&&Math.hypot(input.aimStick.x,input.aimStick.y)>.01?Math.atan2(input.aimStick.y,input.aimStick.x):G.player.aimAngle;
      setInputDevice('touch',true);sound.unlock();input.touchAttack=null;input.aimStick.x=Math.cos(angle);input.aimStick.y=Math.sin(angle);
      input.touchGesture={x,y,angle,key:currentWeaponKey(),age:0,startedAt:Date.now(),dragged:false};updateTouchPad();return true;
    };
    const move=(x,y)=>{
      const g=input.touchGesture;if(!g)return;const dx=x-g.x,dy=y-g.y,len=Math.hypot(dx,dy),max=node.getBoundingClientRect().width*.31;
      if(len>=8){g.dragged=true;g.angle=Math.atan2(dy,dx);input.aimStick.x=dx/len;input.aimStick.y=dy/len;input.aimOwner='touch';}
      const scale=len>max?max/len:1;node.firstElementChild.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
    };
    const finish=cancelled=>{
      const g=input.touchGesture;
      if(!cancelled&&g&&!g.dragged&&g.age<=.3&&Date.now()-g.startedAt<=300&&touchCombatReady()&&g.key===currentWeaponKey()){
        if(G.player.reload>0)toast('RELOADING · TAP AGAIN WHEN READY',.8);
        else if(G.player.cooldown>0)toast('WEAPON RECOVERING',.5);
        else input.touchAttack={key:g.key,angle:g.angle,expiresAt:Date.now()+180};
      }
      reset();updateTouchPad();
    };
    if(window.PointerEvent){
      node.addEventListener('pointerdown',e=>{if(pointer!=null||e.button>0)return;e.preventDefault();if(begin(e.clientX,e.clientY)){pointer=e.pointerId;node.setPointerCapture?.(pointer);}});
      node.addEventListener('pointermove',e=>{if(e.pointerId===pointer){e.preventDefault();move(e.clientX,e.clientY);}});
      node.addEventListener('pointerup',e=>{if(e.pointerId===pointer){e.preventDefault();move(e.clientX,e.clientY);finish(false);}});
      for(const type of ['pointercancel','lostpointercapture'])node.addEventListener(type,e=>{if(e.pointerId===pointer)finish(true);});
    }else{
      node.addEventListener('touchstart',e=>{if(touchId!=null)return;e.preventDefault();const t=e.changedTouches[0];if(begin(t.clientX,t.clientY))touchId=t.identifier;},{passive:false});
      node.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===touchId){e.preventDefault();move(t.clientX,t.clientY);}},{passive:false});
      for(const type of ['touchend','touchcancel'])node.addEventListener(type,e=>{for(const t of e.changedTouches)if(t.identifier===touchId){e.preventDefault();move(t.clientX,t.clientY);finish(type==='touchcancel');}},{passive:false});
    }
  }
  function bindStick(node,key){
    let pointer=null,touchId=null;
    const set=(cx,cy)=>{const r=node.getBoundingClientRect(),x=cx-(r.left+r.width/2),y=cy-(r.top+r.height/2),len=Math.hypot(x,y),max=r.width*.34,nx=len>max?x/len*max:x,ny=len>max?y/len*max:y,amount=len/max,dead=.14,scale=amount<=dead?0:(Math.min(1,amount)-dead)/(1-dead);input[key].x=len?x/len*scale:0;input[key].y=len?y/len*scale:0;node.firstElementChild.style.transform=`translate(${nx}px,${ny}px)`;setInputDevice('touch');input.moveOwner='touch';};
    const clear=e=>{if(e&&e.pointerId!=null&&pointer!=null&&e.pointerId!==pointer)return;pointer=null;touchId=null;input[key].x=0;input[key].y=0;node.firstElementChild.style.transform='translate(0,0)';};
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
    input.keys.clear();input.pressed.clear();input.actions.clear();input.mouse.down=false;input.mouse.active=false;input.touchFlash=0;input.touchAttack=null;input.touchSprint=false;input.pad=null;input.moveOwner=input.device==='touch'?'touch':'keyboard';input.aimOwner='move';
    for(const reset of touchResetters)reset();$('touch-run').textContent='WALK';$('touch-run').setAttribute('aria-pressed','false');controller.suspend();
  }

  window.addEventListener('keydown',e=>{
    if(e.target instanceof Element&&e.target.closest('input,select')&&e.code!=='Escape')return;
    sound.unlock();setInputDevice('keyboard');
    if(e.code==='Escape'){
      if(!e.repeat)input.queue(G.panel?'cancel':'pause','keyboard');return;
    }
    if(G.panel){if(e.code==='Tab'||e.code==='KeyI'){e.preventDefault();if(!e.repeat)input.queue('cancel','keyboard');}else if(e.code.startsWith('Arrow')){e.preventDefault();moveFocus(e.code==='ArrowLeft'?-1:e.code==='ArrowRight'?1:0,e.code==='ArrowUp'?-1:e.code==='ArrowDown'?1:0);}return;}
    if(G.mode!=='play')return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code))e.preventDefault();
    const fresh=!input.keys.has(e.code);input.keys.add(e.code);if(!fresh)return;input.pressed.add(e.code);
    if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code))input.moveOwner='keyboard';
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))input.aimOwner='keyboard';
    if(e.code==='KeyE')input.queue('use','keyboard');
    if(e.code==='KeyR')input.queue('reload','keyboard');
    if(e.code==='KeyQ')input.queue('swap','keyboard');
    if(e.code==='Tab'||e.code==='KeyI')input.queue('pack','keyboard');
    if(e.code==='KeyH')quickHeal();
  });
  window.addEventListener('keyup',e=>input.keys.delete(e.code));
  window.addEventListener('blur',()=>{if(G.mode==='play')showPause('focus');else{clearTransientInput();sound.suspend();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(G.mode==='play')showPause('focus');else{clearTransientInput();sound.suspend();}}});
  window.addEventListener('gamepaddisconnected',e=>{const active=controller.status.index===e.gamepad.index;controller.disconnect(e.gamepad.index);if(active&&G.mode==='play')showPause('focus');});

  const mouseMove=e=>{const dx=e.clientX-input.mouse.x,dy=e.clientY-input.mouse.y;input.mouse.x=e.clientX;input.mouse.y=e.clientY;if(Math.hypot(dx,dy)>2){input.mouse.active=true;input.aimOwner='mouse';setInputDevice('mouse',true);}};
  function pointerInteract(x,y){
    if(G.mode!=='play'||G.panel||!G.player||G.transition!==0)return false;
    const world=screenToWorld(x,y),p=G.player;let selected=null,score=Infinity;
    if(G.area.enemies.some(e=>e.alive&&combatShapes(e,8).some(s=>dist(s,world)<=s.r)))return false;
    for(const o of G.area.objects){if(!o.active||!o.interact||!pointInObject(world.x,world.y,o,18))continue;const cx=o.r!=null?o.x:o.x+o.w/2,cy=o.r!=null?o.y:o.y+o.h/2,d=Math.hypot(world.x-cx,world.y-cy);if(d<score){score=d;selected=o;}}
    if(!selected)return false;const o=selected,d=o.r!=null?dist(p,o)-o.r:Math.hypot(p.x-clamp(p.x,o.x,o.x+o.w),p.y-clamp(p.y,o.y,o.y+o.h));
    if(d>100){if(input.device==='mouse')return false;toast('MOVE CLOSER TO '+(o.label||'INTERACT'));return true;}input.mouse.down=false;G.nearest=o;interact();return true;
  }
  if(window.PointerEvent){
    canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')mouseMove(e);});
    canvas.addEventListener('pointerdown',e=>{sound.unlock();setInputDevice(e.pointerType==='mouse'?'mouse':'touch');if(e.button===0&&pointerInteract(e.clientX,e.clientY))return;if(e.pointerType==='mouse'&&e.button===0){input.mouse.down=true;input.mouse.x=e.clientX;input.mouse.y=e.clientY;input.mouse.active=true;input.aimOwner='mouse';setInputDevice('mouse',true);}});
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

  bindStick($('move-stick'),'moveStick');bindCombatPad($('aim-stick'));
  bindAction($('touch-use'),'use');bindAction($('touch-reload'),'reload');bindAction($('touch-swap'),'swap');bindAction($('touch-pack'),'pack');
  $('prompt').addEventListener('click',()=>{sound.unlock();interact();});
  $('touch-heal').addEventListener('click',quickHeal);
  $('touch-run').addEventListener('click',()=>{input.touchSprint=!input.touchSprint;$('touch-run').textContent=input.touchSprint?'RUN':'WALK';$('touch-run').setAttribute('aria-pressed',String(input.touchSprint));});

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
  window.visualViewport?.addEventListener('resize',resize,{passive:true});

  let accumulator=0;
  function loop(ts){
    pollGamepad(ts);if(!G.last)G.last=ts;let frame=Math.min(.05,(ts-G.last)/1000);G.last=ts;accumulator+=frame;
    while(accumulator>=1/60){update(1/60);accumulator-=1/60;}
    drawWorld();requestAnimationFrame(loop);
  }

  resize();refreshTitle();setInputDevice(input.device);controllerUI();setPlayUI(false);showScreen('title-screen');setInterval(ambientTick,1750);requestAnimationFrame(loop);
})();
