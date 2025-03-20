// Types and Interfaces
export interface LinkNodeFlat {
  name: string;
  url?: string;
  parent?: string;
  taskComplete?: boolean;
}

export interface LinkNode extends LinkNodeFlat {
  children?: LinkNode[];
}

export interface Settings {
  faviconProvider: 'duckduckgo' | 'chrome';
  showFavicons: boolean;
  enableRightClickComplete: boolean;
  theme: 'light' | 'dark' | 'system';
}
