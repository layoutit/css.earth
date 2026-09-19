# What the Gemini archive holds for cssEarth
Written by `tools/objects/gemini/archive-ledger.mts` from the archive itself on 2026-09-19. Nothing here is
typed in by hand: the counts are the archive's own `GROUP BY` results and each capability's state is read from the
pinned programs and the receipts beside them. Re-run the command to bring it up to date.
Every count here is of planes whose dataRelease has passed, so it is a census of what anyone can download without an account.
Where the bytes come from: CADC, which mirrors the Gemini raw archive as CAOM-2 collection GEMINI and answers anonymously. archive.gemini.edu refuses anonymous requests from this machine.
## What this toolkit has proven
A capability is `reduced` only when a receipt exists that parses, names a pinned program and names a product that has a
product record carrying that same evidence. `pinned` means an observation is pinned and nothing has been checked yet.
`unproven` means DRAGONS supports the instrument and nothing here has run it. `unsupported` means DRAGONS does not
reduce it at all, which is a fact about DRAGONS and not something this toolkit can fix.
| instrument | public science frames | DRAGONS | state | why |
|---|---|---|---|---|
| GMOS-N | 156129 | supported | unproven | DRAGONS supports it (imaging and longslit spectroscopy in DRAGONS 4.2) and nothing here has been reduced through it yet. |
| GMOS-S | 146963 | supported | reduced | 4 accepted receipt(s) beside 1 pinned program(s). |
| NIRI | 406596 | supported | unproven | DRAGONS supports it (imaging in DRAGONS 4.2) and nothing here has been reduced through it yet. |
| GNIRS | 112642 | supported | unproven | DRAGONS supports it (longslit and cross-dispersed spectroscopy in DRAGONS 4.2) and nothing here has been reduced through it yet. |
| F2 | 130955 | supported | unproven | DRAGONS supports it (imaging and longslit spectroscopy in DRAGONS 4.2) and nothing here has been reduced through it yet. |
| GSAOI | 13761 | supported | unproven | DRAGONS supports it (imaging in DRAGONS 4.2) and nothing here has been reduced through it yet. |
| GMOS | 89 | supported | unproven | DRAGONS supports it (imaging and longslit spectroscopy in DRAGONS 4.2) and nothing here has been reduced through it yet. |
Instruments DRAGONS does not reduce, with their public science frames:

| instrument | public science frames | why |
|---|---|---|
| NIFS | 29136 | no DRAGONS support; its reduction path is the legacy Gemini IRAF stack |
| MAROON-X | 8880 | visiting spectrograph with its own pipeline, not in DRAGONS |
| PHOENIX | 74202 | visiting high-resolution spectrograph, not in DRAGONS |
| hrwfs | 103893 | No DRAGONS support is pinned here for this instrument. |
| GPI | 51644 | its pipeline is IDL, which is proprietary and is not installed here |
| Alopeke | 64656 | speckle imager; its products come from its own speckle pipeline, not DRAGONS |
| Zorro | 62173 | speckle imager; its products come from its own speckle pipeline, not DRAGONS |
| NICI | 44262 | retired coronagraphic imager, not in DRAGONS |
| IGRINS | 21609 | visiting spectrograph with its own pipeline, not in DRAGONS |
| Hokupaa+QUIRC | 37611 | No DRAGONS support is pinned here for this instrument. |
| GRACES | 19177 | fibre-fed spectrograph reduced by OPERA, not in DRAGONS |
| IGRINS-2 | 5915 | visiting spectrograph with its own pipeline, not in DRAGONS |
| TReCS | 12959 | retired mid-infrared imager, not in DRAGONS |
| michelle | 4753 | retired mid-infrared imager and spectrometer, not in DRAGONS |
| GHOST | 9807 | reduced by its own GHOSTDR package, not the DRAGONS recipes pinned here |
| FLAMINGOS | 12090 | No DRAGONS support is pinned here for this instrument. |
| TEXES | 1739 | a visiting instrument with its own reduction, not in DRAGONS |
| CIRPASS | 620 | No DRAGONS support is pinned here for this instrument. |
| bHROS | 401 | No DRAGONS support is pinned here for this instrument. |
| OSCIR | 436 | No DRAGONS support is pinned here for this instrument. |
## Every public Gemini frame of the Galilean moons
Of the four Galilean moons, all four have public Gemini science frames (io, europa, ganymede, callisto), and 2 (io, ganymede) were taken on an instrument this toolkit has proven. What decides whether anything can be done with a moon is not whether frames exist but whether the instrument that took them is one this toolkit has proven, so each moon is listed with the state of every instrument that observed it. io: NIRI 6541 (unproven), GMOS-S 40 (reduced), NIFS 24 (unsupported), Hokupaa+QUIRC 7 (unsupported), IGRINS 6 (unsupported). Reducible here through GMOS-S. europa: GNIRS 220 (unproven), NIFS 72 (unsupported), TEXES 25 (unsupported), GPI 23 (unsupported). No instrument that observed it has been proven by this toolkit, so nothing here can be reduced for it. ganymede: GMOS-S 49 (reduced), NIRI 18 (unproven). Reducible here through GMOS-S. callisto: NIFS 55 (unsupported), NIRI 53 (unproven). No instrument that observed it has been proven by this toolkit, so nothing here can be reduced for it.
| moon | instrument | type | intent | filter or band | frames | programmes |
|---|---|---|---|---|---|---|
| callisto | NIFS | ACQUISITION | calibration | HK | 4 | GN-2019A-FT-106 |
| callisto | NIFS | OBJECT | science | HK | 55 | GN-2019A-FT-106 |
| callisto | NIRI | ACQUISITION | calibration | H | 8 | GN-2019A-Q-202 |
| callisto | NIRI | OBJECT | science | CH4(long) | 12 | GN-2014B-C-1 |
| callisto | NIRI | OBJECT | science | CH4(short) | 12 | GN-2014B-C-1 |
| callisto | NIRI | OBJECT | science | J | 12 | GN-2014B-C-1 |
| callisto | NIRI | OBJECT | science | Jcon(112) | 5 | GN-2014B-C-1 |
| callisto | NIRI | OBJECT | science | Y | 12 | GN-2014B-C-1 |
| europa | GNIRS | ACQUISITION | calibration | H | 26 | GN-2017A-Q-63, GN-2022A-Q-311 |
| europa | GNIRS | ACQUISITION | calibration | H2 | 4 | GN-2022A-Q-311 |
| europa | GNIRS | OBJECT | science | L | 220 | GN-2017A-Q-63 |
| europa | GPI | OBJECT | science | H | 23 | GS-2019A-SV-500 |
| europa | NIFS | ACQUISITION | calibration | HK | 6 | GN-2011B-Q-76 |
| europa | NIFS | OBJECT | science | HK | 36 | GN-2011B-Q-76 |
| europa | NIFS | OBJECT | science | JH | 36 | GN-2011B-Q-76 |
| europa | NIRI | ACQUISITION | calibration | CH4(long) | 16 | GN-2020A-Q-113, GN-2020B-Q-120, GN-2023A-Q-126 |
| europa | NIRI | ACQUISITION | calibration | H | 60 | GN-2017A-Q-60, GN-2018A-Q-202, GN-2019A-Q-202, GN-2019A-Q-304, GN-2020A-Q-203, GN-2020B-Q-101, GN-2022A-Q-111, GN-2022B-Q-106 |
| europa | NIRI | ACQUISITION | calibration | M(prime) | 34 | GN-2016B-FT-18, GN-2016B-FT-29, GN-2017A-Q-60, GN-2019A-Q-202 |
| europa | TEXES | FLAT | calibration | none | 21 | GN-2006A-DS-1, GN-2006A-DS-3 |
| europa | TEXES | OBJECT | science | none | 25 | GN-2006A-DS-1, GN-2006A-DS-3, GN-2017A-Q-37 |
| ganymede | GMOS-S | ACQUISITION | calibration | g | 8 | GS-2019A-FT-109, GS-2021B-Q-231 |
| ganymede | GMOS-S | ACQUISITION | calibration | OIII | 26 | GS-2021B-Q-231 |
| ganymede | GMOS-S | ACQUISITION | calibration | OIIIC | 6 | GS-2019A-FT-109 |
| ganymede | GMOS-S | OBJECT | science | open | 49 | GS-2019A-FT-109, GS-2021B-Q-231 |
| ganymede | GNIRS | ACQUISITION | calibration | H | 2 | GN-2018A-Q-221 |
| ganymede | GNIRS | ACQUISITION | calibration | H2 | 4 | GN-2018A-Q-221 |
| ganymede | NIRI | ACQUISITION | calibration | CH4(long) | 5 | GN-2020A-Q-113, GN-2020B-Q-120 |
| ganymede | NIRI | ACQUISITION | calibration | H | 12 | GN-2017A-Q-60, GN-2018A-Q-202, GN-2019A-Q-202, GN-2020A-Q-203 |
| ganymede | NIRI | ACQUISITION | calibration | M(prime) | 2 | GN-2017A-Q-60 |
| ganymede | NIRI | OBJECT | science | J | 18 | GN-2015B-FT-12 |
| io | GMOS-S | ACQUISITION | calibration | g | 4 | GS-2021B-Q-231 |
| io | GMOS-S | ACQUISITION | calibration | OIII | 8 | GS-2021B-Q-231 |
| io | GMOS-S | OBJECT | science | open | 40 | GS-2021B-Q-231 |
| io | GNIRS | ACQUISITION | calibration | H | 13 | GN-2018A-Q-221, GN-2020A-Q-315, GN-2021A-Q-118, GN-2022A-Q-311 |
| io | GNIRS | ACQUISITION | calibration | H2 | 17 | GN-2018A-Q-221, GN-2020A-Q-315, GN-2022A-Q-311 |
| io | Hokupaa+QUIRC | OBJECT | science | Kp | 7 | GN-2001B-C-3 |
| io | IGRINS | OBJECT | science | none | 6 | GS-2021B-Q-231 |
| io | NIFS | ACQUISITION | calibration | JH | 9 | GN-2011B-Q-76 |
| io | NIFS | OBJECT | science | HK | 12 | GN-2011B-Q-76 |
| io | NIFS | OBJECT | science | JH | 12 | GN-2011B-Q-76 |
| io | NIRI | ACQUISITION | calibration | none | 7 | GN-2021B-Q-110 |
| io | NIRI | ACQUISITION | calibration | Br(gamma) | 35 | GN-2007A-Q-16, GN-2010B-Q-83, GN-2011B-Q-88 |
| io | NIRI | ACQUISITION | calibration | CH4(long) | 37 | GN-2007A-Q-16, GN-2010B-Q-83, GN-2020A-Q-113, GN-2020B-Q-120, GN-2021A-Q-125 |
| io | NIRI | ACQUISITION | calibration | H | 58 | GN-2017A-Q-60, GN-2018A-Q-202, GN-2019A-Q-202, GN-2019A-Q-304, GN-2020A-Q-203, GN-2020B-Q-101, GN-2021B-Q-110, GN-2022B-Q-106 |
| io | NIRI | ACQUISITION | calibration | hydrocarb | 9 | GN-2007A-Q-16 |
| io | NIRI | ACQUISITION | calibration | Jcon(112) | 6 | GN-2007A-Q-16 |
| io | NIRI | ACQUISITION | calibration | Jcon(121) | 9 | GN-2010B-Q-83 |
| io | NIRI | ACQUISITION | calibration | L(prime) | 863 | GN-2010B-Q-83, GN-2013B-DD-3, GN-2014A-Q-34, GN-2016A-Q-34, GN-2016B-Q-5, GN-2017A-Q-53, GN-2018A-Q-124, GN-2019A-Q-130, GN-2021A-FT-110, GN-2021B-FT-209, GN-2022A-Q-229 |
| io | NIRI | ACQUISITION | calibration | M(prime) | 54 | GN-2010B-Q-83, GN-2016B-FT-18, GN-2016B-FT-29, GN-2018A-Q-202, GN-2019A-Q-202, GN-2020B-Q-101 |
| io | NIRI | OBJECT | science | Br(gamma) | 141 | GN-2007A-Q-16, GN-2010B-Q-83, GN-2011B-Q-88 |
| io | NIRI | OBJECT | science | CH4(long) | 124 | GN-2007A-Q-16, GN-2010B-Q-83 |
| io | NIRI | OBJECT | science | H2O_ice | 65 | GN-2016A-Q-33 |
| io | NIRI | OBJECT | science | hydrocarb | 96 | GN-2007A-Q-16, GN-2016A-Q-33 |
| io | NIRI | OBJECT | science | Jcon(112) | 42 | GN-2007A-Q-16 |
| io | NIRI | OBJECT | science | Jcon(121) | 92 | GN-2010B-Q-83 |
| io | NIRI | OBJECT | science | Kcon(227) | 2735 | GN-2013B-DD-3, GN-2014A-Q-34, GN-2016A-Q-34, GN-2016B-Q-5, GN-2017A-Q-53, GN-2018A-Q-124, GN-2019A-Q-130, GN-2021A-FT-110, GN-2021B-FT-209, GN-2022A-Q-229 |
| io | NIRI | OBJECT | science | L(prime) | 3174 | GN-2010B-Q-83, GN-2013B-DD-3, GN-2014A-Q-34, GN-2016A-Q-33, GN-2016A-Q-34, GN-2016B-Q-5, GN-2017A-Q-53, GN-2018A-Q-124, GN-2019A-Q-130, GN-2021A-FT-110, GN-2021B-FT-209, GN-2022A-Q-229 |
| io | NIRI | OBJECT | science | M(prime) | 72 | GN-2010B-Q-83 |
## cssEarth objects Gemini observed
Science frames and acquisition frames counted apart, because an acquisition frame is a pointing exposure and never an
observation. A body whose only Gemini frames are acquisitions has no Gemini observation at all.
| object | science frames | acquisition frames | programmes | instruments |
|---|---|---|---|---|
| jupiter | 28630 | 227 | 46 | F2, GMOS-S, GNIRS, GSAOI, NIRI, PHOENIX, TEXES, TReCS |
| io | 6620 | 1129 | 35 | GMOS-S, GNIRS, Hokupaa+QUIRC, IGRINS, NIFS, NIRI |
| titan | 6422 | 1047 | 43 | GNIRS, GPI, Hokupaa+QUIRC, NICI, NIFS, NIRI |
| uranus | 4268 | 628 | 26 | Alopeke, F2, GNIRS, IGRINS, NIFS, NIRI, PHOENIX, TEXES, Zorro |
| pluto | 1391 | 62 | 19 | GMOS-N, GMOS-S, GNIRS, Hokupaa+QUIRC, NICI, NIFS, NIRI, PHOENIX, Zorro |
| saturn | 1295 | 93 | 7 | GNIRS, PHOENIX, TEXES |
| didymos | 1032 | 0 | 3 | GMOS-N |
| quaoar | 667 | 2 | 2 | NIFS, NIRI |
| sedna | 626 | 79 | 4 | GMOS-N, NIRI |
| wasp-43b | 556 | 11 | 3 | F2, IGRINS |
| m1 | 527 | 47 | 8 | GHOST, GMOS-N, GMOS-S, GNIRS, GRACES, GSAOI, NIRI, PHOENIX, michelle |
| neptune | 396 | 70 | 10 | Alopeke, GPI, GSAOI, NIFS, NIRI, TEXES, TReCS, michelle |
| europa | 340 | 146 | 20 | GNIRS, GPI, NIFS, NIRI, TEXES |
| gyptis | 337 | 62 | 1 | GNIRS |
| betelgeuse | 335 | 7 | 4 | Alopeke, NICI |
| hd-189733 | 325 | 0 | 1 | IGRINS-2 |
| themis | 280 | 54 | 2 | GMOS-N, GNIRS |
| iapetus | 249 | 0 | 1 | NIRI |
| triton | 240 | 17 | 4 | GNIRS, NIRI, PHOENIX |
| psyche | 236 | 101 | 5 | NIRI, michelle |
| hestia | 186 | 3 | 1 | NIRI |
| hyperion | 159 | 0 | 1 | NIRI |
| ymir | 121 | 0 | 3 | GMOS-N, NIRI |
| ceres | 116 | 3 | 15 | GMOS-N, GMOS-S, GNIRS, GPI, GRACES, TEXES |
| mars | 109 | 0 | 6 | F2, GMOS-N, GMOS-S, GNIRS, NIRI, PHOENIX |
| callisto | 108 | 12 | 3 | NIFS, NIRI |
| patroclus | 105 | 11 | 3 | GMOS-S, NIRI, Zorro |
| m8 | 105 | 0 | 1 | GMOS-S |
| eros | 104 | 0 | 1 | Zorro |
| hermione | 97 | 51 | 3 | NIRI |
| m33 | 81 | 69 | 3 | GMOS-N, NIFS |
| lmc | 78 | 49 | 6 | GHOST, GMOS-S, GSAOI |
| elektra | 75 | 36 | 2 | NIRI |
| phocaea | 73 | 0 | 1 | Hokupaa+QUIRC |
| wasp-43 | 73 | 0 | 1 | IGRINS |
| sylvia | 68 | 40 | 4 | NIRI, michelle |
| ganymede | 67 | 65 | 10 | GMOS-S, GNIRS, NIRI |
| charon | 66 | 52 | 2 | NIRI |
| miranda | 64 | 53 | 2 | GNIRS |
| salacia | 60 | 0 | 3 | NIRI |
| emma | 58 | 29 | 3 | NIRI, michelle |
| hd-181327 | 58 | 0 | 2 | GPI, TReCS |
| pallas | 54 | 10 | 9 | GMOS-N, GPI, GRACES, TEXES |
| ixion | 53 | 0 | 2 | NIRI |
| vesta | 52 | 17 | 7 | GMOS-N, GRACES, GSAOI, MAROON-X, michelle |
| apophis | 50 | 19 | 1 | GNIRS |
| phoebe | 49 | 0 | 2 | NIRI |
| palma | 48 | 11 | 1 | GNIRS |
| phaethon | 48 | 0 | 1 | GMOS-N |
| camilla | 47 | 14 | 2 | NIRI |
| paaliaq | 47 | 0 | 1 | NIRI |
| sycorax | 47 | 0 | 1 | NIRI |
| huya | 42 | 0 | 2 | NIRI |
| m42 | 42 | 0 | 1 | Alopeke |
| m31 | 38 | 24 | 3 | GMOS-N, Hokupaa+QUIRC |
| himalia | 34 | 0 | 2 | GMOS-N, NIRI |
| dinkinesh | 33 | 35 | 1 | F2 |
| daphne | 31 | 10 | 1 | NIRI |
| eugenia | 31 | 8 | 1 | NIRI |
| albiorix | 31 | 0 | 2 | GMOS-N, NIRI |
37 further objects have fewer frames.
## Every instrument in the public collection
| instrument | public frames | of which science |
|---|---|---|
| GMOS-N | 1041973 | 156129 |
| GMOS-S | 964173 | 146963 |
| NIRI | 937721 | 406596 |
| GNIRS | 607102 | 112642 |
| F2 | 270242 | 130955 |
| NIFS | 130945 | 29136 |
| MAROON-X | 112622 | 8880 |
| PHOENIX | 112525 | 74202 |
| hrwfs | 108562 | 103893 |
| GPI | 94894 | 51644 |
| Alopeke | 64694 | 64656 |
| Zorro | 62179 | 62173 |
| NICI | 60593 | 44262 |
| GSAOI | 50486 | 13761 |
| IGRINS | 43058 | 21609 |
| Hokupaa+QUIRC | 39713 | 37611 |
| GRACES | 35024 | 19177 |
| IGRINS-2 | 34726 | 5915 |
| TReCS | 25164 | 12959 |
| michelle | 23174 | 4753 |
| GHOST | 19784 | 9807 |
| FLAMINGOS | 17035 | 12090 |
| TEXES | 3055 | 1739 |
| CIRPASS | 2092 | 620 |
| bHROS | 1571 | 401 |
| OSCIR | 566 | 436 |
| GMOS | 89 | 89 |
## Receipts that could not be accepted
None. Every receipt beside a pinned program parses, names that program, and is backed by a product record.
