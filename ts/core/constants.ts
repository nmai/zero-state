import { FaviconProvider, Settings } from './types';

// Storage key versions
export const CURRENT_LIST_VERSION = 'links-v1';
export const SETTINGS_VERSION = 'settings-v1';

export const DOM_CLASSES = {
  DISPLAY_NONE: 'display-none',
  TREE_LIST: 'tree-list',
  TREE_ITEM: 'tree-item',
  TEXT_PARENT: 'text-parent',
  TEXT_CHILD: 'text-child',
  TEXT_LINETHROUGH: 'text-linethrough',
};

// Text-based icons used inline
export const ICONS = {
  MINUS: '[\u2212]',
  PLUS: '[+]',
  UP: '↑',
  DOWN: '↓',
};

// SVG icons loaded from files — innerHTML strings built at init time
export const SVG_ICONS: Record<string, string> = {};

export async function loadSvgIcons(): Promise<void> {
  const iconNames = ['edit', 'close', 'settings', 'link'];
  await Promise.all(iconNames.map(async (name) => {
    const url = chrome.runtime.getURL(`/static/icons/svg/${name}.svg`);
    const response = await fetch(url);
    SVG_ICONS[name] = await response.text();
  }));
}

export const FAVICON_PROVIDER_NAMES: { [key in FaviconProvider]: string } = {
  [FaviconProvider.Chrome]: 'Dynamic (Chrome cache)',
  [FaviconProvider.DuckDuckGo]: 'Dynamic (DuckDuckGo API)',
  [FaviconProvider.Generic]: 'Generic link icon',
  [FaviconProvider.None]: 'None (disabled)',
};

export const DEFAULT_SETTINGS: Settings = {
  defaultFaviconProvider: Object.keys(FAVICON_PROVIDER_NAMES)[0] as FaviconProvider,
  enableRightClickComplete: true,
  theme: 'system',
};
