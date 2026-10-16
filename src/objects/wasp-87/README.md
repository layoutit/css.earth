# WASP-87

## Sources

Its radius and temperature follow Addison et al. 2016. The introduction is generated from Addison et al. 2016's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6077185317188247936, parallax 3.323 ± 0.019 mas (300.92 pc). Radius 1.627 +/- 0.062 solar radii from Addison et al. 2016, the stellar radius of the default parameter set of WASP-87 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...823...29A/abstract). Mass 1.204 +/- 0.093 solar masses from Addison et al. 2016, the stellar mass of the default parameter set of WASP-87 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...823...29A/abstract). Temperature 6,450 K from Addison et al. 2016, the stellar temperature of the default parameter set of WASP-87 b in the NASA Exoplanet Archive. log g 4.1 from the mass and radius.

**Color.** A Planck spectrum at 6,450 K, because a companion 8.1 arcsec away gives 12% of the light (WDS 12213-5250, Mason et al. 2001) and blends into its measured spectra and catalogue colors, so the color is taken from its own temperature, through the CIE 1931 2° observer: #fff8fd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,450 K and log g 4.1 (u1 0.355, u2 0.312): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
