# WASP-43b

## Sources

WASP-43b is a hot Jupiter that orbits the K dwarf [WASP-43](../wasp-43/README.md) every 19.5 hours. It is the first planet of another star in cssEarth. Its one lens, **Temperature**, is a whole-planet map of brightness temperature measured by JWST.

**The map.** Challener et al. (2024, [ApJL 969, L32](https://doi.org/10.3847/2041-8213/ad5958); [arXiv:2406.10207](https://arxiv.org/abs/2406.10207)) fitted two-dimensional maps to a JWST NIRSpec/G395H phase curve of WASP-43b: 28.6 hours from 14 May 2023, two eclipses and one transit, program 1224 (PI S. Birkmann; [MAST DOI 10.17909/n3ac-1s50](https://doi.org/10.17909/n3ac-1s50)). They used ThERESA's eigenmapping: third-degree spherical harmonics combined into six "eigenmaps", fitted to how the planet's light changed as it turned and passed behind its star. They converted flux to brightness temperature with a PHOENIX stellar spectrum and a blackbody planet. Their data deposit, [Zenodo 10.5281/zenodo.12627524](https://zenodo.org/records/12627524) (CC BY 4.0), holds the best-fitting maps and the light curves.

| Quantity | Value | Source |
| --- | --- | --- |
| Map | white-light brightness temperature, 48 × 96 cells of 3.75° | `whitelight.tmap` in `maps.npy`, Zenodo deposit |
| Hottest cell | 1,975.7 K at longitude +5.6°, latitude −13.1° | computed here from the deposited map |
| Paper's hotspot | 6.9 ± 0.5° east, 13.4 +3.2/−1.7° south, peak near 2,000 K | Challener et al. (2024), abstract and section 5; the latitude depends on the model, see Known problems |
| Area-weighted dayside and nightside means | 1,561 K and 1,003 K | computed here from the deposited map |
| Radius | 0.15883 host radii = 73,481 km (1.03 Jupiter radii) | Table 1 ratio × the host's 0.665 solar radii |
| Orbit | P 0.8134741 d, a 4.8767 host radii, i 82.155°, transit 55934.2922503 BMJD_TDB | Table 1 |

**Processing.** The deposit is pinned as its published tar, unchanged ([manifest](source/manifest.json)). Preparation reads `wasp-43b/maps.npy` in place with a restricted reader ([npy-pickle.mts](../../../tools/objects/terrestrial-layers/npy-pickle.mts)): the file is a pickled Python dictionary, and the reader interprets only the few instructions numpy uses to store float arrays, never running code a file names. [npy-dictionary-map.mts](../../../tools/objects/terrestrial-layers/npy-dictionary-map.mts) checks that the grid is regular pixel centres, south to north and west to east, and samples it bilinearly. The shared `terrestrial-scientific` science kind paints 700 to 2,000 K with the plasma palette, which is false colour. The body is drawn emissive, like the stars: the map is the planet's own heat glow, so it is not shaded by its star.

**Orbit and rotation.** The planet orbits its placed host star on a circular orbit built from the transit fit ([hostedOrbits.ts](../../../packages/astronomy/src/hostedOrbits.ts)). The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked, as the paper does. The pole is the orbit normal and longitude 0 faces the star at every instant; east is the direction of rotation. The default camera looks at the substellar point with the pole up.

## Evidence

Run of 2026-09-16 (this version): `node tools/prepare-object.mts wasp-43b` prepared the package.

- [`eclipse-map.test.mts`](../../../tests/objects/unit/wasp-43b/eclipse-map.test.mts) turns the deposited map with this package's orbit and rotation ([phase-curve.mts](../../../tools/objects/eclipse-map/phase-curve.mts)) and fits the deposited white-light light curve, with a free scale and offset, over the 4,202 samples outside transit:

  | Map | Reduced chi-squared | Flux scale |
  | --- | --- | --- |
  | As deposited | 2.120 | 0.977 |
  | Mirrored north–south | 2.128 | 0.953 |
  | Mirrored east–west | 16.34 | 0.926 |
  | Uniform planet | 92.75 | — |

  The deposited map needs almost no rescaling, and only its east–west mirror fails, so the lens's longitudes, the orbit's phase and the spin direction agree with the observation. The same check in Python gave the same four numbers. The paper's own fit reaches 0.993 with its eigenmap model and error treatment; this check uses the deposited best-fitting map and the deposited uncertainties.
- The same test finds the hottest cell at +5.6°, −13.1°, next to the paper's 6.9° E, 13.4° S.
- [`default-view.test.mts`](../../../tests/objects/unit/wasp-43b/default-view.test.mts) derives the default camera from the runtime's camera math: 0.2° from the substellar point, pole up. In Chrome at 1440 × 900 the leaf under the screen centre covers atlas longitudes 0° to 11.25°, with −39° to its left and +39° to its right.
- [`source.test.mts`](../../../tests/objects/unit/wasp-43b/source.test.mts) verifies the pins, the lens recipe, the radius ratio and that the prepared body frame's +X points at the host star at the scene epoch.
- [`npy-pickle.test.mts`](../../../tools/objects/terrestrial-layers/npy-pickle.test.mts) reads a dictionary written the way numpy writes one, refuses a pickle that names `os.system`, and refuses an irregular grid. Reading the deposit gives the same minimum and maximum as numpy (709.78 and 1,975.68 K).
- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) checks the orbit: the planet in front of the star at mid-transit, 0.6655 stellar radii off centre, the Keplerian speed and the inclination. [`authored-rotation.test.mts`](../../../tools/objects/authored-rotation.test.mts) checks that a synchronous rotation faces +X at its centre with +Z on the orbit normal.
- [ThERESA reruns](source/reference/theresa-reruns.md): the authors' public code (commit 74a8fec) on the deposited light curve, transit excluded, reproduces the paper's hot spot, +7.0° and −12.1°, and a map correlated 0.97 with the deposited one. The same file records the spin-axis finding and the model tests behind the known problem below.
- The orbital phase at the scene epoch agrees with two independent transit ephemerides from the NASA Exoplanet Archive: 21 s (0.1° of orbit) from Kokori et al. (2023) and 39 s from Ivshina & Winn (2022).
- In Chrome at DPR 1 and 2 the page renders with no console errors, and searching "WASP-43" from another page lists and opens WASP-43b and WASP-43.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/wasp-43b/` with the default camera.

## Known problems

- **How far south the hot spot sits is not settled.** Rerunning the authors' public mapping code on their light curve ([ThERESA reruns](source/reference/theresa-reruns.md)) keeps the day–night contrast, the shift of about 7° east and a southward offset in every run, but the latitude moves between −4° and −16° among fits of nearly equal quality. The public code leaves the planet's spin axis 7.8° off its orbit normal; with the axis corrected, the paper's own model choice (degree 3, six eigencurves) puts the hot spot at −4.1°, not −13°. The paper says its unpublished 2024 code includes the tilt, which these files cannot confirm. The deposited map is shown unchanged; its −13° is one of the fits the data allow.
- **North and south cannot be told apart.** An eclipse light curve cannot tell whether the planet crosses north or south of the star's centre. Challener et al. assume one side (their footnote 1), which fixes the map's north, and this package's orbit follows the same construction.
- **Only large patterns are real.** The map is built from third-degree harmonics and six eigenmaps; the paper warns that features at the scale of its quoted uncertainties cannot be measured. The 3.75° cells and the bilinear sampling are display resolution, not detail.
- **Brightness temperature, not temperature.** Each value is the blackbody temperature that would give the observed 2.87–5.18 μm flux against a PHOENIX model of the star. It depends on that model and on the depth the light comes from.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The direction of the orbit's ascending node on the sky is not measured by transits; it is set at position angle 0 as a display convention. The orbit is circular, and the orbit's phase ignores the up to 8.3 minutes of barycentric light-time (0.7 percent of an orbit), as the star placement does.
- **The planet is a sphere.** Its tidal and rotational flattening are not modelled.
- **A quarter-turn atlas offset.** The planet route puts body longitude 0 a quarter turn along the mesh, so the atlas is painted from longitude −90°. The panel's map preview therefore shows the substellar point a quarter of the way across, not at the edge.
- **Other maps of the same planet are not shown.** See the [investigation ledger](investigations.json) for the MIRI map of Hammond et al. (2024), the Bell et al. (2024) products and the two single-detector maps.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
