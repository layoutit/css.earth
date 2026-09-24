# VHS 1256-1257 A

VHS 1256-1257 A is one of two young, nearly identical dwarfs 21 parsecs away in Corvus. The pair, 2 au apart on a 7.3-year orbit, is orbited about 150 au out by the planet-mass companion [VHS 1256-1257 b](../vhs-1256-1257-b/README.md), the main spectroscopy target of the JWST Early Release Science programme for exoplanets. Its twin is [VHS 1256-1257 B](../vhs-1256-1257-companion/README.md).

## Sources

**Placement.** Gaia DR3 source 3526198184723289472 (Gaia Collaboration 2023): position at J2016.0, proper motion, and parallax 47.2733 ± 0.4731 mas, inverted to 21.1536 pc ([source record](../../sources/gaia-dr3-vhs-1256-1257.json)). Gaia does not resolve the pair, 0.1 arcseconds apart: these are the photocentre's values, and its RUWE of 7.3 is the pair's orbital wobble. The two are nearly equal in brightness (K-band difference 0.033 ± 0.004 mag, Dupuy et al. 2023), so the photocentre lies near their centre of mass; this package places A there and B on its measured orbit around A. Radial velocity −1.4 ± 5.0 km/s from VLT/UVES spectra (Gauza et al. [2015](https://arxiv.org/abs/1505.00806), section 3.4).

**Radius.** 0.12 solar radii, the radius Climent et al. ([2022](https://arxiv.org/abs/2201.12606), A&A 660, A65) adopt for each component from the Chabrier et al. (2000) evolutionary models at the pair's age and mass. A model value: the disc is not measured.

**Mass and temperature.** Dupuy et al. ([2023](https://arxiv.org/abs/2208.08448), MNRAS 519, 1688) measure the pair's dynamical total mass, 0.141 ± 0.008 solar masses, from its orbit. Their fitted mass ratio is poorly constrained (0.45 ± 0.08), but the two stars are nearly equal in brightness, so each is given half, 74 ± 4 Jupiter masses in their words. The best-fitting BT-Settl model to the pair's combined spectrum is 2,700 K.

**Colour lens.** A Planck spectrum at 2,700 K through the CIE 1931 2° observer into sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). Gaia's own BP/RP spectrum of the pair exists, but it is the light of both stars and faint in the blue (BP 18.0 mag), so it is not used ([ledger](investigations.json)). Its limb is darkened by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 2,700 K (the record) and log g 5.13 (from the record's mass and radius (packages/astronomy/data/bodies/vhs-1256-1257.json)): a model, since no fit of this star's limb exists.

**Rotation.** None is measured on the sky. The display axis is celestial north at the star ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- The four systems added with this one (VHS 1256-1257, GQ Lup, DH Tau, ROXs 42B), each captured headless at 1440 × 900 from the dev server of this version with its system overview open and no console errors ([young-imaged-systems.png](evidence/young-imaged-systems.png)).
- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) puts B, on Dupuy et al.'s orbit around this star, within 2.1 of its own error bars of all eight Keck/NIRC2 positions in their Table 1.

## Known problems

- The radius is a model value, and each star's mass is half the pair's measured total.
- The pair's placement is Gaia's photocentre, which lies near, not exactly at, the centre of mass.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
