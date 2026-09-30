# 1171 Rusthawelia

The asteroid 1171 Rusthawelia as a published convex lightcurve-inversion shape, scaled by a separate thermal diameter.
There is no photographed surface or independently measured topography. Shape-only views use the shared neutral gray
(#808080 sRGB), a display convention, not a measured colour; gaps keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 3188](https://damit.cuni.cz/projects/damit/asteroid_models/view/3188) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

- **Shape.** DAMIT model 3188, version 2019-05-07, from
  [Ďurech et al. (2019)](https://damit.cuni.cz/projects/damit/references/view/182). The
  [original vertex/facet table](https://damit.cuni.cz/projects/damit/stored_files/open/10084/shape.txt) has 574 vertices
  and 1144 facets. [Model fields and mesh measurements](source/reference/damit-model.json).
- **Spin.** [Original spin.txt](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/3188/spin.txt):
  J2000 ecliptic pole λ = 13°, β = 59°, sidereal period 11.00463 hours. The frame follows
  [DAMIT's documentation](https://damit.cuni.cz/pages/documentation).
- **Diameter.** 67.986 km from [Masiero et al. (2014), ApJ 791, 121](https://doi.org/10.1088/0004-637X/791/2/121)
  ([original measurement data](https://irsa.ipac.caltech.edu/TAP/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=select+%2A+from+neowisesbpropv2+where+asteroid_number%3D1171)),
  a NEATM effective spherical diameter at the observing geometry. It uses fully cryogenic W3/W4 observations with fitted
  beaming, chosen over the shorter-wavelength Masiero 2012 fit, which carries larger systematic errors and depends more
  on the assumed optical H.
- **Licences.** DAMIT model material is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), unless the original
  release states otherwise. Attribute the model authors and Astronomical Institute, Charles University, Josef Ďurech and
  Vojtěch Sidorin. NEOWISE values are distributed by NASA/IPAC IRSA and the NASA PDS Small Bodies Node; keep the
  thermal-fit authors and survey attribution.

## Processing

The DAMIT mesh has unit volume. Preparation computes its volume from the closed triangle mesh and scales it to the
thermal diameter:

```text
V = Σ dot(a, cross(b, c)) / 6
D_source = cbrt(6 * V / π)
metresPerSourceUnit = 1000 * 67.986 / D_source
                    = 54796.4395021
referenceRadiusKm = 67.986 / 2 = 33.993
```

No density, mass or gravitational parameter is inferred. The published pole is converted to J2000 equatorial with the
shared obliquity transform. The display uses an arbitrary rotational phase, and accelerated rotation is illustrative.
Shadows default to off.

## Evidence

The mesh is closed and consistently wound, and its computed volume is 1.00000016374 source units cubed, consistent with
DAMIT's unit-volume normalization. Other published diameters are kept separately, not averaged:

| Reference code | Mean JD | Diameter (km) | Quoted fit error (km) |
| --- | --- | --- | --- |
| Nug16 | 2457306.3147976 | 72.396 | 20.399 |
| Mas12 | 2455539.7254510 | 82.229 | 1.004 |
| Nug15 | 2456995.9878454 | 68.674 | 16.709 |
| Nug15 | 2456818.5080840 | 71.606 | 22.399 |

## Known problems

- DAMIT assigns quality flag 1: a coarse reconstruction from sparse photometry with substantial shape and pole
  uncertainty. Small surface features and concavities are not resolved.
- Two poles fit. Model 3188 (13°, 59°) is shown;
  [3189](https://damit.cuni.cz/projects/damit/asteroid_models/view/3189) (193°, 64°) remains unresolved. The selection
  is not evidence that one pole is physically preferred.
- Published thermal diameters disagree, from 67.986 to 82.229 km. The diameter uncertainty is ±1.091 km, a statistical
  fit error, and the original publication reports about 10% additional systematic uncertainty.
- Applying a thermal effective diameter to the convex mesh is an approximate display normalization, not a
  volume-equivalent calibration. Any Elevation dataset inherits that scale uncertainty.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Investigation ledger](investigations.json) · [Credits](NOTICE.md)
