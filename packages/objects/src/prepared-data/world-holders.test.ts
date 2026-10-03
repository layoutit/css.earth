import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { worldHolders } from './world-holders.js';

// A small world: the Sun's planets and a moon, a featured star with a planet, a plain-dot star with one and one without, a
// galaxy with a featured star, a named bound companion, a plain-dot one and a plain-dot asteroid.
const parents: Record<string, string> = {
  sun: 'solar-system', 'solar-system': 'milky-way', earth: 'earth-system', 'earth-system': 'solar-system', moon: 'earth-system', mercury: 'solar-system',
  ceres: 'solar-system', 'asteroid-1': 'solar-system', sirius: 'sirius-system', 'sirius-system': 'milky-way', 'sirius-b': 'sirius-system',
  'toi-1': 'toi-1-system', 'toi-1-system': 'milky-way', 'toi-1b': 'toi-1-system', 'plain-star': 'milky-way', lmc: 'milky-way', 'hv-1': 'lmc',
  'eps-a': 'eps-a-system', 'eps-a-system': 'milky-way', 'eps-b': 'eps-a-system', 'milky-way': 'local-group',
  'hat-1': 'hat-1-system', 'hat-1-system': 'milky-way', 'hat-1b': 'hat-1-system', 'hat-1-companion': 'hat-1-system',
};
const orbit = (centerBodyId: string) => ({ centerBodyId });
const bodies = [
  { id: 'earth', classification: 'planet', orbit: orbit('sun') }, { id: 'moon', classification: 'satellite', orbit: orbit('earth') },
  { id: 'mercury', classification: 'planet', orbit: orbit('sun') }, { id: 'ceres', classification: 'dwarf-planet', orbit: orbit('sun') },
  { id: 'asteroid-1', classification: 'asteroid', plainDot: true, orbit: orbit('sun') },
  { id: 'sirius', classification: 'star' }, { id: 'sirius-b', classification: 'star', orbit: orbit('sirius') },
  { id: 'toi-1', classification: 'star', plainDot: true }, { id: 'toi-1b', classification: 'exoplanet', orbit: orbit('toi-1') },
  { id: 'plain-star', classification: 'star', plainDot: true }, { id: 'lmc', classification: 'galaxy' }, { id: 'hv-1', classification: 'star' },
  { id: 'eps-a', classification: 'star' }, { id: 'eps-b', classification: 'star', boundTo: { hostId: 'eps-a' } },
  { id: 'hat-1', classification: 'star' }, { id: 'hat-1b', classification: 'exoplanet', orbit: orbit('hat-1') },
  { id: 'hat-1-companion', classification: 'star', plainDot: true, boundTo: { hostId: 'hat-1' } },
];
const holders = worldHolders('sun', bodies, id => parents[id], 'asteroid-bank');

describe('the file each world body is in', () => {
  it('is the object it is inside; a body with a system is drawn as that system, in the file of the object its system is inside', () => {
    assert.equal(holders.holderOf('mercury'), 'solar-system');
    assert.equal(holders.holderOf('earth'), 'solar-system', 'the Earth system is inside the Solar System');
    assert.equal(holders.holderOf('moon'), 'earth-system');
    assert.equal(holders.holderOf('sirius'), 'milky-way');
    assert.equal(holders.holderOf('sirius-b'), 'sirius-system');
    assert.equal(holders.holderOf('hv-1'), 'lmc');
    assert.equal(holders.holderOf('lmc'), 'milky-way');
    assert.equal(holders.holderOf('eps-b'), 'eps-a-system');
    assert.equal(holders.holderOf('sun'), undefined, 'the focus is the world\'s own');
  });

  it('keeps a plain dot out of its parent\'s file: a star with planets is in its system\'s, one without carries its own row, an asteroid is its bank\'s', () => {
    assert.equal(holders.holderOf('toi-1'), 'toi-1-system');
    assert.equal(holders.holderOf('toi-1b'), 'toi-1-system');
    assert.equal(holders.holderOf('plain-star'), 'plain-star');
    assert.ok(holders.ownRow('plain-star') && !holders.ownRow('toi-1') && holders.plainDotStar('toi-1'));
    assert.equal(holders.holderOf('asteroid-1'), 'asteroid-bank');
    // A plain-dot companion is in the file of the system it is bound into, still a dot of its galaxy, and brings that
    // file to no page that is not near it.
    assert.equal(holders.holderOf('hat-1-companion'), 'hat-1-system');
    assert.ok(holders.plainDotStar('hat-1-companion') && !holders.ownRow('hat-1-companion'));
    assert.equal(holders.drawnFromAnywhere('hat-1-system'), false);
    const unpackaged = worldHolders('sun', bodies, id => id === 'hat-1-companion' ? undefined : parents[id], 'asteroid-bank');
    assert.equal(unpackaged.holderOf('hat-1-companion'), 'hat-1-system', 'without a package, the system of the star it is bound to');
  });

  it('says which files are drawn from anywhere: one with a body that orbits nothing or the focus and is no plain dot or moon', () => {
    for (const id of ['solar-system', 'milky-way', 'lmc', 'eps-a-system']) assert.equal(holders.drawnFromAnywhere(id), true, id);
    for (const id of ['earth-system', 'sirius-system', 'toi-1-system', 'asteroid-bank', 'plain-star']) assert.equal(holders.drawnFromAnywhere(id), false, id);
  });

  it('places a body without a package in the system its orbit leads to, and refuses one with neither', () => {
    const unpackaged = worldHolders('sun', [...bodies, { id: 's13', classification: 'star', orbit: orbit('sirius') }], id => parents[id]);
    assert.equal(unpackaged.holderOf('s13'), 'sirius-system');
    assert.throws(() => worldHolders('sun', [{ id: 'rogue', classification: 'star' }], () => undefined).holderOf('rogue'), /World body rogue has no object package/);
  });
});
