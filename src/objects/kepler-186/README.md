# Kepler-186

Kepler-186 is a red dwarf 178 parsecs away, about half the Sun’s radius. Its outermost known planet, Kepler-186 f, circles it every 130 days.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 5.6336 ± 0.0169 mas via SIMBAD. Kepler-186 has no Hipparcos number, so it matches no entry of the shared star field; the package places it from the astrometry above.

Radius: Stellar radius 0.523 (+0.023/−0.021) solar radii from Torres et al. 2015, ApJ 800, 99 (2015). It is a radius from stellar characterisation, not an interferometric diameter; the angular diameter in the record is that radius at the Gaia distance.

Rotation: no spin axis or rotation period is adopted The display axis is celestial north at the star, a convention.

Colour lens: The colour of Gaia DR3's measured spectrum of Kepler-186. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)): **#ffbd89**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 3755 K and log g 4.74: the edge is 25% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the astronomy record's GM and radius (physicalNotes), log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. No second, independent spectrum of Kepler-186 was found (not in LAMOST, SDSS, HST or the ESO archive), so this colour rests on Gaia alone.


## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #ffbd89 is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The radius comes from stellar characterisation, not from a resolved disc. No image of the surface exists. The star is drawn as a neutral sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
