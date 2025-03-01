import type { Van } from "../static/lib/van-1.5.3.js"
declare const van: Van
const { div, a, form, label, input, span, ul, li, br, img } = van.tags

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

// Constants
const CURRENT_LIST_VERSION = 'links-v1';
const DOM_CLASSES = {
  DISPLAY_NONE: 'display-none',
  TREE_LIST: 'tree-list',
  TREE_ITEM: 'tree-item',
  TEXT_PARENT: 'text-parent',
  TEXT_CHILD: 'text-child',
  TEXT_LINETHROUGH: 'text-linethrough',
  WELCOME_MESSAGE: 'welcome-message',
};

const ICONS = {
  MINUS: '[\u2212]',
  PLUS: '[+]',
};

// State
class AppState {
  editMode = van.state(false);
  rawList = van.state<LinkNodeFlat[]>([]);
  names = van.state<string[]>([]);
  root = van.state<LinkNode>({
    name: 'Root',
    children: []
  });
  createdTable = van.state<Record<string, LinkNode>>({});

  updateNames(): void {
    this.names.val = this.rawList.val.map(item => item.name);
  }

  addItem(item: LinkNodeFlat): void {
    this.rawList.val = [...this.rawList.val, item];
    this.updateNames();
  }

  removeItem(item: LinkNodeFlat): void {
    const index = this.rawList.val.findIndex(i => i.name === item.name);
    if (index !== -1) {
      const newList = [...this.rawList.val];
      newList.splice(index, 1);
      this.rawList.val = newList;
      this.updateNames();
    }
  }

  toggleTaskComplete(node: LinkNodeFlat): void {
    const newList = [...this.rawList.val];
    const foundItem = newList.find(item => item.name === node.name);
    if (foundItem) {
      foundItem.taskComplete = !foundItem.taskComplete;
      this.rawList.val = newList;
    }
  }
}

const state = new AppState();

// Storage Service
class StorageService {
  static save(list: LinkNodeFlat[]): Promise<void> {
    // Clone to break references and clean
    const cloneList = JSON.parse(JSON.stringify(list)) as LinkNodeFlat[];
    
    // Remove any transient properties
    cloneList.forEach((n: any) => delete n.children);

    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [CURRENT_LIST_VERSION]: cloneList }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Data saved successfully');
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
          console.log('Fetched data:', result);
          const data = result[CURRENT_LIST_VERSION] as LinkNodeFlat[] | undefined;
          resolve(data || []);
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
  static buildTree(rawList: LinkNodeFlat[]): LinkNode {
    const root: LinkNode = {
      name: 'Root',
      children: []
    };
    
    const createdTable: Record<string, LinkNode> = {};
    const nonrootList: LinkNodeFlat[] = [];
    
    // First pass: Add root level items
    for (const item of rawList) {
      if (!item.parent) {
        const node = { ...item } as LinkNode;
        root.children!.push(node);
        createdTable[node.name] = node;
      } else {
        nonrootList.push({ ...item });
      }
    }
    
    // Second pass: Process items with parents
    let safetyCount = 0;
    const MAX_ITERATIONS = 1000; // Safety limit to prevent infinite loops
    
    while (nonrootList.length > 0 && safetyCount < MAX_ITERATIONS) {
      const remainingItems: LinkNodeFlat[] = [];
      
      for (const item of nonrootList) {
        const parent = createdTable[item.parent!];
        
        if (parent) {
          const node = { ...item } as LinkNode;
          parent.children = parent.children || [];
          parent.children.push(node);
          createdTable[node.name] = node;
        } else {
          remainingItems.push(item);
        }
      }
      
      // If we couldn't process any items in this iteration, break to avoid infinite loop
      if (remainingItems.length === nonrootList.length) {
        console.error('Unable to process remaining items due to missing parents:', remainingItems);
        break;
      }
      
      nonrootList.length = 0;
      nonrootList.push(...remainingItems);
      safetyCount++;
    }
    
    state.createdTable.val = createdTable;
    return root;
  }

  static hasChildren(node: LinkNode): boolean {
    return Boolean(node.children && node.children.length > 0);
  }
}

// UI Components using VanJS
class UiComponents {
  static getFaviconUrl(urlStr: string): string {
    try {
      const url = new URL(urlStr);
      let faviconPath = 'favicon.ico';
      let faviconOrigin = url.origin;
      
      // Custom favicon handling for specific sites
      switch (url.hostname) {
        case 'zoom.us':
          faviconPath = 'zoom.ico';
          break;
        case 'calendar.google.com':
          faviconPath = 'googlecalendar/images/favicon_v2014_3.ico';
          break;
        case 'www.figma.com':
          faviconOrigin = 'https://static.figma.com';
          faviconPath = 'app/icon/1/icon-128.png';
          break;
        case 'www.atlassian.com':
          faviconOrigin = 'https://wac-cdn.atlassian.com';
          faviconPath = 'assets/img/favicons/atlassian/favicon.png';
          break;
        case 'localhost':
          faviconOrigin = '';
          faviconPath = 'misc/favicon.ico';
          break;
      }
      
      return `${faviconOrigin}/${faviconPath}`;
    } catch (error) {
      console.error('Invalid URL for favicon:', urlStr, error);
      return 'misc/favicon.ico'; // Fallback to default favicon
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

  static renderNodeContent(node: LinkNode) {
    const contentClasses = [];
    if (node.taskComplete) contentClasses.push(DOM_CLASSES.TEXT_LINETHROUGH);

    if (node.url) {
      return span({ class: contentClasses.join(' ') }, 
        a({ href: node.url }, 
          span({}, img({ src: this.getFaviconUrl(node.url), class: "favicon" })),
          node.name
        )
      );
    } else {
      return span({ class: contentClasses.join(' ') }, node.name);
    }
  }

  static renderNode(node: LinkNode) {
    const nodeClass = TreeService.hasChildren(node) 
      ? `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_PARENT}` 
      : `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_CHILD}`;

    const children: any[] = [
      this.renderNodeContent(node)
    ];

    // Add delete button if form is open and node has no children
    if (state.editMode.val && !TreeService.hasChildren(node)) {
      children.push(this.createDeleteButton(node));
    }

    // Add children container if needed
    if (TreeService.hasChildren(node) && node.children) {
      children.push(this.renderChildList(node.children));
    }

    return li({ 
      id: 'listchild-' + node.name, 
      class: nodeClass,
      oncontextmenu: (e: Event) => {
        e.preventDefault();
        state.toggleTaskComplete(node);
        StorageService.save(state.rawList.val)
          .catch(error => {
            console.error('Failed to save task status:', error);
            state.toggleTaskComplete(node); // Revert on failure
            alert('Failed to update task status. Please try again.');
          });
      }
    }, ...children);
  }

  static renderChildList(children: LinkNode[]) {
    return ul({ class: DOM_CLASSES.TREE_LIST }, 
      ...children.map(child => this.renderNode(child))
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
      listGroups.push(
        ul({ 
          id: `list-group-${treeIndex}`, 
          class: `${DOM_CLASSES.TREE_LIST} col` 
        }, this.renderNode(node))
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
      }
    }, () => state.editMode.val ? ICONS.MINUS : ICONS.PLUS);
  }

  static renderWelcomeMessage() {
    // Check if welcome message should be shown
    const shouldShow = state.rawList.val.length === 0;
    const overlayContainer = document.getElementById('overlay-container');
    
    // Clear existing welcome message
    if (overlayContainer) {
      while (overlayContainer.firstChild) {
        overlayContainer.removeChild(overlayContainer.lastChild!);
      }
      
      // Add welcome message if needed
      if (shouldShow) {
        const welcomeMessage = div({ class: DOM_CLASSES.WELCOME_MESSAGE },
          "This is Zero State. To add your first node, click the [+] button in the top right corner"
        );
        van.add(overlayContainer, welcomeMessage);
      }
    }
  }

  static renderSidePanel() {
    return div({ class: "row row-side-panel" },
      div({ class: "col" },
        this.renderToggleButton(),
        this.renderAddForm()
      )
    );
  }

  static renderMainContent() {
    // Use van state to create a reactive binding to the root state
    return () => this.renderTree();
  }
}

// Initialize application
async function initializeApp(): Promise<void> {
  try {
    const storedList = await StorageService.load();
    state.rawList.val = storedList;
    state.updateNames();
    
    state.root.val = TreeService.buildTree(state.rawList.val);
    UiComponents.renderWelcomeMessage();
    
    // Render main app components to replace existing containers
    const mainContainer = document.querySelector('.row');
    if (mainContainer) {
      // Clear existing content
      while (mainContainer.firstChild) {
        mainContainer.removeChild(mainContainer.lastChild!);
      }
      
      // Add new VanJS-rendered content - using van.add which automatically 
      // binds reactive functions and state objects
      van.add(mainContainer, UiComponents.renderMainContent());
      van.add(mainContainer, UiComponents.renderSidePanel());
    }
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, namespace: string) => {
      if (namespace === 'sync' && changes[CURRENT_LIST_VERSION]) {
        const list = changes[CURRENT_LIST_VERSION].newValue as LinkNodeFlat[] || [];
        state.rawList.val = list;
        state.updateNames();
        state.root.val = TreeService.buildTree(list);
        UiComponents.renderWelcomeMessage();
      }
    });
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to load data. Please refresh the page to try again.');
  }
}

// Start the application
initializeApp().catch(console.error); 