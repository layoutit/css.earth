import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/clementina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'clementina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/clementina/clementina-directional-sun.webp",
      "two": "/scenes/clementina/clementina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/clementina/clementina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/clementina/clementina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
