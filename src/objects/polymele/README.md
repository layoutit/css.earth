# Polymele

Polymele is a very flattened Jupiter Trojan and a Lucy target.

## Sources

Published approximate ellipsoid from six stellar occultations, assuming the satellite's orbit is circular and equatorial. Full approximation dimensions: 27 × 24.4 × 10.4 km. The fitted pole assumes an equatorial satellite orbit. Rotation period and current longitude remain unqualified; the display meridian is arbitrary. The grid marks unmapped terrain.

Source: [Levison et al. (2023), ACM abstract 2184; Levison et al. (2025), Space Science Reviews 221, 70](https://occultations.org/publications/rasc/2023/2184Polymele1.pdf). Checked 2026-09-08. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

- No resolved registered surface mosaic was qualified for this pre-encounter target. Integrated spectra are not surface maps.

- The selected model does not establish a current rotational phase or an unambiguous period.

- The satellite is outside this standalone asteroid package.

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

JPL Horizons command "15094;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

</details>
