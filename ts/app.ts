import type { Van } from "../static/lib/van-1.5.3.js"
declare const van: Van
const { div, a, form, label, input, span, ul, li, br, img, h2, h3, p } = van.tags

// Types and Interfaces
interface LinkNodeFlat {
  name: string;
  url?: string;
  parent?: string;
  taskComplete?: boolean;
}

interface LinkNode extends LinkNodeFlat {
  children?: LinkNode[];
}

interface Settings {
  showFavicons: boolean;
  enableRightClickComplete: boolean;
  theme: 'light' | 'dark' | 'system';
}

// Constants
const CURRENT_LIST_VERSION = 'links-v1';
const SETTINGS_VERSION = 'settings-v1';
const DOM_CLASSES = {
  DISPLAY_NONE: 'display-none',
  TREE_LIST: 'tree-list',
  TREE_ITEM: 'tree-item',
  TEXT_PARENT: 'text-parent',
  TEXT_CHILD: 'text-child',
  TEXT_LINETHROUGH: 'text-linethrough',
  WELCOME_MESSAGE: 'welcome-message',
  SETTINGS_PAGE: 'settings-page',
  BUTTON_GROUP: 'button-group'
};

const ICONS = {
  MINUS: '[\u2212]',
  PLUS: '[+]',
  UP: '↑',
  DOWN: '↓',
  EDIT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>`,
  CLOSE: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>`,
  SETTINGS: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>`
};

// State
class AppState {
  editMode = van.state(false);
  settingsMode = van.state(false);
  rawList = van.state<LinkNodeFlat[]>([]);
  names = van.state<string[]>([]);
  root = van.state<LinkNode>({
    name: 'Root',
    children: []
  });
  createdTable = van.state<Record<string, LinkNode>>({});
  settings = van.state<Settings>({
    showFavicons: true,
    enableRightClickComplete: false,
    theme: 'system'
  });
  
  // Cache of name to index for O(1) lookups
  private nameToIndexMap: Map<string, number> = new Map();

  updateNames(): void {
    this.names.val = this.rawList.val.map(item => item.name);
    
    // Update the name to index map for fast lookups
    this.nameToIndexMap.clear();
    this.rawList.val.forEach((item, index) => {
      this.nameToIndexMap.set(item.name, index);
    });
  }

  addItem(item: LinkNodeFlat): void {
    this.rawList.val = [...this.rawList.val, item];
    this.nameToIndexMap.set(item.name, this.rawList.val.length - 1);
    this.names.val = [...this.names.val, item.name];
  }

  removeItem(item: LinkNodeFlat): void {
    const index = this.nameToIndexMap.get(item.name);
    
    if (index !== undefined) {
      const newList = [...this.rawList.val];
      newList.splice(index, 1);
      this.rawList.val = newList;
      this.updateNames(); // Need to rebuild the map since indices change
    }
  }

  toggleTaskComplete(node: LinkNodeFlat): void {
    const index = this.nameToIndexMap.get(node.name);
    
    if (index !== undefined) {
      // Create a new array and only clone the specific element we need to modify
      const newList = [...this.rawList.val];
      newList[index] = { ...newList[index], taskComplete: !newList[index].taskComplete };
      this.rawList.val = newList;
    }
  }

  swapNodePositions(node1: LinkNodeFlat, node2: LinkNodeFlat): void {
    const index1 = this.nameToIndexMap.get(node1.name);
    const index2 = this.nameToIndexMap.get(node2.name);
    
    if (index1 !== undefined && index2 !== undefined) {
      // Swap the items
      const newList = [...this.rawList.val];
      [newList[index1], newList[index2]] = [newList[index2], newList[index1]];
      this.rawList.val = newList;
      
      // Update the index map for the swapped items
      this.nameToIndexMap.set(node1.name, index2);
      this.nameToIndexMap.set(node2.name, index1);
    }
  }
}

const state = new AppState();

// Storage Service
class StorageService {
  // Cache for the last saved list to avoid unnecessary storage operations
  private static lastSavedListJson: string = '';
  private static lastSavedSettingsJson: string = '';

  static save(list: LinkNodeFlat[]): Promise<void> {
    // Clone to break references and clean
    const cloneList = JSON.parse(JSON.stringify(list)) as LinkNodeFlat[];
    
    // Remove any transient properties
    cloneList.forEach((n: any) => delete n.children);

    // Check if the list has actually changed to avoid unnecessary storage operations
    const listJson = JSON.stringify(cloneList);
    if (this.lastSavedListJson === listJson) {
      console.log('No changes, skipping save operation');
      return Promise.resolve(); // No changes, skip save operation
    }

    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [CURRENT_LIST_VERSION]: cloneList }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Data saved successfully');
          this.lastSavedListJson = listJson;
          resolve();
        }
      });
    });
  }

  static load(): Promise<LinkNodeFlat[]> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(CURRENT_LIST_VERSION, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          const data = result[CURRENT_LIST_VERSION] as LinkNodeFlat[] | undefined;
          if (data) {
            this.lastSavedListJson = JSON.stringify(data);
          }
          resolve(data || []);
        }
      });
    });
  }

  static saveSettings(settings: Settings): Promise<void> {
    // Check if the settings have actually changed to avoid unnecessary storage operations
    const settingsJson = JSON.stringify(settings);
    if (this.lastSavedSettingsJson === settingsJson) {
      console.log('No changes to settings, skipping save operation');
      return Promise.resolve(); // No changes, skip save operation
    }

    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [SETTINGS_VERSION]: settings }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving settings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Settings saved successfully');
          this.lastSavedSettingsJson = settingsJson;
          resolve();
        }
      });
    });
  }

  static loadSettings(): Promise<Settings> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(SETTINGS_VERSION, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading settings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          const data = result[SETTINGS_VERSION] as Settings | undefined;
          
          const defaultSettings: Settings = {
            showFavicons: true,
            enableRightClickComplete: false,
            theme: 'system'
          };
          
          // Merge with default settings to ensure all properties exist
          const mergedSettings = data ? { ...defaultSettings, ...data } : defaultSettings;
          
          if (mergedSettings) {
            this.lastSavedSettingsJson = JSON.stringify(mergedSettings);
          }
          
          resolve(mergedSettings);
        }
      });
    });
  }
}

// Validator Service
class ValidatorService {
  static validateNewItem(name: string, url: string, parent: string, existingNames: string[]): string | null {
    if (name.length === 0) {
      return 'Name must be populated';
    }
    
    if (existingNames.includes(name)) {
      return 'Name already taken';
    }
    
    if (url.length > 0 && !this.isValidUrl(url)) {
      return 'URL format invalid';
    }
    
    if (parent.length > 0 && !existingNames.includes(parent)) {
      return 'Parent does not exist';
    }
    
    return null;
  }

  static isValidUrl(url: string): boolean {
    return /^https?:\/\//.test(url);
  }
}

// Tree Service
class TreeService {
  // Cache the last built tree to avoid unnecessary rebuilds
  private static lastRawListJson: string = '';
  private static cachedTree: LinkNode | null = null;

  static buildTree(rawList: LinkNodeFlat[]): LinkNode {
    // Check if we already have a cached result for this exact list
    const currentJson = JSON.stringify(rawList);
    if (this.cachedTree && this.lastRawListJson === currentJson) {
      return this.cachedTree;
    }
    
    const root: LinkNode = {
      name: 'Root',
      children: []
    };
    
    // Create a map for O(1) lookups
    const nodeMap: Record<string, LinkNode> = { 'Root': root };
    
    // First pass: Create all nodes without connecting them
    for (const item of rawList) {
      nodeMap[item.name] = { ...item } as LinkNode;
    }
    
    // Second pass: Connect nodes to their parents
    for (const item of rawList) {
      const node = nodeMap[item.name];
      
      if (item.parent) {
        const parentNode = nodeMap[item.parent];
        
        if (parentNode) {
          parentNode.children = parentNode.children || [];
          parentNode.children.push(node);
        } else {
          // If parent doesn't exist, add to root
          console.warn(`Parent "${item.parent}" not found for "${item.name}", adding to root`);
          root.children!.push(node);
        }
      } else {
        // Add root-level items directly to root
        root.children!.push(node);
      }
    }
    
    // Cache the result for future use
    this.lastRawListJson = currentJson;
    this.cachedTree = root;
    
    // Update the createdTable state (used elsewhere in the app)
    state.createdTable.val = nodeMap;
    
    return root;
  }

  static hasChildren(node: LinkNode): boolean {
    return Boolean(node.children && node.children.length > 0);
  }
}

// UI Components using VanJS
class UiComponents {
  // Cache for favicon URLs to avoid redundant URL parsing
  private static faviconCache: Map<string, string> = new Map();
  
  static getFaviconUrl(urlStr: string): string {
    // Return from cache if available
    if (this.faviconCache.has(urlStr)) {
      return this.faviconCache.get(urlStr)!;
    }
    
    try {
      const url = new URL(urlStr);
      // Use DuckDuckGo's favicon service instead of hardcoded URLs
      const result = `https://icons.duckduckgo.com/ip2/${url.hostname}.ico`;
      this.faviconCache.set(urlStr, result);
      return result;
    } catch (error) {
      console.error('Invalid URL for favicon:', urlStr, error);
      const fallback = 'misc/favicon.ico';
      this.faviconCache.set(urlStr, fallback);
      return fallback; // Fallback to default favicon
    }
  }

  static createDeleteButton(node: LinkNodeFlat) {
    return a({ href: "#", onclick: (e: Event) => {
      e.preventDefault();
      state.removeItem(node);
      StorageService.save(state.rawList.val)
        .then(() => {
          state.root.val = TreeService.buildTree(state.rawList.val);
          this.renderWelcomeMessage();
        })
        .catch(error => {
          console.error('Failed to save after delete:', error);
          alert('Failed to delete item. Please try again.');
        });
    }}, ICONS.MINUS);
  }

  static createMoveUpButton(node: LinkNode, siblings: LinkNode[], index: number) {
    // Only show if not first child
    if (index <= 0) return null;
    
    return a({ 
      href: "#", 
      class: "move-btn move-up",
      onclick: (e: Event) => {
        e.preventDefault();
        const prevSibling = siblings[index - 1];
        state.swapNodePositions(node, prevSibling);
        StorageService.save(state.rawList.val)
          .then(() => {
            state.root.val = TreeService.buildTree(state.rawList.val);
          })
          .catch(error => {
            console.error('Failed to save after position change:', error);
            state.swapNodePositions(node, prevSibling); // Revert on failure
            alert('Failed to move item up. Please try again.');
          });
      }
    }, ICONS.UP);
  }

  static createMoveDownButton(node: LinkNode, siblings: LinkNode[], index: number) {
    // Only show if not last child
    if (index >= siblings.length - 1) return null;
    
    return a({ 
      href: "#", 
      class: "move-btn move-down",
      onclick: (e: Event) => {
        e.preventDefault();
        const nextSibling = siblings[index + 1];
        state.swapNodePositions(node, nextSibling);
        StorageService.save(state.rawList.val)
          .then(() => {
            state.root.val = TreeService.buildTree(state.rawList.val);
          })
          .catch(error => {
            console.error('Failed to save after position change:', error);
            state.swapNodePositions(node, nextSibling); // Revert on failure
            alert('Failed to move item down. Please try again.');
          });
      }
    }, ICONS.DOWN);
  }

  static renderNodeContent(node: LinkNode) {
    const contentClasses = [];
    if (node.taskComplete) contentClasses.push(DOM_CLASSES.TEXT_LINETHROUGH);

    if (node.url) {
      return span({ class: contentClasses.join(' ') }, 
        a({ href: node.url }, 
          // Only show favicon if enabled in settings and not in edit mode
          () => state.editMode.val || !state.settings.val.showFavicons ? 
                null : 
                span({}, img({ src: this.getFaviconUrl(node.url || ''), class: "favicon" })),
          node.name
        )
      );
    } else {
      return span({ class: contentClasses.join(' ') }, node.name);
    }
  }

  static renderNode(node: LinkNode, siblings?: LinkNode[], index?: number) {
    const nodeClass = TreeService.hasChildren(node) 
      ? `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_PARENT}` 
      : `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_CHILD}`;

    const children: any[] = [];
    
    // Add up/down buttons if in edit mode and node has siblings
    if (state.editMode.val && siblings && siblings.length > 1) {
      const moveControls = div({ class: "move-controls" });
      const upButton = this.createMoveUpButton(node, siblings, index || 0);
      const downButton = this.createMoveDownButton(node, siblings, index || 0);
      
      if (upButton) van.add(moveControls, upButton);
      if (downButton) van.add(moveControls, downButton);
      
      children.push(moveControls);
    }
    
    // Add the main node content
    children.push(this.renderNodeContent(node));

    // Add delete button if form is open and node has no children
    if (state.editMode.val && !TreeService.hasChildren(node)) {
      children.push(this.createDeleteButton(node));
    }

    // Add children container if needed
    if (TreeService.hasChildren(node) && node.children) {
      children.push(this.renderChildList(node.children));
    }

    // Create list item with conditional right-click handler
    const liProps: Record<string, any> = {
      id: 'listchild-' + node.name,
      class: nodeClass
    };
    
    // Only add the right-click handler if the feature is enabled in settings
    if (state.settings.val.enableRightClickComplete) {
      liProps.oncontextmenu = (e: Event) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        state.toggleTaskComplete(node);
        StorageService.save(state.rawList.val)
          .catch(error => {
            console.error('Failed to save task status:', error);
            state.toggleTaskComplete(node); // Revert on failure
            alert('Failed to update task status. Please try again.');
          });
      };
    }

    return li(liProps, ...children);
  }

  static renderChildList(children: LinkNode[]) {
    return ul({ class: DOM_CLASSES.TREE_LIST }, 
      ...children.map((child, index) => this.renderNode(child, children, index))
    );
  }

  static renderTree() {
    const tree = state.root.val;
    if (!tree.children || tree.children.length === 0) {
      return div({ id: "lists-container", class: "row row-main" });
    }

    const listGroups: any[] = [];
    let treeIndex = 0;

    for (const node of tree.children) {
      const rootChildren = tree.children;
      listGroups.push(
        ul({ 
          id: `list-group-${treeIndex}`, 
          class: `${DOM_CLASSES.TREE_LIST} col` 
        }, this.renderNode(node, rootChildren, treeIndex))
      );
      treeIndex++;
    }

    return div({ id: "lists-container", class: "row row-main" }, ...listGroups);
  }

  static renderAddForm() {
    const nameField = van.state('');
    const urlField = van.state('');
    const parentField = van.state('');

    const handleSubmit = (e: Event) => {
      e.preventDefault();
      
      const name = nameField.val.trim();
      const url = urlField.val.trim();
      const parent = parentField.val.trim();

      const errorMessage = ValidatorService.validateNewItem(name, url, parent, state.names.val);
      
      if (errorMessage) {
        alert(errorMessage);
        return;
      }

      const newItem: LinkNodeFlat = {
        name: name,
        url: url || undefined,
        parent: parent || undefined,
      };
      
      state.addItem(newItem);
      
      StorageService.save(state.rawList.val)
        .then(() => {
          state.editMode.val = false;
          nameField.val = '';
          urlField.val = '';
          parentField.val = '';
          state.root.val = TreeService.buildTree(state.rawList.val);
          this.renderWelcomeMessage();
        })
        .catch(error => {
          console.error('Failed to save new item:', error);
          state.removeItem(newItem); // Revert on failure
          alert('Failed to save new item. Please try again.');
        });
    };

    return form({ 
      id: "newlink-form", 
      class: () => state.editMode.val ? "" : DOM_CLASSES.DISPLAY_NONE,
      onsubmit: handleSubmit
    }, 
      label({ for: "newlink-name" }, "Name:"), br(),
      input({ 
        type: "text", 
        id: "newlink-name", 
        name: "newlink-name", 
        autocomplete: "off",
        value: nameField,
        oninput: (e: Event) => nameField.val = (e.target as HTMLInputElement).value 
      }), br(),
      
      label({ for: "newlink-url" }, "URL:"), br(),
      input({ 
        type: "text", 
        id: "newlink-url", 
        name: "newlink-url", 
        autocomplete: "off",
        value: urlField,
        oninput: (e: Event) => urlField.val = (e.target as HTMLInputElement).value 
      }), br(),
      
      label({ for: "newlink-parent" }, "Parent:"), br(),
      input({ 
        type: "text", 
        id: "newlink-parent", 
        name: "newlink-parent", 
        autocomplete: "off",
        value: parentField,
        oninput: (e: Event) => parentField.val = (e.target as HTMLInputElement).value 
      }), br(),
      
      input({ type: "submit", value: "Add" })
    );
  }

  static renderToggleButton() {
    return a({ 
      id: "toggle-form-btn", 
      href: "#",
      onclick: (e: Event) => {
        e.preventDefault();
        state.editMode.val = !state.editMode.val;
        // Close settings mode if open
        if (state.settingsMode.val) {
          state.settingsMode.val = false;
        }
      },
      innerHTML: () => state.editMode.val ? ICONS.CLOSE : ICONS.EDIT
    });
  }

  static renderSettingsButton() {
    return a({ 
      id: "settings-btn", 
      href: "#",
      onclick: (e: Event) => {
        e.preventDefault();
        state.settingsMode.val = !state.settingsMode.val;
        // Close edit mode if open
        if (state.editMode.val) {
          state.editMode.val = false;
        }
      },
      innerHTML: ICONS.SETTINGS
    });
  }

  static renderSettingsPage() {
    const updateSetting = (key: keyof Settings, value: any) => {
      const newSettings = { ...state.settings.val, [key]: value };
      state.settings.val = newSettings;
      
      // Apply theme immediately if it changes
      if (key === 'theme') {
        applyTheme(value);
      }
      
      // Save settings to storage
      StorageService.saveSettings(newSettings)
        .catch(error => {
          console.error('Failed to save settings:', error);
          alert('Failed to save settings. Please try again.');
        });
    };

    // Create the settings form
    return div({ class: DOM_CLASSES.SETTINGS_PAGE }, 
      div({ class: "settings-header" }, 
        h2({}, "Settings"),
        a({ 
          href: "#", 
          class: "close-settings-btn",
          onclick: (e: Event) => {
            e.preventDefault();
            state.settingsMode.val = false;
          },
          innerHTML: ICONS.CLOSE
        })
      ),
      
      // Favicon Setting
      div({ class: "settings-group" },
        h3({}, "Favicons"),
        div({ class: "setting-item" },
          label({ for: "favicon-toggle" },
            input({
              type: "checkbox",
              id: "favicon-toggle",
              checked: state.settings.val.showFavicons,
              onchange: (e: Event) => {
                updateSetting('showFavicons', (e.target as HTMLInputElement).checked);
              }
            }),
            "Show Favicons"
          ),
          p({ class: "setting-description" }, 
            "When enabled, favicons are fetched from DuckDuckGo's icon service."
          )
        )
      ),
      
      // Right-click Complete Setting
      div({ class: "settings-group" },
        h3({}, "Task Completion"),
        div({ class: "setting-item" },
          label({ for: "right-click-toggle" },
            input({
              type: "checkbox",
              id: "right-click-toggle",
              checked: state.settings.val.enableRightClickComplete,
              onchange: (e: Event) => {
                updateSetting('enableRightClickComplete', (e.target as HTMLInputElement).checked);
              }
            }),
            "Enable Right-click to Mark as Done"
          ),
          p({ class: "setting-description" }, 
            "When enabled, right-clicking on an item will toggle its completion status."
          )
        )
      ),
      
      // Theme Setting
      div({ class: "settings-group" },
        h3({}, "Theme"),
        div({ class: "setting-item" },
          div({ class: "radio-group" },
            label({ for: "theme-light" },
              input({
                type: "radio",
                id: "theme-light",
                name: "theme",
                value: "light",
                checked: state.settings.val.theme === 'light',
                onchange: () => updateSetting('theme', 'light')
              }),
              "Light"
            ),
            label({ for: "theme-dark" },
              input({
                type: "radio",
                id: "theme-dark",
                name: "theme",
                value: "dark",
                checked: state.settings.val.theme === 'dark',
                onchange: () => updateSetting('theme', 'dark')
              }),
              "Dark"
            ),
            label({ for: "theme-system" },
              input({
                type: "radio",
                id: "theme-system",
                name: "theme",
                value: "system",
                checked: state.settings.val.theme === 'system',
                onchange: () => updateSetting('theme', 'system')
              }),
              "System (Default)"
            )
          ),
          p({ class: "setting-description" }, 
            "Choose your preferred theme or use your system's setting."
          )
        )
      )
    );
  }

  static renderWelcomeMessage() {
    // Check if welcome message should be shown
    const shouldShow = state.rawList.val.length === 0;
    const overlayContainer = document.getElementById('overlay-container');
    
    if (!overlayContainer) return;
    
    // Only update DOM if there's a change needed
    const hasWelcomeMessage = overlayContainer.querySelector(`.${DOM_CLASSES.WELCOME_MESSAGE}`);
    
    if (shouldShow && !hasWelcomeMessage) {
      // Clear container and add welcome message
      overlayContainer.innerHTML = '';
      const welcomeMessage = div({ class: DOM_CLASSES.WELCOME_MESSAGE },
        "This is Zero State. To add your first node, click the edit icon in the top right corner"
      );
      van.add(overlayContainer, welcomeMessage);
    } else if (!shouldShow && hasWelcomeMessage) {
      // Just clear the welcome message
      overlayContainer.innerHTML = '';
    }
  }

  static renderSidePanel() {
    return div({ class: "row row-side-panel" },
      div({ class: "col" },
        div({ class: DOM_CLASSES.BUTTON_GROUP },
          this.renderToggleButton(),
          this.renderSettingsButton()
        ),
        this.renderAddForm()
      )
    );
  }

  static renderMainContent() {
    // Use van state to create a reactive binding to the root state
    return () => {
      if (state.settingsMode.val) {
        return this.renderSettingsPage();
      } else {
        return this.renderTree();
      }
    };
  }
  
  static renderFooter() {
    const handleLinkClick = (e: Event, action: string) => {
      e.preventDefault();
      
      switch (action) {
        case 'settings':
          state.settingsMode.val = !state.settingsMode.val;
          if (state.editMode.val) state.editMode.val = false;
          break;
          
        case 'new':
          state.editMode.val = !state.editMode.val;
          if (state.settingsMode.val) state.settingsMode.val = false;
          break;
      }
    };
    
    return div({ id: "footer" },
      a({ 
        href: "#", 
        onclick: (e) => handleLinkClick(e, 'new')
      }, "[+]"),
      a({ 
        href: "#", 
        onclick: (e) => handleLinkClick(e, 'settings')
      }, "[settings]"),
    );
  }
  
  static renderApp() {
    return div({},
      // Overlay container for welcome message
      div({ id: "overlay-container" }),
      
      // Main row containing the content
      div({ class: "row" }, 
        // Main content area - will be populated by renderMainContent
        UiComponents.renderMainContent(),
        
        // Side panel with buttons and form
        UiComponents.renderSidePanel()
      ),
      
      // Footer
      UiComponents.renderFooter()
    );
  }
}

// Initialize application
async function initializeApp(): Promise<void> {
  try {
    // Initialize state with stored data
    const [storedList, storedSettings] = await Promise.all([
      StorageService.load(),
      StorageService.loadSettings()
    ]);
    
    state.rawList.val = storedList;
    state.updateNames();
    state.settings.val = storedSettings;
    
    // Apply theme based on settings
    applyTheme(storedSettings.theme);
    
    // Build tree only once
    state.root.val = TreeService.buildTree(state.rawList.val);
    
    // Render the entire application using VanJS
    // This creates the complete DOM structure including overlay container, main content, and footer
    van.add(document.body, UiComponents.renderApp());
    
    // Render welcome message if needed
    UiComponents.renderWelcomeMessage();
    
    // Listen for storage changes - throttled to avoid excessive processing
    let debounceTimer: number | null = null;
    chrome.storage.onChanged.addListener((changes, namespace: string) => {
      if (namespace === 'sync') {
        // Clear any pending updates
        if (debounceTimer !== null) {
          clearTimeout(debounceTimer);
        }
        
        // Debounce updates to avoid processing multiple changes in quick succession
        debounceTimer = setTimeout(() => {
          // Handle link list changes
          if (changes[CURRENT_LIST_VERSION]) {
            const list = changes[CURRENT_LIST_VERSION].newValue as LinkNodeFlat[] || [];
            state.rawList.val = list;
            state.updateNames();
            state.root.val = TreeService.buildTree(list);
            UiComponents.renderWelcomeMessage();
          }
          
          // Handle settings changes
          if (changes[SETTINGS_VERSION]) {
            const newSettings = changes[SETTINGS_VERSION].newValue as Settings;
            state.settings.val = newSettings;
            applyTheme(newSettings.theme);
          }
          
          debounceTimer = null;
        }, 50) as unknown as number;
      }
    });
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to load data. Please refresh the page to try again.');
  }
}

// Helper function to apply theme
function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const html = document.documentElement;
  
  // Remove any explicit theme class first
  html.classList.remove('theme-light', 'theme-dark');
  
  if (theme === 'system') {
    // Let the browser handle system preferences automatically
    // This will work with the light-dark() CSS function
    html.style.colorScheme = 'light dark';
    
    // Remove data-theme attribute to let system preferences take over
    if (html.hasAttribute('data-theme')) {
      html.removeAttribute('data-theme');
    }
  } else {
    // Set explicit theme
    html.style.colorScheme = theme;
    // Add theme class for any legacy styling
    html.classList.add(`theme-${theme}`);
    html.dataset.theme = theme;
  }
}

// Start the application
initializeApp().catch(console.error); 