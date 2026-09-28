# Leleākūhonua

Leleākūhonua never comes closer to the Sun than about 65 au, and its orbit reaches beyond 2,500 au. Its discoverers reported it as the third known member of the inner Oort cloud.

Source selections and open questions are in the [investigation ledger](investigations.json).

## Sources

| Source | Display interpretation |
| --- | --- |
| [Buie et al. (2020), The Astronomical Journal 159, 230: radius 110 +14/−10 km from the 2018 October 20 stellar occultation, assuming a circular profile](https://arxiv.org/abs/2011.03889) | Sphere at the occultation radius |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position and orbit at the fixed 2026-09-03 epoch. |

Sphere of radius 110 km (+14/−10 km), from one detection and one nearby non-detection of the 2018 October 20 stellar occultation (Buie et al. 2020). The radius assumes a circular outline; the shape is not measured.

Illustrative ICRF north pole, arbitrary prime meridian and phase; no spin pole is published.

The normal grid marks unmapped terrain. Shadows default off. [Measurements](source/measurements.json), [source manifest](source/manifest.json) and [credits](NOTICE.md) keep the numbers and terms.

## On the map

It is an extreme trans-Neptunian object: semimajor axis over 150 au and perihelion beyond 30 au, the definition [de la Fuente Marcos & de la Fuente Marcos (2018)](https://arxiv.org/abs/1809.02571) state. The Solar System map draws the orbits of these objects by default, whatever their page shows.

![The Solar System map at its default view, with the extreme trans-Neptunian orbits drawn](../../../evidence/extreme-tnos/solar-system-map.webp)

Captured headless from the development server on 2026-09-28 with this package prepared.

## Known problems

The orbit is JPL Horizons' Sun-centred osculating orbit at 2026-09-03. Papers quote barycentric orbits for these distant objects; for them the far end of the orbit can differ by several per cent (Leleākūhonua: semimajor axis 1322 au Sun-centred, 1213 au barycentric, both from Horizons at 2026-09-03), while the direction of the orbit changes by less than 0.2°. The fixed-epoch two-body orbit does not simulate long-term perturbations. A sphere with an unmapped grid is not a resolved surface observation. The occultation radius assumes a circular outline and a prior on the size distribution; the paper shows how the result moves with that prior.
