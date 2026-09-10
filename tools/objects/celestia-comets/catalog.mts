import {requireRecord,requireArray,requireString,requireFiniteNumber} from '../../source-values.mts';
// Independent SSC reader for the pinned core comet catalog; no Celestia code.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const sourceRoot = new URL('./source/', import.meta.url);
const rawUpstream = requireRecord(JSON.parse(readFileSync(new URL('upstream.json', sourceRoot), 'utf8')));
export const upstream = {...rawUpstream,commit:requireString(rawUpstream.commit),files:requireArray(rawUpstream.files).map(value=>{const f=requireRecord(value);return {...f,path:requireString(f.path),bytes:requireFiniteNumber(f.bytes),sha256:requireString(f.sha256)}})};
export interface CatalogEntry {id:string;designation:string;name:string;radiusKm:number;mesh:string;excerpt:string}
export function readCatalog() {
  const source = readFileSync(new URL('comets.ssc', sourceRoot));
  if (createHash('sha256').update(source).digest('hex') !== upstream.files.find(f=>f.path==='comets.ssc')?.sha256) throw Error('Celestia catalog hash differs');
  const text = source.toString(), records:CatalogEntry[]=[];
  const header = /^"([^"\r\n]+)"\s+"Sol"\s*\{/gm;
  for (const match of text.matchAll(header)) {
    let depth=1, i=match.index+match[0].length;
    // Comments and quoted strings cannot open/close a block.
    const tokens= /#[^\r\n]*|"(?:[^"\\]|\\.)*"|[{}]/g; tokens.lastIndex=i;
    let token;
    while ((token=tokens.exec(text)) && depth) {
      if(token[0]==='{')depth++;
      else if(token[0]==='}')depth--;
      if(!depth)i=tokens.lastIndex;
    }
    if(depth)throw Error('Unclosed SSC object');
    const excerpt=text.slice(match.index,i),body=excerpt.replace(/#[^\r\n]*/g,'');
    const first=match[1].split(':')[0];
    const periodic=first.match(/^(\d+P) (.+)$/),long=first.match(/^C (\d{4}) ([A-Z]+\d+) \((.+)\)$/);
    if(!periodic&&!long)throw Error(`Unknown comet designation ${first}`);
    const designation=periodic?periodic[1]:`C/${long![1]} ${long![2]}`;
    const id=periodic?`comet-${designation.toLowerCase()}`:`comet-c${long![1]}-${long![2].toLowerCase()}`;
    const radiusKm=Number(body.match(/\bRadius\s+([\d.]+)/)?.[1]);
    if(!(radiusKm>0)||!body.includes('Class\t"comet"'))throw Error(`Invalid comet ${id}`);
    records.push({id,designation,name:periodic?periodic[2]:long![3],radiusKm,mesh:requireString(body.match(/\bMesh\s+"([^"]+)"/)?.[1], 'Catalog mesh'),excerpt});
  }
  if(records.length!==23 || new Set(records.map(r=>r.id)).size!==records.length)throw Error('Core catalog inventory changed; review selection');
  return records;
}
export const preserved = ['comet-1p','comet-2p','comet-19p'];
export const candidates = readCatalog().filter(r=>!preserved.includes(r.id));
