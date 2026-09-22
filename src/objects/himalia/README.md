# Himalia

## Sources

- [Cassini ISS / Porco et al. (2003)](https://doi.org/10.1126/science.1079462) measured a visible projected cross-section of approximately 150 × 120 km, with ±20 km uncertainty, at a solar phase angle near 70°.

- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) give a mean radius of 85 ± 10 km and GM of 0.15155 ± 0.05763 km³/s².

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

- [Cassini ISS/PDS](https://pds-rings.seti.org/cassini/iss/): 93 catalog matches, first 12 retained in [source/survey/opus.json](source/survey/opus.json). The finest-distance N1355869401 calibrated native frame was inspected: CL1/CB3, 8.2-second exposure, approximately 26.60 km/pixel.

- At the six committed independent vector epochs, maximum position residual is **54,961 km** (previously 645,824 km), about 0.48% of semimajor axis; maximum angular error is 0.2625° and radial residual 0.4460%. These samples were not used to fit the correction.

## Known problems

- The Shape model is an **approximate elongated body**, not a recovered detailed mesh. Photographic surface mapping remains unqualified. The observation supports elongation; its partly lit disk does not determine three intrinsic axes.

- This is an illustrative orientation, not a measured spin pole, synchronous rotation or current landmark phase. Orbital position is separately fitted from JPL Horizons over 2020–2032; extrapolation outside that interval is unqualified.

- This remains an approximate orbit preview, not precision tracking or a guaranteed error bound.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="himalia-source-survey"></a>

## Shape and size

This package uses the observed 1.25:1 outline ratio for a prolate ellipsoid, assumes equal short axes, and scales its volume-equivalent radius to JPL's 85 km. The resulting modeled semi-axes are approximately 98.63 × 78.91 × 78.91 km. These combine an observed elongation with a separate size estimate and an explicit depth assumption; they are not three measured dimensions or a fit to Cassini's exact view. The active lens states that the shape, depth and viewing orientation are approximate. No craters or other terrain are invented.

The radius table is reproducible from `source/measurements.json`: `q = 150/120`, `b = c = 85/q^(1/3)`, `a = q*b`, followed by radial intersection with that ellipsoid on the checked-in 5° grid. Shared meshoptimizer preparation targets 480 native triangle leaves under the 2,000-leaf budget. The simplification tolerance is separate from observational uncertainty. The physical reference radius remains 85 km; camera framing accounts for the longer axis.

[Gomes-Júnior's 2021 occultation analysis](https://iota-es.de/JOA/JOA2021_2.pdf), pp. 5–6, rejects a preliminary approximately 200 × 150 km ellipse because of negative chords and the Cassini observations. Combining the 2018 May 12 and May 20 events suggests an equatorial radius of 85 km with a possible crater; a full 3D shape solution was still ongoing. The older 205.6 × 141.3 km outline repeated in secondary catalogs is not adopted as a settled shape, and no speculative crater is added.

## Imagery and complementary products

- This long exposure is not a securely registered disc; exact raster hash and original label are retained.

- [Denk et al. (2026), section 4.3.3 and Figure 20](https://refubium.fu-berlin.de/bitstream/handle/fub188/51747/11214_2026_Article_1263.pdf?sequence=1) examines shorter Cassini exposures in seven filters: approximately 4–6 pixels span the disk, without unambiguous surface spots. The review also finds New Horizons' 2007 images barely resolved. Integrated color measurements do not provide a spatial color or composition map.

- No registered DEM or mapped geology release was qualified. The entire surface uses the ordinary shared missing-data grid. Minimap, thumbnail and context billboard derive from the same approximation. Shared Flood lighting is the default; directional Shadows remains available.

## Orientation, orbit and reproducibility

The display pole uses the fitted orbital normal with an arbitrary meridian. The shared precessing ellipse and longitude fit now carry a bounded periodic ICRF position correction derived from the same five-day osculating samples: ten terms per axis, without a secular drift term. Target 506 is relative to Jupiter’s physical centre (`500@599`), geometric ICRF vectors in km at Julian dates TDB. Evaluating TT at those dates introduces less than 2 ms of clock difference, negligible relative to these fit residuals.

An additional 37 independent Horizons epochs across the interval, including near its ends and the prepared scene date, measure a maximum **85,166 km** and 0.4141° (previously 698,845 km and 3.9580°). At JD 2461286.5 (2026-09-03), the residual falls from 501,216 km to 61,786 km, with angular error 0.3357°.

The extra check is reproducible through the [Horizons vector API](https://ssd.jpl.nasa.gov/horizons/manual.html#vector-table): target `506`, centre `500@599`, `REF_SYSTEM=ICRF`, `REF_PLANE=FRAME`, `VEC_CORR=NONE`, `OUT_UNITS=KM-D`, `TIME_TYPE=TDB`. Its dates are `2458849.625`, `2458864.123 + 130.731*i` for integer `i=0..33`, `2461286.5`, and `2463232.375`. Source products identify the underlying ephemeris as `jup347_merged_DE442`.

Source inputs and authored documents are pinned in `source/manifest.json`. External preparation inputs restore through `preparation/acquisition.json`. Surveyed archive rasters and the journal PDF are recorded as evidence rather than required runtime downloads.

</details>
