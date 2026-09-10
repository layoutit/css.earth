# Portia

## Sources

- [Karkoschka (2001), *Comprehensive Photometry of the Rings and 16 Satellites of Uranus with the Hubble Space Telescope*](https://doi.org/10.1006/icar.2001.6596), Table IV, printed page 55, lists the major and minor radii as 78 × 63 km.

- [French et al. (2024), Table 3, PDF page 10](https://arxiv.org/pdf/2401.04634) reproduces the original Voyager shape measurements and uncertainties: projected radius **sqrt(A B) = 70 ± 4 km**, and minor/major ratio **B/A = 0.8 ± 0.1**.

## Evidence

- An independent 512-direction Fibonacci-sphere sample against the analytic ellipsoid gives mean radius error 0.685 km, 95th-percentile 1.283 km and maximum sampled error 1.947 km. Those sampled errors and the library estimate are distinct; neither is a bound on scientific shape uncertainty.

## Known problems

- It uses the published prolate approximation with semiaxes **78 × 63 × 63 km**, not a detailed terrain mesh. The second minor axis is an assumption of the source model, not an independent third measurement.

- No photographic surface texture is qualified. `material/neutral.png` is an intentionally constant no-data input, not measured albedo. The shared preparer paints missing coverage with its ordinary grid.

- These are not individual-axis error bars or an uncertainty on a directly measured volume. The original Voyager paper's Table V was not retrieved directly; the primary 2024 table identifies it as its source.

- This is a fixed-pole display approximation to the IAU model, not an arbitrary phase or a newly determined spin solution.

- Browser and delivery results are not recorded in this source account.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="portia-sources-and-interpretation"></a>

Portia has one **Shape model** dataset, with the standard no-coverage grid.

The adjacent model description says the major axis “points toward Uranus” and the minor axis lies “in perpendicular directions.” The [public university copy](https://lunar.earth.northwestern.edu/courses/450/uranus2.pdf) was inspected; the numeric transcription, exact PDF hash and page location are retained in `source/survey/published-shape.json`.

The authors explicitly use the prolate volume 4πAB²/3.

The authored radius table evaluates the analytic ellipsoid on a 5° angular grid. The runtime reference radius is **cuberoot(78 × 63 × 63) = 67.64856167757256 km**, the volume radius of that model. The observed projected radius remains a separately named fact. The radius table preserves the published axes without rescaling, artificial craters or inferred relief. The selected ellipsoid is radial: each ray from its center has one positive surface intersection.

## Orientation and appearance

The body frame follows [NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), BODY712, including its IAU pole and prime-meridian periodic terms at **JD 2461286.5 TT (2026-09-03)**. The resulting reference angles are pinned in `preparation/rotation.json`. The shared measured-rotation recipe then propagates the published −701.486587°/day secular spin; its pole and small periodic terms remain frozen at that reference epoch. The long shape axis lies at body longitude 0°/180°.

Surface, thumbnail, minimap and context portrait all use that interpretation. Shared Flood lighting and optional Shadows remain available and follow the same mesh. There is no photographed terminator, invented terrain or atmosphere.

## Dataset survey

Surveyed 2026-09-08, beyond the first press image:

| Candidate | Disposition |
| --- | --- |
| [PDS Voyager ISS original and calibrated products](https://pds-rings.seti.org/voyager/iss/) | The OPUS surface-geometry inventory contains 3,422 observations. The finest indexed product is `vg-iss-2-u-c2675821`, about **35.93 km/pixel**, with a 5.76 s exposure and 5:1 scan mode. Portia spans only a few independent image samples. This supports the published size/elongation analysis, but not a useful resolved cartographic texture. Inventory and original metadata are pinned. No imagery is painted onto the model. |
| Published Voyager/HST shape measurements | Included as the explicitly prolate Shape model described above. A detailed released vertex/facet model was not located in the checked PDS shape collections, NAIF releases or cited papers. No hobbyist mesh or image tracing substitutes for one. |
| [2023 Keck near-infrared study](https://www.sciencedirect.com/science/article/pii/S0019103522004237) and HST photometry | Integrated brightness/reflectivity measurements, using adopted body sizes; they do not supply spatially resolved color pixels. Excluded as a surface color lens. |
| USGS/PDS mapped products, elevation, geology and spectroscopy | No registered Portia surface, elevation or compositional map was located in the relevant archive and cited-release survey. Integrated spectral measurements are distinct from a mapped surface dataset. This is a bounded survey result, not a claim that no other observations exist. |

## Preparation and restoration

The shared radial-terrain recipe simplifies the 5,040 source triangles to **480 native PolyCSS `u` leaves**, using the existing meshoptimizer path and a 1.5 km simplifier-error setting. The result has one closed component, Euler characteristic 2, and an estimated simplifier error of 1.168 km. The same geometry supplies prepared lighting and the purpose-sized context portrait.

The compact radius table, numerical source transcriptions and constant no-data material are checked in. The acquisition plan restores the pinned external Inter font, ESO starfield and NAIF PCK. The context portrait is reproducible by the shared radial-snapshot generator with the recipe in `preparation/navigation.json`. Required preparation inputs have source pins; no private runtime or hand-built renderer is introduced.

</details>
