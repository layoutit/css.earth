/** Independent MCELS identity/position check; never adds a second overlapping gas census. */
import {readFile,writeFile} from 'node:fs/promises';
import {L11,type CatalogueRow} from './catalogue-data.mts';
import {need} from './inputs.mts';
const key=(s:string)=>s.replace(/^LMC-/u,'').replace(/^DEM L/u,'DEM').replace(/[^A-Z0-9]/giu,'').toUpperCase();
export async function checkMcels(rows:CatalogueRow[]){
 const lines=(await readFile(L11+'inputs/Pellegrini2012-lmc.dat','utf8')).trimEnd().split(/\r?\n/u),nebulae=rows.filter(r=>r.kind==='nebula'),checks=[];
 for(const s of lines){const number=(a:number,b:number)=>{const v=Number(s.slice(a-1,b).trim());need(Number.isFinite(v),'Invalid MCELS value');return v;},ra=15*(number(29,30)+number(32,33)/60+number(35,38)/3600),dec=-(number(41,42)+number(44,45)/60+number(47,48)/3600),alias=s.slice(11,25).trim(),matches=nebulae.filter(r=>r.aliases.some(a=>key(a)===key(alias))),near=matches.map(r=>({id:r.id,separationArcmin:Math.hypot((ra-r.ra)*Math.cos(dec*Math.PI/180),dec-r.dec)*60,diameterArcmin:r.majorArcmin})).sort((a,b)=>a.separationArcmin-b.separationArcmin)[0];
 checks.push({id:s.slice(0,10),alias,logHaLuminosityErgS:number(58,62),match:near??null});
 }
 const matched=checks.filter(c=>c.match),within=matched.filter(c=>c.match!.separationArcmin<Math.max(.5,c.match!.diameterArcmin/2)),result={rows:checks.length,identityMatches:matched.length,centresWithinCatalogueFootprint:within.length,scope:'Independent MCELS cross-identification/position check. Different aperture definitions and diffuse backgrounds preclude equating sizes or optical luminosities. No second emission census or fitted geometry.',checks};
 await writeFile(L11+'mcels-check.json',JSON.stringify(result,null,2)+'\n');return result;
}
