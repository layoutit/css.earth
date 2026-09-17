#!/usr/bin/env node
/** VLTI/MATISSE calibration from raw frames, through the archive's association tree (eso-associations.mts).
 *
 *   node tools/objects/interferometry/calibrate-matisse.mts <science dp_id> <work directory> [--raw <directory>] [--calibrator <dp_id> ...]
 *
 * mat_est_flat, mat_est_shift and mat_est_kappa make the flat field, shift map and kappa matrix each association names; a
 * science exposure (TARGET_RAW) is reduced by mat_raw_estimates with the sky in the same beam-commutation (BCD) and chopping
 * state; the calibrator exposure in that state nearest in time, or each --calibrator exposure through its own tree, is reduced
 * the same way, and mat_cal_oifits calibrates. The
 * per-exposure file (TARGET_CAL_INT_0002) is kept, not the BCD-merged one, because one exposure is one BCD state. The
 * separately recorded RMNREC frames are not read. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { associationCli, type InstrumentReduction } from './eso-associations.mts';

const SETUP = ['ESO DET NAME', 'ESO DET SEQ1 DIT', 'ESO INS BCD1 ID', 'ESO INS BCD2 ID', 'ESO ISS CHOP ST'];
const MAPS = { BADPIX: 'raw', NONLINEARITY: 'raw' } as const;
const estimates = (exposure: string, product: string) => ({
  recipe: 'mat_raw_estimates', exposure,
  inputs: { ...MAPS, SKY_RAW: 'raw', JSDC_CAT: 'raw', EST_FLAT: ['OBS_FLATFIELD'], EST_SHIFT: ['SHIFT_MAP'], EST_KAPPA: ['KAPPA_MATRIX'] },
  matched: { SKY_RAW: SETUP },
  products: [product],
} as const);

export const MATISSE_REDUCTION: InstrumentReduction = {
  toolchain: 'matisse',
  steps: {
    TARGET_RAW: estimates('TARGET_RAW', 'TARGET_RAW_INT'),
    CALIB_RAW: estimates('CALIB_RAW', 'CALIB_RAW_INT'),
    EST_FLAT: { recipe: 'mat_est_flat', inputs: { ...MAPS, FLATFIELD: 'raw' }, products: ['OBS_FLATFIELD'] },
    EST_SHIFT: { recipe: 'mat_est_shift', inputs: { ...MAPS, EST_FLAT: ['OBS_FLATFIELD'] }, products: ['SHIFT_MAP'] },
    EST_KAPPA: { recipe: 'mat_est_kappa', inputs: { ...MAPS, EST_FLAT: ['OBS_FLATFIELD'], EST_SHIFT: ['SHIFT_MAP'] }, products: ['KAPPA_MATRIX'] },
  },
  calibrator: { association: 'CALIB_RAW', keys: SETUP },
  calibrate: { recipe: 'mat_cal_oifits', science: 'TARGET_RAW_INT', calibrator: 'CALIB_RAW_INT', product: 'TARGET_CAL_INT', file: /TARGET_CAL_INT_\d{4}\.fits$/u },
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await associationCli(MATISSE_REDUCTION, process.argv.slice(2));
