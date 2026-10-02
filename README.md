# Games & experiments

[Open the screenshot gallery](https://actiondaveinri.github.io/spaceship/)

`index.html` is the gallery, not a game. Owned projects live under `projects/`, with a direct launch link, a short description, and a real preview wherever a usable capture is available. [PROJECTS.md](PROJECTS.md) lists every current build and its source location.

## Current games in this repository

| Project | Directory | Selected release |
|---|---|---|
| First Light | [first-light/](projects/first-light/) | v0.10.2 · Places with a Past |
| Silt + Signal | [silt-and-signal/](projects/silt-and-signal/) | Sites v9 |
| Wayfarer | [wayfarer/](projects/wayfarer/) | Sites v30 |
| Star Cluster · Geographic Explorer | [star-cluster/](projects/star-cluster/) | Sites v11 |
| Wreck Run | [wreck-run/](projects/wreck-run/) | Sites v1 |
| Bramblewild | [bramblewild/](projects/bramblewild/) | Sites v19 |
| Last Light · Trench Assault | [last-light/](projects/last-light/) | Sites v1 |
| Wayfarer · Pixel Study | [wayfarer-pixel-study/](projects/wayfarer-pixel-study/) | Sites v3 |
| Blackpine | [blackpine/](projects/blackpine/) | Sites v2 · formerly Vector Vale |
| Breach Run | [breach-run/](projects/breach-run/) | Sites v2 |
| Island Three | [island-three/](projects/island-three/) | Sites v9 |
| Inkdrift | [inkdrift/](projects/inkdrift/) | Current standalone build |
| Ship effects | [ship-effects/](projects/ship-effects/) | Original study |

Projects already in dedicated repositories retain their existing homes and URLs. The gallery links to them directly; it does not create competing copies.

Inkstar remains in [Inkdrift’s archive](projects/inkdrift/archive/). Nebula Weave remains available at [nebula-weave/](projects/nebula-weave/) outside the main gallery. Older launch URLs still work, and Git history preserves previous files.

## Releases and source

The recovered Sites games run directly from `projects/<game>/` without ChatGPT sign-in. Their original Sites projects, URLs, access settings, and history remain intact. Each exported game records its selected source revision and adaptations in its own README and provenance file. These public builds are deliberate releases; later Sites edits do not automatically change them.

Wayfarer includes its 30 original source commits and Silt + Signal includes its 9 original source commits in downloadable Git bundles. First Light includes its editable portable source and 39 simulation tests. Other recovered games include their source or original source archive alongside the playable build.

Browser saves remain at their original website address. First Light provides Export save / Import save for moving progress between hosts.

## Maintain the gallery

Edit `projects.json`, then run:

```sh
python3 scripts/build_gallery.py
python3 scripts/check_standalone.py
python3 scripts/check_pages.py
```

The generator updates `index.html`, `versions.html`, and `PROJECTS.md`. Put each owned project’s runtime, source, history and preview in `projects/<game>/`. Use real game captures, and record the preview version if it differs from the selected release. Keep launch URLs stable and archive earlier generations within the relevant project.

For a local preview, serve the repository’s parent directory with `python3 -m http.server 8000` and open `http://localhost:8000/spaceship/`. See [release instructions](RELEASING.md) and [gallery verification](GALLERY-QA.md).

## Source layout and stable launch URLs

`projects/` is the canonical home for all games and studies owned by this repository. Root game folders contain only generated HTML compatibility pages. GitHub Pages continues to publish `main` at the repository root with `.nojekyll`; no hosting settings or separate build service are needed.

`projects.json` uses `projects/<game>` for source directories and GitHub source links, while its public launch and history URLs retain their established addresses. Images load from the canonical project folders. `pages-redirects.json` records every previous HTML entry point, including nested archives, Inkstar, WFC Nebula Demo, and `spaceship_001.html`. The gallery generator recreates these relative redirects and preserves query strings and fragments. Edit the route manifest instead of a generated page, and keep old routes when adding releases.

Moving paths within this Pages site keeps the same origin and existing localStorage saves. No game uses a service worker or pathname-based save scope. Original Sites saves remain at their separate origin.

After regenerating, run `python3 -m unittest discover -s scripts -p 'test_*.py'` and `python3 scripts/check_pages.py`. After Pages deploys, run `python3 scripts/check_pages.py --base https://actiondaveinri.github.io/spaceship/` to check all gallery launches, legacy redirects, canonical HTML and local runtime dependencies against the reviewed files.
