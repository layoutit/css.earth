import { pds3Keyword, pds3Values } from '@cssearth/telescope';

/** Archive-specific evidence for the calibrated VICAR band-colour lane. */
export function pds3LabelHasReflectance(label: string): boolean {
  const units = pds3Keyword(label, 'UNITS');
  if (units !== undefined) return units === 'I/F';
  // Voyager's FICOR77 calibration records a real IMAGE attribute.
  const scale = pds3Keyword(label, 'REFLECTANCE_SCALING_FACTOR');
  if (scale !== undefined) return /^1\.0+E-0?4$/i.test(scale);
  // RMS Cassini labels instead retain the CISSCAL log inside root DESCRIPTION.
  // Read that named report deliberately, never arbitrary keyword-looking text.
  if (pds3Keyword(label, 'INSTRUMENT_HOST_NAME', []) !== 'CASSINI ORBITER' ||
      !['ISSNA', 'ISSWA'].includes(pds3Keyword(label, 'INSTRUMENT_ID', []) ?? '')) return false;
  const description = pds3Values(label, 'DESCRIPTION', []);
  if (description?.length !== 1 || !/^\s*Calibrated using CISSCAL [\w.]+:[\r\n]/.test(description[0])) return false;
  const rows = description[0].split(/[\r\n]+/).filter(line => /^[ \t]*UNITS[ \t]*=/.test(line));
  return rows.length === 1 && /^[ \t]*UNITS[ \t]*=[ \t]*'I\/F'[ \t]*$/.test(rows[0]);
}
