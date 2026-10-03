# Hullwalker — EVA

A standalone Three.js magnetic-boots traversal demo, September 29, 2026.

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

## Validation

Simulation tested using actual Three math and hull geometry at 25/30/60/144 Hz: the guided route completes both launches and latches, side traversal, and all three objectives. Manual WASD and full hull circuits preserve contact to within 0.035m. Actual browser interaction checked through the compatibility renderer; accelerated WebGL could not be visually inspected in the test browser because it exposes no WebGL context. Physical touch/gamepad devices were not available. WebMCP was unavailable in the test browser; the optional tools are feature-detected.

## September 29 update

Soft tapered pressure trousers replace the long rigid leg plates. Hip/knee/ankle motion uses two-bone foot placement, smaller grounded steps, and a relaxed free-drift pose. Footfalls trigger on stance transitions. Opposite thruster plumes distinguish hullward thrust.

Hullward RCS applies acceleration toward the nearest point on the last walked hull, cancels lateral drift gently, and uses the normal magnetic latch. It works above, beside and beneath either craft; it is separate from instant recall. Release, pointer cancellation and pause clear the hold.

Validation: full guided route and existing walking checks passed; focused hullward return checks passed on four surfaces at 30 and 144 Hz, including immediate return, release/coasting, LT, pointer cancel and pause. Audio scheduling/lifecycle API checks passed. Compatibility renderer visually checked; this test browser still cannot provide WebGL. Audio mix was not listening-verified; physical touch/gamepad devices were unavailable.

## Attention and locomotion update

EVA facing now follows deliberate movement and camera look, with helmet/chest anticipation and a smoothly limited body turn. Facing remains independent of the control reference and flight velocity; 180-degree reversals use a stable turning direction. Vertical camera attention persists in flight.

Walking uses world-space boot contacts, alternating projected footsteps, touchdown prediction/retargeting, 3D leg IK, turn-in-place steps, supporting-leg weight shift, and opposing arm balance. Ground acceleration and stopping are smoothed; walk is 1.5 m/s and faster movement 2.8 m/s. Feet settle after stopping instead of instantly resetting a periodic pose.

Validation: gaze/turn math, EVA strafe/reversal, camera independence, unchanged free-drift momentum, hullward RCS and the full guided route pass. Planted rendered boot transforms checked through walking, fast movement, stops and 180-degree turns; gaze yaw/pitch signs checked on the articulated model. Browser compatibility graphics checked, without WebGL or subjective full-speed motion verification on a hardware-accelerated device.
