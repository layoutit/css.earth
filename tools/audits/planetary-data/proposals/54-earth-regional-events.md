# Earth: qualify regional change and hazard maps

Proposal 54 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The Earth package has global views; the supplied ARIA, ASTER, ECOSTRESS and radar examples are mostly local events.

A bounded intake PR identifying a small set of scientifically clear regional measurements, such as ground displacement, flood extent or surface temperature, that fit the existing map contract.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The Photojournal list contains many earthquake, flood, fire and deformation maps. They are separate products with different observation windows and uncertainty.

## Work

Group by physical quantity, recover original georeferenced data and quality flags, and choose one representative source-qualified event per supported quantity before expanding.

## Limits and prior decisions

A damage-proxy signal is not a building-damage survey. Thermal burn-risk examples are not a forecast. Do not revive an unrelated local-imagery or surface-photographs UI.

## Acceptance

Before/after time alignment, units, projection, uncertainty, valid footprint and whether current zoom/detail can display the result usefully. Retain low-value cases in the ledger instead of adding clutter.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/mosaic-image-of-fires-in-indonesia/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-northern-sumatra-indonesia/)
- [NASA source page](https://science.nasa.gov/photojournal/kidsat-image-of-sumatra-indonesia-and-map/)
- [NASA source page](https://science.nasa.gov/photojournal/nyiragongo-volcano-congo-map-view-with-lava-landsat-aster-srtm/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-quikscat-maps-southern-californias-destructive-santa-ana-winds/)
- [NASA source page](https://science.nasa.gov/photojournal/uavsar-maps-the-gulf-coast-oil-spill/)
- [NASA source page](https://science.nasa.gov/photojournal/aster-maps-continued-pakistan-flooding-false-color/)
- [NASA source page](https://science.nasa.gov/photojournal/aster-maps-continued-pakistan-flooding/)
- [NASA source page](https://science.nasa.gov/photojournal/aster-maps-fourmile-canyon-fire-near-boulder-colo/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-generated-damage-map-to-assist-with-2015-gorkha-nepal-earthquake-disaster-response/)
- [NASA source page](https://science.nasa.gov/photojournal/new-alos-2-damage-map-assists-2015-gorkha-nepal-disaster-response/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-damage-proxy-map-to-assist-with-italy-earthquake-disaster-response/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-generated-damage-map-to-assist-with-typhoon-haiyan-disaster-response/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-produces-map-to-aid-in-italian-flood-response/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aviris-map-shows-spectral-signature-of-2013-rim-fire/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-project-maps-deformation-of-earths-surface-from-nepal-quake/)
- [NASA source page](https://science.nasa.gov/photojournal/california-drought-effects-on-sierra-trees-mapped-by-nasa/)
- [NASA source page](https://science.nasa.gov/photojournal/new-satellite-damage-maps-assist-italys-earthquake-disaster-response/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-produced-maps-help-gauge-italy-earthquake-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/extent-of-texas-flooding-shown-in-new-nasa-map/)
- [NASA source page](https://science.nasa.gov/photojournal/updated-nasa-satellite-flood-map-of-southeastern-texas-alos-2-data/)
- [NASA source page](https://science.nasa.gov/photojournal/new-nasa-satellite-flood-map-of-southeastern-texas-sentinel-1-data/)
- [NASA source page](https://science.nasa.gov/photojournal/new-nasa-maps-show-flooding-changes-in-aftermath-of-hurricane-harvey/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-damage-map-aids-femas-hurricane-maria-rescue-operation-in-puerto-rico/)
- [NASA source page](https://science.nasa.gov/photojournal/dominica-hurricane-damage-mapped-by-nasas-aria-team/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-damage-map-aids-northern-california-wildfire-response/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-produced-map-shows-extent-of-southern-california-wildfire-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/tonga-cyclone-damage-mapped-by-nasas-aria-team/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-project-generates-new-satellite-derived-map-of-ground-deformation-from-latest-mexico-quake/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-project-generates-satellite-derived-map-of-ground-deformation-from-earthquake-beneath-lombok-indonesia/)
- [NASA source page](https://science.nasa.gov/photojournal/aria-damage-proxy-map-of-lombok-indonesia-earthquakes/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-damage-map-shows-effects-of-destructive-guatemala-volcano-eruption/)
- [NASA source page](https://science.nasa.gov/photojournal/japan-earthquakes-aria-damage-proxy-map/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-maps-damage-from-florence/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-maps-aftermath-from-florence/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-maps-indonesia-quake-tsunami-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-maps-california-fire-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/updated-aria-map-of-ca-camp-fire-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-ecostress-maps-europe-heat-wave/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-maps-southern-california-quake-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-map-shows-ground-movement-from-california-quakes/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aria-team-maps-california-quake-damage/)
- [NASA source page](https://science.nasa.gov/photojournal/new-aria-map-shows-damage-from-typhoon-hagibis/)
- [NASA source page](https://science.nasa.gov/photojournal/aria-maps-damage-of-western-puerto-rico-after-quakes/)
- [NASA source page](https://science.nasa.gov/photojournal/aria-damage-map-beirut-explosion-aftermath/)
- [NASA source page](https://science.nasa.gov/photojournal/aria-maps-damage-in-fort-myers-from-hurricane-ian/)
- [NASA source page](https://science.nasa.gov/photojournal/airborne-nasa-radar-maps-mauna-loa-lava-changes-in-hawaii/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-new-york-city-subsidence-and-uplift/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-ecostress-maps-burn-risk-across-phoenix-streets/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-california-subsidence-and-uplift/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00950](https://science.nasa.gov/photojournal/mosaic-image-of-fires-in-indonesia/) | candidate | KidSat Sumatra fire/smoke strip is a dated regional event observation; original calibration and geolocation are needed before a measured extent claim. |
| [PIA00952](https://science.nasa.gov/photojournal/map-of-northern-sumatra-indonesia/) | duplicate-family | Reference map for KidSat image MET 00215424 supports registration, not an additional fire measurement; caption coordinates require verification. |
| [PIA00956](https://science.nasa.gov/photojournal/kidsat-image-of-sumatra-indonesia-and-map/) | duplicate-family | KidSat image-plus-map presentation overlaps the Sumatra fire campaign; resolve date differences and original image IDs before counting observations. |
| [PIA03339](https://science.nasa.gov/photojournal/nyiragongo-volcano-congo-map-view-with-lava-landsat-aster-srtm/) | candidate | Nyiragongo combines Landsat, ASTER and SRTM around a 2002 eruption; recover dated observations and distinguish mapped lava from background terrain. |
| [PIA10089](https://science.nasa.gov/photojournal/nasas-quikscat-maps-southern-californias-destructive-santa-ana-winds/) | candidate | QuikScat October 2007 offshore wind speed/direction is a measured event field; keep vector retrieval quality and coastal limitations, using a supported scalar/chart presentation. |
| [PIA13233](https://science.nasa.gov/photojournal/uavsar-maps-the-gulf-coast-oil-spill/) | candidate | June 2010 UAVSAR oil-spill imagery is calibrated radar-event data in principle; original backscatter and interpretation are required before mapping oil extent. |
| [PIA13368](https://science.nasa.gov/photojournal/aster-maps-continued-pakistan-flooding-false-color/) | candidate | ASTER September 2010 Pakistan flood false-color strip is an event observation; recover bands and masks rather than infer exact water depth from color. |
| [PIA13369](https://science.nasa.gov/photojournal/aster-maps-continued-pakistan-flooding/) | duplicate-family | Simulated-color Pakistan flood strip uses the same event/date as PIA13368; keep one observation with explicit display variants. |
| [PIA13393](https://science.nasa.gov/photojournal/aster-maps-fourmile-canyon-fire-near-boulder-colo/) | candidate | ASTER Fourmile Canyon post-fire scene could support measured burn-extent comparison; needs original imagery and before/after dates, not casualty context. |
| [PIA13911](https://science.nasa.gov/photojournal/nasa-generated-damage-map-to-assist-with-2015-gorkha-nepal-earthquake-disaster-response/) | candidate | Gorkha earthquake damage-proxy map is a regional remote-sensing estimate; original coherence-change product and uncertainty are needed, not building-level damage claims. |
| [PIA14710](https://science.nasa.gov/photojournal/new-alos-2-damage-map-assists-2015-gorkha-nepal-disaster-response/) | candidate | ALOS-2 Nepal damage proxy is a distinct sensor/version from the earlier Gorkha product; compare exact observations and validity rather than count press updates as separate events. |
| [PIA15374](https://science.nasa.gov/photojournal/nasas-damage-proxy-map-to-assist-with-italy-earthquake-disaster-response/) | candidate | Norcia COSMO-SkyMed damage-proxy v0.5 has a defined 10 km footprint and version; retain proxy semantics and measurement uncertainty. |
| [PIA17687](https://science.nasa.gov/photojournal/nasa-generated-damage-map-to-assist-with-typhoon-haiyan-disaster-response/) | candidate | Haiyan radar-derived damage proxy is an event map with sensor/model limits; original coherence/quality and dates are required before displaying affected areas. |
| [PIA17738](https://science.nasa.gov/photojournal/nasa-produces-map-to-aid-in-italian-flood-response/) | candidate | Sardinia flood-response product is a regional event lead; qualify measured inundation/proxy semantics from native data rather than import the annotated press sheet. |
| [PIA19361](https://science.nasa.gov/photojournal/nasas-aviris-map-shows-spectral-signature-of-2013-rim-fire/) | candidate | AVIRIS Rim Fire spectrum differentiates charred material; native bands and classification method could support a regional spectral change view. |
| [PIA19535](https://science.nasa.gov/photojournal/nasas-aria-project-maps-deformation-of-earths-surface-from-nepal-quake/) | candidate | Nepal radar interferometry measures ground displacement, distinct from damage proxies; preserve line-of-sight geometry and reference/uncertainty. |
| [PIA20717](https://science.nasa.gov/photojournal/california-drought-effects-on-sierra-trees-mapped-by-nasa/) | candidate | Airborne Sierra forest drought/stress mapping is a regional spectral/model product; recover original retrieval, date and uncertainty rather than treat it as a current tree-mortality survey. |
| [PIA20897](https://science.nasa.gov/photojournal/new-satellite-damage-maps-assist-italys-earthquake-disaster-response/) | candidate | Central Italy 2016 satellite damage proxy is a distinct event/sensor product; keep proxy interpretation, version and measured footprint. |
| [PIA21091](https://science.nasa.gov/photojournal/nasa-produced-maps-help-gauge-italy-earthquake-damage/) | candidate | Italy response maps are another release of the 2016 event family; compare source product IDs/version rather than counting a second disaster survey. |
| [PIA21928](https://science.nasa.gov/photojournal/extent-of-texas-flooding-shown-in-new-nasa-map/) | candidate | Harvey ALOS-2 flood proxy estimates likely inundation from radar amplitude; retain uncertainty and original before/after images. |
| [PIA21931](https://science.nasa.gov/photojournal/updated-nasa-satellite-flood-map-of-southeastern-texas-alos-2-data/) | candidate | Updated Harvey ALOS-2 map is a product-version/epoch change, not automatically an independent event; compare exact source dates. |
| [PIA21932](https://science.nasa.gov/photojournal/new-nasa-satellite-flood-map-of-southeastern-texas-sentinel-1-data/) | candidate | Harvey Sentinel-1 map is a separate sensor observation; combine only with explicit acquisition-time and algorithm compatibility. |
| [PIA21951](https://science.nasa.gov/photojournal/new-nasa-maps-show-flooding-changes-in-aftermath-of-hurricane-harvey/) | candidate | SMAP Harvey sequence measures fractional surface-water cover over coarse footprints, distinct from SAR binary-looking flood proxies and soil moisture. |
| [PIA21964](https://science.nasa.gov/photojournal/nasa-damage-map-aids-femas-hurricane-maria-rescue-operation-in-puerto-rico/) | candidate | Puerto Rico Maria damage proxy is an event-specific likelihood product; never relabel pixels as verified individual building damage. |
| [PIA22037](https://science.nasa.gov/photojournal/dominica-hurricane-damage-mapped-by-nasas-aria-team/) | candidate | Dominica Maria damage proxy has a separate island footprint and acquisition interval from Puerto Rico; retain individual event-product provenance. |
| [PIA22048](https://science.nasa.gov/photojournal/nasa-damage-map-aids-northern-california-wildfire-response/) | candidate | Northern California wildfire damage proxy is a radar-change inference; source quality and false-positive limitations must accompany any prepared map. |
| [PIA22191](https://science.nasa.gov/photojournal/nasa-produced-map-shows-extent-of-southern-california-wildfire-damage/) | candidate | Southern California/Thomas Fire damage proxy is a different event footprint; do not merge it with northern fires or treat it as a current hazard prediction. |
| [PIA22257](https://science.nasa.gov/photojournal/tonga-cyclone-damage-mapped-by-nasas-aria-team/) | candidate | Tonga Cyclone Gita damage proxy is an event-specific radar inference; preserve February 2018 dates, footprint and uncertainty. |
| [PIA22258](https://science.nasa.gov/photojournal/nasas-aria-project-generates-new-satellite-derived-map-of-ground-deformation-from-latest-mexico-quake/) | candidate | Mexico earthquake radar deformation is a physical displacement measurement, distinct from damage proxy; keep satellite line of sight and reference pixels. |
| [PIA22491](https://science.nasa.gov/photojournal/nasas-aria-project-generates-satellite-derived-map-of-ground-deformation-from-earthquake-beneath-lombok-indonesia/) | candidate | Lombok Sentinel-1 deformation measures line-of-sight change; preserve track, reference and uncertainty rather than present it as direct vertical displacement. |
| [PIA22495](https://science.nasa.gov/photojournal/aria-damage-proxy-map-of-lombok-indonesia-earthquakes/) | candidate | Lombok earthquake-sequence damage proxy is distinct from PIA22491's displacement field; retain cumulative event dates and proxy semantics. |
| [PIA22532](https://science.nasa.gov/photojournal/nasa-damage-map-shows-effects-of-destructive-guatemala-volcano-eruption/) | candidate | Fuego eruption damage proxy estimates radar-detected change from ash/pyroclastic effects; it is not a direct lava-temperature or verified building-loss map. |
| [PIA22696](https://science.nasa.gov/photojournal/japan-earthquakes-aria-damage-proxy-map/) | candidate | Hokkaido September 2018 earthquake damage proxy supplies a separate event footprint, with ALOS measurement/model limits retained. |
| [PIA22702](https://science.nasa.gov/photojournal/nasas-aria-maps-damage-from-florence/) | candidate | Florence damage proxy estimates surface change from Sentinel-1; keep it distinct from the flood-water product for the same event. |
| [PIA22704](https://science.nasa.gov/photojournal/nasas-aria-maps-aftermath-from-florence/) | candidate | Florence flood proxy represents likely inundation, not the damage quantity in PIA22702; separate masks and interpretations are needed. |
| [PIA22746](https://science.nasa.gov/photojournal/nasas-aria-maps-indonesia-quake-tsunami-damage/) | candidate | Sulawesi/Palu earthquake-tsunami damage proxy is an event-specific radar inference; preserve uncertainty and do not infer which hazard caused each pixel. |
| [PIA22816](https://science.nasa.gov/photojournal/nasas-aria-maps-california-fire-damage/) | candidate | Woolsey and Camp Fire damage maps are two event footprints; retain each acquisition pair and avoid counting one combined plate as a single homogeneous field. |
| [PIA22819](https://science.nasa.gov/photojournal/updated-aria-map-of-ca-camp-fire-damage/) | candidate | Updated Camp Fire map is a version of that event's proxy product; deduplicate by source dates and algorithm revision. |
| [PIA23148](https://science.nasa.gov/photojournal/nasas-ecostress-maps-europe-heat-wave/) | candidate | ECOSTRESS European heatwave images were sharpened; obtain unsharpened numeric temperatures and effective resolution before making street-scale claims. |
| [PIA23150](https://science.nasa.gov/photojournal/nasas-aria-maps-southern-california-quake-damage/) | candidate | Despite its damage title, the description identifies co-seismic InSAR displacement; classify by measured quantity and preserve line-of-sight geometry. |
| [PIA23351](https://science.nasa.gov/photojournal/nasa-map-shows-ground-movement-from-california-quakes/) | candidate | Ridgecrest map provides displacement in metres with direction information; retain the original component/retrieval definitions and reference frame. |
| [PIA23354](https://science.nasa.gov/photojournal/nasas-aria-team-maps-california-quake-damage/) | candidate | Ridgecrest damage proxy is separate from the physical displacement maps; preserve its 250 by 300 km footprint and probabilistic interpretation. |
| [PIA23424](https://science.nasa.gov/photojournal/new-aria-map-shows-damage-from-typhoon-hagibis/) | candidate | Hagibis likely-damage map is a dated satellite proxy; native inputs and uncertainty are needed rather than treating press descriptions as ground truth. |
| [PIA23429](https://science.nasa.gov/photojournal/aria-maps-damage-of-western-puerto-rico-after-quakes/) | candidate | Puerto Rico earthquake damage proxy is a different event from Hurricane Maria; retain event identity and acquisition dates separately. |
| [PIA23692](https://science.nasa.gov/photojournal/aria-damage-map-beirut-explosion-aftermath/) | candidate | Beirut explosion radar-change map estimates likely damage at 30 m cells; preserve proxy uncertainty and event timing, not claimed verified severity per building. |
| [PIA25426](https://science.nasa.gov/photojournal/aria-maps-damage-in-fort-myers-from-hurricane-ian/) | candidate | Ian Fort Myers proxy is an October 2022 radar-change product with a specific event footprint; keep likely-damage interpretation and source uncertainty. |
| [PIA25526](https://science.nasa.gov/photojournal/airborne-nasa-radar-maps-mauna-loa-lava-changes-in-hawaii/) | candidate | Mauna Loa airborne radar measures eruption-related change; identify whether the selected product is height, backscatter or displacement and retain its native units. |
| [PIA25527](https://science.nasa.gov/photojournal/map-of-new-york-city-subsidence-and-uplift/) | candidate | New York 2016–2023 vertical motion is a multi-year inferred rate, distinct from single-event line-of-sight displacement; preserve datum and uncertainty. |
| [PIA25529](https://science.nasa.gov/photojournal/nasas-ecostress-maps-burn-risk-across-phoenix-streets/) | candidate | Phoenix ECOSTRESS surface temperatures are from a specific June 2024 afternoon; original resolution/processing must support any street-scale heat interpretation, not a current burn forecast. |
| [PIA25530](https://science.nasa.gov/photojournal/map-of-california-subsidence-and-uplift/) | candidate | California 2015–2023 uplift/subsidence is a multi-year rate product; keep vertical-motion inference and reference frame separate from earthquake event maps. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
