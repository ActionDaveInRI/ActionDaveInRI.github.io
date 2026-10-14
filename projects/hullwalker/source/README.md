# Hullwalker — EVA

A standalone Three.js magnetic-boots traversal demo, updated October 10, 2026.

Walk any face of the Morrow's hull, hold/release Space to push off toward the visible landing marker, use RCS to steer and brake, and auto-latch to another hull. Restore the dorsal power bus and relay-side uplink, then return to the airlock. A guided EVA demonstrates the complete loop; movement takes over immediately.

Controls: WASD movement; mouse drag view; Space hold/release push; Shift sprint/brake; hold C / on-screen RCS TO HULL / gamepad LT to thrust back toward the last walked hull; E service; R safe recall; Escape pause. Touch joystick/look/actions and standard gamepad controls are included. High/Lite graphics. A Canvas software fallback runs where WebGL is unavailable.

## Run

`npm run dev` serves the tracked `dist/` directory. Production is entirely static: no external CDN, account API, data persistence, or downloads at runtime. Three.js is vendored with its MIT license.

## Reuse and provenance

- Wayfarer `scene-kit.js`: beveled geometry, material cache, pipes, and static batching; from ActionDaveInRI/spaceship main tree f0b175fd225b15d27f1fe922a8f63e6aece0271e, retrieved September 29, 2026.
- Wreck Run `audio.mjs`: synthesis/voice/envelope foundations from the same snapshot. Reworked into `EVAAudio`: helmet breathing and ventilation, attached hull vibration, synchronized varied bootfalls, detach/latch, control-driven RCS/valves, and brief service cues. Sound is enabled by default and starts on the first pointer/key gesture; explicit mute remains respected.
- Wayfarer `software-renderer.js`: depth-buffered CPU fallback, recovered September 28 release in the local source archive.
- Three.js and postprocessing: vendored from the user's Island Three release, with upstream LICENSE.
- New: articulated astronaut, EVA controller, rounded hull contact, launch/latch logic, mission, procedural plating/planet, UI and guided route.

## Original release validation

Simulation tested using actual Three math and hull geometry at 25/30/60/144 Hz: the guided route completes both launches and latches, side traversal, and all three objectives. Manual WASD and full hull circuits preserve contact to within 0.035m. Actual browser interaction checked through the compatibility renderer; accelerated WebGL could not be visually inspected in the test browser because it exposes no WebGL context. Physical touch/gamepad devices were not available. WebMCP was unavailable in the test browser; the optional tools are feature-detected.

## September 29 update

Soft tapered pressure trousers replace the long rigid leg plates. Hip/knee/ankle motion uses two-bone foot placement, smaller grounded steps, and a relaxed free-drift pose. Footfalls trigger on stance transitions. Opposite thruster plumes distinguish hullward thrust.

Hullward RCS applies acceleration toward the nearest point on the last walked hull, cancels lateral drift gently, and uses the normal magnetic latch. It works above, beside and beneath either craft; it is separate from instant recall. Release, pointer cancellation and pause clear the hold.

Validation: full guided route and existing walking checks passed; focused hullward return checks passed on four surfaces at 30 and 144 Hz, including immediate return, release/coasting, LT, pointer cancel and pause. Audio scheduling/lifecycle API checks passed. Compatibility renderer visually checked; this test browser still cannot provide WebGL. Audio mix was not listening-verified; physical touch/gamepad devices were unavailable.

## Attention and locomotion update

EVA facing now follows deliberate movement and camera look, with helmet/chest anticipation and a smoothly limited body turn. Facing remains independent of the control reference and flight velocity; 180-degree reversals use a stable turning direction. Vertical camera attention persists in flight.

Walking uses world-space boot contacts, alternating projected footsteps, touchdown prediction/retargeting, 3D leg IK, turn-in-place steps, supporting-leg weight shift, and opposing arm balance. Ground acceleration and stopping are smoothed; walk is 1.5 m/s and faster movement 2.8 m/s. Feet settle after stopping instead of instantly resetting a periodic pose.

Validation: gaze/turn math, EVA strafe/reversal, camera independence, unchanged free-drift momentum, hullward RCS and the full guided route pass. Planted rendered boot transforms checked through walking, fast movement, stops and 180-degree turns; gaze yaw/pitch signs checked on the articulated model. Browser compatibility graphics checked, without WebGL or subjective full-speed motion verification on a hardware-accelerated device.


## October 10 — tether trial and touchdown

Choose **TRY THE TETHER** to spawn at the starboard edge, already clipped to A1. Hold/release Space to push into an arc, G to release without changing velocity, and hold C to return to magnetic contact. R restarts this practice setup. The original mission and guided EVA remain available from the opening screen.

- G / gamepad RB: clip to the nearest visible anchor within 14 m, or release.
- Z / LB: hold to reel in. X / RT: hold to pay out. Both have on-screen hold buttons.
- Four raised eyelets provide clear anchor positions on the main hull and relay.
- The HUD shows cable length, slack/taut/snared state and remaining winch power. The spool holds 2–28 m; reset restores power.
- Cable motion uses a unilateral distance constraint, with bounded powered winching and physics substeps up to 120 Hz. A catch removes outward velocity, keeps its tangent, and release preserves the complete remaining velocity.
- The first cable is straight, without wrapping around obstacles. Obstructed anchor connections are rejected; a snag stops the movement at its last clear position. Releasing or steering clear recovers control. Decorative ship geometry is not a physical collider; cable clearance uses the same rounded main hull volumes as EVA movement.
- Magnetic contact captures inward normal speed before stopping the body. Planted-foot IK bends the knees and lowers the hips in proportion to impact, with chest/arm balance and slower recovery. A sideways skim does not cause an exaggerated crouch.

Run the repeatable checks with `node --test tests/*.test.mjs`. The numerical tests cover tether constraints and power, cable visibility, complete trial traversal, and the actual articulated landing rig. They do not assess subjective camera/play feel, graphics or real touch/gamepad hardware. No browser-control surface was available for this update, so browser visual QA remains to be done on the playable build.

## October 14 — Boarding action

The primary entry is now **RETAKE THE AIRLOCK**, a single-player combat encounter.
Three boarding suits patrol and reposition through the upper hull, sidewalls,
underside, and a sheared service pod. The raider makes physical EVA transfers.
Clear the squad, then reach the hatch with magnetic boots attached and press E.
Tether practice, the original repair mission, and guided EVA remain selectable.

### Combat controls

- WASD: walk / directional RCS; Shift: run / brake.
- Mouse: free look when captured. Without capture, left/right drag looks only.
  LMB fires only while captured. Hold F or FIRE to shoot in either mode.
  MOUSE LOOK explicitly requests capture; starting or acquiring control never fires.
- RMB: focused aim. Q: reload. A magazine holds 24 rounds; reserve is unlimited.
- Space: hold/release push-off when attached; hold to thrust upward in flight.
- Ctrl: downward RCS. C: thrust back toward the last hull.
- G: clip/release; Z/X: reel in/pay out. Look toward an eyelet to prioritize it.
- E: secure the cleared airlock. R: restart encounter. Escape: pause.
- Touch: left movement stick, canvas drag to look, FIRE hold, FOCUS toggle,
  RELOAD, PUSH OFF, BRAKE, UP/DOWN and hull-return controls. Expand the tether
  drawer for reels. Cancellation, blur and pause clear held inputs.
- Gamepad: sticks move/look; RT fire; LT focus; A push/up; B brake; X reload;
  Y interact; LB hull return; RB tether; D-pad left/right reel, down thrust down.
  Start pauses/resumes. Gamepad gameplay input is frozen while paused.

The rifle uses a camera target followed by a separate muzzle trace, so seeing
around cover does not allow shooting through it. Enemy rounds are swept physical
projectiles with a visible aim warning and burst gaps. Suit integrity recovers
five seconds after the last hit. Cover geometry blocks both movement and shots.
The camera has a hull collision sweep, with closer shoulder framing for focus.
Weapon, impact and reload sounds are synthesized locally.

Character work adds an actual rifle, two-handed wrist/grip IK, a shouldered
stance, distributed recoil and hit response, more responsive airborne limbs,
and armed foot placement for strafing/backpedaling. It also fixes pre-existing
side-step foot sliding. Enemy suits use reduced geometry and material batches.

### Release verification and limits

`node --test tests/*.test.mjs` exercises actual production geometry, rig transforms,
physics and entry-point event wiring (browser rendering/audio are mocked). Tests
cover cover occlusion at the muzzle, reload/death/restart, physical enemy routes,
projectile damage, touch/pause/gamepad input lifecycle, combat collision, tether
regressions, grip contact and planted feet on multiple hull orientations.

Actual production meshes and the combat camera were also inspected through
an offline CPU render. This does not verify hardware-accelerated WebGL, audible
mix, real browser layout, phone/gamepad hardware, frame rate or subjective combat
feel. No browser-control surface was available for this release.

### October 14 camera-control correction

Uncaptured mouse dragging is now camera-only. This fixes the fallback path that
previously fired while trying to look around. F provides an independent trigger,
and the MOUSE LOOK button enables standard free-mouse/LMB controls when the
browser permits capture. HUD hints reflect the actual capture state.

### October 14 phone sightline correction

Starting or retrying combat no longer shows the boarding announcement or the
inherited EVA toast. On phone-sized screens the duplicate mission heading is
hidden; health, ammunition and boarders remain in a compact strip near the top.
After the last boarder, that strip says **SECURE AIRLOCK**. Other combat notices
use a single-line, touch-through slot above it and clear within 2.2 seconds.
Portrait and landscape positions respect the top safe area. The briefing
remains on the opening screen, and controls remain in Pause.
