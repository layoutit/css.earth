# Vesta: qualify VIR mineral and rock signatures

Proposal 31 · **Blocked by existing evidence** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Vesta has FC spectral ratios. Its ledger already excludes the small NASA VIR press mineral map as a quantitative input.

Find and qualify the original VIR measurements or derived grids behind the mineral, hydration and rock-unit maps.

Content owners: [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

## Evidence

The supplied pages show distinct VIR interpretations, including pyroxene and hydration; they do not resolve the existing native-data blocker.

## Work

Trace products to calibrated VIR spectra and documented models, retain footprint and uncertainty, and convert their frame to the selected Claudia convention.

## Limits and prior decisions

Keep the existing exclusion unless reusable numeric or registered source products are found. Howardite, eucrite and diogenite are rock categories; a press color is not a mineral percentage.

## Acceptance

An original-product receipt, independent spectral samples, frame validation and a quantity-specific interpretation. Do not release an RGB-to-abundance reconstruction.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/visible-and-infrared-data-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/a-global-view-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-visible-and-infrared-spectrometer-data/)
- [NASA source page](https://science.nasa.gov/photojournal/global-mineral-map-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/pyroxene-map-of-vestas-south-pole/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-hydrated-minerals-on-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-rock-properties-at-giant-asteroid-vesta/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA14697](https://science.nasa.gov/photojournal/visible-and-infrared-data-mosaic/) | candidate | Vesta July 2011 VIR paired views sample about 1.3 km/pixel; recover original spectra and distinguish simulated true color from physical band information. |
| [PIA15144](https://science.nasa.gov/photojournal/a-global-view-of-vesta/) | candidate | Vesta HAMO VIR image set is spectral instrument data distinct from FC photography; trace exact original channels and interpretation before integration. |
| [PIA15343](https://science.nasa.gov/photojournal/mosaic-of-visible-and-infrared-spectrometer-data/) | candidate | HAMO VIR mosaic locates spectral data coverage; original wavelengths and masks are needed, and footprint graphics are not mineral measurements. |
| [PIA15669](https://science.nasa.gov/photojournal/global-mineral-map-of-vesta/) | candidate | Vesta VIR mineral press map is already excluded as a quantitative input; proposal targets original spectra/grids and explicitly retains that blocker. |
| [PIA15672](https://science.nasa.gov/photojournal/pyroxene-map-of-vestas-south-pole/) | candidate | Vesta south-polar 1 µm pyroxene proxy is a distinct band interpretation; validate the proxy and native quantity before labeling abundance. |
| [PIA16186](https://science.nasa.gov/photojournal/map-of-hydrated-minerals-on-vesta/) | candidate | VIR hydration signature is distinct from GRaND hydrogen and FC color; original band retrieval and uncertainties are required. |
| [PIA17475](https://science.nasa.gov/photojournal/map-of-rock-properties-at-giant-asteroid-vesta/) | candidate | Vesta VIR rock-type interpretation is new relative to FC ratios, but eucrite/howardite/diogenite labels require original model data and must not be described as simple mineral percentages. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
