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
  showFavicons: boolean;
  enableRightClickComplete: boolean;
  theme: 'light' | 'dark' | 'system';
}
