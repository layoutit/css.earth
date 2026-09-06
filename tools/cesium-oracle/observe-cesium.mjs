// These are private observation points in exactly Cesium 1.145.0. The verified
// unmodified upstream bundle is loaded first; no scheduling policy is replaced.
export function observeCesium(C, viewer, layer, trace) {
  if (C.VERSION !== '1.145.0') throw new Error(`Unsupported Cesium oracle version ${C.VERSION}`);
  const required = [[C.ImageryLayer.prototype,'getImageryFromCache'],[C.ImageryLayer.prototype,'removeImageryFromCache'],
    [C.RequestScheduler,'request'],[C.TileImagery.prototype,'processStateMachine']];
  for (const [object,key] of required) if (typeof object[key] !== 'function') throw new Error(`Cesium hook missing: ${key}`);
  const imageIds = new WeakMap(), requestIds = new WeakMap(), targets = new WeakMap();
  let sequence = 0;
  const enumName = (values, state) => Object.keys(values).find(key => values[key] === state) ?? `UNKNOWN:${state}`;
  const tileId = tile => tile ? `${tile.level}/${tile.x}/${tile.y}` : null;
  const imageInfo = image => image ? { id:imageIds.get(image),tile:tileId(image),state:enumName(C.ImageryState,image.state),references:image.referenceCount } : null;
  function watchState(object, values, type, extra) {
    let state = object.state;
    const emit = () => trace.event(type, {...extra(),state:enumName(values,state)});
    Object.defineProperty(object,'state',{configurable:true,enumerable:true,get:()=>state,set(value){if(value!==state){state=value;emit();}}});
    emit();
  }
  function watchImage(image) {
    if (imageIds.has(image)) return image;
    const id = `image-${++sequence}`; imageIds.set(image,id);
    watchState(image,C.ImageryState,'imagery-state',()=>({id,tile:tileId(image)}));
    return image;
  }
  const getImage = layer.getImageryFromCache;
  layer.getImageryFromCache = function(...args){return watchImage(getImage.apply(this,args));};
  const removeImage = layer.removeImageryFromCache;
  layer.removeImageryFromCache = function(image){trace.event('imagery-evict',imageInfo(image));return removeImage.call(this,image);};
  const request = C.RequestScheduler.request;
  C.RequestScheduler.request = function(r) {
    if (!requestIds.has(r)) {
      const id = `request-${++sequence}`;requestIds.set(r,id);
      watchState(r,C.RequestState,'request-state',()=>({id,url:r.url,priority:r.priority,throttle:r.throttle,throttleByServer:r.throttleByServer}));
    }
    const result=request.call(this,r);
    if(result===undefined) trace.event('request-deferred',{id:requestIds.get(r),url:r.url,server:r.serverKey,priority:r.priority});
    return result;
  };
  const processTile = C.TileImagery.prototype.processStateMachine;
  C.TileImagery.prototype.processStateMachine = function(...args){
    if(this.loadingImagery?.imageryLayer===layer) targets.set(this,tileId(this.loadingImagery));
    return processTile.apply(this,args);
  };
  for(const image of Object.values(layer._imageryCache))watchImage(image);
  viewer.scene.globe.tileLoadProgressEvent.addEventListener(pending=>trace.event('terrain-load-progress',{pending}));
  layer.imageryProvider.errorEvent.addEventListener(error=>trace.event('provider-error',{message:error.message,x:error.x,y:error.y,level:error.level,retry:error.retry}));

  function sample() {
    const globe=viewer.scene.globe, q=globe._surface, provider=q._tileProvider;
    if(!Array.isArray(q._tilesToRender)||!Array.isArray(q._tileLoadQueueHigh)||!Array.isArray(provider._drawCommands))throw new Error('Cesium quadtree observation drift');
    const images=Object.values(layer._imageryCache).map(image=>({...imageInfo(image),decoded:!!image.image,
      texture:!!image.texture,textureWebMercator:!!image.textureWebMercator,parent:tileId(image.parent),request:image.request?{id:requestIds.get(image.request),state:enumName(C.RequestState,image.request.state),priority:image.request.priority}:null}));
    const terrain=tile=>({tile:tileId(tile),state:enumName(C.QuadtreeTileLoadState,tile.state),renderable:tile.renderable,
      priority:tile._loadPriority,distance:tile._distance,imagery:(tile.data?.imagery??[]).filter(t=>(t.readyImagery??t.loadingImagery)?.imageryLayer===layer).map(t=>({
        wanted:targets.get(t)??tileId(t.loadingImagery??t.readyImagery),ready:imageInfo(t.readyImagery),loading:imageInfo(t.loadingImagery),
        fallback:!!t.readyImagery&&tileId(t.readyImagery)!==(targets.get(t)??tileId(t.loadingImagery??t.readyImagery))}))});
    // Read the actual submitted globe commands' texture bindings. An image in
    // the cache or even a ready tile is not necessarily in a draw command.
    const textureIds=new Map();for(const im of Object.values(layer._imageryCache))for(const tex of [im.texture,im.textureWebMercator])if(tex)textureIds.set(tex,imageInfo(im));
    const submitted=new Set(viewer.scene.frameState.commandList);
    const draws=provider._drawCommands.slice(0,provider._usedDrawCommands).filter(c=>submitted.has(c)).map(c=>({
      tile:tileId(c.owner),images:(c.uniformMap?.properties?.dayTextures??[]).map(t=>textureIds.get(t)??{unknown:true})}));
    const heap=C.RequestScheduler.requestHeap;
    const camera=viewer.camera;
    return {at:performance.now(),frame:viewer.scene.frameState.frameNumber,
      policy:{maximumScreenSpaceError:globe.maximumScreenSpaceError,loadingDescendantLimit:globe.loadingDescendantLimit,
        preloadAncestors:globe.preloadAncestors,preloadSiblings:globe.preloadSiblings,resolutionScale:viewer.resolutionScale,
        drawingBufferWidth:viewer.scene.drawingBufferWidth,drawingBufferHeight:viewer.scene.drawingBufferHeight},
      camera:{position:Array.from(C.Cartesian3.pack(camera.positionWC,[])),direction:Array.from(C.Cartesian3.pack(camera.directionWC,[])),up:Array.from(C.Cartesian3.pack(camera.upWC,[])),
        viewMatrix:Array.from(C.Matrix4.pack(camera.viewMatrix,[])),projection:Array.from(C.Matrix4.pack(camera.frustum.projectionMatrix,[]))},
      images,rendered:q._tilesToRender.map(terrain),draws,
      queues:Object.fromEntries(['High','Medium','Low'].map(name=>[name.toLowerCase(),q['_tileLoadQueue'+name].map(terrain)])),
      scheduler:{...C.RequestScheduler.statistics,heap:heap.internalArray.slice(0,heap.length).map(r=>({id:requestIds.get(r),url:r.url,priority:r.priority,state:enumName(C.RequestState,r.state)})),
        maximumRequests:C.RequestScheduler.maximumRequests,maximumRequestsPerServer:C.RequestScheduler.maximumRequestsPerServer},
      cache:{terrainTiles:q._tileReplacementQueue.count,terrainLimit:globe.tileCacheSize},tilesLoaded:globe.tilesLoaded};
  }
  return {sample};
}
