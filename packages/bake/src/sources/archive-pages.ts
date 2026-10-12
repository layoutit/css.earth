/**
 * The page that presents what an archive address serves, where the address itself says so: a query service's own page,
 * the record a deposited file belongs to, a repository's view of a raw file, the folder that lists a catalogue's files.
 * A manifest entry fetched from one of these needs no `sourceUrl`; any other file names its page there
 * (`author-source-records.ts`). Each page was fetched on 2026-10-12, when 9,983 catalogue records that led with a file
 * or a query address were given theirs.
 */
type Request = Readonly<Record<string, string>>;

/** A VizieR table such as `J/A+A/529/A75/table-af` or `I/355/gaiadr3`, as the catalogue that holds it. */
const vizierCatalogue = (table: string) => table.split('/').slice(0, table.startsWith('J/') ? 4 : 2).join('/');

const PAGES: readonly (readonly [RegExp, (match: RegExpExecArray, request: Request) => string])[] = [
  [/^https:\/\/gea\.esac\.esa\.int\/(?:tap|data)-server\//u, () => 'https://gea.esac.esa.int/archive/'],
  [/^https:\/\/gaia\.ari\.uni-heidelberg\.de\/tap\//u, () => 'https://gaia.ari.uni-heidelberg.de/tap.html'],
  // A VizieR query names its table in the request it sends; without one the service's own page stands in.
  [/^https:\/\/vizier\.cds\.unistra\.fr\/viz-bin\/asu-/u, (_, request) => `https://vizier.cds.unistra.fr/viz-bin/VizieR${request['-source'] ? `?-source=${vizierCatalogue(request['-source'])}` : ''}`],
  [/^https:\/\/simbad\.cds\.unistra\.fr\/simbad\/sim-tap\//u, () => 'https://simbad.cds.unistra.fr/simbad/'],
  [/^https:\/\/exoplanetarchive\.ipac\.caltech\.edu\/TAP\//u, () => 'https://exoplanetarchive.ipac.caltech.edu/'],
  [/^https:\/\/ssd\.jpl\.nasa\.gov\/api\/horizons\.api/u, () => 'https://ssd.jpl.nasa.gov/horizons/'],
  [/^https:\/\/zenodo\.org\/(?:api\/)?records?\/(\d+)\/files\//u, match => `https://zenodo.org/records/${match[1]}`],
  [/^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(.+)$/u, match => `https://github.com/${match[1]}/blob/${match[2]}/${match[3]}`],
  [/^https:\/\/arxiv\.org\/pdf\/(.+?)(?:\.pdf)?$/u, match => `https://arxiv.org/abs/${match[1]}`],
  // A catalogue file at the CDS sits in a folder whose page lists it with the catalogue's ReadMe.
  [/^(https:\/\/cdsarc\.cds\.unistra\.fr\/ftp\/.+\/)[^/?#]+/u, match => match[1]!],
];

/** The page for an archive address, with the request sent to it when the address is a query service's; undefined for an archive not listed. */
export function archivePage(address: string, request: Request = {}): string | undefined {
  const sent = { ...Object.fromEntries(new URL(address).searchParams), ...request };
  for (const [pattern, page] of PAGES) {
    const match = pattern.exec(address);
    if (match) return page(match, sent);
  }
  return undefined;
}
