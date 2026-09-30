# Prepared migration from spaceship to projects

Status: prepared and locally verified; not deployed. The current `spaceship` production site is unchanged.

The new canonical repository and GitHub Pages path are intended to be `ActionDaveInRI/projects` and `https://actiondaveinri.github.io/projects/`. Create and deploy the new repository before changing any old gallery entrypoint.

## Publication sequence

1. Create `projects` by importing or copying the existing complete repository and history; include the changes on this migration branch. Keep it public, matching the existing audience, and enable Pages from `main` at the repository root.
2. Wait for successful Pages deployment. Check every catalog launch and screenshot, game asset requests, representative game loading, and desktop/mobile gallery layout at `/projects/`.
3. Only after those checks pass, redirect the old `/spaceship/` gallery root and project-directory entrypoint to their `/projects/` counterparts. Preserve query strings and fragments.
4. Keep the old `/spaceship/` runtime, assets, source downloads and historical builds available as compatibility snapshots. Direct old game bookmarks continue to open those preserved builds; new gallery visits use the canonical `/projects/` builds. Future releases target `projects` only. Do not delete or unpublish `spaceship`.
5. Verify both sets of public links. Update the old repository README to identify `projects` as the active home and describe the preserved compatibility builds.

## Verified before publication

- 341 files remained byte-identical to the existing working tree; only seven root/gallery files changed. No game/source/history files were changed, removed or added.
- All 39 migrated catalog URL fields resolve locally; all 82 local links/resources across root HTML pages resolve.
- Records for projects in other repositories are unchanged.
- Existing standalone checks pass. Island Three's current screenshot decodes and its card renders at desktop and 390-pixel mobile widths without horizontal overflow.
- Games use fixed localStorage keys on `actiondaveinri.github.io`, not path-derived save keys. Keeping the same scheme and hostname should preserve those saves; actual user saves were not inspected or modified.
- Historical READMEs/about pages and legacy Inkstar wrappers retain some valid `/spaceship/` links. These depend on keeping the compatibility host available.

## Why this is not a simple rename

GitHub redirects repository links when a repository is renamed, but does not automatically redirect GitHub Pages project URLs. A plain rename would therefore break existing `/spaceship/` links. Creating and verifying the new deployment first avoids that outage.

The GitHub connector supports file and branch operations but did not expose repository creation, renaming or Pages administration. Browser sign-in was declined; those operations remain pending.
