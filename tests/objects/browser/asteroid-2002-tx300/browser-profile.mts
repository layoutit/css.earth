import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/asteroid-2002-tx300/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-2002-tx300',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/asteroid-2002-tx300/asteroid-2002-tx300-model-surface@2x.webp','/scenes/asteroid-2002-tx300/asteroid-2002-tx300-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
