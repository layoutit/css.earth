// Render one real route with Astro, then close it before Chrome starts.
import assert from 'node:assert/strict';
import {dev} from 'astro';
import {mkdir,writeFile} from 'node:fs/promises';
const [id]=process.argv.slice(2);
assert.ok('himalia epimetheus telesto pandora ymir albiorix siarnaq methone pallene'.split(' ').includes(id));
const out='output/playwright/b4-observations/panel';await mkdir(out,{recursive:true});
const server=await dev({root:process.cwd(),server:{host:'127.0.0.1',port:4292},vite:{server:{strictPort:true}}});
try{
 const response=await fetch(`http://127.0.0.1:4292/${id}/`);assert.equal(response.status,200);
 const html=await response.text();assert.ok(html.includes('planet-chart-caption'));
 await writeFile(`${out}/${id}.html`,html);
 console.log(JSON.stringify({id,bytes:Buffer.byteLength(html),maxRssKiB:process.resourceUsage().maxRSS}));
}finally{await server.stop();}
