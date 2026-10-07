# What the archive holds of ESPaDOnS polarised spectra

Written by `packages/telescope-cli/src/archives/espadons/archive-ledger.mts` from the [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) on 2026-10-06.
The counts are the archive's own, from one grouped query. Every state is worked out from the programs in
`packages/telescope-cli/src/archives/espadons/programs` and the receipts `reduce.mts` writes under ignored `output/espadons`; a run
not reduced on this machine keeps the result recorded here. [A star's magnetic map from archived
spectra](stellar-magnetic-maps-from-spectra.md) describes what a map is made with and what it cannot do.

The archive holds 22,652 polarised spectra under 3,005 typed target names. 173 of the 3,090 stars this project ships have some: 5,040 spectra.
93 stars have 6 or more and are listed. Mapped: 23. Reduced without a map: 1. Pinned: 0. Held: 149.

Spectra alone do not make a map. A star also needs its rotation period, the tilt of its axis and its projected rotation
speed from papers, a field strong enough to detect, and spectra spread through a rotation. "Axis" says whether the star's
page already draws a measured tilt or only a display convention.

| star | spectra | years | names typed by observers | axis on its page | state |
|---|---|---|---|---|---|
| [polaris](../src/objects/polaris/README.md) | 545 | 2020 to 2026 | * alf UMi, Polaris, alf UMi | display convention | held |
| [antares](../src/objects/antares/README.md) | 440 | 2010 to 2024 | * alf Sco, Antares, HD 148478, and 1 more | display convention | held |
| [sirius](../src/objects/sirius/README.md) | 421 | 2009 to 2011 | Sirius, Sirius A | display convention | held |
| [vega](../src/objects/vega/README.md) | 332 | 2006 to 2011 | HD 172167 (Vega), Vega, vega | measured | held |
| [betelgeuse](../src/objects/betelgeuse/README.md) | 268 | 2009 to 2023 | * alf Ori, Betelgeuse, HD 39801, and 1 more | measured | held |
| [tepiamenit](../src/objects/tepiamenit/README.md) | 203 | 2005 to 2024 | Tau Boo, tau Boo, tau boo, and 2 more | measured | mapped: `tau-boo-2006-06` (1.6 G), `tau-boo-2007-06` (1.3 G), `tau-boo-2008-01` (2.2 G), `tau-boo-2016-06` (1.9 G), `tau-boo-2024-01` (1.5 G) |
| [sigma-bootis](../src/objects/sigma-bootis/README.md) | 136 | 2011 to 2021 | HD 128167, sig Boo | display convention | held |
| [titawin](../src/objects/titawin/README.md) | 118 | 2005 to 2014 | UPS_AND, Ups And, upsilon And | display convention | held |
| [deneb](../src/objects/deneb/README.md) | 117 | 2005 to 2012 | Deneb, HD 197345, alpha cyg, and 1 more | display convention | held |
| [mirfak](../src/objects/mirfak/README.md) | 115 | 2009 to 2011 | HD 20902 | display convention | held |
| [rastaban](../src/objects/rastaban/README.md) | 107 | 2009 to 2011 | HD 159181 | display convention | held |
| [mekbuda](../src/objects/mekbuda/README.md) | 100 | 2009 to 2025 | * zet Gem, HD 52973, zet Gem, and 1 more | display convention | held |
| [spica](../src/objects/spica/README.md) | 91 | 2006 to 2013 | Alpha Vir, AlphaVir, Spica, and 1 more | display convention | held |
| [arneb](../src/objects/arneb/README.md) | 83 | 2009 to 2019 | Alpha Lep, HD 36673, alpha lep | display convention | held |
| [gq-lup](../src/objects/gq-lup/README.md) | 81 | 2009 to 2016 | GQ Lup | measured | held |
| [tureis](../src/objects/tureis/README.md) | 76 | 2010 to 2022 | * rho Pup, HD 67523, HD67523, and 1 more | display convention | held |
| [nusakan](../src/objects/nusakan/README.md) | 73 | 2005 to 2016 | Beta CrB, BetaCrB, HD 137909, and 1 more | display convention | held |
| [regulus](../src/objects/regulus/README.md) | 65 | 2012 | HD 87901, HD87901 | measured | held |
| [mebsuta](../src/objects/mebsuta/README.md) | 53 | 2009 to 2010 | HD 48329 | display convention | held |
| [hd-189733](../src/objects/hd-189733/README.md) | 52 | 2006 to 2023 | HD 189733, HD189733, hd 189733, and 1 more | measured | mapped: `hd-189733-2006-08-as-drawn` (27 G), `hd-189733-2007-06-as-drawn` (24 G), `hd-189733-2007-06` (24 G), `hd-189733-2013-09-as-drawn` (55 G), `hd-189733-2013-09` (50 G), `hd-189733-2023-06` (33 G) |
| [arcturus](../src/objects/arcturus/README.md) | 49 | 2006 to 2022 | * alf Boo, HD 124897, HD124897 | display convention | held |
| [rigel](../src/objects/rigel/README.md) | 47 | 2009 to 2021 | Rigel, Rigel A, Rigel BC | display convention | held |
| [diphda](../src/objects/diphda/README.md) | 46 | 2007 to 2011 | Beta Cet, BetaCep, HD 4128, and 3 more | display convention | held |
| [pollux](../src/objects/pollux/README.md) | 45 | 2007 to 2014 | HD 62509, Pollux, beta Gem, and 1 more | display convention | held |
| [chi1-orionis](../src/objects/chi1-orionis/README.md) | 44 | 2014 to 2015 | HD39587 | measured | mapped: `chi1-ori-2014-12` (20 G), `chi1-ori-2015-01` (17 G) |
| [edasich](../src/objects/edasich/README.md) | 44 | 2014 | iota Dra | display convention | held |
| [enif](../src/objects/enif/README.md) | 42 | 2005 to 2011 | Epsilon Peg, HD 206778, eps peg, and 1 more | display convention | held |
| [helvetios](../src/objects/helvetios/README.md) | 39 | 2005 to 2014 | 51 Peg, 51Peg, 51peg | display convention | held |
| [hd-75732](../src/objects/hd-75732/README.md) | 34 | 2012 to 2018 | 55 Cnc | display convention | held |
| [gumala](../src/objects/gumala/README.md) | 31 | 2007 to 2009 | HD 179949, HD179949 | measured | mapped: `hd-179949-2009-09` (3.1 G) |
| [aldebaran](../src/objects/aldebaran/README.md) | 30 | 2007 to 2022 | * alf Tau, HD 29139, aldebaran, and 1 more | display convention | held |
| [sadalsuud](../src/objects/sadalsuud/README.md) | 29 | 2007 to 2011 | Beta Aqr, HD 204867 | display convention | held |
| [v374-pegasi](../src/objects/v374-pegasi/README.md) | 28 | 2006 to 2009 | V374 Peg, v374 peg, v374Peg | measured | mapped: `v374-peg-2005-08` (498 G), `v374-peg-2006-08` (578 G) |
| [cebalrai](../src/objects/cebalrai/README.md) | 26 | 2011 | HR 6603 | display convention | held |
| [gj-1245-b](../src/objects/gj-1245-b/README.md) | 26 | 2006 to 2013 | GJ1245A, gj 1245b, gj1245b, and 1 more | measured | mapped: `gj-1245-b-2006-08` (98 G), `gj-1245-b-2007-09` (122 G) |
| [sadalmelik](../src/objects/sadalmelik/README.md) | 26 | 2007 to 2011 | HD 209750, alpha aqr | display convention | held |
| [yed-prior](../src/objects/yed-prior/README.md) | 25 | 2011 | HR 6056 | display convention | held |
| [hip-76768](../src/objects/hip-76768/README.md) | 24 | 2013 | HIP76768 | measured | mapped: `hip-76768-2013-05` (162 G) |
| [m25](../src/objects/m25/README.md) | 24 | 2008 to 2016 | BD-19 5044L | none | held |
| [muscida](../src/objects/muscida/README.md) | 24 | 2014 | omicron UMa | display convention | held |
| [m7](../src/objects/m7/README.md) | 23 | 2005 to 2016 | HD 162725 | none | held |
| [af-lep](../src/objects/af-lep/README.md) | 22 | 2007 | HR1817, hr1817 | measured | mapped: `af-lep-2007-12` (20 G) |
| [eq-pegasi-b](../src/objects/eq-pegasi-b/README.md) | 22 | 2006 to 2007 | Gl 896B, eqpeg a, eqpeg b, and 2 more | measured | mapped: `eq-peg-a-2006-08` (509 G), `eq-peg-b-2006-08` (442 G) |
| [kulou](../src/objects/kulou/README.md) | 22 | 2014 | HD 115892 | display convention | held |
| [ek-draconis](../src/objects/ek-draconis/README.md) | 20 | 2005 to 2016 | EK Dra, EKDra, ek dra, and 1 more | measured | mapped: `ek-dra-2006-11` (93 G) |
| [gj-1156](../src/objects/gj-1156/README.md) | 20 | 2007 to 2009 | GJ 1156, GJ1156, gj1156 | measured | mapped: `gj-1156-2007-03` (119 G), `gj-1156-2008-01` (105 G), `gj-1156-2009-01` (67 G) |
| [gj-504](../src/objects/gj-504/README.md) | 20 | 2025 | * e Vir | measured | mapped: `gj-504-2025-04` (4.6 G) |
| [gomeisa](../src/objects/gomeisa/README.md) | 20 | 2011 | HD 58715 | display convention | held |
| [brachium](../src/objects/brachium/README.md) | 19 | 2011 to 2015 | HD 133216 | display convention | held |
| [heryibwia](../src/objects/heryibwia/README.md) | 19 | 2014 to 2015 | HD 167618 | display convention | held |
| [kraz](../src/objects/kraz/README.md) | 19 | 2014 to 2015 | HD 109379 | display convention | held |
| [tyc-5164-567-1](../src/objects/tyc-5164-567-1/README.md) | 19 | 2013 | TYC 5164-567-1 | measured | mapped: `tyc-5164-567-1-2013-06` (74 G) |
| [au-mic](../src/objects/au-mic/README.md) | 18 | 2005 to 2023 | AU Mic, AUMic, HD 197481, and 2 more | display convention | held |
| [tyc-6878-195-1](../src/objects/tyc-6878-195-1/README.md) | 17 | 2013 | TYC 6878-0195-1 | measured | mapped: `tyc-6878-0195-1-2013-06` (67 G) |
| [bd-16-351](../src/objects/bd-16-351/README.md) | 16 | 2012 | BD-16351 | measured | mapped: `bd-16351-2012-09` (69 G) |
| [hip-12545](../src/objects/hip-12545/README.md) | 16 | 2012 | HIP12545 | measured | mapped: `hip-12545-2012-09` (133 G) |
| [tyc-6349-200-1](../src/objects/tyc-6349-200-1/README.md) | 16 | 2013 | TYC 6349-0200-1 | measured | mapped: `tyc-6349-0200-1-2013-06` (65 G) |
| [hd-209458](../src/objects/hd-209458/README.md) | 15 | 2005 to 2020 | HD 209458 | display convention | held |
| [kepler-78](../src/objects/kepler-78/README.md) | 15 | 2014 to 2015 | Kepler-78 | measured | mapped: `kepler-78-2015-08` (12 G) |
| [tyc-1987-509-1](../src/objects/tyc-1987-509-1/README.md) | 15 | 2015 | TYC 1987-509-1 | measured | mapped: `tyc-1987-509-1-2015-03` (22 G) |
| [tyc-486-4943-1](../src/objects/tyc-486-4943-1/README.md) | 15 | 2013 | TYC 0486-4943-1 | measured | mapped: `tyc-0486-4943-1-2013-06` (12 G) |
| [flegetonte](../src/objects/flegetonte/README.md) | 14 | 2008 | HD 102195, HD102195, hd102195 | measured | mapped: `flegetonte-2008-01` (16 G) |
| [fomalhaut](../src/objects/fomalhaut/README.md) | 14 | 2014 | HD 216956 | display convention | held |
| [iota-piscium](../src/objects/iota-piscium/README.md) | 14 | 2016 | iot Psc | display convention | held |
| [udkadua](../src/objects/udkadua/README.md) | 14 | 2005 to 2006 | HD 222107, HD222107, Lambda And, and 3 more | display convention | held |
| [nganurganity](../src/objects/nganurganity/README.md) | 13 | 2009 to 2014 | HD 52877 | display convention | held |
| [eq-pegasi-a](../src/objects/eq-pegasi-a/README.md) | 12 | 2006 | eq peg a, eq peg b, eqPegA, and 3 more | measured | mapped: `eq-peg-a-2006-08` (509 G), `eq-peg-b-2006-08` (442 G) |
| [hamal](../src/objects/hamal/README.md) | 12 | 2007 to 2014 | Alpha Ari, HD 12929, alpha Ari, and 2 more | display convention | held |
| [hd-6569](../src/objects/hd-6569/README.md) | 12 | 2015 | HD 6569 | measured | mapped: `hd-6569-2015-09` (15 G) |
| [hd-90839](../src/objects/hd-90839/README.md) | 12 | 2017 | 36 UMa | display convention | held |
| [marsic](../src/objects/marsic/README.md) | 12 | 2008 to 2011 | HD 145001, __kappa_~Her A | display convention | held |
| [zeta-aquilae-a](../src/objects/zeta-aquilae-a/README.md) | 12 | 2009 | HR 7235 | display convention | held |
| [jian](../src/objects/jian/README.md) | 11 | 2014 | HD 175775 | display convention | held |
| [kaus-media](../src/objects/kaus-media/README.md) | 10 | 2014 to 2015 | HD 168454 | display convention | held |
| [phact](../src/objects/phact/README.md) | 10 | 2011 to 2015 | HD 37795 | display convention | held |
| [xi-pegasi](../src/objects/xi-pegasi/README.md) | 10 | 2016 | ksi Peg | display convention | held |
| [eps-eridani](../src/objects/eps-eridani/README.md) | 9 | 2014 | epsilon Eri | display convention | held |
| [formosa](../src/objects/formosa/README.md) | 9 | 2014 | HD 100655 | display convention | held |
| [gj-820-b](../src/objects/gj-820-b/README.md) | 9 | 2005 to 2007 | 61 Cyg B, 61 cyg B, HD201092 SPT1 | display convention | held |
| [matrichakra](../src/objects/matrichakra/README.md) | 9 | 2010 to 2011 | __delta_~CrB | display convention | held |
| [t-mon](../src/objects/t-mon/README.md) | 9 | 2021 | T Mon | display convention | held |
| [alchiba](../src/objects/alchiba/README.md) | 8 | 2014 | HD 105452 | display convention | held |
| [alcyone](../src/objects/alcyone/README.md) | 8 | 2009 | Eta Tau | display convention | held |
| [hip-41378](../src/objects/hip-41378/README.md) | 8 | 2017 to 2018 | HIP41378 | display convention | reduced, no map |
| [ping](../src/objects/ping/README.md) | 8 | 2008 to 2015 | HD 32887, hd 32887 | display convention | held |
| [groombridge-34-a](../src/objects/groombridge-34-a/README.md) | 7 | 2005 to 2016 | Gl 15A, HD1326, J00182549+4401376, and 2 more | display convention | held |
| [hd-135344-a](../src/objects/hd-135344-a/README.md) | 7 | 2006 to 2007 | HD 135344, HD135344, SAO 206463, and 1 more | display convention | held |
| [monch](../src/objects/monch/README.md) | 7 | 2008 | HD 130322, HD130322, hd130322 | display convention | held |
| [rukbat](../src/objects/rukbat/README.md) | 7 | 2015 | hd 181869 | display convention | held |
| [zavijava](../src/objects/zavijava/README.md) | 7 | 2005 to 2007 | HD 102870, hr4540 | display convention | held |
| [alqiladah](../src/objects/alqiladah/README.md) | 6 | 2014 | HD 177241 | display convention | held |
| [barnards-star](../src/objects/barnards-star/README.md) | 6 | 2016 to 2017 | GJ699, J17574849+0441405 | display convention | held |
| [seginus](../src/objects/seginus/README.md) | 6 | 2006 | Gamma Boo | display convention | held |

## Reduced without a map

- **tepiamenit**, tau-boo-2005-03: The field is not detected: the 2072 points of the run's Stokes V profiles stand -2.5 standard deviations above none (reduced chi-square 0.92), under the 4 a map asks for.
- **hd-189733**, hd-189733-2006-06-as-drawn: no map
- **hd-189733**, hd-189733-2006-06: The map does not describe the spectra: its reduced chi-square stays at 8.90. The field changed during the run, or it is too strong for the weak-field treatment.
- **chi1-orionis**, chi1-ori-2014-12-all: The map does not describe the spectra: its reduced chi-square stays at 2.30. The field changed during the run, or it is too strong for the weak-field treatment.
- **gumala**, hd-179949-2007-06: The field is not detected: the 270 points of the run's Stokes V profiles stand 3.5 standard deviations above none (reduced chi-square 1.30), under the 4 a map asks for.
- **gj-1245-b**, gj-1245-b-2008-08: The field is not detected: the 270 points of the run's Stokes V profiles stand 0.8 standard deviations above none (reduced chi-square 1.07), under the 4 a map asks for.
- **hip-41378**, hip-41378-2017-12: The field is not detected: the 200 points of the run's Stokes V profiles stand 0.7 standard deviations above none (reduced chi-square 1.07), under the 4 a map asks for.
