# A star's rotation and brightness map from TESS, K2 and Kepler pixels

A star with dark spots dims each time the spots turn to face us. The rise and fall of its light gives the time it takes to
turn once, and the shape of that curve says which longitudes of the star are darker or brighter.

TESS has imaged almost the whole sky every 30 minutes or faster since 2018. The mission publishes light curves only for the
stars it was asked to watch. Its full-frame images hold every other star too. This note describes how the telescope's TESS
tools measure a star's light from those images, decide whether its rotation is seen, and make a brightness map from it.

Kepler (2009 to 2013) and K2 (2014 to 2018) watched far fewer stars, but each for months at a time and with pixels five
times finer. For a star they watched, the mission's own pixels are read instead: see
[Kepler and K2 pixels](#kepler-and-k2-pixels).

A map made this way is **this project's reduction**. It is not a published map, and every dataset made from one says so.

## Whose code does what

Each step of the science is run by the code its authors publish, pinned in
[`toolchain.json`](../packages/telescope-cli/src/archives/tess/toolchain.json) and the telescope's starry toolchain:

| Step | Code | What it does |
| --- | --- | --- |
| Whose light | [Gaia DR3](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355) through [CDS X-Match](http://cdsxmatch.u-strasbg.fr/) | Every Gaia source within 63 arcseconds of the star, with its magnitude in Gaia's red band |
| Pixels | MAST's [TESScut](https://mast.stsci.edu/tesscut/) | Cuts the same 11 × 11 pixels out of every calibrated full-frame image of a sector at the star's place |
| Pixels, Kepler and K2 | [MAST](https://archive.stsci.edu/missions-and-data/k2)'s target pixel files | The pixels the mission kept around a star it watched, one file a K2 campaign or a Kepler quarter |
| Light curve | [lightkurve](https://lightkurve.github.io/lightkurve/) 2.6.0 | Adds up the pixels that stand above the sky, and removes what the sky pixels have in common with them (scattered light and pointing drift) |
| Light curve, K2 | lightkurve's self-flat-fielding corrector (Vanderburg & Johnson 2014, PASP 126, 948) | Takes out the dimming and brightening K2's slow roll about its axis leaves in the light, and keeps the star's own changes |
| Period | [astropy](https://www.astropy.org/) Lomb-Scargle periodogram (VanderPlas 2018, ApJS 236, 16) | The period that best fits the light curve, over the whole sector and in each of its two orbits |
| Period, Kepler and K2 | astropy's generalized Lomb-Scargle, and [star-privateer](https://gitlab.com/sybreton/star_privateer) 1.3.1 (Breton et al. 2024, A&A 689, A229) for the wavelet and the autocorrelation | The three periods that Reinhold & Hekker (2020) compare |
| The map | [starry](https://starry.readthedocs.io/) 1.2.0 (Luger et al. 2019, AJ 157, 64) | The brightness over the surface, as spherical harmonics up to degree 5, that reproduces the light curve as the star turns |

What this repository writes is what lies between them: the reader of TESScut's answers, the files each code reads, the rule
that decides whether a TESS sector shows a rotation, the published criteria as a table of methods, and the conversion of starry's map to the table the star pages draw.
[`tools.py`](../packages/telescope-cli/src/archives/tess/tools.py) holds calls to those codes and nothing else.

## Whose light the pixels hold

A TESS pixel is 21 arcseconds wide, and the pixels added up for a star reach some three pixels from it. Any other star in
that circle adds its light, and its rotation, to the star's. Before a star's pixels are fetched, Gaia DR3 is asked for every
source within 63 arcseconds ([`neighbours.mts`](../packages/telescope-cli/src/archives/tess/neighbours.mts)). A star is not
reduced when Gaia has no source at its place, when it is fainter than magnitude 13.5, or when the other stars give more than
10% of the light. A neighbour counts whole wherever it lies in the circle, so the share is an upper bound.

Of our 3,139 stars, 1,485 pass: 317 have no Gaia source (the brightest stars, and stars of other galaxies), 458 are too
faint and 879 share their pixels. Two of the labelled stars show what the guard is for. V1298 Tauri turns in 2.93 days; its
pixels gave 4.95 days, and Gaia lists a star as bright as it 49 arcseconds away. HD 222259 B's pixels show the rotation of
its brighter companion, 5 arcseconds away.

The pixels are cut where the star was in the sector's year. A nearby star crosses a pixel in a few years: Barnard's Star
moves 10 arcseconds a year.

## When a rotation is believed

This section is the rule for a TESS sector, and it is this repository's own: its numbers were set on our labelled stars,
not taken from a paper. A Kepler or K2 star is judged by a published method instead
([below](#a-published-method-for-each-kind-of-star)), and a published method for a TESS sector is to replace this rule.

One sector is read: the newest imaged every ten minutes (sectors 27 to 55) when the star has one, else the newest of all.
A ten-minute sector's pixels arrive in about 5 seconds; a 200-second sector's take 85 (60 MB for one star). Its period is
accepted only when all of these hold
([`photometry.mts`](../packages/telescope-cli/src/archives/tess/photometry.mts)):

- the star does not saturate the detector;
- the periodogram peak has a power of at least 0.3;
- each of the sector's two orbits, searched alone, gives a period within 20% of the whole sector's;
- the period is 9 days or less;
- the light swings by at least 0.7% of its mean.

The rule was settled on 87 of our stars whose rotation the catalogues print and whose light the mission also measured,
in the sector the mission's light curve is of. TESScut answered for 78, and a light curve was measured for 76.

| Rule | Periods accepted | Equal to the catalogue's or the mission's within 10% |
| --- | --- | --- |
| As above | 24 | 24 |
| As above, on the 20 that also pass the neighbour guard | 20 | 20 |
| Without the 0.7% floor | 33 | 30 |
| Periods over 9 days that pass the other tests | 2 | 0 |
| As above, in each star's newest ten-minute sector (67 measured) | 20 | 19; the other is half the catalogued period |

The rule is strict on purpose, and it leaves out real rotations. For 33 of the 76 stars the catalogue prints a period of
9 days or less and the mission's own light curve shows the same one. The rule accepts 19 of them, all with the right period,
and refuses 14: 6 whose two orbits disagree, 6 that swing by less than 0.7% and 2 with a weak peak. No star of the set
saturates the detector, so that test is a guard this table does not measure. A sector lasts 27 days and the spacecraft
circles the Earth every 13.7 days, which leaves its own mark in the light; that is why long periods are not accepted.

Two groups of spots on opposite sides of a star make its light repeat twice a turn, and no rule can tell that from the
light alone. So a period is set beside the rotation period the star's record already holds from the catalogues: the same
within 20% is kept; half of it means the star turns once in two of the light's periods, and the map is made that way; any
other period is not believed, because one of the two is wrong and these pixels cannot say which. A star with no catalogued
period keeps what its light shows.

A star cannot turn faster than an orbit at its own surface, which its recorded radius and mass give. A shorter period in
its light is something else, a pulsation, a close pair or another star's light, and is not taken as rotation: the pixels
of EPIC 205979159, a giant of 7 solar radii, show 0.16 days, where nothing could turn it faster than 2.3 days.

A star's record holds SIMBAD's main type of it. A star SIMBAD files as an eclipsing or ellipsoidal binary, a cataclysmic,
X-ray or symbiotic pair, or a pulsating variable of any kind is not read at all: its light changes for that reason.

## Kepler and K2 pixels

Kepler stared at one field for four years and K2 at one field after another along the ecliptic, for some 80 days each. Both took
an image every 30 minutes through pixels 4 arcseconds wide, and kept only the pixels around the stars they were asked to
watch: one file a star for each Kepler quarter (some 90 days) or K2 campaign. Against one TESS sector, such a file holds
three times the days, so a star that turns in two or three weeks is seen turning several times, and its pixels are a
fifth the width, so a neighbour seldom shares them.

For every star, MAST is asked once which Kepler and K2 time series lie at its place
([`pixels.mts`](../packages/telescope-cli/src/archives/kepler/pixels.mts)). The missions listed their targets where
surveys of about the year 2000 had them, so a star that moves is looked for at its recorded place, at its place in 2014
and at its place in 2000. One file is read: the longest K2 campaign, or the full-length Kepler quarter nearest the middle
of the mission. A star neither mission watched is read from TESS as before.

Two things differ in how the light is measured:

- **Whose light.** Gaia's sources are counted within 16 arcseconds of the star, four of these pixels, and a star as faint
  as magnitude 16 is read. A bright star is not refused: the missions kept the columns a saturated star bleeds along.
- **The spacecraft's roll.** K2 held its pointing with two wheels and the pressure of sunlight, and rolled slowly between
  thruster firings every six hours. lightkurve's self-flat-fielding corrector takes the roll's mark out of the light and
  is told to keep the star's own slow changes.

### A published method for each kind of star

Whether a light curve shows a star turning is not this repository's judgement. A method is taken from the paper that
made it, for the kind of star and of data the paper applies it to, with its criteria as printed
([`methods.mts`](../packages/telescope-cli/src/archives/tess/methods.mts)). A star no method covers is given no verdict,
and its pixels are not fetched.

| Kind of star and data | Method | State |
| --- | --- | --- |
| Between 3250 and 6250 K with log g over 4.2, one K2 campaign | Reinhold & Hekker (2020, A&A 635, A43) | Wired |
| The same stars, one Kepler quarter | Reinhold, Reiners & Basri (2013, A&A 560, A4), on the mission's corrected light | Read, not wired |
| Giants and subgiants (log g 4.2 or less) | None for rotation in one campaign; their light shows oscillations | Not built |
| Any star, one TESS sector | None yet: the rule above is this repository's own | To replace |

Reinhold & Hekker divide each light curve by a third-order polynomial, drop points more than six median absolute
deviations from the median, and bin it to three hours. They take the period of the highest peak of the generalized
Lomb-Scargle periodogram, of the wavelet power spectrum summed over time and of the autocorrelation, and accept a rotation
when:

- the periodogram's peak is higher than 0.3;
- the three periods differ by at most one day under 10 days, two days from 10 to 20, and five days beyond;
- their mean, which is the rotation period, is longer than a day and shorter than half the time span;
- the light's variability range (its 95th less its 5th percentile) is not over 10%.

The periodogram is astropy's; the wavelet and the autocorrelation are [star-privateer](https://gitlab.com/sybreton/star_privateer)'s
(Breton et al. 2024, A&A 689, A229), pinned with the other codes. The paper measured its own reliability on stars observed
in two campaigns: 75.7% gave periods within 20% of each other.

Our 120 Kepler and K2 stars with a catalogued rotation period show what the method does on our own light curves. This is
a comparison, not a setting: no number above was chosen from it.

| Stars, one K2 campaign | Read | Accepted | The catalogue's period within 20% | Half of it | Another |
| --- | --- | --- | --- | --- | --- |
| In the paper's range | 40 | 29 | 21 | 4 | 4 |
| The same, peaks over 0.5 | 40 | 20 | 17 | 1 | 2 |
| Outside the paper's range | 51 | 16 | 1 | 0 | 15 |

The last row is why the paper leaves evolved stars out: applied to them, its criteria pass periods of 27 to 39 days that
no catalogue prints. Of our 1,090 Kepler and K2 stars, 94 are in the paper's range (67 from K2, 27 from Kepler) and 991
have a log g of 4.2 or less.

A period is then set beside the catalogued one, as for TESS: the same within 20% is kept, half of it is doubled, and any
other is refused. K2-141's light repeats every 7.03 days where the NASA Exoplanet Archive prints 15.17. K2-275's gives
9.30 days: one catalogue prints 9.35 days from the same mission's light and two print 6.02 from TESS's, and the star's
record adopts 6.02.

A star's receipt names the method, what it measured and the paper's sentence of refusal when there is one. Its light
curve is kept as measured, so `reduce.mts --judge` judges it again, under a method wired later, with nothing fetched.

K2-136, a star of the Hyades, is the first page made this way. In K2's campaign 13 (March to May 2017) the three methods
give 15.00, 14.63 and 13.88 days, where the catalogues print 15, and the periodogram's peak has a height of 0.56.

![K2-136 in the app: Color + brightness above, Brightness map below](images/stellar-brightness-maps-k2.webp)

## What the map is and is not

A light curve is one number at each moment: the star's whole disc added up. It fixes how bright each longitude is. It does
not fix the latitude of a spot, and it cannot tell one large pale spot from several small dark ones. starry returns the
smoothest map that reproduces the curve; the map's dark and bright regions are at the right longitudes, and their latitudes
and shapes follow from that choice.

The map is made at one tilt of the star's axis:

1. the tilt the star's page draws, when its rotation record holds a measured one;
2. otherwise the tilt its measurements record works out from its rotation speed, period and radius;
3. otherwise 60°, the middle tilt of axes that point at random (half of them are tilted less).

Each map's text says which. A brightness map never changes the axis a page draws.

For AU Microscopii in sector 95 the pixels give a period of 4.85 days (the NASA Exoplanet Archive prints 4.856) and a swing
of 8.5%. The map's curve leaves a scatter of 0.51% about the light, where the light's own noise is 0.17%: spots that change
during the sector, and flares, are not in a map of one fixed surface.

## What the page opens on

A star with a brightness map opens on **Color + brightness**: the star's own color, darker where the map says its light
was darker. The page then lists the **Brightness map** itself, on a gray scale with its legend and the measured values, and
the flat **Color** the star had.

![The first five stars in the app: Color + brightness above, Brightness map below](images/stellar-brightness-maps.webp)

| Drawn | From |
| --- | --- |
| Which longitudes are darker | The light curve |
| How much darker | The Brightness map's own scale and grays, tinted with the star's color: far stronger than the real contrast |
| The color | The star's Color dataset: the scale's bright end is drawn at that color |
| The darkening toward the edge | The Color dataset's limb law, the same plate |
| The latitude and shape of each patch | Not measured: the smoothest map that reproduces the light |
| Any change of color inside a spot | Not drawn: none is measured |

The contrast is drawn stronger because the measured one cannot be seen. AU Microscopii is among the most spotted stars
here: its darkest longitude gives 21% less light than its brightest, which is one tenth on a display, and most stars swing by
1 or 2%. Two weaker stretches were tried on the page and were still faint, so the color view takes the Brightness map's full
contrast, chosen by eye. Each dataset's text says so with the star's own number, and the Brightness map carries the measured
values on its scale. Every star's scale is its own, so a faintly spotted star is drawn as strongly as a heavily spotted one;
the scale's ends and the text tell them apart.

The dataset's text gives the month the sector was observed, because spots come and go within weeks or months.

## Running it

```sh
node packages/telescope-cli/src/archives/tess/toolchain.mts install
node packages/telescope-cli/src/archives/tess/reduce.mts <star id>...     # or --all: every star without a receipt
pnpm telescope new-object --from-pixels all --out output/tess/specs/all.json
pnpm telescope new-object output/tess/specs/all.json --bake
pnpm telescope new-object --metadata <star id>...
node packages/telescope-cli/src/new-object/new-object-cli.mts --pixel-light --all
```

`reduce.mts` asks MAST whether Kepler or K2 watched the star and reads that file when one did; any other star is read from
one TESS sector. It writes a receipt for each star under ignored `output/tess/<star id>/`: the mission and its sector,
campaign or quarter, the request that fetched its pixels, what was measured, the verdict with its reason, and the codes' versions. The light curve is kept beside it and the
pixels are deleted. Requests to TESScut go one at a time; the service refuses requests sent side by side. Gaia's answer
for all stars is one request of some ten minutes, kept under `output/tess/` so a star is asked once.

The map's table (108 KB a star) is not tracked: its manifest input names `reduce.mts` as its generator, and it is published
to and restored from the source cache (`node packages/bake/cli/publish-source-cache.mts --object=<star id>`).

`--pixel-light` writes what the reduction found into the record of every star it looked at, mapped or not: the verdict in
the reduction's own sentence (a rotation, or why none is accepted, or why the star was not read), the mission and its sector,
campaign or quarter, and the scatter of the star's light over it.

The spec lists each star whose receipt holds a map. Writing it adds a "Brightness map" dataset to the star's page and three
values to its measurements record: the measured period, where it was measured, and the light's swing. The metadata pass then
counts the measured period among the star's catalogued ones when it adopts a rotation period.

## Limits

- The neighbour guard reads Gaia's magnitudes, not the pixels. A neighbour that gives under 10% of the light and swings by
  more than ten times the light's own swing would still pass as the star.
- These are the mission's calibrated images. The frames before calibration are public too, with a published calibrator
  (TICA, Fausnaugh et al. 2020), but that route works on whole detectors.
- A periodic light is taken as rotation. A pulsating star or a close pair that SIMBAD does not file as one, with a period
  longer than the surface orbit's, would pass as a turning, spotted star.
- One sector, campaign or quarter is read for a star. A star whose window is refused may show its rotation in another.
- A star with no catalogued period whose light repeats twice a turn is given half its true period.
