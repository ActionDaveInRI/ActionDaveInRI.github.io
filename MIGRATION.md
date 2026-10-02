# Main portfolio migration

## Cutover status

Prepared and locally verified; **not deployed**. The existing `spaceship/main` remains the publishing branch at commit `8d38d42dfab8e99e70031a0a5831b5e18fc6fad5`. Creation of `ActionDaveInRI/ActionDaveInRI.github.io` and its Pages configuration require GitHub account setup, which the connected repository editor does not expose. Browser sign-in was not completed.

Two preparation branches preserve the work in the existing repository:

- `migration/main-portfolio`: the complete new account website, including the screenshot gallery, collected games, source history and tooling. **Publish this branch's contents to the new repository, not to `spaceship/main`.**
- `migration/restore-spaceship`: the original Spaceship demo and compatibility pages. Publish this to `spaceship/main` only after the account website is deployed and verified.

## Intended addresses

| Content | Canonical URL | Source repository |
|---|---|---|
| Screenshot gallery | `https://actiondaveinri.github.io/` | `ActionDaveInRI/ActionDaveInRI.github.io` |
| Collected games | `https://actiondaveinri.github.io/projects/<game>/` | `ActionDaveInRI.github.io/projects/<game>/` |
| Original Spaceship demo | `https://actiondaveinri.github.io/spaceship/` | `ActionDaveInRI/spaceship` |
| Projects with their own repositories | Existing URLs | Existing repositories |

The gallery retains all 22 entries and 15 real screenshots. Thirteen collection directories move, including Nebula Weave outside the gallery. The fourteenth former directory, Ship effects, returns to its original Spaceship repository; its gallery ID stays `ship-effects`.

## Publish in order

1. Create the public account-site repository `ActionDaveInRI/ActionDaveInRI.github.io`. Preserve the full Git history, rather than uploading a ZIP or squashing the source tree. One route is GitHub's repository importer using the public `ActionDaveInRI/spaceship` repository, then setting `main` to the imported `migration/main-portfolio` commit. Alternatively, create an empty repository and push the preparation branch with Git:

   ```sh
   git clone --branch migration/main-portfolio https://github.com/ActionDaveInRI/spaceship.git portfolio
   cd portfolio
   git remote set-url origin https://github.com/ActionDaveInRI/ActionDaveInRI.github.io.git
   git push origin HEAD:main
   ```

   These commands run on a machine already authorized to push to the account. No rewritten or force-pushed history is needed.

2. Configure the new repository's GitHub Pages source to deploy `main`, folder `/ (root)`. The `.nojekyll` file is already present. Wait for successful deployment before changing `spaceship/main`.
3. From a full clone of the account website, run:

   ```sh
   python3 scripts/build_gallery.py
   python3 -m unittest discover -s scripts -p 'test_*.py'
   python3 scripts/check_standalone.py
   python3 scripts/check_pages.py --base https://actiondaveinri.github.io/
   ```

   Check that the public homepage displays the screenshot cards, filters and search, and that screenshot and Open project links launch the intended games. At this intermediate stage the Spaceship card still reaches the previous gallery until step 4.
4. Recheck the current `spaceship/main` for intervening changes, then merge `migration/restore-spaceship` normally. Its existing Pages deployment can continue publishing `main` at the repository root.
5. After that deployment succeeds, run the compatibility branch's checker:

   ```sh
   python3 scripts/check_pages.py --base https://actiondaveinri.github.io/spaceship/
   ```

   Check a live legacy game link with a query and fragment, Inkstar/WFC aliases, history pages, both `/spaceship/projects` forms, and the restored root demo. Record actual deployed commit IDs and results in `GALLERY-QA.md`.

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

These are local checks, not a claim that the new public website is deployed. Live post-cutover verification and interactive GPU/audio/controller checks remain pending. The move does not change gameplay code.

## Rollback

If the account site fails before the second deployment, leave `spaceship/main` unchanged while fixing it. If the compatibility deployment fails, revert that migration commit normally in `spaceship`, allowing Pages to republish the previous working gallery and collection. Keep the new account site available during repair so links already shared there remain usable. Do not delete either repository or rewrite its history.
