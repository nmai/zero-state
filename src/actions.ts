import { needsFaviconPermission, requestFaviconPermission } from './services/favicon';
import { saveList, saveSettings } from './services/storage';
import { applyTheme } from './services/theme';
import { addFooterMessage, rawList, removeFooterMessage, settings } from './state';
import { LinkNodeFlat, Settings } from './types';

/**
 * Central mutation path for the node list: swap in the next list (the tree
 * re-derives automatically), persist it, and roll back if the save fails.
 */
async function persistList(next: LinkNodeFlat[], failureMessage: string): Promise<boolean> {
  const previous = rawList.val;
  rawList.val = next;
  try {
    await saveList(next);
    return true;
  } catch (error) {
    console.error(failureMessage, error);
    rawList.val = previous;
    alert(`${failureMessage} Please try again.`);
    return false;
  }
}

export function addNode(item: LinkNodeFlat): Promise<boolean> {
  return persistList([...rawList.val, item], 'Failed to save item.');
}

/**
 * Replaces the node named originalName. When the node is being renamed, its
 * children's parent references are remapped so they don't get orphaned.
 */
export function updateNode(originalName: string, item: LinkNodeFlat): Promise<boolean> {
  const renamed = item.name !== originalName;
  const next = rawList.val.map(node => {
    if (node.name === originalName) return item;
    if (renamed && node.parent === originalName) return { ...node, parent: item.name };
    return node;
  });
  return persistList(next, 'Failed to save item.');
}

export function removeNode(name: string): Promise<boolean> {
  const next = rawList.val.filter(node => node.name !== name);
  return persistList(next, 'Failed to delete item.');
}

export function toggleTaskComplete(name: string): Promise<boolean> {
  const next = rawList.val.map(node => {
    if (node.name !== name) return node;
    const { taskComplete, ...rest } = node;
    return taskComplete ? rest : { ...rest, taskComplete: true as const };
  });
  return persistList(next, 'Failed to update task status.');
}

/** Swaps two nodes' positions in the flat list — sibling render order follows list order. */
export function swapNodes(nameA: string, nameB: string): Promise<boolean> {
  const indexA = rawList.val.findIndex(node => node.name === nameA);
  const indexB = rawList.val.findIndex(node => node.name === nameB);
  if (indexA === -1 || indexB === -1) return Promise.resolve(false);

  const next = [...rawList.val];
  [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
  return persistList(next, 'Failed to move item.');
}

export async function updateSettings(patch: Partial<Settings>): Promise<boolean> {
  const previous = settings.val;
  const next = { ...previous, ...patch };
  settings.val = next;
  if (patch.theme) applyTheme(patch.theme);
  try {
    await saveSettings(next);
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    settings.val = previous;
    if (patch.theme) applyTheme(previous.theme);
    alert('Failed to save settings. Please try again.');
    return false;
  }
}

/** Shows or hides the footer notice asking for the favicon permission. */
export async function syncFaviconPermissionNotice(): Promise<void> {
  if (await needsFaviconPermission(rawList.val)) {
    addFooterMessage('request-favicon-permission');
  } else {
    removeFooterMessage('request-favicon-permission');
  }
}

/** Prompts for the favicon permission when needed; reloads on grant so icons load. */
export async function requestFaviconPermissionIfNeeded(): Promise<void> {
  if (!(await needsFaviconPermission(rawList.val))) return;

  if (await requestFaviconPermission()) {
    removeFooterMessage('request-favicon-permission');
    location.reload();
  } else {
    console.log('Favicon permission denied. Change all icon settings to another provider to dismiss the notice.');
  }
}
