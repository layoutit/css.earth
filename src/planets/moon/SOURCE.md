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

The rock-abundance lens consumes `source/science/dgdr_ra_avg_cyl_032_img.img`,
the 11,520 × 3,840 [LRO Diviner V4.0 product](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gdr_l3/cylindrical/img/dgdr_ra_avg_cyl_032_img.xml).
Joshua Bandfield and the UCLA Diviner team estimated the surface areal fraction
covered by rocks using nighttime thermal measurements from July 2009 to
November 2010; see [Bandfield et al. (2011)](https://doi.org/10.1029/2011JE003866).
It combines channels 6–8 and ten local-time bins under the label's quality,
viewing-angle and temperature filters. Source DN × 0.001 is an areal fraction;
display DN × 0.1 is **percent surface area**. The −32768 missing sentinel is
excluded first, zero is valid, and values outside 0–100% are rejected. Exactly
one source cell (sample 4060, line 3821, zero-based) reports DN 1062 = 106.2%
and is excluded. There are 4,119,083 missing cells and 40,117,716 retained valid
cells; their maximum is 61.3%. The display scale spans 0–2%, with larger valid
values saturated at the top color. The 99th source percentile is 1.6%; this
contrast choice is distinct from the validity range. The source supplies no
per-cell uncertainty array; model assumptions and sampling limit interpretation.
This is not an image, composition map or count of individual boulders.

The [SVS color-map description](https://svs.gsfc.nasa.gov/4720/) independently
confirms that the retained visible texture is centered on 0° longitude. Numeric
output uses an explicit −180° left-edge origin to align with that texture and
the retained crust lens; the original PDS coordinates are not relabeled. Fixed
output-cell checks at USGS/IAU Copernicus, Tycho and Tsiolkovskiy coordinates
verify the corresponding source values through the numeric painter. These are
landform alignment anchors, not a claim of subpixel survey accuracy.

Both products use east-positive 0–360° longitude, north-down rows, a 1,737.4 km
sphere and the mean-Earth/polar-axis DE421 frame. Diviner covers only 60°N–60°S
at 32 pixels/degree (about 948 m at the equator); the remainder, missing cells
and rejected values retain the shared missing-coverage pattern. Nearest source
cell sampling preserves source values and gaps. The numeric lenses also opt into
nearest display sampling: latitude-band packing copies pixels, polar tiles use
one nearest pixel-center sample, and thumbnails use nearest resizing. Their
surface, pole and thumbnail WebPs are lossless. This preserves the selected
palette colors and missing-data style through prepared assets; it is not a
claim that browser-transformed screen pixels are quantitative samples. The
visible-color and GRAIL image lenses retain their existing image processing. The original labels and PDS4
identity records are pinned alongside the binaries. Independent NumPy raw-DN,
unit, meridian, latitude and missing-value anchors live in
`source/validation/scientific-source-anchors.json`; these check the decoder
without treating its own output as the reference.

The GRAIL crustal-thickness print remains unchanged at
`source/lenses/grail-crustal-thickness-print.jpg` from
[NASA SVS](https://svs.gsfc.nasa.gov/4014/). It is a gravity/topography-derived
interior model with assumed densities, shown with shaded relief. It has not
become a new numeric crust grid. The old LOLA press JPEG is no longer an active
input; its existing local file is not removed. All four lenses use the same
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
