import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/styx/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'styx',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/styx/styx-model-surface@2x.webp','/scenes/styx/styx-lighting.webp','/scenes/styx/styx-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
