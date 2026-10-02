# Games & experiments

[Open the screenshot gallery](https://actiondaveinri.github.io/)

This is ActionDaveInRI’s main GitHub Pages website. The homepage displays screenshots, descriptions, and direct launch and source links for 22 games, apps and experiments. `projects.json` is the catalog; [PROJECTS.md](PROJECTS.md) is its generated directory.

## Repository layout

- `index.html`, `gallery.css`: the screenshot gallery.
- `projects/<game>/`: each collected game’s selected runtime, editable source, previews, provenance and archives.
- `scripts/`: gallery generation, release export and verification.
- `versions.html`: the complete project directory.

The collection includes First Light, Silt + Signal, Wayfarer, Star Cluster, Wreck Run, Bramblewild, Last Light, Wayfarer Pixel Study, Inkdrift, Blackpine, Breach Run and Island Three. Nebula Weave is preserved under `projects/nebula-weave/` outside the main gallery. Inkstar remains in Inkdrift’s archive.

[Spaceship](https://actiondaveinri.github.io/spaceship/) is the original spacecraft demo in its own [repository](https://github.com/ActionDaveInRI/spaceship). PETRI and the other projects already housed in dedicated repositories retain their own homes and launch URLs. The gallery links to those repositories directly.

## Maintain the gallery

Edit `projects.json`, then run:

```sh
python3 scripts/build_gallery.py
python3 scripts/check_standalone.py
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/check_pages.py
```

The generator updates `index.html`, `versions.html`, `PROJECTS.md`, and the two gallery aliases in `pages-redirects.json`. For a local preview, serve this checkout with `python3 -m http.server 8000` and open `http://localhost:8000/`. Locally collected games launch at `/projects/<game>/`; links to dedicated repositories use their public addresses.

Use real game captures and record the preview version when it differs from the selected release. Keep previous releases within their project’s archive. See [release instructions](RELEASING.md) and [verification records](GALLERY-QA.md).

## Source and history

The selected public games run without ChatGPT sign-in. Their original Sites projects and access settings remain separate. Each game records its release source and adaptations in its README and provenance. Later development edits do not automatically publish here.

This repository inherits the complete `spaceship` Git history through `8d38d42dfab8e99e70031a0a5831b5e18fc6fad5`. Existing source-history bundles and archives remain intact, including Wayfarer’s 30 and Silt + Signal’s 9 source commits. No game code was changed for the website move.

## Publishing and old links

GitHub Pages publishes `main` at the root of `ActionDaveInRI/ActionDaveInRI.github.io`, with `.nojekyll`. The homepage is `https://actiondaveinri.github.io/`; collected projects use `https://actiondaveinri.github.io/projects/<game>/`.

The `spaceship` repository retains small compatibility pages for its 62 previous project, archive, history and directory HTML addresses. They send visitors directly to the new location and preserve query strings and fragments. Both its old `/spaceship/<game>/` and `/spaceship/projects/<game>/` launch forms remain supported. `/spaceship/` itself returns to the original Spaceship demo. The redirects belong in that repository because it serves those old URLs.

Moving within the same `https://actiondaveinri.github.io` origin preserves the collected games’ localStorage saves. Original Sites saves remain at their separate origin.

After Pages deployment succeeds, run `python3 scripts/check_pages.py --base https://actiondaveinri.github.io/`. Verify the old addresses using the compatibility checker in the `spaceship` repository. See [migration and rollback procedure](MIGRATION.md).
