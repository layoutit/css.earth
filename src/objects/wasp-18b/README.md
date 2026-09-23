# WASP-18b

## Sources

WASP-18b is a gas giant ten times Jupiter's mass that circles the F star [WASP-18](../wasp-18/README.md) every 22.6 hours. JWST watched one eclipse of it with NIRISS on 24 August 2022, from 0.85 to 2.83 µm (Early Release Science program 1366). Challener, Weiner Mansfield et al. (2025, Nature Astronomy, [doi:10.1038/s41550-025-02666-9](https://doi.org/10.1038/s41550-025-02666-9); [arXiv:2510.24708](https://arxiv.org/abs/2510.24708)) mapped the day side at 25 wavelengths from that eclipse. Each wavelength sees a different depth in the atmosphere. Their deposit, [Zenodo 10.5281/zenodo.14751570](https://zenodo.org/records/14751570) (CC BY 4.0), holds the maps; this package reads them unchanged.

**The lens.** One Temperature dataset in 25 steps: the brightness-temperature map at each wavelength, from 0.89 to 2.79 µm, stepped with ‹ and › in the dataset panel. All 25 share one scale, as in the paper's Figure 1: inferno from 1,500 K to the hottest observed point of any map, 3,711 K (at 2.79 µm).

The Eigenspectra method (Mansfield et al. 2020) fits a map at each wavelength and then sorts every point of the day side by the shape of its spectrum. For this planet it finds three groups: a **hotspot** around the point under the star, a **ring** near the edges of the day side about 400 K colder, and an **outer** group, which the paper says follows the smooth fit more than the data. As in the paper's Figure 1, the borders between the groups are drawn over every map as thin black lines (solid here; the paper's are dashed).

The maps and groups are read from the deposit's Eigenspectra products (`eigenspectra/Figure1/temp_wave_*.npz` and `eigenspectra/eigenspectra_25_bins_3_groups.npz`) by [eigenspectra-map.mts](../../../tools/objects/terrestrial-layers/eigenspectra-map.mts), through a small [.npz reader](../../../tools/objects/terrestrial-layers/npz.mts). The 1.4 GB archive is pinned by its Zenodo URL and MD5; the [acquisition plan](source/preparation/acquisition.json) streams the needed members out of it (`tar-gz-member`). The grids are the ones the Eigenspectra code builds: nodes every 1° from pole to pole and from −180° to 180°, rows south to north. Only the longitudes the eclipse observation saw, −150.9° to +133.9°, are drawn; the rest shows the no-data grid.

**Orbit and rotation.** The orbit is the one the maps were fitted with, from the deposit's fitting script and ThERESA configuration: period 0.941452382 days, a/R* 3.48023, inclination 84.3532°, circular, transit at 2459802.40788 BJD_TDB. The radius ratio is 0.09783 (Coulombe et al. 2023, Table 3). The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked, as the fit does. The planet is drawn emissive.

**Catalogue colour.** #cf533c, the temperature palette at the 2,781 K day-side plateau of Coulombe et al. (2023).

## Evidence

Run of 2026-09-23 (this version):

- [`eigenspectra-map.test.mts`](../../../tools/objects/terrestrial-layers/eigenspectra-map.test.mts) turns the deposited flux maps with this package's orbit and rotation ([phase-curve.mts](../../../tools/objects/eclipse-map/phase-curve.mts)) and fits the 25 deposited light curves with a free scale and offset. Reduced chi-squared is 1.017 to 1.391 per wavelength, matching the paper's 1.02 to 1.39, and the flux scale is within 2 % of one, so the maps' units and the orbit's phase agree with the observation. Mirrored east-west, the maps fit worse by a total chi-squared of 384.8; a uniform planet is worse by 4,468. Mirrored north-south they fit 15.9 better: north and south are not decided.
- The same test finds the hottest observed node within 8° of noon at 0.89, 1.45 and 2.79 µm, as the paper reports, checks the group counts and the no-data longitudes, and that the border lines cross the equator twice (hotspot to ring, ring to outer) and never inside the hotspot.
- [`wasp-18-default-views.png`](evidence/wasp-18-default-views.png): WASP-18, WASP-18b at 0.89 µm (its default) and WASP-18b at 2.79 µm on this branch's dev server, headless Chrome at 1440 × 900 after the page reported ready. The planet opens on its substellar point; the thin black lines are the paper's group borders.
- [`lens-steps.test.mts`](../../../tools/objects/content/lens-steps.test.mts) checks that stepped datasets form groups of consecutive steps with distinct labels.

## Known problems

- **Only large patterns are real.** Each wavelength's fit has four to seven free parameters, so its map shows the patterns of low-order spherical harmonics. The 1° grid is display resolution.
- **North and south are nearly symmetric.** The maps show no latitude offset. The paper's injection tests show that a clear offset would have been detected, but WASP-18b's low impact parameter (0.36) keeps latitude information weak, and the maps mirrored north to south fit the light curves as well as the deposited ones.
- **The paper's Figure 1 is drawn upside down relative to its arrays.** The deposit's latitude arrays run south to north, as the Eigenspectra code builds them, and Figure 1 draws the first row at the top. This package follows the arrays. The maps are nearly symmetric north to south, so the difference is small.
- **Edges of the observed range are weakly constrained.** Near −150° and +134° some cells fall to a few tens of kelvin, where the fit is forced positive. The paper fades them by how long they were in view; here every observed cell is drawn at full strength, and the palette stops at 1,500 K.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The orbit's position angle on the sky is set at 0 as a display convention. The planet is a sphere.
- **Not shown.** The ThERESA 3D temperature grid of the same eclipse and the retrieved temperature-pressure profiles of the hotspot and ring are in the deposit ([ledger](investigations.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
