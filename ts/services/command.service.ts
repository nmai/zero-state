import { FaviconProvider, LinkNode, LinkNodeFlat, Settings } from '../core/types';
import { DataState } from '../state/data.state';
import { UIState } from '../state/ui.state';
import { FaviconService } from './favicon.service';
import { StorageService } from './storage.service';
import { applyTheme } from './theme.service';
import { TreeService } from './tree.service';

/**
 * Centralizes all state mutations that involve persistence.
 * Components call CommandService instead of directly using StorageService + state.
 */
export class CommandService {

  /** Save the current rawList and rebuild the tree. */
  static async saveAndRebuildTree(): Promise<void> {
    await StorageService.save(DataState.rawList.val);
    DataState.root.val = TreeService.buildTree(DataState.rawList.val);
  }

  static async deleteNode(node: LinkNodeFlat): Promise<void> {
    DataState.removeItem(node);
    try {
      await this.saveAndRebuildTree();
    } catch (error) {
      console.error('Failed to save after delete:', error);
      alert('Failed to delete item. Please try again.');
    }
  }

  static async moveNode(
    node: LinkNodeFlat,
    sibling: LinkNodeFlat,
  ): Promise<void> {
    DataState.swapNodePositions(node, sibling);
    try {
      await this.saveAndRebuildTree();
    } catch (error) {
      console.error('Failed to save after position change:', error);
      DataState.swapNodePositions(node, sibling); // Revert on failure
      alert('Failed to move item. Please try again.');
    }
  }

  static async toggleTaskComplete(node: LinkNodeFlat): Promise<void> {
    DataState.toggleTaskComplete(node);
    try {
      await StorageService.save(DataState.rawList.val);
    } catch (error) {
      console.error('Failed to save task status:', error);
      DataState.toggleTaskComplete(node); // Revert on failure
      alert('Failed to update task status. Please try again.');
    }
  }

  static async addItem(item: LinkNodeFlat): Promise<void> {
    DataState.addItem(item);
    try {
      await this.saveAndRebuildTree();
      if (await FaviconService.shouldRequestPermission()) {
        await FaviconService.requestFaviconPermissions();
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      DataState.removeItem(item); // Revert on failure
      alert('Failed to save. Please try again.');
    }
  }

  static async updateItem(originalName: string, item: LinkNodeFlat, newDefaultIcon?: FaviconProvider): Promise<void> {
    DataState.updateItem(originalName, item);

    if (newDefaultIcon !== undefined) {
      const newSettings = { ...DataState.settings.val, defaultFaviconProvider: newDefaultIcon };
      DataState.settings.val = newSettings;
      StorageService.saveSettings(newSettings).catch(error => {
        console.error('Failed to save settings:', error);
      });
    }

    try {
      await this.saveAndRebuildTree();
      if (await FaviconService.shouldRequestPermission()) {
        await FaviconService.requestFaviconPermissions();
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save. Please try again.');
    }
  }

  static async updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const newSettings = { ...DataState.settings.val, [key]: value };
    DataState.settings.val = newSettings;

    if (key === 'theme') {
      applyTheme(value as 'light' | 'dark' | 'system');
    }

    try {
      await StorageService.saveSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  /** Called on initial load and when storage changes externally. */
  static async handleListUpdate(list: LinkNodeFlat[]): Promise<void> {
    DataState.rawList.val = list;
    StorageService.applyNodeDefaults(list);
    DataState.updateNames();
    DataState.root.val = TreeService.buildTree(list);

    const needsPermission = await FaviconService.shouldRequestPermission();
    if (needsPermission) {
      UIState.addFooterMessage('request-favicon-permission');
    } else {
      UIState.removeFooterMessage('request-favicon-permission');
    }
  }

  static handleSettingsUpdate(settings: Settings): void {
    DataState.settings.val = settings;
    applyTheme(settings.theme);
  }
}
