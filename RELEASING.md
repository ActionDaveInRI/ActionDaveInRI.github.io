# Deliberate game releases

The original ChatGPT Sites repositories are the development sources. The game
directories under `projects/` here are selected public releases. Edit the development source, then
explicitly export and publish a tested revision. There is no watcher, scheduled
sync, or push hook connecting Sites development to this repository.

| Game | Development Site | Current public source |
|---|---|---|
| Wayfarer | https://wayfarer-freighter.x-nihilo.chatgpt.site | Sites v30 · `eacc6f34d17d6d5e7584504188e59b4573a940b1` |
| Silt + Signal | https://silt-and-signal.x-nihilo.chatgpt.site | Sites v9 · `e9b81ea312df5e137a42ac224847c4adc896102a` |

## Prepare a release

Open the game's existing Sites source repository. Confirm the intended saved
Sites version, its complete source commit, and whether that version is the live
deployment. A saved version is not necessarily deployed. The exporter requires
an explicit version and commit; it does not verify Sites metadata itself.
Never use an old recovered bundle as evidence that a game is current.

From a clean checkout of this gallery, make a release branch:

```sh
git switch -c release/game-update
```

First dry-run the export. These examples verify today's releases; for a later
release, replace the source path, complete commit, and version with the selected
revision. Source paths below refer to the development checkouts in ChatGPT's
execution workspace, and can be replaced with equivalent local clones.

```sh
python3 scripts/release_game.py --game wayfarer --source /workspace/sites/wayfarer-freighter --commit eacc6f34d17d6d5e7584504188e59b4573a940b1 --sites-version 30
python3 scripts/release_game.py --game silt-and-signal --source /workspace/sites/silt-and-signal --commit e9b81ea312df5e137a42ac224847c4adc896102a --sites-version 9
```

Repeat the chosen command with `--apply` to prepare its files locally. Applying
the already-current revision makes no changes. The destination comes from the
owned game's catalog `directory`; root compatibility pages are never release
destinations. The script does not commit,
push, publish, contact a service, or modify the source repository.

For a new release it exports tracked files from the exact commit, updates file
hashes and release metadata, and refreshes the recoverable source-history bundle.
It removes only obsolete runtime files listed in the preceding manifest, keeping
screenshots, documentation, archived launchers, and history pages. It refuses
dirty source trees, altered public runtime files, conflicting versions,
downgrades, unmanaged-file collisions, and missing literal dependencies.
Wayfarer's favicon path is the sole automatic runtime adaptation.

If the source adds server features, changes its layout, or needs another runtime
adaptation, assess that change explicitly before modifying the exporter.

## Review and test

1. Update the version, commit, and history counts in the game's README, about
   page and history page, this document, and the root README. Keep existing
   historical version mappings. If intermediate Sites versions were skipped,
   add their verified mappings to `history/versions.json`; do not invent them
   from commit order. Review whether screenshots still represent the game.
2. Run `python3 scripts/build_gallery.py` and
   `python3 scripts/check_standalone.py` and `python3 scripts/check_pages.py`.
   The standalone checker checks hashes, literal
   HTML/CSS/module dependencies, catalog consistency and restoration of every
   mapped original commit. Dynamic requests still require browser review.
3. Run relevant existing tests from the original game source repository.
   For exporter changes, also run
   `python3 -m unittest discover -s scripts -p 'test_release_game.py'`.
4. Serve this checkout with `python3 -m http.server 8000`. Test
   `http://localhost:8000/projects/wayfarer/` or
   `http://localhost:8000/projects/silt-and-signal/`. This exercises the public
   project subpath. Use a fresh browser context, start gameplay, move and
   interact, exercise controls, inspect graphics, and check sound after a user
   gesture. Confirm no login or external game-service dependency.
5. Record actual results and any device/audio limitations in `STANDALONE-QA.md`.
   Review `git diff` before committing.

## Publish and verify

Commit the reviewed release normally, then merge it into the publishing branch
(`main`) when a public update is requested. The existing GitHub Pages deployment
publishes that branch. Pushing development changes to the separate Sites
repository does not publish them here.

Wait for Pages deployment success, then open the public project URLs in a
signed-out browser and verify the expected version and gameplay. Check live
runtime hashes against `source-provenance.json`. Roll back with a normal revert
commit and let Pages deploy it; the original Sites project stays intact.

## Moving the gallery or separating repositories

The exporter preserves catalog URLs and uses the main website catalog. It currently expects `projects.json` and a catalog `directory` under `projects/` for each owned game. If each
game moves into its own repository root, adapt that destination layout and the
catalog update step before using this script. The development source and static
game runtimes can remain the same.

Keep old Pages launch URLs working during a move. Renaming a GitHub repository
does not automatically redirect its Pages URLs. A personal homepage can hold
the screenshot gallery and link to independently hosted game repositories.


## First Light portable release

First Light’s current selected release is game v0.10.2 from `2db0e28ce733822fe2382e973f37d8911c1e66a7`, at [projects/first-light/](projects/first-light/). Its development source is https://first-light-expeditions.x-nihilo.chatgpt.site. The generic `release_game.py` currently handles Wayfarer and Silt + Signal only.

For First Light, select a clean, exact development source commit; run its tests and `node scripts/build-portable.mjs`. Copy the resulting `public/First-Light.html` to `projects/first-light/index.html`, update the editable portable source export and provenance hashes, then update the screenshot, project metadata and README. Run `scripts/build_gallery.py`, verify the portable game at the Pages subpath, and publish a reviewed commit to `main`. Do not copy authentication, server configuration, credentials or personal save files. Updates to the development Site alone do not release this public version.

## Layout changes and compatibility

Keep editable sources, selected runtimes, previews, provenance and archives together in `projects/<game>/` in `ActionDaveInRI.github.io`. Catalog `launch`, `live`, `versions`, `directory`, `source` and `image` all identify the canonical project location. Keep those addresses stable for subsequent releases.

The main-site generator rebuilds the two local gallery aliases in `pages-redirects.json`. Legacy `/spaceship/` routes are maintained separately in the `spaceship` repository. Retain those mappings when adding releases; redirects preserve queries and fragments. See [MIGRATION.md](MIGRATION.md) for the ordered cutover and rollback.

Run all layout/exporter regression tests with `python3 -m unittest discover -s scripts -p 'test_*.py'`. After the normal Pages deployment succeeds, verify the public layout with `python3 scripts/check_pages.py --base https://actiondaveinri.github.io/`. Roll back with a normal revert if those checks fail.
