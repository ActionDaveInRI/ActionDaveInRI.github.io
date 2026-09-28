# Gallery verification · 2026-09-28

## Inventory and organization

- `/spaceship/index.html` is a static screenshot gallery for 22 projects.
- The root gallery and generated project directory launch each selected build directly.
- Eight previously unlisted projects now have their own directories: Wreck Run, Star Cluster, Bramblewild, Last Light, Wayfarer Pixel Study, Blackpine, Breach Run and Island Three.
- First Light remains the exact v0.9 portable release in `first-light/`.
- Silt + Signal is updated from saved Sites v3 to confirmed live v9.
- Dedicated external repositories retain their homes. Existing launch redirects and archives are preserved.
- The original Sites projects, sources, URLs and access settings are unchanged.

## Source and runtime checks

- Gallery local links, images, source directories and unique project IDs checked.
- Wayfarer: all 50 runtime files verified, 30 source commits restored.
- Silt + Signal: all 4 runtime files byte-identical to v9; 9 source commits restored; original gameplay/Canvas tests pass.
- First Light: 32 simulation tests pass with its matching installed dependencies; portable runtime hash matches its provenance.
- Star Cluster: 35 simulation tests and the portable HTML check pass; public runtime matches the committed v11 export exactly.
- Wreck Run: standalone bundle compiles; no external runtime assets.
- Bramblewild, Last Light and Pixel Study: local imports and JavaScript syntax checked; original game modules preserved byte-for-byte.
- Blackpine: original standalone HTML preserved byte-for-byte. Breach Run and Island Three: syntax and local dependencies checked.
- External launch links returned HTTP 200. A real Planet Generator module mismatch was repaired in its own repository by pinning three addon imports to its existing Three.js r128 core. Exact core plus transitive addon imports verified successfully.

## Preview provenance and limits

Previews use actual game captures or the exact game renderer, never generated substitute artwork.

- Silt + Signal uses the current v9 Canvas renderer and its existing shelter test scene.
- Wreck Run, Bramblewild, Last Light and Pixel Study use verified captures from their selected versions.
- Star Cluster currently uses a real v10 screenshot of the cluster view. The card explicitly labels the preview v10; its launch opens v11. It does not depict v11’s new terrain relief.
- Blackpine has a fresh v2 gameplay screenshot captured from its public page. Island Three has no current preview; its old v1 screenshot depicts a materially different version and is excluded from the gallery.
- Seven legacy WebGL previews are unavailable in the capture browser: Planetside, Planet Generator, Starmap, Orbital Velocity, Ship effects, ASCII FLIP and Pulsating sphere. The cloud browser cannot create WebGL contexts. Native browser launch was also blocked by the execution environment. These are labeled honestly, with working launch links retained.

Static validation is not a claim of full gameplay, physical-controller, touch-device or audible-audio testing. Post-publication browser checks are recorded below.

## Public verification

GitHub Pages successfully deployed commit `9e54f76e492c699bb32a3686360bd9540b565f73`. All 22 launch URLs and all 13 then-listed screenshot URLs returned HTTP 200. All 23 checks with a corresponding local file matched its bytes exactly. Blackpine’s new current gameplay preview was captured subsequently.

In the live browser, the gallery shows 22 cards without desktop horizontal overflow. The Space & flight filter returns 7 projects; searching First Light returns 1. Its preview link opens the correct public First Light game and compatibility-rendered gameplay appears. Planet Generator’s former Timer module error is gone; it reaches graphics initialization. Narrow-viewport browser/device testing was not available.

All 13 initially published gallery images decoded in the live browser after deferred loading. Blackpine starts and renders current v2 gameplay. Wreck Run’s Quiet tow starts and displays the tug and wreck with the compatibility renderer. Island Three loads its local source/modules and displays its explicit WebGL-required message in this browser; GPU gameplay could not be verified here.
