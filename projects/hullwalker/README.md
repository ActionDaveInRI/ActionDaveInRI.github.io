# Hullwalker · EVA

[Play](./) · [Gallery](../../) · [Original working Site](https://hullwalker-eva.x-nihilo.chatgpt.site)

Walk the Morrow’s hull with magnetic boots, push off into free drift, and use a tether to catch your outward motion and swing around an anchor. Reel in, pay out, or release into free drift. The original power-node → relay → airlock mission and guided EVA are also available.

Selected public release: **Sites v4 — tether trial**, source commit `a7d791ce000adb39f904864d384077df4a55e8a9`, exported October 13, 2026. The complete tracked `dist/` runtime is byte-identical to the saved source. It runs without sign-in or external CDN requests. Three.js and its MIT license are included.

Choose **TRY THE TETHER** on the opening screen to start already clipped to anchor A1. Hold/release **Space** to push off, **G** to clip/release, **Z** to reel in, **X** to pay out, **C** to thrust toward the hull, and **R** to restart the trial. WASD moves, mouse drag looks, Shift sprints/brakes, and E services mission nodes. Touch and gamepad controls are included. Sound starts after an input gesture.

The cable is straight and does not wrap around obstacles. A snag stops movement at its last clear position; release or steer clear to recover.

The real `preview.jpg` gameplay capture remains from v3 using the built-in Canvas compatibility renderer; it predates the tether. The full four-commit source history, including the previous v3 release, is preserved in [history/](history/). Original development notes are in [source/README.md](source/README.md).

Serve the gallery checkout with `python3 -m http.server 8000`, then open `/projects/hullwalker/`.
