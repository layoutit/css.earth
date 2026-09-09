# Dimorphos source record

The surface is the released DART global SPC v004 encounter model, not a reconstruction of terrain after the impact. The 0.972 m OBJ release preserves 98,306 Cartesian vertices and 196,608 triangular plates in kilometers, with original origin, winding and connectivity. The archive reports a closed surface with volume 0.001759765951701106 km³ and dimensions approximately 178.44 × 169.25 × 114.60 m. The 75 m reference sphere rounds this model's volume-equivalent radius; it is not a gravitational datum.

Source: NASA PDS `urn:nasa:pds:dart_shapemodel:data_derived_dimorphos_model_v004`, Daly/Ernst and the DART shape-model team. Exact URL, byte size and SHA-256 are in `source/manifest.json`; original label and Software Interface Specification are retained in `source/reference/`. Model precision varies with DRACO/LICIACube coverage and SPC constraints. A closed model does not mean every facet was photographed with the same precision.

## Survey and disposition

- DART v003 and v004 global and local OBJ/FITS releases were reviewed. Adopted global v004 at 0.972 m spacing; finer releases add geometry beyond the displayed budget. Local 5 cm impact-region products do not replace the global body and are deferred.
- DRACO and LICIACube imagery contributes to the source model. Individual calibrated images require registered camera projection, coverage and photometry to become surface imagery; they are not silently used as global textures.
- **Included:** the released v004 SPC relative-albedo FITS field, using the existing source-facet material path introduced for Didymos. Its values and uncertainties are bound to the original Dimorphos mesh as described below.
- The v004 972 mm gravity-relative Slope FITS table is selected as its own scientific view, including modeled regions under the source gravity assumptions. Other ancillary fields remain unselected; slope is not relabeled as elevation.
- Shape uses the shared no-imagery grid and prepared directional lighting. Elevation uses source radius minus 75 m in meters, with cartographic relief; it is not measured impact displacement or height above an equipotential.

## Relative albedo

The original `dimorphos_g_0972mm_spc_alb_0000n00000_v004.fits` and its PDS4 label are pinned in `source/science/`. This is the encounter-facing SPC model's relative brightness field, not a photograph, absolute/geometric albedo, or a measurement of the post-impact surface. `SIGMA > 0` requires multiple contributing images in the archive; zero-sigma nominal values remain unavailable.

The FITS header names the selected OBJ, but its rows use a different facet order: 131,072 of 196,608 rows are permuted. Preparation resolves a complete bijection from recorded centroids to the exact original triangles within 1 mm. An independent Astropy/scipy cKDTree check gives a maximum correspondence residual of 0.024 mm, with every second-nearest candidate at least 0.289 m away. Duplicate, ambiguous or displaced centroids fail. The index-ordered Didymos path retains its original strict behavior.

There are 60,464 accepted facets and 136,144 withheld facets. The accepted triangles cover 31.2138% of the original mesh's summed area; this is an exact fraction of those model triangles, not a precision claim about the real surface. Display transfer uses the existing closest-source-point sampler and 2 m acceptance bound. Values span 0.451341–1.290672 and use a linear grayscale display range of 0.45–1.30. Unqualified facets and transfer gaps use the common neutral grid. No facet is filled from its neighbours.

## Geometry and lighting

The existing `source-meshoptimizer` path simplifies original indexed geometry with Meshoptimizer 1.2.0, ErrorAbsolute and RegularizeLight. Target: 800 faces, 2 m simplifier error limit, native PolyCSS `u` raster triangles, 128 px tiles. The resulting mesh is closed, connected and genus zero. On 8,192 equal-area directions, source-to-prepared radial differences average 0.500 m, p95 1.090 m, maximum 2.788 m; the simplifier estimate is 1.668 m. The estimator is not a maximum scientific error guarantee. No boulders or unobserved terrain are synthesized.

The displayed mesh uses the observed pre-impact pole (ICRF RA 69.70029°, declination −72.69527°) and an explicitly arbitrary display phase. The pre-impact 11.92177 h period is source metadata, not a post-impact attitude prediction. The fixed sunlight is illustrative in that display frame. Shadows default off; all lighting texels are prepared and runtime DOM remains retained.

The shared solar context uses the post-impact DART s547 Dimorphos trajectory relative to the Didymos primary, fitted to the existing precessing Kepler model over JD 2461256.5–2461316.5. The numeric application epoch is JD 2461286.5 (2026-09-03 TT). The source Horizons values are TDB, approximated as TT within 2 ms. Six independent vectors measure 54.003 m maximum positional residual and 3.135% radial residual. This is a compact display fit, not a long-term binary dynamics solution. Didymos's heliocentric center uses its pinned small-body elements; Dimorphos remains its satellite.

## Reproduction

Restore required inputs with the existing acquisition operations and verify each pinned byte. Run the authored object preparer for `dimorphos`; runtime consumers can download the separately published pinned scene inventory with `pnpm setup:assets --object=dimorphos`. Source/context/title/sky notices are retained beside the package. Qualification artifacts are under `output/asteroids-dart-radar/` in the implementation checkout.

## Gravity-relative slope and B2 terrain

Every one of the 196,608 slope-table rows is registered to its source triangle. Display colors use the closest point on the full-source mesh within the authored 2 m distance limit; they are not interpolated across facets. Original table row IDs are retained in the slope preparation atlas index.

The exact v004 972 mm PDS slope table is used, in degrees and including modeled regions. Its label defines gravity using uniform density, rotation and Didymos. A verified centroid bijection reconciles 131,072 exporter-order differences; all rows match uniquely within 0.001 m (maximum observed residual 0.00002393 m). That residual measures source registration, not scientific accuracy. This gravity-relative field remains distinct from radius-based elevation and from the separately qualified, positive-sigma relative-albedo coverage.

The slope facet-science flat preview is explicitly 640 × 320, with nearest, lossless
packing for its minimap and temporary projective textures. It makes 204,800
unique-ray queries; ambiguous radial intersections remain missing.
This is a display-preview resolution, not a new scientific grid. The complete
196,608-row slope table, native triangle atlas dimensions and original-row
atlas indices are unchanged. Native slope material colors still query the full source
surface directly and never sample this reduced flat preview. This preview contract
is specific to the B2 slope lens; relative albedo retains its own source-facet path.
