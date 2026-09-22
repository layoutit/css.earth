# Umbriel

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Monochrome uses Paul Schenk’s [2020 LPI Uranian satellites release](https://repository.hou.usra.edu/handle/20.500.11753/1687), original `uumap-cyl-180180.cub`. The unchanged ISIS3 file is losslessly gzipped; both original and compressed identities are pinned in the manifest. The source README is retained alongside it.

This is source-normalized imagery, not calibrated albedo or recovery of terrain in cast shadows. Resolution varies, acquisition shadows and processing seams can remain. A display stretch of 0–1950 source DN retains the bright Wunda ring’s tonal structure; it is not a physical reflectance scale. A narrower trial stretch was rejected because it clipped that feature. The original float data remain intact.

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| normal | 74.5 → 85.0 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/umbriel/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the terrestrial solid-observation lane was retired for Umbriel; the same pinned inputs and the same decoders (`terrestrial-observation` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — native ISIS cube 919 × 460; the retired 5760 × 2880 atlas was an upsample. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js umbriel --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/umbriel/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 6587).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

No dated test report is cited in the existing source notes.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Umbriel (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where the bright Wunda ring on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

Feature notes: 4 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The neutral grid marks missing observations. The separate limb-profile product uses an older control network displaced by degrees and does not provide continuous elevation coverage.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="umbriel-source-record"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

The 919 × 460 floating-point mosaic has a 4,000 m grid, a 584,700 m spherical reference, planetocentric latitude and east-positive longitude. Its bounds are −180…180°, center longitude 180°, and upper-left projected origin (−3,676,000, 920,000) m. These seemingly unusual center/bounds values are applied together, not reinterpreted as a conventional image longitude origin. Only ISIS special pixels are missing; observed low and negative values remain observations.

The embedded history records ISIS `photomet` on 2020-02-15 with ellipsoid angles, maximum emission 79° and incidence 89.7°, followed by filtering/mosaic processing.

Preparation samples at 5760 × 2880 with 64-pixel atlas gutters and 1024-pixel pole tiles to avoid projective face-edge undersampling. This does not add observational detail. WebP q95 encodes the final surface only. Missing observations use the shared neutral grid. Surface, pole, thumbnail, small minimap and 160-pixel context marker (capped by the native crop) derive from the same interpretation. Shared flood and directional lighting remain available. The spherical 450-face scene is a display approximation within the 2000-face budget, not a measured shape mesh.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

[NASA’s Umbriel overview](https://science.nasa.gov/uranus/moons/umbriel/) supports the cratered appearance, bright Wunda region and Lassell’s 1851 discovery. Radius, synchronous rotation and orbital placement come from the existing vendored JPL/IAU astronomy records at the shared epoch. No visible atmosphere or rings are supported.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 584.7 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 4.1445-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, -30.59° initial pitch, -99.19° yaw, taken from the retired lane's camera).

</details>
