import { NODE_KEY_PREFIX } from '../constants';
import { LinkNodeFlat, StoredNode } from '../types';

/**
 * Pure helpers for the one-item-per-node layout in chrome.storage.sync. Each node is stored
 * under `links-v2:<id>` with an `order` number, since storage items have no order of their
 * own. List order is the source of truth in memory; orders are only worked out when saving.
 */

/** What a node's storage item holds: its fields plus its position among all nodes. */
export interface NodeRecord extends LinkNodeFlat {
  order: number;
}

/** The storage items a save has to write (keyed by storage key) and the node ids it has to remove. */
export interface RecordChanges {
  set: Record<string, NodeRecord>;
  remove: string[];
}

export function nodeKey(id: string): string {
  return NODE_KEY_PREFIX + id;
}

/** The node id in a storage key, or undefined when the key isn't a node's. */
export function idFromKey(key: string): string | undefined {
  return key.startsWith(NODE_KEY_PREFIX) ? key.slice(NODE_KEY_PREFIX.length) : undefined;
}

/**
 * The id for a new node. It's derived from the name rather than random, so devices that create
 * the same node independently (the starter data, a move from the legacy key, the same item added
 * on two devices before they sync) write the same storage item instead of duplicating it.
 */
export function newNodeId(name: string, taken: ReadonlySet<string>): string {
  for (let attempt = 0; ; attempt++) {
    const id = hashId(attempt === 0 ? name : `${name}\u0000${attempt}`);
    if (!taken.has(id)) return id;
  }
}

/**
 * Gives each node an id. A node with the same name as one in `current` keeps that node's id,
 * so re-importing a backup of the list rewrites its items instead of replacing them all.
 */
export function withIds(nodes: LinkNodeFlat[], current: StoredNode[] = []): StoredNode[] {
  const currentIds = new Map(current.map(node => [node.name, node.id]));
  const reused = nodes.map(node => currentIds.get(node.name));
  const taken = new Set(reused.filter(id => id !== undefined));
  return nodes.map((node, index) => {
    let id = reused[index];
    if (id === undefined) {
      id = newNodeId(node.name, taken);
      taken.add(id);
    }
    return { ...node, id };
  });
}

export function withoutId(node: StoredNode): LinkNodeFlat {
  const { id: _id, ...fields } = node;
  return fields;
}

/** Every node record among some storage items, by node id. */
export function readRecords(items: Record<string, unknown>): Map<string, NodeRecord> {
  const records = new Map<string, NodeRecord>();
  for (const [key, value] of Object.entries(items)) {
    const id = idFromKey(key);
    if (id !== undefined) records.set(id, value as NodeRecord);
  }
  return records;
}

/** The list the records describe, in order. Ties (two devices adding at once) go by id. */
export function listFromRecords(records: ReadonlyMap<string, NodeRecord>): StoredNode[] {
  return [...records]
    .sort(([idA, a], [idB, b]) => a.order - b.order || (idA < idB ? -1 : idA > idB ? 1 : 0))
    .map(([id, { order: _order, ...fields }]) => ({ ...fields, id }));
}

/**
 * The records to store for a list. Nodes keep their previous order wherever it still fits the
 * list's sequence, so an edit rewrites only the nodes it touched: moving an item reorders one
 * or two records, and adding or deleting one leaves the rest alone.
 */
export function recordsFromList(list: StoredNode[], previous: ReadonlyMap<string, NodeRecord>): Map<string, NodeRecord> {
  const previousOrders = list.map(node => previous.get(node.id)?.order);
  const keep = longestIncreasing(previousOrders);

  let orders: number[] = [];
  for (let start = 0; start < list.length;) {
    if (keep.has(start)) {
      orders.push(previousOrders[start]!);
      start++;
      continue;
    }
    // A run of nodes that need new orders, spread evenly between the kept ones around it
    let end = start;
    while (end < list.length && !keep.has(end)) end++;
    const count = end - start;
    const low = start > 0 ? orders[start - 1] : undefined;
    const high = end < list.length ? previousOrders[end] : undefined;
    for (let step = 1; step <= count; step++) {
      if (low === undefined && high === undefined) orders.push(step - 1);
      else if (high === undefined) orders.push(low! + step);
      else if (low === undefined) orders.push(high - (count + 1 - step));
      else orders.push(low + ((high - low) * step) / (count + 1));
    }
    start = end;
  }
  // Moving items back and forth halves the same gap each time; renumber once it runs out
  if (orders.some((order, index) => index > 0 && !(order > orders[index - 1]))) {
    orders = list.map((_node, index) => index);
  }

  return new Map(list.map((node, index) => [node.id, { ...withoutId(node), order: orders[index] }]));
}

/** What has to be written and removed to go from the previous records to the next ones. */
export function diffRecords(previous: ReadonlyMap<string, NodeRecord>, next: ReadonlyMap<string, NodeRecord>): RecordChanges {
  const changes: RecordChanges = { set: {}, remove: [] };
  for (const [id, record] of next) {
    const before = previous.get(id);
    if (!before || canonical(before) !== canonical(record)) changes.set[nodeKey(id)] = record;
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) changes.remove.push(id);
  }
  return changes;
}

/** JSON with sorted keys: chrome.storage hands objects back with their keys sorted. */
function canonical(record: NodeRecord): string {
  return JSON.stringify(record, Object.keys(record).sort());
}

/** Indices of a longest strictly increasing run (not necessarily contiguous) of the defined values. */
function longestIncreasing(values: (number | undefined)[]): Set<number> {
  const length = values.map(() => 0);
  const before = values.map(() => -1);
  let best = -1;
  values.forEach((value, index) => {
    if (value === undefined) return;
    length[index] = 1;
    for (let earlier = 0; earlier < index; earlier++) {
      const earlierValue = values[earlier];
      if (earlierValue !== undefined && earlierValue < value && length[earlier] + 1 > length[index]) {
        length[index] = length[earlier] + 1;
        before[index] = earlier;
      }
    }
    if (best === -1 || length[index] > length[best]) best = index;
  });

  const keep = new Set<number>();
  for (let index = best; index !== -1; index = before[index]) keep.add(index);
  return keep;
}

/** 8 base-36 characters from cyrb53, a small public-domain 53-bit string hash (github.com/bryc/code). */
function hashId(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return (hash % 36 ** 8).toString(36).padStart(8, '0');
}
