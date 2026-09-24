# Sources and reuse

The TEMPEST dataset retains `dinkinesh.stl` from Duncan Lyster's public
repository at commit `7df4c88063ebe811cbdd25b97c19f85559607459`, in its original
metre coordinates. The supplied [Modified MIT License](source/shape/TEMPEST-LICENSE.md)
requires attribution to **Lyster, D., Howett, C., & Penn, J. (2025), TEMPEST:
A Modular Thermophysical Model for Airless Bodies with Support for Surface
Roughness and Non-Periodic Heating**, submitted to EPSC-DPS 2025.
The file's exact upstream mission-model version is not established. We do not
describe it as a NASA public-domain release or transfer that status to it.

Lucy L’LORRI photographs in the registration evidence: NASA/GSFC/SwRI/JHUAPL
and the Lucy team, distributed in the PDS Small Bodies Node’s
[version 1.0 Dinkinesh partially processed collection](https://pds-smallbodies.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/SUPPORT/dataset.shtml).
The comparison is our diagnostic derivative of the 1 November 2023 observations:
it uses a common linear display of relative DN per second and retains acquisition
illumination. It is neither an archive-supplied basemap nor a calibrated albedo product.
The image and mesh retain their separate source attributions.

The separate Celestia dataset retains the following attribution:

ItzImcool (2024), domi9 (2024–2025); Celestia contributors. CC-BY-4.0; retain ItzImcool and domi9 attribution and mark conversion/scaling.

Original model: source/shape/dinkinesh.cmod and its adjacent SPDX license. Converted from Y-up to Z-up, centered and uniformly scaled; the original topology is retained before shared preparation simplifies it. https://creativecommons.org/licenses/by/4.0/

Scientific sources are linked in source/measurements.json. This package does not redistribute paper prose or figures.

Feature names, centres, diameters, extents and name origins are from the Gazetteer of Planetary Nomenclature, maintained by the USGS Astrogeology Science Center for the IAU Working Group for Planetary System Nomenclature. The archived export is a United States Government work in the public domain; see `source/features/manifest.json`.
