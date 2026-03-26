// crdt.test.ts — Tests pour GCounter, LWWRegister, LWWMap
// Lance: pnpm test:ex58 (depuis exercices/)

import { describe, it, expect, vi } from 'vitest';
import { GCounter, LWWRegister, LWWMap } from './crdt.js';

describe('GCounter', () => {
  it('démarre à 0', () => {
    const c = new GCounter('node-A');
    expect(c.value()).toBe(0);
  });

  it('incrémente uniquement son propre nœud', () => {
    const c = new GCounter('node-A');
    c.increment(3);
    expect(c.value()).toBe(3);
  });

  it('retourne la somme de tous les nœuds', () => {
    const c = new GCounter('node-A', { 'node-A': 2, 'node-B': 5 });
    expect(c.value()).toBe(7);
  });

  it('fusionne en prenant le MAX pour chaque nœud', () => {
    const a = new GCounter('A', { A: 3, B: 1 });
    const b = new GCounter('B', { A: 1, B: 5 });

    a.merge(b);

    expect(a.state()).toEqual({ A: 3, B: 5 });
    expect(a.value()).toBe(8);
  });

  it('la fusion est idempotente (merge deux fois = merge une fois)', () => {
    const a = new GCounter('A', { A: 2, B: 3 });
    const b = new GCounter('B', { A: 2, B: 3 });

    a.merge(b);
    a.merge(b);

    expect(a.value()).toBe(5);
  });

  it('ne peut pas diminuer (merge ignore les valeurs plus petites)', () => {
    const a = new GCounter('A', { A: 10 });
    const b = new GCounter('B', { A: 1 });

    a.merge(b);

    expect(a.state()['A']).toBe(10);
  });
});

describe('LWWRegister', () => {
  it('retourne undefined initialement', () => {
    const r = new LWWRegister<string>('node-A');
    expect(r.value).toBeUndefined();
  });

  it('la dernière écriture (timestamp plus grand) gagne', () => {
    const r = new LWWRegister<string>('node-A');
    r.set('first', 100);
    r.set('second', 200);
    expect(r.value).toBe('second');
  });

  it("un timestamp plus ancien n'écrase pas une valeur plus récente", () => {
    const r = new LWWRegister<string>('node-A');
    r.set('recent', 200);
    r.set('old', 100);
    expect(r.value).toBe('recent');
  });

  it('merge: le registre avec le timestamp le plus récent gagne', () => {
    const a = new LWWRegister<string>('A', 'old', 100);
    const b = new LWWRegister<string>('B', 'new', 200);

    a.merge(b);

    expect(a.value).toBe('new');
  });

  it('merge: en cas d\'égalité de timestamp, le nodeId lexicographiquement supérieur gagne', () => {
    const ts = 500;
    const a = new LWWRegister<string>('node-A', 'value-A', ts);
    const b = new LWWRegister<string>('node-B', 'value-B', ts);

    a.merge(b);

    // 'node-B' > 'node-A' lexicographiquement
    expect(a.value).toBe('value-B');
  });

  it('merge est commutatif (a.merge(b) == b.merge(a))', () => {
    const a = new LWWRegister<number>('A', 1, 300);
    const bForA = new LWWRegister<number>('B', 2, 100);
    a.merge(bForA);

    const b = new LWWRegister<number>('B', 2, 100);
    const aForB = new LWWRegister<number>('A', 1, 300);
    b.merge(aForB);

    expect(a.value).toBe(b.value);
  });
});

describe('LWWMap', () => {
  it('stocke et récupère des valeurs par clé', () => {
    const m = new LWWMap<string>('node-A');
    m.set('name', 'Alice', 100);
    expect(m.get('name')).toBe('Alice');
  });

  it('retourne undefined pour une clé inexistante', () => {
    const m = new LWWMap<string>('node-A');
    expect(m.get('missing')).toBeUndefined();
  });

  it('fusionne les champs indépendamment', () => {
    const a = new LWWMap<string>('A');
    a.set('name', 'Alice', 100);
    a.set('city', 'Paris', 50);

    const b = new LWWMap<string>('B');
    b.set('name', 'Bob', 200); // plus récent
    b.set('city', 'Lyon', 10); // plus ancien

    a.merge(b);

    expect(a.get('name')).toBe('Bob'); // Bob gagne (ts 200 > 100)
    expect(a.get('city')).toBe('Paris'); // Paris gagne (ts 50 > 10)
  });

  it('merge intègre les nouvelles clés de l\'autre map', () => {
    const a = new LWWMap<number>('A');
    a.set('x', 1, 100);

    const b = new LWWMap<number>('B');
    b.set('y', 2, 200);

    a.merge(b);

    expect(a.get('x')).toBe(1);
    expect(a.get('y')).toBe(2);
  });
});
