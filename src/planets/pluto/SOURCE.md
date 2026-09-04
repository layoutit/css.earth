# Pluto source and presentation contract

Pluto is a standalone dwarf planet in the shared object shell. Charon and the
other moons are not mounted. This is a source-backed presentation, not an
epoch-specific ephemeris or a pixel-identical OpenSpace recreation.

## Pinned inputs

Exact byte counts, SHA-256 hashes, download URLs, credits, and consumers are in
`source/manifest.json`. Preparation fails on changed or undeclared input bytes.
The provider pages and labels are checked in alongside the data.

- **Color:** NASA/JHUAPL/SwRI, New Horizons Ralph/MVIC three-filter global mosaic,
  published January 20, 2017. North is up; Sputnik Planitia is near the center.
  This is the published color product, not calibrated true-color reflectance.
  <https://science.nasa.gov/resource/pluto-global-color-map/>
- **Monochrome:** NASA/JHUAPL/SwRI/LPI through USGS, LORRI/MVIC July 2017 mosaic,
  24,888 × 12,444 pixels, equirectangular, positive-east 0–360° longitude.
  <https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m>
- **Elevation:** the matching USGS stereo DEM. Signed 16-bit samples are metres
  relative to a 1,188.3 km sphere; −32,768 means no data. Its ISIS label pins the
  grid, projection, unit multiplier, and reference radius. The TIFF reader checks
  signedness, compression, strip bounds, and no-data metadata. It does not pass
  negative elevations through an unsigned image conversion.
  <https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m>
- **Physical facts:** checked JPL physical-parameter HTML plus NASA's Pluto facts
  record. Preparation parses and checks their Pluto identities and values. The
  radius is 1,188.3 km; density 1.853 g/cm³; sidereal rotation −6.3872 days; orbital
  period 247.92065 years. NASA supplies the rounded mean solar distance of 39 AU.
  <https://ssd.jpl.nasa.gov/planets/phys_par.html>
  <https://science.nasa.gov/dwarf-planets/pluto/facts/>
- **Sky and title:** checked ESO/S. Brunier panorama (CC BY 4.0), HYG v4.1
  registration field (CC BY-SA 4.0), and pinned Inter outlines (SIL OFL 1.1).
  These use the existing shared preparation recipes, not a Pluto star simulation.

## Observation limits and authored choices

Black regions are missing observations, not a dark hemisphere or fabricated
terrain. Neither mosaic nor DEM covers all of Pluto. Source resolution varies
across the flyby mosaic. The original gaps remain black through preparation.
Texture interpolation/compression may soften their edges; no surface is inpainted.

The full 2:1 maps use north-to-south latitude rows and a common 0–360° longitude
domain. Atlas rows are reversed inside each retained latitude band and polar
leaves are resampled at prepare time. The source maps remain unchanged on disk.
The DEM uses nearest source samples before this atlas conversion. Its authored
blue/tan/red palette is linear at −8/0/+8 km and clips outside that range.
It is an elevation color overlay, not geometry displacement or surface color.

The sphere uses a 16 × 32 retained grid with 452 leaves. Display radius, camera,
full-phase curvature shading, initial longitude, and 84-second rotation are
authored presentation choices. Rotation is retrograde. The display axis uses
NASA's 57° description; it is not a solved IAU orientation at an observation
epoch. Sky orientation and the Sun are contextual, not a New Horizons camera
solution. All these choices are prepared; the browser only transports state.

## Reproduction and evidence

Run `node src/planets/pluto/tools/acquire.mjs`, then the repository title-source
preparer and `node src/planets/pluto/tools/prepare.mjs`. Binary inputs are
reacquired only when absent, verified before publication, and never silently
refreshed. Git contains the metadata, provider snapshots, title source, and
license notices. No additional source-provider registry is required.

Acceptance requires the same unskipped Chrome conformance matrix as every other
object, including DPR 1/2, lens races, fly-to, speed, retained identity, visibility,
and teardown. Test passes do not establish native-image parity. Fresh capture
and Saturn scene-regression reports are recorded separately in the PR evidence.
