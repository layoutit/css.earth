import { readFileSync } from 'node:fs';
import { parseCieTable } from './objects/observation/disc-integrated-color.mts';
import { parseMeasuredSpectrumRecord, readMeasuredSpectrum, measuredSpectrumColor } from './objects/observation/stellar-photometric-color.mts';
const cie = parseCieTable(readFileSync('src/objects/wasp-43/source/reference/CIE_xyz_1931_2deg.csv', 'utf8'), 3);
const rec = parseMeasuredSpectrumRecord(JSON.parse(process.argv[3]!));
const s = readMeasuredSpectrum(readFileSync(process.argv[2]!), rec);
const c = measuredSpectrumColor(s, cie, rec.gaps);
console.log(s.wavelengthsNm.length, '#' + c.srgb.map(v => v.toString(16).padStart(2, '0')).join(''));
