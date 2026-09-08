# Nereid source survey

Status: source qualification in progress. No prepared scene or surface lens is registered yet.

## Physical interpretation

- Target: Neptune II, NAIF 802; parent Neptune, NAIF 899.
- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) list a mean radius of 170 ± 25 km. The zero GM field is an unmodeled mass, not a claim of zero physical mass.
- [Kiss et al. (2016)](https://arxiv.org/abs/1601.02395) derive a thermal-model diameter of 345 ± 15 km. This is consistent with the older size estimate but is not a measured three-dimensional shape or a terrain map.
- The [NASA PIA00054 caption](https://science.nasa.gov/resource/nereid/) calls 170 km the distance across. That conflicts with the radius in JPL's table and the research diameter. Do not copy the caption's size into geometry.
- Detailed shape, surface-coordinate registration and current orientation remain unqualified. A future spherical size model must be explicitly described as an approximation.

## Candidate views

| Source | What it can add | Current disposition |
| --- | --- | --- |
| [Voyager ISS archive](https://pds-rings.seti.org/voyager/iss/), OPUS query in `source/survey/opus.json` | Original images and camera metadata | Unresolved: inspect native products, detector sampling and observation geometry before selecting a frame. |
| Finest returned Voyager frame `vg-iss-2-n-c1137631` | Approximately 43.27 km/pixel sampling at a 96.12° phase angle | Unresolved: a coarse, strongly illuminated/shadowed disc; not evidence of a usable global map. |
| Voyager sequence beginning `vg-iss-2-n-c1129120` | Lower phase angle, approximately 55.74°, at 62.09 km/pixel | Compare against the finest sequence before choosing; higher illumination may be more useful than pixel scale alone. |
| Kiss et al. K2, Herschel and Spitzer measurements | Rotation, thermal-model size and integrated surface constraints | Physical context candidate; unresolved spatial terrain is not an elevation, thermal or composition texture. |

The query returned 325 matching catalog entries on 2026-09-08. This is an archive
search result, not a count of usable images. Its first 12 records are retained.
A broader release/paper survey and native image inspection are still required.

## Implementation boundary

Use the generic object adapter, shared lighting and standard missing-data grid.
Do not map a press-image enlargement or infer unobserved terrain. Keep the
image acquisition epoch separate from the scene's orbital epoch. Source
restoration, an independently checked orbital fit, a qualified display
orientation and real-browser review remain implementation work.
