import { ICONS } from '../constants';
import { FaviconProvider, LinkNodeFlat } from '../types';

const FALLBACK_ICON = '/static/icons/icon48.png';

let genericIconUrl: string | undefined;

function getGenericIconUrl(): string {
  if (!genericIconUrl) {
    const blob = new Blob([ICONS.LINK], { type: 'image/svg+xml' });
    genericIconUrl = URL.createObjectURL(blob);
  }
  return genericIconUrl;
}

export function getFaviconUrl(urlStr: string, provider: FaviconProvider): string {
  switch (provider) {
    case FaviconProvider.Chrome: {
      const cacheUrl = new URL(chrome.runtime.getURL('/_favicon/'));
      cacheUrl.searchParams.set('pageUrl', urlStr);
      cacheUrl.searchParams.set('size', '32');
      return cacheUrl.toString();
    }
    case FaviconProvider.DuckDuckGo:
      try {
        return `https://icons.duckduckgo.com/ip2/${new URL(urlStr).hostname}.ico`;
      } catch (error) {
        console.error('Invalid URL for favicon:', urlStr, error);
        return FALLBACK_ICON;
      }
    case FaviconProvider.Generic:
    default:
      return getGenericIconUrl();
  }
}

/** True when some node relies on the Chrome favicon cache but the optional permission isn't granted. */
export async function needsFaviconPermission(nodes: LinkNodeFlat[]): Promise<boolean> {
  const granted = await chrome.permissions.contains({ permissions: ['favicon'] });
  if (granted) return false;
  return nodes.some(node => node.icon === FaviconProvider.Chrome);
}

export async function requestFaviconPermission(): Promise<boolean> {
  return chrome.permissions.request({ permissions: ['favicon'] });
}
