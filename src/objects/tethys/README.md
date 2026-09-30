# Tethys

Saturn's moon Tethys on the Weirich et al. SPC shape model, with Cassini photographic mosaics, one Cassini ISS
photograph, SPC elevation and relative albedo, and two Cassini VIMS infrared maps. Shape-only views use the shared
neutral gray (#808080 sRGB), a display convention, not a measured colour; gaps keep the missing-data grid. The
[navigation marker](source/preparation/navigation.json) is a stylized identifier, not the lighting at the scene epoch.

## Sources

| View | Source and interpretation |
| --- | --- |
| Monochrome | [USGS Cassini mosaic](https://astrogeology.usgs.gov/search/map/tethys_cassini_global_mosaic_293m), 2012, about 293 m/pixel. Exactly zero marks gaps; other dark pixels remain observed. |
| Enhanced color | [PIA18439](https://www.jpl.nasa.gov/images/pia18439-color-maps-of-tethys-2014/), 2014. Ultraviolet/infrared colors extend beyond human vision; producer calibration, registration and photometric correction are retained. |
| ISS photograph | Cassini ISS narrow-angle frame [N1807429484](source/observations/N1807429484_1_CALIB.LBL), 11 April 2015, clear filters, about 1.1 km/pixel from 190,000 km. CISSCAL-calibrated I/F from the [PDS Ring-Moon Systems Node](https://opus.pds-rings.seti.org/opus/#/detail/co-iss-n1807429484). Camera from Cassini SPICE kernels in the shared [Cassini kernel bank](../../spice/cassini/manifest.json), refined to the limb. Empirical Lommel-Seeliger brightness; not measured albedo. |
| Shape and Elevation | [Weirich et al. 2025 SPC V1.0](https://doi.org/10.26033/hpv0-eh61); Elevation is radius minus 531 km, colored over −12.5 to +12.5 km. |
| Relative albedo | The same SPC release’s dimensionless brightness field, less validated than topography; not geometric albedo or calibrated reflectance. Its 0.5–1.5 display clips above 1.5. |
| Infrared and Ice absorption | [Nantes Cassini VIMS archive](https://vims.univ-nantes.fr/), 2007–2015. All 9 selected observations supply near-2.02 µm continuum-relative absorption; 7 supply near-2.02/1.59/1.28 µm false-color infrared after clipping exclusions. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/TETHYS/target) Tethys centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

Six labelled names carry a caption note from their English Wikipedia article (CC BY-SA 4.0), recorded in
`source/features/notes.json` and credited in the caption. The full SPC release is
[Weirich, Gaskell, Palmer and Domingue (2025)](https://sbn.psi.edu/pds/resource/weirichtethysshape.html), NASA PDS.
Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

**Shape.** The native Q128 OBJ has 98,306 vertices and 196,608 triangles. Preparation simplifies it to 2,000 faces
under a 5,310 m display ceiling (1% of the reference radius). Across 8,000 sampled points the distance to the source
surface has RMS 1036.86 m and maximum 3974.44 m. The Shape view uses neutral gray to separate geometry from imagery.

**Photographs.** The monochrome mosaic (11520 × 5760) is rolled by half a width into the shared 0–360° E map. The
enhanced-color map (13467 × 6734) has no validity mask, so dark terrain is not treated as missing. Both atlases sample their original grids directly with a 2 × 2 footprint
([sampling guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)) and use WebP
quality 95. No inpainting, polar repetition or color synthesis is applied.

**Elevation and albedo.** Preparation samples the equatorial map (55° S–55° N) and the two
polar maps on their own grids. Elevation is
`radius * 0.001 - 531`, in km above the 531 km reference sphere. Relative albedo is dimensionless, normalized around 1,
with no relief shading.

**ISS photograph.** The archive ships the calibrated image without geometry, so the camera comes from SPICE kernels at
mid-exposure. Restore them with `node packages/bake/cli/kernel-bank.mts acquire cassini`. A texel keeps the photograph
only when its image contributors lie within two pixel footprints of the source surface, emission is under 75°, the
point is within 5.31 km of the displayed mesh, and the camera can see it. The far side, night side and steep limb keep
the grid.

**VIMS.** Infrared maps channels near 2.02, 1.59 and 1.28 µm to red, green and blue with a common stretch and gamma
2.2. Ice absorption is `1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)`. Saturated, special and invalid
values are excluded per band, and gaps are not interpolated. The 1024 × 512 grid adds no native resolution. The
[recipe](source/cassini-ice/prepare.json) records wavelengths, masks and calibration.

## Evidence

| ISS check | Result |
| --- | --- |
| Range and phase against OPUS's geometry for this frame | Within 0.3 km and 0.001° |
| Limb residual before and after refinement, holdout edges | 6.7 px → 0.89 px RMS |
| Refinement rotation | 0.0061°, a 9.5 px boresight shift |
| Surface showing the photograph | 29.7% of the displayed surface area |
| Largest distance from the displayed mesh to the source surface | 4.39 km, within the 5.31 km limit |

Odysseus (near 30° N, 230° E) and [Ithaca Chasma](https://planetarynames.wr.usgs.gov/Feature/2751) (near 14° S,
353.9° E) check orientation and longitude of the photographic maps. VIMS evidence is in the
[body registration record](source/cassini-ice/evidence/registration.md) and
[preparation receipt](source/cassini-ice/preparation-receipt.json).

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `iss` | 1 | 0 | — | — | — | the `normal` map | 1 of 1 | — | 1 of 1 | — | — | no verdict |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The ISS photograph is one frame with an empirical Lommel-Seeliger law, and its reconstructed pointing needed a
  9.5 px limb correction. No published Tethys photometric model has been checked yet.
- Infrared covers about 14.8% and Ice absorption about 22.6% of reference-sphere solid angle. No resolved
  Odysseus-center registration is claimed for VIMS.
- VIMS has no photometric correction or cross-observation level matching, so neither view measures ice abundance.
  Infrared packing can soften mask edges.
- Photographic seams, coarse inserts, residual shading and local control-network differences remain. Enhanced-color
  hemisphere differences can reflect real dust and radiation alteration.
- The SPC map spacing is about 1.5 km, and its one-to-two-grid-spacing error estimate is not a per-cell uncertainty.
  Tethys used uncalibrated ISS images. The polar grids fall slightly short of 55° near cardinal longitudes, leaving
  narrow gray gaps.
- Photographic, elevation and albedo display atlases use quarter dimensions on the iPad footprint. This reduces
  display detail, not the source data.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
