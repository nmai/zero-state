export interface LinkNodeFlat {
  name: string;
  url?: string;
  parent?: string;
  /**
   * Only set if the user has marked the node as "complete" by right-clicking.
   */
  taskComplete?: true;
  /**
   * Favicon provider. Defaults to Chrome if unspecified.
   */
  icon?: FaviconProvider;
  /**
   * Whether to show a border around the icon
   */
  border?: 0 | 1;
}

export interface LinkNode extends LinkNodeFlat {
  children?: LinkNode[];
}

export interface Settings {
  /**
   * This is simply the last provider the user selected.
   */
  defaultFaviconProvider: FaviconProvider;
  enableRightClickComplete: boolean;
  theme: 'light' | 'dark' | 'system';
}

// NOTE: The string values here are persisted in chrome.storage.sync.
// Changing them would break settings for existing users.
export enum FaviconProvider {
  Chrome = 'chrome',
  DuckDuckGo = 'duck',
  Generic = 'gen',
  None = 'none',
}

export type FooterMessage = 'request-favicon-permission';
