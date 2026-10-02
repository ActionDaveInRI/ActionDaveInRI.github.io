# Spaceship

[Run Spaceship](https://actiondaveinri.github.io/spaceship/) · [Browse all games and experiments](https://actiondaveinri.github.io/)

This repository contains the original spacecraft effects demo: hull plates, thrusters, laser fire, and landing legs. `index.html` is byte-identical to the original `spaceship_001.html` added in commit `f4f06f3`. It requires WebGL and its existing external Three.js module.

The screenshot gallery and collected games now live in [ActionDaveInRI.github.io](https://github.com/ActionDaveInRI/ActionDaveInRI.github.io), with their source under `projects/<game>/`. Projects already maintained in other repositories retain their own homes. The previous gallery and project source remain available in this repository's Git history; the migration retains that ancestry in the account-site repository too.

## Existing links

The root `/spaceship/` address now opens this demo. The gallery is at [actiondaveinri.github.io](https://actiondaveinri.github.io/); the old `/spaceship/projects/` and `/spaceship/projects.html` addresses reach it directly.

`pages-redirects.json` maps all 62 other HTML paths present at pre-migration commit `8d38d42dfab8e99e70031a0a5831b5e18fc6fad5` to their current destinations. This includes both original root game paths and the briefly published `/spaceship/projects/<game>/` paths, their archives, histories, and older Inkstar/WFC aliases. Compatibility directories contain only generated HTML handoffs. The collected source and runtime assets are maintained in the account-site repository.

The original Ship effects addresses reach `/spaceship/`. The historical Star Cluster `source/public/demo/index.html` addresses reach the complete playable Star Cluster build. That editable source page was designed for its own source server and used `/demo/` asset paths; its unchanged source and provenance are preserved in the new repository.

Redirects preserve query strings and fragments through JavaScript, with a link and HTML refresh fallback. All games remain on the same `https://actiondaveinri.github.io` origin, so existing origin-based browser saves remain available. The separate ChatGPT Sites origins retain their own saves.

## Maintain and verify

Edit the manifest, then run:

```sh
python3 scripts/compatibility.py
python3 scripts/check_pages.py
python3 -m unittest discover -s scripts -p 'test_*.py'
```

The generator refuses to overwrite an unmanaged page or redirect the root demo. The checker compares the full baseline HTML inventory, verifies every generated page, and checks the original demo's SHA-256. Tests execute the redirect JavaScript with ordinary and encoded queries/fragments.

**Deployment order:** publish and verify the account site first; only then publish this compatibility change. GitHub Pages serves `main` at the repository root with `.nojekyll`. Do not remove old routes when adding releases.

After both sites are deployed:

```sh
python3 scripts/check_pages.py --base https://actiondaveinri.github.io/spaceship/
```

This checks every old HTML path, index/directory/slashless form, the root demo, and canonical destination response. Compatibility responses and the demo must match this checkout exactly. The account-site checker separately verifies canonical game resources. These route checks do not replace interactive GPU/controller gameplay testing.
