# Trans-Neptunian population

This batch adds three bodies with different physical evidence. Their pages use the existing generic object package, retained PolyCSS `u` raster triangles and world camera. `trans-neptunian` is a reporting category; it does not identify these bodies as IAU-recognized dwarf planets.

| Body | Physical evidence | Surface representation |
| --- | --- | --- |
| Arrokoth | Porter 2024 New Horizons release: 20,484 vertices, 40,960 faces, two overlapping closed lobe meshes | Default missing-data grid; optional fitted LORRI albedo in the release's original per-corner OBJ UVs |
| Quaoar | Margoti et al. 2026 oblate occultation fit, equatorial semiaxes 566.1 km and polar semiaxis 511.2 km | Grid with two explicitly schematic rings at published radii |
| Gǃkúnǁʼhòmdímà (229762) | Proudfoot et al. 2026 Maclaurin model, semiaxes 329, 329, 294 km, with a satellite-orbit pole assumption | Grid; competing triaxial interpretation remains possible |

## Scientific limits

Arrokoth's source mesh preserves both published lobes and their overlap. Southern geometry is constrained by flyby imagery; unseen northern shape is modeled. Meshoptimizer simplifies the full source connectivity; no centre-ray reconstruction or invented joining neck is used. The bundled paper and PDS XML disagree on pole coordinates. We use the paper's revised pole with an arbitrary display meridian and do not claim a qualified current spin phase.

The optional albedo view is a scalar model map, with a grayscale stretch of 0.03–0.08. Its broad uniform baseline is retained exactly as source data. The release supplies no observation-coverage mask, so that baseline is not classified as measured imagery or converted into an invented confidence mask. The default remains the normal missing-data grid. The original OBJ UV indices supply the two south-polar projections; each simplified surface point transfers to the selected closest original source triangle within the configured 250 m simplification allowance. Bilinear sampling stays in the original UV domain. The source geometry can select either incident triangle at a shared boundary; exact texel correspondence is not claimed for boundary ties.

The PDS PNG and raw FITS arrays have opposite row order. Twenty-four independent decoded PNG anchors reproduce their corresponding FITS values within 3e-6 albedo using the label's approximate integer conversion. Standard lower-left OBJ V therefore indexes raw FITS rows directly. `arrokoth-registration.json` records those checks and exact source hashes. Flat latitude/longitude previews withhold directions with multiple source intersections; the 3D albedo transfer uses local surface points.

Quaoar's body pole inherits its ring-plane prior. The adopted ring radii are 4057.2 km and 2520 km. Q1R uses the 76.4 km tenuous component width measured at one Gemini chord as a circular schematic; actual width varies with azimuth, and the dense arc is not reconstructed. Q2R uses the published typical 10 km width. Uniform gray and display opacity are illustrative, not measured reflectance or optical depth. Both bands reuse the shared terrestrial ring capability extracted from Haumea.

Gǃkúnǁʼhòmdímà's model assumes its satellite orbit is equatorial. Its photometric period has aliases, and the pole and meridian must not be read as a precision surface attitude. All three pages default Shadows and Orbit off.

## Reproduction

1. Restore pinned source inputs with each body's existing acquisition recipe. Original shape, albedo and papers stay reacquirable; the source manifests record exact byte lengths and hashes. Common panorama, neutral material and title font are the existing shared assets.
2. Run `python3 docs/trans-neptunian/author.py` for the authored numeric extraction and object source recipes. Its shared contract template is fixed at commit `1fb76e44d6bf831e7ebcf0516b83c0b10e1716da`; it does not import physical facts from that template.
3. Run `node docs/trans-neptunian/finalize-sources.mjs` for titles, source-mesh navigation snapshots and manifest pins. `--refresh-pins` refreshes documents without re-rendering snapshots.
4. Run the existing authored object preparer for only these three IDs, serially. No new rendering path runs in the browser.

JPL Horizons element and independent vector responses are retained beside each body. The shared astronomy generator uses the existing fixed 2026-09-03 TT scene epoch. This is contextual orbit placement, not a live ephemeris.

## Sources

- [NASA PDS: Porter 2024 Arrokoth shape/albedo collection](https://doi.org/10.26007/97r3-1e19)
- [Margoti et al. 2026: Quaoar shape from 36 occultation campaigns](https://arxiv.org/abs/2607.06450)
- [Pereira et al. 2023: Quaoar's two rings](https://doi.org/10.1051/0004-6361/202346365)
- [Proudfoot et al. 2026: Gǃkúnǁʼhòmdímà occultation and orbit model](https://arxiv.org/abs/2605.28636)

Varuna, Orcus and Varda were considered and deferred where the checked sources did not supply a sufficiently constrained numerical 3D model for this batch. A diameter or projected occultation ellipse alone was not expanded into arbitrary terrain. The 572.5 MB Quaoar supplementary lightcurve archive and much larger Arrokoth thermophysical archive were unnecessary for the selected numeric fits and were not downloaded.
