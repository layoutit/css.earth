import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/donaldjohanson/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'donaldjohanson',controls,audit:{
 canonicalPreparedAssets:['/scenes/donaldjohanson/donaldjohanson-llorri-surface@2x.webp'],
 lensRace:{defaultId:'llorri',slowId:'shape',winnerId:'llorri',slowAsset:'/scenes/donaldjohanson/donaldjohanson-shape-surface@2x.webp',preReadyDisabled:true},
 retained:{lensIds:['llorri','shape'],speedClicks:5,allowedMountSelectors:[]}
}});
