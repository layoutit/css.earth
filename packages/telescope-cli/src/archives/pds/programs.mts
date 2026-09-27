/** Where the pinned PDS programs and their receipts live, and where they lived before: a receipt keeps the path it recorded,
 * so reading one back maps a former location to the current one here, in one place. */
export const PDS_PROGRAMS_PATH = 'packages/telescope-cli/src/archives/pds/programs';
const FORMER_PROGRAMS_PATHS: readonly string[] = ['tools/objects/pds/programs'];

/** The receipt path a program's archive-final record is written to now. */
export const pdsReceiptPath = (id: string): string => `${PDS_PROGRAMS_PATH}/${id}.archive-final.product.json`;

/** Every path a program's receipt may have recorded for itself: the current one and each former location. */
export const recordedPdsReceiptPaths = (id: string): readonly string[] =>
  [PDS_PROGRAMS_PATH, ...FORMER_PROGRAMS_PATHS].map(directory => `${directory}/${id}.archive-final.product.json`);

/** A recorded receipt path as it is found in this checkout: a former location becomes the current one, any other path is kept. */
export function currentPdsReceiptPath(recorded: string): string {
  const former = FORMER_PROGRAMS_PATHS.find(directory => recorded.startsWith(`${directory}/`));
  return former === undefined ? recorded : `${PDS_PROGRAMS_PATH}${recorded.slice(former.length)}`;
}
