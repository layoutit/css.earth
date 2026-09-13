import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/thalassa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thalassa',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/thalassa/thalassa-model-surface@2x.webp','/scenes/thalassa/thalassa-lighting.webp','/scenes/thalassa/thalassa-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
