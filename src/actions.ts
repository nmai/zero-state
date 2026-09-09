import { buildExport, parseExport } from './services/export';
import { needsFaviconPermission, requestFaviconPermission } from './services/favicon';
import { applyNodeDefaults, saveList, saveSettings } from './services/storage';
import { applyTheme } from './services/theme';
import { addFooterMessage, exitAllModes, rawList, removeFooterMessage, settings } from './state';
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

/** The current list and settings as pretty-printed JSON in the versioned export format. */
export function exportData(): string {
  const exported = buildExport(rawList.val, settings.val, chrome.runtime.getManifest().version);
  return JSON.stringify(exported, null, 2);
}

/**
 * Replaces the whole list, and any settings the payload carries, from an export.
 * Accepts the JSON text or the parsed object. Throws before touching anything
 * if the payload can't be read; see parseExport() for what is checked.
 */
export async function importData(payload: unknown): Promise<boolean> {
  const { list, settings: patch } = parseExport(payload);
  applyNodeDefaults(list);

  exitAllModes(); // a half-edited node from the old list would be stale
  if (!(await persistList(list, 'Failed to import data.'))) return false;
  if (patch && !(await updateSettings(patch))) return false;
  void syncFaviconPermissionNotice();

  console.log(`Imported ${list.length} item(s)${patch ? ' and settings' : ''}.`);
  return true;
}
