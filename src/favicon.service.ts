import { AppState } from './app.state';
import { ICONS } from './constants';
import { StorageService } from './storage.service';
import { FaviconProvider, LinkNodeFlat } from './types';

export class FaviconService {
  // Cache for favicon URLs to avoid redundant URL parsing
  // REVIEW: is this even useful?
  private static faviconCache: Map<string, string> = new Map();
  // REVIEW: This seems pretty extra when we could just include a svg icon in filesystem
  private static _genericIconBlob: string;
  private static get genericIconBlob(): string {
    if (!this._genericIconBlob) {
      this._genericIconBlob = svgToUrl(ICONS.LINK);
    }
    return this._genericIconBlob;
  }

  static displayIcon(node: LinkNodeFlat): boolean {
    if (!node.url) return false;
    if (node.icon === FaviconProvider.None) return false;
    // Hide if in edit mode
    if (AppState.editMode.val) return false;
    return true;
  }

  static getIcon(urlStr: string, provider?: FaviconProvider): string {
    const url = new URL(urlStr);
    
    switch (provider) {
      // Chrome built-in favicon cache
      case FaviconProvider.Chrome:
        const cacheUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        cacheUrl.searchParams.set("pageUrl", urlStr);
        cacheUrl.searchParams.set("size", "32");
        return cacheUrl.toString();
      case FaviconProvider.DuckDuckGo:
        // Return from cache if available
        if (this.faviconCache.has(urlStr)) {
          return this.faviconCache.get(urlStr)!;
        }
        try {
          // Use DuckDuckGo's favicon service instead of hardcoded URLs
          const result = `https://icons.duckduckgo.com/ip2/${url.hostname}.ico`;
          this.faviconCache.set(urlStr, result);
          return result;
        } catch (error) {
          console.error('Invalid URL for favicon:', urlStr, error);
          const fallback = '/static/icons/icon48.png';
          this.faviconCache.set(urlStr, fallback);
          return fallback; // Fallback to default favicon
        }
      case FaviconProvider.Generic:
        return this.genericIconBlob;
      case FaviconProvider.None:
        return 'undefined';
      default:
        console.warn(`Unknown favicon provider: ${provider}`);
        return 'undefined';
    }
  }

  static async shouldRequestPermission() {
    console.log(`Checking favicon permission`)
    const faviconPermission = await chrome.permissions.contains({permissions: ['favicon']});
    console.log(`Granted favicon permission:`, faviconPermission)
    // Already granted permission
    if (faviconPermission) return false;
    // Request permission if any nodes are depending on the Chrome favicon provider
    return !!AppState.rawList.val.find(node => node.icon === FaviconProvider.Chrome);
  }

  static async requestFaviconPermissions() {
    if (await this.shouldRequestPermission()) {
      const granted = await chrome.permissions.request({permissions: ['favicon']});
      if (granted) {
        console.log(`Favicon permission granted`)
        AppState.removeFooterMessage('request-favicon-permission');
        // Force a reload to reload favicons
        location.reload();
      } else {
        console.log(`Favicon permission denied. Please change the icon setting for all all items to a different provider to dismiss this message.`)
      }
    }
  }
}

function svgToUrl(svg: string): string {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  return url;
}