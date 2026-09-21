# Namaka

Namaka is a moon of Haumea.

## Identity

Namaka is Haumea II, first designated S/2005 (2003 EL61) 2. JPL Horizons carries it as body 220136108.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Illustrative sphere at the approximate 85 km radius in the header of JPL Horizons' satellite solution for Namaka. No shape model is published.

The position is one geometric state from JPL Horizons satellite solution `tnosat_v001b_20136108_jpl110_20221014` at the scene epoch, retained as three responses under [source/orbit](source/orbit) and recorded in [the epoch state record](source/validation/epoch-state.json): the moon relative to Haumea, Haumea's heliocentric state, and an independent heliocentric check. They compose to 4.0e-07 km. It is never propagated at runtime.

The Horizons satellite solution tnosat_v001b_20136108_jpl110_20221014 uses 29 observations from 2005 to 2008 and states a 1570 km position uncertainty with respect to the primary on 2025-Jan-01. That is the solution's own statement at that date, not a measured uncertainty at this 2026 scene epoch.

- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/): orbit solution, header radius and gravitational parameters.

## Evidence

No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere with the shared grid that marks unmapped terrain. Its true shape, pole, rotation, colour and albedo pattern are not published, and none is shown. The radius is the approximate header value of the orbit solution, not a measurement cited to a paper here.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
