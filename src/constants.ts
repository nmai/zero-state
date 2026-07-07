import { FaviconProvider, Settings } from './types';

/** chrome.storage.sync key holding the flat node list (user data — never rename casually). */
export const LIST_STORAGE_KEY = 'links-v1';
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
