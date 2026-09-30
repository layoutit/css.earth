# Moon source and preparation record

The Moon combines LRO imagery and numeric science products with interpreted geology and a modeled crust-thickness display, prepared on the shared raster lane used by Mercury, Venus and Mars.

The navigation marker uses its existing source map as a stylized identifier. The [marker recipe](source/preparation/navigation.json) crops and resizes it, then prepares a circular alpha edge and the shared full-phase curvature shading (35% ambient, 65% diffuse). It is not an observer projection or a view at the scene epoch.

## Sources

| View or quantity | Source |
| --- | --- |
| Monochrome surface | [LROC WAC global morphologic mosaic v1.3](https://data.lroc.im-ldi.com/lroc/view_rdr_product/WAC_GLOBAL_E000N1800_032P), 643 nm photography, 11,520 × 5,760 pixels |
| Elevation | LRO LOLA LDEM16 v3.1 |
| Mineral estimates, FeO, metallic iron, optical maturity, grain size | [Kaguya MI derived maps, May 2016](source/science/usgs/), numeric models within ±50° latitude |
| Midnight temperature, heat anomalies, rock abundance | [LRO Diviner GHRM v1.0](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/), 2009–2022, false-color thermal estimates within ±70° |
| Geology | [USGS Unified Geologic Map v2 (2020)](https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020), 49 units |
| Silicate signature | [Lucey et al. (2021)](https://zenodo.org/records/4558194), Christiansen-feature wavelength |
| Crust thickness | [NASA GRAIL visualization](https://svs.gsfc.nasa.gov/4014/), based on gravity and topography models |
| Gravity, Bouguer gravity | [GRAIL GRGM1200A maps](https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/rsdmap/), NASA GSFC, PDS release 2016-04-01: free-air anomaly and Bouguer disturbance in mGal, summed to degree 660, 16 pixels/degree. See [GRAIL gravity views](#grail-gravity-views). |
| Surface elements: thorium, potassium, iron (FeO), titanium (TiO₂) | [Lunar Prospector GRS elemental abundance, LP-L-GRS-5-ELEM-ABUNDANCE-V1.0](https://pds-geosciences.wustl.edu/missions/lunarp/grs_elem_abundance.html), table LPGRS_HIGH1_ELEM_ABUNDANCE_2DEG: [Prettyman et al. (2006)](https://doi.org/10.1029/2005JE002656), 1998 gamma-ray spectra from 100 km, 2° equal-area pixels. See [Surface elements](#surface-elements). |
| Roughness | [LRO LOLA LDRM_16 V2.0](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldrm_16.lbl), mean height scatter about a plane over 30–120 m, July 2009 to December 2011, 16 pixels/degree; the label cites [Zuber et al. (2012)](https://doi.org/10.1038/nature11216). See [Roughness](#roughness). |
| Maximum and noon temperature | [LRO Diviner Global Cumulative Products, LRO-L-DLRE-5-GCP-V1.0](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/): bin-average bolometric temperature per 0.5° cell and quarter-hour of local time, 2009–2015, [Williams et al. (2017)](https://doi.org/10.1016/j.icarus.2016.08.012). See [Daytime temperature](#daytime-temperature). |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MOON/target) the Moon centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |
| Lighting | The Hapke model of [Sato et al. (2014)](https://doi.org/10.1002/2013JE004580) at 643 nm, the model the monochrome mosaic was corrected with, recorded in [`source/photometry/sato-2014-hapke-643nm.json`](source/photometry/sato-2014-hapke-643nm.json). See [Lighting law](#lighting-law). |

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

Photographic refresh, 12 September 2026,: the new native
LROC map replaces the 2K CGI texture. These are actual Chrome captures at the
same Copernicus camera, 1280 × 720, DPR 1; the crops omit the sidebar. The
before atlas was reproduced with the exact delivery hash.

| Before | Current |
| --- | --- |
| ![Copernicus from the former texture](evidence/photographic-detail/before.png) | ![Copernicus from native LROC photography](evidence/photographic-detail/after.png) |

The PDS reader's two focused checks cover pixel-centre registration, 180° output
origin, footprint integration, observed black and invalid samples. Preparation
build/type checks, source-record generation and unchanged scene/geometry checks
pass. Browser inspection covers Shadows on/off and the same canonical atlas at
DPR 1 and 2. The five photographic files total 17.54 MB, previously 2.28 MB;
the largest decoded atlas is 195 MiB. This is a photographic refresh, not a new
qualification of the scientific views. Seven unrelated scientific thumbnails
were unavailable in the local checkout; the cross-body search preview was
restricted to Moon, Europa and Io.

Earlier shared-lane migration: the static-surface lane was retired for the Moon; the same pinned inputs and the same numeric interpretation (`observationRaster`) now feed the shared raster lane. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the three GHRM grids, LOLA, the Christiansen feature and the geology grid were re-anchored at the Copernicus, Tycho and Tsiolkovskiy cells after the lane change. No new science review is claimed.

The September 2026 lunar thermal review records source, reproduction, Chrome, installation and test results. All three numeric grids reproduce exactly; 507 independent original-to-atlas probes and eight separately fetched byte anchors pass. Browser captures cover DPR 1 and 2, close zoom and the narrow selector. The scene geometry and retained tree of that review belong to the retired static lane; the current tree is the shared raster-lane sphere. Aggregate readiness remains limited by the shared audit and missing unrelated build inputs.

[Earlier independent source anchors](source/validation/scientific-source-anchors.json) preserve LOLA and the superseded Diviner GDR L3 decoder evidence; they do not validate the new GHRM values.

## Known problems

The existing atlas seams can remain visible at extreme close zoom. This change
retains the geometry and its packing layout.

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for the Moon (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code and the 7,063 lettered satellite craters (“Tycho A” and the like, which repeat a parent name), folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Tycho and Copernicus coincide with the imagery. The replacement monochrome WAC map preserves that 180° E output edge.

Landing sites: 80 spacecraft landing, touchdown or impact sites and 2 published traverse paths are labelled beside the IAU names (`source/features/sites.json`). Each coordinate quotes the NASA NSSDCA, PDS, LROC, agency or paper page it was read from, with the stated latitude kind and longitude convention; sites are unsized points ranked like a 20 km feature and the caption shows the quoted source sentence with its publisher.

Feature notes: 1749 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- LOLA's 0.5 m quantization and map spacing are not terrain-accuracy estimates; geometry stays spherical.
- Diviner midnight maps combine 2009–2022 observations, not current temperatures. Unobserved polar caps and internal gaps stay neutral. Thermal-model anomalies retain terrain effects and do not establish geothermal activity. Rock abundance estimates area fraction, not boulder counts; values above 2% share the top display color. Per-cell uncertainty is not supplied.
- Christiansen-feature values are wavelengths, not mineral abundances. Coverage stops at ±70° and residual viewing effects remain.
- Geology colors are interpretations; the GRAIL display depends on model assumptions.
- The monochrome mosaic retains photographed crater shadows and differences between observation strips. The Shadows control adds spherical illumination; it cannot relight those shadows. Gray grid marks missing observations. The 947.6 m source grid is not an estimate of camera accuracy. Polar sprites retain their existing resolution.
- The scene now uses the shared physical frame: pole, prime meridian and Sun direction at the shared epoch come from the IAU/WGCCRE rotation model in `src/platform/solar-geometry.mts`, and the Shadows toggle drives the terminator frames of the Hapke lighting bank (see Lighting law). The retired lane showed limb curvature only.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Package records, physical facts and sky</summary>

The Moon is a first-class cssEarth object. It is not mounted inside Earth.

Authored geometry, observation-processing parameters, controls, legends and
physical source bindings live in `source/preparation/`, `source/presentation/`
and `source/content/object.json`, pinned by `object.json`. The generic authored
preparation (`site/build/prepare/prepare-authored.ts`: raster, celestial, scene,
content, composite presentation, features) compiles those records into
`prepared/*.json`. Each numeric scientific dataset declares its interpretation in
the `science` block of `source/preparation/raster.json`; the shared observation
painter decodes source values and missing coverage before display colour is
chosen, at both prepared densities. Unit checks live under
`tests/objects/unit/moon/`; browser checks use the shared conformance suite.

## Physical and orbital facts

- NASA JPL Solar System Dynamics satellite physical parameters:
  <https://ssd.jpl.nasa.gov/sats/phys_par/sep.html>
- NASA JPL Solar System Dynamics satellite mean elements:
  <https://ssd.jpl.nasa.gov/sats/elem/sep.html>
- The checked `source/orbit/moon.json` records the extracted Moon values and
  exact authority-page hashes.

## Lighting law

The globe is lit with the Hapke model of [Sato et al. (2014)](https://doi.org/10.1002/2013JE004580) in the WAC 643 nm band. The monochrome mosaic was made from the same band, and its [README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_GLOBAL/WAC_GLOBAL_README.TXT) says each image was corrected with this model. Each lighting frame is the law relative to the flood-lit disc centre, so the centre of the default view shows the map as published. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).

| Value | Where it comes from |
| --- | --- |
| Model form | Appendix A, eq. A1 to A9: Hapke (2002) H function, two-term Henyey-Greenstein phase function whose (1 + c)/2 lobe scatters backward |
| B_C0 0, h_C 1, K 1 | Table 1 and section 2.3 |
| Roughness 23.657° | The PDS parameter map's THETA band and README; the paper prints 23.4° (Table 1, Figure 8) |
| w 0.3854, b 0.2375, h_S 0.0672 | Medians of the [PDS 643 nm parameter map](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_HAPKEPARAMMAP) over 30°S to 30°N, the region the paper uses for its all-area trends (Figure 17f). The paper prints no global w. It prints b 0.26 for the maria and 0.23 for the highlands, and h_S 0.050 and 0.074 (section 3.4). The medians fall between them. |
| c 0.3253 | Eq. 2 from b |
| B_S0 1.686 | Eq. 4 from w, b and c, with the 643 nm gradient 2.459 and intercept 0.078 of Table 2 |
| Fitted angles | Incidence below 75°, emission below 30°, phase below 97° (sections 2.2 and 2.3) |

- The WAC looks almost straight down, so the fit saw emission only up to 30°. Toward the limb the law is held at 30°. Beyond that the limb follows no measurement.
- With the Sun behind the viewer the law hardly darkens the limb: 0.996 of the centre at 30° emission and beyond. The shared bank it replaces (Lambert with a 0.35 floor) darkened it much more.
- One set of values lights the whole globe. The paper's maps vary by tile: w from 0.27 to 0.44 between the 16th and 84th percentiles over 30°S to 30°N.
- The bank was redrawn on 2026-09-25 with [`node tools/objects/dist/prepare-authored.js moon --write --reuse-images --accept-changed=raster`](https://github.com/layoutit/css.earth/blob/0f0384e90c/tools/objects/prepare-authored.ts) (now [`site/build/prepare/prepare-authored.ts`](../../../site/build/prepare/prepare-authored.ts)). Outside `lighting`, the only difference between the published recipe and this one is main's removal of `"polesCombined": false`. That changes no image: `false` already meant each dataset writes its own poles, now the only path. The shadowless overlay's alpha along its centre row, main then this version: 0.000 then 0.000 at the centre, 0.086 then 0.004 at half the radius, 0.353 then 0.004 at 0.9 and 0.490 then 0.004 at 0.98.

## Scene and sky

- The lighting follows the published Hapke law described under
  [Lighting law](#lighting-law).
- The directional Sun follows the repository's clean-room directional-sun
  preparation standard. Its direction,
  the pole and the prime meridian at the shared epoch come from the IAU/WGCCRE
  rotation model through `src/platform/solar-geometry.mts`, as for every
  prepared body; the previous static lane claimed no epoch orientation.
- The prepared mesh is the shared sphere: 230 units, 16 latitude bands and 32
  longitude segments, the 50-pixel tile, 0.005 seam overlap, spin origin 0°
  and an 84-second visual rotation (an accelerated presentation choice). The
  6.68° obliquity and the 27.322-day rotation are recorded with the body from
  `source/orbit/moon.json`. The Moon draws its own 256-frame lighting bank
  from that law, with no atmosphere.

</details>

<details>
<summary>Visible surface and crust-thickness sources</summary>

The surface uses `WAC_GLOBAL_E000N1800_032P` v1.3, the original attached-label
PDS3 float map. Its label identifies observations from 7 November 2009 to
31 January 2011, a 1,737.4 km planetocentric sphere, east-positive longitude,
32 pixels/degree and a 0–360° extent. The file name describes the map centre;
the label's projection origin is 0°. Preparation reads the actual offsets,
then rotates the output's left edge to 180° E to retain the existing feature registration.

[LROC's native README](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_GLOBAL/WAC_GLOBAL_README.TXT) documents the
GLD100/LOLA projection surfaces, LOLA/GRAIL ephemeris, camera calibration and
Hapke photometric correction. See [Speyerer et al. (2011), abstract 2387](https://www.lpi.usra.edu/meetings/lpsc2011/pdf/2387.pdf)
and [Wagner et al. (2015), abstract 1473](https://www.hou.usra.edu/meetings/lpsc2015/pdf/1473.pdf).

The float reader integrates the original pixel footprints into 4,096 × 2,048
and 8,192 × 4,096 display maps. Every contributing sample must be valid; the
PDS special values are withheld and observed zero stays black. Display brightness
is `255 × min(1, (4 × reflectance)^(1/2.2))`. No gaps are interpolated or painted
as terrain. The same interpretation supplies the atlas, polar sprites, thumbnail
and small sidebar map. Latitude bands, UV coordinates, geometry and lighting remain fixed.

The source survey compared the NASA CGI Moon Kit, the LROC Hapke v1.2 colour
tiles and this morphology product. The larger CGI map still fills gaps and uses
LOLA albedo at the poles. Native colour tiles avoid that fill but stop at ±70°
and showed less crater relief. The selected morphology map provides sharper
photographed terrain and polar observations; it is explicitly monochrome.
The old 2K Moon Kit remains the small navigation sprite's source.

</details>

<details>
<summary>Numeric datasets, missing data and qualification limits</summary>

## Numeric scientific datasets

The topography dataset consumes `source/science/ldem_16.img`, the 5,760 × 2,880
LRO LOLA LDEM_16 V3.1 grid from the [NASA PDS release](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.xml).
David E. Smith and the GSFC LOLA team produced this global 16-pixel/degree
product from 2009–2016 observations. Signed little-endian 16-bit samples encode
height in half metres above the 1,737.4 km reference sphere. The label offset
1,737,400 m converts heights to planetary radii and is deliberately **not** added
to the displayed elevation. This is not height above a geoid. The source grid
includes interpolation and processing-band artifacts; its cell size is about
1.895 km at the equator, and 0.5 m quantization is not an accuracy estimate.
There is no per-cell uncertainty or no-data constant in the selected product.
The full array spans −8,981.5 to +10,685.5 m; the authored color scale spans
−12 to +12 km. Numeric color does not displace the retained spherical geometry.

The three nighttime datasets use the [LRO Diviner GHRM v1.0 float32 mosaics](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/),
produced by Powell and the UCLA Diviner team from 2009–2022 observations.
The exact product labels, original hash pins, compact numeric grids and conversion
receipts live in `source/science/diviner-ghrm/`; candidate selection and independent
checks are recorded in the lunar thermal source review.

The [shared converter](../../../packages/bake/src/objects/acquisition/diviner-ghrm.py) runs
each `prepare-*.json` in that source directory. Use its `--source-directory` and
`--output-directory` options to reproduce the compact grid separately and compare
it with the pinned output.

- **Midnight temperature**: fitted bolometric temperature at local midnight,
  shown from 80 to 140 K. This combines many nights, not current temperatures.
- **Heat anomalies**: observed minus typical-regolith modeled bolometric
  temperature at slope-adjusted midnight, shown from −10 to +10 K. Negative
  anomalies remain valid. Terrain correction residuals remain; warm colors
  do not establish geothermal activity.
- **Rock abundance**: inferred rock-area fraction at slope-adjusted midnight,
  displayed in percent surface area from 0 to 2%. Values above 2% share the
  top color. This is a thermal-model estimate, not individual boulder counts.

Each original is 46,080 × 17,920 little-endian float32 cells with NaN gaps,
0–360° east-positive longitude and north-down rows between ±70°, on the
Moon_2000 reference sphere (radius 1,737.4 km), mean-Earth/polar-axis frame.
There is no DN scaling in the originals. The 128-pixel/degree spacing is about
237 m at the equator; the paper estimates effective resolving power around
330 m longitudinally and 700 m latitudinally there. Grid spacing is not accuracy.

Windowed preparation retains nearest native samples on a global 4096 × 2048
grid, packs temperature to 0.01 K and rock fraction to 0.00002, and never fills
missing cells. Maximum quantization error is 0.005 K or 0.001 percentage point.
Physically invalid rock fractions outside [0,1] are rejected before sampling;
none occurred in this selected product. Native valid area covers 93.9687% of
the sphere for midnight temperature, 93.8869% for anomalies and 93.8867% for
rock abundance. The two unobserved polar caps and internal gaps retain the
neutral coverage pattern. The original ranges exceed the selected display
scales; endpoint colors are saturation, not rejection or a scientific limit.

The older Bandfield GDR L3 32-pixel/degree rock map (2009–2010, ±60°) and its
independent raw-DN anchors remain archived for provenance but no longer drive
the rock-abundance dataset. The expanded record and GHRM thermal model replace it.

Numeric output retains its −180° left-edge origin, established against the
previous SVS color map. The new LROC photograph uses the equivalent 180° E
left edge; the original PDS coordinates are not relabeled. Fixed
output-cell checks at USGS/IAU Copernicus, Tycho and Tsiolkovskiy coordinates
verify the corresponding source values through the numeric painter. These are
landform alignment anchors, not a claim of subpixel survey accuracy.

Nearest display sampling preserves selected numeric values and gaps: each
numeric dataset is painted directly at 2,048 × 1,024 and 4,096 × 2,048 from the
source grid (no image resampling), latitude-band packing copies pixels, polar
tiles use nearest pixel-center samples, and thumbnails use nearest resizing.
Surface, pole and thumbnail WebPs of numeric datasets are lossless. This preserves
prepared palette colors, not a claim that browser-transformed screen pixels
are quantitative samples. The new monochrome photograph uses footprint integration and lossy WebP;
the unchanged GRAIL display uses Lanczos resampling and lossy WebP.
Independent B10 checks bind all original, compact and runtime hashes and verify
507 original-to-texture probes plus eight separately fetched raw-byte anchors.
The earlier LOLA numerical anchors remain in
`source/validation/scientific-source-anchors.json`.

The GRAIL crustal-thickness print remains unchanged at
`source/lenses/grail-crustal-thickness-print.jpg` from
[NASA SVS](https://svs.gsfc.nasa.gov/4014/). It is a gravity/topography-derived
interior model with assumed densities, shown with shaded relief. It has not
become a new numeric crust grid. The old LOLA press JPEG is no longer an active
input; its existing local file is not removed. All datasets use the same shared
sphere mesh and polar-tile topology; every dataset legend is declared beside its
dataset in `source/content/object.json` (colour stops, labels and units).

PDS publicly archives these NASA mission scientific products. Preserve the
named producers, exact product/version, original archive links and [PDS data
citation](https://pds.nasa.gov/datastandards/citing/) when reusing the derived
visualizations. The selected labels specify no separate Creative Commons
license; this package does not invent one or relicense a journal article.

## Qualification

The standalone Moon is a source-backed retained-DOM presentation on the
shared raster lane. Its mean heliocentric distance is catalogued as 1 AU for
navigation and its world frame comes from the shared solar geometry at the
shared epoch. The camera and background sky do not represent an observer at a
stated epoch, and no native camera parity is claimed.

</details>

<details>
<summary>Geologic units and silicate-signature measurements</summary>

## B6 mapped science

The geology view samples the 49 original units in Fortezzo, Spudis and Harrel's
[Unified Geologic Map v2 (2020)](https://astrogeology.usgs.gov/search/map/unified_geologic_map_of_the_moon_1_5m_2020), scale 1:5 million.
It preserves holes and withholds conflicting units. Its distinguishable palette
is authored for this display; colors are interpretations, not observed color.

The silicate-signature view uses the space-weathering-corrected Christiansen
feature from [Lucey et al. (2021)](https://zenodo.org/records/4558194), DOI
10.5281/zenodo.4558194, CC-BY-4.0. Measurements span July 2009–May 2016.
The published latitude and longitude TIFFs explicitly locate the samples; the
intake verifies every coordinate cell before nearest sampling. Coverage is
±70 degrees. Values are wavelengths in micrometers, not mineral abundances.
The fixed 8.0–8.5 µm display clips source outliers; gaps remain unavailable.
Residual viewing/topographic effects remain, especially above 50 degrees.
The older 2011 PDS noon map was inspected and rejected for its sparse coverage.

Exact bytes, coordinates and validity rules are in the intake plans and receipts.
See the [mapped-science conversion method](../../../packages/bake/src/objects/acquisition/MAPPED-SCIENCE.md).

</details>

## GRAIL gravity views

Two views show the Moon's gravity field as GRAIL measured it. Both use the
GRGM1200A field from NASA Goddard's GRAIL team, built from the whole mission's
tracking data (1 March to 14 December 2012). The PDS label names
[Lemoine et al. (2014)](https://doi.org/10.1002/2014GL060027) as the field's
reference.

| View | Product | What it shows |
| --- | --- | --- |
| Gravity | [GGGRX_1200A_ANOM_L660](https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/rsdmap/gggrx_1200a_anom_l660.lbl) | Free-air gravity anomaly in mGal: the measured field minus that of a uniform sphere, with nothing removed for topography |
| Bouguer gravity | [GGGRX_1200A_BOUG_L660](https://pds-geosciences.wustl.edu/grail/grail-l-lgrs-5-rdr-v1/grail_1001/rsdmap/gggrx_1200a_boug_l660.lbl) | Bouguer disturbance in mGal: the same field after the GRAIL team removed the pull of LOLA topography, taken as rock of 2,500 kg/m³ |

One mGal is 0.01 mm/s². Both maps give values on a 1,738.0 km reference sphere
in the lunar principal-axis frame of DE430. They are 16 pixels per degree
(about 1.9 km at the equator), global, with no missing cells.

**How the views relate to Crust.** The Crust view is not a measurement. It is
a model of crustal thickness that GRAIL scientists inverted from gravity and
topography, and it depends on the densities they assumed for crust and mantle.
The Bouguer view is the step before such a model: gravity with the
topography's pull removed, under one stated density. A crustal-thickness model
then turns what is left into a thickness, with its own density choices. The
Gravity view is the measured field itself, before either step. Positive Bouguer values usually mean dense mantle lies closer to
the surface, as under the mare basins' mascons
([Neumann et al. 2015](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4646831/)).

**Degree 660.** The field is a sum of spherical harmonics up to degree 1200.
The archive publishes each map summed to several degrees. The label says that
terms above degree 600 are held toward a power-law prior (Kaula,
3.6 × 10⁻⁴/n²). Degree 660 is the archived sum just above that limit. Its
shortest half-wavelength, π × 1,738 km / 660 ≈ 8.3 km, spans about three
texels of the 4,096-pixel numeric texture (2.7 km), so the texture keeps every
term the map carries. The degree-900 and degree-1200 maps add terms that the
prior increasingly shapes.

**Colours.** Blue is below zero and red above, the same palette as Heat
anomalies. Gravity spans ±400 mGal and Bouguer gravity ±600 mGal.
These are display stretches chosen from each map's own spread, not scientific
limits: 1.0% of the Moon's area lies beyond the Gravity stretch and
1.3% beyond the Bouguer one. Those areas show the end colours.

### Evidence

- The datasets read the archive's EXTRAS GeoTIFF copies. The volume's
  [extrinfo.txt](source/science/grail/extrinfo.txt) says they hold the same data
  as the RSDMAP images. A byte-level comparison agreed on all 16,588,800 cells
  of each map after shifting the GeoTIFF's −180° left edge to the image's 0°.
- The GeoTIFF tags a 1,737.4 km Moon_2000 ellipsoid. That is a setting of the
  GIS container: the RSDMAP label, which governs the values, gives the 1,738.0 km
  sphere. The geographic grid reads the same either way.
- The migrated PDS4 labels (`.xml`) swap the upper-left corner coordinates. The
  original PDS3 labels are kept here and used instead.
- The Moon's recipe block, read through the shared scientific loader, returns
  the IMG value at all 831 probe points, including the seam and both poles.
- Published comparison: [Neumann et al. (2015), Table 1](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4646831/)
  gives the Bouguer contrast of the central high of each lunar basin. For the 14
  basins from Orientale to Mendeleev, the peak-minus-trough of this map's
  azimuthally averaged profile is 1.04 to 1.44 times theirs (median 1.13,
  correlation 0.987). Orientale: 798 mGal here, 720 ± 28 there. They used the
  earlier GRGM900C field filtered to degrees 6 to 540, so a somewhat larger
  contrast is expected from a field kept to degree 660.
- The largest Bouguer value, +741 mGal, lies at 19.5° N, 55.5° E in the
  Crisium basin. The free-air extremes, −1,330 and +1,782 mGal, lie in the farside
  highlands between 201° and 210° E near the equator; that map keeps the pull
  of topography.
- All check results, with the tested
  file sizes and hashes. Flat previews painted with the dataset palette were
  inspected; they are not in the repository.

### Known problems

- Gravity is in the principal-axis frame; the surface and other views are in
  the mean-Earth frame. Positions differ by about 1 km at the surface
  ([LRO coordinate white paper](https://science.nasa.gov/wp-content/uploads/2024/01/luncoordwhitepaper-10-08.pdf)),
  under half a numeric texel. No frame conversion is applied.
- Values above degree 600 are partly shaped by the prior. Formal uncertainty
  varies across the Moon; the archived error map gives 0.6 to 5.3 mGal (1σ) at
  the 14 basin centres checked.
- The Bouguer view assumes one density everywhere. Dense mare basalt is not
  removed, so part of the positive signal over the maria is basalt fill rather
  than mantle uplift.
- Numeric colour does not displace the globe. Lighting and shading are the
  shared Moon lighting, not part of the data.

## Daytime temperature

Two views show how hot the Moon's surface gets by day, from the LRO Diviner
[Global Cumulative Products](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/) (LRO-L-DLRE-5-GCP-V1.0, product version 1),
made by J.-P. Williams and the UCLA Diviner team and described by
[Williams et al. (2017)](https://doi.org/10.1016/j.icarus.2016.08.012). The
archive compiles every nadir observation from 5 July 2009 to 1 April 2015 into
eighteen tables, one per 10° of latitude. Each row is the average bolometric
temperature of one 0.5° cell in one quarter-hour of local time; −9999 marks a
bin with no observation. Midnight temperature comes from a different product,
GHRM, which holds night-time fits only.

| View | Rule | Coverage |
| --- | --- | --- |
| Maximum temperature | The warmest quarter-hour average of each cell | Every cell |
| Noon temperature | The mean of the four quarter-hour bin averages from 11:30 to 12:30 that hold data | 98.64% of the area |

No archived bin is centred on noon: the two nearest are centred 7.5 minutes
either side. The window was chosen by measurement on the converter's output.
Those two bins alone (11:45–12:15) cover 87.25% of the area and leave streaks
and one large gap on the nearside. 11:30–12:30 covers 98.64% and differs from
them by 1.03 K at the median and 7.32 K at the 95th percentile where both
exist. 11:00–13:00 covers everything but moves the values by 1.89 K and
10.66 K. Nothing is fitted or filled. For 82% of cells the maximum falls
within an hour of noon.

The shared converter `packages/bake/cli/diviner-gcp-grid.mts` reads the tables
row by row (0.8 GB memory, 20 s) with the recipe
[`source/science/diviner-gcp/prepare-tbol.json`](source/science/diviner-gcp/prepare-tbol.json)
and writes the two 720 × 360 float32 grids beside it, with a receipt of every
input and output hash. Two runs wrote byte-identical grids.

**Colours.** Both views use the Midnight temperature palette over one shared
range, 220 to 400 K, so they can be compared. 220 K is just below the 1st
percentile of the noon view (222 K; the maximum's is 242 K) and 400 K just
above both 99th percentiles (395 K). 0.41% of the area is colder than 220 K in
the maximum view and 0.94% in the noon view; almost none is above 400 K.

### Evidence

- For three strips, including the one with the faulty label, a separate reading
  of every row rebuilds both rules and matches the grids at all 43,200 cells
  (checks).
- Within 5° of the equator the maximum's 5th to 95th percentile is 388 to 396 K;
  Williams et al. (2017) report daytime maxima of about 387 to 397 K there.
- Their abstract says dark surfaces reach higher maxima and bright ones lower.
  Here Mare Tranquillitatis reaches 394.5 K and the farside highlands 389.9 K;
  bright young Tycho 349.5 K and Aristarchus 376.2 K.
- Flat previews painted with the dataset palette were inspected; they are not in
  the repository.

### Known problems

- Noon gaps are thin streaks, mostly on the nearside: coverage is lowest at
  40–50°N (96.1%). They show as gray grid.
- These are averages of many days, not one day's temperatures, and at 0.5°
  (about 15 km) they blend terrain. Large craters still show as temperature
  differences.
- The PDS4 labels give the paper DOI as 10.1026/j.icarus.2016.08.012; it is
  10.1016/j.icarus.2016.08.012. The PDS3 label of the 40°S–30°S strip exchanges
  its minimum and maximum latitude; its rows and file name agree with 40°S–30°S,
  and the recipe records the defect.

## Surface elements

Four views, grouped under Surface elements, show what Lunar Prospector's
gamma-ray spectrometer found in the lunar soil: thorium and potassium in parts
per million, iron as FeO and titanium as TiO₂ in weight percent. They come from
one PDS table, [LPGRS_HIGH1_ELEM_ABUNDANCE_2DEG](https://pds-geosciences.wustl.edu/lunar/lp-l-grs-5-elem-abundance-v1/lp_9001/data/lpgrs_high1_elem_abundance_2deg.lbl),
in the data set LP-L-GRS-5-ELEM-ABUNDANCE-V1.0 (PDS release 2012-10-24, PDS4
version 1.1). It holds the abundances of [Prettyman et al. (2006)](https://doi.org/10.1029/2005JE002656),
found by splitting each map pixel's spectrum into modelled element spectra.
Its [data set description](https://pds-geosciences.wustl.edu/lunar/lp-l-grs-5-elem-abundance-v1/lp_9001/catalog/dataset.cat)
explains the method, errors and limits used here.

| View | Column | Display | Median uncertainty (1σ) |
| --- | --- | --- | --- |
| Thorium | W_TH, ppm | 0 to 10 ppm | 0.26 ppm |
| Potassium | W_K, ppm | 0 to 3,500 ppm | 228 ppm |
| Iron (FeO) | W_FEO, g/g × 100 | 0 to 25 weight % | 1.0 weight % |
| Titanium (TiO₂) | TIO2, g/g × 100 | 0 to 8 weight % | 0.52 weight % |

**Where the data come from.** The spectra were taken from about 100 km up
between 17 January and 7 October 1998. At that height the instrument blurred
the surface over about 5° of arc, some 150 km. The table uses equal-area pixels
2° high (about 60 km), so neighbouring pixels share much of what they saw. The
data set says FeO, TiO₂, K and Th are the columns Prettyman et al. evaluated at
2°; it advises caution with the other oxides at that size, so they are not shown.

**Reading the table.** The table is not a grid. Each of its 91 latitude bands is
split into as many pixels as keeps their areas about equal (the smallest,
around the 1° polar caps, has 0.75 of the largest area). A new shared reader
(`pds-equal-area-table`, drafted for `packages/bake/src/objects/raster/pds/`)
cuts each row at the byte positions of the release's format file, checks that
the pixels tile the sphere exactly as printed, and colours every display texel
with the pixel that contains it. Nothing is interpolated. The display grid is
the same numeric texture as the other views, so pixel edges show as steps.

**Colours.** The palette is the one the mineral views use. Each range is a
round value just above the 99th percentile by area, so under 1% of the Moon
shows the top colour: 0.46% for thorium, 0.76% for potassium, 0.55% for FeO
(the same 0–25% range as the Kaguya Iron content view) and 0.49% for TiO₂.

**Zeros.** The release has no negative values. TiO₂ is exactly zero over 18.7%
of the Moon's area and potassium over 3.8%: there the fit found none at a
precision of about 0.5% TiO₂ or 230 ppm K. They are shown as zero, as archived.

### Evidence

- Every one of the 11,306 pixels, probed at its centre and just inside its four
  corners, returns the value an independent whitespace split of the row gives,
  for all four views (226,120 probes, no mismatch).
- Thorium and potassium light up the nearside KREEP region and iron and
  titanium the maria, as expected. Thorium peaks at 11.6 ppm near 0°N, 18.75°W, beside the Apollo 14 site (10.7
  ppm), inside the Procellarum KREEP region; the farside highlands at 0°N, 180°E
  hold 0.86 ppm. Titanium peaks at 12.0% at 12°N, 25°E in Mare Tranquillitatis.
  FeO runs from 2.6% on the farside to 21% at the Apollo 12 and Luna 16 sites.
- [Lawrence et al. (2022)](https://doi.org/10.1029/2022JE007197) report Th above
  12 ppm at Timocharis and the Apennine Bench in a sharper 0.5° reconstruction.
  This table's coarser pixels there hold less, as the 150 km footprint predicts.
- All check results, with pixel values at nine
  landing and sample sites and the tested file sizes and hashes. Flat previews
  painted with the dataset palette were inspected; they are not in the repository.

### Known problems

- The full text of Prettyman et al. (2006) could not be read from this machine
  (the publisher served a challenge page), so no value was compared with the
  paper's own tables. The checks above are the archive's values and their
  geographic pattern.
- The largest FeO, 30.7% at 30°N, 57°W in Oceanus Procellarum, is above any
  returned soil; the paper notes western Procellarum is not well represented by
  the sample collection. It shows the top colour.
- The label's description says "5 degree" pixels and the readme says columns are
  comma-separated; the file name, row count and format file give 2° pixels and
  fixed-width, space-separated columns. The column for TiO₂ is named TIO2, not
  W_TIO2. The reader follows the format file.
- Lunar Prospector has no mission record in the facility catalogue, so these
  views carry no mission attribution edge yet.

## Roughness

The Roughness view shows how bumpy the ground is over tens of metres. It reads
[LDRM_16](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldrm_16.lbl), product version V2.0 of the LOLA gridded data set
LRO-L-LOLA-4-GDR-V1.0, made by David E. Smith's GSFC team in 2012 from laser
shots of 13 July 2009 to 11 December 2011 (mission phases through LRO_SM_17).
The label cites [Zuber et al. (2012)](https://doi.org/10.1038/nature11216).

The label defines each value as the residual standard deviation of altitudes
from three successive laser shots after fitting a plane to their 5 to 15
returns, averaged over the shots in each 1/16° pixel (about 1.9 km). The
distance the fit spans, the baseline, varies from 30 to 120 m with orbital
speed, detection and altitude. Values are metres (signed 16-bit millimetres);
the existing `pds3-grid` reader decodes them and withholds the label's
MISSING_CONSTANT, −32768. That covers 4.4% of the Moon's area in scattered
pixels, most at 70–90° latitude (up to 11% of a 10° band). Nothing is filled.

**Colours.** 0.5 to 2 m, the 1st and 99th percentiles by area (0.50 and 1.93 m)
rounded; 1.0% of the area lies below and 0.74% above, and shows the end colours.
Viridis, as on the Mars thermal-inertia view. The median is 0.92 m.

### Evidence

- 331,175 lattice probes, including the seam and both poles, return the value of
  an independent decode of the image, and are missing exactly where it holds
  −32768 (checks).
- Registration and pattern: Tycho, the roughest large feature, lands at its IAU
  position (median 3.0 m within 0.3° of 43.3°S, 348.7°E); the maria read smooth
  (Tranquillitatis 0.73 m, Serenitatis 0.81 m, Imbrium 0.91 m) and the farside
  highlands rough (1.20 m at 0°N, 180°E).
- The label cites no values to compare with. Flat previews were inspected; they
  are not in the repository.

### Known problems

- Because the baseline varies from 30 to 120 m, pixels are not all measured at
  the same scale; the product is not the fixed-baseline roughness of the later
  LDRM_32 family.
- The newer LDRM_32 products (2019, 25 m baseline, noise-corrected) were tried
  first. At the display textures (about 11 texels per degree) the pixels the
  producer had interpolated, 37% of the area, showed as speckle once withheld;
  see the [investigation ledger](investigations.json).

## Catalogue attribution

The GRAIL crustal-thickness print and the two GRGM1200A gravity maps are attributed to the GRAIL mission. GRAIL-A (Ebb) and GRAIL-B (Flow) have separate vehicle records and are mission participants. The preserved print credit does not itself establish separate vehicle-level contribution edges. LRO-derived datasets retain their explicit LRO spacecraft/mission attribution. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json). Dataset bytes and rendering are unchanged by this metadata migration.

## Kaguya numeric views

Eight views use the May 2016, 512-pixel-per-degree Kaguya MI derived products
published by USGS. These are the ±50° maps made from MI MAP level 02, not the
later global version-3 products. The native labels and acquisition recipes are
in [source/science/usgs](source/science/usgs/).

Olivine, orthopyroxene, clinopyroxene and plagioclase store mass fractions;
preparation multiplies them by 100 for weight percent. FeO is already weight
percent. Submicroscopic metallic iron is a fitted space-weathering parameter
with the release's seven model amounts from 0.5 to 7 weight percent. The
plagioclase grain-size fit chooses 17 or 200 µm; its legend shows two model
classes. OMAT is dimensionless: smaller values mean greater optical maturity,
not a measured age.

The [original methods](https://www.hou.usra.edu/meetings/lpsc2016/pdf/2994.pdf)
and [Lemelin's dissertation, chapter 3, pp. 44–45](https://www.soest.hawaii.edu/earthsciences/wp-content/uploads/2025/09/MLemelin_Dissertation.pdf)
describe the spectral library and its assumptions. Mature soils with weak
absorption bands can be assigned too much plagioclase; interpret mineral
patterns together with OMAT. The metallic-iron model amounts are not a direct
chemical assay of lunar soil.

The ninth product, the weighted spectral-fit criterion, supplies a finite,
nonnegative validity check. All eight new views use it as a conservative
shared coverage gate, including the independently calculated FeO and OMAT.
It has no published universal acceptance threshold, so no confidence cutoff is
asserted. FeO also excludes estimates outside the physical 0–100 weight-percent
domain. Of the compact cells, 344 fail this physical check; 22,314 OMAT zeros
also lack a valid companion fit and are masked. This deliberately excludes
standalone values where the companion fit is absent. OMAT values above the
0.5 display stretch use its labeled endpoint; they are not reclassified as
invalid. Missing native samples
and the unmapped polar regions remain the gray coverage grid. No other image
fills them. The common 2,048 × 1,024 numeric display grids preserve selected
native cells but do not retain the original 59 m spatial detail.

The [shared acquisition method](../../../docs/usgs-numeric-surfaces.md) explains
bounded reads, native-cell selection, independent byte checks and lossless
preparation. The existing mesh and lighting controls are retained.

## Numeric-map qualification

The retained numeric checks bind
the compact input digests and tested processing files, count coverage, and
compare native byte samples at hemispheres, seams, extrema and gaps. Their
calibration check runs before the display coverage masks; it does not validate
the original instrument or scientific model.
The all-cell quality audit checks all
eight views, including the shared fit mask and FeO physical domain. All
16,777,216 comparisons pass. The four mineral fractions sum to one within
4.48 × 10⁻⁸ at every cell with a valid companion fit.

The fresh-install receipt verifies 1,500
runtime files (210,933,400 bytes) across the 13 changed bodies and the shared
Sun world metadata, with no reused files. All 15 compact source grids restored
from the source cache with native fallback disabled and matched byte for byte.

The browser evidence records the earlier
map descriptions, legends and retained scene. It includes screenshots; the
validation record names the checks
and the local full-build limitation. These checks do not measure instrument
accuracy or establish how well readers understand the explanations.

The current-main integration check records the
build, all 11 grouped selectors, source labels and phone playback. It explains
which earlier scientific and browser evidence still applies to this version.

The final dataset UI check confirms that Dataset details
and Surface photographs are absent from all 1,453 generated pages. Browser
checks cover the Moon, Venus and WASP-12b; the final screenshots show the
short description, legend and source link.
