# Charon

## Observations and coordinates

NASA/JHUAPL/SwRI New Horizons LORRI/MVIC monochrome mosaic, mapped by Paul
Schenk and the New Horizons team, distributed by USGS. The 2017 GeoTIFF is
12,693 × 6,347 at 300 m grid spacing, equirectangular, east-positive longitude,
606,000 m reference sphere. Actual image resolution varies substantially.

- [Mosaic](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_mosaic_300m)
- [Terrain model](https://astrogeology.usgs.gov/search/map/charon_new_horizons_lorri_mvic_global_dem_300m)
- [PDS processing description](https://pds-smallbodies.astro.umd.edu/holdings/nh-p_psa-lorri_mvic-5-geophys-v1.0/catalog/dataset.cat), retained in source/observations/dataset.cat.

Both GeoTIFFs have origin (−1,903,950, 952,200) m, 300/−300 m pixels and a
0° central meridian. The preparer samples those coordinates; it does not assume
that rounded image dimensions are an exact longitude/latitude rectangle.
Longitude wraps into the source's −180°…180° domain. The dedicated 640 × 320
minimaps are centred at 0°, keeping the encounter hemisphere together.

## Preparation and interpretation

Monochrome uses the source's existing Lunar-Lambert photometric correction,
normalized to 15° approach phase, as documented in the PDS description. These
8-bit values are relative brightness, not calibrated I/F or measured albedo.
No second gain correction is applied. Local cast shadows and mixed-resolution
boundaries remain observations; the app's shared flood and directional lighting
are both retained. Exact source zero is documented no-data; dark nonzero terrain
is preserved. Bilinear samples touching no-data are withheld.

Elevation uses the signed 16-bit USGS terrain model in metres above the 606 km
sphere. −32768 is no-data. The numeric palette spans −15 to +15 km with neutral
zero and an unshaded legend. Fixed northwest lighting is calculated from actual
height gradients, spherical pixel spacing and unit vertical scale; ambient is
0.25. The stereo/shape-from-shading source contains variable resolution and
mapping artifacts; 300 m post spacing is not a claim of 300 m terrain accuracy.
Gaps remain the shared neutral grid, with no invented neighboring heights.

The shared solid-body recipe prepares a 12,800 × 6,400 map and 1,024 px polar
tiles. Terminal WebP encoding is q90; lossless intermediate maps are preparation
inputs, not globe downloads. One generic object adapter owns runtime behavior.
The resolved context billboard has a dedicated 512 px image from the same
observed navigation crop, rather than enlarging the 32 px UI icon. Prepared
35% ambient / 65% diffuse full-phase shading rounds its circular silhouette;
this is a navigation illustration, not a new terrain or illumination dataset.
No atmosphere shell is supplied: New Horizons found no detectable atmosphere.

## New Horizons MVIC enhanced color

The additional Enhanced color lens uses the PDS product
[nh_charon_color_mosaic::1.0](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/mosaic/nh_charon_color_mosaic.lblx),
retained as the original 116,006,912-byte four-band float32 array. SHA-256:
`dd23352035996d670b9c278a1466461623556acc88d66aabd3bc2da1dd15fc5a`.
The bands are CH4 895 nm, NIR 870 nm, red 625 nm and blue 475 nm;
display RGB uses NIR/red/blue with one common linear 0–0.6 stretch.
This is enhanced false color, not natural color or quantitative albedo.

The PDS4 label declares 3,808 × 1,904, band-sequential little-endian float32,
1,000 m grid spacing, equirectangular planetocentric/east-positive coordinates,
606,000 m sphere, 0° central meridian, and upper-left corner
(−1,904,000, 952,000) m. These coordinates differ from the existing USGS map.
The preparer maps metric pixel centers rather than treating rounded extents as
an exact 360° rectangle. Missing pixels use finite bit pattern `0xFF7FFFFB`;
all selected channels and the complete bilinear footprint must be valid.
Finite negative data remain observations and are clamped only for display.

Independent NumPy decoding found 4,105,311 RGB-valid source pixels, about
60.0019% of surface area after latitude weighting, before conservative
interpolation. Unknown color coverage remains the neutral grid. A raw anchor
at 0°E,80°N has NIR/red/blue values 0.2344332486/0.1650196165/0.1310233623,
consistent with the mission's separately described reddish northern pole.
The southern cap and unobserved longitudes retain missing values. Numeric and
bit-pattern anchors are in source/validation/color-source-inspection.json.

The source combines lower-resolution MVIC color with panchromatic detail;
1 km post spacing is not uniform native color resolution. The archive applied
lunar-Lambert normalization near L=0.65 at 15° phase, but explicitly warns that
mosaicking means values are no longer strictly I/F. No additional photometric
normalization is applied. The archive refers calibration uncertainties to
Howett et al. (2017); there is no accompanying per-pixel uncertainty array.
Retain NASA/JHUAPL/SwRI, Paul Schenk/LPI, New Horizons team and PDS attribution.
The neighboring absorption-map files inspected in this archive target Pluto,
so none is presented as a Charon composition map.

## Physical placement

606 km radius and GM 106.10 km³/s²: JPL Horizons target 901, PLU060 physical
block, retrieved 2026-09-07. The existing satellite generator fits target 901
relative to Pluto (500@999), using the same ICRF mean-element recipe as the
other moons. Source queries and independent vector fixtures live in the
astronomy package. NAIF pck00011 BODY901 supplies pole RA 132.993°, DEC −6.163°,
and W = 122.695° + 56.3625225°/day since J2000. Charon is a standalone route and
a child of Pluto in the shared frame tree, including navigation and orbit view.

[NASA overview](https://science.nasa.gov/dwarf-planets/pluto/moons/charon/)
provides the mutual tidal locking, discovery and geological introduction.

## Reproduction

Run shared acquisition for `charon`, then `pnpm prepare:planets -- --object=charon`.
The source manifest pins original inputs and authored recipes. Runtime installation
uses `pnpm setup:assets --object=charon` and does not require source GeoTIFFs.
