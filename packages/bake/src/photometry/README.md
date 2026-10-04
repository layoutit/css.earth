# Photometry

A photograph's brightness depends on its lighting and viewing angles as well as on the surface. This library carries an observed radiance factor (I/F) to one reference geometry with a published photometric model, so photographs taken under different illumination can be joined and relit. Preparation runs it; the runtime never evaluates a model.

The models and the limb laws are the `@cssearth/bake/photometry` entry (this folder), and its tests sit beside them. The whole-disc color policy is in [`whole-disc-color.ts`](../objects/raster/whole-disc-color.ts) (`@cssearth/bake/objects/raster`). The commands that make records, `fit-epic-limb.mts` and `acquire-psg-limb-table.mts`, are in [`packages/bake/cli/`](../../cli/).

## Modules

| Module | Owns |
| --- | --- |
| `disk.ts` | Lambert, Lommel-Seeliger, ISIS Lunar-Lambert and Minnaert disk functions, with the same arithmetic the routes used before this library, so outputs stay byte-identical. Also Lommel-Seeliger plus Lambert with coefficients linear in phase, the form Buratti and Veverka (1983) introduced for Europa, and Akimov's parameter-free function, which is flat at zero phase. |
| `phase.ts` | The Henyey-Greenstein phase term with shadow hiding that 67P used before its full model, the Kaasalainen-Shkuratov exponential, and a quadratic fitted to a phase curve, held beyond its fitted phase. |
| `hapke.ts` | The Hapke model: the 1981 and 2002 H-function approximations, one- and two-term Henyey-Greenstein and Legendre particle phase functions, shadow hiding, coherent backscatter and porosity. |
| `roughness.ts` | Hapke (1984) macroscopic roughness, step for step as ISIS computes it. |
| `normalization.ts` | A model, a reference geometry and the limits beyond which a pixel is withheld. |
| `model-record.ts` | Reading and validating model records and the recipe block that names them. |
| `light-curve.ts` | A pulsating star's published Gaia DR3 Cepheid harmonic model, turned into one period of veil opacity over the disc from the scene epoch. The display rate, three days per second, is its only presentation choice. See [HV 1345 through one cycle](../../../../docs/images/cepheid-light-curve-phases.png). |
| `whole-disc-color.ts` (`objects/raster`) | A planet's whole-disc color record from a published spectrum, and the band-ratio policy that ties a color map to it through its limb law's disc means (`floodDiscMean` in `limb.ts`); `keepLuminance` then restores the map's mean luminance with a soft shoulder. |

Angles are radians in code and degrees in records and recipes.

## Model records

A body keeps each published model in `src/objects/<body>/source/photometry/<id>.json`. [Lutetia's record](../../../../src/objects/lutetia/source/photometry/hasselmann-2016-hapke-1993.json) is a complete example: instrument, filter, the quantity the paper fitted, the model, and the phase, incidence and emission ranges of the fitted data.

The record is a manifest document. Its binding cites the publication with role `method`, and the binding's locator names the table or abstract the values come from. A value taken from a later compilation, such as a review table, is cited there with role `reference`. Preparation verifies the record before any route runs.

## Recipe block

A photograph recipe names the record, the geometry every pixel is carried to, and the limits:

```json
"photometry": {
  "model": "photometry/hasselmann-2016-hapke-1993.json",
  "referenceDegrees": { "incidence": 35, "emission": 0, "phase": 35 },
  "limits": { "maximumIncidenceDegrees": 70, "maximumEmissionDegrees": 70, "phaseDegrees": [25, 45], "minimumGain": 0.4, "maximumGain": 2.5 }
}
```

- Each pixel's gain is the model at the reference geometry divided by the model at the pixel's own geometry.
- A pixel outside the angle or phase limits, or needing a gain outside the gain limits, is withheld. Gains are never clamped.
- The reference must be a geometry that can occur, with the phase between |incidence − emission| and incidence + emission. It must lie inside the limits, with its phase inside the fitted range.
- Phase limits may extend past the fitted range. The prepared report then says the model is extrapolated.
- A dataset names the model as its `photometry`; its display range and level matching stay in their own recipe blocks.

Surface-observation datasets with Sun geometry (`packages/bake/src/objects/layers/terrestrial/surface-observations/`), controlled-camera datasets included, accept this block. Filter-color datasets refuse it, because a model fitted in one filter would change band ratios. Observed-color datasets keep their per-observation ISIS Lunar-Lambert weights, and ISIS2 orthographic images carry no Sun geometry to normalize with.

The Shadows lighting option still bakes Lambert shading with cast shadows, because a Hapke model depends on the emission angle, which changes as the viewer rotates, and the runtime must not evaluate it.

## Reviewing a model record

Check each point against the source before merging a record:

- Every value comes from the paper, its archive document or a compilation that cites it, and the binding's locator names the table or the abstract.
- The fitted phase, incidence and emission ranges are the ones the source states, and the recipe's reference phase lies inside them.
- The phase function's sign follows the source. A negative one-term asymmetry scatters backward, and ISIS and Hapke (2012) weight two-term functions differently.
- The H-function approximation matches the source's Hapke version: 1981 for the 1981 to 1993 formulations, 2002 for Hapke (2002) and later.
- Values the source held fixed during its fit are named in the binding's evidence.
- A difference between the source's filter and the photographs' filter is stated in the body README.

## Conventions that differ between sources

- **Henyey-Greenstein asymmetry:** with the phase angle g in (1 − ξ²)/(1 + 2ξ cos g + ξ²)^1.5, a negative ξ scatters backward.
- **Two-term Henyey-Greenstein:** Hapke (2012) weights the backward lobe by (1 + c)/2 with c in [−1, 1]. ISIS `HapkeHen` weights it by c in [0, 1]. Use `double-henyey-greenstein` for the first and `isis-henyey-greenstein` for the second; c_ISIS = (1 + c_Hapke2012)/2.
- **Quantity:** radiance factor and bidirectional reflectance differ by a constant, so a normalization ratio does not depend on which one a paper fitted.

## Tests and oracle

- `disk.test.mts` holds the disk functions to exact equality with frozen copies of the historical arithmetic.
- `hapke.test.mts` and `normalization.test.mts` check defining limits: Chandrasekhar's H(1), phase-function normalization, opposition peaks, reciprocity, roughness continuity and the reference and limit rules.
- `isis.oracle.test.mts` compares the library with the values printed by the unit tests of USGS ISIS 10.0.0_LTS, to six significant digits. [`photometric-truth.py`](fixtures/photometric-truth.py) reads those truth files, and the fixture records each file's URL.
- `whole-disc-color.test.mts` checks the record parser, the Minnaert disc means 2/(2k+1), the tie and the luminance shoulder on synthetic maps.
- ISIS's truth files do not exercise the 2002 H function, coherent backscatter or porosity. Those terms are checked only against their defining limits.
