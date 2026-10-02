# TRAPPIST-1b

TRAPPIST-1b is the innermost of the seven planets of [TRAPPIST-1](../trappist-1/README.md), an ultracool dwarf 12.47
parsecs away. The default dataset is its 15 µm temperature as a bare rock, fitted here to JWST data reduced from raw
exposures. A second dataset shows NASA's artist's concept. The [navigation marker](source/preparation/navigation.json)
is a neutral gray schematic with a curvature cue, not measured limb darkening or surface detail.

## Sources

- **Size, mass and orbit.** Agol et al. (2021, PSJ 2, 1), who fitted the seven planets' transit times and photometry
  together: 1.116 Earth radii and 1.374 Earth masses (Table 6), a density of 0.987 Earth's and a surface gravity of
  1.102 Earth's. The orbit is 1.5108 days at 0.01154 au, 4.153 times the starlight Earth receives (Tables 2, 5 and 6).
  The mass is scaled by the stellar mass Mann et al. (2019) give.
- **Ephemeris.** The period and transit time come from the Agol et al. (2024, arXiv:2409.11620) forecast around the
  scene epoch (2026-09-03), which adds JWST timings to the 2021 model.
- **Thermal data.** The ten MIRI/F1500W visits Gillon, Ducrot et al. (2025) fitted together: the 59-hour phase curve of
  program 3077, five eclipses of b from program 1177 (Greene et al. 2023) and four eclipses of c from program 2304
  (Zieba et al. 2023).
- **Illustration.** NASA's artist's concept from its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app
  ([`TRAPPIST-1_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/TRAPPIST-1_b.jpg), 2,048 × 1,024),
  credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like"
  ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)). NASA content is generally not subject
  to copyright in the United States and is credited to NASA
  ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Processing

**Orbit and rotation.** The scene draws a circle, since the eccentricity is under 0.01 and moves the planet by less
than its own radius. The orbit's position angle on the sky is not measured, so the ascending node is drawn at celestial
north, a stated convention. The planet is assumed tidally locked, with longitude 0 facing the star.

**Reduction.** Each visit was reduced with
[`reduce-tso.mts`](../../../packages/telescope-cli/src/archives/jwst/reduce-tso.mts) on Bell's Eureka! settings, except
the aperture, which counts edge pixels by their area inside the circle. Bell's whole-pixel aperture put steps of about
650 ppm into his light curve. The ten visits were then fitted together by
[`joint-emission.mts`](../../../packages/telescope-cli/src/archives/jwst/joint-emission.mts) with Bell's model:
transits and eclipses of b, c and g, c's phase curve, a baseline, pointing terms and a Gaussian process for the star's
variability. What is left is b's own emission,
[`b-emission-15um.csv`](source/science/jwst-trappist-1/b-emission-15um.csv).

**Timing.** The dataset uses the linear ephemeris of these observations (transit at 60271.25431 BMJD, period
1.5108699 days), which places the five 2022 eclipse centres within 1.3 minutes. The package orbit puts them about
17 minutes late, and Agol's 2015 elements put them 2.0 to 2.4 hours early.

**Why a bare rock.** A bare rock has no atmosphere to carry heat, so each patch re-radiates the starlight it absorbs:
the temperature is T cos(z)^(1/4) at an angle z from the point under the star, and zero on the night side
([Cowan & Agol 2011](https://doi.org/10.1088/0004-637X/726/2/82), eq. 3). That leaves one number to fit, T.
[`bare-rock.ts`](../../../packages/bake/src/objects/raster/eclipse-map/bare-rock.ts) converts temperature to 15 µm flux
through the F1500W response and a BT-Settl model of the star (2600 K, log g 5.0). A free smooth map (spherical
harmonics to degree 2) fits the same 6,905 samples no better (BIC 6903 against 6900) and spreads heat onto the night
side, which the data do not measure.

**Illustration.** The map is resized unchanged onto the sphere with its left edge at 0° longitude
([`equirectangular-illustration`](../../../packages/bake/src/objects/interpretation/interpret.ts)). The planet is drawn
self-luminous, so the map is evenly bright, without the star's shading.

## Evidence

- **The result.** 575 K where the star is overhead, 565 to 586 K at one standard deviation, cooling to about 370 K 10°
  from the terminator and cold beyond it. At eclipse that rock shows 865 ppm, as Greene et al. (2023) measured 861. A
  perfectly black rock would reach 562 K, so the fit sits at that limit, 1.3 standard deviations above it, as a dark
  surface with no atmosphere would. Left free, the smooth map puts the hot spot 1.6° from noon.
- **Against the published fit.** With Bell's own phase-curve shape the joint fit gives b a dayside of 859 ppm against
  his 797 ± 77 ppm. Single-visit eclipse depths of b come out between 731 and 880 ppm.
- **Timing.** Chi-squared per sample is 0.985 with the observations' own ephemeris, 1.016 with the package orbit's and
  1.039 with the 2015 elements'.
- The rendered [day side](source/reference/rendered-thermal-day.png),
  [terminator](source/reference/rendered-thermal-terminator.png) and
  [night side](source/reference/rendered-thermal-night.png) show the sharp edge at the terminator. The Illustration
  dataset is shown with the other planets in [this capture](../../../docs/images/eyes-on-exoplanets-illustrations.webp).

## Known problems

- **Only the day-to-night pattern is measured.** The orbit is seen almost exactly edge-on, so the light curve separates
  longitudes but not latitudes. The shape across the disc, north-south included, is the bare-rock model's.
- **The star's variability is modelled, not removed.** The Gaussian process carries about 580 ppm of slow variation,
  mostly the detector's settling over the first hours of the phase curve.
- **The orbit is circular here.** The measured eccentricity is small but not zero, and the transit-timing variations
  of -1.2 to +0.1 minutes are not drawn.
- **The Illustration dataset is art, not data.** Nobody has resolved this planet's disc. Its colors, clouds and terrain
  are the artist's, its longitudes are arbitrary, and NASA does not say how it was made.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
