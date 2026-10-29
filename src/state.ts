import { DEFAULT_SETTINGS } from './constants';
import { LinkNodeFlat, Settings } from './types';
import { state } from './van';

export type FooterMessage = 'request-favicon-permission';

export const editMode = state(false);
export const settingsMode = state(false);
export const editingNode = state<LinkNodeFlat | null>(null);
export const settings = state<Settings>(DEFAULT_SETTINGS);
export const footerMessages = state<ReadonlySet<FooterMessage>>(new Set());

/**
 * Flat source of truth, mirrored to chrome.storage. Always replace, never mutate.
 * TreeView builds the display tree from it on each render.
 */
export const rawList = state<LinkNodeFlat[]>([]);

export function toggleEditMode(): void {
  editMode.val = !editMode.val;
  editingNode.val = null;
  settingsMode.val = false;
}

export function exitAllModes(): void {
  editMode.val = false;
  editingNode.val = null;
  settingsMode.val = false;
}

export function addFooterMessage(message: FooterMessage): void {
  if (!footerMessages.val.has(message)) {
    footerMessages.val = new Set([...footerMessages.val, message]);
  }
}

export function removeFooterMessage(message: FooterMessage): void {
  if (footerMessages.val.has(message)) {
    const next = new Set(footerMessages.val);
    next.delete(message);
    footerMessages.val = next;
  }
}
