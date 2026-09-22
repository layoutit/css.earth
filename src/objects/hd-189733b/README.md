# HD 189733b

## Sources

HD 189733b is a hot Jupiter that orbits the K dwarf [HD 189733 A](../hd-189733/README.md) every 2.2 days, 19.8 parsecs from the Sun. Its lens is the dayside brightness-temperature map Lally et al. (2025) fitted to eclipses at 8 µm, shown as they deposited it.

**The map.** Lally et al. (2025, [arXiv:2503.20895](https://arxiv.org/abs/2503.20895)) fitted a two-dimensional map to two JWST MIRI/LRS eclipses (18 October 2022 and 30 June 2023, program GO 2021, PI B. Kilpatrick) together with seven Spitzer IRAC 8 µm eclipses and a partial Spitzer phase curve. As the planet passes behind its star, the star covers and uncovers the dayside strip by strip, and the light curve records which strips are bright. They used ThERESA's eigenmapping: fifth-degree spherical harmonics combined into two eigenmaps, chosen by BIC. They converted flux to brightness temperature with a PHOENIX stellar spectrum and a blackbody planet over the Spitzer 8 µm band. Their data deposit, [Zenodo 10.5281/zenodo.15103479](https://zenodo.org/records/15103479) (CC BY 4.0), holds the best-fitting map from the Eureka! reduction of the MIRI data (`output_E.npy`) and its ThERESA configuration.

| Quantity | Value | Source |
| --- | --- | --- |
| Map | brightness temperature, 12 × 24 cells of 15° | `tmap` in `output_E.npy`, Zenodo deposit |
| Deposited run | 12 × 24 cells, degree 5, 3 eigencurves (`hd189-eureka-spitzer+MIRI-share.cfg`) | the paper describes its final fit on 48 × 96 cells searching up to degree 10; which run the deposit is, is not stated |
| Hottest cell | 1,334.9 K at longitude +37.5°, latitude +7.5° | computed here from the deposited map |
| Paper's hot spot | 33.0 +0.7/−0.9° east; 32.5 +3.0/−10.6° across the models they combine | Lally et al. (2025), abstract |
| Area-weighted dayside mean | 1,142 K | computed here from the deposited map |
| Radius | 0.116795376 solar radii = 81,255 km (1.14 Jupiter radii) | deposited configuration; Table 1 0.11680 ± 0.00014 |
| Orbit | P 2.21857567 d, a 0.030995 au = 8.863 host radii, i 85.71°, transit 59838.6863112 | deposited configuration; Table 1 |

**Only observed longitudes.** An eclipse map constrains only the longitudes that faced the telescope while it watched. ThERESA's maps show only those: it takes the sub-observer longitude at every observation time, widens it by 90° each way, and keeps the cells that overlap the range ([`utils.vislon`](https://github.com/rychallener/ThERESA/blob/74a8fec0462f4583e336bbc44e2f2441b263a49f/theresa/lib/utils.py) and `theresa.py` at commit 74a8fec). The deposited `tmap` fills every cell, so preparation applies the same rule to the observation times saved in the same file. The range is −109.9° to +179.6°, so the four columns from −180° to −120° are left as missing data. The Spitzer partial phase curve is why most of the nightside is shown; the paper analyses only the dayside.

**Processing.** The deposit file is pinned unchanged and read in place with the restricted pickle reader ([npy-pickle.mts](../../../tools/objects/terrestrial-layers/npy-pickle.mts)). It stores values without grid arrays, so the recipe states the grid layout, `pixel-centres`: south to north and west to east from −180°, values at cell centres, as ThERESA builds it. [npy-dictionary-map.mts](../../../tools/objects/terrestrial-layers/npy-dictionary-map.mts) samples it bilinearly; a cell beside a hidden column is drawn whole. The `terrestrial-scientific` science kind paints 950 to 1,350 K, the observed map's range rounded to 50 K, with the plasma palette, which is false colour. The body is drawn emissive: the map is the planet's own heat glow.

**Orbit and rotation.** The planet orbits its placed host on the circular orbit of the deposited configuration ([hostedOrbits.ts](../../../packages/astronomy/src/hostedOrbits.ts)). The rotation record, `cssearth-synchronous-rotation@1`, assumes tidal locking, as the paper does: the pole is the orbit normal and longitude 0 faces the star. The default camera looks at the substellar point with the pole up.

**Navigation marker.** From a distance the planet is its map seen from the host star, an orthographic dayside disc centred on the substellar point, rendered by [author.mts](../../../tools/objects/source-authoring/hd-189733/author.mts) (`--check` recomputes it).

## Evidence

Run of 2026-09-17 (this version): `node tools/prepare/prepare-object.mts hd-189733b` prepared the package.

- [`eclipse-map.test.mts`](../../../tests/objects/unit/hd-189733b/eclipse-map.test.mts) reads the deposit and checks the table above: the hottest cell, the dayside mean, the visible range from the saved times and the 240 shown cells. It then turns the deposited map with this package's orbit and rotation ([phase-curve.mts](../../../tools/objects/eclipse-map/phase-curve.mts)) and compares its light curve with the deposit's own best-fit model over the MIRI eclipses.
- [`npy-pickle.test.mts`](../../../tools/objects/terrestrial-layers/npy-pickle.test.mts) checks the stated grid layout, ThERESA's visible-longitude rule including its wrapping, and that a kept cell is drawn whole.
- [`hd-189733b-raw-map.test.mts`](../../../tools/objects/eclipse-map/hd-189733b-raw-map.test.mts) (from an earlier change) fits a map to the two MIRI eclipses this project reduced from raw exposures and matches the deposited map's dayside with correlation 0.94; it runs where the reduction's outputs are present.
- [`source.test.mts`](../../../tests/objects/unit/hd-189733b/source.test.mts) verifies the pins, the lens recipe and that the prepared body frame's +X points at the host star at the scene epoch.
- [`rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/hd-189733b/` in headless Chrome, no console errors: the dayside faces the camera with the hot spot east of centre, and the lens preview leaves the unobserved strip blank.

## Known problems

- **Eclipse maps of this planet depend on timing.** Its eclipse-only map moves about 0.5° to 1° of longitude per second of eclipse timing ([eclipse mapping](../../../docs/eclipse-mapping.md#timing-and-the-ramp-on-other-planets)). ThERESA models no light travel time across the orbit; with the 31 s it adds, the same data put the offset about 16° further west. The paper's 33° and the deposited map are shown unchanged; the lens notes say the hot spot's longitude depends on timing.
- **The transit time's scale.** Table 1 labels the transit time UTC; the scene reads it as TDB. The data side with TDB: this project's TESS fit of the star (see [HD 189733](../hd-189733/README.md)) puts the transit 6.4 ± 0.9 s before this ephemeris, where a UTC time would be 69 s off. Either way the difference is 0.1% of an orbit and does not touch the map, which is shown as fitted.
- **Latitude.** The best model has no freedom in latitude; a 3-component model the paper does not prefer puts the hot spot 6.1 ± 1.6° from the equator. The deposited map's hottest cell is at +7.5°, one cell from the equator, and the map is nearly symmetric north to south.
- **North and south cannot be told apart.** An eclipse light curve cannot tell which side of the star the planet crosses; the orbit's construction fixes the map's north.
- **Only large patterns are real.** The 15° cells are the deposit's resolution; the bilinear sampling is display, not detail.
- **Brightness temperature, not temperature.** Each value is the temperature of a blackbody that would give the observed flux at 8 µm, against a PHOENIX model of the star.
- **Other maps of the same planet are not shown.** The deposit's SPARTA-reduction map (`output_S.npy`), earlier Spitzer eclipse maps and this project's map from raw exposures are in the [investigation ledger](investigations.json).
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The orbit's position angle on the sky is not measured by transits; it is set at 0 as a display convention. The planet is a sphere.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
