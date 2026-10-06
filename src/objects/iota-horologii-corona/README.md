# ι Horologii corona

This package draws the corona of [ι Horologii](../iota-horologii/README.md) as prepared volumes attached to the star. No telescope has imaged this corona, and no paper publishes what is drawn: each grid is derived here from one of the star's observed magnetic maps, by the method of [the shared note](../../../docs/stellar-corona-from-magnetic-maps.md). The star lists it as "Derived corona", with one step for each of 18 maps.

## Sources

- **Magnetic maps:** J. D. Alvarado-Gómez and G. Hussain (2025); ESO 3.6 m HARPSpol ([source](https://zenodo.org/records/17251923)): the radial field the star's own package draws, read from the same files.
- **X-ray output:** Freund et al. (2022), A&A 664, A105 ([source](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/664/A105)), 2RXS J024232.5-504758, 7.24 arcsec from the star's Gaia position, stellar probability 0.9996: 3.4 × 10^-12 erg s⁻¹ cm⁻² at Earth in 0.1 to 2.4 keV (ROSAT), which at 17.36 pc is 1.2 × 10^29 erg s⁻¹, or 1.5 × 10^6 erg s⁻¹ from each cm² of the surface.
- **Temperature:** 4.4 million kelvin, not measured: the temperature stars of this X-ray output have (Johnstone & Güdel (2015), A&A 578, A129) ([source](https://arxiv.org/abs/1505.00643), Equation 4: T = 0.11 F_X^0.26 million kelvin).
- **Mass loss:** 25 times the Sun's, not measured: what the X-ray output suggests (Wood et al. (2021), ApJ 915, 37), uncertain by a factor of 5 or more ([source](https://arxiv.org/abs/2105.00019), Section 5.1 and Table 3: mass loss per unit surface rises as F_X^0.77).
- **Mass and radius:** 1.23 solar masses and 1.16 solar radii, the values [the star's package](../iota-horologii/README.md) cites.
- **Recipe:** `telescope new-object` with a `coronae` entry ([`corona-bank.mts`](../../../packages/telescope-cli/src/new-object/corona/corona-bank.mts)) writes everything in `source/`; the numbers it used are in `source/corona-parameters.json`.

**Every grid is a density in three dimensions.** Each voxel takes the density at its own place about the star. Nothing is a sky image given depth.

## What the maps give

| Map | Mean field (gauss) | Left out by the harmonics | Open share of the sphere at 1.05, 1.2, 1.5, 2, 2.4 radii | Sky within 10° of the reversal line |
| --- | --- | --- | --- | --- |
| Oct 2015 | 1.5 | 1% | 0.20, 0.26, 0.43, 0.76, 0.95 | 18% |
| Dec 2015 | 2.2 | 1% | 0.22, 0.35, 0.55, 0.78, 0.96 | 19% |
| Feb 2016 | 1.7 | 1% | 0.31, 0.44, 0.63, 0.81, 0.98 | 17% |
| Jun 2016 | 1.3 | 2% | 0.17, 0.22, 0.38, 0.68, 0.94 | 28% |
| Aug 2016 | 1.5 | 1% | 0.36, 0.44, 0.57, 0.78, 0.96 | 19% |
| Sep 2016 | 1.9 | 1% | 0.15, 0.22, 0.37, 0.67, 0.94 | 29% |
| Oct 2016 | 1.2 | 5% | 0.31, 0.36, 0.50, 0.75, 0.96 | 22% |
| Dec 2016 | 1.3 | 1% | 0.20, 0.33, 0.51, 0.79, 0.96 | 18% |
| Feb 2017 | 2.1 | 0% | 0.15, 0.22, 0.39, 0.73, 0.94 | 23% |
| Jul 2017 | 1.4 | 3% | 0.26, 0.32, 0.44, 0.72, 0.95 | 26% |
| Aug 2017 | 1.5 | 1% | 0.19, 0.26, 0.42, 0.70, 0.94 | 25% |
| Sep 2017 | 1.3 | 1% | 0.22, 0.28, 0.44, 0.71, 0.93 | 24% |
| Nov 2017 | 1.7 | 6% | 0.29, 0.35, 0.48, 0.76, 0.95 | 21% |
| Dec 2017 | 2.3 | 5% | 0.33, 0.39, 0.52, 0.76, 0.95 | 21% |
| Feb 2018 | 1.8 | 7% | 0.36, 0.43, 0.56, 0.77, 0.95 | 19% |
| Jun 2018 | 2.6 | 6% | 0.35, 0.40, 0.53, 0.76, 0.96 | 20% |
| Aug 2018 | 1.4 | 7% | 0.37, 0.43, 0.55, 0.77, 0.95 | 19% |
| Sep 2018 | 2.8 | 4% | 0.35, 0.40, 0.52, 0.76, 0.96 | 20% |

The wind leaves the surface at 126 km/s and passes the speed of sound 1.66 radii out. Gas at rest has 6.6 × 10^8 electrons per cm³ at the surface and falls by e every 0.30 radii at first.

**Orientation.** The rotation axis is 60° from the line of sight, as the map was fitted, in the frame the star's own maps are drawn in (`src/objects/iota-horologii/source/preparation/rotation.json`); where the axis points on the sky and the star's rotation phase today are conventions.

## Known problems

- It is a derivation, not a measurement or a published model. Against the one star with a published simulation, ε Eridani, the method's density is within a factor of two on average ([the shared note](../../../docs/stellar-corona-from-magnetic-maps.md)).
- The mass loss is not measured. It sets how bright the gas away from the sheet is drawn, not where the sheet is.
- The temperature is not measured; it is the one the X-ray output suggests.
- A magnetic map shows only the large-scale field and misses the part of the star that never turns toward us.
- The direction of the rotation axis on the sky and the rotation phase are conventions.
