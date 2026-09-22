# Patroclus

Patroclus and Menoetius form a large Trojan binary that Lucy will visit in the trailing swarm.

## Sources

Published primary-component ellipsoid combining occultation and light-curve constraints. Its full axes differ from the two-dimensional occultation limb and from the unresolved binary system's radiometric diameter. Full approximation dimensions: 127 × 117 × 98 km. Synchronous spin-axis approximation using the same 2024 orbital pole as Menoetius; arbitrary display meridian. A physical mutual-event phase is not claimed. The grid marks unmapped terrain.

Source: [Buie et al. (2015), The Astronomical Journal 149, 113; existing JPL#82 Patroclus-Menoetius source closure](https://www2.boulder.swri.edu/~buie/biblio/pub099.html). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

- No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.

- Local shape deviations and a physical mutual-event rotational phase remain unqualified.

- The existing Menoetius package supplies the retained primary-specific heliocentric state; the system barycentre is not substituted for Patroclus.

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

JPL Horizons command "920000617"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude. The existing Menoetius primary-specific JPL#82 state overrides the conic at this epoch for a consistent binary origin.

</details>
