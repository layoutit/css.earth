# LTT 1445 A c

## Sources

It is one of 2 planets known around LTT 1445 A. Its orbit and size follow Winters et al. 2022's fit, the archive's default. This account was drafted from Winters et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.10232866 Jupiter radii from Winters et al. 2022 (2022AJ....163..168W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..168W/abstract): 7,315.7 km at 71,492 km per Jupiter radius. GM from the mass 0.00484538 Jupiter masses (Winters et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....163..168W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....163..168W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Lavie et al. 2023 (2023A&A...673A..69L), via the NASA Exoplanet Archive ps table (pl_refname LAVIE_ET_AL__2023): P 3.123898 d Winters et al. 2022 (2022AJ....163..168W), via the NASA Exoplanet Archive ps table (pl_refname WINTERS_ET_AL_2022): a/R* 21.56; Winters et al. 2022 (2022AJ....163..168W), via the NASA Exoplanet Archive ps table (pl_refname WINTERS_ET_AL_2022): inclination 87.43 degrees Lavie et al. 2023 (2023A&A...673A..69L), via the NASA Exoplanet Archive ps table (pl_refname LAVIE_ET_AL__2023): e 0.05 Lavie et al. 2023 (2023A&A...673A..69L), via the NASA Exoplanet Archive ps table (pl_refname LAVIE_ET_AL__2023): omega 163 degrees Lavie et al. 2023 (2023A&A...673A..69L), via the NASA Exoplanet Archive ps table (pl_refname LAVIE_ET_AL__2023): transit mid-time 2458425.078182 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by ltt-1445-a's measured colour (#ffc680, the colour lens of ltt-1445-a (src/objects/ltt-1445-a/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of LTT 1445 A's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (4, 31), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ltt-1445-a-c.json).


## Known problems

- **Orbit convention.** omega 163 degrees is taken as Lavie et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.05) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
