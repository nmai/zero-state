import { DEFAULT_SETTINGS } from '../core/constants';
import { LinkNode, LinkNodeFlat, Settings } from '../core/types';
import { state } from '../core/van';

export class DataState {
  static rawList = state<LinkNodeFlat[]>([]);
  static names = state<string[]>([]);
  static root = state<LinkNode>({ name: 'Root', children: [] });
  static settings = state<Settings>(DEFAULT_SETTINGS);

  // Cache of name to index for O(1) lookups
  private static nameToIndexMap: Map<string, number> = new Map();

  static updateNames(): void {
    this.names.val = this.rawList.val.map(item => item.name);

    this.nameToIndexMap.clear();
    this.rawList.val.forEach((item, index) => {
      this.nameToIndexMap.set(item.name, index);
    });
  }

  static addItem(item: LinkNodeFlat): void {
    this.rawList.val = [...this.rawList.val, item];
    this.nameToIndexMap.set(item.name, this.rawList.val.length - 1);
    this.names.val = [...this.names.val, item.name];
  }

  static removeItem(item: LinkNodeFlat): void {
    const index = this.nameToIndexMap.get(item.name);

    if (index !== undefined) {
      const newList = [...this.rawList.val];
      newList.splice(index, 1);
      this.rawList.val = newList;
      this.updateNames();
    }
  }

  static toggleTaskComplete(node: LinkNodeFlat): void {
    const index = this.nameToIndexMap.get(node.name);

    if (index === undefined) return;

    const newList = [...this.rawList.val];
    newList[index] = { ...newList[index] };

    if (node.taskComplete) delete newList[index].taskComplete;
    else newList[index].taskComplete = true;

    this.rawList.val = newList;
  }

  static swapNodePositions(node1: LinkNodeFlat, node2: LinkNodeFlat): void {
    const index1 = this.nameToIndexMap.get(node1.name);
    const index2 = this.nameToIndexMap.get(node2.name);

    if (index1 !== undefined && index2 !== undefined) {
      const newList = [...this.rawList.val];
      [newList[index1], newList[index2]] = [newList[index2], newList[index1]];
      this.rawList.val = newList;

      this.nameToIndexMap.set(node1.name, index2);
      this.nameToIndexMap.set(node2.name, index1);
    }
  }

  static updateItem(originalName: string, updatedItem: LinkNodeFlat): void {
    const index = this.nameToIndexMap.get(originalName);

    if (index !== undefined) {
      const newList = [...this.rawList.val];
      newList[index] = updatedItem;
      this.rawList.val = newList;

      if (originalName !== updatedItem.name) {
        this.updateNames();
      }
    }
  }
}
