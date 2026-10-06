# A star's rotation and brightness map from the TESS and K2 missions' light curves

A star with dark spots dims each time the spots turn to face us. The rise and fall of its light gives the time it takes to
turn once, and the shape of that curve says which longitudes of the star are darker or brighter.

Two missions publish light curves of the stars they were asked to watch. K2 (2014 to 2018) watched one field after another
along the ecliptic, some 80 days each, with an image every 30 minutes. TESS has watched since 2018, a sector of some 27
days at a time, and publishes a light curve every 2 minutes for its targets. Each mission's pipeline corrects the flux for
the spacecraft's systematics (PDC-MAP). This note describes how the telescope's tools take those light curves as they are,
have a published method decide whether a star's rotation is seen in them, and make a brightness map from it.

Nothing here is measured from pixels, and no rule of this repository decides whether a star is seen turning.

A map made this way is **this project's reduction**. It is not a published map, and every dataset made from one says so.

## Whose code does what

Each step of the science is run by the code its authors publish, pinned in
[`toolchain.json`](../packages/telescope-cli/src/archives/tess/toolchain.json) and the telescope's starry toolchain:

| Step | Code | What it does |
| --- | --- | --- |
| Light curve, K2 | The K2 mission's own, from [MAST](https://archive.stsci.edu/missions-and-data/k2) (DOI 10.17909/T9WS3R) | The long-cadence light curve of a campaign with the flux the mission's pipeline corrected (PDC-MAP) |
| Light curve, TESS | The TESS mission's own, from [MAST](https://archive.stsci.edu/missions-and-data/tess) (DOI 10.17909/t9-nmc8-f686) | The 2-minute light curve of a sector with the flux the mission's pipeline corrected (PDC-MAP) |
| Reading a file | [lightkurve](https://lightkurve.github.io/lightkurve/) 2.6.0 | Reads the light curve's file with its quality flags, as it is |
| Period, K2 | [astropy](https://www.astropy.org/)'s generalized Lomb-Scargle, and [star-privateer](https://gitlab.com/sybreton/star_privateer) 1.3.1 (Breton et al. 2024, A&A 689, A229) for the wavelet and the autocorrelation | The three periods that Reinhold & Hekker (2020) compare |
| Period, TESS | [SpinSpotter](https://github.com/rae-holcomb/SpinSpotter) 0.2.0 (Holcomb et al. 2022, ApJ 936, 138) | The period of the light's autocorrelation and the height, width and fit of its peaks |
| Neighbours | [Gaia DR3](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355) through [CDS X-Match](http://cdsxmatch.u-strasbg.fr/) | The Gaia sources around the star, counted for its page to say; nothing is refused on them |
| The map | [starry](https://starry.readthedocs.io/) 1.2.0 (Luger et al. 2019, AJ 157, 64) | The brightness over the surface, as spherical harmonics up to degree 5, that reproduces the light curve as the star turns |

What this repository writes is what lies between them: the readers of MAST's answers, the files each code reads, the
published criteria as a table of methods, and the conversion of starry's map to the table the star pages draw.
[`tools.py`](../packages/telescope-cli/src/archives/tess/tools.py) holds calls to those codes and nothing else.

## Finding a star's light curves

A mission's archive is asked only about a star whose kind that mission's method covers (the next section). MAST is asked
which K2 light curves lie at the star's place
([`kepler/light-curves.mts`](../packages/telescope-cli/src/archives/kepler/light-curves.mts)) and, when K2 has none,
which TESS 2-minute light curves do ([`tess/light-curves.mts`](../packages/telescope-cli/src/archives/tess/light-curves.mts)).
K2 listed its targets where surveys of about the year 2000 had them, so a star that moves is looked for at its recorded
place and at its places in 2016 and 2000; for TESS, at its places in 2019 and 2025. Each file is read as the mission
publishes it.

## A published method for each kind of star

Whether a light curve shows a star turning is not this repository's judgement, nor anyone's here. A method is taken from
the paper that made it, for the kind of star and the light curves the paper applies it to, with its preparation, its
criteria and its rule for a star observed more than once, as printed
([`methods.mts`](../packages/telescope-cli/src/archives/tess/methods.mts)). A star or a light curve no method covers is
given no verdict, and is not fetched.

| Kind of star and light curve | Method | State |
| --- | --- | --- |
| Between 3250 and 6250 K with log g over 4.2; the K2 mission's PDC-MAP light curve of a campaign, campaigns 0 to 18 without 9 | Reinhold & Hekker (2020, A&A 635, A43) | Wired |
| A dwarf by the cuts of Ciardi et al. (2011); the TESS mission's 2-minute PDC-MAP light curve of a sector | Holcomb et al. (2022, ApJ 936, 138) | Wired |
| One Kepler quarter, the mission's PDC-MAP light curve | Reinhold, Reiners & Basri (2013, A&A 560, A4) | Read, not wired |
| Giants and subgiants | None for rotation in one campaign or sector | Not wired |
| A star with full-frame images only | None | Not wired |

### K2: Reinhold & Hekker (2020)

Reinhold & Hekker (Sects. 2 and 3) use the mission's PDC-MAP light curves. They divide each by a third-order polynomial,
drop points more than six median absolute deviations from the median, and bin it to three hours. They take the period of
the highest peak of the generalized Lomb-Scargle periodogram, of the wavelet power spectrum summed over time and of the
autocorrelation, and accept a rotation when:

- the periodogram's peak is higher than 0.3;
- the three periods differ by at most one day under 10 days, two days from 10 to 20, and five days beyond;
- their mean, which is the rotation period, is longer than a day and shorter than half the time span;
- the light's variability range (its 95th less its 5th percentile) is not over 10%.

For a star observed in several campaigns they take the mean of the campaigns' periods, and exclude the star when the
periods deviate by more than 20%. The paper measured its own reliability on such stars: 75.7% gave periods within 20% of
each other.

lightkurve reads the mission's file. The periodogram is astropy's; the wavelet and the autocorrelation are
[star-privateer](https://gitlab.com/sybreton/star_privateer)'s (Breton et al. 2024, A&A 689, A229), pinned with the other
codes. Campaigns 10 and 11 were filed in two parts; the second is read, whose 48 days are the "50 to 70 days" the paper
gives for those campaigns.

Of our stars, 67 are in the paper's range and have a K2 light curve. What the method gave on them:

| Outcome | Stars |
| --- | --- |
| A rotation accepted | 35 |
| Accepted in two campaigns whose periods deviate by over 20%, so excluded | 2 |
| Refused: the periodogram's peak is not over 0.3 | 24 |
| Refused: the three methods' periods do not agree | 4 |
| Refused: the period is not under half the time span | 1 |
| The star's only campaign is one the paper does not analyse | 1 |

Forty of the 67 have a rotation period in the catalogues. The method accepts 26 of them: 20 at the catalogue's period
within 20%, 3 at half of it and 3 at another period. This is a comparison, not a setting: no number above was chosen
from it.

A period is then set beside the one the star's record holds from the catalogues: the same within 20% is kept; half of it
means the star turns once in two of the light's periods (Reinhold, Reiners & Basri 2013 describe spots on opposite sides
giving half the period); any other is not drawn, because two published values disagree.

A star's receipt names the method, the light curve's file and pipeline version, what was measured of each campaign and
the paper's sentence of refusal when there is one. Each accepted campaign becomes one Brightness map of the star, all at
the star's one period.

After that, 32 stars have maps, 37 maps in all: the three whose period is neither the catalogued one nor its half have
none (K2-199, K2-275 and K2-277), and the three at half are drawn at twice the light's period (K2-3, K2-29 and K2-141).
Nine of the 32 have no catalogued period, and the paper's method alone vouches for theirs.

K2-136, a star of the Hyades, is one of them. In campaign 13 (March to May 2017) the three methods give 15.00, 14.63 and
13.75 days, so 14.46, where the catalogues print 15, and the periodogram's peak has a height of 0.56. K2-102 was observed
in three campaigns, which give 11.54, 11.70 and 11.25 days: its period is their mean, 11.5 days, and it has three maps.

![Six of the K2 stars in the app (K2-100, K2-102, K2-136, K2-141, K2-198, K2-233): Color + brightness above, Brightness map below](images/stellar-brightness-maps-k2.webp)

### TESS: Holcomb et al. (2022)

Holcomb et al. (Sects. II and III) use the mission's 2-minute PDC-MAP light curves, binned to 30 minutes, with the
transits they know of masked. Their stars are dwarfs by the cuts of Ciardi et al. (2011) on the star's temperature and
surface gravity: log g at least 3.5 at 6000 K or hotter, at least 4.0 at 4250 K or cooler, and at least 5.2 - 0.00028 T
between; a star without either value is left out. Their code, SpinSpotter, is run on each sector and on all of a star's
sectors stitched together. It finds the period of the light's autocorrelation and fits parabolas to its peaks. A period is
valid when:

- the peaks' height is over a quarter of their width;
- their width is between 0.4 and 0.6 of the period;
- the parabolas fit them with an R² over 0.9.

A star with several sectors needs a valid period in at least half of them, rounded up, and in the stitched light curve,
whose period is the star's. A star whose light is lopsided (the midpoint of its 5th and 95th percentiles farther than
0.01 from zero) is removed as a possible eclipsing binary. On the stars its authors inspected by eye, 4.9% of the periods
these criteria accepted were false, and 6.2% on a second set.

The transits masked are those of the star's planets here: each planet's published period and mid-transit time, and the
published duration its transit chart is drawn with.

One reading of the paper is ours and is not printed in it: its sample is sectors 1 to 26, its criteria are stated for
"the TESS 2-minute cadence data", and they are applied here to any sector's 2-minute light curve.

The five stars drawn before this method was wired keep their maps under it. Each valid sector becomes one Brightness
map, all at the period of the stitched light curve: 53 maps.

| Star | Sectors | Valid | Period, days | Catalogued, days | Maps |
| --- | --- | --- | --- | --- | --- |
| AU Mic | 3 | 2 | 4.84 | 4.856 | 2 |
| AB Pic | 41 | 35 | 3.92 | 3.87 | 35 |
| AF Lep | 4 | 4 | 1.01 | 0.966 | 4 |
| BD-16 351 | 3 | 3 | 3.26 | 3.23 | 3 |
| EK Draconis | 12 | 9 | 2.68 | 2.64 | 9 |

AU Mic's sectors 1, 27 and 95 give 4.97, 4.89 and 5.00 days. Sector 27 is not valid, because its peaks' width is 0.38
where the paper asks for more than 0.4, so it has no map. All three together give 4.84 days.

### What here is not printed in a paper

Five things around the two methods are this repository's, and a reader should know them as such:

1. Holcomb et al.'s criteria are applied to sectors after their sample's 26.
2. A star's temperature and surface gravity are read from its record here; Holcomb et al. read them from the TESS Input
   Catalog v7.
3. A star that SIMBAD files as a pulsating variable, an eclipsing or interacting pair is not read. Holcomb et al. write
   that such stars give periodic signals that are not rotation, and had no catalogue to remove them with.
4. A period shorter than an orbit at the star's surface, from its recorded radius and mass, is refused: no star turns
   faster.
5. A period is set beside the catalogued one as described above: kept within 20%, doubled at half, not drawn otherwise.

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

For AU Microscopii the method gives a period of 4.84 days (the NASA Exoplanet Archive prints 4.856) and a light that varies
by 7.9%. The map of sector 95 leaves a scatter of 0.30% about the light, where the light's own noise is 0.14%: spots that
change during the sector, and flares, are not in a map of one fixed surface.

## What the page opens on

A star with a brightness map opens on **Color + brightness**: the star's own color, darker where the map says its light
was darker. The page then lists the **Brightness map** itself, on a gray scale with its legend and the measured values, and
the flat **Color** the star had.

![The first five stars in the app: Color + brightness above, Brightness map below](images/stellar-brightness-maps.webp)

| Drawn | From |
| --- | --- |
| Which longitudes are darker | The light curve |
| How much darker | The Brightness map's own scale, drawn from a darker, richer tone of the star's hue up to its color: far stronger than the real contrast |
| The color | The star's Color dataset: the scale's bright end is drawn at that color |
| The darkening toward the edge | The Color dataset's limb law, drawn 1.5 times as strong (its light raised to the power 1.5), still toward black: chosen by eye |
| The latitude and shape of each patch | Not measured: the smoothest map that reproduces the light |
| Any change of hue inside a spot | Not drawn: none is measured. The darker tone keeps the star's hue |

The contrast is drawn stronger because the measured one cannot be seen. AU Microscopii is among the most spotted stars
here: its darkest longitude gives 21% less light than its brightest, which is one tenth on a display, and most stars swing by
1 or 2%. Two weaker stretches were tried on the page and were still faint, and a scale that ran toward black read as shadow
on the star. So the darkest part is drawn as a darker, richer step of the star's own hue (0.4 lower in lightness and 0.12
higher in chroma, in OKLCH), chosen by eye from sheets of options. Each dataset's text says so with the star's own number, and the Brightness map carries the measured
values on its scale. Every star's scale is its own, so a faintly spotted star is drawn as strongly as a heavily spotted one;
the scale's ends and the text tell them apart.

The dataset's text gives the month the sector was observed, because spots come and go within weeks or months.

## Running it

```sh
node packages/telescope-cli/src/archives/tess/toolchain.mts install
node packages/telescope-cli/src/archives/tess/reduce.mts <star id>...     # or --all: every star not yet judged
pnpm telescope new-object --from-pixels all --out output/tess/specs/all.json
pnpm telescope new-object output/tess/specs/all.json --bake
pnpm telescope new-object --metadata <star id>...
node packages/telescope-cli/src/new-object/new-object-cli.mts --pixel-light --all
```

`reduce.mts` asks MAST for the star's K2 light curves and, when K2 has none, its TESS 2-minute ones, each only when a
method covers the star's kind, and has that method judge them. It writes a receipt for each star under ignored
`output/tess/<star id>/`: the mission, each sector or campaign with the request that fetched it and the pipeline version
that made it, the method, what it measured, the verdict with its reason, and the codes' versions. Each light curve is kept
beside it as the method prepared it. Requests to MAST go one at a time. Gaia's answer for all stars is one request of
some ten minutes, kept under `output/tess/` so a star is asked once.

The map's table (108 KB a star) is not tracked: its manifest input names `reduce.mts` as its generator, and it is published
to and restored from the source cache (`node packages/bake/cli/publish-source-cache.mts --file=<table> --key=<star id>/<its path under source/>`).

`--pixel-light` writes what the reduction found into the record of every star it looked at, mapped or not: the verdict in
the reduction's own sentence (a rotation, or why none is accepted, or why the star was not read), the mission and its sector
or campaign, and the scatter of the star's light over it.

The spec lists each star whose receipt holds a map. Writing it adds a "Brightness map" dataset to the star's page and three
values to its measurements record: the measured period, where it was measured, and the light's swing. The metadata pass then
counts the measured period among the star's catalogued ones when it adopts a rotation period.

## Limits

- A star no mission published a light curve of is not judged: no published method is wired for full-frame images.
- No method is wired for a Kepler quarter, for giants or for stars hotter or cooler than a method's own range.
- Other stars near a star are counted for its page to say and nothing is refused on them: the missions' light curves
  correct for crowding, and no published limit is applied here.
- A periodic light is taken as rotation. A pulsating star or a close pair that SIMBAD does not file as one, with a period
  longer than the surface orbit's, would pass as a turning, spotted star.
- A star with no catalogued period whose light repeats twice a turn is given half its true period.
