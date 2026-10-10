# Proxima Centauri

Proxima Centauri is a red dwarf 1.30 parsecs away, the closest known star to the Sun, about one seventh of its radius. Here its surface is a plain sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Gaia EDR3 parallax 768.0665 ± 0.0499 mas via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Proxima Centauri, not two.

Radius: Radius 0.141 ± 0.007 solar radii measured with VLTI/AMBER by Demory et al. (2009), A&A 505, 205. Kervella, Thévenin and Lovis (2017) give 0.1542 ± 0.0045 from a radius to magnitude relation; the interferometric value is adopted.

Rotation: the page draws no measured axis: the display axis is celestial north at the star, a convention. Klein et al. (2021), MNRAS 500, 1844 (https://arxiv.org/abs/2010.14311), Sect. 3.2, find an inclination of 47 ± 7° from the line of sight and a rotation period of 89.8 ± 4.0 d from the star's magnetic signatures in ten HARPS-Pol spectra; which way the axis points on the sky is not measured. The brightness maps are made at that inclination, and the pages of Proxima Centauri b and d place their orbits in the star's equatorial plane at it.

Color dataset: The color of the Hubble Space Telescope's STIS spectrum of Proxima Centauri from 26 April 2015 (HST Low Resolution Stellar Library, programme 13776), the flux corrected for scattered light and an off-centre slit; Proxima flares, so this is one moment. It replaces the X-Shooter Spectral Library spectrum used before, whose color (#ffc073) disagreed with both this spectrum and Gaia. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffd06e**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The catalogue swatch, the minimap and the navigation marker use the same color. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colors from these inputs, and `--check` recomputes them. Cross-check: Gaia DR3 XP spectrum, source 5853498713190525696 gives #ffcc6f, 4 levels from the dataset color in its most different channel (the threshold for agreement is 12).

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,098 K and log g 5.23 (u1 0.169, u2 0.506): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/proxima-centauri.json: 5.226.

**Brightness from MEarth.** The Color + brightness and Brightness map datasets are made in this project from the star's MEarth light curve of its 2014, 2015, 2016 and 2017 seasons (the newest of December 2016 to October 2017), from the MEarth Project's [Data Release 11](https://lweb.cfa.harvard.edu/MEarth/DataDR11.html): one point a night, after the segment baselines and the common mode of the paper's model are taken off it by that model's own code ([source record](../../sources/mearth-light-curves.json)). It is the light curve [Newton et al. (2018, AJ 156, 217)](https://arxiv.org/abs/1807.09365) judge, and the star's row in their table (VizieR J/AJ/156/217/table1) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-10-10: the four brightness maps were made again at 47°, the inclination Klein et al. (2021) publish, where they had been made at an assumed 60°. Nothing was fetched or judged again: [`reduce.mts --remap`](../../../packages/telescope-cli/src/archives/tess/reduce.mts) refits the light curves the reduction kept, and everything else its receipt holds (the period, Newton et al.'s verdict, each season's nights) is identical before and after. A star seen nearer its pole needs more contrast for the same light, so the maps are a little stronger, and the scatter the fit leaves is the same:

| Season | Darkest and brightest at 60° | At 47° | Scatter left |
|---|---|---|---|
| 2014 | 98.8 and 101.2 % | 98.6 and 101.4 % | 0.57 % |
| 2015 | 98.5 and 101.5 % | 98.2 and 101.8 % | 0.56 % |
| 2016 | 98.2 and 101.8 % | 97.9 and 102.1 % | 0.79 % |
| 2017 | 99.7 and 100.3 % | 99.6 and 100.4 % | 0.88 % |

The shared scale of the four maps went from 98 to 102 % to 97.5 to 102.5 %. MEarth's server could not be asked again on this day (its certificate had expired on 9 October 2026), which is why the maps were made from the kept light curves.

Run of 2026-09-21:

- [`object-package-consistency.test.mts`](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) checks that the catalogue color #ffd06e is the color dataset's prepared color; `node packages/telescope-cli/authoring/stellar-spectra/author.mts --check` recomputes the color and marker from the pinned spectrum.

**Brightness from MEarth.** Newton et al. (2018, AJ 156, 217) ask to see the sinusoid of their fit by eye in the star's light, over two or more complete cycles and uncorrelated with the systematics of their model (grade A when each of their questions is answered yes, grade B when not all are). Their table (VizieR J/AJ/156/217/table1) gives a grade A rotation period of 88.977 d, with a sinusoid of semi-amplitude 0.0073 mag in the star's longest dataset, of 600 nights: the star's period is 88.977 d, as published, and no criteria were applied to it here. The light varies by 1.3% (twice the semi-amplitude of the sinusoid the table prints). The light curve mapped is the star's longest dataset in the MEarth release, that of telescope 11: 601 nights before 2 March 2018, where the paper's table prints 600 for its longest. The paper's model, fitted to it here at 88.977 d by its authors' code, gives the sinusoid a semi-amplitude of 0.0073 mag, where the table prints 0.0073. The star's 2018 season holds less than one turn of it and has no map. The paper estimates the errors of its rotation periods at about 10%. The star's record holds 83.5 d from the catalogues. The map's light curve leaves a scatter of 0.88% about the light, whose own noise is 0.62%. Gaia DR3 lists 11 other stars within 8 arcseconds, with 0.15% of their light and the star's together.

## Known problems

Proxima is a flare star; its flares are not drawn. Its two known planets, Proxima Centauri b and d, have pages of their own, each an approximate placement in the star's equatorial plane because no orbit tilt is measured. Kervella, Thévenin & Lovis (2017), A&A 598, L7 (https://arxiv.org/abs/1611.03495) find Proxima bound to Alpha Centauri, so it is inside the Alpha Centauri system here, with the mass they adopt for it, 0.1221 ± 0.0022 solar masses. Its orbit about Alpha Centauri is not adopted: the star is placed by its own astrometry.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

- **Brightness from MEarth.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is of the first degree, one brighter and one darker side, which is what the sinusoid of the paper's model fixes: a finer pattern in the star's light, if there is one, is not drawn. The map is made at a tilt of 47°, the inclination published for the star's axis: 47 ± 7 degrees from the line of sight, Klein et al. (2021), MNRAS 500, 1844, Sect. 3.2 (https://arxiv.org/abs/2010.14311): the inclination at which their magnetic maps best fit ten HARPS-Pol spectra of April to July 2017 (src/objects/proxima-centauri/source/measurements.json, spinInclinationPublishedDegrees). The page draws the axis by convention. The map is of December 2016 to October 2017: spots come and go within weeks or months.
