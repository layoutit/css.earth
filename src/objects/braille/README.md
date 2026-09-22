# Braille

Deep Space 1 visited Braille in 1999.

## Sources

Ellipsoid approximation of the published 2.1 × 1 × 1 km size estimate combining Deep Space 1 images and ground-based photometry. The equal short axes are part of that coarse estimate; resolved local terrain is not represented. Full approximation dimensions: 2.1 × 1 × 1 km. Arbitrary display pole and meridian. The published 226.4 ± 1.3 h estimate is synodic and is not installed as a sidereal spin or an observed pole. The grid marks unmapped terrain.

Source: [Oberst et al. (2001), Icarus 153, 16–23; Buratti et al. (2004), Icarus 167, 129–135, Table 1](https://doi.org/10.1006/icar.2001.6648). Checked 2026-09-09. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

- Deep Space 1 images and integrated spectra exist, but no registered global surface mosaic is qualified for this approximation. Integrated spectra are not surface maps.

- Original closed global mesh and registered surface imagery remain unresolved in the checked DS1 archive.

- Integrated infrared spectra constrain composition, not the position of surface texels.

- The quoted period is a probable synodic solution, not a qualified sidereal attitude model.

- The arbitrary display pole and meridian are not measured orientation.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="shape-scale-and-orientation"></a>
<a id="source-survey"></a>
<a id="orbit"></a>
<a id="reproduction"></a>

<details>
<summary>Methods and source notes</summary>

**Shape, scale and orientation**

The [measurements](source/measurements.json) record the radius-table formula and
pole conversion. The [table tool](../../../tools/objects/source-authoring/README.md)
reproduces the pinned radii. The [navigation recipe](source/preparation/navigation.json)
records the context image; shared preparation produces the scene.

**Source survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Orbit**

JPL Horizons command "9969;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

</details>
