# Leucus

Leucus is an elongated Jupiter Trojan with an unusually slow rotation.

## Sources

Ellipsoid approximation using the published convex model's maximum dimensions, as summarized by the Lucy mission paper. It does not reproduce the original irregular convex mesh or occultation silhouettes. Full approximation dimensions: 60.8 × 39.1 × 27.8 km. Published prograde pole, with an arbitrary display meridian. The approximation has no qualified current surface longitude. The grid marks unmapped terrain.

Source: [Mottola et al. (2020), The Planetary Science Journal 1, 73; Levison et al. (2025), Space Science Reviews 221, 70](https://elib.dlr.de/139387/1/Mottola_2020_Planet._Sci._J._1_73.pdf). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

- No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.

- The original Mottola 2020 convex mesh was not located in the checked paper's supporting release.

- DAMIT models 6692 and 6693 have different poles and no matched absolute scale; their geometry is not mixed with this solution.

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

JPL Horizons command "11351;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

</details>
