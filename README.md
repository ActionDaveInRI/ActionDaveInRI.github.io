# Spaceship / INKSTAR

A collection of spaceflight experiments: INKSTAR, an earlier ship-effects demo, and the Nebula Weave generator.

## Start here

[Open main build](https://actiondaveinri.github.io/spaceship/index.html) · [Choose a version](https://actiondaveinri.github.io/spaceship/versions.html) · [All projects](https://github.com/ActionDaveInRI/spaceship/blob/main/PROJECTS.md)

INKSTAR remains the main game. The earlier ship demo and Nebula Weave have their own entry points.

## Run it

Use GitHub Pages or a local HTTP server. The INKSTAR loader and Nebula Weave fetch neighboring JavaScript files, so opening them directly with file:// can fail. Keep the repository together when downloading it.

From inside this repository's folder, with Python 3 installed:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8000/>. On Windows, `py -m http.server 8000 --bind 127.0.0.1` is the equivalent command. Stop the server with Ctrl+C.

## Builds and files

| Build | File | Purpose |
|---|---|---|
| INKSTAR | [index.html](index.html) | The current homepage: fleet and shipyard test build with zero-cost ships and paint. |
| Nebula Weave | [wfc-nebula-demo/index.html](wfc-nebula-demo/index.html) | Wave Function Collapse nebula experiment with palette, structure, and motion controls. |
| Original spaceship effects | [spaceship_001.html](spaceship_001.html) | Earlier ship-effects demo with hull plates, thrusters, lasers, and landing legs. |

The file links in this table show source on GitHub. Use the launch links above to run a build.

## How the main build starts

`index.html` loads `render.js` and `game-loader-v8.js`. The loader fetches `game-v4.js` and makes ships and paint free for the current test mode before running it. `game-v4.js` is therefore still part of the active build despite the loader's v8 name.

| File or folder | Role |
|---|---|
| `render.js` | Renderer used by the main game. |
| `game-loader-v8.js` | Current loader and zero-cost test-mode overrides. |
| `game-v4.js` | Gameplay source loaded by the current homepage. |
| `game.js`, `game-v3.js` | Earlier runtime snapshots; not loaded by the current homepage. |
| `input-compat.js` | Earlier input shim; not loaded by the current homepage. |
| `wfc-nebula-demo/part1.js` through `part6.js` | Six script fragments fetched and joined by the nebula demo. Keep their order and filenames. |
| `projects.html`, `PROJECTS.md` | Directory of the related GitHub projects. |

This repository contains INKSTAR and older space experiments. It is not the ChatGPT Sites repository for Wayfarer.

## Keeping this organized

Keep the documented starting build on `main`. Record changes with a short description of what changed; use named Git milestones (tags) for future checkpoints instead of adding another numbered copy. Preserve existing historical file paths, and update this guide when the launch path changes. Independent experiments can use a clearly named folder or branch.
