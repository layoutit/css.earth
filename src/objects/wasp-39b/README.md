# WASP-39 b

WASP-39 b is a puffy gas giant 1.28 times as wide as Jupiter, circling a Sun-like star every four days. Here it is a plain gray sphere of that size.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Measured, from Mancini et al. 2018, A&A 613, A41 (2018), arXiv:1802.03859: radius 1.279 ± 0.037 ± 0.014 Jupiter radii (at 71492 km per Jupiter radius), inclination 87.32 degrees. The period and transit time are this project's: a straight line through six JWST transits of 2022 to 2026 ([`transit-times.csv`](source/science/jwst-transits/transit-times.csv), fitted with [`fit-transit-time.mts`](../../../tools/objects/jwst/fit-transit-time.mts)) gives 4.0552802 days and puts every transit within 0.2 minutes of it; Mancini et al.'s 4.0552941 days (T0 = BJD 2455342.96913) runs 21 to 28 minutes late over the same transits. Scaled distance a/R* = 11.07. The orbit is drawn circular. The position angle of the orbit on the sky is not measured; the ascending node at celestial north is a display convention.

Measured and not shown: mass, 0.281 ± 0.031 ± 0.006 Jupiter masses (Mancini et al. 2018, appendix table of WASP-39's physical parameters), and a transmission spectrum. Not measured and not shown: colour, albedo, surface, rotation. The rotation is assumed synchronous.

## Evidence

No dated test report exists for this body yet.

## Known problems

JWST has measured this planet’s atmospheric spectrum; none of that is shown. Mancini et al. measure a sky-projected spin-orbit angle of 0 ± 11 degrees, which is not used. The package draws a neutral gray sphere of the measured radius.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
