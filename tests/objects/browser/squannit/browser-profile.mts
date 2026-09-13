import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/squannit/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'squannit',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/squannit/squannit-model-surface@2x.webp','/scenes/squannit/squannit-lighting.webp','/scenes/squannit/squannit-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
