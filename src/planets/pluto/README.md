# Pluto

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Color | [NASA/JHUAPL/SwRI MVIC mosaic](https://science.nasa.gov/resource/pluto-global-color-map/), published 20 January 2017. Published color, not calibrated true-color reflectance. |
| Monochrome | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m), July 2017; 24,888 × 12,444, east-positive longitude. |
| Elevation | [USGS stereo DEM](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m): signed metres above a 1,188.3 km sphere; −32,768 means missing. False-color scale −8 to +8 km. |
| Physical facts | Pinned [JPL](https://ssd.jpl.nasa.gov/planets/phys_par.html) and [NASA](https://science.nasa.gov/dwarf-planets/pluto/facts/) records; shared ESO/HYG sky and Inter title sources. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/PLUTO/target) Pluto centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite remains 512 × 256 pixels at density 1 and 1024 × 512 at density 2; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| monochrome | 147.4 → 172.8 kB |
| surface | 207.2 → 209.6 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/pluto/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Lane change (this PR): the static-surface lane was retired for Pluto; the same pinned inputs and observation interpretation (coverage grid, signed DEM decoding, relief) now feed the shared raster lane used by Mercury, Venus and Mars. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request.

The retained notes point to [unit checks](../../../tests/objects/unit/pluto) and [browser checks](../../../tests/objects/browser/pluto), and mentions separate capture/Saturn reports. They do not identify a dated report here; test definitions are not passing-run evidence.

Pinned inputs are checked by the shared [source closure test](../../../tests/objects/source-closure.test.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Pluto (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 0° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Sputnik Planitia on the New Horizons colour mosaic coincide with the imagery.

Feature notes: 21 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

The mosaics and DEM have incomplete, uneven coverage. A gray grid marks identified gaps. The color JPEG uses only exactly-black pixels connected to the southern border, so a dark boundary fringe can remain. Nonzero dark pixels are preserved; no terrain is filled.

The sphere is the shared raster-lane mesh: 230 units, 16 latitude bands and 32
longitude segments, 450 leaves, the 50-pixel tile and the shared
[seam treatment](../../../docs/surface-preparation.md#reduce-geometry-and-bake-the-atlas): a half-texel raster overscan and a stepped outset.
Display radius, camera, spin origin (180°, keeping the Sputnik Planitia face of
the retired lane) and the 84-second retrograde visual rotation are authored
presentation choices. The pole, prime meridian and Sun direction at the shared
epoch now come from the IAU/WGCCRE rotation model in
`src/platform/solar-geometry.mts`; the body record carries the NSSDC obliquity
of 119.51° (`source/editorial/factsheet-review.json`) rather than the retired
lane's rounded 57° display tilt. Lighting is the Mercury-style Lambert bank
(Shadows toggle) with no atmosphere material; Pluto's real haze layers are not
modelled. Sky orientation is contextual, not a New Horizons camera solution.
All these choices are prepared; the browser only transports state.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="pluto-source-and-presentation-contract"></a>
<a id="pinned-inputs"></a>
<a id="observation-limits-and-authored-choices"></a>
<a id="reproduction-and-evidence"></a>

<details>
<summary>Methods and source notes</summary>

Pluto is a standalone dwarf planet in the shared object shell. Charon and the
other moons are not mounted. This is a source-backed presentation, not an
epoch-specific ephemeris or a pixel-identical OpenSpace recreation.

**Pinned inputs**

Exact byte counts, SHA-256 hashes, download URLs, credits, and consumers are in
`source/manifest.json`. Preparation fails on changed or undeclared input bytes.
The provider pages and labels are checked in alongside the data.

**Observation limits and authored choices**

The full 2:1 maps use north-to-south latitude rows and a common 0–360° longitude
domain. The shared raster lane paints each lens at 4,096 × 2,048, two texels
per layout pixel, packs 16 latitude bands with a 16-texel gutter and
prepares 256-pixel orthographic polar tiles; the retained faces are the shared
projective sphere leaves used by Mercury, Venus and Mars. The retired lane's
inverse-homography RGBA atlas and its lossless seam treatment are gone with it.
The source-derived missing-coverage grid is unchanged and is painted before
packing, so no gap is interpolated.
The DEM uses nearest source samples before this atlas conversion. Its authored
blue/tan/red palette is linear at −8/0/+8 km and clips outside that range.
Terrain shading is derived from that same signed DEM using latitude-corrected spacing on its 1,188,300 m reference sphere. A fixed northwest light at 45° elevation and 25% ambient reveals slopes, with no vertical exaggeration. Where a neighbouring elevation is missing, no slope is invented. Color encodes height; brightness encodes terrain relief. The blue/tan/red endpoints use stronger contrast while keeping the same −8/0/+8 km scale. This does not displace geometry or represent surface color.

**Reproduction and evidence**

- **Color:** NASA/JHUAPL/SwRI, New Horizons Ralph/MVIC three-filter global mosaic,
  published January 20, 2017. North is up; Sputnik Planitia is near the center.
  This is the published color product, not calibrated true-color reflectance.
  <https://science.nasa.gov/resource/pluto-global-color-map/>
- **Monochrome:** NASA/JHUAPL/SwRI/LPI through USGS, LORRI/MVIC July 2017 mosaic,
  24,888 × 12,444 pixels, equirectangular, positive-east 0–360° longitude.
  <https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m>
- **Elevation:** the matching USGS stereo DEM. Signed 16-bit samples are metres
  relative to a 1,188.3 km sphere; −32,768 means no data. Its ISIS label pins the
  grid, projection, unit multiplier, and reference radius. The TIFF reader checks
  signedness, compression, strip bounds, and no-data metadata. It does not pass
  negative elevations through an unsigned image conversion.
  <https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m>
- **Physical facts:** the [selected JPL Pluto row values](source/orbit/jpl-physical.json)
  and NASA's Pluto facts record. Preparation checks their identities and values. The
  radius is 1,188.3 km; density 1.853 g/cm³; sidereal rotation −6.3872 days; orbital
  period 247.92065 years. NASA supplies the rounded mean solar distance of 39 AU.
  <https://ssd.jpl.nasa.gov/planets/phys_par.html>
  <https://science.nasa.gov/dwarf-planets/pluto/facts/>
- **Sky and title:** checked ESO/S. Brunier panorama (CC BY 4.0), HYG v4.1
  registration field (CC BY-SA 4.0), and pinned Inter outlines (SIL OFL 1.1).
  These use the existing shared preparation recipes, not a Pluto star simulation.

Neither mosaic nor DEM covers all of Pluto. Source resolution varies across the
flyby mosaic. A neutral gray cartographic grid marks identified gaps; it is not
terrain or inferred observations. The source maps remain unchanged on disk.
For the color JPEG, only exactly black pixels connected to the southern border
are marked. Nonzero JPEG edge pixels remain untouched, so a dark boundary fringe
can remain. The monochrome product reserves zero for gaps; the DEM uses −32,768.
Coverage is sampled separately before image interpolation. No surface is inpainted.
The navigation icon and resolved context billboard apply this same coverage
treatment before resizing and the circular silhouette mask. Missing observations
remain a neutral grid inside the complete disc, rather than black holes against
space; this is a context illustration, not a reconstructed observation.
The disc has prepared full-phase curvature shading (35% ambient, 65% diffuse),
using the same footprint as its circular mask. This display shading adds depth
without a directional terminator or inferred terrain relief.

</details>
