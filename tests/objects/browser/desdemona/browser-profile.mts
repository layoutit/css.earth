import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/desdemona/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'desdemona',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/desdemona/desdemona-model-surface@2x.webp','/scenes/desdemona/desdemona-lighting.webp','/scenes/desdemona/desdemona-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
