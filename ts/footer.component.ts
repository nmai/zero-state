import { AppState } from './app.state';
import { FaviconService } from './favicon.service';
import { a, derive, div, span, state } from './van';

const handleLinkClick = (e: Event, action: string) => {
  e.preventDefault();
  
  switch (action) {
    case 'settings':
      AppState.settingsMode.val = !AppState.settingsMode.val;
      if (AppState.editMode.val) AppState.editMode.val = false;
      break;

    case 'request-favicon-permission':
      FaviconService.requestFaviconPermissions();
      break;
  }
};

export function renderFooter() {
  const messages = derive(() => {
    const messageList: any[] = [];
    
    if (AppState.footerMessages.val.has('request-favicon-permission')) {
      messageList.push([
        a({
          href: "#",
          onclick: (e) => FaviconService.requestFaviconPermissions()
        },
        span({
          // style: "color: red; font-weight: bold;"
        }, "Action required: Grant permission to use the chrome favicon cache. "),
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
        onclick: (e) => handleLinkClick(e, 'settings')
      }, "[settings]"),
    )
  );
}