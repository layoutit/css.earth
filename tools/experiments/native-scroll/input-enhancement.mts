/** Measurement fixture: JS pointer input drives the same CSS camera. */
const viewport=document.querySelector<HTMLElement>('.object-viewport');
const sensor=document.querySelector<HTMLElement>('.native-drag-frame');
if(!viewport||!sensor) throw new TypeError('The retained native input is missing.');
let x=0,y=0,pending=0;
let down:{id:number;x:number;y:number;baseX:number;baseY:number}|null=null;
const publish=()=>{pending=0;viewport.style.setProperty('--native-drag-x',String(x));viewport.style.setProperty('--native-drag-y',String(y));};
publish();
sensor.addEventListener('pointerdown',event=>{
 if(event.button!==0) return;
 down={id:event.pointerId,x:event.clientX,y:event.clientY,baseX:x,baseY:y};
 sensor.setPointerCapture(event.pointerId);event.preventDefault();
});
sensor.addEventListener('pointermove',event=>{
 if(!down||event.pointerId!==down.id)return;
 x=down.baseX+event.clientX-down.x;y=down.baseY+event.clientY-down.y;
 if(!pending)pending=requestAnimationFrame(publish);
});
const release=(event:PointerEvent)=>{
 if(!down||event.pointerId!==down.id)return;
 if(pending)cancelAnimationFrame(pending);publish();
 down=null;if(sensor.hasPointerCapture(event.pointerId))sensor.releasePointerCapture(event.pointerId);
};
sensor.addEventListener('pointerup',release);sensor.addEventListener('pointercancel',release);
document.documentElement.dataset.nativeInputReady='true';
