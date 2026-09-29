import { describe, expect, it } from 'vitest';
import { gillessenOrbits, gravityOrbits, habibiStars, multiStarFitStars, parseVizierTsv, sStarRecords } from './s-stars.mts';
import { readHostedOrbitRecord } from './generator-records.mts';

// Excerpts of the three sources exactly as they are served: VizieR J/ApJ/837/30/table3 (ASU-TSV), and the LaTeX of
// GRAVITY Collaboration (2022, arXiv:2112.07478) Table 1, Gillessen et al. (2017, arXiv:1611.09144) Sect. 3.4.1 and
// Habibi et al. (2017, arXiv:1708.06353) Table 3.
const TABLE3 = ['#INFO\trequest_date=2026-09-22', '',
  'recno\tStar\tf_Star\ta\te_a\te\te_e\ti\te_i\tOmega\te_Omega\tw\te_w\tTp\te_Tp\tPer\te_Per\tSpT\tKmag\tr\tOrb\tSimbadName\t_RA\t_DE',
  ' \t \t \tarcsec\tarcsec\t \t \tdeg\tdeg\tdeg\tdeg\tdeg\tdeg\tyr\tyr\tyr\tyr\t \tmag\t \t \t \tdeg\tdeg',
  '--------\t----\t-\t--------\t-------\t-------\t-------\t------\t-----\t------\t-----\t------\t-----\t-------\t------\t-------\t-------\t-\t-----\t-----\t---\t-----------\t----------\t----------',
  '       1\tS1  \t \t  0.5950\t 0.0240\t 0.5560\t 0.0180\t119.14\t 0.21\t342.04\t 0.32\t122.30\t 1.40\t2001.80\t  0.15\t 166.00\t   5.80\te\t14.70\t 1.75\tOrb\t[EG97] S1  \t266.416841\t-29.007868',
  '       2\tS2  \t \t  0.1255\t 0.0009\t 0.8839\t 0.0019\t134.18\t 0.40\t226.94\t 0.60\t 65.51\t 0.57\t2002.33\t  0.01\t  16.00\t   0.02\te\t13.95\t 1.13\tOrb\t[EG97] S2  \t266.416851\t-29.007771',
  '      26\tS85 \t \t  4.6000\t 3.3000\t 0.7800\t 0.1500\t 84.78\t 0.29\t107.36\t 0.48\t156.30\t 6.30\t1930.20\t 93.00\t3580.00\t2550.00\tl\t15.60\t 0.62\tOrb\t\t266.4\t-29.0',
  '      36\tS111\ta\t-12.3000\t 8.4000\t 1.0920\t 0.0640\t102.68\t 0.40\t 52.34\t 0.75\t132.40\t 3.30\t1947.70\t  4.50\t\t\tl\t13.80\t 0.97\tOrb\t\t266.4\t-29.0',
].join('\n');
const GRAVITY = [' ~&\\multicolumn{2}{c}{\\bf S2}&&\\multicolumn{2}{c}{\\bf S38}\\\\', ' ~\\\\',
  ' $a\\,[\\mathrm{as}]$ & 0.12495 & 0.00004&&0.14254&0.00004\\\\', '$e$ &0.88441 & 0.00006&&0.8145&0.0002\\\\',
  '$i\\,[^\\circ]$ &134.70 & 0.03&&166.65&0.40\\\\', '$\\Omega\\,[^\\circ]$ &228.19 &0.03&&109.45 & 1.00\\\\',
  '$\\omega\\,[^\\circ]$ &66.25 & 0.03&&27.17 & 1.02\\\\', '$t_\\mathrm{peri}\\,[\\mathrm{yr}]$&2018.3789 & 0.0001 &&2022.7044 & 0.0080 \\\\'].join('\n');
const SELECTION = 'We selected thus the following 3 stars for a multi-star fit: S2, S1, and S55. \n';
const HABIBI = ['Star&$T_{\\mathrm{eff}}$[K]&$\\log(g)$(cgs)&$\\log (L/L_\\odot)$& $R/R_\\odot$& $Mass/M_\\odot$& Age[Myr]& $V \\sin (i)[km s^{-1}]$&SP&$m_K$ \\\\', '\\hline',
  'S1  &$ 27450^{+ 2239}_{- 2569}$&$ 4.11^{+0.13}_{-0.16}$&$ 4.19^{+ 0.19}_{-0.18}$& $5.19^{+1.13}_{-0.76}$&$ 12.40^{+2.0}_{-1.7}$&$  4.3^{+4.2 }_{-4.2 }$&$ 150.00^{+78}_{-44}$&B0--B3&14.8&\\\\',
  '\\end{tabular}'].join('\n');

const HOST = { id: 'sgr-a-star', distanceParsecs: 8277, radiusKm: 30150695.4, massSolar: 4.297e6 };
const inputs = () => ({ host: HOST, solarGm: 132712440041.93938, gillessen: gillessenOrbits(parseVizierTsv(TABLE3)),
  multiStarFit: multiStarFitStars(SELECTION), gravity: gravityOrbits(GRAVITY), habibi: habibiStars(HABIBI), orders: { s2: 1253, s1: 1255 }, firstOrder: 1256 });

describe('S-star records from their publications', () => {
  it('reads each table as published', () => {
    expect(gillessenOrbits(parseVizierTsv(TABLE3)).map(orbit => [orbit.star, orbit.a, orbit.period])).toEqual([['S1', '0.5950', '166.00'], ['S2', '0.1255', '16.00'], ['S85', '4.6000', '3580.00'], ['S111', '-12.3000', '']]);
    expect(gravityOrbits(GRAVITY).map(orbit => [orbit.star, orbit.a, orbit.omega, orbit.tp])).toEqual([['S2', '0.12495', '66.25', '2018.3789'], ['S38', '0.14254', '27.17', '2022.7044']]);
    expect(multiStarFitStars(SELECTION)).toEqual(['S2', 'S1', 'S55']);
    expect(habibiStars(HABIBI)).toEqual([{ star: 'S1', teff: '27450', radius: ['5.19', '1.13', '0.76'], mass: ['12.40', '2.0', '1.7'], spectralType: 'B0-B3' }]);
    expect(() => multiStarFitStars('We selected thus the following 4 stars for a multi-star fit: S2, S1. ')).toThrow(/4 stars/u);
  });

  it('writes the checked S1 and S2 orbits, circles a weak orbit and skips an unbound one', () => {
    const { records, skipped } = sStarRecords(inputs());
    const orbit = (id: string) => readHostedOrbitRecord((records.find(record => record.id === id) as { hostedOrbit: unknown }).hostedOrbit);
    // The values checked against Gillessen et al. (2017) table5 positions and radial velocities before this tool existed.
    expect(orbit('s1')).toMatchObject({ periodDays: 60631.5, semiMajorAxisStellarRadii: 24435.3183, argumentOfPeriapsisDegrees: 302.3, transitTimeBmjdTdb: 52201.95 });
    expect(orbit('s2')).toMatchObject({ periodDays: 5860.3205, semiMajorAxisStellarRadii: 5131.4168, argumentOfPeriapsisDegrees: 246.25, transitTimeBmjdTdb: 58257.3932, ascendingNodePositionAngleDegrees: 228.19 });
    expect(orbit('s1').weaklyConstrained).toBeUndefined();
    expect(orbit('s85').weaklyConstrained).toBe(true);
    expect(orbit('s85').sources.constraint).toMatch(/S2, S1, S55\. S85 is not among them/u);
    const s1 = records.find(record => record.id === 's1') as { order: number; physical: { meanRadiusKm: number; gravitationalParameterKm3PerS2: number } };
    expect(s1.order).toBe(1255);
    expect(s1.physical).toMatchObject({ meanRadiusKm: 3610683, gravitationalParameterKm3PerS2: 1645634256520 });
    expect(records.find(record => record.id === 's85')).toMatchObject({ order: 1256, physical: { meanRadiusKm: 0, gravitationalParameterKm3PerS2: 0 } });
    expect(skipped).toEqual([expect.objectContaining({ star: 'S111' })]);
  });
});
