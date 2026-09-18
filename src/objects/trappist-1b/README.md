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

**Thermal map.** The lens is a brightness-temperature map at 15 µm that this project fitted to JWST data it reduced from raw
exposures. The data are the ten MIRI/F1500W visits Gillon, Ducrot et al. (2025) fitted together: the 59-hour phase curve of
program 3077 (108 raw segments), five eclipses of b from program 1177 (Greene et al. 2023) and four eclipses of c from program 2304
(Zieba et al. 2023). Each visit was reduced with [`reduce-tso.mts`](../../../tools/objects/jwst/reduce-tso.mts) on Bell's Eureka!
settings, except the aperture, which counts edge pixels by their area inside the circle: Bell's whole-pixel aperture includes 78 or
79 pixels as the star moves by 0.01 pixel, which put steps of about 650 ppm into his light curve. The ten visits were then fitted
together by [`joint-emission.mts`](../../../tools/objects/jwst/joint-emission.mts) with Bell's model: transits and eclipses of b, c
and g, c's phase curve, a baseline, pointing terms and a Gaussian process for the star's own variability. What is left is b's own
emission, [`b-emission-15um.csv`](source/science/jwst-trappist-1/b-emission-15um.csv), and the lens fits a map to it with the same
eigenmap code as WASP-43b's MIRI map, converted to temperature through the F1500W response and a BT-Settl model of the star (2600 K,
log g 5.0, the grid point nearest Agol's 2566 K).

Checked against the published result: with Bell's own phase-curve shape the joint fit gives b a dayside of 859 ppm against his
797 ± 77 ppm, and a shape exponent of 2.71 against 2.64. Single-visit eclipse depths of b come out between 731 and 880 ppm, against
the 861 ppm of Greene et al. (2023) that Bell's fit starts from.

**Why the map is centred.** Left free, the best fit puts the hottest point 28° west of noon. That offset is not measured: fixing it
at a range of values and refitting everything else, the fit is only 1 in log-likelihood worse with no offset at all, about 1.4
standard deviations, and the offset trades against the Gaussian process that models the star. The map is therefore built from
harmonics symmetric about the star-facing point (`longitudeSymmetric`). Among those, the model chosen by BIC is degree 2 with one
eigencurve.

**What the map says.** About 520 K where the star is overhead, 350 K at the terminators and under 100 K on the night side: no sign
of an atmosphere carrying heat around the planet, as Greene et al. and Gillon, Ducrot et al. concluded.

## Evidence

- [`source.test.mts`](../../../tests/objects/unit/trappist-1b/source.test.mts) checks the pins and that the package's radius, mass and
  orbit are the astronomy record's.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the TRAPPIST-1 system holds all seven planets.
- Each of the ten reduced visits was checked by image: the aperture on the star, its centroid through the visit, and the light
  curve. None lost the star.

## Known problems

**Only the day-to-night pattern is measured.** The orbit is seen almost exactly edge-on, so the light curve separates longitudes
but not latitudes: the map's north-south shape, including the warm poles, comes from the fitting basis, not from the data. The hot
spot's east-west offset is not measured either (see above), so the map is drawn centred.

**The star's variability is modelled, not removed.** The Gaussian process in the joint fit carries about 580 ppm of slow variation,
mostly the detector's settling over the first hours of the phase curve. The map is fitted to the light curve with that model taken
out.

**The orbit is circular here.** The measured eccentricity is small but not zero, and the transit-timing variations the masses come
from are not drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
