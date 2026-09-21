# Weywot

Weywot is a moon of Quaoar.

## Identity

Weywot is Quaoar I, first designated S/2006 (50000) 1. JPL Horizons carries it as body 120050000.

## Sources

Pinned inputs are listed in the [source manifest](source/manifest.json).

Illustrative sphere at the approximate 85 km radius in the header of JPL Horizons' satellite solution for Weywot. No shape model is published.

The position is one geometric state from JPL Horizons satellite solution `tnosat_v001_20050000_jpl043_20220908` at the scene epoch, retained as three responses under [source/orbit](source/orbit) and recorded in [the epoch state record](source/validation/epoch-state.json): the moon relative to Quaoar, Quaoar's heliocentric state, and an independent heliocentric check. They compose to 9.3e-07 km. It is never propagated at runtime.

The Horizons satellite solution tnosat_v001_20050000_jpl043_20220908 uses 9 observations from 2006 to 2011 and states a 3600 km position uncertainty with respect to the primary on 2025-Jan-01. That is the solution's own statement at that date, not a measured uncertainty at this 2026 scene epoch.

- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/): orbit solution, header radius and gravitational parameters.

## Evidence

No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere with the shared grid that marks unmapped terrain. Its true shape, pole, rotation, colour and albedo pattern are not published, and none is shown. The radius is the approximate header value of the orbit solution, not a measurement cited to a paper here.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
