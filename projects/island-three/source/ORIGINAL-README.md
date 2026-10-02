# Island Three — Daylight Passage

An authored single-page Three.js/D3 environment study of a Universal Century open-type colony, with cinematic aerial and interior camera presets. Open `dist/index.html` in a modern WebGL-capable browser, with internet access for pinned CDN modules.

## Environment and rendering

- 105,051 terrain vertices before the visualization cut, with ridges, shaped riverbanks, reservoirs, curved agricultural parcels and procedural surface variation.
- The default closed model contains 1,942 buildings (including 32 rural homes), 4,751 landscape trees, 192 public-space shade trees and 1,008 streetlights. Candidate seeds remain fixed when the cut changes. Agricultural parcels and their access routes are planned against the complete physical landscape before visualization cuts.
- Shared architectural recipes generate 31,183 building parts throughout all districts: beveled volumes, tower setbacks and podiums, apartment balconies, retaining foundations, parapets, entrances, canopies, roof panels and equipment. Garden neighborhoods retain pitched roofs; campuses add skylights. Detail does not depend on a selected viewpoint or demonstration block.
- Twelve settlement plans coordinate their river-following streets, plot orientation, density, town extent, waterfront furniture and vegetation exclusions. Crossing towns remain aligned with the six window bridges. The three land bands have different bay widths, terrain colors, woodland density and ridge profiles, including a drier terraced landscape. These are landscape designs within a shared atmosphere, not separately simulated climates.
- Twenty-four reserved public spaces include planted squares, gardens, market shelters and campus courts. Ninety-seven non-overlapping agricultural parcels have access lanes meeting the outer avenues. Roads avoid cultivated parcels; complete rotated building plots avoid roads, water and reserved squares. Steep sites remain open, and modest retaining plinths seat buildings above the sampled terrain. River bridge decks follow the cylinder and meet the waterfront road elevations.
- Facades use coordinated glass/solid roughness, framed window masks, derivative-based recess and sill normals, varied room illumination, floor joints and distance filtering. Terrain-following contact-darkening patches are a restrained artistic occlusion approximation, not a simulated light bounce.
- Roads follow the cylindrical terrain, with dashed painted markings, sidewalks, collector streets and pedestrian paths between blocks. Cross streets now reach the waterfront walks. Trees avoid the road and path corridors and cultivated plots. Bridges connect the riverbanks, and beveled modeled beams frame the glazed daylight sectors.
- Six curved, cable-stayed window crossings connect the outer roads of neighboring land bands. Each includes shallow terrain approaches, pedestrian promenades, inward-pointing pylons, framing, lights and moving cars and shuttles. The closed model has 84 vehicles; geometry and traffic respect the visualization cut. These crossings illustrate a possible circulation system, not a validated structural design.
- Procedural concrete, metal, roof, paving and asphalt finishes couple seams, surface relief and roughness with distance filtering. Sloped terrain gains rock strata; cultivated parcels gain finer crop rows. Broadleaf trees have irregular layered crowns, while evergreens use tiered conical crowns with shared leaf shading.
- Stable procedural finish age adds mottling and warm discoloration to hard surfaces, vertical staining with per-building age on facades, worn lane paint, subtle tire tracks and darker, less rough banks. The material upgrade adds shader arithmetic within existing passes, with no external textures, new render targets or additional lighting passes. Its GPU cost has not been profiled.
- Reflective water uses cylindrical-coordinate wave normals and a constant radial level. Soft cloud sprites, distance haze and a quiet vignette establish depth.
- Each of the three reflected solar sources has a broad 1024 × 4096 shadow map and a camera-following 2048 × 2048 local map. The local maps span 1.024 km, resolving 0.5 metres per texel, with texel-snapped light-space origins and a smooth 282–410 metre range blend. Radiance is split between the ranges, not doubled. Broad coverage and caster depth are fitted to the full physical cylinder at each reflected direction. PCF filtering uses a supported radius, and local normal bias is reduced to about 12 cm. High quality uses the same 25,165,824 total shadow-map texels as the previous three-map setup; this does not imply identical GPU cost.
- Restrained, half-resolution GTAO adds screen-space contact shading with edge-aware denoising. Transparent glazing, particles and light pools are excluded from its solid-geometry prepass, and hidden objects remain hidden afterward. The artistic ground-contact patches remain as broad grounding cues. GTAO is not global illumination and cannot see off-screen occluders.
- Standard materials gain finite-cylinder air-path attenuation and normal-dependent low-energy indirect fill. Atmospheric extinction is evaluated in linear HDR, before tone mapping. Rays outside the pressure cylinder do not accumulate haze; the presentation cut does not remove the implied atmosphere. This is an analytic cinematic approximation, not volumetric multiple scattering or ray-marched god rays.
- Half-float multisampled post-processing, ACES tone mapping and restrained bloom remain. A paused scene can accumulate 32 jittered samples to refine fine geometry edges. Accumulation resets when the camera, time, geometry or quality changes; active day/night playback is never silently paused. The renderer stops drawing after refinement finishes.
- Urban waterfronts throughout all three land bands have retaining edges, 9,224 railing members, benches, planters, 72 shelters and 1,512 stationary people for scale. Waterfront detail follows each town's actual extent. Lamp posts and light pools meet their paved surfaces. Both endcaps gain physical radial ribs, ring beams and service bays; the near cap's details hide with the cap when cut away.
- Trees, architecture, railings and street furniture use instancing. Compatible static surfaces are merged after generation. The closed habitat's static instance batches are partitioned into 418 spatial cells with independent camera/shadow-frustum culling. Projected-size detail levels simplify distant bevels and tree crowns; subpixel secondary details disappear with hysteresis. Instance colors and procedural facade attributes are preserved at both detail levels. Animated vehicle buffers remain intact, and their bodies cast moving shadows.
- The source model contains 81,662 instances and 5.33 million fully expanded triangles. At 1080 render pixels in height, detail selection lowers the expanded triangle budget to 1.78 million at Surface, 1.69 million at Bridge and approximately 1.58–1.76 million at the other authored camera positions, before frustum culling or shadow-pass repetition. These are numerical geometry budgets, not measured frame rates. Extra shadow ranges and AO add passes; target-browser profiling is still needed.
- Shadow maps are cached when geometry, casters, light direction and shadow coverage remain unchanged. Solar shadow rendering is suppressed in full habitat night. The upgrade uses GTAOPass and TAARenderPass from the existing pinned Three.js r180 CDN package; it adds no server component, external texture dependency or framework migration.

## Solar model

The cylinder axis points toward the Sun. Three planar mirror wings redirect approximately parallel solar rays through the longitudinal windows. Mirror normals follow the reflection law; each wing spans the cylinder's axial length. The habitat day is a separate 24-hour program, independent of the rotation that produces gravity.

Every direct reflected contribution traces its path back to the complete physical cylinder and is admitted only through the matching window, between the endcaps. This mask does not use the visualization cut angle. Building, terrain and frame shadows are then applied. The external axial Sun is excluded from interior surfaces, including the inner faces of the endcaps.

The clock controls shutter aperture and daylight intensity, with a modest axial change in the reflected direction during morning and evening. Noon is nearly neutral white. Artificial lights appear as the shutters close; haze, cloud brightness, glass emission, road markings and environment reflections dim with the daylight. Normal night retains a restrained cool indirect fill and dim environment reflections for orientation, with inhabited areas picked out by windows, streetlights and vehicle lights. This is a cinematic approximation of distributed artificial light and its bounce, not literal moonlight. Direct solar illumination is zero and the shutters are closed at midnight; the external Sun remains on.

This is an optical geometry model with a cinematic interpretation of indirect light. It does not calculate solar irradiance in lux, multiple light bounces, atmospheric radiative transfer, mirror thermal behavior, or a complete optical control system. Street-light pools and clouds are rendered approximations; water uses an environment reflection map, not reflections traced against the surrounding city. Browser/GPU visual quality and performance have not yet been tested.

## Coordinate model

- Longitudinal axis: world X.
- Circumferential position: `(x, r cos(theta), r sin(theta))`.
- Terrain height reduces radius; local up points inward, toward the axis.
- Render radius 5 and length 56.25 correspond exactly to 3.2 km and 36 km.
- Three land bands alternate with three glazed window bands. Four degrees per nominal 60-degree sector are reserved for framing.
- The removed wedge is a visualization cut, not a mechanical opening.
- Terrain, settlements, trees, shielding thickness and mirror rigging are illustrative, not a structural design or population simulation.

## Controls

Drag to orbit; wheel/pinch to zoom. Choose Vista, Cutaway, Surface, Axis, Bridge or Section. Keys 0–4 retain their original views; key 5 selects Bridge. The scene opens at Surface with the shell closed, scene motion off and the day/night cycle running. Reset restores the current authored view. The control rail starts hidden; Controls reveals it. Labels and motion can be toggled on larger screens. Reduced-motion CSS suppresses interface animations.

The cutaway slider spans 0–160°. Zero closes both the shell and the near endcap; Vista, Surface, Axis and Bridge remain inside. Surface places the camera about 15 metres above the quay. Bridge places the eye about 1.7 metres above a window-crossing promenade, looking along its curve. Cutaway and Section remain external views and therefore show the cap when the shell is closed.

Click the clock to open Habitat time. Scrub the 24-hour slider, select Dawn / Day / Dusk / Night, or pause/resume the cycle at one day per three minutes. Playback starts automatically at noon and is independent of the Motion toggle. Choosing a preset or scrubbing pauses playback. All cutaway and daylight controls remain available on small screens.

Rendering quality defaults to High. Balanced reduces local maps to 1024 × 1024, broad maps to 1024 × 2048, AO to 40% of rendering width/height and display resolution to at most 1.25 device pixels per CSS pixel, with earlier detail simplification. High retains the 1.6 display cap. Refine still explicitly pauses both time and motion, then accumulates 32 samples after the camera settles; resume time or motion through their existing controls. Surface/Bridge near clipping is approximately 0.51 metres so nearby pedestrian-scale geometry is not clipped by the old 2.56-metre near plane.

When labels are enabled, the D3 end-on inset shows the actual cut angle and the camera's projected radial location. Orange arrows in the 3D scene indicate local down. The cylinder stays fixed in its rotating reference frame.

## Sharing

The published Site is available to anyone with its URL. Its HTML includes a `noindex, nofollow` robots directive, with crawling left allowed so search engines can read it. This requests exclusion from search results; it is not access control and cannot guarantee compliance by every crawler.

## Validation

Checks use the actual pinned Three.js r180 classes and scene builders. At 0°, 1°, 108° and 160°, generated geometry attributes, indices and instance matrices are finite and valid, and the near cap appears only when closed. Every Standard material retains the composed shader hooks and required solar/shutter/night uniforms. At midnight, dawn, noon and dusk, mirror normals obey the reflection law and all sampled shell points fit inside each shadow frustum. Additional checks cover 480 clock samples, 14,400 angular shell-coverage samples, inward cap/shell exclusion of the external Sun, and the surface-camera clearance. Earlier cylinder, water-radius and placement checks remain applicable.

For the current rendering upgrade, 24 distinct generated Standard/Basic material program variants are checked with the actual Three r180 program-generation functions, instancing, vertex colors, environment reflections, seven directional-light entries, six shadow maps and the composed material hooks. Additional checks compile the five AO/denoising/blend/temporal-copy shader variants, exercise AO visibility restoration and quality resizing, and verify both temporal render targets resize and reset their accumulation. Shader compilation uses a surfaceless Mesa OpenGL ES 3.2 context; it does not validate rendered appearance, browser interaction, mobile driver compatibility or frame rate. No browser visual or performance test was performed.

`scripts/verify-premium.mjs` is a repeatable non-browser scene check. Run it with a local copy of the pinned Three r180 module: `node scripts/verify-premium.mjs /absolute/path/to/three.module.mjs`. It verifies defaults, 0°/1°/108°/160° rebuilds, finite instance data, custom attributes on both detail levels, animated-buffer ownership, geometry budgets, 23,328 broad-shadow coverage samples across clock/camera combinations, the local range blend, matched source directions, half-metre texel scale, stable sub-texel origins, idle shadow caching and the unchanged High shadow texel budget.

The settlement checks cover 17,478 samples across the complete rotated building plot envelopes, checking water, roads, public-space exclusions and terrain clearance. Every farm access lane is sampled for water clearance. The earlier crossing checks additionally cover road/deck interpolation at all window-crossing landings (zero mismatch), maximum sampled approach grade (2.23%), deck triangle centers against the cut, and 40,992 traffic matrices per cut over 60 simulated seconds at 0°, 108° and 160°. Vehicle matrices stay finite and their local up follows the cylinder inward. Midnight indirect illumination remains below dusk while solar illumination and shutter aperture stay zero. These are numerical scene checks, not browser appearance or structural engineering validation.

## References

- [Gundam ZZ environment development and Shigemi Ikeda's settlement art](https://www.gundamunofficial.com/production/gundamzz.html)
- [Gundam F91 city and colony setting art](https://www.gundamunofficial.com/production/gundamf91.html)
- [Texas Colony's landscape and local identity in THE ORIGIN](https://www.gundam-the-origin.net/world/kouza24.html)
- [NASA / Don Davis / Rick Guidice Island Three paintings](https://nss.org/o-neill-cylinder-space-settlement/)
- [Official Gundam THE ORIGIN colony specification](https://www.gundam-the-origin.net/en/world/orientation03.html)
- [O'Neill's original space-colonization article](https://nss.org/the-colonization-of-space-gerard-k-o-neill-physics-today-1974/)
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)
- [Three.js post-processing](https://threejs.org/manual/en/post-processing.html)
- [Three.js shadows](https://threejs.org/manual/en/shadows.html)
