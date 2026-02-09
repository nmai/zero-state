import { DOM_CLASSES, FAVICON_PROVIDER_NAMES } from '../core/constants';
import { FaviconProvider, LinkNodeFlat } from '../core/types';
import { state, derive, form, div, label, br, input, select, option, ul, li } from '../core/van';
import { CommandService } from '../services/command.service';
import { ValidatorService } from '../services/validator.service';
import { DataState } from '../state/data.state';
import { UIState } from '../state/ui.state';

export class EditForm {
  static renderAddForm() {
    const nameField = state('');
    const urlField = state('');
    const parentField = state('');
    const iconField = state('');
    const borderField = state(1);

    const isEditing = () => UIState.editingNode.val !== null;
    const originalName = state('');

    const resetForm = () => {
      nameField.val = '';
      urlField.val = '';
      parentField.val = '';
      iconField.val = DataState.settings.val.defaultFaviconProvider;
      borderField.val = 1;
      originalName.val = '';
    };

    derive(() => {
      const editNode = UIState.editingNode.val;
      if (editNode) {
        nameField.val = editNode.name;
        urlField.val = editNode.url || '';
        parentField.val = editNode.parent || '';
        iconField.val = editNode.icon || DataState.settings.val.defaultFaviconProvider;
        borderField.val = editNode.border ?? 1;
        originalName.val = editNode.name;
      } else {
        resetForm();
      }
    });

    const handleSubmit = async (e: Event) => {
      e.preventDefault();

      const name = nameField.val.trim();
      const url = urlField.val.trim();
      const parent = parentField.val.trim();
      const icon = iconField.val as FaviconProvider;
      const border = borderField.val;

      let errorMessage: string | null = null;

      if (name.length === 0) {
        errorMessage = 'Name must be populated';
      } else if (!isEditing() && DataState.names.val.includes(name)) {
        errorMessage = 'Name already taken';
      } else if (isEditing() && name !== originalName.val && DataState.names.val.includes(name)) {
        errorMessage = 'Name already taken';
      } else if (url.length > 0 && !ValidatorService.isValidUrl(url)) {
        errorMessage = 'URL format invalid';
      } else if (parent.length > 0 && !DataState.names.val.includes(parent)) {
        errorMessage = 'Parent does not exist';
      }

      if (errorMessage) {
        alert(errorMessage);
        return;
      }

      const item: LinkNodeFlat = {
        name,
        url: url || undefined,
        parent: parent || undefined,
        icon,
        border: border as 0 | 1,
      };

      if (isEditing() && UIState.editingNode.val?.taskComplete) {
        item.taskComplete = UIState.editingNode.val.taskComplete;
      }

      if (isEditing()) {
        const newDefaultIcon = icon !== DataState.settings.val.defaultFaviconProvider ? icon : undefined;
        await CommandService.updateItem(originalName.val, item, newDefaultIcon);
      } else {
        await CommandService.addItem(item);
      }

      UIState.editingNode.val = null;
      resetForm();
    };

    return form({
      id: "newlink-form",
      class: () => UIState.editMode.val ? "" : DOM_CLASSES.DISPLAY_NONE,
      onsubmit: handleSubmit
    },
      div({ class: "form-header" },
        () => isEditing() ? "Edit Item" : "Add New Item",
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

        () => isEditing() ?
          input({
            type: "button",
            value: "Cancel",
            onclick: () => {
              UIState.editingNode.val = null;
              resetForm();
            }
          }) : null
      ),

      ul({ class: "form-hint" },
        li({}, "Click on any highlighted item to edit it"),
        li({}, "Click the [-] icon next to an item to delete it"),
        li({}, "Press ESC or the close button to exit edit mode"),
        li({}, "Press ~ to toggle edit mode")
      )
    );
  }
}
