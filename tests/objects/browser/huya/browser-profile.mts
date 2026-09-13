import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/huya/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'huya',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/huya/huya-model-surface@2x.webp','/scenes/huya/huya-lighting.webp','/scenes/huya/huya-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
