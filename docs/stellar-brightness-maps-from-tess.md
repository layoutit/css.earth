# A star's rotation and brightness map from the TESS and K2 missions' light curves

A star with dark spots dims each time the spots turn to face us. The rise and fall of its light gives the time it takes to
turn once, and the shape of that curve says which longitudes of the star are darker or brighter.

Two missions publish light curves of the stars they were asked to watch. K2 (2014 to 2018) watched one field after another
along the ecliptic, some 80 days each, with an image every 30 minutes. TESS has watched since 2018, a sector of some 27
days at a time, and publishes a light curve every 2 minutes for its targets. Each mission's pipeline corrects the flux for
the spacecraft's systematics (PDC-MAP). This note describes how the telescope's tools take those light curves as they are,
have a published method decide whether a star's rotation is seen in them, and make a brightness map from it.

Nothing here is measured from pixels, and no rule of this repository decides whether a star is seen turning. It is
decided by a published method run on the light curves its paper uses, or by a paper's own published verdict on the
star.

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
| Verdict, TESS, when that method refuses | The catalogue of [Colman et al. (2024, AJ 167, 189)](https://arxiv.org/abs/2402.14954), at [VizieR J/AJ/167/189](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/167/189) | The targets the paper found turning in sectors 1 to 26, each with its period. The paper's code has no licence and is not run |
| Temperature and gravity a record lacks | The TESS Input Catalog v8 (Stassun et al. 2019, AJ 158, 138), in the header of the star's own light curve | The two values Holcomb et al. select their stars by |
| Neighbours | [Gaia DR3](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355) through [CDS X-Match](http://cdsxmatch.u-strasbg.fr/) | The Gaia sources around the star, counted for its page to say; nothing is refused on them |
| The map | [starry](https://starry.readthedocs.io/) 1.2.0 (Luger et al. 2019, AJ 157, 64) | The brightness over the surface, as spherical harmonics up to degree 5, that reproduces the light curve as the star turns |

What this repository writes is what lies between them: the readers of MAST's answers, the files each code reads, the
published criteria as a table of methods, and the conversion of starry's map to the table the star pages draw.
[`tools.py`](../packages/telescope-cli/src/archives/tess/tools.py) holds calls to those codes and nothing else.

## Finding a star's light curves

A mission's archive is asked only about a star whose kind that mission's method covers (the next section). MAST is asked
which K2 light curves lie at the star's place
([`kepler/light-curves.mts`](../packages/telescope-cli/src/archives/kepler/light-curves.mts)) and, when K2 has none or
its method refuses the star, which TESS 2-minute light curves do
([`tess/light-curves.mts`](../packages/telescope-cli/src/archives/tess/light-curves.mts)).
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
| A target in the paper's catalogue of rotators; the TESS mission's 2-minute light curve of a sector, sectors 1 to 26 | Colman et al. (2024, AJ 167, 189): the paper's own verdict, read from its table | Wired, for a star Holcomb et al.'s method refuses |
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

Of our stars with a Kepler or K2 name, the first it was run on, 67 are in the paper's range and have a K2 light curve.
What the method gave on them:

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
| BD-16 351 | 3 | 3 | 3.26 | none (3.23 measured here earlier) | 3 |
| EK Draconis | 12 | 9 | 2.68 | 2.64 | 9 |

AU Mic's sectors 1, 27 and 95 give 4.97, 4.89 and 5.00 days. Sector 27 is not valid, because its peaks' width is 0.38
where the paper asks for more than 0.4, so it has no map. All three together give 4.84 days.

### TESS: the verdict Colman et al. (2024) published

Colman et al. (Sects. II.1, II.4 and III) searched the mission's 2-minute light curves of sectors 1 to 26, one sector at
a time. Their targets are those the TESS Input Catalog gives at most 7,000 K or no temperature, fainter than absolute
magnitude 0 in Gaia's G band and between TESS magnitudes 5 and 16. Each light curve is clipped at three sigma, and its
period is the highest peak of its Lomb-Scargle periodogram. Two random-forest classifiers, trained on periods measured
from the ground, say whether the sector shows rotation and whether its period is accurate. A sector that passes both
with a periodogram amplitude of at least 0.01 is a detection, and a period over 12 days was kept only when the authors
confirmed it by eye. On their blind test set the first classifier turned away 82% of the stars with no rotation, and
the second 95% of the inaccurate periods.

Their code carries no licence, so it is not run here. Their catalogue of the 10,909 targets with a detection is
published, and a star's row in it is the paper's own verdict on that star.
[`published.mts`](../packages/telescope-cli/src/archives/tess/published.mts) reads the table through VizieR's TAP
service, for a star whose light Holcomb et al.'s method refuses, and takes from a row only what the paper asserts:

| Column | What the table's description says | How it is read |
| --- | --- | --- |
| `Prot` | The rotation period: the median of the sectors with a detection | The star's period. 120 rows print none, and are not a verdict |
| `f_Prot` | 1 marks a potential half-period: in at least one sector the 2-term periodogram and the autocorrelation both give twice the period | A flagged row gives two candidate periods, and none is taken from it |
| `Sector` | How many of the star's sectors the detections come from | Decides which light the verdict is on (below) |
| `Rvar` | The light's 95th less its 5th percentile | The light's swing |
| `Per` | The adjusted period: doubled where the flag is set | Not read. In the published file it does not follow the flag: 307 of the 1,796 flagged rows hold twice `Prot`, and 1,453 unflagged rows do |
| `Teff`, `Tmag` | The target's temperature and TESS magnitude | Not read. In the rows checked they are another star's: AU Mic's row prints 6,100 K and magnitude 10.29 |

The table says how many of a star's sectors its detections come from, not which ones, and the paper's per-sector output
([Zenodo](https://doi.org/10.5281/zenodo.10684613)) names no sector either. So the verdict is taken only for a star
whose number of 2-minute light curves in sectors 1 to 26 is the number the table gives. Each of them is then a sector
the paper found rotation in, and each becomes one Brightness map at the paper's period. A sector after 26 was not judged
by the paper and gets no map on its verdict. The three checks against what is published of the star (its catalogued
period, SIMBAD's type, the orbit at its surface) apply as they do to a method's verdict.

Nothing is measured or judged here for such a star. Its datasets say that the rotation and its period are the paper's,
and its README gives the sentence with which Holcomb et al.'s criteria refuse the same light. A period a paper published
is not written into the star's record as one measured here.

Of our stars, 39 are in the catalogue. Holcomb et al.'s method accepts 19 of them itself and refuses 20. Of the 19, 17
are at the table's period within 20%; HIP 67522 is at twice the period the table flags as a potential half, and TOI-2459
at 11.13 days where the table prints 3.91. For the 20 it refuses:

| What the star's row gives | Stars |
| --- | --- |
| One period, found in as many sectors as the star has among 1 to 26: the paper's verdict is taken | 8 |
| Detections in fewer sectors than the star has | 9 |
| A potential half-period | 3 |

Seven of the eight are drawn, with ten maps: BE Ceti, HD 6569, HD 15906, HD 63433, Merga and YSES 1 have one sector
each, and TOI-1136 has four. TOI-2076's 5.43 days is neither its catalogued 7.21 days nor half of it, so it is not
drawn. Six of the seven have a catalogued period from another source, each within 20% of the table's (7.78, 7.13, 6.4,
3.7, 8.19 and 5.5 days); HD 15906's only catalogued period is this table's own. This is a comparison, not a setting.

![Six of the seven stars in the app (BE Ceti, HD 6569, HD 63433, Merga, TOI-1136 and YSES 1): Color + brightness above, Brightness map below](images/stellar-brightness-maps-published-verdict.webp)

### A star K2's method refuses

K2's light is judged first. A star K2 did not watch is judged on its TESS light, and so is a star whose K2 light
Reinhold & Hekker's method refuses: Holcomb et al.'s method is run on its TESS 2-minute light curves as on any other
star's, and the receipt keeps both missions' windows and both verdicts. A rotation K2's method accepts stays K2's,
whether or not it is drawn. Neither paper speaks of the other mission: the order is this repository's, and each method
still reads only its own paper's light curves.

A star that comes to TESS this way is given a light curve only when its target lies within 3 arcseconds of the star's
place: within a pixel, the nearest target of a faint companion is its bright neighbour.

K2's method refuses 40 of our stars: the periodogram's peak for 32, the three periods for 4, two campaigns apart for 2,
the period's range for 1, and 1 has no campaign the paper analyses. Of those 40, 38 have TESS 2-minute light curves of
their own. Holcomb et al.'s method accepts none of them: 31 have no valid period in any sector, 5 have one sector, which
is outside the criteria, and 2 have one sector with no repeating peaks. WASP-157 has no 2-minute light curve, and the
one nearest K2-122 B is of a target 18.9 arcseconds from it. So this rule draws no star today.

### A star whose record holds no temperature or no surface gravity

Holcomb et al. (Sect. III) take a star's temperature and surface gravity from the TESS Input Catalog v7, and leave out
a star without either. The primary header of a 2-minute light curve carries the catalog's values for its target
(`TEFF` and `LOGG`, with the catalog's version in `TICVER`). When the record of a star lacks one of the two, the star's
sectors are listed, lightkurve reads the header of the first, and the missing value is taken from it. A value the record
holds is never replaced, and a header may leave either value blank. The paper's cuts are then applied as to any star.

The header's values are those of the light curve's target. They are taken only when that target lies within 3
arcseconds of the star's place, the distance at which the metadata pass takes a catalogue's row as a star's. The
2-minute light curve nearest HD 189733 B is HD 189733 A's, 11.3 arcseconds away, and nothing is taken from it.

The records of 40 of our stars lack one of the two values: 34 the surface gravity, and 6 both. Of those 40, 23 have a
2-minute light curve of their own, whose headers are of catalog versions 8.2 (12 stars), 8.1 (10) and 8 (1). The header
fills a value for 11 of them and is blank where the record lacks for 12. Ten stars are judged that were not before (HD
189733 A, HD 209458, HD 110067, Malmok, Gnomon, KELT-9, Acubens, Aerostaticus, Alruba and Rukbat), and Holcomb et al.'s
method accepts none: each has a valid period in fewer than half its sectors, Alruba in 16 of 34 where 17 are asked.
TRAPPIST-1's header gives a gravity and no temperature, so it is still left out. For two more, HD 189733 B and Kulou,
the nearest light curve is another target's. So this rule draws no star today either.

### Every star

The counts in the sections on the two methods are of the first stars each was run on. `reduce.mts --all` has since judged
every star with a page, 3,118 on 6 October 2026. These numbers are counted from the receipts.

| What happened | Stars |
| --- | --- |
| Not read: no method covers its kind (evolved, or outside both methods' temperatures) | 1,438 |
| Not read: SIMBAD files it as a pulsating star or a close pair | 534 |
| Not read: neither its record nor a light curve's header holds both its temperature and its surface gravity (162 of them are not stars) | 192 |
| Not read: a method covers its kind, and its mission publishes no light curve of the star | 28 |
| Read by Holcomb et al.'s method, on TESS light curves | 877 |
| Read by Reinhold & Hekker's method, on K2 light curves | 87 |

The two last rows share 38 stars, which K2's method refused and TESS's then read: 926 stars are read. Of them, 116 have
a rotation that is drawn: 65 by Holcomb et al.'s method on TESS light, 44 by Reinhold & Hekker's on K2 light, and 7 on
the verdict Colman et al. published. Why the other 810 have none, by the last light that was judged:

| Reason | TESS | K2 |
| --- | --- | --- |
| A valid period in fewer of the star's sectors than half, rounded up (in none of them for 599) | 693 | |
| The star's one sector is outside the criteria | 44 | |
| No valid period in all the star's sectors together | 29 | |
| No repeating peaks in the autocorrelation of the star's one sector | 26 | |
| Lopsided light: removed as a possible eclipsing binary | 4 | |
| Refused by K2's method, and TESS publishes no 2-minute light curve of the star | | 2 |
| Accepted by the method at a period that is neither the catalogued one nor its half: not drawn | 9 | 3 |

Of the 805 under TESS, 38 are the stars K2's method refused first, for the reasons given above, and 13 are in Colman et
al.'s catalogue without a verdict that could be taken or drawn.

No period was refused as shorter than an orbit at the star's surface.

The two methods accept 121 stars, and 87 of them have a rotation period in the catalogues. The method's period is the
catalogued one within 20% for 68 (TESS 39, K2 29), half of it for 7 (TESS 1, K2 6) and another period for 12 (TESS 9,
K2 3). The 12 have no map; the 7 are drawn at twice the light's period. The other 34 have no catalogued period, and the
method alone vouches for theirs: BD-16 351 is one, because the 3.23 days its record holds were measured in this project
under the rule since removed. This is a comparison, not a setting.

So 116 stars have maps, 362 maps in all: 72 stars with 313 maps from TESS, 7 of those stars and 10 of those maps on
Colman et al.'s verdict, and 44 stars with 49 maps from K2. A star TESS has watched often has a map for each valid
sector: TOI-1860 has 11 and DS Tuc A has 10.

The light of 18 of the 116 stars swings by under 0.1%, and 10 of those are hotter than 7,000 K (Stellio at 9,131 K swings
by 0.012%, the least). Holcomb et al. (Sect. III) exclude no star by how much its light varies, and write that some, the
hotter ones above all, "may warrant additional inspection" to tell rotation from pulsation. They print no cut for it, and
none is applied here.

![Six of the stars in the app (DS Tuc A, PDS 70, HIP 67522, TOI-837, HD 29615 and Biham): Color + brightness above, Brightness map below](images/stellar-brightness-maps-all-stars.webp)

### What here is not printed in a paper

Eight things around the methods are this repository's, and a reader should know them as such:

1. Holcomb et al.'s criteria are applied to sectors after their sample's 26.
2. A star's temperature and surface gravity are read from its record here; Holcomb et al. read them from the TESS Input
   Catalog v7. A value the record lacks is the catalog's, from the header of the star's own light curve: v8, v8.1 or
   v8.2 there, not the paper's v7, and only when the light curve's target lies within 3 arcseconds of the star.
3. A star that SIMBAD files as a pulsating variable, an eclipsing or interacting pair is not read. Holcomb et al. write
   that such stars give periodic signals that are not rotation, and had no catalogue to remove them with.
4. A period shorter than an orbit at the star's surface, from its recorded radius and mass, is refused: no star turns
   faster.
5. A period is set beside the catalogued one as described above: kept within 20%, doubled at half, not drawn otherwise.
6. K2's light is judged before TESS's, and a star K2's method refuses is judged on its TESS light, when the target of
   a 2-minute light curve lies within 3 arcseconds of it. A rotation K2's method accepts is not set beside a second
   method's.
7. Colman et al.'s table is looked up only for a star Holcomb et al.'s method refuses. A row is taken only when the
   star's 2-minute sectors among 1 to 26 are as many as the detections the table counts, and never when the paper flags
   its period as a potential half-period.
8. A map on Colman et al.'s verdict is made from the sector's light as SpinSpotter's cleaning prepares it (30-minute
   bins, the star's known transits masked), as every TESS map here is. The paper judged the light clipped at three
   sigma.

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

A scale ends at the smallest of 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 times a power of ten that holds the star's maps. A
receipt gives a map's range to a tenth of a percent; a map that reads 100% to 100% there takes its range from its table.
Biham's light swings by 0.01%, and its Brightness maps are drawn from 99.96% to 100.04%. A table holds a map to a
thousandth of a percent of the mean, so the narrowest map here (Shangcheng in sector 52, 99.995% to 100.005%) has 11
distinct values. A scale is only how a map is drawn: no star is kept or left out by it.

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

`reduce.mts` asks MAST for the star's K2 light curves and, when K2 has none or its method refuses the star, its TESS
2-minute ones, each only when a method covers the star's kind, and has that method judge them. For a star the TESS method
refuses it looks the star up in Colman et al.'s table, which is one request to VizieR for all stars, kept under
`output/tess/published/`. `--all` leaves a star alone once it has a receipt; a star judged before a change to the
route is judged again by name. It writes a receipt for each star under ignored
`output/tess/<star id>/`: the mission, each sector or campaign with the request that fetched it and the pipeline version
that made it, the method, what it measured, the verdict with its reason, and the codes' versions. Each light curve is kept
beside it as the method prepared it. A star's files are fetched eight at a time and its maps are made in one starry
process. Gaia's answer for all stars is one request of some ten minutes, kept under `output/tess/` so a star is asked once.

Every star takes hours on one run: about 13 s a star with light curves and 8 s a map, measured over 336 stars. Several
runs share the stars, each taking every Nth (`--all --shard=K/N`, K from 0 to N-1); MAST answers requests sent side by
side, and six runs were four times as fast as one:

```sh
for k in 0 1 2 3 4 5; do node packages/telescope-cli/src/archives/tess/reduce.mts --all --shard=$k/6 & done; wait
```

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
- A star of Colman et al.'s catalogue with more 2-minute sectors among 1 to 26 than the table counts detections has no
  map on that verdict: the table does not say which sectors they are.
- A map on Colman et al.'s verdict is of sectors 1 to 26 only (2018 to 2020), however often TESS has watched the star
  since.
- Other stars near a star are counted for its page to say and nothing is refused on them: the missions' light curves
  correct for crowding, and no published limit is applied here.
- A periodic light is taken as rotation. A pulsating star or a close pair that SIMBAD does not file as one, with a period
  longer than the surface orbit's, would pass as a turning, spotted star.
- A star with no catalogued period whose light repeats twice a turn is given half its true period.
