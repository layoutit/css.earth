import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ritona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ritona',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/ritona/ritona-model-surface@2x.webp','/scenes/ritona/ritona-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
