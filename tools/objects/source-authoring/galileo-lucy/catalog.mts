export const celestiaCommit = '1993a082ee6307c0df7fdc0828eb117a0e8e9958';
export const celestiaUrl = `https://github.com/CelestiaProject/CelestiaContent/blob/${celestiaCommit}`;
export const bodies = [
  {
    id: 'dactyl', name: 'Dactyl', parent: 'ida', parentName: 'Ida', radiusKm: Math.cbrt(.8 * .7 * .6),
    shape: { schema: 'cssearth-ellipsoid-parameters@1', scaleConvention: 'published-semiaxes', semiaxesKm: [.8, .7, .6], subdivisions: 3 },
    format: 'ellipsoid-parameters', faces: 512, errorMeters: 15,
    detail: 'Galileo', title: 'Galileo shape estimate',
    description: 'A smooth ellipsoid at the dimensions measured from Galileo images: 1.6 × 1.4 × 1.2 km. Craters and surface imagery are not represented; the grid marks missing imagery.',
    introduction: 'Dactyl, discovered beside Ida in Galileo images, was the first moon found orbiting an asteroid.',
    sourceUrl: 'https://doi.org/10.1006/icar.1996.0045', credit: 'Veverka et al. (1996), Galileo imaging team',
    axes: '1.6 × 1.4 × 1.2 km', periodHours: .96534 * 24,
    qualification: 'Approximate orbital placement. The 1993 encounter did not determine a unique orbit; the present orbital phase is illustrative. A synchronous orientation is assumed, not measured.',
    papers: [
      ['Veverka et al. (1996)', 'Galileo dimensions, shape and surface observations', 'https://doi.org/10.1006/icar.1996.0045'],
      ['Belton et al. (1996)', 'Discovery and encounter orbit constraints', 'https://doi.org/10.1006/icar.1996.0044'],
      ['Petit et al. (1997)', 'Long-term orbit stability and candidate solutions', 'https://doi.org/10.1006/icar.1997.5788'],
    ],
  },
  {
    id: 'dinkinesh', name: 'Dinkinesh', parent: 'sun', parentName: 'Sun', radiusKm: .369,
    format: 'wavefront-obj', faces: 1200, errorMeters: 12,
    detail: 'Model', title: 'Lucy encounter reconstruction',
    description: 'Celestia contributors’ reconstruction inspired by Lucy images, uniformly scaled to the published 738 m volume-equivalent diameter. This is an authored approximation, not the mission photogrammetric shape model. The grid marks missing qualified surface imagery.',
    introduction: 'Dinkinesh was Lucy’s first asteroid encounter. Its equatorial ridge and trough accompany a remarkable moon: the contact binary Selam.',
    sourceUrl: `${celestiaUrl}/models/dinkinesh.cmod`, credit: 'ItzImcool (2024), domi9 (2024–2025); Celestia contributors',
    axes: '738 m equivalent diameter', periodHours: 3.737,
    qualification: 'JPL supplies the heliocentric orbit. The reconstruction has an illustrative meridian; its detailed geometry and unseen hemisphere are not measured terrain.',
    papers: [
      ['Levison et al. (2024)', 'Lucy discovery, ridge and contact-binary satellite', 'https://doi.org/10.1038/s41586-024-07378-0'],
      ['Bierhaus et al. (2025)', 'Revised shape, geology and 738 m equivalent diameter', 'https://doi.org/10.3847/PSJ/ae1968'],
      ['Jackson et al. (2025)', 'Rotation pole and thermal constraints', 'https://doi.org/10.3847/PSJ/ade23c'],
    ],
  },
  {
    id: 'selam', name: 'Selam', parent: 'dinkinesh', parentName: 'Dinkinesh',
    radiusKm: Math.cbrt(.12 * .1 * .1 + .14 * .11 * .105),
    shape: { schema: 'cssearth-contact-ellipsoids@1', origin: 'equal-density-volume-centroid', lobes: [{ semiaxesKm: [.12, .1, .1] }, { semiaxesKm: [.14, .11, .105] }], fluxScale: 1, subdivisions: 3 },
    format: 'contact-ellipsoids', faces: 1024, errorMeters: 3,
    detail: 'Lucy', title: 'Measured two-lobe envelope',
    description: 'Two touching ellipsoids reproduce the lobe dimensions inferred from Lucy images: 240 × 200 × 200 m and 280 × 220 × 210 m, each uncertain by about 10%. This is a smooth shape envelope; the neck, craters and surface imagery are unresolved in this representation.',
    introduction: 'Selam is the first contact-binary moon discovered around an asteroid. Lucy revealed its two touching lobes while passing Dinkinesh in November 2023.',
    sourceUrl: 'https://doi.org/10.1038/s41586-024-07378-0', credit: 'Levison et al. (2024), Lucy science team',
    axes: 'About 520 m end to end', periodHours: 52.67,
    qualification: 'Approximate orbital placement. The 3.11 km separation and 52.67-hour period are measured; circular equatorial motion and synchronous orientation are approximations. The present orbital phase is illustrative.',
    papers: [
      ['Levison et al. (2024)', 'Lobe dimensions, separation and mutual period', 'https://doi.org/10.1038/s41586-024-07378-0'],
      ['Bierhaus et al. (2025)', 'Later geology and limits of the Selam shape evidence', 'https://doi.org/10.3847/PSJ/ae1968'],
    ],
  },
];
