import { LinkNode, LinkNodeFlat } from '../types';

/**
 * Builds the display tree from the flat node list. Pure: same input, same
 * output, no side effects. Sibling order follows flat-list order, which is
 * why reordering swaps positions in the flat list.
 */
export function buildTree(flatList: LinkNodeFlat[]): LinkNode {
  const root: LinkNode = {
    name: 'Root',
    children: [],
  };

  // "Root" is addressable as a parent name for top-level attachment
  const nodeMap = new Map<string, LinkNode>([['Root', root]]);
  for (const item of flatList) {
    nodeMap.set(item.name, { ...item });
  }

  for (const item of flatList) {
    const node = nodeMap.get(item.name)!;
    if (node === root) continue;

    let parent = root;
    if (item.parent) {
      const found = nodeMap.get(item.parent);
      if (found) {
        parent = found;
      } else {
        console.warn(`Parent "${item.parent}" not found for "${item.name}", adding to root`);
      }
    }
    parent.children = parent.children ?? [];
    parent.children.push(node);
  }

  return root;
}

export function hasChildren(node: LinkNode): boolean {
  return !!node.children?.length;
}
