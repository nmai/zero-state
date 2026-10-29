import { FaviconProvider, Settings } from './types';

/**
 * chrome.storage.sync key that held the whole node list as one array, up to 2.1.0. Read until
 * the first edit moves the list to one item per node; after that it stays as an untouched backup.
 */
export const LEGACY_LIST_STORAGE_KEY = 'links-v1';
/** Prefix of the chrome.storage.sync items holding one node each: `links-v2:<id>` (user data). */
export const NODE_KEY_PREFIX = 'links-v2:';
/**
 * chrome.storage.sync key marking that the list has been saved one item per node, so an emptied
 * list stays empty instead of falling back to the legacy key or the starter data.
 */
export const LIST_LAYOUT_KEY = 'links-v2';
/** chrome.storage.sync key holding user settings. */
export const SETTINGS_STORAGE_KEY = 'settings-v1';

export const ICONS = {
  MINUS: '[−]',
  PLUS: '[+]',
  UP: '↑',
  DOWN: '↓',
  CLOSE: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>`,
  LINK: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>`,
};

export const FAVICON_PROVIDER_NAMES: { [key in FaviconProvider]: string } = {
  [FaviconProvider.Chrome]: 'Dynamic (Chrome cache)',
  [FaviconProvider.DuckDuckGo]: 'Dynamic (DuckDuckGo API)',
  [FaviconProvider.Generic]: 'Generic link icon',
  [FaviconProvider.None]: 'None (disabled)',
};

export const DEFAULT_SETTINGS: Settings = {
  defaultFaviconProvider: FaviconProvider.Chrome,
  enableRightClickComplete: true,
  theme: 'system',
};

/**
 * Most nodes the list can hold. chrome.storage.sync allows 512 items, and up to three of them
 * aren't nodes: settings, the layout marker, and the legacy list kept as a backup.
 */
export const MAX_NODES = 509;
