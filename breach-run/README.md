# Breach Run

A pixel-art demolition game: clear the transport lane, break structural supports and survive the falling debris.

- Play: [index.html](index.html)
- Original working Site: https://breach-run.x-nihilo.chatgpt.site
- Recovered saved version: **2**, commit `1c7e9f27c205c47ac154f30f0bff7da831cbff17`.
- Complete original source: [source/sites-source.tar.gz](source/sites-source.tar.gz).

This portable release retains the original `app/game.ts` gameplay without behavioral changes. The small React view was translated to equivalent static HTML and DOM event handlers; its original source is kept in `source/page.tsx`. Custom styles remain from `source/globals.css`, with the unused Tailwind import removed and the button reset retained. No server, login, CDN or framework is needed at runtime. Serve the folder over HTTP to load its local JavaScript modules.

To regenerate `game.js` and `style.css` from the original TypeScript and CSS, run `node build.mjs` with Node 24 or newer. The full original source and lockfile remain in the source archive. The original Site and its history are unchanged.

Controls: A/D or arrows move; Space jumps; J/Z smashes; K/X dashes; S/down slams; R restarts; N makes a new block. The same actions have touch buttons.

`preview.jpeg` is the saved version 2 Site screenshot, captured from that build rather than generated artwork.
