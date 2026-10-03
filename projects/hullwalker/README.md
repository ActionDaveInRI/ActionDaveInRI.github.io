# Hullwalker · EVA

[Play](./) · [Gallery](../../) · [Original working Site](https://hullwalker-eva.x-nihilo.chatgpt.site)

Walk the Morrow’s hull with magnetic boots, push off into free drift, steer with RCS, and restore the ship’s power and relay before returning to the airlock.

Selected public release: **Sites v3**, source commit `0c7cee44007adef9393c3fd7c0116272525c0c91`, exported October 3, 2026. The complete `dist/` runtime is byte-identical to the saved source. It runs locally without sign-in or external CDN requests. Three.js and its MIT license are included.

The real `preview.jpg` gameplay capture is from the same v3 release using its built-in Canvas compatibility renderer. The full three-commit source history is in [history/](history/), and the original development notes are in [source/README.md](source/README.md).

Serve the gallery checkout with `python3 -m http.server 8000`, then open `/projects/hullwalker/`.

Controls: WASD move, mouse drag look, hold/release Space push off, C hullward RCS, Shift sprint/brake, E service, R safe recall. Touch and gamepad controls are also included. Sound starts after the first input gesture. A guided EVA is available from the opening screen.
