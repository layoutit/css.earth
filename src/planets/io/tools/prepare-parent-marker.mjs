import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { renderMarker } from "../../../../src/navigation/marker-recipe.mjs";
import { validateIoSourceGroup } from "./source-manifest.mjs";
import { parentMarkerOperations } from "./parent-marker.mjs";
import { IO_PUBLIC_ROOT, IO_PREPARED_ROOT, IO_SOURCE_ROOT } from "./preparation-paths.mjs";

const [source] = await validateIoSourceGroup("parent-marker");
const png = await renderMarker({schema:"cssearth-navigation-marker@1", planetId:source.bodyId,
  owner:"object", source, operations:parentMarkerOperations},
  {sourcePath:resolve(IO_SOURCE_ROOT,source.path),tileSize:1024});
const filename = `io-parent-${source.bodyId}.webp`;
await sharp(png).webp({lossless:true}).toFile(resolve(IO_PUBLIC_ROOT,filename));
await writeFile(resolve(IO_PREPARED_ROOT,"parent-marker.json"),JSON.stringify({
  id:source.bodyId,url:`/scenes/io/${filename}`,index:0,count:1,size:512,
}));
