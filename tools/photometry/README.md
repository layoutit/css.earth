# Photometry

A photograph's brightness depends on its lighting and viewing angles as well as
on the surface. This library carries an observed radiance factor (I/F) to one
reference geometry with a published photometric model, so photographs taken
under different illumination can be joined and relit. Preparation runs it; the
runtime never evaluates a model.

## Modules

| Module | Owns |
| --- | --- |
| `disk.mts` | Lambert, Lommel-Seeliger, ISIS Lunar-Lambert and Minnaert disk functions. The arithmetic is the form each route used before this library, so migrated routes prepare byte-identical outputs. |
| `phase.mts` | The Henyey-Greenstein phase term with shadow hiding that 67P used before its full model. |
| `hapke.mts` | The Hapke model: the 1981 and 2002 H-function approximations, one- and two-term Henyey-Greenstein and Legendre particle phase functions, shadow hiding, coherent backscatter and porosity. |
| `roughness.mts` | Hapke (1984) macroscopic roughness, step for step as ISIS computes it. |
| `normalization.mts` | A model, a reference geometry and the limits beyond which a pixel is withheld. |
| `model-record.mts` | Reading and validating model records and the recipe block that names them. |

Angles are radians in code and degrees in records and recipes.

## Model records

A body keeps each published model in `src/planets/<body>/source/photometry/<id>.json`.
[Lutetia's record](../../src/planets/lutetia/source/photometry/hasselmann-2016-hapke-1993.json)
is a complete example: instrument, filter, the quantity the paper fitted, the
model, and the phase, incidence and emission ranges of the fitted data.

The record is a manifest document. Its catalogued binding cites the publication
with role `method`, and the binding's locator names the table or abstract the
values come from. Preparation byte-verifies the record before any route runs. A
value taken from a later compilation, such as a review table, is cited there
with role `reference`.

## Recipe block

A photograph recipe names the record, the geometry every pixel is carried to,
and the limits:

```json
"photometry": {
  "model": "photometry/hasselmann-2016-hapke-1993.json",
  "referenceDegrees": { "incidence": 35, "emission": 0, "phase": 35 },
  "limits": { "maximumIncidenceDegrees": 70, "maximumEmissionDegrees": 70, "phaseDegrees": [25, 45], "minimumGain": 0.4, "maximumGain": 2.5 }
}
```

- Each pixel's gain is the model at the reference geometry divided by the model
  at the pixel's own geometry.
- A pixel outside the angle or phase limits, or needing a gain outside the gain
  limits, is withheld. Gains are never clamped.
- The reference must be a geometry that can occur, with the phase between
  |incidence − emission| and incidence + emission. It must lie inside the limits,
  with its phase inside the fitted range.
- Phase limits may extend past the fitted range. The prepared report then says
  the model is extrapolated.
- A shape-camera mosaic keeps its display settings beside the model:
  `displayMaximum`, `gamma`, `minimumLevel`, `maximumLevel` and the optional
  `backgroundMaximum`.

The observation seam (`observed-geo-surface.mts`), the encounter route
(`encounter-surface.mts`) and shape-camera mosaics (`shape-camera-mosaic.mts`)
accept this block. Filter-colour composites refuse it, because a model fitted in
one filter would change band ratios. Observed-colour lenses keep their
per-observation ISIS Lunar-Lambert weights, and ISIS2 orthographic images carry
no Sun geometry to normalize with.

The Shadows lighting option still bakes Lambert shading with cast shadows. A
Hapke model depends on the emission angle, which changes as the viewer rotates,
and the runtime must not evaluate it.

## Conventions that differ between sources

- **Henyey-Greenstein asymmetry:** with the phase angle g in
  (1 − ξ²)/(1 + 2ξ cos g + ξ²)^1.5, a negative ξ scatters backward.
- **Two-term Henyey-Greenstein:** Hapke (2012) weights the backward lobe by
  (1 + c)/2 with c in [−1, 1]. ISIS `HapkeHen` weights it by c in [0, 1]. Use
  `double-henyey-greenstein` for the first and `isis-henyey-greenstein` for the
  second; c_ISIS = (1 + c_Hapke2012)/2.
- **Quantity:** radiance factor and bidirectional reflectance differ by a
  constant, so a normalization ratio does not depend on which one a paper fitted.

## Tests and oracle

- `disk.test.mts` holds the disk functions to exact equality with frozen copies
  of the historical arithmetic.
- `hapke.test.mts` and `normalization.test.mts` check defining limits:
  Chandrasekhar's H(1), phase-function normalization, opposition peaks,
  reciprocity, roughness continuity where incidence meets emission, and the
  reference and limit rules.
- `isis.oracle.test.mts` compares the library with the values printed by the
  unit tests of USGS ISIS 10.0.0_LTS, to six significant digits. The cases cover
  Hapke with shadow hiding, roughness and both ISIS phase functions, plus
  Lunar-Lambert, Minnaert and Lommel-Seeliger.
  [`photometric-truth.py`](../oracles/isis/photometric-truth.py) reads the truth
  files at the pinned commit, and the fixture records each file's URL and sha256.
- ISIS's truth files do not exercise the 2002 H function, coherent backscatter
  or porosity. Those terms are checked only against their defining limits.
