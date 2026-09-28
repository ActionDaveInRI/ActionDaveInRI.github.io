# Island Three — Daylight Passage

An interactive 3D space-habitat interior and cutaway study, with terrain, towns, bridges, reflected sunlight and a day/night cycle.

- Play: [index.html](index.html)
- Original working Site: https://island-three-interior.x-nihilo.chatgpt.site
- Recovered saved version: **9**, commit `91adfc21e038d4e489327f739e806fc68f2eff25`.
- Complete original source: [source/sites-source.tar.gz](source/sites-source.tar.gz).
- Detailed model and controls: [source/ORIGINAL-README.md](source/ORIGINAL-README.md).

The saved build is preserved. Its only runtime adaptations are local imports for the same pinned Three.js r180 and D3 7.9.0 dependencies. D3's official browser distribution supplies the same library through `window.d3`. All required Three.js modules and licenses are under `vendor/`; no CDN, server backend or login is required. Use any static HTTP server for local play, because browser ES modules require HTTP.

Drag to orbit and wheel/pinch to zoom. Choose the authored viewpoints; open Controls for the cutaway and rendering options; click the clock for habitat time. This is a detailed WebGL environment and can be demanding on mobile or integrated graphics.

The original working Site and its history are unchanged. Its existing noindex directive is preserved.

`source/preview-v1.jpeg` is an older version 1 screenshot, retained as history. It does not depict all current version 9 detail and lighting changes.
