# Naiad sources and interpretation

The rendered surface is an explicitly labeled Shape model. Karkoschka (2003),
[DOI: 10.1016/S0019-1035(03)00002-2](https://doi.org/10.1016/S0019-1035(03)00002-2), gives 48 × 30 × 26 km semiaxes in the publisher
abstract. A sampled analytic ellipsoid preserves those dimensions; it contains
no measured local relief. Its principal axes use the synchronous IAU frame as
an orientation approximation. JPL’s nominal 29 km mean radius is the reference
scale only; the ellipsoid is not normalized to it. Source inputs retain the
formula, axes, PCK rotation and Horizons physical metadata.

| Candidate | Disposition |
| --- | --- |
| Karkoschka (2003) Voyager-derived ellipsoid | Included as Shape model; no elevation lens from an analytic ellipsoid. |
| PDS Voyager GEOMED images | Excluded as surface textures. Geometry inventory gives best sampling 17.69 km/native pixel (C1135231, 15.36 s exposure), next 21 km/pixel (C1134547). A 96 km maximum diameter spans only about 5 native pixels. Long-exposure smear and sparse geometry do not support terrain mapping. Survey metadata is retained. |
| HST recovery of Naiad, Showalter et al. (2019), https://pmc.ncbi.nlm.nih.gov/articles/PMC6424524/ | Astrometry and unresolved detections, not a surface map. |
| PDS Stooke shape release, https://sbn.psi.edu/pds/resource/stkshape.html | No Naiad model listed; no detailed mesh adopted. |
| USGS mapping and published photometry | No usable Naiad cartographic or spatial scalar product found in this pass. Disk-integrated photometry does not supply local color or elevation. |

The published study explains that the inner four Neptunian moons were imaged
as small, often trailed disks. A gray grid identifies every unavailable surface
sample through the existing shared coverage preparer. Flood lighting and Shadows
both describe the same approximate geometry. Surface, thumbnail, minimap and
companion portrait use that prepared grid. No source image is deblurred or filled.

Preparation uses the authored terrestrial recipe, native u triangles and existing
meshoptimizer with a 480-face target (2,000 maximum). Source acquisition restores
pinned external font and starfield inputs; the scientific numeric model is
checked in. Use the shared acquire and prepare commands for naiad.
