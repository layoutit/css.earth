# Alpha Centauri B

Alpha Centauri B is the smaller bright star of the nearest stellar system, 1.34 parsecs away and 0.86 times the Sun's radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the parallax 747.17 ± 0.61 mas that Kervella et al. (2017) adopt from Kervella et al. (2016). The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Alpha Centauri B, not two.

Radius: Limb-darkened angular diameter 5.999 ± 0.025 mas measured with VLTI/PIONIER by Kervella et al. (2017), A&A 597, A137, who derive 0.8632 ± 0.0037 solar radii with the parallax 747.17 ± 0.61 mas.

Rotation: no rotation axis or period is adopted here; see Known problems for what the cited paper measures The display axis is celestial north at the star, a convention.

Color dataset: The color of Alpha Centauri B's spectrum as Kiehling (1987) measured it from the ground, 320-880 nm with a relative calibration; the observation date is not published. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffe8d7**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The catalogue swatch, the minimap and the navigation marker use the same color. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colors from these inputs, and `--check` recomputes them. Cross-check: Pulkovo spectrophotometric catalogue, table 6, HR 5460 (320-735 nm) gives #ffe4cb, 12 levels from the dataset color in its most different channel (the threshold for agreement is 12).

**Limb.** The disc is dimmed toward the limb by the power law I(mu) = mu^0.1545 that Kervella et al. (2017), A&A 597, A137 fit to the star's resolved disc (VLTI/PIONIER H band, 1.65 um; not a visible band).

## Evidence

Run of 2026-10-03: the limb law changed from a model to the one Kervella et al. (2017) measured, the fit this package's radius already came from. The page as it opens with it is shown beside [Alpha Centauri A's](../alpha-centauri-a/README.md#evidence).

Run of 2026-09-21 (this version):

- [`object-package-consistency.test.mts`](../../../src/objects/object-package-consistency.test.mts) checks that the catalogue color #ffe8d7 is the color dataset's prepared color; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the color and marker from the pinned spectrum.

## Known problems

Alpha Centauri is a triple system; this package is component B only. Alpha Centauri A, Alpha Centauri B and Proxima Centauri are one system here, the Alpha Centauri system: Akeson et al. (2021), AJ 162, 14 (https://arxiv.org/abs/2104.10086) fit the orbit of A and B and derive this star's mass, 0.9092 ± 0.0025 solar masses, which sets where the pair's centre of mass lies. The orbit itself is not adopted: each star is placed by its own position and proper motion, so the distance between A and B in the world is not their orbit's, and the pair's mutual orbit is not drawn.
- **Measured limb, other band.** The law was measured or fixed outside the visible band the color is drawn in; the visible limb is not measured.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
