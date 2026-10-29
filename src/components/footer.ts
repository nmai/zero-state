import { requestFaviconPermissionIfNeeded } from '../actions';
import { editMode, footerMessages, settingsMode } from '../state';
import { a, div, span } from '../van';

export function Footer() {
  return div({ class: 'footer' },
    // '' rather than null: once a VanJS binding returns null its node is removed for good
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
      : '',
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
