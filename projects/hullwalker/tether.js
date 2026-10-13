import * as T from './vendor/three/build/three.module.js';

const REEL_SPEED = 1.5;       // metres per second, in either direction
const WINCH_ACCELERATION = 2; // metres per second squared under load
const POWER_PER_METRE = 2;
const LOADED_POWER_PER_SECOND = 3;
const EPS = 1e-7;
const radial = new T.Vector3();

export function createTether() {
  return {anchor: null, length: 0, minLength: 2, maxLength: 28,
    power: 100, taut: false, snagged: false};
}

/** Caller checks anchor visibility before connecting. An unreachable anchor is rejected. */
export function connectTether(tether, anchor, harnessPosition) {
  if (!anchor?.position) return false;
  const distance = harnessPosition.distanceTo(anchor.position);
  if (!Number.isFinite(distance) || distance > tether.maxLength + EPS) return false;
  tether.anchor = anchor;
  tether.length = T.MathUtils.clamp(distance, tether.minLength, tether.maxLength);
  tether.taut = distance >= tether.length - EPS;
  tether.snagged = false;
  return true;
}

/** The body is deliberately absent: disconnecting cannot modify its momentum. */
export function releaseTether(tether) {
  tether.anchor = null;
  tether.length = 0;
  tether.taut = false;
  tether.snagged = false;
  return tether;
}

/**
 * Apply after the caller's free movement, preferably in <= 1/120 s substeps.
 * Position is the harness/world position, not the astronaut's foot position.
 * Positive reel takes up cable; negative reel pays cable out. Anchors are fixed.
 * Hull collision and straight-cable obstruction are resolved by the caller.
 */
export function stepTether(tether, position, velocity, dt, reel = 0) {
  if (!tether.anchor || !Number.isFinite(dt) || dt <= 0) return tether;
  dt = Math.min(dt, 1 / 15); // A paused tab cannot discharge or jerk the winch.
  tether.length = T.MathUtils.clamp(tether.length, tether.minLength, tether.maxLength);
  tether.power = T.MathUtils.clamp(tether.power, 0, 100);
  radial.copy(position).sub(tether.anchor.position);
  let distance = radial.length();
  if (!Number.isFinite(distance) || distance < EPS) {
    tether.taut = false;
    return tether;
  }
  radial.multiplyScalar(1 / distance);
  const command = T.MathUtils.clamp(Number.isFinite(reel) ? reel : 0, -1, 1);

  // Paying out precedes the constraint, so newly available slack is usable now.
  if (command < 0 && tether.power > 0 && !tether.snagged) {
    const amount = Math.min(-command * REEL_SPEED * dt,
      tether.maxLength - tether.length, tether.power / POWER_PER_METRE);
    tether.length += amount;
    tether.power -= amount * POWER_PER_METRE;
  }

  // Unilateral constraint: a rope pulls but never pushes. A slack-to-taut catch
  // loses radial energy; it neither boosts the tangent nor reverses inward drift.
  if (distance > tether.length) {
    position.addScaledVector(radial, tether.length - distance);
    distance = tether.length;
  }
  if (distance >= tether.length - EPS) {
    const outwardSpeed = velocity.dot(radial);
    if (outwardSpeed > 0) velocity.addScaledVector(radial, -outwardSpeed);
  }

  if (command > 0 && tether.power > 0 && !tether.snagged && tether.length > tether.minLength + EPS) {
    const requested = Math.min(command * REEL_SPEED * dt,
      tether.length - tether.minLength, tether.power / POWER_PER_METRE);
    // Wind only slack already available. Under tension, accelerate the body
    // inward and take up its actual movement next step instead of teleporting it.
    const takenUp = Math.min(requested, Math.max(0, tether.length - distance));
    tether.length -= takenUp;
    tether.power -= takenUp * POWER_PER_METRE;
    if (requested > takenUp + EPS && tether.power > 0) {
      const poweredTime = Math.min(dt, tether.power / LOADED_POWER_PER_SECOND);
      const inwardSpeed = -velocity.dot(radial);
      const pull = Math.min(command * WINCH_ACCELERATION * poweredTime,
        Math.max(0, command * REEL_SPEED - inwardSpeed));
      if (pull > 0) {
        velocity.addScaledVector(radial, -pull);
        tether.power -= LOADED_POWER_PER_SECOND * poweredTime;
      }
    }
  }

  tether.power = Math.max(0, tether.power);
  tether.taut = distance >= tether.length - EPS;
  return tether;
}

/** Exact squared minimum distance from a segment to an axis-aligned box. */
function segmentBoxDistanceSquared(start, end, center, half) {
  const origins = [start.x - center.x, start.y - center.y, start.z - center.z];
  const directions = [end.x - start.x, end.y - start.y, end.z - start.z];
  const bounds = [half.x, half.y, half.z];
  const cuts = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(directions[axis]) < EPS) continue;
    for (const face of [-bounds[axis], bounds[axis]]) {
      const t = (face - origins[axis]) / directions[axis];
      if (t > 0 && t < 1) cuts.push(t);
    }
  }
  cuts.sort((a, b) => a - b);
  let minimum = Infinity;
  for (let i = 1; i < cuts.length; i++) {
    const low = cuts[i - 1], high = cuts[i], middle = (low + high) / 2;
    let aa = 0, ab = 0, bb = 0;
    for (let axis = 0; axis < 3; axis++) {
      const midValue = origins[axis] + directions[axis] * middle;
      if (Math.abs(midValue) <= bounds[axis]) continue;
      const offset = origins[axis] - Math.sign(midValue) * bounds[axis];
      aa += directions[axis] ** 2;
      ab += offset * directions[axis];
      bb += offset ** 2;
    }
    const t = aa > EPS * EPS ? T.MathUtils.clamp(-ab / aa, low, high) : low;
    minimum = Math.min(minimum, Math.max(0, aa * t * t + 2 * ab * t + bb));
  }
  return minimum;
}

/**
 * The hull is an inner box swept by a .26 m sphere, matching closestSurface.
 * Exact segment distance avoids missing thin crossings and false corner snags.
 * No endpoint exemption: eyelets must actually stand clear of the hull surface.
 */
export function cableClear(anchorPosition, harnessPosition, colliders, clearance = .015) {
  const radius = .26;
  const cableRadius = radius + Math.max(0, clearance);
  for (const collider of colliders) {
    const inner = new T.Vector3(
      Math.max(0, collider.half.x - radius),
      Math.max(0, collider.half.y - radius),
      Math.max(0, collider.half.z - radius));
    if (segmentBoxDistanceSquared(anchorPosition, harnessPosition, collider.center, inner)
        < cableRadius * cableRadius - 1e-10) return false;
  }
  return true;
}
