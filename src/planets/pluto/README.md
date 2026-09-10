# Pluto

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Color | [NASA/JHUAPL/SwRI MVIC mosaic](https://science.nasa.gov/resource/pluto-global-color-map/), published 20 January 2017. Published color, not calibrated true-color reflectance. |
| Monochrome | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m), July 2017; 24,888 × 12,444, east-positive longitude. |
| Elevation | [USGS stereo DEM](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m): signed metres above a 1,188.3 km sphere; −32,768 means missing. False-color scale −8 to +8 km. |
| Physical facts | Pinned [JPL](https://ssd.jpl.nasa.gov/planets/phys_par.html) and [NASA](https://science.nasa.gov/dwarf-planets/pluto/facts/) records; shared ESO/HYG sky and Inter title sources. |

## Evidence

The retained notes point to [unit checks](../../../tests/objects/unit/pluto) and [browser checks](../../../tests/objects/browser/pluto), and mentions separate capture/Saturn reports. They do not identify a dated report here; test definitions are not passing-run evidence.

[Source test definitions](../../../tests/objects/unit/pluto/source.test.mjs).

## Known problems

The mosaics and DEM have incomplete, uneven coverage. A gray grid marks identified gaps. The color JPEG uses only exactly-black pixels connected to the southern border, so a dark boundary fringe can remain. Nonzero dark pixels are preserved; no terrain is filled.

The sphere uses a 16 × 32 retained grid with 452 leaves. Display radius, camera,
full-phase curvature shading, initial longitude, and 84-second rotation are
authored presentation choices. Rotation is retrograde. The display axis uses
NASA's 57° description; it is not a solved IAU orientation at an observation
epoch. Sky orientation and the Sun are contextual, not a New Horizons camera
solution. All these choices are prepared; the browser only transports state.

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
domain. Each retained face's south-to-north coordinate is mapped into the
continuous source image before interpolation, including at latitude-band edges.
Polar leaves are resampled at prepare time. Regular-face projective warps are baked
into RGBA atlas cells; the browser retains affine frames and flat child textures.
This avoids Chrome's triangular projective-child flattening artifacts without
changing the shared renderer or deriving geometry at runtime.
Overlapping faces use matching expanded source coordinates. Each warped face
has a one-pixel source-sampled apron so its antialiased edge is covered by its
neighbor. These RGBA atlases use lossless WebP: lossy chroma subsampling produced
colored tile seams even with correct geometry and alpha. Map resolution and the
source-derived missing-coverage grid are unchanged.
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
