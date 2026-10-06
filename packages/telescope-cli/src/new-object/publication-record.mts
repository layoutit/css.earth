/** The src/sources record of a publication read from arXiv, Crossref, the NASA Exoplanet Archive or a web page. */
import { citedName, isCollaboration, type Publication } from './archives/archives.mts';
import { CHECKED } from './color.mts';

export function publicationRecord(publication: Publication) {
  if (publication.wikipedia) return { id: publication.id, kind: 'reference-page', identityLevel: 'work', title: `Wikipedia article: ${publication.title}`, identifiers: [{ type: 'Archive resource', value: publication.url }],
    links: [{ role: 'landing', url: publication.url, label: `Wikipedia, ${publication.title}` }], evidence: [{ url: publication.url, checkedOn: CHECKED, locator: 'Lead section, as the REST summary API serves it; the quotes name the revision' }], relations: [],
    statements: [{ kind: 'credit', text: `Wikipedia contributors, "${publication.title}", Wikipedia, The Free Encyclopedia`, scope: 'citation', evidence: publication.url },
      { kind: 'rights', text: 'Creative Commons Attribution-ShareAlike 4.0; sentences quoted verbatim with attribution', scope: 'Quoted text', evidence: 'https://creativecommons.org/licenses/by-sa/4.0/' }], creators: publication.creators };
  if (publication.page) return { id: publication.id, kind: 'reference-page', identityLevel: 'work', title: `Web page ${publication.title}`, identifiers: [{ type: 'Archive resource', value: publication.url }],
    links: [{ role: 'landing', url: publication.url, label: publication.title }], evidence: [{ url: publication.url, checkedOn: CHECKED, locator: 'The page as cited by a NASA Exoplanet Archive parameter set or by a spec' }], relations: [],
    statements: [{ kind: 'credit', text: publication.title, scope: 'citation', evidence: publication.url }] };
  const identifiers = [...publication.arxiv ? [{ type: 'arXiv', value: publication.arxiv }] : [], ...publication.doi ? [{ type: 'DOI', value: publication.doi }] : [], ...publication.bibcode ? [{ type: 'bibliography-key', value: publication.bibcode }] : []];
  if (publication.bibcode && !publication.arxiv && !publication.doi) return { id: publication.id, kind: 'publication', identityLevel: 'work', title: `Reference ${publication.bibcode}, as the NASA Exoplanet Archive cites it.`, identifiers,
    links: [{ role: 'landing', url: publication.url, label: 'Published reference' }], evidence: [{ url: publication.url, checkedOn: CHECKED, locator: 'ADS bibcode from the NASA Exoplanet Archive ps table (pl_refname)' }], relations: [],
    statements: [{ kind: 'limitation', text: 'Bibliographic identity transcribed from the NASA Exoplanet Archive; this record does not claim independent review of the paper.', scope: 'citation', evidence: publication.url }], publicationDate: publication.year };
  const lead = publication.creators[0] ? citedName(publication.creators[0]) : 'Anonymous', authors = publication.creators.length > 2 ? (isCollaboration(publication.creators[0]!) ? lead : `${lead} et al.`) : publication.creators.map(citedName).join(' & ');
  return { id: publication.id, kind: 'publication', identityLevel: 'work', title: `${authors} (${publication.year}): ${publication.title}`, identifiers,
    links: [{ role: 'archive', url: publication.url, label: publication.arxiv ? 'arXiv preprint' : 'Publisher' }, ...publication.doi && publication.arxiv ? [{ role: 'landing', url: `https://doi.org/${publication.doi}`, label: publication.publisher ?? 'Journal version' }] : []],
    evidence: [{ url: publication.url, checkedOn: CHECKED, locator: publication.arxiv ? 'arXiv API record: title, authors, journal reference' : 'Crossref record: title, authors, container' }],
    relations: [], statements: [{ kind: 'credit', text: `${authors} (${publication.year})${publication.publisher ? `, ${publication.publisher}` : ''}`, scope: 'citation', evidence: publication.url }],
    ...(publication.publisher ? { publisher: publication.publisher } : {}), creators: publication.creators.length > 3 ? [...publication.creators.slice(0, 3), 'et al.'] : publication.creators, publicationDate: publication.year };
}
