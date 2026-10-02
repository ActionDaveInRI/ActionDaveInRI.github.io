# Wreck Run · v1

[Play Wreck Run](https://actiondaveinri.github.io/projects/wreck-run/) · [Gallery](https://actiondaveinri.github.io/) · [Development Site](https://wreck-run.x-nihilo.chatgpt.site)

Tow a derelict freighter to the recovery ring while raiders attack. The wreck acts as physical cover, and damage reduces its salvage value. Ships move on a plane in a procedural Three.js scene, with a D3 radar and synthesized sound. Keyboard, mouse, touch and standard gamepad controls are included.

`index.html` is a self-contained portable release. It runs on GitHub Pages without sign-in or external assets, and can also be opened directly as a local file. Audio begins after a user gesture. The original development Site remains unchanged.

## Source and rebuilding

This exports the deployed Sites v1, commit `cf754efb925576dabc9956267274cbd4c87a255f`. Its game modules, React interface, CSS and UI components are preserved under `source/`. `source-provenance.json` records the original source hashes and the portable artifact hash. The dependency versions match the original lockfile; the portable package removes the unused Sites/server scaffold and adds a static entry point.

With Node.js 22.13 or newer, run `npm ci` and `npm run build` inside `source/`. This rebuilds the adjacent `index.html`. `source/README.md` contains the game's controls and original simulation verification. `source/package.original.json` and `source/pnpm-lock.yaml` preserve the original dependency declarations.

`preview.jpg` is the actual v1 gameplay capture from the source repository using its compatibility renderer. Hardware GPU rendering, physical controllers and real speaker output require device checks.
