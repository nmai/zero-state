import { SVG_ICONS } from '../core/constants';
import { FaviconProvider, LinkNodeFlat } from '../core/types';
import { DataState } from '../state/data.state';
import { UIState } from '../state/ui.state';

export class FaviconService {
  private static faviconCache: Map<string, string> = new Map();
  private static _genericIconBlob: string;
  private static get genericIconBlob(): string {
    if (!this._genericIconBlob) {
      this._genericIconBlob = svgToUrl(SVG_ICONS['link']);
    }
    return this._genericIconBlob;
  }

  static displayIcon(node: LinkNodeFlat): boolean {
    if (!node.url) return false;
    if (node.icon === FaviconProvider.None) return false;
    if (UIState.editMode.val) return false;
    return true;
  }

  static getIcon(urlStr: string, provider?: FaviconProvider): string {
    const url = new URL(urlStr);

    switch (provider) {
      case FaviconProvider.Chrome:
        const cacheUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        cacheUrl.searchParams.set("pageUrl", urlStr);
        cacheUrl.searchParams.set("size", "32");
        return cacheUrl.toString();
      case FaviconProvider.DuckDuckGo:
        if (this.faviconCache.has(urlStr)) {
          return this.faviconCache.get(urlStr)!;
        }
        try {
          const result = `https://icons.duckduckgo.com/ip2/${url.hostname}.ico`;
          this.faviconCache.set(urlStr, result);
          return result;
        } catch (error) {
          console.error('Invalid URL for favicon:', urlStr, error);
          const fallback = '/static/icons/icon48.png';
          this.faviconCache.set(urlStr, fallback);
          return fallback;
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
    const faviconPermission = await chrome.permissions.contains({permissions: ['favicon']});
    if (faviconPermission) return false;
    return !!DataState.rawList.val.find(node => node.icon === FaviconProvider.Chrome);
  }

  static async requestFaviconPermissions() {
    if (await this.shouldRequestPermission()) {
      const granted = await chrome.permissions.request({permissions: ['favicon']});
      if (granted) {
        console.log(`Favicon permission granted`);
        UIState.removeFooterMessage('request-favicon-permission');
        location.reload();
      } else {
        console.log(`Favicon permission denied. Change icon provider to dismiss this message.`);
      }
    }
  }
}

function svgToUrl(svg: string): string {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
}
