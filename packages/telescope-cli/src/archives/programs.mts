/** Where an archive's pinned programs and their receipts live: `src/archives/<archive>/programs`, beside the archive's code.
 * JWST shares one programs root: time-series directories and imaging, cube and starlight-subtraction JSON files. */
export type ProgramArchive = 'pds' | 'keck' | 'gemini' | 'naco' | 'chandra' | 'spitzer' | 'juno' | 'hst' | 'jwst' | 'ihw' | 'espadons';

export interface ArchivePrograms {
  /** The repository-relative directory the programs and their receipts are in. */
  readonly path: string;
  /** The repository-relative path of one file among them. */
  readonly file: (name: string) => string;
}

const isFileName = (name: string) => /^[^/\\]+$/u.test(name) && name !== '.' && name !== '..';

export function archivePrograms(archive: ProgramArchive): ArchivePrograms {
  const path = `packages/telescope-cli/src/archives/${archive}/programs`;
  return {
    path,
    file: name => {
      if (!isFileName(name)) throw new TypeError(`${JSON.stringify(name)} is not the name of a file directly among an archive's programs.`);
      return `${path}/${name}`;
    } };
}
