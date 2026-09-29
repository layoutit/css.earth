# Proxima Centauri

Proxima Centauri is a red dwarf 1.30 parsecs away, the closest known star to the Sun, about one seventh of its radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 768.0665 ± 0.0499 mas via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Proxima Centauri, not two.

Radius: Radius 0.141 ± 0.007 solar radii measured with VLTI/AMBER by Demory et al. (2009), A&A 505, 205. Kervella, Thévenin and Lovis (2017) give 0.1542 ± 0.0045 from a radius to magnitude relation; the interferometric value is adopted.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Colour lens: The colour of the Hubble Space Telescope's STIS spectrum of Proxima Centauri from 26 April 2015 (HST Low Resolution Stellar Library, programme 13776), the flux corrected for scattered light and an off-centre slit; Proxima flares, so this is one moment. It replaces the X-Shooter Spectral Library spectrum used before, whose colour (#ffc073) disagreed with both this spectrum and Gaia. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffd06e**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Gaia DR3 XP spectrum, source 5853498713190525696 gives #ffcc6f, 4 levels from the lens colour in its most different channel (the threshold for agreement is 12).

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,098 K and log g 4.59 (u1 0.162, u2 0.488): a model, because no fit of this star's limb is used. Gravity: log g 4.59 from 2023ApJS..266...41P; the 5 published values span log g 4.552 to 5.05, across which the limb law changes by at most 1.7% of the centre brightness.

## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../tests/contract/object-package-consistency.test.mts) checks that the catalogue colour #ffd06e is the colour lens's prepared colour; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

Proxima is a flare star with a planet, Proxima b; neither flares nor the planet are drawn. No mass is adopted.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
