# Anthe

## Sources

- A nominal 0.5 km radius from [NASA/NAIF PCK00011, BODY649](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc).

- [Hedman et al. (2020)](https://arxiv.org/abs/1912.09192), section 2.2, explicitly state that Anthe was not resolved well enough to determine shape and size accurately.

## Evidence

- [Cassini ISS/PDS](https://pds-rings.seti.org/cassini/iss/): actual OPUS source products were downloaded and inspected at native resolution. The query and candidate evidence are in [source/survey](source/survey).

- The best 0.714 km/pixel candidate spans roughly 1.4 native pixels for the nominal diameter; it cannot supply a surface map.

## Known problems

- A sphere represents this uncertain size estimate; it is not a measured shape. The Shape model lens uses the normal shared grid throughout: there are no mapped surface texels.

- Display pole aligned to the fitted orbital normal; arbitrary meridian, no measured spin or current landmark phase is claimed. This is distinct from the orbital position, which uses JPL Horizons samples over 2020–2032 and the shared fitted ellipse plus prepared slow-longitude libration terms. Independent fractional-day reference epochs measure fit residuals, not a universal accuracy bound; extrapolation outside the fitted interval is not qualified.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="anthe-source-record"></a>

## Included presentation

Physical scale uses the volume-equivalent radius 0.5 km. The 5° radius table and formula are checked in. Meshoptimizer prepares 480 native triangle leaves; its 12.5 m error allowance is a simplifier parameter, not a physical measurement uncertainty.

The UI says Estimated size.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation, position and delivery

Pole RA 40.57620028935955°, Dec 83.53641614640954°.

Both shared Flood and Shadows remain available. Prepared context, minimap, thumbnail and lighting derive from this same shape and material. Source inputs and authored documents are pinned in source/manifest.json; external files are restorable through preparation/acquisition.json. NASA/PDS source attribution and the separate font terms are retained.

</details>
