import { LinkNode, LinkNodeFlat } from '../core/types';

export class TreeService {
  private static lastRawListJson: string = '';
  private static cachedTree: LinkNode | null = null;

  static buildTree(rawList: LinkNodeFlat[]): LinkNode {
    const currentJson = JSON.stringify(rawList);
    if (this.cachedTree && this.lastRawListJson === currentJson) {
      return this.cachedTree;
    }

    const root: LinkNode = { name: 'Root', children: [] };
    const nodeMap: Record<string, LinkNode> = { 'Root': root };

    for (const item of rawList) {
      nodeMap[item.name] = { ...item };
    }

    for (const item of rawList) {
      const node = nodeMap[item.name];

      if (item.parent) {
        const parentNode = nodeMap[item.parent];

        if (parentNode) {
          parentNode.children = parentNode.children || [];
          parentNode.children.push(node);
        } else {
          console.warn(`Parent "${item.parent}" not found for "${item.name}", adding to root`);
          root.children!.push(node);
        }
      } else {
        root.children!.push(node);
      }
    }

    this.lastRawListJson = currentJson;
    this.cachedTree = root;

    return root;
  }

  static hasChildren(node: LinkNode): boolean {
    return Boolean(node.children && node.children.length > 0);
  }
}
