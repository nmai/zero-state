import { CURRENT_LIST_VERSION, SETTINGS_VERSION, loadSvgIcons } from './core/constants';
import { LinkNodeFlat, Settings } from './core/types';
import { add, a, div } from './core/van';
import { SettingsComponent } from './components/settings.component';
import { EditForm } from './components/edit-form.component';
import { TreeComponent } from './components/tree.component';
import { renderFooter } from './components/footer.component';
import { CommandService } from './services/command.service';
import { StorageService } from './services/storage.service';
import { UIState } from './state/ui.state';

const settingsComponent = new SettingsComponent();

function renderToggleButton() {
  return a({
    id: "toggle-form-btn",
    href: "#",
    onclick: (e: Event) => {
      e.preventDefault();
      UIState.editMode.val = !UIState.editMode.val;
      UIState.editingNode.val = null;

      if (UIState.settingsMode.val) {
        UIState.settingsMode.val = false;
      }
    },
  },
    () => UIState.editMode.val ? `[−]` : `[+]`
  );
}

function renderSidePanel() {
  return div({ class: "row row-side-panel" },
    div({ class: "col" },
      div({},
        renderToggleButton(),
      ),
      EditForm.renderAddForm()
    )
  );
}

function renderOverlay() {
  return div({ id: "overlay-container" },
    UIState.settingsMode.val ? settingsComponent.renderSettingsPage() : null
  );
}

function renderMain() {
  return div({},
    div({ class: "row" },
      () => TreeComponent.renderTree(),
      renderSidePanel()
    ),
  );
}

async function initializeApp(): Promise<void> {
  try {
    // Load SVG icons and stored data in parallel
    const [storedList, storedSettings] = await Promise.all([
      StorageService.load(),
      StorageService.loadSettings(),
      loadSvgIcons(),
    ]);

    await CommandService.handleListUpdate(storedList);
    CommandService.handleSettingsUpdate(storedSettings);

    add(document.body,
      () => renderOverlay(),
      renderMain(),
      renderFooter(),
    );

    StorageService.printStartupInfo();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        console.log('storage changed', changes);

        if (changes[CURRENT_LIST_VERSION]) {
          const newList = changes[CURRENT_LIST_VERSION].newValue as LinkNodeFlat[] || [];
          CommandService.handleListUpdate(newList);
        }

        if (changes[SETTINGS_VERSION]) {
          const newSettings = changes[SETTINGS_VERSION].newValue as Settings;
          CommandService.handleSettingsUpdate(newSettings);
        }
      }
    });

    addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        UIState.editMode.val = false;
        UIState.editingNode.val = null;
        UIState.settingsMode.val = false;
      }
      else if (event.key === "`" || event.key === "~") {
        UIState.editMode.val = !UIState.editMode.val;
        UIState.editingNode.val = null;
      }
    });

    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to load data. Please refresh the page to try again.');
  }
}

initializeApp().catch(console.error);
