import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/toutatis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'toutatis',controls,audit:{
 canonicalPreparedAssets:['/scenes/toutatis/toutatis-shape-surface@2x.webp'],
 retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}
}});
