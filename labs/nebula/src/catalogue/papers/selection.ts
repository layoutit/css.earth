import type { MessierObject } from '../types';
import type { Paper } from './types';

export const paperTopics = ['Structure','Kinematics','Distance','Gas / dust','Imaging','Stellar populations'] as const;
export type PaperTopic = typeof paperTopics[number];
export type PaperOrder = 'object' | 'newest' | 'oldest';
const terms: Record<PaperTopic,RegExp> = {
  Structure:/\b(morpholog\w*|geometr\w*|three[- ]dimensional|3[- ]d|shells?|filaments?|bipolar|inclination|tomograph\w*|deprojection)\b/i,
  Kinematics:/\b(kinematic\w*|velocit\w*|doppler|expansion|outflows?|proper motions?|position[- ]velocity|rotation curve)\b/i,
  Distance:/\b(distances?|parallaxes?|parallax|distance modulus|standard candle|tip of the red giant branch)\b/i,
  'Gas / dust':/\b(dust|extinction|molecular|ioniz\w*|ionis\w*|electron densit\w*|abundances?|gas)\b/i,
  Imaging:/\b(imag\w*|mosaics?|multi[- ]wavelength|infrared|optical|photometr\w*|spectroscop\w*)\b/i,
  'Stellar populations':/\b(stellar populations?|star formation|star clusters?|initial mass function|colour[- ]magnitude|color[- ]magnitude|isochron\w*)\b/i,
};
export function topicsForPaper(paper: Paper) {
  const content = `${paper.title} ${paper.abstract ?? ''}`;
  return paperTopics.filter(topic=>terms[topic].test(content));
}
export function titleNamesObject(paper: Paper, object: MessierObject) {
  const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
  const aliases = [...new Set([`M ${object.messier}`,`Messier ${object.messier}`,object.name,...object.aliases])];
  return aliases.some(alias=>new RegExp(`(?:^|[^a-z0-9])${escaped(alias.replace(/^NAME\s+/,''))}(?![a-z0-9])`,'i').test(paper.title));
}
export function selectPapers(papers: Paper[], object: MessierObject, search: string, topic: PaperTopic | 'all', order: PaperOrder, minYear: number | null) {
  const query = search.trim().toLowerCase();
  return papers.filter(p=> (!query || `${p.title} ${p.abstract ?? ''} ${p.bibcode} ${p.doi ?? ''}`.toLowerCase().includes(query)) &&
    (minYear===null || p.year!==null && p.year>=minYear) && (topic==='all' || topicsForPaper(p).includes(topic)))
    .map(paper=>({paper,named:titleNamesObject(paper,object)})).sort((a,b)=>{
      if(order==='object' && a.named!==b.named) return Number(b.named)-Number(a.named);
      const years = order==='oldest' ? (a.paper.year??Infinity)-(b.paper.year??Infinity) : (b.paper.year??-1)-(a.paper.year??-1);
      return years || a.paper.bibcode.localeCompare(b.paper.bibcode);
    }).map(r=>r.paper);
}
export function paperLinks(paper: Paper) {
  const bib = encodeURIComponent(paper.bibcode), doi = paper.doi?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
  const arxiv = paper.bibcode.match(/^\d{4}arXiv(\d{4})(\d{4,5})[A-Za-z]$/);
  return { ads:`https://ui.adsabs.harvard.edu/abs/${bib}/abstract`, simbad:`https://simbad.cds.unistra.fr/simbad/sim-ref?bibcode=${bib}`,
    doi:doi && /^10\.\d{4,9}\/\S+$/.test(doi) ? `https://doi.org/${encodeURIComponent(doi)}` : null,
    arxiv:arxiv ? `https://arxiv.org/abs/${arxiv[1]}.${arxiv[2]}` : null };
}
