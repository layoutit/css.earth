# HD 35296 corona

This package draws the corona of [HD 35296](../hd-35296/README.md) as prepared volumes attached to the star. No telescope has imaged this corona, and no paper publishes what is drawn: each grid is derived here from one of the star's observed magnetic maps, by the method of [the shared note](../../../docs/stellar-corona-from-magnetic-maps.md). The star lists it as "Derived corona".

## Sources

- **Magnetic map:** Willamo et al. (2022), A&A 659, A71; ESO 3.6 m HARPSpol; VizieR (CDS) ([source](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/659/A71)): the radial field the star's own package draws, read from the same files.
- **X-ray output:** Freund et al. (2022), A&A 664, A105 ([source](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/664/A105)), 2RXS J052425.7+172300, 6.09 arcsec from the star's Gaia position, stellar probability 0.9998: 1.1 × 10^-11 erg s⁻¹ cm⁻² at Earth in 0.1 to 2.4 keV (ROSAT), which at 14.58 pc is 2.7 × 10^29 erg s⁻¹, or 3.7 × 10^6 erg s⁻¹ from each cm² of the surface.
- **Temperature:** 5.6 million kelvin, not measured: the temperature stars of this X-ray output have (Johnstone & Güdel (2015), A&A 578, A129) ([source](https://arxiv.org/abs/1505.00643), Equation 4: T = 0.11 F_X^0.26 million kelvin).
- **Mass loss:** 45 times the Sun's, not measured: what the X-ray output suggests (Wood et al. (2021), ApJ 915, 37), uncertain by a factor of 5 or more ([source](https://arxiv.org/abs/2105.00019), Section 5.1 and Table 3: mass loss per unit surface rises as F_X^0.77).
- **Mass and radius:** 1.10 solar masses and 1.10 solar radii, the values [the star's package](../hd-35296/README.md) cites.
- **Recipe:** `telescope new-object` with a `coronae` entry ([`corona-bank.mts`](../../../packages/telescope-cli/src/new-object/corona/corona-bank.mts)) writes everything in `source/`; the numbers it used are in `source/corona-parameters.json`.

**Every grid is a density in three dimensions.** Each voxel takes the density at its own place about the star. Nothing is a sky image given depth.

## What the maps give

| Map | Mean field (gauss) | Left out by the harmonics | Open share of the sphere at 1.05, 1.2, 1.5, 2, 2.4 radii | Sky within 10° of the reversal line |
| --- | --- | --- | --- | --- |
| Dec 2017 | 10.1 | 1% | 0.30, 0.37, 0.52, 0.76, 0.95 | 20% |

The wind leaves the surface at 221 km/s and passes the speed of sound 1.23 radii out. Gas at rest has 7.8 × 10^8 electrons per cm³ at the surface and falls by e every 0.41 radii at first.

**Orientation.** The rotation axis is 65° from the line of sight, as the map was fitted, in the frame the star's own maps are drawn in (`src/objects/hd-35296/source/preparation/rotation.json`); where the axis points on the sky and the star's rotation phase today are conventions.

## Known problems

- It is a derivation, not a measurement or a published model. Against the one star with a published simulation, ε Eridani, the method's density is within a factor of two on average ([the shared note](../../../docs/stellar-corona-from-magnetic-maps.md)).
- The mass loss is not measured. It sets how bright the gas away from the sheet is drawn, not where the sheet is.
- The temperature is not measured; it is the one the X-ray output suggests.
- A magnetic map shows only the large-scale field and misses the part of the star that never turns toward us.
- The direction of the rotation axis on the sky and the rotation phase are conventions.
