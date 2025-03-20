import { AppState } from './app.state';
import { FaviconService } from './favicon.service';
import { a, derive, div, state } from './van';

const handleLinkClick = (e: Event, action: string) => {
  e.preventDefault();
  
  switch (action) {
    case 'settings':
      AppState.settingsMode.val = !AppState.settingsMode.val;
      if (AppState.editMode.val) AppState.editMode.val = false;
      break;
      
    case 'new':
      AppState.editMode.val = !AppState.editMode.val;
      if (AppState.settingsMode.val) AppState.settingsMode.val = false;
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
          style: "color: red; ",
          onclick: (e) => FaviconService.requestFaviconPermissions()
        }, "Fix favicon permissions (!)")
      ]);
    }
    
    return messageList;
  });

  return div({ class: "footer" },
    () => div(...messages.val),
    div(
      a({ 
        href: "#", 
        onclick: (e) => handleLinkClick(e, 'new')
      }, "[+]"),
      a({ 
        href: "#", 
        onclick: (e) => handleLinkClick(e, 'settings')
      }, "[settings]"),
    )
  );
}