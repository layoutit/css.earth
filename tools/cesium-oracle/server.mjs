import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, sep } from 'node:path';
import { dev } from 'astro';
import { installation, project, PIN } from './acquire.mjs';
import { instrumentCss } from './instrument-css.mjs';
import { prepareCityPageGeometry } from '../../src/planets/earth/tools/city/page-geometry.mjs';
import { prepareLocationPoint } from '../../src/planets/earth/tools/city/prepare-location.mjs';
import { multiplyPreparedMatrix4 } from '../../src/platform/prepared-ellipsoid-projection.mjs';
import { PREPARED_EARTH_SCENE } from '../../src/planets/earth/runtime/preparedScene.mjs';
import { PREPARED_PRESENTATION } from '../../src/planets/earth/runtime/preparedPresentation.mjs';

export function referenceConfig() {
  const plan=PREPARED_PRESENTATION.pageLayers.find(l=>l.id==='city').plan;
  const faces=Array.from({length:14*32},(_,i)=>{
    const page=prepareCityPageGeometry({level:0,x:i%32,y:1+Math.floor(i/32)},PREPARED_EARTH_SCENE);
    const m=multiplyPreparedMatrix4(page.frameMatrix.split(',').map(Number),page.textureMatrix.split(',').map(Number));
    return {key:page.key,normal:page.normal,geographic:page.geographicMatrix,
      world:Array.from({length:12},(_,j)=>m[[0,4,12][j%3]+Math.floor(j/3)]*(j%3===2?1:1024))};
  });
  const tile=plan.initialLayer.url;
  const template=tile.replace(/\/\d+\/\d+\/\d+\.png$/,'/{TileMatrix}/{TileCol}/{TileRow}.png');
  if(template===tile)throw new Error('Prepared WMTS provider URL changed');
  // Prepared cardinal points establish the geography-to-body axis convention.
  // The camera uses this fixed basis, never a changing face's texture Jacobian.
  const axes=[[[0,0],[180,0]],[[90,0],[-90,0]],[[0,90],[0,-90]]].map(([a,b])=>{
    const p=prepareLocationPoint(PREPARED_EARTH_SCENE,...a),q=prepareLocationPoint(PREPARED_EARTH_SCENE,...b);
    return p.map((v,i)=>(v-q[i])/2);
  });
  const camera={perspective:Number(PREPARED_EARTH_SCENE.camera.style.match(/perspective:([\d.]+)px/)[1]),
    bodyRadius:(Math.hypot(...axes[0])+Math.hypot(...axes[1]))/2,
    ecefToBody:axes.map(axis=>axis.map(v=>v/Math.hypot(...axis)))};
  return {faces,camera,provider:{template,credit:plan.credit,dataset:plan.dataset,maximumLevel:19},pin:PIN,geometryVersion:plan.geometryVersion};
}

export function oraclePlugin(config) {
  const root=new URL('./',import.meta.url).pathname;
  return {name:'cesium-loading-oracle',enforce:'pre',
    async load(id){
      if(['/prepared-map/city-pages.mjs','/prepared-map/api-image-transport.mjs','/prepared-map/city-index.mjs'].some(s=>id.endsWith(s)))return instrumentCss(await readFile(id,'utf8'),id);
    },
    configureServer(server){server.middlewares.use(async(req,res,next)=>{
      if(!req.url?.startsWith('/__oracle/'))return next();
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname==='/__oracle/config.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(config));return;}
      const vendor=pathname.startsWith('/__oracle/vendor/');
      const base=vendor?new URL('package/Build/CesiumUnminified/',installation).pathname:root;
      const relative=vendor?pathname.slice('/__oracle/vendor/'.length):pathname.slice('/__oracle/'.length)||'viewer.html';
      const file=resolve(base,relative);
      if(!file.startsWith(resolve(base)+sep)){res.statusCode=403;res.end();return;}
      const types={js:'text/javascript',mjs:'text/javascript',html:'text/html',css:'text/css',json:'application/json',png:'image/png',svg:'image/svg+xml',wasm:'application/wasm'};
      res.setHeader('Content-Type',types[file.split('.').at(-1)]??'application/octet-stream');
      const stream=createReadStream(file);stream.on('error',()=>{res.statusCode=404;res.end();});stream.pipe(res);
    });},
  };
}

export async function startServer(output) {
  await mkdir(output,{recursive:true});
  const file=new URL('astro.config.mjs',output),config=referenceConfig();
  await writeFile(file,`import base from ${JSON.stringify(new URL('astro.config.mjs',project).href)};
import {oraclePlugin} from ${JSON.stringify(import.meta.url)};
export default {...base,vite:{...base.vite,cacheDir:${JSON.stringify(new URL('vite-cache/',output).pathname)},plugins:[...base.vite.plugins,oraclePlugin(${JSON.stringify(config)})]}};`);
  const server=await dev({root:project,configFile:file.pathname.slice(project.pathname.length),server:{host:'127.0.0.1',port:4418},logLevel:'error'});
  return {url:`http://127.0.0.1:${server.address.port}`,config,close:()=>server.stop()};
}
