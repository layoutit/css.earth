#!/usr/bin/env node
/** VLTI/GRAVITY calibration from raw frames, through the archive's association tree (eso-associations.mts).
 *
 *   node tools/objects/interferometry/calibrate-gravity.mts <science dp_id> <work directory> [--raw <directory>]
 *
 * A science exposure (SINGLE_SCI_RAW) is reduced by gravity_vis with its sky, a dark of the same science-camera integration
 * time, and the bad-pixel map, flat, wavelength table and P2VM of the P2VM association (gravity_p2vm from raw darks, flats,
 * wavelength and P2VM scans). The calibrator exposure in the same spectral resolution and polarisation mode nearest in time is
 * reduced the same way, and gravity_viscal divides by its transfer function. --force-calib=TRUE: the archive's DIAMETER_CAT does
 * not mark every calibrator as one, and without it gravity_viscal writes no calibrated file. The archive tree lists no Earth
 * orientation table for 2018 frames, so the kit's EOP_PARAM is used. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { associationCli, type InstrumentReduction } from './eso-associations.mts';

const SCIENCE_DIT = ['ESO DET2 SEQ1 DIT'];
const visibilities = (exposure: string, sky: string) => ({
  recipe: 'gravity_vis', exposure,
  inputs: { DARK: ['DARK'], P2VM: ['BAD', 'FLAT', 'WAVE', 'P2VM'], DISP_MODEL: 'raw', DIODE_POSITION: 'raw', STATIC_PARAM: 'raw', DIAMETER_CAT: 'raw' },
  matched: { [sky]: SCIENCE_DIT, DARK: SCIENCE_DIT },
  kitFrames: { EOP_PARAM: /^GRAVI_EOP_PARAM\..*\.fits$/u },
  products: [exposure === 'SINGLE_SCI_RAW' ? 'SINGLE_SCI_VIS' : 'SINGLE_CAL_VIS'],
} as const);

export const GRAVITY_REDUCTION: InstrumentReduction = {
  toolchain: 'gravity',
  steps: {
    SCI_SINGLE: visibilities('SINGLE_SCI_RAW', 'SINGLE_SKY_RAW'),
    STD_SINGLE: visibilities('SINGLE_CAL_RAW', 'SINGLE_SKY_RAW'),
    DARK: { recipe: 'gravity_dark', inputs: {}, products: ['DARK'] },
    P2VM: { recipe: 'gravity_p2vm', inputs: { DARK: 'raw', WAVE_PARAM: 'raw' }, inherited: ['STATIC_PARAM'], products: ['BAD', 'FLAT', 'WAVE', 'P2VM'] },
  },
  calibrator: { association: 'STD_SINGLE', keys: ['ESO INS SPEC RES', 'ESO INS POLA MODE', 'ESO FT POLA MODE'] },
  calibrate: { recipe: 'gravity_viscal', options: ['--force-calib=TRUE'], science: 'SINGLE_SCI_VIS', calibrator: 'SINGLE_CAL_VIS', raw: ['DIAMETER_CAT'], product: 'SINGLE_SCI_VIS_CALIBRATED' },
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await associationCli(GRAVITY_REDUCTION, process.argv.slice(2));
