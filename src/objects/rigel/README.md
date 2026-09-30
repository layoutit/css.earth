# Rigel

Rigel is a blue supergiant about 265 parsecs away and roughly 79 times the Sun’s radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 3.78 ± 0.34 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Rigel, not two.

Radius: Radius 78.9 ± 7.4 solar radii from Moravveji et al. (2012), ApJ 747, 108, who combine the limb-darkened angular diameter 2.75 ± 0.01 mas of Aufdenberg et al. (2008) with the Hipparcos distance.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour dataset: The colour of Rigel's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#bdcfff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Kharitonov et al. (1988), record 342: Alma-Ata scans gives #b7c9ff, 6 levels from the dataset colour in its most different channel (the threshold for agreement is 12).

**Limb.** The disc is dimmed toward the limb by the quadratic law Howarth (2011), MNRAS 413, 1515 computes from ATLAS9 model atmospheres for the Bessell V band at 12,100 K and log g 1.91, read between the models t12000g15, t12000g20, t12250g15, t12250g20 (u1 0.233, u2 0.330): a model, because no fit of this star's limb is used. Gravity: log g 1.91 from 2023ApJS..266...11B; the 2 published values span log g 1.75 to 1.907.

## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tests/contract/object-package-consistency.test.mts) checks that the catalogue colour #bdcfff is the colour dataset's prepared colour; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The distance rests on a 9 percent parallax, so the radius carries a 7.4 solar radii uncertainty. Rigel is a multiple system; this package is Rigel A only. No mass is adopted.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
