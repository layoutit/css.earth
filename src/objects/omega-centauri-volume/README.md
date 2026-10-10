# Omega Centauri (NGC 5139)

Omega Centauri is shown as a volume of 149 XYZ slabs with stellar light baked
into them, and one shared geometry bank for both optical datasets. The app keeps
493 elements, inside the 500-element limit. **Visual acceptance remains
blocked:** the result fails the fixed axis-handoff image gate and is an
integration candidate.

## Sources

| Dataset | Native image and coverage |
| --- | --- |
| [VST/OmegaCAM, eso1119b](https://www.eso.org/public/images/eso1119b/) | G/R/I display composite; 14540 × 14540 pixels; 50.88′ square. Selected geometry/light reference. |
| [MPG/ESO 2.2-m WFI, eso0844a](https://www.eso.org/public/images/eso0844a/) | B/V/I display composite; 8040 × 7560 pixels; 31.88′ × 29.99′. Same model geometry, different image material. Two mosaic gaps contain publisher-supplied DSS data. |

The [source manifest](source/manifest.json) keeps exact image identities, full
credits and ESO's reuse terms. Published display colors do not establish natural
color or calibrated luminosity.

The [MGE recipe](source/bake-inputs/references/02-photometric-mge.json) uses the
eight projected Gaussians in [D’Souza & Rix (2013), Table 1](https://doi.org/10.1093/mnras/sts426),
with inclination 50° and photometric major-axis PA 100° east of north. The
[5426 ± 47 pc distance](https://doi.org/10.1093/mnras/stab1474) is the combined
NGC 5139 distance in Baumgardt & Vasiliev (2021), Table 2. It locates the
cluster, not individual stars. Competing fits and the rejected spherical
King-Abel experiment are in the [physical evidence](source/bake-inputs/references/04-physical-evidence.json).

## Processing

A smooth oblate MGE envelope carries broad integrated starlight. Finite positive
image residuals receive conditional depths and dataset-specific materials. Both
optical datasets use the same geometry, and no separate star layer counts the
light twice. The [method account](../../../src/objects/omega-centauri-volume/source/README.md)
explains the numerical choices.

The compiler reserves renderer copies and overhead before allocating slabs. It
keeps **X 48, Y 45, Z 56**, so the app holds 447 slab elements, 26 impostors
and 20 wrappers. All 4,085 fitted emission features, the photometric envelope,
registration and optical materials are kept. The source-owned
[compact input](source/bake-inputs.json.gz) replays without the Lab, caches or
network. The [delivery recipe](source/delivery.json) records the failed visual
qualification; `acceptedLabResult` identifies this candidate, not an acceptance
certificate. Shared preparation and replay commands are in the
[nebula guide](../../../docs/nebulae/README.md).

## Evidence

- Replay reproduced all 447 expected raw PNGs and 59 delivery files exactly.
- Native arrival, orbit, close zoom, galaxy-context return and both dataset switches each keep exactly 493 elements. Arrival framing is 204.5516 pixels in a 1440 × 1000 viewport.
- All 1,040 reference depth cells stay integrated, but on fewer slabs: estimated axis errors are 10.5–10.7% against a 1% target, and front views are 23–25% brighter than the previous 459-slab bank.
- Neutral X/Z and Y/Z handoff L1 is **0.131881 / 0.125192**, above the **0.04** limit. All nine tested dataset/axis pairs fail it; brightness disagreement between axes stays below 5%.

The [descriptor](object.json) and [inventory](inventory.json) pin the delivery.

## Known problems

- Axis-handoff image stability is outside the acceptance limits. Earlier Lab inspection also exposed a false grid and an oblique compositor rectangle.
- Desktop GPU performance has not been measured.
- The shared zoom minimum is **0.05 framing radii (2.17 pc)**. Reaching it does not establish an acceptable close-up view.
- Near/far tilt and the six-sigma numerical support cutoff are authored. The MGE's coefficient uncertainties are unavailable.
- Absolute astrometry starts from publisher AVM. Relative image registration does not establish absolute Gaia astrometry or independent WFI detections in DSS-filled gaps.
- The 512-pixel fit and minimum 5.80-arcsec projected sigma soften native stellar texture. Crowding, saturated cores, seeing and publisher display stretches remain. Fitted light features are not a resolved-star catalogue, dynamical mass map or N-body simulation.

The [investigation ledger](investigations.json) records selected sources,
alternatives and unresolved acceptance.
