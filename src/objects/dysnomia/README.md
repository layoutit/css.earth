# Dysnomia

Dysnomia is the only known moon of Eris. Its orbit is what gave Eris a measured mass, and it circles Eris about every 16 days at roughly 37,000 km.

## Identity

IAU name **Dysnomia**, satellite designation **(136199) Eris I**, discovery designation **S/2005 (2003 UB313) 1**. JPL Horizons serves it as target **120136199**, with the Eris system barycentre as **920136199**.

## Sources

The view is a sphere at the catalogued radius, with the shared unmapped-surface grid. Shadows default off.

| Source | Used for |
| --- | --- |
| [Brown and Butler (2023), PSJ 4, 193](https://doi.org/10.3847/PSJ/ace52a) ([preprint](https://arxiv.org/abs/2307.04848)) | The adopted radiometric diameter **615 (+60 / −50) km** and geometric albedo **0.05 ± 0.01**. |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) satellite solution `tnosat_v001_20136199_jpl`, retained as [the primary-relative state](source/orbit/dysnomia-epoch.txt), [the primary's heliocentric state](source/orbit/eris-epoch.txt) and [an independent heliocentric check](source/orbit/dysnomia-heliocentric-check.txt) | Position and velocity relative to Eris at the fixed 2026-09-03 TT scene epoch, and the gravitational parameters this orbit calculation uses. |
| [Holler, Grundy, Buie and Noll (2021), Icarus 355, 114130](https://doi.org/10.1016/j.icarus.2020.114130) | The published orbit the Horizons solution transports: period **15.785899 ± 0.000050 d**, semi-major axis **37,273 ± 64 km**, eccentricity **0.0062 ± 0.0010**. |
| [Bernstein et al. (2023), PSJ 4, 115](https://doi.org/10.3847/PSJ/acdd5f) | Eris rotates synchronously with Dysnomia's orbit, period **15.771 ± 0.008 d**; Dysnomia's own brightness varies by **0.3 mag** in HST imaging. |
| [Epoch state record](source/validation/epoch-state.json) | The three retained responses, their byte pins, the composition check and the stated limitations. |

The source survey was checked on **2026-09-21**. [Measurements and assumptions](source/measurements.json) retain the numerical extraction; the [source manifest](source/manifest.json) pins the files and their acquisition records. See [NOTICE.md](NOTICE.md) for credits and reuse terms.

### Why this moon

Both Dysnomia and Haumea's Namaka were candidates. Their Horizons headers decide it. Dysnomia's solution uses **19 observations spanning 2005 to 2018** and states a **110 km** position uncertainty with respect to the primary on 2025-Jan-01. Namaka's solution `tnosat_v001b_20136108_jp` uses **29 observations spanning 2005 to 2008 only** and states a **1570 km** position uncertainty at the same date, about fourteen times worse on an arc that ends eighteen years before the scene epoch. Dysnomia's radius is served with an uncertainty, `RAD= 350 +- 57.5 km`; Namaka's is served as an approximation, `RAD~ 85 km`, resting on an assumed albedo of 0.8 ± 0.2. Namaka remains a reasonable later addition, with that weakness recorded.

### What the numbers mean

- **Diameter 615 (+60 / −50) km**, from ALMA Band 6 and Band 7 thermal flux in which Dysnomia is detected separately from Eris (45 ± 7 µJy at 1280 µm). The thermal flux gives the size and the albedo **0.05 ± 0.01** follows from it, which is the right direction of inference: before ALMA the size was degenerate over a factor of three. It rests on a fixed 850 µm emissivity of 0.685 and on priors typical of Kuiper-belt objects. One diameter is measured, so the rendered body has three equal axes by construction. These are **not** three measured axes, and there is no occultation silhouette or resolved image of Dysnomia.
- **Horizons is stale here.** It still serves `RAD= 350 +- 57.5 km`, the 2018 value from Brown and Butler's first ALMA paper, halved to a radius. The package uses the 2023 revision.
- **Gravitational parameters.** Horizons states a **range** for the satellite, `GM= 9.56 - 29.7 km^3/s^2`, and for the primary, `GM= 1069.1 - 1089.3 km^3/s^2`. The records carry **9.56** and **1069.1**, the low end of each stated range as read from the response headers. They are parameters of this orbit solution, not measured masses, and the primary value differs from the literature GM carried in the Eris body record, which comes from Sicardy et al. (2011).
- **Albedo 0.04 (+0.02 / −0.01)** and **H ≈ 5.6** appear in the header. They are not presented as body facts in the panel.
- **No rotation pole.** Horizons reports `ROTPER= n.a.`. Eris is measured to rotate synchronously with Dysnomia's 15.79 d orbit, and Dysnomia's own 0.3 mag variation is plausibly a double-peaked curve at that period, so Dysnomia is likely tidally locked. That is an inference. The orbit pole is well measured; a body pole is not.

## Known problems

The retained states use Horizons object **920136199**, which the responses name `Eris (primary body)`. It is the primary, not the system barycentre, which Horizons carries separately as `20136199`.

**The gravitational parameters conflict with the size paper.** Horizons states `GM= 9.56 - 29.7 km^3/s^2` for Dysnomia, a mass ratio of 0.0087 to 0.0270. Brown and Butler (2023) measure a mass ratio of 0.0050 ± 0.0035 with a 1σ upper limit of **0.0085**, below Horizons' whole range. Szakáts et al. (2023) argue from Eris's tidal despinning for the opposite: a mass ratio of 0.01 to 0.03 and a Dysnomia density of 1.8 to 2.4 g/cm³, against Brown and Butler's ≤ 1.2. Nothing here is retracted. The records carry Horizons' 9.56 because that is the parameter this orbit calculation uses, and the [ledger](investigations.json) holds the disagreement.

The pole is illustrative (right ascension **0°**, declination **+90°**) and the meridian arbitrary. Nothing about Dysnomia's orientation is measured here.

The retained state is an osculating geometric snapshot at one epoch. It is never propagated at runtime. The 110 km uncertainty Horizons states is its own statement at 2025-Jan-01, not a measured uncertainty at the 2026 scene epoch.

The surface is unmapped. The grid marks that absence; it is not observed colour or terrain.

<details>
<summary>Source survey and model selection</summary>

Every examined source, with its decision and what would reopen it, is in the [investigation ledger](investigations.json).

</details>

<details>
<summary>Preparation and records to change</summary>

The [shared distant-worlds methods](../../../tools/objects/source-authoring/distant-worlds/README.md) explain the numerical authoring, acquisition and preparation used here; this body's input row is [companions/inputs.json](../../../tools/objects/source-authoring/companions/inputs.json). The satellite placement is separate: the astronomy record `packages/astronomy/data/bodies/dysnomia.json` declares `acquisition.sceneSatellite`, and `node packages/astronomy/tools/generate-scene-satellites.mts --object=dysnomia` reads the retained responses and the [epoch state record](source/validation/epoch-state.json).

Edit source interpretation in [measurements](source/measurements.json) and the existing [preparation records](source/preparation/). Trace the generated result through [prepared provenance](prepared/provenance.json) and the [runtime asset inventory](runtime-assets.json). Common installation and usage belong in the [body contributor guide](../README.md).

</details>
