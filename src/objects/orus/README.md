# Orus

Orus is a dark Jupiter Trojan selected for Lucy's exploration of the leading swarm.

## Sources

Ellipsoid approximation using the published convex model's maximum dimensions, as summarized by the Lucy mission paper. The original convex mesh and local concavities are not represented. Full approximation dimensions: 70.7 × 63 × 51.4 km. Published retrograde pole, with an arbitrary display meridian. The approximation has no qualified current surface longitude. The grid marks unmapped terrain.

Source: [Mottola et al. (2023), The Planetary Science Journal 4, 18, Table 3; Levison et al. (2025), Space Science Reviews 221, 70](https://elib.dlr.de/194154/1/Mottola%20et%20al%202023_shapes%20of%20Eurybates%20and%20Orus.pdf). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

- No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.

- The checked paper's supporting material contains observation tables; an original downloadable convex mesh was not located.

- The paper's 60.5 km surface-equivalent diameter is not a volume-equivalent diameter and is not used to rescale this approximation.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

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

JPL Horizons command "21900;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

</details>
