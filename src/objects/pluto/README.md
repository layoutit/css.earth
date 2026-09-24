# Pluto

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

| View or property | Source and interpretation |
| --- | --- |
| Color | [NASA/JHUAPL/SwRI MVIC mosaic](https://science.nasa.gov/resource/pluto-global-color-map/), published 20 January 2017. Enhanced color from MVIC's blue, red and near-infrared filters, not natural color or calibrated reflectance. |
| Monochrome | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m), July 2017; 24,888 × 12,444, east-positive longitude. |
| Elevation | [USGS stereo DEM](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m): signed metres above a 1,188.3 km sphere; −32,768 means missing. Data run −4.10 to +6.49 km; false-color scale −8 to +8 km. |
| Methane, nitrogen and water ice | [Drozdov & Emelyanov (2026), Zenodo 18825240](https://zenodo.org/records/18825240), CC BY 4.0. Modeled surface fractions from five New Horizons LEISA scans on 14 July 2015. All three use the same 0–100% scale; they are infrared spectral fits, not photographs. |
| Opening view | The side New Horizons approached: its reverse inbound velocity in the IAU body frame at closest approach, 146.5°E, 43.2°N, computed from the [NAIF New Horizons SPICE archive](https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/) (`nh_recon_pluto_od122_v01`, `nh_plu047_od122`, `pck00011`) by [the approach recipe](source/preparation/approach.json) and checked against SpiceyPy ([`tools/spice/approach.test.mts`](../../../tools/spice/approach.test.mts)). |
| Physical facts | Pinned [JPL](https://ssd.jpl.nasa.gov/planets/phys_par.html) and [NASA](https://science.nasa.gov/dwarf-planets/pluto/facts/) records. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/PLUTO/target) Pluto centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels depend on their size on screen, and a selected feature stays labelled. Available in all six views. |

## Evidence

The LEISA reader matches 192 independent Astropy/NumPy sample decisions and the
accepted cell counts for all three ice maps. The unchanged native maps give
69.31% methane-rich ice and 19.88% nitrogen-rich ice averaged over 60–90° N,
matching the paper's rounded 69% and 20% in section 3 and Figure 9.
[Pinned reference values](../../../tests/objects/fixtures/pluto/leisa-astropy.json)
and [the comparison test](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/pluto/leisa.test.mts)
identify the exact source files and oracle versions. These checks establish
decoding, source sampling and the declared mask; they do not validate the
authors' spectral inversion.

The [LEISA validation record](evidence/leisa/validation.json) identifies the
tested inputs and code. All six views passed dataset interaction checks at
DPR 1 and 2. A the shared browser conformance harness
verifies the actual latitude and pole texture bindings on desktop and mobile,
450 retained surface pieces, and shadows off at startup. The original FITS
files restored from Zenodo into an empty directory; all 125 runtime files
restored from their published content-addressed URLs. Repreparation reproduced
the complete asset inventory exactly. Broader shared-test failures are recorded
separately and are not a full-suite pass.

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| monochrome | 147.4 → 172.8 kB |
| surface | 207.2 → 209.6 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/pluto/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

Pluto uses the shared raster lane used by Mercury, Venus and Mars. Photographs,
elevation and composition share the existing geometry, camera and lighting bank.

The retained notes point to [unit checks](https://github.com/layoutit/css.earth/tree/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/pluto) and the shared browser conformance harness, and mentions separate capture/Saturn reports. They do not identify a dated report here; test definitions are not passing-run evidence.

Declared inputs are checked by the shared source manifest coverage check.

## Known problems

LEISA fractions depend on the assumed ice optical properties and the fitting
method. The paper reports residual scan seams and sensitivity of Sputnik
Planitia's nitrogen fraction to the assumed nitrogen absorption. Formal errors
do not include every model or calibration uncertainty. Gray grid means no
usable fit under the display policy below; it does not mean zero ice.
The maps have nominal 7 km cells, with varying effective resolution and
registration accuracy. They cannot support close-up geological detail.

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

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="pluto-source-and-presentation-contract"></a>
<a id="pinned-inputs"></a>
<a id="observation-limits-and-authored-choices"></a>
<a id="reproduction-and-evidence"></a>

<details>
<summary>Methods and source notes</summary>

**LEISA ice composition**

[Drozdov & Emelyanov, Icarus 452 (2026), 117031](https://doi.org/10.1016/j.icarus.2026.117031)
combine five calibrated LEISA scans and fit a four-material Hapke mixture.
We use their baseline least-squares solution, `params_ls.fits`, and its matching
`params_ls_errors.fits`, from the versioned release
[10.5281/zenodo.18825240](https://zenodo.org/records/18825240).
The dataset has CC BY 4.0 terms; the manuscript has separate terms.
The authors prefer this solution over the chi-squared fit, which creates a
strong polar discontinuity. Alternative fits are not extra dataset rows.
Temperature is excluded because the paper identifies unphysical upper-bound
solutions; grain sizes and the tholin proxy are outside this three-ice view.

The native files have an empty primary HDU and ten float32 IMAGE extensions,
each 1,067 × 534. Extensions 1–3 contain methane-rich ice, nitrogen-rich ice and
water-ice area fractions in percent. Their names, units, primary solution name,
`IMAGKN2 = 'k = 0'`, dimensions, byte order and unscaled encoding are checked.
No Hapke inversion, sharpening, photo-detail injection or smoothing runs here.

The FITS headers omit WCS. Section 2.4 describes 7 km equirectangular maps;
Figure 6 establishes east longitude increasing from 0° to 360° and north up.
We map the nearly 2:1 array over the full sphere (+90° to −90° latitude),
sampling cell centres. Its Sputnik feature, blank footprint and northern
averages agree with the publication in this orientation. This is regional map
registration; the release does not provide subpixel coordinate metadata.
The existing Pluto map frame also starts at 0° E. The original figure is a
coordinate reference and is not used as a texture.

Uncomputed cells are finite, not NaN: all ten parameters retain the tuple
`[25, 25, 25, 25, float32(0.06), float32(0.06), float32(0.06), float32(0.06), -1, 40]`.
The error file repeats it. This inferred initialization signature matches the
blank footprint in Figure 6 and includes the impossible negative solubility.
We withhold the complete tuple, not individual 25% values. It occurs in 335,273
cells. Valid zero or low fractions remain values of the fitted model.

The corresponding component error must be finite and between 0 and 100
percentage points. The upper limit is our display choice: an error exceeding
the entire fraction scale provides no useful constraint. It is not an author
confidence threshold. We do not claim the remaining cells are precise, or that
small formal errors cover systematic uncertainty. Sampling is nearest-cell
before the missing-coverage grid is painted, so missing neighbours are never
used to interpolate a fraction.

| Ice view | Accepted native cells | Fraction of the sphere, area weighted |
| --- | ---: | ---: |
| Methane | 213,048 | 34.28% |
| Nitrogen | 210,515 | 34.04% |
| Water | 204,625 | 32.58% |

The display uses one linear viridis palette and one 0–100% legend for all three
fractions. Pole tiles, thumbnails and minimaps use the same interpretation.
Globe lighting supplies the existing curvature shading; colors are a numeric
scale, not physical surface color. Mesh and camera parameters are unchanged.

The reference fixture was calculated with Astropy 8.0.1 and NumPy 2.5.3 in the
repository oracle environment, opening both original FITS files independently.
It samples 64 fixed random cells per component (NumPy seeds 18825241–18825243),
applies the tuple/error policy to the native arrays, and sums
`cos(90° − (row + 0.5) × 180° / 534)` for area weighting. The northern mean is
computed before the error cutoff to match the paper's published quantity.

Pluto is a standalone dwarf planet in the shared object shell. Charon and the
other moons are not mounted. This is a source-backed presentation, not an
epoch-specific ephemeris or a pixel-identical OpenSpace recreation.

**Pinned inputs**

Exact byte counts, SHA-256 hashes, download URLs, credits, and consumers are in
`source/manifest.json`. Preparation fails on changed or undeclared input bytes.
The provider pages and labels are checked in alongside the data.

**Observation limits and authored choices**

The full 2:1 maps use north-to-south latitude rows and a common 0–360° longitude
domain. The shared raster lane paints each lens at 2,048 × 1,024 (DPR 1) and
4,096 × 2,048 (DPR 2), packs 16 latitude bands with a 16-texel gutter and
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
  It is enhanced color from MVIC's blue, red and near-infrared filters, not natural
  color or calibrated reflectance.
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
  period 247.92065 years. The 39.482 AU solar semimajor axis is the Pluto row of JPL's approximate-positions Table 1 (J2000, a = 39.48211675 AU); JPL's current page has dropped Pluto, so it is checked against the [archived table](https://web.archive.org/web/20190803153746/https://ssd.jpl.nasa.gov/txt/p_elem_t1.txt).
  <https://ssd.jpl.nasa.gov/planets/phys_par.html>
  <https://science.nasa.gov/dwarf-planets/pluto/facts/>

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
