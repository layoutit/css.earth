# HD 6569 corona

This package draws the corona of [HD 6569](../hd-6569/README.md) as prepared volumes attached to the star. No telescope has imaged this corona, and no paper publishes what is drawn: each grid is derived here from one of the star's observed magnetic maps, by the method of [the shared note](../../../docs/stellar-corona-from-magnetic-maps.md). The star lists it as "Derived corona".

## Sources

- **Magnetic map:** CFHT ESPaDOnS, CFHT program 15BP19, from the Canadian Astronomy Data Centre; reduced and mapped in this project with Korg 1.3.1, LSDpy 1.0.0, specpolFlow 1.1.0, ZDIpy. This research used the facilities of the Canadian Astronomy Data Centre operated by the National Research Council of Canada with the support of the Canadian Space Agency. ([source](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/)): the radial field the star's own package draws, read from the same files.
- **X-ray output:** Freund et al. (2022), A&A 664, A105 ([source](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/664/A105)), 2RXS J010625.8-141723, 22.91 arcsec from the star's Gaia position, stellar probability 0.9935: 1.1 × 10^-12 erg s⁻¹ cm⁻² at Earth in 0.1 to 2.4 keV (ROSAT), which at 45.47 pc is 2.7 × 10^29 erg s⁻¹, or 7.6 × 10^6 erg s⁻¹ from each cm² of the surface.
- **Temperature:** 6.8 million kelvin, not measured: the temperature stars of this X-ray output have (Johnstone & Güdel (2015), A&A 578, A129) ([source](https://arxiv.org/abs/1505.00643), Equation 4: T = 0.11 F_X^0.26 million kelvin).
- **Mass loss:** 37 times the Sun's, not measured: what the X-ray output suggests (Wood et al. (2021), ApJ 915, 37), uncertain by a factor of 5 or more ([source](https://arxiv.org/abs/2105.00019), Section 5.1 and Table 3: mass loss per unit surface rises as F_X^0.77).
- **Mass and radius:** 0.85 solar masses and 0.76 solar radii, the values [the star's package](../hd-6569/README.md) cites.
- **Recipe:** `telescope new-object` with a `coronae` entry ([`corona-bank.mts`](../../../packages/telescope-cli/src/new-object/corona/corona-bank.mts)) writes everything in `source/`; the numbers it used are in `source/corona-parameters.json`.

**Every grid is a density in three dimensions.** Each voxel takes the density at its own place about the star. Nothing is a sky image given depth.

## What the maps give

| Map | Mean field (gauss) | Left out by the harmonics | Open share of the sphere at 1.05, 1.2, 1.5, 2, 2.4 radii | Sky within 10° of the reversal line |
| --- | --- | --- | --- | --- |
| Sep 2015 | 11.4 | 0% | 0.34, 0.41, 0.56, 0.78, 0.96 | 18% |

The wind leaves the surface at 263 km/s and passes the speed of sound 1.15 radii out. Gas at rest has 1.3 × 10^9 electrons per cm³ at the surface and falls by e every 0.44 radii at first.

**Orientation.** The rotation axis is 77° from the line of sight, as the map was fitted, in the frame the star's own maps are drawn in (`src/objects/hd-6569/source/preparation/rotation.json`); where the axis points on the sky and the star's rotation phase today are conventions.

## Known problems

- It is a derivation, not a measurement or a published model. Against the one star with a published simulation, ε Eridani, the method's density is within a factor of two on average ([the shared note](../../../docs/stellar-corona-from-magnetic-maps.md)).
- The mass loss is not measured. It sets how bright the gas away from the sheet is drawn, not where the sheet is.
- The temperature is not measured; it is the one the X-ray output suggests.
- A magnetic map shows only the large-scale field and misses the part of the star that never turns toward us.
- The direction of the rotation axis on the sky and the rotation phase are conventions.
