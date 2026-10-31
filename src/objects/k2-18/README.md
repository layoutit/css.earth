# K2-18

K2-18 is a red dwarf 38 parsecs away, about four tenths of the Sun’s radius. Its planet K2-18 b circles it every 33 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 26.2469 ± 0.0266 mas via SIMBAD. K2-18 has no Hipparcos number, so it matches no entry of the shared star field; the package places it from the astrometry above.

Radius: Stellar radius 0.4445 ± 0.0148 solar radii from Benneke et al. (2019, ApJL 887, L14; arXiv:1909.04642), Table 1, which revises the discovery-era 0.411 ± 0.038 (Sarkis et al. 2018, from Benneke et al. 2017) using the Gaia DR2 distance. It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: Sarkis et al. 2018 measure a 39.63 ± 0.50 day rotation period from photometry; no spin axis is measured, so none is adopted. The display axis is celestial north at the star, a convention.

Color dataset: The color of K2-18's LAMOST spectrum. The LAMOST survey telescope observed it on 21 March 2014, with a relative flux calibration and a fibre warning in the file. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffc796**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from PHOENIX model atmospheres, read at 3457 K and log g 4.77: the edge is 17% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the astronomy record's GM and radius (physicalNotes), log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same color. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colors from these inputs, and `--check` recomputes them. Cross-check: LAMOST DR11 spectrum 400516214 (2016-01-04): the same survey on another night, not a different instrument gives #ffcb9a, 4 levels from the dataset color in its most different channel (the threshold for agreement is 12).


**Habitable zone dataset.** A dataset of the whole system: the star with its habitable zone as a green band in the plane of its planet' orbit. The band is its own package, a drawing of four distances the Habitable Zone Gallery calculates; its sources, processing and limits are in [its README](../k2-18-habitable-zone/README.md). It is a calculation, not an observation.

**Brightness from K2.** The Color + brightness and Brightness map datasets are made in this project from the K2 mission's own light curve of campaign 1 (June to August 2014; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/k2)) ([source record](../../sources/mast-k2-light-curves.json)). It is among the light curves [Reinhold & Hekker (2020, A&A 635, A43)](https://arxiv.org/abs/2001.08214) searched for rotation, and the star's row in their table (VizieR J/A+A/635/A43/table2) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) checks that the catalogue color #ffc796 is the color dataset's prepared color and that the limb-darkening law is read at the recorded temperature and gravity; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the color and marker from the pinned spectrum.

**Brightness from K2.** Reinhold & Hekker (2020, A&A 635, A43) ask the periodogram, the wavelet and the autocorrelation of a campaign's light to give periods within a day of each other under 10 days, two days to 20 and five beyond, with a periodogram peak over 0.3, a period between a day and half the light's span, and a variability range under 10%. Their table (VizieR J/A+A/635/A43/table2) gives a rotation period of 36.62 ± 15.65 d in campaign 1, with a periodogram peak of 0.72: the star's period is 36.62 d, as published, and no criteria were applied to it here. The light varies by 1.2% (the range between its 5th and 95th percentiles, as the table prints it (the mean of the campaigns' variability ranges)). Of the paper's stars observed in two campaigns, 75.7% gave periods within 20% of each other. The criteria of Reinhold & Hekker (2020, A&A 635, A43), applied here to the star's K2 light, are not met: The three methods of Reinhold & Hekker (2020) do not agree within the 5 d they allow at this period: 36.40 d (periodogram), 33.92 d (wavelet) and 39.25 d (autocorrelation). The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 3 sectors, and Holcomb et al. (2022) ask for at least 2. The star's record holds 38.6 d from the catalogues. The map's light curve leaves a scatter of 0.18% about the light, whose own noise is 0.09%. Gaia DR3 lists no other star within 16 arcseconds.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

- **Brightness from K2.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of June to August 2014: spots come and go within weeks or months.
