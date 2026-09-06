# Ganymede

Standalone Ganymede through cssEarth's shared object contract. Monochrome and
Enhanced color use published USGS Voyager/Galileo mosaics; missing color and the
source's synthesized-red sector retain observed monochrome. See `SOURCE.md`.

```sh
node tools/objects/dist/operations.js acquire ganymede --refresh
node tools/objects/dist/prepare-authored.js ganymede --write
node --test tests/objects/unit/ganymede/*.test.mjs
node tests/objects/browser/ganymede/smoke-browser.mjs http://localhost:4232
```

Prepared asset installation: `pnpm setup:assets --object=ganymede` after the
runtime inventory has been published. This does not download preparation TIFFs.
