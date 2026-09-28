# First Light · v0.10 — Places with a Past

[Play First Light](https://actiondaveinri.github.io/spaceship/first-light/) · [Back to the gallery](https://actiondaveinri.github.io/spaceship/) · [Development version](https://first-light-expeditions.x-nihilo.chatgpt.site)

Build an interstellar civilization across miniature planets. Survey worlds, establish settlements, connect cargo-drone services, and grow lasting towns from local production.

This release adds businesses sustained by actual local industry and delivered cargo, lasting neighborhood histories, clickable workplace and household connections, and visible construction stages. Ochre now has red rock, orange strata and golden ground. Research progresses automatically; City, Build, Ports and Land organize the inspector.

## Play and saves

The game runs directly on GitHub Pages without a login or external assets. `index.html` contains its scripts, styling, procedural graphics and sound. You can also download it and open it locally on a desktop browser.

Saves stay in the browser at each website address. To continue a Sites game here, use **Save and settings → Export save** in the development version, then **Import save** here. Save format 8 accepts earlier First Light saves. Sound starts after enabling audio with a user gesture.

## Source and verification

Editable modules, the locked dependencies, build script, tests and migration fixtures are in [source/](source/). Source revision: `fd6ceccc13413712eb4e0fbadf8c728d0ce5eaf3`. The public runtime is byte-identical to that revision’s portable artifact; [source-provenance.json](source-provenance.json) records file hashes and export adaptations.

39 simulation tests pass, covering the normal campaign, cargo conservation, old saves, resource conversions, housing, businesses and tile occupancy. The source game’s building selection and construction were checked in-browser with the compatibility renderer. Native GPU rendering and physical touch devices were not tested in this release check.

The original development Site and its Git history remain the development source. Publishing this directory is a deliberate release, not an automatic sync.
