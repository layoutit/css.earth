import type { MotionEvent } from './motion-script.mts';
/** Recorded with the footer Record button on 2026-09-12: one upward flick that
 * throws the solar system into a spin, then a click 2.6 s later that stops it.
 * Times in ms, positions in CSS px from the stage centre. */
export const MOTION_RECORDING: readonly MotionEvent[] = [
  { t: 504, type: 'pointerdown', x: 321.2, y: 359.7, buttons: 1 },
  { t: 606, type: 'pointermove', x: 321.2, y: 359.3, buttons: 1 },
  { t: 615, type: 'pointermove', x: 321.2, y: 356.2, buttons: 1 },
  { t: 623, type: 'pointermove', x: 321.2, y: 348.6, buttons: 1 },
  { t: 631, type: 'pointermove', x: 321.2, y: 330.7, buttons: 1 },
  { t: 639, type: 'pointermove', x: 321.2, y: 302.9, buttons: 1 },
  { t: 648, type: 'pointermove', x: 321.2, y: 271.2, buttons: 1 },
  { t: 656, type: 'pointermove', x: 321.2, y: 232.9, buttons: 1 },
  { t: 664, type: 'pointermove', x: 321.2, y: 190.4, buttons: 1 },
  { t: 673, type: 'pointermove', x: 321.2, y: 147.9, buttons: 1 },
  { t: 681, type: 'pointermove', x: 321.2, y: 103.2, buttons: 1 },
  { t: 692, type: 'pointermove', x: 321.2, y: 56.7, buttons: 1 },
  { t: 707, type: 'pointerup', x: 321.2, y: 56.7, buttons: 0 },
  { t: 3340, type: 'pointerdown', x: 321.2, y: 56.7, buttons: 1 },
  { t: 3590, type: 'pointerup', x: 321.2, y: 56.7, buttons: 0 },
];
