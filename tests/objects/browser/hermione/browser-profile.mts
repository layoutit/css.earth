import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/hermione/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hermione',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hermione/hermione-directional-sun.webp",
      "two": "/scenes/hermione/hermione-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hermione/hermione-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hermione/hermione-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
