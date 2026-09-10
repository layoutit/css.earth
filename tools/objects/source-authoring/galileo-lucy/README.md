# Galileo and Lucy bodies

New object packages: Dactyl, Dinkinesh and Selam. All use the existing authored-body preparation and PolyCSS renderer. Dactyl and Selam explicitly use illustrative current phases, with dashed context orbits and circular selection indicators.

## Reproduction

Run from the repository root, serially. The checked-in body inputs are sufficient for normal `prepare-authored`; the authoring commands below reconstruct them from the selected originals and published measurements.

1. Restore missing imagery/font inputs using each package’s acquisition recipe. Shape parameters, original CMOD, converted OBJ, reference records and attribution are checked in.
2. To reconvert Dinkinesh, run `python3 tools/objects/source-authoring/galileo-lucy/cmod.py src/planets/dinkinesh/source/shape/dinkinesh.cmod src/planets/dinkinesh/source/shape/model.obj --volume-equivalent-radius-km 0.369`. Dactyl and Selam’s checked-in `shape/model.json` files transcribe the cited dimensions directly.
3. Run `node tools/objects/source-authoring/galileo-lucy/orbits.mts` to regenerate illustrative mutual orbits and display orientation. Its retained Celestia input may be copied from Dactyl’s source/reference directory to `output/galileo-lucy/celestia/asteroids.ssc`.
4. Run `node packages/astronomy/tools/generate-asteroids.mts --object=dinkinesh` and `node packages/astronomy/tools/generate-scene-satellites.mts --object=dactyl,selam` when refreshing ephemerides. Retain the Horizons responses in the body source directory. The asteroid generator uses independent vector fixtures.
5. Catalogue entries live in each descriptor’s `properties.catalog`; physical values, retained orbit states and independent fixtures live in `packages/astronomy/data/bodies/<id>.json`. Run `pnpm prepare:catalog`, build the packages and preparation bundle, regenerate solar geometry, and run `node tools/objects/dist/prepare-authored.js <id> --write` once per new body. To rebuild title/context source images, run `node tools/objects/source-authoring/galileo-lucy/initialize.mts` first. `pin.mts` refreshes document and descriptor pins after authored source changes.
6. Run `pnpm prepare:navigation dactyl dinkinesh selam` for the three body-owned marker images. Ida already has a prepared context image; for a new parent without one, include that parent in the command. The selected-body serializer binds stable marker URLs with one tile, so other bodies’ transports do not change. Run `pnpm prepare:world-context` and `pnpm prepare:minimap` to rebuild the ignored combined views. Approximate orbit cues come from the retained astronomy state’s `provenance.placement`; no shared Sun body list needs editing.

The checked-in `source/preparation/photometry.json` files in Ida and Dinkinesh are authored inputs for the shared parent-point brightness calculation. Ida retains the original JPL SBDB response; Dinkinesh cites the pre-encounter WISE estimate and its uncertainty. Neither supplies a surface texture or an independently measured moon albedo.

Run `python3 -m unittest discover -s tools/objects/source-authoring/galileo-lucy -p 'test_*.py'`, the adjacent `orbits.test.mjs`, and the three body `source.test.mjs` suites. Shared spatial-context and retained-renderer tests verify that approximate placement survives preparation and changes only the displayed cues.

The CMOD converter rotates `[x,y,z]` to `[x,-z,y]`, centers the source bounding box and scales uniformly. It removes only exactly zero-area source triangles, whose original indices are recorded in `shape/model.json`. The remaining triangles retain their source winding and UVs. The shared preparer then reduces the mesh under its error bound. The original model has no qualified observed/fill texture mask, so no photographic texture is imported.

The moon orbit sources separate published constraints from assumed planes, periapsis and phase. Their effective gravitational parameter makes each display conic consistent with its period; it is not presented as a measured mass. No long-term integration, encounter-camera registration or current phase accuracy is claimed.
