# Europa

Europa is a standalone moon at `/europa/`, using the generic object contract.
It provides observed **Monochrome** and **Enhanced color** surfaces, shared camera and lighting,
and an orbital view with Jupiter at the focus of Europa's orbit.

Install only Europa's prepared assets:

```sh
pnpm install --frozen-lockfile
pnpm setup:assets --object=europa
pnpm dev
```

Open `http://127.0.0.1:4210/europa/`. Source imagery and other bodies' assets
are unnecessary to view Europa. Opening another object needs that object's assets.
Europa's inventory is 37 prepared files, approximately 46.9 MB, including Jupiter's
context image. The original mission images are needed only to reproduce assets.

For source reproduction and scientific limits, see [SOURCE.md](SOURCE.md).
The thin oxygen atmosphere is described in the factsheet; no visible halo or
unobserved surface is invented. This is a spherical globe, not a terrain model.

Focused checks:

```sh
node tools/objects/dist/operations.js verify europa
node --test tests/objects/unit/europa/*.test.mjs
pnpm test:browser http://localhost:4210 europa
node site/test/planet-browser-conformance.mjs http://127.0.0.1:4210 europa
```
