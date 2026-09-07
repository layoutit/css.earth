import {afterEach,expect,test,vi} from 'vitest';
import {mountPointFieldLabels} from './point-field-labels.js';
import type {StarLabelCandidate} from './point-field-labels.js';

class FakeElement {
  readonly style:Record<string,string>={}; readonly dataset:Record<string,string>={};readonly children:FakeElement[]=[];
  className='';textContent='';parent:FakeElement|null=null;flushes=0;hasLayout=true;
  readonly ownerDocument=fakeDocument;
  get offsetWidth(){return this.hasLayout?this.textContent.length*8:0;}
  get offsetHeight(){return this.hasLayout?17:0;}
  appendChild(child:FakeElement){this.children.push(child);child.parent=this;return child;}
  getBoundingClientRect(){this.flushes++;return{x:0,y:0,width:0,height:0};}
  remove(){if(this.parent){const index=this.parent.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);this.parent=null;}}
}
class FakeWindow {
  now=0; next=0; pending=new Map<number,(time:number)=>void>();
  requestAnimationFrame=(callback:(time:number)=>void)=>{const id=++this.next;this.pending.set(id,callback);return id;};
  cancelAnimationFrame=(id:number)=>{this.pending.delete(id);};
  performance={now:()=>this.now};
  frame(milliseconds:number){this.now+=milliseconds;const callbacks=[...this.pending.values()];this.pending.clear();for(const callback of callbacks)callback(this.now);}
}
const fakeWindow=new FakeWindow();
const fakeDocument={createElement:()=>new FakeElement(),defaultView:fakeWindow};
const policy={activeSlots:1,transitionSlots:1,capHeightPx:12,gapPx:7,maxAlpha:.8,fadeMs:500};
const star=(index:number,x:number,y:number,magnitude:number):StarLabelCandidate=>({index,name:`Star ${index}`,x,y,magnitude,radiusPx:1,luminance:.5});
afterEach(()=>vi.useRealTimers());

test('one brightest label stays anchored to its own star while another retires at a moving anchor',()=>{
  vi.useFakeTimers();const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  const retained=[...host.children];let a=star(1,10,20,1),b=star(2,-20,-10,2);
  const project=(index:number)=>index===1?a:index===2?b:null;
  labels.publish([a,b],project);
  fakeWindow.frame(500);
  const active=host.children[0]!,retiring=host.children[1]!;
  expect(active.textContent).toBe('Star 1');expect(active.style.transform).toBe('translate(10px,12px) translate(-50%,-100%)');
  expect(Number(active.style.opacity)).toBeCloseTo(.4);expect(active.style.transition).toBeUndefined();expect(active.flushes).toBe(0);
  b={...b,magnitude:0};labels.publish([a,b],project);
  expect(active.textContent).toBe('Star 2');expect(retiring.textContent).toBe('Star 1');
  expect(Number(retiring.style.opacity)).toBeCloseTo(.4);expect(retiring.style.transition).toBeUndefined();expect(vi.getTimerCount()).toBe(1);
  fakeWindow.frame(250);expect(Number(retiring.style.opacity)).toBeCloseTo(.2);
  a={...a,x:30,y:40};b={...b,x:-10,y:5};labels.publish([a,b],project);
  expect(active.style.transform).toBe('translate(-10px,-3px) translate(-50%,-100%)');
  expect(retiring.style.transform).toBe('translate(30px,32px) translate(-50%,-100%)');
  expect(host.children).toEqual(retained);vi.advanceTimersByTime(500);expect(vi.getTimerCount()).toBe(0);
  expect(active.dataset.starLabelIndex).toBe('2');labels.destroy();expect(host.children).toHaveLength(0);
});

test('destroy clears a pending retirement and prevents subsequent label publication',()=>{
  vi.useFakeTimers();const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  const a=star(1,0,0,1),b=star(2,10,0,0),project=(index:number)=>index===1?a:b;
  labels.publish([a],project);fakeWindow.frame(500);labels.publish([a,b],project);expect(vi.getTimerCount()).toBe(1);
  labels.destroy();labels.destroy();expect(vi.getTimerCount()).toBe(0);expect(host.children).toHaveLength(0);
  labels.publish([a,b],project);vi.runAllTimers();expect(host.children).toHaveLength(0);
});

test('retiring a label with a null projection preserves the departing identity',()=>{
  const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  const a=star(1,12,18,1);
  labels.publish([a],()=>a);fakeWindow.frame(500);
  labels.publish([],()=>null);
  const retiring=host.children[1]!;
  expect(retiring.textContent).toBe('Star 1');
  expect(retiring.style.transform).toBe('translate(12px,10px) translate(-50%,-100%)');
  expect(Number(retiring.style.opacity)).toBeCloseTo(.4);
  fakeWindow.frame(250);expect(Number(retiring.style.opacity)).toBeCloseTo(.2);
  labels.destroy();
});

test('foreground rectangles fade active and retiring text out and release it smoothly after removal',()=>{
  vi.useFakeTimers();const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  let a=star(1,0,0,1),b=star(2,120,0,0);const project=(index:number)=>index===1?a:b;
  labels.publish([a],project);fakeWindow.frame(500);
  const active=host.children[0]!,retiring=host.children[1]!,retained=[...host.children];
  const block={left:-12,top:-24,right:12,bottom:-8};
  labels.publish([a],project,[block]);expect(active.style.visibility).toBe('');
  expect(Number(active.style.opacity)).toBeCloseTo(.4);
  fakeWindow.frame(250);expect(Number(active.style.opacity)).toBeCloseTo(.2);
  labels.publish([a,b],project,[block]);expect(retiring.dataset.starLabelIndex).toBe('1');
  expect(retiring.style.visibility).toBe('');expect(Number(retiring.style.opacity)).toBeCloseTo(.2);
  fakeWindow.frame(250);expect(Number(retiring.style.opacity)).toBeCloseTo(.1);
  expect(Number(active.style.opacity)).toBeCloseTo(.2);
  // Move the foreground blocker onto the new winner while retirement is pending.
  const moved={left:108,top:-24,right:132,bottom:-8};
  labels.publish([a,b],project,[moved]);expect(Number(active.style.opacity)).toBeCloseTo(.2);
  fakeWindow.frame(250);expect(Number(active.style.opacity)).toBeCloseTo(.1);
  vi.advanceTimersByTime(500);fakeWindow.frame(500);expect(Number(active.style.opacity)).toBe(0);
  labels.publish([a,b],project);expect(Number(active.style.opacity)).toBe(0);
  fakeWindow.frame(250);expect(Number(active.style.opacity)).toBeCloseTo(.2);
  fakeWindow.frame(250);expect(Number(active.style.opacity)).toBeCloseTo(.4);
  expect(host.children).toEqual(retained);labels.destroy();
});

test('text width and three-pixel padding suppress collisions away from the star centre',()=>{
  const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  const a={...star(1,0,0,1),name:'A very wide star label'},project=()=>a;
  // The text spans ±88px; the foreground label is nowhere near the star point.
  labels.publish([a],project,[{left:90,top:-20,right:100,bottom:-10}]);
  fakeWindow.frame(500);expect(Number(host.children[0]!.style.opacity)).toBe(0);
  labels.publish([a],project,[{left:92,top:-20,right:100,bottom:-10}]);
  fakeWindow.frame(250);expect(Number(host.children[0]!.style.opacity)).toBeCloseTo(.2);labels.destroy();
});

test('overlapping star labels admit the brighter active label and suppress a departing collision',()=>{
  vi.useFakeTimers();const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,{...policy,activeSlots:2,transitionSlots:2});
  const a=star(1,0,0,1),b=star(2,20,0,2),c=star(3,0,0,0),project=(index:number)=>[a,b,c].find(candidate=>candidate.index===index)!;
  labels.publish([b,a],project);fakeWindow.frame(500);
  expect(host.children[0]!.dataset.starLabelIndex).toBe('1');expect(host.children[0]!.style.visibility).toBe('');
  expect(Number(host.children[1]!.style.opacity)).toBe(0);
  labels.publish([c,b],project);
  expect(host.children[0]!.dataset.starLabelIndex).toBe('3');expect(host.children[0]!.style.visibility).toBe('');
  expect(host.children[2]!.dataset.starLabelIndex).toBe('1');expect(Number(host.children[2]!.style.opacity)).toBeCloseTo(.4);
  fakeWindow.frame(250);expect(Number(host.children[2]!.style.opacity)).toBeCloseTo(.2);
  fakeWindow.frame(250);expect(Number(host.children[2]!.style.opacity)).toBe(0);
  labels.destroy();
});

test('collision reversal resumes from current alpha while moving anchors and repeated frames retain the deadline',()=>{
  const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  let a=star(1,0,0,1);const project=()=>a,block={left:-12,top:-24,right:12,bottom:-8},active=host.children[0]!;
  labels.publish([a],project);fakeWindow.frame(500);labels.publish([a],project,[block]);
  fakeWindow.frame(250);expect(Number(active.style.opacity)).toBeCloseTo(.2);
  a={...a,x:5};labels.publish([a],project);
  expect(Number(active.style.opacity)).toBeCloseTo(.2);expect(active.style.transform).toBe('translate(5px,-8px) translate(-50%,-100%)');
  fakeWindow.frame(125);expect(Number(active.style.opacity)).toBeCloseTo(.25);
  labels.publish([a],project);fakeWindow.frame(375);expect(Number(active.style.opacity)).toBeCloseTo(.4);
  labels.destroy();
});

test('an invisible unprojectable active label does not reserve stale bounds during retirement',()=>{
  vi.useFakeTimers();const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,{...policy,activeSlots:2,transitionSlots:2});
  const a={...star(1,0,0,0),luminance:0},b=star(2,180,0,1),c=star(3,0,0,2);
  let projectA=true;const project=(index:number)=>index===1?(projectA?a:null):index===2?b:c;
  labels.publish([a,b],project);fakeWindow.frame(500);
  labels.publish([a,c],project);expect(vi.getTimerCount()).toBe(1);
  projectA=false;labels.publish([c],project);
  expect(host.children[0]!.dataset.starLabelIndex).toBe('1');expect(Number(host.children[0]!.style.opacity)).toBe(0);
  expect(host.children[1]!.dataset.starLabelIndex).toBe('3');
  fakeWindow.frame(250);expect(Number(host.children[1]!.style.opacity)).toBeCloseTo(.2);
  labels.destroy();
});

test('a label first admitted without layout is measured when its host becomes visible',()=>{
  const host=new FakeElement(),labels=mountPointFieldLabels(host as unknown as HTMLElement,policy);
  const active=host.children[0]!,a=star(1,0,0,1);active.hasLayout=false;
  labels.publish([a],()=>a);expect(active.style.visibility).toBe('hidden');
  active.hasLayout=true;labels.publish([a],()=>a);expect(active.style.visibility).toBe('');labels.destroy();
});
