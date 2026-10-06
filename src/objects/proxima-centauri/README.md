# Proxima Centauri

Proxima Centauri is a red dwarf 1.30 parsecs away, the closest known star to the Sun, about one seventh of its radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 768.0665 ± 0.0499 mas via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Proxima Centauri, not two.

Radius: Radius 0.141 ± 0.007 solar radii measured with VLTI/AMBER by Demory et al. (2009), A&A 505, 205. Kervella, Thévenin and Lovis (2017) give 0.1542 ± 0.0045 from a radius to magnitude relation; the interferometric value is adopted.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Color dataset: The color of the Hubble Space Telescope's STIS spectrum of Proxima Centauri from 26 April 2015 (HST Low Resolution Stellar Library, programme 13776), the flux corrected for scattered light and an off-centre slit; Proxima flares, so this is one moment. It replaces the X-Shooter Spectral Library spectrum used before, whose color (#ffc073) disagreed with both this spectrum and Gaia. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffd06e**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The catalogue swatch, the minimap and the navigation marker use the same color. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colors from these inputs, and `--check` recomputes them. Cross-check: Gaia DR3 XP spectrum, source 5853498713190525696 gives #ffcc6f, 4 levels from the dataset color in its most different channel (the threshold for agreement is 12).

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,098 K and log g 5.23 (u1 0.169, u2 0.506): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/proxima-centauri.json: 5.226.

## Evidence

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) checks that the catalogue color #ffd06e is the color dataset's prepared color; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the color and marker from the pinned spectrum.

## Known problems

Proxima is a flare star with a planet, Proxima b; neither flares nor the planet are drawn. Kervella, Thévenin & Lovis (2017), A&A 598, L7 (https://arxiv.org/abs/1611.03495) find Proxima bound to Alpha Centauri, so it is inside the Alpha Centauri system here, with the mass they adopt for it, 0.1221 ± 0.0022 solar masses. Its orbit about Alpha Centauri is not adopted: the star is placed by its own astrometry.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
