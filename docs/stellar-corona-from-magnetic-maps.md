# A star's corona from its magnetic map

No telescope has imaged the corona of a star other than the Sun. For some stars, astronomers have mapped the magnetic field
on the surface from how it polarises the star's light (Zeeman-Doppler imaging). This note describes how the body generator
turns such a map into a corona drawn around the star, what the result was checked against, and what it does not show.

The result is **derived here**. It is not an observation, and it is not a published model of that star. Every dataset made
this way says so.

## What goes in

| Input | Where it comes from |
| --- | --- |
| The radial magnetic field over the surface | The map the star's own page already draws, read from the same file |
| The star's X-ray flux | A catalogue row, such as the ROSAT all-sky survey's stars (Freund et al. 2022, A&A 664, A105) |
| The temperature of the corona | A cited measurement, or the relation of Johnstone & Güdel (2015, A&A 578, A129): T = 0.11 F_X^0.26 million kelvin, with F_X the X-ray power leaving each cm² of the surface |
| The mass the wind carries away | A cited measurement, or the relation of Wood et al. (2021, ApJ 915, 37): the mass loss through each unit of surface rises as F_X^0.77 |
| Mass, radius, distance, the tilt of the rotation axis | The star's own package |

Wood et al. print the slope of their relation and no starting value. The generator uses the line of that slope through the
median of the paper's own Table 3: the 11 single main-sequence stars whose wind was detected through their astrosphere. That
line gives the Sun's mass loss per unit surface at F_X = 10^4.53 erg s⁻¹ cm⁻². The 11 stars lie about it with an rms of 0.69
dex, a factor of 5; the farthest below, π¹ UMa, is 38 times under it
([`corona.test.mts`](../packages/bake/src/objects/stellar/corona/corona.test.mts) holds the rows and recomputes these numbers).

## What is computed

1. **The field above the surface.** The map is expanded in spherical harmonics to degree 15 and continued outward as a field
   with no electric currents, out to a *source surface* at 2.5 stellar radii where the wind is taken to pull every field line
   straight (Altschuler & Newkirk 1969; Schatten, Wilcox & Ness 1969). This is the model solar physicists use for the Sun
   every day ([`potential-field.ts`](../packages/bake/src/objects/stellar/corona/potential-field.ts)).
2. **The reversal line.** On the source surface the field points outward on one side of a line and inward on the other. On
   the Sun the bright streamer belt follows that line (Wang, Sheeley & Rich 2007).
3. **Two amounts of gas** ([`models.ts`](../packages/bake/src/objects/stellar/corona/models.ts)):
   - *gas at rest* at the corona's temperature, held by gravity, with as much gas as radiates the star's X-ray output
     (the loss function of Rosner, Tucker & Vaiana 1978);
   - *the wind* of Parker (1958) at the same temperature, carrying the star's mass loss. The wind leaves only through the part
     of each sphere that open field lines cross, found by following field lines from 648 directions at five radii, so it is
     that much denser there than a wind from the whole surface would be.
4. **The density** ([`sheet.ts`](../packages/bake/src/objects/stellar/corona/sheet.ts)). Gas at rest fills a sheet about the
   reversal line; the wind fills the rest. The sheet's share falls off with the angle δ from the line as exp(−(δ/σ)²), with σ
   narrowing from 15° at 1.2 radii to 8° from 2 radii outward. Beyond the source surface the sheet's excess over the wind
   falls as r⁻³.
5. **The picture** ([`display.ts`](../packages/bake/src/objects/stellar/corona/display.ts)). At each distance from the star
   brightness is proportional to density, as scattered light is. The gas on the sheet, the densest of its distance, takes its
   place on a logarithmic density scale; everything thinner is dimmer in proportion. Only the fall-off with distance is
   compressed.

The sheet's widths, its r⁻³ decay and the source radius are choices, not measurements. The two checks below say how well
they do.

## Checked against a published simulation

ε Eridani is the one star with both released magnetic maps and a released three-dimensional simulation of its corona
(Ó Fionnagáin et al. 2022; [its package](../src/objects/eps-eridani-corona/README.md)). The derivation was given what it is
given for any star: the surface field, the X-ray luminosity (10^28.35 erg s⁻¹), the X-ray temperature (4.06 million kelvin)
and the measured mass loss (30 times the Sun's). Its density was then compared with the simulation's in every voxel of six
shells, for each of three maps
([`derivation-check.mts`](../packages/bake/authoring/eps-eridani-corona/derivation-check.mts), 19 seconds, run on 5 October
2026):

| Map | Correlation of log density, by shell | Derived ÷ simulated, by shell | rms factor between them |
| --- | --- | --- | --- |
| January 2008 | 0.61 to 0.72 | 0.60 to 1.31 | 1.7 to 2.2 |
| October 2011 | 0.51 to 0.62 | 0.68 to 1.42 | 1.9 to 2.2 |
| October 2013 | 0.81 to 0.90 | 0.46 to 1.20 | 1.5 to 2.3 |

Over the 18 shells the mean correlation is 0.69 and the rms factor is 1.88: on average the derived density is within a
factor of two of the simulation's, and it puts the dense gas in the same places best for the map with the strongest field.
Nothing in the derivation was fitted to this star.

Alternatives tried on the same test on the same day and not kept (their trial code is not in the repository): a wind from the whole surface (rms factor 2.2), a wind whose temperature
falls outward (2.2), a cooler wind at 2.0 or 1.3 million kelvin (2.6 and 10), gas pressure rising with the square of the
field strength (correlation 0.13), and one fixed sheet width of 20° (2.3).

## Checked against the Sun

For Carrington rotation 2053 the Sun has both a measured surface field (the Wilcox Solar Observatory's harmonic
coefficients, [wso.stanford.edu/Harmonic.rad/CR2053](http://wso.stanford.edu/Harmonic.rad/CR2053)) and a measured corona (the STEREO-B COR1 tomography [the Sun's page](../src/objects/sun-cor1-density/README.md)
shows). The reversal line computed here from the first was compared with the density measured in the second
([`corona/sun-check.mts`](../packages/bake/cli/corona/sun-check.mts)):

| Radius | Within 5° of the line | 5° to 10° | 10° to 20° | 20° to 40° | Beyond 40° |
| --- | --- | --- | --- | --- | --- |
| 2.0 | 1.88 | 1.85 | 1.90 | 1.04 | 0.13 |
| 2.5 | 2.85 | 2.75 | 2.42 | 0.95 | 0.35 |
| 3.0 | 2.45 | 2.30 | 1.83 | 0.91 | 0.66 |

Each number is the measured density divided by the density typical of that radius. The Sun's dense belt lies along the
computed line, and far from it the corona is thin. The belt measured this way is about 20° wide, wider than the sheet drawn
here; the tomography smooths it, and on the test above a 20° sheet fitted ε Eridani's simulation worse.

## What it does not show

- **Where the dense gas is** comes from the map and holds up in both checks. **How much gas there is** hangs on three
  numbers for the whole star. Where the mass loss is not measured it is uncertain by a factor of 5 or more, and it sets how
  bright the gas away from the sheet is drawn.
- The method is refused for a star whose corona, at its X-ray temperature, would not be held by the star's gravity: the wind
  would pass the speed of sound inside the star. Of the six stars with maps in the repository in October 2026 this leaves out
  HD 29615 and V1358 Orionis, the two brightest in X-rays.
- A star with a companion within 10 arcseconds that gives more of the pair's light than the color check allows is not
  drafted: the ROSAT survey does not separate the two, so its flux is both stars' (EQ Pegasi A and B, GJ 1245 B). Its own
  X-ray flux has to be cited by hand.
- A magnetic map resolves only the large-scale field and misses the part of the star that never turns toward us.
- The star's spin is left out of the gas balance, and so are flares and eruptions.
- The direction of the rotation axis on the sky and the star's rotation phase today are not measured; the corona is drawn in
  the same frame as the star's own maps.

## Making one

```bash
pnpm telescope new-object --from-magnetic STAR_ID... --out output/corona/spec.json
```

drafts one entry for each star: every radial-field map its page shows, its ROSAT flux, and the two relations. Replace a
relation by a cited measurement where one exists (`"temperature": { "kelvin": ..., "catalogueId": ..., "url": ..., "label":
..., "locator": ... }`, `"massLoss": { "solar": ..., ... }`). Then

```bash
pnpm telescope new-object output/corona/spec.json --bake
```

writes each star's bank (`src/objects/<star>-corona/`), adds a "Derived corona" dataset to the star with one step for each
map, and bakes both. The code is [`corona/`](../packages/telescope-cli/src/new-object/corona/) in the generator.
