# Wayfarer

[Play Wayfarer](https://actiondaveinri.github.io/projects/wayfarer/) · [Source history](history/) · [About](about.html)

The full game runs directly on GitHub Pages, without ChatGPT sign-in, a backend, a CDN, or a build step. This is the recovered Sites **v30** game at source commit `eacc6f34d17d6d5e7584504188e59b4573a940b1`. All game code, graphics, sound, controls and save formats are preserved.

## Source and hosting

The files in this directory are the standalone game source and playable build. They were copied from `public/game/` in the original Sites repository. `source-provenance.json` records every original path and source/deployed SHA-256. The only runtime edit is the relative favicon URL in `index.html`. The original vendored Three.js r180 modules are included locally; see `vendor/LICENSE`.

To run locally, serve the repository root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/wayfarer/`. Use HTTP hosting for reliable module loading and browser saves. No npm install is needed. This directory can also be deployed unchanged under another static-host subdirectory.

## History

`history/source-history.bundle` preserves all **30 original source commits**, including the original hosting wrapper, build configuration, documentation and any original tests. `history/versions.json` maps each published version to its exact original commit and date. The former redirect is retained as `history/sites-launcher.html`.

Restore the complete original repository from a clone/download of this repository:

```sh
git clone wayfarer/history/source-history.bundle wayfarer-original
git -C wayfarer-original log --all --oneline
```

To inspect a published version, use its commit from `history/versions.json` with `git checkout --detach COMMIT` inside the restored repository. These are original source snapshots, including their original hosting setup, not independently adapted historical Pages builds.

The [original Sites game](https://wayfarer-freighter.x-nihilo.chatgpt.site) and its history remain available with their existing access settings. The repository's own prior commits also retain the old launcher files.

## Saves

Future public updates follow the [deliberate release process](../RELEASING.md). Develop in the original Sites source repository, then export and publish a selected, tested revision.

Progress is still stored in this browser using the game's original save keys. Browser storage belongs to an origin: an existing save at the Sites address does **not** automatically appear at the GitHub Pages address. It remains available at the original address. The two games use separate save keys.

[Original gameplay and technical documentation](history/SITES-README.md) is preserved verbatim. Its `public/game/`, `tests/` and tooling paths refer to the restored original repository.
