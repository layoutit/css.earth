import {parseControlledMosaic,parseControlledColorMosaic,parseControlledMetadata,numericRasterBands} from './source-records.mts';
import {execFile} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {fromFile} from 'geotiff';
import {controlledBodyFrame, colorPhotometricGain, readObservationVectors} from './photometric-observations.mts';
import {orthographicPoint} from './orthographic-observation.mts';
import {sampleColorBand} from './scientific-raster.mts';

const run = promisify(execFile), radians = Math.PI / 180;
/** Correct calibrated source frames before compositing, retaining the finest valid observation. */
export async function prepareControlledOrthographicMosaic(sourceDirectory: string, entries: readonly {path:string}[], value: unknown, width: number, height: number) {
  const recipe=parseControlledMosaic(value);
  if (entries.length !== 1 || !/^[a-z][a-z0-9_-]*$/.test(recipe.directory) || !recipe.imageIds?.length || recipe.imageIds.some(id => !/^c\d+$/.test(id))) {
    throw new Error('Controlled mosaic requires one pinned archive and exact frame identities.');
  }
  const profile = recipe.photometry;
  if (!(profile.radiusKm > 0) || !(profile.gamma > 0) || !(profile.displayMaximum > 0) ||
      !Number.isFinite(profile.weight) || profile.weight < 0 || profile.weight > 1 || !(profile.maximumGain >= 1) ||
      profile.phaseNormalization !== false || !Number.isSafeInteger(profile.matchStride) || profile.matchStride < 1 ||
      !(profile.minimumLevel > 0 && profile.minimumLevel <= 1 && profile.maximumLevel >= 1) ||
      ![profile.referenceIncidenceDegrees, profile.referenceEmissionDegrees].every(v => v >= 0 && v < 90) ||
      ![profile.maximumIncidenceDegrees, profile.maximumEmissionDegrees].every(v => v > 0 && v < 90)) {
    throw new Error('Invalid controlled mosaic correction.');
  }
  const {values, missing, statistics} = await correctedFilterMosaic(resolve(sourceDirectory, entries[0].path), recipe, sourceDirectory, width, height);
  const rgb=Buffer.alloc(width*height*3);
  for(let i=0;i<values.length;i++){
    const v=Math.round(255*Math.min(1,values[i]/profile.displayMaximum)**(1/profile.gamma));
    rgb.fill(v,i*3,i*3+3);
  }
  return {rgb,missing,grid:{model:'controlled-orthographic-photometric-mosaic',profile,frames:statistics}};
}

type ControlledMosaicRecipe = ReturnType<typeof parseControlledMosaic>;
/** One filter's photometrically corrected mosaic: finest frames win, each exposure matched to what is already placed. */
export async function correctedFilterMosaic(archive: string, recipe: Pick<ControlledMosaicRecipe,'directory'|'imageIds'|'filter'|'photometry'>, sourceDirectory: string, width: number, height: number) {
  const profile = recipe.photometry;
  const extract = async (name: string) => (await run('unzip', ['-p', archive, name], {encoding:'buffer',maxBuffer:128*1024*1024})).stdout;
  const vectors = await readObservationVectors(sourceDirectory, profile.vectors);
  const frames = [];
  for (const id of recipe.imageIds) {
    const member = `${recipe.directory}/${id}.ortho.tif`;
    const xml = (await extract(`${member}.aux.xml`)).toString('utf8');
    const match=xml.match(/<Metadata[^>]*>([\s\S]*?)<\/Metadata>/);if(!match)throw new Error('Missing controlled mosaic metadata.');
    const metadata = parseControlledMetadata(JSON.parse(match[1]));
    const cube = metadata.IsisCube, rotation = metadata.Table_BodyRotation;
    if (cube.BandBin.FilterName !== recipe.filter) throw new Error(`Unexpected filter: ${id}`);
    const et = rotation.CkTableStartTime, axes = controlledBodyFrame(rotation, et);
    const vector = (name: 'sun'|'observer') => {
      const sample = vectors[name].find(row => Math.abs(row.et-et)<.001);
      if (!sample?.position.every(Number.isFinite)) throw new Error(`Missing capture geometry: ${id}`);
      return axes.map(axis => axis.reduce((sum,v,i)=>sum+v*sample.position[i],0));
    };
    const geometry={sun:vector("sun"),observer:vector("observer")};
    frames.push({id,member,geometry,mapping:cube.Mapping});
  }
  frames.sort((a,b)=>b.mapping.PixelResolution.value-a.mapping.PixelResolution.value);
  const values = new Float32Array(width*height), missing = new Uint8Array(width*height).fill(1);
  const statistics = [], directory = await mkdtemp(resolve(tmpdir(),'cssearth-controlled-mosaic-'));
  try {
    for (const frame of frames) {
      const path = resolve(directory,'frame.tif'); await writeFile(path,await extract(frame.member));
      const file = await fromFile(path);
      try {
        const image = await file.getImage(), keys=image.getGeoKeys(), m=frame.mapping;
        if (!keys || image.getSampleFormat(0)!==3 || image.getSamplesPerPixel()!==1 || keys.ProjCoordTransGeoKey!==21 ||
            keys.ProjCenterLongGeoKey!==m.CenterLongitude || keys.ProjCenterLatGeoKey!==m.CenterLatitude ||
            keys.GeogSemiMajorAxisGeoKey!==profile.radiusKm*1000) throw new Error(`Controlled grid differs: ${frame.id}`);
        const band={filter:recipe.filter,data:numericRasterBands(await image.readRasters())[0],width:image.getWidth(),height:image.getHeight(),
          origin:image.getOrigin(),resolution:image.getResolution(),noData:image.getGDALNoData(),specialValueMagnitude:1e30};
        const firstY=Math.max(0,Math.floor((90-m.MaximumLatitude)/180*height)),lastY=Math.min(height,Math.ceil((90-m.MinimumLatitude)/180*height));
        const firstX=Math.floor(m.MinimumLongitude/360*width),lastX=Math.ceil(m.MaximumLongitude/360*width);
        const samples=[], ratios=[];
        for(let y=firstY;y<lastY;y++){
          const lat=90-(y+.5)*180/height,cl=Math.cos(lat*radians),sl=Math.sin(lat*radians);
          for(let column=firstX;column<lastX;column++){
            const x=(column+width)%width,i=y*width+x,lon=(x+.5)*360/width;
            const point=orthographicPoint(lon,lat,{centerLongitude:m.CenterLongitude,centerLatitude:m.CenterLatitude,radius:profile.radiusKm*1000});
            if(!point)continue;
            const source=sampleColorBand(band,point[0],point[1]);if(source===null)continue;
            const normal=[cl*Math.cos(lon*radians),cl*Math.sin(lon*radians),sl];
            const gain=colorPhotometricGain(normal,frame.geometry,profile.weight,profile);
            if(gain===null||gain>profile.maximumGain)continue;
            const value=Math.max(0,source)*gain;
            samples.push(i,value);
            // Robust co-located exposure fit, excluding unavailable and unstable signal.
            if(!missing[i]&&i%profile.matchStride===0&&value>.03&&values[i]>.03)ratios.push(values[i]/value);
          }
        }
        ratios.sort((a,b)=>a-b);
        const level=ratios.length>=profile.minimumMatchSamples?Math.max(profile.minimumLevel,Math.min(profile.maximumLevel,ratios[Math.floor(ratios.length/2)])):1;
        for(let j=0;j<samples.length;j+=2){values[samples[j]]=samples[j+1]*level;missing[samples[j]]=0;}
        statistics.push({id:frame.id,sourceResolutionMeters:band.resolution[0],correctedPixels:samples.length/2,level,overlapSamples:ratios.length});
      }finally{await file.close();}
    }
  }finally{await rm(directory,{recursive:true,force:true});}
  return {values, missing, statistics};
}

/** Red, green and blue from three corrected filter mosaics, each stretched to its own percentile where all three observed. */
export async function prepareControlledOrthographicColor(sourceDirectory: string, entries: readonly {path:string}[], value: unknown, width: number, height: number) {
  const recipe = parseControlledColorMosaic(value);
  if (entries.length !== 1 || recipe.channels.length !== 3 || !(recipe.stretchPercentile > 0.5 && recipe.stretchPercentile < 1) ||
      [...recipe.channels, recipe.monochrome].some(set => !set.imageIds.length || set.imageIds.some(id => !/^c\d+$/.test(id)))) {
    throw new Error('Controlled colour mosaic requires one pinned archive, three filters and exact frame identities.');
  }
  const archive = resolve(sourceDirectory, entries[0].path), profile = recipe.photometry;
  const channels: Awaited<ReturnType<typeof correctedFilterMosaic>>[] = [];
  for (const set of recipe.channels) channels.push(await correctedFilterMosaic(archive, {directory: recipe.directory, photometry: profile, ...set}, sourceDirectory, width, height));
  const mono = await correctedFilterMosaic(archive, {directory: recipe.directory, photometry: profile, ...recipe.monochrome}, sourceDirectory, width, height);
  const colored = (i: number) => channels.every(channel => !channel.missing[i]);
  const stretch = channels.map(channel => {
    const values = [];
    for (let i = 0; i < channel.values.length; i++) if (colored(i)) values.push(channel.values[i]!);
    if (!values.length) throw new Error('Controlled colour mosaic has no pixel observed in all three filters.');
    values.sort((a, b) => a - b);
    return values[Math.min(values.length - 1, Math.floor(values.length * recipe.stretchPercentile))]!;
  });
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  let colorPixels = 0, monochromePixels = 0;
  for (let i = 0; i < width * height; i++) {
    if (colored(i)) {
      colorPixels++;
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(255 * Math.min(1, channels[c]!.values[i]! / stretch[c]!) ** (1 / profile.gamma));
    } else if (!mono.missing[i]) {
      monochromePixels++;
      rgb.fill(Math.round(255 * Math.min(1, mono.values[i]! / profile.displayMaximum) ** (1 / profile.gamma)), i * 3, i * 3 + 3);
    } else missing[i] = 1;
  }
  return {rgb, missing, grid: {model: 'controlled-orthographic-photometric-color', profile,
    channels: recipe.channels.map((set, c) => ({filter: set.filter, stretch: stretch[c], frames: channels[c]!.statistics})),
    colorPixels, monochromePixels}};
}
