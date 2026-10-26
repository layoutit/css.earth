/** Inventory the released continuum-subtracted parents, then acquire through Data Lab cutouts. */
import {mkdir,writeFile} from 'node:fs/promises';
import {querySia} from './service.mts';
import {versionDir} from '../sequence-state.mts';
import {need} from '../inputs.mts';
const dir=versionDir(35)+'inputs/';await mkdir(dir,{recursive:true});
const query="SELECT s_ra,s_dec,access_url,fileref,im_naxis1,im_naxis2,fluxaxis_unit FROM ivoa_demcels_dr1.siav1 WHERE fileref LIKE '%.ha_sub_r.%'",url=new URL('https://datalab.noirlab.edu/tap/sync');
for(const [k,v]of Object.entries({REQUEST:'doQuery',LANG:'ADQL',FORMAT:'votable',QUERY:query}))url.searchParams.set(k,v);
const rows=await querySia(url.href,dir+'release-inventory.xml'),tiles=rows.map(row=>{const id=new URL(row.access_url).searchParams.get('siaRef');need(id&&/LMC_[A-Za-z0-9_]+\.ha_sub_r\.dr01\.fits/u.test(id),'Not a released continuum-subtracted LMC tile');return{id,...row};});
need(tiles.length>100&&tiles.length<400&&new Set(tiles.map(t=>t.id)).size===tiles.length,'Unexpected or duplicate release inventory');
const record={field:{center:[80.89,-69.76],tangentWidthDeg:10,inventory:'Complete DR1 continuum-subtracted H-alpha table, including overlapping parents.'},url:url.href,query,tiles,complete:true,discoveryLimit:'A 529-point SIA grid with 0.02 degree SIZE omitted valid parents. Even8 degree searches returned only parents containing the point. The provider TAP inventory supplies the complete released set; its access URLs are the same cutout service. Raw exploratory responses remain local.'};
await writeFile(dir+'discovery.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({sentinel:'FULL_LMC_RELEASE_INVENTORY_COMPLETE',tiles:tiles.length}));
