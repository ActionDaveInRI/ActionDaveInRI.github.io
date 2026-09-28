# First Light 0.4 — The Near Stars

The adaptation keeps First Light's planet identities and cartoon art, while making those places part of a persistent cluster, planet and regional model. It is a small expedition game with eight stars and nine worlds.

## Research basis

Reviewed the current **Star Cluster to Planet Tile** source, version 7, commit `6d3bc34586940f2076362975c80bf615d3144e8e`, especially `public/demo/index.html`: system hierarchy, surface caching, body profiles, geography generation, bridge/navigation and feature selection. Also consulted **Star_Cluster_Project_Review_and_Rebuild_Brief_2026-09-28.md**, whose baseline was the earlier Geographic Explorer version 4. The reference project was read only.

Version 7 already improves on that older review: `rememberSurface` / `synchronizeSystemSurfaces` share loaded geography between orbital and close-up solids. The valuable contract is that changing scale reveals another representation of the same place. Its raw WebGL/Three bridge, 40,962-cell generator, index-derived body identities, shared star/nebula RNG and hydrology do not fit this game's scope. First Light keeps its own renderer and simulation.

## The custom model

`lib/world.js` owns explicit star/body IDs, generation version 2, body profiles, palettes, spherical terrain sampling, selected landing sites and regional addresses. Each new game stores a fresh `universe.seed`; saves and imports retain it. Renderer randomness is derived separately from the same expedition seed. The star layout and planetary archetypes remain fixed.

`lib/planet.js` constructs the common faceted sphere and converts local positions to radial coordinates. Surface, planet, system and cluster views instantiate that same mesh, relief, nature and founded buildings. Roads and terrain grids bend onto the sphere; rigid buildings and trees follow its local up direction. Surface mode reframes the globe around the selected landing site or region. The scale is deliberately miniature, with an exaggerated horizon, rather than astronomical.

Landing candidates come from the generated geography. Scores prefer sheltered, fertile lowlands or mineral uplands. Clearance checks cover the full set of possible colony buildings, including footprint corners. Candidate regions must offer dry ground and mineral opportunities. A denser geographic search handles difficult worlds; new expeditions preflight all worlds and retry a rejected seed before storing it. Gardens remain optional and salt worlds do not naturally support them. Geographical rules are deterministic; there is no runtime AI dependency.

| Star | World | Local character |
| --- | --- | --- |
| Helios | Hearth; Rook, its moon | Warm coast and spaceport; crater and copper mine |
| Aster | Pelagos | Turquoise seas, basalt islands, Longshore Bay and High Mesa |
| Vesper | Tarn | Pale fjords, high upkeep and mineral uplands |
| Lyra | Ochre | Terracotta bluffs and irrigable river terraces |
| Morrow | Verdant | Forested highlands and fertile valleys |
| Serein | Brine | Salt shelves, sparse soil and rich minerals |
| Ember | Russet | Autumn steppe and wind-scoured ridges |
| Faraday | Haven | Alpine islands and a long supply journey |

Cluster, system, planet and surface are linked views. Named landing markers and the optional regional grid occupy corresponding geographic positions on globe and terrain. The system picker and map bodies provide navigation; the original keyboard, controller, touch and camera controls remain.

## What the player owns

A named expedition's launch budget and travel schedule are frozen when it departs. Its founding hull stays with the settlement. Each colony keeps its location, founder, founding season, design, policy, supplies, development and local projects. A field installation remains on its chosen hex after leaving the world or reloading.

World and site traits determine travel time, fuel needs, food upkeep, mine output and winter exposure. Colonies now run independently across the cluster. The original Rook ore service and Pelagos opening chapter remain intact. Materials are pooled strategically; provisions remain local; the Rook freighter still transports actual loaded ore.

Regional construction adds three choices:

- **Field station:** 20 materials, two seasons, then +1 knowledge each season.
- **Remote extractor:** 24 materials, three seasons, then +2 materials each season; requires a mineral seam.
- **Terrace garden:** 18 materials, two seasons, then +1 local provision each season; requires fertile soil and a settlement.

Landing reserves protect room for the colony's founding buildings. Some worlds have little suitable growing ground outside those reserves; delivered greenhouses remain useful. Regional installations operate independently of colony workforce priority. Rook retains its dedicated extraction-and-freight model.

Navigation charts, compact life support and the new deep-range drive upgrade help subsequent expeditions. Every destination has a legal survey design within the three-tank limit.

## Save compatibility

The existing storage key remains. Version 4 state stores the expedition seed and generation version. Versions 1–3 migrate to the new spherical geography. Flight budgets, timing and phase, colony founder/history/projects, and loaded freighter cargo survive unchanged. Existing regional installations retain their progress and move to legal ground; if no legal ground is available, their material cost is recovered. The original place layouts are intentionally reimagined.

Rook keeps the internal `cinder` ID. Legacy global community policy maps only to Pelagos. Region IDs contain a world, landing option and axial cell coordinate, rather than a mesh vertex index.

## Verification

Integration tests cover per-game variation, seed/save reproducibility, spherical sampler correspondence, dry colony footprints and useful regional choices across multiple seeds, survey reachability, v1/v2/v3 migration, ore conservation, independent colonies, and regional construction timing. Run `node --test tests/cluster.test.mjs`.

The browser used compatibility rendering because cloud WebGL was unavailable. Hardware WebGL, physical touch and controller testing remain device checks.

## Deliberate boundaries

One colony per world; two candidate landing regions with 37 local hexes each rather than a planet-wide economic grid. Whole-globe terrain and nature provide context outside those areas. Navigation uses separate scale views; camera flight is not seamless. No tectonic/hydrological simulation, manual flight, rival empires, combat or autonomous interstellar trade network is implied. These limits keep the central activity legible: choose a place, design a journey, commit resources, and see a lasting result there.

## Traffic across scales (0.5)

`lib/traffic.js` derives visible vessels, relevant views and turn-driven animation schedules from the authoritative mission and ore-service state. `lib/view.js` projects those schedules onto actual port coordinates at each scale. Surface views use a local departure/arrival lane; planet views add small labeled destination miniatures; system views use local ports or an explicitly labeled transfer exit. These are compressed strategic views, not simulated orbital trajectories.

A season transition animates travel, a landed pause and takeoff where a leg reverses. Completed missions keep a short arrival animation before handing off to the permanent founder or removing the returned vessel. The original founding design now preserves its payload kit, with a legacy fallback for existing settlements. Separate cargo and visiting berths keep the founder's pad occupied without visual collisions. GPU rendering remains a hardware verification item; the compatibility renderer and game UI were checked with simultaneous interstellar expedition and Rook freight traffic.
