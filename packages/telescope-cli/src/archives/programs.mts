/** Where an archive's pinned programs and their receipts live, and where they lived before they moved beside the archive's
 * code. A tracked receipt or ledger keeps the path it recorded, so reading one back maps a former location to the current one
 * here, in one place, for every archive that has moved. */

/** The archives whose programs sit beside their code, in `src/archives/<archive>/programs`. JWST pins its time series,
 * its imaging and cube programs and its starlight-subtraction programs in three such folders, one beside each tool's code. */
export type MovedArchive = 'pds' | 'keck' | 'gemini' | 'naco' | 'chandra' | 'spitzer' | 'juno' | 'hst' | 'jwst' | 'jwst/imaging' | 'jwst/klip' | 'ihw';

export interface ArchivePrograms {
  /** The repository-relative directory the programs and their receipts are in now. */
  readonly path: string;
  /** The repository-relative path of one file among them, as it is written now. */
  readonly file: (name: string) => string;
  /** Every path one file among them may have recorded for itself: the current one and each former location. */
  readonly recorded: (name: string) => readonly string[];
  /** A recorded path as it is found in this checkout: a file directly inside a former location becomes the same file in the
   * current one; any other path, including one nested deeper or stepping out of a former location, is kept as recorded. */
  readonly current: (recorded: string) => string;
}

const isFileName = (name: string) => /^[^/\\]+$/u.test(name) && name !== '.' && name !== '..';

function fileName(name: string): string {
  if (!isFileName(name)) throw new TypeError(`${JSON.stringify(name)} is not the name of a file directly among an archive's programs.`);
  return name;
}

export function archivePrograms(archive: MovedArchive): ArchivePrograms {
  const path = `packages/telescope-cli/src/archives/${archive}/programs`;
  const former: readonly string[] = [`tools/objects/${archive}/programs`];
  return {
    path,
    file: name => `${path}/${fileName(name)}`,
    recorded: name => [path, ...former].map(directory => `${directory}/${fileName(name)}`),
    current: recorded => {
      const directory = former.find(entry => recorded.startsWith(`${entry}/`));
      if (directory === undefined) return recorded;
      const name = recorded.slice(directory.length + 1);
      return isFileName(name) ? `${path}/${name}` : recorded;
    } };
}

/** Archives that moved beside their code as a whole folder, programs or not. The interferometry toolchain descriptor names the
 * ROTIR Julia environment by its repository path, and that descriptor's text is hashed into the digest an installed toolchain
 * records, so it keeps the path it was written with. */
export type MovedArchiveFolder = 'interferometry';
const MOVED_FOLDERS: readonly MovedArchiveFolder[] = ['interferometry'];

/** A recorded repository path as it is found in this checkout: a path inside a moved archive folder's former location becomes the
 * same path inside its current one; any other path, including one that steps out of the former folder, is kept as recorded. */
export function currentArchivePath(recorded: string): string {
  for (const archive of MOVED_FOLDERS) {
    const former = `tools/objects/${archive}/`;
    if (!recorded.startsWith(former)) continue;
    const rest = recorded.slice(former.length);
    const parts = rest.split('/');
    return rest.length > 0 && !rest.includes('\\') && parts.every(part => part !== '' && part !== '.' && part !== '..')
      ? `packages/telescope-cli/src/archives/${archive}/${rest}` : recorded;
  }
  return recorded;
}
