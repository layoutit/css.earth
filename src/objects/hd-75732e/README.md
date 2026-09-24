# 55 Cnc e

## Sources

55 Cnc e transits 55 Cnc every 0.737 days and is 1.9 Earth radii across. Orbit and size follow Bourrier et al. 2018's fit, the archive's default. This account was drafted from Bourrier et al. 2018's values; the sections below are the data's own.

**Size and mass.** Radius 0.1672763 Jupiter radii from Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018A&A...619A...1B/abstract): 11,958.9 km at 71,492 km per Jupiter radius. GM from the mass 0.02513923 Jupiter masses (Bourrier et al. 2018, the mass the NASA Exoplanet Archive's composite table adopts (2018A&A...619A...1B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2018A&A...619A...1B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive ps table (pl_refname BOURRIER_ET_AL__2018): P 0.7365474 d Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive ps table (pl_refname BOURRIER_ET_AL__2018): a/R* 3.52; Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive ps table (pl_refname BOURRIER_ET_AL__2018): inclination 83.59 degrees Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive ps table (pl_refname BOURRIER_ET_AL__2018): e 0.05 Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive ps table (pl_refname BOURRIER_ET_AL__2018): omega 86 degrees Bourrier et al. 2018 (2018A&A...619A...1B), via the NASA Exoplanet Archive ps table (pl_refname BOURRIER_ET_AL__2018): transit mid-time 2457063.2096 BJD, taken as BJD_TDB Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** A black body at the 2,360 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Demory et al. 2012, dayside brightness temperature at 4.5 µm (NASA Exoplanet Archive emission table)): #ff9e3e. Chosen from the archive's emission rows by rule: 1 measured of 3 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Illustration lens.** The base-colour texture of NASA's [55 Cnc e 3D Model](https://science.nasa.gov/resource/55-cancri-e-3d-model/), credited to NASA Visualization Technology Applications and Development (VTAD). The original GLB (`55_Cancri_e_1_24364.glb`) is declared in [the manifest](source/manifest.json). The resource page gives only a one-line description and the credit; it does not say how the texture was made. Nobody has resolved this planet's disc, so none of the colour or features in it was observed. Preparation carries the texture through the model's own texture coordinates onto the sphere and does not repaint it ([`glb-base-color`](../../../tools/objects/shape-model/glb-surface.mts)); its longitudes are arbitrary. The model's texture is named `LHS3844b_assembled.jpg` inside the file: NASA reused the texture of another lava-world illustration, LHS 3844 b, for this model. It is shown as NASA published it for 55 Cancri e. It is a second lens: Thermal glow stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

Generated 2026-09-24 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-75732e.json).

- The Illustration lens was added by [`illustration-lens.mts`](../../../tools/objects/illustration-lens.mts) and baked with the package on 2026-09-24. In headless Chrome the lens opens on the NASA art with no console errors ([the four new illustrated planets](../../../docs/images/illustrated-exoplanets-new-systems.webp)).

## Known problems

- **Orbit convention.** omega 86 degrees is taken as Bourrier et al. 2018 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.05) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "55 Cancri Ae" (revision 1374105089), verbatim, CC BY-SA 4.0.
- **The Illustration lens is art, not data.** Its colours and features are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
