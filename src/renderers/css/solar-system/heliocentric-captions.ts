import { LABEL_OWNER_BODY,LABEL_OWNER_FOCUS,LABEL_OWNER_SUN,createLabelDeclutter,createLabelSlots,labelBox,labelFontPixels,validateLabelPolicy } from "@cssearth/engine";
import type { LabelPolicy,LabelMetrics,LabelEntry,LabelDeclutter,LabelSlots } from "@cssearth/engine";
import { selectStarLabel } from "@cssearth/engine";
import type { CatalogueStar,StarLabel } from "@cssearth/engine";
import { createExposure } from "@cssearth/engine";
import type { ExposureOptions } from "@cssearth/engine";
import type { HeliocentricProjection,PreparedPlanetarySystem } from './heliocentric-view.js';
import type { Vector2,VisibleRect,Matrix3 } from './types.js';
import type { Sprite,SystemMarkers } from './heliocentric-sprites.js';
import { bindObjectNavigationTarget } from './heliocentric-navigation.js';
const LABEL_OWNER_STAR = 3;
export interface StarCaptionPolicy extends LabelMetrics {poolSize:number;maxAlpha:number;maxAlphaStep:number;}
export interface CaptionPlan {policy:LabelPolicy;names:Readonly<Record<string,string>>;stars?:{policy:StarCaptionPolicy;records:readonly (CatalogueStar & {id:string})[];exposure:ExposureOptions};}
export type LabelPolicyOptions = Partial<Pick<LabelPolicy,'capPixels'|'gapPixels'|'spacingPixels'|'maxAlpha'|'maxAlphaStep'|'boxHeightCaps'>>;
interface CaptionCandidate extends LabelEntry {owner:number;id:string;box:ReturnType<typeof labelBox>;}
interface StarField {group:HTMLDivElement;element:HTMLElement;measures:Map<string,HTMLElement>;widths:Map<string,number>;policy:StarCaptionPolicy;pool:LabelSlots;candidate:StarLabel|null;accepted:boolean;measured:boolean;}
interface CaptionField {policy:LabelPolicy;group:HTMLDivElement;elements:HTMLElement[];measures:[string,HTMLElement][];widthPerCapHeight:Map<string,number>;declutter:LabelDeclutter;pool:LabelSlots;published:{text:string|null;transform:string|null;opacity:string|null;hidden:boolean}[];measured:boolean;settled:boolean;accepted:CaptionCandidate[];candidates:number;candidateList?:CaptionCandidate[];visibleRect?:VisibleRect|null;stars?:StarField;}
interface CaptionMount {host:HTMLElement;celestialRoot:HTMLElement;labels:CaptionPlan;objectId:string;markerSprite:Sprite;system:PreparedPlanetarySystem|null;systemMarkers:SystemMarkers|null;getMarkerOpacity:()=>string|null;getSunMarkerOpacity:()=>number;getSunMarkerHidden:()=>boolean;}
export function createHeliocentricCaptions({host,celestialRoot,labels,objectId,markerSprite,system,systemMarkers,getMarkerOpacity,getSunMarkerOpacity,getSunMarkerHidden}:CaptionMount) {
  const document = host.ownerDocument;
  let skyView: {matrix:string;rotation:Matrix3;exposure:Partial<ExposureOptions>|null} | null = null;
  let labelFrame: number | null = null;
  let lastProjection: HeliocentricProjection | null = null;
  let destroyed = false;
    const policy = labels.policy;
    const fontPixels = labelFontPixels(policy);
    const group = document.createElement("div");
    group.className = `planet-heliocentric-captions ${objectId}-captions`;
    group.style.fontSize = `${fontPixels}px`;
    const widthPerCapHeight = new Map<string,number>();
    const measures: [string,HTMLElement][] = [];
    for (const [id, name] of Object.entries(labels.names)) {
      const measure = document.createElement("s");
      measure.className = "planet-heliocentric-caption-measure";
      measure.textContent = name;
      group.appendChild(measure);
      measures.push([id, measure]);
    }
    const elements: HTMLElement[] = [];
    const navigation: ReturnType<typeof bindObjectNavigationTarget>[] = [];
    for (let index = 0; index < policy.poolSize; index += 1) {
      const element = document.createElement("s");
      element.className = `planet-heliocentric-caption ${objectId}-caption`;
      element.style.opacity = "0";
      element.style.visibility = "hidden";
      group.appendChild(element);
      elements.push(element);
      navigation.push(bindObjectNavigationTarget(element, host));
    }
    celestialRoot.appendChild(group);
    const labelField: CaptionField = {
      policy, group, elements, measures, widthPerCapHeight,
      declutter: createLabelDeclutter({ capacity: policy.candidateCapacity, spacingPixels: policy.spacingPixels }),
      pool: createLabelSlots({ poolSize: policy.poolSize, maxAlpha: policy.maxAlpha, maxAlphaStep: policy.maxAlphaStep }),
      published: elements.map(() => ({ text: null, transform: null, opacity: null, hidden: true })),
      measured: false,
      settled: false,
      accepted: [],
      candidates: 0,
    };
    if (labels.stars) {
      const { policy: starPolicy, records } = labels.stars;
      const starGroup = document.createElement("div");
      starGroup.className = "planet-heliocentric-star-captions";
      starGroup.ariaHidden = "true";
      starGroup.style.fontSize = `${labelFontPixels(starPolicy)}px`;
      const measures = new Map<string,HTMLElement>();
      for (const star of records) {
        const measure = document.createElement("s");
        measure.className = "planet-heliocentric-caption-measure planet-cubic-sky-caption";
        measure.textContent = star.name;
        starGroup.appendChild(measure);
        measures.set(star.id, measure);
      }
      const element = document.createElement("s");
      element.className = `planet-heliocentric-caption planet-cubic-sky-caption ${objectId}-star-caption`;
      element.style.opacity = "0";
      element.style.visibility = "hidden";
      starGroup.appendChild(element);
      labelField.stars = { group: starGroup, element, measures, widths: new Map(), policy: starPolicy,
        pool: createLabelSlots(starPolicy), candidate: null, accepted: false, measured: false };
    }
  if (labelField.stars) celestialRoot.appendChild(labelField.stars.group);
  return Object.freeze({
    count: labelField.elements.length,
    setSkyView({ matrix, exposure }: {matrix:string;exposure:Partial<ExposureOptions>|null}) {
      if (!labelField?.stars) return;
      if (skyView?.matrix !== matrix) {
        const m = new DOMMatrix(matrix);
        skyView = { matrix, rotation: [m.m11, m.m21, m.m31, m.m12, m.m22, m.m32, m.m13, m.m23, m.m33], exposure };
      } else skyView.exposure = exposure;
    },
    setLabelPolicy(options:LabelPolicyOptions|null = null) {
      if (labelField === null) return null;
      if (options !== null && (typeof options !== "object" || Array.isArray(options))) {
        throw new TypeError("Label policy options must be a record or null.");
      }
      const prepared = labels.policy;
      const next = { ...prepared };
      if (options !== null) {
        for (const [name, value] of Object.entries(options)) {
          if (!["capPixels", "gapPixels", "spacingPixels", "maxAlpha", "maxAlphaStep", "boxHeightCaps"].includes(name)) {
            throw new TypeError(`Unknown label policy knob: ${name}.`);
          }
          if (name === "capPixels" || name === "gapPixels" || name === "spacingPixels" || name === "maxAlpha" || name === "maxAlphaStep" || name === "boxHeightCaps") next[name] = value;
        }
        next.poolSize = prepared.poolSize;
        next.candidateCapacity = prepared.candidateCapacity;
      }
      validateLabelPolicy(next);
      labelField.policy = Object.freeze(next);
      labelField.group.style.fontSize = `${labelFontPixels(next)}px`;
      labelField.declutter = createLabelDeclutter({ capacity: next.candidateCapacity, spacingPixels: next.spacingPixels });
      labelField.pool.setMaxAlpha?.(next.maxAlpha);
      labelField.measured = false;
      return Object.freeze({ ...next, source: options === null ? "prepared" : "session" });
    },
    publish(projection:HeliocentricProjection, visibleRect:VisibleRect|null = null) { lastProjection=projection;publishCaptions(projection,visibleRect); },
    state() { return Object.freeze({
            policy: labelField.policy,
            candidateCount: labelField.candidates,
            acceptedCount: labelField.accepted.length,
            // Every candidate of the last pass with its box, and which were
            // accepted: enough for a test to recompute the pass on its own.
            candidates: Object.freeze((labelField.candidateList ?? []).map((candidate) => Object.freeze({
              key: candidate.key, owner: candidate.owner, id: candidate.id, text: candidate.text,
              priority: candidate.priority, anchor: candidate.anchor, alpha: candidate.alpha, ...candidate.box,
              accepted: labelField.accepted.includes(candidate),
            }))),
            poolSize: labelField.policy.poolSize,
            widthPerCapHeight: Object.freeze(Object.fromEntries(labelField.widthPerCapHeight)),
            slots: Object.freeze(labelField.pool.slots.map((slot) => Object.freeze({
              occupant: slot.occupant, text: slot.text, alpha: slot.alpha, target: slot.target,
              anchor: slot.anchor, bottomOffsetPx: slot.bottomOffsetPx,
            }))),
            stars: labelField.stars ? Object.freeze({ policy: labelField.stars.policy,
              candidate: labelField.stars.candidate, accepted: labelField.stars.accepted,
              slots: labelField.stars.pool.slots.map(slot => ({ ...slot, anchor: [...slot.anchor] })) }) : null,
          }); },
    destroy() {destroyed=true;for(const target of navigation)target.destroy();if(labelFrame!==null)host.ownerDocument.defaultView!.cancelAnimationFrame(labelFrame);},
  });
  function publishCaptions(projection:HeliocentricProjection, visibleRect:VisibleRect|null = null) {
    const field = labelField;
    field.visibleRect = visibleRect;
    if (!field.measured) {
      // Once: the retained measuring elements' widths, per cap height.
      const capPixels = field.policy.capPixels;
      for (const [id, element] of field.measures) {
        const width = element.getBoundingClientRect().width;
        field.widthPerCapHeight.set(id, width > 0 ? width / capPixels : field.policy.boxHeightCaps * 3);
      }
      field.measured = true;
    }
    const { policy, declutter } = field;
    declutter.reset();
    const candidates: CaptionCandidate[] = [];
    const consider = (owner:number, id:string, priority:number, screen:Vector2|null|undefined, markerRadiusPx:number, alpha:number) => {
      if (!(alpha > 0) || screen === null || screen === undefined) return;
      const geometry = labelBox(policy, { widthPerCapHeight: field.widthPerCapHeight.get(id)!, markerRadiusPx });
      const anchor = [screen[0], screen[1]];
      declutter.add({ owner, id, priority, anchor, ...geometry });
      candidates.push({ owner, id, key: `${owner}:${id}`, priority, anchor, alpha,
        text: labels.names[id], bottomOffsetPx: geometry.bottomOffsetPx,
        box: Object.freeze({ widthPx: geometry.widthPx, bottomOffsetPx: geometry.bottomOffsetPx, topOffsetPx: geometry.topOffsetPx }) });
    };
    // Focus retains priority even while a world flight places it off-centre.
    const ownMarkerOpacity = getMarkerOpacity() === null ? 0 : Number(getMarkerOpacity());
    consider(LABEL_OWNER_FOCUS, objectId, 1000, projection.body.visible ? projection.body.screen : null,
      Math.max(markerSprite.size / 2, projection.body.silhouetteRadius), ownMarkerOpacity);
    if (system !== null) {
      // The Sun: brightest of all (the reference ranks by -magnitude; the
      // Sun's -27 puts it above every planet), once its marker floors in.
      const sunVisible = !getSunMarkerHidden() && projection.sun.screen !== undefined;
      consider(LABEL_OWNER_SUN, "sun", 27, sunVisible ? projection.sun.screen : null,
        systemMarkers!.sun.size / 2, getSunMarkerOpacity());
      if (projection.system !== null) {
        for (const body of projection.system.bodies) {
          // Priority follows apparent magnitude; text keeps the caption
          // policy's brightness independently of the point's faint flux.
          consider(LABEL_OWNER_BODY, body.id, body.marker.labelPriority,
            body.marker.visible ? body.marker.screen : null, body.marker.diameterPx / 2, 1);
        }
      }
    }
    const stars = field.stars;
    if (stars && skyView) {
      if (!stars.measured) {
        for (const [id, measure] of stars.measures) stars.widths.set(id, measure.getBoundingClientRect().width);
        stars.measured = true;
      }
      const exposure = createExposure({ ...labels.stars!.exposure, ...skyView.exposure });
      const star = selectStarLabel({ stars: labels.stars!.records, rotation: skyView.rotation, exposure,
        focal: projection.focal, principalOffset: projection.principalOffset,
        visibleRect: visibleRect ?? { left: -projection.viewportWidth / 2, top: -projection.viewportHeight / 2,
          right: projection.viewportWidth / 2, bottom: projection.viewportHeight / 2 } });
      stars.candidate = star;
      if (star) {
        const box = labelBox(stars.policy, { widthPerCapHeight: stars.widths.get(star.id)! / stars.policy.capPixels,
          markerRadiusPx: star.radiusPx });
        declutter.add({ owner: LABEL_OWNER_STAR, id: star.id, priority: star.priority, anchor: star.anchor, ...box });
        candidates.push({ owner: LABEL_OWNER_STAR, id: star.id, key: `${LABEL_OWNER_STAR}:${star.id}`,
          priority: star.priority, anchor: star.anchor, alpha: star.alpha, text: star.name,
          bottomOffsetPx: box.bottomOffsetPx, box });
      }
    }
    field.candidates = candidates.length;
    field.candidateList = candidates;
    const acceptedKeys = new Set(declutter.resolve().map((entry) => `${entry.owner}:${entry.id}`));
    field.accepted = candidates.filter((candidate) => acceptedKeys.has(candidate.key));
    const slots = field.pool.assign(field.accepted.filter(candidate => candidate.owner !== LABEL_OWNER_STAR), field.settled);
    const visibleBodies = new Set((projection.system?.bodies ?? [])
      .filter(body => body.marker.visible && body.marker.alpha > 0).map(body => `${LABEL_OWNER_BODY}:${body.id}`));
    if (stars) {
      const accepted = field.accepted.filter(candidate => candidate.owner === LABEL_OWNER_STAR);
      stars.accepted = accepted.length > 0;
      const [slot] = stars.pool.assign(accepted, field.settled);
      const element = stars.element;
      const visible = slot.occupant !== null && slot.alpha > 0;
      if (visible) {
        if (element.textContent !== slot.text) element.textContent = slot.text;
        element.dataset.occupant = slot.occupant!;
        element.style.transform = `translate(${formatNumber(slot.anchor[0])}px, ${formatNumber(slot.anchor[1] - slot.bottomOffsetPx)}px) translate(-50%, -100%)`;
      }
      element.style.opacity = formatNumber(slot.alpha);
      element.style.visibility = visible ? "" : "hidden";
    }
    field.settled = true;
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const element = field.elements[index];
      const published = field.published[index];
      const hidden = slot.occupant === null || slot.alpha <= 0;
      const target = !hidden && slot.occupant !== null && visibleBodies.has(slot.occupant)
        ? candidates.find(candidate => candidate.key === slot.occupant && candidate.owner === LABEL_OWNER_BODY) : undefined;
      navigation[index].update(target?.id ?? null, target?.text);
      if (!hidden) {
        if (published.text !== slot.text) {
          element.textContent = slot.text;
          published.text = slot.text;
        }
        // Bottom-centre of the caption at the anchor, `bottomOffset` above it.
        const transform = `translate(${formatNumber(slot.anchor[0])}px, ` +
          `${formatNumber(slot.anchor[1] - slot.bottomOffsetPx)}px) translate(-50%, -100%)`;
        if (published.transform !== transform) {
          element.style.transform = transform;
          published.transform = transform;
        }
        const opacity = formatNumber(slot.alpha);
        if (published.opacity !== opacity) {
          element.style.opacity = opacity;
          published.opacity = opacity;
        }
      }
      if (published.hidden !== hidden) {
        element.style.visibility = hidden ? "hidden" : "";
        published.hidden = hidden;
      }
    }
    // Both caption populations finish their bounded fades after camera input
    // stops, including frames with no eligible star caption at all.
    if (labelFrame === null && (field.pool.slots.some(slot => slot.alpha !== slot.target) ||
        stars?.pool.slots.some(slot => slot.alpha !== slot.target))) {
      labelFrame = host.ownerDocument.defaultView!.requestAnimationFrame(() => {
        labelFrame = null;
        if (!destroyed && lastProjection) publishCaptions(lastProjection, field.visibleRect ?? null);
      });
    }
  }

}
function formatNumber(value:number) {return Math.abs(value)<1e-9?'0':Number(value.toFixed(6)).toString();}
