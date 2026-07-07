import { requestFaviconPermissionIfNeeded } from '../actions';
import { editMode, footerMessages, settingsMode } from '../state';
import { a, div, span } from '../van';

export function Footer() {
  return div({ class: 'footer' },
    () => footerMessages.val.has('request-favicon-permission')
      ? div(
          a({
            href: '#',
            onclick: (e: Event) => {
              e.preventDefault();
              void requestFaviconPermissionIfNeeded();
            },
          },
            span({}, 'Action required: Grant permission to use the chrome favicon cache. '),
            span({}, 'Alternatively, change all icons to use a different provider.'),
          ),
        )
      : null,
    div(
      a({
        href: '#',
        onclick: (e: Event) => {
          e.preventDefault();
          settingsMode.val = !settingsMode.val;
          if (editMode.val) editMode.val = false;
        },
      }, '[settings]'),
    ),
  );
}
