# Kepler-7 b

## Sources

Kepler-7 b transits Kepler-7 every 4.89 days and is 1.6 Jupiter radii across. Orbit and size follow Esteves et al. 2015's fit, the archive's default. This account was drafted from Esteves et al. 2015's values; the sections below are the data's own.

**Size and mass.** Radius 1.622 Jupiter radii from Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract): 115,960 km at 71,492 km per Jupiter radius. GM from the mass 0.441 Jupiter masses (Esteves et al. 2015, the mass the NASA Exoplanet Archive's composite table adopts (2015ApJ...804..150E), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): P 4.8854892 d Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): a/R* 6.637; Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): inclination 85.161 degrees Latham et al. 2010 (2010ApJ...713L.140L), via the NASA Exoplanet Archive ps table (pl_refname LATHAM_ET_AL__2010): e 0 Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): transit mid-time 2454967.27687 BJD, taken as BJD_TDB Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by kepler-7's measured colour (#fff5f6, the colour lens of kepler-7 (src/objects/kepler-7/source/photometry/stellar-color.json)) at the gray's own brightness.

**Illustration lens.** NASA's artist's concept of Kepler-7 b: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`Kepler-7_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/Kepler-7_b.jpg), named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. It is a second lens: Shape stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

Generated 2026-09-24 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-7b.json).

- The Illustration lens was added by [`illustration-lens.mts`](../../../tools/objects/illustration-lens.mts) and baked with the package on 2026-09-24. In headless Chrome the lens opens on the NASA art with no console errors ([the four new illustrated planets](../../../docs/images/illustrated-exoplanets-new-systems.webp)).

## Known problems

- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "Kepler-7b" (revision 1374220514), verbatim, CC BY-SA 4.0.
- **The Illustration lens is art, not data.** Its colours and features are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
