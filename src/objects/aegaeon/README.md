# Aegaeon

## Sources

- [Hedman et al. (2020), Table 1](https://arxiv.org/abs/1912.09192) supplies semiaxes 0.7 × 0.25 × 0.2 km with uncertainties 0.05 × 0.06 × 0.08 km.

## Evidence

- [Cassini ISS/PDS](https://pds-rings.seti.org/cassini/iss/): actual OPUS source products were downloaded and inspected at native resolution. The query and candidate evidence are in [source/survey](source/survey).

## Known problems

- The mesh is an analytic ellipsoid approximating those axes, not a copy of the detailed irregular shape solution. The Shape model lens uses the normal shared grid throughout: there are no mapped surface texels.

- The 2010 and 2015 resolved candidates remain unqualified for texture mapping: published and OPUS longitude conventions disagree, and the reconstructed camera did not securely locate a usable disc.

- Frozen historical Aegaeon pole from the mission BPC at 2015-12-19T12:32:14.886 UTC, arbitrary display meridian; not a current spin prediction. This is distinct from the orbital position, which uses JPL Horizons samples over 2020–2032 and the shared fitted ellipse plus prepared slow-longitude libration terms. Independent fractional-day reference epochs measure fit residuals, not a universal accuracy bound; extrapolation outside the fitted interval is not qualified.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="aegaeon-source-record"></a>

## Included presentation

The table attributes the source shapes to Cassini measurements, including Thomas et al. and Thomas & Helfenstein.

Physical scale uses the volume-equivalent radius 0.327106631018859 km. The 5° radius table and formula are checked in. Meshoptimizer prepares 480 native triangle leaves; its 8.177665775471475 m error allowance is a simplifier parameter, not a physical measurement uncertainty.

The UI says Measured shape; this does not imply mapped terrain.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation, position and delivery

Pole RA 40.57815780620991°, Dec 83.53745027635604°.

Both shared Flood and Shadows remain available. Prepared context, minimap, thumbnail and lighting derive from this same shape and material. Source inputs and authored documents are pinned in source/manifest.json; external files are restorable through preparation/acquisition.json. NASA/PDS source attribution and the separate font terms are retained.

</details>
