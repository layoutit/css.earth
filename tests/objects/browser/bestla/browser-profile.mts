import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/bestla/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bestla',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/bestla/bestla-model-surface@2x.webp','/scenes/bestla/bestla-lighting.webp','/scenes/bestla/bestla-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
