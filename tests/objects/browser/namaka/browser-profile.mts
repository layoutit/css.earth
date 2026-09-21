import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/namaka/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'namaka',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/namaka/namaka-model-surface@2x.webp','/scenes/namaka/namaka-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
