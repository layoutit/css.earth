# Galileo and Lucy bodies

New object packages: Dactyl, Dinkinesh and Selam. All use the existing authored-body preparation and PolyCSS renderer. Dactyl and Selam explicitly use illustrative current phases, with dashed context orbits and circular selection indicators.

## Reproduction

Run from the repository root, serially. The checked-in body inputs are sufficient for normal `prepare-authored`; the authoring commands below reconstruct them from the selected originals and published measurements.

1. Restore the pinned Celestia originals listed in `src/planets/dinkinesh/source/shape/` and `src/planets/dactyl/source/reference/`. `catalog.mjs` identifies the release. For a new scaffold, place these originals in `output/galileo-lucy/celestia/`; `scaffold.mjs` deliberately refuses to overwrite an existing package.
2. Run `node tools/objects/source-authoring/galileo-lucy/scaffold.mjs`, then `node tools/objects/source-authoring/galileo-lucy/orbits.mjs`.
3. Run `node packages/astronomy/tools/generate-asteroids.mjs --object=dinkinesh` and `node packages/astronomy/tools/generate-scene-satellites.mjs`. Retain the Horizons response in the body source directory. The asteroid generator uses its existing independent vector fixtures.
4. Run `node tools/objects/source-authoring/galileo-lucy/initialize.mjs` for title and navigation sources, then `node tools/objects/source-authoring/galileo-lucy/integrate.mjs` and `node tools/objects/source-authoring/galileo-lucy/pin.mjs`.
5. Build astronomy and preparation, regenerate solar geometry, then run `node tools/objects/dist/prepare-authored.js <id> --write` once per body.
6. Run `node tools/objects/source-authoring/galileo-lucy/navigation.mjs` to retain accepted marker pixels and prepare the three new markers. The script verifies unchanged existing recipes and exact visible pixel equality at both densities. Regenerate shared world context, then finalize object JSON for Dactyl, Dinkinesh, Selam, Ida and the Sun.

The checked-in `source/preparation/photometry.json` files in Ida and Dinkinesh are authored inputs for the shared parent-point brightness calculation. Ida retains the original JPL SBDB response; Dinkinesh cites the pre-encounter WISE estimate and its uncertainty. Neither supplies a surface texture or an independently measured moon albedo.

Run `python3 -m unittest discover -s tools/objects/source-authoring/galileo-lucy -p 'test_*.py'`, the adjacent `orbits.test.mjs`, and the three body `source.test.mjs` suites. Shared spatial-context and retained-renderer tests verify that approximate placement survives preparation and changes only the displayed cues.

The CMOD converter rotates `[x,y,z]` to `[x,-z,y]`, centers the source bounding box and scales uniformly. It removes only exactly zero-area source triangles, whose original indices are recorded in `shape/model.json`. The remaining triangles retain their source winding and UVs. The shared preparer then reduces the mesh under its error bound. The original model has no qualified observed/fill texture mask, so no photographic texture is imported.

The moon orbit sources separate published constraints from assumed planes, periapsis and phase. Their effective gravitational parameter makes each display conic consistent with its period; it is not presented as a measured mass. No long-term integration, encounter-camera registration or current phase accuracy is claimed.
