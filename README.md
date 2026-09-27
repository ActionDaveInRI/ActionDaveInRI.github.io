# Games & experiments

A visual directory of David’s browser games and experiments.

[Open the screenshot gallery](https://actiondaveinri.github.io/spaceship/)

| Project | Directory |
|---|---|
| Wayfarer | [wayfarer/](wayfarer/) — complete v30 game, no login |
| Silt + Signal | [silt-and-signal/](silt-and-signal/) — complete v3 game, no login |
| Inkdrift | [inkdrift/](inkdrift/) — current playable build |
| Inkstar history | [inkdrift/archive/](inkdrift/archive/) — early Inkdrift builds |
| Nebula Weave | [nebula-weave/](nebula-weave/) |
| Ship effects | [ship-effects/](ship-effects/) |

Inkstar is part of Inkdrift’s history, not a separate gallery project. The current Inkdrift card launches the game directly; its Archive link opens earlier Inkstar builds. Old launch URLs remain usable.

Wayfarer and Silt + Signal now run directly on GitHub Pages. Their complete game sources and local assets are included here; neither game needs ChatGPT sign-in, a backend, a CDN, or an npm build. Wayfarer preserves v30 and Silt + Signal preserves v3, including their current controls, graphics, sound, gameplay and browser save formats.

Their original Sites source histories are preserved in downloadable Git bundles: [Wayfarer history](wayfarer/history/) (30 commits) and [Silt + Signal history](silt-and-signal/history/) (3 commits). Each game includes a version-to-commit manifest and per-file source hashes. The existing Sites builds remain available, and the former redirects are archived. Existing browser saves remain at their original website address; they do not automatically transfer to GitHub Pages.

To run this repository locally, use `python3 -m http.server 8000` and open `http://localhost:8000/`. No installation or build is needed for these two games. To verify their preserved runtime files and source history, run `python3 scripts/check_standalone.py`. See [migration verification](STANDALONE-QA.md) for the browser checks and limits.

The gallery catalog is `projects.json`. Run `python3 scripts/build_gallery.py` after changing it. Screenshots must be real captures. Single-project repositories remain their own project directories.

For future Wayfarer and Silt + Signal updates, follow [Deliberate game releases](RELEASING.md). The original Sites repositories remain the development sources. `scripts/release_game.py` exports an explicitly selected source revision, with a dry-run default and a separate local `--apply` step. Publishing remains a deliberate commit to the GitHub Pages publishing branch; ordinary Sites edits do not update these public releases.
