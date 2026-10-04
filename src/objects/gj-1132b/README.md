# GJ 1132 b

## Sources

It is one of 2 planets known around GJ 1132. Its orbit and size follow Xue et al. 2024's fit, the archive's default. The introduction is generated from Xue et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.1063 Jupiter radii from Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L...8X/abstract): 7,599.6 km at 71,492 km per Jupiter radius. GM from the mass 0.00578 Jupiter masses (Xue et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJ...973L...8X), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJ...973L...8X/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): P 1.62892911 d Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): a/R* 15.26; Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): inclination 88.16 degrees Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): e 0.0118 Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): omega -95.8 degrees, stored as 264.2 Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): transit mid-time 2459280.98988 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-1132's measured color (#ffc778, the color dataset of gj-1132 (src/objects/gj-1132/source/photometry/stellar-color.json)) at the gray's own brightness.

**Rock model.** The page opens on a model set by one measurement: the 5 to 12 µm eclipse depth of Xue et al. (2024, ApJL, [arXiv:2408.13340](https://arxiv.org/abs/2408.13340), [doi:10.3847/2041-8213/ad72e9](https://doi.org/10.3847/2041-8213/ad72e9)), 123 to 157 ppm ([record](source/science/xue-2024/dayside-5-12um.json)), which the paper finds only one sigma below the hottest a bare rock can be, concluding the planet likely has no significant atmosphere. The `bare-rock-eclipse` format draws the bare rock that shows that depth ([a rock set by one eclipse depth](../../../docs/eclipse-mapping.md#a-rock-set-by-one-eclipse-depth)): no atmosphere and no heat transport, 742 K under the star (711 to 772 K across the depth's range), falling as cos^(1/4) of the angle from it, and nothing at night. The depth becomes a temperature through the JWST MIRI LRS throughput table released with Valentine et al. (2024) ([Zenodo record 12571830](https://zenodo.org/records/12571830), CC BY 4.0), summed as counted photons over the wavelengths the paper summed, and the BT-Settl model spectrum at 3200 K, log g 5.0, the grid point nearest the star's cited values, from the Spanish Virtual Observatory. The radius ratio is the one the paper fitted with the depth, 0.04943 ± 0.00015. Only the dayside brightness is measured.

**Charts.** The orbits of GJ 1132's planets from above, from their hosted-orbit records, and its transmission spectrum, 17 bins from Diamond-Lowe et al. 2018 in the archive's transitspec table; its transit in 3 TESS sectors (63, 90, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-1132b.json).

- Run of 2026-10-04: [`new-object --rock-eclipse`](../../../packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.mts) wrote the dataset from the paper's depth. The paper's dayside temperature was not an input: the uniform day side that shows the same depth here is 665 K against the printed 709 ± 31 K (−1.4 sigma). The difference is traced below.

## Known problems

- **A model, not a map.** One number is measured, the day side's brightness in one band. The night side is drawn dark because a bare rock's is; nobody has measured it.
- **The model runs 44 K cooler than the paper's day side.** The paper's released script ([Zenodo record 13244543](https://zenodo.org/records/13244543), `Tp_tempfactor_inverse_pheonix.py`) adds up the band on its PHOENIX model's wavelength grid without the grid's spacing. That grid is logarithmic between 5 and 12 µm (step over wavelength 6.7e-5 throughout), so short wavelengths count for more than a detector counts them. Run as written with the paper's own inputs it gives 709 K, the printed value; with the spacing included it gives 689 K. The rest is the stellar model (BT-Settl here, PHOENIX there) and the throughput table. Both readings sit inside the paper's own error.
- **Orbit convention.** omega -95.8 degrees is taken as Xue et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0118) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 1132 b" (revision 1375986378) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
