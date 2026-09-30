# Games & experiments

[Open the screenshot gallery](https://actiondaveinri.github.io/projects/)

`index.html` is the gallery, not a game. Each project has its own directory, with a direct launch link, a short description, and a real preview wherever a usable capture is available. [PROJECTS.md](PROJECTS.md) lists every current build and its source location.

## Current games in this repository

| Project | Directory | Selected release |
|---|---|---|
| First Light | [first-light/](first-light/) | v0.9 · Ground into Towns |
| Silt + Signal | [silt-and-signal/](silt-and-signal/) | Sites v9 |
| Wayfarer | [wayfarer/](wayfarer/) | Sites v30 |
| Star Cluster · Geographic Explorer | [star-cluster/](star-cluster/) | Sites v11 |
| Wreck Run | [wreck-run/](wreck-run/) | Sites v1 |
| Bramblewild | [bramblewild/](bramblewild/) | Sites v19 |
| Last Light · Trench Assault | [last-light/](last-light/) | Sites v1 |
| Wayfarer · Pixel Study | [wayfarer-pixel-study/](wayfarer-pixel-study/) | Sites v3 |
| Blackpine | [blackpine/](blackpine/) | Sites v2 · formerly Vector Vale |
| Breach Run | [breach-run/](breach-run/) | Sites v2 |
| Island Three | [island-three/](island-three/) | Sites v9 |
| Inkdrift | [inkdrift/](inkdrift/) | Current standalone build |
| Ship effects | [ship-effects/](ship-effects/) | Original study |

Projects already in dedicated repositories retain their existing homes and URLs. The gallery links to them directly; it does not create competing copies.

Inkstar remains in [Inkdrift’s archive](inkdrift/archive/). Nebula Weave remains available at [nebula-weave/](nebula-weave/) outside the main gallery. Older launch URLs still work, and Git history preserves previous files.

## Releases and source

The recovered Sites games run directly from these project directories without ChatGPT sign-in. Their original Sites projects, URLs, access settings, and history remain intact. Each exported game records its selected source revision and adaptations in its own README and provenance file. These public builds are deliberate releases; later Sites edits do not automatically change them.

Wayfarer includes its 30 original source commits and Silt + Signal includes its 9 original source commits in downloadable Git bundles. First Light includes its editable portable source and 39 simulation tests. Other recovered games include their source or original source archive alongside the playable build.

Browser saves remain at their original website address. First Light provides Export save / Import save for moving progress between hosts.

## Maintain the gallery

Edit `projects.json`, then run:

```sh
python3 scripts/build_gallery.py
python3 scripts/check_standalone.py
```

The generator updates `index.html`, `versions.html`, and `PROJECTS.md`. Put each project’s runtime and preview in its own directory. Use real game captures, and record the preview version if it differs from the selected release. Keep launch URLs stable and archive earlier generations within the relevant project.

For a local preview, serve the repository’s parent directory with `python3 -m http.server 8000` and open `http://localhost:8000/projects/`. See [release instructions](RELEASING.md) and [gallery verification](GALLERY-QA.md).
