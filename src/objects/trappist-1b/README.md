# TRAPPIST-1b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

## Sources

TRAPPIST-1b is the innermost of the seven planets of [TRAPPIST-1](../trappist-1/README.md), an ultracool dwarf 12.47 parsecs away. Every number in this
package comes from Agol et al. (2021, PSJ 2, 1), who fitted the seven planets' transit times and the Spitzer and ground-based photometry together: the
planets perturb each other enough for their masses to be read from the timing of their transits.

**Size and mass.** 1.116 Earth radii and 1.374 Earth masses (Agol et al. (2021, PSJ 2, 1), Table 6), a density of 0.987 Earth's and a
surface gravity of 1.102 Earth's. The radius comes from the transit depth against the star's own radius; the mass from the
transit-timing variations, scaled by the stellar mass Mann et al. (2019) give.

**Orbit.** 1.5108 days at 0.01154 au, 4.153 times the starlight Earth receives (Agol et al. (2021, PSJ 2, 1), Tables 2, 5 and 6). The
scene draws a circle: the paper's eccentricity for this planet is under 0.01, which moves it by less than its own radius. The
period and transit time are the ones the Agol et al. (2024, arXiv:2409.11620) forecast gives around the scene epoch
(2026-09-03), which adds JWST timings to the Agol et al. (2021) model; their Table 2 period, 1.510826 d, is an osculating value at
the start of their simulation and drifts hours off by 2026. Transit-timing variations of -1.2 to +0.1 minutes about that
line are not modelled. The temperature lens uses the timing of its own 2022 and 2023 observations (see Timing). The orbit's position
angle on the sky is not measured, so the ascending node is drawn at celestial north, a stated convention.

**Rotation.** Assumed synchronous: this close to its star the planet is expected to be tidally locked, and no rotation period of
TRAPPIST-1b is measured. Longitude 0 faces the star.

**Thermal map.** The lens is the 15 µm brightness temperature of a bare rock that this project fitted to JWST data it reduced from
raw exposures. The data are the ten MIRI/F1500W visits Gillon, Ducrot et al. (2025) fitted together: the 59-hour phase curve of
program 3077 (108 raw segments), five eclipses of b from program 1177 (Greene et al. 2023) and four eclipses of c from program 2304
(Zieba et al. 2023). Each visit was reduced with [`reduce-tso.mts`](../../../tools/objects/jwst/reduce-tso.mts) on Bell's Eureka!
settings, except the aperture, which counts edge pixels by their area inside the circle: Bell's whole-pixel aperture includes 78 or
79 pixels as the star moves by 0.01 pixel, which put steps of about 650 ppm into his light curve. The ten visits were then fitted
together by [`joint-emission.mts`](../../../tools/objects/jwst/joint-emission.mts) with Bell's model: transits and eclipses of b, c
and g, c's phase curve, a baseline, pointing terms and a Gaussian process for the star's own variability. What is left is b's own
emission, [`b-emission-15um.csv`](source/science/jwst-trappist-1/b-emission-15um.csv). The lens fits a bare rock to it with
[`bare-rock.mts`](../../../tools/objects/eclipse-map/bare-rock.mts), converting temperature to 15 µm flux through the F1500W response
and a BT-Settl model of the star (2600 K, log g 5.0, the grid point nearest Agol's 2566 K).

Checked against the published result: with Bell's own phase-curve shape the joint fit gives b a dayside of 859 ppm against his
797 ± 77 ppm, and a shape exponent of 2.71 against 2.64. Single-visit eclipse depths of b come out between 731 and 880 ppm, against
the 861 ppm of Greene et al. (2023) that Bell's fit starts from.

**Timing.** Agol's 2015 osculating elements, which the package orbit carried before, put these eclipses 2.0 to 2.4 hours before
they happen: the eclipse visits are centred on dips of 850 to 950 ppm that the old fits placed outside the eclipse. The package orbit
now follows the Agol et al. (2024) forecast around the 2026 scene epoch, which still puts these 2022 eclipses about 17 minutes late.
The lens therefore uses the linear ephemeris of these observations (transit at 60271.25431 BMJD, period 1.5108699 days), from the
joint fit's transit of b and the five 2022 eclipse centres, which it places within 1.3 minutes. The fit gives 0.985 in chi-squared
per sample with that timing, 1.016 with the package orbit's and 1.039 with the 2015 elements'.

**Why a bare rock.** A bare rock has no atmosphere to carry heat, so each patch of ground re-radiates the starlight it absorbs: the
temperature is T cos(z)^(1/4) at an angle z from the point under the star, and there is none on the night side (the equilibrium
temperature of [Cowan & Agol 2011](https://doi.org/10.1088/0004-637X/726/2/82), eq. 3). That leaves one number to fit, T, the
temperature under the star. A free smooth map (spherical harmonics up to degree 2, centred on the star-facing point) fits the same
6,905 samples no better: chi-squared 6796.6 against the rock's 6803.0 with one parameter more, BIC 6903 against 6900. A smooth map of
that degree cannot draw the sharp edge at the terminator, so it spreads heat onto the night side and the poles, which the data do not
measure; the rock is the physical model the data allow.

**What the lens says.** 575 K where the star is overhead, 565 to 586 K at one standard deviation, cooling to about 370 K 10° from the
terminator and cold beyond it. At eclipse that rock shows 865 ppm, as Greene et al. (2023) measured 861. A perfectly black rock would
reach 562 K (Agol's 2566 K star at 20.843 stellar radii): the fit sits at that limit, 1.3 standard deviations above it, as a dark
surface with no atmosphere would. The hot spot is drawn on the point under the star, and that is now measured: left free in
longitude, the smooth map puts it 1.6° from noon. The 28° west offset an earlier fit found was the timing error above.

**Illustration lens.** NASA's artist's concept of TRAPPIST-1b: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`TRAPPIST-1_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/TRAPPIST-1_b.jpg), 2,048 × 1,024, named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. It is a second lens: MIRI 15 µm stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. The planet is drawn self-luminous, so the map is shown evenly bright, without its star's shading, as the MIRI 15 µm lens is. An earlier TRAPPIST-1 set, NASA/JPL-Caltech maps made for NOAA's [Science On a Sphere](https://sos.noaa.gov/catalog/datasets/exoplanet-trappist-1b/) in March 2017, is different artwork and is not used; this package uses the map NASA's app shows today. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

- Run of 2026-09-24: `node tools/prepare/prepare-object.mts` added the Illustration lens; every image this package already delivered is byte-identical to main's. [`equirectangular-illustration.test.mts`](../../../tools/objects/observation/equirectangular-illustration.test.mts) checks that the map keeps its left edge at 0° and that an emissive body gets transparent plates. In headless Chrome the lens opens on the map with no console errors ([all ten planets](../../../docs/images/eyes-on-exoplanets-illustrations.webp)).

- [`lens-fits.test.mts`](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/trappist-1b/lens-fits.test.mts) runs the shipped recipe and holds it to the
  temperature and fit it was measured to give, checks the ephemeris against every eclipse in the light curve, and refits the old
  smooth map on the same data to compare the fit and find the hot spot.
- The rendered [day side](source/reference/rendered-thermal-day.png), [terminator](source/reference/rendered-thermal-terminator.png)
  and [night side](source/reference/rendered-thermal-night.png), captured from the prepared lens, show the sharp edge at the terminator
  and a night side at the bottom of the scale.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the TRAPPIST-1 system holds all seven planets.
- Each of the ten reduced visits was checked by image: the aperture on the star, its centroid through the visit, and the light
  curve. None lost the star.

## Known problems

**Only the day-to-night pattern is measured.** The orbit is seen almost exactly edge-on, so the light curve separates longitudes
but not latitudes. The lens's shape across the disc, north-south included, is the bare-rock model's, not a measurement.

**The star's variability is modelled, not removed.** The Gaussian process in the joint fit carries about 580 ppm of slow variation,
mostly the detector's settling over the first hours of the phase curve. The map is fitted to the light curve with that model taken
out.

**The orbit is circular here.** The measured eccentricity is small but not zero, and the transit-timing variations the masses come
from are not drawn.

**The Illustration lens is art, not data.** Its colours, clouds and terrain are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
