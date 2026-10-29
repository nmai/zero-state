import {
  DEFAULT_SETTINGS, LEGACY_LIST_STORAGE_KEY, LIST_LAYOUT_KEY, SETTINGS_STORAGE_KEY,
} from '../constants';
import { FaviconProvider, LinkNodeFlat, Settings, StoredNode } from '../types';
import {
  diffRecords, idFromKey, listFromRecords, nodeKey, NodeRecord, readRecords, recordsFromList, withIds,
} from './storage-layout';

// What this page knows is in chrome.storage.sync: the node records (kept current by
// saveList() and applyListChanges()) and whether the layout marker has been written.
// Saves write only the difference, since the sync quota is small and writes are rate-limited.
let savedRecords = new Map<string, NodeRecord>();
let layoutSaved = false;
let lastSavedSettingsJson = '';

/**
 * Saves the list one item per node, writing only the nodes that changed and removing the
 * ones that are gone. The first save also moves a legacy or starter list into this layout.
 */
export async function saveList(list: StoredNode[]): Promise<void> {
  const records = recordsFromList(list, savedRecords);
  const { set, remove } = diffRecords(savedRecords, records);
  const items: Record<string, unknown> = layoutSaved ? set : { ...set, [LIST_LAYOUT_KEY]: true };

  // One set() is all-or-nothing, so a rejected save leaves storage as it was
  if (Object.keys(items).length > 0) {
    await chrome.storage.sync.set(items);
    for (const [key, record] of Object.entries(set)) savedRecords.set(idFromKey(key)!, record);
    layoutSaved = true;
  }
  if (remove.length > 0) {
    await chrome.storage.sync.remove(remove.map(nodeKey));
    for (const id of remove) savedRecords.delete(id);
  }
}

export async function loadList(): Promise<StoredNode[]> {
  const items = await chrome.storage.sync.get(null);
  savedRecords = readRecords(items);
  layoutSaved = items[LIST_LAYOUT_KEY] !== undefined || savedRecords.size > 0;
  if (layoutSaved) return listFromRecords(savedRecords);

  // Not saved one item per node yet: show the list 2.1.0 and older stored under one key. It
  // moves to the new layout on the first edit, so loading alone writes nothing.
  const legacy = items[LEGACY_LIST_STORAGE_KEY] as LinkNodeFlat[] | undefined;
  if (legacy) return withIds(legacy);

  // First run: seed from the bundled starter data (the "welcome screen").
  // NOTE: keep this JSON file in sync with the latest data format.
  console.log('No data found, loading initial-data JSON file instead...');
  const url = chrome.runtime.getURL('/static/json/initial-data-2.0.0.json');
  const response = await fetch(url);
  return withIds((await response.json()) as LinkNodeFlat[]);
}

/**
 * Folds a chrome.storage.onChanged batch into what this page knows is saved, and returns the
 * list to show if it changed. Changes to the legacy key only count until the list has moved to
 * one item per node; after that they can only come from a device still running 2.1.0 or older.
 */
export function applyListChanges(changes: Record<string, chrome.storage.StorageChange>): StoredNode[] | undefined {
  let changed = false;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key === LIST_LAYOUT_KEY) {
      layoutSaved = newValue !== undefined;
      changed = true;
      continue;
    }
    const id = idFromKey(key);
    if (id === undefined) continue;
    if (newValue === undefined) savedRecords.delete(id);
    else savedRecords.set(id, newValue as NodeRecord);
    changed = true;
  }
  if (changed) return listFromRecords(savedRecords);

  const legacy = changes[LEGACY_LIST_STORAGE_KEY];
  if (legacy && !layoutSaved && savedRecords.size === 0) {
    return withIds((legacy.newValue as LinkNodeFlat[] | undefined) ?? []);
  }
  return undefined;
}

/**
 * Fills in defaults for any settings keys missing from storage, and drops keys this
 * version doesn't know, such as the stray DEFAULT_SETTINGS object that 2.0.0 saved.
 */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const known = Object.entries(stored ?? {})
    .filter(([key, value]) => Object.hasOwn(DEFAULT_SETTINGS, key) && value !== undefined);
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(known) };
}

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  const settings = mergeSettings(result[SETTINGS_STORAGE_KEY] as Partial<Settings> | undefined);
  lastSavedSettingsJson = JSON.stringify(settings);
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const json = JSON.stringify(settings);
  if (json === lastSavedSettingsJson) return;

  await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
  lastSavedSettingsJson = json;
}

/**
 * Normalizes nodes loaded from storage (in place): favicon options only make
 * sense on nodes with a URL, and taskComplete is only ever stored as true.
 */
export function applyNodeDefaults(nodes: LinkNodeFlat[]): void {
  for (const node of nodes) {
    if (node.url) {
      node.border ??= 1;
      node.icon ??= FaviconProvider.Chrome;
    } else {
      delete node.border;
      delete node.icon;
    }
    if (!node.taskComplete) {
      delete node.taskComplete;
    }
  }
}

export async function printStartupInfo(): Promise<void> {
  const { sync } = chrome.storage;
  const [bytesInUse, items] = await Promise.all([sync.getBytesInUse(null), sync.get(null)]);
  const percent = (used: number, max: number) => Math.ceil((used / max) * 100);
  const itemCount = Object.keys(items).length;
  console.log(
    `Sync storage: ${bytesInUse} of ${sync.QUOTA_BYTES} bytes (${percent(bytesInUse, sync.QUOTA_BYTES)}%), `
    + `${itemCount} of ${sync.MAX_ITEMS} items (${percent(itemCount, sync.MAX_ITEMS)}%)`,
  );
}
