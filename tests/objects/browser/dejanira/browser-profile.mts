import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/dejanira/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dejanira',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dejanira/dejanira-directional-sun.webp",
      "two": "/scenes/dejanira/dejanira-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dejanira/dejanira-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dejanira/dejanira-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
