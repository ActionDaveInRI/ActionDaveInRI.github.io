// Physical contact boxes in the same frame as actors: the docked port, or the
// Wayfarer's fixed interior frame in flight. No dependency on engine/rendering.
import { activeVessels, portSolids, coastalRocks, terrainHeight, relayRooms,
  coastZ, worldSupport, toWorld } from './world.js';

const EMPTY = Object.freeze([]);
const cache = new WeakMap();
const EPS = 1e-7;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const title = text => String(text).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function toSurfaceLocal(s, x, z) {
  const c = Math.cos(s.heading || 0), n = Math.sin(s.heading || 0);
  const dx = x - s.x, dz = z - s.z;
  return { x: dx * c - dz * n, z: dx * n + dz * c };
}
export function fromSurfaceLocal(s, x, z) {
  const c = Math.cos(s.heading || 0), n = Math.sin(s.heading || 0);
  return { x: s.x + x * c + z * n, z: s.z - x * n + z * c };
}
/** Positive inset shrinks all four edges; negative inset expands them. */
export function surfaceContains(s, x, z, inset = 0) {
  const p = toSurfaceLocal(s, x, z), hw = s.w / 2 - inset, hd = s.d / 2 - inset;
  return hw >= 0 && hd >= 0 && Math.abs(p.x) <= hw + EPS && Math.abs(p.z) <= hd + EPS;
}
/** A vertical actor cylinder: y is feet height. Exact top contact is not overlap. */
export function surfaceBlocked(s, x, y, z, r = .32, height = 2.3) {
  if (height <= 0 || s.h <= 0 || y >= s.y + s.h - EPS || y + height <= s.y + EPS) return false;
  const p = toSurfaceLocal(s, x, z);
  const dx = Math.max(0, Math.abs(p.x) - s.w / 2), dz = Math.max(0, Math.abs(p.z) - s.d / 2);
  if (r <= 0) return Math.abs(p.x) < s.w / 2 - EPS && Math.abs(p.z) < s.d / 2 - EPS;
  return dx * dx + dz * dz < r * r - EPS;
}
/** Nearest vertical face; corners deterministically prefer an x face. */
export function nearestFace(s, x, z) {
  const p = toSurfaceLocal(s, x, z), hw = s.w / 2, hd = s.d / 2;
  const faces = [
    { x: -hw, z: clamp(p.z, -hd, hd), nx: -1, nz: 0, span: s.d },
    { x: hw, z: clamp(p.z, -hd, hd), nx: 1, nz: 0, span: s.d },
    { x: clamp(p.x, -hw, hw), z: -hd, nx: 0, nz: -1, span: s.w },
    { x: clamp(p.x, -hw, hw), z: hd, nx: 0, nz: 1, span: s.w },
  ];
  let best = faces[0], distance = Infinity;
  for (const f of faces) {
    const d = Math.hypot(p.x - f.x, p.z - f.z);
    if (d < distance - EPS) { best = f; distance = d; }
  }
  const q = fromSurfaceLocal(s, best.x, best.z), c = Math.cos(s.heading || 0), n = Math.sin(s.heading || 0);
  return { ...q, nx: best.nx * c + best.nz * n, nz: -best.nx * n + best.nz * c, distance, span: best.span };
}

/** Interior roof/floor caps, independent of visual cutaways and touch objects.
 * The Wayfarer uses intended 3.8 clearance; its current decorative roof extends
 * lower. Morrow's gallery shares the accommodation clearance so the authored
 * upper walkway remains usable despite the exterior cargo roof below it.
 */
export function hasHeadroom(g, p, height = 2.35) {
  if (!Number.isFinite(p.y) || !Number.isFinite(height)) return false;
  if (height <= 0) return true;
  const inside = (x, z, b) => b && x >= b[0] - EPS && x <= b[1] + EPS && z >= b[2] - EPS && z <= b[3] + EPS;
  const crosses = (feet, cap) => feet < cap - EPS && feet + height > cap + EPS;
  if (inside(p.x, p.z, [-3.15, 3.15, -11.7, 10.5]) && crosses(p.y, 3.8)) return false;
  for (const v of activeVessels(g)) {
    const q = toSurfaceLocal(v, p.x, p.z), feet = p.y - finite(v.y);
    if (!inside(q.x, q.z, v.bounds)) continue;
    if (!v.upper) { if (crosses(feet, 4.425)) return false; continue; }
    const forward = inside(q.x, q.z, v.upperBounds), gallery = inside(q.x, q.z, v.gallery);
    const stairs = inside(q.x, q.z, v.stairs);
    if ((forward || gallery) && !stairs && crosses(feet, v.upper - .25)) return false;
    const upperRoute = forward || gallery || stairs;
    const ceiling = upperRoute ? v.upper + 2.79 : 6.125;
    if (crosses(feet, ceiling)) return false;
  }
  return true;
}

/**
 * Inputs fixtures/slots are the immutable exported Wayfarer arrays from engine.
 * Return values are immutable and cached by game, port/docked/cargo, input refs.
 * y is the bottom of the box. `safe` means suitable for voluntary contact;
 * `stable` means fixed/sturdy, NOT a promise of a standable top. Only `climb`
 * boxes offer a climb target. rest='seat' puts the pelvis on y+h; rest='lean'
 * offers a vertical face. Callers must still check reach, body clearance,
 * support, occupied seats, and approach paths. No action locations are authored.
 *
 * This is a contact registry, not a replacement for worldSupport/worldBlocked.
 * Floors, slopes and cutaway ceilings remain with their existing world queries.
 */
export function contactSurfaces(g, fixtures = EMPTY, slots = EMPTY) {
  fixtures ||= EMPTY; slots ||= EMPTY;
  const docked = !!g.docked, port = docked ? (g.port || 0) : -1;
  const cargo = clamp(Math.floor(finite(g.job?.cargo)), 0, slots.length);
  const old = cache.get(g);
  if (old && old.docked === docked && old.port === port && old.cargo === cargo && old.fixtures === fixtures && old.slots === slots) return old.surfaces;
  const out = [], ids = new Set();
  function add(s, frame = null) {
    if (![s.x, s.z, s.y, s.w, s.d, s.h].every(Number.isFinite) || s.w <= 0 || s.d <= 0 || s.h <= 0) return;
    const position = frame ? toWorld(frame, s.x, s.z) : { x: s.x, z: s.z };
    const item = { id: s.id, label: s.label || title(s.id), ...position,
      y: s.y + finite(frame?.y), w: s.w, d: s.d, h: s.h,
      heading: finite(frame?.heading) + finite(s.heading), level: s.level ?? 0,
      material: s.material || 'metal', safe: s.safe ?? true, stable: s.stable ?? true,
      rest: s.rest || false, climb: !!s.climb, wallContact:!!s.wallContact, railContact:!!s.railContact, use:s.use||null, counterContact:!!s.counterContact };
    if (ids.has(item.id)) throw new Error('Duplicate contact surface: ' + item.id);
    ids.add(item.id); out.push(Object.freeze(item));
  }
  function fixture(f, base, prefix, frame = null) {
    const type = f.type || 'solid', id = prefix + ':' + (f.id || type);
    const label = f.name || title(f.id || type), level = f.level || 0;
    const common = { id, label, x: f.x, z: f.z, y: base, w: f.w, d: f.d, h: f.h, level, heading: f.heading || 0, use:type };
    // Chair geometry is fixed by vessel-view.seat(), independent of fixture h.
    if (type === 'chair') {
      const local = (dx, dz) => fromSurfaceLocal({ x: f.x, z: f.z, heading: f.heading || 0 }, dx, dz);
      add({ ...common, id: id + ':cushion', y: base + .49, w: .78, d: .74, h: .18, material: 'cloth', rest: 'seat' }, frame);
      add({ ...common, id: id + ':pedestal', y: base, w: .20, d: .20, h: .49 }, frame);
      add({ ...common, ...local(0, .32), id: id + ':back', y: base + .59, w: .76, d: .15, h: .92, material: 'rubber' }, frame);
      for (const side of [-1, 1]) add({ ...common, ...local(side * .47, 0), id: id + ':arm:' + side, y: base + .80, w: .12, d: .65, h: .10 }, frame);
      return;
    }
    if (type === 'bunk') {
      add({ ...common, id: id + ':frame', y: base + .02, h: .44 }, frame);
      add({ ...common, id: id + ':mattress', y: base + .45, w: f.w - .10, d: f.d - .10, h: .24, material: 'cloth', rest: 'seat' }, frame);
      const center = fromSurfaceLocal(common, 0, .25);
      add({ ...common, ...center, id: id + ':blanket', y: base + .665, w: f.w - .14, d: f.d * .68, h: .15, material: 'cloth', rest: 'seat' }, frame);
      const pillow = fromSurfaceLocal(common, 0, -f.d * .34);
      add({ ...common, ...pillow, id: id + ':pillow', y: base + .685, w: f.w * .82, d: .53, h: .17, material: 'cloth', stable: false }, frame);
      return;
    }
    if (type === 'bench') {
      add({ ...common, id: id + ':seat', y: base + f.h - .21, h: .22, material: 'cloth', rest: 'seat' }, frame);
      for (const side of [-1, 1]) {
        const p = fromSurfaceLocal(common, 0, side * f.d * .35);
        add({ ...common, ...p, id: id + ':leg:' + side, w: f.w * .75, d: .12, h: f.h }, frame);
      }
      return;
    }
    if (type === 'shower') {
      add({ ...common, id: id + ':tray', h: .12, material: 'metal', safe: false }, frame);
      add({ ...common, id: id + ':back', z: f.z - f.d / 2, d: .08, material: 'metal' }, frame);
      add({ ...common, id: id + ':side', x: f.x - f.w / 2, w: .08, material: 'metal' }, frame);
      return;
    }
    if (type === 'table') {
      add({ ...common, y: base + f.h - .07, h: .14, material: 'wood', rest: 'lean', counterContact:true, climb:Math.min(f.w,f.d)>=1.05 }, frame);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const p = fromSurfaceLocal(common, sx * f.w * .36, sz * f.d * .34);
        add({ ...common, ...p, id: id + ':leg:' + sx + ':' + sz, w: .12, d: .12, h: f.h }, frame);
      }
      return;
    }
    const crate = type === 'crate' || type === 'freight';
    const unsafe = ['engine', 'tank', 'galley', 'sink', 'wash'].includes(type);
    const broad = Math.min(f.w, f.d) >= 1 && f.h >= .35;
    // Crate tops are structural; equipment, shelving and soft furnishings are not.
    add({ ...common, material: crate ? 'crate' : type === 'console' ? 'glass' : 'metal',
      counterContact:type==='market-counter', safe: !unsafe, rest: unsafe || type === 'console' ? false : 'lean', climb: crate && broad }, frame);
    if (type === 'galley' || type === 'sink') add({ ...common, id: id + ':counter', y: base + f.h - .02, w: f.w + .08, d: f.d + .08, h: .12, safe: false }, frame);
  }
  function wall(w, base, prefix, frame = null, rail = false) {
    const span = w.end - w.start, thick = w.thickness || .1;
    const common = { id: prefix, label: rail ? 'Handrail' : 'Bulkhead',
      x: w.axis === 'x' ? w.at : (w.start + w.end) / 2,
      z: w.axis === 'z' ? w.at : (w.start + w.end) / 2,
      y: base, w: w.axis === 'x' ? thick : span, d: w.axis === 'z' ? thick : span,
      h: w.h, level: w.level || 0, rest: 'lean' };
    if (!rail) { add({...common,wallContact:true}, frame); return; }
    // A rail is an elevated tube plus narrow posts, never a solid low wall.
    add({ ...common, y: base + w.h - .05, h: .10, railContact: true }, frame);
    for (let t = w.start, i = 0; t <= w.end + EPS; t += 2, i++) add({ ...common,
      id: prefix + ':post:' + i, x: w.axis === 'x' ? w.at : t,
      z: w.axis === 'z' ? w.at : t, w: .07, d: .07, rest: false }, frame);
  }

  fixtures.forEach((f, i) => fixture(f, 1.4, 'wayfarer:fixture:' + i));
  for (const side of [-1, 1]) {
    fixture({ type: 'chair', x: side * .85, z: -8.8 }, 1.4, 'wayfarer:helm:' + side);
    add({ id: 'wayfarer:hull:' + side, label: 'Wayfarer hull', x: side * 3.18, z: -.2, y: 1.34, w: .28, d: 23, h: 2.56, rest: 'lean', wallContact:true });
    add({ id: 'wayfarer:pylon:' + side, label: 'Engine pylon', x: side * 4.7, z: 1.2, y: .95, w: 3.2, d: 2.2, h: .7, safe: false });
    add({ id: 'wayfarer:engine:' + side, label: 'Engine pod', x: side * 6.4, z: 1.3, y: .46, w: 2.28, d: 8.04, h: 2.28, safe: false });
    for (const z of [-7, 0, 3]) {
      add({ id: 'wayfarer:bulkhead:' + side + ':' + z, label: 'Bulkhead', x: side * 2.04, z, y: 1.425, w: 1.85, d: .16, h: 2.05, rest: 'lean', wallContact:true });
      add({ id: 'wayfarer:jamb:' + side + ':' + z, label: 'Door frame', x: side * 1.08, z, y: 1.4, w: .09, d: .20, h: 2, rest: false });
    }
  }
  add({ id: 'wayfarer:bow', label: 'Cockpit bulkhead', x: 0, z: -11.7, y: 1.4, w: 6.2, d: .25, h: 2.25, rest: 'lean', wallContact:true });
  for (let i = 0; i < cargo; i++) fixture({ ...slots[i], w: 1.3, d: 1.6, h: 1.4, type: 'crate' }, 1.4, 'wayfarer:cargo:' + i);

  for (const v of activeVessels(g)) {
    v.fixtures.forEach((f, i) => fixture(f, f.level ? v.upper : v.floor, v.id + ':fixture:' + i, v));
    for (const [i, p] of (v.partitions || EMPTY).entries()) wall(p, p.level ? v.upper : v.floor, v.id + ':partition:' + (p.id || i), v);
    for (const [i, r] of (v.rails || EMPTY).entries()) wall(r, r.level ? v.upper : v.floor, v.id + ':rail:' + i, v, true);
    // Same three outer wall runs as buildVessel(), preserving the open stern.
    for (const level of v.upper ? [0, 1] : [0]) {
      const b = level ? v.upperBounds : v.bounds, h = level ? 2.8 : v.upper ? 3.4 : 2.8;
      const runs = [['x', b[0], b[2], b[3]], ['x', b[1], b[2], b[3]], ['z', b[2], b[0], b[1]]];
      runs.forEach(([axis, at, start, end], i) => wall({ axis, at, start, end, level, h, thickness: .19 }, level ? v.upper : v.floor, v.id + ':hull:' + level + ':' + i, v));
    }
    for (const [i, e] of (v.externalSolids || EMPTY).entries()) add({ ...e,
      id: v.id + ':external:' + (e.id || i), label: 'Engine assembly', safe: false, rest: false, climb: false }, v);
  }
  if (docked) {
    add({ id: 'port:' + port + ':freight-desk', label: 'Freight desk', x: -9, z: 20, y: 0, w: 3.7, d: 1.65, h: 1.67, rest: 'lean' });
    (portSolids[port] || EMPTY).forEach((f, i) => {
      const prefix = 'port:' + port + ':solid:' + i;
      if (f.type) { fixture(f, finite(f.y), prefix); return; }
      const building = !!f.name;
      // Coastal tanks are rendered from terrain height although old nav solids
      // omit y. Their dimensions identify the cylinders; don't make flat tops.
      const tank = port === 0 && f.w === 6.6 && f.d === 6.6 && f.h === 6;
      const y = Number.isFinite(f.y) ? f.y : tank ? terrainHeight(f.x, f.z) : 0;
      add({ ...f, id: prefix, label: f.name || (tank ? 'Water tank' : 'Fixed structure'), y,
        material: building ? 'masonry' : 'metal', wallContact:building, safe: !tank, rest: tank ? false : 'lean', climb: false });
    });
    if (port === 0) {
      coastalRocks.forEach((r, i) => add({ id: 'cinder:rock:' + i, label: 'Coastal rock', x: r.x, z: r.z,
        y: r.y - r.ry, w: r.rx * 2, d: r.rz * 2, h: r.ry * 2, heading: r.angle,
        material: 'stone', safe: false, rest: false, climb: false }));
      // Match visible waterfront/pier handrails; broad walls are never invented.
      for (let x = -77, i = 0; x < 73; x += 6, i++) {
        const z = Math.min(40, coastZ(x) - 3);
        add({ id: 'cinder:seawall:beam:' + i, label: 'Seawall railing', x: x + 2.9, z, y: .875, w: 5.8, d: .13, h: .13, rest: 'lean', railContact: true });
        add({ id: 'cinder:seawall:post:' + i, label: 'Railing post', x, z, y: 0, w: .13, d: .13, h: 1 });
      }
      for (const side of [-1, 1]) {
        const x = -60 + side * 5.6;
        add({ id: 'cinder:pier:beam:' + side, label: 'Pier railing', x, z: 56, y: .825, w: .12, d: 25, h: .15, rest: 'lean', railContact: true });
        for (let z = 46; z < 69; z += 5) add({ id: 'cinder:pier:post:' + side + ':' + z, label: 'Railing post', x, z, y: -.005, w: .15, d: .15, h: .85 });
      }
      add({ id: 'cinder:pier:end', label: 'Pier railing', x: -60, z: 68, y: .825, w: 12, d: .12, h: .15, rest: 'lean', railContact: true });
    }
    if (port === 1) {
      // Derive boundary segments exactly as the renderer does, leaving room
      // connections open. No hand-authored interaction or approach coordinates.
      for (const room of relayRooms) {
        const b = room.bounds;
        for (const [i, [axis, at, start, end]] of [['x', b[0], b[2], b[3]], ['x', b[1], b[2], b[3]], ['z', b[2], b[0], b[1]], ['z', b[3], b[0], b[1]]].entries()) {
          let run = null, part = 0;
          const flush = t => { if (run === null) return; wall({ axis, at, start: run, end: t, h: 4, thickness: .5 }, 0, 'relay:wall:' + room.id + ':' + i + ':' + part++); run = null; };
          for (let t = start; t < end; t++) {
            const sign = at === (axis === 'x' ? b[0] : b[2]) ? -1 : 1;
            const x = axis === 'x' ? at + sign * .6 : t + .5, z = axis === 'z' ? at + sign * .6 : t + .5;
            if (!worldSupport({ docked: true, port: 1 }, x, z, 0)) { if (run === null) run = t; } else flush(t);
          }
          flush(end);
        }
      }
    }
  }
  const surfaces = Object.freeze(out);
  cache.set(g, { docked, port, cargo, fixtures, slots, surfaces });
  return surfaces;
}
