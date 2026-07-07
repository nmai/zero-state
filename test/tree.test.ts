import { describe, expect, it } from 'vitest';
import { buildTree, hasChildren } from '../src/services/tree';
import { LinkNodeFlat } from '../src/types';

describe('buildTree', () => {
  it('returns an empty root for an empty list', () => {
    const root = buildTree([]);
    expect(root.name).toBe('Root');
    expect(root.children).toEqual([]);
  });

  it('attaches parentless nodes to the root in list order', () => {
    const root = buildTree([{ name: 'a' }, { name: 'b' }]);
    expect(root.children?.map(n => n.name)).toEqual(['a', 'b']);
  });

  it('nests children under their parent', () => {
    const list: LinkNodeFlat[] = [
      { name: 'parent' },
      { name: 'child', parent: 'parent' },
      { name: 'grandchild', parent: 'child' },
    ];
    const root = buildTree(list);
    expect(root.children).toHaveLength(1);
    const parent = root.children![0];
    expect(parent.children![0].name).toBe('child');
    expect(parent.children![0].children![0].name).toBe('grandchild');
  });

  it('orders siblings by flat-list position', () => {
    const list: LinkNodeFlat[] = [
      { name: 'p' },
      { name: 'second', parent: 'p' },
      { name: 'first', parent: 'p' },
    ];
    // Swap flat positions -> sibling order follows
    const swapped = [list[0], list[2], list[1]];
    const root = buildTree(swapped);
    expect(root.children![0].children!.map(n => n.name)).toEqual(['first', 'second']);
  });

  it('attaches nodes with a missing parent to the root', () => {
    const root = buildTree([{ name: 'orphan', parent: 'nope' }]);
    expect(root.children?.map(n => n.name)).toEqual(['orphan']);
  });

  it('treats "Root" as an addressable parent name', () => {
    const root = buildTree([{ name: 'x', parent: 'Root' }]);
    expect(root.children?.map(n => n.name)).toEqual(['x']);
  });

  it('does not mutate the input nodes', () => {
    const list: LinkNodeFlat[] = [{ name: 'p' }, { name: 'c', parent: 'p' }];
    buildTree(list);
    expect(list[0]).toEqual({ name: 'p' });
    expect('children' in list[0]).toBe(false);
  });
});

describe('hasChildren', () => {
  it('is true only for a non-empty children array', () => {
    expect(hasChildren({ name: 'x' })).toBe(false);
    expect(hasChildren({ name: 'x', children: [] })).toBe(false);
    expect(hasChildren({ name: 'x', children: [{ name: 'y' }] })).toBe(true);
  });
});
