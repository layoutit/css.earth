# Dimorphos source record

The surface is the released DART global SPC v004 encounter model, not a reconstruction of terrain after the impact. The 0.972 m OBJ release preserves 98,306 Cartesian vertices and 196,608 triangular plates in kilometers, with original origin, winding and connectivity. The archive reports a closed surface with volume 0.001759765951701106 km³ and dimensions approximately 178.44 × 169.25 × 114.60 m. The 75 m reference sphere rounds this model's volume-equivalent radius; it is not a gravitational datum.

Source: NASA PDS `urn:nasa:pds:dart_shapemodel:data_derived_dimorphos_model_v004`, Daly/Ernst and the DART shape-model team. Exact URL, byte size and SHA-256 are in `source/manifest.json`; original label and Software Interface Specification are retained in `source/reference/`. Model precision varies with DRACO/LICIACube coverage and SPC constraints. A closed model does not mean every facet was photographed with the same precision.

## Survey and disposition

- DART v003 and v004 global and local OBJ/FITS releases were reviewed. Adopted global v004 at 0.972 m spacing; finer releases add geometry beyond the displayed budget. Local 5 cm impact-region products do not replace the global body and are deferred.
- DRACO and LICIACube imagery contributes to the source model. Individual calibrated images require registered camera projection, coverage and photometry to become surface imagery; they are not silently used as global textures.
- Released SPC relative-albedo FITS is a per-facet binary table with uncertainty. The facet-table decoder is available, but this candidate remains excluded because finite values and zero sigma do not establish photographed coverage. Its source limits do not support treating every modeled facet as observed albedo.
- The v004 972 mm gravity-relative Slope FITS table is selected as its own scientific view, including modeled regions under the source gravity assumptions. Other ancillary fields remain unselected; slope is not relabeled as elevation.
- Shape uses the shared no-imagery grid and prepared directional lighting. Elevation uses source radius minus 75 m in meters, with cartographic relief; it is not measured impact displacement or height above an equipotential.

## Geometry and lighting

The existing `source-meshoptimizer` path simplifies original indexed geometry with Meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight. Target: 800 faces, 2 m simplifier error limit, native PolyCSS `u` raster triangles, 128 px tiles. The resulting mesh is closed, connected and genus zero. On 8,192 equal-area directions, source-to-prepared radial differences average 0.500 m, p95 1.090 m, maximum 2.788 m; the simplifier estimate is 1.668 m. The estimator is not a maximum scientific error guarantee. No boulders or unobserved terrain are synthesized.

The displayed mesh uses the observed pre-impact pole (ICRF RA 69.70029°, declination −72.69527°) and an explicitly arbitrary display phase. The pre-impact 11.92177 h period is source metadata, not a post-impact attitude prediction. The fixed sunlight is illustrative in that display frame. Shadows default on; all lighting texels are prepared and runtime DOM remains retained.

The shared solar context uses the post-impact DART s547 Dimorphos trajectory relative to the Didymos primary, fitted to the existing precessing Kepler model over JD 2461256.5–2461316.5. The numeric application epoch is JD 2461286.5 (2026-09-03 TT). The source Horizons values are TDB, approximated as TT within 2 ms. Six independent vectors measure 54.003 m maximum positional residual and 3.135% radial residual. This is a compact display fit, not a long-term binary dynamics solution. Didymos's heliocentric center uses its pinned small-body elements; Dimorphos remains its satellite.

## Reproduction

Restore required inputs with the existing acquisition operations and verify each pinned byte. Run the authored object preparer for `dimorphos`; runtime consumers can download the separately published pinned scene inventory with `pnpm setup:assets --object=dimorphos`. Source/context/title/sky notices are retained beside the package. Qualification artifacts are under `output/asteroids-dart-radar/` in the implementation checkout.

## B2 facet science and terrain

Every one of the 196,608 source table rows is registered to its source triangle. Display colors use the nearest full-source triangle within the authored distance limit; they are not interpolated across facets. Original table row IDs are retained in the preparation atlas index.

The exact v004 972 mm PDS slope table is used, including modeled regions. Its label defines gravity using uniform density, rotation and Didymos. A verified centroid bijection reconciles 131,072 exporter-order differences; all rows match uniquely within 0.001 m (maximum observed residual 0.00002393 m). That residual measures source registration, not scientific accuracy. The separately reviewed relative-albedo candidate remains withheld as a lens because finite values and zero sigma do not establish photographed coverage.

The facet-science flat preview is explicitly 640 × 320, with nearest, lossless
packing for its minimap and temporary projective textures. It makes 204,800
unique-ray queries per lens; ambiguous radial intersections remain missing.
This is a display-preview resolution, not a new scientific grid. The complete
196,608-row source tables, native triangle atlas dimensions and original-row
atlas indices are unchanged. Native material colors still query the full source
surface directly and never sample this reduced flat preview.
