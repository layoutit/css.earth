# Ganymede

Standalone Ganymede through cssEarth's shared object contract. Monochrome and
Enhanced color use published USGS Voyager/Galileo mosaics; missing color and the
source's synthesized-red sector retain observed monochrome. See `SOURCE.md`.

```sh
node src/planets/ganymede/tools/acquire.mjs
node src/planets/ganymede/tools/prepare.mjs
node --test src/planets/ganymede/test/*.test.mjs
node src/planets/ganymede/test/smoke-browser.mjs http://localhost:4232
```

Prepared asset installation: `pnpm setup:assets --object=ganymede` after the
runtime inventory has been published. This does not download preparation TIFFs.
