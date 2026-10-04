# HD 189733b

HD 189733b is a hot Jupiter that orbits the K dwarf [HD 189733 A](../hd-189733/README.md) every 2.2 days, 19.8 parsecs from the Sun. Its default dataset is the dayside brightness-temperature map Lally et al. (2025) fitted to eclipses at 8 µm. Other datasets show the map's uncertainty and NASA artwork; the Charts tab shows measured reflected light and transmission.

## Sources

- **Map and uncertainty:** Lally et al. (2025, [arXiv:2503.20895](https://arxiv.org/abs/2503.20895)) fitted a map to two JWST MIRI/LRS eclipses (18 October 2022 and 30 June 2023, program GO 2021, PI B. Kilpatrick), seven Spitzer IRAC 8 µm eclipses and a partial Spitzer phase curve, using ThERESA eigenmapping. Their deposit, [Zenodo 10.5281/zenodo.15103479](https://zenodo.org/records/15103479) (CC BY 4.0), holds the best-fitting map from the Eureka! reduction (`output_E.npy`) and its configuration.
- **Reflected light:** [Evans et al. (2013), Table 1](https://arxiv.org/abs/1307.3239), HST/STIS G430L geometric albedos from a secondary eclipse on 20 December 2012 (GO-13006), [transcribed](source/science/evans-2013/albedo.json); and [Krenn et al. (2023)](https://arxiv.org/abs/2301.07731), CHEOPS geometric albedo 0.076 ± 0.016 from thirteen occultations in 2021, [transcribed](source/science/krenn-2023/albedo.json).
- **Transmission:** [Fu et al. (2024)](https://www.nature.com/articles/s41586-024-07760-y), NIRCam data and retrievals in [Zenodo 11459715, version 1](https://zenodo.org/records/11459715), CC BY 4.0. Two members of `HD189733b_JWST_data_model.zip` are kept under `zenodo/`: the 139-row spectrum and the free-retrieval median model.
- **Illustration:** NASA's artist's concept from [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) ([`HD_189733_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/HD_189733_b.jpg), 2,048 × 1,024), credited NASA/JPL-Caltech. NASA content is generally not subject to copyright in the United States ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

| Quantity | Value | Source |
| --- | --- | --- |
| Map | brightness temperature, 12 × 24 cells of 15° | `tmap` in `output_E.npy`, Zenodo deposit |
| Deposited run | 12 × 24 cells, degree 5, 3 eigencurves (`hd189-eureka-spitzer+MIRI-share.cfg`) | the paper describes its final fit on 48 × 96 cells searching up to degree 10; which run the deposit is, is not stated |
| Hottest cell | 1,334.9 K at longitude +37.5°, latitude +7.5° | computed here from the deposited map |
| Paper's hot spot | 33.0 +0.7/−0.9° east; 32.5 +3.0/−10.6° across the models they combine | Lally et al. (2025), abstract |
| Area-weighted dayside mean | 1,142 K | computed here from the deposited map |
| Radius | 0.116795376 solar radii = 81,255 km (1.14 Jupiter radii) | deposited configuration; Table 1 0.11680 ± 0.00014 |
| Orbit | P 2.21857567 d, a 0.030995 au = 8.863 host radii, i 85.71°, transit 59838.6863112 | deposited configuration; Table 1 |

## Processing

**Map.** [npy-pickle.ts](../../../packages/bake/src/objects/raster/numpy/npy-pickle.ts) reads the deposit in place. It has no grid arrays, so the recipe states ThERESA's layout: south to north and west to east from −180°, values at cell centres. [npy-dictionary-map.ts](../../../packages/bake/src/objects/raster/numpy/npy-dictionary-map.ts) samples it bilinearly onto a 950 to 1,350 K plasma palette, false color.

**Only observed longitudes.** ThERESA shows only cells within 90° of a sub-observer longitude seen during the observations ([`utils.vislon`](https://github.com/rychallener/ThERESA/blob/74a8fec0462f4583e336bbc44e2f2441b263a49f/theresa/lib/utils.py)). Preparation applies the same rule to the saved observation times: the range is −109.9° to +179.6°, so the four columns from −180° to −120° are missing data.

**Uncertainty.** `tmap_unc` is the standard deviation of the authors' sampled maps ([ThERESA, lines 207–210](https://github.com/rychallener/ThERESA/blob/74a8fec0462f4583e336bbc44e2f2441b263a49f/theresa/theresa.py#L207)), 3.2717 to 9.5537 K, shown on a 0–10 K viridis scale with the same grid and mask.

**Orbit and frame.** The planet follows the deposited circular orbit ([hostedOrbits.ts](../../../packages/astronomy/src/hostedOrbits.ts)). Rotation assumes tidal locking, as the paper does: the pole is the orbit normal and longitude 0 faces the star. The navigation marker is the map seen from the star, rendered by [author.mts](../../../packages/telescope-cli/authoring/hd-189733/author.mts).

**Illustration.** The artwork is resized unchanged with its left edge at 0° longitude ([`equirectangular-illustration`](../../../packages/bake/src/objects/interpretation/interpret.ts)), and never counts as imagery.

**Charts.** Three prepared SVGs come from the shared [measured-spectrum renderer](../../../packages/bake/src/objects/charts/measured-spectrum.ts) and their [recipes](source/content/charts.json). Hubble's six bins from 290 to 570 nm keep their signed estimates and asymmetric errors; −0.11 at 502 nm is a noisy fit, not negative reflectivity. The CHEOPS value spans its whole 350–1100 nm passband. The Webb chart shows depths as percent of starlight blocked, with no refitting or offsets. The retrieval identifies H₂O, CO₂, CO and H₂S; these interpret the spectrum and are not maps of gases.

**Lighting.** The planet is drawn lit by its star, as every planet with a map is: a sphere under the shared lighting bank. The shading is a display convention, not data; the map's colors are read against the legend where the disc is fully lit.

## Evidence

- Tests check the table above, every chart value and all 240 shown uncertainty cells against their sources.
- A map this project fitted to the two MIRI eclipses from raw exposures matches the deposited dayside with correlation 0.94 ([test](../../../packages/bake/src/objects/raster/eclipse-map/hd-189733b-raw-map.test.mts)).
- [The default view](source/reference/rendered-default-view.png) shows the dayside facing the camera with the hot spot east of centre and the unobserved strip blank.

## Known problems

- The eclipse map moves about 0.5° to 1° of longitude per second of eclipse timing ([eclipse mapping](../../../docs/eclipse-mapping.md#timing-and-the-ramp-on-other-planets)). ThERESA models no light travel time; with the 31 s it adds, the same data put the offset about 16° further west. The paper's map is shown unchanged.
- Table 1 labels the transit time UTC; the scene reads it as TDB. This project's TESS fit of the star puts the transit 6.4 ± 0.9 s before this ephemeris, where a UTC time would be 69 s off.
- The best model has no freedom in latitude, and an eclipse light curve cannot tell north from south; the orbit's construction fixes it.
- Only large patterns are real: the 15° cells are the deposit's resolution, and bilinear sampling is display.
- Values are brightness temperatures at 8 µm against a PHOENIX stellar model, not temperatures.
- The uncertainty is conditional on the fitted model. It excludes timing and model-choice uncertainty, and neighbouring cells are correlated.
- Other maps of this planet (the SPARTA map `output_S.npy`, earlier Spitzer maps and this project's raw-exposure map) are not shown; see the [investigation ledger](investigations.json).
- Tidal locking, a sky position angle of 0 and a spherical planet are assumptions.
- The Illustration dataset is art. Nobody has resolved this planet's disc; its colors, clouds and terrain are the artist's, and its longitudes are arbitrary.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
