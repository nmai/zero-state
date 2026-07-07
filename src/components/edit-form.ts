import { addNode, requestFaviconPermissionIfNeeded, updateNode, updateSettings } from '../actions';
import { FAVICON_PROVIDER_NAMES } from '../constants';
import { validateNodeForm } from '../services/validation';
import { editMode, editingNode, rawList, settings } from '../state';
import { FaviconProvider, LinkNodeFlat } from '../types';
import { br, derive, div, form, input, label, li, option, select, state, ul } from '../van';

export function EditFormPanel() {
  const nameField = state('');
  const urlField = state('');
  const parentField = state('');
  const iconField = state<FaviconProvider>(settings.rawVal.defaultFaviconProvider);
  const borderField = state<0 | 1>(1);
  const errorMessage = state('');
  let originalName = '';

  const isEditing = () => editingNode.val !== null;

  const resetFields = () => {
    nameField.val = '';
    urlField.val = '';
    parentField.val = '';
    iconField.val = settings.rawVal.defaultFaviconProvider;
    borderField.val = 1;
    errorMessage.val = '';
    originalName = '';
  };

  // Populate the form when a node is selected for editing, reset when cleared.
  // settings is read via rawVal so unrelated settings changes don't clobber an
  // in-progress edit.
  derive(() => {
    const node = editingNode.val;
    if (node) {
      nameField.val = node.name;
      urlField.val = node.url ?? '';
      parentField.val = node.parent ?? '';
      iconField.val = node.icon ?? settings.rawVal.defaultFaviconProvider;
      borderField.val = node.border ?? 1;
      errorMessage.val = '';
      originalName = node.name;
    } else {
      resetFields();
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const editing = isEditing();
    const name = nameField.val.trim();
    const url = urlField.val.trim();
    const parent = parentField.val.trim();

    const validationError = validateNodeForm({
      name,
      url,
      parent,
      nodes: rawList.val,
      originalName: editing ? originalName : undefined,
    });
    if (validationError) {
      errorMessage.val = validationError;
      return;
    }
    errorMessage.val = '';

    const item: LinkNodeFlat = { name };
    if (parent) item.parent = parent;
    if (url) {
      item.url = url;
      item.icon = iconField.val;
      item.border = borderField.val;
    }
    if (editing && editingNode.val?.taskComplete) {
      item.taskComplete = true;
    }

    // Remember the last provider the user picked as the default for next time
    if (url && iconField.val !== settings.val.defaultFaviconProvider) {
      void updateSettings({ defaultFaviconProvider: iconField.val });
    }

    const saved = editing ? await updateNode(originalName, item) : await addNode(item);
    if (!saved) return;

    editingNode.val = null;
    resetFields();
    await requestFaviconPermissionIfNeeded();
  };

  return form({
    id: 'newlink-form',
    class: () => (editMode.val ? '' : 'display-none'),
    onsubmit: handleSubmit,
  },
    div({ class: 'form-header' }, () => (isEditing() ? 'Edit Item' : 'Add New Item')),

    label({ for: 'newlink-name' }, 'Name:'), br(),
    input({
      type: 'text',
      id: 'newlink-name',
      name: 'newlink-name',
      autocomplete: 'off',
      value: nameField,
      oninput: (e: Event) => nameField.val = (e.target as HTMLInputElement).value,
    }), br(),

    label({ for: 'newlink-url' }, 'URL (optional):'), br(),
    input({
      type: 'text',
      id: 'newlink-url',
      name: 'newlink-url',
      autocomplete: 'off',
      value: urlField,
      oninput: (e: Event) => urlField.val = (e.target as HTMLInputElement).value,
    }), br(),

    label({ for: 'newlink-parent' }, 'Parent (optional):'), br(),
    input({
      type: 'text',
      id: 'newlink-parent',
      name: 'newlink-parent',
      autocomplete: 'off',
      value: parentField,
      oninput: (e: Event) => parentField.val = (e.target as HTMLInputElement).value,
    }), br(),

    label({ for: 'newlink-icon' }, 'Favicon options (for URLs):'), br(),
    div({ class: 'select-wrapper' },
      select({
        id: 'newlink-icon',
        name: 'newlink-icon',
        value: iconField,
        onchange: (e: Event) => iconField.val = (e.target as HTMLSelectElement).value as FaviconProvider,
      },
        ...Object.entries(FAVICON_PROVIDER_NAMES).map(([value, text]) =>
          option({ value, selected: () => iconField.val === value }, text),
        ),
      ),
      br(),
      select({
        id: 'newlink-border',
        name: 'newlink-border',
        value: borderField,
        onchange: (e: Event) => borderField.val = parseInt((e.target as HTMLSelectElement).value) as 0 | 1,
      },
        option({ value: '1' }, 'Bordered'),
        option({ value: '0' }, 'No border'),
      ),
    ), br(),

    () => errorMessage.val ? div({ class: 'form-error' }, errorMessage.val) : null,

    div({ class: 'form-actions' },
      input({ type: 'submit', value: () => (isEditing() ? 'Update' : 'Add') }),
      () => isEditing()
        ? input({
            type: 'button',
            value: 'Cancel',
            onclick: () => { editingNode.val = null; },
          })
        : null,
    ),

    ul({ class: 'form-hint' },
      li({}, 'Click on any highlighted item to edit it'),
      li({}, 'Click the [-] icon next to an item to delete it'),
      li({}, 'Press Esc to exit edit mode'),
      li({}, 'Press ~ to toggle edit mode'),
    ),
  );
}
