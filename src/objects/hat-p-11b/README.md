# HAT-P-11 b

## Sources

HAT-P-11 b transits HAT-P-11 every 4.89 days and is 0.45 Jupiter radii across. Orbit and size follow An et al. 2025's fit, the archive's default. This account was drafted from An et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.4466 Jupiter radii from Basilicata et al. 2024 (2024A&A...686A.127B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...686A.127B/abstract): 31,928.3 km at 71,492 km per Jupiter radius. GM from the mass 0.0787 Jupiter masses (Basilicata et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...686A.127B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...686A.127B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** An et al. 2025 (2025AJ....169...22A), via the NASA Exoplanet Archive ps table (pl_refname AN_ET_AL__2025): P 4.888 d Basilicata et al. 2024 (2024A&A...686A.127B), via the NASA Exoplanet Archive ps table (pl_refname BASILICATA_ET_AL__2024): a/R* 15.05; Basilicata et al. 2024 (2024A&A...686A.127B), via the NASA Exoplanet Archive ps table (pl_refname BASILICATA_ET_AL__2024): inclination 89.027 degrees An et al. 2025 (2025AJ....169...22A), via the NASA Exoplanet Archive ps table (pl_refname AN_ET_AL__2025): e 0.251 An et al. 2025 (2025AJ....169...22A), via the NASA Exoplanet Archive ps table (pl_refname AN_ET_AL__2025): omega 28 degrees Basilicata et al. 2024 (2024A&A...686A.127B), via the NASA Exoplanet Archive ps table (pl_refname BASILICATA_ET_AL__2024): transit mid-time 2454957.8132067 BJD, taken as BJD_TDB Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hat-p-11's measured colour (#ffd4b9, the colour lens of hat-p-11 (src/objects/hat-p-11/source/photometry/stellar-color.json)) at the gray's own brightness.

**Illustration lens.** NASA's artist's concept of HAT-P-11 b: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`HAT-P-11_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/HAT-P-11_b.jpg), named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. It is a second lens: Shape stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

Generated 2026-09-24 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-11b.json).

- The Illustration lens was added by [`illustration-lens.mts`](../../../tools/objects/illustration-lens.mts) and baked with the package on 2026-09-24. In headless Chrome the lens opens on the NASA art with no console errors ([the four new illustrated planets](../../../docs/images/illustrated-exoplanets-new-systems.webp)).

## Known problems

- **Orbit convention.** omega 28 degrees is taken as An et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.251) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "HAT-P-11b" (revision 1374246338), verbatim, CC BY-SA 4.0.
- **The Illustration lens is art, not data.** Its colours and features are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
