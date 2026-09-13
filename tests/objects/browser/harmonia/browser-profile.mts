import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/harmonia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'harmonia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/harmonia/harmonia-directional-sun.webp",
      "two": "/scenes/harmonia/harmonia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/harmonia/harmonia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/harmonia/harmonia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
