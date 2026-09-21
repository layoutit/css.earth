import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/goibniu/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'goibniu',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/goibniu/goibniu-model-surface@2x.webp','/scenes/goibniu/goibniu-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
