# Titania

Titania uses Voyager 2 mosaics and terrain reconstruction, a Voyager color dataset, and digitized historical geology.

## Sources

| View or quantity | Source |
| --- | --- |
| Monochrome and elevation | [Schenk's 2020 mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), described by [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) and the [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) |
| Voyager color | Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node (volumes VGISS_7201–7207): every complete green/violet/ultraviolet set of Titania, 30 frames in 10 sets, listed in [the frame recipe](source/preparation/voyager-color-frames.json) |
| Geologic categories | [Thomson and Baynham (2026)](https://zenodo.org/records/20819132), digitized Voyager-era interpretations, CC BY 4.0 |
| Lighting | The Hapke fit of Veverka et al. (1987) to Voyager photometry of Titania, read in [NASA TM-4041](https://ntrs.nasa.gov/citations/19880017749), page 181. See [Lighting law](#lighting-law). |
| Physical placement and spin | JPL satellite elements and IAU/NAIF rotation |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/TITANIA/target) Titania centre-point export, snapshot 2026-09-11, public domain. Labels appear at the closest zoom only, and a selected feature stays labelled. |

The Voyager color camera comes from the pinned [Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json). Five labelled names carry a caption note from the lead of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption beside the IAU naming year. [NASA's overview](https://science.nasa.gov/uranus/moons/titania/) supplies the editorial facts. Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

The mosaic/DEM release has no explicit license statement. We retain author and mission attribution and the README's advice to consult the author before scientific analyses. No new license is asserted for these data.

## Processing

**Monochrome** uses `tumap-cyl-180180.cub`, the registered CLEAR-filter mosaic. We keep the published product and apply a linear display stretch from 0–3000 DN to 0–255. Photographed shadows, image seams, camera marks and varying detail remain.

**Elevation** uses `tudem-ZL-180180.cub`, a stereogrammetric model with published limb-profile data. Values are kilometres relative to the release's reference ellipsoid. The −8 to +8 km color scale contains the observed extrema, approximately −7.4973 and +7.9025 km. A fixed northwest hillshade adds relief; it does not change elevation.

Both cubes are 1722 × 861 on a 2880 m simple-cylindrical grid. Gray grid marks real gaps.

**Voyager color.** The SEDR pointing predicts each disc, and a fitted limb circle moves the optical centre. Each frame is then registered against the Schenk 2020 mosaic rendered through its own camera; a band that does not register is dropped rather than fringed. The [placement report](source/reference/voyager-color-placement.json) records the result. Each set is corrected with the same Lunar-Lambert disk function as the monochrome mosaic and used within 60° incidence and emission. Other sets are scaled band by band onto the finest set.

The archive's filter calibration leaves violet darker than green and ultraviolet, which renders purple. Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489; [ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)) recalibrated the filters and published whole-disc spectra. Read from their Fig. 2 at ±0.02, Titania has ultraviolet/green 0.92 and violet/green 0.96. The composer scales violet and ultraviolet by one gain each (1.157, 1.008) to meet those ratios; spatial color differences are Voyager's own. DeColibus et al. (2026, *Planet. Sci. J.*, [doi:10.3847/PSJ/ae4a1b](https://doi.org/10.3847/PSJ/ae4a1b)) independently find Oberon and Titania the reddest.

**Geology.** `registration.json` maps south-polar stereographic coordinates into the GIS page, fitted on six crater centroids and validated on four named craters. The 10 styled polygon categories keep their original unit names and colors. They are converted by nearest neighbour onto a 1440 × 720 grid, with no interpolation between classes. Reproduce the input with `python packages/bake/src/objects/acquisition/prepare-geologic-categories.py src/objects/titania/source/preparation/geology-conversion.json`.

The sphere uses the 788.9 km mean radius, with synchronous spin. The prepared map starts at 0° E; preparation refuses a declared edge the source contradicts ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).

## Lighting law

The globe is lit with Hapke's 1986 model and the parameters Veverka et al. (1987) fitted to Voyager photometry of Titania: single-scattering albedo 0.48, asymmetry −0.28, roughness 23°, opposition surge width 0.018 and S(0) = 0.77. They are Titania's row in Table 1 of Verbiscer and Veverka's summary, page 181 of NASA's [Reports of Planetary Geology and Geophysics Program 1987](https://ntrs.nasa.gov/citations/19880017749); the [paper](https://doi.org/10.1029/JA092iA13p14895) was not read. The model takes the surge amplitude B0, which the authors define as S(0)/(w P(0)) in their [1986 summary](https://ntrs.nasa.gov/citations/19870013908): 0.65. It is a fit to whole-disc photometry; the same group [reports](https://ntrs.nasa.gov/citations/19900003138) that whole-disc and disc-resolved fits agree excellently for Titania. The law is recorded in [`source/photometry/veverka-1987-hapke-clear.json`](source/photometry/veverka-1987-hapke-clear.json).

Each lighting frame is the law relative to the flood-lit disc centre, so the centre of the default view shows the map as published. With the Sun behind the viewer the limb is 0.97 of the centre. At 0.98 of the radius that is an overlay alpha of 0.02, where the authored bank this replaces reached 0.49. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).

## Evidence

Read through its georeferenced source, the prepared normal map correlates 0.87 from 0° E and 0.16 from 180° E. The [source inspection](source/observations/source-inspection.json) gives independent NumPy coordinate and value samples.

For the color dataset, the limb fits have an RMS of 0.38–1.35 pixels. 17 frames in 6 sets were placed, the finest set at 7.4 km/px. The [oracle report](source/reference/voyager-color-oracle.json) re-places every frame against the mosaic: mean correlation 0.45, mean residual 11.7 km. The mosaic is the same control the Monochrome dataset uses, so the color lands on the ground the reader already sees.

The checked geology landmark differences are 0.33–0.83° (approximately 4.5–11.4 km); these are not uncertainty bounds for every unit boundary. Geology covers approximately 35.3% of the sphere.

## Known problems

- **Lighting law:** The fit is to whole-disc photometry, not to resolved images, and one row lights every terrain. The surge amplitude 0.65 is computed here from the printed S(0); the phase range and the emission limit 86.2° are derived here. The opposition surge puts the point under the Sun at 0.70 of the flood-lit centre at 10° phase, so frames with Shadows on are dimmer than the flood-lit view.
- The Voyager color dataset is false color (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles. A color seam at a footprint edge is a real difference in viewing geometry. Its band ratios are read from a figure at ±0.02, and the ultraviolet calibration carries a stated ±10 % uncertainty. The brightest 0.1 % of texels may clip.
- Approximate source coverage is 44.8% for monochrome and 27.7% for elevation before interpolation; the unobserved north stays missing.
- Monochrome processing depends on an unavailable photometric parameter file (`eu_pho10.pvl`). DN values are not calibrated albedo.
- Terrain spacing is not accuracy; stereo noise and mapping artifacts remain. Geology records historical interpretations, not measured composition. Overlaps with no unique supported winner remain missing.
- Feature outlines trace a rim circle for craters and an extent box for other types; they are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)
