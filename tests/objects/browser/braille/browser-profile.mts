import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/braille/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'braille',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/braille/braille-model-surface@2x.webp','/scenes/braille/braille-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
