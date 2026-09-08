# Himalia source survey

Status: source qualification in progress. No prepared scene or surface lens is registered yet.

## Physical interpretation

- Target: Jupiter VI, NAIF 506; parent Jupiter, NAIF 599.
- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) list a mean radius of 85 ± 10 km and GM of 0.15155 ± 0.05763 km³/s². Retain the uncertainty; do not infer a precisely measured mass or density.
- [NASA's Cassini observation](https://science.nasa.gov/resource/distant-himalia/) was acquired on 2000-12-19 at about 27 km/pixel. The approximately 160 km apparent height is a projected extent, not a complete three-dimensional shape solution. The published inset is enlarged tenfold.
- [The 2018 occultation report](https://meetingorganizer.copernicus.org/EPSC-DPS2019/EPSC-DPS2019-1909-1.pdf) constrains an elliptical projected outline larger than the Cassini estimate. Resolve its final analysis and coordinate definitions before choosing geometry; a projected ellipse does not determine the unseen third axis.
- Pole, rotational phase and complete shape remain unqualified. Do not fill missing axes by silently copying an observed axis.

## Candidate views

| Source | What it can add | Current disposition |
| --- | --- | --- |
| [Cassini ISS archive](https://pds-rings.seti.org/cassini/iss/), OPUS query in `source/survey/opus.json` | Original frames, calibration and geometry | Unresolved: inspect native products and filter metadata before mapping imagery. |
| Finest returned Cassini frame `co-iss-n1355869401` | Approximately 26.60 km/pixel sampling at a 69.12° phase angle | Unresolved: only several pixels span the disc, so pointing, limb coverage and photographed shading matter. |
| Cassini press image | Identifies the observation and its limitations | Reference only; the enlarged inset is not a higher-resolution texture. |
| Stellar occultation analysis | Projected size and shape constraints | Physical geometry candidate; not a surface map and not yet a full 3D model. |

The query returned 93 matching catalog entries on 2026-09-08. This is an archive
search result, not a count of usable images. Its first 12 records are retained.
A broader release/paper survey, including other spacecraft observations, and
native image inspection are still required.

## Implementation boundary

Use the generic object adapter, shared lighting and standard missing-data grid.
Only add imagery after its sampling, valid coverage and camera registration
are established. Source restoration, an independently checked orbital fit,
a qualified display orientation and real-browser review remain implementation
work. A model-only view must disclose the missing shape or surface information.
