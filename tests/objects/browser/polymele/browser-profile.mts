import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/polymele/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polymele',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/polymele/polymele-model-surface@2x.webp','/scenes/polymele/polymele-lighting.webp','/scenes/polymele/polymele-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
