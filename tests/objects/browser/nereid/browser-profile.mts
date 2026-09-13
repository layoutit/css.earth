import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/nereid/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nereid',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/nereid/nereid-model-surface@2x.webp','/scenes/nereid/nereid-lighting.webp','/scenes/nereid/nereid-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
