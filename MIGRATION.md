# Main portfolio migration

## Cutover status

**Deployed and verified.** The screenshot gallery is live at [actiondaveinri.github.io](https://actiondaveinri.github.io/), with the collected games and their source under `projects/` in this repository. The original Spaceship demo is live at [/spaceship/](https://actiondaveinri.github.io/spaceship/).

The account repository was imported with full Git history. Both repositories publish `main` from `/ (root)` through GitHub Pages. The account site was published and checked before changing the old site:

| Repository | Migration commit | Successful Pages deployment |
|---|---|---|
| `ActionDaveInRI.github.io` | `3922bae89ac5112bca72421e72f793080db0d037` | [37069989078](https://github.com/ActionDaveInRI/ActionDaveInRI.github.io/actions/runs/37069989078) |
| `spaceship` | `dc583a8ebe64438439797ecb4de46944dd2c8679` | [37070324576](https://github.com/ActionDaveInRI/spaceship/actions/runs/37070324576) |

Both migration commits descend from `8d38d42dfab8e99e70031a0a5831b5e18fc6fad5`. No history was rewritten. The preparation branches `migration/main-portfolio` and `migration/restore-spaceship` remain as migration checkpoints; ordinary updates now belong on each repository's `main` branch.

## Current addresses

| Content | Canonical URL | Source repository |
|---|---|---|
| Screenshot gallery | `https://actiondaveinri.github.io/` | `ActionDaveInRI/ActionDaveInRI.github.io` |
| Collected games | `https://actiondaveinri.github.io/projects/<game>/` | `ActionDaveInRI.github.io/projects/<game>/` |
| Original Spaceship demo | `https://actiondaveinri.github.io/spaceship/` | `ActionDaveInRI/spaceship` |
| Projects with their own repositories | Existing URLs | Existing repositories |

The gallery retains all 22 entries and 15 real screenshots. Thirteen collection directories move, including Nebula Weave outside the gallery. The fourteenth former directory, Ship effects, returns to its original Spaceship repository; its gallery ID stays `ship-effects`.

## Maintain and verify

From a full clone of this account website:

```sh
python3 scripts/build_gallery.py
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/check_standalone.py
python3 scripts/check_pages.py --base https://actiondaveinri.github.io/
```

From a full clone of `ActionDaveInRI/spaceship`:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/check_pages.py --base https://actiondaveinri.github.io/spaceship/
```

Keep catalog/source links and releases in this account repository. Keep the existing compatibility manifest and generated redirects in `spaceship`. When changing a destination, deploy and verify it before updating any old entry point.

## Compatibility and preservation

The compatibility manifest contains all 62 former HTML addresses other than root `index.html`, which intentionally returns to Spaceship. Both `/spaceship/<game>/` and `/spaceship/projects/<game>/` are retained. Explicit index, directory and slashless forms are covered. JavaScript preserves the original query and fragment; canonical, HTML refresh and visible-link fallbacks are included.

The historical Star Cluster `source/public/demo/index.html` aliases now open its playable standalone release. The editable source page needed its own source server and root `/demo/` dependencies; its source and provenance remain unchanged in the account repository.

Only documentation, catalog data and navigation pages change in the collected projects. Game runtimes, sources, screenshots, source archives and history bundles remain byte-identical. Both repositories retain the original Git ancestry. Existing origin-based saves remain on `https://actiondaveinri.github.io`; Sites saves remain at their separate origins.

## Local validation

- 16 main-site layout/exporter regression tests.
- 5 compatibility tests, including 186 JavaScript redirect cases.
- 54 recovered runtime files and 39 source commits verified for Wayfarer and Silt + Signal.
- 170 main-site routes/resources inspected.
- Paired HTTP rehearsal: 218 gallery/resource/launch checks plus 183 compatibility/destination checks, all passed. External repository launches were checked at their existing public URLs.
- All 62 compatibility destinations resolve to actual files in the prepared sites.
- 306 collection files remain byte-identical to the baseline; 11 documentation/navigation files changed. The original Spaceship runtime is restored byte-for-byte.

## Live verification

- Account website: all 22 catalog launch URLs, 170 local routes/resources and gallery aliases passed across **218 HTTP requests**. Local responses matched the reviewed bytes; other repositories were checked at their unchanged public URLs.
- Spaceship: all 62 legacy HTML paths, their directory/slashless variants, 28 canonical destinations and the restored demo passed across **183 HTTP requests**. Both root demo URLs matched the original runtime exactly.
- Live browser: 22 gallery cards, all 15 decoded screenshots, search (First Light: 1 result) and category filter (Space & flight: 7 results) checked. No desktop horizontal overflow. Clicking the First Light screenshot launched its compatibility-rendered interface at `/projects/first-light/`.
- Live browser redirects checked for First Light with `?seed=123&mode=test#landing-site`, Inkstar and its fleet build, WFC, Wayfarer/Silt + Signal history, and both `/spaceship/projects` forms. The original Spaceship title and root URL were verified.

All **401 live HTTP checks passed**. See [GALLERY-QA.md](GALLERY-QA.md) for the verification history and [the deployed gallery capture](docs/gallery-live.jpg). Interactive GPU/audio/controller/touch gameplay was not revalidated by this migration. The move does not change gameplay code.

## Rollback

If a later repair requires the previous gallery and collection layout, revert the compatibility migration commit normally in `spaceship`, allowing Pages to republish the previous site. Keep the new account site available during repair so links already shared there remain usable. Do not delete either repository or rewrite its history.
