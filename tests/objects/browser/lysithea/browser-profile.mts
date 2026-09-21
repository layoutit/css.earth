import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/lysithea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lysithea',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/lysithea/lysithea-model-surface@2x.webp','/scenes/lysithea/lysithea-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
