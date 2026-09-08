# Cordelia sources and interpretation

Cordelia has one **Shape model** dataset, with the shared no-coverage grid. Its prolate semiaxes are **25 × 18 × 18 km**. The second minor axis is a published modeling assumption, not an independently measured third axis or a detailed terrain mesh.

[Karkoschka (2001), HST photometry, Table IV, printed page 55](https://doi.org/10.1006/icar.2001.6596) adopts major/minor radii 25 × 18 km and prolate spheroids whose major axis points toward Uranus. The inspected [public university copy](https://lunar.earth.northwestern.edu/courses/450/uranus2.pdf) and exact numeric transcription are identified by URL, PDF hash and page in `source/survey/published-shape.json`. No full publisher paper is redistributed.

[French et al. (2024), Table 3, PDF page 10](https://arxiv.org/pdf/2401.04634) reproduces **sqrt(A B) = 21 ± 3 km** and **B/A = 0.7 ± 0.2**, attributed to the original Voyager paper's Table V. That original table was not retrieved directly. These uncertainties describe the projected-radius and axis-ratio estimates, not individual-axis errors. The model's derived volume radius is **cuberoot(25 × 18 × 18) = 20.082988502465085 km**; the projected radius remains a separately named fact.

The same 2024 table's **footnote-b row** gives **GM = (4.06 ± 0.38) × 10⁻³ km³/s²** and mass **(6.08 ± 0.57) × 10¹⁶ kg**, inferred from Cordelia's forced ring modes. We use this result, not the preceding row's assumed-density mass. Table 19 and Sections 9.1–9.2 describe the combined delta-ring and inner epsilon-ring constraints. The authors qualify the amplitude-to-mass relation as a test-particle scaling approximation; the displayed value is a ring-dynamical inference, not a spacecraft tracking measurement. Density assumptions used elsewhere in that paper are not used to invent a new mass here.

## Frame and surface

The radius table samples the analytic ellipsoid every 5° in east-positive planetocentric longitude/latitude. `measurements.json` records its equation and units. It preserves the published semiaxes without rescaling or adding terrain. This selected model is radial, with one positive surface intersection per central ray.

[NAIF PCK00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), BODY706, supplies the IAU pole and prime meridian. The authored measured-rotation source evaluates its periodic terms at **JD 2461286.5 TT (2026-09-03)** and propagates the published **−1074.520573°/day** secular spin. The pole and small periodic terms are frozen at that epoch. This is a fixed-pole approximation to the IAU orientation, not an arbitrary display phase. The shape's long axis follows body longitude 0°/180°.

No photograph is treated as a mapped albedo surface. The constant `neutral.png` is marked no-data, and the ordinary shared grid fills unavailable coverage. Surface, thumbnail, minimap and purpose-sized context portrait use this same interpretation. Shared Flood lighting and optional Shadows remain supported on the retained mesh. There is no photographed terminator, invented crater, color pattern or atmosphere.

## Dataset survey

Surveyed 2026-09-08:

| Candidate | Disposition |
| --- | --- |
| [PDS Voyager ISS products](https://pds-rings.seti.org/voyager/iss/) | The OPUS body-geometry inventory lists 3,871 candidates. The smallest indexed center scale is 10.00939 km/pixel (`vg-iss-2-u-c2687151`), but this frame reports no sampled surface intersection and has a center phase of about 151°. The center scale alone does not establish imaged surface coverage. The ten finest candidates were checked for intersection metadata; their disposition is pinned in `survey/candidate-geometry.json`. The first with sampled surface geometry is `vg-iss-2-u-c2679525`, at **21.38897 km/pixel**, only about two independent samples across the modeled moon. Its original metadata is also pinned. No useful registered texture was qualified. |
| Published Voyager/HST shape analysis | Included as the stated prolate Shape model. The source analysis estimates size and elongation; the adopted model does not supply local relief. A detailed vertex/facet release was not located in the checked PDS, NAIF or cited-paper repositories. |
| [NASA discovery illustration](https://science.nasa.gov/uranus/moons/cordelia/) | Establishes the discovery and shepherd-moon context. Its distant, few-pixel image does not supply a global surface map. Excluded as a mapped texture. |
| HST photometry, ground-based near-infrared studies and mapped-product searches | Integrated flux and adopted sizes do not provide spatial color texels. No qualified registered color, elevation, geological or compositional map was located. The source survey establishes this bounded disposition, not the absence of all other observations. |

## Preparation and restoration

The shared radial-terrain recipe simplifies 5,040 source triangles to **480 native PolyCSS `u` leaves**, with a 450 m simplifier-error setting. Its estimated error is 336.9 m and the result has one closed component with Euler characteristic 2. An independent 512-direction Fibonacci-sphere sample against the analytic ellipsoid gives mean radius error 200 m, p95 356 m and sampled maximum 552 m. The sampled values and library estimate are distinct from each other and from scientific shape uncertainty.

The compact radius table, constant material and factual source records are checked in. The acquisition plan restores the pinned Inter font, ESO starfield and NAIF PCK. The context portrait is reproducible with the shared radial-snapshot generator and `preparation/navigation.json`; no private runtime is introduced.

`node tools/objects/dist/operations.js acquire cordelia --verify-only` verifies source closure. `node tools/objects/dist/prepare-authored.js cordelia --write` performs the shared authored preparation. `pnpm setup:assets --object=cordelia` installs its published runtime package. Browser and delivery qualification belong to the coordinating task.
