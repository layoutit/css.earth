import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/pasiphae/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pasiphae',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/pasiphae/pasiphae-model-surface@2x.webp','/scenes/pasiphae/pasiphae-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
