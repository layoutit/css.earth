import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/asporina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asporina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/asporina/asporina-directional-sun.webp",
      "two": "/scenes/asporina/asporina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/asporina/asporina-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/asporina/asporina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
