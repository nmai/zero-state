import { AppState } from './app.state';

export class FaviconService {
  // Cache for favicon URLs to avoid redundant URL parsing
  private static faviconCache: Map<string, string> = new Map();

  // Chrome built-in favicon cache. Seems inconsistent.
  static getIcon(urlStr: string): string {
    const url = new URL(urlStr);

    switch (AppState.settings.val.faviconProvider ?? 'chrome') {
      case 'chrome':
        const u = new URL(chrome.runtime.getURL("/_favicon/"));
        u.searchParams.set("pageUrl", urlStr);
        // u.searchParams.set("pageUrl", `https://${hostname}/`);
        u.searchParams.set("size", "32");
        return u.toString();
      case 'duckduckgo':
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
    }
  }

  static async shouldRequestPermission() {
    console.log(`Checking favicon permission`)
    if (AppState.settings.val.showFavicons) {
      const faviconPermission = await chrome.permissions.contains({permissions: ['favicon']});
      console.log(`Favicon permission`, faviconPermission)
      return !faviconPermission;
    }
    return false;
  }

  static async requestFaviconPermissions() {
    if (await this.shouldRequestPermission()) {
      const granted = await chrome.permissions.request({permissions: ['favicon']});
      if (granted) {
        console.log(`Favicon permission granted`)
      } else {
        console.log(`Favicon permission denied, disabling setting`)
      }
    }
  }
}