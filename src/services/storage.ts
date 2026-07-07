import { DEFAULT_SETTINGS, LIST_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../constants';
import { FaviconProvider, LinkNodeFlat, Settings } from '../types';

// Last-saved snapshots let us skip redundant writes — sync quota is small
// (100KB total, 8KB per key) and writes are rate-limited.
let lastSavedListJson = '';
let lastSavedSettingsJson = '';

export async function saveList(list: LinkNodeFlat[]): Promise<void> {
  // Deep-clone to break references, then strip transient properties
  const clean = JSON.parse(JSON.stringify(list)) as (LinkNodeFlat & { children?: unknown })[];
  clean.forEach(node => delete node.children);

  const json = JSON.stringify(clean);
  if (json === lastSavedListJson) return;

  await chrome.storage.sync.set({ [LIST_STORAGE_KEY]: clean });
  lastSavedListJson = json;
}

export async function loadList(): Promise<LinkNodeFlat[]> {
  const result = await chrome.storage.sync.get(LIST_STORAGE_KEY);
  const stored = result[LIST_STORAGE_KEY] as LinkNodeFlat[] | undefined;
  if (stored) {
    lastSavedListJson = JSON.stringify(stored);
    return stored;
  }

  // First run: seed from the bundled starter data (the "welcome screen").
  // NOTE: keep this JSON file in sync with the latest data format.
  console.log('No data found, loading initial-data JSON file instead...');
  const url = chrome.runtime.getURL('/static/json/initial-data-2.0.0.json');
  const response = await fetch(url);
  const initialData = (await response.json()) as LinkNodeFlat[];
  lastSavedListJson = JSON.stringify(initialData);
  return initialData;
}

/** Fills in defaults for any settings keys missing from storage. */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...stored };
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
  const bytesInUse = await chrome.storage.sync.getBytesInUse(LIST_STORAGE_KEY);
  const maxBytes = chrome.storage.sync.QUOTA_BYTES_PER_ITEM;
  console.log(`Bytes in use: ${bytesInUse} (${Math.ceil((bytesInUse / maxBytes) * 100)}%)`);
}
