import { open,stat } from "node:fs/promises";

// A local mirror of the immutable production packs. Keep the world dataset
// outside the static application bundle; production reads the same bytes on R2.
export function wmtsLocalMirror({directory=new URL("../../../../.local/wmts-global/",import.meta.url)}={}){
  const install=server=>{server.middlewares.use(async(req,res,next)=>{
    const match=/^\/scenes\/earth\/wmts-([a-f0-9]{16})\/((?:5|8)-\d+-\d+\.pack)$/u.exec(req.url??"");
    if(!match)return next();
    if(!["GET","HEAD"].includes(req.method)){res.statusCode=405;res.end();return;}
    let handle;
    try{
      const path=new URL(`${match[1]}/${match[2]}`,directory),info=await stat(path),range=/^bytes=(\d+)-(\d+)$/u.exec(req.headers.range??"");
      if(!range){res.statusCode=416;res.end("A bounded prepared range is required.");return;}
      const start=Number(range[1]),end=Number(range[2]),length=end-start+1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end>=info.size||length<1||length>2*1024*1024){res.statusCode=416;res.end();return;}
      res.statusCode=206;res.setHeader("Content-Range",`bytes ${start}-${end}/${info.size}`);res.setHeader("Content-Length",length);
      res.setHeader("Content-Type","application/octet-stream");res.setHeader("Accept-Ranges","bytes");res.setHeader("Cache-Control","public,max-age=31536000,immutable");
      if(req.method==="HEAD"){res.end();return;}
      handle=await open(path);const bytes=Buffer.alloc(length),result=await handle.read(bytes,0,length,start);
      if(result.bytesRead!==length)throw new Error("Incomplete local prepared range.");res.end(bytes);
    }catch(error){res.statusCode=error.code==="ENOENT"?404:500;res.end("Prepared geometry is unavailable.");}
    finally{await handle?.close();}
  });};
  return {name:"earth-prepared-geometry-mirror",configureServer:install,configurePreviewServer:install};
}
