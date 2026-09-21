import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/autonoe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'autonoe',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/autonoe/autonoe-model-surface@2x.webp','/scenes/autonoe/autonoe-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
