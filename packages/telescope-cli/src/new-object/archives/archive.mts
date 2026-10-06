/** The fetch interface every archive reader takes, and the catalogue row the readers of a star's position return. */
import type { SourceRange } from '@cssearth/objects/node';

export interface Archive {
  /** GET, or POST a form when `form` is given; the response text. */
  text(url: string, form?: Readonly<Record<string, string>>): Promise<string>;
  /** The whole answer, or exactly the bytes of `range`: a ranged request answered with anything else is refused. */
  bytes(url: string, range?: SourceRange): Promise<Buffer>;
  /** Whether a HEAD request answers 200. */
  exists(url: string): Promise<boolean>;
  /** Where a redirecting URL points, without following it; undefined when it does not redirect. */
  location?(url: string): Promise<string | undefined>;
}
/** One row of a VizieR table, for a star Gaia cannot see (spec `position`): the whole row as VizieR serves it, archived beside the
 * body, and the J2000 position it gives. A star a paper lists by its detector pixel is held the same way: `tsv` is then the header of
 * the archived exposure's extension, and `image` says where in the file it lies (images/image-pixel.mts). Coordinates a paper prints in a
 * table no archive holds are a row too, with nothing kept: the paper is cited by its DOI, as every other printed value is (`paper`). */
export interface CatalogueRow { readonly catalogue: string; readonly tsv: string; readonly form: Readonly<Record<string, string>>; readonly cells: Readonly<Record<string, string>>; readonly ra: number; readonly dec: number; readonly words: string;
  /** The columns the position was read from: the table's RAJ2000 and DEJ2000 unless the spec names others. */
  readonly columns: { readonly ra: string; readonly dec: string };
  /** Where the row is held, and how a manifest records it (rowArchive). */
  readonly archive: 'VizieR' | 'SIMBAD' | 'MAST' | 'DOI'; readonly paper?: { readonly url: string }; readonly image?: { readonly url: string; readonly file: string; readonly extension: string; readonly range: SourceRange };
  /** The Julian year of the position, 2000 unless the spec's `motion` says otherwise, and the row's proper motion (mas/yr) when it names the columns. */
  readonly epoch: number; readonly pmra?: number; readonly pmdec?: number }
