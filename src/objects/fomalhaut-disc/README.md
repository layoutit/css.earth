# Fomalhaut debris disc

## Sources

This package draws the debris disc around [Fomalhaut](../fomalhaut/README.md) as a prepared volume attached to the star, the way the [HD 181327 ring](../hd-181327-disc/README.md) is: it has no catalogue entry of its own, shares the star's frame, and is listed among the star's datasets as "Debris disc · JWST 25.5 µm".

- **Image:** the authors' own final reduced 25.5 µm image, `F2550W_finalsc_DC.fits`, from the repository their paper's Data Availability statement names, [github.com/merope82/Fomalhaut](https://github.com/merope82/Fomalhaut/tree/3566f5976f8a029703b05550004c347d58aa0a85), pinned at commit `3566f59` by bytes and sha256 and downloaded into `.local/fomalhaut-disc/deposit/`. It is JWST/MIRI F2550W imaging of 22 October 2022, GTO programme 1193 (Gáspár et al. 2023, Nature Astronomy 7, 790, [arXiv:2305.03789](https://arxiv.org/abs/2305.03789)): reference-PSF subtracted with 19 PsA and multiplied by 1.11 for absolute calibration, as their Supplementary Information 1.1 describes, and distortion corrected. MAST's own level-3 product still holds the saturated star and its diffraction pattern, so it is not the image the paper shows.
- **Colour:** the colour scale printed on the authors' own F2550W figure (`08_F2550W.png` in the same repository), logarithmic from 1 to 1000 MJy sr⁻¹, black through orange to pale yellow. It is sampled in 64 steps evenly in log brightness from the printed bar (image rows 374 and 37); its printed 10 and 100 fall at rows 262 and 150, where a log scale puts them. Nothing is fitted.
- **Recipe:** [`source/circumstellar.json`](source/circumstellar.json) names the deposit and its pins, the star's position, the colour scale, the drawn inner edge and where the ring is scored from, the stated conventions, and the published geometry that is adopted. [`author.mts`](../../../tools/objects/circumstellar/author.mts) writes everything else in `source/` from it; `--check` reproduces it byte for byte.

**Placement.** One volume unit is one astronomical unit at the star's prepared distance (7.70 pc), and the cube (±420 au) is anchored on the star's scene origin, so the star's sphere sits at its centre. The deposit's header does not name the star, so its position is `TARG_RA`, `TARG_DEC` of MAST's level-3 product of the same visit, the target position carried to that date. The authors subtracted the sky with dedicated background exposures, so no background is subtracted here; the median absolute deviation 26–34″ from the star gives the noise, 1.71 MJy sr⁻¹. The zero padding outside the image's field is read as missing, not as dark sky.

**The ring: adopted from the paper, not measured.** The circumstellar author measures a ring from its brightest ridge in each azimuth. On this image it finds the ridge in only 10 of 24 azimuths: the warm inner disc outshines the inclined outer belt along its minor axis. The paper itself fitted the belt from 51 points chosen by eye. So its fit is adopted (Supplementary Table 3, the outer belt's inner gap): semi-major axis 133.79 au, inclination 67.52°, line of nodes at position angle 336.28°, the orientation the authors de-project with. The disc is centred on the star, as their de-projection is; the belt itself sits about 15 au off centre, which is not modelled ([ledger](investigations.json)).

**Depth: a shape tested against the image, not the image pushed backwards.** The drawn envelope is a disc of that geometry whose surface density in its own plane follows the image's deprojected radial profile, the warm inner disc and the halo included, 0.05 of the radius thick. Projected through the cube and scored against the image from 96 au, outside the inner disc the paper measures (77 to 96 au), to 200 au, each at its own best gain:

| envelope | residual against a signal of 8.64 |
|---|---|
| disc following the measured radial profile | 2.84 |
| single gaussian ring, radial width 40.1 au | 3.16 |
| spherical shell | 6.39 |
| constant depth, what an extrusion assumes | 7.16 |

Each sky column's colour is spread along the disc with one depth profile, so the view from Earth reproduces the image and every other direction shows a disc. The light is drawn to 330 au in the disc plane, where the deprojected median falls to the noise; the author refuses a grid that would cut light above it.

## Evidence

- [`source/previews/f2550w.png`](source/previews/f2550w.png): the image as read, in its displayed colours, north up and east left; it matches the authors' printed figure.
- `node tools/objects/circumstellar/author.mts fomalhaut-disc --check` reproduces the grid, recipe, delivery, presentation, preview and manifest.
- [`disc-envelope.test.mts`](../../../tools/objects/circumstellar/disc-envelope.test.mts): a synthetic inclined ring is recovered from its own projection, the stated near side lies toward the observer, a spherical shell is refused as a ring.
- MAST's F2550W product was reproduced from the archived exposures by [`image3.mts`](../../../tools/objects/jwst/imaging/image3.mts): same grid, correlation 0.9999, RMS difference 3.9 × 10⁻⁶, but 19 of 429,982 pixels differ by more than 10⁻⁵ (worst 0.42%), so no archive agreement is claimed ([ledger](investigations.json)).

## Known problems

- **Which side is nearer is taken from the literature and disputed.** The east end of the minor axis is drawn nearer, as Kalas et al. (2013, [arXiv:1305.2222](https://arxiv.org/abs/1305.2222)) find from forward scattering; Le Bouquin et al. (2009) suggested the opposite, a sign their own data could not secure.
- **The belt's 15 au offset from the star is not modelled.** The paper's orbit elements need an unstated sign convention to place it, and the north-west reading projects worse on this image than a centred disc.
- **The disc's thickness is a convention** (0.05 of its radius): the image changes by under 6% across heights from 0.02 to 0.2.
- **Nothing is drawn inside 2.4″** (18.5 au): the 25.5 µm core is saturated within about 1.2″, and the 23 µm coronagraph's working angle is 2.4″.
- **The colours are a display scale for thermal-infrared brightness**, the authors' own, not what an eye would see.
- **One wavelength.** The authors' 23/25.5 µm colour image is not built: the 23 µm field ends near 21″ and covers the belt only partly ([ledger](investigations.json)).
- The deposit carries no licence file; its images are fetched at preparation time, pinned, and not redistributed.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](source/circumstellar.json) · [Provenance](source/provenance.json)
