# Spitzer archive ledger

What the Spitzer Heritage Archive at IRSA holds for the 519 objects this repository ships, what this toolkit can re-make, and how far that is proved. Written by [`archive-ledger.mts`](../tools/objects/spitzer/archive-ledger.mts) from IRSA on 2026-09-19; the route it checks is [Spitzer](spitzer.md).

## What Spitzer observed, by mode

Counts are observations of this repository's objects, not of the archive. "Re-made by" is the stage here that produces that mode's level-2 product; "checked" counts products that carry a reproduction receipt naming the exact observation.

| Mode | Records | Observations of our objects | Re-made by | Channels pinned | Products checked |
| --- | --- | --- | --- | --- | --- |
| IRAC Map PC | pictures held on one pointing, the mode exoplanet transits were watched in | 4372 | none | 0 | 0 |
| MIPS Phot | photometry at 24, 70 and 160 micron | 318 | none | 0 | 0 |
| IRAC Map | mapped pictures in the four IRAC channels, 3.6 to 8.0 micron | 317 | `tools/objects/spitzer/mosaic.mts` | 4 | 4 |
| IRS Stare | spectra of one point, 5 to 38 micron | 312 | none | 0 | 0 |
| IRS Map | spectra stepped across a target, which build a spectral cube | 165 | none | 0 | 0 |
| MIPS SED | low-resolution spectra around 70 micron | 38 | none | 0 | 0 |
| IRS Peakup Image | a small picture taken to put the target in the slit | 32 | none | 0 | 0 |
| IRAC IER | pictures taken on an engineering request rather than a normal observation | 31 | none | 0 | 0 |
| MIPS Scan | large maps made by scanning the telescope | 25 | none | 0 | 0 |
| MIPS IER | MIPS data taken on an engineering request | 9 | none | 0 | 0 |
| MIPS TP | total-power measurements | 7 | none | 0 | 0 |
| IRS IER | spectra taken on an engineering request | 3 | none | 0 | 0 |
| IRAC Post-Cryo Map | mapped pictures in the two channels that kept working after the cryogen ran out | 0 | none | 0 | 0 |

- **IRAC Map PC**: The archive mosaics these too, so the same stage would run; none is pinned here.
- **MIPS Phot**: The archive mosaics these; this toolkit has not been run on MIPS and does not claim it.
- **IRS Stare**: Needs the observatory's SPICE, which was not obtained or run here.
- **IRS Map**: Needs CUBISM, which was not obtained or run here.
- **IRAC Post-Cryo Map**: The same stage would run; none is pinned here.

## Which of our objects Spitzer observed

460 objects could be asked for; 174 of them have Spitzer observations.

| Object | What it is | Asked as | Observations | Modes |
| --- | --- | --- | --- | --- |
| m42 | extended | 83.78715, -5.40038 within 10.0 arcmin | 734 | IRAC IER 1, IRAC Map 22, IRAC Map PC 555, IRS Map 7, IRS Stare 146, MIPS Phot 1, MIPS Scan 2 |
| TRAPPIST-1 | star | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1b | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1c | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1d | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1e | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1f | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1g | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| TRAPPIST-1h | exoplanet | 346.62652, -5.04353 within 0.5 arcmin | 419 | IRAC Map PC 418, MIPS Phot 1 |
| Pluto | dwarf-planet | NAIF 999 | 157 | IRAC Map 9, IRAC Map PC 95, IRS Stare 16, MIPS Phot 34, MIPS SED 3 |
| HD 189733 A | star | 300.18212, 22.70974 within 0.5 arcmin | 105 | IRAC IER 10, IRAC Map 8, IRAC Map PC 40, IRS IER 1, IRS Map 22, IRS Peakup Image 1, IRS Stare 5, MIPS Phot 16, MIPS Scan 2 |
| HD 189733 B | star | 300.17902, 22.70837 within 0.5 arcmin | 105 | IRAC IER 10, IRAC Map 8, IRAC Map PC 40, IRS IER 1, IRS Map 22, IRS Peakup Image 1, IRS Stare 5, MIPS Phot 16, MIPS Scan 2 |
| HD 189733b | exoplanet | 300.18212, 22.70974 within 0.5 arcmin | 105 | IRAC IER 10, IRAC Map 8, IRAC Map PC 40, IRS IER 1, IRS Map 22, IRS Peakup Image 1, IRS Stare 5, MIPS Phot 16, MIPS Scan 2 |
| m8 | extended | 270.76532, -24.30623 within 10.0 arcmin | 62 | IRAC Map 11, IRAC Map PC 37, MIPS IER 9, MIPS Phot 2, MIPS SED 1, MIPS Scan 2 |
| Lutetia | asteroid | NAIF 2000021 | 42 | IRAC Map 24, IRS Map 2, IRS Stare 14, MIPS Phot 2 |
| Isis | asteroid | NAIF 2000042 | 39 | IRAC Map 25, MIPS Phot 13, MIPS SED 1 |
| Neptune | planet | NAIF 899 | 37 | IRAC Map PC 6, IRS Map 13, IRS Stare 14, MIPS SED 4 |
| Quaoar | trans-neptunian | NAIF 2050000 | 34 | IRAC Map 2, IRAC Map PC 16, IRS Stare 1, MIPS Phot 14, MIPS SED 1 |
| Bennu | asteroid | NAIF 2101955 | 26 | IRAC Map 11, IRAC Map PC 1, IRS Peakup Image 12, IRS Stare 2 |
| Eris | dwarf-planet | NAIF 2136199 | 26 | IRAC Map 2, IRAC Map PC 16, MIPS Phot 8 |
| Hesperia | asteroid | NAIF 2000069 | 26 | IRAC Map 25, IRS Map 1 |
| 85 Io | asteroid | NAIF 2000085 | 26 | IRAC Map 24, MIPS Phot 2 |
| Minerva | asteroid | NAIF 2000093 | 26 | IRAC Map 24, MIPS Phot 2 |
| Hidalgo | asteroid | NAIF 2000944 | 21 | IRS Map 1, IRS Peakup Image 10, IRS Stare 10 |
| m45 | extended | 56.75000, 24.11670 within 10.0 arcmin | 20 | IRAC Map 6, IRAC Map PC 5, IRS Map 1, IRS Stare 2, MIPS Phot 4, MIPS Scan 2 |
| WASP-43 | star | 154.90837, -9.80628 within 0.5 arcmin | 19 | IRAC Map PC 19 |
| WASP-43b | exoplanet | 154.90837, -9.80628 within 0.5 arcmin | 19 | IRAC Map PC 19 |
| Makemake | dwarf-planet | NAIF 2136472 | 18 | IRAC Map 2, IRAC Map PC 16 |
| 9 Metis | asteroid | NAIF 2000009 | 18 | IRAC Map 16, MIPS Phot 2 |
| Titan | satellite | NAIF 606 | 18 | IRS Map 13, IRS Stare 4, MIPS Phot 1 |
| Ryugu | asteroid | NAIF 2162173 | 17 | IRAC Map PC 15, IRS Map 2 |
| Massalia | asteroid | NAIF 2000020 | 16 | IRAC Map 1, MIPS Phot 12, MIPS SED 3 |
| Victoria | asteroid | NAIF 2000012 | 16 | IRS Map 1, MIPS Phot 12, MIPS SED 3 |
| Steins | asteroid | NAIF 2002867 | 15 | IRS Stare 15 |
| Uranus | planet | NAIF 799 | 14 | IRS Map 1, IRS Stare 13 |
| Eros | asteroid | NAIF 2000433 | 13 | IRAC Map 2, IRAC Map PC 1, IRS Map 1, IRS Peakup Image 1, MIPS Phot 7, MIPS SED 1 |
| helix | extended | 337.41071, -20.83717 within 10.0 arcmin | 13 | IRAC Map 5, IRAC Map PC 1, IRS Stare 4, MIPS Scan 3 |
| Harmonia | asteroid | NAIF 2000040 | 12 | MIPS Phot 9, MIPS SED 3 |
| Oberon | satellite | NAIF 704 | 12 | IRAC Map 2, IRAC Map PC 4, IRS Stare 2, MIPS Phot 1, MIPS SED 1, MIPS TP 2 |
| Titania | satellite | NAIF 703 | 12 | IRAC Map 2, IRAC Map PC 4, IRS Stare 2, MIPS Phot 2, MIPS SED 2 |
| m1 | extended | 83.63345, 22.01512 within 10.0 arcmin | 11 | IRAC Map 2, IRAC Map PC 1, IRS Stare 7, MIPS Phot 1 |
| HD 181327 | star | 290.74579, -54.53841 within 0.5 arcmin | 10 | IRAC Map 2, IRAC Map PC 4, IRS Stare 1, MIPS Phot 2, MIPS SED 1 |
| Melpomene | asteroid | NAIF 2000018 | 10 | IRAC Map 1, MIPS Phot 6, MIPS SED 1, MIPS Scan 1, MIPS TP 1 |
| Varuna | trans-neptunian | NAIF 2020000 | 10 | IRAC Map 2, IRAC Map PC 1, IRS Stare 1, MIPS Phot 6 |
| Ariel | satellite | NAIF 701 | 9 | IRAC Map 2, IRAC Map PC 4, IRS Stare 3 |
| Donaldjohanson | asteroid | NAIF 2052246 | 9 | IRAC Map PC 9 |
| Itokawa | asteroid | NAIF 2025143 | 9 | IRAC Map PC 1, IRS Peakup Image 1, IRS Stare 7 |
| Jupiter | planet | NAIF 599 | 9 | IRAC Map PC 7, IRS Map 2 |
| Leucus | asteroid | NAIF 2011351 | 9 | IRAC Map PC 9 |
| Thalia | asteroid | NAIF 2000023 | 9 | IRAC Map 2, MIPS Phot 6, MIPS SED 1 |
| Phoebe | satellite | NAIF 609 | 8 | IRAC Map 2, IRS Stare 2, MIPS Phot 2, MIPS SED 2 |
| Rhea | satellite | NAIF 605 | 8 | IRAC Map 2, IRS Stare 2, MIPS TP 4 |
| Salacia | trans-neptunian | NAIF 2120347 | 8 | IRAC Map PC 6, MIPS Phot 2 |
| Triton | satellite | NAIF 801 | 8 | IRAC Map 4, IRS Map 4 |
| Umbriel | satellite | NAIF 702 | 8 | IRAC Map 2, IRAC Map PC 4, IRS Stare 2 |
| 2002 TC302 | trans-neptunian | NAIF 2084522 | 7 | IRAC Map 4, IRS Stare 1, MIPS Phot 2 |
| 2003 VS2 | trans-neptunian | NAIF 2084922 | 7 | IRAC Map 4, IRS Stare 1, MIPS Phot 2 |
| Echo | asteroid | NAIF 2000060 | 7 | MIPS Phot 6, MIPS SED 1 |
| Orcus | trans-neptunian | NAIF 2090482 | 7 | IRAC Map 2, IRS Stare 1, MIPS Phot 4 |
| Bacchus | asteroid | NAIF 2002063 | 6 | IRAC Map PC 5, IRS Stare 1 |
| Chariklo | asteroid | NAIF 2010199 | 6 | IRAC Map 2, IRS Stare 1, MIPS Phot 2, MIPS SED 1 |
| Cybele | asteroid | NAIF 2000065 | 6 | IRS Map 2, MIPS Phot 4 |
| Haumea | dwarf-planet | NAIF 2136108 | 6 | IRAC Map 2, IRAC Map PC 1, MIPS Phot 3 |
| Huya | trans-neptunian | NAIF 2038628 | 6 | IRAC Map 2, IRAC Map PC 1, MIPS Phot 3 |
| Iris | asteroid | NAIF 2000007 | 6 | IRAC Map 1, IRS Map 1, MIPS Phot 3, MIPS SED 1 |
| 2002 TX300 | trans-neptunian | NAIF 2055636 | 5 | IRAC Map 2, IRS Stare 1, MIPS Phot 2 |
| Fortuna | asteroid | NAIF 2000019 | 5 | IRAC Map 2, IRS Map 1, MIPS Phot 1, MIPS SED 1 |
| Hebe | asteroid | NAIF 2000006 | 5 | IRAC Map 1, MIPS Phot 4 |
| Iapetus | satellite | NAIF 608 | 5 | IRAC Map 1, IRS Stare 2, MIPS Phot 1, MIPS SED 1 |
| Ixion | trans-neptunian | NAIF 2028978 | 5 | IRAC Map 2, IRS Stare 1, MIPS Phot 2 |
| R Doradus | star | 69.18996, -62.07717 within 0.5 arcmin | 5 | MIPS Scan 5 |
| Saturn | planet | NAIF 699 | 5 | IRAC Map 1, MIPS Scan 4 |
| YORP | asteroid | NAIF 2054509 | 5 | IRAC Map 1, IRAC Map PC 1, IRS Peakup Image 2, IRS Stare 1 |
| Achlys | trans-neptunian | NAIF 2208996 | 4 | IRAC Map PC 4 |
| Enceladus | satellite | NAIF 602 | 4 | IRAC Map 3, IRS Map 1 |
| Eurybates | asteroid | NAIF 2003548 | 4 | IRAC Map 2, IRAC Map PC 1, IRS Stare 1 |
| Gǃkúnǁʼhòmdímà | trans-neptunian | NAIF 2229762 | 4 | IRAC Map PC 4 |
| Gonggong | trans-neptunian | NAIF 2225088 | 4 | IRAC Map PC 4 |
| Himalia | satellite | NAIF 506 | 4 | IRS Stare 2, MIPS Phot 2 |
| Juno | asteroid | NAIF 2000003 | 4 | MIPS Phot 3, MIPS SED 1 |
| Máni | trans-neptunian | NAIF 2307261 | 4 | IRAC Map PC 4 |
| Peitho | asteroid | NAIF 2000118 | 4 | MIPS Phot 4 |
| Polaris | star | 37.95456, 89.26411 within 0.5 arcmin | 4 | IRAC Map 2, IRS Stare 1, MIPS Phot 1 |
| Taurinensis | asteroid | NAIF 2000512 | 4 | MIPS Phot 3, MIPS SED 1 |
| Varda | trans-neptunian | NAIF 2174567 | 4 | IRAC Map PC 4 |
| Achilles | asteroid | NAIF 2000588 | 3 | IRAC Map 2, IRS Stare 1 |
| Ariadne | asteroid | NAIF 2000043 | 3 | MIPS Phot 3 |
| Bienor | asteroid | NAIF 2054598 | 3 | IRAC Map 2, MIPS Phot 1 |
| Camilla | asteroid | NAIF 2000107 | 3 | IRS Map 3 |
| Daphne | asteroid | NAIF 2000041 | 3 | IRAC Map 1, MIPS Phot 2 |
| Diomedes | asteroid | NAIF 2001437 | 3 | IRAC Map 2, IRS Stare 1 |
| Emma | asteroid | NAIF 2000283 | 3 | IRS Map 3 |
| Eugenia | asteroid | NAIF 2000045 | 3 | IRS Map 3 |
| Geographos | asteroid | NAIF 2001620 | 3 | IRAC Map PC 2, IRS Stare 1 |
| Hektor | asteroid | NAIF 2000624 | 3 | IRAC Map 2, IRS Map 1 |
| Hermione | asteroid | NAIF 2000121 | 3 | IRS Map 3 |
| Nysa | asteroid | NAIF 2000044 | 3 | MIPS Phot 3 |
| Phocaea | asteroid | NAIF 2000025 | 3 | MIPS Phot 2, MIPS SED 1 |
| Proserpina | asteroid | NAIF 2000026 | 3 | IRAC Map 3 |
| Sappho | asteroid | NAIF 2000080 | 3 | MIPS Phot 2, MIPS SED 1 |
| Tethys | satellite | NAIF 603 | 3 | IRAC Map 2, MIPS Phot 1 |
| Aglaja | asteroid | NAIF 2000047 | 2 | MIPS Phot 2 |
| Albiorix | satellite | NAIF 626 | 2 | MIPS Phot 2 |
| Antigone | asteroid | NAIF 2000129 | 2 | IRS Map 2 |
| 1994 CC Alpha | asteroid | NAIF 2136617 | 2 | IRAC Map PC 2 |
| Athor | asteroid | NAIF 2000161 | 2 | IRS Map 2 |
| Ausonia | asteroid | NAIF 2000063 | 2 | MIPS Phot 2 |
| Beatrix | asteroid | NAIF 2000083 | 2 | MIPS Phot 2 |
| Bellona | asteroid | NAIF 2000028 | 2 | MIPS Phot 2 |
| Betulia | asteroid | NAIF 2001580 | 2 | IRAC Map PC 1, IRS Stare 1 |
| Castalia | asteroid | NAIF 2004769 | 2 | IRAC Map PC 2 |
| Ceres | dwarf-planet | NAIF 2000001 | 2 | MIPS Phot 2 |
| Dejopeja | asteroid | NAIF 2000184 | 2 | IRS Map 2 |
| Elektra | asteroid | NAIF 2000130 | 2 | IRS Map 2 |
| Eleonora | asteroid | NAIF 2000354 | 2 | MIPS Phot 2 |
| Erriapus | satellite | NAIF 628 | 2 | MIPS Phot 2 |
| Eurynome | asteroid | NAIF 2000079 | 2 | MIPS Phot 1, MIPS SED 1 |
| Gaspra | asteroid | NAIF 2000951 | 2 | IRS Peakup Image 1, IRS Stare 1 |
| Hyperion | satellite | NAIF 607 | 2 | IRAC Map 1, IRS Stare 1 |
| Ida | asteroid | NAIF 2000243 | 2 | IRS Peakup Image 1, IRS Stare 1 |
| Ijiraq | satellite | NAIF 622 | 2 | MIPS Phot 2 |
| Interamnia | asteroid | NAIF 2000704 | 2 | IRS Map 2 |
| Kalliope | asteroid | NAIF 2000022 | 2 | IRS Map 2 |
| Kiviuq | satellite | NAIF 624 | 2 | MIPS Phot 2 |
| Kleopatra | asteroid | NAIF 2000216 | 2 | IRS Map 2 |
| Liberatrix | asteroid | NAIF 2000125 | 2 | IRS Map 2 |
| Lydia | asteroid | NAIF 2000110 | 2 | IRS Map 2 |
| m2-9 | extended | 256.40796, -10.14255 within 10.0 arcmin | 2 | IRAC Map 1, IRS Stare 1 |
| Mathilde | asteroid | NAIF 2000253 | 2 | IRS Peakup Image 1, IRS Stare 1 |
| Melete | asteroid | NAIF 2000056 | 2 | MIPS Phot 2 |
| Nemausa | asteroid | NAIF 2000051 | 2 | MIPS Phot 2 |
| Nereus | asteroid | NAIF 2004660 | 2 | IRAC Map PC 1, IRS Stare 1 |
| Paaliaq | satellite | NAIF 620 | 2 | MIPS Phot 2 |
| 55 Pandora | asteroid | NAIF 2000055 | 2 | IRS Map 2 |
| Penelope | asteroid | NAIF 2000201 | 2 | IRS Map 2 |
| Phaethon | asteroid | NAIF 2003200 | 2 | IRS Stare 1, MIPS Phot 1 |
| Psyche | asteroid | NAIF 2000016 | 2 | IRS Map 2 |
| Sedna | trans-neptunian | NAIF 2090377 | 2 | IRAC Map 2 |
| Siarnaq | satellite | NAIF 629 | 2 | MIPS Phot 2 |
| Sycorax | satellite | NAIF 717 | 2 | MIPS Phot 2 |
| Sylvia | asteroid | NAIF 2000087 | 2 | IRS Map 2 |
| Tarvos | satellite | NAIF 621 | 2 | MIPS Phot 2 |
| Themis | asteroid | NAIF 2000024 | 2 | IRS Map 2 |
| Thetis | asteroid | NAIF 2000017 | 2 | MIPS Phot 2 |
| Toro | asteroid | NAIF 2001685 | 2 | IRAC Map PC 1, IRS Stare 1 |
| Velleda | asteroid | NAIF 2000126 | 2 | MIPS Phot 2 |
| Ymir | satellite | NAIF 619 | 2 | MIPS Phot 2 |
| Apophis | asteroid | NAIF 2099942 | 1 | IRAC Map PC 1 |
| Asia | asteroid | NAIF 2000067 | 1 | MIPS Phot 1 |
| 1950 DA | asteroid | NAIF 2029075 | 1 | IRAC Map PC 1 |
| 1992 SK | asteroid | NAIF 2010115 | 1 | IRAC Map PC 1 |
| 1996 HW1 | asteroid | NAIF 2008567 | 1 | IRAC Map PC 1 |
| 1998 ML14 | asteroid | NAIF 2052760 | 1 | IRAC Map PC 1 |
| 1998 WT24 | asteroid | NAIF 2033342 | 1 | IRAC Map PC 1 |
| 2001 SN263 | asteroid | NAIF 2153591 | 1 | IRAC Map PC 1 |
| Astraea | asteroid | NAIF 2000005 | 1 | IRAC Map 1 |
| Aurora | asteroid | NAIF 2000094 | 1 | IRAC Map 1 |
| Cerberus | asteroid | NAIF 2001865 | 1 | IRAC Map PC 1 |
| Davida | asteroid | NAIF 2000511 | 1 | IRS Map 1 |
| Dione | satellite | NAIF 604 | 1 | IRS Map 1 |
| Doris | asteroid | NAIF 2000048 | 1 | IRAC Map 1 |
| Euphrosyne | asteroid | NAIF 2000031 | 1 | IRAC Map 1 |
| Fides | asteroid | NAIF 2000037 | 1 | IRAC Map 1 |
| Ganymed | asteroid | NAIF 2001036 | 1 | IRAC Map PC 1 |
| Hertha | asteroid | NAIF 2000135 | 1 | IRS Map 1 |
| Ivar | asteroid | NAIF 2001627 | 1 | IRAC Map PC 1 |
| Lucia | asteroid | NAIF 2000222 | 1 | IRS Stare 1 |
| Nereid | satellite | NAIF 802 | 1 | MIPS Phot 1 |
| Orus | asteroid | NAIF 2021900 | 1 | IRAC Map PC 1 |
| Polymele | asteroid | NAIF 2015094 | 1 | IRAC Map PC 1 |
| Ra-Shalom | asteroid | NAIF 2002100 | 1 | IRAC Map PC 1 |
| Siwa | asteroid | NAIF 2000140 | 1 | IRS Map 1 |
| Tantalus | asteroid | NAIF 2002102 | 1 | IRAC Map PC 1 |
| Unitas | asteroid | NAIF 2000306 | 1 | MIPS Phot 1 |

## The Galilean moons

Spitzer has no observation of Io, Europa, Ganymede or Callisto in this archive. Each was asked for by its own NAIF id (501, 502, 503, 504) and the archive returned no observation request for any of them, and none for Jupiter itself (599) either. That is a measured answer and not an untried one: the same search, in the same pass, returned 157 for Pluto, 42 for Lutetia, 39 for Isis, so it works and the holding is empty. Europa is this repository's showcase body and Spitzer contributes nothing to it.

## What this ledger does not say

- It does not say what Spitzer holds in total. The archive's search backend answers one target at a time and takes no whole-archive count, so every number here is about this repository's objects.
- The JSON ledger retains every returned AORKEY, programme, mode, title, start and end time. The table above groups those same records for reading; the capability query exposes the records for one requested target.
- A moving body is found only if its observation was scheduled against that NAIF id. An observation that caught a body inside a fixed-target field is not counted, because the archive does not index it that way.
- 59 objects were not asked for at all. Most are comets and interstellar objects, whose packages carry a Horizons designation rather than a NAIF id; the rest have neither a body record nor a sky position. They are gaps, not zeroes.

- The archive would not answer for antares, betelgeuse, ce-tauri, pi1-gruis in this pass, after three attempts each. Those objects are missing from the table above, not empty.
