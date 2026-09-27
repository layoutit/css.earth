# Earth: spectral mosaics and vegetation observations

Proposal 67 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Blue Marble photography does not preserve ASTER or AVIRIS spectral bands or measured vegetation stress.

Qualify one useful native spectral observing set, with separately defined vegetation products when their source retrieval is available.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The reviewed pages identify Anti-Atlas ASTER, North American MISR, Rim Fire AVIRIS, Sierra forest stress and SHIFT flight coverage. The ASTER global browse mosaic was assembled from thumbnails.

## Work

Verify public product availability, acquire calibrated bands and geometry, retain acquisition dates and quality flags, and compare source support with current imagery.

## Limits and prior decisions

The SHIFT flight map is an availability lead, not proof the native cube is downloadable. A thumbnail mosaic or added shaded relief is not calibrated surface reflectance.

## Acceptance

Native access, band wavelengths/units, registration, measured footprint and uncertainty for any derived vegetation quantity.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/anti-atlas-mountains-morocco/)
- [NASA source page](https://science.nasa.gov/photojournal/natural-color-mosaic-of-north-america/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aviris-map-shows-spectral-signature-of-2013-rim-fire/)
- [NASA source page](https://science.nasa.gov/photojournal/california-drought-effects-on-sierra-trees-mapped-by-nasa/)
- [NASA source page](https://science.nasa.gov/photojournal/aster-global-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/anti-atlas-mtns-morocco/)
- [NASA source page](https://science.nasa.gov/photojournal/shift-campaign-research-plane-flight-area-map/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA03893](https://science.nasa.gov/photojournal/anti-atlas-mountains-morocco/) | candidate | ASTER Anti-Atlas spectral imagery is a regional geological/vegetation imaging lead, not the Saturn moon Atlas or a ready mineral abundance grid. |
| [PIA04361](https://science.nasa.gov/photojournal/natural-color-mosaic-of-north-america/) | candidate | MISR North America cloud-free mosaic mixes imagery with shaded-relief inputs; compare actual spectral/photographic gain over Blue Marble and separate injected relief. |
| [PIA19361](https://science.nasa.gov/photojournal/nasas-aviris-map-shows-spectral-signature-of-2013-rim-fire/) | candidate | AVIRIS Rim Fire spectrum differentiates charred material; native bands and classification method could support a regional spectral change view. |
| [PIA20717](https://science.nasa.gov/photojournal/california-drought-effects-on-sierra-trees-mapped-by-nasa/) | candidate | Airborne Sierra forest drought/stress mapping is a regional spectral/model product; recover original retrieval, date and uncertainty rather than treat it as a current tree-mortality survey. |
| [PIA22979](https://science.nasa.gov/photojournal/aster-global-mosaic/) | candidate | ASTER global mosaic is explicitly made from thumbnail browse images; useful as an archive lead only, with original calibrated bands required for any scientific surface product. |
| [PIA23533](https://science.nasa.gov/photojournal/anti-atlas-mtns-morocco/) | candidate | ASTER Anti-Atlas visible/near-/shortwave-IR image is a regional spectral lead; cross-match with PIA03893 before treating a newer page as new data. |
| [PIA25144](https://science.nasa.gov/photojournal/shift-campaign-research-plane-flight-area-map/) | candidate | SHIFT flight-area map is a route to repeated AVIRIS-NG spectra, not the measurements themselves; verify original campaign data before promising vegetation change maps. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
