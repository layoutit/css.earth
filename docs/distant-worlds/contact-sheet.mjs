import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
sharp.concurrency(1);
const {bodies}=JSON.parse(await readFile('docs/distant-worlds/inputs.json'));
const output='docs/distant-worlds/images';await mkdir(output,{recursive:true});
const layers=[],receipts=[];
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
for(let i=0;i<bodies.length;i++){
 const b=bodies[i],source=`output/playwright/distant-worlds/${b.id}-dpr1.png`,bytes=await readFile(source);
 const full=await sharp(bytes).webp({quality:85}).toBuffer();await writeFile(`${output}/${b.id}.webp`,full);
 const crop=await sharp(bytes).extract({left:400,top:160,width:650,height:600}).resize(420,388).toBuffer();
 const label=Buffer.from(`<svg width="420" height="62" xmlns="http://www.w3.org/2000/svg"><rect width="420" height="62" fill="#111418"/><text x="16" y="26" fill="#fff" font-family="Arial" font-size="22">${escape(b.name)}</text><text x="16" y="49" fill="#adb4bc" font-family="Arial" font-size="14">${escape(b.radiusKm<1?'115 × 111 × 19 m':b.fullAxesKm.map(n=>Math.round(n)).join(' × ')+' km')} · model, unmapped surface</text></svg>`);
 const left=(i%3)*432,top=Math.floor(i/3)*462;
 layers.push({input:label,left,top},{input:crop,left,top:top+62});
 receipts.push({id:b.id,source,sourceSha256:createHash('sha256').update(bytes).digest('hex'),image:`${output}/${b.id}.webp`,imageSha256:createHash('sha256').update(full).digest('hex')});
}
await sharp({create:{width:1284,height:1374,channels:3,background:'#090b0d'}}).composite(layers).webp({quality:88}).toFile(`${output}/nine-worlds.webp`);
await writeFile('docs/distant-worlds/image-provenance.json',JSON.stringify({scope:'Actual default DPR1 browser captures. Contact sheet crops the same scene rectangle and resizes it; models are individually framed, not compared at a common physical scale. Full browser views retained alongside.',receipts},null,2)+'\n');
