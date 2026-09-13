import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/ajax/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ajax',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ajax/ajax-directional-sun.webp",
      "two": "/scenes/ajax/ajax-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ajax/ajax-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ajax/ajax-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
