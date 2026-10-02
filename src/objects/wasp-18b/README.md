# WASP-18b

WASP-18b is a gas giant ten times Jupiter's mass that circles the F star [WASP-18](../wasp-18/README.md) every 22.6 hours. It shows JWST day-side temperature maps at 25 wavelengths, each seeing a different depth in the atmosphere, and a chart of retrieved temperature against pressure.

## Sources

- **Maps:** JWST watched one eclipse with NIRISS on 24 August 2022, from 0.85 to 2.83 µm (Early Release Science program 1366). Challener, Weiner Mansfield et al. (2025, Nature Astronomy, [doi:10.1038/s41550-025-02666-9](https://doi.org/10.1038/s41550-025-02666-9); [arXiv:2510.24708](https://arxiv.org/abs/2510.24708)) mapped the day side from it. Their deposit, [Zenodo 10.5281/zenodo.14751570](https://zenodo.org/records/14751570) (CC BY 4.0), holds the maps and the two hotspot retrieval tables.
- **Whole-dayside retrieval and radius ratio:** [Coulombe et al. (2023)](https://doi.org/10.1038/s41586-023-06230-1), [Zenodo 7907569](https://zenodo.org/records/7907569), CC BY 4.0.

The three retrieval tables are tracked under `source/science/`; the [manifest](source/manifest.json) and [acquisition recipe](source/preparation/acquisition.json) name their archive members.

## Processing

**Temperature.** One dataset in 25 steps, from 0.89 to 2.79 µm, stepped with ‹ and ›. All steps share one inferno scale, as in the paper's Figure 1, from 1,500 K to the hottest observed point of any map, 3,711 K (at 2.79 µm).

The Eigenspectra method (Mansfield et al. 2020) sorts every day-side point by the shape of its spectrum into three groups: a **hotspot** under the star, a **ring** near the day-side edges about 400 K colder, and an **outer** group that the paper says follows the smooth fit more than the data. The group borders are drawn over every map as thin solid black lines.

[eigenspectra-map.ts](../../../packages/bake/src/objects/raster/eclipse-map/eigenspectra-map.ts) reads `eigenspectra/Figure1/temp_wave_*.npz` and `eigenspectra/eigenspectra_25_bins_3_groups.npz` through a small [.npz reader](../../../packages/bake/src/objects/raster/numpy/npz.ts). The [acquisition plan](source/preparation/acquisition.json) streams these members out of the 1.4 GB archive. The grids have nodes every 1°, rows south to north. Only the longitudes the eclipse saw, −150.9° to +133.9°, are drawn; the rest shows the no-data grid.

**Orbit and rotation.** The orbit is the one the maps were fitted with: period 0.941452382 days, a/R* 3.48023, inclination 84.3532°, circular, transit at 2459802.40788 BJD_TDB. The radius ratio is 0.09783 (Coulombe et al. 2023, Table 3). Rotation assumes tidal locking, as the fit does. The planet is drawn emissive. The catalogue color, #cf533c, is the palette at the 2,781 K day-side plateau of Coulombe et al. (2023).

**Temperature with depth.** Following Figure 4 of Challener et al., the chart compares the hotspot's HyDRA and Pyrat Bay retrievals with the whole-dayside HyDRA retrieval. The shared [profile preparer](../../../packages/bake/src/objects/charts/retrieved-profile.ts) converts Pa to bar and draws the medians and 1σ credible intervals on a logarithmic axis from 0.01 to 10 bar. It keeps native samples and interpolates only where a curve crosses the plot edge; it does not refit or extrapolate. The dashed 0.1 and 1 bar levels mark the pressures this observation probes. The temperature rise there is a thermal inversion.

## Evidence

- [`eigenspectra-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/eigenspectra-map.test.mts) turns the maps with this package's orbit and rotation ([phase-curve.ts](../../../packages/bake/src/objects/raster/eclipse-map/phase-curve.ts)) and fits the 25 deposited light curves. Reduced chi-squared is 1.017 to 1.391 per wavelength, matching the paper's 1.02 to 1.39, and the flux scale is within 2 % of one. Mirrored east-west the maps fit worse by a total chi-squared of 384.8; a uniform planet is worse by 4,468.
- The hottest observed node is within 8° of noon at 0.89, 1.45 and 2.79 µm, as the paper reports.
- At 0.1 and 1 bar the source medians are 3265/2993 K (hotspot HyDRA), 3186/2891 K (hotspot Pyrat Bay) and 3053/2866 K (whole-dayside HyDRA). Each agrees within 25 K with positions read from the [published Figure 4](https://www.nature.com/articles/s41550-025-02666-9/figures/4), whose ticks are 250 K apart.

## Known problems

- **Only large patterns are real.** Each wavelength's fit has four to seven free parameters, so its map shows low-order spherical harmonics. The 1° grid is display resolution.
- **North and south are not decided.** The low impact parameter (0.36) keeps latitude information weak; mirrored north to south the maps fit 15.9 better in chi-squared. The paper's Figure 1 draws the first array row at the top, while the arrays run south to north; this package follows the arrays.
- **Edges of the observed range are weakly constrained.** Near −150° and +134° some cells fall to a few tens of kelvin. The paper fades them by how long they were in view; here every observed cell is drawn at full strength, and the palette stops at 1,500 K.
- **Frame assumptions.** Tidal locking, a pole on the orbit normal, a sky position angle of 0 and a spherical planet are assumed.
- **Profiles are models.** The bands are credible intervals under each retrieval's assumptions, not direct measurements at known depths, and exclude some systematic uncertainty. Curves outside the probed range are weakly constrained. The whole-dayside fit is not a third region or an average of the hotspot profiles. Changing the wavelength map does not change the chart.
- **Not shown.** The ThERESA 3D temperature grid and ring profiles ([ledger](investigations.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
