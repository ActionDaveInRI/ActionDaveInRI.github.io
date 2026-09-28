# First Light portable source · v0.10.1

Game modules exported from source commit `d319e719c1ae2bfb3e2391cac129865a467944cd`.

From this directory, with Node 22.13+ and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The build writes `public/First-Light.html`, a single self-contained game file. Copy it to `../index.html` for the public release after testing. The upstream dependency versions and lockfile are retained; Sites authentication, server and deployment modules are excluded.

The only source adaptations are a portable package script, creating the output directory, and reading the v0.4 migration test fixtures from files instead of the separate development Git history. Gameplay, graphics, input and sound modules are unchanged.

See [release details](../README.md) and [source provenance](../source-provenance.json).
