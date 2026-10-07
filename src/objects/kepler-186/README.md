# Kepler-186

Kepler-186 is a red dwarf 178 parsecs away, about half the Sun’s radius. Its outermost known planet, Kepler-186 f, circles it every 130 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 5.6336 ± 0.0169 mas via SIMBAD. Kepler-186 has no Hipparcos number, so it matches no entry of the shared star field; the package places it from the astrometry above.

Radius: Stellar radius 0.523 (+0.023/−0.021) solar radii from Torres et al. 2015, ApJ 800, 99 (2015). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted The display axis is celestial north at the star, a convention.

Color dataset: The color of Gaia DR3's measured spectrum of Kepler-186. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffbd89**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 3755 K and log g 4.74: the edge is 25% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the astronomy record's GM and radius (physicalNotes), log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same color. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colors from these inputs, and `--check` recomputes them. No second, independent spectrum of Kepler-186 was found (not in LAMOST, SDSS, HST or the ESO archive), so this color rests on Gaia alone.

**Brightness from Kepler.** The Color + brightness and Brightness map datasets are made in this project from quarters 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15 and 16 of the star's KEPSEISMIC light curve (the newest of January to April 2013), which its authors make from the Kepler mission's pixels and keep at [MAST](https://archive.stsci.edu/hlsp/kepseismic) ([source record](../../sources/mast-kepseismic-light-curves.json)). It is the light curve [Santos et al. (2019, ApJS 244, 21)](https://arxiv.org/abs/1908.05222) judge, and the star's row in their table (VizieR J/ApJS/244/21, table 3) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) checks that the catalogue color #ffbd89 is the color dataset's prepared color and that the limb-darkening law is read at the recorded temperature and gravity; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the color and marker from the pinned spectrum.

**Brightness from Kepler.** Santos et al. (2019, ApJS 244, 21) ask the wavelet, the autocorrelation and their product to give one period in the star's light filtered at 20, 55 and 80 days, selected by the paper's automatic criteria or by its authors' inspection. Their table (VizieR J/ApJS/244/21, table 3) gives a rotation period of 33.75 ± 2.4 d and a photometric activity (S_ph, the scatter of the light over five rotations) of 2186 parts per million: the star's period is 33.75 d, as published, and no criteria were applied to it here. The light varies by 0.80% (the range between its 5th and 95th percentiles, measured here over the quarters mapped; the table prints another measure of it, S_ph). The papers read a period of 33.75 d in the star's light filtered at 55 days, and that is the light curve mapped. 3 of the star's 17 quarters have no map. The papers' rule on a quarter's variance (García et al. 2014) removes quarter 13, whose variance is 4.4 times the median of the star's quarters. Quarters 1 and 17 hold less than one turn of the star. For the 11,209 stars also in McQuillan et al. (2013, 2014), the paper's periods agree with theirs within two sigma for 99.4%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 7 sectors, and Holcomb et al. (2022) ask for at least 4. The star's record holds 34.29 d from the catalogues. The map's light curve leaves a scatter of 0.10% about the light, whose own noise is 0.04%. Gaia DR3 lists 6 other stars within 16 arcseconds, with 5.8% of their light and the star's together.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

- **Brightness from Kepler.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of January to April 2013: spots come and go within weeks or months.
