import { CURRENT_LIST_VERSION, DOM_CLASSES, ICONS, SETTINGS_VERSION, FAVICON_PROVIDER_NAMES } from './constants';
import { SettingsComponent } from './settings.component';
import { AppState } from './app.state';
import { StorageService } from './storage.service';
import { applyTheme } from './theme.service';
import { LinkNode, LinkNodeFlat, Settings, FaviconProvider } from './types';
import { add, state, derive, div, a, form, label, input, span, ul, li, br, img, h2, h3, p, select, option } from './van'
import { ValidatorService } from './validator.service';
import { TreeService } from './tree.service';
import { FaviconService } from './favicon.service';
import { renderFooter } from './footer.component';
import { EditForm } from './edit.component';


// UI Components using VanJS
class UiComponents {
  private static settingsComponent = new SettingsComponent(AppState);

  static createDeleteButton(node: LinkNodeFlat) {
    return a({ href: "#", onclick: (e: Event) => {
      e.preventDefault();
      AppState.removeItem(node);
      StorageService.save(AppState.rawList.val)
        .then(() => {
          AppState.root.val = TreeService.buildTree(AppState.rawList.val);
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
        AppState.swapNodePositions(node, prevSibling);
        StorageService.save(AppState.rawList.val)
          .then(() => {
            AppState.root.val = TreeService.buildTree(AppState.rawList.val);
          })
          .catch(error => {
            console.error('Failed to save after position change:', error);
            AppState.swapNodePositions(node, prevSibling); // Revert on failure
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
        AppState.swapNodePositions(node, nextSibling);
        StorageService.save(AppState.rawList.val)
          .then(() => {
            AppState.root.val = TreeService.buildTree(AppState.rawList.val);
          })
          .catch(error => {
            console.error('Failed to save after position change:', error);
            AppState.swapNodePositions(node, nextSibling); // Revert on failure
            alert('Failed to move item down. Please try again.');
          });
      }
    }, ICONS.DOWN);
  }

  static createEditButton(node: LinkNodeFlat) {
    return a({ 
      href: "#", 
      class: "edit-node-btn",
      title: "Edit",
      innerHTML: ICONS.EDIT,
      onclick: (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Set the editing node in state
        AppState.editingNode.val = node;
        
        // Make sure edit mode is enabled
        if (!AppState.editMode.val) {
          AppState.editMode.val = true;
        }
        
        // The form will be populated based on this state in renderAddForm
      }
    });
  }

  static renderNodeContent(node: LinkNode) {
    const contentClasses = [];
    if (node.taskComplete) contentClasses.push(DOM_CLASSES.TEXT_LINETHROUGH);
    
    // Add editable class when in edit mode
    if (AppState.editMode.val) contentClasses.push('editable-node');

    const handleNodeClick = (e: Event) => {
      // Only handle clicks when in edit mode
      if (AppState.editMode.val) {
        e.preventDefault();
        e.stopPropagation();
        
        // Set the editing node in state
        AppState.editingNode.val = node;
      }
    };

    function faviconClasses(node: LinkNodeFlat) {
      if (node.border == 1)
        return "favicon border-effect";
      return "favicon";
    }

    if (node.url) {
      return span({ class: contentClasses.join(' ') }, 
        a({ 
          href: node.url, 
          onclick: handleNodeClick
        }, 
          () => FaviconService.displayIcon(node) ? 
          img({ src: FaviconService.getIcon(node.url || '', node.icon), class: faviconClasses(node) }) : null,
          node.name
        )
      );
    } else {
      return span({ 
        class: contentClasses.join(' '), 
        onclick: handleNodeClick,
        style: AppState.editMode.val ? "cursor: pointer;" : ""
      }, node.name);
    }
  }

  static renderNode(node: LinkNode, siblings?: LinkNode[], index?: number) {
    const nodeClass = TreeService.hasChildren(node) 
      ? `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_PARENT}` 
      : `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_CHILD}`;

    const children: any[] = [];
    
    // Add up/down buttons if in edit mode and node has siblings
    if (AppState.editMode.val && siblings && siblings.length > 1) {
      const moveControls = div({ class: "move-controls" });
      const upButton = this.createMoveUpButton(node, siblings, index || 0);
      const downButton = this.createMoveDownButton(node, siblings, index || 0);
      
      if (upButton) add(moveControls, upButton);
      if (downButton) add(moveControls, downButton);
      
      children.push(moveControls);
    }
    
    // Add the main node content
    children.push(this.renderNodeContent(node));

    // Add delete button if form is open and node has no children
    if (AppState.editMode.val && !TreeService.hasChildren(node)) {
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
    if (AppState.settings.val.enableRightClickComplete) {
      liProps.oncontextmenu = (e: Event) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        AppState.toggleTaskComplete(node);
        StorageService.save(AppState.rawList.val)
          .catch(error => {
            console.error('Failed to save task status:', error);
            AppState.toggleTaskComplete(node); // Revert on failure
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
    const tree = AppState.root.val;
    if (!tree.children || tree.children.length === 0) {
      return div({ id: "lists-container", class: "row main-content" });
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

    return div({ id: "lists-container", class: "row main-content" }, ...listGroups);
  }

  static renderToggleButton() {
    return a({ 
      id: "toggle-form-btn", 
      href: "#",
      onclick: (e: Event) => {
        e.preventDefault();
        AppState.editMode.val = !AppState.editMode.val;
        
        // Close settings mode if open
        if (AppState.settingsMode.val) {
          AppState.settingsMode.val = false;
        }
      },
    },
      () => AppState.editMode.val ? `[−]` : `[+]`
    );
  }

  static renderSidePanel() {
    return div({ class: "row row-side-panel" },
      div({ class: "col" },
        div({},
          this.renderToggleButton(),
        ),
        EditForm.renderAddForm()
      )
    );
  }

  static renderOverlay() {
    return div({ id: "overlay-container" },
      AppState.settingsMode.val ? this.settingsComponent.renderSettingsPage() : null
    )
  }
  
  static renderMain() {
    return div({},
      // Main row containing the content
      div({ class: "row" },
        // Main content area - will be populated by renderMainContent
        () => this.renderTree(),
        // Side panel with buttons and form TODO: Move this to overlay
        UiComponents.renderSidePanel()
      ),
    );
  }
}

function handleListUpdate(list: LinkNodeFlat[]) {
  AppState.rawList.val = list;
  StorageService.applyNodeDefaults(list);
  AppState.updateNames();
  AppState.root.val = TreeService.buildTree(list);

  FaviconService.shouldRequestPermission().then( result => {
    if (result) {
      AppState.addFooterMessage('request-favicon-permission');
    } else {
      AppState.removeFooterMessage('request-favicon-permission');
    }
  });
}

function handleSettingsUpdate(settings: Settings) {
  AppState.settings.val = settings;
  applyTheme(settings.theme);
}

// Initialize application
async function initializeApp(): Promise<void> {
  try {
    // Initialize state with stored data
    const [storedList, storedSettings] = await Promise.all([
      StorageService.load(),
      StorageService.loadSettings()
    ]);

    handleListUpdate(storedList);
    handleSettingsUpdate(storedSettings);
    // Render the entire application using VanJS
    // This creates the complete DOM structure including overlay container, main content, and footer
    // Review: Consider moving this to the start instead of waiting for storage to load
    add(document.body,
      () => UiComponents.renderOverlay(),
      UiComponents.renderMain(),
      renderFooter(),
    );

    StorageService.printStartupInfo();
    
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        console.log('storage changed', changes);

        // Handle link list changes
        if (changes[CURRENT_LIST_VERSION]) {
          const newList = changes[CURRENT_LIST_VERSION].newValue as LinkNodeFlat[] || [];
          handleListUpdate(newList);
        }
        
        // Handle settings changes
        if (changes[SETTINGS_VERSION]) {
          const newSettings = changes[SETTINGS_VERSION].newValue as Settings;
          handleSettingsUpdate(newSettings);
        }
      }
    });

    addEventListener("keydown", async (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        AppState.editMode.val = false;
        AppState.settingsMode.val = false;
      }
      else if (event.key === "`" || event.key === "~") {
        AppState.editMode.val = !AppState.editMode.val;
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