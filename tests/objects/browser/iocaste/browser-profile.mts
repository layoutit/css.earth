import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/iocaste/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'iocaste',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/iocaste/iocaste-model-surface@2x.webp','/scenes/iocaste/iocaste-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
