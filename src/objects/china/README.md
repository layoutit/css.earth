# 1125 China

The asteroid 1125 China as a published convex lightcurve-inversion shape, scaled by a separate thermal diameter. There
is no photographed surface or independently measured topography. Shape-only views use the shared neutral gray (#808080
sRGB), a display convention, not a measured color; gaps keep the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT 1119](https://damit.cuni.cz/projects/damit/asteroid_models/view/1119) |
| Physical scale | [Calibration and uncertainty](source/reference/calibration.json) |

- **Shape.** DAMIT model 1119, version 2016-01-04, from
  [Hanuš et al. (2016)](https://damit.cuni.cz/projects/damit/references/view/161). The
  [original vertex/facet table](https://damit.cuni.cz/projects/damit/stored_files/open/4104/shape.txt) has 1021 vertices
  and 2038 facets. [Model fields and mesh measurements](source/reference/damit-model.json).
- **Spin.** [Original spin.txt](https://damit.cuni.cz/projects/damit/generated_files/open/AsteroidModel/1119/spin.txt):
  J2000 ecliptic pole λ = 305°, β = -49°, sidereal period 5.36863 hours. The frame follows
  [DAMIT's documentation](https://damit.cuni.cz/pages/documentation).
- **Diameter.** 26.084 km from [Masiero et al. (2011), ApJ 741, 68](https://doi.org/10.1088/0004-637X/741/2/68)
  ([original measurement data](https://irsa.ipac.caltech.edu/TAP/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=csv&QUERY=select+%2A+from+neowisesbpropv2+where+asteroid_number%3D1125)),
  a NEATM effective spherical diameter at the observing geometry. It is the four-band fit the JPL SBDB physical field
  selects.
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
metresPerSourceUnit = 1000 * 26.084 / D_source
                    = 21023.6012052
referenceRadiusKm = 26.084 / 2 = 13.042
```

No density, mass or gravitational parameter is inferred. The published pole is converted to J2000 equatorial with the
shared obliquity transform. The display uses an arbitrary rotational phase, and accelerated rotation is illustrative.
Shadows default to off.

## Evidence

The mesh is closed and consistently wound, and its computed volume is 0.999999694505 source units cubed, consistent with
DAMIT's unit-volume normalization. Other published diameters are kept separately, not averaged:

| Reference code | Mean JD | Diameter (km) | Quoted fit error (km) |
| --- | --- | --- | --- |
| Mas11 | 2455241.0056985 | 27.391 | 0.31 |
| Nug16 | 2457025.9881068 | 21.297 | 6.276 |
| Nug16 | 2457190.4980879 | 21.724 | 5.891 |
| Nug15 | 2456704.8563375 | 23.946 | 6.028 |

## Known problems

- A convex reconstruction describes broad shape and cannot recover small craters or concavities. The archived record
  leaves its quality flag blank.
- Two poles fit. Model 1119 (305°, -49°) is shown;
  [1120](https://damit.cuni.cz/projects/damit/asteroid_models/view/1120) (132°, -46°) remains unresolved. The selection
  is not evidence that one pole is physically preferred.
- The diameter uncertainty is ±0.199 km, a statistical fit error. The original publication reports about 10% additional
  systematic uncertainty. Applying a thermal effective diameter to the convex mesh is an approximate display
  normalization, not a volume-equivalent calibration. Any Elevation dataset inherits that scale uncertainty.
- Face 1723 is a tiny sliver (area 3.07596e-09 source units squared) with a slightly negative normal, consistent with
  rounding of the published six-decimal coordinates. It is kept as published.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation](source/preparation/) · [Investigation ledger](investigations.json) · [Credits](NOTICE.md)
