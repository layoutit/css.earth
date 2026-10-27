/** Keep the approved Earth calibration while refining only its numerical representation. */
import {writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {pinsFor,pngRgb,measure} from '../owner-rounds/pins.mts';
import {versionDir} from '../sequence-state.mts';
import {RESOLUTION_DIR} from './resolution-cameras.mts';
import {requireNativeAgreement,downsampleLinear} from './reference.mts';
import {need} from '../inputs.mts';
import {loadObservation} from '../observation.mts';
import {imageBytes} from '../report.mts';
import {normalized} from '../grade-report.mts';
const size=Number(process.argv[2]??512);need(size===512||size===1024,'Choose a completed small or native Earth render');let path=RESOLUTION_DIR+'views-512/earth.png';if(size===1024){const b=await readFile(RESOLUTION_DIR+'views-1024/earth.f64le');need(b.length===1024*768*3*8,'Native Earth pixels are incomplete');const reduced=downsampleLinear(new Float64Array(Uint8Array.from(b).buffer),1024,768,2),o=await loadObservation(8);path=RESOLUTION_DIR+'views-1024/earth-512.png';await sharp(imageBytes(normalized(reduced,o),o,true),{raw:{width:512,height:384,channels:3}}).png().toFile(path);}
const current=await pngRgb(path),previous=await pngRgb(versionDir(36)+'earth.png'),rows=pinsFor(36).map(pin=>{const a=measure(previous,pin),b=measure(current,pin);return{pin:pin.id,previous:a,current:b,colorRatioChange:Math.max(Math.abs(b.rg/a.rg-1),Math.abs(b.bg/a.bg-1)),brightnessChange:Math.abs(b.light/a.light-1)};}),maxColor=Math.max(...rows.map(r=>r.colorRatioChange)),maxBrightness=Math.max(...rows.map(r=>r.brightnessChange));
await writeFile(RESOLUTION_DIR+`earth-pin-check-${size}.json`,JSON.stringify({size,maxColorRatioChange:maxColor,maxBrightnessChange:maxBrightness,tolerance:.02,rows},null,2)+'\n');requireNativeAgreement(maxColor,maxBrightness);console.log(JSON.stringify({sentinel:'RESOLUTION_EARTH_PINS_PASS',size,maxColor,maxBrightness}));
