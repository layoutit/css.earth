# Earth: atmospheric gases and microwave observations

Proposal 52 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Existing Earth imagery and clouds do not establish measured CO₂, CO, dust, methane-plume or microwave fields.

Qualify a small set of atmosphere measurements that can be described faithfully on an existing map or chart, without adding atmospheric rendering.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The supplied pages include mid-tropospheric AIRS gases, regional methane plumes and 34 GHz COWVR emissions. They sample different altitudes and quantities.

## Work

Choose original numeric products and record pressure/altitude sensitivity, time interval, retrieval quality and footprint. Keep local plume detections separate from global fields.

## Limits and prior decisions

These are not surface chemistry maps. Microwave brightness is not a direct wind or humidity measurement without the retrieval. Emission-rate estimates need their wind/model uncertainty.

## Acceptance

Source quantity and vertical sensitivity, native samples, masks and epoch. Stop if the existing content contract cannot clearly preserve these distinctions.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/cloud-height-maps-for-hurricanes-frances-and-ivan/)
- [NASA source page](https://science.nasa.gov/photojournal/airs-global-map-of-carbon-dioxide-from-space/)
- [NASA source page](https://science.nasa.gov/photojournal/airs-map-of-carbon-monoxide-draped-on-globe-time-series-from-812005-to-9302005/)
- [NASA source page](https://science.nasa.gov/photojournal/airs-detection-of-dust-global-map-for-july-2003/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-quikscat-maps-southern-californias-destructive-santa-ana-winds/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-airs-maps-carbon-monoxide-from-brazil-fires-2/)
- [NASA source page](https://science.nasa.gov/photojournal/cowvrs-new-map/)
- [NASA source page](https://science.nasa.gov/photojournal/emit-identifying-methane-plumes-around-the-globe/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA04367](https://science.nasa.gov/photojournal/cloud-height-maps-for-hurricanes-frances-and-ivan/) | candidate | MISR hurricane cloud-top heights are measured regional retrievals from two dates; original height grids and cloud masks could fit a prepared observation view. |
| [PIA09269](https://science.nasa.gov/photojournal/airs-global-map-of-carbon-dioxide-from-space/) | candidate | AIRS CO₂ is a mid-tropospheric retrieval, not surface emissions; original pressure sensitivity and units must accompany the prepared field. |
| [PIA09936](https://science.nasa.gov/photojournal/airs-map-of-carbon-monoxide-draped-on-globe-time-series-from-812005-to-9302005/) | candidate | AIRS CO time series spans August–September 2005; select native dated grids with retrieval quality, not colors sampled from a rendered globe. |
| [PIA09940](https://science.nasa.gov/photojournal/airs-detection-of-dust-global-map-for-july-2003/) | candidate | AIRS July 2003 dust proxy is a difference between 961 and 1231 cm⁻¹ brightness temperatures; it is not direct dust mass concentration. |
| [PIA10089](https://science.nasa.gov/photojournal/nasas-quikscat-maps-southern-californias-destructive-santa-ana-winds/) | candidate | QuikScat October 2007 offshore wind speed/direction is a measured event field; keep vector retrieval quality and coastal limitations, using a supported scalar/chart presentation. |
| [PIA23356](https://science.nasa.gov/photojournal/nasas-airs-maps-carbon-monoxide-from-brazil-fires-2/) | candidate | AIRS Brazil CO series samples about 500 hPa and each displayed day averages three days; preserve altitude sensitivity and averaging windows. |
| [PIA24985](https://science.nasa.gov/photojournal/cowvrs-new-map/) | candidate | COWVR January 16–23 2022 map measures 34 GHz emissions; it is not direct wind or humidity without an explicit retrieval model. |
| [PIA26113](https://science.nasa.gov/photojournal/emit-identifying-methane-plumes-around-the-globe/) | candidate | EMIT methane plumes are local atmospheric detections; emission estimates depend on wind and model uncertainty, not surface abundance or uniform global coverage. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
