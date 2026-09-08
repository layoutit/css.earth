# Polydeuces source record

## Included presentation

[Hedman et al. (2020), Table 1](https://arxiv.org/abs/1912.09192) supplies semiaxes 1.75 × 1.55 × 1.31 km with uncertainties 0.2 × 0.2 × 0.2 km. Appendix B revises the older 1.5 × 1.2 × 1.0 km values. The mesh is an analytic ellipsoid approximating those axes, not a copy of the detailed irregular shape solution.

Physical scale uses the volume-equivalent radius 1.525973578806757 km. The 5° radius table and formula are checked in. Meshoptimizer prepares 480 native triangle leaves; its 38.149339470168925 m error allowance is a simplifier parameter, not a physical measurement uncertainty.

The Monochrome lens uses NASA/JPL-Caltech/SSI Cassini N1527002576, CL1/IR1 near infrared, 2006-05-22. The body is only about 9 × 7 native pixels. CISSCAL I/F and detached label are pinned, along with the raw frame used to exclude saturation. Table 7 provides camera center, north azimuth, observer/Sun coordinates and range; the shared camera projection uses the measured-axis approximation. The 1-pixel inset and 55° incidence/emission cuts limit limb/registration uncertainty. Bounded Lommel-Seeliger normalization (gain ≤2) suppresses geometric shading without inventing fine terrain or recovering albedo. Gray grid retains true gaps.

## Source survey

- [Cassini ISS/PDS](https://pds-rings.seti.org/cassini/iss/): actual OPUS source products were downloaded and inspected at native resolution. The query and candidate evidence are in source/survey. The finer 2015 crescent is excluded because it mixes strong Saturnshine with direct solar illumination.
- Published photometry and visible spectra in Hedman et al. constrain integrated brightness; they are not additional spatial lenses.
- [PDS Saturn shape release](https://doi.org/10.26033/ewy3-jy61): no body-specific deliverable for this target was qualified for this package; the measured-axis source above owns the approximation.
- No qualified DEM, geology, or mapped composition product was found in the inspected releases and cited study. No artificial terrain or dust arc is added.

## Orientation, position and delivery

Display pole aligned to the fitted orbital normal; arbitrary meridian, no measured spin or current landmark phase is claimed. Pole RA 40.562369830280026°, Dec 83.5427248263262°. Photographic registration uses its separate historical Table 7 frame. This is distinct from the orbital position, which uses JPL Horizons samples over 2020–2032 and the shared fitted ellipse plus prepared slow-longitude libration terms. Independent fractional-day reference epochs measure fit residuals, not a universal accuracy bound; extrapolation outside the fitted interval is not qualified.

Both shared Flood and Shadows remain available. Prepared context, minimap, thumbnail and lighting derive from this same shape and material. Source inputs and authored documents are pinned in source/manifest.json; external files are restorable through preparation/acquisition.json. NASA/PDS source attribution and the separate ESO/font terms are retained.
