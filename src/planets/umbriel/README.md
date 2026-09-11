# Umbriel

## Sources

Monochrome uses Paul Schenk’s [2020 LPI Uranian satellites release](https://repository.hou.usra.edu/handle/20.500.11753/1687), original `uumap-cyl-180180.cub`. The unchanged ISIS3 file is losslessly gzipped; both original and compressed identities are pinned in the manifest. The source README is retained alongside it.

This is source-normalized imagery, not calibrated albedo or recovery of terrain in cast shadows. Resolution varies, acquisition shadows and processing seams can remain. A display stretch of 0–1950 source DN retains the bright Wunda ring’s tonal structure; it is not a physical reflectance scale. A narrower trial stretch was rejected because it clipped that feature. The original float data remain intact.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Umbriel (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where the bright Wunda ring on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

The neutral grid marks missing observations. The separate limb-profile product uses an older control network displaced by degrees and does not provide continuous elevation coverage.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="umbriel-source-record"></a>
<a id="dataset-survey"></a>

<details>
<summary>Methods and source notes</summary>

The 919 × 460 floating-point mosaic has a 4,000 m grid, a 584,700 m spherical reference, planetocentric latitude and east-positive longitude. Its bounds are −180…180°, center longitude 180°, and upper-left projected origin (−3,676,000, 920,000) m. These seemingly unusual center/bounds values are applied together, not reinterpreted as a conventional image longitude origin. Only ISIS special pixels are missing; observed low and negative values remain observations.

The embedded history records ISIS `photomet` on 2020-02-15 with ellipsoid angles, maximum emission 79° and incidence 89.7°, followed by filtering/mosaic processing.

Preparation samples at 5760 × 2880 with 64-pixel atlas gutters and 1024-pixel pole tiles to avoid projective face-edge undersampling. This does not add observational detail. WebP q95 encodes the final surface only. Missing observations use the shared neutral grid. Surface, pole, thumbnail, small minimap and 160-pixel context marker (capped by the native crop) derive from the same interpretation. Shared flood and directional lighting remain available. The spherical 452-face scene is a display approximation within the 2000-face budget, not a measured shape mesh.

**Dataset survey**

| Candidate | Disposition |
| --- | --- |
| Schenk 2020 corrected image cube | Included as Monochrome: controlled, mapped original with numeric validity and processing history. |
| Schenk `uumap_Zlimb.cub` | Excluded from Elevation: the release labels it a limb profile in map form. Its README warns this separate product uses an older control network displaced by degrees. Sparse limb measurements cannot supply a surface elevation map. |
| [Schenk and Moore 2023](https://www.hou.usra.edu/meetings/uranusflagship2023/eposter/8140.pdf) | Supports native 4 km imaging and limited Umbriel topography; no complementary extended terrain raster qualified. |
| [JPL legacy map catalog](https://space.jpl.nasa.gov/tmaps/uranus.html) | Older display texture; no additional scientific meaning over the corrected original. Replaced rather than a duplicate lens. |
| [PDS Voyager imaging archive](https://pds-rings.seti.org/voyager/iss/) | Original frames require independent calibration, registration and mosaic preparation. No better ready registered Umbriel product qualified here. |
| [Carbon oxide spectroscopy](https://arxiv.org/abs/2607.05600) | Hemispheric spectra are scientifically useful but do not provide a qualified spatial composition raster for this lens system. |
| NASA press photographs and interior models | Disc photographs are not longitude/latitude maps; inferred interiors are not observed surface data. No fabricated color or interior lens. |

[NASA’s Umbriel overview](https://science.nasa.gov/uranus/moons/umbriel/) supports the cratered appearance, bright Wunda region and Lassell’s 1851 discovery. Radius, synchronous rotation and orbital placement come from the existing vendored JPL/IAU astronomy records at the shared epoch. No visible atmosphere or rings are supported.

</details>
