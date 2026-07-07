import { syncFaviconPermissionNotice } from './actions';
import { Footer } from './components/footer';
import { SettingsModal } from './components/settings-modal';
import { SidePanel } from './components/side-panel';
import { TreeView } from './components/tree-view';
import { LIST_STORAGE_KEY, SETTINGS_STORAGE_KEY } from './constants';
import { applyNodeDefaults, loadList, loadSettings, printStartupInfo } from './services/storage';
import { applyTheme } from './services/theme';
import { exitAllModes, rawList, settings, settingsMode, toggleEditMode } from './state';
import { LinkNodeFlat, Settings } from './types';
import { add, div } from './van';

function Overlay() {
  return div({ id: 'overlay-container' },
    settingsMode.val ? SettingsModal() : null,
  );
}

function Main() {
  return div({},
    div({ class: 'row' },
      () => TreeView(),
      SidePanel(),
    ),
  );
}

function applyListUpdate(list: LinkNodeFlat[]): void {
  applyNodeDefaults(list);
  rawList.val = list;
  void syncFaviconPermissionNotice();
}

function applySettingsUpdate(next: Settings): void {
  settings.val = next;
  applyTheme(next.theme);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
}

async function initializeApp(): Promise<void> {
  try {
    const [storedList, storedSettings] = await Promise.all([loadList(), loadSettings()]);
    applyListUpdate(storedList);
    applySettingsUpdate(storedSettings);

    add(document.body,
      () => Overlay(),
      Main(),
      Footer(),
    );

    void printStartupInfo();

    // Keep this tab in sync with edits made in other tabs/devices
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      if (changes[LIST_STORAGE_KEY]) {
        applyListUpdate((changes[LIST_STORAGE_KEY].newValue as LinkNodeFlat[] | undefined) ?? []);
      }
      if (changes[SETTINGS_STORAGE_KEY]) {
        applySettingsUpdate(changes[SETTINGS_STORAGE_KEY].newValue as Settings);
      }
    });

    addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitAllModes();
      } else if ((event.key === '`' || event.key === '~') && !isTypingTarget(event.target)) {
        toggleEditMode();
      }
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to load data. Please refresh the page to try again.');
  }
}

void initializeApp();
