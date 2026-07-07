import { ICONS } from '../constants';
import { editMode, toggleEditMode } from '../state';
import { a, div } from '../van';
import { EditFormPanel } from './edit-form';

function ToggleEditButton() {
  return a({
    id: 'toggle-form-btn',
    href: '#',
    onclick: (e: Event) => {
      e.preventDefault();
      toggleEditMode();
    },
  }, () => (editMode.val ? ICONS.MINUS : ICONS.PLUS));
}

export function SidePanel() {
  return div({ class: 'row row-side-panel' },
    div({ class: 'col' },
      div({}, ToggleEditButton()),
      EditFormPanel(),
    ),
  );
}
