import { FaviconService } from '../services/favicon.service';
import { UIState } from '../state/ui.state';
import { a, derive, div, span } from '../core/van';

export function renderFooter() {
  const messages = derive(() => {
    const messageList: any[] = [];

    if (UIState.footerMessages.val.has('request-favicon-permission')) {
      messageList.push([
        a({
          href: "#",
          onclick: () => FaviconService.requestFaviconPermissions()
        },
        span({}, "Action required: Grant permission to use the chrome favicon cache. "),
        span({}, "Alternatively, change all icons to use a different provider."))
      ]);
    }

    return messageList;
  });

  return div({ class: "footer" },
    () => div(messages.val),
    div(
      a({
        href: "#",
        onclick: (e: Event) => {
          e.preventDefault();
          UIState.settingsMode.val = !UIState.settingsMode.val;
          if (UIState.editMode.val) UIState.editMode.val = false;
        }
      }, "[settings]"),
    )
  );
}
