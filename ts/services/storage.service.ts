import { CURRENT_LIST_VERSION, DEFAULT_SETTINGS, SETTINGS_VERSION } from '../core/constants';
import { FaviconProvider, LinkNodeFlat, Settings } from '../core/types';

export class StorageService {
  private static lastSavedListJson: string = '';
  private static lastSavedSettingsJson: string = '';

  static async printStartupInfo() {
    const bytesInUse = await chrome.storage.sync.getBytesInUse("links-v1");
    const maxBytes = chrome.storage.sync.QUOTA_BYTES_PER_ITEM;
    console.log(`Bytes in use: ${bytesInUse} (${Math.ceil(bytesInUse/maxBytes*100)}%)`);
  }

  static save(list: LinkNodeFlat[]): Promise<void> {
    const cloneList = JSON.parse(JSON.stringify(list)) as LinkNodeFlat[];
    cloneList.forEach((n: any) => delete n.children);

    const listJson = JSON.stringify(cloneList);
    if (this.lastSavedListJson === listJson) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [CURRENT_LIST_VERSION]: cloneList }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Data saved successfully');
          this.lastSavedListJson = listJson;
          resolve();
        }
      });
    });
  }

  static async load(): Promise<LinkNodeFlat[]> {
    const result = await chrome.storage.sync.get(CURRENT_LIST_VERSION);
    const data = result[CURRENT_LIST_VERSION] as LinkNodeFlat[] | undefined;
    if (data) {
      this.lastSavedListJson = JSON.stringify(data);
      return data;
    } else {
      console.log("No data found, loading initial-data JSON file instead...");
      const url = chrome.runtime.getURL('/static/json/initial-data-2.0.0.json');
      const response = await fetch(url);
      const initialData = await response.json();
      this.lastSavedListJson = JSON.stringify(initialData);
      return initialData;
    }
  }

  static saveSettings(settings: Settings): Promise<void> {
    const settingsJson = JSON.stringify(settings);
    if (this.lastSavedSettingsJson === settingsJson) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [SETTINGS_VERSION]: settings }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving settings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Settings saved successfully');
          this.lastSavedSettingsJson = settingsJson;
          resolve();
        }
      });
    });
  }

  static async loadSettings(): Promise<Settings> {
    const result = await chrome.storage.sync.get(SETTINGS_VERSION);
    const data = result[SETTINGS_VERSION] as Settings | undefined;

    const mergedSettings = data ? { DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;

    if (mergedSettings) {
      this.lastSavedSettingsJson = JSON.stringify(mergedSettings);
    }

    return mergedSettings;
  }

  static applyNodeDefaults(nodes: LinkNodeFlat[]) {
    nodes.forEach((node) => {
      if (node.url) {
        if (node.border === undefined) {
          node.border = 1;
        }
        if (node.icon === undefined) {
          node.icon = FaviconProvider.Chrome;
        }
      } else {
        delete node.border;
        delete node.icon;
      }
      if (!node.taskComplete) {
        delete node.taskComplete;
      }
    });
  }
}
