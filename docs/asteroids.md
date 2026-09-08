# Exceptional asteroid coverage

This addition selects 65 bodies from the [list of exceptional asteroids](https://en.wikipedia.org/wiki/List_of_exceptional_asteroids) for which original calibrated shape models and source-specific orientation evidence could be pinned. Per-body source notes below identify the exact model, authors, frame, reduction error, limitations and restoration path. The list is a discovery index; the underlying research and original data supply the physical properties.

The [validation record](asteroids-validation.md) includes browser examples, fresh-install evidence, measured drag traces and the remaining aggregate-check limitations.

Every body uses the existing generic object package, shared application shell and Solar System asteroid accordion. All additions have Shape; 64 also have Elevation. Donaldjohanson withholds radial Elevation because its source mesh has overlapping surfaces on some rays. Shape uses the shared missing-imagery grid: no surface texture, reflectance, composition or regolith is invented. Elevation is source radius minus the documented reference sphere, not an independent terrain measurement or height above an equipotential. Single-axis spin solutions use an arbitrary display meridian. The tumbling Apophis and Donaldjohanson packages use the established fixed illustrative display frame.

The existing meshoptimizer preparation path reduces the original connected meshes while preserving their closed topology. Every result has 800 native PolyCSS u raster leaves and 128 by 128 px cells. The twelve DAMIT models already containing 800 triangles require no edge collapse. All geometry, surface texels and directional/flood lighting are prepared ahead of runtime. Both DPRs select the same highest-density asset bank.

52 Europa, 9 Metis and 666 Desdemona retain their asteroid numbers in display names to distinguish them from the moons Europa, Metis and Desdemona. Their route IDs are europa-52, metis-9 and desdemona-666. The 1994 CC package explicitly displays Alpha alone; its two satellites are not included. Castalia retains the published northern spin solution and documents the unresolved alternative.

| Number | Body and provenance | Selected source family | Reference diameter (km) | Period (h) |
| --- | --- | --- | ---: | ---: |
| 2 | [Pallas](../src/planets/pallas/SOURCE.md) | VLT/SPHERE MPCD | 511 | 7.81321 |
| 10 | [Hygiea](../src/planets/hygiea/SOURCE.md) | VLT/SPHERE MPCD | 433 | 13.82559 |
| 3 | [Juno](../src/planets/juno/SOURCE.md) | VLT/SPHERE MPCD | 254 | 7.209531 |
| 16 | [Psyche](../src/planets/psyche/SOURCE.md) | VLT/SPHERE MPCD | 223 | 4.195948 |
| 704 | [Interamnia](../src/planets/interamnia/SOURCE.md) | VLT/SPHERE MPCD | 332 | 8.71234 |
| 511 | [Davida](../src/planets/davida/SOURCE.md) | VLT/SPHERE MPCD | 298 | 5.129365 |
| 87 | [Sylvia](../src/planets/sylvia/SOURCE.md) | VLT/SPHERE MPCD | 274 | 5.18364 |
| 15 | [Eunomia](../src/planets/eunomia/SOURCE.md) | VLT/SPHERE MPCD | 270 | 6.082753 |
| 31 | [Euphrosyne](../src/planets/euphrosyne/SOURCE.md) | VLT/SPHERE MPCD | 268 | 5.529595 |
| 324 | [Bamberga](../src/planets/bamberga/SOURCE.md) | VLT/SPHERE MPCD | 227 | 29.4403 |
| 19 | [Fortuna](../src/planets/fortuna/SOURCE.md) | VLT/SPHERE MPCD | 211 | 7.443224 |
| 24 | [Themis](../src/planets/themis/SOURCE.md) | VLT/SPHERE MPCD | 208 | 8.374187 |
| 29 | [Amphitrite](../src/planets/amphitrite/SOURCE.md) | VLT/SPHERE MPCD | 204 | 5.390119 |
| 13 | [Egeria](../src/planets/egeria/SOURCE.md) | VLT/SPHERE MPCD | 202 | 7.046664 |
| 130 | [Elektra](../src/planets/elektra/SOURCE.md) | VLT/SPHERE MPCD | 199 | 5.224663 |
| 7 | [Iris](../src/planets/iris/SOURCE.md) | VLT/SPHERE MPCD | 199 | 7.138843 |
| 6 | [Hebe](../src/planets/hebe/SOURCE.md) | VLT/SPHERE MPCD | 195 | 7.274467 |
| 45 | [Eugenia](../src/planets/eugenia/SOURCE.md) | VLT/SPHERE MPCD | 188 | 5.699151 |
| 41 | [Daphne](../src/planets/daphne/SOURCE.md) | VLT/SPHERE MPCD | 187 | 5.98798 |
| 354 | [Eleonora](../src/planets/eleonora/SOURCE.md) | VLT/SPHERE MPCD | 165 | 4.277185 |
| 128 | [Nemesis](../src/planets/nemesis/SOURCE.md) | VLT/SPHERE MPCD | 163 | 38.9325 |
| 22 | [Kalliope](../src/planets/kalliope/SOURCE.md) | VLT/SPHERE MPCD | 150 | 4.1482 |
| 51 | [Nemausa](../src/planets/nemausa/SOURCE.md) | VLT/SPHERE MPCD | 150 | 7.78484 |
| 11 | [Parthenope](../src/planets/parthenope/SOURCE.md) | VLT/SPHERE MPCD | 149 | 13.72204 |
| 18 | [Melpomene](../src/planets/melpomene/SOURCE.md) | VLT/SPHERE MPCD | 141 | 11.570306 |
| 89 | [Julia](../src/planets/julia/SOURCE.md) | VLT/SPHERE MPCD | 140 | 11.388336 |
| 12 | [Victoria](../src/planets/victoria/SOURCE.md) | VLT/SPHERE MPCD | 116 | 8.660345 |
| 30 | [Urania](../src/planets/urania/SOURCE.md) | VLT/SPHERE MPCD | 88 | 13.68717 |
| 8 | [Flora](../src/planets/flora/SOURCE.md) | VLT/SPHERE MPCD | 146 | 12.86667 |
| 52 | [52 Europa](../src/planets/europa-52/SOURCE.md) | VLT/SPHERE MPCD | 319 | 5.629954 |
| 9 | [9 Metis](../src/planets/metis-9/SOURCE.md) | VLT/SPHERE MPCD | 173 | 5.079176 |
| 107 | [Camilla](../src/planets/camilla/SOURCE.md) | DAMIT | 260 | 4.843928 |
| 88 | [Thisbe](../src/planets/thisbe/SOURCE.md) | DAMIT | 218 | 6.041319 |
| 48 | [Doris](../src/planets/doris/SOURCE.md) | DAMIT | 210 | 11.8901 |
| 121 | [Hermione](../src/planets/hermione/SOURCE.md) | DAMIT | 200 | 5.550877 |
| 423 | [Diotima](../src/planets/diotima/SOURCE.md) | DAMIT | 209 | 4.775377 |
| 532 | [Herculina](../src/planets/herculina/SOURCE.md) | DAMIT | 189 | 9.404937 |
| 192 | [Nausikaa](../src/planets/nausikaa/SOURCE.md) | DAMIT | 94 | 13.62523 |
| 5 | [Astraea](../src/planets/astraea/SOURCE.md) | DAMIT | 112 | 16.80059 |
| 14 | [Irene](../src/planets/irene/SOURCE.md) | DAMIT | 153 | 15.02987 |
| 44 | [Nysa](../src/planets/nysa/SOURCE.md) | DAMIT | 75 | 6.421418 |
| 80 | [Sappho](../src/planets/sappho/SOURCE.md) | DAMIT | 61 | 14.03086 |
| 1580 | [Betulia](../src/planets/betulia/SOURCE.md) | NASA/JPL radar | 5.39 | 6.13836 |
| 4769 | [Castalia](../src/planets/castalia/SOURCE.md) | NASA/JPL radar | 1.084476 | 4.089 |
| 33342 | [1998 WT24](../src/planets/asteroid-1998-wt24/SOURCE.md) | NASA/JPL radar | 0.415 | 3.697 |
| 136617 | [1994 CC Alpha](../src/planets/asteroid-1994-cc/SOURCE.md) | NASA/JPL radar | 0.62 | 2.3886 |
| 37 | [Fides](../src/planets/fides/SOURCE.md) | DAMIT | 118 | 7.332527 |
| 201 | [Penelope](../src/planets/penelope/SOURCE.md) | DAMIT | 85 | 3.747455 |
| 925 | [Alphonsina](../src/planets/alphonsina/SOURCE.md) | DAMIT | 58 | 7.87754 |
| 64 | [Angelina](../src/planets/angelina/SOURCE.md) | DAMIT | 52 | 8.75033 |
| 1036 | [Ganymed](../src/planets/ganymed/SOURCE.md) | DAMIT | 39 | 10.31304 |
| 66391 | [Moshup](../src/planets/moshup/SOURCE.md) | NASA/JPL radar | 1.317 | 2.7645 |

| 65 | [Cybele](../src/planets/cybele/SOURCE.md) | DAMIT 1843 | 313 | 6.081435 |
| 94 | [Aurora](../src/planets/aurora/SOURCE.md) | DAMIT 1830 | 198 | 7.226189 |
| 372 | [Palma](../src/planets/palma/SOURCE.md) | DAMIT 298 | 187 | 8.58189 |
| 279 | [Thule](../src/planets/thule/SOURCE.md) | DAMIT 16313 | 116 | 23.8964 |
| 624 | [Hektor](../src/planets/hektor/SOURCE.md) | DAMIT 232 | 175 | 6.920509 |
| 100 | [Hekate](../src/planets/hekate/SOURCE.md) | DAMIT 3088 | 87 | 27.0703 |
| 3200 | [Phaethon](../src/planets/phaethon/SOURCE.md) | DAMIT 4394 | 5.1 | 3.603957 |
| 40 | [Harmonia](../src/planets/harmonia/SOURCE.md) | DAMIT 1855 | 111 | 8.908485 |
| 70 | [Panopaea](../src/planets/panopaea/SOURCE.md) | DAMIT 6171 | 128 | 15.8044 |
| 666 | [666 Desdemona](../src/planets/desdemona-666/SOURCE.md) | DAMIT 6218 | 28.4 | 14.60796 |
| 29075 | [1950 DA](../src/planets/asteroid-1950-da/SOURCE.md) | NASA/JPL retrograde radar | 1.3 | 2.1216 |
| 99942 | [Apophis](../src/planets/apophis/SOURCE.md) | NASA/PDS radar Model B | 0.34 | 27.45 / 265.7 (tumbling) |
| 52246 | [Donaldjohanson](../src/planets/donaldjohanson/SOURCE.md) | Lucy / DLR DSK | 4.81065 | 252.6 / 455.2 (lightcurve) |

The reference diameter sets the explicitly stated elevation sphere and object scale. The original calibrated coordinates are not rescaled to rounded or averaged catalog diameters. Individual source records provide more precise geometric measurements.

Original-to-reduced geometry inspection covers front, back and both poles. Independent nearest-triangle sampling uses 8192 area-stratified samples in each direction; these are sampled distances, not a proof of a Hausdorff bound. Radial ambiguity checks cover every source face centroid plus 8192 directions. Source/model limitations remain visible in each package rather than being hidden behind a generic surface claim.

Runtime assets are installed through the existing runtime-assets.json inventories. Source/preparation/acquisition.json restores original source inputs separately; pinned HTML and small source tables remain checked in where applicable. All source manifests verify byte counts and SHA-256 identities.

## Source availability beyond the selected bodies

The [candidate survey](asteroid-candidate-survey.json) records 217 DAMIT targets (142 named and 75 provisional-designation entries) and the additional mission/radar checks. A missing calibrated mesh is a source gap, not permission to synthesize an ellipsoid or rescale an unrelated model. This record is a dated survey, not a claim that no usable data exists anywhere.

Cybele retains its explicitly identified 2017 model rather than relabeling it as the 2023 SPHERE reconstruction. Hektor uses the published convex primary model and does not claim to resolve the bilobed shape or its moon. Phaethon uses the 2018 convex solution. Apophis’s 2026 archive release contains the preliminary 2018 Model B. Donaldjohanson preserves the source authors’ reconstruction of its unseen side; it does not present that region as observed terrain. Per-body source records explain these choices.
