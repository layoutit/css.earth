# TOI-2180 b

## Sources

It is the only planet known around TOI-2180. Its orbit and size follow Dalba et al. 2022's fit, the archive's default. This account was drafted from Dalba et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 1.01 Jupiter radii from Dalba et al. 2022 (2022AJ....163...61D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...61D/abstract): 72,206.9 km at 71,492 km per Jupiter radius. GM from the mass 2.755 Jupiter masses (Dalba et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....163...61D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....163...61D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Dalba et al. 2022 (2022RNAAS...6...76D), via the NASA Exoplanet Archive ps table (pl_refname DALBA_ET_AL__2022): P 260.15764 d Dalba et al. 2022 (2022AJ....163...61D), via the NASA Exoplanet Archive ps table (pl_refname DALBA_ET_AL__2022): a/R* derived from its semi-major axis 0.828 au and stellar radius 1.636 solar radii; Dalba et al. 2022 (2022AJ....163...61D), via the NASA Exoplanet Archive ps table (pl_refname DALBA_ET_AL__2022): inclination 89.955 degrees Dalba et al. 2022 (2022AJ....163...61D), via the NASA Exoplanet Archive ps table (pl_refname DALBA_ET_AL__2022): e 0.3683 Dalba et al. 2022 (2022AJ....163...61D), via the NASA Exoplanet Archive ps table (pl_refname DALBA_ET_AL__2022): omega -43.8 degrees, stored as 316.2 Dalba et al. 2022 (2022RNAAS...6...76D), via the NASA Exoplanet Archive ps table (pl_refname DALBA_ET_AL__2022): transit mid-time 2458830.76417 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2180's measured colour (#fff3f0, the colour lens of toi-2180 (src/objects/toi-2180/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2180's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2180b.json).


## Known problems

- **Orbit convention.** omega -43.8 degrees is taken as Dalba et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.3683) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-2180 b" (revision 1374090731), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
