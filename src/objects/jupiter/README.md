# Jupiter source and preparation record

Jupiter combines Hubble observations, its rings at their published optical depths, a magnetic field model and
modeled atmosphere charts.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View or quantity | Source |
| --- | --- |
| Visible clouds | [Hubble 2019 global map](https://science.nasa.gov/asset/hubble/jupiter-global-map-2019/) |
| Ultraviolet and methane bands | [Hubble OPAL Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-jupiter-cycle-32), 2025 |
| Ring structure | [PDS ring statistics](https://pds-rings.seti.org/jupiter/jupiter_rings_table.html) and Galileo images |
| Atmosphere charts | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/), modeled 30 August 2026 |

- Dated maps: the [OPAL release](https://archive.stsci.edu/hlsp/opal) supplies eleven RGB maps, 19 January 2015 to
  11 December 2025.
- Magnetic field: [JRM33](https://doi.org/10.1029/2021JE007055), evaluated with the unchanged
  [PSH community implementation](https://github.com/rjwilson-LASP/PSH).
- Rings: Galileo [PIA00701](https://pds-rings.seti.org/jupiter/galileo/PIA00701.html) and
  [PIA01623](https://pds-rings.seti.org/jupiter/galileo/PIA01623.html).
- Limb law: the [OPAL photometry paper](https://doi.org/10.1088/0004-637X/812/1/55) by Simon, Wong and Orton.
- Silhouette and navigation marker: the NASA/ESA/STScI/Amy Simon full-disc Hubble view from 5 January 2024.
- Facts: [NASA Jupiter facts](https://science.nasa.gov/jupiter/jupiter-facts/),
  [NASA Jupiter moons](https://science.nasa.gov/jupiter/jupiter-moons/), JPL
  [satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html) and
  [physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html). The Galileo
  [PIA01299](https://science.nasa.gov/photojournal/the-galilean-satellites/) montage remains pinned source material.
- Moons: 28 of Jupiter's 115 confirmed moons are separate object packages; the 87 others are drawn as plain dots at
  their JPL Horizons positions by [Jupiter's moons without a page](../jupiter-minor-moons/README.md).

## Processing

**Visible map.** The Hubble WFC3 map from 27 June 2019 is 3,600 by 1,800 pixels from the 395, 502 and 631 nm filters,
and excludes latitudes beyond 80°. Bands are limited to eight degrees to reduce close-zoom faceting. Poleward of 64°
the body is a dome of two rings and a flat cap at 80°.

**Poles.** The map observed nothing beyond 80° north or south. The shared gray grid marks those caps; nothing is
drawn into them. Juno polar photographs were grafted in until 2026-10-01 and were removed: the south pole's structure
was a 5-micron infrared image, and neither pole was registered to the Hubble longitudes.

**Dated maps.** Each OPAL image keeps the intersection of its three component footprints. Polar-connected zero fill
and non-finite values are gaps. F395N, F502N and F631N provide the channels, except January 2024 uses F658N for red.
There is no 2023 release; two observations belong to 2024.

**Ultraviolet and methane.** The 11 December 2025 OPAL maps `F275W` (275 nm) and `FQ889N` (889 nm) keep their measured
values, including dark and negative samples. Only exact-zero regions connected to a polar edge, and non-finite
samples, are gaps. A percentile stretch and false-color palette give relative contrast.

**Magnetic field.** JRM33 through degree/order 13 is evaluated at the 1-bar ellipsoid (71,492 × 66,854 km) as the
radial field on a 720 × 360 grid. The range is −13.94 to 21.68 gauss on a fixed linear −25 to 25 scale, blue inward
and red outward. The [model recipe](source/preparation/magnetic.json) and
[pinned upstream tool](../../../packages/telescope/toolchains/magnetic-toolchain.json) reproduce it. Textures are
lossless.

**Lighting.** The OPAL paper publishes the Minnaert coefficients used to remove limb darkening: F631N red `k=0.999`,
F502N green `k=0.950` and F395N blue `k=0.850`, transcribed in `source/photometry/simon-2015-minnaert-*.json`.
Preparation puts that law back on the map for every light direction
([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)), with no ambient floor or
terminator ramp. The presentation Sun direction `[0.883835, -0.385595, 0.264864]` is an authored choice, because
the PSG near-opposition phase of `4.360399` degrees would hide the terminator. In the 5 January 2024 Hubble view,
every pixel of the 1.005-to-1.03 exterior annulus is zero, so no atmosphere halo is drawn.

**Rings.** [Jupiter's ring particles](../jupiter-ring-particles/README.md) draws 600 dots in the rings, the only thing that shows them; the position of a single dot is drawn from a seed. The PDS Ring-Moon Systems table fixes boundaries and optical depths: halo 100,000 to 122,400 km, main ring
to 129,100 km, Amalthea gossamer to 181,350 km, Thebe to 221,900 km and its extension to 270,000 km. The Galileo images
establish the three-part structure, the gossamer components and the truncation in Jupiter's shadow. The components are
composited once into a 4 by 4 tile grid. Their radial mapping keeps the Thebe extension inside Io. Each ring's opacity
is 1 − exp(−optical depth). The published depths run from 10⁻⁹ to 8 × 10⁻⁶, below one display level for every
ring, so nothing shows and the map marker carries no ring. Hand-picked grays and a contrast emphasis capped at 0.4
alpha were removed on 2026-10-01.

**Scene.** The scene uses the IAU radii (71,492 and 66,854 km), the JUP365 ephemeris, 3.13° axial tilt and NASA's
9.9-hour rotation period. The 36-second CSS rotation is an accelerated presentation timescale. Io, Europa, Ganymede
and Callisto are separate object packages.

**Charts.** The PSG configuration for `2026/08/30 12:00` contains the 50-layer Moses et al. 2005 atmosphere from 10
bar to 10 nanobar. Its R=240 I/F response has 253 samples from 0.35 to 0.998 micrometers. All charts are static SVG.

Jupiter is prepared only from inputs declared in `source/manifest.json`; ignored binaries are restored through
`source/preparation/acquisition.json`. Commands are in the [contributor guide](../README.md).

## Evidence

![Jupiter, Uranus and Neptune before (left) and after (right) the 2026-10-01 fidelity pass](evidence/2026-10-01/giants-before-after.webp)

Headless captures of the default views: the Juno pole graft and the boosted rings on the left, the measured map
with its gray polar cap and the rings at true opacity on the right.

- Every added dataset was selected and visually inspected in the browser on 26 September 2026.
- Polar ring leaves place every texel within 0.33 of a 2x polar-atlas texel of its latitude, and the cap within 0.39.
  The cap's rim stands 0.15% of the radius outside the body.
- [Observed-map checks](../../../packages/bake/src/objects/layers/observed-surfaces/observed-polar.test.mts) cover the
  RGB intersection, the date control, the valid zero field and the palette midpoint.

## Known problems

- The default map has no data beyond 80° north or south; the gray grid marks those caps.
- Spectral gaps remain missing. The edge-fill mask is a heuristic without an independent validity mask.
- The dated maps vary in filters and provider color processing, so they are a morphological comparison, not a
  calibrated color trend or a measurement of the Great Red Spot's shrinkage.
- The magnetic map is an inferred internal field. It excludes external currents, and its grid follows the mesh's
  parametric latitude, not planetographic latitude.
- The rings are invisible at their true opacity. An empty ring layer is still mounted.
- Atmosphere lighting and charts are models, and the display rotation is accelerated.
- The photometric overlay has one color and alpha per pixel, so the per-channel limb law is exact for the 2019 map's
  mean color and approximate for colors far from it. The coefficients are for near-zero phase; directional frames use
  them at every phase.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)
