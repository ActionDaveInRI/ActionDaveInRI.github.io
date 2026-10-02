# Star Cluster to Planet Tile

A client-side WebGL explorer with travel from a star cluster to systems, worlds,
and generated planetary terrain. The application lives in `public/demo/index.html`.

## Exploring

- The default cluster has **100 stars** at a **700-unit cluster scale**, down from
  3,500 stars and 2,000 units. The nominal spacing is about 15% greater.
  Larger populations remain available under **Menu → Generation & graphics**.
- The opening **Visit a living system** action finds a real generated temperate
  world without changing the ecology distribution. It waits for your click;
  **Controls** opens the short exploration guide.
- **Explore** contains grouped planets/moons and **Places / Location** views.
  **Maps** shows system and nearby-star diagrams together on the right. **Menu** holds orbit motion,
  full screen, control help, and the generation/graphics controls.
- Tap or click a visible star/world to preview it with corner brackets. **Travel**
  commits the visit. Double-tapping/clicking an already marked target also travels;
  the first double-tap on a new target only selects. Dragging/pinching never counts
  as a targeting gesture. Visible worlds remain targetable near another planet;
  foreground bodies block targets behind them. Tap terrain to pin its facts.
- Both maps start compact in a right-side stack. Each has its own **↗**, **Expand**,
  and **−** controls; expanding one keeps the other available. **Maps** restores
  closed cards or hides the whole stack. Short screens scroll the stack. On
  phones, an expanded Explore inspector temporarily takes its space; **Maps**
  restores both diagrams.
  The solar-system map tracks current orbital positions; spacing is compressed
  and bodies enlarged. Each size choice stays in effect as you travel.
- Use the **Map** selector for **Natural**, **Elevation**, **Rivers**, **Watersheds**, and **Tectonic plates** to inspect
  terrain. Cyan drainage segments belong to the Rivers layer.
- **Explore land** finds exposed ground. **View relief** selects a sunlit landform
  when available, frames it from an angle, and aims at its actual raised surface.
  Both work on terrestrial worlds and rocky moons.
- Use **Tilt**, zoom, and named places to examine a surface; **Back** returns through
  the navigation scales. **Recenter** recovers the current view. Escape closes the
  current menu/target/chart before moving up a level; it never dismisses Settings
  and leaves the world in the same action. Arrow keys orbit when the scene has
  keyboard focus. Command/Ctrl browser shortcuts are left alone.

## Worlds and rendering

Solid worlds use deterministic airless, arid, volcanic, ice-crust, sterile wet,
cold-ocean, dry-temperate, warm-ocean, and temperate profiles. These are authored
procedural distributions, not measured exoplanet frequencies. Water and atmosphere
do not imply vegetation. In the default seed's 100 systems, 17 contain a
temperate garden planet and 26 contain at least one mild-climate candidate.

Ice-crust worlds have solid, cratered ice surfaces rather than liquid basins.
They retain below-datum relief, expose rock on steep faces, and have no liquid
river network. On water-bearing worlds, fully frozen water now remains fully
frozen; mottling affects the transition at the ice edge.

Orbital and close-up solid worlds share the same generated terrain and natural
colors. A plain globe in the world's material color appears while that terrain
resolves. A background worker prepares the other solid worlds in the current
system; its cache is released when changing systems. Structural edits retain
unchanged surfaces and discard removed or changed worlds. In-flight worker results
are tied to the seed and body definition that requested them. Gas giants retain their
atmospheric renderer and have no solid terrain to explore.

Close-up materials add fine shading and surface roughness. Atmospheric worlds
have a thin, daylight-weighted limb; terrain depth masks the glow over the ground.
Stars have steady cores, restrained halos, and soft outer boundaries. Belt debris
uses rotated angular silhouettes and faceted shading for rock and ice. Oort
particles are mostly compact icy points, with sparse subtle illustrative tails
and softer shell haze. This is still a finite-resolution planetary mesh, not a
local terrain level-of-detail engine.

## Build and verification

Requires Node.js 22.13 or newer and the locked npm dependencies.

```sh
npm run install:ci
npm run build
npm test
```

The build bundles the portable explorer, copies assets to `dist/`, and writes the
fullscreen iframe entry page. Sites serves `dist/` as configured in
`.openai/hosting.json`; this client-only application needs no server runtime.
The original framework scaffold remains available, including its development
commands, but is not part of the production build.

`npm test` covers navigation, interruption, touch gestures, world framing,
profile determinism, chart selection, terrain generation, ray picking, and shared
orbital/close-up geometry. Browser rendering and device performance should also
be checked before treating a rendering change as visually verified.

`public/geography-explorer.html` is the self-contained export. The legacy
`public/pathfinder-survey.html` route contains the identical export. Both are
regenerated by `scripts/export-standalone.mjs`; edit the demo source instead.

## Stellar context and geological relief

Expand the **Nearby stars** map to see the current system among its actual
3D neighbors, with a whole-cluster locator. Selecting a star previews its distance;
**Travel to selected star** commits the trip. Distances are simulation cluster
units, not asserted light-years. This generator represents a cluster, not an
entire modeled galaxy.

**Find mild world** surveys the actual planets in the displayed 24-star
neighborhood, starting with the nearest systems. It previews a candidate without
moving the camera. Travel enters its system; if already there, **Visit Planet**
approaches the candidate directly. A mild climate is a generated profile, not a
promise of Earth conditions or habitability. World summaries identify surface
phase, generated water coverage, air, and vegetation where relevant.

**Amber links** above the maps switches the main-viewport overlay on/off, even
when both maps are compact. **Adjust** provides brightness and a **Link steps**
slider (1–8, default 3). One step shows the links touching the current system;
each extra step follows another set of neighbors. A connection exists when either
star is among the other's three nearest neighbors in full 3D space. A kd-tree
builds this fixed network; cached breadth-first traversal selects the requested
steps. The overlay can extend beyond the nearby chart's 24-star survey area.

Zooming never fades the overlay. Brightness stays fixed; dashed links mark the
first step, dotted links extend outward, and the solid selected course remains
visible independently of the step limit. A disconnected component can run out of
new links before the slider's maximum; the settings show actual star/link counts.
Preferences are saved locally, and obsolete distance-fade settings are ignored.
Changing steps never moves the camera or changes the selected destination.

The nearby map retains its anchor when returning to Cluster; the system map
clears its old travel targets and offers a return to that star. These connections
do not restrict travel.

Nebulae mix curved filaments, hollow shells, and paired cloud knots using stable
three-dimensional shapes. Feathered, softly mottled particles remove hard circular
edges and screen-space shimmer. Core/edge color variation and gaps provide visible
landmarks without moving any existing stars or changing their generated systems.
The default remains 6,000 particles in one draw pass; glow attenuates by up to 55%
during close-world inspection. These are illustrative emissive clouds, not a
physical dust-extinction or volumetric-scattering simulation.

Inactive airless worlds now use spherical impact centers, resolvable crater rims,
ejecta aprons, and older degraded floors. Broad volcanic swells are limited to
active profiles. At this resolution only large impacts are explicit geometry;
finer material grain is cosmetic. Body radius is a deterministic authored
physical parameter correlated with the existing displayed body sizes.

`altM`, `slopeDegrees`, and `localReliefM` hold physical terrain measurements.
Dry-world heights use a reference-radius datum, including negative basin floors;
wet-world heights use sea level. Regional slope is the largest neighboring-cell
height gradient using the body's assigned radius. Render-only vertical
exaggeration is shared by orbital previews and detailed meshes, and does not
change terrain measurements or derived movement/build-suitability data.
Tectonic terrestrial worlds now use a radius-aware display scale (about 30× for
an assigned 4,850 km radius), so large highlands project several pixels above a
200-pixel globe. Physical altitudes, slopes, water levels, and biome boundaries
are unchanged. Rocky moons retain their existing 2.5× display scale. Camera
clearance includes the highest generated terrain.
Those suitability values remain game-design estimates, not engineering models.

Paused orbits skip position updates and GPU position uploads. Integrated orbital
clocks keep speed changes continuous, and static orbit guides are built only when
needed. Nearest-star adjacency is reused across system changes when the stellar
coordinates are unchanged. Editing system contents preserves a surviving logical
planet/moon and its framing; removed targets return to the system view. Zero
moons means zero, including around gas giants.

Geological references informing the procedural model:

- NASA, [Moon Craters](https://science.nasa.gov/moon/lunar-craters/): simple bowls,
  complex crater floors and central peaks, ejecta, and degraded basins.
- NASA, [Mars Moons: Facts](https://science.nasa.gov/mars/moons/facts/): heavily
  cratered small moons with loose surface material.
- USGS, [Fresh lunar impact craters: Review of variations in size](https://www.usgs.gov/publications/fresh-lunar-impact-craters-review-variations-size):
  size-dependent crater morphology.

The generator approximates those processes. Its impact frequencies, radius
assignment, and exaggeration factors are authored choices, not a calibrated
planetary evolution simulation.
