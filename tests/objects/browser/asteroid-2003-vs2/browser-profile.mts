import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/asteroid-2003-vs2/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-2003-vs2',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/asteroid-2003-vs2/asteroid-2003-vs2-model-surface@2x.webp','/scenes/asteroid-2003-vs2/asteroid-2003-vs2-lighting.webp','/scenes/asteroid-2003-vs2/asteroid-2003-vs2-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
