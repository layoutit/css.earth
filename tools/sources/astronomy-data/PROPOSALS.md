# Data proposals

These writeups describe scope, evidence and acceptance. Current work status, next action, blocker and PR link live in `ledger.sqlite`, in the `proposals` table. IDs are permanent; do not renumber them. The local viewer shows current status beside each writeup.

## Scope


These are proposals, not completed integrations. Use the [shared body guide](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/README.md), [celestial skill](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/.agents/skills/celestial-skill/SKILL.md) and [provenance contract](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/docs/provenance/CONTRACT.md). Keep the shared renderer, fixed existing body geometry and current shell. All scientific decoding, registration and raster preparation happen offline. Reuse existing band/date controls and source labels; do not add Dataset details or Surface photographs panels.

An implementation must retain original quantity, units, source version, time support, coordinates, uncertainty and missingness. Update the owning body README and investigation ledger. Qualify a claimed measurement against independent native samples. For released assets, publish the prepared files and refresh the delivery inventory under the existing contract. Run only affected checks and inspect the real rendered result when appearance changes.

For a qualification proposal, a negative result is a documented source decision with exact evidence and a reopen condition. It is not permission to ship an inferred or filled map. Generic-contract compatibility must be demonstrated before any integration that depends on it.


## P1

### Bennu: heat storage, roughness and predicted temperatures

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Bennu has albedo, monochrome, four reflected-light bands, spectral color and elevation. No thermal view is present at the pinned revision.

Eight global maps: OTES and OVIRS thermal inertia, OTES and OVIRS thermal roughness, and four OTES-based temperature extremes at the nearest and farthest points from the Sun. Group related maps with the existing arrow selector.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md)

#### Evidence

The collection inventory lists 16 products: eight global maps, four site-specific thermal-inertia maps and four site meshes. Full scans of both global inertia FITS tables found 48,958/49,152 finite values for OTES (99.61%) and 48,273/49,152 for OVIRS (98.21%). These are facet counts, not area-weighted coverage. Each file is 1,189,440 bytes.

#### Work

Prepare facet values and uncertainty on the current surface; preserve missing values; retain the source instrument and model identity. No renderer change is expected.

#### Limits and prior decisions

Thermal inertia is a fitted measure of resistance to heating and cooling. Temperature extremes are predictions, not simultaneous observations. The FITS names a v034 SPO source shape; the displayed Bennu uses OLA v20. Verify transfer without replacing the display mesh. The OVIRS file incorrectly says OTES in INSTRUME; its product name and companion record identify OVIRS. Roughness and temperature payloads still need their own numeric checks.

#### Acceptance

Compare decoded samples against the source FITS; measure area-weighted coverage after mesh transfer; check seams, poles, picking and the instrument selector. Resolve the OVIRS header conflict in the source record.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/data_thermal_maps/collection_inventory_data_thermal_maps.csv)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/document/thermal_sis.pdf)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/data_thermal_maps/global_thermal_inertia_maps/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/bundle_thermal.xml)

PDS bundle IDs: `urn:nasa:pds:orex.thermal`.


## P2

### Bennu: hydrated minerals and carbon-bearing material

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The current spectral color is a MapCam visible/near-infrared composite, not an OVIRS hydration or carbon-band map.

Separate maps of the 2.74 µm absorption and the 3.2–3.6 µm band area. They show spectral signatures that are absent from the existing MapCam color maps.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md)

#### Evidence

Downloaded and scanned the two native FITS products. Each contains 196,608 rows and is 4,728,960 bytes. The OH product has 367 negative values at the missing-data floor; the carbon-band product has 370 negative values, so negativity alone is not a safe generic mask. The FITS shape and row count agree with the detailed-survey README's roughly 200,000-facet v020 SPC model.

#### Work

A larger preparation task than thermal inertia. Use the source FITS layout, retain archive discrepancies as evidence, and qualify the scientific quantity before adding a surface view.

#### Limits and prior decisions

The OH XML says 49,152 records; the FITS has four times as many. Its filename says 2.7 µm while the README specifies a measurement at 2.74 µm. The XML says percent but native values are around 0.14 and the FITS unit is BAND_DEPTH: establish the scale explicitly before labeling. Carbonates and organics both contribute to the 3.2–3.6 µm feature; do not label it organic abundance. Resolve fill values, source-frame transfer and uncertainty before release.

#### Acceptance

Resolve fraction versus percent using the native documentation and an independent numeric sample. Preserve the -9999 sentinel while investigating the three additional negative carbon-band values. Check source-shape registration. Include the OTES 350 cm⁻¹ band only if emission-angle bias can be bounded; otherwise retain its exclusion.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/data_vnir_maps/detailed_survey/ovirs_eq3_maps_readme.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/data_vnir_maps/detailed_survey/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/bundle_spectral_analysis.xml)

PDS bundle IDs: `urn:nasa:pds:orex.spectral_analysis`.


## P3

### Ceres: hydrogen and iron

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Existing Ceres composition views use VIR mineral absorptions and band centres. No GRaND map is selected.

Two chemically distinct global measurements from Dawn GRaND, with their uncertainty columns.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

#### Evidence

Native labels and hydrogen table inspected. The products use 110 approximately equal-area cells. Hydrogen is water-equivalent hydrogen by mass; iron is mass fraction. Measurements were collected in the low-altitude mapping orbit in 2015–2016.

#### Work

Small numeric tables fit the existing prepared surface lane. Keep the coarse footprint and uncertainty visible in the description; do not produce crater-scale detail.

#### Limits and prior decisions

The effective resolution is roughly 600 km FWHM. Twenty-degree cells are sampling, not independent resolved terrain. Hydrogen does not uniquely measure surface ice, and a water-equivalent value is not an ice-fraction map.

#### Acceptance

Independently check table units and uncertainty columns; compare prepared cell values and boundaries against the native table. Keep the approximately 600 km footprint explicit.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-ceres_1.0/data_derived/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-ceres_1.0/bundle_dawn-grand-ceres.xml)

PDS bundle IDs: `urn:nasa:pds:dawn-grand-ceres`.


## P4

### Vesta: hydrogen and iron signal

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The current Vesta package has imagery, spectral ratios and elevation. No GRaND measurement is selected.

Hydrogen and corrected iron gamma-ray signal; neutron absorption is a possible later addition.

Content owners: [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

#### Evidence

Hydrogen has 16,200 two-degree cells, µg/g values and uncertainty. Effective spatial resolution is about 300 km FWHM. The corrected iron table is a count-rate product, not a directly measured iron mass fraction.

#### Work

Reuse the Ceres GRaND reader while preserving different units and frame conventions. The renderer can remain unchanged.

#### Limits and prior decisions

The release uses Claudia Double Prime; the current body uses Claudia. A documented offline coordinate conversion is required. Do not adopt the archive's preliminary iron conversion without its stated limitations. Two-degree sampling does not mean two-degree resolution.

#### Acceptance

Verify Claudia Double Prime to Claudia coordinates against independent landmarks. Check hydrogen values and uncertainty, iron count-rate units, missing cells and the approximately 300 km effective resolution.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/bundle_dawn-grand-vesta.xml)
- [NASA source page](https://science.nasa.gov/photojournal/hydrogen-map-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/contour-map-of-hydrogen-on-vesta/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA16180](https://science.nasa.gov/photojournal/hydrogen-map-of-vesta/) | candidate | Vesta GRaND hydrogen is measured elemental information, likely mineral-bound rather than ice; integrate the verified PDS4 numeric release instead of the press image. |
| [PIA16181](https://science.nasa.gov/photojournal/contour-map-of-hydrogen-on-vesta/) | duplicate-family | Hydrogen/albedo contour comparison illustrates the same GRaND measurement family and a correlation; not an independent abundance dataset. |

PDS bundle IDs: `urn:nasa:pds:dawn-grand-vesta`.


## P5

### Ceres and Vesta: gravity, anomalies and geoid

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

These gravity fields are not selected surface datasets in the three current packages.

Prepare Dawn's published gravity, Bouguer anomaly, geoid and associated errors for Ceres and Vesta. Give each physical quantity a clear label within one related group per body.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md), [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

#### Evidence

Ceres and Vesta native map labels describe 360 × 181 grids, including radial acceleration and error products. Bennu's native label specifies 196,608 facet records with normalized anomaly and mGal columns. The source overview explains comparison with a uniform-density shape.

#### Work

Decode the existing numeric grids at preparation time. Use plain labels such as Gravity variation, with mission attribution and a concise explanation of the reference model.

#### Limits and prior decisions

These are model-derived fields. Grid spacing does not equal resolving power; harmonic degree, reference surface, density assumption, scale/offset, longitude and uncertainty all matter. An anomaly is not a direct map of hidden caverns or mineral abundance.

#### Acceptance

Read grid scale, offset, longitude, reference radius, density assumption and harmonic degree. Verify numeric samples against a separate decoder and keep uncertainty separate from anomaly. A grid cell is not the model's effective resolution.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-ceres/maps/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-vesta/maps/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-ceres/bundle-dawn-rss-der-ceres.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-vesta/bundle-dawn-rss-der-vesta.xml)

PDS bundle IDs: `urn:nasa:pds:dawn-rss-der-ceres`, `urn:nasa:pds:dawn-rss-der-vesta`.


## P6

### Bennu: gravity anomaly on the observed shape

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

These gravity fields are not selected surface datasets in the three current packages.

Prepare the published Bennu Bouguer anomaly, retaining its physical units and uniform-density reference model. Keep it separate from Dawn's regular-grid importer.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md)

#### Evidence

Ceres and Vesta native map labels describe 360 × 181 grids, including radial acceleration and error products. Bennu's native label specifies 196,608 facet records with normalized anomaly and mGal columns. The source overview explains comparison with a uniform-density shape.

#### Work

Decode the existing numeric grids at preparation time. Use plain labels such as Gravity variation, with mission attribution and a concise explanation of the reference model.

#### Limits and prior decisions

These are model-derived fields. Grid spacing does not equal resolving power; harmonic degree, reference surface, density assumption, scale/offset, longitude and uncertainty all matter. An anomaly is not a direct map of hidden caverns or mineral abundance.

#### Acceptance

Check all 196,608 facet rows, missing values and the distinction between normalized anomaly and mGal. Establish source-shape registration without inventing subsurface structures.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.derived_gravity_v1.1/data/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.derived_gravity_v1.1/bundle_derived_gravity.xml)

PDS bundle IDs: `urn:nasa:pds:orex.derived_gravity`.


## P7

### Eros: 334 mapped pond locations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Eros currently has IAU named features and seven reflected-light maps. The pond catalogue is not included.

A scientific feature catalogue of smooth deposits, placed through the existing surface-feature contract.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

#### Evidence

The native label declares 334 records with pond number, IAU_EROS Cartesian coordinates, north latitude, east longitude and diameter in kilometres. The bundle description says the locations were transferred from MSI pixels to the Gaskell SPC shape with SBMT; frame constants are identified in eros_alex.tpc.

#### Work

Import the feature table into the existing prepared feature system. Useful and understandable, but smaller than the multi-map proposals above.

#### Limits and prior decisions

Ponds are smooth deposits of fine material, not liquid water. The source warns that several catalogue circles can belong to one continuous deposit, and detection is biased by image resolution, especially below 30 m. Diameters are characteristic sizes of generally noncircular features. Catalogue IDs must not be presented as IAU names.

#### Acceptance

Import all 334 catalogue records with stable research IDs, coordinates and characteristic diameter. Validate the IAU_EROS frame and size units. Keep multiple circles belonging to one deposit distinguishable; never call them 334 separate ponds or IAU names.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/data/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/document/bundle_description.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/bundle_ast-eros.roberts.ponds-catalog.xml)

PDS bundle IDs: `urn:nasa:pds:ast-eros.roberts.ponds-catalog`.


## P8

### Mimas: relative reflectivity

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The source bundle already supplies Mimas's shape and radius map, but its relative-albedo product is not selected. Dione, Rhea, Tethys and Phoebe already have similar reflectivity views.

Add the SPC relative-albedo GeoTIFF beside the existing photos and elevation.

Content owners: [mimas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mimas/README.md)

#### Evidence

The native mimas_albedo_g.xml describes a 2,222 × 1,111 unitless GeoTIFF associated with the SPC topography.

#### Work

A bounded texture addition using the same source family. No need to change geometry. Supporting image-count or uncertainty rasters are secondary opportunities, not new physical measurements.

#### Limits and prior decisions

This is relative albedo, not absolute reflectance. Read its actual geotransform and missing-data conventions; the current radius map already has a documented narrow edge gap.

#### Acceptance

Inspect native GeoTIFF extent, relative scaling, geotransform and no-data before preparation. Check the known edge gap and fixed geometry. Compare with the same source-family views on Dione, Rhea, Tethys and Phoebe.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/data/mimas_albedo_g.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/bundle_satellite-mimas.cassini.shape-models-maps.xml)

PDS bundle IDs: `urn:nasa:pds:satellite-mimas.cassini.shape-models-maps`.


## P9

### Moon: nine Kaguya reflected-light bands

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Kaguya mineral, grain-size, iron and maturity products are already selected. The nine measured MI spectral bands are the remaining distinct addition.

Add a single reflected-light group with nine wavelength choices and JAXA / Kaguya MI attribution.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The USGS audit inspected nine 16-bit spectral products. Their coverage is approximately 65°S to 65°N, wider than the derived mineral maps but not polar coverage.

#### Work

Read the native scale and invalid-value rules, reduce the bands together on the same grid, and preserve their common validity mask. Keep these measured bands separate from fitted mineral products.

#### Limits and prior decisions

Nine bands are nine wavelength samples, not nine minerals. Verify photometric treatment and JAXA reuse terms. Do not repeat the already shipped derived maps.

#### Acceptance

Independent source-to-prepared values, common footprint, wavelength order, band switching and byte budget.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/kaguya_lunar_multiband_imager_59mpp)
- [USGS product record](https://astrogeology.usgs.gov/search/map/lunar-kaguya-multiband-imager-mosaics)

USGS catalogue IDs: `lunar-kaguya-multiband-imager-mosaics`, `kaguya_lunar_multiband_imager_59mpp`.


## P10

### Moon: improve existing photography and height sampling

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The current Moon uses coarser LROC morphology and LOLA inputs; its surface geometry stays fixed.

Replace an existing prepared map only where finer input produces visible or numerical improvement at the existing display budget.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The audit verified the 59 m merged DEM within ±60°, 118 m LOLA and 100 m WAC alternatives. PIA18138 supplies a separate north-pole imaging lead, not proof that the whole Moon has that detail.

#### Work

Run a matched preparation at the present asset dimensions, then compare a bounded larger texture level if the existing contract supports it. Record improvement per delivered byte.

#### Limits and prior decisions

No terrain displacement, mesh refinement or extra duplicate dataset row. Preserve regional coverage and the difference between source sampling and actual resolution.

#### Acceptance

Matched close-up samples, poles, numeric heights, seams, source values and delivered byte counts; reject a replacement that gives no useful gain.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-releases-first-interactive-mosaic-of-lunar-north-pole/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA18138](https://science.nasa.gov/photojournal/nasa-releases-first-interactive-mosaic-of-lunar-north-pole/) | candidate | LROC north-pole 2 m imagery offers concrete regional detail; useful gain must be measured at current texture budgets and fixed geometry. |

USGS catalogue IDs: `moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m`, `moon_lro_lola_dem_118m`, `moon_lro_lroc_wac_global_morphology_mosaic_100m`.


## P11

### Europa: expand registered infrared coverage

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Two registered NIMS products supply the current infrared composite. Other composition datasets already exist and should remain distinct.

Use additional qualified NIMS observations to improve measured coverage and add a water-ice or hydrate signature only when the archived quantity supports it.

Content owners: [europa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/europa/README.md)

#### Evidence

The expanded USGS listing contains 794 TIFF URLs, including alternate processing products. Photojournal identifies trailing-hemisphere, Tyre and Manannán observations worth tracing back to original cubes.

#### Work

Deduplicate by observation and processing version, join geometry and quality products, measure incremental surface coverage, and retain wavelength, observation epoch and calibration lineage.

#### Limits and prior decisions

794 files do not mean 794 observations. The Manannán press overlay is regional and is not a quantitative abundance raster. Do not merge incompatible brightness scales or sharpen NIMS with SSI detail.

#### Acceptance

A per-observation coverage table, independent band samples, geometry landmarks, explicit overlap rules and comparison against the existing two-product baseline.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/europa-galileo-nims-hyperspectral-map-products-registered-archive)
- [NASA source page](https://science.nasa.gov/photojournal/nims-e4-observations-of-europa-trailing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/a-compositional-map-of-the-tyre-region-of-europa/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-water-signatures-at-europas-manannan-crater/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00846](https://science.nasa.gov/photojournal/nims-e4-observations-of-europa-trailing-hemisphere/) | candidate | December 1996 Europa E4 NIMS observations are regional, about 3 km/pixel, and overlaid on older Voyager context; preserve actual spectral support. |
| [PIA01098](https://science.nasa.gov/photojournal/a-compositional-map-of-the-tyre-region-of-europa/) | candidate | Tyre NIMS/SSI composition overlay is a useful regional observation lead; original spectral quantity and mask must be recovered. |
| [PIA26104](https://science.nasa.gov/photojournal/map-of-water-signatures-at-europas-manannan-crater/) | candidate | Manannán Galileo NIMS overlay is a regional water-ice/hydrate-signature lead published much later than observation; use original spectra and actual dates. |

USGS catalogue IDs: `europa-galileo-nims-hyperspectral-map-products-registered-archive`.


## P12

### Callisto: expand registered infrared coverage

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Two NIMS products supply the existing infrared view.

Increase measured infrared coverage and assess additional water-ice spectral information through the current surface-data controls.

Content owners: [callisto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/callisto/README.md)

#### Evidence

The USGS release lists 93 TIFF URLs. PIA00844 is a Callisto product despite its supplied Ganymede target tag; PIA01079 shows another NIMS/SSI comparison.

#### Work

Identify independent observations, read native units and masks, and compare their measured footprints with the selected products before choosing additions.

#### Limits and prior decisions

Separate wavelength images, browse products and processing versions do not each create a dataset. Preserve coarse spectral resolution and observation-time differences.

#### Acceptance

Record net new measured area, sample original cube values independently, and inspect seams, orientation and missing areas on the fixed body.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/callisto-galileo-nims-hyperspectral-map-products-registered-archive)
- [NASA source page](https://science.nasa.gov/photojournal/nims-callisto-global-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/callistos-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00844](https://science.nasa.gov/photojournal/nims-callisto-global-mosaic/) | candidate | Callisto NIMS mosaic from November 1996 samples roughly 100 km spatial scales; supplied Ganymede tag is wrong and must not drive the join. |
| [PIA01078](https://science.nasa.gov/photojournal/callistos-southern-hemisphere/) | candidate | Callisto G8 NIMS southern data are a distinct spectral observation, with false colors indicating relative ice signatures rather than calibrated abundance. |
| [PIA01079](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/) | duplicate-family | NIMS/SSI composite combines the same spectral and photographic observations shown separately; assess each instrument at its own spatial support. |

USGS catalogue IDs: `callisto-galileo-nims-hyperspectral-map-products-registered-archive`.


## P13

### Ryugu: thermal-corrected infrared spectra

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Ryugu already has thermal inertia, visible spectral slope, monochrome, enhanced color, elevation and a close-up. Those are not new opportunities.

Investigate an infrared absorption map using the 2026 NIRS3 thermal-excess-removed release, distinct from the existing visible spectral slope.

Content owners: [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

#### Evidence

The collection inventories contain 107 spectrum products and 109 geometry products. A native LBLX sample describes 128 channels × 2,695 spectra, a corresponding standard-deviation array, and an estimated-temperature array. This is an actual calibrated numeric release with geometry, not a gallery of pictures.

#### Work

A source-reduction PR after a bounded coverage pilot. Reuse the existing surface renderer, but budget substantial preparation and qualification work.

#### Limits and prior decisions

There is no ready global hydration raster in this bundle. Quality filtering, geometry association, thermal correction limits and footprint coverage must be established. A source release date is not the observation date.

#### Acceptance

Join the 107 spectrum products and 109 geometry products by identifiers, not row order. Independently check channel wavelengths, thermal correction, standard deviations and valid footprint coverage. Release a map only if the inferred signature survives these checks.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_nirs3_sp_v1.0/readme_v001.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_nirs3_sp_v1.0/)


## P14

### Itokawa: more AMICA wavelengths

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The current ten-frame v-band mosaic already uses this source family and has 84.26% sampled display-mesh coverage. It is not a new backplane discovery.

Investigate additional AMICA filters using the archived geometry backplanes.

Content owners: [itokawa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/itokawa/README.md)

#### Evidence

The archive contains the AMICA observation and backplane bundles. The body ledger records successful selected paired exposures and other exposures rejected by the existing brightness or registration limits.

#### Work

Survey same-pointing filter sets and demonstrate worthwhile registered coverage before committing to a large PR.

#### Limits and prior decisions

Do not imply matching coverage in every band, reuse rejected exposures without new evidence, or relax registration tolerances to fill gaps. The separate native SBMT comparison has a documented unresolved one-pixel issue; the controlled-DDR production route is separate.

#### Acceptance

Compare co-pointed filters and exposure/registration residuals against the current ten v-band frames. Report coverage per filter and common coverage before selecting a band set. Backplane availability alone does not repair the existing rejected exposures.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.amica/bundle_hay.amica.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.amica.itokawa.backplanes_v1.0/bundle_hay.amica.itokawa.backplanes.xml)

PDS bundle IDs: `urn:nasa:pds:hay.amica`, `urn:nasa:pds:hay.amica.itokawa.backplanes`.


## P15

### Ceres: qualified Urvara and crater close-ups

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The current Ceres imagery is global; this would be an explicitly regional close-up.

A controlled high-resolution mosaic of Urvara crater, with separate products for different source-resolution ranges.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

#### Evidence

The native label describes a 57,573 × 40,282 mosaic resampled to 5 m/pixel from 1,583 images. The method document describes source imaging at about 3.5–20 m/pixel and a mapped region from 128°W to 93°W, 59°S to 35°S.

#### Work

Prepare a bounded regional raster while retaining clear coverage. Lower priority for the user's preference for broadly useful coverage.

#### Limits and prior decisions

It covers one basin, not the whole body. Five-metre output sampling is not uniform five-metre resolved detail. A generic radius description in the image label is inconsistent with the photographic product; use the explicit mosaic method record.

#### Acceptance

Start with the controlled Urvara product. Treat Occator, Vinalia, Dantu and Haulani images as separate leads until their native registration and incremental detail are demonstrated. Compare output against global imagery at the same camera and budget; do not label resampled 5 m pixels as uniform 5 m detail.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn-fc.urvara-mosaics/document/productdescription.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn-fc.urvara-mosaics/data/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn-fc.urvara-mosaics/bundle_dwarf_planet-ceres.dawn-fc.urvara-mosaics.xml)
- [NASA source page](https://science.nasa.gov/photojournal/haulani-crater-topographic-map/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula-in-occator-crater/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-the-vinalia-faculae-in-occator-crater/)
- [NASA source page](https://science.nasa.gov/photojournal/color-mosaic-of-dantu-crater/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA21748](https://science.nasa.gov/photojournal/haulani-crater-topographic-map/) | candidate | Haulani regional topography may add local height detail; compare original DEM and frame with current Ceres terrain while keeping geometry fixed. |
| [PIA21924](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula-in-occator-crater/) | candidate | Cerealia extended-mission imaging from roughly 34 km altitude has gaps filled by lower-resolution context; preserve source-resolution support in a regional mosaic. |
| [PIA21925](https://science.nasa.gov/photojournal/mosaic-of-the-vinalia-faculae-in-occator-crater/) | candidate | Vinalia extended-mission mosaic is a separate regional footprint with mixed-resolution coverage; qualify originals rather than assume uniform detail. |
| [PIA22471](https://science.nasa.gov/photojournal/color-mosaic-of-dantu-crater/) | candidate | May 2018 Dantu color mosaic is a distinct regional Ceres observation; recover native bands and compare detail with current global color. |
| [PIA22480](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula/) | candidate | Cerealia mosaic is draped on an older LAMO terrain model without exaggeration; use original imagery and retain the mismatch in image/terrain resolution. |

PDS bundle IDs: `urn:nasa:pds:dwarf_planet-ceres.dawn-fc.urvara-mosaics`.


## P16

### Ceres: millimetre observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

No ALMA dataset is selected in Ceres's current surface controls.

A different wavelength range using the archived ALMA images, spectra and light curves.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

#### Evidence

The bundle and data inventory were read; the data collection separates images, imaging parameters, light curves and spectra.

#### Work

A bounded native-product inspection before any surface proposal. Prefer the ready derived global products above.

#### Limits and prior decisions

This audit has not decoded or registered its image payloads. Treat it as an observation lead, not a verified global temperature map. Spatial resolution, dates and instrumental beam must be checked first.

#### Acceptance

Inspect the actual image, beam, epoch, calibration and geometry records. Prove whether a supported surface map or existing-chart observation is possible. Stop at an evidence-backed ledger update if neither is supported.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-ceres.alma.images-spectra_V1_0/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-ceres.alma.images-spectra_V1_0/bundle_gbo.ast-ceres.alma.images-spectra.xml)

PDS bundle IDs: `urn:nasa:pds:gbo.ast-ceres.alma.images-spectra`.


## P17

### Small bodies: reconcile diameters and albedos

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

NEOWISE is already referenced for Amycus, Echeclus, Elatus, Okyrhoe and Thereus. Many radar target bodies already exist. A catalogue must be joined against existing object identities before counting additions.

Join NEOWISE, radiometric, occultation and radar compilations to existing object IDs; update only demonstrated gaps or better-supported measurements.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

Latest discovered bundle versions include NEOWISE v2, LCDB v4 and occultations v4. Their inventories were read. Several are a handful of large tables, so product counts are not body counts.

#### Work

A substantial facts PR is possible, using published uncertainties and an explicit source-selection policy. It adds scientific information rather than surface textures.

#### Limits and prior decisions

This audit did not compute a row-level join against every existing body fact or adjudicate conflicting measurements. There is no verified number of new bodies or corrected facts yet. Old optical, radiometric and radar estimates are not interchangeable, and migration dates do not make observations new.

#### Acceptance

Produce a row-level before/after fact ledger with method, epoch, uncertainty and source. Keep radiometric diameters separate from resolved shape dimensions. Do not announce a new-body count before the join.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/iras/iras/bundle_iras.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/msx/msx.mimps/bundle.msx.mimps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.delbo.radiometric-diameters-albedos/bundle_ast.delbo.radiometric-diameters-albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.shevchenko-tedesco.occultation-albedos/bundle_ast.shevchenko-tedesco.occultation-albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.albedos/bundle_compil.ast.albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar-properties/bundle_compil.ast.radar-properties.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.triad.radiometry/bundle_compil.ast.triad.radiometry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/hst.ast-ceres.images-albedo-shape_V1_0/bundle_hst.ast-ceres.images-albedo-shape.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/neowise_diameters_albedos_V2_0/bundle_neowise_diameters_albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/tno-centaur_diam-albedo-density_V1_0/bundle_tno-centaur_diam-albedo-density.xml)
- [NASA source page](https://science.nasa.gov/photojournal/one-year-of-neowise-observations-mapped/)
- [NASA source page](https://science.nasa.gov/photojournal/two-years-of-neowise-observations-mapped/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA19101](https://science.nasa.gov/photojournal/one-year-of-neowise-observations-mapped/) | candidate | NEOWISE survey animation points to a catalogue, not asteroid surface maps; the native identifier/diameter/albedo join owns any actual facts addition. |
| [PIA20546](https://science.nasa.gov/photojournal/two-years-of-neowise-observations-mapped/) | candidate | Two-year NEOWISE visualization extends the survey context of PIA19101; original catalogue rows, not animation dots, own any new body facts. |

PDS bundle IDs: `urn:nasa:pds:iras`, `urn:nasa:pds:msx.mimps`, `urn:nasa:pds:ast.delbo.radiometric-diameters-albedos`, `urn:nasa:pds:ast.shevchenko-tedesco.occultation-albedos`, `urn:nasa:pds:compil.ast.albedos`, `urn:nasa:pds:compil.ast.radar-properties`, `urn:nasa:pds:compil.ast.triad.radiometry`, `urn:nasa:pds:hst.ast-ceres.images-albedo-shape`, `urn:nasa:pds:neowise_diameters_albedos`, `urn:nasa:pds:tno-centaur_diam-albedo-density`.


## P18

### Small bodies: measured rotation periods and light curves

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

NEOWISE is already referenced for Amycus, Echeclus, Elatus, Okyrhoe and Thereus. Many radar target bodies already exist. A catalogue must be joined against existing object identities before counting additions.

Reconcile published rotation periods and their quality codes; retain selected measured light curves only where existing chart content can present them faithfully.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

Latest discovered bundle versions include NEOWISE v2, LCDB v4 and occultations v4. Their inventories were read. Several are a handful of large tables, so product counts are not body counts.

#### Work

A substantial facts PR is possible, using published uncertainties and an explicit source-selection policy. It adds scientific information rather than surface textures.

#### Limits and prior decisions

This audit did not compute a row-level join against every existing body fact or adjudicate conflicting measurements. There is no verified number of new bodies or corrected facts yet. Old optical, radiometric and radar estimates are not interchangeable, and migration dates do not make observations new.

#### Acceptance

Handle aliases, synodic versus sidereal periods, period ambiguities and observation epochs. Preserve existing scene motion unless a separately justified source-backed fact change requires it; this proposal does not redesign motion.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast_lightcurve_derived/bundle_ast_lightcurve_derived_parameters.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-lightcurve-database_V4_0/bundle_ast-lightcurve-database.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.apc.lightcurves_V1_0/bundle_compil.ast.apc.lightcurves.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.tno-centaur.lightcurves/bundle_compil.tno-centaur.lightcurves.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-1999td10.images-lightcurves_V2_0/bundle_gbo.ast-1999td10.images-lightcurves.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-neo.ondrejov.lightcurves/bundle_gbo.ast-neo.ondrejov.lightcurves.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.alcdef-database_V1_0/bundle_gbo.ast.alcdef-database.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.chamberlain.sub-mm-lightcurves/bundle_gbo.ast.chamberlain.sub-mm-lightcurves.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/orex.gbo.ast-bennu.lightcurves-images_V1_0/bundle_orex.gbo.ast-bennu.lightcurves-images.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/surveys/gbo.ast.loneos.survey/bundle_gbo.ast.loneos.survey.xml)

PDS bundle IDs: `urn:nasa:pds:ast_lightcurve_derived_parameters`, `urn:nasa:pds:ast-lightcurve-database`, `urn:nasa:pds:compil.ast.apc.lightcurves`, `urn:nasa:pds:compil.tno-centaur.lightcurves`, `urn:nasa:pds:gbo.ast-1999td10.images-lightcurves`, `urn:nasa:pds:gbo.ast-neo.ondrejov.lightcurves`, `urn:nasa:pds:gbo.ast.alcdef-database`, `urn:nasa:pds:gbo.ast.chamberlain.sub-mm-lightcurves`, `urn:nasa:pds:orex.gbo.ast-bennu.lightcurves-images`, `urn:nasa:pds:gbo.ast.loneos.survey`.


## P19

### Small bodies: masses, densities and binary properties

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

NEOWISE is already referenced for Amycus, Echeclus, Elatus, Okyrhoe and Thereus. Many radar target bodies already exist. A catalogue must be joined against existing object identities before counting additions.

Improve existing physical facts with published masses, densities, binary parameters and occultation size constraints, including their uncertainties.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

Latest discovered bundle versions include NEOWISE v2, LCDB v4 and occultations v4. Their inventories were read. Several are a handful of large tables, so product counts are not body counts.

#### Work

A substantial facts PR is possible, using published uncertainties and an explicit source-selection policy. It adds scientific information rather than surface textures.

#### Limits and prior decisions

This audit did not compute a row-level join against every existing body fact or adjudicate conflicting measurements. There is no verified number of new bodies or corrected facts yet. Old optical, radiometric and radar estimates are not interchangeable, and migration dates do not make observations new.

#### Acceptance

Resolve object/component IDs and correlated quantities. A binary-system mass is not an individual component mass. Do not derive precise density from incompatible size and mass estimates or turn an occultation chord into a surface map.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast_binary_parameters_compilation_V3_0/bundle_ast_binary_parameters_compilation.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.shevchenko-tedesco.occultation-albedos/bundle_ast.shevchenko-tedesco.occultation-albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.masses/bundle_compil.ast.masses.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.pluto-charon.mutual-events/bundle_gbo.pluto-charon.mutual-events.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.pluto.benecchi-etal.occultation/bundle_gbo.pluto.benecchi-etal.occultation.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/smallbodiesoccultations_V4_0/bundle_smallbodiesoccultations.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/tno-centaur_diam-albedo-density_V1_0/bundle_tno-centaur_diam-albedo-density.xml)

PDS bundle IDs: `urn:nasa:pds:ast_binary_parameters_compilation`, `urn:nasa:pds:ast.shevchenko-tedesco.occultation-albedos`, `urn:nasa:pds:compil.ast.masses`, `urn:nasa:pds:gbo.pluto-charon.mutual-events`, `urn:nasa:pds:gbo.pluto.benecchi-etal.occultation`, `urn:nasa:pds:smallbodiesoccultations`, `urn:nasa:pds:tno-centaur_diam-albedo-density`.


## P20

### Asteroid spectral libraries and taxonomy

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Potential additional scientific content; no claim that every target or classification is absent from cssEarth.

Source-backed whole-object spectra and spectral classifications across many asteroids.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

MITHNEOS has 771 data products in its collection inventory. SMASS, SMASS II, S3OS2, PRIMASS and several targeted IRTF releases are also present and separately catalogued.

#### Work

Join archive target IDs to existing bodies, retain spectra and calibration records, and then choose a bounded content addition.

#### Limits and prior decisions

A disc-integrated spectrum does not locate minerals on a surface. A taxonomic class is not a measured mineral percentage. Plot and catalogue presentation compatibility requires a separate design check; this is not a ready surface-map PR.

#### Acceptance

Join target identifiers, normalization wavelength, units, telluric masks, error arrays and observing dates. Separate taxonomy systems and whole-object reflectance spectra. Verify the existing prepared chart contract before adding content; no spatial mineral map follows from a disc-integrated spectrum.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast_spectra_reddy_neos_marscrossers/bundle_ast_spectra_reddy_neos_marscrossers.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast_taxonomy_v1.1/bundle_ast_taxonomy.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.bus-demeo.taxonomy/bundle_ast.bus-demeo.taxonomy.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.sdss-based-taxonomy/bundle_ast.sdss-based-taxonomy.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.fieber-beyer.spectra_V2_0/bundle_gbo.ast.fieber-beyer.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-dtype.gartrelleetal.irtf.spectra_V1_0/bundle_gbo.ast-dtype.gartrelleetal.irtf.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-iannini-family.spectra/bundle_gbo.ast-iannini-family.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-m-type.fornasier.spectra/bundle_gbo.ast-m-type.fornasier.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-mb.reddy.spectra/bundle_gbo.ast-mb.reddy.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-neo.reddy.irtf.spectra/bundle_gbo.ast-neo.reddy.irtf.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-neo.sanchez-reddy.spectra/bundle_gbo.ast-neo.sanchez-reddy.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-neo.whiteley.ecas-phot/bundle_gbo.ast-neo.whiteley.ecas-phot.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-trojan.fornasier-etal.spectra/bundle_gbo.ast-trojan.fornasier-etal.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-v-type.moscovitz.spectra/bundle_gbo.ast-v-type.moscovitz.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-vesta.reddy.spectra/bundle_gbo.ast-vesta.reddy.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.24-color-survey/bundle_gbo.ast.24-color-survey.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.52-color-survey/bundle_gbo.ast.52-color-survey.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.7-color-survey/bundle_gbo.ast.7-color-survey.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.des.taxonomy_V1_0/bundle_gbo.ast.des.taxonomy.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.ecas.phot/bundle_gbo.ast.ecas.phot.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.fieber-beyer.spectra/bundle_gbo.ast.fieber-beyer.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.hardersen.spectra/bundle_gbo.ast.hardersen.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.irtf-spex-collection.spectra/bundle_gbo.ast.irtf-spex-collection.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.lebofsky-etal.3-micron-spectra/bundle_gbo.ast.lebofsky-etal.3-micron-spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.mithneos.spectra_2000-2021_V1_0/bundle_gbo.ast.mithneos.spectra_2000-2021.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.primass-l.spectra_V2_0/bundle_gbo.ast.primass-l.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.rivkin.3-micron-spectra/bundle_gbo.ast.rivkin.3-micron-spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.s3os2.spectra/bundle_gbo.ast.s3os2.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.sawyer.spectra_V1_0/bundle_gbo.ast.sawyer.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.smass.spectra/bundle_gbo.ast.smass.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.smass2.spectra/bundle_gbo.ast.smass2.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.vilas.spectra/bundle_gbo.ast.vilas.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/hst.ast-ceres.uv-spectra_V1_0/bundle_hst.ast-ceres.uv-spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/iue.ast.hendrix.spectra_V2_0/bundle_iue.ast.hendrix.spectra.xml)

PDS bundle IDs: `urn:nasa:pds:ast_spectra_reddy_neos_marscrossers`, `urn:nasa:pds:ast_taxonomy`, `urn:nasa:pds:ast.bus-demeo.taxonomy`, `urn:nasa:pds:ast.sdss-based-taxonomy`, `urn:nasa:pds:gbo_ast_fieber-beyer_spectra`, `urn:nasa:pds:gbo_ast-dtype_gartrelleetal_irtf_spectra`, `urn:nasa:pds:gbo.ast-iannini-family.spectra`, `urn:nasa:pds:gbo.ast-m-type.fornasier.spectra`, `urn:nasa:pds:gbo.ast-mb.reddy.spectra`, `urn:nasa:pds:gbo.ast-neo.reddy.irtf.spectra`, `urn:nasa:pds:gbo.ast-neo.sanchez-reddy.spectra`, `urn:nasa:pds:gbo.ast-neo.whiteley.ecas-phot`, `urn:nasa:pds:gbo.ast-trojan.fornasier-etal.spectra`, `urn:nasa:pds:gbo.ast-v-type.moscovitz.spectra`, `urn:nasa:pds:gbo.ast-vesta.reddy.spectra`, `urn:nasa:pds:gbo.ast.24-color-survey`, `urn:nasa:pds:gbo.ast.52-color-survey`, `urn:nasa:pds:gbo.ast.7-color-survey`, `urn:nasa:pds:gbo.ast.des.taxonomy`, `urn:nasa:pds:gbo.ast.ecas.phot`, `urn:nasa:pds:gbo.ast.fieber-beyer.spectra`, `urn:nasa:pds:gbo.ast.hardersen.spectra`, `urn:nasa:pds:gbo.ast.irtf-spex-collection.spectra`, `urn:nasa:pds:gbo.ast.lebofsky-etal.3-micron-spectra`, `urn:nasa:pds:gbo.ast.mithneos.spectra_2000-2021`, `urn:nasa:pds:gbo.ast.primass-l.spectra`, `urn:nasa:pds:gbo.ast.rivkin.3-micron-spectra`, `urn:nasa:pds:gbo.ast.s3os2.spectra`, `urn:nasa:pds:gbo.ast.sawyer.spectra`, `urn:nasa:pds:gbo.ast.smass.spectra`, `urn:nasa:pds:gbo.ast.smass2.spectra`, `urn:nasa:pds:gbo.ast.vilas.spectra`, `urn:nasa:pds:hst.ast-ceres.uv-spectra`, `urn:nasa:pds:iue.ast.hendrix.spectra`.


## P21

### Asteroids: source-backed family membership

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The archive has several family and discovery compilations; a row-level comparison against current object facts has not been done.

Add or correct membership and discovery facts for existing objects where identifiers and the published classification agree.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

Nesvorny HCM, Zappalà, Mothé-Diniz and high-inclination family bundles were found in the PDS4 tree.

#### Work

Retain each catalogue's method and version, distinguish dynamical membership from spectral type, and document conflicting assignments rather than silently combining them.

#### Limits and prior decisions

This is facts content, not a new scene, orbit layout or claim of shared composition. No verified number of additions yet.

#### Acceptance

Review joined and unmatched rows, aliases, family parent IDs and exact source references. Keep uncertain or conflicting memberships qualified.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-high-inclination.gil-hutton.families/bundle_ast-high-inclination.gil-hutton.families.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.mrc.families/bundle_ast.mrc.families.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.nesvorny.families_V2_0/bundle_ast.nesvorny.families.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.zappala-etal.families/bundle_ast.zappala-etal.families.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.names/bundle_compil.ast.names.xml)

PDS bundle IDs: `urn:nasa:pds:ast-high-inclination.gil-hutton.families`, `urn:nasa:pds:ast.mrc.families`, `urn:nasa:pds:ast.nesvorny.families`, `urn:nasa:pds:ast.zappala-etal.families`, `urn:nasa:pds:compil.ast.names`.


## P22

### Small bodies: measured colors, phase curves and polarization

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

These catalogue families contain whole-object measurements; the audit has not established which individual facts or charts are missing.

Add selected measured photometric facts or prepared charts that answer a clear question about an existing body.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

PDS4 contains asteroid, satellite and TNO colors, phase relations, polarization, and radar echo spectra.

#### Work

Join IDs and record bandpass, geometry, epoch, normalization, uncertainty and calibration. Separate radar echo measurements from optical reflectance.

#### Limits and prior decisions

Do not derive a new surface tint or lighting law from an unrelated whole-disc measurement. Renderer and lighting changes are outside this proposal.

#### Acceptance

Use independent table samples and source plots. Verify chart compatibility first; retain a source decision if the existing content contract cannot display the quantity.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/asteroid_polarimetric_database_V2_0/bundle_asteroid_polarimetric_database.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.magnitude-phase/bundle_compil.ast.magnitude-phase.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.magnitude-slope/bundle_compil.ast.magnitude-slope.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.ubv-photometry/bundle_compil.ast.ubv-photometry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.satellite.colors/bundle_compil.satellite.colors.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.satellite.polarimetry/bundle_compil.satellite.polarimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.tno-centaur.colors/bundle_compil.tno-centaur.colors.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.tno-centaur.polarimetry/bundle_compil.tno-centaur.polarimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-itokawa.torino.polarimetry_V1_1/bundle_gbo.ast-itokawa.torino.polarimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-neo.whiteley.ecas-phot/bundle_gbo.ast-neo.whiteley.ecas-phot.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.2mass.phot/bundle_gbo.ast.2mass.phot.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.belskaya.polarimetry/bundle_gbo.ast.belskaya.polarimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.denis.ir-photometry/bundle_gbo.ast.denis.ir-photometry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.ecas.phot/bundle_gbo.ast.ecas.phot.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.skads.astrometry-photometry/bundle_gbo.ast.skads.astrometry-photometry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.torino.polarimetry/bundle_gbo.ast.torino.polarimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.wisniewski.magnitudes/bundle_gbo.ast.wisniewski.magnitudes.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.kbo-centaur.magnitudes/bundle_gbo.kbo-centaur.magnitudes.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.sdss-moc.phot/bundle_gbo.sdss-moc.phot.xml)

PDS bundle IDs: `urn:nasa:pds:asteroid_polarimetric_database`, `urn:nasa:pds:compil.ast.magnitude-phase`, `urn:nasa:pds:compil.ast.magnitude-slope`, `urn:nasa:pds:compil.ast.ubv-photometry`, `urn:nasa:pds:compil.satellite.colors`, `urn:nasa:pds:compil.satellite.polarimetry`, `urn:nasa:pds:compil.tno-centaur.colors`, `urn:nasa:pds:compil.tno-centaur.polarimetry`, `urn:nasa:pds:gbo.ast-itokawa.torino.polarimetry`, `urn:nasa:pds:gbo.ast-neo.whiteley.ecas-phot`, `urn:nasa:pds:gbo.ast.2mass.phot`, `urn:nasa:pds:gbo.ast.belskaya.polarimetry`, `urn:nasa:pds:gbo.ast.denis.ir-photometry`, `urn:nasa:pds:gbo.ast.ecas.phot`, `urn:nasa:pds:gbo.ast.skads.astrometry-photometry`, `urn:nasa:pds:gbo.ast.torino.polarimetry`, `urn:nasa:pds:gbo.ast.wisniewski.magnitudes`, `urn:nasa:pds:gbo.kbo-centaur.magnitudes`, `urn:nasa:pds:gbo.sdss-moc.phot`.


## P23

### Eros: qualify X-ray, gamma-ray and infrared composition data

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Gaspra and Ida NIMS are already recorded as unresolved in the body ledgers. Eros's existing seven MSI bands do not provide X-ray elemental maps.

Establish whether NEAR XRS, GRS or NIS can support a distinct elemental or spectral map with useful measured coverage.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

#### Evidence

The NEAR XRS collection has calibrated observations including level-3 directories; the scan did not find a ready global element raster. Galileo NIMS bundles contain calibrated point-perspective spectral cubes.

#### Work

Keep as research candidates. Reopen the specific recorded blockers only with new evidence.

#### Limits and prior decisions

Registration, footprint geometry, calibration and coverage remain substantial work. Gaspra has a pre-existing calibration-source discrepancy; Ida's current false-color coverage is only 17.2% of the display mesh. These are not replacements for the broadly covered recommendations above.

#### Acceptance

Keep instrument footprints, solar excitation/calibration, units and uncertainty. Inventory level-3 products before raw reduction. Do not count the already shipped seven MSI bands as this addition.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_grs/bundle_near.grs.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near.nis/bundle_near.nis.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_xrs/bundle_near.xrs.xml)

PDS bundle IDs: `urn:nasa:pds:near.grs`, `urn:nasa:pds:near.nis`, `urn:nasa:pds:near.xrs`.


## P24

### Gaspra and Ida: resolve the existing NIMS blockers

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Gaspra and Ida NIMS are already recorded as unresolved in the body ledgers. Eros's existing seven MSI bands do not provide X-ray elemental maps.

A bounded qualification PR resolving the recorded calibration and geometry issues in the NIMS cubes; a measured regional view is conditional on that result.

Content owners: [gaspra](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/gaspra/README.md), [ida](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ida/README.md)

#### Evidence

The NEAR XRS collection has calibrated observations including level-3 directories; the scan did not find a ready global element raster. Galileo NIMS bundles contain calibrated point-perspective spectral cubes.

#### Work

Keep as research candidates. Reopen the specific recorded blockers only with new evidence.

#### Limits and prior decisions

Registration, footprint geometry, calibration and coverage remain substantial work. Gaspra has a pre-existing calibration-source discrepancy; Ida's current false-color coverage is only 17.2% of the display mesh. These are not replacements for the broadly covered recommendations above.

#### Acceptance

Compare the original label/calibration disagreement for Gaspra and the sparse source geometry for Ida. Do not treat a PDS4 migration as new calibration evidence. A negative result updates the existing ledger, not an invented map.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.nims.spectra/bundle_galileo.ast-gaspra.nims.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.nims.spectral-cube/bundle_galileo.ast-gaspra.nims.spectral-cube.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-ida.nims.spectra/bundle_galileo.ast-ida.nims.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-ida.nims.spectral-cubes/bundle_galileo.ast-ida.nims.spectral-cubes.xml)

PDS bundle IDs: `urn:nasa:pds:galileo.ast-gaspra.nims.spectra`, `urn:nasa:pds:galileo.ast-gaspra.nims.spectral-cube`, `urn:nasa:pds:galileo.ast-ida.nims.spectra`, `urn:nasa:pds:galileo.ast-ida.nims.spectral-cubes`.


## P25

### Eros: qualify derived gravity and physical parameters

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Eros already has an observed shape and elevation. No new gravity map has been qualified by this audit.

Read the derived NEAR radio-science products and determine which gravity or physical facts add information beyond the current package.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

#### Evidence

The PDS4 scan located the NEAR RSS derived bundle separately from raw tracking.

#### Work

Identify model coefficients, covariance, reference frame and radius; compare selected mass and spin facts before deriving any field offline.

#### Limits and prior decisions

Spatial resolving power and reference-density assumptions constrain interpretation. No hidden-structure claims or automatic geometry replacement.

#### Acceptance

Reproduce published check values and uncertainty. If no distinct reliable surface field exists, limit the PR to demonstrated fact corrections and the source decision.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_rss/near_rss_derived/bundle_near_rs_derived.xml)

PDS bundle IDs: `urn:nasa:pds:near_rss_derived`.


## P26

### Preserve quantitative map precision and source support

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Bennu and Eros bands are shipped; several SPC moon packages already use albedo and radius products. Their auxiliary rasters are not all selected.

Improve numeric decoding, masks and source-support evidence where the native products expose more precision, counts, uncertainty, XYZ or observing angles.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md), [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md), [mimas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mimas/README.md), [dione](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/dione/README.md), [rhea](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/rhea/README.md), [tethys](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/tethys/README.md), [phoebe](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/phoebe/README.md)

#### Evidence

The USGS audit identified Bennu ancillary products and a catalogue-versus-file dimension discrepancy; PDS4 supplies related SPC support products.

#### Work

Compare exact current inputs to the native release, retain quantitative data through preparation, and use counts/angles to qualify measurements. Add a displayed quality view only if it answers a clear question within existing controls.

#### Limits and prior decisions

Quality counts and uncertainty are not new physical quantities. Do not re-add existing bands, replace geometry, or create a Dataset details panel.

#### Acceptance

Source samples, validity masks, precision loss, orientation and declared dimensions; an evidence-only result is valid if existing output is already adequate.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-dione.cassini.shape-models-maps/bundle_satellite-dione.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/bundle_satellite-mimas.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-phoebe.cassini.shape-models-maps_V1_0/bundle_satellite-phoebe.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-rhea.cassini.shape-models-maps/bundle_satellite-rhea.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-tethys.cassini.shape-models-maps/bundle_satellite-tethys.cassini.shape-models-maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.color_geom_cubes/bundle_galileo.ast-gaspra.color_geom_cubes.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.lidar/bundle_hay.lidar.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_lidar/bundle_hyb2_lidar_v002.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_msi_digital_image_maps/bundle_near_msi_digital_image_maps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near.nlr/bundle_near.nlr.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/nearmsi.shapebackplane/bundle_nearmsi.shapebackplane.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.altimetry/bundle_altimetry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.image_processing/bundle_image_processing.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.ola/bundle_ola.xml)
- [USGS product record](https://astrogeology.usgs.gov/search/map/near_msi_albedo_mosaics)
- [USGS product record](https://astrogeology.usgs.gov/search/map/bennu_osiris_rex_ocams_global_pan_mosaic_5cm)
- [USGS product record](https://astrogeology.usgs.gov/search/map/bennu_osiris_rex_ocams_global_albedo_mosaic_6_25cm)
- [USGS product record](https://astrogeology.usgs.gov/search/map/bennu-osiris-rex-ocams-photometric-mosaics-25cm)

PDS bundle IDs: `urn:nasa:pds:satellite-dione.cassini.shape-models-maps`, `urn:nasa:pds:satellite-mimas.cassini.shape-models-maps`, `urn:nasa:pds:satellite-phoebe.cassini.shape-models-maps`, `urn:nasa:pds:satellite-rhea.cassini.shape-models-maps`, `urn:nasa:pds:satellite-tethys.cassini.shape-models-maps`, `urn:nasa:pds:galileo.ast-gaspra.color_geom_cubes`, `urn:nasa:pds:hay.lidar`, `urn:jaxa:darts:hyb2_lidar`, `urn:nasa:pds:near_msi_digital_image_maps`, `urn:nasa:pds:near.nlr`, `urn:nasa:pds:nearmsi.shapebackplane`, `urn:nasa:pds:orex.altimetry`, `urn:nasa:pds:orex.image_processing`, `urn:nasa:pds:orex.ola`.

USGS catalogue IDs: `bennu_osiris_rex_ocams_global_pan_mosaic_5cm`, `bennu_osiris_rex_ocams_global_albedo_mosaic_6_25cm`, `bennu-osiris-rex-ocams-photometric-mosaics-25cm`, `near_msi_albedo_mosaics`.


## P27

### Mercury: qualify regional stereo maps

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Native global BDR, LOI, enhanced color and numeric elevation are already shipped.

Add only regional stereo height or orthophoto products that demonstrably improve a useful close-up on the current body.

Content owners: [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

#### Evidence

The USGS audit found 192 TIFF files in the Fassett release, including paired DEMs and orthophotos, plus a separate volatile-loss terrain product. PIA17385 identifies a north-polar MLA elevation lead; its datum and value over the selected global DEM need checking.

#### Work

Pair DEMs and orthophotos, read frames and vertical datums, and compare the MLA polar grid and local volatile-loss DTM with current elevation. Rank measured footprint and detail gain before preparing a bounded subset.

#### Limits and prior decisions

Regional coverage, fixed geometry and no duplicate global basemap rows. Keep output sampling separate from stereo accuracy.

#### Acceptance

Independent elevations, overlap residuals, regional boundary masks and matched camera comparisons against the current global maps.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_dtms_fassett_2016)
- [USGS product record](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_volatile_loss_dtm)
- [NASA source page](https://science.nasa.gov/photojournal/digital-elevation-model-of-mercurys-northern-hemisphere/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA17385](https://science.nasa.gov/photojournal/digital-elevation-model-of-mercurys-northern-hemisphere/) | candidate | Northern Mercury MLA DEM offers independent altimetry relative to the current global stereo DEM; compare numeric support and datum before a regional addition. |

USGS catalogue IDs: `mercury_messenger_mdis_dtms_fassett_2016`, `mercury_messenger_mdis_volatile_loss_dtm`.


## P28

### Moon: qualify regional terrain and photometric products

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The Moon already has global imagery, elevation, thermal, mineral and geology views.

Prepare only local products whose numeric terrain or photometric information adds a measured improvement over those views.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The linked regional collection lists 15 TIFFs. Separate USGS records identify the Apollo 17 orthomosaic, south-polar DEM/slope and Haworth photoclinometry. PIA00090 adds an Aristarchus multispectral lead. Each remains a regional product with its own method and quality limits.

#### Work

Match source quantity, map projection, scale, footprint and quality for each location. Group related variants through existing controls if a regional addition is warranted.

#### Limits and prior decisions

Keep the mesh fixed. No global fill, duplicate mineral claims or separate photographs panel.

#### Acceptance

Source-to-output values, regional bounds, landmark registration and visible benefit at the selected texture size.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_apollo_17_lroc_nac_landing_site_orthomosaic_50cm)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem)
- [USGS product record](https://astrogeology.usgs.gov/search/map/lunar_lro_nac_haworth_photoclinometry_dem_1m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/regional_topography_and_photometric_cube_data_for_lunar_locations)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lro_south_pole_dem_slope_map)
- [NASA source page](https://science.nasa.gov/photojournal/multispectral-mosaic-of-the-aristarchus-crater-and-plateau/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00090](https://science.nasa.gov/photojournal/multispectral-mosaic-of-the-aristarchus-crater-and-plateau/) | candidate | Aristarchus Clementine three-filter ratios are a regional spectral lead; recover calibrated bands and compare with current Kaguya coverage, not the decorated RGB alone. |

USGS catalogue IDs: `regional_topography_and_photometric_cube_data_for_lunar_locations`, `moon_apollo_17_lroc_nac_landing_site_orthomosaic_50cm`, `moon_lro_south_pole_dem`, `lunar_lro_nac_haworth_photoclinometry_dem_1m`, `moon_lro_south_pole_dem_slope_map`.


## P29

### Io: resolve the limits of the Tvashtar stereo product

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The existing Io package does not have a qualified global height field from this source.

Determine whether the regional product supports any defensible relative-height display, and record the result in Io's investigation ledger.

Content owners: [io](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/io/README.md)

#### Evidence

The source explicitly calls the DEM uncontrolled, with an arbitrary elevation zero and possible long-baseline tilt.

#### Work

Inspect the stereo solution, vertical reference and external control. Quantify residual tilt and local uncertainty before preparing any relative-height view.

#### Limits and prior decisions

No absolute elevation, no global elevation layer and no geometry changes. Without new independent control this remains excluded from delivery.

#### Acceptance

A reproducible control comparison and an explicit acceptance or rejection; visual plausibility is not sufficient.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_tvashtar_paterae_dem_and_orthoimages_900m)

USGS catalogue IDs: `io_galileo_ssi_tvashtar_paterae_dem_and_orthoimages_900m`.


## P30

### Mercury: magnesium and other elemental measurements

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Current Mercury adds MDIS imaging, numeric height and a MASCS spectrum; XRS/GRS surface chemistry is distinct from those.

Add qualified elemental ratios and neutron-absorption data from MESSENGER as one related measurement group.

Content owners: [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

#### Evidence

PIA19242 shows Mg/Si and thermal-neutron absorption derived from XRS and GRS. It is an explanatory two-panel image, not the native numeric release.

#### Work

Locate the underlying published grids and uncertainties through the source references, establish the effective footprint and longitude convention, then prepare numeric fields offline.

#### Limits and prior decisions

Do not decode quantitative values from the press color palette or call a neutron-absorption signal a specific mineral abundance. Native release access and coverage are not yet verified.

#### Acceptance

Check native units, scale, mask, uncertainty and published sample values. Release only if useful coverage and original numeric data are established.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/surface-chemistry-maps/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA19242](https://science.nasa.gov/photojournal/surface-chemistry-maps/) | candidate | Mercury Mg/Si and neutron-absorption maps introduce distinct XRS/GRS chemistry leads; original grids and uncertainty remain to be acquired. |


## P31

### Vesta: qualify VIR mineral and rock signatures

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Vesta has FC spectral ratios. Its ledger already excludes the small NASA VIR press mineral map as a quantitative input.

Find and qualify the original VIR measurements or derived grids behind the mineral, hydration and rock-unit maps.

Content owners: [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

#### Evidence

The supplied pages show distinct VIR interpretations, including pyroxene and hydration; they do not resolve the existing native-data blocker.

#### Work

Trace products to calibrated VIR spectra and documented models, retain footprint and uncertainty, and convert their frame to the selected Claudia convention.

#### Limits and prior decisions

Keep the existing exclusion unless reusable numeric or registered source products are found. Howardite, eucrite and diogenite are rock categories; a press color is not a mineral percentage.

#### Acceptance

An original-product receipt, independent spectral samples, frame validation and a quantity-specific interpretation. Do not release an RGB-to-abundance reconstruction.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/visible-and-infrared-data-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/a-global-view-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-visible-and-infrared-spectrometer-data/)
- [NASA source page](https://science.nasa.gov/photojournal/global-mineral-map-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/pyroxene-map-of-vestas-south-pole/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-hydrated-minerals-on-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-rock-properties-at-giant-asteroid-vesta/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA14697](https://science.nasa.gov/photojournal/visible-and-infrared-data-mosaic/) | candidate | Vesta July 2011 VIR paired views sample about 1.3 km/pixel; recover original spectra and distinguish simulated true color from physical band information. |
| [PIA15144](https://science.nasa.gov/photojournal/a-global-view-of-vesta/) | candidate | Vesta HAMO VIR image set is spectral instrument data distinct from FC photography; trace exact original channels and interpretation before integration. |
| [PIA15343](https://science.nasa.gov/photojournal/mosaic-of-visible-and-infrared-spectrometer-data/) | candidate | HAMO VIR mosaic locates spectral data coverage; original wavelengths and masks are needed, and footprint graphics are not mineral measurements. |
| [PIA15669](https://science.nasa.gov/photojournal/global-mineral-map-of-vesta/) | candidate | Vesta VIR mineral press map is already excluded as a quantitative input; proposal targets original spectra/grids and explicitly retains that blocker. |
| [PIA15672](https://science.nasa.gov/photojournal/pyroxene-map-of-vestas-south-pole/) | candidate | Vesta south-polar 1 µm pyroxene proxy is a distinct band interpretation; validate the proxy and native quantity before labeling abundance. |
| [PIA16186](https://science.nasa.gov/photojournal/map-of-hydrated-minerals-on-vesta/) | candidate | VIR hydration signature is distinct from GRaND hydrogen and FC color; original band retrieval and uncertainties are required. |
| [PIA17475](https://science.nasa.gov/photojournal/map-of-rock-properties-at-giant-asteroid-vesta/) | candidate | Vesta VIR rock-type interpretation is new relative to FC ratios, but eucrite/howardite/diogenite labels require original model data and must not be described as simple mineral percentages. |


## P32

### Vesta: mapped geological units

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The selected Vesta views include photographs, spectral ratios and elevation, without this geological-unit map.

Qualify published geological units and original bright/dark deposit catalogues for Vesta through existing categorical and feature content.

Content owners: [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

#### Evidence

PIA18788 combines 15 quadrangle maps in a Mollweide map using Dawn Claudia coordinates.

#### Work

Locate original unit boundaries, deposit tables and legends. Keep mapped geological interpretation distinct from reflectance and the VIR mineral measurements in proposal 31.

#### Limits and prior decisions

The press sheet includes labels and a legend; it is not a clean numeric input. Map units are interpreted terrain categories, not exact ages or measured mineral fractions.

#### Acceptance

Verify unit boundaries, categorical resampling, landmark orientation, legend completeness and source reuse terms.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/map-of-bright-areas-on-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-dark-materials-on-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/geological-map-of-vesta/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA15233](https://science.nasa.gov/photojournal/map-of-bright-areas-on-vesta/) | candidate | Vesta bright-material locations may support a geological/deposit catalogue if original coordinates and definitions are available; brightness alone is not composition. |
| [PIA15238](https://science.nasa.gov/photojournal/map-of-dark-materials-on-vesta/) | candidate | Vesta dark-material map distinguishes deposit settings with symbols; recover the research catalogue/units rather than digitize press marks as exact coordinates. |
| [PIA18788](https://science.nasa.gov/photojournal/geological-map-of-vesta/) | candidate | Vesta fifteen-quadrangle geology combines mapped units in Claudia coordinates; native categorical/vector data could add a distinct geology view. |


## P33

### Titan: observed infrared surface coverage

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Titan has current ISS, radar, terrain and geology. The ledger leaves the 2019 VIMS/ISS composite unresolved because filled pixels lack a validity mask.

Qualify a VIMS surface product that distinguishes observed spectral coverage from filled or seam-repaired areas.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

#### Evidence

The surface Photojournal pages discuss atmospheric/photometric correction and mosaics from many flybys. Their native masks remain essential. The separate atmospheric HCN observation is assigned to proposal 80.

#### Work

Locate masks and native band or ratio products, identify footprints and source epochs, and document haze correction before selecting data.

#### Limits and prior decisions

The new list does not remove the existing mask blocker. Apparent surface brightening is not proof of cryovolcanism. No synthetic global fill or atmospheric volume work.

#### Acceptance

Measured coverage per band, common mask, calibration/photometry comparison, existing-ledger reopen evidence and fixed-scene registration.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/an-infrared-map-of-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-in-infrared/)
- [NASA source page](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/working-toward-seamless-infrared-maps-of-titan/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02147](https://science.nasa.gov/photojournal/an-infrared-map-of-titan/) | candidate | Titan 1.6/2.01/5 µm mosaic combines two flybys and measures reflected light; it is not thermal emission or instantaneous global coverage. |
| [PIA07961](https://science.nasa.gov/photojournal/map-of-titan-in-infrared/) | candidate | October 2004 Titan VIMS swath ranges from tens of km to roughly 2 km pixels; preserve variable resolution and atmospheric correction. |
| [PIA11701](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/) | candidate | Titan VIMS brightness-change regions are a source lead, but cryovolcanism is a hypothesis and calibration/atmospheric effects must be controlled. |
| [PIA13696](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/) | candidate | Sotra Facula plate combines SAR footprints with VIMS context and a volcanic interpretation; qualify each data source and keep the interpretation conditional. |
| [PIA20022](https://science.nasa.gov/photojournal/working-toward-seamless-infrared-maps-of-titan/) | candidate | Titan synthetic VIMS views demonstrate seam/photometry processing over many flybys; the existing validity-mask blocker remains and native observed support is required. |


## P34

### Titan: measured seasonal temperature by latitude

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Titan's selected views do not include this seasonal surface-temperature series.

Present Cassini CIRS seasonal temperatures as explicitly latitude-averaged observations, using the existing date selector or chart contract.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

#### Evidence

The source describes 19 µm measurements at two-year intervals from 2004 to 2016, averaged over longitude. Black regions have no data.

#### Work

Find the numeric latitude/time measurements and uncertainty, preserve averaging windows and missing latitudes, then select a compact sequence.

#### Limits and prior decisions

This is not a longitude-resolved surface temperature map. A zonal mean can only be displayed as such; the date is an averaging interval, not an instantaneous global observation.

#### Acceptance

Reproduce latitude profiles from native data, retain uncertainty and check date labels and missing regions. If only the animation is available, stop before integration.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/titan-temperature-lag-maps-and-animation/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA20020](https://science.nasa.gov/photojournal/titan-temperature-lag-maps-and-animation/) | candidate | Titan 2004–2016 CIRS temperatures are longitude-averaged latitude profiles at two-year intervals, not resolved longitude maps. |


## P35

### Ganymede: infrared ice and grain-size signatures

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Ganymede has imaging, geology and an oxygen-signature view. A new NIMS product needs comparison with the existing deferred SPHERE/JWST composition work.

Qualify Galileo NIMS ice-sensitive bands or published grain-size interpretations as measured regional data.

Content owners: [ganymede](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ganymede/README.md)

#### Evidence

PIA00500 compares camera imagery with NIMS water-ice and grain/mineral interpretations, but supplies a montage rather than a native scalar grid.

#### Work

Identify the original observation cube, geometry, wavelengths, masks and interpretation method; measure useful coverage on the current body.

#### Limits and prior decisions

Ice absorption, grain size and abundance are different quantities. Do not assign minerals from press colors or imply global coverage.

#### Acceptance

Native cube samples, footprint/landmark registration, spectral uncertainty and explicit distinction from the oxygen dataset.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/nims-ganymede-surface-map/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00500](https://science.nasa.gov/photojournal/nims-ganymede-surface-map/) | candidate | NIMS water-ice and grain/mineral panels are distinct spectral leads; native cubes, quantity definitions and coverage are still required. |


## P36

### Ganymede: Galileo brightness temperatures

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

No corresponding measured PPR temperature map is selected.

A dated brightness-temperature view for the observed part of Ganymede, with the PPR footprint retained.

Content owners: [ganymede](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ganymede/README.md)

#### Evidence

PIA01232 describes a 90–160 K daytime product. Its narrative contains inconsistent encounter/orbit wording, so native records must resolve the observation identity.

#### Work

Recover the PPR numeric measurements and geometry, establish the epoch and radiometric interpretation, and prepare only the measured footprint.

#### Limits and prior decisions

Brightness temperature is inferred from radiation and depends on assumptions; one sunlit encounter is not a global climate. No palette inversion.

#### Acceptance

Resolve observation identity against native labels, independently check temperature samples and quantify footprint and uncertainty.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-ganymede/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA01232](https://science.nasa.gov/photojournal/temperature-map-of-ganymede/) | candidate | Ganymede PPR temperatures are a radiometric observation lead; native records must resolve the page's encounter wording before release. |


## P37

### Phoebe, Iapetus and Enceladus: measured heat radiation

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Reflectivity and infrared/ice data already exist on these moons. This proposal concerns CIRS heat measurements, separate from Enceladus VIMS work in the other chat.

Prepare selected dated CIRS temperature products and local-time comparisons, with one coherent source-qualified outcome per moon.

Content owners: [phoebe](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/phoebe/README.md), [iapetus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/iapetus/README.md), [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md)

#### Evidence

The supplied pages show Phoebe flyby temperatures, Iapetus dark-side temperatures and Enceladus south-polar heat. They include unobserved areas, model comparisons and different spatial footprints.

#### Work

Obtain original CIRS measurements, footprints and uncertainties. Separate observed heat from predicted solar temperatures; choose only observations with useful coverage.

#### Limits and prior decisions

Different local times cannot be merged into a simultaneous global map. The Iapetus curve is not a spatial raster. Do not animate geysers or modify geometry.

#### Acceptance

Numeric temperature/brightness checks, explicit local time, measurement/model distinction, footprint masks and current-source overlap. Split implementation by moon if independent qualification outcomes differ.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/phoebe-temperature-maps/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-temperature-map/)
- [NASA source page](https://science.nasa.gov/photojournal/iapetus-temperature-map/)
- [NASA source page](https://science.nasa.gov/photojournal/iapetus-temperature-variation-map/)
- [NASA source page](https://science.nasa.gov/photojournal/stripes-and-heat-map-side-by-side/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA06403](https://science.nasa.gov/photojournal/phoebe-temperature-maps/) | candidate | Phoebe CIRS montage is a local-time temperature sequence with unobserved areas; recover numeric maps instead of merging them into a simultaneous globe. |
| [PIA06432](https://science.nasa.gov/photojournal/enceladus-temperature-map/) | candidate | Enceladus south-polar CIRS heat observation is distinct from the predicted solar-temperature panel; observed and modeled fields must remain separate. |
| [PIA07005](https://science.nasa.gov/photojournal/iapetus-temperature-map/) | candidate | Iapetus December 2004 CIRS temperature map records local illumination and dark/bright terrain differences; preserve time and measured footprint. |
| [PIA07006](https://science.nasa.gov/photojournal/iapetus-temperature-variation-map/) | candidate | Iapetus temperature-versus-local-time plot compares measurements with a thermal-inertia model; suitable as qualified chart data, not an additional spatial map. |
| [PIA10360](https://science.nasa.gov/photojournal/stripes-and-heat-map-side-by-side/) | candidate | Enceladus comparison shows earlier south-polar thermal footprints and a later flyby outline; preserve observation dates instead of assuming the whole plate is March 2008 data. |


## P38

### Enceladus: published geyser source locations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Existing named features do not establish this research catalogue. Enceladus VIMS imagery is already being worked on elsewhere.

Add the published jet-source catalogue through the existing feature contract, retaining uncertainty and research identifiers.

Content owners: [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md)

#### Evidence

The source page describes 100 plotted geyser sources, circles showing position uncertainty, and additional qualifications for poorly constrained tilts or single-image detections. It points to the 2014 papers.

#### Work

Acquire the original coordinate table, resolve source counts/definitions and projection, and compare with existing IAU features. Record uncertainty even if the current feature UI cannot draw error circles.

#### Limits and prior decisions

Locations are not a current activity forecast, animated plume or IAU naming catalogue. No new feature panel or invented jet geometry.

#### Acceptance

Match published IDs and coordinates, verify south-polar registration and account for ambiguous detections without merging them silently.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/surveyors-map-of-enceladus-geyser-basin/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA17188](https://science.nasa.gov/photojournal/surveyors-map-of-enceladus-geyser-basin/) | candidate | Enceladus source-location survey provides 100 plotted geysers with position/tilt qualifications; original coordinate table can feed existing research-feature content. |


## P39

### Ceres: catalogue of bright deposits

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Ceres has named features and composition maps; the more-than-300 bright-area classification has not been joined to those features.

Add source-backed deposit locations and their geological setting through existing feature content.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

#### Evidence

The NASA page groups bright areas by crater floor, rim/wall, ejecta and Ahuna Mons setting.

#### Work

Retrieve the research table behind the plot, match coordinates and IDs, and preserve category definitions and survey completeness.

#### Limits and prior decisions

Do not infer chemical composition from brightness alone or digitize plotted dots as exact coordinates. Avoid duplicating existing named faculae.

#### Acceptance

Row count, deduplication, coordinate frame, cross-match to named features and uncertainty. Release only with a reusable source catalogue.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/map-of-ceres-bright-spots/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA21914](https://science.nasa.gov/photojournal/map-of-ceres-bright-spots/) | candidate | More than 300 Ceres bright areas classified by geological setting could add feature content if original coordinates/catalogue can be recovered. |


## P40

### Pluto: geological units around Sputnik Planitia

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Pluto already has imagery, height and three fitted ice fractions; geological terrain units are a different interpreted dataset.

Prepare the published regional geological mapping with a categorical legend and an honest footprint.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/pluto/README.md)

#### Evidence

The two supplied pages are versions of the same geological map and legend, covering Sputnik Planitia and surrounding terrain rather than the full globe.

#### Work

Locate original polygons or a registered categorical release, preserve unit codes and source-map scale, and use the current categorical preparation lane.

#### Limits and prior decisions

Do not create two datasets from the map and its legend. Units describe mapped morphology; they are not measured ages or direct ice fractions.

#### Acceptance

Native boundary checks, source frame, categorical resampling, legend parity and missing-area visibility.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map/)
- [NASA source page](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map-2/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA20465](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map/) | candidate | Pluto Sputnik-region geological units are interpreted morphology on a regional map; obtain original categorical boundaries and legend. |
| [PIA20466](https://science.nasa.gov/photojournal/putting-plutos-geology-on-the-map-2/) | duplicate-family | Companion Pluto geology page explains the same map's legend; one underlying dataset, with both source references retained. |


## P41

### Io: dated volcanic changes and thermal observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Io already has a JIRAM volcanic-heat view from orbits 41, 43, 47 and 49, with 22% measured coverage. The current hotspot table serves as validation, not a second live lens.

Add qualified dated observations of surface change or heat that are distinct from the existing JIRAM map.

Content owners: [io](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/io/README.md)

#### Evidence

PIA26526 identifies JunoCam observations from April, October and December 2024 with different resolutions. Older Galileo pages show PPR temperatures and observed surface changes.

#### Work

Recover native JunoCam/SSI/PPR observations, keep epochs and instrument quantities separate, and compare registered common footprints. Assess later JIRAM observations under the current ledger. Treat the 242-volcano historical reconstruction and heat-flow model as separate interpreted products requiring their original numeric data; do not revive the retired point-symbol lens.

#### Limits and prior decisions

Different brightness processing is not proof of change. PPR temperature and JIRAM radiance are not interchangeable. The PPR night map warns that some edge temperatures may be spurious.

#### Acceptance

Matched registration and resolution, common-footprint masks, native radiometry and source-time labels. Do not replace measured heat with a modeled prediction from PIA16941.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/io-shown-in-lambertian-equal-area-projection-and-in-approximately-natural-color/)
- [NASA source page](https://science.nasa.gov/photojournal/global-mercator-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/io-cylindrical-projection/)
- [NASA source page](https://science.nasa.gov/photojournal/high-resolution-global-view-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-io-in-various-colors/)
- [NASA source page](https://science.nasa.gov/photojournal/color-global-mosaic-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/resurfacing-of-the-jupiter-facing-hemisphere-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-pele-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/voyager-to-galileo-changes-ios-anti-jove-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-io-natural-and-falseenhanced-color/)
- [NASA source page](https://science.nasa.gov/photojournal/color-mosaic-and-active-volcanic-plumes-on-io/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-kanehekili-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/changes-on-ios-loki-pele-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/highest-resolution-mosaic-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-pele-hemisphere-after-pillan-changes/)
- [NASA source page](https://science.nasa.gov/photojournal/io-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/io-2x2-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/galileo-ppr-temperature-maps-of-loki-in-october-1999/)
- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-ios-night-side/)
- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-pele-io/)
- [NASA source page](https://science.nasa.gov/photojournal/io-predicted-heat-flow-map/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-ios-volcanic-heat-flow/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-new-southern-hemisphere-hotspot/)
- [NASA source page](https://science.nasa.gov/photojournal/three-views-of-ios-southern-hemisphere/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00318](https://science.nasa.gov/photojournal/io-shown-in-lambertian-equal-area-projection-and-in-approximately-natural-color/) | candidate | Voyager equal-area Io hemispheres can anchor a historical surface-change comparison if source color and registration are recovered. |
| [PIA00319](https://science.nasa.gov/photojournal/global-mercator-mosaic/) | candidate | Voyager Mercator mosaic covers ±60° and a limited longitude range; a historical Io observation candidate with explicit footprint. |
| [PIA00401](https://science.nasa.gov/photojournal/io-cylindrical-projection/) | candidate | Voyager Io multispectral cube appears as natural/enhanced/ratio panels; recover its original bands once, rather than count three independent surveys. |
| [PIA00583](https://science.nasa.gov/photojournal/high-resolution-global-view-of-io/) | candidate | Galileo Io hemisphere offers a dated visible baseline at about 2.5 km resolvable scale; compare with current maps only on common support. |
| [PIA00584](https://science.nasa.gov/photojournal/global-view-of-io-in-various-colors/) | candidate | Near-zero-phase Io filter composites can support spectral/photometric comparison; the natural and enhanced panels are variants of related observations. |
| [PIA00585](https://science.nasa.gov/photojournal/color-global-mosaic-of-io/) | candidate | 1996 Io cylindrical composite merges July and September observations and includes grid lines; recover undecorated source bands and retain its multi-epoch identity. |
| [PIA00712](https://science.nasa.gov/photojournal/resurfacing-of-the-jupiter-facing-hemisphere-of-io/) | candidate | Voyager/Galileo Jupiter-facing comparison provides actual 1979/1996 surface-change leads; use original frames and common resolution rather than the four-panel plate. |
| [PIA00718](https://science.nasa.gov/photojournal/ios-pele-hemisphere/) | candidate | Pele comparison uses different filter sets on Voyager and Galileo; retain bandpass differences before attributing color differences to activity. |
| [PIA01063](https://science.nasa.gov/photojournal/voyager-to-galileo-changes-ios-anti-jove-hemisphere/) | candidate | Reprojected 1979/1996 Io comparison gives an explicit surface-change experiment; recover original filter calibration and common resolution. |
| [PIA01064](https://science.nasa.gov/photojournal/global-view-of-io-natural-and-falseenhanced-color/) | candidate | Natural/enhanced Io panels share a September 1996 near-IR/green/violet set; useful dated color, not two independent observations. |
| [PIA01081](https://science.nasa.gov/photojournal/color-mosaic-and-active-volcanic-plumes-on-io/) | candidate | Io C9 color records dated surface and plume activity; surface comparison is in scope, rendering an extended plume is not. |
| [PIA01108](https://science.nasa.gov/photojournal/mosaic-of-io/) | candidate | Io C3 simple-cylindrical mosaic is a broad dated photographic baseline; remove only presentation overlays using original data, not invented pixels. |
| [PIA01220](https://science.nasa.gov/photojournal/ios-kanehekili-hemisphere/) | candidate | Kanehekili C9 color hemisphere is a dated activity observation, with plume/thermal interpretations requiring their original supporting measurements. |
| [PIA01223](https://science.nasa.gov/photojournal/changes-on-ios-loki-pele-hemisphere/) | candidate | E6 Loki/Pele observation was designed to monitor color change; compare its common footprint and calibration with earlier Galileo epochs. |
| [PIA01663](https://science.nasa.gov/photojournal/highest-resolution-mosaic-of-io/) | candidate | Multi-orbit low-sun Io mosaic emphasizes relief; it is a historical photographic product, not numeric terrain or a single observation time. |
| [PIA01667](https://science.nasa.gov/photojournal/ios-pele-hemisphere-after-pillan-changes/) | candidate | Io's G10 Pele hemisphere follows the Pillan changes; useful for a registered dated sequence rather than another timeless global color map. |
| [PIA02250](https://science.nasa.gov/photojournal/io-southern-hemisphere/) | candidate | Io southern terminator photograph supplies shadow/terrain context at one geometry; do not derive a numeric height field from the press image. |
| [PIA02294](https://science.nasa.gov/photojournal/io-2x2-mosaic/) | candidate | Voyager four-image Io color mosaic is a 1979 baseline, conditional on original bands, registration and comparison with later epochs. |
| [PIA02524](https://science.nasa.gov/photojournal/galileo-ppr-temperature-maps-of-loki-in-october-1999/) | candidate | Galileo PPR maps of Loki's October 1999 eruption measure thermal behavior distinct from later JIRAM radiance; retain epoch and physical units. |
| [PIA02548](https://science.nasa.gov/photojournal/temperature-map-of-ios-night-side/) | candidate | Io night-temperature mosaic combines November 1999 and February 2000; keep spurious-edge warning and separate encounters from one instantaneous map. |
| [PIA02560](https://science.nasa.gov/photojournal/temperature-map-of-pele-io/) | candidate | Pele February 2000 infrared temperature overlay uses 1979 visible context; the thermal footprint must not inherit the background's apparent resolution or epoch. |
| [PIA16941](https://science.nasa.gov/photojournal/io-predicted-heat-flow-map/) | candidate | Two Io tidal-heating predictions are model-comparison leads only; they must remain distinct from observed PPR/JIRAM heat and cannot replace measured coverage. |
| [PIA19655](https://science.nasa.gov/photojournal/map-of-ios-volcanic-heat-flow/) | candidate | Io's 242-volcano heat-flow reconstruction is historical derived data, despite the supplied Jupiter tag; compare methodology with current JIRAM and do not revive the retired hotspot-symbol lens. |
| [PIA22600](https://science.nasa.gov/photojournal/ios-new-southern-hemisphere-hotspot/) | candidate | December 2017 JIRAM southern hotspot is a dated thermal source outside the selected later orbit set; qualify native radiance and footprint before extension. |
| [PIA26526](https://science.nasa.gov/photojournal/three-views-of-ios-southern-hemisphere/) | candidate | Io April/October/December 2024 JunoCam comparisons have unequal resolutions; native common-footprint qualification can support real volcanic surface-change content. |


## P42

### Jupiter: dated visible and infrared observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Jupiter already has dated OPAL visible maps plus UV and methane views. More OPAL dates already present are not new work.

Add a small number of scientifically distinct historical observing sets, with regional NIMS/PPR products considered only if the original geometry and quantity are recoverable.

Content owners: [jupiter](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/jupiter/README.md)

#### Evidence

The individual entries span Voyager, Galileo, Cassini, New Horizons, Juno and ground-based observing sets. They include cylindrical maps, spectral/time sequences, pressure-sensitive infrared measurements and regional impact observations. One PR should release a coherent qualified set rather than combine unrelated epochs.

#### Work

Group by actual observation and wavelength, recover native map boundaries and longitude system, and select coherent epochs. Use existing date/band arrows.

#### Limits and prior decisions

A historical partial hemisphere cannot silently fill a modern OPAL map. A PPR pressure-level temperature is not a solid-surface temperature. No artificial animation from unrelated exposures.

#### Acceptance

Resolve each epoch and observing interval, validate longitude systems and common footprints, and compare source-calibrated channels without independent cosmetic stretches.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/cylindrical-projection-of-jupiter/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiter-great-red-spot-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/great-red-spot-mosaic-near-infrared-filter/)
- [NASA source page](https://science.nasa.gov/photojournal/false-color-mosaic-great-red-spot/)
- [NASA source page](https://science.nasa.gov/photojournal/nims-spectral-maps-of-jupiters-great-red-spot/)
- [NASA source page](https://science.nasa.gov/photojournal/false-color-mosaic-of-jupiters-belt-zone-boundary-2/)
- [NASA source page](https://science.nasa.gov/photojournal/true-color-mosaic-of-jupiters-belt-zone-boundary/)
- [NASA source page](https://science.nasa.gov/photojournal/e4-true-and-false-color-hot-spot-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-in-the-near-infrared/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-in-the-near-infrared-2/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-violet-filter/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-727-nm/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-methane-filter/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-1/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-1/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-1-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-violet-light-time-set-1/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-2-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-violet-light-time-set-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-3/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-3/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-3-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-violet-light-time-set-3/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-4/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-true-color-time-set-1/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-false-color-time-set-1/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-true-color-time-set-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-false-color-time-set-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-true-color-time-set-3/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-false-color-time-set-3/)
- [NASA source page](https://science.nasa.gov/photojournal/false-color-mosaic-of-jupiters-belt-zone-boundary/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-southern-hemisphere-in-the-near-infrared-time-set-1/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-southern-hemisphere-in-the-near-infrared-time-set-2/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-southern-hemisphere-in-the-near-infrared-time-set-3/)
- [NASA source page](https://science.nasa.gov/photojournal/photopolarimeterradiometer-ppr-temperature-map-of-great-red-spot/)
- [NASA source page](https://science.nasa.gov/photojournal/ppr-great-red-spot-temperature-map/)
- [NASA source page](https://science.nasa.gov/photojournal/clouds-and-hazes-of-jupiters-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/voyager-1-jupiter-southern-hemisphere-movie/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-hemisphere-storms/)
- [NASA source page](https://science.nasa.gov/photojournal/pj-high-resolution-globe-of-jupiter/)
- [NASA source page](https://science.nasa.gov/photojournal/atmospheric-motion-in-jupiters-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/)
- [NASA source page](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-north-polar-map/)
- [NASA source page](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-south-polar-map/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiter-atmospheric-map/)
- [NASA source page](https://science.nasa.gov/photojournal/a-moving-jupiter-global-map-animation/)
- [NASA source page](https://science.nasa.gov/photojournal/full-jupiter-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/heat-map-of-jupiter-impact/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-hemisphere-close-up/)
- [NASA source page](https://science.nasa.gov/photojournal/jupiters-stunning-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-hemisphere-views/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00011](https://science.nasa.gov/photojournal/cylindrical-projection-of-jupiter/) | candidate | Voyager's February 1979 cylindrical map covers one rotation and could add a coherent historical Jupiter epoch after coordinate and color qualification. |
| [PIA00022](https://science.nasa.gov/photojournal/jupiter-great-red-spot-mosaic/) | candidate | March 1979 Great Red Spot regional observation; a historical storm comparison needs original registration and matched scale, not a global texture. |
| [PIA00488](https://science.nasa.gov/photojournal/great-red-spot-mosaic-near-infrared-filter/) | candidate | Six Galileo frames at 757 nm form a registered Great Red Spot sequence over 80 seconds; valuable as a dated wavelength observation if native scale is retained. |
| [PIA00489](https://science.nasa.gov/photojournal/false-color-mosaic-great-red-spot/) | candidate | Great Red Spot three-band false color encodes cloud-height sensitivity; recover individual bands and avoid treating RGB as literal cloud altitude. |
| [PIA00501](https://science.nasa.gov/photojournal/nims-spectral-maps-of-jupiters-great-red-spot/) | candidate | Four NIMS wavelengths around the Great Red Spot probe different cloud properties; original calibrated bands could add information beyond OPAL, regionally. |
| [PIA00548](https://science.nasa.gov/photojournal/false-color-mosaic-of-jupiters-belt-zone-boundary-2/) | candidate | Galileo 886/732/757 nm belt-boundary mosaic is a coherent regional spectral set; preserve the band meanings and observation interval. |
| [PIA00574](https://science.nasa.gov/photojournal/true-color-mosaic-of-jupiters-belt-zone-boundary/) | candidate | Pseudo-true-color belt mosaic synthesizes green from violet/near-IR inputs; a useful observing-set variant, not a measured RGB color dataset. |
| [PIA00602](https://science.nasa.gov/photojournal/e4-true-and-false-color-hot-spot-mosaic/) | candidate | E4 hotspot true/false-color panels use related Galileo filters; retain one dated band set and separate cloud-height sensitivity from visible color. |
| [PIA00829](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-in-the-near-infrared/) | candidate | First registered Galileo Great Red Spot 756 nm sequence; deduplicate against PIA00488's same observing-family product. |
| [PIA00830](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-in-the-near-infrared-2/) | candidate | Second 756 nm Great Red Spot mosaic is about ten hours later; preserve it as a separate observation time within one band group. |
| [PIA00831](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-violet-filter/) | candidate | 404 nm violet Great Red Spot sequence provides a distinct band, with its own 75-second acquisition interval and common-grid registration. |
| [PIA00832](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-727-nm/) | candidate | 727 nm methane-sensitive Great Red Spot mosaic belongs in the coherent Galileo filter set, not as an inferred gas-abundance map. |
| [PIA00833](https://science.nasa.gov/photojournal/mosaic-of-jupiters-great-red-spot-methane-filter/) | candidate | 886 nm methane-sensitive Great Red Spot mosaic has different atmospheric sensitivity from 727 nm; retain the native wavelength and time. |
| [PIA00879](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-1/) | candidate | Northern 10–50° near-IR time set 1 anchors the Galileo observing sequence; no polar or full-latitude coverage is implied. |
| [PIA00880](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-1/) | candidate | First northern methane-band product in time set 1; recover wavelength metadata and retain it separately from the companion methane filter. |
| [PIA00881](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-1-2/) | candidate | Second northern methane-band product in time set 1; similar title is not sufficient evidence of duplication. |
| [PIA00882](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-violet-light-time-set-1/) | candidate | Northern violet time set 1 adds the short-wavelength measurement on the same limited latitude strip. |
| [PIA00883](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-2/) | candidate | Northern near-IR time set 2 is a later observation, not a second independent global survey. |
| [PIA00884](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-2/) | candidate | Time set 2 methane product must retain its wavelength and source acquisition interval; compare only common footprint with set 1. |
| [PIA00885](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-2-2/) | candidate | Companion methane product in time set 2 requires a distinct band identity before grouping with the other methane channel. |
| [PIA00886](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-violet-light-time-set-2/) | candidate | Northern violet time set 2 supplies temporal comparison at one band, subject to geometric and photometric matching. |
| [PIA00887](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-3/) | candidate | Northern near-IR time set 3 adds another measured epoch within the latitude strip; keep missing longitudes visible. |
| [PIA00888](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-3/) | candidate | Time set 3 methane observation is a wavelength/time choice, not a standalone atmospheric-composition claim. |
| [PIA00889](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-a-methane-band-time-set-3-2/) | candidate | Second methane observation in set 3 remains separate until native wavelength metadata resolves its identity. |
| [PIA00890](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-violet-light-time-set-3/) | candidate | Northern violet time set 3 completes another multiband epoch; color comparisons need a common calibration. |
| [PIA00891](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-the-near-infrared-time-set-4/) | candidate | Fourth northern near-IR time set provides an additional time sample; do not fabricate unobserved companion bands. |
| [PIA00892](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-true-color-time-set-1/) | duplicate-family | Time set 1 true-color presentation is derived from the observing set's filters; retain its synthesis recipe rather than count new exposure coverage. |
| [PIA00893](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-false-color-time-set-1/) | duplicate-family | Time set 1 false-color presentation encodes the same band's measurements differently; no extra independent observations. |
| [PIA00894](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-true-color-time-set-2/) | duplicate-family | Time set 2 true-color composite is a presentation variant of that epoch's channels and needs explicit synthetic-color labeling. |
| [PIA00895](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-false-color-time-set-2/) | duplicate-family | Time set 2 false-color composite belongs with its original spectral channels, not a separate inferred physical field. |
| [PIA00896](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-true-color-time-set-3/) | duplicate-family | Time set 3 true-color panel is a derived observing-set presentation; select it only with the underlying band provenance. |
| [PIA00897](https://science.nasa.gov/photojournal/jupiters-northern-hemisphere-in-false-color-time-set-3/) | duplicate-family | Time set 3 false-color panel adds no source footprint beyond its contributing channels. |
| [PIA01116](https://science.nasa.gov/photojournal/false-color-mosaic-of-jupiters-belt-zone-boundary/) | duplicate-family | Galileo belt-zone false-color presentation appears in the same three-near-IR product family; cross-match with PIA00548 before selecting. |
| [PIA01227](https://science.nasa.gov/photojournal/jupiters-southern-hemisphere-in-the-near-infrared-time-set-1/) | candidate | Southern Jupiter near-IR time set 1 covers −10° to −80°; preserve limb and finite observing window. |
| [PIA01228](https://science.nasa.gov/photojournal/jupiters-southern-hemisphere-in-the-near-infrared-time-set-2/) | candidate | Southern time set 2 is nine hours later with different coverage and a terminator boundary; no interpolation into an instantaneous global map. |
| [PIA01229](https://science.nasa.gov/photojournal/jupiters-southern-hemisphere-in-the-near-infrared-time-set-3/) | candidate | Southern time set 3 is ten hours after set 1; use a date/time choice with exact common support. |
| [PIA01233](https://science.nasa.gov/photojournal/photopolarimeterradiometer-ppr-temperature-map-of-great-red-spot/) | candidate | Great Red Spot PPR map samples an atmospheric pressure level; retain the source's 250 mbar interpretation, not a surface-temperature label. |
| [PIA01234](https://science.nasa.gov/photojournal/ppr-great-red-spot-temperature-map/) | candidate | Companion PPR map represents about 500 mbar and is scientifically distinct from the 250 mbar product; preserve vertical sensitivity. |
| [PIA02098](https://science.nasa.gov/photojournal/clouds-and-hazes-of-jupiters-southern-hemisphere/) | candidate | Galileo southern true/false-color clouds cover 25°S to the pole; derived color variants belong to one qualified observing set. |
| [PIA02258](https://science.nasa.gov/photojournal/voyager-1-jupiter-southern-hemisphere-movie/) | candidate | Voyager sequence spans 17 Jupiter days; choose original dated maps/frames for existing controls rather than fabricate continuous surface animation. |
| [PIA02869](https://science.nasa.gov/photojournal/southern-hemisphere-storms/) | candidate | Cassini Jupiter southern-storm movie offers dated original frames; retain interval and common geometry instead of treating its still as a global map. |
| [PIA02873](https://science.nasa.gov/photojournal/pj-high-resolution-globe-of-jupiter/) | candidate | Cassini December 2000 globe was rendered from a cylindrical map; recover the underlying four-image map, not pixels from the rendered limb. |
| [PIA03000](https://science.nasa.gov/photojournal/atmospheric-motion-in-jupiters-northern-hemisphere/) | duplicate-family | Northern Jupiter motion plate reuses true/false-color Galileo time sequences; trace back to those observations rather than count new independent coverage. |
| [PIA07782](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/) | candidate | Cassini December 11–12 2000 cylindrical Jupiter map offers a coherent historical epoch; retain its multi-rotation observing interval. |
| [PIA07783](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-north-polar-map/) | duplicate-family | North-polar projection uses the PIA07782 observing set; useful registration reference, not another independent date. |
| [PIA07784](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-south-polar-map/) | duplicate-family | South-polar projection also derives from the same Cassini 2000 set; retain one dataset with source-backed polar support. |
| [PIA09241](https://science.nasa.gov/photojournal/jupiter-atmospheric-map/) | candidate | New Horizons January 2007 LORRI map combines eleven hourly observations; a useful historical rotation map with its interval stated. |
| [PIA09242](https://science.nasa.gov/photojournal/a-moving-jupiter-global-map-animation/) | candidate | Six New Horizons observing sets each cover a rotation; source maps can use existing date selection without treating the animation as continuous measured evolution. |
| [PIA09243](https://science.nasa.gov/photojournal/full-jupiter-mosaic/) | candidate | February 2007 LORRI four-frame disc mosaic is a separate short observation; original geometry is required rather than a flat globe texture. |
| [PIA13761](https://science.nasa.gov/photojournal/heat-map-of-jupiter-impact/) | candidate | Gemini 9.7 µm Jupiter impact emission is a distinct 2009 thermal observation; recover calibrated radiance and footprint, not infer temperature from press RGB. |
| [PIA21035](https://science.nasa.gov/photojournal/southern-hemisphere-close-up/) | candidate | JunoCam red-filter southern Jupiter observation from August 2016 offers a specific band/epoch; register its partial footprint without mixing with OPAL dates. |
| [PIA21970](https://science.nasa.gov/photojournal/jupiters-stunning-southern-hemisphere/) | candidate | October 2017 JunoCam southern color-enhanced view offers a dated atmosphere observation; original color processing and regional geometry need qualification. |
| [PIA24234](https://science.nasa.gov/photojournal/southern-hemisphere-views/) | candidate | JunoCam April 2020 southern Jupiter image is a specific observing epoch; qualify native geometry/color rather than paste it into OPAL. |


## P43

### Saturn: coherent historical observing sets

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Saturn already has dated OPAL, UV and methane maps. Its ledger rejects a Cassini polar cap pasted into the 2025 OPAL body.

Qualify one coherent Voyager or Cassini visible/infrared set as a separately dated dataset if coverage supports the existing map contract.

Content owners: [saturn](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/saturn/README.md)

#### Evidence

The individual review includes Voyager observations, Cassini visible/infrared narrow-strip mosaics and southern-hemisphere UV imagery.

#### Work

Find original map-projected products, observing intervals, ring/limb masks and longitude conventions. Measure coverage before committing to a surface view.

#### Limits and prior decisions

This does not reopen cross-mission cap filling or claim the narrow-strip images are ready global maps. No cloud geometry or renderer work.

#### Acceptance

Native observation identity, geometry, bandpass, measured footprint and actual improvement over the existing historical set.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/saturn-false-color-of-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/saturn-brown-ovals-in-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/saturns-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/photographic-mosaic-of-saturn/)
- [NASA source page](https://science.nasa.gov/photojournal/saturns-northern-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/northern-hemisphere-of-saturn/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-hemisphere-in-ultraviolet/)
- [NASA source page](https://science.nasa.gov/photojournal/the-painted-globe/)
- [NASA source page](https://science.nasa.gov/photojournal/cassini-noodle-mosaic-of-saturn/)
- [NASA source page](https://science.nasa.gov/photojournal/cassini-near-infrared-noodle-mosaic-of-saturn/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00025](https://science.nasa.gov/photojournal/saturn-false-color-of-southern-hemisphere/) | candidate | Voyager's November 1980 southern false-color image adds an epoch/band lead; its red oval is not a calibrated composition map. |
| [PIA00026](https://science.nasa.gov/photojournal/saturn-brown-ovals-in-northern-hemisphere/) | candidate | November 1980 northern ovals form a separate dated Voyager observation; partial hemisphere and geometry must be preserved. |
| [PIA01365](https://science.nasa.gov/photojournal/saturns-northern-hemisphere/) | candidate | Voyager Saturn UV/violet/green hemisphere offers a coherent historical band set with partial coverage. |
| [PIA01377](https://science.nasa.gov/photojournal/photographic-mosaic-of-saturn/) | candidate | Voyager three-frame green Saturn mosaic is a distinct dated morphology observation, not a ready global map. |
| [PIA01960](https://science.nasa.gov/photojournal/saturns-northern-hemisphere-2/) | candidate | Paired Voyager violet and green Saturn images cover the same region; a useful historical two-band set with explicit footprint. |
| [PIA02230](https://science.nasa.gov/photojournal/northern-hemisphere-of-saturn/) | candidate | Voyager November 1980 Saturn northern cloud image is a separate epoch/footprint lead for the historical observing-set proposal. |
| [PIA05412](https://science.nasa.gov/photojournal/southern-hemisphere-in-ultraviolet/) | candidate | Cassini May 2004 UV Saturn image adds a dated band observation; clouds/aerosols and gas brightness need their UV interpretation retained. |
| [PIA08396](https://science.nasa.gov/photojournal/the-painted-globe/) | candidate | Saturn Cassini color observation may add a coherent historical epoch; verify actual target despite the supplied ring tag and preserve illumination. |
| [PIA21617](https://science.nasa.gov/photojournal/cassini-noodle-mosaic-of-saturn/) | candidate | Cassini April 2017 narrow-strip mosaic covers a long latitude swath rather than a full globe; original geometry and observing interval must be retained. |
| [PIA21622](https://science.nasa.gov/photojournal/cassini-near-infrared-noodle-mosaic-of-saturn/) | candidate | June 2017 thirty-frame near-IR Saturn swath is a distinct epoch/band; partial coverage and changing camera geometry are qualification requirements. |


## P44

### Saturn rings: qualify radial spectral measurements

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Ring opacity uses a measured UVIS profile, but radius-indexed color is unresolved. Perspective Photojournal images do not meet that requirement.

Find a calibrated radius-indexed VIMS spectral profile that can be prepared within the existing ring contract, or record why it cannot.

Content owners: [saturn](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/saturn/README.md)

#### Evidence

PIA23170 shows spectral variation across A, B and C rings. Its colors mix ice purity and grain-size effects and are not a ready radial measurement file.

#### Work

Trace the native VIMS scan and geometry, preserve radial resolution and quality flags, then check whether current prepared ring assets can represent the qualified quantity.

#### Limits and prior decisions

No renderer or ring-topology changes. If the existing contract cannot support the result, keep an evidence-only PR. Do not infer grain size or abundance from press RGB values.

#### Acceptance

Published radial calibration and uncertainty, scan-to-radius mapping, current-contract feasibility and no regression in the selected opacity profile.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/two-image-mosaic-of-saturns-rings/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-saturns-rings/)
- [NASA source page](https://science.nasa.gov/photojournal/the-atlas-ring/)
- [NASA source page](https://science.nasa.gov/photojournal/infrared-eye-yields-new-spectral-map/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02227](https://science.nasa.gov/photojournal/two-image-mosaic-of-saturns-rings/) | candidate | Voyager ring mosaic offers a geometric/profile lead, but perspective brightness does not solve the missing calibrated radius-indexed color source. |
| [PIA02242](https://science.nasa.gov/photojournal/mosaic-of-saturns-rings/) | candidate | Underside Cassini-Division imagery is a ring-scattering observation lead; radial geometry and viewing-side calibration differ from face-on reflectance. |
| [PIA06113](https://science.nasa.gov/photojournal/the-atlas-ring/) | candidate | New narrow-ring observation near Atlas is a source lead for radial support, not calibrated opacity/color; require native geometry and a valid profile. |
| [PIA23170](https://science.nasa.gov/photojournal/infrared-eye-yields-new-spectral-map/) | candidate | Saturn VIMS ring colors combine ice/grain-size sensitivity; require calibrated radial spectra and current-contract feasibility, not palette inversion. |


## P45

### Tempel 1: qualify a body package and thermal observation

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

No Tempel 1 package appears in the pinned source snapshot. The PSI PDS4 tree does not include the full separate UMD comet archive.

A source-intake proposal for a genuine observed comet package, followed by a dated thermal view only if its shape, camera and data can be qualified through the generic object contract.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

The Photojournal thermal page describes a modeled separation of reflected and emitted light from Deep Impact infrared observations; the imagery is regional on the nucleus.

#### Work

Locate the original UMD/PDS comet products, shape, frame, images and thermal interpretation. Establish acquisition and registration before promising a new rendered object.

#### Limits and prior decisions

The current audit has not downloaded or qualified those holdings. Do not create a fallback scene from the press montage. No renderer redesign or synthetic whole-nucleus temperature.

#### Acceptance

A complete original-source intake, generic-adapter compatibility, camera/shape evidence, uncertainty and measured coverage before any package release.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/tempel-1-composite-map/)
- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-tempel-1/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02142](https://science.nasa.gov/photojournal/tempel-1-composite-map/) | candidate | Tempel 1 composite resamples varied-distance images to 5 m pixels; original shape/camera registration is required and uniform pixel scale is not uniform resolution. |
| [PIA02143](https://science.nasa.gov/photojournal/temperature-map-of-tempel-1/) | candidate | Tempel 1 infrared thermal fit separates reflected and emitted components; preserve regional support, model assumptions and uncertainty. |


## P46

### Moon: GRAIL gravity anomalies

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The Moon already has crustal thickness and topography; a gravitational anomaly is a distinct modeled quantity.

Add a qualified GRAIL Bouguer anomaly map and retain local Orientale/dike illustrations as supporting leads only.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

PIA16623 describes gravity after removal of topographic attraction. The supplied movie is not the original coefficient or grid release.

#### Work

Obtain published coefficients or numeric grids and model assumptions, evaluate them offline if needed, and record degree, density and reference-radius choices.

#### Limits and prior decisions

An anomaly does not uniquely identify a buried rock type or cavity. Keep the existing crustal-thickness product distinct and the mesh unchanged.

#### Acceptance

Independent published check values, model truncation, units, orientation and uncertainty; avoid interpreting grid spacing as resolving power.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/moon-dike-map/)
- [NASA source page](https://science.nasa.gov/photojournal/grails-bouguer-gravity-moon-map/)
- [NASA source page](https://science.nasa.gov/photojournal/grail-gravity-map-of-orientale-basin/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA16584](https://science.nasa.gov/photojournal/moon-dike-map/) | candidate | GRAIL-inferred lunar dike locations are a model interpretation, potentially feature content after recovery of the published catalogue and uncertainty. |
| [PIA16623](https://science.nasa.gov/photojournal/grails-bouguer-gravity-moon-map/) | candidate | Lunar Bouguer gravity is distinct from crustal thickness and height; original grid/coefficients and reference-density assumptions are required. |
| [PIA21050](https://science.nasa.gov/photojournal/grail-gravity-map-of-orientale-basin/) | candidate | GRAIL Orientale regional surface gravity is distinct from Bouguer anomaly; original field definition, degree and units must remain separate. |


## P47

### Moon and Mercury: observed polar illumination

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Current temperature and elevation views do not themselves show an observed illumination-frequency survey.

Prepare published polar illumination fractions with explicit observation windows and polar footprints.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md), [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

#### Evidence

The lunar page describes a six-month WAC stack over 88°S–90°S. The Mercury page is a separate polar-illumination source lead and needs its own method check.

#### Work

Locate original fractional rasters, observation counts and coverage, keeping observed time sampling separate from a long-term lighting simulation.

#### Limits and prior decisions

Six months of images do not prove permanent darkness or annual sunlight percentage. This is a prepared data view, not changes to runtime sunlight or shadows.

#### Acceptance

Native fractions and denominator, exact time window, polar projection, missing cells and independent source-map comparison.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/south-pole-illumination-map/)
- [NASA source page](https://science.nasa.gov/photojournal/illumination-map-of-mercurys-south-pole/)
- [NASA source page](https://science.nasa.gov/photojournal/orbital-mosaic-of-mercurys-north-pole/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA13720](https://science.nasa.gov/photojournal/south-pole-illumination-map/) | candidate | Lunar 88–90°S illumination stack is a finite observation-window fraction; preserve denominator and interval rather than assert eternal sunlight/shadow. |
| [PIA15527](https://science.nasa.gov/photojournal/illumination-map-of-mercurys-south-pole/) | candidate | Mercury south-polar illumination derives from 89 WAC images; preserve their time sampling and test shadow classification against native records. |
| [PIA16950](https://science.nasa.gov/photojournal/orbital-mosaic-of-mercurys-north-pole/) | candidate | Mercury polar imaging could support illumination-source validation; a multi-image north-pole mosaic is not itself a measured sunlight-frequency raster. |


## P48

### Earth: measured soil moisture and freeze/thaw

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Earth has imagery, terrain, night lights and a temperature-anomaly view. SMAP moisture and freeze/thaw are distinct proposed quantities.

Add one compact SMAP soil-moisture observation set; include freeze/thaw only from its own valid product and categorical definition.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The supplied pages include commissioning-era radiometer/radar products and later surface-moisture maps. They have different spatial resolutions and gaps.

#### Work

Select a versioned numeric product, retain acquisition interval, quality flags, land/ice mask and uncertainty, and prepare a bounded date set offline.

#### Limits and prior decisions

Do not confuse brightness temperature with soil moisture or commissioning maps with uninterrupted operational coverage. Original-data access has not been verified by this Photojournal audit.

#### Acceptance

Official-unit samples, invalid-value handling, measured footprint, date averaging and incremental source value over existing Earth layers.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/nasa-smap-images-show-progression-of-spring-thaw-in-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radiometer-map/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radar-map/)
- [NASA source page](https://science.nasa.gov/photojournal/high-resolution-global-soil-moisture-map/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-us-soil-moisture-map/)
- [NASA source page](https://science.nasa.gov/photojournal/smap-global-map-of-surface-soil-moisture-aug-25-27-2015/)
- [NASA source page](https://science.nasa.gov/photojournal/new-nasa-maps-show-flooding-changes-in-aftermath-of-hurricane-harvey/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA11399](https://science.nasa.gov/photojournal/nasa-smap-images-show-progression-of-spring-thaw-in-northern-hemisphere/) | candidate | SMAP freeze/thaw sequence is a categorical radar retrieval, distinct from soil-moisture concentration; retain quality and observation dates. |
| [PIA18057](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radiometer-map/) | candidate | First SMAP radiometer map is an instrument commissioning observation; establish whether it is brightness temperature or a retrieved moisture product before labeling. |
| [PIA18058](https://science.nasa.gov/photojournal/nasa-soil-moisture-mission-produces-first-global-radar-map/) | candidate | SMAP radar commissioning map is distinct from radiometer brightness and combined moisture retrievals; preserve quantity and instrument-specific quality flags. |
| [PIA19337](https://science.nasa.gov/photojournal/high-resolution-global-soil-moisture-map/) | candidate | Combined SMAP radar/radiometer moisture covers May 4–11 2015 with commissioning gaps; preserve interval, resolution and validity. |
| [PIA19338](https://science.nasa.gov/photojournal/southern-us-soil-moisture-map/) | candidate | Southern-US SMAP comparison contrasts radiometer-only and combined retrievals on April 27 2015; processing versions are not independent soil states. |
| [PIA19877](https://science.nasa.gov/photojournal/smap-global-map-of-surface-soil-moisture-aug-25-27-2015/) | candidate | SMAP radiometer-only three-day August 2015 moisture product is distinct from early combined radar retrievals; preserve frozen/snow flags and averaging period. |
| [PIA21951](https://science.nasa.gov/photojournal/new-nasa-maps-show-flooding-changes-in-aftermath-of-hurricane-harvey/) | candidate | SMAP Harvey sequence measures fractional surface-water cover over coarse footprints, distinct from SAR binary-looking flood proxies and soil moisture. |


## P49

### Earth: ocean salinity and sea-level anomalies

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The selected Earth ocean views include bathymetry and a temperature anomaly, not these two quantities.

Prepare versioned salinity and sea-surface-height anomalies as separate measured quantities under existing dataset/date controls.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

Aquarius and Jason Photojournal pages identify the source instruments and dated examples. Those rendered images are leads to the original gridded measurements.

#### Work

Retrieve documented numeric products with land/coast masks, averaging windows, uncertainty and reference climatology. Select a small matched set of intervals rather than an unbounded time archive.

#### Limits and prior decisions

Salinity, sea level and ocean temperature cannot share units or a common quantitative scale. Sea-level anomaly is relative to a stated reference, not ocean depth.

#### Acceptance

Native values, units, anomaly reference, coastal masking, temporal coverage and separate color scales.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/first-jason-1-and-ostmjason-2-tandem-global-view/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-salt-of-the-earth-aquarius-reveals-first-map/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aquarius-maps-ocean-salinity-structure/)
- [NASA source page](https://science.nasa.gov/photojournal/jason-3-produces-first-global-map-of-sea-surface-height/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA11859](https://science.nasa.gov/photojournal/first-jason-1-and-ostmjason-2-tandem-global-view/) | candidate | Jason-1/Jason-2 interleaved sea-surface topography has a defined repeat/averaging cycle; recover numeric heights and reference surface. |
| [PIA14786](https://science.nasa.gov/photojournal/nasas-salt-of-the-earth-aquarius-reveals-first-map/) | candidate | First Aquarius salinity map is a real ocean retrieval lead; commissioning/version and averaging interval must be checked before selecting a representative product. |
| [PIA15799](https://science.nasa.gov/photojournal/nasas-aquarius-maps-ocean-salinity-structure/) | candidate | Aquarius tropical salinity structure is a dated regional measurement analysis; native salinity grids and reference conditions are the input, not the plotted wave annotations. |
| [PIA20532](https://science.nasa.gov/photojournal/jason-3-produces-first-global-map-of-sea-surface-height/) | candidate | Jason-3 sea-surface-height anomaly is relative to a reference, not ocean depth; native grid and calibration continuity with Jason-2 are required. |


## P50

### Earth: monthly gravity changes from GRACE

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The existing Earth package does not establish this monthly gravity-anomaly series.

A compact source-qualified set of GRACE gravity changes, or an explicitly interpreted mass-equivalent product if that is the selected release.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

PIA22448 describes near-monthly gravity-anomaly maps from April 2002 to June 2017; it does not provide the full numeric interpretation contract.

#### Work

Identify a versioned official solution, its reference interval, corrections, masks and uncertainties. Prepare a declared sequence through the existing date selector.

#### Limits and prior decisions

Do not interchange gravity anomaly and water-equivalent thickness. Spatial smoothing and missing months matter; the press animation alone is insufficient.

#### Acceptance

Independent monthly samples, reference mean, leakage/smoothing treatment, unit labels and no interpolation disguised as observations.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/monthly-grace-gravity-anomaly-maps/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA22448](https://science.nasa.gov/photojournal/monthly-grace-gravity-anomaly-maps/) | candidate | GRACE monthly gravity anomalies from 2002–2017 are a substantial time-series lead; original grids, corrections and units must replace the animation frames. |


## P51

### Earth: thermal emissivity and mapped surface minerals

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Earth's photographic basemap does not measure infrared emission efficiency or EMIT mineral signatures.

Add separate ASTER emissivity and EMIT mineral data groups if their native coverage and quality masks support useful prepared views.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

ASTER provides an emissivity lead; EMIT's map concerns arid regions and named mineral signatures, not an everywhere-complete global composition map.

#### Work

Acquire versioned bands and numeric mineral products, preserve wavelength, quality and footprint, and explain unfamiliar mineral names in ordinary language.

#### Limits and prior decisions

Emissivity is not temperature. Mineral presence, spectral fit and abundance are different products. Do not treat unsurveyed areas as zero or use the press RGB mixture as numeric concentrations.

#### Acceptance

Band units and scaling, independent samples, land/validity masks, declared effective resolution and a measured-coverage report for each product family.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/nasa-spacecraft-maps-earths-global-emissivity/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-emit-collects-mineral-maps-spectral-fingerprints-from-nevada/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-emit-mission-produces-maps-of-arid-region-surface-minerals/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA18833](https://science.nasa.gov/photojournal/nasa-spacecraft-maps-earths-global-emissivity/) | candidate | ASTER emissivity is a measured/model-retrieved radiation-efficiency quantity distinct from temperature; use original bands, quality and units. |
| [PIA25428](https://science.nasa.gov/photojournal/nasas-emit-collects-mineral-maps-spectral-fingerprints-from-nevada/) | candidate | EMIT Nevada spectra are compared with 2018 AVIRIS for validation; preserve different instrument epochs and retrieve original mineral/reflectance products. |
| [PIA26116](https://science.nasa.gov/photojournal/nasas-emit-mission-produces-maps-of-arid-region-surface-minerals/) | candidate | EMIT arid-region mineral map is incomplete by design and distinguishes mineral signatures; retain valid surveyed footprint and numeric products, not RGB abundance inference. |


## P52

### Earth: atmospheric gases and microwave observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Existing Earth imagery and clouds do not establish measured CO₂, CO, dust, methane-plume or microwave fields.

Qualify a small set of atmosphere measurements that can be described faithfully on an existing map or chart, without adding atmospheric rendering.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The supplied pages include mid-tropospheric AIRS gases, regional methane plumes and 34 GHz COWVR emissions. They sample different altitudes and quantities.

#### Work

Choose original numeric products and record pressure/altitude sensitivity, time interval, retrieval quality and footprint. Keep local plume detections separate from global fields.

#### Limits and prior decisions

These are not surface chemistry maps. Microwave brightness is not a direct wind or humidity measurement without the retrieval. Emission-rate estimates need their wind/model uncertainty.

#### Acceptance

Source quantity and vertical sensitivity, native samples, masks and epoch. Stop if the existing content contract cannot clearly preserve these distinctions.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/cloud-height-maps-for-hurricanes-frances-and-ivan/)
- [NASA source page](https://science.nasa.gov/photojournal/airs-global-map-of-carbon-dioxide-from-space/)
- [NASA source page](https://science.nasa.gov/photojournal/airs-map-of-carbon-monoxide-draped-on-globe-time-series-from-812005-to-9302005/)
- [NASA source page](https://science.nasa.gov/photojournal/airs-detection-of-dust-global-map-for-july-2003/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-quikscat-maps-southern-californias-destructive-santa-ana-winds/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-airs-maps-carbon-monoxide-from-brazil-fires-2/)
- [NASA source page](https://science.nasa.gov/photojournal/cowvrs-new-map/)
- [NASA source page](https://science.nasa.gov/photojournal/emit-identifying-methane-plumes-around-the-globe/)

#### Individual Photojournal entries

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


## P53

### Earth: measured ice motion

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Earth has static terrain and imagery. Measured ice flow and regional cryosphere products require separate source qualification.

Prepare a measured Antarctic ice-speed field, with separate qualification of Iceland ice motion and source snow-water products.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The Antarctic page identifies a radar-interferometry velocity map with 300 m sampling. Other supplied pages concern local ice speed, snow and coastal bathymetry.

#### Work

Retrieve original grids, observation dates and uncertainties. Use a scalar speed view if supported; retain direction in the data without inventing motion arrows or animation.

#### Limits and prior decisions

Sampling is not accuracy and an old survey is not current ice motion. Snow water content is a different quantity from speed. Coastal Greenland bathymetry belongs in proposal 66.

#### Acceptance

Velocity components and units, speed calculation, polar projection, missing areas, epoch and comparison with the source map.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-research-leads-to-first-complete-map-of-antarctic-ice-flows/)
- [NASA source page](https://science.nasa.gov/photojournal/spatial-distribution-of-tuolumne-river-basin-mapped-by-airborne-snow-observatory/)
- [NASA source page](https://science.nasa.gov/photojournal/nasa-radar-maps-the-winter-pace-of-icelands-glaciers/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02970](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/) | candidate | Radarsat Arctic sea-ice mosaic adds a broad radar/cryosphere lead; distinguish dated backscatter imagery from inferred motion or thickness. |
| [PIA14556](https://science.nasa.gov/photojournal/nasa-research-leads-to-first-complete-map-of-antarctic-ice-flows/) | candidate | Antarctic radar-interferometric flow gives velocity vectors with a stated 300 m sampling; native grid, epoch and uncertainty are required. |
| [PIA17775](https://science.nasa.gov/photojournal/spatial-distribution-of-tuolumne-river-basin-mapped-by-airborne-snow-observatory/) | candidate | Tuolumne snow-water equivalent combines measured snow depth with density assumptions; preserve that inference and the April–June 2013 intervals. |
| [PIA17924](https://science.nasa.gov/photojournal/nasa-radar-maps-the-winter-pace-of-icelands-glaciers/) | candidate | Iceland winter radar ice-motion campaign is a regional velocity lead; identify actual measured products and acquisition interval, not just the campaign announcement. |
| [PIA20476](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/) | candidate | OMG Greenland coastal bathymetry could improve a bounded region, conditional on comparison with current GEBCO and verified vertical datum/coverage. |


## P54

### Earth: qualify regional change and hazard maps

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The Earth package has global views; the supplied ARIA, ASTER, ECOSTRESS and radar examples are mostly local events.

A bounded intake PR identifying a small set of scientifically clear regional measurements, such as ground displacement, flood extent or surface temperature, that fit the existing map contract.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The Photojournal list contains many earthquake, flood, fire and deformation maps. They are separate products with different observation windows and uncertainty.

#### Work

Group by physical quantity, recover original georeferenced data and quality flags, and choose one representative source-qualified event per supported quantity before expanding.

#### Limits and prior decisions

A damage-proxy signal is not a building-damage survey. Thermal burn-risk examples are not a forecast. Do not revive an unrelated local-imagery or surface-photographs UI.

#### Acceptance

Before/after time alignment, units, projection, uncertainty, valid footprint and whether current zoom/detail can display the result usefully. Retain low-value cases in the ledger instead of adding clutter.


#### Sources

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

#### Individual Photojournal entries

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


## P55

### Europa: measure the value of controlled regional mosaics

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Europa already uses a broad set of individual CLEAR images, plus global and other mission imagery.

Replace or extend existing photography only where the controlled mosaic release improves registration, measured coverage or useful close-up detail.

Content owners: [europa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/europa/README.md)

#### Evidence

The USGS audit identifies a 92-mosaic archive overlapping the current 332 individual CLEAR images. The press close-ups are supporting observation leads, not 92 new datasets.

#### Work

Cross-match observation IDs and map versions, measure geometric and coverage differences, and select replacements only after a matched preparation comparison.

#### Limits and prior decisions

Keep geometry and current photographic controls. No separate photo gallery, global gap filling or claim that a newer wrapper improves resolution.

#### Acceptance

Image-source deduplication, common-landmark residuals, measured area and delivered bytes at the same camera and texture budget.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/photogrammetrically_controlled_galileo_image_mosaics_of_europa)
- [NASA source page](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-europas-ridges-craters-2/)
- [NASA source page](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-and-similar-scales-on-earth/)
- [NASA source page](https://science.nasa.gov/photojournal/europas-leading-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/regional-mosaic-of-chaos-and-gray-band-on-europa/)
- [NASA source page](https://science.nasa.gov/photojournal/high-resolution-mosaic-of-ridges-plains-and-mountains-on-europa/)
- [NASA source page](https://science.nasa.gov/photojournal/europas-jupiter-facing-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/highest-resolution-europa-image-and-mosaic-from-galileo/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00587](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-2/) | candidate | Europa trailing-hemisphere close-up has a defined 100 by 140 km footprint; cross-match source IDs with the existing CLEAR-image preparation. |
| [PIA00589](https://science.nasa.gov/photojournal/mosaic-of-europas-ridges-craters-2/) | candidate | February 1997 Europa mosaic offers 20 m pixels over a small ridge region; qualify registration and incremental detail without claiming global resolution. |
| [PIA00596](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-and-similar-scales-on-earth/) | duplicate-family | Europa/Earth comparison plate reuses the PIA00587 regional observation; the San Francisco panel is an educational comparison, not added Europa data. |
| [PIA00874](https://science.nasa.gov/photojournal/europas-leading-hemisphere/) | candidate | Galileo Europa leading hemisphere includes Tyre and long lineaments; compare original image IDs against existing coverage before selecting another mosaic. |
| [PIA01125](https://science.nasa.gov/photojournal/regional-mosaic-of-chaos-and-gray-band-on-europa/) | candidate | Europa E11 chaos/gray-band regional mosaic may improve local photography; compare registered originals with current CLEAR images. |
| [PIA01126](https://science.nasa.gov/photojournal/high-resolution-mosaic-of-ridges-plains-and-mountains-on-europa/) | candidate | Europa E11 high-resolution ridges mosaic has useful local structural detail; qualification needs exact original extent and image overlap. |
| [PIA02528](https://science.nasa.gov/photojournal/europas-jupiter-facing-hemisphere-2/) | candidate | Europa twelve-frame November 1999 mosaic has approximately 1 km pixels plus lower-resolution context; establish improvement over current CLEAR coverage. |
| [PIA21431](https://science.nasa.gov/photojournal/highest-resolution-europa-image-and-mosaic-from-galileo/) | candidate | Europa mosaic includes a 6 m/pixel footprint and seven coarser frames; regional detail is a concrete candidate with explicit source support and registration. |

USGS catalogue IDs: `photogrammetrically_controlled_galileo_image_mosaics_of_europa`.


## P56

### Pluto, Ceres and Vesta: qualify historical telescope maps

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Spacecraft maps already provide better spatial detail. Historical telescope observations would only add a supported epoch or wavelength comparison.

Determine whether one historical observing set supports a useful dated map or whole-object observation within current controls.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/pluto/README.md), [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md), [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

#### Evidence

Photojournal contains Hubble maps of Pluto and Vesta; PDS4 contains historical HST Ceres products. Different inversions and resolutions prevent a direct pixel-by-pixel change claim.

#### Work

Recover original products and reconstruction assumptions, compare on common support/resolution, and preserve observation dates separately from publication dates.

#### Limits and prior decisions

Do not sharpen old telescope maps with later spacecraft detail or infer surface change from different image-processing methods. No automatic replacement of current global maps.

#### Acceptance

Original product and method availability, effective resolution, geometry and calibration consistency. Keep an evidence-only result if a faithful comparison cannot be made.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/hst.ast-ceres.images-albedo-shape_V1_0/bundle_hst.ast-ceres.images-albedo-shape.xml)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-plutos-surface/)
- [NASA source page](https://science.nasa.gov/photojournal/pj-asteroid-or-mini-planet-hubble-maps-the-ancient-surface-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/new-hubble-maps-of-pluto-show-surface-changes/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00826](https://science.nasa.gov/photojournal/map-of-plutos-surface/) | candidate | Hubble FOC rotational reconstruction could add an early Pluto epoch, conditional on recovery of the inversion and effective resolution. |
| [PIA17467](https://science.nasa.gov/photojournal/pj-asteroid-or-mini-planet-hubble-maps-the-ancient-surface-of-vesta/) | candidate | Hubble Vesta 24-image rotation sequence resolves roughly 80 km features; historical observation value is conditional on native calibration and effective-resolution disclosure. |
| [PIA18179](https://science.nasa.gov/photojournal/new-hubble-maps-of-pluto-show-surface-changes/) | candidate | Hubble 2002–2003 Pluto reconstruction is a historical epoch lead with multiple display longitudes; original inversion and support are required for any change comparison. |

PDS bundle IDs: `urn:nasa:pds:hst.ast-ceres.images-albedo-shape`.


## P57

### Ganymede: controlled close-up photography

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Global monochrome, enhanced color, geology and oxygen data already exist. New photographs must improve measured coverage, registration or useful detail.

Qualify a small set of native Galileo SSI regional mosaics, starting with Uruk Sulcus and Galileo Regio.

Content owners: [ganymede](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ganymede/README.md)

#### Evidence

The individual review found roughly 74 m and 80 m sampling in close-up products, plus mixed-resolution color composites. These are regional observations.

#### Work

Recover original calibrated frames and control geometry; cross-match frame IDs against the current photography; compare native and prepared detail at identical viewing conditions.

#### Limits and prior decisions

The press insets and color composites are not georeferenced scalar products. Do not manufacture high-resolution color by treating a coarse color overlay as fine measured detail.

#### Acceptance

Landmark residuals, source frame identities, valid footprint, actual resolution and delivered bytes. Add only a demonstrated improvement on the fixed body.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/ganymede-galileo-mosaic-overlayed-on-voyager-data-in-uruk-sulcus-region/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymedes-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/galileo-regio-mosaic-galileo-over-voyager-data/)
- [NASA source page](https://science.nasa.gov/photojournal/uruk-sulcus-mosaic-galileo-over-voyager-data/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymede-uruk-sulcus-high-resolution-mosaic-shown-in-context/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymede-galileo-regio-high-resolution-mosaic-shown-in-context/)
- [NASA source page](https://science.nasa.gov/photojournal/completing-a-global-map-of-ganymede/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymedes-trailing-hemisphere/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00281](https://science.nasa.gov/photojournal/ganymede-galileo-mosaic-overlayed-on-voyager-data-in-uruk-sulcus-region/) | candidate | Ganymede Uruk Sulcus offers approximately 74 m local Galileo detail over a 1.3 km Voyager context; isolate original registered observations before integration. |
| [PIA00356](https://science.nasa.gov/photojournal/ganymedes-northern-hemisphere/) | candidate | Voyager northern Ganymede color is a potential regional band comparison, but original frames must improve coverage or color evidence over the current global map. |
| [PIA00492](https://science.nasa.gov/photojournal/galileo-regio-mosaic-galileo-over-voyager-data/) | candidate | Galileo Regio local mosaic resolves roughly 80 m features against a Voyager context; qualify its own footprint and separate the background image. |
| [PIA00493](https://science.nasa.gov/photojournal/uruk-sulcus-mosaic-galileo-over-voyager-data/) | candidate | Uruk Sulcus 120 by 110 km mosaic overlaps PIA00281's source family; check observation IDs to avoid duplicate regional datasets. |
| [PIA00579](https://science.nasa.gov/photojournal/ganymede-uruk-sulcus-high-resolution-mosaic-shown-in-context/) | duplicate-family | Uruk Sulcus context plate reuses the high-resolution Galileo mosaic with Voyager/full-disc insets; keep one original observation set. |
| [PIA00580](https://science.nasa.gov/photojournal/ganymede-galileo-regio-high-resolution-mosaic-shown-in-context/) | duplicate-family | Galileo Regio context image belongs with PIA00492's source mosaic; contextual packaging must not inflate regional coverage. |
| [PIA01606](https://science.nasa.gov/photojournal/completing-a-global-map-of-ganymede/) | candidate | Galileo image deliberately fills a Voyager imaging gap; compare that footprint against the current combined Ganymede source before deciding it remains new. |
| [PIA01666](https://science.nasa.gov/photojournal/ganymedes-trailing-hemisphere/) | candidate | Enhanced trailing-hemisphere Ganymede color may support a regional band comparison; original calibration must distinguish polar frost signatures from cosmetic color. |


## P58

### Callisto: controlled close-up photography

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Callisto already has global photography, Galileo color and infrared observations.

Qualify additional SSI coverage around Valhalla, Asgard and the southern hemisphere where it adds useful observed detail.

Content owners: [callisto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/callisto/README.md)

#### Evidence

The reviewed pages distinguish fine pixel sampling from coarser resolved features; PIA00561's sampling does not mean every 46 m feature is resolved. Other products combine coarse color with finer monochrome.

#### Work

Obtain the native images and observation geometry, measure overlap with selected inputs, and prepare only controlled regional footprints.

#### Limits and prior decisions

No global gap filling or claim that every press crop is a separate dataset. Infrared measurements belong in proposal 12.

#### Acceptance

Independent image registration, resolution comparison, illumination differences, masks and byte budget.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/callisto-crater-chain-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/callisto-scarp-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/asgard-scarp-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/large-impact-on-callistos-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/)
- [NASA source page](https://science.nasa.gov/photojournal/the-asgard-hemisphere-of-callisto/)
- [NASA source page](https://science.nasa.gov/photojournal/large-craters-in-callistos-southern-hemisphere/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00549](https://science.nasa.gov/photojournal/callisto-crater-chain-mosaic/) | candidate | Callisto Valhalla crater-chain mosaic covers about 45 km with resolvable 160 m features; original registered images may add useful local detail. |
| [PIA00561](https://science.nasa.gov/photojournal/callisto-scarp-mosaic/) | candidate | Valhalla scarp mosaic has 46 m pixels but roughly 155 m resolvable details; preserve that distinction in a regional photography comparison. |
| [PIA00562](https://science.nasa.gov/photojournal/asgard-scarp-mosaic/) | candidate | Asgard composite mixes lower-resolution color with high-resolution photography; recover channels and report color support separately from visible detail. |
| [PIA01077](https://science.nasa.gov/photojournal/large-impact-on-callistos-southern-hemisphere/) | candidate | Callisto southern impact mosaic gives regional Galileo detail around a 200 km crater; source footprints may complement current imaging. |
| [PIA01079](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/) | duplicate-family | NIMS/SSI composite combines the same spectral and photographic observations shown separately; assess each instrument at its own spatial support. |
| [PIA01100](https://science.nasa.gov/photojournal/the-asgard-hemisphere-of-callisto/) | candidate | Asgard false-color SSI hemisphere could add regional calibrated bands; compare coverage with the already selected Galileo color source. |
| [PIA01219](https://science.nasa.gov/photojournal/large-craters-in-callistos-southern-hemisphere/) | candidate | Galileo southern Callisto imaging covers terrain not seen by Voyager; compare against the present combined map to establish remaining gain. |


## P59

### Neptune: a dated Voyager cloud observation

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Neptune uses OPAL maps and a qualified color reference. Its ledger already defers older OPAL maps with a different photometric coefficient.

Determine whether a separate Voyager epoch adds a faithful historical cloud observation through the current dataset controls.

Content owners: [neptune](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/neptune/README.md)

#### Evidence

PIA00050 shows a partial southern-hemisphere observation, not a complete timeless surface map.

#### Work

Recover original Voyager filters, timing and camera geometry; determine the required prepared photometric treatment and measured coverage.

#### Limits and prior decisions

No renderer change, no insertion into modern OPAL gaps and no inference of cloud evolution from unmatched processing. A dated dataset is conditional on current-contract compatibility.

#### Acceptance

Source identity, longitude convention, calibrated band combination, footprint and the existing photometry ledger's constraints.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/neptunes-southern-hemisphere/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00050](https://science.nasa.gov/photojournal/neptunes-southern-hemisphere/) | candidate | Voyager Neptune southern cloud image offers a dated atmospheric observation, not a global replacement; original pointing and a coherent observing set are required. |


## P60

### Earth and Moon: historical Galileo spectral observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Modern global maps already supply better basemap detail. Galileo offers a different observing epoch or wavelength, not an automatic replacement.

Qualify a compact set of dated Galileo Earth/Moon bands where the scientific difference is useful.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md), [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The supplied entries include an Antarctic limb mosaic, green and near-infrared lunar imagery, Andes observations and a 24-hour Earth mosaic. Their geometry and time support differ.

#### Work

Group exposures by actual encounter and band; retrieve native calibrated values, poses and footprints; preserve observation intervals.

#### Limits and prior decisions

A 24-hour mosaic is not simultaneous Earth illumination. Never wrap an unregistered camera image onto the whole globe or introduce a photograph gallery.

#### Acceptance

Registration, band response, dates, view geometry and common support for any comparison.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/earth-antarctica-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-western-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-18-image-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-false-color-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-north-pole-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-false-color-mosaic-2/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-false-color-mosaic-3/)
- [NASA source page](https://science.nasa.gov/photojournal/earth-false-color-mosaic-of-the-andes/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-earth-in-the-near-infrared/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-north-polar-mosaic-color/)
- [NASA source page](https://science.nasa.gov/photojournal/south-polar-projection-of-earth/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00116](https://science.nasa.gov/photojournal/earth-antarctica-mosaic/) | candidate | Galileo Antarctica limb mosaic is a dated three-filter Earth observation; useful only as a historical observation with its original camera geometry. |
| [PIA00120](https://science.nasa.gov/photojournal/moon-western-hemisphere/) | candidate | Galileo green-filter lunar hemisphere is a historical wavelength/epoch observation; not a resolution upgrade over LROC. |
| [PIA00128](https://science.nasa.gov/photojournal/moon-18-image-mosaic/) | candidate | Eighteen-image December 1992 lunar mosaic has enhanced dark-region brightness; retain original processing and treat as an observing set, not calibrated albedo. |
| [PIA00129](https://science.nasa.gov/photojournal/moon-false-color-mosaic/) | candidate | Galileo lunar false-color composite shows spectral contrasts; could support a historical band comparison, but cannot supply numeric titanium abundance. |
| [PIA00130](https://science.nasa.gov/photojournal/moon-north-pole-mosaic/) | candidate | North-polar Galileo mosaic has a shadowed pole and partial coverage; preserve that footprint and deduplicate its 18 input frames. |
| [PIA00131](https://science.nasa.gov/photojournal/moon-false-color-mosaic-2/) | candidate | Fifty-three-frame lunar color mosaic is a separate product variant requiring observation-ID overlap checks with the other Galileo lunar mosaics. |
| [PIA00132](https://science.nasa.gov/photojournal/moon-false-color-mosaic-3/) | candidate | Fifteen-image lunar false-color composite from December 1992 could supply a dated spectral example; no unique composition grid is provided. |
| [PIA00133](https://science.nasa.gov/photojournal/earth-false-color-mosaic-of-the-andes/) | candidate | Galileo Andes green/near-IR mosaic distinguishes surface colors regionally; needs original bands and geometry and is not a modern global vegetation map. |
| [PIA00226](https://science.nasa.gov/photojournal/global-view-of-earth-in-the-near-infrared/) | candidate | Single December 1990 1 µm Earth image has a distinct band and epoch, but only a visible hemisphere and perspective geometry. |
| [PIA00404](https://science.nasa.gov/photojournal/moon-north-polar-mosaic-color/) | duplicate-family | North-polar lunar presentation reuses Galileo's December 1992 18-frame observing set; compare with PIA00130 before selecting a variant. |
| [PIA00729](https://science.nasa.gov/photojournal/south-polar-projection-of-earth/) | candidate | Earth south-polar composite spans 24 hours and depicts an impossible simultaneous illumination; any historical view must state that mosaic interval. |


## P61

### Venus: qualify regional Magellan radar detail

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Venus already has global radar, height, emissivity, reflectivity and roughness products.

Use finer native radar mosaics only where they improve useful regional detail at the existing asset budget.

Content owners: [venus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/venus/README.md)

#### Evidence

PIA00086 identifies a Lavinia Planitia F-MIDR region; PIA00461 supplies a separate Bahet/Onatah lead.

#### Work

Locate original F-MIDR products, preserve radar geometry and calibration, and run a matched comparison against the selected global radar map.

#### Limits and prior decisions

Radar brightness is not optical color. Pixel sampling is not terrain resolution, and a small regional patch does not solve poor global coverage.

#### Acceptance

Native footprint and calibration, look-direction differences, source/prepared comparison and improvement per byte.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-large-impact-craters/)
- [NASA source page](https://science.nasa.gov/photojournal/venus-mosaic-of-bahet-and-onatah-coronae/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00086](https://science.nasa.gov/photojournal/mosaic-of-large-impact-craters/) | candidate | Magellan F-MIDR resolves a roughly 500 km Lavinia region; compare original radar pixels with current global preparation before adding regional detail. |
| [PIA00461](https://science.nasa.gov/photojournal/venus-mosaic-of-bahet-and-onatah-coronae/) | candidate | Bahet/Onatah Magellan mosaic is a regional 120 m radar lead; compare original F-MIDR coverage and sampling with current Venus assets. |


## P62

### Earth: calibrated radar mosaics and land measurements

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Earth's optical basemap does not show calibrated radar backscatter or radar-derived biomass.

Qualify a broad radar mosaic first, with land-cover or biomass products treated as separate measured or modeled quantities.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The reviewed set includes the JERS-1 equatorial Africa mosaic, Raco land cover and biomass, Arctic RADARSAT and regional oil/lava examples.

#### Work

Obtain calibrated georeferenced bands, incidence-angle information and masks. Distinguish native radar measurements from classifications and retrievals.

#### Limits and prior decisions

Proposal 54 owns individual event comparisons; this proposal owns calibrated radar source handling and a representative broad mosaic. Do not publish a biomass model as raw radar reflectivity.

#### Acceptance

Units, polarization, acquisition interval, incidence correction, independent numeric samples and declared footprint.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/radar-mosaic-of-africa/)
- [NASA source page](https://science.nasa.gov/photojournal/space-radar-image-of-raco-vegetation-map/)
- [NASA source page](https://science.nasa.gov/photojournal/space-radar-image-of-raco-biomass-map/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/)
- [NASA source page](https://science.nasa.gov/photojournal/uavsar-maps-the-gulf-coast-oil-spill/)
- [NASA source page](https://science.nasa.gov/photojournal/airborne-nasa-radar-maps-mauna-loa-lava-changes-in-hawaii/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA01348](https://science.nasa.gov/photojournal/radar-mosaic-of-africa/) | candidate | Nearly 4000 JERS-1 L-band images form an equatorial Africa radar mosaic; a broad new Earth wavelength lead beyond the photographic basemap. |
| [PIA01713](https://science.nasa.gov/photojournal/space-radar-image-of-raco-vegetation-map/) | candidate | Raco SIR-C/X-SAR vegetation classification is a regional categorical product, distinct from radar backscatter; recover its original class map and validation. |
| [PIA01714](https://science.nasa.gov/photojournal/space-radar-image-of-raco-biomass-map/) | candidate | Raco biomass is a radar-based inference, not the vegetation-class map itself; original model, units and uncertainties are needed. |
| [PIA02970](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/) | candidate | Radarsat Arctic sea-ice mosaic adds a broad radar/cryosphere lead; distinguish dated backscatter imagery from inferred motion or thickness. |
| [PIA13233](https://science.nasa.gov/photojournal/uavsar-maps-the-gulf-coast-oil-spill/) | candidate | June 2010 UAVSAR oil-spill imagery is calibrated radar-event data in principle; original backscatter and interpretation are required before mapping oil extent. |
| [PIA25526](https://science.nasa.gov/photojournal/airborne-nasa-radar-maps-mauna-loa-lava-changes-in-hawaii/) | candidate | Mauna Loa airborne radar measures eruption-related change; identify whether the selected product is height, backscatter or displacement and retain its native units. |


## P63

### Eros: qualify low-altitude MSI close-ups

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Seven MSI bands and global photography are already selected. The repository also has preparation evidence for registered native MSI images.

Add a bounded regional improvement from native close-flyby images if it survives a same-budget comparison.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

#### Evidence

The Photojournal sequence includes low-altitude observations and mosaics of boulders, craters and smooth deposits. A rendered drape is not an original MSI frame.

#### Work

Cross-match source image IDs, retrieve calibrated frames and qualified backplanes, then measure new detail and support on the existing shape.

#### Limits and prior decisions

Do not re-add the seven global bands. Pond coordinates belong in proposal 07; speculative boulder-size measurements from a press image are excluded.

#### Acceptance

Existing camera-oracle compatibility, independent landmarks, source sampling, valid mask and prepared byte cost.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near.msi/near.msi_bundle.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/nearmsi.shapebackplane/bundle_nearmsi.shapebackplane.xml)
- [NASA source page](https://science.nasa.gov/photojournal/nears-first-whole-eros-mosaic-from-orbit/)
- [NASA source page](https://science.nasa.gov/photojournal/eros-image-mosaic-looking-north/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/southwest-of-the-big-crater-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/the-southern-saddle-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/looking-along-the-southern-hemisphere-of-eros/)
- [NASA source page](https://science.nasa.gov/photojournal/eros-closest-approach-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/color-mapping-the-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/a-southern-hemisphere-overview/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02467](https://science.nasa.gov/photojournal/nears-first-whole-eros-mosaic-from-orbit/) | candidate | First orbital Eros mosaic is a dated four-frame polar observation; compare source footprints against selected global MSI maps. |
| [PIA02472](https://science.nasa.gov/photojournal/eros-image-mosaic-looking-north/) | candidate | Eros crescent mosaic has roughly 35 m resolvable features and partial illumination; native frames may add a useful regional view after overlap checks. |
| [PIA02923](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere/) | candidate | Eros polar display drapes imagery on a computer shape; original source frames or registered mosaic are required, not reverse projection of the press render. |
| [PIA02924](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere-2/) | candidate | June 2000 low-sun Eros view emphasizes small relief; useful regional imaging candidate with illumination retained, not albedo inferred from shadows. |
| [PIA02933](https://science.nasa.gov/photojournal/southwest-of-the-big-crater-mosaic/) | candidate | Eight-image Eros crater-area mosaic from 50 km altitude may add regional detail; compare exact source pixels with the selected MSI base. |
| [PIA02934](https://science.nasa.gov/photojournal/the-southern-saddle-mosaic/) | candidate | Seven-image southern-saddle mosaic targets a specific regional structure; qualify footprint and registration without creating a separate photo panel. |
| [PIA03105](https://science.nasa.gov/photojournal/looking-along-the-southern-hemisphere-of-eros/) | candidate | September 2000 Eros stereo sequence gives southern context; potential regional registration evidence, not a standalone new global texture. |
| [PIA03119](https://science.nasa.gov/photojournal/eros-closest-approach-mosaic/) | candidate | Low-altitude Eros closest-approach mosaic has potentially useful boulder/regolith detail; native camera/shape geometry and tiny footprint must be qualified. |
| [PIA03120](https://science.nasa.gov/photojournal/color-mapping-the-southern-hemisphere/) | candidate | Southern crater observation is part of a color sequence; compare original channels and common coverage with the shipped seven-band MSI maps. |
| [PIA03137](https://science.nasa.gov/photojournal/a-southern-hemisphere-overview/) | candidate | December 2000 southern Eros mosaic is south-up with terminator near the equator; preserve orientation and illuminated footprint in any regional addition. |

PDS bundle IDs: `urn:nasa:pds:near.msi`, `urn:nasa:pds:nearmsi.shapebackplane`.


## P64

### Jupiter rings: qualify a measured radial profile

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

A perspective ring photograph does not establish a radius-indexed measurement suitable for the current prepared ring contract.

Determine whether Galileo observations support a calibrated radial brightness profile usable by the existing ring preparation.

Content owners: [jupiter](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/jupiter/README.md)

#### Evidence

PIA03001 identifies a backlit Galileo ring mosaic and its observing geometry.

#### Work

Recover the original images and geometry, distinguish forward-scattering brightness from optical depth, and assess the current ring asset contract before deriving a profile offline.

#### Limits and prior decisions

No renderer or ring-topology changes. A photograph alone cannot establish a three-dimensional dust distribution or opacity law.

#### Acceptance

Radius mapping, scattering angle, background subtraction, uncertainty and current-contract feasibility; otherwise record a bounded negative result.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/jovian-ring-system-mosaic/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA03001](https://science.nasa.gov/photojournal/jovian-ring-system-mosaic/) | candidate | Galileo Jupiter ring mosaic measures strongly geometry-dependent scattered light; only a qualified radial/profile outcome fits the unchanged renderer. |


## P65

### Mercury: historical and additional spectral observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Native global BDR, LOI, enhanced color, elevation and a MASCS spectrum are already selected.

Qualify a distinct Mariner 10 epoch or measured MDIS filter set beyond the existing enhanced-color view.

Content owners: [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

#### Evidence

The reviewed entries include Mariner 10 maps and a MESSENGER sequence of five scenes in eleven filters. Press RGB maps do not retain all those measurements.

#### Work

Identify original filters, calibration, epochs and registered footprints; compare their actual values and coverage with current inputs.

#### Limits and prior decisions

No duplicate row for a press rendering of the shipped global map. Keep measured bands distinct from an enhanced-color composite and from elemental products in proposal 30.

#### Acceptance

Band centers, scale, geometry, common footprint and an explicit statement of what the addition teaches.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/outgoing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/incoming-hemisphere-enhanced-color/)
- [NASA source page](https://science.nasa.gov/photojournal/mercurys-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/five-of-five-the-last-scene-in-a-high-resolution-color-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/the-new-three-color-mosaic/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02418](https://science.nasa.gov/photojournal/outgoing-hemisphere/) | candidate | Mariner 10 outgoing Mercury hemisphere provides a 1974 historical observation, though current MESSENGER maps are the spatial baseline. |
| [PIA02440](https://science.nasa.gov/photojournal/incoming-hemisphere-enhanced-color/) | candidate | Recalibrated Mariner 10 enhanced color could add a distinct spectral comparison; native channels and processing must replace mineral claims inferred from RGB. |
| [PIA03101](https://science.nasa.gov/photojournal/mercurys-southern-hemisphere/) | candidate | Mariner southern Mercury photomosaic is a historical imaging variant; compare native inputs with other Mariner mosaics and current MESSENGER coverage. |
| [PIA11765](https://science.nasa.gov/photojournal/five-of-five-the-last-scene-in-a-high-resolution-color-mosaic/) | candidate | MESSENGER five-scene eleven-filter flyby sequence supplies a specific spectral lead beyond a press RGB map; qualify native channels and common footprint. |
| [PIA18108](https://science.nasa.gov/photojournal/the-new-three-color-mosaic/) | candidate | MESSENGER three-color release may provide native measured channels beyond enhanced-color presentation; compare with current inputs before deciding on additional band choices. |


## P66

### Earth: regional elevation and bathymetry improvements

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Earth already uses GEBCO 2026 for global terrain and bathymetry.

Replace or supplement regional numeric height data only where SRTM, AIRSAR or ocean surveys demonstrably improve it.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The supplied entries include California and Eurasian SRTM, Umnak AIRSAR and OMG coastal Greenland bathymetry.

#### Work

Recover original numeric grids and vertical datums; compare measured detail, gaps and uncertainty against the exact GEBCO samples.

#### Limits and prior decisions

No mesh change, height inferred from shaded relief or extra row for a coarser historical map. Coastal bathymetry is distinct from ice-flow velocity.

#### Acceptance

Independent elevations/depths, vertical datum, shoreline, masks, source resolution and visible improvement within existing zoom and byte budgets.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic-with-insets/)
- [NASA source page](https://science.nasa.gov/photojournal/srtm-data-release-for-eurasia-index-map-and-colored-height/)
- [NASA source page](https://science.nasa.gov/photojournal/shaded-relief-mosaic-of-umnak-island-aleutian-islands-alaska/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA03333](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic/) | candidate | California SRTM colored relief points to native terrain; compare quantitative regional detail with current GEBCO, without importing the shaded RGB as heights. |
| [PIA03347](https://science.nasa.gov/photojournal/shaded-relief-with-color-as-height-california-mosaic-with-insets/) | duplicate-family | California relief with insets repackages the terrain behind PIA03333; the insets do not create an independent elevation dataset. |
| [PIA03398](https://science.nasa.gov/photojournal/srtm-data-release-for-eurasia-index-map-and-colored-height/) | candidate | Eurasia SRTM release index is a route to original elevation tiles, not a height grid itself; assess native regional benefit over current terrain. |
| [PIA03509](https://science.nasa.gov/photojournal/shaded-relief-mosaic-of-umnak-island-aleutian-islands-alaska/) | candidate | Umnak AIRSAR shaded relief leads to a regional elevation product; inspect native accuracy, date and detail relative to GEBCO before selecting. |
| [PIA20476](https://science.nasa.gov/photojournal/nasas-omg-mission-maps-sea-floor-depth-off-greenlands-coast/) | candidate | OMG Greenland coastal bathymetry could improve a bounded region, conditional on comparison with current GEBCO and verified vertical datum/coverage. |


## P67

### Earth: spectral mosaics and vegetation observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Blue Marble photography does not preserve ASTER or AVIRIS spectral bands or measured vegetation stress.

Qualify one useful native spectral observing set, with separately defined vegetation products when their source retrieval is available.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

The reviewed pages identify Anti-Atlas ASTER, North American MISR, Rim Fire AVIRIS, Sierra forest stress and SHIFT flight coverage. The ASTER global browse mosaic was assembled from thumbnails.

#### Work

Verify public product availability, acquire calibrated bands and geometry, retain acquisition dates and quality flags, and compare source support with current imagery.

#### Limits and prior decisions

The SHIFT flight map is an availability lead, not proof the native cube is downloadable. A thumbnail mosaic or added shaded relief is not calibrated surface reflectance.

#### Acceptance

Native access, band wavelengths/units, registration, measured footprint and uncertainty for any derived vegetation quantity.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/anti-atlas-mountains-morocco/)
- [NASA source page](https://science.nasa.gov/photojournal/natural-color-mosaic-of-north-america/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-aviris-map-shows-spectral-signature-of-2013-rim-fire/)
- [NASA source page](https://science.nasa.gov/photojournal/california-drought-effects-on-sierra-trees-mapped-by-nasa/)
- [NASA source page](https://science.nasa.gov/photojournal/aster-global-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/anti-atlas-mtns-morocco/)
- [NASA source page](https://science.nasa.gov/photojournal/shift-campaign-research-plane-flight-area-map/)

#### Individual Photojournal entries

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


## P68

### Saturn moons: controlled ISS regional photography

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

These moons already have global photography. Enceladus VIMS composition work belongs to the other active proposal, not this one.

Qualify useful native ISS close-ups on the existing body geometry, starting with the strongest measurable detail gain.

Content owners: [phoebe](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/phoebe/README.md), [rhea](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/rhea/README.md), [dione](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/dione/README.md), [tethys](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/tethys/README.md), [mimas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mimas/README.md), [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md)

#### Evidence

The individual entries include Phoebe, Rhea, Dione, Tethys and Mimas regions and Enceladus close-flyby mosaics, including a 12.3 m sampling example.

#### Work

For each moon, deduplicate against current source images, obtain controlled poses and calibrated frames, and record an independent go/no-go result before preparing an addition.

#### Limits and prior decisions

Sampling is not uniform resolved detail. Regional imagery must retain its footprint and shadows. No new surface-photo panel or replacement geometry.

#### Acceptance

Per-body current-input comparison, landmark residuals, footprint, effective detail and byte budget. Implement successful bodies separately when their source work is independent.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/phoebe-hi-resolution-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/zooming-in-on-enceladus-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/rhea-polar-view/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-trailing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/dione-north-polar-view/)
- [NASA source page](https://science.nasa.gov/photojournal/leading-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/the-southern-hemisphere-of-enceladus/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-rev-91-flyby-skeet-shoot-1-4-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/trailing-hemisphere-craters/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-leading-hemisphere/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA06073](https://science.nasa.gov/photojournal/phoebe-hi-resolution-mosaic/) | candidate | Phoebe six-image close-encounter mosaic may offer regional detail beyond the selected global view; cross-match native frames and current texture support. |
| [PIA06191](https://science.nasa.gov/photojournal/enceladus-mosaic/) | candidate | Four-frame Enceladus February 2005 close-up can be checked for detail beyond the current Schenk map; no assumed improvement from the press label. |
| [PIA06254](https://science.nasa.gov/photojournal/zooming-in-on-enceladus-mosaic/) | candidate | Twenty-one-frame Enceladus July 2005 mosaic is a potential local-detail source; compare exact observations with the newer selected global release. |
| [PIA07566](https://science.nasa.gov/photojournal/rhea-polar-view/) | candidate | Rhea south-polar crater close-up may add local photographic detail; compare its original frame support with the selected 417 m global mosaic. |
| [PIA08353](https://science.nasa.gov/photojournal/enceladus-trailing-hemisphere/) | candidate | Enceladus 16-image trailing-hemisphere close-up could expose native detail beyond the delivery map; compare it against current source coverage before selecting. |
| [PIA09886](https://science.nasa.gov/photojournal/dione-north-polar-view/) | candidate | Dione north-polar frame may supply regional detail near Janiculum Dorsa; compare the native footprint with the current global mosaic. |
| [PIA10424](https://science.nasa.gov/photojournal/leading-hemisphere/) | candidate | Tethys leading-hemisphere photograph includes the dark equatorial band and Odysseus; compare calibrated regional detail with the existing global source. |
| [PIA11126](https://science.nasa.gov/photojournal/the-southern-hemisphere-of-enceladus/) | candidate | Enceladus southern high-resolution 2008 flyby mosaic is a regional-detail lead; compare its original frames with the selected Schenk input. |
| [PIA11134](https://science.nasa.gov/photojournal/enceladus-rev-91-flyby-skeet-shoot-1-4-mosaic/) | candidate | Enceladus October 2008 four-frame mosaic at 12.3 m/pixel is a concrete local-detail opportunity if camera registration and display budget support it. |
| [PIA11582](https://science.nasa.gov/photojournal/trailing-hemisphere-craters/) | candidate | Mimas northern/trailing crater view offers regional imaging at a stated orientation; compare native resolution and footprint with the selected map. |
| [PIA11684](https://science.nasa.gov/photojournal/enceladus-leading-hemisphere/) | candidate | Enceladus leading-hemisphere observing set improved previously dim/low-resolution areas; compare native support with current mapping to determine residual detail gain. |


## P69

### Titan: dated ISS and radar observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Titan already uses the USGS 2026 ISS map, mission-end SAR, terrain and geology. Historical cumulative mosaics often add no independent coverage.

Qualify actual dated observations that support a useful regional or temporal comparison, including radar lake observations.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

#### Evidence

The supplied set spans 2004–2015 releases, individual flybys, cumulative maps and Sotra terrain. PIA19658 was published in 2015 but its source observations end in April 2014.

#### Work

Resolve each exposure interval, recover native bands and SAR geometry, separate cumulative-map revisions from observations, and compare on common support.

#### Limits and prior decisions

Atmospheric correction and changing look angle can mimic surface changes. VIMS spectra belong in proposal 33; mapped geological units belong in 70.

#### Acceptance

Actual observing dates, instrument units, registration, masks and any change claim tested against processing and viewing differences.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-october-2004/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-december-2004/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-feb-2005/)
- [NASA source page](https://science.nasa.gov/photojournal/tracing-surface-features-on-titan-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-east-of-xanadu/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-december-2006/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-october-2007/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-t28-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/radar-sees-lakes-in-titans-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/topographic-map-of-titans-north-polar-region/)
- [NASA source page](https://science.nasa.gov/photojournal/saturns-view-of-titans-trailing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/maps-of-titan-january-2009/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-february-2009/)
- [NASA source page](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-april-2011/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-polar-maps-2015/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-global-map-june-2015/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA06158](https://science.nasa.gov/photojournal/titan-mosaic-october-2004/) | candidate | Titan October 2004 28-image footprint set could support a dated ISS comparison with original haze treatment and measured regional coverage. |
| [PIA06159](https://science.nasa.gov/photojournal/titan-mosaic-december-2004/) | candidate | December 2004 Titan mosaic is a second regional epoch overlapping October; compare common support rather than mix dates into a change map. |
| [PIA06185](https://science.nasa.gov/photojournal/titan-mosaic-feb-2005/) | candidate | February 2005 Titan sixteen-image set has explicit haze and terminator processing; qualify those corrections before any seasonal surface comparison. |
| [PIA06203](https://science.nasa.gov/photojournal/tracing-surface-features-on-titan-mosaic/) | candidate | July 2004 Titan south-polar mosaic is contrast-enhanced; only native calibration can support comparison with later brightness changes. |
| [PIA06222](https://science.nasa.gov/photojournal/titan-mosaic-east-of-xanadu/) | candidate | East-of-Xanadu mosaic combines narrow- and wide-angle imaging with different resolution; keep their individual spatial support. |
| [PIA08346](https://science.nasa.gov/photojournal/map-of-titan-december-2006/) | candidate | Titan December 2006 ISS 938 nm release can help trace observing epochs, but a cumulative map is not itself an instantaneous historical surface. |
| [PIA08399](https://science.nasa.gov/photojournal/map-of-titan-october-2007/) | candidate | Titan 2007 cumulative ISS 938 nm mosaic offers source-lineage context for a time study; recover constituent observation times before comparing surface change. |
| [PIA08945](https://science.nasa.gov/photojournal/titan-t28-mosaic/) | candidate | Titan T28 April 2007 northern trailing-hemisphere mosaic offers a specific dated regional footprint for a controlled ISS comparison. |
| [PIA10018](https://science.nasa.gov/photojournal/radar-sees-lakes-in-titans-southern-hemisphere/) | candidate | Titan southern lake radar observation is a dated footprint that may support change/feature context beyond a mission-end composite; recover original SAR data. |
| [PIA10353](https://science.nasa.gov/photojournal/topographic-map-of-titans-north-polar-region/) | candidate | Titan north-polar stereo topography may offer regional information beyond the selected mission-end GTDR; compare native measured support and uncertainty first. |
| [PIA10536](https://science.nasa.gov/photojournal/saturns-view-of-titans-trailing-hemisphere/) | candidate | November 2008 Titan 938 nm image is a dated ISS observation with partial illumination; potential common-footprint comparison, not a new global map. |
| [PIA11146](https://science.nasa.gov/photojournal/maps-of-titan-january-2009/) | candidate | Titan January 2009 cumulative map incorporates August 2008 northern imaging; recover constituent epochs before a historical ISS comparison. |
| [PIA11149](https://science.nasa.gov/photojournal/map-of-titan-february-2009/) | candidate | February 2009 Titan 938 nm map is another cumulative release; qualification must separate new footprints from processing/version changes. |
| [PIA11701](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/) | candidate | Titan VIMS brightness-change regions are a source lead, but cryovolcanism is a hypothesis and calibration/atmospheric effects must be controlled. |
| [PIA13696](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/) | candidate | Sotra Facula plate combines SAR footprints with VIMS context and a volcanic interpretation; qualify each data source and keep the interpretation conditional. |
| [PIA14908](https://science.nasa.gov/photojournal/map-of-titan-april-2011/) | candidate | Titan April 2011 ISS cumulative 938 nm map supports observation-lineage work; a publication date is not a simultaneous surface snapshot. |
| [PIA19657](https://science.nasa.gov/photojournal/titan-polar-maps-2015/) | duplicate-family | Titan 2015 polar maps reproject the cumulative ISS source; only original dated observations, not map projections, can support a temporal comparison. |
| [PIA19658](https://science.nasa.gov/photojournal/titan-global-map-june-2015/) | candidate | Titan June 2015 ISS map uses data only through April 2014 T100; record observation cutoff separately from publication and compare with current 2026 mapping. |


## P70

### Enceladus and Titan: published fracture and terrain maps

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Titan already has a global geological map. Regional boundaries and Enceladus fracture traces need their own original coordinate source.

Qualify source-published Enceladus fracture traces and Titan local geological units through the existing feature or categorical-map contract.

Content owners: [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md), [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

#### Evidence

The reviewed entries include Enceladus north/south fracture maps and interpreted Titan terrain near proposed volcanic features.

#### Work

Locate original linework or registered categorical files, preserve map scale and unit definitions, and cross-match current named features and Titan geological units.

#### Limits and prior decisions

A proposed volcanic interpretation is not a confirmed eruption. Do not digitize press annotations as exact surveyed coordinates or add plume geometry.

#### Acceptance

Original coordinate access, frame, line/region topology, scale, legend and distinct value over current maps. Keep separate source decisions per body.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-northern-polar-projection/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-southern-polar-projection/)
- [NASA source page](https://science.nasa.gov/photojournal/geologic-map-of-titan-volcano/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA07721](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-northern-polar-projection/) | candidate | Northern Enceladus fracture interpretation is a potential mapped-structure dataset; obtain original traces and their definitions instead of treating annotations as exact vectors. |
| [PIA07722](https://science.nasa.gov/photojournal/enceladus-global-patterns-of-fracture-southern-polar-projection/) | candidate | Southern fracture interpretation complements the northern map and could share one categorical/feature release, with independent polar registration. |
| [PIA07964](https://science.nasa.gov/photojournal/geologic-map-of-titan-volcano/) | candidate | Titan circular-feature geology is an interpreted regional unit map; a volcano interpretation remains conditional and needs original map data, not press labels. |
| [PIA13696](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/) | candidate | Sotra Facula plate combines SAR footprints with VIMS context and a volcanic interpretation; qualify each data source and keep the interpretation conditional. |


## P71

### Titan: qualify Huygens descent imaging

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Global Titan products do not resolve the Huygens landing region at descent-image scales.

Establish whether original DISR observations can be registered as a very small measured regional dataset on the existing body.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

#### Evidence

The supplied pages show mosaics taken from several altitudes, including river-like channels and a roughly 1.3 km landing-region footprint.

#### Work

Recover calibrated DISR frames, descent poses and the relevant terrain reference. Verify the image-triplet accounting against native records rather than the press montage.

#### Limits and prior decisions

No surface-photo panel and no panorama wrapped around the globe. The small footprint may have no useful presentation at current zoom limits.

#### Acceptance

Authoritative camera/terrain registration, native pixel geometry, footprint and demonstrable value within existing controls; stop if those conditions fail.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-river-channel-and-ridge-area-on-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/huygens-titan-mosaic-1/)
- [NASA source page](https://science.nasa.gov/photojournal/huygens-titan-mosaic-2/)
- [NASA source page](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view/)
- [NASA source page](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view-at-different-altitudes/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA07236](https://science.nasa.gov/photojournal/mosaic-of-river-channel-and-ridge-area-on-titan/) | candidate | Three Huygens DISR descent frames resolve ridge/channel terrain locally; a registered regional observation requires original camera geometry and a valid site frame. |
| [PIA07870](https://science.nasa.gov/photojournal/huygens-titan-mosaic-1/) | candidate | Huygens descent stereographic mosaic projects images from a 3 km height; source poses and terrain assumptions must be recovered before surface registration. |
| [PIA07871](https://science.nasa.gov/photojournal/huygens-titan-mosaic-2/) | candidate | Huygens lower-altitude mosaic covers about 1.3 km; it is a distinct local support/resolution product, not an entire Titan texture. |
| [PIA08113](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view/) | candidate | Huygens 10 km descent poster is a Mercator presentation of camera views; original DISR records are needed for physical surface mapping. |
| [PIA08427](https://science.nasa.gov/photojournal/mercator-projection-of-huygenss-view-at-different-altitudes/) | candidate | Huygens four-altitude poster represents multiple local observing geometries; use original frames and poses, not a continuous fabricated descent surface. |


## P72

### HD 189733b: qualify a historical Spitzer thermal comparison

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The package already includes a JWST/Spitzer eclipse map, uncertainties and spectra. Earlier Spitzer maps are explicitly excluded unless a deposited numeric map adds a worthwhile comparison.

Resolve that specific source-availability condition for the 2007 Spitzer observations; add a historical result only if it is scientifically distinct and faithfully comparable.

Content owners: [hd-189733b](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/hd-189733b/README.md)

#### Evidence

PIA09376 and PIA09377 describe a phase-curve inversion, not a resolved photograph. Rediscovering these illustrations does not satisfy the existing ledger.

#### Work

Locate the original data and reconstruction, establish longitudinal and latitudinal support, and account for data reused in the current fit.

#### Limits and prior decisions

No new body or invented temperature texture. Model dependence and systematics must remain explicit; a press illustration cannot reopen the exclusion by itself.

#### Acceptance

Deposited numeric availability, independent reconstruction checks, shared-data dependence, uncertainty and explicit ledger reopen evidence.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/first-map-of-alien-world-animation/)
- [NASA source page](https://science.nasa.gov/photojournal/how-to-map-a-very-faraway-planet-animation/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA09376](https://science.nasa.gov/photojournal/first-map-of-alien-world-animation/) | candidate | The older Spitzer phase-map inversion is a conditional historical comparison: HD 189733b already has a JWST/Spitzer map, and its ledger requires a deposited original numeric map before reopening earlier Spitzer products. |
| [PIA09377](https://science.nasa.gov/photojournal/how-to-map-a-very-faraway-planet-animation/) | duplicate-family | Exoplanet mapping animation explains the same Spitzer measurement/inversion family; original light curve and model, not explanatory frames, are the candidate inputs. |


## P73

### Atlas: qualify additional observed ISS coverage

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Atlas already uses calibrated 2017 ISS images. Its ledger records a failed 2026 trial where published camera geometry projected about 98% of illuminated pixels onto sky.

Assess the December 2015 anti-Saturn view only if its original frames and authoritative geometry add measured coverage beyond the current set.

Content owners: [atlas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/atlas/README.md)

#### Evidence

PIA17206 identifies a resolved ridge observation. A press portrait does not itself repair the known pointing problem.

#### Work

Cross-match observation IDs, obtain original calibrated pixels and independent controlled poses, and compare the footprint with the selected 2017 sources.

#### Limits and prior decisions

No guessed pointing adjustment, synthetic far side or replacement shape. Respect the existing press-portrait exclusion until genuinely new pixels or registration are established.

#### Acceptance

Original camera solution, independent landmark residuals, new measured area and fixed-geometry preparation.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/atlas-escaping/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA17206](https://science.nasa.gov/photojournal/atlas-escaping/) | candidate | The December 2015 Atlas view is a conditional coverage lead beyond selected 2017 frames. The current ledger records a failed camera-geometry trial; this press image does not repair it, so authoritative native registration is required. |


## P74

### Planck: qualified all-sky scientific maps

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The audit has not established a compatible current all-sky prepared content path for these three quantities.

Qualify native CMB, lensing and polarized-dust data and identify a faithful existing image or catalogue presentation before any integration.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

PIA16873, PIA16875 and PIA18048 concern temperature anisotropy, inferred lensing matter and polarized dust respectively.

#### Work

Obtain official numeric HEALPix releases with units, masks, coordinates and uncertainty; reduce to supported prepared content offline only if the present contract permits it.

#### Limits and prior decisions

A sky map is not a planet texture. Lensing is an inference, and dust polarization is not a three-dimensional magnetic field. No renderer or world-ownership changes.

#### Acceptance

Official product identity, coordinate transformations, numeric samples, uncertainty and current-contract fit. If no fit exists, the PR is a source qualification record only.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/best-map-ever-of-the-universe/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-matter-in-the-universe/)
- [NASA source page](https://science.nasa.gov/photojournal/magnetic-map-of-milky-way/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA16873](https://science.nasa.gov/photojournal/best-map-ever-of-the-universe/) | candidate | Planck CMB temperature anisotropy is a real all-sky numeric-map lead; original HEALPix data, masks and an existing compatible display contract must be verified. |
| [PIA16875](https://science.nasa.gov/photojournal/map-of-matter-in-the-universe/) | candidate | Planck lensing/matter reconstruction is distinct from the CMB temperature map and contains masked Galactic regions; retain model interpretation and uncertainty. |
| [PIA18048](https://science.nasa.gov/photojournal/magnetic-map-of-milky-way/) | candidate | Planck polarized dust map constrains projected magnetic orientation; recover Stokes/uncertainty data and avoid calling drawn streamlines measured 3D field lines. |


## P75

### NED and the stellar halo: qualify catalogue measurements

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The audit has not yet joined these observations to the existing catalogue packages.

Identify a bounded set of genuinely missing catalogue facts or prepared statistical content backed by the original survey.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

PIA21084 shows NED galaxy distribution; PIA24571 depicts an inferred outer Milky Way halo density structure. Their pictures are not ready three-dimensional scene assets.

#### Work

Find original row identifiers, distance uncertainties and selection functions, cross-match current entries, and select only supported facts or existing-chart results.

#### Limits and prior decisions

No unbounded catalogue import, false depth from image pixels or renderer/world redesign. Native product access and incremental value remain unverified.

#### Acceptance

Stable IDs, coordinate/distance conventions, population selection, uncertainty and row-level before/after changes.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/ned-catalog-sky-source-map/)
- [NASA source page](https://science.nasa.gov/photojournal/star-map-of-the-milky-ways-outer-halo/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA21084](https://science.nasa.gov/photojournal/ned-catalog-sky-source-map/) | candidate | NED density graphic points to an extragalactic catalogue, not a literal galaxy texture; inspect original IDs/measurements and current catalogue support before any content addition. |
| [PIA24571](https://science.nasa.gov/photojournal/star-map-of-the-milky-ways-outer-halo/) | candidate | Outer-halo stellar-density map is an inferred population field over a distance shell; recover the source star catalogue, selection function and uncertainties instead of a literal 3D texture. |


## P76

### Nebulae: calibrated infrared image layers

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The reviewed products have not been matched to an existing image-layer package or scientifically qualified by this audit.

Qualify measured infrared bands for the California Nebula and Cygnus X through an existing image-layer contract where supported.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

PIA23650 shows Spitzer dust emission; PIA26748 identifies SPHEREx water-ice and carbon-bearing spectral signatures in Cygnus X.

#### Work

Recover native calibrated images or cubes, WCS, band definitions, errors and masks; compare any existing target inputs before preparing additional layers.

#### Limits and prior decisions

These are projected measurements. No invented depth, volumetric nebula reconstruction or renderer change. Spectral signatures are not automatically abundance maps.

#### Acceptance

Native availability, WCS registration, units, common band footprint and independent sample comparisons.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/spitzer-california-nebula-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-spherex-mission-maps-water-ice-throughout-cygnus-x/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA23650](https://science.nasa.gov/photojournal/spitzer-california-nebula-mosaic/) | candidate | Spitzer January 2020 California Nebula mosaic offers measured infrared dust imagery; recover calibrated channels/WCS and use existing image content without inferring unsupported 3D structure. |
| [PIA26748](https://science.nasa.gov/photojournal/nasas-spherex-mission-maps-water-ice-throughout-cygnus-x/) | candidate | SPHEREx Cygnus X ice/PAH signatures are actual spectral-map leads; original calibrated data, WCS, masks and interpretation are required without invented volume geometry. |


## P77

### 3I/ATLAS: measured infrared coma spectra

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The audit has not qualified a current package or an original downloadable measurement set for this lead.

Present a source-qualified spectrum or dated image through existing content if the native measurements are available and compatible.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

PIA26720 describes December 2025 SPHEREx observations of dust, water, carbon-bearing material and carbon dioxide in the coma.

#### Work

Locate the released spectra/images, preserve aperture, observation dates, wavelengths, calibration and uncertainties, and verify a suitable existing content owner.

#### Limits and prior decisions

A coma is not a nucleus surface. Do not paint these signatures onto an asteroid mesh or invent a new particle renderer.

#### Acceptance

Native product availability, aperture/geometry, line identification versus model interpretation, uncertainty and existing-contract compatibility.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/nasas-spherex-examines-comet-3i-atlass-coma/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA26720](https://science.nasa.gov/photojournal/nasas-spherex-examines-comet-3i-atlass-coma/) | candidate | SPHEREx December 2025 3I/ATLAS coma observations contain distinct dust/molecular spectral information; preserve coma aperture and epoch, not a nucleus surface texture. |


## P78

### Earth: coastal water measurements and their interpretation

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The existing Earth layers do not establish the Belize protected-area measurements behind this study.

Qualify measured turbidity and water-temperature inputs, with any published protected-area risk score clearly retained as a separate model interpretation.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

#### Evidence

PIA25862 describes a MODIS-based study involving 24 protected areas and a published risk ranking.

#### Work

Obtain original measured fields, time windows, area boundaries and the ranking method. Preserve the distinction between direct observations and aggregated conclusions.

#### Limits and prior decisions

The historical ranking is not a current forecast or direct satellite measurement. Do not color whole regions from a press diagram without its underlying data.

#### Acceptance

Boundary joins, native units, temporal aggregation, uncertainty and reproducibility of any retained ranking.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/map-shows-belizean-protected-areas-assessed-for-risk/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA25862](https://science.nasa.gov/photojournal/map-shows-belizean-protected-areas-assessed-for-risk/) | candidate | Belize protected-area risk ranks combine MODIS turbidity/temperature evidence and a model; recover underlying observations, boundaries and scoring assumptions, not a current risk forecast. |


## P79

### Jupiter: gravity-constrained deep winds

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Jupiter has cloud imagery and magnetic data; the audit has not established whether the published deep-wind constraints are already reflected in its factual content.

Add only missing, source-backed facts or an existing-chart representation of the inferred wind-depth model.

Content owners: [jupiter](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/jupiter/README.md)

#### Evidence

PIA26076 illustrates Juno gravity constraints on winds extending roughly 3,000 km deep. The illustration itself is not a numeric field.

#### Work

Read the original model and uncertainties, locate reusable parameter/profile data and compare current interior facts before editing content.

#### Limits and prior decisions

No new interior geometry or animated flow. Gravity constrains a model; it does not directly photograph cylindrical winds.

#### Acceptance

Original inference and uncertainty, published profile reproduction, current-content comparison and no unsupported spatial precision.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/cylindrical-orientation-of-jupiters-east-west-jet-streams/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA26076](https://science.nasa.gov/photojournal/cylindrical-orientation-of-jupiters-east-west-jet-streams/) | candidate | Juno-derived deep-wind result is shown as a cutaway illustration; only original model/fact/chart data could add scientific content without renderer changes. |


## P80

### Titan: the measured south-polar HCN signature

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Titan surface VIMS, thermal and geological products do not represent an atmospheric HCN cloud spectrum.

Qualify the observed polar-vortex spectrum as a dated atmospheric measurement using existing chart or factual content.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

#### Evidence

PIA18431 identifies hydrogen-cyanide ice in Titan's south-polar atmospheric vortex, a different target and interpretation from surface reflectance.

#### Work

Find the original VIMS observation, spectral extraction and reference comparison; retain altitude/limb geometry, date and uncertainty.

#### Limits and prior decisions

No surface HCN-abundance map, cloud volume or renderer change. A detection spectrum is not a global atmospheric concentration measurement.

#### Acceptance

Original band samples, feature identification, aperture/geometry, observational support and existing chart compatibility.


#### Sources

- [NASA source page](https://science.nasa.gov/photojournal/spectral-map-of-titan-with-polar-vortex/)

#### Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA18431](https://science.nasa.gov/photojournal/spectral-map-of-titan-with-polar-vortex/) | candidate | Titan VIMS HCN polar-vortex signal is atmospheric, not surface composition; preserve that distinction and keep any unsupported atmosphere presentation out of delivery. |


## P81

### Ceres: measured topography inside polar craters

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The current elevation view withholds polar caps because its source cannot separate stereo measurements from interpolation.

Assess the separate nine-crater SPC release for genuinely measured regional height/albedo support within those withheld areas.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

#### Evidence

The PDS4 bundle describes secondary-illumination reconstruction inside permanently shadowed regions and a v2 correction to regional albedo orientations.

#### Work

Inspect each crater's native grid, reconstruction quality, frame and validity. Transfer qualified scalar height/albedo onto the existing Ceres geometry; leave all unsupported surrounding areas missing.

#### Limits and prior decisions

This is not permission to fill the entire polar caps or replace the displayed mesh. A new source must satisfy the existing measurement-versus-interpolation blocker.

#### Acceptance

Per-crater native samples, corrected orientation, error/validity records, independent registration and explicit ledger reopen evidence.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn.shape-models-maps/bundle_dwarf_planet-ceres.dawn.shape-models-maps.xml)

PDS bundle IDs: `urn:nasa:pds:dwarf_planet-ceres.dawn.shape-models-maps`.


## P82

### Itokawa: calibrated near-infrared spectra

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

AMICA photographic bands do not supply the NIRS spectral measurements.

Qualify a useful measured spectrum first, followed by a regional spectral-signature map only if native geometry supports it.

Content owners: [itokawa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/itokawa/README.md)

#### Evidence

The archive distinguishes 117,937 raw spectra from 111,226 calibrated Itokawa spectra. Other targets and calibration frames must not be mistaken for asteroid coverage.

#### Work

Read original wavelength/calibration records, select target and epoch, preserve quality and uncertainty, and join observation geometry before assessing spatial coverage.

#### Limits and prior decisions

Spectrum counts are not independent resolved surface cells. Do not infer mineral abundance or use AMICA texture detail to sharpen a NIRS footprint.

#### Acceptance

Target filtering, native radiometric samples, wavelength order, uncertainty, footprint and current chart/map feasibility.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.nirs/bundle_hay.nirs.xml)

PDS bundle IDs: `urn:nasa:pds:hay.nirs`.


## P83

### Ryugu: dated infrared temperature observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Ryugu already has a modeled thermal-inertia view. Actual dated TIR observations are a different possible addition.

Qualify a compact, useful temperature observing set that preserves local solar time and measured footprint.

Content owners: [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

#### Evidence

The Hayabusa2 TIR bundle contains operational instrument products; the inventory alone does not establish a ready global temperature map.

#### Work

Prefer calibrated or derived products, resolve radiance versus brightness temperature, join camera geometry and uncertainty, and prepare a bounded set offline.

#### Limits and prior decisions

Thermal inertia and temperature have different units and meanings. No false simultaneous global mosaic from changing illumination.

#### Acceptance

Source calibration, time/local time, independent temperatures, registration and a distinct result beyond the current thermal-inertia product.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_tir/bundle_hyb2_tir.xml)

PDS bundle IDs: `urn:jaxa:darts:hyb2_tir`.


## P84

### Ryugu: MASCOT's local temperature measurements

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Global thermal inertia does not represent the lander's local thermal time series.

Qualify a local temperature curve or measured thermal facts using existing chart content, with the landing-site context retained.

Content owners: [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

#### Evidence

The archive contains MASCOT MARA radiometer observations and separate bus records that can support timing and state interpretation.

#### Work

Read instrument calibration, channel responses, pointing and lander states; isolate the usable surface intervals and preserve uncertainty.

#### Limits and prior decisions

Do not extrapolate a lander-sized measurement across Ryugu or confuse instrument temperature with surface temperature. No surface panorama UI.

#### Acceptance

Native time/channel samples, state filtering, footprint/pointing, uncertainty and current chart compatibility.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_mascot_mara/bundle_hyb2_mascot_mara.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_mascot_mbus/bundle_hyb2_mascot_mbus.xml)

PDS bundle IDs: `urn:jaxa:darts:hyb2_mascot_mara`, `urn:jaxa:darts:hyb2_mascot_mbus`.


## P85

### Eros and Ryugu: measured magnetic constraints

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The audit has not compared these instrument results with each body's existing magnetic-property facts.

Add or correct published magnetic limits or a bounded measurement curve where it adds useful scientific content.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md), [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

#### Evidence

NEAR MAG includes calibrated and derived results; MASCOT carries a separate fluxgate magnetometer archive.

#### Work

Identify final science products, frame and background/spacecraft-field corrections; compare published limits and uncertainties to current facts.

#### Limits and prior decisions

A measured field near an asteroid is not automatically intrinsic magnetization. An upper limit must not become zero or a fabricated global magnetic map.

#### Acceptance

Original calibrated units, background treatment, statistical limit definition, epoch and independent published comparisons.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_mascot_mag/bundle_hyb2_mascot_mag.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_mag_v1.1/bundle_near.mag.xml)

PDS bundle IDs: `urn:jaxa:darts:hyb2_mascot_mag`, `urn:nasa:pds:near.mag`.


## P86

### Moon and giant-planet systems: measured dust observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

These detector and infrared measurements were outside the original surface-map shortlist. They may support existing chart or factual content without changing rendering.

Qualify a small set of published dust-flux, particle-distribution or infrared-brightness measurements, with separate source decisions for each observing system.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md), [saturn](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/saturn/README.md), [jupiter](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/jupiter/README.md)

#### Evidence

CDA/HRD, Galileo DDS, LADEE LDEX, Ulysses and MSX measure different particle or line-of-sight quantities; their archives are independently listed in PDS4.

#### Work

Start from calibrated or published derived products, retain detection efficiency, spacecraft position, viewing direction, time and uncertainty, and identify an existing content owner.

#### Limits and prior decisions

No fabricated surface dust map, animated particles or three-dimensional density inferred directly from a detector count. A source without a faithful current-contract presentation remains an evidence-only result.

#### Acceptance

Counts versus physical flux, calibration/selection effects, geometry, uncertainty and useful source-backed facts or charts.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/cassini_cda_v1.0/bundle_cassini_cda.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/cassini_high_rate_detector/bundle_cassini_high_rate_detector.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/galileo-dds/bundle_galileo-dds.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/ldex/ladee_ldex_20240411/bundle_ladee_ldex.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/msx/msx.zody.dust/bundle.msx.zody.dust.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/ulysses/ulysses.udds/bundle_ulysses.udds.xml)

PDS bundle IDs: `urn:nasa:pds:cassini_cda`, `urn:nasa:pds:cassini_high_rate_detector`, `urn:nasa:pds:galileo-dds`, `urn:nasa:pds:ladee_ldex`, `urn:nasa:pds:msx.zody.dust`, `urn:nasa:pds:ulysses-udds`.


## P87

### Explain spectral signatures with measured laboratory references

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The tool needs understandable explanations of mineral and ice signatures. A laboratory spectrum can support an existing chart but does not measure a planetary surface.

Add a small number of clearly labeled laboratory comparisons beside relevant measured spectra, only through an already supported chart contract.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

The archive includes temperature-dependent water-ice spectra/optical constants, meteorite reflectance spectra and olivine absorption spectra across iron/magnesium compositions.

#### Work

Choose a concrete existing scientific comparison, retain sample composition, temperature, grain/preparation method and units, and verify that normalization remains meaningful.

#### Limits and prior decisions

No claim that a laboratory sample uniquely identifies surface minerals or determines abundance. Ice transmission, optical constants and asteroid reflectance are not interchangeable curves.

#### Acceptance

Native samples, units, sample conditions, normalization and a scientifically justified comparison with plain-language labels.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ices.mastrapa.lab-spectra/bundle_gbo.ices.mastrapa.lab-spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.meteorite.gaffey.lab-spectra/bundle_gbo.meteorite.gaffey.lab-spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.olivines.pitman.lab-spectra/bundle_gbo.olivines.pitman.lab-spectra.xml)

PDS bundle IDs: `urn:nasa:pds:gbo.ices.mastrapa.lab-spectra`, `urn:nasa:pds:gbo.meteorite.gaffey.lab-spectra`, `urn:nasa:pds:gbo.olivines.pitman.lab-spectra`.


## P88

### Pluto: observed atmospheric occultation profiles

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Pluto has surface ice and height data. A stellar occultation samples atmospheric transmission rather than surface composition.

Qualify the 2007 simultaneous visible/infrared occultation curve or published atmospheric constraints through existing charts and facts.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/pluto/README.md)

#### Evidence

The PDS4 package records the March 18 grazing occultation with continuous observations and timing metadata.

#### Work

Retrieve calibrated light curves, geometry, time scale and uncertainties; retain the distinction between observations and any retrieved atmospheric profile.

#### Limits and prior decisions

A grazing chord is not a global pressure map. Do not change atmospheric rendering or derive an unconstrained three-dimensional structure.

#### Acceptance

Time alignment between bands, normalization, station geometry, uncertainty and published-model reproduction if a profile is retained.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.pluto.benecchi-etal.occultation/bundle_gbo.pluto.benecchi-etal.occultation.xml)

PDS bundle IDs: `urn:nasa:pds:gbo.pluto.benecchi-etal.occultation`.


## P89

### Small bodies: calibrated MSX infrared observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

No row-level comparison of these measured infrared observations with existing comet and asteroid content has been completed.

Identify a bounded set of missing measured spectra, photometric points or supported image layers for existing objects.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

The archive contains calibrated Spirit III images of eight comets, two transition objects and two near-Earth asteroids in six infrared bands.

#### Work

Join original target IDs, source apertures, band responses, observation geometry and uncertainties; distinguish nucleus, coma and background contributions.

#### Limits and prior decisions

Six bands do not imply six resolved surface maps. No invented comet shape or new dust renderer; unresolved measurements belong in charts or facts.

#### Acceptance

Target matching, calibration, aperture/background treatment, epoch and distinct value over existing observations.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/msx/msx.sb.images/bundle.msx.sb.images.xml)

PDS bundle IDs: `urn:nasa:pds:msx.sb.images`.


## P90

### Small bodies: qualify historical map observations

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Many represented bodies already have better spacecraft maps. The collection title alone does not establish missing data.

Identify individual historical map sheets or photographic observations that add a useful epoch, footprint or source interpretation to an existing package.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

The Stooke archive contains 270 map sheets covering six asteroids, five satellites and three comets; the Thomas collection also includes image mosaics.

#### Work

Inventory each sheet's underlying observations, projection and target ID, compare it with selected current maps, and keep a named acceptance or rejection for every proposed addition.

#### Limits and prior decisions

No automatic new-body count, replacement geometry or reinterpretation of a cartographic reconstruction as a resolved photograph. Map-sheet counts are not unique observations.

#### Acceptance

Original image lineage, coordinate support, current-source overlap, source reuse terms and measurable incremental value.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/bundle_ast-sat.thomas.shape-models.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.maps/bundle_small_bodies.stooke.maps.xml)

PDS bundle IDs: `urn:nasa:pds:ast-sat.thomas.shape-models`, `urn:nasa:pds:small_bodies.stooke.maps`.


## P91

### Moon: Clementine spectral bands and calibration comparison

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

The Moon already has derived mineral signatures and Kaguya products. A Clementine measured-band set is a distinct instrument source, but its calibration variants are not independent observations.

Qualify a compact Clementine UVVIS/NIR band group if it adds useful wavelength or historical coverage beyond the selected products.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The USGS audit identifies five-band warped UVVIS and two NIR calibration releases. Their native scale and cross-instrument consistency need qualification.

#### Work

Compare the two NIR calibration methods, preserve per-band validity and wavelength, and check the warped grid against Kaguya on common footprints.

#### Limits and prior decisions

No mineral abundance inferred from a ratio press image, duplicated standard/empirical rows or assumption that all bands are quantitatively comparable.

#### Acceptance

Native scaling and masks, published calibration limits, wavelength order, numeric samples and measured benefit over existing datasets.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_uvvis_global_mosaic_118m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_uvvis_5_band_warped_image_mosaic_200m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_nir_empirical_calibration_500m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_clementine_nir_standard_calibration_500m)

USGS catalogue IDs: `moon_clementine_uvvis_global_mosaic_118m`, `moon_clementine_uvvis_5_band_warped_image_mosaic_200m`, `moon_clementine_nir_empirical_calibration_500m`, `moon_clementine_nir_standard_calibration_500m`.


## P92

### Moon: qualify the published polar ice-favorability model

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Existing lunar thermal, rock and illumination inputs do not themselves establish this combined favorability score.

Determine whether the published north/south polar index adds an understandable, reproducible model interpretation through an existing data view.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The USGS catalogue exposes separate polar index products. This is a model lead, not a direct ice detection or water-abundance observation.

#### Work

Read the index definition, input epochs, weighting and missing-data treatment; retrieve native values and compare with selected underlying measurements.

#### Limits and prior decisions

Label the quantity as modeled favorability. Do not equate a high score with confirmed ice, probability of ice unless the model defines that, or current exploration guidance.

#### Acceptance

Published formula, native value range, polar registration, uncertainty/limitations and incremental educational value beyond the measured inputs.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_ice_favorability_index_north_pole_591mp)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_ice_favorability_index_south_pole_591mp)

USGS catalogue IDs: `moon_ice_favorability_index_north_pole_591mp`, `moon_ice_favorability_index_south_pole_591mp`.


## P93

### Venus: published regional geological units

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Venus radar and numeric surface measurements do not supply these interpreted regional geological boundaries.

Qualify original categorical mapping for the Snegurochka Planitia and Metis Mons quadrangles using the existing geological-map contract.

Content owners: [venus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/venus/README.md)

#### Evidence

The USGS audit found the two regional map records and TIFF evidence; original unit and coordinate support still need inspection.

#### Work

Prefer the original GIS or categorical map over a flattened illustrated plate; preserve unit codes, mapped scale, projection and source interpretation.

#### Limits and prior decisions

No claim of complete global coverage or absolute terrain ages from relative units. Keep this a regional option, reflecting the user's preference for substantial useful coverage.

#### Acceptance

Original GIS availability, category/legend agreement, native boundaries, projection and useful footprint at current zoom.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/venus_geologic_map_of_the_snegurochka_planitia_quadrangle)
- [USGS product record](https://astrogeology.usgs.gov/search/map/venus_geologic_map_of_the_metis_mons_quadrangle)

USGS catalogue IDs: `venus_geologic_map_of_the_snegurochka_planitia_quadrangle`, `venus_geologic_map_of_the_metis_mons_quadrangle`.


## P94

### Moon: qualify historical and illumination-specific photographs

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Modern global lunar photography already exists. These sources would add a qualified historical or illumination comparison rather than automatically improve spatial detail.

Retain one genuinely distinct source-qualified observing set if its date or lighting adds scientific value within existing controls.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

#### Evidence

The USGS audit includes Lunar Orbiter imagery, a hybrid mosaic and Kaguya morning/evening products. The hybrid combines instruments rather than representing a single exposure.

#### Work

Read source-image lineage, illumination and projection; cross-match current inputs and quantify registration and footprint before choosing a set.

#### Limits and prior decisions

Do not turn lighting differences into surface-change claims or label a multi-epoch hybrid as one historical date. No duplicate dataset for a cosmetic alternate basemap.

#### Acceptance

Original epochs and observing geometry, source overlap, control residuals, validity and an explicit reason the addition is useful.


#### Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_global_orthomosaic_474m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_evening_global_mosaic_474m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lunar_orbiter_digital_photographic_global_mosaic_59m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lunar_orbiter_clementine_uvvisv2_hybrid_mosaic_59m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_morning_global_mosaic_474m)

USGS catalogue IDs: `moon_lunar_orbiter_digital_photographic_global_mosaic_59m`, `moon_lunar_orbiter_clementine_uvvisv2_hybrid_mosaic_59m`, `moon_selene_kaguya_tc_global_orthomosaic_474m`, `moon_selene_kaguya_tc_evening_global_mosaic_474m`, `moon_selene_kaguya_tc_morning_global_mosaic_474m`.


## P95

### Asteroids: measured radar Doppler spectra

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

#### Problem and proposed result

Radar shape models and optical reflectance spectra do not preserve the measured radar echo profiles in this archive.

Qualify selected original Doppler profiles for existing bodies through the current chart or factual-content contract.

Content owners: Determine the existing content owner during source qualification.

#### Evidence

The PDS4 bundle identifies comma-separated Arecibo Doppler spectra associated with Virkki et al. (2022). These are whole-target echo measurements, not surface photographs.

#### Work

Join target and observation IDs, record transmit frequency, polarization, Doppler convention, normalization and noise, and compare current radar-property facts before adding a representative profile.

#### Limits and prior decisions

Do not turn echo frequency into a surface longitude or infer material abundance from radar brightness. A shape inversion is a separate model, outside this proposal.

#### Acceptance

Native numeric samples, Doppler units/sign, polarization channels, calibration/noise and a faithful existing-chart presentation.


#### Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.radar.arecibo.doppler_spectra_of_asteroids_v1.1/bundle_gbo.ast.radar.arecibo.doppler_spectra_of_asteroids.xml)

PDS bundle IDs: `urn:nasa:pds:gbo.ast.radar.arecibo.doppler_spectra_of_asteroids`.


## P96

### Saturn rings: compare measured opacity profiles

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Saturn currently uses one Cassini UVIS occultation profile to prepare ring opacity. Proposal 44 concerns spectral interpretation; it does not cover a comparison of dated occultation profiles.

Prepare a small set of measured radial profiles with instrument, wavelength, event time and uncertainty, using the existing chart and ring preparation contracts.

Content owners: [saturn](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/saturn/README.md).

#### Evidence

OPUS lists Cassini RSS optical-depth profiles and companion geometry/calibration products. The inspected K-band label identifies calibrated optical depth and phase shift over 72,001.25–144,998.75 km. UVIS, VIMS and Voyager occultations are separate instrument families.

#### Work

Choose events with useful radial coverage; decode their native tables and quality limits; reconcile ring radius and event-time conventions. Keep optical depth distinct from display alpha and from the brightness spectra in proposal 44.

#### Limits and prior decisions

Different wavelengths, opening angles and epochs cannot be pooled into one measured profile. A single occultation samples a path, not every longitude. Do not infer complete azimuthal structure or change retained ring geometry.

#### Acceptance

Verify native table values, radius ordering, missingness, uncertainty and the optical-depth-to-transmission conversion. Demonstrate a useful change against the currently selected UVIS profile; keep preparation and rendering separate.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [co-rss-occ-2005-123-rev007-k26-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+RSS&target=Saturn+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 2005-05-03T02:49:00.202. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/CORSS_8xxx/CORSS_8001/data/Rev007/Rev007I/Rev007I_RSS_2005_123_K26_I/RSS_2005_123_K26_I_TAU_01KM.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/CORSS_8xxx/CORSS_8001/data/Rev007/Rev007I/Rev007I_RSS_2005_123_K26_I/RSS_2005_123_K26_I_TAU_01KM.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P97

### Uranus rings: replace broad opacity assumptions with measured profiles

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Uranus uses published ring dimensions and broad optical-depth values; the epsilon-ring display uses a midpoint of the published range.

Qualify Voyager and Earth-based occultation profiles for prepared ring-opacity inputs and source-backed explanatory charts.

Content owners: [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md).

#### Evidence

The inspected Voyager PPS label supplies ring-intercept radius, normal opacity and uncertainty. The Earth-based PDS4 release supplies radial products at multiple sampling intervals, ring fits and quality ratings. These are native measurements beyond the summary ring table.

#### Work

Select dated ingress/egress events with documented ring-plane models and adequate signal. Preserve the native quantity: normalized flux, opacity and optical depth are different. Compare overlapping independent events before changing an existing display parameter.

#### Limits and prior decisions

Sampling interval is not spatial resolving power. Narrow-ring eccentricity and longitude variations prohibit averaging all profiles into a supposedly simultaneous circular ring. Keep fixed geometry and disclose any display-width floor.

#### Acceptance

Check radius, units, flags, uncertainties, bandpass and conversion against the label and independent numeric rows. Demonstrate that the existing prepared annular texture can represent the result without geometry or renderer changes.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [vg-pps-2-u-occ-1986-024-sigsgr-ringpl-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Uranus+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1986-01-24T04:38:08.032. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM000_1/PU1P01XI.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM000_1/PU1P01XI.LBL).
- [ctio4m0-insb-occ-1980-080-u11-ringpl-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cerro+Tololo+Victor+Blanco+4m&target=Uranus+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1980-03-20T04:00:00.064. [Read native label](https://opus.pds-rings.seti.org/pds4-holdings/bundles/uranus_occs_earthbased/uranus_occ_u11_ctio_400cm/data/global/u11_ctio_400cm_2200nm_radius_equator_ingress_100m.xml) · [Original label](https://opus.pds-rings.seti.org/pds4-holdings/bundles/uranus_occs_earthbased/uranus_occ_u11_ctio_400cm/data/global/u11_ctio_400cm_2200nm_radius_equator_ingress_100m.xml).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P98

### Neptune rings: measured radial profiles and dated arc observations

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Current Neptune ring radii are sourced, but arc centres and widths remain schematic because the selected summary table does not establish absolute positions.

Qualify native occultation profiles and calibrated Voyager/Hubble observations as separate constraints on the existing ring presentation.

Content owners: [neptune](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/neptune/README.md).

#### Evidence

OPUS provides Voyager PPS/UVS ring occultations and ISS calibrated/geometrically corrected images. The first inspected PPS segment covers only 42,500–49,999 km: it does not measure the Adams arcs near 62,933 km.

#### Work

Read every segment associated with the selected occultation and choose actual arc imaging by event time, phase and ring longitude. Retain a separate table of what each source measures. Use only source-supported fixed-epoch arc locations or an existing prepared chart.

#### Limits and prior decisions

A radial occultation cannot locate every arc. Do not expand the inspected inner-ring segment to the Adams ring, fill unseen longitudes, animate arcs or alter scene geometry.

#### Acceptance

Independently verify radius/longitude frames and timing, resolve actual arc coverage from native images, and compare with the current schematic assumptions. A profile-only result must be labeled as such.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [vg-pps-2-n-occ-1989-236-sigsgr-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Neptune+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1989-08-24T22:56:46.860. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM001/PN1P0104.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM001/PN1P0104.LBL).
- [vg-iss-2-n-c1060649](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Neptune+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1989-07-30T01:08:34.560. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8204/DATA/C10606XX/C1060649_CALIB.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8204/DATA/C10606XX/C1060649_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P99

### Saturn moons: qualify additional infrared bands and coverage

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Dione, Rhea, Tethys, Iapetus and Phoebe already have infrared/ice views. Mimas and Hyperion are the clearest missing VIMS cases in this set. Enceladus now has the merged infrared mosaic and is not another new infrared addition.

Start with measured VIMS bands for Mimas and Hyperion; extend another moon only when a native-source comparison establishes new coverage or a distinct useful spectral measurement.

Content owners: [mimas](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/mimas/README.md), [hyperion](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/hyperion/README.md), [dione](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/dione/README.md), [rhea](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/rhea/README.md), [tethys](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/tethys/README.md), [iapetus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/iapetus/README.md), [phoebe](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/phoebe/README.md).

#### Evidence

Read labels identify 48×352×12 and 36×352×24 QUBEs for the inspected Mimas and Hyperion products. OPUS also finds a sharp Dione observation, but its label is only 64×352×1: one spatial line, not a high-resolution global map. OPUS exposes raw QUBEs and geometry summaries, not a ready calibrated global mosaic.

#### Work

Recover the documented radiometric calibration and wavelength tables, separate VIS/IR channels sharing a QUBE, validate per-pixel geometry and compare against the selected corrected mosaics. Prefer independent registration and measured area gain over more catalogue rows.

#### Limits and prior decisions

A band-depth indicator is not mineral abundance. Resolution sorting does not rank total useful coverage. Preserve scan gaps, saturation and fixed moon geometry; do not reopen rejected registrations without new evidence.

#### Acceptance

Independent calibrated samples, wavelength selection, held-out registration, area-weighted support and overlap checks. Report each moon separately, including any case that produces no useful addition.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [co-vims-v1818531048_040_ir](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Dione&surfacegeometrytargetname=Dione&SURFACEGEOdione_centerresolution1=0.000001&order=SURFACEGEOdione_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Reflectivity, 2015-08-17T18:33:16.480. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0076/data/2015229T143120_2015229T225720/v1818531048_4_040.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0076/data/2015229T143120_2015229T225720/v1818531048_4_040.lbl).
- [co-vims-v1644777564_ir](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Mimas&surfacegeometrytargetname=Mimas&SURFACEGEOmimas_centerresolution1=0.000001&order=SURFACEGEOmimas_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Reflectivity, 2010-02-13T17:55:21.837. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0041/data/2010044T055716_2010044T203312/v1644777564_1.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0041/data/2010044T055716_2010044T203312/v1644777564_1.lbl).
- [co-vims-v1506393701_vis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Hyperion&surfacegeometrytargetname=Hyperion&SURFACEGEOhyperion_centerresolution1=0.000001&order=SURFACEGEOhyperion_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Reflectivity, 2005-09-26T02:13:14.560. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0008/data/2005269T015111_2005269T030239/v1506393701_1.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0008/data/2005269T015111_2005269T030239/v1506393701_1.lbl).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P100

### Saturn moons: measured ultraviolet spectra

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Visible/infrared composites do not expose the archived ultraviolet measurements as spectra with their original calibration and observing conditions.

Qualify selected UVIS and Hubble STIS spectra as existing prepared charts; a surface band is optional only where resolved footprints and registration support it.

Content owners: [mimas](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/mimas/README.md), [enceladus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/enceladus/README.md), [tethys](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/tethys/README.md), [dione](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/dione/README.md), [rhea](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/rhea/README.md), [iapetus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/iapetus/README.md), [phoebe](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/phoebe/README.md), [hyperion](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/hyperion/README.md).

#### Evidence

The Dione UVIS example has a native FUV cube plus a versioned calibration-correction product. Catalogue records also mix HDAC time series, EUV/FUV scans and different observing purposes.

#### Work

Separate sunlight reflected by ice from atmospheric emission, background and detector calibration. Apply the documented correction for the selected release, inspect slit footprints, and compare with existing VIMS/visible source coverage.

#### Limits and prior decisions

A target name or generic Emission field does not establish a surface reflectance measurement. Raw counts and correction factors are not final radiance or I/F. Unresolved spectra must stay charts, not painted surface patches.

#### Acceptance

Validate units and correction direction against native documentation; retain spectral errors and resolution, event time and pointing. Demonstrate that existing chart or surface preparation supports the chosen result.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [co-uvis-fuv2004_171_23_11](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Dione&COUVISchannel=FUV&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Emission, 2004-06-19T23:11:30.616. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/COUVIS_0xxx/COUVIS_0007/CALIB/VERSION_3/D2004_171/FUV2004_171_23_11_CAL_3.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COUVIS_0xxx/COUVIS_0007/CALIB/VERSION_3/D2004_171/FUV2004_171_23_11_CAL_3.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P101

### Jupiter moons: distinguish ultraviolet surface and atmospheric signals

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

The earlier proposals cover NIMS, photography and volcanic changes. Hubble ultraviolet spectra provide a separate set of measurements requiring their own interpretation.

Prepare selected measured spectra or spatially supported ultraviolet bands with clear labels for reflected light versus atmospheric emission.

Content owners: [io](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/io/README.md), [europa](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/europa/README.md), [ganymede](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/ganymede/README.md), [callisto](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/callisto/README.md).

#### Evidence

A targeted Europa STIS query returns native spectrum products, including calibrated 1D and 2D extractions. The archive also contains ACS/STIS/WFPC2 observations of Io, Europa and Ganymede; these are not automatically surface maps.

#### Work

Select coherent observing programs, remove acquisition images and calibrations, read aperture/pointing/error products, and match published analyses to exact observation IDs. Use the existing chart contract for spatially unresolved signals.

#### Limits and prior decisions

Do not place an auroral or exospheric emission pattern on solid terrain, interpret it as mineral abundance, or combine time-variable emissions into a timeless global surface.

#### Acceptance

Check extraction, flux units, wavelength solution, error arrays and observing geometry. Any mapped result needs independent surface registration; otherwise deliver a qualified chart or retain a source decision.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [hst-08224-stis-o5d601010](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Europa&observationtype=Spectrum&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectrum, Emission, 1999-10-05T08:39:27.000. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/HSTOx_xxxx/HSTO0_8224/DATA/VISIT_01/O5D601010.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/HSTOx_xxxx/HSTO0_8224/DATA/VISIT_01/O5D601010.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P102

### Uranus: a dated Voyager cloud observation

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Uranus already has dated OPAL maps. A Voyager-era view would extend the time baseline only if it is reconstructed from a coherent observation set.

Qualify one dated 1986 cloud/filter dataset through the existing surface/date selector.

Content owners: [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md).

#### Evidence

OPUS exposes thousands of Uranus ISS records with calibrated and geometrically corrected products. The resolution-ranked example crosses incidence angles above 90 degrees and approaches the limb; nominally fine sampling is not sufficient selection evidence.

#### Work

Choose a near-contemporaneous filter set using illumination, disk placement and resolution together. Use the native calibration and camera geometry, retaining missing polar/limb coverage and acquisition times.

#### Limits and prior decisions

No mixing decades or unseen hemispheres; no inferred high-detail clouds. A Voyager false-color view must not imply absolute brightness comparability with contrast-enhanced OPAL displays.

#### Acceptance

Check independent limb/feature registration, inter-band timing, source sampling and visible coverage. Use an honest dated regional result if a coherent global view is unsupported.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [vg-iss-2-u-c2686312](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Uranus&surfacegeometrytargetname=Uranus&SURFACEGEOuranus_centerresolution1=0.000001&order=SURFACEGEOuranus_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1986-01-25T06:15:56.280. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26863XX/C2686312_CALIB.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26863XX/C2686312_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P103

### Uranian moons: qualify numeric Voyager filter measurements

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

All five moons already have Voyager color datasets. A second color composite is duplicate work. The current recipes include whole-disc color matching and no phase normalization.

Assess whether calibrated individual filter values or measured ratios can support a distinct numeric dataset or chart beyond the current display colors.

Content owners: [ariel](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/ariel/README.md), [miranda](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/miranda/README.md), [umbriel](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/umbriel/README.md), [titania](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/titania/README.md), [oberon](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/oberon/README.md).

#### Evidence

Native Voyager CALIB/GEOMED products and geometry are accessible. Existing ledgers preserve camera/control limits and the earlier unsuccessful Oberon color trial as well as the subsequently included Voyager color dataset.

#### Work

Start from selected observations and their existing registrations. Trace calibration, scaling, phase and uncertainty to the original measurements; inspect additional frames only if they meet an explicit unmet coverage or information requirement.

#### Limits and prior decisions

Archive availability does not reopen rejected reconstructions. Do not repeat the old Oberon trial, borrow clear-filter detail, fill the unlit north or change moon geometry.

#### Acceptance

Establish physically meaningful units and independent photometric checks. If the available calibration cannot support numeric interpretation beyond the current color display, retain that negative result rather than add another lens.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [vg-iss-2-u-c2684629](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Miranda&surfacegeometrytargetname=Miranda&SURFACEGEOmiranda_centerresolution1=0.000001&order=SURFACEGEOmiranda_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1986-01-24T16:53:31.080. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26846XX/C2684629_CALIB.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26846XX/C2684629_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P104

### Neptune moons: qualify useful native filter measurements

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Triton and Proteus already use calibrated Voyager photography and filter color. Proteus still lacks independent interior feature control; Triton retains a documented calibration-scale discrepancy.

Resolve a demonstrated calibration or registration gap before adding a numeric band or genuinely additional observed region. Unresolved small moons can contribute measured photometry, not fabricated textures.

Content owners: [triton](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/triton/README.md), [proteus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/proteus/README.md), [nereid](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/nereid/README.md), [larissa](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/larissa/README.md).

#### Evidence

The resolution-ranked Proteus example C1138920 is already a selected source. Its presence in OPUS is duplication, not a newly discovered high-resolution image.

#### Work

Compare exact observation IDs and source processing versions first. Follow the existing Triton/Proteus reopen conditions and investigate alternative native products only when they offer new calibration or independent geometric evidence.

#### Limits and prior decisions

No new surface from a point source, no repeat of the same unconstrained limb fit, and no geometry changes. Preserve existing native-resolution and missing-coverage limits.

#### Acceptance

An independent calibration/control improvement must be demonstrated against the current selected inputs. Otherwise close the candidate as existing-family or unresolved; do not count retrieved copies as new data.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [vg-iss-2-n-c1138920](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Proteus&surfacegeometrytargetname=Proteus&SURFACEGEOproteus_centerresolution1=0.000001&order=SURFACEGEOproteus_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1989-08-25T03:10:19.080. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DATA/C11389XX/C1138920_CALIB.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DATA/C11389XX/C1138920_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P105

### Pluto and Charon: native MVIC spectral bands

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Current enhanced-color displays combine MVIC filters. Native individual measurements could provide useful band comparisons beyond those display composites.

Qualify selected blue, red, near-infrared and methane-filter observations on the existing surfaces, grouped with the existing selector.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/pluto/README.md), [charon](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/charon/README.md).

#### Evidence

OPUS returns calibrated MVIC SCI products. Their labels explicitly say the absolute-calibration step does not convert stored calibrated DN to physical units. The Charon intended-target sample is from 2012, so it cannot stand in for resolved 2015 flyby coverage.

#### Work

Locate the actual encounter scans, including Charon observations indexed under another intended target. Bind filter identities, scan timing and physical-unit conversion; use published geometry/control against current mosaics.

#### Limits and prior decisions

OPUS does not supply enhanced MVIC surface geometry in this audit. Four differently colored arrays alone do not establish composition or independent spatial information. Do not substitute 2012 point-source frames for resolved encounter scans.

#### Acceptance

Verify calibration constants, band registration, scan geometry, masks and native sampling against independent values and landmarks. Name reflectance/band ratios honestly and avoid duplicating enhanced color.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [nh-mvic-mp1_0299137933](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Pluto&time1=2015-07-14&time2=2015-07-15&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 2015-07-14T00:00:21.007. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPEMV_2001/data/20150714_029913/mp1_0299137933_0x530_sci.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPEMV_2001/data/20150714_029913/mp1_0299137933_0x530_sci.lbl).
- [nh-mvic-mpf_0200906396](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Charon&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 2012-06-02T01:28:01.010. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPCMV_2001/data/20120602_020090/mpf_0200906396_0x539_sci.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPCMV_2001/data/20120602_020090/mpf_0200906396_0x539_sci.lbl).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P106

### Pluto small moons: preserve and resolve native-image blockers

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Nix/Hydra photographic registration is deferred, Nix MVIC color is excluded for inadequate spatial information, and Kerberos/Styx have unresolved source limits.

Use OPUS to document exact candidate/control products and their overlap with existing failed trials; reopen a surface only when its recorded condition is met.

Content owners: [nix](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/nix/README.md), [hydra](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/hydra/README.md), [kerberos](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/kerberos/README.md), [styx](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/styx/README.md).

#### Evidence

OPUS provides LORRI/MVIC records and calibrated-file links. Existing Nix evidence estimates roughly 24×17 color pixels, inadequate for the required cross-band registration; the indexed image dimensions describe the detector, not the moon.

#### Work

Compare identifiers, pointing and source-model bindings with the existing ledgers. Seek independent control or a newly released registered product; distinguish matching metadata from a successful shape-frame solution.

#### Limits and prior decisions

No geometry changes, no coarse color transferred onto finer LORRI detail, and no repeated failed fit presented as new evidence. Styx has no intended-target MVIC row in this snapshot; that is not proof that it never appears in a frame.

#### Acceptance

Meet the existing disjoint interior-holdout and source-frame conditions on genuinely new evidence. An unchanged blocker remains blocked and does not justify a rendered dataset.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [nh-mvic-mc0_0299154512](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Nix&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 2015-07-14T04:36:40.007. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPEMV_2001/data/20150714_029915/mc0_0299154512_0x545_sci.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPEMV_2001/data/20150714_029915/mc0_0299154512_0x545_sci.lbl).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P107

### Venus: native Galileo and Cassini cloud observations

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Venus has Magellan surface measurements and Akatsuki ultraviolet clouds. Historical optical/infrared flybys are a different observing opportunity from the rejected sparse radar-look mosaics.

Qualify one coherent dated cloud/filter observation through existing prepared datasets.

Content owners: [venus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/venus/README.md).

#### Evidence

Galileo SSI and Cassini ISS/VIMS/UVIS have Venus intended-target records. The inspected Galileo endpoint supplies raw EDR imagery and geometry; calibrated reflectance is not established by that file listing.

#### Work

Recover the relevant calibration, verify filter and exposure, and choose a time-consistent observed hemisphere. Register cloud images using atmosphere-appropriate geometry; preserve native resolution and missing coverage.

#### Limits and prior decisions

Cloud measurements are not surface geology or global ground coverage. Different wavelengths can probe different altitudes; do not merge moving clouds from separate flybys.

#### Acceptance

Independent radiometric and pointing checks, explicit time and bandpass, and a demonstrated useful difference from the current Akatsuki dataset. No inferred unseen cloud texture.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [go-ssi-c0018062600](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Venus&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1990-02-10T05:12:16.682. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0002/VENUS/C0018062600R.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0002/VENUS/C0018062600R.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P108

### Giant planets: measured ultraviolet and infrared spectra

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Several current spectrum/atmosphere charts are model outputs. OPUS supplies observed spectra whose purpose and calibration can be compared with those model claims.

Add selected measured spectra to existing prepared charts, labeled by aperture, wavelength and observation time.

Content owners: [jupiter](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/jupiter/README.md), [saturn](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/saturn/README.md), [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md), [neptune](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/neptune/README.md).

#### Evidence

The Uranus STIS search has spectrum records and calibrated FITS links. The earliest sample is not automatically a complete disk-integrated reflected-light spectrum; slit placement and emission interpretation require native checks.

#### Work

Choose published, coherent programs; recover extraction/error arrays and instrument response. Separate reflected sunlight, thermal radiation and auroral emission. Compare models only at matched geometry and spectral resolution.

#### Limits and prior decisions

A spectrum from a slit or limb is not a global atmosphere profile. Raw Hubble inputs overlapping OPAL maps are not additional dates merely because OPUS lists them.

#### Acceptance

Validate physical units, aperture, uncertainties, resolution and observed-versus-modeled labels. Render all charts at preparation time through existing content support.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [hst-07439-stis-o4wt03010](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Uranus&observationtype=Spectrum&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectrum, Emission, 1998-09-14T05:37:38.000. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/HSTOx_xxxx/HSTO0_7439/DATA/VISIT_03/O4WT03010.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/HSTOx_xxxx/HSTO0_7439/DATA/VISIT_03/O4WT03010.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P109

### Enceladus: measured ultraviolet occultation light curves

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

The merged Enceladus VIMS mosaic concerns surface infrared data. UVIS occultation light curves could explain a different measurement without adding plume rendering.

Qualify selected normalized stellar light curves and, only with an independently supported retrieval, plume column-density values in existing prepared chart content.

Content owners: [enceladus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/enceladus/README.md).

#### Evidence

The OPUS UVIS HSP query with Enceladus geometry returns raw time series. A body in the geometric field of view does not identify a plume occultation; event classification and reference-star/background measurements remain required.

#### Work

Match candidate events to published occultation analyses and original time series. Establish line-of-sight paths, stellar baseline, instrumental flags and uncertainty before any absorption retrieval.

#### Limits and prior decisions

Do not convert surface VIMS color into plume activity or infer a global/animated plume from a light curve. This proposal does not reopen the completed VIMS mosaic or change geometry.

#### Acceptance

Independently verify timing, normalization, background and retrieval assumptions. Preserve non-detections and uncertainty; use the existing chart contract or keep an evidence-backed source decision.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [co-uvis-hsp2005_048_03_27](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&surfacegeometrytargetname=Enceladus&COUVISchannel=HSP&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Time Series, Optical Depth, 2005-02-17T03:27:37.431. [Read native label](https://opus.pds-rings.seti.org/holdings/volumes/COUVIS_0xxx/COUVIS_0010/DATA/D2005_048/HSP2005_048_03_27.LBL) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COUVIS_0xxx/COUVIS_0010/DATA/D2005_048/HSP2005_048_03_27.LBL).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P110

### Uranus: observed atmospheric occultation light curves

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

#### Problem and proposed result

Uranus currently explains its atmosphere using model-based charts. The ring archive also contains separately labeled atmospheric occultation measurements.

Prepare an observed stellar-flux curve alongside an accurately described atmospheric explanation using existing chart support.

Content owners: [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md).

#### Evidence

The read HST FOS PDS4 label identifies normalized stellar flux versus time during the 16 March 1996 atmospheric egress. It supplies time coordinates, sky-plane radius and flags, not a measured temperature-pressure grid.

#### Work

Decode the original calibrated table and quality record; compare ground-based events where compatible. Keep any later atmospheric inversion a separately justified model with explicit assumptions.

#### Limits and prior decisions

Do not relabel the API Optical Depth facet as a ready atmospheric temperature measurement. A single occultation samples one path and epoch, not the whole atmosphere.

#### Acceptance

Check time systems, normalization and quality flags against native rows. Distinguish observed light loss from any derived density/temperature and preserve uncertainties.

Follow the [shared scope](PROPOSALS.md#scope): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

#### Examined source products

- [hst-fos-occ-1996-076-u137-uranus-e](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+FOS&target=Uranus&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1996-03-16T15:25:38.144. [Read native label](https://opus.pds-rings.seti.org/pds4-holdings/bundles/uranus_occs_earthbased/uranus_occ_u137_hst_fos/data/atmosphere/u137_hst_fos_540nm_counts-v-time_atmos_egress.xml) · [Original label](https://opus.pds-rings.seti.org/pds4-holdings/bundles/uranus_occs_earthbased/uranus_occ_u137_hst_fos/data/atmosphere/u137_hst_fos_540nm_counts-v-time_atmos_egress.xml).

The product snapshot and exact queries are in [OPUS evidence](README.md#query-the-ledger). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

## P111

### Moon: measured magnetic anomalies

Qualify Kaguya LMAG grid values, altitude and vector components; prepare scalar views on the existing Moon.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:sln-l-lmag-5-ma-grid-v1.0). An orbital field measurement is not surface magnetization. Retain source altitude, inversion assumptions and missing cells.

#### Acceptance

Read MA_GD native labels and compare several grid values with the published maps. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P112

### Moon: Kaguya elemental measurements

Add the published GRS nuclide maps and separately named gamma-ray intensity maps after unit and coverage checks.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:sln-l-grs-5-nuclide-map-v1.0). Gamma-ray intensity is not elemental abundance. The South Pole-Aitken product is regional; preserve its limits.

#### Acceptance

Decode a nuclide-map label and verify its units, projection, resolution and missing-value convention. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P113

### Moon: radar evidence of buried layers

Qualify the Kaguya LRS interpretation map and selected dated radar profiles for existing maps and prepared charts.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:sln-l-lrs-5-sndr-gsi-map-v1.0). An interpreted reflector is not a measured three-dimensional interior. Radar delay requires a stated material model before conversion to depth.

#### Acceptance

Inspect one interpretation-map product and one matching radar track; identify a presentation supported by the existing contract. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P114

### Moon: measured seismic signals

Prepare a small set of Apollo impact and moonquake waveforms with station, event time and calibration.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:apollo-ai-data). Scanned trace images and numeric waveforms are different products. Do not infer a global seismic map from a few stations.

#### Acceptance

Select a documented artificial impact and verify sample timing and instrument response against the source. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P115

### Venus: measured winds and atmospheric profiles

Use Akatsuki cloud-motion vectors and radio-science profiles in existing prepared charts; keep observing dates and altitude context.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:vco-00020). Cloud tracking measures motion at the observed cloud level. Profiles and winds are not a global instantaneous weather field.

#### Acceptance

Inspect one NetCDF vector file and one radio-science profile, including uncertainty and quality flags. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P116

### Sun: local magnetic and X-ray observations

Qualify a bounded Hinode magnetic observation and a dated X-ray comparison from Hinode or Yohkoh using existing prepared views.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:hinode-sot-sp-level2.1-mirror). Hinode slit scans are local and assembled over a scan interval. HAO field inversions retain ambiguity and model assumptions. Never stretch them over the whole Sun.

#### Acceptance

Choose one calibrated observation with coordinates and scan times; prove it fits the current view contract before preparing imagery. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P117

### 67P: dated thermal and infrared measurements

Extend beyond the already selected VIRTIS derived maps with calibrated MIRO continuum/spectral records and dated VIRTIS observations.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/holdings/ro-c-miro-3-esc1-67p-v3.0/dataset.shtml). Separate nucleus thermal emission from coma lines and mixed footprints. Older MIRO releases have different calibration.

#### Acceptance

Read the latest applicable MIRO calibration and select a nucleus-dominated footprint with independently checkable geometry. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P118

### 67P: gas and dust measurements

Prepare source-backed spectra, particle measurements and dated gas/dust curves from ROSINA, ALICE, GIADA, COSIMA and MIDAS.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/data_sb/missions/rosetta/index.shtml). Spacecraft measurements describe their sampled location and time; dust collector particles are not a nucleus surface map.

#### Acceptance

Select a calibrated measurement with units, uncertainty and spacecraft context; compare against an original published result. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P119

### 67P: Philae measurements at the landing site

Qualify MUPUS, SESAME, ROMAP, COSAC and Ptolemy measurements as local records in existing prepared charts.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/holdings/rl-c-mupus-2-sdl-v1.0/dataset.shtml). The landing sequence, sensor contact and instrument state affect interpretation. Do not generalize one site to the entire comet.

#### Acceptance

Read instrument-state and calibration records for one dated measurement before selecting a chart. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P120

### 67P: radio measurements of gravity and the interior

Qualify RSI and CONSERT observations and published inversions as measured curves or model constraints.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/holdings/ro_rl-c-consert-2-sdl-v2.0/dataset.shtml). Tracking volumes are often raw observation sessions. CONSERT inversion does not supply a direct three-dimensional photograph of the interior.

#### Acceptance

Find a documented derived product and compare its physical quantity and uncertainty with the existing 67P interior account. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P121

### Comets: native observations from historical flybys

Assess Halley, Borrelly, Wild 2 and Hartley 2 native camera and spectral records for source-backed packages or dated measurements. Tempel 1 stays in P45.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/data_sb/by_mission.shtml). A flyby has limited illumination and viewing geometry. New bodies must satisfy the generic object contract; sparse images do not justify invented global coverage.

#### Acceptance

Select one comet and a calibrated encounter sequence; establish usable coverage and registration before proposing its final surface. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P122

### Comets: measured changes in brightness and spectra

Qualify IHW, ground-based and space-based comet spectra, photometry and production-rate series for dated prepared charts.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/data_sb/by_target.shtml). Aperture size, distance correction, calibration and observing geometry control comparability. Coma measurements are not nucleus albedo.

#### Acceptance

Select one comet series with documented apertures and units; reproduce one source value and its uncertainty. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P123

### Earth: aurora, plasma and radiation measurements

Qualify dated Kaguya UPI, Akebono, Arase, Reimei, IMAP and related observations as registered imagery or measured curves supported by current preparation.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:sln-e-tex-5-plasmasphere-v1.0). Orbital samples and line-of-sight emissions are not global surface fields. Keep magnetic coordinates, altitude and time explicit.

#### Acceptance

Select one numeric observation and prove the existing image or chart contract can represent its coordinates without a renderer change. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P124

### Sky objects: X-ray and radio observations

Qualify DARTS MAXI, ASCA, Suzaku, XRISM and VSOP products through existing source-backed image and spectrum delivery.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:maxi-gsc-allsky). Mission archives contain raw events, backgrounds and quicklooks as well as science products. Source detection and calibrated images need separate checks.

#### Acceptance

Choose one calibrated image or spectrum of an already supported object and verify response, units, time and spatial registration. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P125

### Moon: SLIM measurements of individual rocks

Follow the SLIM MBC release for measured local rock spectra and named observing sites.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/missions/slim/). This audit found mission metadata, but no individual SLIM dataset record in the published DARTS dataset catalogue. The mission description alone cannot supply calibrated pixels.

#### Acceptance

Locate a public calibrated MBC product, native label and reuse terms before implementation. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P126

### Itokawa: measured X-ray composition constraints

Assess Hayabusa XRS records alongside existing AMICA and NIRS measurements.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:hayabusa-xrs-level1-data). The listed Level-1 data require calibration, solar illumination and footprint checks before elemental claims.

#### Acceptance

Read the XRS calibration and select a spectrum with solar-reference and geometry records. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P127

### Moon: measured plasma and exosphere observations

Qualify Kaguya PACE, radio-science electron columns and alpha-ray records as dated measurements in existing charts.

#### Source and limits

[Archive source](https://darts.isas.jaxa.jp/datasets/darts:sln-l-rs-5-electron-column-density-v1.0). Orbit samples, integrated columns and particle counts are different physical quantities. None is automatically a global abundance map.

#### Acceptance

Select one derived quantity with quality flags and compare it with an independent published value. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P128

### 67P: dated surface changes in native images

Assess calibrated OSIRIS and NAVCAM sequences against the existing 67P surface and registration limits.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/data_sb/missions/rosetta/index.shtml). Different shadows and viewing angles can imitate change. Preserve current shape and require a controlled comparison before claiming erosion or new deposits.

#### Acceptance

Choose a repeated patch with compatible geometry and quantify registration error before preparing a date pair. Retain provider product/version, observation time, units, missing values, uncertainty and the checked repository revision. Compare numeric results with a source reference. Use the existing renderer, shell, camera and controls; stop this scope if it needs a new rendering capability.

## P129

### Lucy: Dinkinesh and Donaldjohanson encounter measurements

Qualify L’LORRI imagery, MVIC and LEISA bands, L’TES spectra and radio science from the named encounters.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/data_sb/missions/lucy/index.shtml). Some camera products are only partially processed. Prove calibration, geometry and useful coverage before selecting a body surface; use the existing object contract.

#### Acceptance

Select one native product, verify its processing level, units, time, coordinates and missing values, then compare numerical samples with an independent source reference. Preserve the existing renderer, shell and camera. Record negative qualification results instead of filling missing measurements.

## P130

### Didymos and Dimorphos: observed impact and orbital changes

Combine qualified DART and LICIACube observations with calibrated ground-based photometry and published orbital measurements.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/data_sb/missions/dart/index.shtml). An expanding ejecta cloud is not a surface texture. Separate observed brightness, model-derived ejecta and the measured orbital change.

#### Acceptance

Select one native product, verify its processing level, units, time, coordinates and missing values, then compare numerical samples with an independent source reference. Preserve the existing renderer, shell and camera. Record negative qualification results instead of filling missing measurements.

## P131

### Exoplanets: EPOCh measured transit light curves

Qualify the derived EPOXI stellar photometry and selected calibrated images for existing exoplanet charts.

#### Source and limits

[Archive source](https://pdssbn.astro.umd.edu/holdings/dif-x-hriv-5-epoxi-exoplanets-phot-v1.0/dataset.shtml). Stellar systematics, contaminating light and time-standard conversion affect transit depth. A transit does not measure a resolved planet image.

#### Acceptance

Select one native product, verify its processing level, units, time, coordinates and missing values, then compare numerical samples with an independent source reference. Preserve the existing renderer, shell and camera. Record negative qualification results instead of filling missing measurements.
