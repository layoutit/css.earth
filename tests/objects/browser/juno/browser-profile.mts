import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/juno/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'juno',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/juno/juno-directional-sun.webp",
      "two": "/scenes/juno/juno-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/juno/juno-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/juno/juno-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
