# Wayfarer — A Small Ship

A small playable freighter prototype built from the Bramblewild / Last Light character locomotion work. A working ship and crew, two explorable ports, two boardable visiting ships, a delivery, an optional rescue job and a playable payroll robbery bounty. No backend or external game assets are required.

## Play

Start with **Start a freight shift**: the ship, crew and paid delivery establish the voyage. After receiving payment at Relay Nine, an optional HUD lead sends you to Nell in the commons. Accept nearby with E; you stay where you are, with your weapon holstered if it was already holstered. The payroll gang escaped Cinder and is hiding behind ordinary stored cargo. A quiet close threat can subdue an isolated suspect. Gunfire or a witnessed confrontation alerts the gang and sends Wren running through the habitat link toward the hangar skiff. You can first lock its mooring controls to prevent escape. Kite and the survey rescue remain separate.

E near a surrendered suspect approaches and cuffs in one interruptible action. Manual movement, another walking destination or firing cancels it. Three stun hits force surrender; real cover blocks shots and threats. Suit charge returns after five seconds without damage. The optional bounty does not block boarding or launching.
Captures pay 150 credits each, with a 150-credit clean-sweep bonus. Payout settles when all three are captured or escaped. Replays pay only an improvement over the best previous result. Suit failure offers a free retry preserving freight, credits and ship health. Leave bounty returns to the normal voyage. The training range is now east of Morrow and listed on the local chart.

Start at Cinder Quay, a coastal settlement on an arid volcanic world. The context action walks to the terminal; use it again to accept the job. Iona carries four crates up the rear ramp. Walk to the cockpit, take the helm and launch. Follow the coastal corridor into orbit, fly to Relay Nine, brake inside its docking ring, then walk to the freight terminal to deliver. Delivery pays once. The ship remains playable afterwards, including a return flight, harbor approach and paid refits.

The local chart routes you on foot to landmarks. At Cinder, visit the waterfront, stores and Morrow: a 56 × 16 m supply carrier with larger side engines, a tall cargo hold, workshop and ship services below. Physical stairs lead to a mess, two separate twin cabins, washroom, stores, crew corridor and bridge; a side gallery overlooks the hold. Relay Nine is a pressurized asteroid base with a freight hangar, commons and survey tunnel. Board the maintenance tender Kite and talk to Mara for a short job: restore the spur breaker, escort Jun back through the base and collect 180 credits and a spare. Both vessels have their own interior layouts and residents.

- WASD: walk / directional thrust. Mouse: aim.
- H / R3 / sidearm button: draw or holster. Start holstered; a fire press draws before shooting. Holstering cancels a queued shot and waits for held fire controls to be released.
- Left mouse: Kestrel blaster / twin pulse guns. Right mouse: walk to point on foot / guided missile in flight.
- E: displayed interaction. F: walk to cockpit / leave helm.
- Shift: sprint / boost. Space: brake. R: reload sidearm.
- Q: call Bex for repairs; one spare restores 45 hull and engine health after six seconds.
- C: toggle crew coursekeeping. Escape: pause and controls.
- Tab / gamepad L3: open the local walking chart while docked and on foot.
- Scroll, pinch or use + / − to zoom from character detail to a harbor overview; View resets zoom and orbit. [ / ] or middle-drag rotates the camera; gamepad D-pad left/right and the orbit buttons do the same. Movement follows camera orientation. Camera preferences persist.
- Touch: left stick movement, right stick quiet aim; hold and drag FIRE with the right thumb to aim and shoot while the left thumb moves. Context buttons remain available. Tap floor to walk. Controls can be shown manually in the pause menu.
- Pinch the playfield to zoom. Sprint also works while following a walking destination.
- Standard gamepad: left stick move, right stick aim, RT fire, RB missile, LT boost, A interact, B brake, X reload, Y leave helm, D-pad down repair / up course, Start pause.

Progress is stored in localStorage on this browser. New voyage has an in-game confirmation. Disabled ships can call a tow without losing the shipment.

Sound starts after a play interaction. The pause menu includes master, engine, ambience and effect levels, plus an eleven-second engine sound check. Audio preferences persist separately from voyage saves. Mute, pause, window blur and backgrounding fade the output immediately.

## Ship feel and sound

The two engines have distinct synthesized voices: a low port-side throb and a brighter starboard turbine. Pitch, breath, vibration and exhaust respond to acceleration, thrust demand, braking, boost, heat and engine condition. Spool-up is quicker than wind-down. Directional maneuvering jets follow actual acceleration and rotation. Boost needs thrust, yields to braking, and has thermal hysteresis so it cannot chatter at the temperature limit.

Walking aboard changes the sound to filtered machinery and hull vibration, with more engine presence near engineering. Quiet ventilation, port machinery, deck/grit footsteps, cargo thuds, ramp motors, reload mechanisms, repair tools and coolant rattles provide ambient and responsive detail. Shield strikes, hull impacts, pulse guns and missiles have separate sounds; nearby events are panned and distant events attenuated. Critical impacts briefly lower engine volume.

Surf grows nearer the shoreline, atmospheric flight adds wind, and the visiting ships have quieter auxiliary machinery. Water uses shallow/deep surfaces, shoreline detail and moving ripples. The harbor geometry stays the same on foot and during departure or arrival. Surface flight has assisted altitude and safes the guns; orbital combat retains pulse guns and guided missiles.

The visual pass adds warm and cool cabin lighting, soft contact shadows, engine collars, responsive exhaust and maneuvering jets, a moving ramp, weapon recoil and impact response. Camera framing is closer on foot, looks ahead gently in flight, and retains separate zoom settings for the two views. Nearby bulkheads lower to keep the character visible.

## Implementation

### Shared character wardrobe

The cast now uses five garment cuts on the existing 19-bone family: a cropped flight jacket, boxier work jacket, rolled-sleeve cargo shirt with front/over-shoulder/back harness, longer notched coat, and field vest over a contrasting shirt. Garment fit is separate from anatomy; `appearance.outfit` can select a cut independently. Raised pocket sidewalls, folded collar/lapel edges, a visible underlayer, sparse waist/elbow folds and asymmetric workwear details carry through both mesh detail levels. The coat has an intermediate skirt ring and thigh-blended lower panels for sitting and kneeling; this is authored skinning, not cloth simulation.

`human-workwear.js` adds garment-specific trouser volume, knee/cargo panels, broad ankle folds and boots with flat soles, welts and shaped toe boxes. `human-head.js` strengthens jaw/chin/cheek and nose forms, supports explicit eye spacing/tilt and brow shape, and preserves six distinct hair silhouettes. Children retain softer facial relief. Rig landmarks, limb lengths, grips, holsters, gait and world contacts are unchanged.

For cast-wide visual checks, temporarily copy `tests/wardrobe-review.html` to `public/wardrobe-review.html`. It exposes front/side/back, both LODs and standing/sitting/kneeling/counter/carrying/aiming states using the production rig. Remove temporary review pages before publishing. These software-rendered views inspect geometry and pose clearance, not GPU material fidelity or native-device performance.

### Environmental poses

The first six environmental pose families are live in ordinary routines. Bex alternates machinery inspection, a table rest, pacing and shoulder rests aboard Wayfarer. Oren uses Morrow's bridge consoles, lookout and seating. Edda and Hal rest at their market counters; Leena and Tomas sit on the square's benches. Bex and Oren tuck their arms while making room when the player crowds their passage. Merely observing an established pose from nearby does not interrupt it.

`environment-contact.js` discovers opportunities from registered object faces and checks height, facing, support and clearance. `environment-pose.js` fits adult hips, hands and ankles to those surfaces; kneeling includes a folded rear boot and room for the supporting leg. These are six families from the proposed 24-pose library, not 24 implemented actions. Children retain their existing routines. Machinery is still excluded from generic resting/climbing; only Bex's docked inspection routine treats the service face as a work opportunity.

Ambient poses never own player controls. Upright poses release with a short local blend; seated/kneeling NPCs stand before their next errand. Cargo, weapons, repairs, explicit interactions and scene changes take priority. Transient poses are discarded when saving, preserving existing voyage and mission state. No new lean prompts are added. The shared rig also suppresses unused NPC holsters, weapons and cuffs explicitly, fixing stray equipment visible during close pose inspection.

For a temporary visual inspection page, copy `tests/pose-review.html` to `public/pose-review.html` and remove it before publication. Run `node tests/environment-poses.mjs` for six families across all adult profiles, reachable limb targets, real routine use, seated release, passage yielding and save cleanup. The visual review uses the game rig and renderer; the available browser preview uses the software fallback and does not establish native GPU performance.

`public/game/engine.js` is a deterministic fixed-step simulation, independent of rendering. Ship, cargo, crew, damage and weapons retain their state across camera changes. Grid navigation shares deck and fixture collision. New cargo causes blocked actors to re-plan. Projectile collisions are swept along the segment and choose the nearest hit. Guns originate at the actual barrel positions and follow the vessel's bounded turn rate. Missiles have finite ammunition and a forward acquisition cone. The copilot uses a visibility graph to steer around asteroids. Drones telegraph attacks; a projected lead marker helps aim pulse fire. Shield recovery, boost heat, physical engineer repairs and paid refits provide recovery choices.

`world.js` holds location, vessel, support surface and per-deck collision data independently of drawing. Navigation carries a deck level and changes it only through stairs. Orbital coordinates and coastal flight coordinates remain separate. Existing version-one and version-two voyage saves migrate to version three, including Morrow’s relocated captain; obstructed old positions move to the nearest safe surface.

`robbery.js` owns the bounty AI, surrender, capture, suit health and replay-safe rewards; `robbery-scene.js` shares pay-office scenery, Relay cover and encounter landmarks between collision and rendering. `tests/robbery.mjs` exercises the real simulation, including thin-wall muzzle obstruction and a full approach-and-cuff path.

`render.js`, `world-view.js`, `vessel-view.js` and `scene-kit.js` build procedural Three.js geometry, interiors, water and camera-aware cutaways. Furniture uses bevelled profiles and separate paint, metal, cloth, rubber, floor and glazing finishes. Static port meshes are combined by material and visibility group; small details and labels drop away in distant views. `crew-model.js` uses a shared 19-bone adult-human rig with collarbones and a head pivot at the skull base. `human-profiles.js` defines distinct shoulder, ribcage, waist, pelvis, arm and facial proportions independently of skin color and clothing. This first family keeps common limb lengths and stature; different species or skeleton layouts are future families. `human-jacket.js` joins torso and sleeves at shared armhole vertices, with spatial shoulder weights. `human-head.js` joins neck, jaw and skull, with integrated nose/lip forms and eyelid rims around inset eyes. Hair and fitted pockets/harnesses remain separate layers. Bex’s utility jacket, Iona’s harness and Oren’s longer coat create distinct silhouettes. Two cached body detail levels share animation and weights. Body facing, aim twist, hand grips, visible belt holster, drawing, breathing, cargo and repair poses share the same planted-foot gait. `gait.js` retains planted-foot / two-bone IK locomotion, with speed-dependent walk/jog/sprint timing, shorter directional steps, support-driven hip correction and continuous Hermite replanning on reversals. A fast bounded weapon turn buffers a tap until the barrel is aligned (a full reversal takes about 0.1 seconds). Gait now advances at the simulation rate rather than the render rate, and feet sample the actual stair treads. Foot contacts trigger footsteps. A shared geometry software renderer is available when WebGL cannot initialize, with cached static world geometry, near-plane clipping, smooth skinned vertex shading, approximate lighting/materials and alpha blending. `audio.js` uses persistent Web Audio engine and ambience graphs, bounded transient voices and independent mix buses. `main.js` handles inputs, the HUD, audio, saves and optional WebMCP registration. WebMCP is feature-detected; the available cloud preview did not expose a supported modelContext, so live tool validation was unavailable.

## Verification

Run `node tests/voyage.mjs` for the full simulated voyage, cargo loading during movement, boarding, launch, repair costs, collision sweep, braking, live hostile crossing, docking, unloading, payout, save restoration, return navigation and combat.

Run `node tests/world.mjs` for coastal boundaries, named walking routes, both visiting ships, stairs in both directions, deck-separated collision, upper-deck saves, the physical rescue route and one-time reward, and legacy save migration.

Run `node tests/rendering.mjs` for near-plane clipping and close-camera ground coverage.

Run `node tests/characters.mjs` for both skin detail levels, deformation bounds, muzzle alignment and holster/deck pose consistency.

Run `node tests/human-topology.mjs` for connected head/neck and torso/sleeve shells, manifold edges, clean boundaries and normalized weights in every profile and detail level. Run `node tests/human-motion.mjs` for rigid limb lengths, neck support, grip reach and skin deformation through draw, aim, reload, walk, sprint, carry and repair.

Run `node tests/locomotion.mjs` for planted-foot locking, bounded swing motion and repeated-direction-change recovery.

Run `node tests/holster.mjs` for draw timing, queued shots, cancellation, held-trigger suppression, movement facing, reload, migration and ship weapon independence.

Run `node tests/audio.mjs` for audio graph allocation, finite parameter scheduling, immediate mute/fade, transient cleanup, fatal-impact tails, interior bounds, audition reset, engine spool/boost behavior and path sprinting. This uses a scheduling harness, not an acoustic listening test.

Desktop and narrow-screen layouts are checked through the managed preview, including actual browser AudioContext startup and engine audition controls. Hardware gamepad, real touch-device feel and speaker/headphone balance require physical-device testing. The cloud preview exercises the software rendering fallback; native WebGL uses the same scene and camera.

This is a small prototype: orbital flight on a plane rendered in 3D, a bounded coastal flight area with assisted altitude, authored ports/interiors, two jobs, simple drone AI and synthesized audio. It does not include a galaxy economy, moving NPC vessels, boarding combat, swimming, multiplayer or a full six-axis flight model. The simulation, surface support, actor presentation and audio boundaries leave room for later graphics and locomotion work without changing the route or mission rules.
