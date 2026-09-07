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
