import { LinkNodeFlat } from '../types';

export function isValidUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export interface NodeFormInput {
  name: string;
  url: string;
  parent: string;
  /** The current flat list, used for uniqueness and parent checks. */
  nodes: LinkNodeFlat[];
  /** Set when editing an existing node (keeping one's own name is allowed). */
  originalName?: string;
}

/** Returns a user-facing error message, or null when the input is valid. */
export function validateNodeForm({ name, url, parent, nodes, originalName }: NodeFormInput): string | null {
  const names = nodes.map(node => node.name);

  if (name.length === 0) {
    return 'Name must be populated';
  }
  if (name !== originalName && names.includes(name)) {
    return 'Name already taken';
  }
  if (url.length > 0 && !isValidUrl(url)) {
    return 'URL format invalid';
  }
  if (parent.length > 0 && !names.includes(parent)) {
    return 'Parent does not exist';
  }

  // Reject parent chains that loop back to this node — a cycle would detach
  // the whole loop from the root and make it invisible and uneditable.
  const seen = new Set<string>();
  let ancestor: string | undefined = parent || undefined;
  while (ancestor) {
    if (ancestor === name || ancestor === originalName) {
      return 'Parent chain loops back to this item';
    }
    if (seen.has(ancestor)) break; // pre-existing cycle elsewhere, not introduced here
    seen.add(ancestor);
    ancestor = nodes.find(node => node.name === ancestor)?.parent;
  }

  return null;
}
