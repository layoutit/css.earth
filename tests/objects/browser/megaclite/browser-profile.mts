import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/megaclite/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'megaclite',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/megaclite/megaclite-model-surface@2x.webp','/scenes/megaclite/megaclite-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
