# Nereid source survey

Status: research only. The radius-only spherical scene has been withdrawn; neither a complete shape nor photographic surface mapping is qualified.

## Physical interpretation

- Target: Neptune II, NAIF 802; parent Neptune, NAIF 899.
- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) list a mean radius of 170 ± 25 km. The zero GM field is an unmodeled mass, not a claim of zero physical mass.
- [Kiss et al. (2016)](https://arxiv.org/abs/1601.02395) derive a thermal-model diameter of 345 ± 15 km. This is consistent with the older size estimate but is not a measured three-dimensional shape or a terrain map.
- The [NASA PIA00054 caption](https://science.nasa.gov/resource/nereid/) calls 170 km the distance across. That conflicts with the radius in JPL's table and the research diameter. Do not copy the caption's size into geometry.
- Detailed shape, surface-coordinate registration and current orientation remain unqualified. The included sphere is explicitly described as a size approximation.

## Image and dataset survey

- [Voyager ISS/PDS](https://pds-rings.seti.org/voyager/iss/): 325 catalog matches, first 12 retained in `source/survey/opus.json`. Both the finest C1137631 (43.27 km/pixel, 96.12° phase) and lower-phase C1129120 (62.09 km/pixel, 55.74° phase) calibrated native frames were inspected. Their discs span roughly eight and five pixels. Photographed illumination and sampling dominate; their pole/landmark registration is unqualified. No photographic lens is included. Exact inspected product hashes and original labels are retained in `source/survey`.
- [Kiss et al. (2016)](https://academic.oup.com/mnras/article/457/3/2908/2588900): K2 rotation, Spitzer/Herschel thermal photometry and model-derived shape constraints add physical context. They do not provide a spatial DEM, thermal map or composition map. The study explicitly says the Voyager data do not constrain the detailed shape. Its roughness inference is not rendered as invented craters.
- [JPL texture inventory](https://space.jpl.nasa.gov/tmaps/neptune.html) supplies no Nereid surface map. No registered terrain product was qualified from the inspected mapping releases or their cited work. Future image registration remains possible research, not a claim that photographs do not exist.

## Presentation decision

No standalone scene is included. A mean-radius estimate does not establish a
spherical shape, and the gray missing-data grid cannot correct unsupported
geometry. The initial spherical size proxy was withdrawn after visual review.
The original native-image inspection and candidate evidence are retained above.
A future scene needs defensible geometry and honest coverage; missing axes must
not be silently invented from a projected outline.
