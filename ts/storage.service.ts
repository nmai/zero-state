import { AppState } from './app.state';
import { CURRENT_LIST_VERSION, DEFAULT_SETTINGS, SETTINGS_VERSION } from './constants';
import { FaviconProvider, LinkNodeFlat, Settings } from './types';

// Storage Service
export class StorageService {
  // Cache for the last saved list to avoid unnecessary storage operations
  private static lastSavedListJson: string = '';
  private static lastSavedSettingsJson: string = '';

  /**
   * Change this to use max bytes after migrating away from single list
   */
  static async printStartupInfo() {
    const bytesInUse = await chrome.storage.sync.getBytesInUse("links-v1");
    const maxBytes = chrome.storage.sync.QUOTA_BYTES_PER_ITEM;
    console.log(`Bytes in use: ${bytesInUse} (${Math.ceil(bytesInUse/maxBytes*100)}%)`);
  }

  static save(list: LinkNodeFlat[]): Promise<void> {
    // Clone to break references and clean
    const cloneList = JSON.parse(JSON.stringify(list)) as LinkNodeFlat[];
    
    // Remove any transient properties
    cloneList.forEach((n: any) => delete n.children);

    // Check if the list has actually changed to avoid unnecessary storage operations
    const listJson = JSON.stringify(cloneList);
    if (this.lastSavedListJson === listJson) {
      console.log('No changes, skipping save operation');
      return Promise.resolve(); // No changes, skip save operation
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

  static load(): Promise<LinkNodeFlat[]> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(CURRENT_LIST_VERSION, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          const data = result[CURRENT_LIST_VERSION] as LinkNodeFlat[] | undefined;
          if (data) {
            this.lastSavedListJson = JSON.stringify(data);
          }
          resolve(data || []);
        }
      });
    });
  }

  static saveSettings(settings: Settings): Promise<void> {
    // Check if the settings have actually changed to avoid unnecessary storage operations
    const settingsJson = JSON.stringify(settings);
    if (this.lastSavedSettingsJson === settingsJson) {
      console.log('No changes to settings, skipping save operation');
      return Promise.resolve(); // No changes, skip save operation
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
    console.log('Parsing node list', nodes);
    nodes.forEach((node) => {
      // Favicon-related options
      if (node.url) {
        if (node.border === undefined) {
          node.border = 1;
        }
        if (node.icon === undefined) {
          node.icon = FaviconProvider.Chrome;
        }
      } else {
        // Cleanup
        delete node.border;
        delete node.icon;
      }
      if (!node.taskComplete) {
        // Cleanup
        delete node.taskComplete;
      }
    });
  }
}