# Omega Centauri: projected shape and conditional depth

The selected prior is the published eight-component oblate Multi-Gaussian Expansion
(MGE), recorded in [photometric-mge.json](photometric-mge.json). It describes a smooth
stellar light distribution with changing flattening across radius. Its 3D depth is
conditional on axisymmetry and inclination; individual stellar depths are not measured.
The [physical ledger](physical-evidence.json) records values, access status and limits;
[mge-method.md](mge-method.md) gives the conversion and coordinate conventions.

## Selected constraints

| Constraint | Adopted value | Source and limitation |
| --- | --- | --- |
| Projected profile | Eight Gaussian amplitudes, angular widths and projected axis ratios | [D’Souza & Rix 2013](https://doi.org/10.1093/mnras/sts426), Table 1; full author PDF inspected. Coefficient uncertainties/covariance are not supplied. |
| Photometric major axis | 100° east of north | [van de Ven et al. 2006](https://arxiv.org/pdf/astro-ph/0509228), §2.3.3: nearly constant between 5–15 arcmin. No formal error bar supplied there. |
| Inclination | 50° | D’Souza adopts 50±3°; the earlier van de Ven fit reports 50±4°. This is a selected model convention, not a combined uncertainty estimate. |
| Distance | 5426±47 pc | [Baumgardt & Vasiliev 2021](https://doi.org/10.1093/mnras/stab1474), combined-distance table, NGC 5139 row, inspected directly. Angular widths remain unchanged. |
| Center | ICRS (201.696958°, −47.479539°) | Re-anchor the published radial shape to the common observation frame; the older paper used a different kinematic center. |

The full paper and table resolve the earlier position-angle and fitted-profile gaps.
[Watkins et al. 2013](https://academic.oup.com/mnras/article/436/3/2598/1258888),
Table 1, independently reproduces the same MGE and explicitly identifies its
amplitudes as central projected surface brightness. Its −80° major axis is equivalent
to 100°; the signed rotation parameters are unnecessary for this static light prior.

## Competing constraints and historical trials

- **Modern kinematics:** [Häberle et al. 2024, accepted v2](https://arxiv.org/html/2404.03722v2),
  §8.2, gives PA104±1° and inclination43.9±1.3°. This is a different kinematic fit.
  The old MGE requires inclination greater than43.603810°; the newer uncertainty
  interval crosses that boundary. It cannot be inserted into this profile without
  checking every component's deprojection.
- **Wilson fit:** the actual [McLaughlin & van der Marel CDS table](https://cdsarc.cds.unistra.fr/ftp/J/ApJS/161/304/table10.dat)
  gives W0=4.70±0.10 and scale radius196.810 +7.080/−7.010 arcsec. Its chi²24.28 is
  lower than the King(1966) fit's89.81 for the same54 points. This comparison does not
  invalidate every other family; MGE supplies the radial flattening needed here.
  Wilson's scale radius is not its projected core radius, and its parameters cannot
  be substituted into an empirical King(1962) law.
- **Rejected King-Abel experiment:** [king-abel-profile.json](king-abel-profile.json)
  remains unchanged as historical evidence. Its spherical shape, substitution of a
  3D dynamical core radius for a projected radius, and approximate conversion from
  mass radius to light radius are not used by the selected MGE.
- **Unresolved structure:** rotation, central counter-rotation and population-dependent
  dynamics complicate a smooth oblate interpretation. Those observations do not by
  themselves prove triaxiality; no measured triaxial model is supplied here.

## What the source recipe establishes

It establishes a reproducible, source-backed conditional depth prior. The near/far
mirror choice and finite cutoff are authored. The images retain integrated starlight;
relative image emission does not become calibrated luminosity, resolved member stars
or a stellar mass map. A published shape does not establish image registration,
completed baking, credible side views or application acceptance. Those outcomes need
their own receipts and visual checks.
