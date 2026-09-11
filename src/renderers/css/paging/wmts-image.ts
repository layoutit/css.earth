import type { PreparedPage } from "./types.js";
export function isPreparedWmtsImage(page: Pick<PreparedPage,"rasterSource"|"url"|"width"|"height">) {
  if(page.rasterSource!=="terrascope-wmts@1"||page.width!==256||page.height!==256)return false;
  let url;try{url=new URL(page.url);}catch{return false;}
  if(url.origin!=="https://mapproxy.terrascope.be"||url.username||url.password||url.search||url.hash)return false;
  const match=url.pathname.match(/^\/mapproxy\/wmts\/esa-worldcover-s2rgbnir-10m-2021-v2_tcc\/webmercator\/(\d{2})\/(\d+)\/(\d+)\.png$/);
  if(!match)return false;
  const [z,x,y]=match.slice(1).map(Number);
  return z>=5&&z<=19&&x<2**z&&y<2**z;
}
