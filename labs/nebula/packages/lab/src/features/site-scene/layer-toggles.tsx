import { WORLD_LAYERS, type WorldLayer } from '@cssearth/renderer/universe/world-layers.ts';
import { InfoTip } from '../../ui/info-tip';
import './site-scene.css';

/** Each world layer's switch: an icon and one word (the page's own layers, @cssearth/renderer/universe/world-layers.ts). */
const LAYERS: Readonly<Record<WorldLayer, readonly [icon: string, label: string, tip: string]>> = {
  subject: ['◎', 'Object', 'The object this page is about: its dataset’s picture or volume.'],
  sky: ['◐', 'Sky', 'The sky around the Solar System and the far background.'],
  stars: ['✦', 'Stars', 'Stars: catalogue dots, star markers and clusters.'],
  galaxies: ['✺', 'Galaxies', 'Galaxies: their pictures, markers and catalogue dots, our own seen from outside.'],
  nebulae: ['☁', 'Nebulae', 'Other nebulae’s volumes, pictures and markers.'],
  planets: ['●', 'Planets', 'Planets, moons, dwarf planets, asteroids and comets.'],
  orbits: ['◯', 'Orbits', 'Every orbit line.'],
  labels: ['Aa', 'Labels', 'Every name and caption.'],
};

/** The left column of layer switches over the website's scene: each turns one world layer of the page on or off. */
export function LayerToggles({ hidden, disabled, onChange }: { hidden: readonly WorldLayer[]; disabled: boolean; onChange(hidden: WorldLayer[]): void }) {
  return <nav className="site-layer-toggles" aria-label="Scene layers">
    {WORLD_LAYERS.map(layer => {
      const [icon, label, tip] = LAYERS[layer], shown = !hidden.includes(layer);
      return <InfoTip key={layer} content={`${tip} ${shown ? 'Shown' : 'Hidden'}.`}>
        <button type="button" data-world-layer={layer} aria-label={label} aria-pressed={shown} aria-disabled={disabled}
          onClick={() => { if (!disabled) onChange(shown ? [...hidden, layer] : hidden.filter(value => value !== layer)); }}>
          <span aria-hidden="true">{icon}</span><span>{label}</span>
        </button>
      </InfoTip>;
    })}
  </nav>;
}
