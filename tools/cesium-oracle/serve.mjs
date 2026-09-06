import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { resolve, sep } from 'node:path';
import { stat } from 'node:fs/promises';

const directory=resolve(process.argv[2]??''),port=Number(process.argv[3]??4429);
if(!process.argv[2]||!(await stat(resolve(directory,'index.html'))).isFile())throw new Error('Usage: pnpm oracle:cesium:serve <capture-directory> [port]');
const types={html:'text/html',json:'application/json',png:'image/png',mp4:'video/mp4',webm:'video/webm'};
const server=createServer(async(req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  const path=resolve(directory,'.'+(name==='/'?'/index.html':name));
  if(!path.startsWith(directory+sep)){res.writeHead(403);res.end();return;}
  let file;try{file=await stat(path);if(!file.isFile())throw new Error('Not a file');}catch{res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',types[path.split('.').at(-1)]??'application/octet-stream');
  res.setHeader('Accept-Ranges','bytes');
  let start=0,end=file.size-1;
  if(req.headers.range){
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(range&&(range[1]||range[2])){
      start=range[1]?Number(range[1]):Math.max(0,file.size-Number(range[2]));
      end=range[1]&&range[2]?Math.min(end,Number(range[2])):end;
    }else start=NaN;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=file.size){res.writeHead(416,{'Content-Range':`bytes */${file.size}`});res.end();return;}
    res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${file.size}`);
  }
  res.setHeader('Content-Length',Math.max(0,end-start+1));
  if(req.method==='HEAD'||!file.size){res.end();return;}
  const stream=createReadStream(path,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
});
server.listen(port,'127.0.0.1',()=>console.log(`Cesium loading report: http://127.0.0.1:${port}/`));
