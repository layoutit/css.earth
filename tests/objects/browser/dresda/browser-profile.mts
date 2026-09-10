import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/dresda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dresda',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dresda/dresda-directional-sun.webp",
      "two": "/scenes/dresda/dresda-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dresda/dresda-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/dresda/dresda-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
