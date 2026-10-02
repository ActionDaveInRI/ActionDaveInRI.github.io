# Star Cluster · Geographic Explorer · Sites v11

[Open Star Cluster](https://actiondaveinri.github.io/projects/star-cluster/) · [Gallery](https://actiondaveinri.github.io/) · [Development Site](https://star-cluster-planet-demo.x-nihilo.chatgpt.site)

Explore a procedural star cluster, travel between systems, and inspect planetary terrain. This release includes the 100-star starting cluster, paired system and nearby-star maps, adjustable amber neighbor links, and exaggerated visible terrestrial relief.

`index.html` is the self-contained export from deployed Sites v11, commit `ca4d807e953495976fa2446a3c362fc2972b54ae`. It is byte-identical to that revision's `public/geography-explorer.html`. Scripts, vendored Three.js/D3, styling and procedural graphics are included, with no sign-in or external runtime assets. WebGL is required. The original development Site remains unchanged.

## Source and rebuilding

Editable source lives in `source/public/demo/index.html`; vendored graphics modules are alongside it. The original exporter and simulation tests are included. `source-provenance.json` records original source hashes and the portable artifact hash.

With Node.js 22.13 or newer, run `npm ci` and `npm run build` inside `source/`. The export updates the adjacent `index.html`. Run `npm test` for the original simulation and rendered HTML checks. The fuller controls, rendering model and limitations are documented in `source/README.md`.

## Preview and verification

The preview is an actual screenshot from Sites v10 (`c3ddf5488067cf9e000f52a4482873a287a64320`), showing the same cluster view and nebula renderer used in v11. The current v11 release adds a living-world start action, relief framing and stronger terrestrial relief, plus performance and navigation fixes; those changes are not depicted in this cluster screenshot.

All 35 original simulation tests pass. The rendered HTML test was adapted from the Sites iframe shell to the portable entry point and also passes. The published artifact is byte-identical to the deployed v11 portable export. A new GPU screenshot could not be captured in this environment because the available browser lacks WebGL.
