# Jupiter moon source review — 2026-09-08

All **115** frozen Jupiter entries have a bounded, individual source review: **6 existing improvements**, **3 retain**, **23 new observation candidates**, and **83 orbit-context-only**. Nine scenes exist; this review does not qualify any new scene. The full row evidence and source ledger are in [jupiter-review.json](jupiter-review.json).

Package baseline: `7b289887ee03e040b981f6aaff25390d1e17ca9c`. Source and relevant content/preparation recipes were read for all nine existing packages. No implementation, PR, commit, worktree or qualification run was started.

## Strongest concrete opportunities

| Priority | Body or set | Evidence supports | Boundary / next step |
|---|---|---|---|
| 1 | Europa | Five regional measured terrain products with confidence/FOM layers; registered NIMS spectral observations | Validate datum, effective resolution and masks. NIMS uses the 2010 V2 map frame; resolve individual cube/label access. |
| 2 | Io, Ganymede | Released global interpreted geology GIS | Resolve 403-blocked publication archive access, inspect schema and coordinates, then prepare a labeled unit overlay. |
| 3 | Himalia; Themisto, Elara, Lysithea, Ananke, Carme, Pasiphae, Sinope | Eight January 2024 JWST spectra, paper and program 4028 archive DOI | These are unresolved spectra. Keep composition inference off the globe; verify extraction provenance and plot uncertainty. |
| 4 | Sixteen additional missing moons | Named optical/thermal photometry rows | Honest color/brightness/size comparisons; no recovered surface shape or texture. |
| 5 | Thebe, Callisto | New Juno Thebe view; Galileo color Callisto disk | Recover original observations/geometry before mapping. Thebe’s new 3-km/pixel view is coarser than its best existing Galileo image. |

The sixteen additional photometric candidates are Leda, Callirrhoe, Megaclite, Taygete, Chaldene, Harpalyke, Kalyke, Iocaste, Erinome, Isonoe, Praxidike, Autonoe, Thyone, Hermippe, Eukelade, Cyllene. None of the 23 missing-body observation candidates was promoted to a measured-shape scene. Thermal equivalent diameters, sparse light curves and statistical population shapes do not supply an individual mesh and pole.

## Product links and coverage

**Europa terrain.** [USGS documentation](https://stac.astrogeology.usgs.gov/docs/data/jupiter/europa/europa_controlled_usgs_dtms/) and the [five-item STAC manifest](https://stac.astrogeology.usgs.gov/api/collections/galileo_usgs_photogrammetrically_controlled_dtms/items?limit=100) were read. The following links are the actual manifest assets; raster bytes were not downloaded. Coordinates reproduce STAC bounding boxes (minimum longitude, minimum latitude, maximum longitude, maximum latitude); they do not assert valid terrain everywhere inside each rectangle.

| Product | STAC bounds, degrees | Data and quality |
|---|---|---|
| Yelland_Ridges | 162.8428, -16.9795, 163.2824, -16.6857 | [DTM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Yelland_Ridges/Yelland_Ridges.tif) · [FOM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Yelland_Ridges/Yelland_Ridges_FOM.tif) · [confidence](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Yelland_Ridges/Yelland_Ridges_ClrConf.tif) · [provenance](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Yelland_Ridges/provenance.txt) |
| Rhadamanthys | 132.0763, 34.0515, 136.2285, 36.9295 | [DTM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Rhadamanthys/Rhadamanthys.tif) · [FOM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Rhadamanthys/Rhadamanthys_FOM.tif) · [confidence](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Rhadamanthys/Rhadamanthys_ClrConf.tif) · [provenance](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Rhadamanthys/provenance.txt) |
| Pwyll_Crater | 85.7271, -26.6234, 92.0943, -23.9803 | [DTM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Pwyll_Crater/Pwyll_Crater.tif) · [FOM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Pwyll_Crater/Pwyll_Crater_FOM.tif) · [confidence](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Pwyll_Crater/Pwyll_Crater_ClrConf.tif) · [provenance](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Pwyll_Crater/provenance.txt) |
| Cilix_Crater | 177.5349, 1.8043, 178.8944, 3.0560 | [DTM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Cilix_Crater/Cilix_Crater.tif) · [FOM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Cilix_Crater/Cilix_Crater_FOM.tif) · [confidence](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Cilix_Crater/Cilix_Crater_ClrConf.tif) · [provenance](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Cilix_Crater/provenance.txt) |
| Agenor | 134.6330, -45.0312, 149.0128, -42.1239 | [DTM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Agenor/Agenor.tif) · [FOM](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Agenor/Agenor_FOM.tif) · [confidence](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Agenor/Agenor_ClrConf.tif) · [provenance](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Agenor/provenance.txt) |

Yelland’s 60-m posting represents about 180-m effective terrain resolution; other site products have coarser effective resolution. Quality masks and reference surface must travel with the selected observations; there is no global terrain fill. FOM/confidence also marks manually interpolated posts, which must remain distinguishable from successfully correlated stereo measurements.

**Europa spectra.** [PDS data collection](https://pds.nasa.gov/ds-view/pds/viewCollection.jsp?identifier=urn:nasa:pds:europa_go_nims_reprojected_malaska_2023:data), [archive DOI](https://doi.org/10.17189/4sz4-5024) and [USGS access page](https://astrogeology.usgs.gov/search/map/europa-galileo-nims-hyperspectral-map-products-registered-archive). This is a registered 0.7–5.2-micron observation collection, not a ready mineral-abundance layer. Original NIMS coverage, missing bands, backplanes and 2010 V2 registration require inspection. The USGS endpoint returned 403 directly, so no individual cube/label URL is asserted here.

**Global geology.** [Io SIM3168](https://pubs.usgs.gov/sim/3168/) lists its GIS database (281.1 MB compressed). [Ganymede SIM3237](https://pubs.usgs.gov/sim/3237/) lists its database (107.3 MB); its [actual readme PDF](https://pubs.usgs.gov/sim/3237/SIM3237_readme/sim3237_Ganymede_readme.pdf) and [official geospatial metadata](https://astrogeology.usgs.gov/search/map/global_geologic_map_of_ganymede_sim3237) identify shapefiles/geodatabase, global coverage and RAND control. These are concrete releases, but direct publication requests returned 403; do not invent or claim validated ZIP URLs. Ganymede’s GIS reference radius is 2632.345 km versus the package’s 2631.2 km, and accuracy is limited by its kilometer-scale basemap errors.

**Irregular observations.** [JWST primary paper v2](https://arxiv.org/html/2501.16484v2), [MAST data DOI](https://doi.org/10.17909/pwcf-c575); [WISE primary paper](https://arxiv.org/abs/1505.07820), [2018 optical photometry](https://faculty.epss.ucla.edu/~jewitt/papers/2018/GJ18.pdf), [2003 optical photometry](https://arxiv.org/abs/astro-ph/0301016). The PDS archive directory exposes the actual [NEOWISE irregular-satellite CSV](https://sbnarchive.psi.edu/pds4/non_mission/neowise_diameters_albedos_V2_0/data/neowise_irreg_sat.csv) and [XML label](https://sbnarchive.psi.edu/pds4/non_mission/neowise_diameters_albedos_V2_0/data/neowise_irreg_sat.xml), but both direct reads returned 403. All per-body measurement membership and size values in this review were checked against the read paper tables.

## Identity and discovery reconciliation

All 115 input rows match the [JPL discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html) and an individual [JPL mean-element row](https://ssd.jpl.nasa.gov/sats/elem/sep.html). Each JSON row preserves the source spelling, resolved code, exact designation and ephemeris. This exposed three important identity traps:

- **Megaclite** is `Magaclite` in the mean elements and 2003 photometry paper: code **519**, Jupiter XIX, S/2000 J8.
- **Philophrosyne** is `Philophrosyn` in mean elements: code **558**, Jupiter LVIII, S/2003 J15.
- **Jupiter LXXIII / S/2003 J2** currently resolves to code **55501**, not an assumed 573.

The four current kernel groups are **JUP365: 8**, **JUP347: 89**, **JUP348: 4**, **JUP349: 14**. The 2026 objects were not silently assigned the earlier irregular kernel. Mean elements establish context, not an accurate runtime position fit.

Original discovery research includes **49 read MPEC notices** and **12 read IAUC notices**. IAUC7555 explicitly covers S/2000 J2–J11; that range was checked for each named identity. IAUC9222 and IAUC9252 returned HTTP 401 for S/2010 J1/J2 and S/2011 J1/J2. Those four identities still have independently checked JPL catalog and ephemeris rows; the original notices remain unread. All exact notice URLs and memberships are in the JSON source ledger.

## All 115 dispositions

| Key | Moon | Disposition | Code / raw mean-element name |
|---|---|---|---|
| Jupiter / I | Io | improve-existing | 501 / Io |
| Jupiter / II | Europa | improve-existing | 502 / Europa |
| Jupiter / III | Ganymede | improve-existing | 503 / Ganymede |
| Jupiter / IV | Callisto | improve-existing | 504 / Callisto |
| Jupiter / V | Amalthea | retain-existing | 505 / Amalthea |
| Jupiter / VI | Himalia | improve-existing | 506 / Himalia |
| Jupiter / VII | Elara | observation-candidate | 507 / Elara |
| Jupiter / VIII | Pasiphae | observation-candidate | 508 / Pasiphae |
| Jupiter / IX | Sinope | observation-candidate | 509 / Sinope |
| Jupiter / X | Lysithea | observation-candidate | 510 / Lysithea |
| Jupiter / XI | Carme | observation-candidate | 511 / Carme |
| Jupiter / XII | Ananke | observation-candidate | 512 / Ananke |
| Jupiter / XIII | Leda | observation-candidate | 513 / Leda |
| Jupiter / XIV | Thebe | improve-existing | 514 / Thebe |
| Jupiter / XV | Adrastea | retain-existing | 515 / Adrastea |
| Jupiter / XVI | Metis | retain-existing | 516 / Metis |
| Jupiter / XVII | Callirrhoe | observation-candidate | 517 / Callirrhoe |
| Jupiter / XVIII | Themisto | observation-candidate | 518 / Themisto |
| Jupiter / XIX | Megaclite | observation-candidate | 519 / Magaclite |
| Jupiter / XX | Taygete | observation-candidate | 520 / Taygete |
| Jupiter / XXI | Chaldene | observation-candidate | 521 / Chaldene |
| Jupiter / XXII | Harpalyke | observation-candidate | 522 / Harpalyke |
| Jupiter / XXIII | Kalyke | observation-candidate | 523 / Kalyke |
| Jupiter / XXIV | Iocaste | observation-candidate | 524 / Iocaste |
| Jupiter / XXV | Erinome | observation-candidate | 525 / Erinome |
| Jupiter / XXVI | Isonoe | observation-candidate | 526 / Isonoe |
| Jupiter / XXVII | Praxidike | observation-candidate | 527 / Praxidike |
| Jupiter / XXVIII | Autonoe | observation-candidate | 528 / Autonoe |
| Jupiter / XXIX | Thyone | observation-candidate | 529 / Thyone |
| Jupiter / XXX | Hermippe | observation-candidate | 530 / Hermippe |
| Jupiter / XXXI | Aitne | orbit-context-only | 531 / Aitne |
| Jupiter / XXXII | Eurydome | orbit-context-only | 532 / Eurydome |
| Jupiter / XXXIII | Euanthe | orbit-context-only | 533 / Euanthe |
| Jupiter / XXXIV | Euporie | orbit-context-only | 534 / Euporie |
| Jupiter / XXXV | Orthosie | orbit-context-only | 535 / Orthosie |
| Jupiter / XXXVI | Sponde | orbit-context-only | 536 / Sponde |
| Jupiter / XXXVII | Kale | orbit-context-only | 537 / Kale |
| Jupiter / XXXVIII | Pasithee | orbit-context-only | 538 / Pasithee |
| Jupiter / XXXIX | Hegemone | orbit-context-only | 539 / Hegemone |
| Jupiter / XL | Mneme | orbit-context-only | 540 / Mneme |
| Jupiter / XLI | Aoede | orbit-context-only | 541 / Aoede |
| Jupiter / XLII | Thelxinoe | orbit-context-only | 542 / Thelxinoe |
| Jupiter / XLIII | Arche | orbit-context-only | 543 / Arche |
| Jupiter / XLIV | Kallichore | orbit-context-only | 544 / Kallichore |
| Jupiter / XLV | Helike | orbit-context-only | 545 / Helike |
| Jupiter / XLVI | Carpo | orbit-context-only | 546 / Carpo |
| Jupiter / XLVII | Eukelade | observation-candidate | 547 / Eukelade |
| Jupiter / XLVIII | Cyllene | observation-candidate | 548 / Cyllene |
| Jupiter / XLIX | Kore | orbit-context-only | 549 / Kore |
| Jupiter / L | Herse | orbit-context-only | 550 / Herse |
| Jupiter / LI | S/2010 J1 | orbit-context-only | 551 / S2010_J_1 |
| Jupiter / LII | S/2010 J2 | orbit-context-only | 552 / S2010_J_2 |
| Jupiter / LIII | Dia | orbit-context-only | 553 / Dia |
| Jupiter / LIV | S/2016 J1 | orbit-context-only | 554 / S2016_J_1 |
| Jupiter / LV | S/2003 J18 | orbit-context-only | 555 / S2003_J_18 |
| Jupiter / LVI | S/2011 J2 | orbit-context-only | 556 / S2011_J_2 |
| Jupiter / LVII | Eirene | orbit-context-only | 557 / Eirene |
| Jupiter / LVIII | Philophrosyne | orbit-context-only | 558 / Philophrosyn |
| Jupiter / LIX | S/2017 J1 | orbit-context-only | 559 / S2017_J_1 |
| Jupiter / LX | Eupheme | orbit-context-only | 560 / Eupheme |
| Jupiter / LXI | S/2003 J19 | orbit-context-only | 561 / S2003_J_19 |
| Jupiter / LXII | Valetudo | orbit-context-only | 562 / Valetudo |
| Jupiter / LXIII | S/2017 J2 | orbit-context-only | 563 / S2017_J_2 |
| Jupiter / LXIV | S/2017 J3 | orbit-context-only | 564 / S2017_J_3 |
| Jupiter / LXV | Pandia | orbit-context-only | 565 / Pandia |
| Jupiter / LXVI | S/2017 J5 | orbit-context-only | 566 / S2017_J_5 |
| Jupiter / LXVII | S/2017 J6 | orbit-context-only | 567 / S2017_J_6 |
| Jupiter / LXVIII | S/2017 J7 | orbit-context-only | 568 / S2017_J_7 |
| Jupiter / LXIX | S/2017 J8 | orbit-context-only | 569 / S2017_J_8 |
| Jupiter / LXX | S/2017 J9 | orbit-context-only | 570 / S2017_J_9 |
| Jupiter / LXXI | Ersa | orbit-context-only | 571 / Ersa |
| Jupiter / LXXII | S/2011 J1 | orbit-context-only | 572 / S2011_J_1 |
| Jupiter / LXXIII | S/2003 J2 | orbit-context-only | 55501 / S2003_J_2 |
| Jupiter / S/2003 J4 | S/2003 J4 | orbit-context-only | 55502 / S2003_J_4 |
| Jupiter / S/2003 J9 | S/2003 J9 | orbit-context-only | 55503 / S2003_J_9 |
| Jupiter / S/2003 J10 | S/2003 J10 | orbit-context-only | 55504 / S2003_J_10 |
| Jupiter / S/2003 J12 | S/2003 J12 | orbit-context-only | 55505 / S2003_J_12 |
| Jupiter / S/2003 J16 | S/2003 J16 | orbit-context-only | 55506 / S2003_J_16 |
| Jupiter / S/2003 J23 | S/2003 J23 | orbit-context-only | 55507 / S2003_J_23 |
| Jupiter / S/2003 J24 | S/2003 J24 | orbit-context-only | 55508 / S2003_J_24 |
| Jupiter / S/2010 J3 | S/2010 J3 | orbit-context-only | 55531 / S2010_J_3 |
| Jupiter / S/2010 J4 | S/2010 J4 | orbit-context-only | 55532 / S2010_J_4 |
| Jupiter / S/2010 J5 | S/2010 J5 | orbit-context-only | 55533 / S2010_J_5 |
| Jupiter / S/2010 J6 | S/2010 J6 | orbit-context-only | 55534 / S2010_J_6 |
| Jupiter / S/2011 J3 | S/2011 J3 | orbit-context-only | 55509 / S2011_J_3 |
| Jupiter / S/2011 J4 | S/2011 J4 | orbit-context-only | 55527 / S2011_J_4 |
| Jupiter / S/2011 J5 | S/2011 J5 | orbit-context-only | 55530 / S2011_J_5 |
| Jupiter / S/2011 J6 | S/2011 J6 | orbit-context-only | 55535 / S2011_J_6 |
| Jupiter / S/2016 J3 | S/2016 J3 | orbit-context-only | 55518 / S2016_J_3 |
| Jupiter / S/2016 J4 | S/2016 J4 | orbit-context-only | 55519 / S2016_J_4 |
| Jupiter / S/2017 J10 | S/2017 J10 | orbit-context-only | 55525 / S2017_J_10 |
| Jupiter / S/2017 J11 | S/2017 J11 | orbit-context-only | 55526 / S2017_J_11 |
| Jupiter / S/2017 J12 | S/2017 J12 | orbit-context-only | 55536 / S2017_J_12 |
| Jupiter / S/2017 J13 | S/2017 J13 | orbit-context-only | 55537 / S2017_J_13 |
| Jupiter / S/2017 J14 | S/2017 J14 | orbit-context-only | 55538 / S2017_J_14 |
| Jupiter / S/2017 J15 | S/2017 J15 | orbit-context-only | 55539 / S2017_J_15 |
| Jupiter / S/2017 J16 | S/2017 J16 | orbit-context-only | 55540 / S2017_J_16 |
| Jupiter / S/2017 J17 | S/2017 J17 | orbit-context-only | 55541 / S2017_J_17 |
| Jupiter / S/2017 J18 | S/2017 J18 | orbit-context-only | 55542 / S2017_J_18 |
| Jupiter / S/2018 J2 | S/2018 J2 | orbit-context-only | 55510 / S2018_J_2 |
| Jupiter / S/2018 J3 | S/2018 J3 | orbit-context-only | 55511 / S2018_J_3 |
| Jupiter / S/2018 J4 | S/2018 J4 | orbit-context-only | 55520 / S2018_J_4 |
| Jupiter / S/2018 J5 | S/2018 J5 | orbit-context-only | 55528 / S2018_J_5 |
| Jupiter / S/2021 J1 | S/2021 J1 | orbit-context-only | 55512 / S2021_J_1 |
| Jupiter / S/2021 J2 | S/2021 J2 | orbit-context-only | 55513 / S2021_J_2 |
| Jupiter / S/2021 J3 | S/2021 J3 | orbit-context-only | 55514 / S2021_J_3 |
| Jupiter / S/2021 J4 | S/2021 J4 | orbit-context-only | 55515 / S2021_J_4 |
| Jupiter / S/2021 J5 | S/2021 J5 | orbit-context-only | 55516 / S2021_J_5 |
| Jupiter / S/2021 J6 | S/2021 J6 | orbit-context-only | 55517 / S2021_J_6 |
| Jupiter / S/2021 J7 | S/2021 J7 | orbit-context-only | 55543 / S2021_J_7 |
| Jupiter / S/2021 J8 | S/2021 J8 | orbit-context-only | 55544 / S2021_J_8 |
| Jupiter / S/2022 J1 | S/2022 J1 | orbit-context-only | 55521 / S2022_J_1 |
| Jupiter / S/2022 J2 | S/2022 J2 | orbit-context-only | 55522 / S2022_J_2 |
| Jupiter / S/2022 J3 | S/2022 J3 | orbit-context-only | 55523 / S2022_J_3 |
| Jupiter / S/2024 J1 | S/2024 J1 | orbit-context-only | 55529 / S2024_J_1 |

## Scope, rejected paths and unresolved work

- This is a completed bounded source-feasibility survey, not release qualification, exhaustive literature proof of absence, or approval of 115 scenes.
- Every row was individually reconciled to catalog, orbital identifier and actual measured-target lists; orbit-context decisions do not claim physical data can never exist.
- No large data archive, image raster, SPK or FITS set was downloaded. No scene code, PR, commit, worktree, build or browser test was created.
- JPL raw spellings Magaclite and Philophrosyn are preserved against Megaclite/519 and Philophrosyne/558. Jupiter LXXIII S/2003 J2 resolves to 55501, not an assumed 573.
- IAUC9222/9252 returned 401. Their four moons remain individually reconciled through JPL; original notices were not read.
- USGS SIM3168/SIM3237 direct pages/API returned 403; indexed official metadata/readme identify the releases, but exact GIS ZIP URLs/schema were not independently inspected.
- NEOWISE CSV/XML and PDS satellite-colors browse were inaccessible. Measurement membership was established from primary paper tables, never from unread archive contents.
- Europa STAC manifests and exact asset URLs were read; numeric rasters and their per-pixel validity were not processed. Its NIMS bundle is Europa-specific despite broad PDS context-target tags; no Io/Callisto spectral coverage was inherited.
- JWST MAST DOI establishes available observation provenance. No final reduced table was acquired or reduction repeated; spectra constrain interpretations rather than unique surface-material maps.
- Existing nine packages were inspected at the merged commit; current dirty checkout files were not taken as that release, and its earlier qualification claims were not re-tested.

The [Stooke release](https://sbn.psi.edu/pds/resource/stkshape.html) has only Amalthea and Thebe among Jupiter targets. The [Thomas release](https://sbn.psi.edu/pds/resource/oshape.html) contains no Jupiter target. Their actual target lists, plus the actual WISE/optical/JWST measurement tables, were checked against every missing-body name/designation; nonmembership is a bounded archive result, not a claim that no physical study could exist.

Asteroid 9 Metis / 38 Leda hits and artist-built visualization meshes were not accepted as measured Jovian satellite geometry. An inaccessible older satellite-color compilation was left as an unresolved lead; no body inherited photometry from it.
