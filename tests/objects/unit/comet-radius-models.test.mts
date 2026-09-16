import { testRadiusNucleus } from './comets/radius-models.mts';
import { selectedObjectIds } from './anchor-table.mts';

// Independent source anchors: [effective radius km, displayed lightcurve elongation a/b].
// Snodgrass et al. (2006) 17P; Pittichová et al. (2008) 21P; Boehnhardt et al. (1999) 26P; Schambeau et al. (2021) 29P;
// Boehnhardt et al. (2002) 46P; Lamy et al. (2004) 55P, 109P; Eisner et al. (2019) 96P; Bauer et al. (2013) 167P;
// Rieke and Lee (1974) C/1973 E1; Campins and Fernández (2002) C/1983 H1; Szabó et al. (2012) C/1995 O1;
// Harmon et al. (1997) C/1996 B2; Farnham et al. (2017) C/2013 A1; Lellouch et al. (2022) C/2014 UN271;
// Liu, Hui and Liu (2025) C/2023 A3, an upper limit. 153P, C/1956 R1, C/2006 P1 and C/2020 F3 have no
// published nucleus measurement; their radii are assumptions recorded in each body's investigation ledger.
const NUCLEI = {
  'comet-17p': [1.62, 1.3], 'comet-21p': [1.82, 1], 'comet-26p': [1.5, 1.1], 'comet-29p': [32.3, 1],
  'comet-46p': [0.6, 1.4], 'comet-55p': [1.8, 1], 'comet-96p': [3.4, 1.6], 'comet-109p': [13, 1],
  'comet-153p': [1.877, 1], 'comet-167p': [33.1, 1], 'comet-c1956-r1': [1.165, 1], 'comet-c1973-e1': [6.25, 1],
  'comet-c1983-h1': [4.6, 1], 'comet-c1995-o1': [37, 1], 'comet-c1996-b2': [1.25, 1], 'comet-c2006-p1': [1.165, 1],
  'comet-c2013-a1': [0.5, 1], 'comet-c2014-un271': [68.5, 1], 'comet-c2020-f3': [1.844, 1], 'comet-c2023-a3': [5.9, 1],
} as const;
for (const id of selectedObjectIds(Object.keys(NUCLEI))) {
  const [radiusKm, axisRatioAB] = NUCLEI[id as keyof typeof NUCLEI];
  testRadiusNucleus(id, radiusKm, axisRatioAB);
}
