# Wreck Run

A complete small salvage encounter: 3D ships move on an X/Z plane. Tow the disabled Kestrel to a recovery ring while raiders attack. The wreck is physical cover, but damage lowers its payout.

## Play

- WASD / arrows: thrust; mouse: aim; left click: fire.
- Shift: rechargeable boost. Space: braking thrusters.
- E: detach / reconnect within 38 m. F: change cable length.
- Escape / P: pause. Mouse wheel: camera distance.
- Touch: left stick moves, right stick aims and fires. Dedicated boost, brake, tow and winch buttons. Touch mode can also be enabled in the pause menu.
- Standard gamepad: left stick moves; right stick aims; RT fires; LT boosts; B brakes; A toggles tow; X changes winch length; Menu pauses. Hardware gamepad testing was unavailable.
- Quiet tow uses the same handling and recovery rules without raiders.

Bring both ships inside the cyan recovery ring, attached, for three seconds to complete the run. Your bullets also hit the wreck: fire around its hull. No homing or target assist.

## Systems

- Three.js scene with original procedural ships, damaged hull, asteroid field, distant planet, beacon, lighting, bloom, particles, engine trails and aiming telegraphs.
- D3 radar and responsive HUD. Orthographic camera adapts to screen aspect ratio and follows the tug/cargo pair.
- Fixed 120 Hz planar physics; unilateral damped cable, inverse mass correction, capsule-like wreck collision, swept bullets with nearest-hit ordering.
- Four finite raider encounters, locked aiming telegraphs, salvage payout, win/fail/restart and focus-loss pause.
- Locally synthesized Web Audio engines, boost, cable strain, shots, impacts, explosions and an adaptive ambience bed. Audio starts after a user gesture.
- Automatic Canvas software projection of the same 3D scene when WebGL is unavailable. Full shadows, bloom and nebula shader use WebGL.
- Bundled dependencies. The game itself requires no external content API and can be ported to other static hosting; the current delivery uses Sites.

## Development

Use the existing package manager and lockfile. `pnpm dev`, `pnpm build`. No database, uploads, account features, or external game services.

## Verification for v1

- TypeScript check and production build.
- 720,000 randomized fixed physics steps: positions/velocities remain finite.
- Nearest-hit tests for wreck, tug, obstacles and a near-miss just outside the wreck.
- Quiet straight tow and braking reaches recovery in 72.05 s with 100% hull and cargo.
- Standard straight escape without firing: 3% hull, 85.6% cargo. A simulated clear-line firing policy: 91% hull, 91.35% cargo, four raiders disabled.
- Corrected terminal damage/repair ordering and exclusive win/lose outcomes.
- Browser launch, pause, tow toggle, touch controls and portrait HUD checked in a 390 × 844 viewport.
- Test browser disables WebGL; the software renderer was visually inspected. GPU rendering, physical gamepads and listening on real speakers remain unverified.
- Optional WebMCP status tool is feature-detected; this browser lacks a supported modelContext.
