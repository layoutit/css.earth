import {afterEach,expect,it,vi} from 'vitest';
import {createPreparedWheelZoomControls} from './prepared-wheel-zoom.js';
import type {PreparedWheelZoomOptions} from './prepared-wheel-zoom.js';
const pending=new Map<number,FrameRequestCallback>();let id=0;
class Surface {
  listeners=new Map<string,(event:WheelEvent)=>void>();
  ownerDocument={defaultView:{requestAnimationFrame:(cb:FrameRequestCallback)=>{pending.set(++id,cb);return id;},cancelAnimationFrame:(key:number)=>pending.delete(key)}};
  addEventListener(name:string,callback:(event:WheelEvent)=>void){this.listeners.set(name,callback);}
  removeEventListener(name:string){this.listeners.delete(name);}
}
afterEach(()=>{vi.unstubAllGlobals();pending.clear();});
it('applies the same wheel gesture proportionally to altitude, with reversible smooth intermediate frames', () => {
  vi.stubGlobal('HTMLElement',Surface);
  const surface=new Surface(),radius=6378;
  const camera={state:{rotX:0,rotY:0,zoom:1,distance:radius+60},update(){}};
  const controls=createPreparedWheelZoomControls({inputSurface:surface as unknown as HTMLElement,camera,
    runtimePolicy:{wheelZoomInputKind:()=> 'trackpad'} as PreparedWheelZoomOptions['runtimePolicy'],speedMultiplier:1,useScrollDistance:true,
    minimumZoom:.1,maximumZoom:4096,dolly:{stepPerDelta:.006,distanceOrigin:radius},
    trackballMetrics:()=>{throw new Error('Dolly must not rotate the surface.');},
    rotate(delta){camera.state.distance=delta.distance!;expect(delta.rotation).toBeUndefined();}});
  const tick=(time:number)=>{const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback(time);};
  const scroll=(deltaY:number,timeStamp:number)=>surface.listeners.get('wheel')!({deltaY,timeStamp,deltaMode:0,preventDefault(){}} as WheelEvent);
  scroll(-8,0);tick(100);const intermediate=camera.state.distance-radius;tick(200);
  const end=camera.state.distance-radius;
  expect(intermediate).toBeGreaterThan(end);expect(intermediate).toBeLessThan(60);
  expect(end/60).toBeCloseTo(.9531337870775047,10);
  scroll(8,300);tick(500);expect(camera.state.distance-radius).toBeCloseTo(60,9);
  camera.state.distance=radius+6000;scroll(-8,600);tick(800);
  expect((camera.state.distance-radius)/6000).toBeCloseTo(end/60,10);
  scroll(-8,900);tick(950);const stopped=camera.state.distance;controls.stop();tick(1100);
  expect(camera.state.distance).toBe(stopped);controls.destroy();expect(pending.size).toBe(0);
});
