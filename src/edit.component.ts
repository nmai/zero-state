import { AppState } from './app.state';
import { DOM_CLASSES, FAVICON_PROVIDER_NAMES } from './constants';
import { FaviconService } from './favicon.service';
import { StorageService } from './storage.service';
import { TreeService } from './tree.service';
import { FaviconProvider, LinkNodeFlat } from './types';
import { ValidatorService } from './validator.service';
import { state, derive, form, div, label, br, input, select, option, ul, li } from './van';

export class EditForm {
  static renderAddForm() {
    const nameField = state('');
    const urlField = state('');
    const parentField = state('');
    const iconField = state('');
    const borderField = state(1); // Default to 1 (yes)
    
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
        iconField.val = editNode.icon || AppState.settings.val.defaultFaviconProvider;
        borderField.val = editNode.border ?? 1;
        originalName.val = editNode.name;
      } else {
        // Clear the form when not editing
        nameField.val = '';
        urlField.val = '';
        parentField.val = '';
        iconField.val = AppState.settings.val.defaultFaviconProvider;
        borderField.val = 1;
        originalName.val = '';
      }
    });

    const handleSubmit = (e: Event) => {
      e.preventDefault();
      
      const name = nameField.val.trim();
      const url = urlField.val.trim();
      const parent = parentField.val.trim();
      const icon = iconField.val as FaviconProvider;
      const border = borderField.val;
      
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
        icon: icon,
        border: border as 0 | 1,
      };
      
      // If editing an existing node, preserve its task status
      if (isEditing() && AppState.editingNode.val?.taskComplete) {
        item.taskComplete = AppState.editingNode.val.taskComplete;
      }
      
      // Either update or add the item
      if (isEditing()) {
        AppState.updateItem(originalName.val, item);
        // Update default provider if changed
        if (icon !== AppState.settings.val.defaultFaviconProvider) {
          const newSettings = { ...AppState.settings.val, defaultFaviconProvider: icon as FaviconProvider };
          AppState.settings.val = newSettings;
          StorageService.saveSettings(newSettings).catch(error => {
            console.error('Failed to save settings:', error);
          });
        }
      } else {
        AppState.addItem(item);
      }
      
      // Save to storage
      StorageService.save(AppState.rawList.val)
        .then(async () => {
          // Reset state
          // AppState.editMode.val = false;
          AppState.editingNode.val = null;
          nameField.val = '';
          urlField.val = '';
          parentField.val = '';
          iconField.val = AppState.settings.val.defaultFaviconProvider;
          borderField.val = 1;
          originalName.val = '';
          
          // Update tree
          AppState.root.val = TreeService.buildTree(AppState.rawList.val);

          // Request favicon permission if needed
          if (await FaviconService.shouldRequestPermission()) {
            await FaviconService.requestFaviconPermissions();
          }
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
        // a({ 
        //   href: "#", 
        //   class: "close-form-btn",
        //   onclick: (e: Event) => {
        //     e.preventDefault();
        //     AppState.editMode.val = false;
        //     AppState.editingNode.val = null;
        //   },
        //   innerHTML: ICONS.CLOSE
        // })
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
      
      label({ for: "newlink-url" }, "URL (optional):"), br(),
      input({ 
        type: "text", 
        id: "newlink-url", 
        name: "newlink-url", 
        autocomplete: "off",
        value: urlField,
        oninput: (e: Event) => urlField.val = (e.target as HTMLInputElement).value 
      }), br(),
      
      label({ for: "newlink-parent" }, "Parent (optional):"), br(),
      input({ 
        type: "text", 
        id: "newlink-parent", 
        name: "newlink-parent", 
        autocomplete: "off",
        value: parentField,
        oninput: (e: Event) => parentField.val = (e.target as HTMLInputElement).value 
      }), br(),
      
      // Icon dropdown
      label({ for: "newlink-icon" }, "Favicon options (for URLs):"), br(),
      div({ class: "select-wrapper" },
        select({ 
          id: "newlink-icon", 
          name: "newlink-icon",
          value: iconField,
          onchange: (e: Event) => iconField.val = (e.target as HTMLSelectElement).value as FaviconProvider
        },
          ...Object.keys(FAVICON_PROVIDER_NAMES).map((value: string) =>
            option({ 
              value,
              selected: () => iconField.val === value
            }, 
            FAVICON_PROVIDER_NAMES[value as keyof typeof FAVICON_PROVIDER_NAMES])
          )
        ),
        br(),
        select({ 
          id: "newlink-border", 
          name: "newlink-border",
          value: borderField,
          onchange: (e: Event) => borderField.val = parseInt((e.target as HTMLSelectElement).value)
        },
          option({ value: "1" }, "Bordered"),
          option({ value: "0" }, "No border")
        )
      ), br(),
      
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
              iconField.val = AppState.settings.val.defaultFaviconProvider;
              borderField.val = 1;
              originalName.val = '';
            }
          }) : null
      ),
      
      // Add form hint text
      ul({ class: "form-hint" },
        li({}, "Click on any highlighted item to edit it"),
        li({}, "Click the [-] icon next to an item to delete it"),
        li({}, "Press ESC or the close button to exit edit mode"),
        li({}, "Press ~ to toggle edit mode")
      )
    );
  }
}