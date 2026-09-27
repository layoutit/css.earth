# Bennu: hydrated minerals and carbon-bearing material

Proposal 02 · **Qualification first** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The current spectral color is a MapCam visible/near-infrared composite, not an OVIRS hydration or carbon-band map.

Separate maps of the 2.74 µm absorption and the 3.2–3.6 µm band area. They show spectral signatures that are absent from the existing MapCam color maps.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md)

## Evidence

Downloaded and scanned the two native FITS products. Each contains 196,608 rows and is 4,728,960 bytes. The OH product has 367 negative values at the missing-data floor; the carbon-band product has 370 negative values, so negativity alone is not a safe generic mask. The FITS shape and row count agree with the detailed-survey README's roughly 200,000-facet v020 SPC model.

## Work

A larger preparation task than thermal inertia. Use the source FITS layout, retain archive discrepancies as evidence, and qualify the scientific quantity before adding a surface view.

## Limits and prior decisions

The OH XML says 49,152 records; the FITS has four times as many. Its filename says 2.7 µm while the README specifies a measurement at 2.74 µm. The XML says percent but native values are around 0.14 and the FITS unit is BAND_DEPTH: establish the scale explicitly before labeling. Carbonates and organics both contribute to the 3.2–3.6 µm feature; do not label it organic abundance. Resolve fill values, source-frame transfer and uncertainty before release.

## Acceptance

Resolve fraction versus percent using the native documentation and an independent numeric sample. Preserve the -9999 sentinel while investigating the three additional negative carbon-band values. Check source-shape registration. Include the OTES 350 cm⁻¹ band only if emission-angle bias can be bounded; otherwise retain its exclusion.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/data_vnir_maps/detailed_survey/ovirs_eq3_maps_readme.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/data_vnir_maps/detailed_survey/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/bundle_spectral_analysis.xml)

PDS bundle IDs: `urn:nasa:pds:orex.spectral_analysis`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
