import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/mani/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mani',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/mani/mani-model-surface@2x.webp','/scenes/mani/mani-lighting.webp','/scenes/mani/mani-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
