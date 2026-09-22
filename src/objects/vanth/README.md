# Vanth

Vanth is a moon of Orcus.

## Identity

Vanth is Orcus I, first designated S/2005 (90482) 1. JPL Horizons carries it as body 120090482.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Illustrative sphere at the approximate 221.5 km radius in the header of JPL Horizons' satellite solution for Vanth. No shape model is published.

The position is one geometric state from JPL Horizons satellite solution `tnosat_v001_20090482_jpl043_20220908` at the scene epoch, retained as three responses under [source/orbit](source/orbit) and recorded in [the epoch state record](source/validation/epoch-state.json): the moon relative to Orcus, Orcus's heliocentric state, and an independent heliocentric check. They compose to 8.3e-07 km. It is never propagated at runtime.

The Horizons satellite solution tnosat_v001_20090482_jpl043_20220908 uses 12 observations from 2005 to 2015 and states a 67 km position uncertainty with respect to the primary on 2025-Jan-01. That is the solution's own statement at that date, not a measured uncertainty at this 2026 scene epoch.

- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/): orbit solution, header radius and gravitational parameters.

## Evidence

No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere with the shared grid that marks unmapped terrain. Its true shape, pole, rotation, colour and albedo pattern are not published, and none is shown. The radius is the approximate header value of the orbit solution, not a measurement cited to a paper here.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
