# Titan: qualify Huygens descent imaging

Proposal 71 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Global Titan products do not resolve the Huygens landing region at descent-image scales.

Establish whether original DISR observations can be registered as a very small measured regional dataset on the existing body.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

## Evidence

The supplied pages show mosaics taken from several altitudes, including river-like channels and a roughly 1.3 km landing-region footprint.

## Work

Recover calibrated DISR frames, descent poses and the relevant terrain reference. Verify the image-triplet accounting against native records rather than the press montage.

## Limits and prior decisions

No surface-photo panel and no panorama wrapped around the globe. The small footprint may have no useful presentation at current zoom limits.

## Acceptance

Authoritative camera/terrain registration, native pixel geometry, footprint and demonstrable value within existing controls; stop if those conditions fail.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-river-channel-and-ridge-area-on-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/huygens-titan-mosaic-1/)
- [NASA source page](https://science.nasa.gov/photojournal/huygens-titan-mosaic-2/)
- [NASA source page](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view/)
- [NASA source page](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view-at-different-altitudes/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA07236](https://science.nasa.gov/photojournal/mosaic-of-river-channel-and-ridge-area-on-titan/) | candidate | Three Huygens DISR descent frames resolve ridge/channel terrain locally; a registered regional observation requires original camera geometry and a valid site frame. |
| [PIA07870](https://science.nasa.gov/photojournal/huygens-titan-mosaic-1/) | candidate | Huygens descent stereographic mosaic projects images from a 3 km height; source poses and terrain assumptions must be recovered before surface registration. |
| [PIA07871](https://science.nasa.gov/photojournal/huygens-titan-mosaic-2/) | candidate | Huygens lower-altitude mosaic covers about 1.3 km; it is a distinct local support/resolution product, not an entire Titan texture. |
| [PIA08113](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view/) | candidate | Huygens 10 km descent poster is a Mercator presentation of camera views; original DISR records are needed for physical surface mapping. |
| [PIA08427](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view-at-different-altitudes/) | candidate | Huygens four-altitude poster represents multiple local observing geometries; use original frames and poses, not a continuous fabricated descent surface. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
