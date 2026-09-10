# Moon source and preparation record

The Moon is a first-class cssEarth object. It is not mounted inside Earth.

Authored geometry, observation-processing parameters, controls, and physical
source bindings live in `source/preparation/` and `source/content/`, pinned by
`object.json`. The shared `tools/objects/static-surface/` preparation compiles
those records into `prepared/*.json`. The numeric scientific lenses are prepared from the original PDS arrays;
source values and missing coverage are decoded before display color is chosen. Unit and browser
checks live under `tests/objects/{unit,browser}/moon/`.

## Surface

- NASA Scientific Visualization Studio CGI Moon Kit colour map, prepared from
  LRO/LROC and LOLA data: <https://svs.gsfc.nasa.gov/4720/>
- Checked input: `source/surface/lroc-color-2k.jpg`
- The preparation step packs the equirectangular source into retained
projective latitude bands and a prepared polar atlas. Runtime performs no
geometry or raster preparation.

## Numeric scientific lenses

The topography lens consumes `source/science/ldem_16.img`, the 5,760 × 2,880
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

The three nighttime lenses use the [LRO Diviner GHRM v1.0 float32 mosaics](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/),
produced by Powell and the UCLA Diviner team from 2009–2022 observations.
The exact product labels, original hash pins, compact numeric grids and conversion
receipts live in `source/science/diviner-ghrm/`; candidate selection and independent
checks are recorded in [B10](../../../docs/moons/b10-lunar-thermal/README.md).

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
the rock-abundance lens. The expanded record and GHRM thermal model replace it.

The [SVS color-map description](https://svs.gsfc.nasa.gov/4720/) independently
confirms that the retained visible texture is centered on 0° longitude. Numeric
output uses an explicit −180° left-edge origin to align with that texture and
the retained crust lens; the original PDS coordinates are not relabeled. Fixed
output-cell checks at USGS/IAU Copernicus, Tycho and Tsiolkovskiy coordinates
verify the corresponding source values through the numeric painter. These are
landform alignment anchors, not a claim of subpixel survey accuracy.

Nearest display sampling preserves selected numeric values and gaps: latitude-band
packing copies pixels, polar tiles use nearest pixel-center samples, and
thumbnails use nearest resizing. Surface, pole and thumbnail WebPs are lossless.
This preserves prepared palette colors, not a claim that browser-transformed
screen pixels are quantitative samples. The three GHRM atlases use 4096 × 2048
canonical materials; existing visible-color, topography, GRAIL, silicate and
geology materials keep their previous sizes and image bytes.
Independent B10 checks bind all original, compact and runtime hashes and verify
507 original-to-texture probes plus eight separately fetched raw-byte anchors.
The earlier LOLA numerical anchors remain in
`source/validation/scientific-source-anchors.json`.

The GRAIL crustal-thickness print remains unchanged at
`source/lenses/grail-crustal-thickness-print.jpg` from
[NASA SVS](https://svs.gsfc.nasa.gov/4014/). It is a gravity/topography-derived
interior model with assumed densities, shown with shaded relief. It has not
become a new numeric crust grid. The old LOLA press JPEG is no longer an active
input; its existing local file is not removed. All lenses use the same
retained projective-band and polar-atlas topology.

PDS publicly archives these NASA mission scientific products. Preserve the
named producers, exact product/version, original archive links and [PDS data
citation](https://pds.nasa.gov/datastandards/citing/) when reusing the derived
visualizations. The selected labels specify no separate Creative Commons
license; this package does not invent one or relicense a journal article.

## Physical and orbital facts

- NASA JPL Solar System Dynamics satellite physical parameters:
  <https://ssd.jpl.nasa.gov/sats/phys_par/sep.html>
- NASA JPL Solar System Dynamics satellite mean elements:
  <https://ssd.jpl.nasa.gov/sats/elem/sep.html>
- The checked `source/orbit/moon.json` records the extracted Moon values and
  exact authority-page hashes.

## Scene and sky

- The retained globe configuration is checked from OpenSpace commit
  `56e29b54b8592084ff1fef47c2e08de0b22ce516`.
- The cubic sky is prepared from ESO/S. Brunier's Milky Way panorama under
  CC BY 4.0. HYG v4.1 coordinates are used only for registration auditing.
- The directional Sun uses the repository's clean-room, retained-billboard
  preparation standard at a mean heliocentric distance of 1 AU.

## Qualification

The standalone Moon is a source-backed retained-DOM presentation. Its mean
heliocentric distance is catalogued as 1 AU for navigation. It is not an
epoch-specific ephemeris and does not claim native camera parity.

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
Reproduction: `tools/objects/acquisition/MAPPED-SCIENCE.md`.
