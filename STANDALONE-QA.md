# Standalone game migration

Recovered and checked on September 27, 2026.

| Game | Published source recovered | Runtime files | Original source commits preserved |
|---|---|---:|---:|
| Wayfarer | v30 · `eacc6f34d17d6d5e7584504188e59b4573a940b1` | 50 | 30 |
| Silt + Signal | v3 · `9f2fcf390a0da78f054fd87bdc5259a3560098d0` | 4 | 3 |

The latest source commits were matched against the Sites version listings. Both working trees were clean before export. Wayfarer's entire `public/game/` tree and favicon were copied; Silt + Signal's entire `dist/` tree was copied. These directories contain the actual human-readable game source, not replacement demos or placeholders.

Wayfarer's only runtime modification is changing `/favicon.svg` to `./favicon.svg`. All other runtime bytes, including local Three.js r180 modules, are unchanged. Silt + Signal's four files are byte-identical to v3. The Three.js MIT license is included separately.

## Verification

- `python3 scripts/check_standalone.py`: passed. Checks all deployed and original file hashes, local entry-point resources, launch metadata, absence of external redirects, and complete restoration of both original Git bundles. Every listed historical commit and every current source file was verified from the restored bundles.
- Original Wayfarer `tests/voyage.mjs`: passed. Covers boarding, cargo loading, launch, weapons, repair, the full guided voyage, docking, payment, saves and return travel.
- Original Wayfarer `tests/robbery.mjs`: all 14 checks passed, covering mission gating, surrender, capture, cover, escape, retries, reward persistence and old-save migration.
- `git diff --check` on authored migration changes: passed. Four whitespace warnings in the recovered JavaScript/Three.js files are inherited verbatim; the original game files were not reformatted.

The gameplay checks run against the original source; the hash verification establishes that those game modules are unchanged in this migration. No new gameplay behavior was introduced.

## Browser and device limits

Local interactive browser verification was unavailable in the execution environment. Public-page verification is recorded below after deployment. This migration does not establish new native-device, physical-controller or GPU-performance coverage.

## Saves and history

The existing Sites deployments and source repositories were not edited. Their former GitHub launcher pages are archived in each game's `history/sites-launcher.html`. Full original source history is recoverable with `git clone` from each `history/source-history.bundle`; the bundle includes the original hosting configuration, documentation and tests where present. Version manifests map all published versions to original commit IDs.

GitHub Pages and Sites have different origins. Existing browser saves remain on the original Sites origin and are not automatically transferred. Save keys and game save formats are unchanged.
