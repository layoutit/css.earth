# Published photometric models by body

Which bodies have a published photometric model that `tools/photometry/` can use,
where its values were read, and what blocks the rest. Searched on 2026-09-12. Add
a model record only from values read in the paper, its archive document, or a
compilation that cites it, and name the table in the binding's locator. The
[photometry guide](../../../../tools/photometry/README.md) has the record format and the
review checklist.

"Read" names what was checked: full text, abstract, archive document or
compilation. "Summary only" means the values were seen only in search results or
citing papers; confirm them in the source first.

## In use

| Body | Model | Source | Read |
| --- | --- | --- | --- |
| Lutetia | Hapke (1993) | [Hasselmann et al. 2016](https://doi.org/10.1016/j.icarus.2015.11.023), Table 5 | Full text ([arXiv 1710.01356](https://arxiv.org/abs/1710.01356)) |
| Ida | Hapke, one-term Henyey-Greenstein | [Helfenstein et al. 1996](https://doi.org/10.1006/icar.1996.0036) | Abstract; Hasselmann 2016 Table 7 lists the opposition amplitude as 1.53 |
| Gaspra | Hapke, one-term Henyey-Greenstein | [Helfenstein et al. 1994](https://doi.org/10.1006/icar.1994.1005) | Abstract, with width and asymmetry from Hasselmann 2016 Table 7 |

## Ready to add

| Body | Values | Source | Read | Next step |
| --- | --- | --- | --- | --- |
| 67P | Hapke (2002): w 0.042, g −0.37, B0SH 2.5, hs 0.079, θ̄ 15°, B0CB 0.188, hCB 0.017; fitted at 1.3–53.9° phase, incidence and emission below 70° | [Fornasier et al. 2015](https://doi.org/10.1051/0004-6361/201525901), Table 4 | Full text ([arXiv 1505.06888](https://arxiv.org/abs/1505.06888)) | Record and recipe switch on the observation seam; 67P prepares again |
| Ryugu | Hapke with shadow hiding per ONC-T band; v band w 0.044, g −0.388, B0 0.98, h 0.075, θ̄ 28° | [Tatsumi et al. 2020](https://doi.org/10.1051/0004-6361/201937096) | Hayabusa2 ONC data-product document; it flips the sign of g relative to the paper, so check the sign | No photograph lens yet; the archive's L2e images are already corrected to 30° incidence, 0° emission and 30° phase |
| Eros | Hapke: w 0.33, g −0.25, θ̄ 28° at 550 nm; B0 1.4, h 0.01 | [Li et al. 2004](https://doi.org/10.1016/j.icarus.2004.07.024); Hasselmann 2016 Table 7 | Compilation; abstract summary only | Read the paper; no photograph lens yet |

## Blocked

| Body | What exists | Blocker |
| --- | --- | --- |
| Tempel 1, Wild 2, Hartley 2 | Hapke w, g and θ̄ with B0 1.0 and h 0.01 fixed, from Li et al. 2007, 2009 and 2013, in Hasselmann 2016 Table 7 | The fitted phase ranges are in papers that ADS and ScienceDirect refuse to automated readers. Summaries give about 15–94° for Tempel 1 from Stardust-NExT and about 80–95° for Hartley 2. |
| Steins | Hapke with porosity: w 0.57, g −0.27, θ̄ 28°, porosity 84%; B_S0 0.60, h_S 0.06, B_C0 0.52, h_C 0.0025 | [Spjuth et al. 2012](https://doi.org/10.1016/j.icarus.2012.06.021) abstract and Hasselmann 2016 Table 7. The frames lie at 0.4–6° phase, where the opposition terms decide the result, so the paper's formulation is needed. |
| Borrelly | Li et al. 2007 means: w 0.057, g −0.43, θ̄ 22° | Summary only, and the ISIS2 orthographic route carries no Sun geometry |
| Dimorphos | [Buratti et al. 2024](https://doi.org/10.3847/PSJ/ad2b60): roughness and an albedo map | No Dimorphos Hapke fit; its w and g describe the Didymos system |
| Itokawa | [Tatsumi et al. 2018](https://doi.org/10.1016/j.icarus.2018.04.001) disk-integrated Hapke | No disk-resolved AMICA model |
| Donaldjohanson | None | [Marchi et al. 2026](https://doi.org/10.1126/science.aec0503) used L'LORRI for shape and lightcurve only |
| Bennu | [Golish et al. 2021](https://doi.org/10.1016/j.icarus.2020.113724): ROLO phase function with Lommel-Seeliger | Coefficients not read; the library has no ROLO phase function |
| Europa | [Belgacem et al. 2020](https://doi.org/10.1016/j.icarus.2019.113525): Hapke per region | Per-region Tables 2 and 3 not retrieved |
| Triton | [Hillier et al. 1994](https://doi.org/10.1006/icar.1994.1095): per-unit Hapke ranges | Per-unit values not retrieved |
| Amalthea, Thebe, Metis | [Simonelli et al. 2000](https://doi.org/10.1006/icar.2000.6474), Table II | Table not retrieved |
| Saturn's small moons | [Hedman et al. 2020](https://doi.org/10.3847/1538-3881/ab659d): whole-disk Minnaert with an assumed exponent | Not disk-resolved; keep the empirical forms |
| Hyperion, Proteus, Larissa, Puck | Geometric albedos | No disk-resolved model |
| Tethys | Not searched | Search Cassini ISS and VIMS photometry before replacing the empirical Lommel-Seeliger law |
