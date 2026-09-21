# TRAPPIST-1b

## Sources

TRAPPIST-1b is the innermost of the seven planets of [TRAPPIST-1](../trappist-1/README.md), an ultracool dwarf 12.47 parsecs away. Every number in this
package comes from Agol et al. (2021, PSJ 2, 1), who fitted the seven planets' transit times and the Spitzer and ground-based photometry together: the
planets perturb each other enough for their masses to be read from the timing of their transits.

**Size and mass.** 1.116 Earth radii and 1.374 Earth masses (Agol et al. (2021, PSJ 2, 1), Table 6), a density of 0.987 Earth's and a
surface gravity of 1.102 Earth's. The radius comes from the transit depth against the star's own radius; the mass from the
transit-timing variations, scaled by the stellar mass Mann et al. (2019) give.

**Orbit.** 1.510826 days at 0.01154 au, 4.153 times the starlight Earth receives (Agol et al. (2021, PSJ 2, 1), Tables 2, 5 and 6). The
scene draws a circle: the paper's eccentricity for this planet is under 0.01, which moves it by less than its own radius. The
transit time is the paper's, and transit-timing variations of up to about half an hour are not modelled. The orbit's position
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

**Why a bare rock.** A bare rock has no atmosphere to carry heat, so each patch of ground re-radiates the starlight it absorbs: the
temperature is T cos(z)^(1/4) at an angle z from the point under the star, and there is none on the night side (the equilibrium
temperature of [Cowan & Agol 2011](https://doi.org/10.1088/0004-637X/726/2/82), eq. 3). That leaves one number to fit, T, the temperature under the star. The lens used to be a free smooth map
(spherical harmonics up to degree 2, centred on the star-facing point). On the same light curve the rock fits better with one parameter
fewer: chi-squared 7002.2 against 7016.0 over 6,737 samples, and BIC 7099 against 7122. A smooth map of that degree cannot draw the
sharp edge at the terminator, so it spread heat onto the night side and the poles, which the data do not measure.

**What the lens says.** 497 K where the star is overhead, 485 to 510 K at one standard deviation, cooling to about 320 K 10° from
the terminator and cold beyond it. A perfectly black rock would reach 562 K (Agol's 2566 K star at 20.843 stellar radii). No sign of
an atmosphere carrying heat around the planet, as Greene et al. and Gillon, Ducrot et al. concluded. The hot spot is drawn on the
point under the star: left free in the smooth map, it went 28° west of noon, but that fit was only 1 in log-likelihood better than a
centred one, and the offset traded against the Gaussian process that models the star.

## Evidence

- [`lens-fits.test.mts`](../../../tests/objects/unit/trappist-1b/lens-fits.test.mts) runs the shipped recipe and holds it to the
  temperature and fit it was measured to give, and refits the old smooth map on the same data to check the rock fits better.
- The rendered [day side](source/reference/rendered-thermal-day.png), [terminator](source/reference/rendered-thermal-terminator.png)
  and [night side](source/reference/rendered-thermal-night.png), captured from the prepared lens, show the sharp edge at the terminator
  and a night side at the bottom of the scale.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the TRAPPIST-1 system holds all seven planets.
- Each of the ten reduced visits was checked by image: the aperture on the star, its centroid through the visit, and the light
  curve. None lost the star.

## Known problems

**Only the day-to-night pattern is measured.** The orbit is seen almost exactly edge-on, so the light curve separates longitudes
but not latitudes. The lens's shape across the disc, north-south included, is the bare-rock model's, not a measurement. The hot
spot's east-west offset is not measured either (see above), so the rock is drawn centred.

**The star's variability is modelled, not removed.** The Gaussian process in the joint fit carries about 580 ppm of slow variation,
mostly the detector's settling over the first hours of the phase curve. The map is fitted to the light curve with that model taken
out.

**The orbit is circular here.** The measured eccentricity is small but not zero, and the transit-timing variations the masses come
from are not drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
