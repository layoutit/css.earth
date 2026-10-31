/** The bank's far pictures in one arm's grade: a global channel gain from the fit, on the prepared pictures. They hold every component in one image, so nothing finer is possible without rendering them again. */
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { GRADES_RECORD } from './dots-all.mts';
import { L37_DIR } from './regions.mts';
export async function gradeFar(arm: string) {
  const { channelGains } = (JSON.parse(await readFile(GRADES_RECORD, 'utf8')) as Record<string, { channelGains: number[] }>)[arm]!, from = 'src/objects/lmc-volume/.local/versions/l36/delivery/far-model/bank/', to = L37_DIR + 'grades/' + arm + '-far/'; await mkdir(to, { recursive: true });
  const lut = channelGains.map(g => Uint8Array.from({ length: 256 }, (_, v) => { const x = v / 255, l = x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4, o = Math.min(1, l * g); return Math.round(255 * (o <= .0031308 ? 12.92 * o : 1.055 * o ** (1 / 2.4) - .055)); }));
  for (const name of await readdir(from)) { const { data, info } = await sharp(from + name).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = lut[c]![data[i + c]!]!; await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 6 }).toFile(to + name); }
  console.log('GRADE_FAR ' + arm + ' ' + JSON.stringify(channelGains));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await gradeFar(process.argv[2]!);
