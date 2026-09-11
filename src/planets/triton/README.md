# Triton

## Sources

Michael Bland / USGS, [High Resolution Voyager 2 Images of Neptune’s Moon
Triton](https://doi.org/10.5066/P9MGH7FB), 2023 processing of 1989 Voyager images.
We use the CLEAR-filter frames in `fully_processed.zip`, at their native
approximately 335–1633 m/pixel scales. Their calibrated float I/F, corrected
locations, per-frame GeoTIFF grids and ISIS metadata remain authoritative.
USGS removed reseaux and corner marks with local interpolation; we do not add
terrain, fill coverage or borrow another body's surface.

Paul Schenk / LPI's [2014 global color map](https://www.lpi.usra.edu/icy_moons/neptune/triton/),
`tnmap-cyl-KH.jpg`, 14,138 × 7,069, approximately 600 m/pixel at the equator.
LPI documents image selection, radiometric calibration, geographic registration,
photometric correction and mosaic assembly. NASA/JPL supplied Voyager images;
credit Paul Schenk, Lunar and Planetary Institute. Public use is permitted with
that credit. Orange/green/blue filter images approximate natural color with
enhanced contrast. Color resolution varies across observations.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

- The Gazetteer shapefile export for Triton publishes a diameter for only 4 of its 63 adopted names (the four craters); the other 59 rows carry neither a diameter nor a usable extent in the export, so preparation tallies them as skipped (`prepared/features.json`) and only the four craters are labelled until the export carries sizes.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Triton (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Bubembe Regio, Boynne Sulci and the named cavi all falling inside the Voyager coverage of the cylindrical mosaic coincide with the imagery.

The original unannotated LPI map runs from 180° W to 180° E, north at the top.
Preparation rolls it to the shared 0–360° east-positive globe convention.
The source's black northern region was not illuminated by Voyager. Exact black
background is withheld before resampling, and all interpolation taps must remain
valid. The USGS `GlobalFill` derivative is not used: it interpolates over map grid
lines. Neither color nor Monochrome silently fills the other's gaps.

Triton has a thin nitrogen atmosphere. These observations do not justify a
visible atmospheric halo or an elevation lens inferred from brightness.

No phase, atmosphere-scattering or terrain-shadow inversion is
claimed. Incidence/emission above 80° and amplification above 6 are withheld
geometrically; low brightness alone never marks missing terrain.

The per-frame Lunar-Lambert correction reduces acquisition shading;
it is not a recovered calibrated albedo map. Local terrain shading, source
resolution changes and some patch transitions remain. Frame-level correction
and exposure receipts are generated in `prepared/surfaces.json`.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="monochrome"></a>
<a id="enhanced-color"></a>
<a id="presentation-and-reproduction"></a>

<details>
<summary>Methods and source notes</summary>

The generic authored solid-body package provides one retained 452-leaf sphere,
shared shell, flood lighting and optional Sun Shadows. Its 1,352.6 km mean
radius, Neptune parent orbit, pole and synchronous retrograde rotation come from
the vendored JPL/NAIF/IAU astronomy sources. The opening camera faces measured
southern terrain. It does not move, stretch or replace observations.

**Monochrome**

The TIFFs and original ISIS metadata specify orthographic center **15° east,
18° north**, positive-east longitude, radius 1,352,600 m. The release prose says
15° west; the embedded grid and corresponding original label control these
pixels. The opposite orthographic hemisphere is rejected before sampling.
All bilinear samples must be observed; ISIS special values remain unavailable.

Correction runs on individual calibrated frames before composition, using the
existing Lunar-Lambert implementation (weight 0.5, 30° incidence / 0° emission
reference). Sun and Voyager 2 vectors are pinned JPL Horizons ICRF/km responses
at each ISIS cache epoch; the frame's own PCK00009 coefficients transform them
into the map's body frame. Horizons ephemerides can differ from the original
NEP081 kernels.

Coarser frames establish levels; finer valid observations replace them. Robust
co-located overlap ratios set one bounded exposure multiplier per frame
(0.67–1.5). Source detail stays within its own observation. The fixed display
transfer is I/F divided by 0.9 with gamma 1.4.

**Presentation and reproduction**

The 14,336 × 7,168 preparation grid retains approximately 593 m equatorial
texels. It does not make the coarser observations sharper. Source masks become
the shared gray coverage grid. Runtime surfaces use WebP q90 with lossless
alpha; poles and 640-pixel previews are prepared separately. Previews center
longitude zero so the observed region is continuous; globe coordinates stay
unchanged. Both datasets retain the app's flood and directional lighting.

</details>
