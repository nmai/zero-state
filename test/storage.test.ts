import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/constants';
import { applyNodeDefaults, mergeSettings } from '../src/services/storage';
import { FaviconProvider, LinkNodeFlat } from '../src/types';

describe('mergeSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps stored values and fills in missing keys with defaults', () => {
    const merged = mergeSettings({ theme: 'dark' });
    expect(merged.theme).toBe('dark');
    expect(merged.enableRightClickComplete).toBe(DEFAULT_SETTINGS.enableRightClickComplete);
    expect(merged.defaultFaviconProvider).toBe(DEFAULT_SETTINGS.defaultFaviconProvider);
  });

  it('does not leak a DEFAULT_SETTINGS key into the result', () => {
    // Regression: the old code spread { DEFAULT_SETTINGS, ...data }
    expect(Object.keys(mergeSettings({}))).toEqual(Object.keys(DEFAULT_SETTINGS));
  });
});

describe('applyNodeDefaults', () => {
  it('defaults border and icon for URL nodes', () => {
    const nodes: LinkNodeFlat[] = [{ name: 'a', url: 'https://x.com' }];
    applyNodeDefaults(nodes);
    expect(nodes[0].border).toBe(1);
    expect(nodes[0].icon).toBe(FaviconProvider.Chrome);
  });

  it('strips favicon options and falsy taskComplete from URL-less nodes', () => {
    const nodes = [
      { name: 'a', icon: FaviconProvider.Chrome, border: 1, taskComplete: false },
    ] as unknown as LinkNodeFlat[];
    applyNodeDefaults(nodes);
    expect(nodes[0]).toEqual({ name: 'a' });
  });

  it('preserves explicit values on URL nodes', () => {
    const nodes: LinkNodeFlat[] = [
      { name: 'a', url: 'https://x.com', icon: FaviconProvider.None, border: 0, taskComplete: true },
    ];
    applyNodeDefaults(nodes);
    expect(nodes[0].icon).toBe(FaviconProvider.None);
    expect(nodes[0].border).toBe(0);
    expect(nodes[0].taskComplete).toBe(true);
  });
});
