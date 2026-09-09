import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/hedda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hedda',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hedda/hedda-directional-sun.webp",
      "two": "/scenes/hedda/hedda-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hedda/hedda-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hedda/hedda-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
