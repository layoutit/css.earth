import { registerBodyDependentLayers } from '../body-layer-registration.mjs';

// Controlled native element boundary; registrations use the production owner.
export function bodyLayerFixture(parentStage = null) {
  const node = className => ({ nodeType: 1, className, style: {}, children: [], parentNode: null,
    get isConnected() { return this === stage || this.parentNode?.isConnected === true; },
    contains(child) { return child === this || this.children.some(node => node.contains(child)); },
    closest(selector) { return this.className === selector.slice(1) ? this : this.parentNode?.closest(selector) ?? null; },
    append(child) { child.remove(); this.children.push(child); child.parentNode = this; },
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; },
  });
  const stage = parentStage ?? node('planet-stage'), cameraElement = node('polycss-camera'), sceneElement = node('polycss-scene'), body = node('body'), overlay = node('lighting');
  stage.append(cameraElement); cameraElement.append(sceneElement); sceneElement.append(body); stage.append(overlay);
  const registration = registerBodyDependentLayers({ objectId: 'moon', sceneElement, bodySystem: body, lightingOverlays: [overlay] });
  return { stage, cameraElement, sceneElement, body, overlay, bodyLayers: Object.freeze([registration]) };
}
