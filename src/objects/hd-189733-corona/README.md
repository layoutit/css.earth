# HD 189733 A corona

This package draws the corona of [HD 189733 A](../hd-189733/README.md) as prepared volumes attached to the star. No telescope has imaged this corona, and no paper publishes what is drawn: each grid is derived here from one of the star's observed magnetic maps, by the method of [the shared note](../../../docs/stellar-corona-from-magnetic-maps.md). The star lists it as "Derived corona", with one step for each of 3 maps.

## Sources

- **Magnetic maps:** CFHT ESPaDOnS, CFHT programs 06BD01, 06BF27, 06BT15, from the Canadian Astronomy Data Centre; reduced and mapped in this project with Korg 1.3.1, LSDpy 1.0.0, specpolFlow 1.1.0, ZDIpy. This research used the facilities of the Canadian Astronomy Data Centre operated by the National Research Council of Canada with the support of the Canadian Space Agency. ([source](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/)); CFHT ESPaDOnS, CFHT program 07AC27, from the Canadian Astronomy Data Centre; reduced and mapped in this project with Korg 1.3.1, LSDpy 1.0.0, specpolFlow 1.1.0, ZDIpy. This research used the facilities of the Canadian Astronomy Data Centre operated by the National Research Council of Canada with the support of the Canadian Space Agency. ([source](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/)); CFHT ESPaDOnS, CFHT program 13BE92, from the Canadian Astronomy Data Centre; reduced and mapped in this project with Korg 1.3.1, LSDpy 1.0.0, specpolFlow 1.1.0, ZDIpy. This research used the facilities of the Canadian Astronomy Data Centre operated by the National Research Council of Canada with the support of the Canadian Space Agency. ([source](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/)): the radial field the star's own package draws, read from the same files.
- **X-ray output:** Freund et al. (2022), A&A 664, A105 ([source](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/664/A105)), 2RXS J200043.2+224238, 6.46 arcsec from the star's Gaia position, stellar probability 0.9997: 6.4 × 10^-13 erg s⁻¹ cm⁻² at Earth in 0.1 to 2.4 keV (ROSAT), which at 19.78 pc is 3.0 × 10^28 erg s⁻¹, or 8.7 × 10^5 erg s⁻¹ from each cm² of the surface.
- **Temperature:** 3.8 million kelvin, not measured: the temperature stars of this X-ray output have (Johnstone & Güdel (2015), A&A 578, A129) ([source](https://arxiv.org/abs/1505.00643), Equation 4: T = 0.11 F_X^0.26 million kelvin).
- **Mass loss:** 6.9 times the Sun's, not measured: what the X-ray output suggests (Wood et al. (2021), ApJ 915, 37), uncertain by a factor of 5 or more ([source](https://arxiv.org/abs/2105.00019), Section 5.1 and Table 3: mass loss per unit surface rises as F_X^0.77).
- **Mass and radius:** 0.81 solar masses and 0.75 solar radii, the values [the star's package](../hd-189733/README.md) cites.
- **Recipe:** `telescope new-object` with a `coronae` entry ([`corona-bank.mts`](../../../packages/telescope-cli/src/new-object/corona/corona-bank.mts)) writes everything in `source/`; the numbers it used are in `source/corona-parameters.json`.

**Every grid is a density in three dimensions.** Each voxel takes the density at its own place about the star. Nothing is a sky image given depth.

## What the maps give

| Map | Mean field (gauss) | Left out by the harmonics | Open share of the sphere at 1.05, 1.2, 1.5, 2, 2.4 radii | Sky within 10° of the reversal line |
| --- | --- | --- | --- | --- |
| Aug 2006 | 12.4 | 0% | 0.20, 0.28, 0.50, 0.79, 0.96 | 19% |
| Jun 2007 | 10.7 | 0% | 0.14, 0.21, 0.39, 0.71, 0.94 | 25% |
| Sep 2013 | 32.7 | 0% | 0.34, 0.40, 0.54, 0.78, 0.97 | 20% |

The wind leaves the surface at 87 km/s and passes the speed of sound 1.93 radii out. Gas at rest has 7.4 × 10^8 electrons per cm³ at the surface and falls by e every 0.26 radii at first.

**Orientation.** The rotation axis is 72° from the line of sight, as the map was fitted, in the frame the star's own maps are drawn in (`src/objects/hd-189733/source/preparation/rotation.json`); where the axis points on the sky and the star's rotation phase today are conventions.

## Known problems

- It is a derivation, not a measurement or a published model. Against the one star with a published simulation, ε Eridani, the method's density is within a factor of two on average ([the shared note](../../../docs/stellar-corona-from-magnetic-maps.md)).
- The mass loss is not measured. It sets how bright the gas away from the sheet is drawn, not where the sheet is.
- The temperature is not measured; it is the one the X-ray output suggests.
- A magnetic map shows only the large-scale field and misses the part of the star that never turns toward us.
- The direction of the rotation axis on the sky and the rotation phase are conventions.
