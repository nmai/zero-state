import { describe, expect, it } from 'vitest';
import {
  diffRecords, idFromKey, listFromRecords, newNodeId, NodeRecord, nodeKey, readRecords, recordsFromList, withIds,
  withoutId,
} from '../src/services/storage-layout';
import { StoredNode } from '../src/types';

const list: StoredNode[] = [
  { id: 'a', name: 'Work' },
  { id: 'b', name: 'Docs', parent: 'Work', url: 'https://docs.example.com/' },
  { id: 'c', name: 'Home' },
  { id: 'd', name: 'Recipes', parent: 'Home' },
];

/** The records a list would have after being saved from scratch. */
const saved = (nodes: StoredNode[]) => recordsFromList(nodes, new Map());

/** Saves `next` over `previous`, and returns what the save writes and removes plus the result. */
function save(previous: StoredNode[], next: StoredNode[]) {
  const before = saved(previous);
  const after = recordsFromList(next, before);
  const { set, remove } = diffRecords(before, after);
  return { written: Object.keys(set).map(key => idFromKey(key)), removed: remove, records: after };
}

describe('node ids', () => {
  it('derives the same id from the same name, so devices creating the same node agree', () => {
    expect(newNodeId('Groceries', new Set())).toBe(newNodeId('Groceries', new Set()));
    expect(newNodeId('Groceries', new Set())).not.toBe(newNodeId('Groceries ', new Set()));
    expect(newNodeId('Groceries', new Set())).toMatch(/^[0-9a-z]{8}$/);
  });

  it('picks another id, still deterministically, when the derived one is taken', () => {
    const first = newNodeId('Groceries', new Set());
    const second = newNodeId('Groceries', new Set([first]));
    expect(second).not.toBe(first);
    expect(newNodeId('Groceries', new Set([first]))).toBe(second);
  });

  it('withIds reuses the ids of nodes with the same name', () => {
    const current: StoredNode[] = [{ id: 'kept', name: 'Work' }];
    const result = withIds([{ name: 'Work' }, { name: 'New' }], current);
    expect(result[0]).toEqual({ id: 'kept', name: 'Work' });
    expect(result[1].id).toBe(newNodeId('New', new Set()));
  });

  it('withIds never hands out an id that a reused node already has', () => {
    // A node created as "Foo" and later renamed keeps the id derived from "Foo"
    const renamed: StoredNode = { id: newNodeId('Foo', new Set()), name: 'Bar' };
    const result = withIds([{ name: 'Foo' }, { name: 'Bar' }], [renamed]);
    expect(result[1].id).toBe(renamed.id);
    expect(result[0].id).not.toBe(renamed.id);
  });

  it('maps ids to storage keys and back, ignoring other keys', () => {
    expect(nodeKey('abc')).toBe('links-v2:abc');
    expect(idFromKey('links-v2:abc')).toBe('abc');
    expect(idFromKey('links-v2')).toBeUndefined();
    expect(idFromKey('settings-v1')).toBeUndefined();
  });

  it('withoutId leaves only the node fields', () => {
    expect(withoutId({ id: 'a', name: 'Work', parent: 'Root' })).toEqual({ name: 'Work', parent: 'Root' });
  });
});

describe('records', () => {
  it('numbers a list saved from scratch in list order', () => {
    expect([...saved(list).values()].map(record => record.order)).toEqual([0, 1, 2, 3]);
    expect(saved(list).get('b')).toEqual({ name: 'Docs', parent: 'Work', url: 'https://docs.example.com/', order: 1 });
  });

  it('reads node records out of all storage items and lists them in order', () => {
    const items = {
      'links-v2': true,
      'links-v1': [{ name: 'Old' }],
      'settings-v1': { theme: 'dark' },
      'links-v2:c': { name: 'Home', order: 5 },
      'links-v2:a': { name: 'Work', order: -1 },
    };
    expect(listFromRecords(readRecords(items))).toEqual([{ id: 'a', name: 'Work' }, { id: 'c', name: 'Home' }]);
  });

  it('breaks order ties by id, so every device shows the same list', () => {
    // Two devices that each add an item at the end give both the same order
    const records = new Map<string, NodeRecord>([
      ['zz', { name: 'From laptop', order: 4 }],
      ['aa', { name: 'From desktop', order: 4 }],
      ['mm', { name: 'Earlier', order: 3 }],
    ]);
    expect(listFromRecords(records).map(node => node.id)).toEqual(['mm', 'aa', 'zz']);
  });

  it('round-trips a list through its records', () => {
    expect(listFromRecords(saved(list))).toEqual(list);
  });

  it('counts a record with the same fields in another key order as unchanged', () => {
    const before = new Map<string, NodeRecord>([['b', { url: 'https://docs.example.com/', order: 1, name: 'Docs', parent: 'Work' }]]);
    const after = new Map<string, NodeRecord>([['b', { name: 'Docs', parent: 'Work', url: 'https://docs.example.com/', order: 1 }]]);
    expect(diffRecords(before, after)).toEqual({ set: {}, remove: [] });
  });
});

describe('saving writes only what changed', () => {
  it('writes nothing when nothing changed', () => {
    expect(save(list, list.map(node => ({ ...node })))).toMatchObject({ written: [], removed: [] });
  });

  it('writes one node for an edit', () => {
    const next = list.map(node => (node.id === 'c' ? { ...node, taskComplete: true as const } : node));
    expect(save(list, next)).toMatchObject({ written: ['c'], removed: [] });
  });

  it('writes one node for an item added at the end, after the last one', () => {
    const { written, records } = save(list, [...list, { id: 'e', name: 'New' }]);
    expect(written).toEqual(['e']);
    expect(records.get('e')!.order).toBeGreaterThan(records.get('d')!.order);
  });

  it('only removes a deleted node and leaves the others alone', () => {
    expect(save(list, list.filter(node => node.id !== 'b'))).toMatchObject({ written: [], removed: ['b'] });
  });

  it('writes the renamed node and the children that point at it', () => {
    const next = list.map(node => {
      if (node.id === 'a') return { ...node, name: 'Office' };
      if (node.parent === 'Work') return { ...node, parent: 'Office' };
      return node;
    });
    expect(save(list, next)).toMatchObject({ written: ['a', 'b'], removed: [] });
  });

  it('rewrites a single record when two neighbors swap', () => {
    const next = [list[0], list[2], list[1], list[3]];
    const { written, records } = save(list, next);
    expect(written).toHaveLength(1);
    expect(listFromRecords(records)).toEqual(next);
  });

  it('rewrites the two swapped records when other nodes sit between them', () => {
    // Work and Home are siblings; Docs (Work's child) sits between them in the flat list
    const next = [list[2], list[1], list[0], list[3]];
    const { written, records } = save(list, next);
    expect(written).toHaveLength(2);
    expect(listFromRecords(records)).toEqual(next);
  });

  it('renumbers everything once moving items back and forth uses up the gap between them', () => {
    let current = list;
    let records = saved(current);
    for (let move = 0; move < 200; move++) {
      current = [current[0], current[2], current[1], current[3]];
      records = recordsFromList(current, records);
      expect(listFromRecords(records)).toEqual(current);
    }
    const orders = [...records.values()].map(record => record.order);
    expect(orders.every(Number.isFinite)).toBe(true);
  });

  it('replacing the whole list writes the new nodes and removes the old ones', () => {
    const next: StoredNode[] = [{ id: 'x', name: 'Imported' }, { id: 'a', name: 'Work' }];
    const { written, removed, records } = save(list, next);
    expect(written).toEqual(['x']); // Work keeps its record; Imported goes in front of it
    expect(removed.sort()).toEqual(['b', 'c', 'd']);
    expect(listFromRecords(records)).toEqual(next);
  });
});
