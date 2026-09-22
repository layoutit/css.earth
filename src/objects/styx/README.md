# Styx

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

- Porter, Verbiscer and Canup (2025), [presentation slide 9](https://www.hou.usra.edu/meetings/plutosystem2025/presentations/Friday/1135_Porter.pdf), reports a 10.6 × 6.0 × 5.3 km best fit and a 7.0 km equivalent diameter.

- The [conference abstract](https://www.hou.usra.edu/meetings/plutosystem2025/pdf/7035.pdf) rounds those dimensions to 11 × 6 × 5 km.

## Evidence

- The archived label, native-frame identity and OPUS metadata are retained under [source/survey/](source/survey/). The inspected FITS source is excluded from the runtime and is reproducible by its URL and SHA-256 in `native-inspection.json`.

## Known problems

- These are approximate conference results from imagery and lightcurves, not a downloadable terrain mesh. `measurements.json` defines the analytic ellipsoid; it preserves the three semi-axes without renormalization to the 3.5 km reference radius.

- **Coverage and orientation:** Every material pixel is explicitly no-data; the shared coverage preparer supplies the gray grid. The 2025 fit does not converge on a unique rotational pole.

- The shared astronomy model uses the historical Weaver et al. (2016) pole as a static illustration, with an arbitrary spin phase. The reported 3.24-day period is a factsheet value, not an implemented spin-phase ephemeris. Styx is not tidally locked.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="styx-sources-and-interpretation"></a>

Styx, Pluto’s innermost small moon, uses a labeled **Shape model** with the standard missing-coverage grid.

It is not a uniquely measured pose or a prediction of long-term chaotic rotation.

Source selections and alternative products are recorded in the [investigation ledger](investigations.json).

Shape, thumbnail, minimap and context portrait all use that grid. Flood and Shadows are prepared on the same mesh. No elevation, photometric correction, color reconstruction, fabricated terrain, or body-specific runtime controller is introduced. Preparation targets 480 native `u` leaves with a hard 2,000-leaf maximum.

The small analytic radius table, neutral no-data sentinel and context portrait are versioned source inputs.

</details>
