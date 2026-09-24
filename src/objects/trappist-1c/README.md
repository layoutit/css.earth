# TRAPPIST-1c

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

## Sources

TRAPPIST-1c is the second planet out from [TRAPPIST-1](../trappist-1/README.md), an ultracool dwarf 12.47 parsecs away. Every number in this
package comes from Agol et al. (2021, PSJ 2, 1), who fitted the seven planets' transit times and the Spitzer and ground-based photometry together: the
planets perturb each other enough for their masses to be read from the timing of their transits.

**Size and mass.** 1.097 Earth radii and 1.308 Earth masses (Agol et al. (2021, PSJ 2, 1), Table 6), a density of 0.991 Earth's and a
surface gravity of 1.086 Earth's. The radius comes from the transit depth against the star's own radius; the mass from the
transit-timing variations, scaled by the stellar mass Mann et al. (2019) give.

**Orbit.** 2.4218 days at 0.01580 au, 2.214 times the starlight Earth receives (Agol et al. (2021, PSJ 2, 1), Tables 2, 5 and 6). The
scene draws a circle: the paper's eccentricity for this planet is under 0.01, which moves it by less than its own radius. The
period and transit time are the ones the Agol et al. (2024, arXiv:2409.11620) forecast gives around the scene epoch
(2026-09-03), which adds JWST timings to the Agol et al. (2021) model; their Table 2 period, 2.421937 d, is an osculating value at
the start of their simulation and drifts hours off by 2026. Transit-timing variations of -0.9 to +1.2 minutes about that
line are not modelled. The orbit's position
angle on the sky is not measured, so the ascending node is drawn at celestial north, a stated convention.

**Rotation.** Assumed synchronous: this close to its star the planet is expected to be tidally locked, and no rotation period of
TRAPPIST-1c is measured. Longitude 0 faces the star.

**Dayside temperature.** This project reduced ten JWST MIRI visits at 15 µm from raw and fitted them together with Bell's model
(see [TRAPPIST-1b](../trappist-1b/README.md), whose map comes from the same fit). For TRAPPIST-1c they measure the dayside: an eclipse
depth of 318 to 389 ppm depending on the phase-curve shape the fit assumes, a brightness temperature of 353 to 379 K through the
F1500W response and a model of the star. Its four eclipse visits alone give 331 to 463 ppm.

**The lens is a model.** The day-night pattern of c is not measured: with its offset free the phase-curve fit runs to the edge of
what it allows, and held symmetric its day-night amplitude fits to zero, so no map is fitted ([ledger](investigations.json)). The
lens instead draws the simplest surface the one measurement allows: a bare rock with no atmosphere, whose ground re-radiates the
starlight it absorbs, T cos(z)^(1/4) at an angle z from the point under the star and nothing at night (the equilibrium temperature of
[Cowan & Agol 2011](https://doi.org/10.1088/0004-637X/726/2/82), eq. 3), the model TRAPPIST-1b's light curve supports. Its one
number is set so the rock shows c's eclipse depth
([`c-dayside-15um.json`](source/science/jwst-trappist-1/c-dayside-15um.json)) through the F1500W response and a BT-Settl model of the
star, with [`bare-rock.mts`](../../../tools/objects/eclipse-map/bare-rock.mts): 392 to 421 K under the star for 318 to 389 ppm, drawn
at 407 K for the middle of the range. A perfectly black rock at c's distance would reach 480 K (Agol's 2566 K star at 28.549 stellar
radii), so the measured day side is dimmer than a black rock's. The lens is labelled a model on the page.

**Illustration lens.** NASA's artist's concept of TRAPPIST-1c: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`TRAPPIST-1_c.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/TRAPPIST-1_c.jpg), 2,048 × 1,024, named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. It is a second lens: Rock model stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. The planet is drawn self-luminous, so the map is shown evenly bright, without its star's shading, as the Rock model lens is. An earlier TRAPPIST-1 set, NASA/JPL-Caltech maps made for NOAA's [Science On a Sphere](https://sos.noaa.gov/catalog/datasets/exoplanet-trappist-1c/) in March 2017, is different artwork and is not used; this package uses the map NASA's app shows today. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

- Run of 2026-09-24: `node tools/prepare/prepare-object.mts` added the Illustration lens; every image this package already delivered is byte-identical to main's. [`equirectangular-illustration.test.mts`](../../../tools/objects/observation/equirectangular-illustration.test.mts) checks that the map keeps its left edge at 0° and that an emissive body gets transparent plates. In headless Chrome the lens opens on the map with no console errors ([all ten planets](../../../docs/images/eyes-on-exoplanets-illustrations.webp)).

- [`source.test.mts`](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/trappist-1/source.test.mts) checks the pins, and that the planet turns synchronously
  with longitude 0 on its star and orbits it;
  [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) checks that it transits at the published times.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the TRAPPIST-1 system holds all seven planets.
- [`lens-fits.test.mts`](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/trappist-1c/lens-fits.test.mts) runs the shipped recipe and checks that the
  drawn rock shows the middle of the measured eclipse depth and is dark at night.
- Driven in a real browser: the seven orbits and labels draw around the star in the system view. The rendered
  [day side](source/reference/rendered-model-day.png) and [terminator](source/reference/rendered-model-terminator.png) show the model lens.

## Known problems

**The lens is a model, not an observation.** Size, mass, orbit and the dayside brightness above are measured; the surface and its
day-night pattern are not. A dark night is the rock's assumption: a thin atmosphere carrying some heat round would also fit the one
depth, and would draw a cooler day and a warmer night. The depth's range comes from the phase-curve shapes the joint fit can assume,
whose separate values were not kept.

**The orbit is circular here.** The measured eccentricity is small but not zero, and the transit-timing variations the masses come
from are not drawn.

**The Illustration lens is art, not data.** Its colours, clouds and terrain are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
