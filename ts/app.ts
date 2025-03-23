import { CURRENT_LIST_VERSION, DOM_CLASSES, ICONS, SETTINGS_VERSION } from './constants';
import { SettingsComponent } from './settings.component';
import { AppState } from './app.state';
import { StorageService } from './storage.service';
import { applyTheme } from './theme.service';
import { LinkNode, LinkNodeFlat, Settings } from './types';
import { add, state, derive, div, a, form, label, input, span, ul, li, br, img, h2, h3, p } from './van'
import { ValidatorService } from './validator.service';
import { TreeService } from './tree.service';
import { FaviconService } from './favicon.service';
import { renderFooter } from './footer.component';


// UI Components using VanJS
class UiComponents {

  static createDeleteButton(node: LinkNodeFlat) {
    return a({ href: "#", onclick: (e: Event) => {
      e.preventDefault();
      AppState.removeItem(node);
      StorageService.save(AppState.rawList.val)
        .then(() => {
          AppState.root.val = TreeService.buildTree(AppState.rawList.val);
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

  static renderAddForm() {
    const nameField = state('');
    const urlField = state('');
    const parentField = state('');
    
    // Set up to track if we're in edit mode
    const isEditing = () => AppState.editingNode.val !== null;
    const originalName = state('');
    
    // Effect to populate the form when editing node changes
    derive(() => {
      const editNode = AppState.editingNode.val;
      if (editNode) {
        nameField.val = editNode.name;
        urlField.val = editNode.url || '';
        parentField.val = editNode.parent || '';
        originalName.val = editNode.name;
      } else {
        // Clear the form when not editing
        nameField.val = '';
        urlField.val = '';
        parentField.val = '';
        originalName.val = '';
      }
    });

    const handleSubmit = (e: Event) => {
      e.preventDefault();
      
      const name = nameField.val.trim();
      const url = urlField.val.trim();
      const parent = parentField.val.trim();
      
      // Validation - slightly different for edit vs add
      let errorMessage: string | null = null;
      
      // TODO: Move to validatorservice
      if (name.length === 0) {
        errorMessage = 'Name must be populated';
      } else if (!isEditing() && AppState.names.val.includes(name)) {
        errorMessage = 'Name already taken';
      } else if (isEditing() && name !== originalName.val && AppState.names.val.includes(name)) {
        errorMessage = 'Name already taken';
      } else if (url.length > 0 && !ValidatorService.isValidUrl(url)) {
        errorMessage = 'URL format invalid';
      } else if (parent.length > 0 && !AppState.names.val.includes(parent)) {
        errorMessage = 'Parent does not exist';
      }
      
      if (errorMessage) {
        alert(errorMessage);
        return;
      }
      
      // Build the item object with updated values
      const item: LinkNodeFlat = {
        name: name,
        url: url || undefined,
        parent: parent || undefined,
      };
      
      // If editing an existing node, preserve its task status
      if (isEditing() && AppState.editingNode.val?.taskComplete) {
        item.taskComplete = AppState.editingNode.val.taskComplete;
      }
      
      // Either update or add the item
      if (isEditing()) {
        AppState.updateItem(originalName.val, item);
      } else {
        AppState.addItem(item);
      }
      
      // Save to storage
      StorageService.save(AppState.rawList.val)
        .then(() => {
          // Reset state
          AppState.editMode.val = false;
          AppState.editingNode.val = null;
          nameField.val = '';
          urlField.val = '';
          parentField.val = '';
          originalName.val = '';
          
          // Update tree and welcome message
          AppState.root.val = TreeService.buildTree(AppState.rawList.val);
          this.renderWelcomeMessage();
        })
        .catch(error => {
          console.error('Failed to save item:', error);
          if (!isEditing()) {
            AppState.removeItem(item); // Revert on failure for new items
          }
          alert('Failed to save. Please try again.');
        });
    };

    return form({ 
      id: "newlink-form", 
      class: () => AppState.editMode.val ? "" : DOM_CLASSES.DISPLAY_NONE,
      onsubmit: handleSubmit
    }, 
      div({ class: "form-header" }, 
        () => isEditing() ? "Edit Item" : "Add New Item",
        a({ 
          href: "#", 
          class: "close-form-btn",
          onclick: (e: Event) => {
            e.preventDefault();
            AppState.editMode.val = false;
            AppState.editingNode.val = null;
          },
          innerHTML: ICONS.CLOSE
        })
      ),
      
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
      
      div({ class: "form-actions" },
        input({ 
          type: "submit", 
          value: () => isEditing() ? "Update" : "Add" 
        }),
        
        // Show cancel button when editing
        () => isEditing() ? 
          input({ 
            type: "button", 
            value: "Cancel", 
            onclick: () => {
              AppState.editingNode.val = null;
              nameField.val = '';
              urlField.val = '';
              parentField.val = '';
              originalName.val = '';
            }
          }) : null
      ),
      
      // Add form hint text
      div({ class: "form-hint" },
        "Click on any highlighted item to edit it."
      )
    );
  }

  static renderToggleButton() {
    return a({ 
      id: "toggle-form-btn", 
      href: "#",
      class: () => AppState.editMode.val ? DOM_CLASSES.DISPLAY_NONE : "",
      onclick: (e: Event) => {
        e.preventDefault();
        // Only enable edit mode, don't disable (that's now handled by the close button)
        if (!AppState.editMode.val) {
          AppState.editMode.val = true;
        }
        
        // Close settings mode if open
        if (AppState.settingsMode.val) {
          AppState.settingsMode.val = false;
        }
      },
      innerHTML: ICONS.EDIT
    });
  }

  static renderSettingsButton() {
    return a({ 
      id: "settings-btn", 
      href: "#",
      class: () => AppState.editMode.val ? DOM_CLASSES.DISPLAY_NONE : "",
      onclick: (e: Event) => {
        e.preventDefault();
        AppState.settingsMode.val = !AppState.settingsMode.val;
        
        // Close edit mode if open
        if (AppState.editMode.val) {
          AppState.editMode.val = false;
          AppState.editingNode.val = null;
        }
      },
      innerHTML: ICONS.SETTINGS
    });
  }

  static renderWelcomeMessage() {
    // Check if welcome message should be shown
    const shouldShow = AppState.rawList.val.length === 0;
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
      add(overlayContainer, welcomeMessage);
    } else if (!shouldShow && hasWelcomeMessage) {
      // Just clear the welcome message
      overlayContainer.innerHTML = '';
    }
  }

  static renderSidePanel() {
    return div({ class: "row row-side-panel" },
      div({ class: "col" },
        div({ 
          class: () => `${DOM_CLASSES.BUTTON_GROUP} ${AppState.editMode.val ? 'hidden-in-edit-mode' : ''}` 
        },
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
      if (AppState.settingsMode.val) {
        return new SettingsComponent(AppState).renderSettingsPage();
      } else {
        return this.renderTree();
      }
    };
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
      renderFooter()
    );
  }
}

function handleListUpdate(list: LinkNodeFlat[]) {
  AppState.rawList.val = list;
  StorageService.applyNodeDefaults(list);
  AppState.updateNames();
  AppState.root.val = TreeService.buildTree(list);
  UiComponents.renderWelcomeMessage();
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
    // TODO: Move this to the start instead of waiting for storage to load
    add(document.body, UiComponents.renderApp());

    // TODO: Update to use the new per-node workflow
    if (await FaviconService.shouldRequestPermission()) {
      AppState.addFooterMessage('request-favicon-permission');
    }

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
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to load data. Please refresh the page to try again.');
  }
}


// Start the application
initializeApp().catch(console.error); 