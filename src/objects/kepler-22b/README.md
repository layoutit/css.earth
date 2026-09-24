# Kepler-22 b

## Sources

Kepler-22 b transits Kepler-22 every 290 days and is 2.1 Earth radii across. Orbit and size follow Bonomo et al. 2023's fit, the archive's default. This account was drafted from Bonomo et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.18734977 Jupiter radii from Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract): 13,394 km at 71,492 km per Jupiter radius. No mass is measured: Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract) gives only an upper limit of 0.0286318 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): P 289.863876 d Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): a/R* derived from its semi-major axis 0.812 au and stellar radius 0.869 solar radii; Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): inclination 89.764 degrees Borucki et al. 2012 (2012ApJ...745..120B), via the NASA Exoplanet Archive ps table (pl_refname BORUCKI_ET_AL__2012): e 0 Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): transit mid-time 2454966.7001 BJD, taken as BJD_TDB Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by kepler-22's measured colour (#fff1eb, the colour lens of kepler-22 (src/objects/kepler-22/source/photometry/stellar-color.json)) at the gray's own brightness.

**Illustration lens.** NASA's artist's concept of Kepler-22 b: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`Kepler-22_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/Kepler-22_b.jpg), named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. NOAA's Science On a Sphere also has a Kepler-22b map (2013, SETI Institute for NASA's Kepler outreach). It is different artwork, and NOAA marks partner datasets for educational use only, so it is not used. It is a second lens: Shape stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

Generated 2026-09-24 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-22b.json).

- The Illustration lens was added by [`illustration-lens.mts`](../../../tools/objects/illustration-lens.mts) and baked with the package on 2026-09-24. In headless Chrome the lens opens on the NASA art with no console errors ([the four new illustrated planets](../../../docs/images/illustrated-exoplanets-new-systems.webp)).

## Known problems

- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "Kepler-22b" (revision 1374868815), verbatim, CC BY-SA 4.0.
- **The Illustration lens is art, not data.** Its colours and features are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
