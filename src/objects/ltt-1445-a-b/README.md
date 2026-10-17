# LTT 1445 A b

## Sources

It is one of 2 planets known around LTT 1445 A. Its orbit and size follow Pass et al. 2023's fit, the archive's default. The introduction is generated from Pass et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.119547 Jupiter radii from Pass et al. 2023 (2023AJ....166..171P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..171P/abstract): 8,546.7 km at 71,492 km per Jupiter radius. GM from the mass 0.00858954 Jupiter masses (Pass et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166..171P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166..171P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Lavie et al. 2023 (2023A&A...673A..69L), via the NASA Exoplanet Archive ps table (pl_refname LAVIE_ET_AL__2023): P 5.358765 d Pass et al. 2023 (2023AJ....166..171P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL__2023): a/R* derived from its semi-major axis 0.0381 au and stellar radius 0.271 solar radii; Pass et al. 2023 (2023AJ....166..171P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL__2023): inclination 89.53 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.19 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 221 degrees Lavie et al. 2023 (2023A&A...673A..69L), via the NASA Exoplanet Archive ps table (pl_refname LAVIE_ET_AL__2023): transit mid-time 2458423.426378 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by ltt-1445-a's measured color (#ffc680, the color dataset of ltt-1445-a (src/objects/ltt-1445-a/source/photometry/stellar-color.json)) at the gray's own brightness.

**Measured day side.** The page opens on the one thing measured of its surface: a dayside brightness temperature of 525 K in the JWST MIRI LRS band, 5 to 12 µm (Wachiraphan et al. 2025, AJ 169, 311 (arXiv 2410.10987), dayside brightness temperature from the emission spectrum of three eclipses; [record](source/photometry/dayside-temperature.json)). Read from the paper (abstract): the paper's 16-bin value; its 1-, 4- and 8-bin fits give 513 to 515 K, and its uncertainty leaves out the star's and planet's parameter errors. The `measured-dayside` format paints the hemisphere under the star in false color at that temperature, on the 300 to 3,000 K scale every measured day side shares, and leaves the night hemisphere blank. It is too cool for a visible glow, so no black-body color is shown.

**Charts.** The orbits of LTT 1445 A's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (4, 31), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ltt-1445-a-b.json).

## Known problems

- **Orbit convention.** omega 221 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.19) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
