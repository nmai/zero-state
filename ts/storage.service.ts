import { CURRENT_LIST_VERSION, SETTINGS_VERSION } from './constants';
import { LinkNodeFlat, Settings } from './types';

// Storage Service
export class StorageService {
  // Cache for the last saved list to avoid unnecessary storage operations
  private static lastSavedListJson: string = '';
  private static lastSavedSettingsJson: string = '';

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

  static loadSettings(): Promise<Settings> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(SETTINGS_VERSION, (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error loading settings:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          const data = result[SETTINGS_VERSION] as Settings | undefined;
          
          const defaultSettings: Settings = {
            showFavicons: true,
            enableRightClickComplete: false,
            theme: 'system'
          };
          
          // Merge with default settings to ensure all properties exist
          const mergedSettings = data ? { ...defaultSettings, ...data } : defaultSettings;
          
          if (mergedSettings) {
            this.lastSavedSettingsJson = JSON.stringify(mergedSettings);
          }
          
          resolve(mergedSettings);
        }
      });
    });
  }
}