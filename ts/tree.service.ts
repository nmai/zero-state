import { AppState } from './app.state';
import { LinkNode, LinkNodeFlat } from './types';

// Tree Service
export class TreeService {
  // Cache the last built tree to avoid unnecessary rebuilds
  private static lastRawListJson: string = '';
  private static cachedTree: LinkNode | null = null;

  static buildTree(rawList: LinkNodeFlat[]): LinkNode {
    // Check if we already have a cached result for this exact list
    const currentJson = JSON.stringify(rawList);
    if (this.cachedTree && this.lastRawListJson === currentJson) {
      return this.cachedTree;
    }
    
    const root: LinkNode = {
      name: 'Root',
      children: []
    };
    
    // Create a map for O(1) lookups
    const nodeMap: Record<string, LinkNode> = { 'Root': root };
    
    // First pass: Create all nodes without connecting them
    for (const item of rawList) {
      nodeMap[item.name] = { ...item };
    }
    
    // Second pass: Connect nodes to their parents
    for (const item of rawList) {
      const node = nodeMap[item.name];
      
      if (item.parent) {
        const parentNode = nodeMap[item.parent];
        
        if (parentNode) {
          parentNode.children = parentNode.children || [];
          parentNode.children.push(node);
        } else {
          // If parent doesn't exist, add to root
          console.warn(`Parent "${item.parent}" not found for "${item.name}", adding to root`);
          root.children!.push(node);
        }
      } else {
        // Add root-level items directly to root
        root.children!.push(node);
      }
    }
    
    // Cache the result for future use
    this.lastRawListJson = currentJson;
    this.cachedTree = root;
    
    // Update the createdTable state (used elsewhere in the app)
    AppState.createdTable.val = nodeMap;
    
    return root;
  }

  static hasChildren(node: LinkNode): boolean {
    return Boolean(node.children && node.children.length > 0);
  }
}