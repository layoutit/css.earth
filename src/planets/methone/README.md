# Methone

## Sources

- Methone uses its measured smooth ellipsoid and a **Monochrome** Cassini view.

- [Thomas et al. (2013)](https://doi.org/10.1016/j.icarus.2013.07.022) give semi-axes 1.94 ± 0.02, 1.29 ± 0.04 and 1.21 ± 0.02 km, with a mean radius of 1.45 ± 0.03 km.

- The selected exposure midpoint is 2012-05-20T07:09:49.699 UTC.

## Evidence

- The mission `methone_mst2013.bpc`, `cas_rocks_v18.tf`, reconstructed spacecraft CK and ISS frame/instrument kernels independently fix the north clock angle at 179.9162 degrees. `survey/source-camera.json` records the matrix, exact kernel URLs and pins, midpoint and extraction convention.

- The native boundary residual is 1.97 pixels.

## Known problems

- Three source pixels at the edge are withheld for this pointing/shape uncertainty. This is a refined pointing fit, not an independently controlled cartographic solution.

- Phase-function and detailed material scattering are not recovered, so the result is an approximate reflectance presentation, not absolute calibrated albedo at zero phase.

- Display orientation therefore retains the measured 2012 pose, explicitly frozen; it does not extrapolate a rotation phase to 2026.

- Its compact fit uses SAT415 samples from 2005–2018 and has a maximum independent-epoch position residual of about 17,511 km. The 2026 orbit is extrapolated beyond that source window; it is an approximate system visualization, not a precise current ephemeris.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="methone-sources-and-interpretation"></a>

Current [NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) uses the same BODY632_RADII. The analytic radius table preserves these axes; the reference radius sets world scale without renormalizing the shape. The 5-degree source table is reduced to 480 native `u` leaves. No local relief is inferred from image brightness.

| Candidate | Disposition |
| --- | --- |
| PDS CISSCAL clear-filter N1716192103 | Included. The closest May 2012 image resolves about 27 m per native pixel. Calibrated linear I/F, not a press-image enlargement. |
| Other close-flyby clear frames | About 32–161 m/pixel across the same 2012 flyby, at observer west longitudes 124.7–134.3 degrees. The next independent encounter is 3.35 km/pixel, about one native pixel across the body. The best frame supplies the useful mapped region. |
| ISS UV, green and infrared frames | Real complementary observations surveyed in OPUS. The authors find no significant correlation between UV/IR ratio and the visible oval. No separate composition or color lens is claimed from these subtle, coarser measurements. |
| Thomas et al. [LPSC 2013 Fig. 2](https://www.lpi.usra.edu/meetings/lpsc2013/pdf/1598.pdf) | Photometrically corrected, contrast-stretched visible albedo map used as a scientific comparison. A paper figure is not substituted for calibrated source pixels. |
| PDS shape release / Thomas and Helfenstein [2020 update](https://doi.org/10.1016/j.icarus.2019.06.016) | Updated shape survey inspected; full text unavailable. Current PCK agrees with the published axes. Buratti et al. [2019 author manuscript](https://discovery.ucl.ac.uk/10075919/1/2019_buratti_aat2349_CombinedPDF_v6.pdf) identifies Methone as an ellipsoidal exception to the detailed archived meshes. No measured local elevation field was qualified. |
| NASA display photographs | Useful observational references, with photographed illumination. The calibrated PDS product is used instead. |

## Image geometry and coverage

OPUS provides observer and Sun planetocentric latitudes and west-positive longitudes, and 4,454.706 km center distance. `survey/observation-metadata.json` preserves them.

The image center is fitted to the measured ellipsoid's illuminated limb and terminator, holding those physical and mission parameters fixed. Camera west longitudes are converted to east-positive mesh coordinates by the shared recipe.

CISSCAL's attached VICAR header owns the raster offset: 8,192 bytes, little-endian float32, 1,024 square. The detached label's older record pointer is not used to read the binary telemetry as pixels. Edge-connected I/F below 0.012 defines sky; isolated dark observed samples are retained. Incidence above 75 degrees, emission above 72 degrees, and corrections greater than 2.5 are withheld. The same standard grid marks gaps on surface, poles, thumbnail, minimap and full-silhouette context portrait.

## Photometry and display

The shared preparer applies a 50:50 Lommel–Seeliger/Lambert disk correction to linear I/F before encoding. Its disk factor is normalized at normal incidence and emission. Display maximum is 0.65, gamma 1; no image exposure matching is needed for one observation.

The real leading-side oval remains darker. The published comparison finds an approximately 13% contrast and notes that small isolated image spots are not reproducible between frames. Such detector artifacts are not interpreted as craters. No texture sharpening, invented terrain or reconstructed shadowed surface is added. Flood and directional Shadows use the shared mesh lighting.

The binary rotation model covers 2004–2018. The source-image projection still uses the true capture geometry. Orbital propagation is owned by the shared astronomy package.

</details>
