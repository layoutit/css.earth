# 2017 OF201

2017 OF201 never comes closer to the Sun than about 45 au, and its orbit reaches about 1,600 au. It was reported in 2025 from 24 observations spread over 20 years.

Source selections and open questions are in the [investigation ledger](investigations.json).

## Sources

| Source | Display interpretation |
| --- | --- |
| [Cheng, Li & Yang (2026), The Astrophysical Journal Letters 998, 6: diameter about 700 km for an assumed albedo of 0.13](https://arxiv.org/abs/2505.15806) | Sphere at the estimated diameter |
| [JPL Horizons elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric geometric position and orbit at the fixed 2026-09-03 epoch. |

Illustrative sphere 700 km across, the diameter Cheng, Li & Yang estimate from its brightness for an assumed albedo of 0.13. The size is not measured.

Illustrative ICRF north pole, arbitrary prime meridian and phase; no spin pole is published.

The normal grid marks unmapped terrain. Shadows default off. [Measurements](source/measurements.json), [source manifest](source/manifest.json) and [credits](NOTICE.md) keep the numbers and terms.

## On the map

It is an extreme trans-Neptunian object: semimajor axis over 150 au and perihelion beyond 30 au, the definition [de la Fuente Marcos & de la Fuente Marcos (2018)](https://arxiv.org/abs/1809.02571) state. The Solar System map shows these objects as named dots by default, whatever their page shows; their orbits stay hidden like other trans-Neptunian orbits and appear on hover.

![The Solar System map at its default view, with the extreme trans-Neptunian objects named](../../../evidence/extreme-tnos/solar-system-map.webp)

Captured headless from the development server on 2026-09-28 with this package prepared.

## Known problems

The orbit is JPL Horizons' Sun-centred osculating orbit at 2026-09-03. Papers quote barycentric orbits for these distant objects; for them the far end of the orbit can differ by several per cent (Leleākūhonua: semimajor axis 1322 au Sun-centred, 1213 au barycentric, both from Horizons at 2026-09-03), while the direction of the orbit changes by less than 0.2°. The fixed-epoch two-body orbit does not simulate long-term perturbations. A sphere with an unmapped grid is not a resolved surface observation. The discovery paper also discusses how this orbit relates to the proposed distant planet. That debate is not settled, so the app does not present it.
