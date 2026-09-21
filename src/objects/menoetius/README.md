# Menoetius

Menoetius forms a binary system with Patroclus.

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

Published approximate ellipsoid with full dimensions 117×108×90 km, inferred from occultation and photometry. Orbital-pole alignment is a synchronous approximation; the display meridian is arbitrary. The grid marks unmapped terrain.

- [Buie et al. Patroclus-Menoetius occultation](https://www2.boulder.swri.edu/~buie/biblio/pub099.html)

## Evidence

Menoetius uses the JPL#82 system ephemeris and its own matching primary center. Exact target/center IDs, time conversion, vectors, parent GM and independent heliocentric composition checks are in [epoch record](source/validation/epoch-state.json). Runtime extrapolation is not enabled.

[Source test definitions](../../../tests/objects/unit/menoetius/source.test.mts).

## Known problems

Published full axes are halved to construct the ellipsoid. The 2024 orbital pole approximates a synchronous spin axis; current longitude is unknown. Discrepant negative occultation chords and ambiguous, unarchived tapes do not establish a crater.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="menoetius-source-model"></a>
<a id="selected-geometry"></a>
<a id="assumptions"></a>
<a id="source-interpretation-limits"></a>
<a id="orbit-and-orientation"></a>
<a id="survey-and-sources"></a>
<a id="selected-fixed-epoch-position"></a>

<details>
<summary>Methods and source notes</summary>

**Selected geometry**

Buie 2015 mean-ellipsoidal full axes 117×108×90 km; not the observed projected 117.2×93 km limb.

**Orbit and orientation**

The [validation records](source/validation) identify the parent-relative state and any fit interval. The display uses meridian zero.

**Survey and sources**

Source decisions and the historical review they came from are recorded in the [investigation ledger](investigations.json).

</details>
