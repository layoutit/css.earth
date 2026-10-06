# (21900) Orus

Orus is a Jupiter Trojan and a target of the Lucy mission.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

<a id="shape-scale-and-orientation"></a>

| Input | Selected source |
| --- | --- |
| Shape and spin | [Ďurech & Hanuš (2026), model 1 of (21900) Orus](https://doi.org/10.5281/zenodo.22812438) |
| Physical scale | [Mottola et al. (2023), The Planetary Science Journal 4, 18, Table 3](https://doi.org/10.3847/PSJ/acaf79) ([record](source/reference/calibration.json)) |

The shape is `shape_models/model_21900_1.tri` from `shape_models.tar.gz` of the [Zenodo deposit](https://doi.org/10.5281/zenodo.22812438) (version 2026-09-17, CC BY 4.0) of [Ďurech & Hanuš (2026)](https://arxiv.org/abs/2610.06082). It is a convex mesh fitted to sparse brightness measurements from sky surveys (Catalina, Mt. Lemmon, Pan-STARRS, ZTF, USNO, ATLAS, ASAS-SN, TESS and Gaia). The original 574 vertices and 1144 triangular faces are the source input. Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved.

The deposit's spin table gives the J2000 ecliptic pole λ = 36.8°, β = -54° and the sidereal period 13.486235 h. The table also lists solution 2 with pole λ = 240.3°, β = -62.2° and the same period. Survey photometry does not tell the two poles apart. Solution 1 is selected because its pole lies beside the pole of Mottola et al. (2023), ecliptic (33°, −59°), which the 2021 October 16 occultation told apart from its mirror.

Adopted diameter: **60 ± 0.9 km**, meaning volume-equivalent diameter of the occultation-scaled convex model, from [Mottola et al. (2023), The Planetary Science Journal 4, 18, Table 3](https://doi.org/10.3847/PSJ/acaf79). The reference-sphere radius is 30 km. Table 3 gives the convex shape volume 1.13 × 10^5 km³ of the model its authors scaled to the 2021 October 16 occultation chords; a sphere of that volume is 60 km across. The quoted error is that of the table's surface-equivalent diameter, 60.5 ± 0.9 km. That model's mesh is not archived, so its volume is given to the Ďurech & Hanuš (2026) mesh, whose proportions differ: at this scale the mesh measures 70.4 × 59.8 × 58.2 km (longest extent across the spin axis, the extent at right angles to it, the extent along it) where the table lists 70.7 × 63 × 51.4 km.

[Model fields, mesh measurements and comparison](source/reference/survey-model.json).

## Evidence

Checked 2026-10-06 against the deposit's files.

- Mesh: positive signed volume (1.000000025 source units cubed), every edge used once in each direction, Euler characteristic 2.
- Pole: solution 1 is 5.4° from the pole of Mottola et al. (2023), (33°, −59°), which an occultation told apart from its mirror; solution 2 is 57° away. Solution 1 is shown.
- Period: 13.486235 h against their 13.486190 ± 0.000017 h.
- Dimensions: at the adopted volume the mesh measures 70.4 × 59.8 × 58.2 km where their Table 3 lists 70.7 × 63 × 51.4 km for their own model: the mesh is 13% thicker along the spin axis and 5% narrower across it.
- Display shape: the fewest faces the error allowance permits, 282 of at most 800, from the source's 1144. The farthest sampled point of the source lies 521.6 m from it, inside the 600 m allowance (2% of the radius).
- Browser: the default view below, in headless Chrome 1280 × 800 from the local site after the bake, with every image loaded and no page error.

![Orus in the app, default view](evidence/2026-10-06/default-view.jpg)

## Known problems

- The model of Mottola et al. (2023) rests on dense light curves and an occultation, and its mesh is not archived. The mesh shown comes from sparse survey photometry and is 13% thicker along the spin axis than that model.
- The paper's 60.5 km surface-equivalent diameter is not a volume-equivalent diameter; the scale uses the table's convex volume instead.
- No registered surface imagery exists for this shape; it shows the shared neutral gray. Convex inversion leaves concavities and fine relief unresolved.
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch. Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral gives a volume-equivalent diameter of 1.24070099202 source units. The preparation conversion is:

`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))`

For this input, `metersPerUnit = 48359.7582222451`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

Converted with obliquity 23.439291111°, the equatorial pole is α = 53.88°, δ = -37.03°. Model longitude zero is an inversion convention, not an observed landmark. JPL Horizons command "21900;" supplies the osculating elements and vector fixtures at 2026-09-03 TT; this is a fixed-date context, not a real-time trajectory or surface attitude.

</details>
