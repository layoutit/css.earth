import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/loge/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'loge',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/loge/loge-model-surface@2x.webp','/scenes/loge/loge-lighting.webp','/scenes/loge/loge-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
