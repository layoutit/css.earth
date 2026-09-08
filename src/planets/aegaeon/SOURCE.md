# Aegaeon source record

## Included presentation

[Hedman et al. (2020), Table 1](https://arxiv.org/abs/1912.09192) supplies semiaxes 0.7 × 0.25 × 0.2 km with uncertainties 0.05 × 0.06 × 0.08 km. The table attributes the source shapes to Cassini measurements, including Thomas et al. and Thomas & Helfenstein. The mesh is an analytic ellipsoid approximating those axes, not a copy of the detailed irregular shape solution.

Physical scale uses the volume-equivalent radius 0.327106631018859 km. The 5° radius table and formula are checked in. Meshoptimizer prepares 480 native triangle leaves; its 8.177665775471475 m error allowance is a simplifier parameter, not a physical measurement uncertainty.

The Shape model lens uses the normal shared grid throughout: there are no mapped surface texels. The UI says Measured shape; this does not imply mapped terrain.

## Source survey

- [Cassini ISS/PDS](https://pds-rings.seti.org/cassini/iss/): actual OPUS source products were downloaded and inspected at native resolution. The query and candidate evidence are in source/survey. The 2010 and 2015 resolved candidates remain unqualified for texture mapping: published and OPUS longitude conventions disagree, and the reconstructed camera did not securely locate a usable disc. This is not a claim that resolved Aegaeon imagery does not exist.
- Published photometry and visible spectra in Hedman et al. constrain integrated brightness; they are not additional spatial lenses. Table 27 multicolor frames remain a possible later source if registration is resolved.
- [PDS Saturn shape release](https://doi.org/10.26033/ewy3-jy61): no body-specific deliverable for this target was qualified for this package; the measured-axis source above owns the approximation.
- No qualified DEM, geology, or mapped composition product was found in the inspected releases and cited study. No artificial terrain or dust arc is added.

## Orientation, position and delivery

Frozen historical Aegaeon pole from the mission BPC at 2015-12-19T12:32:14.886 UTC, arbitrary display meridian; not a current spin prediction. Pole RA 40.57815780620991°, Dec 83.53745027635604°.  This is distinct from the orbital position, which uses JPL Horizons samples over 2020–2032 and the shared fitted ellipse plus prepared slow-longitude libration terms. Independent fractional-day reference epochs measure fit residuals, not a universal accuracy bound; extrapolation outside the fitted interval is not qualified.

Both shared Flood and Shadows remain available. Prepared context, minimap, thumbnail and lighting derive from this same shape and material. Source inputs and authored documents are pinned in source/manifest.json; external files are restorable through preparation/acquisition.json. NASA/PDS source attribution and the separate ESO/font terms are retained.
